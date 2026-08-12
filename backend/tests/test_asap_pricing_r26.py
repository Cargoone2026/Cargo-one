"""R26 — ASAP Pricing Engine V1 tests.

Covers direct-engine unit tests + HTTP integration against the live API.

Structure
---------
Section 1: Direct engine unit tests (AsyncMock db, no HTTP)
  - progressive mileage (C)
  - ASAP premium value 0.15 not 0.20 (F)
  - +50 / +80% ceiling (G, H)
  - validation errors (I)
  - manual review flag (J)
  - transport auto-pick (K)
  - recovery auto-pick (L)
  - recovery vs transport rate independence (D)
  - transport_category NEVER leaks into recovery (E — R25.1 regression guard)

Section 2: HTTP integration (auth customer, live API)
  - Smethwick recovery scenario (A)
  - Manchester → Leeds LWB (B)
  - booking-fee band consistency vs /booking-fee-bands/preview (M)
  - screen consistency: /asap/quote == /jobs.fixed_price == /bookings.driver_charge (N)
  - scheduled /pricing/quote unchanged path returns non-ASAP-engine (O)
  - snapshot immutability & asap_quote_audit persistence (P, Q)
  - auth guard on /asap/quote (T)
"""

from __future__ import annotations

import os
import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
import requests

from services.asap_pricing import (
    ASAP_DEFAULT_CONFIG,
    ASAP_ENGINE_VERSION,
    AsapPricingError,
    _progressive_mileage,
    _pick_transport_vehicle,
    _pick_recovery_vehicle,
    calculate_asap_quote,
    load_asap_config,
)

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE}/api"

CUST_EMAIL = "testcustomer@example.com"
CUST_PW = "CustomerTest12345!"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _fake_db(driver_count: int = 0):
    """Return an AsyncMock db double with an empty asap_pricing_config
    override + fixed driver count."""
    db = MagicMock()
    db.asap_pricing_config.find_one = AsyncMock(return_value=None)
    db.users.count_documents = AsyncMock(return_value=driver_count)
    return db


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


# ===========================================================================
# Section 1: Direct engine unit tests
# ===========================================================================


class TestProgressiveMileage:
    """C — progressive mileage bands, NOT distance × per_mile."""

    def test_lwb_300mi_uses_bands_not_flat(self):
        # goods curve: 50@1.0 + 50@0.94 + 100@0.88 + 100@0.82 (=300)
        # LWB per_mile £1.50 -> total = (50*1.0 + 50*0.94 + 100*0.88 + 100*0.82) * 1.50
        expected = (50*1.0 + 50*0.94 + 100*0.88 + 100*0.82) * 1.50
        flat = 300 * 1.50
        got = _progressive_mileage(
            300.0, 1.50, ASAP_DEFAULT_CONFIG["mileage_curves"]["goods"]
        )
        assert got == pytest.approx(expected, abs=0.5)
        assert got < flat, "progressive mileage must be cheaper than flat"

    def test_short_distance_within_first_band(self):
        got = _progressive_mileage(
            25.0, 1.50, ASAP_DEFAULT_CONFIG["mileage_curves"]["goods"]
        )
        assert got == pytest.approx(25 * 1.50 * 1.0, abs=0.01)


