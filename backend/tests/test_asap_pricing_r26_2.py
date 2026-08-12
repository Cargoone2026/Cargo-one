"""R26.2 — Customer-facing ASAP TRANSPORT vehicle picker regression tests.

Covers:
  1. `requested_vehicle_key` is honoured when large enough for the load.
  2. `requested_vehicle_key` raises `AsapPricingError(code='vehicle_too_small')`
     when the customer picks a class smaller than the auto-recommended
     minimum for the given load. Recommendation appears in the message.
  3. Tail-lift variants are separately priceable (no double-charge on top
     of their configured rate cards).
  4. Auto-recommend still works when no key is passed.
  5. `size_ranks` table covers all 20 transport classes.
  6. R26.1 recovery dead-mileage bands remain untouched (guard against a
     stray edit in the same function).
  7. Snapshot's `resolved_vehicle_key` matches the requested key on happy
     path.

Fee delegation, booking-fee bands, snapshot immutability and international
guardrail behaviour are all covered by the R26 and R26.1 test files and
are NOT duplicated here.
"""

from __future__ import annotations

import asyncio
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.asap_pricing import (  # noqa: E402
    ASAP_DEFAULT_CONFIG,
    AsapPricingError,
    calculate_asap_quote,
    _pick_transport_vehicle,
)


class _DB:
    class _u:
        async def count_documents(self, *_a, **_k): return 0
    class _c:
        async def find_one(self, *_a, **_k): return None
    users = _u()
    asap_pricing_config = _c()


DB = _DB()


async def _fee_detail(dc: float) -> dict:
    bands = [
        (0.00,    150.00,  15.0),
        (150.01,  300.00,  14.0),
        (300.01,  600.00,  13.0),
        (600.01,  1000.00, 12.0),
        (1000.01, None,    10.0),
    ]
    for mn, mx, pct in bands:
        if dc >= mn and (mx is None or dc <= mx):
            return {"percent": pct, "amount": round(dc * pct / 100.0, 2),
                    "band_id": None, "source": "booking_fee_bands"}
    return {"percent": 10.0, "amount": round(dc * 0.10, 2),
            "band_id": None, "source": "fallback"}


def _q(**over):
    kw = dict(
        distance_miles=25, duration_minutes=45, distance_source="test",
        service_type="transport", urgency="asap",
        calculate_booking_fee_detail=_fee_detail,
    )
    kw.update(over)
    return asyncio.get_event_loop().run_until_complete(
        calculate_asap_quote(DB, **kw))


# ---------------------------------------------------------------------------
# 5. size_ranks covers every transport class
# ---------------------------------------------------------------------------

def test_transport_size_ranks_cover_all_20_classes():
    ranks = ASAP_DEFAULT_CONFIG["transport_vehicle_size_ranks"]
    vehs  = ASAP_DEFAULT_CONFIG["transport_vehicles"]
    missing = [k for k in vehs if k not in ranks]
    assert missing == [], f"Missing size rank for: {missing}"
    # Every rank value should be an int between 0 and 10 inclusive.
    assert all(isinstance(v, int) and 0 <= v <= 10 for v in ranks.values())
    # Tail-lift pairs share the base rank.
    assert ranks["luton"] == ranks["luton_tail_lift"]
    assert ranks["3_5t_rigid"] == ranks["3_5t_rigid_tail_lift"]
    assert ranks["7_5t_rigid"] == ranks["7_5t_rigid_tail_lift"]


# ---------------------------------------------------------------------------
# 1 + 4. Auto-recommend and honour-request happy paths
# ---------------------------------------------------------------------------

def test_auto_recommend_when_no_vehicle_requested():
    q = _q(requested_vehicle_key=None)
    assert q.pricing_snapshot["resolved_vehicle_key"] == "car"


def test_lwb_van_25mi_matches_owner_spec_numbers():
    """Owner's canonical sign-off scenario: LWB Van 25mi ASAP = £70/£10.50/£80.50."""
    q = _q(requested_vehicle_key="lwb_van")
    assert q.driver_charge == 70.0
    assert q.booking_fee_percent == 15.0
    assert q.booking_fee == 10.5
    assert q.customer_total == 80.5
    assert q.pricing_snapshot["resolved_vehicle_key"] == "lwb_van"


@pytest.mark.parametrize("key,exp_driver", [
    ("luton",                    100.0),
    ("luton_tail_lift",          110.0),
    ("3_5t_rigid",               100.0),
    ("3_5t_rigid_tail_lift",     115.0),
    ("7_5t_rigid",               175.0),
    ("7_5t_rigid_tail_lift",     195.0),
    ("articulated_hgv",          400.0),
])
def test_tail_lift_and_heavy_classes_price_at_min_charge_on_25mi(key, exp_driver):
    q = _q(requested_vehicle_key=key)
    assert q.driver_charge == exp_driver, (
        f"{key} 25mi ASAP: expected £{exp_driver}, got £{q.driver_charge}")
    assert q.pricing_snapshot["resolved_vehicle_key"] == key


# ---------------------------------------------------------------------------
# 3. Tail-lift is NOT double-charged when picking the tail-lift class
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("base,tl", [
    ("luton",       "luton_tail_lift"),
    ("3_5t_rigid",  "3_5t_rigid_tail_lift"),
    ("7_5t_rigid",  "7_5t_rigid_tail_lift"),
])
def test_tail_lift_variant_has_no_extra_line_item(base, tl):
    q_tl = _q(requested_vehicle_key=tl, tail_lift_needed=True)
    keys = {li.key for li in q_tl.line_items}
    assert "tail_lift" not in keys, (
        f"{tl} produced a separate tail_lift line item: {keys}")
    # And the price should be exactly the tail-lift class's min charge on
    # a short 25mi run (no additional surcharge).
    expected_min = ASAP_DEFAULT_CONFIG["transport_vehicles"][tl]["minimum_charge"]
    assert q_tl.driver_charge == float(expected_min)


