"""Final QA Round 19 — Customer self-service cancel-and-refund for ASAP bookings.

Covers the new POST /api/customer/bookings/{booking_id}/cancel-and-refund endpoint.

Approach:
  * Login as testcustomer / testdriver / admin.
  * Directly seed a paid ASAP booking + confirmed job in Mongo (bypassing
    Stripe checkout) so we can exercise every branch without needing a real
    payment_intent. The refund step may return 502 in preview because the
    synthetic bookings have no real payment_intent — that's OK and covered
    explicitly below. The AUDIT trail must still be written before the
    Stripe call fails, so we assert the booking transitions to cancelled
    even on refund failure.

Test matrix (spec P0):
  a. Anonymous → 401
  b. Driver token → 403
  c. Admin token → 403
  d. Non-owner customer → 403
  e. Non-ASAP scheduled booking → 400
  f. Unpaid ASAP booking → 400
  g. Already-claimed ASAP booking → 409
  h. Happy path — job gets cancelled, booking gets cancelled_at, refund
     audit row is appended, refund_status is one of {succeeded, pending,
     failed} depending on whether Stripe can reach a payment_intent.
     The customer/dispatch endpoint no longer surfaces the job as active.
  i. Second immediate call → 409 (already cancelled/refund in progress).
  j. Race safety — customer cancel and driver claim in parallel: exactly
     one succeeds, the other returns 409. Booking is NEVER left in the
     invalid state (refund_state != failed) AND (assigned_driver_id set).
"""
from __future__ import annotations

import asyncio
import os
import uuid
import threading
import time
from typing import Optional

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@cargoone.com"
ADMIN_PASSWORD = "Vc9O0sNDGR6SfzKDaa0L1lhp"
CUSTOMER_EMAIL = "testcustomer@example.com"
CUSTOMER_PASSWORD = "CustomerTest12345!"
DRIVER_EMAIL = "testdriver@example.com"
DRIVER_PASSWORD = "DriverTest12345!"


def _bearer(tok):
    return {"Authorization": f"Bearer {tok}"}


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login failed {email}: {r.status_code} {r.text[:200]}"
    return r.json()["access_token"]


def _me(tok):
    r = requests.get(f"{API}/auth/me", headers=_bearer(tok), timeout=20)
    assert r.status_code == 200, f"/auth/me failed: {r.status_code} {r.text[:200]}"
    return r.json()


# ---- Direct Mongo helpers ---------------------------------------------------
# We seed jobs/bookings straight into mongodb://localhost:27017 to bypass
# the Stripe checkout flow. All docs are prefixed TEST_R19 for cleanup.


def _mongo_db():
    from pymongo import MongoClient
    client = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
    return client[os.environ.get("DB_NAME", "test_database")]


def _now_iso():
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()


def _seed_asap_paid(customer_id: str, *, claimed_by: Optional[str] = None,
                    payment_status: str = "paid",
                    service_timing: str = "asap") -> tuple[str, str]:
    """Insert a job + booking pair straight into Mongo and return (job_id, booking_id)."""
    db = _mongo_db()
    job_id = str(uuid.uuid4())
    booking_id = str(uuid.uuid4())
    job = {
        "id": job_id,
        "customer_id": customer_id,
        "title": f"TEST_R19 seeded {job_id[:8]}",
        "category": "Furniture",
        "description": "R19 pytest — seeded ASAP job.",
        "service_timing": service_timing,
        "service_type": "transport",
        "transport_category": "pallets",
        "pickup_address": "10 Downing St, London",
        "pickup_lat": 51.5034,
        "pickup_lng": -0.1276,
        "dropoff_address": "1 Oxford St, London",
        "dropoff_lat": 51.5152,
        "dropoff_lng": -0.1418,
        "pricing_type": "fixed",
        "fixed_price": 120.0,
        "status": "confirmed" if not claimed_by else "accepted",
        "assigned_driver_id": claimed_by,
        "created_at": _now_iso(),
        "dispatch_started_at": _now_iso(),
    }
    booking = {
        "id": booking_id,
        "job_id": job_id,
        "customer_id": customer_id,
        "driver_id": claimed_by,
        "driver_charge": 120.0,
        "booking_fee": 15.0,
        "total_price": 135.0,
        "deposit_amount": 15.0,
        "balance_due": 120.0,
        "status": "deposit_paid" if payment_status == "paid" else "accepted",
        "payment_status": payment_status,
        "stripe_session_id": f"cs_test_R19_{booking_id[:8]}",
        "service_timing": service_timing,
        "service_type": "transport",
        "created_at": _now_iso(),
    }
    db.jobs.insert_one(job)
    db.bookings.insert_one(booking)
    # Match payment_transactions structure the endpoint expects.
    db.payment_transactions.insert_one({
        "session_id": booking["stripe_session_id"],
        "booking_id": booking_id,
        "amount": 15.0,
        "payment_status": payment_status,
        "created_at": _now_iso(),
    })
    return job_id, booking_id


