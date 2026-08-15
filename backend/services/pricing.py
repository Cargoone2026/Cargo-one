"""Cargo One — Authoritative Pricing Engine (R25).

Single source of truth for every quote in the system. Every path that ever
produces a price MUST call `calculate_quote()` and use the returned
`PricingBreakdown` verbatim. No path may re-derive prices from partial
inputs; no path may apply "just one more" adjustment on top.

Design principles
-----------------
1.  **Server-authoritative.** The frontend is a dumb caller. All rates,
    thresholds and multipliers live in `pricing_config` (Mongo) or in
    `DEFAULT_PRICING_CONFIG` below when no override exists yet.
2.  **Routing-provider abstracted.** The engine accepts a
    `(distance_miles, duration_minutes, distance_source)` triple. Whoever
    calls the engine is responsible for calling Google Distance Matrix (or
    Mapbox tomorrow) and passing the results in. Business rules never
    depend on the map provider.
3.  **Immutable snapshot.** Every quote result includes a
    `pricing_snapshot` dict — inputs + rates + line items — that gets
    persisted onto the job and booking documents. Historical quotes NEVER
    change when admins tweak `pricing_config` for future work.
4.  **Fail loud on impossible inputs.** Negative weight, dims > 30m,
    item_count > 10000, vehicle-capacity exceeded → `PricingError`. Never
    silently invent a "typical 20 kg parcel".
5.  **Booking fee is a separate layer.** The engine returns
    `driver_charge` only. Callers apply `calculate_booking_fee_detail`
    exactly once (see server.py). Fee is never included in the engine's
    subtotal.

Formula (all values £, all distances miles)
-------------------------------------------
::

    resolved_vehicle = derive_vehicle(cargo, service_type, requested_vehicle)
    v                = pricing_config.vehicles[resolved_vehicle.key]

    base             = v.base_charge                # covers minimum overhead
    distance_charge  = distance_miles * v.per_mile
    time_charge      = duration_minutes * v.per_minute
    subtotal_route   = base + distance_charge + time_charge

    weight_add       = weight_multiplier(weight_kg) - 1.0
    dim_add          = volume_multiplier(volume_m3) - 1.0
    category_mult    = category_multipliers[transport_category] or 1.0

    operational      = (forklift_fee if needs_forklift else 0)
                     + (loading_help_fee if needs_loading_help else 0)
                     + (item_count_surcharge if items > items_included else 0)

    subtotal         = subtotal_route
                       * category_mult
                       * (1.0 + weight_add + dim_add)
                     + operational

    if service_type == "breakdown_recovery":
        subtotal    *= recovery_multiplier          # ONE place, no double-mul

    if service_timing == "asap":
        subtotal    *= asap_multiplier              # urgency surcharge

    driver_charge    = max(subtotal, v.minimum_charge)

    # Booking fee applied by calculate_booking_fee_detail() — NOT here.

Every intermediate line is captured in `PricingBreakdown.line_items` so
Admin can audit exactly why a customer saw £X.

Distance source
---------------
`distance_source` is a required field on the input and echoes back on the
snapshot. Accepted values:
  * ``google_road``          — Google Distance Matrix (authoritative)
  * ``haversine_fallback``   — straight-line, lower-confidence
  * ``mapbox_road``          — reserved for the future Mapbox migration
  * ``manual``               — admin override

If ``distance_source == "haversine_fallback"`` we tag the snapshot with
``low_confidence_distance=True`` so callers can render a warning.
"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Optional, Any

# ---------------------------------------------------------------------------
# Configuration model — sensible UK-market DEFAULTS. Admin overrides live in
# the `pricing_config` collection with the same shape; missing keys fall
# back to these values. Rates are in £ (GBP).
#
# Rates were seeded after benchmarking public UK same-day courier and vehicle
# recovery pricing pages (Nov 2025). They are STARTING calibration — admin
# should review + tune before high-volume production traffic.
# ---------------------------------------------------------------------------

PRICING_ENGINE_VERSION = "1.0.0"

DEFAULT_PRICING_CONFIG: dict = {
    "version": PRICING_ENGINE_VERSION,

    # -- Vehicle rate cards -------------------------------------------------
    # Keys map to the recommended-vehicle strings used elsewhere in the
    # codebase (see _derive_suitable_vehicle in server.py). Each vehicle
    # has: base_charge (£), per_mile (£), per_minute (£), minimum_charge
    # (£), capacity_kg (soft — used for validation), volume_m3 (soft).
    "vehicles": {
        # Transport vehicles
        "small_van":     {"label": "Small Van (SWB)",   "base_charge": 20.0, "per_mile": 1.10, "per_minute": 0.35, "minimum_charge": 35.0,  "capacity_kg": 800,   "volume_m3": 5.0},
        "medium_van":    {"label": "Medium Van (MWB)",  "base_charge": 25.0, "per_mile": 1.30, "per_minute": 0.40, "minimum_charge": 45.0,  "capacity_kg": 1000,  "volume_m3": 8.0},
        "large_van":     {"label": "Large Van (LWB)",   "base_charge": 30.0, "per_mile": 1.50, "per_minute": 0.45, "minimum_charge": 55.0,  "capacity_kg": 1200,  "volume_m3": 11.0},
        "luton_van":     {"label": "Luton / Box Van",   "base_charge": 40.0, "per_mile": 1.80, "per_minute": 0.55, "minimum_charge": 75.0,  "capacity_kg": 1200,  "volume_m3": 17.0},
        "3_5t_truck":    {"label": "3.5t Truck",        "base_charge": 55.0, "per_mile": 2.10, "per_minute": 0.65, "minimum_charge": 95.0,  "capacity_kg": 1600,  "volume_m3": 20.0},
        "7_5t_truck":    {"label": "7.5t Truck",        "base_charge": 85.0, "per_mile": 2.60, "per_minute": 0.80, "minimum_charge": 140.0, "capacity_kg": 3500,  "volume_m3": 32.0},
        "18t_hgv":       {"label": "18t HGV",           "base_charge": 120.0,"per_mile": 3.20, "per_minute": 1.00, "minimum_charge": 220.0, "capacity_kg": 12000, "volume_m3": 55.0},

        # Recovery vehicles — separate rate card. NEVER used for transport.
        "motorcycle_recovery": {"label": "Motorcycle Recovery",  "base_charge": 55.0, "per_mile": 2.20, "per_minute": 0.60, "minimum_charge": 95.0,  "capacity_kg": 400,  "volume_m3": 0, "recovery": True},
        "3_5t_recovery":       {"label": "3.5T Recovery Truck",  "base_charge": 75.0, "per_mile": 2.80, "per_minute": 0.75, "minimum_charge": 130.0, "capacity_kg": 3500, "volume_m3": 0, "recovery": True},
        "7_5t_recovery":       {"label": "7.5T Recovery Truck",  "base_charge": 110.0,"per_mile": 3.40, "per_minute": 1.00, "minimum_charge": 180.0, "capacity_kg": 7500, "volume_m3": 0, "recovery": True},
        "heavy_recovery":      {"label": "Heavy Recovery / Lowloader", "base_charge": 160.0,"per_mile": 4.20, "per_minute": 1.35, "minimum_charge": 275.0, "capacity_kg": 26000,"volume_m3": 0, "recovery": True},
    },

    # -- Cargo category multipliers -----------------------------------------
    # Applied to the route subtotal. Recovery gets its own top-level
    # multiplier below — do NOT double-count here.
    "category_multipliers": {
        "documents":            0.85,
        "parcels":              1.00,
        "package_delivery":     1.00,
        "same_day_express":     1.05,
        "furniture":            1.10,
        "furniture_delivery":   1.10,
        "single_items":         1.05,
        "pallets":              1.15,
        "freight":              1.20,
        "freight_haulage":      1.20,
        "house_moves":          1.25,
        "house_removals":       1.25,
        "office_commercial":    1.15,
        "retail_business":      1.10,
        "auction_marketplace":  1.10,
        "garden_outdoor":       1.10,
        "event_equipment":      1.15,
        "motorcycles":          1.25,
        "cars_vehicles":        1.35,
        "vans":                 1.35,
        "machinery":            1.30,
        "machinery_plant":      1.30,
        "agricultural":         1.30,
        "building_materials":   1.20,
        "boats":                1.35,
        "boats_marine":         1.35,
        "caravans":             1.30,
        "static_caravans":      1.45,
        "shipping_containers":  1.45,
        "fragile_high_value":   1.20,
        "long_distance_uk":     1.10,
        "medical_equipment":    1.20,
        "other":                1.10,
    },

    # -- Weight adjustment --------------------------------------------------
    # Additive multiplier over 1.0. Below 100 kg = 0.
    # 100–250 = +5%, 250–500 = +12%, 500–1000 = +25%, 1000–2000 = +40%,
    # 2000+ = +60% (capped). Encourages picking the right vehicle rather
    # than smuggling 1t of gear into a small van.
    "weight_bands": [
        {"max_kg": 100,  "add": 0.00},
        {"max_kg": 250,  "add": 0.05},
        {"max_kg": 500,  "add": 0.12},
        {"max_kg": 1000, "add": 0.25},
        {"max_kg": 2000, "add": 0.40},
        {"max_kg": None, "add": 0.60},
    ],

    # -- Volume/dimensions adjustment --------------------------------------
    "volume_bands": [
        {"max_m3": 3.0,  "add": 0.00},
        {"max_m3": 8.0,  "add": 0.05},
        {"max_m3": 15.0, "add": 0.15},
        {"max_m3": 25.0, "add": 0.30},
        {"max_m3": None, "add": 0.50},
    ],

    # -- Operational charges (flat £, not %) --------------------------------
    "forklift_fee":       35.0,
    "loading_help_fee":   25.0,
    "items_included":     5,
    "extra_item_fee":     2.50,   # per item over items_included, capped by max
    "max_extra_item_fee": 100.0,

    # -- Service-type multipliers ------------------------------------------
    "recovery_multiplier": 1.30,   # applied after route + adjustments,
                                    # separately from the recovery vehicle's
                                    # own rate card. Reflects specialist
                                    # equipment, on-site time and access.
    "asap_multiplier":     1.20,   # ASAP urgency surcharge, applied last.

    # -- Validation guards --------------------------------------------------
    "max_weight_kg":     30000,    # 30t hard ceiling
    "max_volume_m3":     100,      # 100m³ hard ceiling
    "max_items":         500,
    "max_distance_miles": 800,     # UK is ~650mi corner to corner; refuse absurd routes

    # -- Route sanity ------------------------------------------------------
    # If distance is null/0 we still return a minimum-charge quote so the
    # customer sees SOMETHING sensible for very-short journeys.
    "min_distance_miles": 0.5,
}


# ---------------------------------------------------------------------------
# Exceptions + result dataclasses
# ---------------------------------------------------------------------------


class PricingError(ValueError):
    """Raised when inputs cannot yield a safe quote. The message is
    customer-safe (never leaks internals) so it can be surfaced directly."""

    def __init__(self, message: str, *, code: str = "invalid_input"):
        super().__init__(message)
        self.code = code


@dataclass
class LineItem:
    key: str
    label: str
    amount: float
    detail: Optional[str] = None


@dataclass
class PricingBreakdown:
    driver_charge: float                # what the driver receives on delivery
    subtotal: float                     # driver_charge BEFORE min-charge floor
    line_items: list[LineItem]
    resolved_vehicle_key: str
    resolved_vehicle_label: str
    distance_miles: float
    duration_minutes: float
    distance_source: str
    low_confidence_distance: bool
    service_timing: str                 # "asap" | "scheduled"
    service_type: str                   # "transport" | "breakdown_recovery"
    engine_version: str = PRICING_ENGINE_VERSION
    # Everything needed to reproduce this quote later. Stored on job +
    # booking so historical calculations survive future config changes.
    pricing_snapshot: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        d = asdict(self)
        d["line_items"] = [asdict(li) for li in self.line_items]
        return d


# ---------------------------------------------------------------------------
# Config resolution — fetches admin overrides then falls back to defaults.
# ---------------------------------------------------------------------------


async def load_pricing_config(db) -> dict:
    """Return the effective pricing config. Merges the active row from
    `pricing_config` (Mongo) over `DEFAULT_PRICING_CONFIG`. Missing keys at
    any depth fall back to defaults so partial admin overrides don't
    destroy the model."""
    override = None
    try:
        override = await db.pricing_config.find_one({"active": True}, {"_id": 0})
    except Exception:  # noqa: BLE001 — Mongo hiccups fall back cleanly
        override = None
    if not override:
        return _deep_copy(DEFAULT_PRICING_CONFIG)
    return _deep_merge(_deep_copy(DEFAULT_PRICING_CONFIG), override)


def _deep_copy(d):
    if isinstance(d, dict):
        return {k: _deep_copy(v) for k, v in d.items()}
    if isinstance(d, list):
        return [_deep_copy(x) for x in d]
    return d


def _deep_merge(base: dict, override: dict) -> dict:
    for k, v in (override or {}).items():
        if k in base and isinstance(base[k], dict) and isinstance(v, dict):
            base[k] = _deep_merge(base[k], v)
        else:
            base[k] = v
    return base


# ---------------------------------------------------------------------------
# Vehicle derivation — deterministic, matches _derive_suitable_vehicle
# style in server.py. Returns a KEY (string) into config["vehicles"].
# ---------------------------------------------------------------------------


def _pick_transport_vehicle(cfg: dict, *, weight_kg: Optional[float],
                             volume_m3: Optional[float],
                             transport_category: Optional[str]) -> str:
    """Deterministic transport vehicle pick based on weight + volume
    thresholds. Callers may override by passing `requested_vehicle_key`
    into `calculate_quote`."""
    w = float(weight_kg or 0)
    v = float(volume_m3 or 0)

    # Pallets always → luton or 3.5t depending on weight.
    if transport_category in ("pallets", "freight", "freight_haulage"):
        if w > 1200:
            return "3_5t_truck"
        return "luton_van"

    # House moves → luton by default
    if transport_category in ("house_moves", "house_removals"):
        if v > 15 or w > 1000:
            return "3_5t_truck"
        return "luton_van"

    # R44 — Furniture delivery: typical 200 kg / 4 m³ per catalog. Small van
    # underquotes. Prefer luton for bulky items unless the customer entered
    # a very small load.
    if transport_category in ("furniture", "furniture_delivery"):
        if v > 15 or w > 800:
            return "3_5t_truck"
        if v > 3 or w > 150:
            return "luton_van"
        return "large_van"

    # R44 — Office / commercial moves: typical 2500 kg / 35 m³.
    if transport_category in ("office_commercial", "office_moves"):
        if v > 25 or w > 2500:
            return "7_5t_truck"
        if v > 15 or w > 1000:
            return "3_5t_truck"
        return "luton_van"

    # R44 — Building materials: typical 2000 kg / 12 m³.
    if transport_category in ("building_materials",):
        if w > 3500 or v > 25:
            return "7_5t_truck"
        return "3_5t_truck"

    # R44 — Motorcycles as CARGO (not recovery): a covered van does the job.
    if transport_category in ("motorcycles",):
        if w > 400 or v > 4:
            return "large_van"
        return "medium_van"

    # R44 — Same-day / parcels express — small load, speed matters.
    if transport_category in ("same_day_express", "documents"):
        if w > 150 or v > 2:
            return "medium_van"
        return "small_van"

    # Machinery / caravans / containers → truck
    if transport_category in ("machinery", "machinery_plant", "agricultural",
                                "shipping_containers", "static_caravans"):
        if w > 3000:
            return "7_5t_truck"
        return "3_5t_truck"

    # Cars/vans as cargo → recovery vehicles (should not usually hit
    # transport rate cards, but guard the boundary).
    if transport_category in ("cars_vehicles", "vans", "caravans", "boats", "boats_marine"):
        if w > 3500:
            return "7_5t_truck"
        return "3_5t_truck"

    # Volume + weight-driven pick (default transport). Order matters —
    # HGV band checked first so heavy loads never fall into a smaller van.
    if w > 3500 or v > 30:
        return "18t_hgv"
    if w > 1500 or v > 25:
        return "7_5t_truck"
    if w > 1200 or v > 18:
        return "3_5t_truck"
    if w > 1000 or v > 11:
        return "luton_van"
    if w > 500 or v > 8:
        return "large_van"
    if w > 250 or v > 3:
        return "medium_van"
    return "small_van"


def _pick_recovery_vehicle(cfg: dict, *, vehicle_details: Optional[dict]) -> str:
    """Recovery vehicle pick. `vehicle_details` may be a dict from the
    ASAP-recovery form containing `type` and/or `weight_class`."""
    if not vehicle_details:
        return "3_5t_recovery"
    t = str(vehicle_details.get("type") or "").lower()
    wc = str(vehicle_details.get("weight_class") or "").lower()
    if "motorcycle" in t or "bike" in t:
        return "motorcycle_recovery"
    if "hgv" in t or "hgv" in wc or "18t" in wc or "26t" in wc or "lowloader" in t:
        return "heavy_recovery"
    if "7.5" in wc or "van_large" in t or "lorry" in t or "truck" in t:
        return "7_5t_recovery"
    return "3_5t_recovery"


# ---------------------------------------------------------------------------
# Adjustment helpers
# ---------------------------------------------------------------------------


def _band_lookup(bands: list[dict], key: str, value: float) -> float:
    """Return the `add` (or `mult`) value for the FIRST band whose upper
    bound (`max_<key>`) is >= value. `max_<key>=None` means unbounded."""
    for b in bands:
        cap = b.get(f"max_{key}")
        if cap is None or value <= float(cap):
            return float(b.get("add") or b.get("mult") or 0.0)
    return 0.0


def _validate_inputs(cfg: dict, *, weight_kg, volume_m3, item_count,
                     distance_miles):
    if weight_kg is not None:
        if weight_kg < 0:
            raise PricingError("Weight cannot be negative.", code="invalid_weight")
        if weight_kg > cfg["max_weight_kg"]:
            raise PricingError(
                f"Weight above {cfg['max_weight_kg']} kg needs a bespoke freight quote. "
                "Contact support so we can arrange the right vehicle.",
                code="weight_too_large",
            )
    if volume_m3 is not None:
        if volume_m3 < 0:
            raise PricingError("Dimensions cannot be negative.", code="invalid_dims")
        if volume_m3 > cfg["max_volume_m3"]:
            raise PricingError(
                "Volume above 100 m³ needs a bespoke freight quote. Contact support.",
                code="volume_too_large",
            )
    if item_count is not None:
        if item_count < 0:
            raise PricingError("Item count cannot be negative.", code="invalid_items")
        if item_count > cfg["max_items"]:
            raise PricingError(
                f"More than {cfg['max_items']} items needs a bespoke quote. Contact support.",
                code="too_many_items",
            )
    if distance_miles is not None and distance_miles > cfg["max_distance_miles"]:
        raise PricingError(
            f"Journey over {cfg['max_distance_miles']} miles is outside our "
            "standard UK network. Contact support for a bespoke quote.",
            code="distance_too_large",
        )


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------


async def calculate_quote(
    db,
    *,
    distance_miles: float,
    duration_minutes: float,
    distance_source: str,
    service_type: str = "transport",         # "transport" | "breakdown_recovery"
    service_timing: str = "scheduled",       # "scheduled" | "asap"
    transport_category: Optional[str] = None,
    weight_kg: Optional[float] = None,
    volume_m3: Optional[float] = None,
    item_count: Optional[int] = None,
    needs_forklift: bool = False,
    needs_loading_help: bool = False,
    vehicle_details: Optional[dict] = None,   # recovery-form payload
    requested_vehicle_key: Optional[str] = None,  # admin override
    config: Optional[dict] = None,            # dependency-inject for tests
) -> PricingBreakdown:
    """Compute the authoritative driver_charge + breakdown.

    Returns a `PricingBreakdown` — the frontend + booking creation must use
    the fields returned here VERBATIM. Callers apply the booking-fee band
    on top via `calculate_booking_fee_detail(breakdown.driver_charge)`.
    """
    cfg = config or await load_pricing_config(db)

    # ---- 1. Validate inputs --------------------------------------------
    _validate_inputs(cfg,
                       weight_kg=weight_kg, volume_m3=volume_m3,
                       item_count=item_count, distance_miles=distance_miles)

    # Guard-rail: distance floor
    d = max(float(distance_miles or 0), float(cfg["min_distance_miles"]))
    t = max(float(duration_minutes or 0), 0.0)

    # ---- 2. Vehicle resolution ------------------------------------------
    if requested_vehicle_key and requested_vehicle_key in cfg["vehicles"]:
        vehicle_key = requested_vehicle_key
    elif service_type == "breakdown_recovery":
        vehicle_key = _pick_recovery_vehicle(cfg, vehicle_details=vehicle_details)
    else:
        vehicle_key = _pick_transport_vehicle(
            cfg,
            weight_kg=weight_kg, volume_m3=volume_m3,
            transport_category=transport_category,
        )

    v = cfg["vehicles"][vehicle_key]

    # Capacity sanity — reject overload against the picked vehicle.
    cap_kg = float(v.get("capacity_kg") or 0)
    if cap_kg and weight_kg and weight_kg > cap_kg * 1.15:  # 15% tolerance
        raise PricingError(
            f"Load ({weight_kg:.0f} kg) exceeds the {v['label']} capacity. "
            "Please provide accurate weight or contact support for a bespoke quote.",
            code="vehicle_capacity_exceeded",
        )

    # ---- 3. Route subtotal ---------------------------------------------
    base = float(v["base_charge"])
    distance_charge = round(d * float(v["per_mile"]), 4)
    time_charge = round(t * float(v["per_minute"]), 4)
    subtotal_route = base + distance_charge + time_charge

    # ---- 4. Category / weight / volume adjustments ---------------------
    # R25.1 — Recovery has its OWN specialist rate card + `recovery_multiplier`.
    # Applying a transport category multiplier (e.g. cars_vehicles=1.35) on
    # top double-counts the "vehicle recovery is expensive" premium and
    # produces the £1,068 for a 120mi recovery bug reported in production.
    # For recovery service_type we deliberately ignore `transport_category`
    # — a category mult only makes sense for transport work.
    if service_type == "breakdown_recovery":
        category_mult = 1.0
    else:
        category_mult = float(
            cfg["category_multipliers"].get(transport_category or "", 1.0)
        )
    weight_add = _band_lookup(cfg["weight_bands"], "kg", float(weight_kg or 0))
    volume_add = _band_lookup(cfg["volume_bands"], "m3", float(volume_m3 or 0))
    adjustment = subtotal_route * category_mult * (1.0 + weight_add + volume_add)

    # ---- 5. Operational surcharges (flat £) ----------------------------
    forklift_amt = float(cfg["forklift_fee"]) if needs_forklift else 0.0
    loading_amt = float(cfg["loading_help_fee"]) if needs_loading_help else 0.0
    items_included = int(cfg.get("items_included") or 0)
    extra_items = max(0, int(item_count or 0) - items_included)
    extra_item_amt = min(
        float(cfg.get("max_extra_item_fee") or 0),
        extra_items * float(cfg.get("extra_item_fee") or 0),
    )
    operational = forklift_amt + loading_amt + extra_item_amt

    subtotal = adjustment + operational

    # ---- 6. Service-type + urgency multipliers -------------------------
    recovery_mult_applied = None
    if service_type == "breakdown_recovery":
        recovery_mult_applied = float(cfg["recovery_multiplier"])
        subtotal *= recovery_mult_applied

    asap_mult_applied = None
    if service_timing == "asap":
        asap_mult_applied = float(cfg["asap_multiplier"])
        subtotal *= asap_mult_applied

    # ---- 7. Minimum-charge floor ---------------------------------------
    driver_charge = max(round(subtotal, 2), float(v["minimum_charge"]))
    driver_charge = round(driver_charge, 2)

    # ---- 8. Build line-item breakdown ----------------------------------
    line_items: list[LineItem] = [
        LineItem("vehicle_base", f"{v['label']} base charge", round(base, 2)),
        LineItem("distance", f"Distance ({d:.1f} mi × £{v['per_mile']:.2f})",
                  round(distance_charge, 2),
                  detail=f"source={distance_source}"),
        LineItem("time", f"Driver time ({t:.0f} min × £{v['per_minute']:.2f})",
                  round(time_charge, 2)),
    ]
    if category_mult != 1.0 and transport_category:
        line_items.append(LineItem(
            "category", f"Category multiplier — {transport_category}",
            round(subtotal_route * (category_mult - 1.0), 2),
            detail=f"×{category_mult:.2f}",
        ))
    if weight_add > 0:
        line_items.append(LineItem(
            "weight", f"Heavy-load adjustment ({weight_kg or 0:.0f} kg)",
            round(subtotal_route * category_mult * weight_add, 2),
            detail=f"+{weight_add*100:.0f}%",
        ))
    if volume_add > 0:
        line_items.append(LineItem(
            "volume", f"Large-volume adjustment ({volume_m3 or 0:.1f} m³)",
            round(subtotal_route * category_mult * volume_add, 2),
            detail=f"+{volume_add*100:.0f}%",
        ))
    if forklift_amt:
        line_items.append(LineItem("forklift", "Forklift required", forklift_amt))
    if loading_amt:
        line_items.append(LineItem("loading_help", "Loading assistance", loading_amt))
    if extra_item_amt:
        line_items.append(LineItem(
            "extra_items", f"Extra items ({extra_items} × £{cfg['extra_item_fee']:.2f})",
            round(extra_item_amt, 2),
        ))
    if recovery_mult_applied:
        line_items.append(LineItem(
            "recovery_surcharge", "Vehicle recovery surcharge",
            round((subtotal / recovery_mult_applied) * (recovery_mult_applied - 1.0), 2)
              if recovery_mult_applied != 1.0 else 0.0,
            detail=f"×{recovery_mult_applied:.2f}",
        ))
    if asap_mult_applied:
        # Recompute the ASAP delta cleanly rather than re-derive.
        pre_asap = subtotal / asap_mult_applied
        line_items.append(LineItem(
            "asap_surcharge", "ASAP urgency surcharge",
            round(pre_asap * (asap_mult_applied - 1.0), 2),
            detail=f"×{asap_mult_applied:.2f}",
        ))
    if driver_charge > round(subtotal, 2):
        line_items.append(LineItem(
            "minimum_charge_uplift",
            f"Minimum charge for {v['label']}",
            round(driver_charge - subtotal, 2),
        ))

    # ---- 9. Immutable snapshot for the booking record ------------------
    snapshot = {
        "engine_version": PRICING_ENGINE_VERSION,
        "inputs": {
            "distance_miles": round(d, 2),
            "duration_minutes": round(t, 1),
            "distance_source": distance_source,
            "service_type": service_type,
            "service_timing": service_timing,
            "transport_category": transport_category,
            "weight_kg": weight_kg,
            "volume_m3": volume_m3,
            "item_count": item_count,
            "needs_forklift": bool(needs_forklift),
            "needs_loading_help": bool(needs_loading_help),
            "requested_vehicle_key": requested_vehicle_key,
        },
        "resolved_vehicle_key": vehicle_key,
        "vehicle_rate_card": v,
        "category_multiplier": category_mult,
        "weight_add": weight_add,
        "volume_add": volume_add,
        "operational_flat_fees": {
            "forklift": forklift_amt,
            "loading_help": loading_amt,
            "extra_items": round(extra_item_amt, 2),
        },
        "recovery_multiplier": recovery_mult_applied,
        "asap_multiplier": asap_mult_applied,
        "subtotal_before_min": round(subtotal, 2),
        "minimum_charge": float(v["minimum_charge"]),
        "driver_charge": driver_charge,
        "low_confidence_distance": distance_source == "haversine_fallback",
        "config_snapshot_at_time": {
            "recovery_multiplier": cfg["recovery_multiplier"],
            "asap_multiplier": cfg["asap_multiplier"],
            "forklift_fee": cfg["forklift_fee"],
            "loading_help_fee": cfg["loading_help_fee"],
        },
    }

    return PricingBreakdown(
        driver_charge=driver_charge,
        subtotal=round(subtotal, 2),
        line_items=line_items,
        resolved_vehicle_key=vehicle_key,
        resolved_vehicle_label=v["label"],
        distance_miles=round(d, 2),
        duration_minutes=round(t, 1),
        distance_source=distance_source,
        low_confidence_distance=(distance_source == "haversine_fallback"),
        service_timing=service_timing,
        service_type=service_type,
        pricing_snapshot=snapshot,
    )
