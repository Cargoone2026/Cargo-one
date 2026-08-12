"""R26.1 E2E certification — items 3/4/5 (API-level checks).

Item 3: three-way domestic ASAP consistency between /asap/quote and /pricing/quote
Item 4: international guardrail on both endpoints
Item 5: domestic /pricing/quote asap mode

Run: pytest -v /app/backend/tests/test_r26_1_e2e_certification.py
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://cargo-repo-bridge.preview.emergentagent.com").rstrip("/")

CUSTOMER_EMAIL = "testcustomer@example.com"
CUSTOMER_PW = "CustomerTest12345!"


@pytest.fixture(scope="module")
def customer_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": CUSTOMER_EMAIL, "password": CUSTOMER_PW},
                      timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    tok = r.json().get("access_token") or r.json().get("token")
    assert tok, f"no token in response: {r.json()}"
    return tok


@pytest.fixture
def auth_headers(customer_token):
    return {"Authorization": f"Bearer {customer_token}", "Content-Type": "application/json"}


# --- Item 5: domestic /pricing/quote in asap mode ------------------------
def test_domestic_pricing_quote_asap(auth_headers):
    payload = {
        "pickup_lat": 52.5, "pickup_lng": -1.5,
        "dropoff_lat": 52.7, "dropoff_lng": -1.1,
        "service_type": "transport",
        "service_timing": "asap",
        "requested_vehicle_key": "lwb_van",
        "pickup_country_code": "GB",
        "dropoff_country_code": "GB",
    }
    r = requests.post(f"{BASE_URL}/api/pricing/quote", json=payload, headers=auth_headers, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    print("DOMESTIC /pricing/quote asap:", data)
    assert data.get("requires_manual_review") in (False, None), data
    assert isinstance(data.get("driver_charge"), (int, float))
    assert isinstance(data.get("customer_total"), (int, float))
    assert data.get("engine_version") == "ASAP-V1.0"


# --- Item 4: international guardrail -------------------------------------
INTL_PAYLOAD = {
    "pickup_lat": 51.5, "pickup_lng": -0.1,
    "dropoff_lat": 53.3, "dropoff_lng": -6.2,
    "service_type": "transport",
    "service_timing": "asap",
    "requested_vehicle_key": "lwb_van",
    "pickup_country_code": "GB",
    "dropoff_country_code": "IE",
}


def test_intl_pricing_quote_asap_guardrail(auth_headers):
    r = requests.post(f"{BASE_URL}/api/pricing/quote", json=INTL_PAYLOAD, headers=auth_headers, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    print("INTL /pricing/quote:", data)
    assert data.get("requires_manual_review") is True
    assert data.get("route_class") == "international"
    assert "driver_charge" not in data or data.get("driver_charge") is None
    assert "customer_total" not in data or data.get("customer_total") is None
    assert data.get("engine_version") == "ASAP-V1.0"


def test_intl_asap_quote_guardrail(auth_headers):
    payload = {k: v for k, v in INTL_PAYLOAD.items() if k != "service_timing"}
    r = requests.post(f"{BASE_URL}/api/asap/quote", json=payload, headers=auth_headers, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    print("INTL /asap/quote:", data)
    assert data.get("requires_manual_review") is True
    assert data.get("route_class") == "international"
    assert data.get("engine_version") == "ASAP-V1.0"


# --- Item 3: three-way consistency for domestic transport ~25 mi ---------
CONSISTENCY_PAYLOAD_ASAP = {
    "pickup_lat": 51.507, "pickup_lng": -0.128,       # London
    "dropoff_lat": 51.236, "dropoff_lng": -0.570,     # Guildford (~25 mi)
    "service_type": "transport",
    "requested_vehicle_key": "lwb_van",
    "pickup_country_code": "GB",
    "dropoff_country_code": "GB",
}


def test_three_way_domestic_asap_consistency(auth_headers):
    # /asap/quote
    r1 = requests.post(f"{BASE_URL}/api/asap/quote",
                       json=CONSISTENCY_PAYLOAD_ASAP, headers=auth_headers, timeout=30)
    assert r1.status_code == 200, r1.text
    d1 = r1.json()
    print("CONSISTENCY /asap/quote:", d1)

    # /pricing/quote with service_timing=asap
    p2 = dict(CONSISTENCY_PAYLOAD_ASAP)
    p2["service_timing"] = "asap"
    r2 = requests.post(f"{BASE_URL}/api/pricing/quote",
                       json=p2, headers=auth_headers, timeout=30)
    assert r2.status_code == 200, r2.text
    d2 = r2.json()
    print("CONSISTENCY /pricing/quote asap:", d2)

    for k in ("driver_charge", "booking_fee", "customer_total", "engine_version"):
        assert d1.get(k) == d2.get(k), (
            f"mismatch on {k}: /asap/quote={d1.get(k)} vs /pricing/quote={d2.get(k)}"
        )
    assert d1["engine_version"] == "ASAP-V1.0"
