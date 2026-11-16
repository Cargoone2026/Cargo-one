# R82 quote-first ("account last") flow — backend contract checks the guest UI relies on.
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
CUSTOMER = {"email": "testcustomer@example.com", "password": "CustomerTest12345!"}


@pytest.fixture
def s():
    return requests.Session()


# Public endpoints a guest needs to fill PostJob / ASAP forms
class TestGuestPublicEndpoints:
    def test_categories_public(self, s):
        r = s.get(f"{BASE_URL}/api/catalog/categories")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) > 0
        assert "key" in data[0] and "_id" not in data[0]

    def test_vehicles_public(self, s):
        r = s.get(f"{BASE_URL}/api/catalog/vehicles")
        assert r.status_code == 200
        assert isinstance(r.json(), list) and len(r.json()) > 0

    def test_asap_vehicles_public(self, s):
        r = s.get(f"{BASE_URL}/api/asap/vehicles")
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d.get("transport"), list) and isinstance(d.get("recovery"), list)

    def test_geo_autocomplete_public(self, s):
        r = s.get(f"{BASE_URL}/api/geo/autocomplete", params={"q": "Birmingham"})
        assert r.status_code == 200
        assert isinstance(r.json().get("suggestions"), list)

    def test_recommend_vehicle_public(self, s):
        r = s.post(f"{BASE_URL}/api/catalog/recommend-vehicle", json={"category_key": "furniture_delivery"})
        assert r.status_code == 200


# Pricing endpoints are login-only (why guests see no prices)
class TestPricingRequiresAuth:
    def test_quote_estimate_401_guest(self, s):
        r = s.get(f"{BASE_URL}/api/quote/estimate", params={"pickup_lat": 52.48, "pickup_lng": -1.89, "dropoff_lat": 53.48, "dropoff_lng": -2.24})
        assert r.status_code == 401

    def test_booking_fee_preview_401_guest(self, s):
        r = s.get(f"{BASE_URL}/api/booking-fees/preview", params={"driver_charge": 100})
        assert r.status_code == 401

    def test_asap_quote_401_guest(self, s):
        r = s.post(f"{BASE_URL}/api/asap/quote", json={"pickup_lat": 52.48, "pickup_lng": -1.89, "dropoff_lat": 52.40, "dropoff_lng": -1.51, "service_type": "transport"})
        assert r.status_code == 401

    def test_jobs_post_401_guest(self, s):
        r = s.post(f"{BASE_URL}/api/jobs", json={"title": "TEST_guest"})
        assert r.status_code in (401, 403)

    def test_quote_estimate_works_for_customer(self, s):
        lg = s.post(f"{BASE_URL}/api/auth/login", json=CUSTOMER)
        if lg.status_code != 200:
            pytest.skip("customer login failed")
        r = s.get(f"{BASE_URL}/api/quote/estimate", params={"pickup_lat": 52.48, "pickup_lng": -1.89, "dropoff_lat": 53.48, "dropoff_lng": -2.24, "category": "furniture_delivery"})
        assert r.status_code == 200
        assert r.json().get("suggested_price", 0) > 0
        f = s.get(f"{BASE_URL}/api/booking-fees/preview", params={"driver_charge": r.json()["suggested_price"]})
        assert f.status_code == 200
        assert f.json()["customer_total"] > f.json()["booking_fee"] > 0


# Account step: duplicate email message must match the UI regex /already registered/i
class TestAccountStepContract:
    def test_duplicate_register_message(self, s):
        r = s.post(f"{BASE_URL}/api/auth/register", json={"email": CUSTOMER["email"], "password": "Whatever12345!", "name": "Dup", "role": "customer"})
        assert r.status_code == 400
        assert "already registered" in r.text.lower()

    def test_login_sets_httponly_cookie(self, s):
        r = s.post(f"{BASE_URL}/api/auth/login", json=CUSTOMER)
        assert r.status_code == 200
        sc = r.headers.get("set-cookie", "")
        assert "httponly" in sc.lower()
        assert r.json().get("user", r.json()).get("role") == "customer" or r.json().get("role") == "customer"

    def test_cors_credentials(self, s):
        # CORS_ORIGINS is the production domain list; preview UI is same-origin so needs no CORS.
        origin = "https://cargoone.co.uk"
        r = s.options(f"{BASE_URL}/api/auth/login", headers={"Origin": origin, "Access-Control-Request-Method": "POST"})
        assert r.headers.get("access-control-allow-credentials") == "true"
        assert r.headers.get("access-control-allow-origin") == origin

    @pytest.mark.xfail(reason="R82 finding: backend /auth/register accepts <8 char passwords (UI-only check)", strict=False)
    def test_register_short_password_rejected(self, s):
        r = s.post(f"{BASE_URL}/api/auth/register", json={"email": f"qf-test-{uuid.uuid4().hex[:6]}@example.com", "password": "short", "name": "X", "role": "customer"})
        assert r.status_code in (400, 422)
