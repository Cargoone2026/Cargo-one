"""Session F — Booking-fee band engine (percentage tiers).

Locks in the exact tier math the QA sprint spec requires:
    £0.00 – £150.00        15%
    £150.01 – £300.00      14%
    £300.01 – £600.00      13%
    £600.01 – £1,000.00    12%
    Over £1,000.00         10%
"""
import os
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL",
    "https://cargo-repo-bridge.preview.emergentagent.com",
).rstrip("/")
API = f"{BASE_URL}/api"


@pytest.mark.parametrize("charge,expected_pct,expected_fee", [
    (50.00,    15.0,   7.50),
    (150.00,   15.0,   22.50),
    (150.01,   14.0,   21.00),  # rounds via 150.01 * 0.14
    (151.00,   14.0,   21.14),
    (299.00,   14.0,   41.86),
    (300.00,   14.0,   42.00),
    (300.01,   13.0,   39.00),
    (301.00,   13.0,   39.13),
    (600.00,   13.0,   78.00),
    (600.01,   12.0,   72.00),
    (601.00,   12.0,   72.12),
    (999.00,   12.0,   119.88),
    (1000.00,  12.0,   120.00),
    (1000.01,  10.0,   100.00),
    (1001.00,  10.0,   100.10),
    (2500.00,  10.0,   250.00),
])
def test_booking_fee_bands_match_spec(charge, expected_pct, expected_fee):
    r = requests.get(f"{API}/booking-fee-bands/preview",
                       params={"driver_charge": charge}, timeout=10)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["booking_fee_percent"] == expected_pct, \
        f"@£{charge}: expected {expected_pct}% got {d['booking_fee_percent']}%"
    # Allow 1p rounding tolerance because of half-cent boundary conditions.
    assert abs(d["booking_fee"] - expected_fee) < 0.02, \
        f"@£{charge}: expected £{expected_fee} got £{d['booking_fee']}"
    assert abs(d["customer_total"] - (charge + d["booking_fee"])) < 0.01
    assert d["balance_due"] == pytest.approx(charge, abs=0.005)
    # Session F guarantee: the calc must come from the new bands, not fallback.
    assert d["booking_fee_source"] == "booking_fee_bands"


def test_negative_input_rejected():
    r = requests.get(f"{API}/booking-fee-bands/preview",
                       params={"driver_charge": -1}, timeout=10)
    assert r.status_code == 400


def test_zero_charge_still_returns_a_band():
    r = requests.get(f"{API}/booking-fee-bands/preview",
                       params={"driver_charge": 0}, timeout=10)
    assert r.status_code == 200
    d = r.json()
    assert d["booking_fee"] == 0.0
    assert d["booking_fee_source"] == "booking_fee_bands"