def _get_booking(booking_id):
    db = _mongo_db()
    return db.bookings.find_one({"id": booking_id}, {"_id": 0})


def _get_job(job_id):
    db = _mongo_db()
    return db.jobs.find_one({"id": job_id}, {"_id": 0})


# ---- Fixtures ---------------------------------------------------------------

@pytest.fixture(scope="module")
def customer_tok():
    return _login(CUSTOMER_EMAIL, CUSTOMER_PASSWORD)


@pytest.fixture(scope="module")
def driver_tok():
    return _login(DRIVER_EMAIL, DRIVER_PASSWORD)


@pytest.fixture(scope="module")
def admin_tok():
    return _login(ADMIN_EMAIL, ADMIN_PASSWORD)


@pytest.fixture(scope="module")
def customer_id(customer_tok):
    return _me(customer_tok)["id"]


@pytest.fixture(scope="module", autouse=True)
def _cleanup_after():
    yield
    try:
        db = _mongo_db()
        db.jobs.delete_many({"title": {"$regex": "^TEST_R19"}})
        db.bookings.delete_many({"stripe_session_id": {"$regex": "^cs_test_R19"}})
        db.payment_transactions.delete_many({"session_id": {"$regex": "^cs_test_R19"}})
    except Exception as exc:  # pragma: no cover
        print(f"[cleanup] warn: {exc}")


# ---- Tests ------------------------------------------------------------------

def test_anonymous_returns_401():
    r = requests.post(f"{API}/customer/bookings/does-not-matter/cancel-and-refund", timeout=15)
    assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}"


def test_driver_token_forbidden(driver_tok, customer_id):
    job_id, booking_id = _seed_asap_paid(customer_id)
    r = requests.post(f"{API}/customer/bookings/{booking_id}/cancel-and-refund",
                      headers=_bearer(driver_tok), timeout=15)
    assert r.status_code == 403, f"expected 403 for driver, got {r.status_code}: {r.text[:200]}"


def test_admin_token_forbidden(admin_tok, customer_id):
    job_id, booking_id = _seed_asap_paid(customer_id)
    r = requests.post(f"{API}/customer/bookings/{booking_id}/cancel-and-refund",
                      headers=_bearer(admin_tok), timeout=15)
    assert r.status_code == 403, f"expected 403 for admin, got {r.status_code}: {r.text[:200]}"


def test_not_your_booking_forbidden(customer_tok):
    # Seed a booking owned by a different customer id (fabricated uuid).
    fake_owner = str(uuid.uuid4())
    _, booking_id = _seed_asap_paid(fake_owner)
    r = requests.post(f"{API}/customer/bookings/{booking_id}/cancel-and-refund",
                      headers=_bearer(customer_tok), timeout=15)
    assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text[:200]}"


def test_booking_not_found(customer_tok):
    r = requests.post(f"{API}/customer/bookings/nope-{uuid.uuid4().hex}/cancel-and-refund",
                      headers=_bearer(customer_tok), timeout=15)
    assert r.status_code == 404


def test_non_asap_scheduled_returns_400(customer_tok, customer_id):
    _, booking_id = _seed_asap_paid(customer_id, service_timing="scheduled")
    r = requests.post(f"{API}/customer/bookings/{booking_id}/cancel-and-refund",
                      headers=_bearer(customer_tok), timeout=15)
    assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text[:200]}"
    assert "asap" in r.text.lower()


def test_unpaid_asap_returns_400(customer_tok, customer_id):
    _, booking_id = _seed_asap_paid(customer_id, payment_status="pending")
    r = requests.post(f"{API}/customer/bookings/{booking_id}/cancel-and-refund",
                      headers=_bearer(customer_tok), timeout=15)
    assert r.status_code == 400, f"expected 400 unpaid, got {r.status_code}: {r.text[:200]}"


def test_already_claimed_asap_returns_409(customer_tok, customer_id):
    fake_driver = str(uuid.uuid4())
    _, booking_id = _seed_asap_paid(customer_id, claimed_by=fake_driver)
    r = requests.post(f"{API}/customer/bookings/{booking_id}/cancel-and-refund",
                      headers=_bearer(customer_tok), timeout=15)
    assert r.status_code == 409, f"expected 409, got {r.status_code}: {r.text[:200]}"
    assert "accept" in r.text.lower() or "no longer" in r.text.lower()


