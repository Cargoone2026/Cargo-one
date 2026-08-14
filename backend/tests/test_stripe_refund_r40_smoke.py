"""R40 — Stripe Refund End-to-End Smoke Test (R35/R36 deposit-only policy).

Runs against the LIVE Stripe test-mode account that /app/backend/.env is
pointing at. The whole point of this suite is to prove — with actual
Stripe.PaymentIntent + Stripe.Refund objects — that:

    Booking total  £675.00
    Deposit paid   £81.00      (server-side computed booking_fee)
    Post-accept    20% of deposit  →  £16.20
    Customer refund               →  £64.80  (exactly)
    Balance £594.00 is CANCELLED — never charged to the customer, never
    paid to the driver.

Also covers the edge cases:
  * Cancel BEFORE driver acceptance  → 0% fee, full deposit refunded
  * Cancel AFTER driver acceptance   → deposit-only fee applies
  * Deposit smaller than fee floor   → fee capped at deposit (no negative refund)
  * Same deposit, different total    → fee is invariant of full booking value
  * Client-injected refund amount    → server ignores; still deposit-only

Runs with a fresh disposable customer + driver per session; never mutates
seeded fixture accounts. Reuses the platform's DEFAULT_CANCELLATION_POLICY
(20 % of deposit). If the singleton policy doc in Mongo has been changed,
this test explicitly resets it back to defaults for the duration and
restores it on teardown.
"""

from __future__ import annotations

import os
import time
import uuid
from datetime import datetime, timezone

import pytest
import requests

# Load the same .env the server uses so MONGO_URL / STRIPE_API_KEY match.
# NB — the shell environment in this container ships a placeholder
# `STRIPE_API_KEY=sk_test_emergent`. `load_dotenv()` by default does NOT
# override existing env vars, so we pass `override=True` to force the real
# dedicated-account key from /app/backend/.env into the process.
from dotenv import load_dotenv

load_dotenv("/app/backend/.env", override=True)

import stripe  # noqa: E402  (imported after load_dotenv)

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL",
    "https://cargo-repo-bridge.preview.emergentagent.com",
).rstrip("/")
API = f"{BASE_URL}/api"

STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY", "").strip()
stripe.api_key = STRIPE_API_KEY

# Guard-rail: refuse to run this suite against the emergent proxy placeholder.
if STRIPE_API_KEY == "sk_test_emergent" or not STRIPE_API_KEY.startswith("sk_test_"):
    pytest.skip(
        f"STRIPE_API_KEY is not a Cargo One dedicated test key (got {STRIPE_API_KEY[:20]!r}). "
        "Run this suite from a shell where /app/backend/.env's real key is loaded.",
        allow_module_level=True,
    )

TEST_TAG = "r40_stripe_refund_smoke"


# ---------------------------------------------------------------------------
# Mongo helpers (we bypass the Stripe Checkout redirect by seeding the
# booking directly with a real PaymentIntent that we captured through
# stripe.PaymentIntent.create + confirm=True). Everything downstream —
# the /customer/bookings/{id}/cancel-and-refund endpoint — still runs
# unmodified.
# ---------------------------------------------------------------------------

def _mongo():
    from pymongo import MongoClient
    client = MongoClient(os.environ["MONGO_URL"])
    return client, client[os.environ["DB_NAME"]]


def _iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------

def _register(email: str, role: str, name: str) -> dict:
    """Register (or login if exists) and return {token, id}."""
    payload = {
        "email": email,
        "password": "Rr40Test!12345",
        "name": name,
        "phone": "+441234599999",
        "role": role,
    }
    r = requests.post(f"{API}/auth/register", json=payload, timeout=15)
    if r.status_code == 200:
        d = r.json()
        return {"token": d["access_token"], "id": d["user"]["id"]}
    # Duplicate — fall back to login.
    r = requests.post(
        f"{API}/auth/login",
        json={"email": email, "password": "Rr40Test!12345"},
        timeout=15,
    )
    r.raise_for_status()
    d = r.json()
    return {"token": d["access_token"], "id": d["user"]["id"]}


def _api(method: str, path: str, token: str | None = None, **kw):
    h = kw.pop("headers", {}) or {}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return requests.request(method, f"{API}{path}", headers=h, timeout=30, **kw)


# ---------------------------------------------------------------------------
# Stripe helpers — real API calls against test mode
# ---------------------------------------------------------------------------

