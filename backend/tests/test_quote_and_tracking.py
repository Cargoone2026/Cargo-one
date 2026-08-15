"""
Phase 2.1 backend regression tests:
- GET /api/quote/estimate (Google Distance Matrix + haversine fallback)
- GET /api/tracking/{booking_id} enhanced fields (target, remaining_miles, eta_minutes, heading)
- Regression: /auth/login, POST /jobs, POST /bookings, /booking-fees/preview, /admin/deposit-bands
"""

import math
import os
import time
import uuid

import pytest
import requests

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL",
    "https://cargo-port.preview.emergentagent.com",
).rstrip("/")

ADMIN_EMAIL = "admin@cargoone.com"
ADMIN_PASSWORD = (os.environ.get("TEST_ADMIN_PASSWORD") or os.environ.get("INITIAL_ADMIN_PASSWORD") or "admin123")

# London -> Manchester (per review request)
PICKUP = (51.5074, -0.1278)
DROPOFF = (53.4808, -2.2426)

CATEGORIES = [
    "furniture", "pallets", "cars", "motorcycles", "house_moves",
    "parcels", "freight", "documents", "boats", "machinery",
]

EXPECTED_VEHICLES = {
    "furniture": "Luton Van",
    "pallets": "3.5T Curtain-side",
    "cars": "Car Transporter",
    "motorcycles": "Motorcycle Trailer",
    "house_moves": "Luton Van",
    "parcels": "Small Van",
    "freight": "7.5T HGV",
    "documents": "Car / Bike",
    "boats": "Boat Trailer",
    "machinery": "Flatbed HGV",
}


# ---------- helpers ----------

def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _register(role: str) -> dict:
    """Register a fresh user of given role, return {token, user}."""
    email = f"test_{role}_{uuid.uuid4().hex[:10]}@qa.com"
    r = requests.post(
        f"{BASE_URL}/api/auth/register",
        json={
            "email": email,
            "name": f"QA {role}",
            "password": "Passw0rd!",
            "role": role,
        },
        timeout=15,
    )
    assert r.status_code == 200, f"register {role}: {r.status_code} {r.text}"
    data = r.json()
    return {"token": data["access_token"], "user": data["user"], "email": email}


def _admin_token() -> str:
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=15,
    )
    assert r.status_code == 200, f"admin login failed: {r.text}"
    return r.json()["access_token"]


def _approve_driver(admin_token: str, driver_id: str) -> None:
    r = requests.post(
        f"{BASE_URL}/api/admin/users/{driver_id}/approve",
        headers=_auth_headers(admin_token),
        timeout=15,
    )
    assert r.status_code == 200, f"approve: {r.text}"


def _haversine_miles(a, b):
    R = 3959.0
    phi1, phi2 = math.radians(a[0]), math.radians(b[0])
    dphi = math.radians(b[0] - a[0])
    dlmb = math.radians(b[1] - a[1])
    x = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlmb / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(x), math.sqrt(1 - x))


# ---------- fixtures ----------

@pytest.fixture(scope="module")
def admin_token():
    return _admin_token()


@pytest.fixture(scope="module")
def customer():
    return _register("customer")


@pytest.fixture(scope="module")
def driver(admin_token):
    d = _register("driver")
    _approve_driver(admin_token, d["user"]["id"])
    return d


# =====================================================================
# Quote Engine
# =====================================================================