# ---------------------------------------------------------------------------
# 2. vehicle_too_small validation
# ---------------------------------------------------------------------------

def test_customer_picking_car_with_heavy_load_raises_vehicle_too_small():
    with pytest.raises(AsapPricingError) as exc:
        _q(requested_vehicle_key="car", weight_kg=2000)
    assert exc.value.code == "vehicle_too_small"
    # Message must NAME both the too-small choice and the recommendation.
    msg = str(exc.value)
    assert "Car" in msg
    assert "too small" in msg.lower()
    assert "recommend" in msg.lower()


def test_customer_picking_small_van_with_pallet_load_raises_vehicle_too_small():
    with pytest.raises(AsapPricingError) as exc:
        _q(requested_vehicle_key="small_van", pallets=5)
    assert exc.value.code == "vehicle_too_small"


def test_customer_picking_larger_than_auto_pick_is_allowed():
    """LWB Van picked for a 200 kg load — auto would pick lwb_van; picking
    a Luton or 3.5T Rigid must be honoured (customer wants a bigger van)."""
    for k in ["luton", "3_5t_rigid", "articulated_hgv"]:
        q = _q(requested_vehicle_key=k, weight_kg=200)
        assert q.pricing_snapshot["resolved_vehicle_key"] == k


def test_customer_picking_lwb_van_for_borderline_load_still_ok():
    """LWB Van covers up to 1000 kg / 8 m³ / 2 pallets in the tier table."""
    q = _q(requested_vehicle_key="lwb_van", weight_kg=900, pallets=2)
    assert q.pricing_snapshot["resolved_vehicle_key"] == "lwb_van"


def test_customer_picking_unknown_key_falls_back_to_auto():
    """Bogus key silently falls back to auto-recommend — protects against
    stale FE catalogs after admin removes a class."""
    q = _q(requested_vehicle_key="not_a_real_vehicle", weight_kg=200)
    # weight 200 kg → auto-pick small_van (tier: 500 kg / 4 m³ / 1 pallet)
    assert q.pricing_snapshot["resolved_vehicle_key"] == "small_van"


# ---------------------------------------------------------------------------
# 6. R26.1 recovery dead-mileage bands must not be touched
# ---------------------------------------------------------------------------

def test_recovery_dead_mileage_bands_still_r26_1():
    assert ASAP_DEFAULT_CONFIG["dead_mileage_bands_recovery"] == [
        {"max_mi": 10,   "uplift": 0.00},
        {"max_mi": 20,   "uplift": 0.25},
        {"max_mi": 30,   "uplift": 0.40},
        {"max_mi": 50,   "uplift": 0.60},
        {"max_mi": None, "uplift": 0.75},
    ]


def test_transport_dead_mileage_bands_still_r26_1():
    assert ASAP_DEFAULT_CONFIG["dead_mileage_bands_transport"] == [
        {"max_mi": 10,   "uplift": 0.00},
        {"max_mi": 20,   "uplift": 0.10},
        {"max_mi": 30,   "uplift": 0.20},
        {"max_mi": 50,   "uplift": 0.30},
        {"max_mi": None, "uplift": 0.40},
    ]


# ---------------------------------------------------------------------------
# 7. Snapshot resolved_vehicle_key reflects the customer's pick
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("key", [
    "car", "small_van", "lwb_van", "elwb_van", "pickup",
    "luton", "luton_tail_lift", "3_5t_rigid", "3_5t_rigid_tail_lift",
    "5t_rigid", "7_5t_rigid", "7_5t_rigid_tail_lift",
    "10_18t_rigid", "26t_rigid", "32t_rigid", "multi_axle_rigid",
    "tractor_unit", "semi_trailer", "articulated_hgv", "heavy_haul_combo",
])
def test_snapshot_resolved_vehicle_matches_request_when_load_fits(key):
    q = _q(requested_vehicle_key=key)   # zero load — everything fits
    assert q.pricing_snapshot["resolved_vehicle_key"] == key
    assert q.pricing_snapshot["inputs"]["requested_vehicle_key"] == key


# ---------------------------------------------------------------------------
# Direct _pick_transport_vehicle unit tests
# ---------------------------------------------------------------------------

def test_pick_transport_vehicle_direct_calls():
    cfg = ASAP_DEFAULT_CONFIG
    # Auto: empty load → car
    assert _pick_transport_vehicle(cfg, weight_kg=0, volume_m3=0, pallets=0,
                                       requested=None) == "car"
    # Auto: 1200 kg → elwb_van tier
    assert _pick_transport_vehicle(cfg, weight_kg=1200, volume_m3=0, pallets=0,
                                       requested=None) == "elwb_van"
    # Requested LWB with zero load → honour
    assert _pick_transport_vehicle(cfg, weight_kg=0, volume_m3=0, pallets=0,
                                       requested="lwb_van") == "lwb_van"
    # Requested Car with 2000kg → raise
    with pytest.raises(AsapPricingError) as exc:
        _pick_transport_vehicle(cfg, weight_kg=2000, volume_m3=0, pallets=0,
                                    requested="car")
    assert exc.value.code == "vehicle_too_small"
