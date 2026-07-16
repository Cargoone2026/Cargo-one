"""Tests for the configurable deposit-bands feature and its integration
with booking creation.

Covers:
- Public GET /api/deposit-bands (auth required, enabled only, sorted)
- GET /api/deposit-bands/preview
- Admin CRUD under /api/admin/deposit-bands (RBAC + validation)
- 5 default bands seeded on startup
- POST /api/bookings uses calculate_deposit(price)
- Fallback to DEPOSIT_PERCENTAGE when all bands disabled
"""
import os
import uuid
import pytest
import requests
import pymongo


# ---------------------------------------------------------------------------
# Helpers / fixtures
# ---------------------------------------------------------------------------

def _uniq_email(prefix):
    return f"test_dep_{prefix}_{uuid.uuid4().hex[:10]}@example.com"


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def mongo():
    client = pymongo.MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
    db = client[os.environ.get("DB_NAME", "cargoone_db")]
    yield db
    client.close()


@pytest.fixture(scope="module")
def admin_token(base_url):
    r = requests.post(f"{base_url}/api/auth/login",
                      json={"email": "admin@cargoone.com", "password": "admin123"})
    assert r.status_code == 200, f"admin login failed: {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def customer_token(base_url):
    email = _uniq_email("cust")
    r = requests.post(f"{base_url}/api/auth/register", json={
        "email": email, "password": "Passw0rd!", "name": "Deposit Test Customer",
        "role": "customer", "phone": "+441111111111",
    })
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def driver_token(base_url, admin_token):
    email = _uniq_email("drv")
    r = requests.post(f"{base_url}/api/auth/register", json={
        "email": email, "password": "Passw0rd!", "name": "Deposit Test Driver",
        "role": "driver", "phone": "+442222222222",
    })
    assert r.status_code == 200, r.text
    drv_id = r.json()["user"]["id"]
    # Approve the driver
    ra = requests.post(f"{base_url}/api/admin/users/{drv_id}/approve",
                       headers=_auth(admin_token))
    assert ra.status_code == 200, ra.text
    # Re-login to refresh status
    rl = requests.post(f"{base_url}/api/auth/login",
                       json={"email": email, "password": "Passw0rd!"})
    assert rl.status_code == 200
    return rl.json()["access_token"]


def _create_fixed_job(base_url, customer_token, price):
    payload = {
        "title": f"TEST deposit job £{price}",
        "category": "furniture",
        "description": "Deposit calc test job",
        "photos": [],
        "pickup_address": "10 Downing St, London",
        "pickup_town": "London",
        "pickup_lat": 51.5034, "pickup_lng": -0.1276,
        "dropoff_address": "1 Church Rd, Brighton",
        "dropoff_town": "Brighton",
        "dropoff_lat": 50.8225, "dropoff_lng": -0.1372,
        "collection_date": "2026-02-01",
        "delivery_date": "2026-02-02",
        "pricing_type": "fixed",
        "fixed_price": float(price),
    }
    r = requests.post(f"{base_url}/api/jobs", json=payload,
                      headers=_auth(customer_token))
    assert r.status_code == 200, r.text
    return r.json()


def _accept_and_book(base_url, customer_token, driver_token, price):
    job = _create_fixed_job(base_url, customer_token, price)
    ra = requests.post(f"{base_url}/api/jobs/{job['id']}/accept",
                       headers=_auth(driver_token))
    assert ra.status_code == 200, ra.text
    rb = requests.post(f"{base_url}/api/bookings",
                       json={"job_id": job["id"]},
                       headers=_auth(customer_token))
    assert rb.status_code == 200, rb.text
    return rb.json()