def test_happy_path_cancels_and_audits(customer_tok, customer_id):
    job_id, booking_id = _seed_asap_paid(customer_id)
    r = requests.post(f"{API}/customer/bookings/{booking_id}/cancel-and-refund",
                      headers=_bearer(customer_tok), timeout=30)
    # In preview: 200 (Stripe returns pending/succeeded) OR 502 (no real
    # payment_intent on synthetic session). Either is acceptable per spec.
    assert r.status_code in (200, 502), f"unexpected status {r.status_code}: {r.text[:300]}"

    # Booking transitions to cancelled regardless of refund outcome.
    b = _get_booking(booking_id)
    assert b is not None
    assert b.get("cancelled_at"), f"booking not marked cancelled: {b}"
    assert b.get("refund_status") in ("succeeded", "pending", "failed", "in_progress"), b.get("refund_status")

    # Audit row appended.
    refunds = b.get("refunds") or []
    assert len(refunds) >= 1, f"no audit entry appended: {b}"
    entry = refunds[-1]
    assert entry.get("customer_id") == customer_id
    assert entry.get("reason") == "customer_asap_cancel_full_refund"

    # Job is now cancelled.
    j = _get_job(job_id)
    assert j.get("status") == "cancelled", f"job not cancelled: {j}"
    assert j.get("cancelled_by") == "customer"


def test_second_call_returns_409(customer_tok, customer_id):
    job_id, booking_id = _seed_asap_paid(customer_id)
    r1 = requests.post(f"{API}/customer/bookings/{booking_id}/cancel-and-refund",
                       headers=_bearer(customer_tok), timeout=30)
    assert r1.status_code in (200, 502)
    r2 = requests.post(f"{API}/customer/bookings/{booking_id}/cancel-and-refund",
                       headers=_bearer(customer_tok), timeout=15)
    # Second call must NOT succeed. 409 is expected.
    assert r2.status_code == 409, f"expected 409 on repeat, got {r2.status_code}: {r2.text[:200]}"


def test_race_safety_customer_cancel_vs_driver_claim(customer_tok, customer_id):
    """Simulate concurrent customer cancel + driver claim (simulated in Mongo).

    Because we can't easily orchestrate a real driver claim (requires
    online status, location, docs), we simulate the driver-wins race by
    performing a direct Mongo update to `assigned_driver_id` at the same
    moment the customer POST fires. Exactly one of the two writes must
    reach cancelled/refunded state — the other must fail with 409, and
    the booking must NEVER end up with BOTH assigned_driver_id AND
    refund_status='succeeded' or 'pending'.
    """
    results = {"http": None, "mongo": None}

    def _do_cancel():
        try:
            resp = requests.post(
                f"{API}/customer/bookings/{booking_id}/cancel-and-refund",
                headers=_bearer(customer_tok), timeout=30,
            )
            results["http"] = resp.status_code
        except Exception as e:  # pragma: no cover
            results["http"] = f"exc:{e}"

    fake_driver = str(uuid.uuid4())

    for attempt in range(3):
        job_id, booking_id = _seed_asap_paid(customer_id)
        db = _mongo_db()

        def _driver_claim():
            # Simulate the atomic claim step of /jobs/{job_id}/claim.
            res = db.jobs.update_one(
                {
                    "id": job_id,
                    "service_timing": "asap",
                    "status": {"$in": ["confirmed", "dispatch_ready"]},
                    "assigned_driver_id": None,
                    "cancelled_at": {"$exists": False},
                },
                {"$set": {
                    "status": "accepted",
                    "assigned_driver_id": fake_driver,
                    "accepted_at": _now_iso(),
                }},
            )
            results["mongo"] = res.modified_count

        t1 = threading.Thread(target=_do_cancel)
        t2 = threading.Thread(target=_driver_claim)
        t1.start(); t2.start()
        t1.join(); t2.join()

        j = _get_job(job_id)
        b = _get_booking(booking_id)

        # INVARIANT: never a state where refund succeeded AND driver is assigned.
        refund_ok = (b or {}).get("refund_status") in ("succeeded", "pending", "in_progress")
        driver_won = j.get("status") == "accepted" and j.get("assigned_driver_id") == fake_driver
        cust_won = j.get("status") == "cancelled" and j.get("cancelled_by") == "customer"

        # At least one won, and they didn't both win.
        assert not (driver_won and cust_won), f"BOTH won! job={j} booking={b}"
        assert driver_won or cust_won, f"neither won! job={j} booking={b}"

        # If driver won → refund must NOT be success/pending AND HTTP must be 409.
        if driver_won:
            assert (b or {}).get("refund_status") not in ("succeeded", "pending"), \
                f"refund succeeded despite driver winning: {b}"
            assert results["http"] == 409, f"expected HTTP 409 when driver won, got {results['http']}"
            return  # observed the race path — done
        # If customer won → HTTP was 200 or 502, refund audit row exists.
        if cust_won:
            assert results["http"] in (200, 502), f"unexpected {results['http']} when cust won"
            assert refund_ok or (b or {}).get("refund_status") == "failed"
    # If we get here, we never observed the driver-wins branch across 3 tries.
    # That's not a failure — it just means our thread interleave landed the
    # customer first every time. The invariants above passed each iteration.
