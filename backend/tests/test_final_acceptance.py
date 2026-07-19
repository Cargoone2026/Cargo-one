"""Cargo One — FINAL PRE-PRODUCTION ACCEPTANCE TEST.

Covers 9 acceptance criteria (AC-1 … AC-9) end-to-end against the deployed
backend at $EXPO_PUBLIC_BACKEND_URL. Uses the seeded accounts:
    admin@cargoone.com  / admin123
    cust1@cargoone.com  / cust1234
    driver1@cargoone.com/ driver123

Tests are ordered so the driver-verification flow (AC-7) always resets the
seeded driver back to `active` at the end so subsequent runs are idempotent.
"""
from __future__ import annotations

import os
import time
import uuid

import pytest
import requests

BASE_URL = (
    os.environ.get("EXPO_BACKEND_URL")
    or os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    or "https://cargo-one-preview.preview.emergentagent.com"
).rstrip("/")

ADMIN = {"email": "admin@cargoone.com", "password": "admin123"}
CUSTOMER = {"email": "cust1@cargoone.com", "password": "cust1234"}
DRIVER1 = {"email": "driver1@cargoone.com", "password": "driver123"}

# Reference coordinates
LON = (51.5074, -0.1278)      # London, GB
MAN = (53.4808, -2.2426)      # Manchester, GB
BEL = (54.5973, -5.9301)      # Belfast, GB (Northern Ireland)
DUB = (53.3498, -6.2603)      # Dublin, IE
PAR = (48.8566, 2.3522)       # Paris, FR
BER = (52.5200, 13.4050)      # Berlin, DE


# --------------------------------------------------------------------------- #
# Fixtures                                                                    #
# --------------------------------------------------------------------------- #
@pytest.fixture(scope="module")
def http() -> requests.Session:
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(http: requests.Session, creds: dict) -> str:
    r = http.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, f"login {creds['email']}: {r.status_code} {r.text[:200]}"
    return r.json()["access_token"]


def _auth(tok: str) -> dict:
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def admin_token(http):
    return _login(http, ADMIN)


@pytest.fixture(scope="module")
def customer_token(http):
    return _login(http, CUSTOMER)


@pytest.fixture(scope="module")
def driver_id(http, admin_token):
    """Look up driver1's user id via /api/admin/users?role=driver."""
    r = http.get(
        f"{BASE_URL}/api/admin/users",
        params={"role": "driver"},
        headers=_auth(admin_token),
        timeout=15,
    )
    assert r.status_code == 200, r.text
    users = r.json()
    match = next((u for u in users if u.get("email") == DRIVER1["email"]), None)
    assert match, f"seeded driver {DRIVER1['email']} not found: {[u['email'] for u in users]}"
    return match["id"]