class TestQuoteEndpoint:
    """GET /api/quote/estimate"""

    def test_requires_auth(self):
        r = requests.get(
            f"{BASE_URL}/api/quote/estimate",
            params={
                "pickup_lat": PICKUP[0], "pickup_lng": PICKUP[1],
                "dropoff_lat": DROPOFF[0], "dropoff_lng": DROPOFF[1],
                "category": "furniture",
            },
            timeout=15,
        )
        # HTTPBearer with auto_error=False + explicit 401 in dependency
        assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code} {r.text}"

    def test_haversine_fallback_london_manchester(self, customer):
        """Since GOOGLE_MAPS_API_KEY is empty, source must be 'haversine'."""
        r = requests.get(
            f"{BASE_URL}/api/quote/estimate",
            params={
                "pickup_lat": PICKUP[0], "pickup_lng": PICKUP[1],
                "dropoff_lat": DROPOFF[0], "dropoff_lng": DROPOFF[1],
                "category": "furniture",
            },
            headers=_auth_headers(customer["token"]),
            timeout=15,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        # required fields
        for k in ("distance_miles", "duration_minutes", "suggested_price", "vehicle", "source"):
            assert k in body, f"missing {k}: {body}"
        assert body["source"] == "haversine", f"expected haversine, got {body['source']}"
        # sensible numeric ranges
        assert body["distance_miles"] > 0
        assert body["duration_minutes"] > 0
        assert body["suggested_price"] >= 30
        assert isinstance(body["vehicle"], str) and body["vehicle"]
        # London-Manchester should be roughly ~163 miles great-circle
        expected = _haversine_miles(PICKUP, DROPOFF)
        assert abs(body["distance_miles"] - round(expected, 1)) < 0.5, (
            f"distance mismatch: got {body['distance_miles']}, expected ~{expected:.1f}"
        )
        # haversine duration = miles/40 * 60 + 10
        expected_min = round((expected / 40.0) * 60 + 10, 0)
        assert abs(body["duration_minutes"] - expected_min) <= 1
        # furniture vehicle
        assert body["vehicle"] == "Luton Van"

    @pytest.mark.parametrize("category", CATEGORIES)
    def test_all_10_categories_return_distinct_vehicle(self, customer, category):
        r = requests.get(
            f"{BASE_URL}/api/quote/estimate",
            params={
                "pickup_lat": PICKUP[0], "pickup_lng": PICKUP[1],
                "dropoff_lat": DROPOFF[0], "dropoff_lng": DROPOFF[1],
                "category": category,
            },
            headers=_auth_headers(customer["token"]),
            timeout=15,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["vehicle"] == EXPECTED_VEHICLES[category], (
            f"cat={category}: got {body['vehicle']}, expected {EXPECTED_VEHICLES[category]}"
        )
        assert body["distance_miles"] > 0
        assert body["duration_minutes"] > 0
        assert body["suggested_price"] >= 30
        assert body["source"] == "haversine"

    def test_category_multiplier_effects_price(self, customer):
        """boats (2.5x) should be priced higher than documents (0.8x) for same route."""
        def price(cat):
            r = requests.get(
                f"{BASE_URL}/api/quote/estimate",
                params={
                    "pickup_lat": PICKUP[0], "pickup_lng": PICKUP[1],
                    "dropoff_lat": DROPOFF[0], "dropoff_lng": DROPOFF[1],
                    "category": cat,
                },
                headers=_auth_headers(customer["token"]),
                timeout=15,
            )
            assert r.status_code == 200
            return r.json()["suggested_price"]

        assert price("boats") > price("documents")
        assert price("cars") > price("parcels")

    def test_minimum_price_floor_30(self, customer):
        """Very short route should still floor at £30."""
        r = requests.get(
            f"{BASE_URL}/api/quote/estimate",
            params={
                "pickup_lat": 51.5074, "pickup_lng": -0.1278,
                "dropoff_lat": 51.5080, "dropoff_lng": -0.1280,  # meters away
                "category": "documents",
            },
            headers=_auth_headers(customer["token"]),
            timeout=15,
        )
        assert r.status_code == 200
        assert r.json()["suggested_price"] >= 30


# =====================================================================
# Enhanced Tracking
# =====================================================================

class TestEnhancedTracking:
    """GET /api/tracking/{booking_id} returns target/remaining_miles/eta_minutes/heading."""

    @pytest.fixture(scope="class")
    def paid_booking(self, admin_token):
        """Create customer+driver, post a fixed job, accept, book, force deposit_paid via admin path.

        Since we cannot complete real Stripe payment here, we directly mark booking as
        deposit_paid using the /bookings/{id}/status route... but that endpoint uses only
        driver-lifecycle statuses. Instead we accept the job and use the natural flow,
        then update booking status through mongo-visible transitions using participants.

        Simplification: we cannot mark payment_status=paid via HTTP. However, tracking
        endpoint does NOT require payment_status=paid — it only requires participant access.
        Booking with status="accepted" works: target logic falls through to else -> target=None.
        For target='pickup' we need status in (deposit_paid, confirmed, travelling).
        For target='dropoff' we need status in (arrived, collected, on_route).
        The POST /bookings/{id}/status endpoint accepts "travelling","arrived","collected","on_route",
        "delivered","cancelled". So we can drive the booking through those states directly.
        """
        # customer + driver
        cust = _register("customer")
        drv = _register("driver")
        _approve_driver(admin_token, drv["user"]["id"])

        # customer creates fixed-price job (London -> Manchester)
        job_payload = {
            "title": "QA phase 2.1 tracking",
            "category": "furniture",
            "description": "test",
            "photos": [],
            "pickup_address": "1 Pickup St",
            "pickup_town": "London",
            "pickup_lat": PICKUP[0], "pickup_lng": PICKUP[1],
            "dropoff_address": "2 Dropoff Rd",
            "dropoff_town": "Manchester",
            "dropoff_lat": DROPOFF[0], "dropoff_lng": DROPOFF[1],
            "collection_date": "2026-02-01",
            "delivery_date": "2026-02-02",
            "pricing_type": "fixed",
            "fixed_price": 300.0,
        }
        r = requests.post(f"{BASE_URL}/api/jobs", json=job_payload,
                          headers=_auth_headers(cust["token"]), timeout=15)
        assert r.status_code == 200, r.text
        job = r.json()

        # driver accepts
        r = requests.post(f"{BASE_URL}/api/jobs/{job['id']}/accept",
                          headers=_auth_headers(drv["token"]), timeout=15)
        assert r.status_code == 200, r.text

        # customer creates booking
        r = requests.post(f"{BASE_URL}/api/bookings", json={"job_id": job["id"]},
                          headers=_auth_headers(cust["token"]), timeout=15)
        assert r.status_code == 200, r.text
        booking = r.json()
        return {"cust": cust, "drv": drv, "job": job, "booking": booking, "admin": admin_token}

    def test_requires_auth(self, paid_booking):
        r = requests.get(
            f"{BASE_URL}/api/tracking/{paid_booking['booking']['id']}",
            timeout=15,
        )
        assert r.status_code in (401, 403)

    def test_forbidden_for_other_users(self, paid_booking):
        """Another random customer must get 403."""
        outsider = _register("customer")
        r = requests.get(
            f"{BASE_URL}/api/tracking/{paid_booking['booking']['id']}",
            headers=_auth_headers(outsider["token"]),
            timeout=15,
        )
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text}"

    def test_no_location_returns_null_fields(self, paid_booking):
        """Before driver posts any location, eta/remaining/heading must be null."""
        r = requests.get(
            f"{BASE_URL}/api/tracking/{paid_booking['booking']['id']}",
            headers=_auth_headers(paid_booking["cust"]["token"]),
            timeout=15,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        for k in ("target", "remaining_miles", "eta_minutes", "heading",
                  "last_location", "trail"):
            assert k in body, f"missing {k}"
        assert body["last_location"] is None
        assert body["remaining_miles"] is None
        assert body["eta_minutes"] is None
        assert body["heading"] is None
        assert body["target"] is None

    def test_target_pickup_when_travelling(self, admin_token):
        """Fresh booking driven to 'travelling' → target must be 'pickup'."""
        cust = _register("customer")
        drv = _register("driver")
        _approve_driver(admin_token, drv["user"]["id"])
        job_payload = {
            "title": "pickup target",
            "category": "furniture", "description": "d", "photos": [],
            "pickup_address": "a", "pickup_town": "London",
            "pickup_lat": PICKUP[0], "pickup_lng": PICKUP[1],
            "dropoff_address": "b", "dropoff_town": "Manchester",
            "dropoff_lat": DROPOFF[0], "dropoff_lng": DROPOFF[1],
            "collection_date": "2026-02-01", "delivery_date": "2026-02-02",
            "pricing_type": "fixed", "fixed_price": 250.0,
        }
        r = requests.post(f"{BASE_URL}/api/jobs", json=job_payload,
                          headers=_auth_headers(cust["token"]), timeout=15)
        assert r.status_code == 200
        job = r.json()
        r = requests.post(f"{BASE_URL}/api/jobs/{job['id']}/accept",
                          headers=_auth_headers(drv["token"]), timeout=15)
        assert r.status_code == 200
        r = requests.post(f"{BASE_URL}/api/bookings", json={"job_id": job["id"]},
                          headers=_auth_headers(cust["token"]), timeout=15)
        assert r.status_code == 200
        bid = r.json()["id"]

        # move to 'travelling' (valid via /status)
        r = requests.post(f"{BASE_URL}/api/bookings/{bid}/status",
                          json={"status": "travelling"},
                          headers=_auth_headers(drv["token"]), timeout=15)
        assert r.status_code == 200, r.text

        # driver posts location near Birmingham
        r = requests.post(f"{BASE_URL}/api/tracking/{bid}",
                          json={"lat": 52.4862, "lng": -1.8904},
                          headers=_auth_headers(drv["token"]), timeout=15)
        assert r.status_code == 200

        r = requests.get(f"{BASE_URL}/api/tracking/{bid}",
                         headers=_auth_headers(cust["token"]), timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert body["target"] == "pickup", f"got {body['target']}"
        assert body["remaining_miles"] is not None and body["remaining_miles"] > 0
        assert body["eta_minutes"] is not None and body["eta_minutes"] > 0

    def test_target_dropoff_when_on_route(self, paid_booking):
        """Drive booking to 'on_route' via /status; post 2 driver locations; then check target."""
        bid = paid_booking["booking"]["id"]
        drv_h = _auth_headers(paid_booking["drv"]["token"])

        # walk booking through the statuses that require dropoff target
        # Note: /status endpoint permits any participant; only validates values.
        for s in ("travelling", "arrived", "collected", "on_route"):
            r = requests.post(f"{BASE_URL}/api/bookings/{bid}/status",
                              json={"status": s}, headers=drv_h, timeout=15)
            assert r.status_code == 200, f"status {s}: {r.text}"

        # post two tracking points (driver near London moving north)
        p1 = {"lat": 52.0, "lng": -1.5}
        p2 = {"lat": 52.5, "lng": -2.0}
        for p in (p1, p2):
            r = requests.post(f"{BASE_URL}/api/tracking/{bid}",
                              json=p, headers=drv_h, timeout=15)
            assert r.status_code == 200, r.text
            time.sleep(0.15)  # ensure different timestamps

        # customer fetches tracking
        r = requests.get(f"{BASE_URL}/api/tracking/{bid}",
                         headers=_auth_headers(paid_booking["cust"]["token"]),
                         timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["last_location"] is not None
        assert body["last_location"]["lat"] == p2["lat"]
        assert body["target"] == "dropoff", f"got target={body['target']}"
        # remaining miles from (52.5,-2.0) to Manchester (~53.48,-2.24) ~ 70 miles
        assert body["remaining_miles"] is not None
        assert 30 < body["remaining_miles"] < 150
        # haversine fallback ETA = miles/40*60 + 5
        assert body["eta_minutes"] is not None
        assert body["eta_minutes"] > 0
        # bearing between p1 and p2: NW-ish -> should be between 270-360
        assert body["heading"] is not None
        assert 0.0 <= body["heading"] < 360.0
        # from p1 (52,-1.5) to p2 (52.5,-2.0) is NW -> bearing ~ 325
        assert 270 < body["heading"] < 360, f"bearing looks wrong: {body['heading']}"


# =====================================================================
# Regression: unchanged endpoints
# =====================================================================

class TestRegression:

    def test_auth_login_admin(self):
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
                          timeout=15)
        assert r.status_code == 200
        b = r.json()
        assert "access_token" in b and b["user"]["role"] == "admin"

    def test_create_job(self, customer):
        r = requests.post(
            f"{BASE_URL}/api/jobs",
            headers=_auth_headers(customer["token"]),
            json={
                "title": "regression job",
                "category": "parcels",
                "description": "d",
                "photos": [],
                "pickup_address": "a", "pickup_town": "London",
                "pickup_lat": PICKUP[0], "pickup_lng": PICKUP[1],
                "dropoff_address": "b", "dropoff_town": "Manchester",
                "dropoff_lat": DROPOFF[0], "dropoff_lng": DROPOFF[1],
                "collection_date": "2026-02-01", "delivery_date": "2026-02-02",
                "pricing_type": "fixed", "fixed_price": 200.0,
            }, timeout=15)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["status"] == "posted"
        assert j["distance_miles"] > 0
        assert j["suggested_price"] >= 30

    def test_create_booking_after_accept(self, customer, driver):
        # customer creates job
        r = requests.post(
            f"{BASE_URL}/api/jobs",
            headers=_auth_headers(customer["token"]),
            json={
                "title": "reg booking", "category": "furniture", "description": "d",
                "photos": [],
                "pickup_address": "a", "pickup_town": "London",
                "pickup_lat": PICKUP[0], "pickup_lng": PICKUP[1],
                "dropoff_address": "b", "dropoff_town": "Manchester",
                "dropoff_lat": DROPOFF[0], "dropoff_lng": DROPOFF[1],
                "collection_date": "2026-02-01", "delivery_date": "2026-02-02",
                "pricing_type": "fixed", "fixed_price": 270.0,
            }, timeout=15)
        assert r.status_code == 200
        job = r.json()

        r = requests.post(f"{BASE_URL}/api/jobs/{job['id']}/accept",
                          headers=_auth_headers(driver["token"]), timeout=15)
        assert r.status_code == 200, r.text

        r = requests.post(f"{BASE_URL}/api/bookings",
                          json={"job_id": job["id"]},
                          headers=_auth_headers(customer["token"]), timeout=15)
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["driver_charge"] == 270.0
        assert b["booking_fee"] == 25  # Tier 2 (100.01-300 -> 25)
        assert b["total_price"] == 295.0
        assert b["deposit_amount"] == 25
        assert b["balance_due"] == 270.0

    def test_booking_fees_preview_regression(self, customer):
        r = requests.get(f"{BASE_URL}/api/booking-fees/preview",
                         params={"driver_charge": 270},
                         headers=_auth_headers(customer["token"]), timeout=15)
        assert r.status_code == 200
        b = r.json()
        assert b["driver_charge"] == 270
        assert b["booking_fee"] == 25
        assert b["customer_total"] == 295

    def test_admin_deposit_bands_list(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/admin/deposit-bands",
                         headers=_auth_headers(admin_token), timeout=15)
        assert r.status_code == 200
        bands = r.json()
        assert isinstance(bands, list) and len(bands) >= 5
        assert all("min_price" in b and "deposit_amount" in b for b in bands)
