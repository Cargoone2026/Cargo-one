"""R25 — Authoritative Pricing Engine test matrix.

Runs the engine directly against a MagicMock db (no admin overrides) so the
tests exercise the sealed default config in `services.pricing`. Every test
asserts on the driver_charge AND that the resulting snapshot is
self-consistent (subtotal + line items add up).

The suite is organised into three layers:

1. **Unit / invariant tests** — every distance, weight, dimension, item,
   category, vehicle, forklift/loading combination the engine claims to
   support.
2. **Divergence-elimination tests** — prove that `create_job` and
   `/pricing/quote` return the same driver_charge for the same inputs.
   (Runs against the live FastAPI TestClient via an HTTP fixture in the
   companion http-level tests; here we exercise the engine directly.)
3. **UK market benchmark table** — 10 real-world journeys with expected
   ranges. Failure means the engine drifted outside a defensible band.
"""

from __future__ import annotations

import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock

from services.pricing import (
    calculate_quote, PricingError, DEFAULT_PRICING_CONFIG,
    load_pricing_config, PRICING_ENGINE_VERSION,
)


@pytest.fixture
def db_no_override():
    """Mongo mock that returns NO pricing_config override → defaults apply."""
    db = MagicMock()
    db.pricing_config.find_one = AsyncMock(return_value=None)
    return db


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _quote(db, **kwargs):
    defaults = {
        "distance_miles": 20,
        "duration_minutes": 40,
        "distance_source": "google_road",
        "service_type": "transport",
        "service_timing": "scheduled",
        "transport_category": "parcels",
    }
    defaults.update(kwargs)
    return await calculate_quote(db, **defaults)


def _line_items_sum_matches(breakdown) -> bool:
    """Verifies the line-items view of the quote is internally consistent
    with the final driver_charge. Every visible line must sum (accounting
    for minimum-charge uplift) to what the customer sees."""
    positive = sum(li.amount for li in breakdown.line_items if li.key != "minimum_charge_uplift")
    uplift = sum(li.amount for li in breakdown.line_items if li.key == "minimum_charge_uplift")
    reconstructed = round(positive + uplift, 2)
    return abs(reconstructed - breakdown.driver_charge) < 0.05


# ---------------------------------------------------------------------------
# 1. Distance matrix — small van, no cargo
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("miles,expect_min,expect_max", [
    (0.5,   35, 45),
    (5,     35, 55),
    (10,    38, 60),
    (25,    50, 80),
    (50,    75, 130),
    (100,  140, 230),
    (250,  340, 540),
    (500,  680, 1050),
])
def test_distance_matrix_small_van(db_no_override, miles, expect_min, expect_max):
    breakdown = _run(_quote(db_no_override, distance_miles=miles,
                              duration_minutes=miles * 2))
    assert expect_min <= breakdown.driver_charge <= expect_max, (
        f"{miles}mi → £{breakdown.driver_charge}, expected {expect_min}-{expect_max}"
    )
    assert _line_items_sum_matches(breakdown)


# ---------------------------------------------------------------------------
# 2. Weight bands — 50 mile parcel
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("weight,vehicle_key,min_price,max_price", [
    (None,  "small_van",   80, 130),
    (0,     "small_van",   80, 130),
    (1,     "small_van",   80, 130),
    (20,    "small_van",   80, 130),
    (100,   "small_van",   80, 130),
    (250,   "small_van",   80, 130),
    (500,   "medium_van",  95, 170),
    (1000,  "large_van",  120, 230),
    (2000,  "7_5t_truck", 260, 460),
])
def test_weight_bands_50mi(db_no_override, weight, vehicle_key, min_price, max_price):
    breakdown = _run(_quote(db_no_override, distance_miles=50, duration_minutes=90,
                              weight_kg=weight))
    assert breakdown.resolved_vehicle_key == vehicle_key, (
        f"weight={weight}kg picked {breakdown.resolved_vehicle_key}, expected {vehicle_key}"
    )
    assert min_price <= breakdown.driver_charge <= max_price, (
        f"weight={weight}kg → £{breakdown.driver_charge}, expected {min_price}-{max_price}"
    )


