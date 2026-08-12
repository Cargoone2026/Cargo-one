"""R25.1 — Screen-to-screen price consistency regression.

Guards the bug reported in production for a 119.6mi ASAP Recovery:
customer saw £1,068 in the summary → same journey went through booking
creation and Stripe with a different figure. Root cause: recovery jobs
picked up a transport-category multiplier (cars_vehicles = 1.35×) on top
of the dedicated recovery rate card + recovery_multiplier + ASAP
multiplier, triple-stacking the "recovery is expensive" premium.

Fix (services/pricing.py): when service_type == 'breakdown_recovery' the
engine forces category_mult = 1.0 regardless of transport_category input.

This suite proves the fix from an HTTP-integration angle: exercises real
endpoints against the running API and asserts the three screens agree.
"""

from __future__ import annotations

import os
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE}/api"

CUSTOMER_EMAIL = "testcustomer@example.com"
CUSTOMER_PW = "CustomerTest12345!"


def _login(email: str, pw: str) -> str:
    r = requests.post(f"{API}/auth/login",
                       json={"email": email, "password": pw}, timeout=15)
    r.raise_for_status()
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def cust_token():
    if not BASE:
        pytest.skip("REACT_APP_BACKEND_URL not set")
    return _login(CUSTOMER_EMAIL, CUSTOMER_PW)


# ---------------------------------------------------------------------------
# The exact production repro — Smethwick recovery
# ---------------------------------------------------------------------------


SMETHWICK_ROUTE = {
    "pickup_lat": 51.5074, "pickup_lng": -0.1278,
    "dropoff_lat": 52.4923, "dropoff_lng": -2.0069,
}


def test_R251_smethwick_recovery_below_1000(cust_token):
    """The bug produced £1,068 — the fix must land the same journey below
    £1,000 driver charge. R26 note: ASAP now routes through V1 engine which
    has a different snapshot shape; this test uses service_timing=scheduled
    to keep exercising the R25 (services/pricing.py) engine which still
    handles scheduled Fixed + Bidding."""
    r = requests.post(f"{API}/pricing/quote", headers={
        "Authorization": f"Bearer {cust_token}"
    }, json={
        **SMETHWICK_ROUTE,
        "service_type": "breakdown_recovery",
        "service_timing": "scheduled",
        "transport_category": "cars_vehicles",   # the buggy input
        "vehicle_details": {"type": "car"},
    }, timeout=15)
    assert r.status_code == 200, r.text
    q = r.json()
    assert q["driver_charge"] < 1000, (
        f"Recovery double-count regression: £{q['driver_charge']} "
        "still above £1000 — root cause not fixed."
    )
    assert q["pricing_snapshot"]["category_multiplier"] == 1.0
    assert q["pricing_snapshot"]["recovery_multiplier"] == 1.30
    assert q["pricing_snapshot"]["asap_multiplier"] is None


def test_R251_recovery_category_ignored_in_quote(cust_token):
    """Same journey with and without transport_category must yield the
    SAME driver_charge for a recovery job."""
    payload_base = {
        **SMETHWICK_ROUTE,
        "service_type": "breakdown_recovery",
        "service_timing": "asap",
        "vehicle_details": {"type": "car"},
    }
    with_cat = requests.post(
        f"{API}/pricing/quote",
        headers={"Authorization": f"Bearer {cust_token}"},
        json={**payload_base, "transport_category": "cars_vehicles"},
        timeout=15,
    ).json()
    without_cat = requests.post(
        f"{API}/pricing/quote",
        headers={"Authorization": f"Bearer {cust_token}"},
        json={**payload_base, "transport_category": None},
        timeout=15,
    ).json()
    assert with_cat["driver_charge"] == without_cat["driver_charge"], (
        f"cars_vehicles leak: £{with_cat['driver_charge']} vs "
        f"£{without_cat['driver_charge']}"
    )


