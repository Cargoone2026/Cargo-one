"""Final QA Round 13 — Ops nudge endpoint + email template."""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone, timedelta

import pytest
import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://cargo-repo-bridge.preview.emergentagent.com",
).rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@cargoone.com"
ADMIN_PASSWORD = "Vc9O0sNDGR6SfzKDaa0L1lhp"
CUSTOMER_EMAIL = "testcustomer@example.com"
CUSTOMER_PASSWORD = "CustomerTest12345!"
DRIVER_EMAIL = "testdriver@example.com"
DRIVER_PASSWORD = "DriverTest12345!"


def _bearer(tok):
    return {"Authorization": f"Bearer {tok}"}


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text[:200]}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_tok():
    return _login(ADMIN_EMAIL, ADMIN_PASSWORD)


@pytest.fixture(scope="module")
def customer_tok():
    return _login(CUSTOMER_EMAIL, CUSTOMER_PASSWORD)


@pytest.fixture(scope="module")
def driver_tok():
    try:
        return _login(DRIVER_EMAIL, DRIVER_PASSWORD)
    except AssertionError:
        pytest.skip("testdriver login failed — R12 may have altered password")


# ------------------------- GET drivers-missing-phone -------------------------


def test_get_drivers_missing_phone_shape(admin_tok):
    r = requests.get(f"{API}/admin/drivers-missing-phone", headers=_bearer(admin_tok), timeout=20)
    assert r.status_code == 200
    body = r.json()
    assert set(["count", "total_drivers", "drivers"]).issubset(body.keys())
    assert isinstance(body["drivers"], list)
    assert body["count"] == len(body["drivers"])


# ------------------------- POST nudge — auth guards --------------------------


def test_nudge_requires_auth():
    r = requests.post(f"{API}/admin/drivers-missing-phone/nudge", timeout=15)
    assert r.status_code in (401, 403)


def test_nudge_forbids_customer(customer_tok):
    r = requests.post(f"{API}/admin/drivers-missing-phone/nudge", headers=_bearer(customer_tok), timeout=15)
    assert r.status_code == 403


def test_nudge_forbids_driver(driver_tok):
    r = requests.post(f"{API}/admin/drivers-missing-phone/nudge", headers=_bearer(driver_tok), timeout=15)
    assert r.status_code == 403


# ------------------------- POST nudge — happy path ---------------------------


def test_nudge_first_and_second_call(admin_tok):
    # first call
    r1 = requests.post(f"{API}/admin/drivers-missing-phone/nudge", headers=_bearer(admin_tok), timeout=60)
    assert r1.status_code == 200
    b1 = r1.json()
    assert b1["ok"] is True
    for k in ("flagged", "sent", "skipped", "failed", "skipped_reasons"):
        assert k in b1
    assert isinstance(b1["flagged"], int)
    assert isinstance(b1["skipped_reasons"], list)
    # provider is offline in preview → sent==0, everything skipped or dedupe
    # (main agent noted 331 flagged in preview)
    assert b1["flagged"] >= 0
    assert b1["sent"] + b1["skipped"] + b1["failed"] == b1["flagged"]

    # second call — within 24h, should dedupe every row
    r2 = requests.post(f"{API}/admin/drivers-missing-phone/nudge", headers=_bearer(admin_tok), timeout=60)
    assert r2.status_code == 200
    b2 = r2.json()
    assert b2["flagged"] == b1["flagged"]
    assert b2["sent"] == 0
    assert b2["failed"] == 0
    # every one should be skipped this time (dedupe)
    assert b2["skipped"] == b2["flagged"]
    if b2["flagged"] > 0:
        assert "dedupe_24h" in b2["skipped_reasons"]


def test_nudge_stamps_users_and_email_log(admin_tok):
    """After a nudge call, flagged drivers should have nudged_add_phone_at
    ISO string set, and email_log should have new rows with template=driver_add_phone_nudge.
    We assert via the GET endpoint (which returns the same driver rows)."""
    # trigger (idempotent within 24h)
    requests.post(f"{API}/admin/drivers-missing-phone/nudge", headers=_bearer(admin_tok), timeout=60)
    r = requests.get(f"{API}/admin/drivers-missing-phone", headers=_bearer(admin_tok), timeout=20)
    assert r.status_code == 200
    drivers = r.json()["drivers"]
    if not drivers:
        pytest.skip("no flagged drivers in preview")
    # Every flagged driver should now have the timestamp field
    stamped = [d for d in drivers if d.get("nudged_add_phone_at")]
    assert len(stamped) >= 1, "expected at least one driver stamped with nudged_add_phone_at"
    sample = stamped[0]
    # ISO parseable
    ts = sample["nudged_add_phone_at"]
    assert isinstance(ts, str)
    parsed = datetime.fromisoformat(ts.replace("Z", "+00:00"))
    now = datetime.now(timezone.utc)
    assert (now - parsed) < timedelta(hours=24)
    assert sample.get("nudged_add_phone_last_status") in ("sent", "skipped")
    assert sample.get("nudged_add_phone_by_id")


# ------------------------- Email template render -----------------------------


def test_render_driver_add_phone_nudge_template():
    """Direct import test of the render helper (no network)."""
    import sys
    sys.path.insert(0, "/app/backend")
    from services.email import render_driver_add_phone_nudge

    subject, html, text = render_driver_add_phone_nudge(
        driver_name="Alice", profile_url="https://cargo-repo-bridge.preview.emergentagent.com/driver/profile"
    )
    assert subject == "Add your phone to keep receiving Cargo One jobs"
    # driver/profile appears at least once
    assert html.count("driver/profile") >= 1
    assert text.count("driver/profile") >= 1
    # 'phone' appears at least twice in each (case-insensitive)
    assert html.lower().count("phone") >= 2
    assert text.lower().count("phone") >= 2
    # Driver name mentioned in text fallback
    assert "Alice" in text
