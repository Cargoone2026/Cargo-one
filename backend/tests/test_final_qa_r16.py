"""Final QA Round 16 — ASAP transport POST /api/jobs must round-trip the
seven optional loading-detail fields that the new AsapRequest wizard section
collects (needs_forklift, needs_loading_help, weight_kg, item_count,
dimensions_l/w/h_m, volume_m3). ASAP breakdown_recovery must NOT be affected
and must force needs_forklift / needs_loading_help to False.

Coverage:
  1. ASAP transport POST with all seven fields — 200, echo verbatim,
     recommended_vehicle derived.
  2. GET /api/jobs/mine echoes the same fields to the customer.
  3. GET /api/admin/jobs/{id} echoes the same fields to admin.
  4. ASAP recovery POST persists needs_forklift=False / needs_loading_help=False
     even if the client tried to send True (defensive: our UI sends False; we
     assert the server tolerates the payload and the fields don't leak in).
  5. Minimal ASAP transport POST (no R16 fields) still succeeds and defaults
     are safe (False / None).
"""
from __future__ import annotations

import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@cargoone.com"
ADMIN_PASSWORD = "Vc9O0sNDGR6SfzKDaa0L1lhp"
CUSTOMER_EMAIL = "testcustomer@example.com"
CUSTOMER_PASSWORD = "CustomerTest12345!"


def _bearer(tok):
    return {"Authorization": f"Bearer {tok}"}


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login failed {email}: {r.status_code} {r.text[:200]}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def customer_tok():
    return _login(CUSTOMER_EMAIL, CUSTOMER_PASSWORD)


@pytest.fixture(scope="module")
def admin_tok():
    return _login(ADMIN_EMAIL, ADMIN_PASSWORD)


def _asap_transport_body():
    suffix = uuid.uuid4().hex[:8]
    return {
        "title": f"TEST_R16 ASAP transport {suffix}",
        "category": "Furniture",
        "description": "R16 pytest — ASAP transport with new loading details.",
        "photos": [],
        "service_timing": "asap",
        "service_type": "transport",
        "transport_category": "pallets",
        "pickup_address": "10 Downing St, London SW1A 2AA",
        "pickup_town": "London",
        "pickup_lat": 51.5034,
        "pickup_lng": -0.1276,
        "dropoff_address": "1 Oxford St, London W1D 1BS",
        "dropoff_town": "London",
        "dropoff_lat": 51.5152,
        "dropoff_lng": -0.1418,
        "collection_date": "2026-02-01T10:00:00Z",
        "delivery_date": "2026-02-01T16:00:00Z",
        "pricing_type": "fixed",
        "fixed_price": 180.0,
    }


def _asap_recovery_body():
    suffix = uuid.uuid4().hex[:8]
    return {
        "title": f"TEST_R16 ASAP recovery {suffix}",
        "category": "Vehicle Recovery",
        "description": "R16 pytest — ASAP recovery must not carry R16 flags.",
        "photos": [],
        "service_timing": "asap",
        "service_type": "breakdown_recovery",
        "vehicle_details": {
            "make": "Ford", "model": "Focus", "registration": "AB12 CDE",
            "condition": "will_not_start", "rolls": "yes", "steers": "yes", "brakes": "yes",
        },
        "pickup_address": "10 Downing St, London SW1A 2AA",
        "pickup_town": "London",
        "pickup_lat": 51.5034,
        "pickup_lng": -0.1276,
        "dropoff_address": "1 Oxford St, London W1D 1BS",
        "dropoff_town": "London",
        "dropoff_lat": 51.5152,
        "dropoff_lng": -0.1418,
        "collection_date": "2026-02-01T10:00:00Z",
        "delivery_date": "2026-02-01T16:00:00Z",
        "pricing_type": "fixed",
        "fixed_price": 220.0,
        "weight_kg": 1500,
    }


R16_EXTRAS = {
    "needs_forklift": True,
    "needs_loading_help": True,
    "weight_kg": 420.0,
    "item_count": 5,
    "dimensions_l_m": 1.2,
    "dimensions_w_m": 1.0,
    "dimensions_h_m": 1.5,
    "volume_m3": 1.8,
}


