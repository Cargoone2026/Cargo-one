"""RC1 Wave 2 backend smoke regression tests.

Only tests the endpoints called out in the review request:
1) GET  /api/                  → 200 { app, version, status }
2) POST /api/auth/login        → 200 + JWT (seeded admin)
3) POST /api/auth/register     → 200 + JWT (new customer)
4) GET  /api/deposit-bands     → configured bands (with JWT)
5) GET  /api/booking-fees/preview?driver_charge=250 → { booking_fee, customer_total, ... }
"""

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
ADMIN_PASSWORD = os.environ.get("TEST_ADMIN_PASSWORD", "admin123")


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_token(api):
    r = api.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=30,
    )
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    tok = r.json().get("access_token") or r.json().get("token")
    assert tok, f"no token in login response: {r.json()}"
    return tok


# 1) Root
def test_root_endpoint(api):
    r = api.get(f"{BASE_URL}/api/", timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    for key in ("app", "version", "status"):
        assert key in data, f"missing key {key!r} in root response: {data}"


# 2) Admin login
def test_admin_login(admin_token):
    assert admin_token
    # JWT rough sanity: three segments separated by "."
    assert admin_token.count(".") == 2, f"not a JWT: {admin_token[:40]}..."


# 3) Register a new customer
def test_register_new_customer(api):
    email = f"TEST_wave2_{uuid.uuid4().hex[:10]}@example.com"
    r = api.post(
        f"{BASE_URL}/api/auth/register",
        json={
            "email": email,
            "password": "TestPass123!",
            "name": "Wave2 Customer",
            "role": "customer",
        },
        timeout=30,
    )
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    data = r.json()
    tok = data.get("access_token") or data.get("token")
    assert tok and tok.count(".") == 2, f"no JWT in register: {data}"
    # backend lowercases emails
    assert data.get("user", {}).get("email", "").lower() == email.lower()


# 4) Deposit bands
def test_deposit_bands(api, admin_token):
    r = api.get(
        f"{BASE_URL}/api/deposit-bands",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    # Accept either a bare list or {"bands": [...]}
    bands = data.get("bands", data) if isinstance(data, dict) else data
    assert isinstance(bands, list) and len(bands) > 0, f"no bands returned: {data}"
    b = bands[0]
    # Each band should carry at least an amount / fee-like fields
    assert isinstance(b, dict) and len(b) > 0


# 5) Booking-fee preview
def test_booking_fee_preview(api, admin_token):
    r = api.get(
        f"{BASE_URL}/api/booking-fees/preview",
        params={"driver_charge": 250},
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert "booking_fee" in data, f"missing booking_fee: {data}"
    assert "customer_total" in data, f"missing customer_total: {data}"
    # sanity: total ≈ driver_charge + booking_fee
    assert float(data["customer_total"]) >= 250
