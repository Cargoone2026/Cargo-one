# R80 — Admin drivers overview (display stages) + admin vehicle tags
import json
import os
import uuid

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://cargo-repo-bridge.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN = ("admin@cargoone.com", "Vc9O0sNDGR6SfzKDaa0L1lhp")
DRIVER = ("testdriver@example.com", "DriverTest12345!")
REQUIRED = ["driving_licence", "insurance", "vehicle_registration", "vehicle_photos", "profile_photo", "proof_of_address"]
PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
FIXTURE_FILE = "/app/test_reports/r80_fixtures.json"
ALLOWED_KEYS = {"id", "name", "email", "phone", "status", "created_at", "town", "postcode_area", "documents_verified",
                "docs", "stage", "vehicles", "vehicle_count", "admin_vehicle_tags", "total_jobs", "rating"}


def login(email, pw):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def H(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def admin_tok():
    return login(*ADMIN)


@pytest.fixture(scope="module")
def drivers():
    """Create 3 TEST_ drivers (0, 3, 6 docs). IDs persisted for UI testing + cleanup."""
    out = {}
    tag = uuid.uuid4().hex[:6]
    for label, n in (("nodocs", 0), ("partial", 3), ("ready", 6)):
        email = f"test_r80_{label}_{tag}@cargoone-test.example.com"
        r = requests.post(f"{API}/auth/register", json={
            "email": email, "password": "R80Test!2026", "name": f"TEST_R80 {label} {tag}", "phone": "+447700900123",
            "role": "driver", "town": "Birmingham", "postcode": "B12 9AA"}, timeout=20)
        assert r.status_code == 200, r.text
        tok = r.json()["access_token"]
        uid = r.json()["user"]["id"]
        for t in REQUIRED[:n]:
            rr = requests.post(f"{API}/users/me/documents", headers=H(tok),
                               json={"doc_type": t, "base64": PNG, "filename": f"{t}.png"}, timeout=20)
            assert rr.status_code == 200, rr.text
            assert "base64" not in rr.json()
        out[label] = {"id": uid, "email": email, "token": tok}
    existing = {}
    if os.path.exists(FIXTURE_FILE):
        existing = json.load(open(FIXTURE_FILE))
    existing.setdefault("all_ids", []).extend([v["id"] for v in out.values()])
    existing["latest"] = {k: {"id": v["id"], "email": v["email"]} for k, v in out.items()}
    json.dump(existing, open(FIXTURE_FILE, "w"), indent=2)
    return out


def overview(tok):
    r = requests.get(f"{API}/admin/drivers/overview", headers=H(tok), timeout=60)
    assert r.status_code == 200, r.text
    return r


class TestOverview:
    def test_auth(self):
        assert requests.get(f"{API}/admin/drivers/overview", timeout=20).status_code == 401
        dt = login(*DRIVER)
        assert requests.get(f"{API}/admin/drivers/overview", headers=H(dt), timeout=20).status_code == 403

    def test_shape_no_base64_sorted(self, admin_tok, drivers):
        r = overview(admin_tok)
        assert "base64" not in r.text
        data = r.json()
        assert isinstance(data, list) and len(data) > 0
        for d in data:
            assert set(d.keys()) == ALLOWED_KEYS, set(d.keys()) ^ ALLOWED_KEYS
        cas = [d["created_at"] or "" for d in data]
        assert cas == sorted(cas, reverse=True)
        print(f"overview: {len(data)} drivers, {len(r.content)} bytes")

    def test_stages_of_new_drivers(self, admin_tok, drivers):
        by_id = {d["id"]: d for d in overview(admin_tok).json()}
        n = by_id[drivers["nodocs"]["id"]]
        p = by_id[drivers["partial"]["id"]]
        rd = by_id[drivers["ready"]["id"]]
        assert n["stage"] == "no_documents" and n["docs"]["uploaded"] == 0 and len(n["docs"]["missing"]) == 6
        assert p["stage"] == "in_progress" and p["docs"]["uploaded"] == 3 and len(p["docs"]["missing"]) == 3
        assert set(p["docs"]["missing"]) == set(REQUIRED[3:])
        assert rd["stage"] == "ready_to_review" and rd["docs"]["uploaded"] == 6 and rd["docs"]["missing"] == []
        assert rd["docs"]["pending"] == 6 and rd["docs"]["approved"] == 0 and rd["docs"]["required"] == 6
        for d in (n, p, rd):
            assert d["town"] == "Birmingham" and d["postcode_area"] == "B12"
            assert d["status"] == "pending" and d["documents_verified"] is False
            assert d["vehicles"] == [] and d["vehicle_count"] == 0

    def test_stage_counts_consistent(self, admin_tok):
        data = overview(admin_tok).json()
        stages = {}
        for d in data:
            stages[d["stage"]] = stages.get(d["stage"], 0) + 1
        assert set(stages) <= {"no_documents", "in_progress", "ready_to_review", "changes_requested", "approved", "suspended"}
        assert sum(stages.values()) == len(data)
        for d in data:
            if d["status"] == "active":
                assert d["stage"] == "approved"
            if d["status"] == "suspended":
                assert d["stage"] == "suspended"
        print("stage counts:", stages)


class TestVehicleTags:
    def test_auth_and_validation(self, admin_tok, drivers):
        did = drivers["partial"]["id"]
        dt = login(*DRIVER)
        assert requests.post(f"{API}/admin/drivers/{did}/vehicle-tags", headers=H(dt), json={"tags": ["car"]}, timeout=20).status_code == 403
        r = requests.post(f"{API}/admin/drivers/{did}/vehicle-tags", headers=H(admin_tok), json={"tags": ["car", "spaceship"]}, timeout=20)
        assert r.status_code == 400 and "spaceship" in r.text
        r = requests.post(f"{API}/admin/drivers/nope-{uuid.uuid4()}/vehicle-tags", headers=H(admin_tok), json={"tags": ["car"]}, timeout=20)
        assert r.status_code == 404

    def test_set_tags_only_changes_tags(self, admin_tok, drivers):
        did = drivers["partial"]["id"]
        before = requests.get(f"{API}/admin/drivers/{did}", headers=H(admin_tok), timeout=20).json()["user"]
        r = requests.post(f"{API}/admin/drivers/{did}/vehicle-tags", headers=H(admin_tok), json={"tags": ["luton", "7_5t", "luton"]}, timeout=20)
        assert r.status_code == 200
        assert r.json()["admin_vehicle_tags"] == ["luton", "7_5t"]
        after = requests.get(f"{API}/admin/drivers/{did}", headers=H(admin_tok), timeout=20).json()["user"]
        assert after["status"] == before["status"] and after["documents_verified"] == before["documents_verified"]
        row = {d["id"]: d for d in overview(admin_tok).json()}[did]
        assert row["vehicles"] == ["luton", "7_5t"] and row["admin_vehicle_tags"] == ["luton", "7_5t"]
        assert row["stage"] == "in_progress" and row["status"] == "pending"

    def test_driver_detail_returns_tags(self, admin_tok, drivers):
        """DriverDetail initialises the tag editor from GET /admin/drivers/{id}.user.admin_vehicle_tags."""
        did = drivers["partial"]["id"]
        user = requests.get(f"{API}/admin/drivers/{did}", headers=H(admin_tok), timeout=20).json()["user"]
        assert user.get("admin_vehicle_tags") == ["luton", "7_5t"], f"detail user.admin_vehicle_tags={user.get('admin_vehicle_tags')!r}"


class TestDocReviewFlowUnchanged:
    def test_reject_then_approve_all(self, admin_tok, drivers):
        did = drivers["ready"]["id"]
        docs = requests.get(f"{API}/admin/documents/{did}", headers=H(admin_tok), timeout=20).json()
        assert len(docs) == 6
        # reject one -> changes_requested stage (status unchanged = pending)
        r = requests.post(f"{API}/admin/documents/{docs[0]['id']}/review", headers=H(admin_tok), json={"action": "reject", "reason": "TEST blurry"}, timeout=20)
        assert r.status_code == 200 and r.json()["status"] == "rejected"
        row = {d["id"]: d for d in overview(admin_tok).json()}[did]
        assert row["stage"] == "changes_requested" and row["docs"]["rejected"] == 1 and row["status"] == "pending"
        # approve all -> documents_verified true, status active (existing _recompute flow)
        for d in docs:
            r = requests.post(f"{API}/admin/documents/{d['id']}/review", headers=H(admin_tok), json={"action": "approve"}, timeout=20)
            assert r.status_code == 200
        u = requests.get(f"{API}/admin/drivers/{did}", headers=H(admin_tok), timeout=20).json()["user"]
        assert u["documents_verified"] is True and u["status"] == "active"
        row = {d["id"]: d for d in overview(admin_tok).json()}[did]
        assert row["stage"] == "approved" and row["docs"]["approved"] == 6
