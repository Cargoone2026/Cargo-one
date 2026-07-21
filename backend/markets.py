"""Cargo One market / geography configuration (backend).

Mirrors /app/frontend/src/config/markets.ts. Keep the two in sync.

Adding a new supported country requires only appending it to
SUPPORTED_MARKETS. To enable UK-style pricing for a country, add its
ISO2 to LAUNCH_DOMESTIC_ISO_CODES (currently only 'GB').
"""
from __future__ import annotations

from typing import Optional


# (iso2, iso3, name, currency, calling_code, postcode_label, pricing_configured)
SUPPORTED_MARKETS: list[dict] = [
    {"iso2": "GB", "iso3": "GBR", "name": "United Kingdom",      "currency": "GBP", "calling_code": "+44",  "postal_code_label": "Postcode",       "pricing_configured": True},
    {"iso2": "IE", "iso3": "IRL", "name": "Republic of Ireland", "currency": "EUR", "calling_code": "+353", "postal_code_label": "Eircode",        "pricing_configured": False},
    {"iso2": "FR", "iso3": "FRA", "name": "France",              "currency": "EUR", "calling_code": "+33",  "postal_code_label": "Code postal",    "pricing_configured": False},
    {"iso2": "DE", "iso3": "DEU", "name": "Germany",             "currency": "EUR", "calling_code": "+49",  "postal_code_label": "PLZ",            "pricing_configured": False},
    {"iso2": "NL", "iso3": "NLD", "name": "Netherlands",         "currency": "EUR", "calling_code": "+31",  "postal_code_label": "Postcode",       "pricing_configured": False},
    {"iso2": "BE", "iso3": "BEL", "name": "Belgium",             "currency": "EUR", "calling_code": "+32",  "postal_code_label": "Postcode",       "pricing_configured": False},
    {"iso2": "ES", "iso3": "ESP", "name": "Spain",               "currency": "EUR", "calling_code": "+34",  "postal_code_label": "Código postal",  "pricing_configured": False},
    {"iso2": "IT", "iso3": "ITA", "name": "Italy",               "currency": "EUR", "calling_code": "+39",  "postal_code_label": "CAP",            "pricing_configured": False},
    {"iso2": "PT", "iso3": "PRT", "name": "Portugal",            "currency": "EUR", "calling_code": "+351", "postal_code_label": "Código postal",  "pricing_configured": False},
    {"iso2": "AT", "iso3": "AUT", "name": "Austria",             "currency": "EUR", "calling_code": "+43",  "postal_code_label": "PLZ",            "pricing_configured": False},
    {"iso2": "PL", "iso3": "POL", "name": "Poland",              "currency": "EUR", "calling_code": "+48",  "postal_code_label": "Kod pocztowy",   "pricing_configured": False},
    {"iso2": "SE", "iso3": "SWE", "name": "Sweden",              "currency": "SEK", "calling_code": "+46",  "postal_code_label": "Postnummer",     "pricing_configured": False},
    {"iso2": "DK", "iso3": "DNK", "name": "Denmark",             "currency": "DKK", "calling_code": "+45",  "postal_code_label": "Postnummer",     "pricing_configured": False},
    {"iso2": "NO", "iso3": "NOR", "name": "Norway",              "currency": "NOK", "calling_code": "+47",  "postal_code_label": "Postnummer",     "pricing_configured": False},
    {"iso2": "CH", "iso3": "CHE", "name": "Switzerland",         "currency": "CHF", "calling_code": "+41",  "postal_code_label": "PLZ",            "pricing_configured": False},
    {"iso2": "LU", "iso3": "LUX", "name": "Luxembourg",          "currency": "EUR", "calling_code": "+352", "postal_code_label": "Code postal",    "pricing_configured": False},
]

SUPPORTED_ISO2 = {m["iso2"] for m in SUPPORTED_MARKETS}

# ISO2 codes with fully configured pricing rules (UK-domestic today).
LAUNCH_DOMESTIC_ISO_CODES = {"GB"}


def is_supported_country(iso2: Optional[str]) -> bool:
    return bool(iso2) and iso2.upper() in SUPPORTED_ISO2


def market_name(iso2: Optional[str]) -> str:
    if not iso2:
        return ""
    m = next((x for x in SUPPORTED_MARKETS if x["iso2"] == iso2.upper()), None)
    return m["name"] if m else iso2.upper()


def classify_route(origin: Optional[str], dest: Optional[str]) -> str:
    """Return one of: domestic_uk | domestic_other | international | unsupported."""
    o = (origin or "").upper()
    d = (dest or "").upper()
    if not is_supported_country(o) or not is_supported_country(d):
        return "unsupported"
    if o == "GB" and d == "GB":
        return "domestic_uk"
    if o == d:
        return "domestic_other"
    return "international"
