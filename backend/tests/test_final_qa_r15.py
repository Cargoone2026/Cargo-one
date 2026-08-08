"""Final QA Round 15 — JobCreate accepts (and persists) the new
Round-15 details: needs_forklift, needs_loading_help, dimensions_l/w/h_m,
volume_m3, item_count. These previously were dropped by Pydantic.

Coverage:
  1. POST /api/jobs fixed-price with ALL new fields round-trips them.
  2. POST /api/jobs (minimal, only weight_kg) still 200 with defaults.
  3. POST /api/jobs bidding-type with the same fields round-trips them.
  4. GET  /api/jobs/mine echoes the fields back to the customer.
  5. GET  /api/admin/jobs/{id} (admin) echoes the fields back.
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


def _base_job(pricing="fixed"):
    suffix = uuid.uuid4().hex[:8]
    body = {
        "title": f"TEST_R15 job {suffix}",
        "category": "Furniture",
        "description": "R15 pytest — validate new booking-detail chip fields round-trip.",
        "photos": [],
        "pickup_address": "10 Downing St, London SW1A 2AA",
        "pickup_town": "London",
        "pickup_lat": 51.5034,
        "pickup_lng": -0.1276,
        "pickup_postcode": "SW1A 2AA",
        "pickup_country": "United Kingdom",
        "pickup_country_code": "GB",
        "dropoff_address": "1 Oxford St, London W1D 1BS",
        "dropoff_town": "London",
        "dropoff_lat": 51.5152,
        "dropoff_lng": -0.1418,
        "dropoff_postcode": "W1D 1BS",
        "dropoff_country": "United Kingdom",
        "dropoff_country_code": "GB",
        "collection_date": "2026-02-01",
        "delivery_date": "2026-02-02",
        "pricing_type": pricing,
    }
    if pricing == "fixed":
        body["fixed_price"] = 150.0
    else:
        body["max_budget"] = 300.0
    return body


R15_EXTRAS = {
    "needs_forklift": True,
    "needs_loading_help": True,
    "dimensions_l_m": 2.0,
    "dimensions_w_m": 1.2,
    "dimensions_h_m": 1.5,
    "volume_m3": 3.6,
    "item_count": 4,
    "weight_kg": 250.0,
}


def _assert_all_r15_present(job, expected=R15_EXTRAS):
    for k, v in expected.items():
        assert k in job, f"missing key {k} in job response"
        got = job[k]
        if isinstance(v, float):
            assert abs(float(got) - v) < 1e-6, f"{k}: got {got} want {v}"
        else:
            assert got == v, f"{k}: got {got} want {v}"


# ------------- 1. Fixed-price with all R15 fields round-trips -------------

def test_post_job_fixed_with_r15_fields_roundtrip(customer_tok):
    payload = {**_base_job("fixed"), **R15_EXTRAS}
    r = requests.post(f"{API}/jobs", json=payload, headers=_bearer(customer_tok), timeout=20)
    assert r.status_code == 200, f"POST /jobs failed: {r.status_code} {r.text[:300]}"
    job = r.json()
    assert "id" in job
    _assert_all_r15_present(job)
    # persist id for downstream tests via module attr
    pytest._r15_fixed_job_id = job["id"]


# ------------- 2. Minimal job (no R15 fields) still 200 + defaults -------------

def test_post_job_minimal_defaults(customer_tok):
    payload = _base_job("fixed")
    payload["weight_kg"] = 80.0
    # NO forklift/loading/dims/item_count
    r = requests.post(f"{API}/jobs", json=payload, headers=_bearer(customer_tok), timeout=20)
    assert r.status_code == 200, f"POST /jobs minimal failed: {r.status_code} {r.text[:300]}"
    job = r.json()
    assert job.get("needs_forklift") in (False, None), f"needs_forklift default wrong: {job.get('needs_forklift')}"
    assert job.get("needs_loading_help") in (False, None), f"needs_loading_help default wrong: {job.get('needs_loading_help')}"
    # dim fields absent or None
    for k in ("dimensions_l_m", "dimensions_w_m", "dimensions_h_m", "item_count"):
        assert job.get(k) in (None, 0), f"{k} unexpectedly {job.get(k)}"


# ------------- 3. Bidding-type accepts R15 fields identically -------------

def test_post_job_bidding_with_r15_fields_roundtrip(customer_tok):
    payload = {**_base_job("bidding"), **R15_EXTRAS}
    r = requests.post(f"{API}/jobs", json=payload, headers=_bearer(customer_tok), timeout=20)
    assert r.status_code == 200, f"POST /jobs bidding failed: {r.status_code} {r.text[:300]}"
    job = r.json()
    assert job.get("pricing_type") == "bidding"
    _assert_all_r15_present(job)
    pytest._r15_bidding_job_id = job["id"]


# ------------- 4. /jobs/mine echoes the fields -------------

def test_jobs_mine_echoes_r15_fields(customer_tok):
    fixed_id = getattr(pytest, "_r15_fixed_job_id", None)
    assert fixed_id, "prior test did not produce a fixed job id"
    r = requests.get(f"{API}/jobs/mine", headers=_bearer(customer_tok), timeout=20)
    assert r.status_code == 200
    jobs = r.json()
    assert isinstance(jobs, list)
    match = next((j for j in jobs if j.get("id") == fixed_id), None)
    assert match is not None, f"posted job {fixed_id} not in /jobs/mine"
    _assert_all_r15_present(match)


# ------------- 5. Admin GET /admin/jobs/{id} echoes the fields -------------

def test_admin_jobs_detail_echoes_r15_fields(admin_tok):
    fixed_id = getattr(pytest, "_r15_fixed_job_id", None)
    assert fixed_id, "prior test did not produce a fixed job id"
    r = requests.get(f"{API}/admin/jobs/{fixed_id}", headers=_bearer(admin_tok), timeout=20)
    assert r.status_code == 200, f"admin GET failed: {r.status_code} {r.text[:200]}"
    job = r.json()
    # some admin endpoints wrap into {"job": {...}}
    if isinstance(job, dict) and "job" in job and isinstance(job["job"], dict):
        job = job["job"]
    _assert_all_r15_present(job)
