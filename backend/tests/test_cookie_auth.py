"""Cookie-auth compatibility tests for the web frontend port.

Verifies:
- POST /auth/login sets an HttpOnly Secure SameSite=Lax cookie.
- POST /auth/register sets the same cookie on account creation.
- GET /auth/me works with the cookie alone (no Authorization header).
- Bearer token continues to work (native/mobile backwards compat).
- POST /auth/logout clears the cookie and subsequent /auth/me is 401.
"""

import os
import uuid

import requests

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL",
    "https://cargo-repo-bridge.preview.emergentagent.com",
).rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = os.environ.get("TEST_ADMIN_EMAIL", "admin@cargoone.com")
ADMIN_PASSWORD = (os.environ.get("TEST_ADMIN_PASSWORD") or os.environ.get("INITIAL_ADMIN_PASSWORD") or "admin123")


def _cookie(session: requests.Session, name: str):
    for c in session.cookies:
        if c.name == name:
            return c
    return None


def test_login_sets_httponly_cookie():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("access_token"), "login must still return access_token (bearer compat)"
    assert body["user"]["role"] == "admin"
    # HttpOnly cookie
    c = _cookie(s, "cargoone_session")
    assert c is not None, "cargoone_session cookie must be set"
    assert c.secure is True, "cookie must be Secure"
    # requests exposes HttpOnly via rest['HttpOnly']; treat truthy as present
    assert c.has_nonstandard_attr("HttpOnly") or c._rest.get("HttpOnly") is not None, "cookie must be HttpOnly"
    # SameSite=Lax
    samesite = c._rest.get("SameSite") or c._rest.get("samesite")
    assert (samesite or "").lower() == "lax", f"cookie SameSite must be Lax, got {samesite!r}"


def test_me_works_with_cookie_only():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    # Cookie-only: do NOT send Authorization header.
    me = s.get(f"{API}/auth/me")
    assert me.status_code == 200, me.text
    assert me.json()["role"] == "admin"


def test_bearer_still_works():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200
    token = r.json()["access_token"]
    me = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200, me.text
    assert me.json()["role"] == "admin"


def test_register_sets_cookie_and_returns_token():
    s = requests.Session()
    email = f"cookie-test-{uuid.uuid4().hex[:8]}@example.com"
    r = s.post(
        f"{API}/auth/register",
        json={
            "email": email,
            "password": "TestPass!234",
            "name": "Cookie Test",
            "phone": "+441234567890",
            "role": "customer",
        },
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("access_token")
    assert body["user"]["email"] == email
    assert _cookie(s, "cargoone_session") is not None
    # Session works cookie-only
    me = s.get(f"{API}/auth/me")
    assert me.status_code == 200
    assert me.json()["email"] == email


def test_logout_clears_cookie_and_blocks_subsequent_requests():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200
    # Confirm authenticated
    assert s.get(f"{API}/auth/me").status_code == 200
    # Logout
    lo = s.post(f"{API}/auth/logout")
    assert lo.status_code == 200
    assert lo.json() == {"ok": True}
    # Session cookie removed by server response
    assert _cookie(s, "cargoone_session") is None, "logout must clear cargoone_session cookie"
    # Subsequent request must 401
    me = s.get(f"{API}/auth/me")
    assert me.status_code == 401


def test_no_auth_returns_401():
    r = requests.get(f"{API}/auth/me")
    assert r.status_code == 401
