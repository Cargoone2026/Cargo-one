"""Tests for the updated Cargo One booking-fee pricing model.

Semantics:
- Driver bid == amount driver receives on delivery (`driver_charge`).
- Cargo One `booking_fee` is added on top based on configurable bands
  (bands are matched against `driver_charge`, not against a customer total).
- `customer_total` = `driver_charge` + `booking_fee`.
- Legacy Booking fields are preserved:
    total_price   == customer_total
    deposit_amount == booking_fee
    balance_due   == driver_charge

Endpoints under test:
- GET /api/booking-fees/preview?driver_charge=X (new)
- GET /api/deposit-bands/preview?price=X (legacy alias, same payload)
- POST /api/bookings (fixed + bidding flows)
- POST /api/bookings/{id}/deposit (Stripe amount == booking_fee)
- Fallback to DEPOSIT_PERCENTAGE=0.10 of driver_charge when all bands disabled.
- Admin CRUD /api/admin/deposit-bands & public GET /api/deposit-bands (no regression).
"""
import os
import uuid

import pymongo
import pytest
import requests


# --------------------------------------------------------------------------- helpers

def _uniq_email(prefix):
    return f"test_bf_{prefix}_{uuid.uuid4().hex[:10]}@example.com"


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def mongo():
    client = pymongo.MongoClient(
        os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
    db = client[os.environ.get("DB_NAME", "cargoone_db")]
    yield db
    client.close()


@pytest.fixture(scope="module")
def admin_token(base_url):
    r = requests.post(f"{base_url}/api/auth/login",
                      json={"email": "admin@cargoone.com", "password": os.environ.get("TEST_ADMIN_PASSWORD", "admin123")})
    assert r.status_code == 200, f"admin login failed: {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def customer_token(base_url):
    email = _uniq_email("cust")
    r = requests.post(f"{base_url}/api/auth/register", json={
        "email": email, "password": "Passw0rd!", "name": "BF Test Customer",
        "role": "customer", "phone": "+441111111111",
    })
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def driver_token(base_url, admin_token):
    email = _uniq_email("drv")
    r = requests.post(f"{base_url}/api/auth/register", json={
        "email": email, "password": "Passw0rd!", "name": "BF Test Driver",
        "role": "driver", "phone": "+442222222222",
    })
    assert r.status_code == 200, r.text
    drv_id = r.json()["user"]["id"]
    ra = requests.post(f"{base_url}/api/admin/users/{drv_id}/approve",
                       headers=_auth(admin_token))
    assert ra.status_code == 200, ra.text
    rl = requests.post(f"{base_url}/api/auth/login",
                       json={"email": email, "password": "Passw0rd!"})
    assert rl.status_code == 200
    return rl.json()["access_token"]


def _create_job(base_url, customer_token, pricing_type, price=None, max_budget=None):
    payload = {
        "title": f"TEST bf job ({pricing_type} £{price or max_budget})",
        "category": "furniture",
        "description": "Booking fee test",
        "photos": [],
        "pickup_address": "10 Downing St, London",
        "pickup_town": "London",
        "pickup_lat": 51.5034, "pickup_lng": -0.1276,
        "dropoff_address": "1 Church Rd, Brighton",
        "dropoff_town": "Brighton",
        "dropoff_lat": 50.8225, "dropoff_lng": -0.1372,
        "collection_date": "2026-02-01",
        "delivery_date": "2026-02-02",
        "pricing_type": pricing_type,
    }
    if pricing_type == "fixed":
        payload["fixed_price"] = float(price)
    else:
        payload["max_budget"] = float(max_budget or price)
    r = requests.post(f"{base_url}/api/jobs", json=payload,
                      headers=_auth(customer_token))
    assert r.status_code == 200, r.text
    return r.json()


def _accept_fixed_and_book(base_url, customer_token, driver_token, price):
    job = _create_job(base_url, customer_token, "fixed", price=price)
    ra = requests.post(f"{base_url}/api/jobs/{job['id']}/accept",
                       headers=_auth(driver_token))
    assert ra.status_code == 200, ra.text
    rb = requests.post(f"{base_url}/api/bookings",
                       json={"job_id": job["id"]},
                       headers=_auth(customer_token))
    assert rb.status_code == 200, rb.text
    return rb.json()


def _bid_accept_and_book(base_url, customer_token, driver_token, bid_amount):
    job = _create_job(base_url, customer_token, "bidding",
                      max_budget=max(bid_amount * 2, 5000))
    rb = requests.post(f"{base_url}/api/jobs/{job['id']}/bids",
                       json={"amount": float(bid_amount), "message": "TEST",
                             "eta_hours": 4},
                       headers=_auth(driver_token))
    assert rb.status_code == 200, rb.text
    bid_id = rb.json()["id"]
    ra = requests.post(f"{base_url}/api/bids/{bid_id}/accept",
                       headers=_auth(customer_token))
    assert ra.status_code == 200, ra.text
    rk = requests.post(f"{base_url}/api/bookings",
                       json={"job_id": job["id"]},
                       headers=_auth(customer_token))
    assert rk.status_code == 200, rk.text
    return rk.json()


def _assert_close(actual, expected, label=""):
    assert abs(float(actual) - float(expected)) < 1e-6, \
        f"{label}: expected {expected}, got {actual}"


# --------------------------------------------------------------------------- preview endpoints

class TestBookingFeePreview:
    """GET /api/booking-fees/preview - new endpoint."""

    def test_preview_270_returns_new_and_legacy_fields(self, base_url, customer_token):
        r = requests.get(
            f"{base_url}/api/booking-fees/preview?driver_charge=270",
            headers=_auth(customer_token))
        assert r.status_code == 200, r.text
        d = r.json()
        # New fields
        _assert_close(d["driver_charge"], 270, "driver_charge")
        _assert_close(d["booking_fee"], 25, "booking_fee")
        _assert_close(d["customer_total"], 295, "customer_total")
        # Legacy fields
        _assert_close(d["total_price"], 295, "total_price")
        _assert_close(d["deposit_amount"], 25, "deposit_amount")
        _assert_close(d["balance_due"], 270, "balance_due")

    def test_preview_rejects_negative_driver_charge(self, base_url, customer_token):
        r = requests.get(
            f"{base_url}/api/booking-fees/preview?driver_charge=-1",
            headers=_auth(customer_token))
        assert r.status_code == 400, r.text

    def test_preview_requires_auth(self, base_url):
        r = requests.get(f"{base_url}/api/booking-fees/preview?driver_charge=270")
        assert r.status_code in (401, 403)

    @pytest.mark.parametrize("charge,fee,total", [
        (50.0, 10.0, 60.0),
        (100.0, 10.0, 110.0),
        (100.01, 25.0, 125.01),
        (500.0, 50.0, 550.0),
        (1200.0, 100.0, 1300.0),
        (3000.0, 150.0, 3150.0),
    ])
    def test_preview_bands_across_tiers(self, base_url, customer_token,
                                        charge, fee, total):
        r = requests.get(
            f"{base_url}/api/booking-fees/preview?driver_charge={charge}",
            headers=_auth(customer_token))
        assert r.status_code == 200, r.text
        d = r.json()
        _assert_close(d["driver_charge"], charge)
        _assert_close(d["booking_fee"], fee)
        _assert_close(d["customer_total"], total)
        _assert_close(d["total_price"], total)
        _assert_close(d["deposit_amount"], fee)
        _assert_close(d["balance_due"], charge)


class TestLegacyPreviewAlias:
    """GET /api/deposit-bands/preview - legacy alias, must return identical payload."""

    def test_legacy_alias_identical_to_new(self, base_url, customer_token):
        new = requests.get(
            f"{base_url}/api/booking-fees/preview?driver_charge=270",
            headers=_auth(customer_token))
        legacy = requests.get(
            f"{base_url}/api/deposit-bands/preview?price=270",
            headers=_auth(customer_token))
        assert new.status_code == 200 and legacy.status_code == 200
        assert new.json() == legacy.json()

    def test_legacy_alias_rejects_negative(self, base_url, customer_token):
        r = requests.get(
            f"{base_url}/api/deposit-bands/preview?price=-5",
            headers=_auth(customer_token))
        assert r.status_code == 400


# --------------------------------------------------------------------------- booking creation

class TestFixedPriceBooking:
    def test_fixed_price_270_booking_math(self, base_url, customer_token, driver_token):
        b = _accept_fixed_and_book(base_url, customer_token, driver_token, 270)
        _assert_close(b["driver_charge"], 270, "driver_charge")
        _assert_close(b["booking_fee"], 25, "booking_fee")
        _assert_close(b["total_price"], 295, "total_price")
        _assert_close(b["deposit_amount"], 25, "deposit_amount")
        _assert_close(b["balance_due"], 270, "balance_due")
        # Cross-field invariants
        assert b["deposit_amount"] == b["booking_fee"]
        assert b["balance_due"] == b["driver_charge"]
        assert b["total_price"] == b["driver_charge"] + b["booking_fee"]


class TestBiddingBooking:
    @pytest.mark.parametrize("bid,fee,total", [
        (500.0, 50.0, 550.0),
        (50.0, 10.0, 60.0),
        (1200.0, 100.0, 1300.0),
        (3000.0, 150.0, 3150.0),
    ])
    def test_accepted_bid_booking_math(self, base_url, customer_token,
                                        driver_token, bid, fee, total):
        b = _bid_accept_and_book(base_url, customer_token, driver_token, bid)
        _assert_close(b["driver_charge"], bid, f"driver_charge bid={bid}")
        _assert_close(b["booking_fee"], fee, f"booking_fee bid={bid}")
        _assert_close(b["total_price"], total, f"total_price bid={bid}")
        _assert_close(b["deposit_amount"], fee, f"deposit_amount bid={bid}")
        _assert_close(b["balance_due"], bid, f"balance_due bid={bid}")


# --------------------------------------------------------------------------- Stripe charges booking_fee

class TestStripeChargesBookingFee:
    def test_deposit_session_amount_equals_booking_fee(
            self, base_url, customer_token, driver_token, mongo):
        b = _accept_fixed_and_book(base_url, customer_token, driver_token, 500)
        # driver_charge=500, booking_fee=50, customer_total=550
        _assert_close(b["booking_fee"], 50)
        _assert_close(b["total_price"], 550)

        r = requests.post(
            f"{base_url}/api/bookings/{b['id']}/deposit",
            json={"origin_url": "https://example.com"},
            headers=_auth(customer_token))
        assert r.status_code == 200, r.text
        session_id = r.json()["session_id"]
        assert session_id

        # Verify persisted transaction amount == booking_fee (50), NOT customer_total (550)
        txn = mongo.payment_transactions.find_one({"session_id": session_id})
        assert txn is not None, "payment_transactions row missing"
        _assert_close(txn["amount"], 50, "Stripe txn.amount must equal booking_fee")
        assert txn["currency"] == "gbp"


# --------------------------------------------------------------------------- fallback

class TestFallbackAllBandsDisabled:
    def test_fallback_percentage_of_driver_charge(
            self, base_url, customer_token, driver_token, mongo):
        original = list(mongo.deposit_bands.find({"enabled": True}, {"_id": 0, "id": 1}))
        try:
            mongo.deposit_bands.update_many(
                {"enabled": True}, {"$set": {"enabled": False}})

            # preview fallback: 10% of driver_charge
            p = requests.get(
                f"{base_url}/api/booking-fees/preview?driver_charge=700",
                headers=_auth(customer_token))
            assert p.status_code == 200
            d = p.json()
            _assert_close(d["booking_fee"], 70.0, "fallback booking_fee")
            _assert_close(d["customer_total"], 770.0, "fallback customer_total")
            _assert_close(d["balance_due"], 700.0, "fallback balance_due")

            # booking fallback: same math applied
            b = _accept_fixed_and_book(base_url, customer_token, driver_token, 700)
            _assert_close(b["driver_charge"], 700)
            _assert_close(b["booking_fee"], 70)
            _assert_close(b["total_price"], 770)
            _assert_close(b["deposit_amount"], 70)
            _assert_close(b["balance_due"], 700)
        finally:
            ids = [x["id"] for x in original]
            if ids:
                mongo.deposit_bands.update_many(
                    {"id": {"$in": ids}}, {"$set": {"enabled": True}})


# --------------------------------------------------------------------------- admin CRUD regression

class TestAdminCRUDRegression:
    def test_admin_list_bands(self, base_url, admin_token):
        r = requests.get(f"{base_url}/api/admin/deposit-bands",
                         headers=_auth(admin_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        assert len(r.json()) >= 5

    def test_admin_create_update_delete(self, base_url, admin_token):
        # Create
        c = requests.post(
            f"{base_url}/api/admin/deposit-bands",
            json={"min_price": 500000, "max_price": 600000,
                  "deposit_amount": 200, "enabled": True,
                  "label": "TEST bf regression"},
            headers=_auth(admin_token))
        assert c.status_code == 200, c.text
        bid = c.json()["id"]
        try:
            # Update
            u = requests.put(
                f"{base_url}/api/admin/deposit-bands/{bid}",
                json={"min_price": 500000, "max_price": 700000,
                      "deposit_amount": 250, "enabled": False,
                      "label": "TEST bf regression upd"},
                headers=_auth(admin_token))
            assert u.status_code == 200
            assert u.json()["deposit_amount"] == 250
            assert u.json()["enabled"] is False
        finally:
            d = requests.delete(f"{base_url}/api/admin/deposit-bands/{bid}",
                                headers=_auth(admin_token))
            assert d.status_code in (200, 404)

    def test_public_deposit_bands_returns_enabled_only(
            self, base_url, customer_token):
        r = requests.get(f"{base_url}/api/deposit-bands",
                         headers=_auth(customer_token))
        assert r.status_code == 200
        bands = r.json()
        assert all(b["enabled"] for b in bands)
        mins = [float(b["min_price"]) for b in bands]
        assert mins == sorted(mins)
