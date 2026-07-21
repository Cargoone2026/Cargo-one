"""Wave 3 Pre-Launch Increment B tests — international address + routing.

Covers:
  - GET /api/geo/markets (public): 16 markets, GB pricing_configured true, others false.
  - GET /api/geo/autocomplete (public): short-query fallback, no-Google-key fallback.
  - GET /api/quote/estimate (auth required — cust1):
        * UK -> UK domestic (with country codes GB/GB) -> domestic_uk, priced
        * GB -> IE -> international, requires_manual_review, price=null
        * FR -> FR -> domestic_other, requires_manual_review, price=null
        * legacy (no country codes) -> domestic_uk, priced
        * CN dropoff -> unsupported, requires_manual_review, price=null
  - POST /api/jobs (auth: customer):
        * UK-only (no country codes) -> status=posted, route_class=domestic_uk
        * GB->IE (with country codes) -> status=awaiting_manual_quote,
          route_class=international, new address fields round-trip via GET /api/jobs/{id}.
"""
from __future__ import annotations

import os
import uuid
import pytest
import requests

BASE_URL = (
    os.environ.get("EXPO_BACKEND_URL")
    or os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    or "https://cargo-port.preview.emergentagent.com"
).rstrip("/")

ADMIN = {"email": "admin@cargoone.com", "password": os.environ.get("TEST_ADMIN_PASSWORD", "admin123")}
CUSTOMER = {"email": "cust1@cargoone.com", "password": "cust1234"}


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------
@pytest.fixture(scope="module")
def http():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(http, creds):
    r = http.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, f"login failed for {creds['email']}: {r.status_code} {r.text[:200]}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def customer_token(http):
    return _login(http, CUSTOMER)


def _auth(tok: str) -> dict:
    return {"Authorization": f"Bearer {tok}"}