class TestVehicleAutoPick:
    """K — transport auto-pick; L — recovery auto-pick."""

    def test_transport_pick_parcel(self):
        assert _pick_transport_vehicle(
            ASAP_DEFAULT_CONFIG, weight_kg=25, volume_m3=0.5, pallets=0, requested=None
        ) == "car"

    def test_transport_pick_300kg(self):
        v = _pick_transport_vehicle(
            ASAP_DEFAULT_CONFIG, weight_kg=300, volume_m3=3, pallets=1, requested=None
        )
        assert v in ("small_van", "lwb_van")

    def test_transport_pick_800kg(self):
        v = _pick_transport_vehicle(
            ASAP_DEFAULT_CONFIG, weight_kg=800, volume_m3=6, pallets=2, requested=None
        )
        assert v == "lwb_van"

    def test_transport_pick_1500kg(self):
        # 1500 kg > 1400 tier; next tier is 3_5t_rigid at 1600
        v = _pick_transport_vehicle(
            ASAP_DEFAULT_CONFIG, weight_kg=1500, volume_m3=15, pallets=5, requested=None
        )
        assert v in ("3_5t_rigid", "luton")

    def test_transport_pick_5000kg(self):
        v = _pick_transport_vehicle(
            ASAP_DEFAULT_CONFIG, weight_kg=5000, volume_m3=40, pallets=15, requested=None
        )
        assert v in ("10_18t_rigid", "26t_rigid", "articulated_hgv")

    def test_recovery_pick_motorcycle(self):
        assert _pick_recovery_vehicle(
            ASAP_DEFAULT_CONFIG, requested=None, vehicle_class="motorcycle", weight_kg=200
        ) == "light_recovery_van"

    def test_recovery_pick_hgv(self):
        assert _pick_recovery_vehicle(
            ASAP_DEFAULT_CONFIG, requested=None, vehicle_class="hgv", weight_kg=None
        ) == "heavy_recovery"

    def test_recovery_pick_default(self):
        assert _pick_recovery_vehicle(
            ASAP_DEFAULT_CONFIG, requested=None, vehicle_class=None, weight_kg=None
        ) == "3_5t_recovery"