def _capture_stripe_payment(amount_pence: int, booking_id: str) -> stripe.PaymentIntent:
    """Create a real captured PaymentIntent in Stripe TEST mode using
    the always-succeed test card (`pm_card_visa`). Returns the PI object
    with status='succeeded'.
    """
    pi = stripe.PaymentIntent.create(
        amount=amount_pence,
        currency="gbp",
        payment_method="pm_card_visa",
        confirm=True,
        automatic_payment_methods={"enabled": True, "allow_redirects": "never"},
        metadata={"cargoone_test": TEST_TAG, "booking_id": booking_id},
    )
    assert pi.status == "succeeded", f"PI not captured: {pi.status}"
    return pi


# ---------------------------------------------------------------------------
# Fixture: reset the cancellation policy to DEFAULTS (20% / post-accept)
# so this test is deterministic even if an admin has been tinkering.
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module", autouse=True)
def _pin_policy_to_defaults():
    """Snapshot then reset the singleton platform-config policy for the module.

    Uses direct Mongo — no admin token required. Restores on teardown.
    """
    client, db = _mongo()
    snapshot = db.platform_config.find_one({"id": "cancellation"})
    db.platform_config.update_one(
        {"id": "cancellation"},
        {"$set": {
            "id": "cancellation",
            "percentage": 20.0,
            "applies_after_driver_accept": True,
            "min_fee": 0.0,
            "max_fee": None,
            "updated_at": _iso(),
        }},
        upsert=True,
    )
    try:
        yield
    finally:
        if snapshot is None:
            db.platform_config.delete_one({"id": "cancellation"})
        else:
            snapshot.pop("_id", None)
            db.platform_config.replace_one({"id": "cancellation"}, snapshot, upsert=True)
        client.close()


@pytest.fixture(scope="module")
def customer():
    tag = uuid.uuid4().hex[:8]
    return _register(f"cust-{tag}@cargo-r40.example.com", "customer", f"R40 Customer {tag}")


@pytest.fixture(scope="module")
def driver():
    tag = uuid.uuid4().hex[:8]
    return _register(f"drv-{tag}@cargo-r40.example.com", "driver", f"R40 Driver {tag}")


# ---------------------------------------------------------------------------
# The setup that makes a booking directly in Mongo, then attaches a real
# captured Stripe PI to it. We do NOT go through the Stripe Checkout
# redirect because that requires a browser. Everything from
# `/customer/bookings/{id}/cancel-and-refund` onwards runs unmodified.
# ---------------------------------------------------------------------------

def _seed_paid_booking(
    customer_id: str,
    *,
    driver_charge: float,
    deposit: float,
    driver_id: str | None = None,        # None → pre-accept (marketplace not yet claimed)
    service_timing: str = "scheduled",   # matches the R36 platform-wide rule
) -> tuple[dict, stripe.PaymentIntent]:
    """Create a job + booking in Mongo, then capture a real Stripe PI for
    the deposit and stamp it onto the booking. Returns (booking, PI).
    """
    client, db = _mongo()
    try:
        job_id = f"r40-job-{uuid.uuid4().hex[:10]}"
        booking_id = f"r40-bkg-{uuid.uuid4().hex[:10]}"
        session_id = f"cs_test_r40_{uuid.uuid4().hex[:12]}"
        total = round(driver_charge + deposit, 2)

        db.jobs.insert_one({
            "id": job_id,
            "customer_id": customer_id,
            "title": "R40 refund smoke",
            "category_key": "furniture",
            "service_timing": service_timing,
            "service_type": "transport",
            "pricing_type": "fixed",
            "fixed_price": driver_charge,
            "accepted_price": driver_charge,
            "status": "accepted" if driver_id else "posted",
            "assigned_driver_id": driver_id,
            "assigned_driver_name": ("R40 Driver" if driver_id else None),
            "pickup_town": "London",
            "dropoff_town": "Reading",
            "created_at": _iso(),
        })
        db.bookings.insert_one({
            "id": booking_id,
            "job_id": job_id,
            "customer_id": customer_id,
            "driver_id": driver_id,
            "driver_charge": driver_charge,
            "booking_fee": deposit,
            "total_price": total,
            "customer_total": total,
            "deposit_amount": deposit,
            "balance_due": driver_charge,
            "status": "deposit_paid" if driver_id else "accepted",
            "payment_status": "paid",
            "stripe_session_id": session_id,
            "service_timing": service_timing,
            "service_type": "transport",
            "created_at": _iso(),
            "paid_at": _iso(),
        })

        # Capture a REAL Stripe PI for the deposit amount.
        pi = _capture_stripe_payment(int(round(deposit * 100)), booking_id)

        db.payment_transactions.insert_one({
            "id": f"txn-{uuid.uuid4().hex[:10]}",
            "session_id": session_id,
            "payment_intent_id": pi.id,
            "amount_total": int(round(deposit * 100)),
            "booking_id": booking_id,
            "customer_id": customer_id,
            "status": "paid",
            "refunds": [],
            "created_at": _iso(),
            "updated_at": _iso(),
        })

        booking = db.bookings.find_one({"id": booking_id}, {"_id": 0})
        return booking, pi
    finally:
        client.close()


