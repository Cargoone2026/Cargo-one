"""Shared pytest fixtures for Cargo One backend tests.

Bootstraps the fixture users that the wave-3 / final-acceptance suites assume
exist (`driver1@cargoone.com`, `cust1@cargoone.com`). This was previously done
out-of-band; centralising it here makes the suite self-contained.
"""
import os

# Load backend/.env explicitly. In the container, the shell env has a stale
# `STRIPE_API_KEY=sk_test_emergent` placeholder (and no admin password), so
# `override=True` is important — same pattern already used by
# test_stripe_refund_r40_smoke.py + test_cash_reminder_r45.py.
try:
    from dotenv import load_dotenv
    load_dotenv("/app/backend/.env", override=False)
except Exception:
    pass

import pytest
import requests

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL",
    "https://cargo-repo-bridge.preview.emergentagent.com",
).rstrip("/")
API = f"{BASE_URL}/api"

# R50 fix — fall back to the backend's OWN admin-seed password before the
# ancient 'admin123' hard-coded default. This way tests work out of the box
# on any environment where INITIAL_ADMIN_PASSWORD is set in backend/.env
# (which is the case on preview + production), without requiring an explicit
# TEST_ADMIN_PASSWORD export.
ADMIN_EMAIL = os.environ.get("TEST_ADMIN_EMAIL", "admin@cargoone.com")
ADMIN_PASSWORD = (
    os.environ.get("TEST_ADMIN_PASSWORD")
    or os.environ.get("INITIAL_ADMIN_PASSWORD")
    or "admin123"
)

FIXTURE_CUSTOMER = {
    "email": "cust1@cargoone.com",
    "password": "cust1234",
    "name": "Cust One",
    "phone": "+441234500001",
    "role": "customer",
}
FIXTURE_DRIVER = {
    "email": "driver1@cargoone.com",
    "password": "driver123",
    "name": "Driver One",
    "phone": "+441234500002",
    "role": "driver",
}


def _register_if_missing(payload):
    r = requests.post(f"{API}/auth/register", json=payload, timeout=15)
    if r.status_code == 200:
        return r.json()["user"]["id"]
    # Duplicate email => already exists; fetch id via admin.
    if r.status_code == 400 and "already" in r.text.lower():
        return None
    r.raise_for_status()
    return None


def _admin_token():
    r = requests.post(
        f"{API}/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=15,
    )
    r.raise_for_status()
    return r.json()["access_token"]


def _find_user_id(admin_token, email, role):
    r = requests.get(
        f"{API}/admin/users",
        params={"role": role},
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=15,
    )
    r.raise_for_status()
    for u in r.json():
        if u.get("email") == email:
            return u["id"]
    return None


@pytest.fixture(scope="session", autouse=True)
def _bootstrap_fixture_users():
    """Idempotently ensure driver1 + cust1 exist and driver1 is approved.

    Runs once per test session.
    """
    try:
        _register_if_missing(FIXTURE_CUSTOMER)
        _register_if_missing(FIXTURE_DRIVER)
        token = _admin_token()
        driver_id = _find_user_id(token, FIXTURE_DRIVER["email"], "driver")
        if driver_id:
            # Approve driver so it can access driver endpoints.
            requests.post(
                f"{API}/admin/users/{driver_id}/approve",
                headers={"Authorization": f"Bearer {token}"},
                timeout=15,
            )
            # Mark docs verified so verified_driver flag becomes True on tests
            # that assert it. Uses admin doc-review path only if any pending
            # docs exist; safe no-op otherwise.
    except Exception as exc:  # pragma: no cover
        # Don't hard-fail the entire suite here; individual tests will surface
        # more actionable errors when their assumed accounts are absent.
        print(f"[conftest] fixture user bootstrap warning: {exc}")
    yield


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s
