"""R25 — HTTP-level integration tests for the pricing engine.

Runs against the live FastAPI at REACT_APP_BACKEND_URL. Covers:
- POST /pricing/quote (auth guard, happy path, validation errors, recovery)
- Divergence: /pricing/quote vs /quote/estimate return identical prices
- Auth: /pricing/quote requires a token (401 or 403)

We only exercise the endpoints public to a customer (login via /api/auth/login).
"""
from __future__ import annotations

import os
import pytest
import requests

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE}/api"

CUSTOMER = {"email": "testcustomer@example.com", "password": "CustomerTest12345!"}
ADMIN    = {"email": "admin@cargoone.com",     "password": "Vc9O0sNDGR6SfzKDaa0L1lhp"}

# London → Reading approx
PICKUP  = {"lat": 51.5074, "lng": -0.1278}
DROPOFF = {"lat": 51.4543, "lng": -0.9781}


@pytest.fixture(scope="module")
def customer_session() -> requests.Session:
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=CUSTOMER, timeout=20)
    if r.status_code != 200:
        pytest.skip(f"customer login failed: {r.status_code} {r.text[:200]}")
    body = r.json()
    tok = body.get("access_token") or body.get("token")
    if tok:
        s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


def _quote_body(**overrides):
    body = {
        "pickup_lat": PICKUP["lat"], "pickup_lng": PICKUP["lng"],
        "dropoff_lat": DROPOFF["lat"], "dropoff_lng": DROPOFF["lng"],
        "service_type": "transport",
        "service_timing": "asap",
        "transport_category": "parcels",
        "weight_kg": 15,
        "volume_m3": 0.2,
        "item_count": 1,
        "pickup_country_code": "GB",
        "dropoff_country_code": "GB",
    }
    body.update(overrides)
    return body