# ---------------------------------------------------------------------------
# GEO endpoints — public
# ---------------------------------------------------------------------------
class TestGeoMarkets:
    def test_markets_returns_16_entries_and_gb_configured(self, http):
        r = http.get(f"{BASE_URL}/api/geo/markets", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "markets" in data and "count" in data
        assert data["count"] == 16
        assert isinstance(data["markets"], list)
        assert len(data["markets"]) == 16

        by_iso = {m["iso2"]: m for m in data["markets"]}
        # Required countries at minimum
        for iso in ("GB", "IE", "FR"):
            assert iso in by_iso, f"missing market {iso}"

        # GB must be pricing_configured=True
        assert by_iso["GB"]["pricing_configured"] is True
        # All others must be pricing_configured=False
        for iso, m in by_iso.items():
            if iso == "GB":
                continue
            assert m["pricing_configured"] is False, (
                f"{iso} should not be pricing_configured yet: {m}"
            )

    def test_markets_shape_has_required_fields(self, http):
        r = http.get(f"{BASE_URL}/api/geo/markets", timeout=15)
        data = r.json()
        required = {"iso2", "iso3", "name", "currency", "calling_code",
                    "postal_code_label", "pricing_configured"}
        for m in data["markets"]:
            missing = required - set(m.keys())
            assert not missing, f"market {m.get('iso2')} missing fields {missing}"

    def test_markets_is_public_no_auth_required(self, http):
        # No Authorization header — must succeed.
        r = requests.get(f"{BASE_URL}/api/geo/markets", timeout=15)
        assert r.status_code == 200


class TestGeoAutocomplete:
    def test_short_query_returns_empty_manual(self, http):
        r = http.get(f"{BASE_URL}/api/geo/autocomplete", params={"q": "s"}, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("suggestions") == []
        assert data.get("source") == "manual"

    def test_empty_query_returns_empty_manual(self, http):
        r = http.get(f"{BASE_URL}/api/geo/autocomplete", params={"q": ""}, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data.get("suggestions") == []
        assert data.get("source") == "manual"

    def test_no_google_key_fallback_returns_manual(self, http):
        # In this env GOOGLE_MAPS_API_KEY is empty or 'placeholder…' — endpoint
        # must return an empty suggestions list, source=manual, and echo the query.
        r = http.get(f"{BASE_URL}/api/geo/autocomplete", params={"q": "SW1A"}, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("suggestions") == []
        assert data.get("source") == "manual"
        assert data.get("query") == "SW1A"

    def test_autocomplete_is_public_no_auth_required(self, http):
        r = requests.get(f"{BASE_URL}/api/geo/autocomplete", params={"q": "SW1A"}, timeout=15)
        assert r.status_code == 200


# ---------------------------------------------------------------------------
# GET /api/quote/estimate — auth required
# ---------------------------------------------------------------------------
# Sample coordinates
LON = (51.5074, -0.1278)      # London, GB
MAN = (53.4808, -2.2426)      # Manchester, GB
DUB = (53.3498, -6.2603)      # Dublin, IE
PAR = (48.8566, 2.3522)       # Paris, FR
LYO = (45.7640, 4.8357)       # Lyon, FR


class TestQuoteEstimate:
    def _quote(self, http, token, **params):
        r = http.get(
            f"{BASE_URL}/api/quote/estimate",
            params=params,
            headers=_auth(token),
            timeout=20,
        )
        return r

    def test_requires_auth(self, http):
        r = http.get(
            f"{BASE_URL}/api/quote/estimate",
            params={
                "pickup_lat": LON[0], "pickup_lng": LON[1],
                "dropoff_lat": MAN[0], "dropoff_lng": MAN[1],
            },
            timeout=15,
        )
        assert r.status_code in (401, 403), f"expected auth error, got {r.status_code}"

    def test_uk_to_uk_with_country_codes(self, http, customer_token):
        r = self._quote(
            http, customer_token,
            pickup_lat=LON[0], pickup_lng=LON[1],
            dropoff_lat=MAN[0], dropoff_lng=MAN[1],
            pickup_country_code="GB", dropoff_country_code="GB",
            category="furniture_delivery",
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["route_class"] == "domestic_uk"
        assert d["requires_manual_review"] is False
        assert d["manual_review_message"] is None
        assert isinstance(d["suggested_price"], (int, float))
        assert d["suggested_price"] > 0
        assert d["origin_country_code"] == "GB"
        assert d["destination_country_code"] == "GB"

    def test_gb_to_ie_international(self, http, customer_token):
        r = self._quote(
            http, customer_token,
            pickup_lat=LON[0], pickup_lng=LON[1],
            dropoff_lat=DUB[0], dropoff_lng=DUB[1],
            pickup_country_code="GB", dropoff_country_code="IE",
            category="furniture_delivery",
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["route_class"] == "international"
        assert d["requires_manual_review"] is True
        assert d["suggested_price"] is None
        assert d["origin_country_code"] == "GB"
        assert d["destination_country_code"] == "IE"
        msg = d["manual_review_message"] or ""
        assert "United Kingdom" in msg
        assert "Republic of Ireland" in msg

    def test_fr_to_fr_domestic_other(self, http, customer_token):
        r = self._quote(
            http, customer_token,
            pickup_lat=PAR[0], pickup_lng=PAR[1],
            dropoff_lat=LYO[0], dropoff_lng=LYO[1],
            pickup_country_code="FR", dropoff_country_code="FR",
            category="furniture_delivery",
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["route_class"] == "domestic_other"
        assert d["requires_manual_review"] is True
        assert d["suggested_price"] is None
        assert d["origin_country_code"] == "FR"
        assert d["destination_country_code"] == "FR"

    def test_legacy_no_country_codes_defaults_uk(self, http, customer_token):
        r = self._quote(
            http, customer_token,
            pickup_lat=LON[0], pickup_lng=LON[1],
            dropoff_lat=MAN[0], dropoff_lng=MAN[1],
            category="furniture_delivery",
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["route_class"] == "domestic_uk"
        assert d["requires_manual_review"] is False
        assert isinstance(d["suggested_price"], (int, float))
        assert d["suggested_price"] > 0
        # Default country falls back to GB
        assert d["origin_country_code"] == "GB"
        assert d["destination_country_code"] == "GB"

    def test_unsupported_country_dropoff(self, http, customer_token):
        r = self._quote(
            http, customer_token,
            pickup_lat=LON[0], pickup_lng=LON[1],
            dropoff_lat=39.9042, dropoff_lng=116.4074,  # Beijing
            pickup_country_code="GB", dropoff_country_code="CN",
            category="furniture_delivery",
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["route_class"] == "unsupported"
        assert d["requires_manual_review"] is True
        assert d["suggested_price"] is None


# ---------------------------------------------------------------------------
# POST /api/jobs — new international address fields
# ---------------------------------------------------------------------------
def _base_job_payload(**overrides) -> dict:
    payload = {
        "title": f"TEST_intl_job_{uuid.uuid4().hex[:8]}",
        "category": "furniture_delivery",
        "description": "TEST job for international routing tests. Please ignore.",
        "photos": [],
        "pickup_address": "10 Downing Street, London",
        "pickup_town": "London",
        "pickup_lat": LON[0],
        "pickup_lng": LON[1],
        "dropoff_address": "1 Deansgate, Manchester",
        "dropoff_town": "Manchester",
        "dropoff_lat": MAN[0],
        "dropoff_lng": MAN[1],
        "collection_date": "2026-02-01",
        "delivery_date": "2026-02-02",
        "pricing_type": "fixed",
        "fixed_price": 250.0,
    }
    payload.update(overrides)
    return payload


class TestJobsIntlAddressing:
    def test_uk_only_no_country_codes_posted(self, http, customer_token):
        payload = _base_job_payload()
        r = http.post(
            f"{BASE_URL}/api/jobs",
            json=payload,
            headers=_auth(customer_token),
            timeout=20,
        )
        assert r.status_code in (200, 201), r.text
        job = r.json()
        assert job["status"] == "posted"
        assert job["route_class"] == "domestic_uk"
        assert isinstance(job.get("suggested_price"), (int, float))
        assert job["suggested_price"] > 0

        # Round-trip via GET /api/jobs/{id}
        job_id = job["id"]
        r2 = http.get(
            f"{BASE_URL}/api/jobs/{job_id}",
            headers=_auth(customer_token),
            timeout=15,
        )
        assert r2.status_code == 200, r2.text
        j2 = r2.json()
        assert j2["status"] == "posted"
        assert j2["route_class"] == "domestic_uk"

    def test_gb_to_ie_awaiting_manual_quote(self, http, customer_token):
        payload = _base_job_payload(
            title=f"TEST_intl_gbie_{uuid.uuid4().hex[:8]}",
            pickup_address="10 Downing Street, London",
            pickup_town="London",
            pickup_lat=LON[0], pickup_lng=LON[1],
            pickup_postcode="SW1A 2AA",
            pickup_region="Greater London",
            pickup_country="United Kingdom",
            pickup_country_code="GB",
            pickup_place_id="TEST_place_london_001",
            dropoff_address="O'Connell Street, Dublin",
            dropoff_town="Dublin",
            dropoff_lat=DUB[0], dropoff_lng=DUB[1],
            dropoff_postcode="D01 F5P2",
            dropoff_region="Leinster",
            dropoff_country="Republic of Ireland",
            dropoff_country_code="IE",
            dropoff_place_id="TEST_place_dublin_001",
        )
        r = http.post(
            f"{BASE_URL}/api/jobs",
            json=payload,
            headers=_auth(customer_token),
            timeout=20,
        )
        assert r.status_code in (200, 201), r.text
        job = r.json()
        assert job["status"] == "awaiting_manual_quote"
        assert job["route_class"] == "international"
        assert job.get("suggested_price") is None
        assert job["pickup_country_code"] == "GB"
        assert job["dropoff_country_code"] == "IE"

        # Round-trip via GET /api/jobs/{id}
        job_id = job["id"]
        r2 = http.get(
            f"{BASE_URL}/api/jobs/{job_id}",
            headers=_auth(customer_token),
            timeout=15,
        )
        assert r2.status_code == 200, r2.text
        j2 = r2.json()
        assert j2["status"] == "awaiting_manual_quote"
        assert j2["route_class"] == "international"

        # New extended address fields must persist and round-trip
        assert j2["pickup_postcode"] == "SW1A 2AA"
        assert j2["pickup_country"] == "United Kingdom"
        assert j2["pickup_country_code"] == "GB"
        assert j2["pickup_place_id"] == "TEST_place_london_001"
        assert j2["dropoff_postcode"] == "D01 F5P2"
        assert j2["dropoff_country"] == "Republic of Ireland"
        assert j2["dropoff_country_code"] == "IE"
        assert j2["dropoff_place_id"] == "TEST_place_dublin_001"
