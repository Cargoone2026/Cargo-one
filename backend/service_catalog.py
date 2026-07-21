"""Cargo One - Service categories & vehicle types.

Static seed data + rule-based vehicle recommendation engine.
Data lives in MongoDB (`service_categories`, `vehicle_types`) so admins can
enable/disable/reorder/rename without code changes. This module only supplies
the FIRST-BOOT seed and the recommendation logic.
"""
from __future__ import annotations

from typing import Optional

# ---------------------------------------------------------------------------
# Vehicle catalogue
# ---------------------------------------------------------------------------
# Fields:
#   key            - stable slug (used everywhere)
#   name           - display label
#   description    - short blurb shown in pickers / admin
#   icon           - Ionicons name
#   max_weight_kg  - approx payload
#   max_volume_m3  - approx load volume (None = "very large / N/A")
#   features       - flags used by recommender (tail_lift, crane, refrigerated, etc.)
#   order          - default display order
VEHICLE_SEED = [
    {"key": "motorcycle_courier",   "name": "Motorcycle Courier",   "icon": "bicycle",         "max_weight_kg": 20,    "max_volume_m3": 0.05, "features": ["urgent", "documents"], "description": "Bike/scooter courier for documents and small parcels — same-hour delivery."},
    {"key": "small_van",            "name": "Small Van",            "icon": "car",             "max_weight_kg": 500,   "max_volume_m3": 3.5,  "features": [],                    "description": "Berlingo/Combo class. Great for parcels and single items up to 500kg."},
    {"key": "swb_van",              "name": "Short Wheelbase Van",  "icon": "car-outline",     "max_weight_kg": 800,   "max_volume_m3": 6.0,  "features": [],                    "description": "Transporter SWB — fits 1-bed contents or 1-2 pallets."},
    {"key": "lwb_van",              "name": "Long Wheelbase Van",   "icon": "car-sport",       "max_weight_kg": 1200,  "max_volume_m3": 11.0, "features": [],                    "description": "Sprinter LWB — 2-bed flat move, 3-4 pallets or bulky items."},
    {"key": "luton_van",            "name": "Luton Van",            "icon": "cube",            "max_weight_kg": 1000,  "max_volume_m3": 22.0, "features": [],                    "description": "Box body Luton — full 3-bed house or event equipment."},
    {"key": "luton_van_taillift",   "name": "Luton Van with Tail Lift", "icon": "cube",        "max_weight_kg": 1000,  "max_volume_m3": 22.0, "features": ["tail_lift"],         "description": "Luton with hydraulic tail lift for heavy or awkward items."},
    {"key": "recovery_truck",       "name": "Recovery Truck",       "icon": "car-sport-outline","max_weight_kg": 3500, "max_volume_m3": None, "features": ["vehicle_transport", "tail_lift"], "description": "Flatbed recovery — cars, vans, and mechanical failures."},
    {"key": "car_transporter",      "name": "Car Transporter",      "icon": "car",             "max_weight_kg": 2500,  "max_volume_m3": None, "features": ["vehicle_transport"], "description": "Enclosed or open car transporter — 1-2 vehicles."},
    {"key": "flatbed_truck",        "name": "Flatbed Truck",        "icon": "construct",       "max_weight_kg": 7000,  "max_volume_m3": None, "features": ["open_load", "machinery"], "description": "Open flatbed — machinery, building materials, plant."},
    {"key": "curtain_side",         "name": "Curtain Side Vehicle", "icon": "layers",          "max_weight_kg": 7000,  "max_volume_m3": 35.0, "features": ["easy_load"],         "description": "Curtain-side rigid — palletised freight, easy side loading."},
    {"key": "7_5_tonne",            "name": "7.5 Tonne Lorry",      "icon": "bus",             "max_weight_kg": 3000,  "max_volume_m3": 35.0, "features": ["tail_lift"],         "description": "7.5T rigid box — small removals, ~6 UK pallets."},
    {"key": "18_tonne",             "name": "18 Tonne Lorry",       "icon": "bus-outline",     "max_weight_kg": 10000, "max_volume_m3": 60.0, "features": ["tail_lift"],         "description": "18T rigid — big removals or 12-14 UK pallets."},
    {"key": "articulated_hgv",      "name": "Articulated HGV",      "icon": "train",           "max_weight_kg": 26000, "max_volume_m3": 90.0, "features": ["heavy_freight"],     "description": "44T artic — full loads and long-distance freight."},
    {"key": "hiab_crane",           "name": "Hiab Crane Vehicle",   "icon": "hammer",          "max_weight_kg": 10000, "max_volume_m3": 30.0, "features": ["crane", "machinery"], "description": "Truck-mounted crane for machinery, plant, containers."},
    {"key": "refrigerated",         "name": "Refrigerated Vehicle", "icon": "snow",            "max_weight_kg": 3000,  "max_volume_m3": 20.0, "features": ["refrigerated"],      "description": "Temperature-controlled — food, pharma, fresh produce."},
    {"key": "other",                "name": "Other",                "icon": "help-circle",     "max_weight_kg": 0,     "max_volume_m3": None, "features": ["other"],             "description": "Something else — the driver will confirm requirements."},
]


