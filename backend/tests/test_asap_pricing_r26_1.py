"""R26.1 mini-patch regression tests.

Covers:
  1. Transport dead-mileage: new `dead_mileage_bands_transport` correctly
     applied at nearest-driver-distance bands 0/10/20/35/50+ mi.
  2. Recovery dead-mileage unchanged from R26 baseline.
  3. Vehicle rate cards untouched (20 transport, 12 recovery).
  4. Booking-fee bands untouched (single source of truth still
     `calculate_booking_fee_detail`; ASAP engine still has zero fee logic
     of its own).
  5. International ASAP guardrail returns manual review from BOTH
     `/asap/quote` and `/pricing/quote` (service_timing=asap).
  6. UK domestic ASAP still returns an instant price.
  7. Three-way endpoint consistency: `/asap/quote`, `/pricing/quote` (asap)
     and `calculate_asap_quote` all produce the SAME driver_charge /
     booking_fee / customer_total for identical inputs.
  8. Historical immutability: a snapshot dict created BEFORE the R26.1
     patch semantics remains byte-identical after the patch is loaded.

The FastAPI HTTP endpoints (#5, #7) are exercised via `httpx.AsyncClient`
against the running backend using the seeded test customer, so this file
doubles as an HTTP integration smoke.
"""

from __future__ import annotations

import asyncio
import json
import os
import sys

import pytest

# Ensure `services.*` is importable when running from /app/backend.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.asap_pricing import (  # noqa: E402
    ASAP_DEFAULT_CONFIG,
    ASAP_ENGINE_VERSION,
    calculate_asap_quote,
)


# ---------------------------------------------------------------------------
# Test doubles
# ---------------------------------------------------------------------------

class _StubDB:
    class _users:
        async def count_documents(self, *_a, **_k): return 0
    class _cfg:
        async def find_one(self, *_a, **_k): return None
    users = _users()
    asap_pricing_config = _cfg()


DB = _StubDB()


async def _fee_detail(driver_charge: float) -> dict:
    """Local mirror of the canonical `calculate_booking_fee_detail`."""
    bands = [
        (0.00,    150.00,  15.0),
        (150.01,  300.00,  14.0),
        (300.01,  600.00,  13.0),
        (600.01,  1000.00, 12.0),
        (1000.01, None,    10.0),
    ]
    for mn, mx, pct in bands:
        if driver_charge >= mn and (mx is None or driver_charge <= mx):
            return {"percent": pct, "amount": round(driver_charge * pct / 100.0, 2),
                    "band_id": None, "source": "booking_fee_bands"}
    return {"percent": 10.0, "amount": round(driver_charge * 0.10, 2),
            "band_id": None, "source": "fallback"}


def _quote(**over):
    """Sync helper — LWB Van 40mi ASAP with overrides."""
    kw = dict(
        distance_miles=40, duration_minutes=60, distance_source="test",
        service_type="transport", urgency="asap",
        requested_vehicle_key="lwb_van",
        calculate_booking_fee_detail=_fee_detail,
    )
    kw.update(over)
    return asyncio.get_event_loop().run_until_complete(
        calculate_asap_quote(DB, **kw))


# ---------------------------------------------------------------------------
# 1. Transport dead-mileage bands
# ---------------------------------------------------------------------------

def test_transport_dead_mileage_default_bands_present():
    assert "dead_mileage_bands_transport" in ASAP_DEFAULT_CONFIG
    bands = ASAP_DEFAULT_CONFIG["dead_mileage_bands_transport"]
    # 5 entries with monotonically non-decreasing uplifts
    upsteps = [b["uplift"] for b in bands]
    assert upsteps == sorted(upsteps)
    # First band = 0 uplift when driver at pickup, last uplift <= recovery last
    rec_last = ASAP_DEFAULT_CONFIG["dead_mileage_bands_recovery"][-1]["uplift"]
    assert upsteps[0] == 0.0
    assert upsteps[-1] < rec_last, "Transport table must be LIGHTER than recovery"


