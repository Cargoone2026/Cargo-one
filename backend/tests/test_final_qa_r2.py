"""Final QA Round 2 backend contract tests — address fields on register/PUT/GET /auth/me.

Covers:
 - POST /api/auth/register accepts + echoes address_line1..country
 - GET /api/auth/me surfaces address fields
 - PUT /api/auth/me (CSRF via cookie+header) persists address fields
 - Regression: /api/auth/login, /api/auth/logout, /api/auth/me still work
"""
import os
import time
import uuid
import requests

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL",
    "https://cargo-repo-bridge.preview.emergentagent.com",
).rstrip("/")
API = f"{BASE_URL}/api"

ADDRESS_FIELDS = [
    "address_line1", "address_line2", "town", "county", "postcode", "country",
]


def _unique_email(tag: str) -> str:
    return f"TEST_qar2_{tag}_{uuid.uuid4().hex[:8]}@example.com"


def _register(payload):
    return requests.post(f"{API}/auth/register", json=payload, timeout=20)


def _login_cookie_session(email, password):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, r.text
    return s


# ---------------------------------------------------------------------------
# 1. Register: address fields persisted + echoed
# ---------------------------------------------------------------------------

def test_register_persists_and_echoes_address_fields():
    email = _unique_email("reg")
    payload = {
        "email": email,
        "password": "PasswordTest12345!",
        "name": "QA R2 Reg",
        "phone": "+447700900123",
        "role": "customer",
        "address_line1": "12 Fleet Street",
        "address_line2": "Suite 3",
        "town": "London",
        "county": "Greater London",
        "postcode": "EC4Y 1AA",
        "country": "United Kingdom",
    }
    r = _register(payload)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "user" in data
    u = data["user"]
    for f in ADDRESS_FIELDS:
        assert u.get(f) == payload[f], f"register response missing/mismatched field {f}: got {u.get(f)}"


# ---------------------------------------------------------------------------
# 2. GET /auth/me surfaces address fields
# ---------------------------------------------------------------------------

def test_get_me_returns_address_fields():
    email = _unique_email("me")
    password = "PasswordTest12345!"
    payload = {
        "email": email,
        "password": password,
        "name": "QA R2 Me",
        "phone": "+447700900124",
        "role": "customer",
        "address_line1": "1 Main Rd",
        "town": "Manchester",
        "postcode": "M1 1AE",
        "country": "United Kingdom",
    }
    r = _register(payload)
    assert r.status_code == 200, r.text

    s = _login_cookie_session(email, password)
    r2 = s.get(f"{API}/auth/me", timeout=20)
    assert r2.status_code == 200, r2.text
    me = r2.json()
    assert me["address_line1"] == "1 Main Rd"
    assert me["town"] == "Manchester"
    assert me["postcode"] == "M1 1AE"
    assert me["country"] == "United Kingdom"
    # Optional fields must still be present as keys (None allowed).
    for f in ADDRESS_FIELDS:
        assert f in me, f"GET /auth/me missing key {f}"


# ---------------------------------------------------------------------------
# 3. PUT /auth/me updates address fields (CSRF-guarded)
# ---------------------------------------------------------------------------

def test_put_me_updates_address_fields_with_csrf():
    email = _unique_email("put")
    password = "PasswordTest12345!"
    r = _register({
        "email": email, "password": password,
        "name": "QA R2 Put", "phone": "+447700900125", "role": "customer",
    })
    assert r.status_code == 200, r.text

    s = _login_cookie_session(email, password)
    csrf = s.cookies.get("cargoone_csrf")
    assert csrf, f"cargoone_csrf cookie missing after login. cookies={s.cookies.get_dict()}"

    new_addr = {
        "address_line1": "99 Testing Ln",
        "address_line2": "Flat 2",
        "town": "Birmingham",
        "county": "West Midlands",
        "postcode": "B1 1AA",
        "country": "United Kingdom",
        "phone": "+447700900999",
    }
    r2 = s.put(
        f"{API}/auth/me",
        json=new_addr,
        headers={"X-CSRF-Token": csrf},
        timeout=20,
    )
    assert r2.status_code == 200, r2.text
    body = r2.json()
    for f in ADDRESS_FIELDS:
        assert body.get(f) == new_addr[f], f"PUT /auth/me did not echo {f}: got {body.get(f)}"

    # Verify persistence via GET /auth/me
    r3 = s.get(f"{API}/auth/me", timeout=20)
    assert r3.status_code == 200
    persisted = r3.json()
    for f in ADDRESS_FIELDS:
        assert persisted[f] == new_addr[f], f"persisted mismatch on {f}"


def test_put_me_without_csrf_is_rejected():
    email = _unique_email("nocsrf")
    password = "PasswordTest12345!"
    r = _register({
        "email": email, "password": password,
        "name": "QA R2 NoCSRF", "role": "customer",
    })
    assert r.status_code == 200
    s = _login_cookie_session(email, password)
    r2 = s.put(f"{API}/auth/me", json={"address_line1": "should-fail"}, timeout=20)
    assert r2.status_code in (401, 403), f"expected CSRF rejection, got {r2.status_code}"


# ---------------------------------------------------------------------------
# 4. Regression: login/logout/me for a pre-existing seeded user
# ---------------------------------------------------------------------------

def test_regression_login_me_logout_seeded_customer():
    # Pre-seeded customer from /app/memory/test_credentials.md
    email = "testcustomer@example.com"
    password = "CustomerTest12345!"
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, r.text
    csrf = s.cookies.get("cargoone_csrf")
    assert csrf

    r2 = s.get(f"{API}/auth/me", timeout=20)
    assert r2.status_code == 200
    me = r2.json()
    assert me["email"] == email
    # Address fields should be present as keys even if None
    for f in ADDRESS_FIELDS:
        assert f in me

    r3 = s.post(f"{API}/auth/logout", headers={"X-CSRF-Token": csrf}, timeout=20)
    assert r3.status_code in (200, 204), r3.text


# ---------------------------------------------------------------------------
# 5. Regression: booking-fee bands endpoint still exposed
# ---------------------------------------------------------------------------

def test_regression_booking_fee_bands_preview():
    r = requests.get(f"{API}/booking-fee-bands/preview", params={"driver_charge": 100.0}, timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "booking_fee" in data and "booking_fee_percent" in data


# ---------------------------------------------------------------------------
# 6. Regression: /payments/status/{unknown} returns 404 (not 401) — public route
# ---------------------------------------------------------------------------

def test_regression_payments_status_public_returns_404_for_unknown():
    fake = "cs_test_" + "a" * 70
    r = requests.get(f"{API}/payments/status/{fake}", timeout=20)
    assert r.status_code == 404, f"expected 404, got {r.status_code}: {r.text[:200]}"
