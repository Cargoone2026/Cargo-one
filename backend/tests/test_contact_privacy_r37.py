"""R37 — Contact-details reveal gate.

Ensures phone/email of the *other party* on a booking are hidden until:
  (a) deposit is paid  AND
  (b) a driver has ACTUALLY accepted / claimed the booking.

Scenarios covered:
  1. Paid ASAP booking with no driver claimed yet
        -> GET /api/bookings/{id}      -> other_party=None, driver_accepted=False
        -> GET /api/bookings/mine      -> same booking has other_party=None
  2. Unrelated driver tries to GET the booking -> 403
  3. After driver claim (simulated via Mongo set on job+booking):
        -> customer sees other_party with phone+email + driver_accepted=True
        -> assigned driver sees customer's other_party with phone+email
  4. Pre-payment regression: even with an assigned driver, if payment_status
     != "paid" the addresses AND other_party stay hidden.
"""
import os
import uuid
import pytest
import requests
import pymongo
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")


def _uniq(prefix):
    return f"TEST_r37_{prefix}_{uuid.uuid4().hex[:8]}@example.com"


@pytest.fixture(scope="module")
def db():
    client = pymongo.MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
    return client[os.environ.get("DB_NAME", "test_database")]


@pytest.fixture(scope="module")
def ctx(base_url, db):
    """Register 1 customer + 2 drivers, create fixed-price ASAP job + booking."""
    api = requests.Session()
    api.headers.update({"Content-Type": "application/json"})
    B = base_url.rstrip("/")

    customer = {
        "email": _uniq("cust"), "password": "Passw0rd!", "name": "R37 Customer",
        "role": "customer", "phone": "+441111100037",
    }
    driver_A = {
        "email": _uniq("drvA"), "password": "Passw0rd!", "name": "R37 Driver A",
        "role": "driver", "phone": "+442222200037",
    }
    driver_B = {
        "email": _uniq("drvB"), "password": "Passw0rd!", "name": "R37 Driver B",
        "role": "driver", "phone": "+443333300037",
    }
    tokens = {}
    ids = {}
    for label, payload in [("cust", customer), ("drvA", driver_A), ("drvB", driver_B)]:
        r = api.post(f"{B}/api/auth/register", json=payload, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        tokens[label] = d["access_token"]
        ids[label] = d["user"]["id"]

    # Customer creates a fixed-price ASAP job.  service_timing=asap must be
    # fixed-price so the pricing engine accepts it.
    hc = {"Authorization": f"Bearer {tokens['cust']}"}
    job_payload = {
        "title": "TEST R37 ASAP transport",
        "category": "transport",
        "description": "R37 privacy-gate fixture",
        "pickup_address": "10 Downing St, London", "pickup_town": "London",
        "pickup_lat": 51.5034, "pickup_lng": -0.1276,
        "dropoff_address": "1 Church Rd, Brighton", "dropoff_town": "Brighton",
        "dropoff_lat": 50.8225, "dropoff_lng": -0.1372,
        "collection_date": "2026-02-10", "delivery_date": "2026-02-10",
        "pricing_type": "fixed", "fixed_price": 200.0,
        "service_timing": "asap",
    }
    r = api.post(f"{B}/api/jobs", json=job_payload, headers=hc, timeout=20)
    assert r.status_code == 200, r.text
    job = r.json()

    # Create booking (still unpaid, no driver claimed).
    r = api.post(f"{B}/api/bookings", json={"job_id": job["id"]}, headers=hc, timeout=20)
    assert r.status_code == 200, r.text
    booking = r.json()

    yield {
        "api": api, "B": B, "tokens": tokens, "ids": ids,
        "job": job, "booking": booking,
    }


def _get_booking(ctx, token):
    return ctx["api"].get(
        f"{ctx['B']}/api/bookings/{ctx['booking']['id']}",
        headers={"Authorization": f"Bearer {token}"}, timeout=15,
    )


# ---------------------------------------------------------------------------
# Scenario 1  —  Paid, but driver has NOT claimed yet
# ---------------------------------------------------------------------------
class TestPaidButUnclaimed:
    @pytest.fixture(autouse=True)
    def _force_paid_no_driver(self, ctx, db):
        # Ensure driver_id is None on booking and assigned_driver_id None on job,
        # but payment_status = paid.
        db.bookings.update_one(
            {"id": ctx["booking"]["id"]},
            {"$set": {"payment_status": "paid", "driver_id": None,
                       "paid_at": "2026-01-15T00:00:00Z", "status": "deposit_paid"}},
        )
        db.jobs.update_one(
            {"id": ctx["job"]["id"]},
            {"$set": {"assigned_driver_id": None, "assigned_driver_name": None}},
        )

    def test_customer_get_hides_other_party(self, ctx):
        r = _get_booking(ctx, ctx["tokens"]["cust"])
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["payment_status"] == "paid"
        # R37: no driver -> other_party MUST be null.
        assert b.get("other_party") is None, b.get("other_party")
        assert b.get("driver_accepted") is False, b.get("driver_accepted")
        # Addresses are unlocked by payment (pre-existing behaviour we must not break).
        assert b["job"].get("pickup_address")
        assert b["job"].get("dropoff_address")

    def test_bookings_mine_hides_other_party(self, ctx):
        r = ctx["api"].get(
            f"{ctx['B']}/api/bookings/mine",
            headers={"Authorization": f"Bearer {ctx['tokens']['cust']}"}, timeout=15,
        )
        assert r.status_code == 200
        me_b = next((b for b in r.json() if b["id"] == ctx["booking"]["id"]), None)
        assert me_b is not None
        assert me_b.get("payment_status") == "paid"
        assert me_b.get("other_party") is None, me_b.get("other_party")

    def test_unassigned_driver_cannot_get_booking(self, ctx):
        # Neither driver is assigned yet — both should be 403.
        for label in ("drvA", "drvB"):
            r = _get_booking(ctx, ctx["tokens"][label])
            assert r.status_code == 403, f"{label}: {r.status_code} {r.text}"


# ---------------------------------------------------------------------------
# Scenario 2  —  Driver claim simulated (driver_id set on booking + job)
# ---------------------------------------------------------------------------
class TestAfterDriverClaim:
    @pytest.fixture(autouse=True)
    def _seed_claim(self, ctx, db):
        # Simulate a successful ASAP claim: driver A wins.
        driver_id = ctx["ids"]["drvA"]
        db.bookings.update_one(
            {"id": ctx["booking"]["id"]},
            {"$set": {"payment_status": "paid", "driver_id": driver_id,
                       "status": "accepted"}},
        )
        db.jobs.update_one(
            {"id": ctx["job"]["id"]},
            {"$set": {"assigned_driver_id": driver_id,
                       "assigned_driver_name": "R37 Driver A",
                       "status": "accepted"}},
        )

    def test_customer_sees_driver_contact(self, ctx):
        r = _get_booking(ctx, ctx["tokens"]["cust"])
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["driver_accepted"] is True
        assert b["other_party"] is not None
        op = b["other_party"]
        assert op["role"] == "driver"
        assert op["id"] == ctx["ids"]["drvA"]
        assert op["phone"] == "+442222200037"
        assert op["email"].lower().startswith("test_r37_drva_")

    def test_assigned_driver_sees_customer_contact(self, ctx):
        r = _get_booking(ctx, ctx["tokens"]["drvA"])
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["driver_accepted"] is True
        op = b["other_party"]
        assert op is not None
        assert op["role"] == "customer"
        assert op["id"] == ctx["ids"]["cust"]
        assert op["phone"] == "+441111100037"

    def test_other_driver_still_forbidden(self, ctx):
        r = _get_booking(ctx, ctx["tokens"]["drvB"])
        assert r.status_code == 403


# ---------------------------------------------------------------------------
# Scenario 3  —  Pre-payment regression: even w/ assigned driver, hide.
# ---------------------------------------------------------------------------
class TestPrePaymentPrivacyRegression:
    @pytest.fixture(autouse=True)
    def _assigned_but_unpaid(self, ctx, db):
        driver_id = ctx["ids"]["drvA"]
        db.bookings.update_one(
            {"id": ctx["booking"]["id"]},
            {"$set": {"payment_status": "pending", "driver_id": driver_id,
                       "status": "pending"}},
        )
        db.jobs.update_one(
            {"id": ctx["job"]["id"]},
            {"$set": {"assigned_driver_id": driver_id,
                       "assigned_driver_name": "R37 Driver A",
                       "status": "accepted"}},
        )

    def test_customer_pre_pay_addresses_and_contact_hidden(self, ctx):
        r = _get_booking(ctx, ctx["tokens"]["cust"])
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["payment_status"] == "pending"
        # Addresses hidden.
        assert "pickup_address" not in b["job"], b["job"].get("pickup_address")
        assert "dropoff_address" not in b["job"]
        # Contact hidden.
        assert b.get("other_party") is None