# ---------------------------------------------------------------------------
# Service category catalogue
# ---------------------------------------------------------------------------
# Fields:
#   key                 - stable slug
#   name                - display label
#   description         - short blurb
#   icon                - Ionicons name
#   default_vehicles    - ordered shortlist of vehicle keys most suited to this category
#   typical_weight_kg   - approx payload used as default when customer doesn't provide one
#   typical_volume_m3   - approx volume default
#   order               - default display order
CATEGORY_SEED = [
    {"key": "house_removals",        "name": "House Removals",        "icon": "home",                "description": "Full or part house moves — studio to 5-bed homes.",           "default_vehicles": ["luton_van", "luton_van_taillift", "7_5_tonne", "18_tonne"], "typical_weight_kg": 1500, "typical_volume_m3": 22.0},
    {"key": "furniture_delivery",    "name": "Furniture Delivery",    "icon": "bed",                 "description": "Single furniture items — sofas, wardrobes, beds.",              "default_vehicles": ["lwb_van", "luton_van", "luton_van_taillift"], "typical_weight_kg": 200, "typical_volume_m3": 4.0},
    {"key": "single_items",          "name": "Single Items",          "icon": "cube-outline",        "description": "One-off items too big for a parcel courier.",                   "default_vehicles": ["small_van", "swb_van", "lwb_van"], "typical_weight_kg": 80, "typical_volume_m3": 1.5},
    {"key": "parcels",               "name": "Parcels",               "icon": "cube",                "description": "Boxes and packages up to 30kg.",                                "default_vehicles": ["motorcycle_courier", "small_van", "swb_van"], "typical_weight_kg": 15, "typical_volume_m3": 0.2},
    {"key": "documents",             "name": "Documents",             "icon": "document-text",       "description": "Same-hour secure document delivery.",                          "default_vehicles": ["motorcycle_courier", "small_van"], "typical_weight_kg": 2, "typical_volume_m3": 0.05},
    {"key": "pallets",               "name": "Pallets",               "icon": "albums",              "description": "UK, Euro or oversized pallets. 1 to 26 per load.",              "default_vehicles": ["lwb_van", "curtain_side", "7_5_tonne", "18_tonne", "articulated_hgv"], "typical_weight_kg": 400, "typical_volume_m3": 2.4},
    {"key": "freight",               "name": "Freight",               "icon": "boat",                "description": "General freight, full & part-loads across the UK.",             "default_vehicles": ["7_5_tonne", "18_tonne", "articulated_hgv", "curtain_side"], "typical_weight_kg": 3000, "typical_volume_m3": 30.0},
    {"key": "motorcycles",           "name": "Motorcycles & Scooters", "icon": "bicycle",            "description": "Bikes, mopeds, scooters — insured trailer transport.",         "default_vehicles": ["recovery_truck", "car_transporter", "swb_van", "lwb_van"], "typical_weight_kg": 180, "typical_volume_m3": None},
    {"key": "cars_vehicles",         "name": "Cars & Vehicles",       "icon": "car-sport",           "description": "Car recovery, dealer transfers, private sales.",                "default_vehicles": ["car_transporter", "recovery_truck"], "typical_weight_kg": 1500, "typical_volume_m3": None},
    {"key": "vans",                  "name": "Vans",                  "icon": "car",                 "description": "Van transport — up to 3.5T.",                                   "default_vehicles": ["recovery_truck", "car_transporter"], "typical_weight_kg": 2500, "typical_volume_m3": None},
    {"key": "machinery_plant",       "name": "Machinery & Plant",     "icon": "construct",           "description": "Construction and industrial machinery.",                        "default_vehicles": ["flatbed_truck", "hiab_crane", "18_tonne", "articulated_hgv"], "typical_weight_kg": 4000, "typical_volume_m3": None},
    {"key": "agricultural",          "name": "Agricultural Equipment","icon": "leaf",                "description": "Tractors, implements, farm machinery.",                         "default_vehicles": ["flatbed_truck", "hiab_crane", "18_tonne", "articulated_hgv"], "typical_weight_kg": 5000, "typical_volume_m3": None},
    {"key": "building_materials",    "name": "Building Materials",    "icon": "hammer",              "description": "Bricks, timber, plasterboard, aggregates.",                     "default_vehicles": ["flatbed_truck", "curtain_side", "hiab_crane", "18_tonne"], "typical_weight_kg": 2000, "typical_volume_m3": 12.0},
    {"key": "boats_marine",          "name": "Boats & Marine Transport","icon": "boat",              "description": "Boats, jet-skis and marine trailers.",                          "default_vehicles": ["recovery_truck", "flatbed_truck", "articulated_hgv"], "typical_weight_kg": 2000, "typical_volume_m3": None},
    {"key": "shipping_containers",   "name": "Shipping Containers",   "icon": "cube",                "description": "20ft or 40ft shipping containers.",                             "default_vehicles": ["hiab_crane", "flatbed_truck", "articulated_hgv"], "typical_weight_kg": 6000, "typical_volume_m3": None},
    {"key": "caravans",              "name": "Caravans",              "icon": "car-outline",         "description": "Touring caravans — collection and delivery.",                   "default_vehicles": ["recovery_truck", "flatbed_truck"], "typical_weight_kg": 1400, "typical_volume_m3": None},
    {"key": "static_caravans",       "name": "Static Caravans",       "icon": "home-outline",        "description": "Static caravan and park-home relocation.",                     "default_vehicles": ["articulated_hgv", "hiab_crane", "flatbed_truck"], "typical_weight_kg": 8000, "typical_volume_m3": None},
    {"key": "garden_outdoor",        "name": "Garden & Outdoor Items","icon": "flower",              "description": "Hot tubs, sheds, playhouses, garden furniture.",               "default_vehicles": ["lwb_van", "luton_van_taillift", "flatbed_truck"], "typical_weight_kg": 300, "typical_volume_m3": 4.0},
    {"key": "office_commercial",     "name": "Office & Commercial Moves","icon": "briefcase",        "description": "Office fit-outs, retail store relocations.",                    "default_vehicles": ["luton_van", "7_5_tonne", "18_tonne"], "typical_weight_kg": 2500, "typical_volume_m3": 35.0},
    {"key": "retail_business",       "name": "Retail & Business Deliveries","icon": "storefront",    "description": "Retail replenishment, wholesale drops, B2B.",                   "default_vehicles": ["lwb_van", "curtain_side", "7_5_tonne"], "typical_weight_kg": 800, "typical_volume_m3": 8.0},
    {"key": "event_equipment",       "name": "Event Equipment",       "icon": "megaphone",           "description": "AV, staging, exhibition kit — with weekend crews.",             "default_vehicles": ["luton_van_taillift", "7_5_tonne", "curtain_side"], "typical_weight_kg": 1000, "typical_volume_m3": 15.0},
    {"key": "auction_marketplace",   "name": "Auction & Marketplace Collections","icon": "pricetags","description": "eBay, Facebook Marketplace, live auction pickups.",             "default_vehicles": ["small_van", "swb_van", "lwb_van", "luton_van"], "typical_weight_kg": 150, "typical_volume_m3": 2.0},
    {"key": "same_day_express",      "name": "Same Day / Express Deliveries","icon": "flash",         "description": "Urgent same-hour and same-day dedicated runs.",                 "default_vehicles": ["motorcycle_courier", "small_van", "swb_van", "lwb_van"], "typical_weight_kg": 100, "typical_volume_m3": 1.0},
    {"key": "long_distance_uk",      "name": "Long Distance UK Deliveries","icon": "map",             "description": "300+ mile UK routes, overnight and next-day.",                 "default_vehicles": ["lwb_van", "luton_van", "7_5_tonne", "articulated_hgv"], "typical_weight_kg": 500, "typical_volume_m3": 8.0},
    {"key": "fragile_high_value",    "name": "Fragile & High Value Items","icon": "diamond",          "description": "Art, antiques, glass, medical, high-value goods.",             "default_vehicles": ["small_van", "swb_van", "luton_van_taillift"], "typical_weight_kg": 100, "typical_volume_m3": 2.0},
    {"key": "other",                 "name": "Other",                 "icon": "help-circle",         "description": "Not sure which category fits — we'll match you to a driver.",   "default_vehicles": ["swb_van", "lwb_van", "luton_van"], "typical_weight_kg": 200, "typical_volume_m3": 3.0},
]


