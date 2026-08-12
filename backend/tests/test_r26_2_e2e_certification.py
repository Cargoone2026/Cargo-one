"""R26.2 — Customer-facing ASAP vehicle picker API certification.

Covers items #1, #7 (smoke sweep), #8 (international guardrail) of the
R26.2 review request.
"""
from __future__ import annotations

import os
import pytest
import requests

# Use direct backend to bypass CSRF for these API-only smokes.
BACKEND = os.environ.get("R26_2_BACKEND", "http://localhost:8001").rstrip("/")
PUBLIC  = os.environ.get("REACT_APP_BACKEND_URL",
                         "https://cargo-repo-bridge.preview.emergentagent.com").rstrip("/")

TEST_EMAIL = "testcustomer@example.com"
TEST_PW    = "CustomerTest12345!"

# ~25 mi UK domestic route (London → Guildford roughly)
LONDON  = (51.507, -0.128)
GUILDFD = (51.236, -0.570)


@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    # Login via PUBLIC url so cookies + CSRF are set the normal way.
    r = sess.post(f"{PUBLIC}/api/auth/login",
                  json={"email": TEST_EMAIL, "password": TEST_PW},
                  timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    csrf = sess.cookies.get("cargoone_csrf")
    if csrf:
        sess.headers.update({"X-CSRF-Token": csrf})
    return sess


# ─── 1) /api/asap/vehicles catalog ────────────────────────────────────────
class TestVehicleCatalog:
    def test_catalog_returns_all_20_transport_and_engine_version(self, s):
        r = s.get(f"{PUBLIC}/api/asap/vehicles", timeout=15)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["engine_version"] == "ASAP-V1.0"
        assert isinstance(j["transport"], list)
        assert isinstance(j["recovery"], list)
        assert len(j["transport"]) == 20, f"expected 20 transport got {len(j['transport'])}"
        assert len(j["recovery"]) == 12, f"expected 12 recovery got {len(j['recovery'])}"
        # verify item shape
        for item in j["transport"] + j["recovery"]:
            for k in ("key", "label", "minimum_charge", "per_mile",
                      "requires_manual_review", "tail_lift"):
                assert k in item, f"missing {k} in {item}"
        # ensure lwb_van & articulated_hgv are present
        keys = {v["key"] for v in j["transport"]}
        assert "lwb_van" in keys
        assert "articulated_hgv" in keys
        assert "luton_tail_lift" in keys


# ─── 7) Smoke via API for each vehicle key ─────────────────────────────────
SMOKE_EXPECTATIONS = [
    # key, driver_charge, fee_pct
    ("luton",                 100.0, 15.0),
    ("luton_tail_lift",       110.0, 15.0),
    ("3_5t_rigid",            100.0, 15.0),
    ("3_5t_rigid_tail_lift",  115.0, 15.0),
    ("7_5t_rigid",            175.0, 14.0),
    ("7_5t_rigid_tail_lift",  195.0, 14.0),
    ("articulated_hgv",       400.0, 13.0),
]


class TestAsapQuoteSmokePerVehicle:
    @pytest.mark.parametrize("key,expected_dc,expected_pct", SMOKE_EXPECTATIONS)
    def test_quote_for_key(self, s, key, expected_dc, expected_pct):
        body = {
            "pickup_lat":  LONDON[0],  "pickup_lng":  LONDON[1],
            "dropoff_lat": GUILDFD[0], "dropoff_lng": GUILDFD[1],
            "service_type": "transport",
            "urgency": "asap",
            "requested_vehicle_key": key,
            "pickup_country_code": "GB",
            "dropoff_country_code": "GB",
        }
        r = s.post(f"{PUBLIC}/api/asap/quote", json=body, timeout=30)
        assert r.status_code == 200, f"[{key}] {r.status_code} {r.text}"
        j = r.json()
        assert j["engine_version"] == "ASAP-V1.0"
        assert j["resolved_vehicle_key"] == key, \
            f"[{key}] resolved={j.get('resolved_vehicle_key')}"
        assert abs(j["driver_charge"] - expected_dc) < 0.01, \
            f"[{key}] driver_charge={j['driver_charge']} expected {expected_dc}"
        assert abs(j["booking_fee_percent"] - expected_pct) < 0.01, \
            f"[{key}] fee%={j['booking_fee_percent']} expected {expected_pct}"

    def test_lwb_van_canonical(self, s):
        body = {
            "pickup_lat":  LONDON[0],  "pickup_lng":  LONDON[1],
            "dropoff_lat": GUILDFD[0], "dropoff_lng": GUILDFD[1],
            "service_type": "transport",
            "urgency": "asap",
            "requested_vehicle_key": "lwb_van",
            "pickup_country_code": "GB",
            "dropoff_country_code": "GB",
        }
        r = s.post(f"{PUBLIC}/api/asap/quote", json=body, timeout=30)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["resolved_vehicle_key"] == "lwb_van"
        assert abs(j["driver_charge"]        - 70.0)  < 0.01, j
        assert abs(j["booking_fee"]          - 10.5)  < 0.01, j
        assert abs(j["booking_fee_percent"]  - 15.0)  < 0.01, j
        assert abs(j["customer_total"]       - 80.5)  < 0.01, j
        assert j["engine_version"] == "ASAP-V1.0"

    def test_recovery_canonical(self, s):
        # breakdown_recovery mode canonical scenario
        body = {
            "pickup_lat":  LONDON[0],  "pickup_lng":  LONDON[1],
            "dropoff_lat": GUILDFD[0], "dropoff_lng": GUILDFD[1],
            "service_type": "breakdown_recovery",
            "urgency": "asap",
            "pickup_country_code": "GB",
            "dropoff_country_code": "GB",
        }
        r = s.post(f"{PUBLIC}/api/asap/quote", json=body, timeout=30)
        assert r.status_code == 200, r.text
        j = r.json()
        assert abs(j["driver_charge"]       - 110.0)  < 0.01, j
        assert abs(j["booking_fee"]         - 16.5)   < 0.01, j
        assert abs(j["booking_fee_percent"] - 15.0)   < 0.01, j
        assert abs(j["customer_total"]      - 126.5)  < 0.01, j


# ─── vehicle_too_small validation ──────────────────────────────────────────
class TestVehicleTooSmall:
    def test_car_with_2000kg_rejected(self, s):
        body = {
            "pickup_lat":  LONDON[0],  "pickup_lng":  LONDON[1],
            "dropoff_lat": GUILDFD[0], "dropoff_lng": GUILDFD[1],
            "service_type": "transport",
            "urgency": "asap",
            "requested_vehicle_key": "car",
            "weight_kg": 2000,
            "pickup_country_code": "GB",
            "dropoff_country_code": "GB",
        }
        r = s.post(f"{PUBLIC}/api/asap/quote", json=body, timeout=30)
        assert r.status_code == 422, r.text
        detail = r.json().get("detail") or {}
        assert detail.get("code") == "vehicle_too_small", detail
        msg = detail.get("message", "").lower()
        assert "too small" in msg or "small" in msg, msg
        assert "recommend" in msg, msg


# ─── 8) International guardrail on /pricing/quote (asap) ──────────────────
class TestInternationalGuardrail:
    def test_gb_to_ie_asap_with_lwb_van_manual_review(self, s):
        body = {
            "pickup_lat":  51.507, "pickup_lng":  -0.128,        # London
            "dropoff_lat": 53.349, "dropoff_lng": -6.260,        # Dublin
            "service_type": "transport",
            "service_timing": "asap",
            "requested_vehicle_key": "lwb_van",
            "pickup_country_code":  "GB",
            "dropoff_country_code": "IE",
        }
        r = s.post(f"{PUBLIC}/api/pricing/quote", json=body, timeout=30)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j.get("requires_manual_review") is True, j
        assert j.get("route_class") == "international", j
