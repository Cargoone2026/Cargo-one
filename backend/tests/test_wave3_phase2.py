"""Wave 3 Phase 2 backend tests.

Covers only the NEW/CHANGED endpoints introduced in Wave 3 Phase 2:
  1) Vehicle capabilities catalog (public + admin CRUD)
  2) `featured` flag on categories and vehicles
  3) Driver fleet CRUD (/api/driver/vehicles)
  4) Enhanced /api/catalog/recommend-vehicle (required_capabilities + reason)
  5) /api/admin/analytics/overview
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("BACKEND_URL_OVERRIDE", "http://localhost:8001").rstrip("/")
ADMIN_EMAIL = "admin@cargoone.com"
ADMIN_PASSWORD = (os.environ.get("TEST_ADMIN_PASSWORD") or os.environ.get("INITIAL_ADMIN_PASSWORD") or "admin123")


def _hdr(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------------------------------------------------------------------------
# Session fixtures
# ---------------------------------------------------------------------------
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=15,
    )
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    body = r.json()
    return body.get("access_token") or body.get("token")


@pytest.fixture(scope="module")
def driver_token():
    email = f"TEST_w3p2_driver_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(
        f"{BASE_URL}/api/auth/register",
        json={
            "email": email,
            "password": "testpass123",
            "name": "TEST W3P2 Driver",
            "role": "driver",
        },
        timeout=15,
    )
    assert r.status_code in (200, 201), f"Driver register failed: {r.status_code} {r.text}"
    body = r.json()
    return body.get("access_token") or body.get("token")


@pytest.fixture(scope="module")
def customer_token():
    email = f"TEST_w3p2_cust_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(
        f"{BASE_URL}/api/auth/register",
        json={
            "email": email,
            "password": "testpass123",
            "name": "TEST W3P2 Customer",
            "role": "customer",
        },
        timeout=15,
    )
    assert r.status_code in (200, 201), r.text
    body = r.json()
    return body.get("access_token") or body.get("token")


# ---------------------------------------------------------------------------
# 1) VEHICLE CAPABILITIES CATALOG
# ---------------------------------------------------------------------------
class TestCapabilitiesCatalog:
    REQUIRED_KEYS = {"id", "key", "name", "description", "icon", "order", "active", "featured"}

    def test_public_list_returns_21_active(self):
        r = requests.get(f"{BASE_URL}/api/catalog/capabilities", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) == 21, f"expected 21 capabilities, got {len(data)}"
        assert all(c["active"] is True for c in data), "public list must be active-only"
        # Schema
        assert self.REQUIRED_KEYS.issubset(set(data[0].keys())), (
            f"missing keys: {self.REQUIRED_KEYS - set(data[0].keys())}"
        )
        assert isinstance(data[0]["featured"], bool)

    def test_public_include_inactive(self):
        r = requests.get(
            f"{BASE_URL}/api/catalog/capabilities?include_inactive=true", timeout=15,
        )
        assert r.status_code == 200
        assert len(r.json()) >= 21

    def test_admin_list_requires_admin(self, driver_token):
        r = requests.get(
            f"{BASE_URL}/api/admin/catalog/capabilities",
            headers=_hdr(driver_token), timeout=15,
        )
        assert r.status_code == 403, f"driver should get 403, got {r.status_code}"

    def test_admin_full_cycle(self, admin_token):
        # 1) admin list
        r = requests.get(
            f"{BASE_URL}/api/admin/catalog/capabilities",
            headers=_hdr(admin_token), timeout=15,
        )
        assert r.status_code == 200
        assert len(r.json()) >= 21

        # 2) Create (auto-key from name)
        unique_name = f"TEST W3P2 Cap {uuid.uuid4().hex[:6]}"
        expected_key = unique_name.lower().replace(" ", "_")
        create_payload = {
            "name": unique_name,
            "description": "temp capability for wave3-phase2 test",
            "icon": "star",
        }
        r_c = requests.post(
            f"{BASE_URL}/api/admin/catalog/capabilities",
            headers=_hdr(admin_token), json=create_payload, timeout=15,
        )
        assert r_c.status_code == 200, r_c.text
        created = r_c.json()
        cap_id = created["id"]
        assert created["key"] == expected_key, f"expected auto-key '{expected_key}', got '{created['key']}'"
        assert created["active"] is True
        assert created["featured"] is False

        try:
            # 3) Duplicate key -> 400
            r_dup = requests.post(
                f"{BASE_URL}/api/admin/catalog/capabilities",
                headers=_hdr(admin_token), json=create_payload, timeout=15,
            )
            assert r_dup.status_code == 400, r_dup.text

            # 4) PUT -> deactivate + feature
            # Note: `name` is required by model, include it
            r_u = requests.put(
                f"{BASE_URL}/api/admin/catalog/capabilities/{cap_id}",
                headers=_hdr(admin_token),
                json={"name": unique_name, "active": False, "featured": True},
                timeout=15,
            )
            assert r_u.status_code == 200, r_u.text
            upd = r_u.json()
            assert upd["active"] is False
            assert upd["featured"] is True

            # 5) Public GET (default) must exclude disabled
            r_pub = requests.get(f"{BASE_URL}/api/catalog/capabilities", timeout=15)
            keys_pub = [c["key"] for c in r_pub.json()]
            assert expected_key not in keys_pub, "disabled capability leaked into public list"

            # include_inactive=true still present
            r_pub_all = requests.get(
                f"{BASE_URL}/api/catalog/capabilities?include_inactive=true", timeout=15,
            )
            keys_all = [c["key"] for c in r_pub_all.json()]
            assert expected_key in keys_all
        finally:
            # 6) DELETE
            r_d = requests.delete(
                f"{BASE_URL}/api/admin/catalog/capabilities/{cap_id}",
                headers=_hdr(admin_token), timeout=15,
            )
            assert r_d.status_code == 200, r_d.text

        # Confirm removed
        r_after = requests.get(
            f"{BASE_URL}/api/admin/catalog/capabilities",
            headers=_hdr(admin_token), timeout=15,
        )
        keys_after = [c["key"] for c in r_after.json()]
        assert expected_key not in keys_after


# ---------------------------------------------------------------------------
# 2) FEATURED FLAG ON CATEGORIES & VEHICLES
# ---------------------------------------------------------------------------
class TestFeaturedFlags:
    def test_categories_have_featured_flag(self):
        r = requests.get(f"{BASE_URL}/api/catalog/categories", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert all("featured" in c for c in data), "featured missing on some categories"
        featured_count = sum(1 for c in data if c["featured"] is True)
        assert featured_count >= 10, f"expected >= 10 featured, got {featured_count}"

    def test_vehicles_have_featured_flag(self):
        r = requests.get(f"{BASE_URL}/api/catalog/vehicles", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert all("featured" in v for v in data), "featured missing on some vehicles"
        assert all(isinstance(v["featured"], bool) for v in data)

    def test_admin_toggle_featured_on_category(self, admin_token):
        # Pick a currently-featured category and toggle it off/on
        r_all = requests.get(
            f"{BASE_URL}/api/admin/catalog/categories",
            headers=_hdr(admin_token), timeout=15,
        )
        assert r_all.status_code == 200
        featured = [c for c in r_all.json() if c.get("featured")]
        assert featured, "expected at least one featured category to toggle"
        cat = featured[0]

        try:
            r_u = requests.put(
                f"{BASE_URL}/api/admin/catalog/categories/{cat['id']}",
                headers=_hdr(admin_token),
                json={"name": cat["name"], "featured": False},
                timeout=15,
            )
            assert r_u.status_code == 200, r_u.text
            assert r_u.json()["featured"] is False

            # Verify GET
            r_get = requests.get(f"{BASE_URL}/api/catalog/categories", timeout=15)
            got = next((c for c in r_get.json() if c["id"] == cat["id"]), None)
            assert got and got["featured"] is False
        finally:
            # Restore
            requests.put(
                f"{BASE_URL}/api/admin/catalog/categories/{cat['id']}",
                headers=_hdr(admin_token),
                json={"name": cat["name"], "featured": True},
                timeout=15,
            )

    def test_admin_toggle_featured_on_vehicle(self, admin_token):
        r_all = requests.get(
            f"{BASE_URL}/api/admin/catalog/vehicles",
            headers=_hdr(admin_token), timeout=15,
        )
        assert r_all.status_code == 200
        vehicles = r_all.json()
        assert vehicles
        v = vehicles[0]
        prev = bool(v.get("featured"))
        try:
            r_u = requests.put(
                f"{BASE_URL}/api/admin/catalog/vehicles/{v['id']}",
                headers=_hdr(admin_token),
                json={"name": v["name"], "featured": not prev},
                timeout=15,
            )
            assert r_u.status_code == 200, r_u.text
            assert r_u.json()["featured"] is (not prev)
        finally:
            requests.put(
                f"{BASE_URL}/api/admin/catalog/vehicles/{v['id']}",
                headers=_hdr(admin_token),
                json={"name": v["name"], "featured": prev},
                timeout=15,
            )


# ---------------------------------------------------------------------------
# 3) DRIVER FLEET CRUD
# ---------------------------------------------------------------------------
class TestDriverFleet:
    def test_full_fleet_lifecycle(self, driver_token):
        # 1) Initially empty
        r0 = requests.get(
            f"{BASE_URL}/api/driver/vehicles",
            headers=_hdr(driver_token), timeout=15,
        )
        assert r0.status_code == 200, r0.text
        assert r0.json() == [], f"expected empty list, got {r0.json()}"

        # 2) POST vehicle 1 (default)
        payload_1 = {
            "vehicle_type_key": "lwb_van",
            "registration": f"AB{uuid.uuid4().hex[:4].upper()} XYZ",
            "make": "Ford",
            "model": "Transit",
            "year": 2022,
            "payload_kg": 1000,
            "capabilities": ["tail_lift", "ulez_compliant"],
            "insurance_expiry": "2026-12-31",
            "mot_expiry": "2026-11-01",
            "is_default": True,
        }
        r1 = requests.post(
            f"{BASE_URL}/api/driver/vehicles",
            headers=_hdr(driver_token), json=payload_1, timeout=15,
        )
        assert r1.status_code == 200, r1.text
        v1 = r1.json()
        assert v1["id"]
        assert v1["driver_id"], "driver_id must be server-set"
        assert v1["vehicle_type_name"], "vehicle_type_name should be inferred from vehicle_type_key"
        assert v1["is_default"] is True
        assert set(v1["capabilities"]) == {"tail_lift", "ulez_compliant"}
        assert v1["registration"] == payload_1["registration"].upper()

        veh1_id = v1["id"]

        try:
            # 3) Duplicate registration for same driver -> 400
            r_dup = requests.post(
                f"{BASE_URL}/api/driver/vehicles",
                headers=_hdr(driver_token), json=payload_1, timeout=15,
            )
            assert r_dup.status_code == 400, f"expected 400, got {r_dup.status_code}: {r_dup.text}"

            # 4) Unknown vehicle_type_key -> 400
            bad_payload = dict(payload_1)
            bad_payload["registration"] = f"XX{uuid.uuid4().hex[:4].upper()} XXX"
            bad_payload["vehicle_type_key"] = "not_a_real_vehicle_type"
            r_bad = requests.post(
                f"{BASE_URL}/api/driver/vehicles",
                headers=_hdr(driver_token), json=bad_payload, timeout=15,
            )
            assert r_bad.status_code == 400, r_bad.text

            # 5) POST vehicle 2 with is_default=True -> vehicle 1 must become non-default
            payload_2 = {
                "vehicle_type_key": "small_van",
                "registration": f"CD{uuid.uuid4().hex[:4].upper()} XYZ",
                "make": "Vauxhall",
                "model": "Combo",
                "year": 2023,
                "payload_kg": 700,
                "capabilities": ["ulez_compliant"],
                "is_default": True,
            }
            r2 = requests.post(
                f"{BASE_URL}/api/driver/vehicles",
                headers=_hdr(driver_token), json=payload_2, timeout=15,
            )
            assert r2.status_code == 200, r2.text
            v2 = r2.json()
            veh2_id = v2["id"]
            assert v2["is_default"] is True

            # verify vehicle 1 flipped
            r_list = requests.get(
                f"{BASE_URL}/api/driver/vehicles",
                headers=_hdr(driver_token), timeout=15,
            )
            listed = {x["id"]: x for x in r_list.json()}
            assert listed[veh1_id]["is_default"] is False, (
                "first vehicle should no longer be default when a new default is added"
            )
            assert listed[veh2_id]["is_default"] is True

            # 6) PUT update on vehicle 1
            r_u = requests.put(
                f"{BASE_URL}/api/driver/vehicles/{veh1_id}",
                headers=_hdr(driver_token),
                json={
                    "vehicle_type_key": "lwb_van",
                    "registration": payload_1["registration"],  # required field in model
                    "capabilities": ["tail_lift", "ulez_compliant", "fragile_goods"],
                    "photos": ["data:image/png;base64,AAAA"],
                    "mot_expiry": "2027-05-15",
                },
                timeout=15,
            )
            assert r_u.status_code == 200, r_u.text
            upd = r_u.json()
            assert set(upd["capabilities"]) == {"tail_lift", "ulez_compliant", "fragile_goods"}
            assert upd["photos"] == ["data:image/png;base64,AAAA"]
            assert upd["mot_expiry"] == "2027-05-15"

            # 7) DELETE vehicle 2
            r_d = requests.delete(
                f"{BASE_URL}/api/driver/vehicles/{veh2_id}",
                headers=_hdr(driver_token), timeout=15,
            )
            assert r_d.status_code == 200
        finally:
            # Cleanup: remove vehicle 1 too
            requests.delete(
                f"{BASE_URL}/api/driver/vehicles/{veh1_id}",
                headers=_hdr(driver_token), timeout=15,
            )


# ---------------------------------------------------------------------------
# 4) ENHANCED RECOMMENDER — required_capabilities + reason
# ---------------------------------------------------------------------------
class TestRecommenderEnhanced:
    def _post(self, payload):
        return requests.post(
            f"{BASE_URL}/api/catalog/recommend-vehicle",
            json=payload, timeout=15,
        )

    def test_required_capabilities_hard_filter(self):
        r = self._post({
            "category_key": "house_removals",
            "weight_kg": 800,
            "required_capabilities": ["tail_lift"],
        })
        assert r.status_code == 200, r.text
        body = r.json()
        recs = body["recommendations"]
        assert isinstance(recs, list) and len(recs) >= 1, "expected at least one recommendation"
        for rec in recs:
            caps = set((rec.get("capabilities") or []) + (rec.get("features") or []))
            assert "tail_lift" in caps, (
                f"vehicle {rec.get('key')} lacks tail_lift: caps={caps}"
            )
            assert isinstance(rec.get("reason"), str) and rec["reason"], (
                f"reason missing/blank on {rec.get('key')}"
            )
        assert recs[0]["is_best_match"] is True

    def test_nonexistent_capability_does_not_crash(self):
        r = self._post({
            "category_key": "house_removals",
            "weight_kg": 800,
            "required_capabilities": ["nonexistent_cap"],
        })
        assert r.status_code == 200, r.text
        body = r.json()
        # Accept either empty recommendations OR fallback list; must not crash
        assert "recommendations" in body
        assert isinstance(body["recommendations"], list)

    def test_no_required_caps_baseline(self):
        r = self._post({"category_key": "parcels", "weight_kg": 5})
        assert r.status_code == 200, r.text
        body = r.json()
        recs = body["recommendations"]
        assert len(recs) >= 1
        # reason still populated
        for rec in recs:
            assert isinstance(rec.get("reason"), str) and rec["reason"]
        assert recs[0]["is_best_match"] is True
        for rec in recs[1:]:
            assert rec["is_best_match"] is False


# ---------------------------------------------------------------------------
# 5) ADMIN ANALYTICS OVERVIEW
# ---------------------------------------------------------------------------
class TestAnalyticsOverview:
    def test_non_admin_forbidden(self, driver_token):
        r = requests.get(
            f"{BASE_URL}/api/admin/analytics/overview",
            headers=_hdr(driver_token), timeout=15,
        )
        assert r.status_code == 403, f"expected 403 for non-admin, got {r.status_code}"

    def test_admin_overview_schema(self, admin_token):
        r = requests.get(
            f"{BASE_URL}/api/admin/analytics/overview",
            headers=_hdr(admin_token), timeout=20,
        )
        assert r.status_code == 200, r.text
        body = r.json()

        # marketplace
        mp = body.get("marketplace")
        assert isinstance(mp, dict)
        for k in ("jobs_posted", "jobs_completed", "jobs_cancelled", "jobs_active",
                  "completion_rate", "customer_revenue_total", "driver_revenue_total",
                  "platform_fee_revenue", "bookings_total"):
            assert k in mp, f"marketplace missing '{k}'"

        # categories
        cats = body.get("categories")
        assert isinstance(cats, dict)
        for k in ("top_requested", "top_vehicles", "top_capabilities", "top_routes",
                  "revenue_by_category", "revenue_by_vehicle"):
            assert k in cats, f"categories missing '{k}'"
            assert isinstance(cats[k], list), f"categories.{k} must be array"

        # drivers
        drv = body.get("drivers")
        assert isinstance(drv, dict)
        for k in ("total", "verified", "verification_rate", "top_rated",
                  "highest_earning", "most_active"):
            assert k in drv, f"drivers missing '{k}'"
        for k in ("top_rated", "highest_earning", "most_active"):
            assert isinstance(drv[k], list), f"drivers.{k} must be array"

        # customers
        cust = body.get("customers")
        assert isinstance(cust, dict)
        for k in ("total", "repeat", "most_active", "avg_customer_rating"):
            assert k in cust, f"customers missing '{k}'"
        assert isinstance(cust["most_active"], list)

        # operational
        op = body.get("operational")
        assert isinstance(op, dict)
        for k in ("avg_winning_bid", "avg_delivery_distance_miles",
                  "avg_delivery_time_minutes", "avg_booking_value"):
            assert k in op, f"operational missing '{k}'"
