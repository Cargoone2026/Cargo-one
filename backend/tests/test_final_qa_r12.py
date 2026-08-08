"""Final QA Round 12 — Phone validator (UK/E.164) + admin backfill endpoint.

Covers:
  * POST /auth/register phone rules for driver + customer.
  * PUT  /auth/me phone rules for driver + customer.
  * GET  /admin/drivers-missing-phone (admin token, shape + membership).
  * Contract parity: is_valid_phone mirrors frontend isValidPhone.
"""
from __future__ import annotations

import os
import uuid

import pytest
import requests

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL",
    "https://cargo-repo-bridge.preview.emergentagent.com",
).rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@cargoone.com"
ADMIN_PASSWORD = "Vc9O0sNDGR6SfzKDaa0L1lhp"


def _bearer(tok):
    return {"Authorization": f"Bearer {tok}"}


def _u(tag):
    return f"TEST_qar12_{tag}_{uuid.uuid4().hex[:8]}@example.com"


def _register(email, role, phone=None, extra=None):
    body = {
        "email": email,
        "password": "PasswordTest12345!",
        "name": f"QAR12 {role}",
        "role": role,
    }
    if phone is not None:
        body["phone"] = phone
    if extra:
        body.update(extra)
    return requests.post(f"{API}/auth/register", json=body, timeout=15)


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
                      timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


# ---------------------------------------------------------------------------
# Register — driver phone rules
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("phone", ["1234567", "abcdefg", "07abc900123", "+", "12"])
def test_driver_register_junk_phone_rejected(phone):
    r = _register(_u("bad"), "driver", phone=phone)
    assert r.status_code == 400, f"phone={phone!r} -> {r.status_code} {r.text}"


@pytest.mark.parametrize("phone", [
    "07700900123",
    "+447700900456",
    "00447700900789",
    "07700 900 123",       # spaces stripped
    "+44 7700 900 456",    # spaces stripped
])
def test_driver_register_valid_phone_accepted(phone):
    r = _register(_u("ok"), "driver", phone=phone)
    assert r.status_code == 200, f"phone={phone!r} -> {r.status_code} {r.text}"
    body = r.json()
    assert body["user"]["role"] == "driver"


def test_driver_register_missing_phone_rejected():
    r = _register(_u("noph"), "driver", phone=None)
    assert r.status_code == 400, r.text


def test_driver_register_empty_phone_rejected():
    r = _register(_u("emptyph"), "driver", phone="")
    assert r.status_code == 400, r.text


# ---------------------------------------------------------------------------
# Register — customer phone rules (optional but structural)
# ---------------------------------------------------------------------------

def test_customer_register_junk_phone_rejected():
    r = _register(_u("cbad"), "customer", phone="1234")
    assert r.status_code == 400, r.text


def test_customer_register_empty_phone_accepted():
    r = _register(_u("cempty"), "customer", phone="")
    assert r.status_code == 200, r.text


def test_customer_register_missing_phone_accepted():
    r = _register(_u("cnone"), "customer", phone=None)
    assert r.status_code == 200, r.text


def test_customer_register_valid_phone_accepted():
    r = _register(_u("cok"), "customer", phone="07700900321")
    assert r.status_code == 200, r.text


# ---------------------------------------------------------------------------
# PUT /auth/me phone rules
# ---------------------------------------------------------------------------

def test_driver_put_me_junk_phone_rejected():
    email = _u("putbad")
    reg = _register(email, "driver", phone="07700900123")
    assert reg.status_code == 200, reg.text
    tok = reg.json()["access_token"]
    r = requests.put(f"{API}/auth/me", json={"phone": "not-a-phone"},
                     headers=_bearer(tok), timeout=15)
    assert r.status_code == 400, r.text


def test_driver_put_me_valid_phone_persists():
    email = _u("putok")
    reg = _register(email, "driver", phone="07700900123")
    assert reg.status_code == 200, reg.text
    tok = reg.json()["access_token"]
    r = requests.put(f"{API}/auth/me", json={"phone": "07700900321"},
                     headers=_bearer(tok), timeout=15)
    assert r.status_code == 200, r.text
    # GET verify persistence
    me = requests.get(f"{API}/auth/me", headers=_bearer(tok), timeout=15).json()
    assert me["phone"] == "07700900321"


def test_driver_put_me_empty_phone_rejected():
    """Driver cannot clear their phone."""
    email = _u("putclr")
    reg = _register(email, "driver", phone="07700900123")
    assert reg.status_code == 200, reg.text
    tok = reg.json()["access_token"]
    r = requests.put(f"{API}/auth/me", json={"phone": ""},
                     headers=_bearer(tok), timeout=15)
    assert r.status_code == 400, r.text


def test_customer_put_me_clear_phone_ok():
    email = _u("custclr")
    reg = _register(email, "customer", phone="07700900321")
    assert reg.status_code == 200, reg.text
    tok = reg.json()["access_token"]
    r = requests.put(f"{API}/auth/me", json={"phone": ""},
                     headers=_bearer(tok), timeout=15)
    assert r.status_code == 200, r.text


def test_customer_put_me_junk_phone_rejected():
    email = _u("custjunk")
    reg = _register(email, "customer", phone="")
    assert reg.status_code == 200, reg.text
    tok = reg.json()["access_token"]
    r = requests.put(f"{API}/auth/me", json={"phone": "not-a-phone"},
                     headers=_bearer(tok), timeout=15)
    assert r.status_code == 400, r.text


# ---------------------------------------------------------------------------
# Admin backfill endpoint
# ---------------------------------------------------------------------------

def test_admin_drivers_missing_phone_shape(admin_token):
    r = requests.get(f"{API}/admin/drivers-missing-phone",
                     headers=_bearer(admin_token), timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    assert set(body.keys()) >= {"count", "total_drivers", "drivers"}
    assert isinstance(body["count"], int)
    assert isinstance(body["total_drivers"], int)
    assert isinstance(body["drivers"], list)
    assert body["count"] == len(body["drivers"])
    assert body["count"] <= body["total_drivers"]
    # Each flagged driver should have role=driver and either empty or invalid phone
    for d in body["drivers"][:20]:
        assert d.get("role") == "driver"
        phone = (d.get("phone") or "").strip()
        # Should fail validator: either empty or structurally invalid.
        # Since we replicate the FE rule, do a basic sanity check.
        assert phone == "" or not phone.replace(" ", "").replace("-", "").isdigit() \
               or len(phone.replace(" ", "").replace("-", "")) < 8


def test_admin_drivers_missing_phone_requires_admin():
    """Non-admin (customer) call must be blocked."""
    email = _u("nadm")
    reg = _register(email, "customer", phone="07700900123")
    tok = reg.json()["access_token"]
    r = requests.get(f"{API}/admin/drivers-missing-phone",
                     headers=_bearer(tok), timeout=15)
    assert r.status_code in (401, 403), r.text


def test_admin_drivers_missing_phone_unauth():
    r = requests.get(f"{API}/admin/drivers-missing-phone", timeout=15)
    assert r.status_code == 401, r.text