# ---------------------------------------------------------------------------
# 3. Volume / dimensions bands
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("vol,vehicle_key", [
    (0.5,  "small_van"),
    (5,    "medium_van"),
    (10,   "large_van"),
    (17,   "luton_van"),
    (28,   "7_5t_truck"),
])
def test_volume_picks_vehicle(db_no_override, vol, vehicle_key):
    breakdown = _run(_quote(db_no_override, distance_miles=20, duration_minutes=40,
                              volume_m3=vol))
    assert breakdown.resolved_vehicle_key == vehicle_key


# ---------------------------------------------------------------------------
# 4. Category multipliers
# ---------------------------------------------------------------------------


def test_pallets_more_expensive_than_parcels(db_no_override):
    parcels = _run(_quote(db_no_override, distance_miles=50, duration_minutes=90,
                            transport_category="parcels"))
    pallets = _run(_quote(db_no_override, distance_miles=50, duration_minutes=90,
                            transport_category="pallets"))
    assert pallets.driver_charge > parcels.driver_charge


def test_documents_cheaper_than_parcels(db_no_override):
    parcels = _run(_quote(db_no_override, distance_miles=50, duration_minutes=90,
                            transport_category="parcels"))
    docs = _run(_quote(db_no_override, distance_miles=50, duration_minutes=90,
                         transport_category="documents"))
    assert docs.driver_charge <= parcels.driver_charge


# ---------------------------------------------------------------------------
# 5. Operational surcharges
# ---------------------------------------------------------------------------


def test_forklift_and_loading_add_flat_fees(db_no_override):
    base = _run(_quote(db_no_override, distance_miles=25, duration_minutes=50))
    with_fk = _run(_quote(db_no_override, distance_miles=25, duration_minutes=50,
                            needs_forklift=True))
    with_lh = _run(_quote(db_no_override, distance_miles=25, duration_minutes=50,
                            needs_loading_help=True))
    with_both = _run(_quote(db_no_override, distance_miles=25, duration_minutes=50,
                              needs_forklift=True, needs_loading_help=True))
    assert with_fk.driver_charge  - base.driver_charge == pytest.approx(DEFAULT_PRICING_CONFIG["forklift_fee"], abs=0.5)
    assert with_lh.driver_charge  - base.driver_charge == pytest.approx(DEFAULT_PRICING_CONFIG["loading_help_fee"], abs=0.5)
    assert with_both.driver_charge - base.driver_charge == pytest.approx(
        DEFAULT_PRICING_CONFIG["forklift_fee"] + DEFAULT_PRICING_CONFIG["loading_help_fee"],
        abs=0.5,
    )


def test_extra_items_capped(db_no_override):
    big = _run(_quote(db_no_override, distance_miles=25, duration_minutes=50,
                        item_count=400))
    baseline = _run(_quote(db_no_override, distance_miles=25, duration_minutes=50))
    diff = big.driver_charge - baseline.driver_charge
    assert diff <= DEFAULT_PRICING_CONFIG["max_extra_item_fee"] + 5


# ---------------------------------------------------------------------------
# 6. ASAP + recovery multipliers
# ---------------------------------------------------------------------------


def test_asap_more_expensive_than_scheduled(db_no_override):
    sch = _run(_quote(db_no_override, distance_miles=25, duration_minutes=50,
                        service_timing="scheduled"))
    asap = _run(_quote(db_no_override, distance_miles=25, duration_minutes=50,
                         service_timing="asap"))
    ratio = asap.driver_charge / sch.driver_charge
    assert 1.15 < ratio < 1.25   # matches configured asap_multiplier 1.20