# ---------------------------------------------------------------------------
# Legacy → new category migration map (auto-migrate old jobs)
# ---------------------------------------------------------------------------
LEGACY_CATEGORY_MAP = {
    "furniture":  "furniture_delivery",
    "pallets":    "pallets",
    "cars":       "cars_vehicles",
    "motorcycles":"motorcycles",
    "house_moves":"house_removals",
    "parcels":    "parcels",
    "freight":    "freight",
    "documents":  "documents",
    "boats":      "boats_marine",
    "machinery":  "machinery_plant",
}


# ---------------------------------------------------------------------------
# Recommendation engine
# ---------------------------------------------------------------------------
def _feature_boost(vehicle: dict, needs_forklift: bool, needs_loading_help: bool, category_key: str) -> int:
    """Additive score for feature matching — higher = better."""
    features = set(vehicle.get("features") or [])
    score = 0
    if needs_forklift:
        if "crane" in features or "easy_load" in features or "open_load" in features:
            score += 20
    if needs_loading_help:
        if "tail_lift" in features or "crane" in features:
            score += 20
    if category_key in ("cars_vehicles", "vans", "motorcycles") and "vehicle_transport" in features:
        score += 15
    if category_key == "machinery_plant" and "machinery" in features:
        score += 15
    if category_key == "shipping_containers" and "crane" in features:
        score += 15
    if category_key == "documents" and "urgent" in features:
        score += 10
    return score


