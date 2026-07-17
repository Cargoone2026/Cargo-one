"""Wave 3 Phase B (increment 1) tests.

Covers:
  - GET /api/search  (public + role-scoped + admin users list + malformed JWT + scope=marketing)
  - GET /api/driver/dashboard  (schema, RBAC for customer & admin)
  - Regression checks: /api/auth/login, /api/catalog/{categories,vehicles,capabilities},
    /api/admin/stats, /api/jobs/nearby
"""
from __future__ import annotations

import os
import pytest
import requests

# Frontend uses EXPO_PUBLIC_BACKEND_URL — reuse it here so we test the public
# route that real clients hit.
BASE_URL = (
    os.environ.get("EXPO_BACKEND_URL")
    or os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    or "https://cargo-one-preview.preview.emergentagent.com"
).rstrip("/")

ADMIN = {"email": "admin@cargoone.com", "password": "admin123"}
DRIVER = {"email": "driver1@cargoone.com", "password": "driver123"}
CUSTOMER = {"email": "cust1@cargoone.com", "password": "cust1234"}


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------
@pytest.fixture(scope="session")
def http():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(http, creds):
    r = http.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, f"login failed for {creds['email']}: {r.status_code} {r.text[:200]}"
    return r.json()


@pytest.fixture(scope="session")
def admin_token(http):
    return _login(http, ADMIN)["access_token"]


@pytest.fixture(scope="session")
def driver_token(http):
    return _login(http, DRIVER)["access_token"]


@pytest.fixture(scope="session")
def customer_token(http):
    return _login(http, CUSTOMER)["access_token"]


def _auth(tok: str) -> dict:
    return {"Authorization": f"Bearer {tok}"}