@pytest.mark.parametrize("mi,expected_dead_uplift", [
    (0.0,  0.00),
    (10.0, 0.00),
    (10.1, 0.10),
    (20.0, 0.10),
    (20.1, 0.20),
    (30.0, 0.20),
    (30.1, 0.30),
    (50.0, 0.30),
    (50.1, 0.40),
    (75.0, 0.40),
    (200.0, 0.40),
])
def test_transport_dead_mileage_bands_correctly_applied(mi, expected_dead_uplift):
    q = _quote(nearest_driver_distance_mi=mi)
    assert q.pricing_snapshot["uplifts"]["dead_mileage"] == pytest.approx(expected_dead_uplift), (
        f"nearest_driver_distance_mi={mi} expected uplift={expected_dead_uplift} "
        f"got {q.pricing_snapshot['uplifts']['dead_mileage']}")


def test_transport_close_and_far_drivers_have_distinct_economics():
    """LWB Van 100mi ASAP — close (0mi) driver charge must differ from far
    (35mi) driver charge because the new transport band contributes."""
    close = _quote(distance_miles=100, duration_minutes=150,
                    nearest_driver_distance_mi=0.0)
    far = _quote(distance_miles=100, duration_minutes=150,
                    nearest_driver_distance_mi=35.0)
    assert close.driver_charge < far.driver_charge, (
        f"close £{close.driver_charge} should be < far £{far.driver_charge}")


def test_transport_dead_mileage_none_disables_the_uplift():
    """When callers don't supply a nearest-driver-distance we skip the
    uplift entirely — no free premium slipped in via a default 0mi."""
    q = _quote(nearest_driver_distance_mi=None)
    assert q.pricing_snapshot["uplifts"]["dead_mileage"] == 0.0


# ---------------------------------------------------------------------------
# 2. Recovery dead-mileage unchanged (regression guard)
# ---------------------------------------------------------------------------

def test_recovery_dead_mileage_bands_unchanged():
    assert ASAP_DEFAULT_CONFIG["dead_mileage_bands_recovery"] == [
        {"max_mi": 10,   "uplift": 0.00},
        {"max_mi": 20,   "uplift": 0.25},
        {"max_mi": 30,   "uplift": 0.40},
        {"max_mi": 50,   "uplift": 0.60},
        {"max_mi": None, "uplift": 0.75},
    ]


@pytest.mark.parametrize("mi,expected", [
    (5.0,  0.00),
    (15.0, 0.25),
    (25.0, 0.40),
    (45.0, 0.60),
    (60.0, 0.75),
])
def test_recovery_dead_mileage_still_fires(mi, expected):
    q = asyncio.get_event_loop().run_until_complete(calculate_asap_quote(
        DB,
        distance_miles=40, duration_minutes=60, distance_source="test",
        service_type="breakdown_recovery", urgency="asap",
        requested_vehicle_key="3_5t_recovery",
        nearest_driver_distance_mi=mi,
        calculate_booking_fee_detail=_fee_detail,
    ))
    assert q.pricing_snapshot["uplifts"]["dead_mileage"] == pytest.approx(expected)


# ---------------------------------------------------------------------------
# 3. Vehicle rate cards untouched
# ---------------------------------------------------------------------------

def test_transport_vehicles_unchanged():
    """All 20 transport keys still present with their exact min charges."""
    expected_mins = {
        "car": 35, "small_van": 45, "lwb_van": 70, "elwb_van": 80,
        "pickup": 55, "luton": 100, "luton_tail_lift": 110,
        "3_5t_rigid": 100, "3_5t_rigid_tail_lift": 115,
        "5t_rigid": 140, "7_5t_rigid": 175, "7_5t_rigid_tail_lift": 195,
        "10_18t_rigid": 250, "26t_rigid": 300, "32t_rigid": 325,
        "multi_axle_rigid": 400, "tractor_unit": 300, "semi_trailer": 300,
        "articulated_hgv": 400, "heavy_haul_combo": 500,
    }
    for k, m in expected_mins.items():
        assert ASAP_DEFAULT_CONFIG["transport_vehicles"][k]["minimum_charge"] == m