def recommend_vehicles(
    vehicles: list[dict],
    category: dict,
    *,
    weight_kg: Optional[float] = None,
    volume_m3: Optional[float] = None,
    item_count: Optional[int] = None,
    needs_forklift: bool = False,
    needs_loading_help: bool = False,
    limit: int = 4,
) -> list[dict]:
    """Return an ordered list of vehicle recommendations for a job.

    First result is the "best value" (smallest vehicle that fits).
    Subsequent results are larger alternatives.
    """
    if not category or not vehicles:
        return []

    cat_key = category.get("key", "")
    default_keys: list[str] = category.get("default_vehicles") or []

    # Use category typicals if the customer left them blank
    weight_kg = weight_kg if weight_kg and weight_kg > 0 else category.get("typical_weight_kg") or 0
    volume_m3 = volume_m3 if volume_m3 and volume_m3 > 0 else category.get("typical_volume_m3") or 0
    if item_count and item_count > 1 and volume_m3:
        volume_m3 = float(volume_m3) * float(item_count) / max(1, min(item_count, 4))

    # Build a lookup for active vehicles
    active_vehicles = [v for v in vehicles if v.get("active", True) and v.get("key") != "other"]
    v_by_key = {v["key"]: v for v in active_vehicles}

    # Start with category defaults (in order), then any others as fallback
    shortlist_keys = [k for k in default_keys if k in v_by_key]
    for v in active_vehicles:
        if v["key"] not in shortlist_keys:
            shortlist_keys.append(v["key"])

    def capacity_penalty(v: dict) -> int:
        """Higher penalty = worse fit."""
        max_w = float(v.get("max_weight_kg") or 0)
        max_v = float(v.get("max_volume_m3") or 0) if v.get("max_volume_m3") is not None else 999
        # under-capacity is a hard fail — the vehicle can't carry it
        if weight_kg and max_w > 0 and weight_kg > max_w:
            return 10000
        if volume_m3 and max_v > 0 and volume_m3 > max_v:
            return 10000
        # over-capacity is a mild penalty — 1 point per 1000kg spare, 1 per 5m3 spare
        weight_slack = max(0, max_w - (weight_kg or 0)) / 1000.0
        vol_slack = max(0, max_v - (volume_m3 or 0)) / 5.0
        return int(weight_slack + vol_slack)

    scored: list[tuple[int, int, dict]] = []
    for idx, key in enumerate(shortlist_keys):
        v = v_by_key[key]
        penalty = capacity_penalty(v)
        if penalty >= 10000:
            continue
        boost = _feature_boost(v, needs_forklift, needs_loading_help, cat_key)
        default_bonus = max(0, 30 - idx * 5)  # earlier in default_vehicles = better
        score = -penalty + boost + default_bonus
        scored.append((-score, idx, v))

    scored.sort()
    ranked = [v for _, _, v in scored][:limit]

    if not ranked:
        # Fall back: return the category defaults regardless of capacity
        ranked = [v_by_key[k] for k in default_keys[:limit] if k in v_by_key]

    # Annotate: first = Best value, then Roomier alternatives
    labels = ["Best value ⭐", "Roomier option", "Larger alternative", "Extra capacity"]
    out = []
    for i, v in enumerate(ranked):
        out.append({
            **v,
            "recommendation_label": labels[i] if i < len(labels) else "Alternative",
            "is_best_match": i == 0,
        })
    return out