# ---------------------------------------------------------------------------
# ---------  ACCEPTANCE CRITERION TEST  --------------------------------------
# ---------------------------------------------------------------------------

class TestPrimaryScenario:
    """£675 total, £81 deposit, driver accepted, 20% policy → £16.20 fee, £64.80 refund."""

    def test_stripe_refund_end_to_end(self, customer, driver):
        driver_charge = 594.00
        deposit = 81.00

        booking, pi = _seed_paid_booking(
            customer["id"],
            driver_charge=driver_charge,
            deposit=deposit,
            driver_id=driver["id"],           # driver has accepted
        )
        assert pi.amount == 8100
        assert pi.status == "succeeded"
        original_pi_id = pi.id

        # === CANCEL ==========================================================
        r = _api(
            "POST",
            f"/customer/bookings/{booking['id']}/cancel-and-refund",
            token=customer["token"],
        )
        assert r.status_code == 200, r.text
        payload = r.json()

        # ---- Response payload — server-computed breakdown --------------------
        bd = payload["cancellation_breakdown"]
        assert bd["deposit_paid"] == 81.00
        assert bd["cancellation_pct"] == 20.0
        assert bd["cancellation_fee"] == 16.20
        assert bd["refund_amount"] == 64.80
        assert bd["driver_accepted_before_cancel"] is True
        assert bd["policy_applied"] is True
        assert payload["refund_state"] == "succeeded"
        refund_id = payload["stripe_refund_id"]
        assert refund_id and refund_id.startswith("re_")

        # ---- LIVE STRIPE VERIFICATION ---------------------------------------
        refund_obj = stripe.Refund.retrieve(refund_id)
        assert refund_obj.amount == 6480, (
            f"Stripe refund amount is {refund_obj.amount} pence, "
            f"expected exactly 6480 (£64.80)."
        )
        assert refund_obj.currency == "gbp"
        assert refund_obj.payment_intent == original_pi_id
        assert refund_obj.status in ("succeeded", "pending")

        pi_after = stripe.PaymentIntent.retrieve(original_pi_id)
        assert pi_after.amount == 8100, "Original charge must remain £81, not the full £675."
        assert pi_after.amount_received == 8100

        # No second charge for the £594 balance must exist against this PI.
        charges = pi_after.charges.data if hasattr(pi_after, "charges") else []
        assert len(charges) <= 1
        if charges:
            assert charges[0].amount == 8100
            # Stripe records the refunded portion — must be exactly £64.80.
            assert charges[0].amount_refunded == 6480

        # ---- Mongo booking state --------------------------------------------
        _, db = _mongo()
        b_after = db.bookings.find_one({"id": booking["id"]}, {"_id": 0})
        assert b_after["cancelled_at"] is not None
        assert b_after["refund_status"] == "succeeded"
        assert b_after["refund_amount"] == 64.80
        assert b_after["stripe_refund_id"] == refund_id
        assert b_after["cancellation_breakdown"]["refund_amount"] == 64.80
        assert b_after["cancellation_breakdown"]["cancellation_fee"] == 16.20

        # Anti-bypass counter must have incremented on the customer.
        u = db.users.find_one({"id": customer["id"]}, {"_id": 0})
        assert (u.get("post_accept_cancel_count") or 0) >= 1
        # And the exact booking must be in the history.
        hist_ids = [h["booking_id"] for h in (u.get("post_accept_cancel_history") or [])]
        assert booking["id"] in hist_ids

        # ---- Driver payout: no ledger row credited for the cancelled balance -
        # We don't run our own payouts through Stripe Connect on this account,
        # but if a `driver_earnings` collection exists, no £594 row must have
        # been created against this booking.
        earnings = list(db.driver_earnings.find({"booking_id": booking["id"]}))
        assert earnings == []


# ---------------------------------------------------------------------------
# ---------  EDGE CASE TESTS  ------------------------------------------------
# ---------------------------------------------------------------------------