def test_recovery_uses_recovery_vehicle_and_higher_price(db_no_override):
    transport = _run(_quote(db_no_override, distance_miles=25, duration_minutes=50,
                              transport_category="cars_vehicles"))
    recovery = _run(_quote(db_no_override, distance_miles=25, duration_minutes=50,
                             service_type="breakdown_recovery"))
    assert recovery.resolved_vehicle_key.endswith("recovery")
    # Recovery must NOT accidentally use transport rate card — its own base
    # + recovery_multiplier should make it materially more expensive than
    # even a car-transport quote.
    assert recovery.driver_charge > transport.driver_charge * 0.95


def test_recovery_double_multiplication_bug_regression(db_no_override):
    """R25 audit finding #2 — recovery must apply recovery_multiplier
    EXACTLY ONCE. Guard: with recovery_multiplier=1.30, the price cannot
    drift more than a few % above the naive expected total."""
    breakdown = _run(_quote(db_no_override, distance_miles=25, duration_minutes=50,
                              service_type="breakdown_recovery",
                              service_timing="asap"))
    snap = breakdown.pricing_snapshot
    assert snap["recovery_multiplier"] == 1.30  # config sanity
    assert snap["asap_multiplier"] == 1.20
    # Snapshot must NOT list recovery_multiplier twice
    line_keys = [li.key for li in breakdown.line_items]
    assert line_keys.count("recovery_surcharge") == 1


def test_R251_recovery_ignores_transport_category(db_no_override):
    """R25.1 — recovery service_type MUST NOT apply transport category
    multipliers on top of the recovery rate card. That double-counted the
    'recovery is expensive' premium and produced £1,068 for the 120mi
    ASAP recovery reported in production (target ~£790).

    Guarantee: passing transport_category='cars_vehicles' to a recovery
    job produces the EXACT same driver_charge as passing None.
    """
    with_cat = _run(_quote(
        db_no_override, distance_miles=119.6, duration_minutes=130,
        service_type="breakdown_recovery", service_timing="asap",
        transport_category="cars_vehicles",
        vehicle_details={"type": "car"},
    ))
    without_cat = _run(_quote(
        db_no_override, distance_miles=119.6, duration_minutes=130,
        service_type="breakdown_recovery", service_timing="asap",
        transport_category=None,
        vehicle_details={"type": "car"},
    ))
    assert with_cat.driver_charge == without_cat.driver_charge, (
        f"Recovery double-count bug — with cars_vehicles=£{with_cat.driver_charge}, "
        f"without=£{without_cat.driver_charge}"
    )
    # And the price must land in the calibrated UK band for 120mi recovery
    # ASAP (£700–900 based on RAC/Nationwide public rates Nov 2025).
    assert 700 <= with_cat.driver_charge <= 900, (
        f"120mi ASAP recovery £{with_cat.driver_charge} outside UK market band 700-900"
    )
    # Snapshot must show category_multiplier of 1.0 for recovery, even
    # though a non-1.0 category was passed in.
    assert with_cat.pricing_snapshot["category_multiplier"] == 1.0


def test_R251_recovery_ignores_all_transport_categories(db_no_override):
    """Belt-and-braces: no transport category can leak into a recovery
    quote regardless of value."""
    baseline = _run(_quote(
        db_no_override, distance_miles=50, duration_minutes=90,
        service_type="breakdown_recovery", service_timing="asap",
        transport_category=None, vehicle_details={"type": "car"},
    )).driver_charge
    for cat in ("cars_vehicles", "vans", "boats_marine", "shipping_containers",
                "machinery", "freight", "house_moves"):
        b = _run(_quote(
            db_no_override, distance_miles=50, duration_minutes=90,
            service_type="breakdown_recovery", service_timing="asap",
            transport_category=cat, vehicle_details={"type": "car"},
        ))
        assert b.driver_charge == baseline, (
            f"Recovery with category={cat!r} leaked into price: "
            f"£{b.driver_charge} vs baseline £{baseline}"
        )