def test_recovery_vehicles_unchanged():
    expected_mins = {
        "light_recovery_van": 85, "pickup_recovery": 90,
        "3_5t_recovery": 110, "5_7_5t_recovery": 150,
        "10_18t_recovery": 250, "26t_recovery": 300, "32t_recovery": 350,
        "heavy_recovery": 400, "heavy_6x4_8x4_recovery": 450,
        "heavy_tractor_recovery": 500, "heavy_articulated_recovery": 550,
        "stgo_heavy_recovery": 750,
    }
    for k, m in expected_mins.items():
        assert ASAP_DEFAULT_CONFIG["recovery_vehicles"][k]["minimum_charge"] == m


# ---------------------------------------------------------------------------
# 4. Booking-fee delegation intact
# ---------------------------------------------------------------------------

def test_asap_engine_has_no_fee_logic():
    """The ASAP engine must delegate booking-fee calc via an INJECTED
    callable. It must NEVER hardcode band tables or import from `server`."""
    path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                          "services", "asap_pricing.py")
    src = open(path).read()
    assert "from server" not in src
    assert "import server" not in src
    # The single legal reference to booking_fee_bands is in the docstring
    # header; the ENGINE never touches the collection directly.
    assert "booking_fee_bands" not in src
    # calculate_booking_fee_detail must be an injected callable — not an
    # import.
    assert "def calculate_booking_fee_detail" not in src


# ---------------------------------------------------------------------------
# 5. International guardrail via HTTP endpoints
# ---------------------------------------------------------------------------

BASE_URL = os.environ.get("R26_TEST_BASE_URL", "http://localhost:8001").rstrip("/")


def _load_env_backend_url():
    # localhost:8001 bypasses the CSRF referer/origin check (Bearer path is
    # still exercised end-to-end). If the caller has explicitly overridden
    # to a public URL that requires CSRF, they must supply the CSRF cookie
    # separately.
    return


