"""Final QA Round 1 backend verification.

Focus areas:
  * BUG #11  — /api/payments/status/{session_id} is PUBLIC (no 401).
  * BUG #10  — ASAP transport + ASAP breakdown_recovery bookings persist
               booking_fee / booking_fee_percent / booking_fee_band_id /
               booking_fee_source and use the percentage-band engine.
  * REG      — /api/booking-fee-bands/preview returns correct tiers for
               the canonical Session F band boundaries.
"""

import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://cargo-repo-bridge.preview.emergentagent.com",
).rstrip("/")
API = f"{BASE_URL}/api"

CUSTOMER_EMAIL = "testcustomer@example.com"
CUSTOMER_PASSWORD = "CustomerTest12345!"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login {email} failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def customer_token():
    return _login(CUSTOMER_EMAIL, CUSTOMER_PASSWORD)


@pytest.fixture
def customer_headers(customer_token):
    return {"Authorization": f"Bearer {customer_token}", "Content-Type": "application/json"}


def _asap_job_payload(service_type: str, price: float, transport_category=None, transport_description=None):
    return {
        "title": f"TEST_ASAP {service_type}",
        "category": "cars_vehicles" if service_type == "breakdown_recovery" else "package_delivery",
        "description": "Automated QA test job",
        "pickup_address": "10 Downing St, London",
        "pickup_town": "London",
        "pickup_lat": 51.5034,
        "pickup_lng": -0.1276,
        "dropoff_address": "Buckingham Palace, London",
        "dropoff_town": "London",
        "dropoff_lat": 51.5014,
        "dropoff_lng": -0.1419,
        "weight_kg": 1500 if service_type == "breakdown_recovery" else 20,
        "collection_date": "2026-01-15T10:00:00Z",
        "delivery_date": "2026-01-15T16:00:00Z",
        "pricing_type": "fixed",
        "fixed_price": price,
        "service_timing": "asap",
        "service_type": service_type,
        "vehicle_details": (
            {"make": "Ford", "model": "Transit", "registration": "AB12CDE",
             "condition": "immobile", "rolls": True, "steers": True, "brakes": True}
            if service_type == "breakdown_recovery" else None
        ),
        "transport_category": transport_category,
        "transport_description": transport_description,
    }


# ---------------------------------------------------------------------------
# BUG #11  —  Public payment status endpoint
# ---------------------------------------------------------------------------
class TestPaymentStatusPublic:
    def test_unknown_session_returns_404_not_401(self):
        """Anonymous request must NOT be rejected by auth (401). 404 = auth
        passed, session simply not found."""
        r = requests.get(f"{API}/payments/status/{uuid.uuid4().hex}", timeout=20)
        assert r.status_code != 401, f"payment status is auth-gated: {r.status_code}"
        assert r.status_code == 404, f"expected 404 for unknown session, got {r.status_code} {r.text}"

    def test_real_session_reachable_anonymously(self, customer_headers):
        """Create a real booking + Stripe checkout row, then hit /payments/status
        anonymously (no Authorization header) — must return 200 with txn shape.

        Simulates Apple Pay redirect where Safari drops the session cookie.
        """
        # 1. Create an ASAP transport job (cheapest / fastest path).
        job_body = _asap_job_payload("transport", 200.0,
                                     transport_category="parcel",
                                     transport_description="QA test parcel")
        r = requests.post(f"{API}/jobs", headers=customer_headers, json=job_body, timeout=20)
        assert r.status_code == 200, f"job create failed: {r.status_code} {r.text}"
        job = r.json()

        # 2. Create the booking.
        r = requests.post(f"{API}/bookings", headers=customer_headers,
                          json={"job_id": job["id"]}, timeout=20)
        assert r.status_code == 200, f"booking create failed: {r.status_code} {r.text}"
        booking = r.json()

        # 3. Create Stripe checkout session (produces a session_id).
        r = requests.post(
            f"{API}/bookings/{booking['id']}/deposit",
            headers=customer_headers,
            json={"origin_url": BASE_URL},
            timeout=30,
        )
        if r.status_code != 200:
            pytest.skip(f"Stripe checkout not available in this env: {r.status_code} {r.text}")
        session_id = r.json().get("session_id") or r.json().get("id")
        assert session_id, f"no session_id in checkout response: {r.json()}"

        # 4. Anonymous poll — this is the critical check.
        anon = requests.get(f"{API}/payments/status/{session_id}", timeout=30)
        assert anon.status_code != 401, "payment-status endpoint is still auth-gated!"
        assert anon.status_code == 200, f"anon poll failed: {anon.status_code} {anon.text}"
        data = anon.json()
        for key in ("session_id", "status", "payment_status", "amount_total", "currency"):
            assert key in data, f"missing {key} in txn response: {data}"
        assert data["session_id"] == session_id