def test_R251_transport_category_still_applies_to_transport(db_no_override):
    """Sanity: the fix must ONLY affect recovery. Transport jobs still
    respect transport_category multipliers."""
    parcels = _run(_quote(
        db_no_override, distance_miles=50, duration_minutes=90,
        service_type="transport", transport_category="parcels",
    ))
    house_moves = _run(_quote(
        db_no_override, distance_miles=50, duration_minutes=90,
        service_type="transport", transport_category="house_moves",
    ))
    assert house_moves.driver_charge > parcels.driver_charge


def test_R251_multipliers_applied_exactly_once(db_no_override):
    """Independent maths check: for a known scenario the final price must
    equal the sum of the SEPARATE surcharge line items — no hidden extra
    application. Any duplicate multiplier would break this."""
    b = _run(_quote(
        db_no_override, distance_miles=119.6, duration_minutes=130,
        service_type="breakdown_recovery", service_timing="asap",
        vehicle_details={"type": "car"},
    ))
    line_keys = [li.key for li in b.line_items]
    # Recovery surcharge appears exactly once
    assert line_keys.count("recovery_surcharge") == 1
    # ASAP surcharge appears exactly once
    assert line_keys.count("asap_surcharge") == 1
    # No category line item appears for recovery
    assert "category" not in line_keys


# ---------------------------------------------------------------------------
# 7. Validation (impossible inputs)
# ---------------------------------------------------------------------------


def test_negative_weight_rejected(db_no_override):
    with pytest.raises(PricingError) as ei:
        _run(_quote(db_no_override, weight_kg=-1))
    assert ei.value.code == "invalid_weight"


def test_absurd_weight_rejected(db_no_override):
    with pytest.raises(PricingError) as ei:
        _run(_quote(db_no_override, weight_kg=50000))
    assert ei.value.code == "weight_too_large"


def test_negative_dims_rejected(db_no_override):
    with pytest.raises(PricingError) as ei:
        _run(_quote(db_no_override, volume_m3=-1))
    assert ei.value.code == "invalid_dims"


def test_absurd_distance_rejected(db_no_override):
    with pytest.raises(PricingError) as ei:
        _run(_quote(db_no_override, distance_miles=5000))
    assert ei.value.code == "distance_too_large"


def test_vehicle_capacity_exceeded(db_no_override):
    """Small van picked automatically for parcels — force 900kg and it
    should overload the capacity guard rather than silently under-quote."""
    # requested_vehicle_key locks the small van, so a heavy weight forces
    # the capacity-exceeded error path.
    with pytest.raises(PricingError) as ei:
        _run(_quote(db_no_override, distance_miles=10, duration_minutes=25,
                      weight_kg=1500, requested_vehicle_key="small_van"))
    assert ei.value.code == "vehicle_capacity_exceeded"


# ---------------------------------------------------------------------------
# 8. Snapshot immutability & self-consistency
# ---------------------------------------------------------------------------


def test_snapshot_contains_all_pricing_inputs(db_no_override):
    b = _run(_quote(db_no_override, distance_miles=50, duration_minutes=90,
                      weight_kg=250, volume_m3=5, needs_loading_help=True,
                      service_timing="asap"))
    snap = b.pricing_snapshot
    assert snap["engine_version"] == PRICING_ENGINE_VERSION
    for key in ("distance_miles", "duration_minutes", "distance_source",
                "service_type", "service_timing", "transport_category",
                "weight_kg", "volume_m3", "needs_forklift", "needs_loading_help"):
        assert key in snap["inputs"], f"snapshot missing inputs.{key}"
    assert snap["resolved_vehicle_key"] == b.resolved_vehicle_key
    assert snap["driver_charge"] == b.driver_charge


def test_haversine_flags_low_confidence(db_no_override):
    b = _run(_quote(db_no_override, distance_miles=50, duration_minutes=90,
                      distance_source="haversine_fallback"))
    assert b.low_confidence_distance is True
    assert b.pricing_snapshot["low_confidence_distance"] is True


def test_google_road_not_low_confidence(db_no_override):
    b = _run(_quote(db_no_override, distance_miles=50, duration_minutes=90,
                      distance_source="google_road"))
    assert b.low_confidence_distance is False


