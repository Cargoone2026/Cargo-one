"""Wave 3 backend tests — Dynamic Service Categories & Vehicle Catalogue.

Covers:
  * Public catalog endpoints (categories / vehicles / recommend-vehicle)
  * Admin CRUD for categories & vehicles
  * Enhanced /api/quote/estimate (legacy + new slugs)

The tests use the public backend URL and admin credentials seeded on startup.
"""
import os
import uuid
import time
import pytest
import requests

# Prefer localhost — Wave 3 explicitly asks us to hit http://localhost:8001
BASE_URL = os.environ.get("BACKEND_URL_OVERRIDE", "http://localhost:8001").rstrip("/")
ADMIN_EMAIL = "admin@cargoone.com"
ADMIN_PASSWORD = "admin123"


# ---------------------------------------------------------------------------
# Session-scoped auth fixtures
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
def customer_token():
    email = f"TEST_wave3_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(
        f"{BASE_URL}/api/auth/register",
        json={
            "email": email,
            "password": "testpass123",
            "name": "TEST Wave3 Customer",
            "role": "customer",
        },
        timeout=15,
    )
    assert r.status_code in (200, 201), f"Customer register failed: {r.status_code} {r.text}"
    body = r.json()
    return body.get("access_token") or body.get("token")


def _hdr(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------------------------------------------------------------------------
# 1) Public catalog endpoints
# ---------------------------------------------------------------------------
class TestPublicCatalog:
    def test_categories_returns_26_ordered(self):
        r = requests.get(f"{BASE_URL}/api/catalog/categories", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) == 26, f"expected 26 categories, got {len(data)}"
        # All active
        assert all(c["active"] is True for c in data)
        # Ordered by 'order'
        orders = [c["order"] for c in data]
        assert orders == sorted(orders), "categories not ordered by 'order'"
        # Schema check on first row
        required = {
            "id", "key", "name", "description", "icon", "order", "active",
            "default_vehicles", "typical_weight_kg", "typical_volume_m3",
        }
        assert required.issubset(data[0].keys())
        assert isinstance(data[0]["default_vehicles"], list)

    def test_vehicles_returns_16_ordered(self):
        r = requests.get(f"{BASE_URL}/api/catalog/vehicles", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 16, f"expected 16 vehicles, got {len(data)}"
        assert all(v["active"] is True for v in data)
        required = {
            "id", "key", "name", "description", "icon", "order", "active",
            "max_weight_kg", "max_volume_m3", "features",
        }
        assert required.issubset(data[0].keys())
        assert isinstance(data[0]["features"], list)
        orders = [v["order"] for v in data]
        assert orders == sorted(orders), "vehicles not ordered by 'order'"

    def test_categories_include_inactive_returns_all(self):
        r = requests.get(
            f"{BASE_URL}/api/catalog/categories?include_inactive=true", timeout=15,
        )
        assert r.status_code == 200
        data = r.json()
        # Should return all rows (initially all active, so still >= 26)
        assert len(data) >= 26


# ---------------------------------------------------------------------------
# 2) Vehicle recommendation
# ---------------------------------------------------------------------------
class TestRecommendVehicle:
    LABELS = {"Best value ⭐", "Roomier option", "Larger alternative", "Extra capacity"}

    def _post(self, payload):
        return requests.post(
            f"{BASE_URL}/api/catalog/recommend-vehicle",
            json=payload, timeout=15,
        )

    def _validate_shape(self, body):
        assert "category" in body
        assert "recommendations" in body
        recs = body["recommendations"]
        assert isinstance(recs, list) and 1 <= len(recs) <= 4
        # Only first has is_best_match=True
        assert recs[0]["is_best_match"] is True
        for r in recs[1:]:
            assert r["is_best_match"] is False
        for r in recs:
            assert r["recommendation_label"] in self.LABELS

    def test_parcels_small_load(self):
        r = self._post({"category_key": "parcels", "weight_kg": 5})
        assert r.status_code == 200, r.text
        body = r.json()
        self._validate_shape(body)
        assert len(body["recommendations"]) == 4
        first_key = body["recommendations"][0]["key"]
        assert first_key in ("motorcycle_courier", "small_van"), (
            f"expected small vehicle first, got {first_key}"
        )

    def test_house_removals_needs_loading_help(self):
        r = self._post({
            "category_key": "house_removals",
            "weight_kg": 1500,
            "volume_m3": 22,
            "needs_loading_help": True,
        })
        assert r.status_code == 200, r.text
        body = r.json()
        self._validate_shape(body)
        keys = [x["key"] for x in body["recommendations"]]
        assert any(k in keys for k in ("luton_van_taillift", "7_5_tonne")), (
            f"tail-lift vehicle should be ranked high, got keys={keys}"
        )

    def test_machinery_forklift_boost(self):
        r = self._post({
            "category_key": "machinery_plant",
            "weight_kg": 6000,
            "needs_forklift": True,
        })
        assert r.status_code == 200, r.text
        body = r.json()
        self._validate_shape(body)
        keys = [x["key"] for x in body["recommendations"]]
        # Hiab crane or flatbed should be present in top ranks
        assert any(k in keys[:3] for k in ("hiab_crane", "flatbed_truck")), (
            f"crane/flatbed should rank high, got {keys}"
        )

    def test_documents_motorcycle_first(self):
        r = self._post({"category_key": "documents"})
        assert r.status_code == 200, r.text
        body = r.json()
        self._validate_shape(body)
        assert body["recommendations"][0]["key"] == "motorcycle_courier"

    def test_unknown_category_returns_404(self):
        r = self._post({"category_key": "does_not_exist"})
        assert r.status_code == 404
        assert "Unknown or inactive category" in r.text

    def test_dimensions_compute_volume(self):
        r = self._post({
            "category_key": "parcels",
            "dimensions_l_m": 1,
            "dimensions_w_m": 0.5,
            "dimensions_h_m": 0.3,
        })
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["computed_volume_m3"] == pytest.approx(0.15, rel=1e-3)


# ---------------------------------------------------------------------------
# 3) Admin CRUD
# ---------------------------------------------------------------------------
class TestAdminCategoriesCRUD:
    def test_admin_list_shows_all(self, admin_token):
        r = requests.get(
            f"{BASE_URL}/api/admin/catalog/categories",
            headers=_hdr(admin_token), timeout=15,
        )
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 26

    def test_create_update_delete_cycle(self, admin_token):
        unique_key = f"TEST_cat_{uuid.uuid4().hex[:6]}"
        # 1) Create
        payload = {
            "key": unique_key,
            "name": "TEST Wave3 Category",
            "description": "temp",
            "icon": "cube",
            "order": 999,
            "active": True,
            "default_vehicles": ["small_van"],
            "typical_weight_kg": 100,
            "typical_volume_m3": 2.0,
        }
        r = requests.post(
            f"{BASE_URL}/api/admin/catalog/categories",
            headers=_hdr(admin_token), json=payload, timeout=15,
        )
        assert r.status_code == 200, r.text
        created = r.json()
        cat_id = created["id"]
        assert created["key"] == unique_key
        assert "created_at" in created and "updated_at" in created
        try:
            # 2) Duplicate key → 400
            r_dup = requests.post(
                f"{BASE_URL}/api/admin/catalog/categories",
                headers=_hdr(admin_token), json=payload, timeout=15,
            )
            assert r_dup.status_code == 400, r_dup.text

            # 3) Update order + deactivate
            r_upd = requests.put(
                f"{BASE_URL}/api/admin/catalog/categories/{cat_id}",
                headers=_hdr(admin_token),
                json={"name": "TEST Wave3 Category", "order": 500, "active": False},
                timeout=15,
            )
            assert r_upd.status_code == 200
            updated = r_upd.json()
            assert updated["order"] == 500
            assert updated["active"] is False

            # 4) Public GET should NOT include disabled row
            r_pub = requests.get(f"{BASE_URL}/api/catalog/categories", timeout=15)
            assert r_pub.status_code == 200
            keys = [c["key"] for c in r_pub.json()]
            assert unique_key not in keys

            # include_inactive=true → still present
            r_pub_all = requests.get(
                f"{BASE_URL}/api/catalog/categories?include_inactive=true", timeout=15,
            )
            all_keys = [c["key"] for c in r_pub_all.json()]
            assert unique_key in all_keys
        finally:
            # 5) Delete
            r_del = requests.delete(
                f"{BASE_URL}/api/admin/catalog/categories/{cat_id}",
                headers=_hdr(admin_token), timeout=15,
            )
            assert r_del.status_code == 200
            # Confirm removed
            r_after = requests.get(
                f"{BASE_URL}/api/admin/catalog/categories",
                headers=_hdr(admin_token), timeout=15,
            )
            after_keys = [c["key"] for c in r_after.json()]
            assert unique_key not in after_keys


class TestAdminVehiclesCRUD:
    def test_create_update_delete_cycle(self, admin_token):
        unique_key = f"TEST_veh_{uuid.uuid4().hex[:6]}"
        payload = {
            "key": unique_key,
            "name": "TEST Wave3 Vehicle",
            "description": "temp",
            "icon": "car",
            "order": 999,
            "active": True,
            "max_weight_kg": 750,
            "max_volume_m3": 5.0,
            "features": ["urgent"],
        }
        r = requests.post(
            f"{BASE_URL}/api/admin/catalog/vehicles",
            headers=_hdr(admin_token), json=payload, timeout=15,
        )
        assert r.status_code == 200, r.text
        created = r.json()
        veh_id = created["id"]
        try:
            # duplicate
            r_dup = requests.post(
                f"{BASE_URL}/api/admin/catalog/vehicles",
                headers=_hdr(admin_token), json=payload, timeout=15,
            )
            assert r_dup.status_code == 400

            # update
            r_upd = requests.put(
                f"{BASE_URL}/api/admin/catalog/vehicles/{veh_id}",
                headers=_hdr(admin_token),
                json={"name": "TEST Wave3 Vehicle", "order": 400, "active": False},
                timeout=15,
            )
            assert r_upd.status_code == 200
            updated = r_upd.json()
            assert updated["order"] == 400 and updated["active"] is False

            # Public GET should hide disabled vehicle
            r_pub = requests.get(f"{BASE_URL}/api/catalog/vehicles", timeout=15)
            assert r_pub.status_code == 200
            keys = [v["key"] for v in r_pub.json()]
            assert unique_key not in keys
        finally:
            r_del = requests.delete(
                f"{BASE_URL}/api/admin/catalog/vehicles/{veh_id}",
                headers=_hdr(admin_token), timeout=15,
            )
            assert r_del.status_code == 200


# ---------------------------------------------------------------------------
# 4) /api/quote/estimate — legacy + new slugs (GET endpoint)
# ---------------------------------------------------------------------------
class TestQuoteEstimate:
    BASE_PARAMS = {
        "pickup_lat": 51.5074, "pickup_lng": -0.1278,
        "dropoff_lat": 52.4862, "dropoff_lng": -1.8904,  # London -> Birmingham
    }

    def _get(self, token, extra):
        params = {**self.BASE_PARAMS, **extra}
        return requests.get(
            f"{BASE_URL}/api/quote/estimate",
            headers={"Authorization": f"Bearer {token}"},
            params=params, timeout=20,
        )

    def test_legacy_category_normalized(self, customer_token):
        r = self._get(customer_token, {"category": "furniture"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["category_key"] == "furniture_delivery", body
        assert body.get("vehicle") and isinstance(body["vehicle"], str)

    def test_shipping_containers_large_vehicle(self, customer_token):
        # Baseline (no weight/volume)
        r_base = self._get(customer_token, {"category": "shipping_containers"})
        assert r_base.status_code == 200, r_base.text
        base_price = r_base.json()["suggested_price"]

        # Loaded
        r_full = self._get(customer_token, {
            "category": "shipping_containers",
            "weight_kg": 5000, "volume_m3": 30,
        })
        assert r_full.status_code == 200
        body = r_full.json()
        assert body["category_key"] == "shipping_containers"
        assert body["vehicle"] in ("Hiab Crane Vehicle", "Articulated HGV", "Flatbed Truck"), body
        assert body["suggested_price"] > base_price, (
            f"loaded price {body['suggested_price']} should exceed base {base_price}"
        )