class TestEdgeCases:

    def test_cancel_before_driver_accept_gives_full_refund(self, customer):
        """Pre-accept cancels are FREE — deposit is fully refunded."""
        booking, pi = _seed_paid_booking(
            customer["id"],
            driver_charge=594.00,
            deposit=81.00,
            driver_id=None,       # NOT accepted
        )
        r = _api(
            "POST",
            f"/customer/bookings/{booking['id']}/cancel-and-refund",
            token=customer["token"],
        )
        assert r.status_code == 200, r.text
        bd = r.json()["cancellation_breakdown"]
        assert bd["driver_accepted_before_cancel"] is False
        assert bd["cancellation_fee"] == 0.0
        assert bd["refund_amount"] == 81.00

        refund_id = r.json()["stripe_refund_id"]
        refund_obj = stripe.Refund.retrieve(refund_id)
        assert refund_obj.amount == 8100

    def test_same_deposit_different_total_yields_same_fee(self, customer, driver):
        """Fee is a % of DEPOSIT — must not vary with the full booking total."""
        # £81 deposit, but the full booking is only £150 total (£69 driver charge).
        booking, _pi = _seed_paid_booking(
            customer["id"],
            driver_charge=69.00,
            deposit=81.00,
            driver_id=driver["id"],
        )
        r = _api(
            "POST",
            f"/customer/bookings/{booking['id']}/cancel-and-refund",
            token=customer["token"],
        )
        assert r.status_code == 200
        bd = r.json()["cancellation_breakdown"]
        assert bd["cancellation_fee"] == 16.20   # same as the £675 case
        assert bd["refund_amount"] == 64.80

    def test_client_cannot_manipulate_refund_amount(self, customer, driver):
        """Server ignores any refund_amount / fee override the client posts."""
        booking, _pi = _seed_paid_booking(
            customer["id"],
            driver_charge=594.00,
            deposit=81.00,
            driver_id=driver["id"],
        )
        # Attempt to inject a bigger refund via body.
        r = _api(
            "POST",
            f"/customer/bookings/{booking['id']}/cancel-and-refund",
            token=customer["token"],
            json={"refund_amount": 999999, "cancellation_fee": 0, "override": True},
        )
        assert r.status_code == 200
        bd = r.json()["cancellation_breakdown"]
        assert bd["cancellation_fee"] == 16.20
        assert bd["refund_amount"] == 64.80

        refund_id = r.json()["stripe_refund_id"]
        assert stripe.Refund.retrieve(refund_id).amount == 6480

    def test_customer_cannot_cancel_someone_elses_booking(self, customer, driver):
        """Booking ownership is enforced — third parties get 403."""
        booking, _pi = _seed_paid_booking(
            customer["id"],
            driver_charge=594.00,
            deposit=81.00,
            driver_id=driver["id"],
        )
        other = _register(f"other-{uuid.uuid4().hex[:6]}@cargo-r40.example.com", "customer", "Other")
        r = _api(
            "POST",
            f"/customer/bookings/{booking['id']}/cancel-and-refund",
            token=other["token"],
        )
        assert r.status_code == 403

    def test_min_fee_cap_never_exceeds_deposit(self, customer, driver):
        """If policy min_fee > deposit, fee is capped at deposit; refund cannot be negative."""
        client, db = _mongo()
        original = db.platform_config.find_one({"id": "cancellation"})
        try:
            db.platform_config.update_one(
                {"id": "cancellation"},
                {"$set": {
                    "id": "cancellation",
                    "percentage": 20.0,
                    "applies_after_driver_accept": True,
                    "min_fee": 500.0,          # much larger than the £10 deposit
                    "max_fee": None,
                }},
                upsert=True,
            )
            booking, _pi = _seed_paid_booking(
                customer["id"],
                driver_charge=90.00,
                deposit=10.00,
                driver_id=driver["id"],
            )
            r = _api(
                "POST",
                f"/customer/bookings/{booking['id']}/cancel-and-refund",
                token=customer["token"],
            )
            assert r.status_code == 200, r.text
            bd = r.json()["cancellation_breakdown"]
            assert bd["cancellation_fee"] == 10.00   # capped at deposit
            assert bd["refund_amount"] == 0.0        # never negative

            # £0 refund case — Stripe was NOT called (nothing to refund).
            assert r.json()["stripe_refund_id"] is None
        finally:
            if original is None:
                db.platform_config.delete_one({"id": "cancellation"})
            else:
                original.pop("_id", None)
                db.platform_config.replace_one({"id": "cancellation"}, original, upsert=True)
            client.close()

    def test_double_cancel_is_rejected(self, customer, driver):
        """A booking cannot be cancelled/refunded twice — 409 on the second attempt."""
        booking, _pi = _seed_paid_booking(
            customer["id"],
            driver_charge=594.00,
            deposit=81.00,
            driver_id=driver["id"],
        )
        r1 = _api(
            "POST",
            f"/customer/bookings/{booking['id']}/cancel-and-refund",
            token=customer["token"],
        )
        assert r1.status_code == 200

        r2 = _api(
            "POST",
            f"/customer/bookings/{booking['id']}/cancel-and-refund",
            token=customer["token"],
        )
        assert r2.status_code == 409