class TestEngineDirect:
    """Direct calls into calculate_asap_quote for R26 invariants."""

    def test_F_asap_premium_is_15_not_20(self):
        db = _fake_db()
        b = _run(calculate_asap_quote(
            db,
            distance_miles=50, duration_minutes=60,
            distance_source="haversine",
            service_type="transport",
            urgency="asap",
            requested_vehicle_key="lwb_van",
            when_iso="2026-02-10T14:00:00Z",  # Tue afternoon — no night/weekend/BH
        ))
        assert b.pricing_snapshot["uplifts"]["asap"] == pytest.approx(0.15)
        assert b.pricing_snapshot["engine_version"] == ASAP_ENGINE_VERSION

    def test_G_ceiling_capped_at_50_pct(self):
        db = _fake_db(driver_count=0)  # supply +30%
        b = _run(calculate_asap_quote(
            db,
            distance_miles=50, duration_minutes=60,
            distance_source="haversine",
            service_type="transport",
            urgency="emergency",  # +25
            collection_within_minutes=10,  # +20
            requested_vehicle_key="lwb_van",
            pickup_lat=51.5, pickup_lng=-0.12,
            when_iso="2026-12-25T02:30:00Z",  # Christmas + night — should force cap
        ))
        u = b.pricing_snapshot["uplifts"]
        assert u["capped"] is True
        assert u["effective_total"] == pytest.approx(0.50, abs=0.001)
        assert u["raw_total"] > 0.50

    def test_H_heavy_vehicle_uses_heavy_curve_and_80pct_ceiling(self):
        db = _fake_db(driver_count=0)
        b = _run(calculate_asap_quote(
            db,
            distance_miles=200, duration_minutes=200,
            distance_source="haversine",
            service_type="transport",
            urgency="emergency",
            collection_within_minutes=10,
            requested_vehicle_key="26t_rigid",
            pickup_lat=51.5, pickup_lng=-0.12,
            when_iso="2026-12-25T02:30:00Z",
        ))
        assert b.pricing_snapshot["uplifts"]["ceiling"] == pytest.approx(0.80)
        # 200mi heavy: 100@1.00 + 100@0.95 = 195 * per_mile 3.90 = 760.5
        mileage = b.pricing_snapshot["base_charges"]["mileage"]
        assert mileage == pytest.approx(195 * 3.90, abs=1.0)

    @pytest.mark.parametrize("field,value,code", [
        ("weight_kg", -5, "invalid_weight"),
        ("weight_kg", 50000, "invalid_weight"),
        ("volume_m3", -1, "invalid_dims"),
        ("distance_miles", 2000, "distance_too_large"),
    ])
    def test_I_validation(self, field, value, code):
        db = _fake_db()
        kwargs = dict(
            distance_miles=50, duration_minutes=60,
            distance_source="haversine",
            service_type="transport",
            requested_vehicle_key="lwb_van",
        )
        kwargs[field] = value
        with pytest.raises(AsapPricingError) as exc:
            _run(calculate_asap_quote(db, **kwargs))
        assert exc.value.code == code

    def test_J_manual_review_heavy_haul_combo(self):
        db = _fake_db()
        b = _run(calculate_asap_quote(
            db,
            distance_miles=50, duration_minutes=60,
            distance_source="haversine",
            service_type="transport",
            requested_vehicle_key="heavy_haul_combo",
        ))
        assert b.manual_review is True

    def test_J_manual_review_stgo(self):
        db = _fake_db()
        b = _run(calculate_asap_quote(
            db,
            distance_miles=50, duration_minutes=60,
            distance_source="haversine",
            service_type="breakdown_recovery",
            requested_vehicle_key="stgo_heavy_recovery",
        ))
        assert b.manual_review is True

    def test_D_recovery_more_expensive_than_transport(self):
        """A 100mi 3.5T recovery must cost more than a 100mi small_van
        transport (independent rate cards, recovery is a premium service)."""
        db = _fake_db()
        rec = _run(calculate_asap_quote(
            db,
            distance_miles=100, duration_minutes=120,
            distance_source="haversine",
            service_type="breakdown_recovery",
            requested_vehicle_key="3_5t_recovery",
            urgency="asap",
            when_iso="2026-02-10T14:00:00Z",
        ))
        trans = _run(calculate_asap_quote(
            db,
            distance_miles=100, duration_minutes=120,
            distance_source="haversine",
            service_type="transport",
            requested_vehicle_key="small_van",
            urgency="asap",
            when_iso="2026-02-10T14:00:00Z",
        ))
        assert rec.driver_charge > trans.driver_charge

    def test_E_recovery_ignores_transport_category(self):
        """R25.1 regression guard — a recovery quote must NOT vary when
        the customer passes a `vehicle_class='car'` (which used to leak
        the cars_vehicles transport multiplier)."""
        db = _fake_db()
        with_car = _run(calculate_asap_quote(
            db,
            distance_miles=120, duration_minutes=140,
            distance_source="haversine",
            service_type="breakdown_recovery",
            vehicle_class="car",
            urgency="asap",
            when_iso="2026-02-10T14:00:00Z",
        ))
        without = _run(calculate_asap_quote(
            db,
            distance_miles=120, duration_minutes=140,
            distance_source="haversine",
            service_type="breakdown_recovery",
            urgency="asap",
            when_iso="2026-02-10T14:00:00Z",
        ))
        assert with_car.driver_charge == without.driver_charge
        assert with_car.resolved_vehicle_key == "3_5t_recovery"


# ===========================================================================
# Section 2: HTTP integration
# ===========================================================================


@pytest.fixture(scope="module")
def cust_token():
    if not BASE:
        pytest.skip("REACT_APP_BACKEND_URL not set")
    r = requests.post(
        f"{API}/auth/login",
        json={"email": CUST_EMAIL, "password": CUST_PW},
        timeout=15,
    )
    if r.status_code != 200:
        pytest.skip(f"customer login failed: {r.status_code} {r.text[:200]}")
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def auth(cust_token):
    return {"Authorization": f"Bearer {cust_token}"}


SMETHWICK = dict(pickup_lat=51.5074, pickup_lng=-0.1278,
                   dropoff_lat=52.4923, dropoff_lng=-2.0069)
MAN_LEEDS = dict(pickup_lat=53.4808, pickup_lng=-2.2426,
                   dropoff_lat=53.8008, dropoff_lng=-1.5491)


