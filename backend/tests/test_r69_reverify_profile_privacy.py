"""R69 RE-VERIFICATION — R37 privacy fix on GET /api/users/{id}/profile.

Module under test:
  * server.py `public_profile` (~L1287-1327) redaction guard
  * server.py `list_bids` driver_review_count enrichment
Scenarios: customer view (redacted), self view (full), admin view (full),
unauthenticated (401), plus bidding accept smoke.
"""
import os
import uuid

import pytest
import requests
from dotenv import dotenv_values
from pymongo import MongoClient

fe = dotenv_values("/app/frontend/.env")
BASE = (os.environ.get("REACT_APP_BACKEND_URL") or fe["REACT_APP_BACKEND_URL"]).rstrip("/")
API = f"{BASE}/api"
be = dotenv_values("/app/backend/.env")
mdb = MongoClient(be["MONGO_URL"])[be["DB_NAME"]]

ADMIN = {"email": "admin@cargoone.com", "password": "Vc9O0sNDGR6SfzKDaa0L1lhp"}
PW = "R69Rev!2026"
TAG = uuid.uuid4().hex[:8]
PHONE = "+447700900177"

PRIVATE_KEYS = (
    "email", "phone", "address_line1", "address_line2", "town", "county",
    "postcode", "country", "changes_requested_reason",
    "changes_requested_doc_types", "suspension_reason",
)
PUBLIC_KEYS = (
    "id", "name", "role", "rating", "review_count", "verified_driver",
    "reviews", "completed_bookings",
)


def h(tok):
    return {"Authorization": f"Bearer {tok}"}


def login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login {email} -> {r.status_code} {r.text[:200]}"
    j = r.json()
    return j["access_token"], j["user"]


def register(email, role, name):
    r = requests.post(f"{API}/auth/register", json={
        "email": email, "password": PW, "name": name,
        "phone": PHONE, "role": role}, timeout=30)
    assert r.status_code == 200, f"register {email} -> {r.status_code} {r.text[:300]}"
    j = r.json()
    return j["access_token"], j["user"]


@pytest.fixture(scope="module")
def admin_tok():
    return login(**ADMIN)[0]


@pytest.fixture(scope="module")
def actors(admin_tok):
    cust_email = f"r69_cust_{TAG}@cargoone.com"
    ctok, cust = register(cust_email, "customer", "R69 Rev Customer")
    drv_email = f"r69_drv_{TAG}@cargoone.com"
    dtok, drv = register(drv_email, "driver", "R69 Rev Driver")
    ra = requests.post(f"{API}/admin/users/{drv['id']}/approve", headers=h(admin_tok), timeout=30)
    assert ra.status_code in (200, 204), f"approve -> {ra.status_code} {ra.text[:200]}"
    dtok, drv = login(drv_email, PW)

    review_ids = []
    for i, (rating, comment) in enumerate([(5, "TEST_ great driver"), (4, "TEST_ good comms")]):
        rid = str(uuid.uuid4())
        review_ids.append(rid)
        mdb.reviews.insert_one({
            "id": rid, "target_id": drv["id"], "author_id": cust["id"],
            "from_name": f"TEST_Reviewer {i+1}", "rating": rating, "comment": comment,
            "created_at": f"2026-06-0{i+1}T10:00:00Z", "booking_id": f"TEST_{TAG}_{i}",
        })
    mdb.users.update_one({"id": drv["id"]}, {"$set": {
        "review_count": 2, "rating": 4.5, "total_jobs": 3,
        "address_line1": "1 TEST_ Private Road", "town": "Leeds",
        "postcode": "LS1 1AA", "country": "GB",
    }})

    data = {"cust": cust, "ctok": ctok, "cust_email": cust_email,
            "drv": drv, "dtok": dtok, "drv_email": drv_email, "atok": admin_tok,
            "review_ids": review_ids}
    yield data
    mdb.reviews.delete_many({"id": {"$in": review_ids}})