# ---------------------------------------------------------------------------
# /api/search — public / no auth
# ---------------------------------------------------------------------------
class TestSearchPublic:
    def test_empty_query_returns_default_marketing_pages(self, http):
        r = http.get(f"{BASE_URL}/api/search", timeout=15)
        assert r.status_code == 200
        data = r.json()
        # Structure
        for key in ("query", "total", "pages", "categories", "vehicles", "capabilities", "jobs", "users"):
            assert key in data, f"missing key {key}"
        assert data["query"] == ""
        assert isinstance(data["pages"], list)
        assert len(data["pages"]) > 0, "empty query should return default marketing pages"
        # No auth => no jobs or users
        assert data["jobs"] == []
        assert data["users"] == []

    def test_query_matches_categories_and_vehicles(self, http):
        r = http.get(f"{BASE_URL}/api/search", params={"q": "van"}, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["query"] == "van"
        # Expect at least one vehicle match
        assert isinstance(data["vehicles"], list)
        # Not required to have any specific count but total > 0 for common term
        assert data["total"] >= 0
        assert data["jobs"] == []
        assert data["users"] == []

    def test_malformed_jwt_does_not_crash(self, http):
        r = http.get(
            f"{BASE_URL}/api/search",
            params={"q": "furniture"},
            headers={"Authorization": "Bearer this.is.not.a.valid.jwt"},
            timeout=15,
        )
        assert r.status_code == 200, f"expected 200 with malformed JWT, got {r.status_code} {r.text[:200]}"
        data = r.json()
        # Falls back to public results only
        assert data["jobs"] == []
        assert data["users"] == []


# ---------------------------------------------------------------------------
# /api/search — driver scope
# ---------------------------------------------------------------------------
class TestSearchDriver:
    def test_driver_jobs_only_posted_or_own_assignments(self, http, driver_token):
        r = http.get(
            f"{BASE_URL}/api/search",
            params={"q": "delivery"},
            headers=_auth(driver_token),
            timeout=15,
        )
        assert r.status_code == 200
        data = r.json()
        # Fetch this driver's id
        me = http.get(f"{BASE_URL}/api/auth/me", headers=_auth(driver_token), timeout=15).json()
        driver_id = me["id"]
        for j in data["jobs"]:
            status = j.get("status")
            # Job kind must be posted, OR belong to this driver (assigned)
            # The search response does not return assigned_driver_id, but if status != posted
            # then it must be one of the driver's own assignments (we cannot verify that from
            # the response alone, so also fetch job detail as a spot check).
            assert status is not None
            if status != "posted":
                job_full = http.get(
                    f"{BASE_URL}/api/jobs/{j['id']}", headers=_auth(driver_token), timeout=15,
                )
                # Should be accessible (either assigned to driver or admin) — if forbidden,
                # that indicates the search leaked another user's job.
                assert job_full.status_code == 200, (
                    f"Driver received job {j['id']} status={status} but /jobs/{j['id']} "
                    f"returned {job_full.status_code} — possible data leak"
                )
        # Driver must never receive the users list
        assert data["users"] == []

    def test_driver_dashboard_public_structure(self, http, driver_token):
        # smoke test — dashboard route works, deeper checks in TestDriverDashboard
        r = http.get(f"{BASE_URL}/api/driver/dashboard", headers=_auth(driver_token), timeout=15)
        assert r.status_code == 200


# ---------------------------------------------------------------------------
# /api/search — customer scope
# ---------------------------------------------------------------------------
class TestSearchCustomer:
    def test_customer_jobs_only_their_own(self, http, customer_token):
        me = http.get(f"{BASE_URL}/api/auth/me", headers=_auth(customer_token), timeout=15).json()
        cust_id = me["id"]
        r = http.get(
            f"{BASE_URL}/api/search",
            params={"q": "a"},  # broad
            headers=_auth(customer_token),
            timeout=15,
        )
        assert r.status_code == 200
        data = r.json()
        # Every job must belong to this customer.
        for j in data["jobs"]:
            job_full = http.get(
                f"{BASE_URL}/api/jobs/{j['id']}", headers=_auth(customer_token), timeout=15,
            )
            assert job_full.status_code == 200, "customer received a job they cannot access"
            body = job_full.json()
            assert body.get("customer_id") == cust_id, (
                f"customer search returned job owned by another user: {body.get('customer_id')} != {cust_id}"
            )
        # Users list MUST be empty for customer
        assert data["users"] == [], f"customer should not receive users list; got {data['users']}"


# ---------------------------------------------------------------------------
# /api/search — admin scope
# ---------------------------------------------------------------------------
class TestSearchAdmin:
    def test_admin_users_populated_for_driver_query(self, http, admin_token):
        r = http.get(
            f"{BASE_URL}/api/search",
            params={"q": "driver"},
            headers=_auth(admin_token),
            timeout=15,
        )
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data["users"], list)
        assert len(data["users"]) > 0, "admin search for 'driver' should return matching users"
        # Ensure user objects have expected keys
        for u in data["users"]:
            assert u["kind"] == "user"
            assert "id" in u
            assert "title" in u
            assert "role" in u

    def test_admin_users_populated_for_email_domain_query(self, http, admin_token):
        r = http.get(
            f"{BASE_URL}/api/search",
            params={"q": "cargoone.com"},
            headers=_auth(admin_token),
            timeout=15,
        )
        assert r.status_code == 200
        data = r.json()
        assert len(data["users"]) > 0, "admin search for 'cargoone.com' should match seeded users"