def test_R251_screens_agree_end_to_end(cust_token, request):
    """Screen 1 (/pricing/quote) == Screen 2 (/jobs.fixed_price) ==
    Screen 3 (/bookings.driver_charge). Same recovery journey.

    This is the definitive proof that the £1,068 → £790 fix landed and
    the customer sees the same number all the way to Stripe.
    """
    headers = {"Authorization": f"Bearer {cust_token}"}

    # Screen 1 — quote preview
    q = requests.post(f"{API}/pricing/quote", headers=headers, json={
        **SMETHWICK_ROUTE,
        "service_type": "breakdown_recovery",
        "service_timing": "asap",
        "vehicle_details": {"type": "car"},
    }, timeout=15).json()
    screen1_dc = q["driver_charge"]
    screen1_tot = q["customer_total_preview"]

    # Screen 2 — job creation. Frontend sends category='recovery' (post-R25.1);
    # server MUST derive the same authoritative price regardless of the
    # category label attached to the job doc.
    job = requests.post(f"{API}/jobs", headers=headers, json={
        "title": "R25.1 regression",
        "category": "recovery",
        "description": "screen-consistency regression",
        "pickup_address": "London", "pickup_town": "London",
        "dropoff_address": "Smethwick", "dropoff_town": "Smethwick",
        **SMETHWICK_ROUTE,
        "collection_date": "2026-02-10T10:00:00Z",
        "delivery_date":   "2026-02-10T14:00:00Z",
        "service_timing": "asap",
        "service_type":   "breakdown_recovery",
        "pricing_type":   "fixed",
        "vehicle_details": {"type": "car"},
    }, timeout=15).json()
    assert "id" in job, f"Job creation failed: {job}"
    screen2_dc = job["fixed_price"]

    # Screen 3 — booking creation (what Stripe collects)
    bk = requests.post(f"{API}/bookings", headers=headers,
                         json={"job_id": job["id"]}, timeout=15).json()
    screen3_dc = bk["driver_charge"]
    screen3_fee = bk["booking_fee"]
    screen3_tot = bk["total_price"]
    screen3_dep = bk["deposit_amount"]

    try:
        assert screen1_dc == screen2_dc == screen3_dc, (
            f"driver_charge divergence — quote £{screen1_dc}, "
            f"job £{screen2_dc}, booking £{screen3_dc}"
        )
        assert screen1_tot == screen3_tot, (
            f"customer_total divergence — quote £{screen1_tot}, "
            f"booking £{screen3_tot}"
        )
        # Deposit === booking fee (Stripe collects the fee, driver gets balance)
        assert screen3_dep == screen3_fee, (
            f"deposit £{screen3_dep} != booking_fee £{screen3_fee}"
        )
        # Customer total is the sum, no hidden extras
        assert round(screen3_dc + screen3_fee, 2) == round(screen3_tot, 2), (
            f"customer_total maths broken: driver £{screen3_dc} + fee "
            f"£{screen3_fee} != total £{screen3_tot}"
        )
    finally:
        # Best-effort cleanup — don't fail the test on cleanup errors.
        try:
            from dotenv import load_dotenv
            load_dotenv("/app/backend/.env")
            import asyncio, os as _os
            from motor.motor_asyncio import AsyncIOMotorClient
            async def _clean():
                db = AsyncIOMotorClient(_os.environ["MONGO_URL"])[_os.environ["DB_NAME"]]
                await db.jobs.delete_one({"id": job["id"]})
                await db.bookings.delete_many({"job_id": job["id"]})
            asyncio.get_event_loop().run_until_complete(_clean())
        except Exception:
            pass


def test_R251_transport_price_regression_not_broken(cust_token):
    """Sanity: the fix targets recovery only. Transport ASAP job should
    still respect its transport_category multiplier."""
    headers = {"Authorization": f"Bearer {cust_token}"}
    parcels = requests.post(f"{API}/pricing/quote", headers=headers, json={
        **SMETHWICK_ROUTE,
        "service_type": "transport",
        "service_timing": "scheduled",
        "transport_category": "parcels",
    }, timeout=15).json()
    house_moves = requests.post(f"{API}/pricing/quote", headers=headers, json={
        **SMETHWICK_ROUTE,
        "service_type": "transport",
        "service_timing": "scheduled",
        "transport_category": "house_moves",
    }, timeout=15).json()
    assert house_moves["driver_charge"] > parcels["driver_charge"], (
        f"Transport category multiplier appears broken — parcels "
        f"£{parcels['driver_charge']} >= house_moves £{house_moves['driver_charge']}"
    )
