"""Regression tests for the P0 Job Lifecycle Fix batch (Fix 1B + Fix 2A).

Uses the live preview backend (same pattern as `test_cookie_auth.py`),
because `server.py` uses async Motor which does not play nicely with
FastAPI's TestClient lifespan.

Fix 1B — `/api/jobs/nearby` without an explicit lat/lng anchor returns every
eligible posted job (no proximity filter). With an anchor, radius applies.

Fix 2A — `/api/driver/accepted-jobs` returns only the caller-driver's jobs
in the pre-deposit "accepted" state.
"""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone, timedelta

import pytest
import requests

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL",
    "https://cargo-repo-bridge.preview.emergentagent.com",
).rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = os.environ.get("TEST_ADMIN_EMAIL", "admin@cargoone.com")
ADMIN_PASSWORD = os.environ.get("TEST_ADMIN_PASSWORD", "Vc9O0sNDGR6SfzKDaa0L1lhp")


def _register(role):
    email = f"lc-{role}-{uuid.uuid4().hex[:10]}@x.io"
    r = requests.post(
        f"{API}/auth/register",
        json={
            "email": email,
            "password": "LifeCycle12345!",
            "name": f"LC {role}",
            "phone": "+441111111111" if role == "customer" else "+442222222222",
            "role": role,
        },
        timeout=15,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    return body["access_token"], body["user"]["id"], email


def _approve_driver(driver_id):
    a = requests.post(
        f"{API}/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=15,
    )
    assert a.status_code == 200, a.text
    admin_tok = a.json()["access_token"]
    r = requests.post(
        f"{API}/admin/users/{driver_id}/approve",
        headers={"Authorization": f"Bearer {admin_tok}"},
        timeout=15,
    )
    assert r.status_code == 200, r.text


def _post_uk_fixed_job(customer_token, *, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, title):
    now = datetime.now(timezone.utc)
    r = requests.post(
        f"{API}/jobs",
        headers={"Authorization": f"Bearer {customer_token}"},
        json={
            "title": title,
            "description": "P0 lifecycle regression job",
            "category": "parcels",
            "pickup_town": "PickupTown",
            "dropoff_town": "DropoffTown",
            "pickup_address": "1 Test St",
            "dropoff_address": "2 Test St",
            "pickup_lat": pickup_lat,
            "pickup_lng": pickup_lng,
            "dropoff_lat": dropoff_lat,
            "dropoff_lng": dropoff_lng,
            "pickup_country_code": "GB",
            "dropoff_country_code": "GB",
            "collection_date": (now + timedelta(days=14)).isoformat(),
            "delivery_date": (now + timedelta(days=15)).isoformat(),
            "pricing_type": "fixed",
            "fixed_price": 200,
            "weight_kg": 20,
        },
        timeout=20,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "posted", body
    return body["id"]


# -------------------------------------------------------------------
# Fix 1B — /jobs/nearby anchor semantics
# -------------------------------------------------------------------

def test_nearby_returns_all_posted_when_no_lat_lng_given():
    """The Manchester-outside-London regression: driver hits /jobs/nearby
    with no coordinates → gets the far-away job back regardless of distance."""
    ct, _, _ = _register("customer")
    dt, drv_id, _ = _register("driver")
    _approve_driver(drv_id)

    jid = _post_uk_fixed_job(
        ct,
        pickup_lat=53.4708, pickup_lng=-2.2426,        # Manchester
        dropoff_lat=52.4862, dropoff_lng=-1.8904,       # Birmingham
        title="Fix1B far-from-London",
    )

    r = requests.get(f"{API}/jobs/nearby", headers={"Authorization": f"Bearer {dt}"}, timeout=15)
    assert r.status_code == 200
    ids = [j["id"] for j in r.json()]
    assert jid in ids, "no-anchor call must return jobs outside London radius"


def test_nearby_applies_radius_only_when_lat_lng_explicit():
    ct, _, _ = _register("customer")
    dt, drv_id, _ = _register("driver")
    _approve_driver(drv_id)

    jid = _post_uk_fixed_job(
        ct,
        pickup_lat=53.4708, pickup_lng=-2.2426,
        dropoff_lat=52.4862, dropoff_lng=-1.8904,
        title="Fix1B radius engaged",
    )

    r = requests.get(
        f"{API}/jobs/nearby?lat=51.5074&lng=-0.1278&radius=50",
        headers={"Authorization": f"Bearer {dt}"}, timeout=15,
    )
    ids = [j["id"] for j in r.json()]
    assert jid not in ids, "explicit anchor must apply radius filter"

    r = requests.get(
        f"{API}/jobs/nearby?lat=51.5074&lng=-0.1278&radius=250",
        headers={"Authorization": f"Bearer {dt}"}, timeout=15,
    )
    ids = [j["id"] for j in r.json()]
    assert jid in ids


def test_nearby_still_excludes_accepted_jobs():
    ct, _, _ = _register("customer")
    dt, drv_id, _ = _register("driver")
    _approve_driver(drv_id)

    jid = _post_uk_fixed_job(
        ct,
        pickup_lat=53.4708, pickup_lng=-2.2426,
        dropoff_lat=52.4862, dropoff_lng=-1.8904,
        title="Fix1B accept-then-check",
    )
    r = requests.post(f"{API}/jobs/{jid}/accept", headers={"Authorization": f"Bearer {dt}"}, timeout=15)
    assert r.status_code == 200

    r = requests.get(f"{API}/jobs/nearby", headers={"Authorization": f"Bearer {dt}"}, timeout=15)
    ids = [j["id"] for j in r.json()]
    assert jid not in ids


# -------------------------------------------------------------------
# Fix 2A — /api/driver/accepted-jobs
# -------------------------------------------------------------------

def test_accepted_jobs_returns_own_accepted_jobs_only():
    ct, _, _ = _register("customer")
    dt, drv_id, _ = _register("driver")
    _approve_driver(drv_id)

    jid = _post_uk_fixed_job(
        ct,
        pickup_lat=53.4708, pickup_lng=-2.2426,
        dropoff_lat=52.4862, dropoff_lng=-1.8904,
        title="Fix2A own accepted",
    )
    r = requests.post(f"{API}/jobs/{jid}/accept", headers={"Authorization": f"Bearer {dt}"}, timeout=15)
    assert r.status_code == 200

    r = requests.get(f"{API}/driver/accepted-jobs", headers={"Authorization": f"Bearer {dt}"}, timeout=15)
    assert r.status_code == 200
    items = r.json()
    ids = [j["id"] for j in items]
    assert jid in ids
    entry = next(j for j in items if j["id"] == jid)
    assert entry["awaiting_deposit"] is True
    assert entry.get("accepted_price") == 200


def test_accepted_jobs_hides_other_drivers_accepts():
    ct, _, _ = _register("customer")
    dt_a, drv_a_id, _ = _register("driver")
    dt_b, drv_b_id, _ = _register("driver")
    _approve_driver(drv_a_id)
    _approve_driver(drv_b_id)

    jid = _post_uk_fixed_job(
        ct,
        pickup_lat=53.4708, pickup_lng=-2.2426,
        dropoff_lat=52.4862, dropoff_lng=-1.8904,
        title="Fix2A cross-driver isolation",
    )
    requests.post(f"{API}/jobs/{jid}/accept", headers={"Authorization": f"Bearer {dt_a}"}, timeout=15)

    r = requests.get(f"{API}/driver/accepted-jobs", headers={"Authorization": f"Bearer {dt_b}"}, timeout=15)
    assert r.status_code == 200
    assert jid not in [j["id"] for j in r.json()]


def test_accepted_jobs_requires_driver_role():
    ct, _, _ = _register("customer")
    r = requests.get(f"{API}/driver/accepted-jobs", headers={"Authorization": f"Bearer {ct}"}, timeout=15)
    assert r.status_code in (401, 403)


def test_accepted_jobs_persists_across_fresh_session():
    ct, _, _ = _register("customer")
    dt, drv_id, drv_email = _register("driver")
    _approve_driver(drv_id)

    jid = _post_uk_fixed_job(
        ct,
        pickup_lat=53.4708, pickup_lng=-2.2426,
        dropoff_lat=52.4862, dropoff_lng=-1.8904,
        title="Fix2A cross-session",
    )
    r = requests.post(f"{API}/jobs/{jid}/accept", headers={"Authorization": f"Bearer {dt}"}, timeout=15)
    assert r.status_code == 200

    # Simulate logout/login → fresh token
    r = requests.post(
        f"{API}/auth/login",
        json={"email": drv_email, "password": "LifeCycle12345!"},
        timeout=15,
    )
    assert r.status_code == 200
    new_tok = r.json()["access_token"]
    r = requests.get(f"{API}/driver/accepted-jobs", headers={"Authorization": f"Bearer {new_tok}"}, timeout=15)
    assert r.status_code == 200
    assert jid in [j["id"] for j in r.json()]