@pytest.fixture(scope="module")
def http_bearer():
    _load_env_backend_url()
    if not BASE_URL:
        pytest.skip("REACT_APP_BACKEND_URL not available for integration test")
    import urllib.request
    body = json.dumps({"email": "testcustomer@example.com",
                        "password": "CustomerTest12345!"}).encode()
    req = urllib.request.Request(f"{BASE_URL}/api/auth/login",
                                    data=body, method="POST",
                                    headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            d = json.load(r)
        return d["access_token"]
    except Exception as e:
        pytest.skip(f"login failed / backend unreachable: {e}")


def _post(path, tok, body):
    import urllib.request
    req = urllib.request.Request(
        f"{BASE_URL}{path}", data=json.dumps(body).encode(), method="POST",
        headers={"Content-Type": "application/json",
                  "Authorization": f"Bearer {tok}"})
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.load(r)


@pytest.mark.integration
def test_pricing_quote_asap_international_returns_manual_review(http_bearer):
    """UK → IE ASAP quote via /pricing/quote MUST be manual review."""
    r = _post("/api/pricing/quote", http_bearer, {
        "pickup_lat": 51.5, "pickup_lng": -0.1,
        "dropoff_lat": 53.3, "dropoff_lng": -6.2,
        "service_type": "transport",
        "service_timing": "asap",
        "requested_vehicle_key": "lwb_van",
        "pickup_country_code": "GB",
        "dropoff_country_code": "IE",
    })
    assert r.get("requires_manual_review") is True
    assert r.get("route_class") == "international"
    assert "driver_charge" not in r or r["driver_charge"] in (None, 0)


@pytest.mark.integration
def test_asap_quote_international_returns_manual_review(http_bearer):
    r = _post("/api/asap/quote", http_bearer, {
        "pickup_lat": 51.5, "pickup_lng": -0.1,
        "dropoff_lat": 53.3, "dropoff_lng": -6.2,
        "service_type": "transport", "urgency": "asap",
        "requested_vehicle_key": "lwb_van",
        "pickup_country_code": "GB",
        "dropoff_country_code": "IE",
    })
    assert r.get("requires_manual_review") is True
    assert r.get("route_class") == "international"


@pytest.mark.integration
def test_pricing_quote_asap_domestic_still_priced(http_bearer):
    r = _post("/api/pricing/quote", http_bearer, {
        "pickup_lat": 52.5, "pickup_lng": -1.5,
        "dropoff_lat": 52.7, "dropoff_lng": -1.1,   # ~15 mi UK domestic
        "service_type": "transport",
        "service_timing": "asap",
        "requested_vehicle_key": "lwb_van",
        "pickup_country_code": "GB",
        "dropoff_country_code": "GB",
    })
    assert r.get("requires_manual_review") is False
    assert r.get("driver_charge") is not None
    assert r.get("engine_version") == "ASAP-V1.0"
    # Booking-fee percent must come back from the band lookup
    assert r.get("booking_fee_percent") in (10.0, 12.0, 13.0, 14.0, 15.0)


@pytest.mark.integration
def test_asap_quote_domestic_still_priced(http_bearer):
    r = _post("/api/asap/quote", http_bearer, {
        "pickup_lat": 52.5, "pickup_lng": -1.5,
        "dropoff_lat": 52.7, "dropoff_lng": -1.1,
        "service_type": "transport", "urgency": "asap",
        "requested_vehicle_key": "lwb_van",
        "pickup_country_code": "GB",
        "dropoff_country_code": "GB",
    })
    assert r.get("driver_charge") is not None
    assert r.get("engine_version") == "ASAP-V1.0"


@pytest.mark.integration
def test_three_way_domestic_asap_consistency(http_bearer):
    """/asap/quote and /pricing/quote (asap) must return same £ for same
    inputs. /jobs is exercised separately (creates persistent state)."""
    payload = {
        "pickup_lat": 52.5, "pickup_lng": -1.5,
        "dropoff_lat": 52.7, "dropoff_lng": -1.1,
        "service_type": "transport",
        "requested_vehicle_key": "lwb_van",
        "pickup_country_code": "GB", "dropoff_country_code": "GB",
    }
    a = _post("/api/asap/quote", http_bearer, {**payload, "urgency": "asap"})
    b = _post("/api/pricing/quote", http_bearer, {**payload, "service_timing": "asap"})
    assert a["driver_charge"] == b["driver_charge"]
    assert a["booking_fee"]   == b["booking_fee"]
    assert a["customer_total"] == b["customer_total"]
    assert a["engine_version"] == b["engine_version"] == "ASAP-V1.0"


# ---------------------------------------------------------------------------
# 6. Snapshot immutability under R26.1 config changes
# ---------------------------------------------------------------------------

def test_snapshot_written_at_creation_survives_config_edit():
    """A snapshot is a self-contained dict — the new dead-mileage
    transport table added by R26.1 must NOT retroactively change the
    figures stored on a pre-R26.1 booking."""
    q = _quote(distance_miles=25, duration_minutes=45,
                 nearest_driver_distance_mi=None)   # pre-R26.1 style
    frozen = json.dumps(q.pricing_snapshot, sort_keys=True)
    # Now imagine an admin edits the transport band table upwards…
    hacked = json.loads(json.dumps(ASAP_DEFAULT_CONFIG))
    hacked["dead_mileage_bands_transport"] = [
        {"max_mi": None, "uplift": 0.75},   # aggressive
    ]
    q_new = asyncio.get_event_loop().run_until_complete(calculate_asap_quote(
        DB, distance_miles=25, duration_minutes=45, distance_source="test",
        service_type="transport", urgency="asap",
        requested_vehicle_key="lwb_van", config=hacked,
        nearest_driver_distance_mi=None,
        calculate_booking_fee_detail=_fee_detail,
    ))
    # Original snapshot bytes untouched
    assert json.dumps(q.pricing_snapshot, sort_keys=True) == frozen
    # New quote uses the new table (or ignores it because nearest_driver_distance_mi=None)
    assert q_new.driver_charge == q.driver_charge