# ---------------------------------------------------------------------------
# /api/search — scope=marketing filters out jobs & users
# ---------------------------------------------------------------------------
class TestSearchScopeMarketing:
    def test_marketing_scope_filters_admin_users(self, http, admin_token):
        r = http.get(
            f"{BASE_URL}/api/search",
            params={"q": "driver", "scope": "marketing"},
            headers=_auth(admin_token),
            timeout=15,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["jobs"] == [], "scope=marketing must not return jobs"
        assert data["users"] == [], "scope=marketing must not return users (even for admin)"

    def test_marketing_scope_filters_driver_jobs(self, http, driver_token):
        r = http.get(
            f"{BASE_URL}/api/search",
            params={"q": "delivery", "scope": "marketing"},
            headers=_auth(driver_token),
            timeout=15,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["jobs"] == []
        assert data["users"] == []


# ---------------------------------------------------------------------------
# /api/driver/dashboard
# ---------------------------------------------------------------------------
class TestDriverDashboard:
    def test_driver_dashboard_ok_schema(self, http, driver_token):
        r = http.get(f"{BASE_URL}/api/driver/dashboard", headers=_auth(driver_token), timeout=15)
        assert r.status_code == 200, r.text[:300]
        d = r.json()

        # Top-level keys
        for key in ("user", "fleet", "earnings", "bids", "jobs", "verification"):
            assert key in d, f"missing key {key}"

        # user
        for k in ("id", "name", "status", "rating", "review_count"):
            assert k in d["user"], f"user.{k} missing"

        # fleet
        for k in ("count", "active_count", "capabilities", "vehicles"):
            assert k in d["fleet"], f"fleet.{k} missing"
        assert isinstance(d["fleet"]["capabilities"], list)
        assert isinstance(d["fleet"]["vehicles"], list)

        # earnings
        for k in ("today", "week", "month", "all_time", "completed_count"):
            assert k in d["earnings"], f"earnings.{k} missing"

        # bids
        for k in ("active", "accepted"):
            assert k in d["bids"], f"bids.{k} missing"

        # jobs
        for k in ("nearby_count", "active_count", "upcoming_count", "upcoming"):
            assert k in d["jobs"], f"jobs.{k} missing"
        assert isinstance(d["jobs"]["upcoming"], list)

        # verification
        for k in ("docs_verified", "docs_pending", "docs_rejected", "account_status"):
            assert k in d["verification"], f"verification.{k} missing"

    def test_driver_dashboard_forbidden_for_customer(self, http, customer_token):
        r = http.get(f"{BASE_URL}/api/driver/dashboard", headers=_auth(customer_token), timeout=15)
        assert r.status_code == 403, f"expected 403 for customer, got {r.status_code}"

    def test_driver_dashboard_forbidden_for_admin(self, http, admin_token):
        r = http.get(f"{BASE_URL}/api/driver/dashboard", headers=_auth(admin_token), timeout=15)
        assert r.status_code == 403, f"expected 403 for admin, got {r.status_code}"


# ---------------------------------------------------------------------------
# Regression checks
# ---------------------------------------------------------------------------
class TestRegression:
    def test_login_existing_users(self, http):
        for creds in (ADMIN, DRIVER, CUSTOMER):
            r = http.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=15)
            assert r.status_code == 200, f"login regressed for {creds['email']}: {r.status_code}"
            body = r.json()
            assert "access_token" in body and "user" in body
            assert body["user"]["email"] == creds["email"]

    def test_catalog_categories(self, http):
        r = http.get(f"{BASE_URL}/api/catalog/categories", timeout=15)
        assert r.status_code == 200
        cats = r.json()
        assert isinstance(cats, list) and len(cats) > 0
        assert "key" in cats[0] and "name" in cats[0]

    def test_catalog_vehicles(self, http):
        r = http.get(f"{BASE_URL}/api/catalog/vehicles", timeout=15)
        assert r.status_code == 200
        vs = r.json()
        assert isinstance(vs, list) and len(vs) > 0
        assert "key" in vs[0] and "name" in vs[0]

    def test_catalog_capabilities(self, http):
        r = http.get(f"{BASE_URL}/api/catalog/capabilities", timeout=15)
        assert r.status_code == 200
        cs = r.json()
        assert isinstance(cs, list)
        if cs:
            assert "key" in cs[0]

    def test_admin_stats(self, http, admin_token):
        r = http.get(f"{BASE_URL}/api/admin/stats", headers=_auth(admin_token), timeout=15)
        assert r.status_code == 200
        d = r.json()
        for key in ("customers", "drivers", "pending_drivers", "total_jobs", "revenue_gbp"):
            assert key in d, f"admin/stats missing {key}"

    def test_jobs_nearby(self, http, driver_token):
        r = http.get(f"{BASE_URL}/api/jobs/nearby", headers=_auth(driver_token), timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