# ---------------------------------------------------------------------------
# REGRESSION  —  /booking-fee-bands/preview tier math
# ---------------------------------------------------------------------------
class TestBookingFeeBandsPreview:
    # (driver_charge, expected_percent)
    CASES = [
        (50,    15.0),
        (150,   15.0),
        (151,   14.0),
        (300,   14.0),
        (301,   13.0),
        (600,   13.0),
        (601,   12.0),
        (1000,  12.0),
        (1001,  10.0),
        (2500,  10.0),
    ]

    @pytest.mark.parametrize("driver_charge,expected_pct", CASES)
    def test_preview_bands(self, driver_charge, expected_pct):
        r = requests.get(f"{API}/booking-fee-bands/preview",
                         params={"driver_charge": driver_charge}, timeout=20)
        assert r.status_code == 200, f"preview failed for £{driver_charge}: {r.status_code} {r.text}"
        d = r.json()
        assert d["booking_fee_source"] == "booking_fee_bands", (
            f"£{driver_charge}: source={d.get('booking_fee_source')} (expected booking_fee_bands)"
        )
        assert d["booking_fee_percent"] == expected_pct, (
            f"£{driver_charge}: pct={d['booking_fee_percent']} (expected {expected_pct})"
        )
        expected_fee = round(driver_charge * expected_pct / 100.0, 2)
        assert abs(d["booking_fee"] - expected_fee) < 0.01, (
            f"£{driver_charge}: fee={d['booking_fee']} (expected {expected_fee})"
        )
        assert abs(d["customer_total"] - (driver_charge + expected_fee)) < 0.01


# ---------------------------------------------------------------------------
# BUG #10  —  ASAP bookings use the percentage-band engine
# ---------------------------------------------------------------------------
class TestAsapBookingFees:
    @pytest.mark.parametrize(
        "service_type,price,expected_pct",
        [
            ("transport",          500.0, 13.0),   # Band C
            ("transport",          100.0, 15.0),   # Band A
            ("breakdown_recovery", 500.0, 13.0),   # recovery uses same engine
            ("breakdown_recovery", 1200.0, 10.0),  # Band E
        ],
    )
    def test_asap_booking_persists_band_metadata(self, customer_headers,
                                                  service_type, price, expected_pct):
        job_body = _asap_job_payload(
            service_type, price,
            transport_category="pallets" if service_type == "transport" else None,
            transport_description="QA fee band test" if service_type == "transport" else None,
        )
        r = requests.post(f"{API}/jobs", headers=customer_headers, json=job_body, timeout=20)
        assert r.status_code == 200, f"job create failed: {r.status_code} {r.text}"
        job = r.json()

        # Verify transport_category / transport_description round-trip on the job
        if service_type == "transport":
            assert job.get("transport_category") == "pallets", (
                f"transport_category not persisted on job: {job.get('transport_category')}"
            )
            assert job.get("transport_description") == "QA fee band test", (
                f"transport_description not persisted on job: {job.get('transport_description')}"
            )

        r = requests.post(f"{API}/bookings", headers=customer_headers,
                          json={"job_id": job["id"]}, timeout=20)
        assert r.status_code == 200, f"booking create failed: {r.status_code} {r.text}"
        booking = r.json()

        # GET-verify persisted state (create → get pattern).
        r = requests.get(f"{API}/bookings/{booking['id']}", headers=customer_headers, timeout=20)
        assert r.status_code == 200, f"booking fetch failed: {r.status_code} {r.text}"
        fetched = r.json()

        assert fetched["booking_fee_source"] == "booking_fee_bands", (
            f"source={fetched.get('booking_fee_source')} — expected booking_fee_bands"
        )
        assert fetched["booking_fee_percent"] == expected_pct, (
            f"£{price} {service_type}: pct={fetched['booking_fee_percent']} (expected {expected_pct})"
        )
        expected_fee = round(price * expected_pct / 100.0, 2)
        assert abs(fetched["booking_fee"] - expected_fee) < 0.01
        assert abs(fetched["total_price"] - (fetched["driver_charge"] + fetched["booking_fee"])) < 0.01
        assert fetched["driver_charge"] == price
        assert fetched.get("booking_fee_band_id"), "booking_fee_band_id missing on booking"
        assert fetched["service_timing"] == "asap"
        assert fetched["service_type"] == service_type