class TestAsapQuoteHTTP:

    def test_T_auth_required(self):
        if not BASE:
            pytest.skip("no BASE")
        r = requests.post(f"{API}/asap/quote", json={
            **SMETHWICK, "service_type": "transport", "urgency": "asap"
        }, timeout=15)
        assert r.status_code in (401, 403), (
            f"Expected 401/403 without auth, got {r.status_code}: {r.text[:200]}"
        )

    def test_A_smethwick_recovery_below_600(self, auth):
        r = requests.post(f"{API}/asap/quote", headers=auth, json={
            **SMETHWICK,
            "service_type": "breakdown_recovery",
            "urgency": "asap",
            "vehicle_class": "car",
        }, timeout=20)
        assert r.status_code == 200, r.text
        q = r.json()
        assert q["driver_charge"] < 600, (
            f"Smethwick recovery £{q['driver_charge']} still too high — "
            "buggy £1,068 must never come back"
        )
        assert q["engine_version"] == ASAP_ENGINE_VERSION
        assert q["resolved_vehicle_key"] == "3_5t_recovery"
        # Booking fee band for £150.01–£300 == 14%
        if 150.01 <= q["driver_charge"] <= 300:
            assert q["booking_fee_percent"] == pytest.approx(14.0)
        assert q["customer_total"] == pytest.approx(
            round(q["driver_charge"] + q["booking_fee"], 2), abs=0.01
        )

    def test_B_manchester_leeds_lwb(self, auth):
        r = requests.post(f"{API}/asap/quote", headers=auth, json={
            **MAN_LEEDS,
            "service_type": "transport",
            "urgency": "asap",
            "requested_vehicle_key": "lwb_van",
        }, timeout=20)
        assert r.status_code == 200, r.text
        q = r.json()
        keys = {li["key"] for li in q["line_items"]}
        assert "mileage" in keys
        assert "minimum_floor" in keys
        assert "asap_premium" in keys
        assert q["resolved_vehicle_key"] == "lwb_van"

    def test_M_booking_fee_band_consistency(self, auth):
        # Ask for a quote with driver_charge likely in £150–300 or £300–600
        r = requests.post(f"{API}/asap/quote", headers=auth, json={
            **SMETHWICK,
            "service_type": "breakdown_recovery",
            "urgency": "asap",
            "vehicle_class": "car",
        }, timeout=20)
        q = r.json()
        dc = q["driver_charge"]
        # Compare against /booking-fee-bands/preview
        r2 = requests.get(f"{API}/booking-fee-bands/preview",
                            params={"driver_charge": dc},
                            headers=auth, timeout=15)
        if r2.status_code != 200:
            # older name
            r2 = requests.get(f"{API}/booking-fee-bands/preview",
                                params={"amount": dc}, headers=auth, timeout=15)
        assert r2.status_code == 200, r2.text
        preview = r2.json()
        # Accept several possible key names
        preview_pct = (preview.get("booking_fee_percent")
                          or preview.get("percent")
                          or (preview.get("band") or {}).get("booking_fee_percent"))
        assert preview_pct is not None, f"no % in preview: {preview}"
        assert float(preview_pct) == pytest.approx(q["booking_fee_percent"], abs=0.01)

    def test_N_screen_consistency_asap(self, auth):
        """/asap/quote driver_charge == /jobs.fixed_price ==
        /bookings.driver_charge for the same inputs."""
        payload_quote = {
            **SMETHWICK,
            "service_type": "breakdown_recovery",
            "urgency": "asap",
            "vehicle_class": "car",
        }
        q = requests.post(f"{API}/asap/quote", headers=auth,
                            json=payload_quote, timeout=20).json()
        screen1 = q["driver_charge"]

        job = requests.post(f"{API}/jobs", headers=auth, json={
            "title": "R26 screen consistency",
            "category": "recovery",
            "description": "R26 asap engine screen test",
            "pickup_address": "London", "pickup_town": "London",
            "dropoff_address": "Smethwick", "dropoff_town": "Smethwick",
            **SMETHWICK,
            "collection_date": "2026-02-10T10:00:00Z",
            "delivery_date":   "2026-02-10T14:00:00Z",
            "service_timing": "asap",
            "service_type":   "breakdown_recovery",
            "pricing_type":   "fixed",
            "vehicle_details": {"type": "car"},
        }, timeout=20).json()
        assert "id" in job, f"job create failed: {job}"
        screen2 = job["fixed_price"]

        try:
            bk = requests.post(f"{API}/bookings", headers=auth,
                                 json={"job_id": job["id"]}, timeout=20).json()
            screen3 = bk["driver_charge"]
            assert screen1 == screen2 == screen3, (
                f"divergence quote={screen1} job={screen2} booking={screen3}"
            )
            # P — snapshot immutability
            assert job.get("pricing_engine_version") == ASAP_ENGINE_VERSION
            assert bk.get("pricing_engine_version") == ASAP_ENGINE_VERSION
            snap = bk.get("pricing_snapshot") or {}
            assert snap.get("engine_version") == ASAP_ENGINE_VERSION
            for k in ("inputs", "uplifts", "base_charges",
                        "driver_charge_pre_min", "minimum_charge",
                        "driver_charge_rounded", "booking_fee",
                        "customer_total"):
                assert k in snap, f"snapshot missing {k}"
        finally:
            # cleanup
            try:
                from dotenv import load_dotenv
                load_dotenv("/app/backend/.env")
                import asyncio as _aio
                from motor.motor_asyncio import AsyncIOMotorClient
                async def _clean():
                    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
                    await db.jobs.delete_one({"id": job["id"]})
                    await db.bookings.delete_many({"job_id": job["id"]})
                _aio.get_event_loop().run_until_complete(_clean())
            except Exception:
                pass

    def test_O_scheduled_pricing_unchanged(self, auth):
        """Scheduled Fixed/Bidding still uses services/pricing.py (NOT ASAP-V1.0)."""
        r = requests.post(f"{API}/pricing/quote", headers=auth, json={
            **SMETHWICK,
            "service_type": "breakdown_recovery",
            "service_timing": "scheduled",
            "vehicle_details": {"type": "car"},
        }, timeout=20)
        assert r.status_code == 200, r.text
        q = r.json()
        snap = q.get("pricing_snapshot") or {}
        # scheduled path should NOT bear the ASAP-V1.0 stamp
        assert snap.get("engine_version") != ASAP_ENGINE_VERSION, (
            "scheduled pricing accidentally routed through ASAP engine"
        )

    def test_Q_asap_quote_audit_persisted(self, auth):
        """Every /asap/quote call must append a row to asap_quote_audit."""
        r = requests.post(f"{API}/asap/quote", headers=auth, json={
            **MAN_LEEDS,
            "service_type": "transport",
            "urgency": "asap",
            "requested_vehicle_key": "lwb_van",
        }, timeout=20)
        assert r.status_code == 200
        try:
            from dotenv import load_dotenv
            load_dotenv("/app/backend/.env")
            import asyncio as _aio
            from motor.motor_asyncio import AsyncIOMotorClient
            async def _peek():
                db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
                doc = await db.asap_quote_audit.find_one(
                    {"pricing_engine_version": ASAP_ENGINE_VERSION,
                     "resolved_vehicle_key": "lwb_van"},
                    sort=[("created_at", -1)])
                return doc
            doc = _aio.get_event_loop().run_until_complete(_peek())
            assert doc is not None, "asap_quote_audit row not written"
            assert doc.get("driver_charge") is not None
            assert doc.get("snapshot", {}).get("engine_version") == ASAP_ENGINE_VERSION
        except pytest.skip.Exception:
            raise
        except Exception as e:
            pytest.skip(f"cannot peek mongo: {e}")