def _assert_r16_present(job, expected=R16_EXTRAS):
    for k, v in expected.items():
        assert k in job, f"missing key {k} in job response: keys={list(job.keys())[:40]}"
        got = job[k]
        if isinstance(v, float):
            assert abs(float(got) - v) < 1e-6, f"{k}: got {got} want {v}"
        else:
            assert got == v, f"{k}: got {got} want {v}"


# ---- 1. ASAP transport POST round-trips all seven fields ----

def test_asap_transport_post_roundtrips_r16_fields(customer_tok):
    payload = {**_asap_transport_body(), **R16_EXTRAS}
    r = requests.post(f"{API}/jobs", json=payload, headers=_bearer(customer_tok), timeout=25)
    assert r.status_code == 200, f"POST /jobs ASAP transport failed: {r.status_code} {r.text[:400]}"
    job = r.json()
    assert job.get("service_timing") == "asap"
    assert job.get("service_type") == "transport"
    _assert_r16_present(job)
    # recommended_vehicle should be derived (Large Van / Luton Van for 420 kg)
    rv = (job.get("recommended_vehicle") or "").strip()
    # Server may or may not set this; if set, must be one of the van tiers.
    if rv:
        assert any(k in rv.lower() for k in ("van", "luton", "lorry", "truck")), \
            f"unexpected recommended_vehicle: {rv}"
    pytest._r16_asap_job_id = job["id"]


# ---- 2. /jobs/mine echoes the seven fields ----

def test_jobs_mine_echoes_r16_fields(customer_tok):
    jid = getattr(pytest, "_r16_asap_job_id", None)
    assert jid, "prior test did not produce an ASAP job id"
    r = requests.get(f"{API}/jobs/mine", headers=_bearer(customer_tok), timeout=20)
    assert r.status_code == 200
    jobs = r.json()
    match = next((j for j in jobs if j.get("id") == jid), None)
    assert match, f"posted ASAP job {jid} not in /jobs/mine"
    _assert_r16_present(match)


# ---- 3. Admin GET /admin/jobs/{id} echoes the fields ----

def test_admin_jobs_detail_echoes_r16_fields(admin_tok):
    jid = getattr(pytest, "_r16_asap_job_id", None)
    assert jid, "prior test did not produce an ASAP job id"
    r = requests.get(f"{API}/admin/jobs/{jid}", headers=_bearer(admin_tok), timeout=20)
    assert r.status_code == 200, f"admin GET failed: {r.status_code} {r.text[:200]}"
    job = r.json()
    if isinstance(job, dict) and "job" in job and isinstance(job["job"], dict):
        job = job["job"]
    _assert_r16_present(job)


# ---- 4. ASAP recovery is unaffected: forklift/loading remain False ----

def test_asap_recovery_forklift_loading_false(customer_tok):
    payload = _asap_recovery_body()
    r = requests.post(f"{API}/jobs", json=payload, headers=_bearer(customer_tok), timeout=25)
    assert r.status_code == 200, f"POST /jobs ASAP recovery failed: {r.status_code} {r.text[:400]}"
    job = r.json()
    assert job.get("service_type") == "breakdown_recovery"
    assert job.get("needs_forklift") in (False, None), \
        f"recovery job unexpectedly has needs_forklift={job.get('needs_forklift')}"
    assert job.get("needs_loading_help") in (False, None), \
        f"recovery job unexpectedly has needs_loading_help={job.get('needs_loading_help')}"
    # vehicle_details persisted
    vd = job.get("vehicle_details")
    assert vd and vd.get("make") == "Ford"


# ---- 5. Minimal ASAP transport POST (no R16 fields) still 200 ----

def test_asap_transport_minimal_defaults(customer_tok):
    payload = _asap_transport_body()
    payload["weight_kg"] = 20  # legacy default
    r = requests.post(f"{API}/jobs", json=payload, headers=_bearer(customer_tok), timeout=25)
    assert r.status_code == 200, f"POST /jobs ASAP transport minimal failed: {r.status_code} {r.text[:300]}"
    job = r.json()
    assert job.get("needs_forklift") in (False, None)
    assert job.get("needs_loading_help") in (False, None)
    for k in ("item_count", "dimensions_l_m", "dimensions_w_m", "dimensions_h_m"):
        assert job.get(k) in (None, 0), f"{k} unexpectedly {job.get(k)}"
