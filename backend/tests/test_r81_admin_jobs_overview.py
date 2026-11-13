# R81 — Admin Jobs organiser: GET /api/admin/jobs/overview + rebooks include_test
import os
import json
import collections
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN = {"email": "admin@cargoone.com", "password": "Vc9O0sNDGR6SfzKDaa0L1lhp"}
CUST = {"email": "testcustomer@example.com", "password": "CustomerTest12345!"}
VALID_STAGES = {"open_no_bids", "open_with_bids", "in_progress", "completed", "cancelled",
                "needs_quote", "issue", "other", "deleted"}
VALID_TYPES = {"Bid Jobs", "Fixed Price Jobs", "ASAP Transport", "ASAP Recovery"}


def _login(creds):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=30)
    if r.status_code != 200:
        pytest.skip(f"login failed {creds['email']}: {r.status_code}")
    tok = r.json().get("token") or r.json().get("access_token")
    if tok:
        s.headers["Authorization"] = f"Bearer {tok}"
    return s


@pytest.fixture(scope="module")
def admin():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def overview(admin):
    r = admin.get(f"{BASE_URL}/api/admin/jobs/overview", timeout=90)
    assert r.status_code == 200, r.text[:300]
    return r


# Overview shape
class TestOverview:
    def test_list_and_fields(self, overview):
        data = overview.json()
        assert isinstance(data, list) and len(data) > 0
        for j in data[:200]:
            for k in ("id", "stage", "booking_type", "bids_count", "booking", "is_test", "waiting_hours", "price"):
                assert k in j, f"missing {k}"
            assert j["stage"] in VALID_STAGES
            assert j["booking_type"] in VALID_TYPES
            assert isinstance(j["bids_count"], int)
            assert isinstance(j["is_test"], bool)
            assert j["booking"] is None or set(j["booking"].keys()) == {"status", "payment_status"}
            assert "_id" not in j
        print("count", len(data), "size_bytes", len(overview.content))
        print("stages", collections.Counter(j["stage"] for j in data))
        print("types", collections.Counter(j["booking_type"] for j in data))
        print("test", collections.Counter(j["is_test"] for j in data))

    def test_no_base64_or_photos(self, overview):
        txt = overview.text
        assert "data:image" not in txt
        assert ";base64," not in txt
        for j in overview.json()[:50]:
            assert "photos" not in j and "pickup_photos" not in j

    def test_no_deleted_by_default(self, overview):
        assert all(not j.get("deleted_at") for j in overview.json())

    def test_include_deleted(self, admin, overview):
        r = admin.get(f"{BASE_URL}/api/admin/jobs/overview?include_deleted=true", timeout=90)
        assert r.status_code == 200
        d = r.json()
        assert len(d) >= len(overview.json())
        dels = [j for j in d if j.get("deleted_at")]
        print("deleted", len(dels))
        assert all(j["stage"] == "deleted" for j in dels)

    def test_stage_consistency(self, overview):
        for j in overview.json():
            st = (j.get("status") or "").lower()
            if j["stage"] == "open_no_bids":
                assert j["bids_count"] == 0 and st == "posted"
            if j["stage"] == "open_with_bids":
                assert j["bids_count"] > 0
            if st == "arrived" and j["stage"] not in ("issue", "cancelled"):
                assert j["stage"] == "in_progress"
            if j["stage"] in ("open_no_bids", "open_with_bids", "needs_quote") and j.get("created_at"):
                assert j["waiting_hours"] is not None

    def test_other_stage_statuses(self, overview):
        others = collections.Counter(j.get("status") for j in overview.json() if j["stage"] == "other")
        print("OTHER stage statuses (not in any tab except All):", dict(others))

    def test_customer_forbidden(self):
        s = _login(CUST)
        r = s.get(f"{BASE_URL}/api/admin/jobs/overview", timeout=30)
        assert r.status_code == 403

    def test_unauth(self):
        r = requests.get(f"{BASE_URL}/api/admin/jobs/overview", timeout=30)
        assert r.status_code in (401, 403)


# Rebooks include_test
class TestRebooks:
    def test_include_test_ge(self, admin):
        a = admin.get(f"{BASE_URL}/api/admin/analytics/rebooks?days=365", timeout=60)
        b = admin.get(f"{BASE_URL}/api/admin/analytics/rebooks?days=365&include_test=true", timeout=60)
        assert a.status_code == 200 and b.status_code == 200
        ja, jb = a.json(), b.json()
        print("rebooks excl", {k: ja.get(k) for k in ("cancelled_asap", "rebooked", "rebook_rate_pct")})
        print("rebooks incl", {k: jb.get(k) for k in ("cancelled_asap", "rebooked", "rebook_rate_pct")})
        assert jb["cancelled_asap"] >= ja["cancelled_asap"]
        assert jb["rebooked"] >= ja["rebooked"]
