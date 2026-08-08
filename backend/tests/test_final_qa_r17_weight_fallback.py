"""R17 — Regression tests proving the ASAP price is NOT skewed by the
hard-coded 20 kg / 1500 kg weight fallback that lived in AsapRequest.jsx
before this round.

Verifies via the real HTTP surface:

  1. `/quote/estimate` returns the SAME suggested_price for a given
     route + category regardless of any weight_kg ≤ 500 kg. This proves
     the previous 20 kg / 1500 kg ASAP fallbacks were pricing-neutral
     when passed to the server.
  2. Above 500 kg the price DOES scale — sanity guardrail so future
     changes can't accidentally break the threshold.
  3. POST /api/jobs with service_timing=asap and weight_kg=null
     succeeds and persists weight_kg as null (so JobExtras hides the
     "kg" chip). recommended_vehicle is still derived from
     transport_category (transport) or vehicle_details.type (recovery).
"""
from __future__ import annotations

import os
import time
import uuid

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"

CUSTOMER_EMAIL = "testcustomer@example.com"
CUSTOMER_PASSWORD = "CustomerTest12345!"


def _bearer(tok: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {tok}"}


def _login(email: str, password: str) -> str:
    r = requests.post(
        f"{API}/auth/login",
        json={"email": email, "password": password},
        timeout=20,
    )
    assert r.status_code == 200, f"login failed {email}: {r.status_code} {r.text[:200]}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def customer_tok() -> str:
    return _login(CUSTOMER_EMAIL, CUSTOMER_PASSWORD)


# Manchester → Leeds — stable low-traffic route used by all R15/R16 tests.
ROUTE = {
    "pickup_lat": 53.4808, "pickup_lng": -2.2426,
    "dropoff_lat": 53.8008, "dropoff_lng": -1.5491,
}


def _quote(customer_tok: str, *, weight_kg: float | None) -> dict:
    q = {**ROUTE, "category": "parcels"}
    if weight_kg is not None:
        q["weight_kg"] = weight_kg
    r = requests.get(
        f"{API}/quote/estimate",
        params=q,
        headers=_bearer(customer_tok),
        timeout=20,
    )
    assert r.status_code == 200, f"{r.status_code} {r.text[:200]}"
    return r.json()


# ---------------------------------------------------------------------------
# Weight ≤ 500 kg — pricing must be IDENTICAL to the un-weighted baseline
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("weight_kg", [0, 1, 20, 100, 250, 500])
def test_quote_price_ignores_weight_at_or_below_500kg(customer_tok, weight_kg):
    baseline = _quote(customer_tok, weight_kg=None)["suggested_price"]
    got = _quote(customer_tok, weight_kg=weight_kg)["suggested_price"]
    assert got == baseline, (
        f"weight={weight_kg}: quoted {got} != baseline {baseline}. "
        f"The 20 kg ASAP fallback must NOT skew the price."
    )


def test_quote_price_scales_only_above_500kg(customer_tok):
    base = _quote(customer_tok, weight_kg=None)["suggested_price"]
    heavy = _quote(customer_tok, weight_kg=1500)["suggested_price"]
    assert heavy > base, (
        f"1500 kg quote {heavy} must exceed un-weighted baseline {base} — "
        f"threshold at >500 kg is intentional; check for regression."
    )


# ---------------------------------------------------------------------------
# POST /jobs with service_timing=asap accepts weight_kg=None and derives
# the vehicle from transport_category / vehicle_details.
# ---------------------------------------------------------------------------

def _post_asap_transport(customer_tok: str, *, weight_kg: float | None) -> dict:
    body = {
        "title": f"R17 ASAP weight null {uuid.uuid4().hex[:6]}",
        "description": "R17 test",
        "category": "package_delivery",
        "service_type": "transport",
        "service_timing": "asap",
        "transport_category": "pallets",
        "transport_description": "5 pallets",
        "pricing_type": "fixed",
        "fixed_price": 120,
        "pickup_address": "Manchester",
        "pickup_town": "Manchester",
        "dropoff_address": "Leeds",
        "dropoff_town": "Leeds",
        "collection_date": "2026-03-01",
        "delivery_date": "2026-03-01",
        **ROUTE,
        "weight_kg": weight_kg,
    }
    r = requests.post(f"{API}/jobs", json=body, headers=_bearer(customer_tok), timeout=20)
    assert r.status_code == 200, f"{r.status_code} {r.text[:200]}"
    return r.json()


def test_asap_transport_accepts_null_weight(customer_tok):
    job = _post_asap_transport(customer_tok, weight_kg=None)
    assert job["service_timing"] == "asap"
    assert job.get("weight_kg") in (None, 0.0), (
        f"expected null weight_kg on server; got {job.get('weight_kg')!r}"
    )
    # Vehicle still derives from transport_category — pallets → Luton Van.
    assert job.get("recommended_vehicle"), "vehicle must still derive when weight is null"


def test_asap_recovery_accepts_null_weight(customer_tok):
    body = {
        "title": f"R17 ASAP recovery null {uuid.uuid4().hex[:6]}",
        "description": "R17 test",
        "category": "cars_vehicles",
        "service_type": "breakdown_recovery",
        "service_timing": "asap",
        "vehicle_details": {"type": "car", "make": "BMW", "model": "3 Series"},
        "pricing_type": "fixed",
        "fixed_price": 220,
        "pickup_address": "Manchester",
        "pickup_town": "Manchester",
        "dropoff_address": "Leeds",
        "dropoff_town": "Leeds",
        "collection_date": "2026-03-01",
        "delivery_date": "2026-03-01",
        **ROUTE,
        "weight_kg": None,
    }
    r = requests.post(f"{API}/jobs", json=body, headers=_bearer(customer_tok), timeout=20)
    assert r.status_code == 200, f"{r.status_code} {r.text[:200]}"
    job = r.json()
    assert job.get("weight_kg") in (None, 0.0)
    assert "Recovery" in (job.get("recommended_vehicle") or ""), (
        f"recovery vehicle must derive from vehicle_details.type — got "
        f"{job.get('recommended_vehicle')!r}"
    )
