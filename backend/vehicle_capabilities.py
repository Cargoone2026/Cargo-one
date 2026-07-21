"""Cargo One - Vehicle capability catalogue.

Static seed for the `vehicle_capabilities` collection. Admin can add/edit/disable
capabilities through the admin portal without code changes.

Each vehicle_type & driver_vehicle references capability keys via a `capabilities`
list. The recommender uses these keys to boost / hard-filter vehicles.
"""
from __future__ import annotations

CAPABILITY_SEED = [
    {"key": "tail_lift",              "name": "Tail Lift",                  "icon": "arrow-down-circle",   "description": "Hydraulic tail-lift for heavy or awkward loads."},
    {"key": "flatbed",                "name": "Flatbed",                    "icon": "layers-outline",       "description": "Open flatbed body suitable for oversized items."},
    {"key": "curtainside",            "name": "Curtainside",                "icon": "layers",               "description": "Curtain-side rigid body for side loading."},
    {"key": "refrigerated",           "name": "Refrigerated",               "icon": "snow",                 "description": "Temperature-controlled load area."},
    {"key": "hiab_crane",             "name": "Hiab Crane",                 "icon": "hammer",               "description": "Truck-mounted crane for lifting heavy items."},
    {"key": "winch",                  "name": "Winch",                      "icon": "cog",                  "description": "Powered winch for recovery/vehicle loading."},
    {"key": "car_transporter",       "name": "Car Transporter",             "icon": "car-sport",            "description": "Certified car transport equipment."},
    {"key": "motorcycle_transport",  "name": "Motorcycle Transport",        "icon": "bicycle",              "description": "Chocks, straps and rails for motorcycles."},
    {"key": "low_loader",             "name": "Low Loader",                 "icon": "construct",            "description": "Low-loader trailer for heavy or tall plant."},
    {"key": "container_capable",     "name": "Shipping Container Capable",  "icon": "cube",                 "description": "Can lift/transport 20ft or 40ft containers."},
    {"key": "caravan_transport",     "name": "Caravan Transport",           "icon": "car-outline",          "description": "Certified for touring caravan transport."},
    {"key": "static_caravan_transport","name": "Static Caravan Transport",  "icon": "home-outline",         "description": "Equipped for static caravan / park-home moves."},
    {"key": "machinery_transport",   "name": "Machinery Transport",         "icon": "construct-outline",    "description": "Suitable for machinery and plant transport."},
    {"key": "pallet_transport",      "name": "Pallet Transport",            "icon": "albums",               "description": "Pallet-ready deck and pallet truck."},
    {"key": "fragile_goods",         "name": "Fragile Goods",               "icon": "flower-outline",       "description": "Blankets, air-ride suspension for fragile items."},
    {"key": "high_value_goods",      "name": "High Value Goods",            "icon": "diamond",              "description": "Alarmed vehicle, GPS-tracked, insured for high value."},
    {"key": "adr_ready",             "name": "ADR Ready",                   "icon": "warning",              "description": "ADR-certified driver + placarding for dangerous goods."},
    {"key": "two_person_crew",       "name": "Two Person Crew",             "icon": "people",               "description": "Two-person crew for heavy/awkward lifting."},
    {"key": "heavy_lift",            "name": "Heavy Lift Equipment",        "icon": "barbell",              "description": "Sack trucks, straps, ramps for heavy items."},
    {"key": "electric_vehicle",      "name": "Electric Vehicle",            "icon": "flash",                "description": "Zero-emission EV — great for ULEZ / clean-air zones."},
    {"key": "ulez_compliant",        "name": "ULEZ Compliant",              "icon": "leaf",                 "description": "Meets London ULEZ / Clean Air Zone standards."},
]