# ---------------------------------------------------------------------------
# Seeded defaults
# ---------------------------------------------------------------------------
class TestSeededBands:
    def test_five_default_bands_seeded(self, base_url, admin_token):
        r = requests.get(f"{base_url}/api/admin/deposit-bands",
                         headers=_auth(admin_token))
        assert r.status_code == 200, r.text
        bands = r.json()
        # Must contain at least the 5 seeded bands
        assert len(bands) >= 5
        # Verify the specific default deposit tiers exist and are enabled
        expected = [
            (0.0, 100.0, 10.0),
            (100.01, 300.0, 25.0),
            (300.01, 750.0, 50.0),
            (750.01, 1500.0, 100.0),
            (1500.01, None, 150.0),
        ]
        for mn, mx, dep in expected:
            match = [b for b in bands
                     if abs(float(b["min_price"]) - mn) < 1e-6
                     and ((mx is None and b["max_price"] is None)
                          or (mx is not None and b["max_price"] is not None
                              and abs(float(b["max_price"]) - mx) < 1e-6))
                     and abs(float(b["deposit_amount"]) - dep) < 1e-6]
            assert match, f"Missing seeded band {mn}-{mx} => {dep}. Got: {bands}"
            assert match[0]["enabled"] is True


# ---------------------------------------------------------------------------
# Public / authenticated user endpoints
# ---------------------------------------------------------------------------
class TestPublicBandEndpoints:
    def test_list_bands_requires_auth(self, base_url):
        r = requests.get(f"{base_url}/api/deposit-bands")
        assert r.status_code in (401, 403), r.text

    def test_list_bands_returns_only_enabled_sorted(self, base_url,
                                                    customer_token, admin_token,
                                                    mongo):
        # Ensure one disabled band exists (create if not, then disable)
        create = requests.post(
            f"{base_url}/api/admin/deposit-bands",
            json={"min_price": 99999, "max_price": None,
                  "deposit_amount": 9999, "enabled": False,
                  "label": "TEST disabled"},
            headers=_auth(admin_token))
        assert create.status_code == 200, create.text
        disabled_id = create.json()["id"]

        try:
            r = requests.get(f"{base_url}/api/deposit-bands",
                             headers=_auth(customer_token))
            assert r.status_code == 200, r.text
            bands = r.json()
            # None disabled
            assert all(b["enabled"] for b in bands), \
                "Disabled band leaked to /deposit-bands"
            # Sorted ascending by min_price
            mins = [float(b["min_price"]) for b in bands]
            assert mins == sorted(mins)
            # Explicitly, our disabled band should NOT be present
            assert not any(b["id"] == disabled_id for b in bands)
        finally:
            requests.delete(
                f"{base_url}/api/admin/deposit-bands/{disabled_id}",
                headers=_auth(admin_token))

    @pytest.mark.parametrize("price,exp_dep,exp_bal", [
        (50.0, 10.0, 40.0),
        (100.0, 10.0, 90.0),
        (100.01, 25.0, 75.01),
        (500.0, 50.0, 450.0),
        (1200.0, 100.0, 1100.0),
        (5000.0, 150.0, 4850.0),
    ])
    def test_preview_matches_band(self, base_url, customer_token,
                                  price, exp_dep, exp_bal):
        r = requests.get(
            f"{base_url}/api/deposit-bands/preview?price={price}",
            headers=_auth(customer_token))
        assert r.status_code == 200, r.text
        d = r.json()
        assert abs(d["total_price"] - round(price, 2)) < 1e-6
        assert abs(d["deposit_amount"] - exp_dep) < 1e-6, d
        assert abs(d["balance_due"] - exp_bal) < 1e-6, d

    def test_preview_negative_price_rejected(self, base_url, customer_token):
        r = requests.get(f"{base_url}/api/deposit-bands/preview?price=-1",
                         headers=_auth(customer_token))
        assert r.status_code == 400