# ---------- A: happy path ----------
def test_A_pricing_quote_happy_path(customer_session):
    r = customer_session.post(f"{API}/pricing/quote", json=_quote_body(), timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["engine_version"] == "1.0.0"
    assert data["resolved_vehicle_key"] == "small_van"
    assert data["driver_charge"] > 0
    assert data["subtotal"] > 0
    assert isinstance(data["line_items"], list) and len(data["line_items"]) >= 3
    keys = {li["key"] for li in data["line_items"]}
    assert "vehicle_base" in keys and "distance" in keys and "time" in keys
    assert "asap_surcharge" in keys
    assert "distance_source" in data
    assert data["distance_source"] in ("google_road", "haversine_fallback")
    assert "booking_fee_preview" in data
    assert "customer_total_preview" in data
    assert data["customer_total_preview"] == pytest.approx(
        round(data["driver_charge"] + data["booking_fee_preview"], 2), abs=0.02
    )


# ---------- Z: auth guard ----------
def test_Z_pricing_quote_requires_auth():
    r = requests.post(f"{API}/pricing/quote", json=_quote_body(), timeout=20)
    assert r.status_code in (401, 403), f"expected 401/403 got {r.status_code}"


# ---------- B-E: validation errors ----------
@pytest.mark.parametrize("overrides,expected_code", [
    ({"weight_kg": -5},            "invalid_weight"),
    ({"weight_kg": 40000},         "weight_too_large"),
    ({"volume_m3": -5},            "invalid_dims"),
    ({"volume_m3": 200},           "volume_too_large"),
    ({"item_count": 999},          "too_many_items"),
    ({"item_count": -3},           "invalid_items"),
])
def test_BCDE_validation_errors(customer_session, overrides, expected_code):
    r = customer_session.post(f"{API}/pricing/quote", json=_quote_body(**overrides), timeout=20)
    assert r.status_code == 422, r.text
    detail = r.json().get("detail")
    # HTTPException(detail={...}) exposes it as-is
    if isinstance(detail, dict):
        assert detail.get("code") == expected_code, detail
    else:
        assert expected_code in str(detail)


# ---------- F/G: recovery vehicle picker ----------
def test_F_motorcycle_recovery(customer_session):
    body = _quote_body(service_type="breakdown_recovery",
                       vehicle_details={"type": "motorcycle"},
                       transport_category=None, weight_kg=None, volume_m3=None)
    r = customer_session.post(f"{API}/pricing/quote", json=body, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["resolved_vehicle_key"] == "motorcycle_recovery"
    assert "Motorcycle" in data["resolved_vehicle_label"]


def test_G_car_recovery_uses_3_5t(customer_session):
    body = _quote_body(service_type="breakdown_recovery",
                       vehicle_details={"type": "car"},
                       transport_category=None, weight_kg=None, volume_m3=None)
    r = customer_session.post(f"{API}/pricing/quote", json=body, timeout=30)
    assert r.status_code == 200, r.text
    assert r.json()["resolved_vehicle_key"] == "3_5t_recovery"


# ---------- H: divergence elimination ----------
def test_H_pricing_quote_and_estimate_match(customer_session):
    body = _quote_body(service_timing="scheduled", transport_category="furniture_delivery",
                       weight_kg=200, volume_m3=5, needs_loading_help=False)
    r1 = customer_session.post(f"{API}/pricing/quote", json=body, timeout=30)
    assert r1.status_code == 200, r1.text
    q1 = r1.json()

    params = {
        "pickup_lat": body["pickup_lat"], "pickup_lng": body["pickup_lng"],
        "dropoff_lat": body["dropoff_lat"], "dropoff_lng": body["dropoff_lng"],
        "category": "furniture_delivery",
        "weight_kg": 200, "volume_m3": 5,
        "pickup_country_code": "GB", "dropoff_country_code": "GB",
        "service_type": "transport", "service_timing": "scheduled",
    }
    r2 = customer_session.get(f"{API}/quote/estimate", params=params, timeout=30)
    assert r2.status_code == 200, r2.text
    q2 = r2.json()
    # The legacy adapter returns suggested_price; equal to driver_charge
    assert q2.get("suggested_price") == pytest.approx(q1["driver_charge"], abs=0.02), (
        f"divergence: /pricing/quote={q1['driver_charge']} vs /quote/estimate={q2.get('suggested_price')}"
    )


# ---------- P: vehicle picker weight tiers ----------
@pytest.mark.parametrize("weight,expected_vehicle", [
    (250,  "small_van"),
    (500,  "medium_van"),
    (1000, "large_van"),
    (1500, "3_5t_truck"),  # engine intentionally picks the safer/bigger vehicle (Luton payload maxes ~1400kg IRL)
    (2000, "7_5t_truck"),
    (4000, "18t_hgv"),
])
def test_P_weight_tier_picker(customer_session, weight, expected_vehicle):
    body = _quote_body(weight_kg=weight, volume_m3=None, item_count=1)
    r = customer_session.post(f"{API}/pricing/quote", json=body, timeout=30)
    assert r.status_code == 200, r.text
    got = r.json()["resolved_vehicle_key"]
    assert got == expected_vehicle, f"{weight}kg → {got}, expected {expected_vehicle}"


# ---------- Q: volume tiers ----------
@pytest.mark.parametrize("vol,expected_vehicle", [
    (0.5,  "small_van"),
    (5,    "medium_van"),
    (10,   "large_van"),
    (17,   "luton_van"),
    (28,   "7_5t_truck"),
])
def test_Q_volume_tier_picker(customer_session, vol, expected_vehicle):
    body = _quote_body(volume_m3=vol, weight_kg=None, item_count=1)
    r = customer_session.post(f"{API}/pricing/quote", json=body, timeout=30)
    assert r.status_code == 200, r.text
    got = r.json()["resolved_vehicle_key"]
    assert got == expected_vehicle, f"{vol}m³ → {got}"


# ---------- T: recovery + ASAP multipliers applied exactly once ----------
def test_T_recovery_asap_single_application(customer_session):
    body = _quote_body(service_type="breakdown_recovery", service_timing="asap",
                       transport_category=None, weight_kg=None, volume_m3=None,
                       vehicle_details={"type": "car"})
    r = customer_session.post(f"{API}/pricing/quote", json=body, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    snap = data["pricing_snapshot"]
    assert snap["recovery_multiplier"] == 1.30
    assert snap["asap_multiplier"] == 1.20
    line_keys = [li["key"] for li in data["line_items"]]
    assert line_keys.count("recovery_surcharge") == 1
    assert line_keys.count("asap_surcharge") == 1


# ---------- R: forklift/loading flat fees via HTTP ----------
def test_R_forklift_loading_flat_fees(customer_session):
    base = customer_session.post(f"{API}/pricing/quote", json=_quote_body(), timeout=30).json()
    fk   = customer_session.post(f"{API}/pricing/quote", json=_quote_body(needs_forklift=True), timeout=30).json()
    lh   = customer_session.post(f"{API}/pricing/quote", json=_quote_body(needs_loading_help=True), timeout=30).json()
    both = customer_session.post(f"{API}/pricing/quote", json=_quote_body(needs_forklift=True, needs_loading_help=True), timeout=30).json()
    # Note: forklift/loading are flat but they get multiplied by ASAP surcharge
    # since they're added BEFORE the ASAP multiplier. Use a scheduled version to
    # isolate flat fee.
    body_sch = _quote_body(service_timing="scheduled")
    b0 = customer_session.post(f"{API}/pricing/quote", json=body_sch, timeout=30).json()
    b_fk = customer_session.post(f"{API}/pricing/quote", json={**body_sch, "needs_forklift": True}, timeout=30).json()
    b_lh = customer_session.post(f"{API}/pricing/quote", json={**body_sch, "needs_loading_help": True}, timeout=30).json()
    b_both = customer_session.post(f"{API}/pricing/quote", json={**body_sch, "needs_forklift": True, "needs_loading_help": True}, timeout=30).json()
    assert b_fk["driver_charge"]  - b0["driver_charge"] == pytest.approx(35.0, abs=0.5)
    assert b_lh["driver_charge"]  - b0["driver_charge"] == pytest.approx(25.0, abs=0.5)
    assert b_both["driver_charge"] - b0["driver_charge"] == pytest.approx(60.0, abs=0.5)


# ---------- O: distance source ----------
def test_O_distance_source_present(customer_session):
    r = customer_session.post(f"{API}/pricing/quote", json=_quote_body(), timeout=30)
    d = r.json()
    assert d["distance_source"] in ("google_road", "haversine_fallback")
    if d["distance_source"] == "haversine_fallback":
        assert d["low_confidence_distance"] is True


# ---------- L: booking fee preview consistency ----------
def test_L_booking_fee_bands_preview(customer_session):
    # Preview endpoint should be band-based and stable for a given driver charge.
    r_q = customer_session.post(f"{API}/pricing/quote", json=_quote_body(), timeout=30)
    dc = r_q.json()["driver_charge"]
    r = customer_session.get(f"{API}/booking-fee-bands/preview",
                             params={"driver_charge": dc}, timeout=20)
    if r.status_code == 404:
        pytest.skip("booking-fee-bands/preview not exposed")
    assert r.status_code == 200, r.text
    prev = r.json()
    assert "booking_fee_percent" in prev and "booking_fee" in prev
    assert 10.0 <= float(prev["booking_fee_percent"]) <= 15.0