class TestProfilePrivacyR37:
    def test_customer_view_is_redacted(self, actors):
        r = requests.get(f"{API}/users/{actors['drv']['id']}/profile",
                         headers=h(actors["ctok"]), timeout=30)
        assert r.status_code == 200, r.text[:300]
        p = r.json()
        leaked = [k for k in PRIVATE_KEYS if k in p]
        assert not leaked, f"R37 leak: keys still present for customer caller: {leaked}"
        blob = r.text.lower()
        assert actors["drv_email"].lower() not in blob
        assert PHONE not in r.text
        assert "LS1 1AA" not in r.text
        for k in PUBLIC_KEYS:
            assert k in p, f"public field {k} missing after redaction"
        assert p["id"] == actors["drv"]["id"]
        assert p["role"] == "driver"
        assert p["review_count"] == 2
        assert float(p["rating"]) == pytest.approx(4.5)
        assert len(p["reviews"]) == 2
        assert isinstance(p["completed_bookings"], int)
        assert "vehicle" in p and "profile_photo" in p
        assert "documents_verified" in p
        assert "_id" not in p and "password_hash" not in p

    def test_self_view_keeps_private_fields(self, actors):
        r = requests.get(f"{API}/users/{actors['drv']['id']}/profile",
                         headers=h(actors["dtok"]), timeout=30)
        assert r.status_code == 200
        p = r.json()
        assert p["email"] == actors["drv_email"]
        assert p["phone"] == PHONE
        assert p["postcode"] == "LS1 1AA"
        assert p["address_line1"] == "1 TEST_ Private Road"
        assert p["review_count"] == 2

    def test_admin_view_keeps_private_fields(self, actors):
        r = requests.get(f"{API}/users/{actors['drv']['id']}/profile",
                         headers=h(actors["atok"]), timeout=30)
        assert r.status_code == 200
        p = r.json()
        assert p["email"] == actors["drv_email"]
        assert p["phone"] == PHONE
        assert p["postcode"] == "LS1 1AA"

    def test_unauthenticated_is_401(self, actors):
        r = requests.get(f"{API}/users/{actors['drv']['id']}/profile", timeout=30)
        assert r.status_code == 401, f"expected 401, got {r.status_code}"

    def test_driver_cannot_read_customer_private_fields(self, actors):
        r = requests.get(f"{API}/users/{actors['cust']['id']}/profile",
                         headers=h(actors["dtok"]), timeout=30)
        assert r.status_code == 200
        p = r.json()
        leaked = [k for k in PRIVATE_KEYS if k in p]
        assert not leaked, f"customer private fields exposed to driver: {leaked}"
        assert actors["cust_email"].lower() not in r.text.lower()

    def test_unknown_user_is_404(self, actors):
        r = requests.get(f"{API}/users/{uuid.uuid4()}/profile",
                         headers=h(actors["ctok"]), timeout=30)
        assert r.status_code == 404


class TestBiddingSmoke:
    def test_bid_flow_with_review_count_and_accept(self, actors):
        payload = {
            "title": f"R69 Rev Bidding {TAG}", "category": "general",
            "description": "R69 reverify job",
            "pickup_address": "10 Downing Street, London SW1A 2AA",
            "pickup_town": "London", "pickup_lat": 51.5033, "pickup_lng": -0.1276,
            "dropoff_address": "Reading Station, Reading RG1 1LZ",
            "dropoff_town": "Reading", "dropoff_lat": 51.4585, "dropoff_lng": -0.9718,
            "weight_kg": 40, "pricing_type": "bidding",
            "vehicle_required": "small_van", "service_timing": "scheduled",
            "service_type": "transport",
            "collection_date": "2026-08-05", "delivery_date": "2026-08-05",
        }
        rj = requests.post(f"{API}/jobs", headers=h(actors["ctok"]), json=payload, timeout=40)
        assert rj.status_code == 200, rj.text[:300]
        job = rj.json()

        rb = requests.post(f"{API}/jobs/{job['id']}/bids", headers=h(actors["dtok"]),
                           json={"amount": 165.0, "message": "Can do today", "eta_hours": 3},
                           timeout=30)
        assert rb.status_code == 200, rb.text[:300]
        bid = rb.json()

        rl = requests.get(f"{API}/jobs/{job['id']}/bids", headers=h(actors["ctok"]), timeout=30)
        assert rl.status_code == 200
        bids = rl.json()
        assert len(bids) == 1
        assert bids[0]["driver_review_count"] == 2
        blob = rl.text.lower()
        assert actors["drv_email"].lower() not in blob
        assert PHONE not in rl.text

        ra = requests.post(f"{API}/bids/{bid['id']}/accept", headers=h(actors["ctok"]), timeout=30)
        assert ra.status_code == 200, ra.text[:300]
        rg = requests.get(f"{API}/jobs/{job['id']}", headers=h(actors["ctok"]), timeout=30)
        j = rg.json()
        assert j["status"] == "accepted"
        assert j["assigned_driver_id"] == actors["drv"]["id"]