# ---------------------------------------------------------------------------
# Admin CRUD + RBAC
# ---------------------------------------------------------------------------
class TestAdminBandCRUD:
    def test_admin_list_includes_disabled(self, base_url, admin_token):
        # Create a disabled band
        c = requests.post(
            f"{base_url}/api/admin/deposit-bands",
            json={"min_price": 100000, "max_price": None,
                  "deposit_amount": 5, "enabled": False,
                  "label": "TEST admin list disabled"},
            headers=_auth(admin_token))
        assert c.status_code == 200
        bid = c.json()["id"]
        try:
            r = requests.get(f"{base_url}/api/admin/deposit-bands",
                             headers=_auth(admin_token))
            assert r.status_code == 200
            bands = r.json()
            found = next((b for b in bands if b["id"] == bid), None)
            assert found is not None and found["enabled"] is False
        finally:
            requests.delete(f"{base_url}/api/admin/deposit-bands/{bid}",
                            headers=_auth(admin_token))

    def test_non_admin_cannot_list_all(self, base_url, customer_token):
        r = requests.get(f"{base_url}/api/admin/deposit-bands",
                         headers=_auth(customer_token))
        assert r.status_code == 403

    def test_non_admin_cannot_create(self, base_url, customer_token):
        r = requests.post(
            f"{base_url}/api/admin/deposit-bands",
            json={"min_price": 0, "max_price": 10, "deposit_amount": 1,
                  "enabled": True, "label": "TEST"},
            headers=_auth(customer_token))
        assert r.status_code == 403

    def test_admin_create_update_delete_flow(self, base_url, admin_token):
        # Create
        c = requests.post(
            f"{base_url}/api/admin/deposit-bands",
            json={"min_price": 200000, "max_price": 300000,
                  "deposit_amount": 500, "enabled": True,
                  "label": "TEST crud"},
            headers=_auth(admin_token))
        assert c.status_code == 200, c.text
        band = c.json()
        assert band["deposit_amount"] == 500
        assert band["min_price"] == 200000
        assert band["max_price"] == 300000
        bid = band["id"]

        # Verify via GET admin list
        g = requests.get(f"{base_url}/api/admin/deposit-bands",
                         headers=_auth(admin_token))
        assert g.status_code == 200
        assert any(b["id"] == bid for b in g.json())

        # Update
        u = requests.put(
            f"{base_url}/api/admin/deposit-bands/{bid}",
            json={"min_price": 200000, "max_price": 400000,
                  "deposit_amount": 750, "enabled": False,
                  "label": "TEST crud updated"},
            headers=_auth(admin_token))
        assert u.status_code == 200, u.text
        upd = u.json()
        assert upd["deposit_amount"] == 750
        assert upd["max_price"] == 400000
        assert upd["enabled"] is False
        assert upd["label"] == "TEST crud updated"

        # Delete
        d = requests.delete(f"{base_url}/api/admin/deposit-bands/{bid}",
                            headers=_auth(admin_token))
        assert d.status_code == 200

        # Confirm gone
        g2 = requests.get(f"{base_url}/api/admin/deposit-bands",
                          headers=_auth(admin_token))
        assert not any(b["id"] == bid for b in g2.json())

        # Delete again should 404
        d2 = requests.delete(f"{base_url}/api/admin/deposit-bands/{bid}",
                             headers=_auth(admin_token))
        assert d2.status_code == 404

    def test_update_nonexistent_404(self, base_url, admin_token):
        r = requests.put(
            f"{base_url}/api/admin/deposit-bands/nonexistent-id",
            json={"min_price": 0, "max_price": 10, "deposit_amount": 1,
                  "enabled": True},
            headers=_auth(admin_token))
        assert r.status_code == 404

    def test_validation_max_le_min(self, base_url, admin_token):
        r = requests.post(
            f"{base_url}/api/admin/deposit-bands",
            json={"min_price": 100, "max_price": 50,
                  "deposit_amount": 10, "enabled": True},
            headers=_auth(admin_token))
        assert r.status_code == 400

    def test_validation_max_equal_min(self, base_url, admin_token):
        r = requests.post(
            f"{base_url}/api/admin/deposit-bands",
            json={"min_price": 100, "max_price": 100,
                  "deposit_amount": 10, "enabled": True},
            headers=_auth(admin_token))
        assert r.status_code == 400

    def test_validation_negative_min(self, base_url, admin_token):
        r = requests.post(
            f"{base_url}/api/admin/deposit-bands",
            json={"min_price": -1, "max_price": 100,
                  "deposit_amount": 10, "enabled": True},
            headers=_auth(admin_token))
        assert r.status_code == 400

    def test_validation_negative_deposit(self, base_url, admin_token):
        r = requests.post(
            f"{base_url}/api/admin/deposit-bands",
            json={"min_price": 0, "max_price": 100,
                  "deposit_amount": -5, "enabled": True},
            headers=_auth(admin_token))
        assert r.status_code == 400

    def test_max_price_null_allowed(self, base_url, admin_token):
        r = requests.post(
            f"{base_url}/api/admin/deposit-bands",
            json={"min_price": 999999, "max_price": None,
                  "deposit_amount": 500, "enabled": False,
                  "label": "TEST null-max"},
            headers=_auth(admin_token))
        assert r.status_code == 200, r.text
        bid = r.json()["id"]
        assert r.json()["max_price"] is None
        # cleanup
        requests.delete(f"{base_url}/api/admin/deposit-bands/{bid}",
                        headers=_auth(admin_token))