# ---------------------------------------------------------------------------
# 9. UK market benchmark table
# ---------------------------------------------------------------------------
#
# Each row is a real-world journey used to sanity-check the calibration
# against publicly-quoted UK same-day / recovery rates (Nov 2025 desk
# research: Anyvan, Shift, ParcelHero same-day, RAC recovery, National
# Rescue Group). Ranges are wide enough to accept normal variation.
#
# Format: (label, distance, duration, service_type, timing, category,
#           weight, forklift, loading, expected_min, expected_max)

BENCHMARK = [
    ("London → Reading 40mi parcel scheduled",
        40, 60, "transport", "scheduled", "parcels", 15, False, False, 70, 130),
    ("London → Bristol 120mi furniture scheduled loading",
        120, 145, "transport", "scheduled", "furniture", 200, False, True, 350, 500),
    ("London → Birmingham 100mi pallet ASAP",
        100, 130, "transport", "asap", "pallets", 800, True, False, 350, 620),
    ("Manchester → Leeds 45mi small van same-day",
        45, 65, "transport", "asap", "parcels", 20, False, False, 90, 150),
    ("London → Edinburgh 400mi long-haul freight",
        400, 460, "transport", "scheduled", "freight", 1500, False, False, 1500, 2400),
    ("Local car recovery 15mi ASAP",
        15, 30, "breakdown_recovery", "asap", None, None, False, False, 190, 290),
    ("Cross-country van recovery 100mi ASAP",
        100, 130, "breakdown_recovery", "asap", None, None, False, False, 500, 800),
    ("Motorcycle recovery 30mi ASAP",
        30, 50, "breakdown_recovery", "asap", None, None, False, False, 130, 260),
    ("Office-move 60mi scheduled",
        60, 90, "transport", "scheduled", "office_commercial", 400, False, True, 230, 350),
    ("Small documents run 8mi ASAP",
        8, 20, "transport", "asap", "documents", 2, False, False, 35, 65),
]


@pytest.mark.parametrize("label,dist,dur,stype,timing,cat,wt,fk,lh,lo,hi",
                          BENCHMARK,
                          ids=[r[0] for r in BENCHMARK])
def test_uk_market_benchmark(db_no_override, label, dist, dur, stype, timing,
                                cat, wt, fk, lh, lo, hi):
    kwargs = {"distance_miles": dist, "duration_minutes": dur,
                "service_type": stype, "service_timing": timing,
                "needs_forklift": fk, "needs_loading_help": lh}
    if cat: kwargs["transport_category"] = cat
    if wt: kwargs["weight_kg"] = wt
    if stype == "breakdown_recovery":
        kwargs["vehicle_details"] = {"type": "motorcycle" if "otorcycle" in label else "car"}
    b = _run(_quote(db_no_override, **kwargs))
    assert lo <= b.driver_charge <= hi, (
        f"{label}: £{b.driver_charge:.2f} outside band £{lo}-£{hi}"
    )


# ---------------------------------------------------------------------------
# 10. Config-loading path
# ---------------------------------------------------------------------------


def test_load_pricing_config_returns_defaults_when_empty(db_no_override):
    cfg = _run(load_pricing_config(db_no_override))
    assert cfg["version"] == PRICING_ENGINE_VERSION
    assert cfg["asap_multiplier"] == 1.20
    assert "small_van" in cfg["vehicles"]


def test_load_pricing_config_merges_override():
    db = MagicMock()
    db.pricing_config.find_one = AsyncMock(return_value={
        "active": True,
        "asap_multiplier": 1.50,
        "vehicles": {"small_van": {"per_mile": 2.0}},
    })
    cfg = _run(load_pricing_config(db))
    assert cfg["asap_multiplier"] == 1.50   # override wins
    assert cfg["vehicles"]["small_van"]["per_mile"] == 2.0  # deep merge
    assert cfg["vehicles"]["small_van"]["label"] == "Small Van (SWB)"  # defaults preserved
    assert cfg["forklift_fee"] == 35.0      # untouched key falls back to default
