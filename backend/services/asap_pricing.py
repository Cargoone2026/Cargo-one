"""Cargo One — ASAP Pricing Engine V1 (R26).

SCOPE: ASAP Transport + ASAP Recovery ONLY. Scheduled Fixed and Bidding
continue to use `services/pricing.py` — NEVER touched by this module.

Design principles
-----------------
1.  Layered calculation with explicit separation of concerns:
        DRIVER CHARGE  (this engine)
        BOOKING FEE    (existing calculate_booking_fee_detail — SAME source of truth)
        CUSTOMER TOTAL (driver_charge + booking_fee)
    Never merge these layers.
2.  Every rate is admin-editable via the `asap_pricing_config` collection.
    Defaults ship in ASAP_DEFAULT_CONFIG below and act as calibration only.
3.  Recovery has its OWN rate card + formula. Transport category multipliers
    NEVER leak into recovery (R25.1 regression guard baked in).
4.  Progressive mileage — not distance × single rate.
5.  Multiplier stacking is capped at +50% by default; heavy/specialist jobs
    may have a separate ceiling.
6.  Every quote returns a `pricing_snapshot` with every input, every layer
    of the calculation, and `pricing_engine_version="ASAP-V1.0"`. Persist
    it on job + booking; NEVER mutate after write.

Formula
-------
::

    driver_charge = round_to_band(
        max(
            v.minimum_charge,
            mileage_charge (progressive)
              + waiting + extra_stops + loading + specialist
              + tolls + ferry + overnight
              + dead_mileage_recovery
        )
        * (1 + asap_uplift + urgency_uplift + night_uplift + weekend_uplift + bh_uplift
            + supply_uplift + regional_uplift, capped at 1 + uplift_ceiling)
    )

    booking_fee    = calculate_booking_fee_detail(driver_charge)          # 10-15% band
    customer_total = driver_charge + booking_fee
"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Optional
from zoneinfo import ZoneInfo

ASAP_ENGINE_VERSION = "ASAP-V1.0"
UK_TZ = ZoneInfo("Europe/London")


# ---------------------------------------------------------------------------
# Default configuration — V1 calibration. Admin overrides in Mongo win.
# ---------------------------------------------------------------------------

ASAP_DEFAULT_CONFIG: dict = {
    "version": ASAP_ENGINE_VERSION,

    # ---- Transport vehicle rate cards (20 classes per spec §6) --------
    # Each row: minimum_charge (£), base_per_mile (£), radius km triple
    # (nearby / medium / wide), progressive_mileage key.
    "transport_vehicles": {
        "car":                   {"label": "Car",                     "minimum_charge": 35,  "per_mile": 1.00, "radii_mi": [5, 10, 20], "mileage_curve": "goods"},
        "small_van":             {"label": "Small Van",               "minimum_charge": 45,  "per_mile": 1.20, "radii_mi": [5, 10, 20], "mileage_curve": "goods"},
        "lwb_van":               {"label": "LWB Van",                 "minimum_charge": 70,  "per_mile": 1.50, "radii_mi": [10, 20, 30], "mileage_curve": "goods"},
        "elwb_van":              {"label": "ELWB Van",                "minimum_charge": 80,  "per_mile": 1.60, "radii_mi": [10, 20, 30], "mileage_curve": "goods"},
        "pickup":                {"label": "Pickup",                  "minimum_charge": 55,  "per_mile": 1.30, "radii_mi": [10, 20, 30], "mileage_curve": "goods"},
        "luton":                 {"label": "Luton",                   "minimum_charge": 100, "per_mile": 1.85, "radii_mi": [20, 40, 60], "mileage_curve": "goods"},
        "luton_tail_lift":       {"label": "Luton Tail Lift",         "minimum_charge": 110, "per_mile": 2.00, "radii_mi": [20, 40, 60], "mileage_curve": "goods"},
        "3_5t_rigid":            {"label": "3.5T Rigid",              "minimum_charge": 100, "per_mile": 1.75, "radii_mi": [20, 40, 60], "mileage_curve": "goods"},
        "3_5t_rigid_tail_lift":  {"label": "3.5T Rigid Tail Lift",    "minimum_charge": 115, "per_mile": 1.95, "radii_mi": [20, 40, 60], "mileage_curve": "goods"},
        "5t_rigid":              {"label": "5T Rigid",                "minimum_charge": 140, "per_mile": 2.10, "radii_mi": [20, 40, 60], "mileage_curve": "goods"},
        "7_5t_rigid":            {"label": "7.5T Rigid",              "minimum_charge": 175, "per_mile": 2.90, "radii_mi": [20, 40, 60], "mileage_curve": "goods"},
        "7_5t_rigid_tail_lift":  {"label": "7.5T Rigid Tail Lift",    "minimum_charge": 195, "per_mile": 3.15, "radii_mi": [20, 40, 60], "mileage_curve": "goods"},
        "10_18t_rigid":          {"label": "10–18T Rigid",            "minimum_charge": 250, "per_mile": 3.50, "radii_mi": [30, 50, 100], "mileage_curve": "heavy"},
        "26t_rigid":             {"label": "26T Rigid",               "minimum_charge": 300, "per_mile": 3.90, "radii_mi": [50, 100, 150], "mileage_curve": "heavy"},
        "32t_rigid":             {"label": "32T Rigid",               "minimum_charge": 325, "per_mile": 4.10, "radii_mi": [50, 100, 150], "mileage_curve": "heavy"},
        "multi_axle_rigid":      {"label": "Other Multi-Axle Rigid",  "minimum_charge": 400, "per_mile": 4.50, "radii_mi": [50, 100, 150], "mileage_curve": "heavy"},
        "tractor_unit":          {"label": "Tractor Unit",            "minimum_charge": 300, "per_mile": 3.50, "radii_mi": [50, 100, 150], "mileage_curve": "heavy"},
        "semi_trailer":          {"label": "Semi-Trailer",            "minimum_charge": 300, "per_mile": 3.75, "radii_mi": [50, 100, 150], "mileage_curve": "heavy"},
        "articulated_hgv":       {"label": "Articulated HGV",         "minimum_charge": 400, "per_mile": 4.85, "radii_mi": [50, 100, 150], "mileage_curve": "heavy"},
        "heavy_haul_combo":      {"label": "Heavy-Haul Combination",  "minimum_charge": 500, "per_mile": 5.50, "radii_mi": [50, 100, 200], "mileage_curve": "heavy", "manual_review": True},
    },

    # ---- Recovery vehicle rate cards (12 classes per spec §7) ---------
    "recovery_vehicles": {
        "light_recovery_van":         {"label": "Light Recovery Van",              "minimum_charge": 85,  "per_mile": 1.75, "radii_mi": [10, 25, 50], "mileage_curve": "goods"},
        "pickup_recovery":            {"label": "Pickup Recovery",                 "minimum_charge": 90,  "per_mile": 1.85, "radii_mi": [10, 25, 50], "mileage_curve": "goods"},
        "3_5t_recovery":              {"label": "3.5T Recovery",                   "minimum_charge": 110, "per_mile": 2.00, "radii_mi": [20, 40, 60], "mileage_curve": "goods"},
        "5_7_5t_recovery":            {"label": "5–7.5T Recovery",                 "minimum_charge": 150, "per_mile": 2.50, "radii_mi": [20, 40, 60], "mileage_curve": "goods"},
        "10_18t_recovery":            {"label": "10–18T Recovery",                 "minimum_charge": 250, "per_mile": 3.25, "radii_mi": [30, 50, 100], "mileage_curve": "heavy"},
        "26t_recovery":               {"label": "26T Recovery",                    "minimum_charge": 300, "per_mile": 3.75, "radii_mi": [50, 100, 150], "mileage_curve": "heavy"},
        "32t_recovery":               {"label": "32T Recovery",                    "minimum_charge": 350, "per_mile": 4.00, "radii_mi": [50, 100, 150], "mileage_curve": "heavy"},
        "heavy_recovery":             {"label": "Heavy Recovery",                  "minimum_charge": 400, "per_mile": 4.50, "radii_mi": [50, 100, 200], "mileage_curve": "heavy"},
        "heavy_6x4_8x4_recovery":     {"label": "Heavy 6×4 / 8×4 Recovery",        "minimum_charge": 450, "per_mile": 5.00, "radii_mi": [50, 100, 200], "mileage_curve": "heavy"},
        "heavy_tractor_recovery":     {"label": "Heavy Tractor Recovery",          "minimum_charge": 500, "per_mile": 5.25, "radii_mi": [50, 100, 200], "mileage_curve": "heavy"},
        "heavy_articulated_recovery": {"label": "Heavy Articulated Recovery",      "minimum_charge": 550, "per_mile": 5.50, "radii_mi": [50, 100, 200], "mileage_curve": "heavy"},
        "stgo_heavy_recovery":        {"label": "STGO Heavy Recovery Combination", "minimum_charge": 750, "per_mile": 6.50, "radii_mi": [50, 100, 200], "mileage_curve": "heavy", "manual_review": True},
    },

    # ---- Progressive mileage curves (spec §8, §9) ---------------------
    # Each entry: (upper_mile_bound_or_None, factor).
    "mileage_curves": {
        "goods": [(50, 1.00), (100, 0.94), (200, 0.88), (300, 0.82), (500, 0.76), (None, 0.72)],
        "heavy": [(100, 1.00), (250, 0.95), (500, 0.90), (None, 0.85)],
    },

    # ---- ASAP premium levels (spec §10) --------------------------------
    "urgency_levels": {
        "same_day":  0.05,
        "asap":      0.15,      # normal Cargo One ASAP — the default
        "immediate": 0.20,
        "emergency": 0.25,
    },
    "default_urgency": "asap",

    # ---- Collection window uplifts (spec §11) --------------------------
    # Applied on top of urgency (still additive under the cap).
    "collection_window_uplifts": [
        {"max_minutes": 15,   "uplift": 0.20},
        {"max_minutes": 30,   "uplift": 0.15},
        {"max_minutes": 60,   "uplift": 0.12},
        {"max_minutes": 120,  "uplift": 0.08},
        {"max_minutes": 180,  "uplift": 0.05},
        {"max_minutes": None, "uplift": 0.00},
    ],

    # ---- Night uplift (spec §12) — UK local time -----------------------
    "night_uplifts": [
        {"start": 20, "end": 23, "uplift": 0.08},
        {"start": 23, "end": 26, "uplift": 0.15},   # 26h means 02:00 next day
        {"start": 26, "end": 30, "uplift": 0.20},   # 02:00 → 06:00
    ],

    # ---- Weekend (spec §13) --------------------------------------------
    "saturday_uplift": 0.08,
    "sunday_uplift":   0.15,

    # ---- UK bank holidays (spec §14) -----------------------------------
    # ISO date → multiplier uplift. Admin can override / extend.
    "bank_holiday_uplifts": {
        "default":     0.15,
        "christmas_eve":   0.20,
        "christmas_day":   0.50,
        "boxing_day":      0.35,
        "new_years_eve":   0.20,
        "new_years_day":   0.40,
    },
    # Known dates for 2026 (England+Wales). Admins can extend.
    "bank_holiday_calendar": {
        "2026-01-01": "new_years_day",
        "2026-04-03": "default",     # Good Friday
        "2026-04-06": "default",     # Easter Monday
        "2026-05-04": "default",     # Early May
        "2026-05-25": "default",     # Spring Bank Hol
        "2026-08-31": "default",     # Summer Bank Hol
        "2026-12-24": "christmas_eve",
        "2026-12-25": "christmas_day",
        "2026-12-26": "boxing_day",
        "2026-12-31": "new_years_eve",
    },

    # ---- Supply uplift (spec §16) --------------------------------------
    "supply_uplifts": [
        {"min": 10,  "uplift": -0.05},
        {"min": 6,   "uplift": -0.02},
        {"min": 4,   "uplift":  0.00},
        {"min": 3,   "uplift":  0.05},
        {"min": 2,   "uplift":  0.10},
        {"min": 1,   "uplift":  0.20},
        {"min": 0,   "uplift":  0.30},
    ],

    # ---- Dead mileage — recovery (spec §19) ----------------------------
    # Percentage uplift on driver_charge_base (route + extras), keyed by
    # nearest_driver_distance_mi.
    "dead_mileage_bands_recovery": [
        {"max_mi": 10,   "uplift": 0.00},
        {"max_mi": 20,   "uplift": 0.25},
        {"max_mi": 30,   "uplift": 0.40},
        {"max_mi": 50,   "uplift": 0.60},
        {"max_mi": None, "uplift": 0.75},
    ],

    # ---- Dead mileage — transport (R26.1) ------------------------------
    # Lighter than recovery — transport ASAP dispatch is typically shorter
    # runs so repositioning bites harder on driver economics but must not
    # blow through the +50% normal ceiling on its own. Values below leave
    # sufficient headroom for ASAP+urgency to stack under the cap.
    "dead_mileage_bands_transport": [
        {"max_mi": 10,   "uplift": 0.00},
        {"max_mi": 20,   "uplift": 0.10},
        {"max_mi": 30,   "uplift": 0.20},
        {"max_mi": 50,   "uplift": 0.30},
        {"max_mi": None, "uplift": 0.40},
    ],

    # ---- Extras (flat £) -----------------------------------------------
    # Waiting per 30-minute block after 15 min free (spec §20).
    "waiting_per_30min_by_class": {
        "car":                   10,
        "small_van":             15,
        "lwb_van":               18,
        "elwb_van":              18,
        "pickup":                15,
        "luton":                 18,
        "luton_tail_lift":       18,
        "3_5t_rigid":            18,
        "3_5t_rigid_tail_lift":  18,
        "5t_rigid":              20,
        "7_5t_rigid":            20,
        "7_5t_rigid_tail_lift":  20,
        "10_18t_rigid":          30,
        "26t_rigid":             40,
        "32t_rigid":             40,
        "multi_axle_rigid":      40,
        "tractor_unit":          30,
        "semi_trailer":          30,
        "articulated_hgv":       40,
        "heavy_haul_combo":      50,
    },
    "free_waiting_minutes": 15,   # each end
    "extra_stop_fees":     [15, 12, 10, 10, 10],  # first, second, third+
    "loading_help_by_class": {
        "car": 20, "small_van": 20,
        "lwb_van": 28, "elwb_van": 28, "pickup": 20,
        "luton": 30, "luton_tail_lift": 30, "3_5t_rigid": 30, "3_5t_rigid_tail_lift": 30,
        "5t_rigid": 37, "7_5t_rigid": 37, "7_5t_rigid_tail_lift": 37,
        "10_18t_rigid": 50, "26t_rigid": 60, "32t_rigid": 60, "multi_axle_rigid": 60,
        "tractor_unit": 50, "semi_trailer": 50, "articulated_hgv": 60, "heavy_haul_combo": 80,
    },

    # ---- Cap on multiplier stacking (spec §15) -------------------------
    "uplift_ceiling":       0.50,   # +50%
    "uplift_ceiling_heavy": 0.80,   # heavy/specialist can go higher

    # ---- Regional multipliers (spec §26) -------------------------------
    "regional_multipliers": {
        "GB": 1.00, "IE": 1.15, "NI": 1.10,
        "FR": 1.15, "BE": 1.15, "NL": 1.15,
        "DE": 1.20, "ES": 1.30, "PT": 1.30, "IT": 1.30,
    },

    # ---- Vehicle auto-pick thresholds (transport) ---------------------
    # Deterministic pick when the customer hasn't chosen a class.
    "transport_auto_pick_tiers": [
        # weight_max_kg, volume_max_m3, pallets_max, vehicle_key
        [50,   1,   0, "car"],
        [500,  4,   1, "small_van"],
        [1000, 8,   2, "lwb_van"],
        [1200, 11,  3, "elwb_van"],
        [1400, 17,  6, "luton"],
        [1600, 20,  8, "3_5t_rigid"],
        [3000, 30,  14, "7_5t_rigid"],
        [10000, 55, 26, "10_18t_rigid"],
        [26000, 90, 33, "26t_rigid"],
        [999999, 999, 999, "articulated_hgv"],
    ],

    # ---- Size ranking for customer-picked vehicles (R26.2) -------------
    # Larger rank = larger vehicle. Used by _pick_transport_vehicle to
    # detect when a customer picks a class too small for their load, and
    # by the recommendation banner. Tail-lift variants share the rank of
    # their base class — they're the same size, just with a tail lift.
    "transport_vehicle_size_ranks": {
        "car":                    0,
        "small_van":              1,
        "pickup":                 1,
        "lwb_van":                2,
        "elwb_van":               3,
        "luton":                  4,
        "luton_tail_lift":        4,
        "3_5t_rigid":             5,
        "3_5t_rigid_tail_lift":   5,
        "5t_rigid":               5,
        "7_5t_rigid":             6,
        "7_5t_rigid_tail_lift":   6,
        "10_18t_rigid":           7,
        "26t_rigid":              8,
        "32t_rigid":              9,
        "multi_axle_rigid":       9,
        "tractor_unit":           9,
        "semi_trailer":           9,
        "articulated_hgv":        10,
        "heavy_haul_combo":       10,
    },

    # ---- Validation guards ---------------------------------------------
    "max_weight_kg": 40000,
    "max_volume_m3": 100,
    "max_items":     500,
    "max_distance_miles": 1500,
}


class AsapPricingError(ValueError):
    def __init__(self, message: str, *, code: str = "invalid_input"):
        super().__init__(message)
        self.code = code


@dataclass
class AsapLineItem:
    key: str
    label: str
    amount: float
    detail: Optional[str] = None


@dataclass
class AsapBreakdown:
    driver_charge: float
    booking_fee_percent: float
    booking_fee: float
    customer_total: float
    resolved_vehicle_key: str
    resolved_vehicle_label: str
    line_items: list[AsapLineItem]
    pricing_snapshot: dict
    engine_version: str = ASAP_ENGINE_VERSION
    manual_review: bool = False
    manual_review_reason: Optional[str] = None

    def to_dict(self) -> dict:
        d = asdict(self)
        d["line_items"] = [asdict(li) for li in self.line_items]
        return d


# ---------------------------------------------------------------------------
# Config resolution
# ---------------------------------------------------------------------------


async def load_asap_config(db) -> dict:
    override = None
    try:
        override = await db.asap_pricing_config.find_one({"active": True}, {"_id": 0})
    except Exception:
        override = None
    if not override:
        return _deep_copy(ASAP_DEFAULT_CONFIG)
    return _deep_merge(_deep_copy(ASAP_DEFAULT_CONFIG), override)


def _deep_copy(d):
    if isinstance(d, dict): return {k: _deep_copy(v) for k, v in d.items()}
    if isinstance(d, list): return [_deep_copy(x) for x in d]
    return d


def _deep_merge(a: dict, b: dict) -> dict:
    for k, v in (b or {}).items():
        if k in a and isinstance(a[k], dict) and isinstance(v, dict):
            a[k] = _deep_merge(a[k], v)
        else:
            a[k] = v
    return a


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _progressive_mileage(distance: float, per_mile: float, curve: list) -> float:
    """Apply progressive mileage curve. curve = [(upper, factor), ...]."""
    if distance <= 0: return 0.0
    remaining = distance
    prev = 0.0
    total = 0.0
    for upper, factor in curve:
        cap = float('inf') if upper is None else float(upper)
        band = min(cap, prev + remaining) - prev
        if band <= 0: break
        seg = min(band, remaining)
        total += seg * per_mile * factor
        remaining -= seg
        prev = cap
        if remaining <= 0: break
    return round(total, 2)


def _time_uplifts(cfg: dict, when_iso: Optional[str]) -> tuple[float, float, str]:
    """Return (night_uplift, weekend_uplift, bank_holiday_label). All uplifts additive."""
    if not when_iso:
        dt = datetime.now(UK_TZ)
    else:
        try:
            dt = datetime.fromisoformat(when_iso.replace("Z", "+00:00")).astimezone(UK_TZ)
        except Exception:
            dt = datetime.now(UK_TZ)
    hour_frac = dt.hour + dt.minute / 60.0
    if hour_frac < 6:
        hour_bucket = hour_frac + 24
    else:
        hour_bucket = hour_frac
    night = 0.0
    for band in cfg["night_uplifts"]:
        if band["start"] <= hour_bucket < band["end"]:
            night = band["uplift"]; break
    dow = dt.weekday()   # 0=Mon
    weekend = 0.0
    if dow == 5: weekend = cfg["saturday_uplift"]
    elif dow == 6: weekend = cfg["sunday_uplift"]
    iso = dt.strftime("%Y-%m-%d")
    bh_key = cfg["bank_holiday_calendar"].get(iso)
    bh = cfg["bank_holiday_uplifts"].get(bh_key, 0.0) if bh_key else 0.0
    return round(night, 4), round(weekend, 4), (bh_key or ""), bh


def _band_lookup(bands: list, value: float, key: str, out: str) -> float:
    for b in bands:
        cap = b.get(f"max_{key}") or b.get("max")
        if cap is None or value <= float(cap):
            return float(b.get(out) or 0)
    return 0.0


def _supply_uplift(cfg: dict, driver_count: int) -> float:
    for row in cfg["supply_uplifts"]:
        if driver_count >= row["min"]:
            return float(row["uplift"])
    return 0.0


def _urgency_uplift(cfg: dict, urgency_key: Optional[str]) -> float:
    return float(cfg["urgency_levels"].get(urgency_key or cfg["default_urgency"], 0.15))


def _collection_window_uplift(cfg: dict, minutes: Optional[int]) -> float:
    if minutes is None: return 0.0
    for row in cfg["collection_window_uplifts"]:
        if row["max_minutes"] is None or minutes <= row["max_minutes"]:
            return float(row["uplift"])
    return 0.0


def _pick_transport_vehicle(cfg: dict, *, weight_kg, volume_m3, pallets, requested):
    """Return the vehicle_key to price against.

    Auto-pick behaviour (no `requested`): scan `transport_auto_pick_tiers`
    for the smallest tier that can carry the load.

    Customer-picked (with `requested`): honour the request unless it is
    strictly SMALLER than the auto-picked minimum for the same load. In
    that case raise AsapPricingError so the customer sees an explicit
    "too small — try X" message instead of a silent upgrade or an
    over-charge for an unsafe pick.
    """
    w = float(weight_kg or 0); v = float(volume_m3 or 0); p = int(pallets or 0)
    auto_key = "articulated_hgv"
    for row in cfg["transport_auto_pick_tiers"]:
        max_w, max_v, max_p, key = row
        if w <= max_w and v <= max_v and p <= max_p:
            auto_key = key
            break
    if requested and requested in cfg["transport_vehicles"]:
        ranks = cfg.get("transport_vehicle_size_ranks", {})
        if ranks.get(requested, 0) < ranks.get(auto_key, 0):
            req_label = cfg["transport_vehicles"][requested]["label"]
            auto_label = cfg["transport_vehicles"][auto_key]["label"]
            raise AsapPricingError(
                f"{req_label} is too small for your load "
                f"({w:.0f} kg · {v:.1f} m³ · {p} pallets). "
                f"We recommend at least {auto_label}. "
                f"Please pick that vehicle or a larger one.",
                code="vehicle_too_small",
            )
        return requested
    return auto_key


def _pick_recovery_vehicle(cfg: dict, *, requested, vehicle_class, weight_kg):
    if requested and requested in cfg["recovery_vehicles"]:
        return requested
    vc = (vehicle_class or "").lower()
    if "motorcycle" in vc or "bike" in vc:
        return "light_recovery_van"
    if any(t in vc for t in ("hgv", "artic", "18t", "26t", "32t", "lowloader", "lorry")):
        return "heavy_recovery"
    if any(t in vc for t in ("7.5", "7_5", "truck")):
        return "5_7_5t_recovery"
    return "3_5t_recovery"


def _round_display(amount: float) -> float:
    if amount < 50:  return round(amount)
    if amount < 500: return round(amount / 5) * 5
    return round(amount / 25) * 25


async def _count_available_drivers(db, *, vehicle_key: str, pickup_lat: float,
                                    pickup_lng: float, radius_mi: float) -> int:
    """Live count of eligible drivers with the matching vehicle within radius.
    Uses simple bounding-box on last_lat/lng — fast, index-friendly. A future
    round can replace with a proper geo-index."""
    try:
        # 1° lat ≈ 69mi. Bounding box keeps the query cheap.
        deg = radius_mi / 69.0
        q = {
            "role": "driver",
            "status": "active",
            "verified_driver": True,
            "asap_available": True,
            "last_lat": {"$gte": pickup_lat - deg, "$lte": pickup_lat + deg},
            "last_lng": {"$gte": pickup_lng - deg, "$lte": pickup_lng + deg},
            "vehicle_types": vehicle_key,   # array field on driver docs
        }
        return await db.users.count_documents(q)
    except Exception:
        return 0


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------


async def calculate_asap_quote(
    db,
    *,
    # Route
    distance_miles: float,
    duration_minutes: float,
    distance_source: str,
    pickup_lat: Optional[float] = None,
    pickup_lng: Optional[float] = None,
    # Service classification
    service_type: str = "transport",            # transport | breakdown_recovery
    urgency: Optional[str] = None,              # same_day | asap | immediate | emergency
    collection_within_minutes: Optional[int] = None,
    when_iso: Optional[str] = None,             # ISO datetime; defaults to now
    # Vehicle
    requested_vehicle_key: Optional[str] = None,
    vehicle_class: Optional[str] = None,        # e.g. 'motorcycle' for recovery
    # Cargo / recovery
    weight_kg: Optional[float] = None,
    volume_m3: Optional[float] = None,
    pallets: Optional[int] = None,
    item_count: Optional[int] = None,
    # Operational extras
    waiting_minutes: Optional[int] = None,
    extra_stops: Optional[int] = None,
    loading_help: bool = False,
    tail_lift_needed: bool = False,             # only influences pick, not price
    # Recovery-only
    nearest_driver_distance_mi: Optional[float] = None,
    # Regional
    pickup_country_code: Optional[str] = None,
    # Injected
    config: Optional[dict] = None,
    calculate_booking_fee_detail=None,
) -> AsapBreakdown:
    """Compute the authoritative ASAP driver_charge + full customer breakdown.

    booking-fee application uses the injected `calculate_booking_fee_detail`
    (server.py) so we never duplicate the fee-band logic here.
    """
    cfg = config or await load_asap_config(db)

    # ---------- 1. Validate inputs -------------------------------------
    if distance_miles is not None and distance_miles > cfg["max_distance_miles"]:
        raise AsapPricingError(
            f"Journey over {cfg['max_distance_miles']} miles requires a bespoke quote.",
            code="distance_too_large")
    if weight_kg is not None and (weight_kg < 0 or weight_kg > cfg["max_weight_kg"]):
        raise AsapPricingError("Invalid weight.", code="invalid_weight")
    if volume_m3 is not None and (volume_m3 < 0 or volume_m3 > cfg["max_volume_m3"]):
        raise AsapPricingError("Invalid dimensions.", code="invalid_dims")
    if item_count is not None and item_count > cfg["max_items"]:
        raise AsapPricingError("Too many items — contact support.", code="too_many_items")

    d = max(float(distance_miles or 0), 0.5)
    t = max(float(duration_minutes or 0), 0.0)

    # ---------- 2. Vehicle resolution ----------------------------------
    manual_review = False
    manual_review_reason = None
    if service_type == "breakdown_recovery":
        vehicle_key = _pick_recovery_vehicle(
            cfg, requested=requested_vehicle_key,
            vehicle_class=vehicle_class, weight_kg=weight_kg)
        v = cfg["recovery_vehicles"][vehicle_key]
    else:
        vehicle_key = _pick_transport_vehicle(
            cfg, weight_kg=weight_kg, volume_m3=volume_m3,
            pallets=pallets, requested=requested_vehicle_key)
        v = cfg["transport_vehicles"][vehicle_key]

    if v.get("manual_review"):
        manual_review = True
        manual_review_reason = f"{v['label']} requires operator confirmation before dispatch."

    # ---------- 3. Progressive mileage ---------------------------------
    curve = cfg["mileage_curves"][v.get("mileage_curve", "goods")]
    mileage_charge = _progressive_mileage(d, float(v["per_mile"]), curve)

    # ---------- 4. Extras (all flat £, applied BEFORE uplifts) ---------
    # Waiting
    free_min = int(cfg["free_waiting_minutes"]) * 2  # both ends free
    waiting_blocks = max(0, ((int(waiting_minutes or 0) - free_min) + 29) // 30)
    per_block = float(cfg["waiting_per_30min_by_class"].get(vehicle_key, 15))
    waiting_charge = round(waiting_blocks * per_block, 2)
    # Stops
    stop_fees = cfg["extra_stop_fees"]
    stops_charge = 0.0
    for i in range(int(extra_stops or 0)):
        stop_fees_val = stop_fees[min(i, len(stop_fees) - 1)]
        stops_charge += stop_fees_val
    # Loading
    loading_charge = float(cfg["loading_help_by_class"].get(vehicle_key, 25)) if loading_help else 0.0

    base_route = mileage_charge + waiting_charge + stops_charge + loading_charge

    # ---------- 5. Dead mileage (recovery + transport, R26.1) ----------
    dead_uplift_pct = 0.0
    if nearest_driver_distance_mi is not None:
        band_key = ("dead_mileage_bands_recovery"
                     if service_type == "breakdown_recovery"
                     else "dead_mileage_bands_transport")
        dead_uplift_pct = _band_lookup(
            cfg.get(band_key, []),
            float(nearest_driver_distance_mi), "mi", "uplift")

    # ---------- 6. Multiplicative uplifts (capped stacking) ------------
    asap_uplift = _urgency_uplift(cfg, urgency)
    urgency_win = _collection_window_uplift(cfg, collection_within_minutes)
    night, weekend, bh_label, bh = _time_uplifts(cfg, when_iso)

    supply = 0.0; driver_count = None
    if pickup_lat is not None and pickup_lng is not None:
        wide_radius = float(v["radii_mi"][2])
        driver_count = await _count_available_drivers(
            db, vehicle_key=vehicle_key,
            pickup_lat=pickup_lat, pickup_lng=pickup_lng,
            radius_mi=wide_radius)
        supply = _supply_uplift(cfg, driver_count)

    regional = float(cfg["regional_multipliers"].get((pickup_country_code or "GB").upper(), 1.0)) - 1.0

    # Total additive uplift (capped)
    heavy = v.get("mileage_curve") == "heavy"
    ceiling = float(cfg["uplift_ceiling_heavy" if heavy else "uplift_ceiling"])
    raw_uplift = asap_uplift + urgency_win + night + weekend + bh + supply + regional + dead_uplift_pct
    effective_uplift = min(raw_uplift, ceiling)
    capped = raw_uplift > ceiling

    # ---------- 7. Apply and enforce minimum ---------------------------
    driver_charge_pre_min = base_route * (1.0 + effective_uplift)
    driver_charge_raw = max(driver_charge_pre_min, float(v["minimum_charge"]))
    driver_charge = float(_round_display(driver_charge_raw))

    # ---------- 8. Booking fee (delegated) -----------------------------
    if calculate_booking_fee_detail is None:
        # Test path: fixed 15% for unit-test isolation. In production the
        # server.py wrapper always injects the real detail function.
        booking_fee = round(driver_charge * 0.15, 2)
        booking_fee_percent = 15.0
    else:
        fee_detail = await calculate_booking_fee_detail(driver_charge)
        booking_fee = float(fee_detail["amount"])
        booking_fee_percent = float(fee_detail["percent"])
    customer_total = round(driver_charge + booking_fee, 2)

    # ---------- 9. Build line items + snapshot -------------------------
    line_items = [
        AsapLineItem("mileage",       f"Mileage ({d:.1f} mi progressive)", mileage_charge),
        AsapLineItem("minimum_floor", f"{v['label']} min charge",          float(v["minimum_charge"]),
                       detail="floor" if driver_charge_pre_min < v["minimum_charge"] else None),
    ]
    if waiting_charge:   line_items.append(AsapLineItem("waiting",     "Waiting time",       waiting_charge))
    if stops_charge:     line_items.append(AsapLineItem("extra_stops", "Extra stops",        stops_charge))
    if loading_charge:   line_items.append(AsapLineItem("loading",     "Loading assistance", loading_charge))
    if asap_uplift:      line_items.append(AsapLineItem("asap_premium", f"ASAP premium (+{asap_uplift*100:.0f}%)", round(base_route * asap_uplift, 2)))
    if urgency_win:      line_items.append(AsapLineItem("urgency_window", f"Urgency window (+{urgency_win*100:.0f}%)", round(base_route * urgency_win, 2)))
    if night:            line_items.append(AsapLineItem("night",       f"Night rate (+{night*100:.0f}%)",  round(base_route * night, 2)))
    if weekend:          line_items.append(AsapLineItem("weekend",     f"Weekend (+{weekend*100:.0f}%)",   round(base_route * weekend, 2)))
    if bh:               line_items.append(AsapLineItem("bank_holiday", f"Bank Holiday (+{bh*100:.0f}%)",  round(base_route * bh, 2), detail=bh_label))
    if supply:           line_items.append(AsapLineItem("supply",      f"Driver supply (+{supply*100:.0f}%)", round(base_route * supply, 2), detail=f"drivers={driver_count}"))
    if regional:         line_items.append(AsapLineItem("regional",    f"Regional (+{regional*100:.0f}%)", round(base_route * regional, 2)))
    if dead_uplift_pct:  line_items.append(AsapLineItem("dead_mileage", f"Repositioning (+{dead_uplift_pct*100:.0f}%)", round(base_route * dead_uplift_pct, 2)))
    if capped:           line_items.append(AsapLineItem("capped_uplift", f"Uplift capped at +{ceiling*100:.0f}%", 0.0))

    snapshot = {
        "engine_version": ASAP_ENGINE_VERSION,
        "service_type": service_type,
        "inputs": {
            "distance_miles": round(d, 2),
            "duration_minutes": round(t, 1),
            "distance_source": distance_source,
            "urgency": urgency or cfg["default_urgency"],
            "collection_within_minutes": collection_within_minutes,
            "when_iso": when_iso,
            "requested_vehicle_key": requested_vehicle_key,
            "vehicle_class": vehicle_class,
            "weight_kg": weight_kg, "volume_m3": volume_m3,
            "pallets": pallets, "item_count": item_count,
            "waiting_minutes": waiting_minutes,
            "extra_stops": extra_stops,
            "loading_help": loading_help,
            "tail_lift_needed": tail_lift_needed,
            "nearest_driver_distance_mi": nearest_driver_distance_mi,
            "pickup_country_code": pickup_country_code,
            "pickup_lat": pickup_lat, "pickup_lng": pickup_lng,
        },
        "resolved_vehicle_key": vehicle_key,
        "vehicle_rate_card": v,
        "base_charges": {
            "mileage": mileage_charge,
            "waiting": waiting_charge,
            "stops":   stops_charge,
            "loading": loading_charge,
            "base_route_total": round(base_route, 2),
        },
        "uplifts": {
            "asap":            asap_uplift,
            "urgency_window":  urgency_win,
            "night":           night,
            "weekend":         weekend,
            "bank_holiday":    bh,
            "bank_holiday_label": bh_label or None,
            "supply":          supply,
            "supply_driver_count": driver_count,
            "regional":        regional,
            "dead_mileage":    dead_uplift_pct,
            "raw_total":       raw_uplift,
            "effective_total": effective_uplift,
            "ceiling":         ceiling,
            "capped":          capped,
        },
        "driver_charge_pre_min":  round(driver_charge_pre_min, 2),
        "minimum_charge":         float(v["minimum_charge"]),
        "driver_charge_rounded":  driver_charge,
        "booking_fee_percent":    booking_fee_percent,
        "booking_fee":            booking_fee,
        "customer_total":         customer_total,
        "manual_review":          manual_review,
        "manual_review_reason":   manual_review_reason,
    }

    return AsapBreakdown(
        driver_charge=driver_charge,
        booking_fee_percent=booking_fee_percent,
        booking_fee=booking_fee,
        customer_total=customer_total,
        resolved_vehicle_key=vehicle_key,
        resolved_vehicle_label=v["label"],
        line_items=line_items,
        pricing_snapshot=snapshot,
        manual_review=manual_review,
        manual_review_reason=manual_review_reason,
    )