# --------------------------------------------------------------------------- #
# AC-1: UK domestic quote                                                     #
# --------------------------------------------------------------------------- #
class TestAC1_UKDomesticQuote:
    def test_gb_gb_domestic_returns_price(self, http, customer_token):
        r = http.get(
            f"{BASE_URL}/api/quote/estimate",
            params={
                "pickup_lat": LON[0], "pickup_lng": LON[1],
                "dropoff_lat": MAN[0], "dropoff_lng": MAN[1],
                "pickup_country_code": "GB", "dropoff_country_code": "GB",
                "category": "furniture_delivery",
            },
            headers=_auth(customer_token),
            timeout=15,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["route_class"] == "domestic_uk"
        assert d["requires_manual_review"] is False
        assert isinstance(d["suggested_price"], (int, float))
        assert d["suggested_price"] > 0

    def test_deposit_bands_still_returns_bands(self, http, customer_token):
        r = http.get(
            f"{BASE_URL}/api/deposit-bands",
            headers=_auth(customer_token),
            timeout=15,
        )
        assert r.status_code == 200, r.text
        bands = r.json()
        assert isinstance(bands, list)
        assert len(bands) >= 1
        # Sanity: each band should have min_price / percent-like fields
        first = bands[0]
        assert "min_price" in first or "min" in first or "id" in first


# --------------------------------------------------------------------------- #
# AC-2: Northern Ireland (Belfast) is still UK domestic                       #
# --------------------------------------------------------------------------- #
class TestAC2_NorthernIrelandDomestic:
    def test_belfast_dropoff_domestic_uk(self, http, customer_token):
        r = http.get(
            f"{BASE_URL}/api/quote/estimate",
            params={
                "pickup_lat": LON[0], "pickup_lng": LON[1],
                "dropoff_lat": BEL[0], "dropoff_lng": BEL[1],
                "pickup_country_code": "GB", "dropoff_country_code": "GB",
                "category": "furniture_delivery",
            },
            headers=_auth(customer_token),
            timeout=15,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["route_class"] == "domestic_uk"
        assert d["requires_manual_review"] is False
        assert isinstance(d["suggested_price"], (int, float))
        assert d["suggested_price"] > 0


# --------------------------------------------------------------------------- #
# AC-3: GB → IE international                                                  #
# --------------------------------------------------------------------------- #
class TestAC3_GBtoIE:
    def test_gb_ie_international_manual_review(self, http, customer_token):
        r = http.get(
            f"{BASE_URL}/api/quote/estimate",
            params={
                "pickup_lat": LON[0], "pickup_lng": LON[1],
                "dropoff_lat": DUB[0], "dropoff_lng": DUB[1],
                "pickup_country_code": "GB", "dropoff_country_code": "IE",
                "category": "furniture_delivery",
            },
            headers=_auth(customer_token),
            timeout=15,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["route_class"] == "international"
        assert d["requires_manual_review"] is True
        assert d["suggested_price"] is None
        msg = d.get("manual_review_message") or ""
        assert "United Kingdom" in msg, f"missing UK in message: {msg}"
        assert "Republic of Ireland" in msg or "Ireland" in msg, f"missing IE in message: {msg}"


# --------------------------------------------------------------------------- #
# AC-4: IE → GB reverse international                                          #
# --------------------------------------------------------------------------- #
class TestAC4_IEtoGB:
    def test_ie_gb_international_manual_review(self, http, customer_token):
        r = http.get(
            f"{BASE_URL}/api/quote/estimate",
            params={
                "pickup_lat": DUB[0], "pickup_lng": DUB[1],
                "dropoff_lat": LON[0], "dropoff_lng": LON[1],
                "pickup_country_code": "IE", "dropoff_country_code": "GB",
                "category": "furniture_delivery",
            },
            headers=_auth(customer_token),
            timeout=15,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["route_class"] == "international"
        assert d["requires_manual_review"] is True
        assert d["suggested_price"] is None


# --------------------------------------------------------------------------- #
# AC-5: European routes                                                       #
# --------------------------------------------------------------------------- #
class TestAC5_EuropeanRoutes:
    def test_london_paris_international(self, http, customer_token):
        r = http.get(
            f"{BASE_URL}/api/quote/estimate",
            params={
                "pickup_lat": LON[0], "pickup_lng": LON[1],
                "dropoff_lat": PAR[0], "dropoff_lng": PAR[1],
                "pickup_country_code": "GB", "dropoff_country_code": "FR",
                "category": "furniture_delivery",
            },
            headers=_auth(customer_token),
            timeout=15,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["route_class"] == "international"
        assert d["requires_manual_review"] is True
        assert d["suggested_price"] is None

    def test_dublin_berlin_international(self, http, customer_token):
        r = http.get(
            f"{BASE_URL}/api/quote/estimate",
            params={
                "pickup_lat": DUB[0], "pickup_lng": DUB[1],
                "dropoff_lat": BER[0], "dropoff_lng": BER[1],
                "pickup_country_code": "IE", "dropoff_country_code": "DE",
                "category": "furniture_delivery",
            },
            headers=_auth(customer_token),
            timeout=15,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["route_class"] == "international"
        assert d["requires_manual_review"] is True
        assert d["suggested_price"] is None


# --------------------------------------------------------------------------- #
# AC-6: Legacy UK job (no country codes) — backwards compat                    #
# --------------------------------------------------------------------------- #
class TestAC6_LegacyUKJob:
    def test_legacy_job_creates_posted_domestic_uk(self, http, customer_token):
        payload = {
            "title": f"TEST_legacy_uk_{uuid.uuid4().hex[:8]}",
            "category": "furniture_delivery",
            "description": "TEST legacy UK job — no country codes.",
            "photos": [],
            "pickup_address": "10 Downing Street, London",
            "pickup_town": "London",
            "pickup_lat": LON[0], "pickup_lng": LON[1],
            "dropoff_address": "1 Deansgate, Manchester",
            "dropoff_town": "Manchester",
            "dropoff_lat": MAN[0], "dropoff_lng": MAN[1],
            "collection_date": "2026-02-01",
            "delivery_date": "2026-02-02",
            "pricing_type": "fixed",
            "fixed_price": 180.0,
        }
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
        job_id = job["id"]

        # Round-trip via GET /api/jobs/{id}
        r2 = http.get(
            f"{BASE_URL}/api/jobs/{job_id}",
            headers=_auth(customer_token),
            timeout=15,
        )
        assert r2.status_code == 200, r2.text
        j2 = r2.json()
        assert j2["status"] == "posted"
        assert j2["route_class"] == "domestic_uk"


# --------------------------------------------------------------------------- #
# AC-7: Driver verification flow                                              #
# --------------------------------------------------------------------------- #
class TestAC7_DriverVerificationFlow:
    """Full lifecycle: reset → request-changes → resubmit → approve.

    The driver may start in any state (pending / changes_requested / active).
    We first approve to reset to `active`, then step through the full flow.
    """

    def test_00_reset_driver_to_active(self, http, admin_token, driver_id):
        r = http.post(
            f"{BASE_URL}/api/admin/users/{driver_id}/approve",
            headers=_auth(admin_token),
            timeout=15,
        )
        assert r.status_code == 200, r.text
        # Verify
        r2 = http.get(
            f"{BASE_URL}/api/admin/drivers/{driver_id}",
            headers=_auth(admin_token),
            timeout=15,
        )
        assert r2.status_code == 200, r2.text
        assert r2.json()["user"]["status"] == "active"

    def test_01_admin_get_driver_detail(self, http, admin_token, driver_id):
        r = http.get(
            f"{BASE_URL}/api/admin/drivers/{driver_id}",
            headers=_auth(admin_token),
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["user"]["id"] == driver_id
        assert data["user"]["role"] == "driver"
        assert "documents" in data
        # verification_history is nested under `user` per the admin_driver_detail schema
        assert "verification_history" in data["user"]

    def test_02_admin_request_changes(self, http, admin_token, driver_id):
        r = http.post(
            f"{BASE_URL}/api/admin/users/{driver_id}/request-changes",
            json={
                "reason": "Please re-upload a clearer copy of your driving licence.",
                "doc_types": ["driving_licence"],
            },
            headers=_auth(admin_token),
            timeout=15,
        )
        assert r.status_code == 200, r.text

    def test_03_driver_me_shows_changes_requested(self, http):
        tok = _login(http, DRIVER1)
        r = http.get(
            f"{BASE_URL}/api/auth/me",
            headers=_auth(tok),
            timeout=15,
        )
        assert r.status_code == 200, r.text
        me = r.json()
        assert me["status"] == "changes_requested"
        assert me.get("changes_requested_reason")
        assert len(me["changes_requested_reason"]) >= 10
        assert me.get("changes_requested_doc_types") == ["driving_licence"]

    def test_04_driver_resubmit_verification(self, http):
        tok = _login(http, DRIVER1)
        r = http.post(
            f"{BASE_URL}/api/auth/me/resubmit-verification",
            headers=_auth(tok),
            timeout=15,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("status") == "pending"

        # Verify via GET /me
        r2 = http.get(
            f"{BASE_URL}/api/auth/me",
            headers=_auth(tok),
            timeout=15,
        )
        assert r2.status_code == 200
        assert r2.json()["status"] == "pending"

    def test_05_admin_approve(self, http, admin_token, driver_id):
        r = http.post(
            f"{BASE_URL}/api/admin/users/{driver_id}/approve",
            headers=_auth(admin_token),
            timeout=15,
        )
        assert r.status_code == 200, r.text

    def test_06_verification_history_contains_all_three(
        self, http, admin_token, driver_id
    ):
        r = http.get(
            f"{BASE_URL}/api/admin/drivers/{driver_id}",
            headers=_auth(admin_token),
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        history = data.get("verification_history") or data["user"].get(
            "verification_history"
        ) or []
        actions = [h["action"] for h in history]
        # Must contain at least the three we just performed (there may be
        # earlier history entries from prior runs — that's fine).
        assert "request_changes" in actions, actions
        assert "resubmit" in actions, actions
        assert "approve" in actions, actions

        # And the LAST three (in insertion order) should be exactly these:
        last_three = actions[-3:]
        assert last_three == ["request_changes", "resubmit", "approve"], (
            f"expected last 3 to be request_changes/resubmit/approve, got {last_three}"
        )
        # Final status must be active
        assert data["user"]["status"] == "active"


# --------------------------------------------------------------------------- #
# AC-8: Admin route audit                                                     #
# --------------------------------------------------------------------------- #
ADMIN_ENDPOINTS = [
    ("GET", "/api/admin/stats", None),
    ("GET", "/api/admin/users", {"role": "customer"}),
    ("GET", "/api/admin/users", {"role": "driver"}),
    ("GET", "/api/admin/jobs", None),
    ("GET", "/api/admin/analytics/overview", None),
    # /api/deposit-bands is authenticated-only (not admin-only) by design so
    # customers can preview during checkout. We still assert admin=200.
    ("GET", "/api/deposit-bands", None),
]


class TestAC8_AdminRouteAudit:
    def test_admin_can_access_all_admin_endpoints(
        self, http, admin_token, driver_id
    ):
        for method, path, params in ADMIN_ENDPOINTS:
            r = http.request(
                method,
                f"{BASE_URL}{path}",
                params=params,
                headers=_auth(admin_token),
                timeout=15,
            )
            assert r.status_code == 200, (
                f"admin {method} {path} params={params}: {r.status_code} {r.text[:200]}"
            )
        # Plus /api/admin/drivers/{driver1_id}
        r = http.get(
            f"{BASE_URL}/api/admin/drivers/{driver_id}",
            headers=_auth(admin_token),
            timeout=15,
        )
        assert r.status_code == 200, r.text

    def test_driver_cannot_access_admin_endpoints(self, http, driver_id):
        tok = _login(http, DRIVER1)
        # All /api/admin/* must be forbidden for driver
        admin_only = [
            ("GET", "/api/admin/stats", None),
            ("GET", "/api/admin/users", {"role": "customer"}),
            ("GET", "/api/admin/users", {"role": "driver"}),
            ("GET", "/api/admin/jobs", None),
            ("GET", "/api/admin/analytics/overview", None),
            ("GET", f"/api/admin/drivers/{driver_id}", None),
        ]
        for method, path, params in admin_only:
            r = http.request(
                method,
                f"{BASE_URL}{path}",
                params=params,
                headers=_auth(tok),
                timeout=15,
            )
            assert r.status_code == 403, (
                f"driver {method} {path} should be 403, got {r.status_code}"
            )

    def test_customer_cannot_access_admin_endpoints(
        self, http, customer_token, driver_id
    ):
        admin_only = [
            ("GET", "/api/admin/stats", None),
            ("GET", "/api/admin/users", {"role": "customer"}),
            ("GET", "/api/admin/users", {"role": "driver"}),
            ("GET", "/api/admin/jobs", None),
            ("GET", "/api/admin/analytics/overview", None),
            ("GET", f"/api/admin/drivers/{driver_id}", None),
        ]
        for method, path, params in admin_only:
            r = http.request(
                method,
                f"{BASE_URL}{path}",
                params=params,
                headers=_auth(customer_token),
                timeout=15,
            )
            assert r.status_code == 403, (
                f"customer {method} {path} should be 403, got {r.status_code}"
            )

    def test_no_admin_endpoint_accessible_without_jwt(self, http, driver_id):
        admin_only = [
            "/api/admin/stats",
            "/api/admin/users",
            "/api/admin/jobs",
            "/api/admin/analytics/overview",
            f"/api/admin/drivers/{driver_id}",
        ]
        for path in admin_only:
            r = requests.get(f"{BASE_URL}{path}", timeout=15)
            assert r.status_code in (401, 403), (
                f"no-auth {path} should reject, got {r.status_code}"
            )


# --------------------------------------------------------------------------- #
# AC-9: Security regression                                                   #
# --------------------------------------------------------------------------- #
class TestAC9_SecurityRegression:
    def test_register_as_admin_rejected(self, http):
        payload = {
            "email": f"TEST_admin_reject_{uuid.uuid4().hex[:8]}@example.com",
            "password": "somepass123",
            "name": "TEST Attacker",
            "role": "admin",
        }
        r = http.post(f"{BASE_URL}/api/auth/register", json=payload, timeout=15)
        assert r.status_code == 400, f"admin register must be 400, got {r.status_code}: {r.text[:200]}"

    def test_register_as_customer_succeeds(self, http):
        payload = {
            "email": f"TEST_cust_reg_{uuid.uuid4().hex[:8]}@example.com",
            "password": "somepass123",
            "name": "TEST Customer",
            "role": "customer",
        }
        r = http.post(f"{BASE_URL}/api/auth/register", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("access_token")
        assert data["user"]["role"] == "customer"

    def test_register_as_driver_succeeds(self, http):
        payload = {
            "email": f"TEST_drv_reg_{uuid.uuid4().hex[:8]}@example.com",
            "password": "somepass123",
            "name": "TEST Driver",
            "role": "driver",
        }
        r = http.post(f"{BASE_URL}/api/auth/register", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("access_token")
        assert data["user"]["role"] == "driver"
        assert data["user"]["status"] == "pending"

    def test_suspended_user_token_rejected(self, http, admin_token):
        # Create a fresh customer, capture its token, suspend, then reuse token.
        email = f"TEST_susp_{uuid.uuid4().hex[:8]}@example.com"
        reg = http.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": email,
                "password": "somepass123",
                "name": "TEST Suspend Victim",
                "role": "customer",
            },
            timeout=15,
        )
        assert reg.status_code == 200, reg.text
        original_token = reg.json()["access_token"]
        user_id = reg.json()["user"]["id"]

        # Verify token works before suspension
        r_pre = http.get(
            f"{BASE_URL}/api/auth/me",
            headers=_auth(original_token),
            timeout=15,
        )
        assert r_pre.status_code == 200, r_pre.text

        # Admin suspends
        s = http.post(
            f"{BASE_URL}/api/admin/users/{user_id}/suspend",
            json={"reason": "TEST suspension for AC-9 verification"},
            headers=_auth(admin_token),
            timeout=15,
        )
        assert s.status_code == 200, s.text

        # Reuse original token — MUST be 403 now
        r_post = http.get(
            f"{BASE_URL}/api/auth/me",
            headers=_auth(original_token),
            timeout=15,
        )
        assert r_post.status_code == 403, (
            f"suspended user token must be 403, got {r_post.status_code}: {r_post.text[:200]}"
        )