# ---------------------------------------------------------------------------
# Booking creation uses calculate_deposit
# ---------------------------------------------------------------------------
class TestBookingDepositIntegration:
    @pytest.mark.parametrize("price,exp_dep,exp_bal", [
        (500.0, 50.0, 450.0),
        (1200.0, 100.0, 1100.0),
        (50.0, 10.0, 40.0),
    ])
    def test_booking_uses_band_deposit(self, base_url, customer_token,
                                       driver_token, price, exp_dep, exp_bal):
        booking = _accept_and_book(base_url, customer_token, driver_token,
                                   price)
        assert abs(booking["total_price"] - price) < 1e-6
        assert abs(booking["deposit_amount"] - exp_dep) < 1e-6, \
            f"price={price}: expected deposit {exp_dep}, got {booking['deposit_amount']}"
        assert abs(booking["balance_due"] - exp_bal) < 1e-6, \
            f"price={price}: expected balance {exp_bal}, got {booking['balance_due']}"


# ---------------------------------------------------------------------------
# Fallback when all bands are disabled -> DEPOSIT_PERCENTAGE (0.10)
# ---------------------------------------------------------------------------
class TestFallbackWhenAllDisabled:
    def test_fallback_percentage_when_no_enabled_bands(
            self, base_url, customer_token, driver_token, mongo):
        # Snapshot & disable all bands via direct DB update
        original = list(mongo.deposit_bands.find({"enabled": True}, {"_id": 0, "id": 1}))
        try:
            mongo.deposit_bands.update_many(
                {"enabled": True}, {"$set": {"enabled": False}})
            # Sanity check via public endpoint
            r = requests.get(f"{base_url}/api/deposit-bands",
                             headers=_auth(customer_token))
            assert r.status_code == 200
            assert r.json() == []

            # Preview should fall back to 10%
            p = requests.get(
                f"{base_url}/api/deposit-bands/preview?price=700",
                headers=_auth(customer_token))
            assert p.status_code == 200
            assert abs(p.json()["deposit_amount"] - 70.0) < 1e-6
            assert abs(p.json()["balance_due"] - 630.0) < 1e-6

            # Booking should fall back to 10%
            booking = _accept_and_book(base_url, customer_token,
                                        driver_token, 700.0)
            assert abs(booking["deposit_amount"] - 70.0) < 1e-6, booking
            assert abs(booking["balance_due"] - 630.0) < 1e-6, booking
        finally:
            # Restore
            ids = [b["id"] for b in original]
            if ids:
                mongo.deposit_bands.update_many(
                    {"id": {"$in": ids}}, {"$set": {"enabled": True}})
