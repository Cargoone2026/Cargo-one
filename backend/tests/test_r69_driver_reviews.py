"""R69 certification — driver-review visibility pre-acceptance + security.

Modules under test:
  * list_bids enrichment (`driver_review_count`)  — server.py ~3025
  * GET /api/users/{id}/profile (reviews payload used by DriverReviewsSheet)
  * Bidding + Fixed Price lifecycle basics (R42 fixed price preservation)
  * Security: auth guards, cross-user access, role guards
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
PW = "R69Cert!2026"
TAG = uuid.uuid4().hex[:8]

PRIVATE_KEYS = ("email", "phone", "address_line1", "address_line2", "postcode")


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
        "phone": "+447700900123", "role": role}, timeout=30)
    assert r.status_code == 200, f"register {email} -> {r.status_code} {r.text[:300]}"
    j = r.json()
    return j["access_token"], j["user"]


def make_job(tok, *, title, pricing_type="fixed", price=140.0, timing="scheduled",
             service_type="transport"):
    payload = {
        "title": title, "category": "general",
        "description": "R69 certification job",
        "pickup_address": "10 Downing Street, London SW1A 2AA",
        "pickup_town": "London", "pickup_lat": 51.5033, "pickup_lng": -0.1276,
        "dropoff_address": "Reading Station, Reading RG1 1LZ",
        "dropoff_town": "Reading", "dropoff_lat": 51.4585, "dropoff_lng": -0.9718,
        "weight_kg": 40,
        "pricing_type": pricing_type,
        "vehicle_required": "small_van",
        "service_timing": timing, "service_type": service_type,
        "collection_date": "2026-08-05", "delivery_date": "2026-08-05",
    }
    if pricing_type == "fixed":
        payload["fixed_price"] = price
    r = requests.post(f"{API}/jobs", headers=h(tok), json=payload, timeout=40)
    assert r.status_code == 200, f"job create -> {r.status_code} {r.text[:300]}"
    return r.json()


# --------------------------------------------------------------------------
# Session fixtures — fresh customer + approved driver, seeded reviews
# --------------------------------------------------------------------------
@pytest.fixture(scope="session")
def admin_tok():
    return login(**ADMIN)[0]


@pytest.fixture(scope="session")
def actors(admin_tok):
    cust_email = f"r69_cust_{TAG}@cargoone.com"
    ctok, cust = register(cust_email, "customer", "R69 Customer")

    drv_email = f"r69_drv_{TAG}@cargoone.com"
    dtok, drv = register(drv_email, "driver", "R69 Driver")
    ra = requests.post(f"{API}/admin/users/{drv['id']}/approve", headers=h(admin_tok), timeout=30)
    assert ra.status_code in (200, 204), f"approve -> {ra.status_code} {ra.text[:200]}"
    dtok, drv = login(drv_email, PW)
    assert drv["status"] == "active"

    # Seed 2 written reviews + aggregate counters so the sheet has content.
    review_ids = []
    for i, (rating, comment) in enumerate(
            [(5, "Excellent driver, arrived early and handled the load with care."),
             (4, "Good communication throughout, minor delay on delivery.")]):
        rid = str(uuid.uuid4())
        review_ids.append(rid)
        mdb.reviews.insert_one({
            "id": rid, "target_id": drv["id"], "author_id": cust["id"],
            "from_name": f"TEST_Reviewer {i+1}", "rating": rating, "comment": comment,
            "created_at": f"2026-06-0{i+1}T10:00:00Z", "booking_id": f"TEST_{TAG}_{i}",
        })
    mdb.users.update_one({"id": drv["id"]},
                         {"$set": {"review_count": 2, "rating": 4.5, "total_jobs": 3}})

    # second customer for cross-user checks
    c2_email = f"r69_cust2_{TAG}@cargoone.com"
    c2tok, cust2 = register(c2_email, "customer", "R69 Customer Two")

    data = {
        "cust": cust, "ctok": ctok, "cust_email": cust_email,
        "drv": drv, "dtok": dtok, "drv_email": drv_email,
        "cust2": cust2, "c2tok": c2tok, "review_ids": review_ids,
        "password": PW,
    }
    yield data
    mdb.reviews.delete_many({"id": {"$in": review_ids}})


# --------------------------------------------------------------------------
# PART 1a — Bidding: driver_review_count in list_bids
# --------------------------------------------------------------------------
class TestBiddingReviewVisibility:
    def test_bid_list_exposes_driver_review_count(self, actors):
        job = make_job(actors["ctok"], title=f"R69 Bidding {TAG}", pricing_type="bidding")
        assert job["pricing_type"] == "bidding"

        rb = requests.post(f"{API}/jobs/{job['id']}/bids", headers=h(actors["dtok"]),
                           json={"amount": 165.0, "message": "Can do this today",
                                 "eta_hours": 3}, timeout=30)
        assert rb.status_code == 200, f"bid -> {rb.status_code} {rb.text[:300]}"
        bid = rb.json()

        rl = requests.get(f"{API}/jobs/{job['id']}/bids", headers=h(actors["ctok"]), timeout=30)
        assert rl.status_code == 200, rl.text[:300]
        bids = rl.json()
        assert len(bids) == 1
        b = bids[0]
        assert b["id"] == bid["id"]
        assert "driver_review_count" in b, "R69 enrichment missing"
        assert b["driver_review_count"] == 2, b
        assert isinstance(b["driver_review_count"], int)
        assert b["total_jobs"] == 3
        assert b["driver_rating"] == pytest.approx(4.5)
        actors["bidding_job"] = job
        actors["bid"] = b

    def test_bid_payload_has_no_private_contact(self, actors):
        job = actors.get("bidding_job") or make_job(
            actors["ctok"], title=f"R69 Bidding priv {TAG}", pricing_type="bidding")
        rl = requests.get(f"{API}/jobs/{job['id']}/bids", headers=h(actors["ctok"]), timeout=30)
        assert rl.status_code == 200
        blob = rl.text.lower()
        assert actors["drv_email"].lower() not in blob, "driver email leaked in bids"
        assert "+447700900123" not in blob, "driver phone leaked in bids"
        for b in rl.json():
            for k in PRIVATE_KEYS:
                assert k not in b, f"private key {k} present in bid payload"

    def test_accept_bid_proceeds(self, actors):
        job = actors["bidding_job"]
        bid = actors["bid"]
        ra = requests.post(f"{API}/bids/{bid['id']}/accept", headers=h(actors["ctok"]), timeout=30)
        assert ra.status_code == 200, f"accept bid -> {ra.status_code} {ra.text[:300]}"
        rj = requests.get(f"{API}/jobs/{job['id']}", headers=h(actors["ctok"]), timeout=30)
        assert rj.status_code == 200
        j = rj.json()
        assert j["status"] == "accepted"
        assert j["assigned_driver_id"] == actors["drv"]["id"]
        assert float(j["accepted_price"]) == 165.0


# --------------------------------------------------------------------------
# PART 1b / R42 — Fixed price claim + price preservation
# --------------------------------------------------------------------------
class TestFixedPriceFlow:
    def test_fixed_price_preserved_and_driver_accept(self, actors):
        job = make_job(actors["ctok"], title=f"R69 Fixed {TAG}",
                       pricing_type="fixed", price=137.5)
        assert float(job["fixed_price"]) == 137.5, job
        assert float(job.get("price") or job["fixed_price"]) == 137.5, \
            f"R42 violation: declared fixed_price replaced -> {job.get('price')}"

        ra = requests.post(f"{API}/jobs/{job['id']}/accept", headers=h(actors["dtok"]), timeout=40)
        assert ra.status_code == 200, f"driver accept -> {ra.status_code} {ra.text[:300]}"

        rj = requests.get(f"{API}/jobs/{job['id']}", headers=h(actors["ctok"]), timeout=30)
        j = rj.json()
        assert j["status"] == "accepted"
        assert j["assigned_driver_id"] == actors["drv"]["id"]
        assert float(j["fixed_price"]) == 137.5
        assert j.get("assigned_driver_name")
        actors["fixed_job"] = j

    def test_customer_cannot_self_accept(self, actors):
        job = make_job(actors["ctok"], title=f"R69 Fixed roleguard {TAG}",
                       pricing_type="fixed", price=99.0)
        r = requests.post(f"{API}/jobs/{job['id']}/accept", headers=h(actors["ctok"]), timeout=30)
        assert r.status_code in (401, 403), f"customer accept should be blocked, got {r.status_code}"


# --------------------------------------------------------------------------
# PART 1 / 7e — public profile payload consumed by DriverReviewsSheet
# --------------------------------------------------------------------------
class TestDriverProfileReviews:
    def test_profile_returns_reviews(self, actors):
        r = requests.get(f"{API}/users/{actors['drv']['id']}/profile",
                         headers=h(actors["ctok"]), timeout=30)
        assert r.status_code == 200, r.text[:300]
        p = r.json()
        assert p["id"] == actors["drv"]["id"]
        assert p["review_count"] == 2
        assert float(p["rating"]) == pytest.approx(4.5)
        assert isinstance(p["reviews"], list) and len(p["reviews"]) == 2
        for row in p["reviews"]:
            assert row["id"] in actors["review_ids"]
            assert isinstance(row["rating"], int)
            assert row["comment"]
            assert row["from_name"].startswith("TEST_Reviewer")
            assert row["created_at"]
        assert isinstance(p["completed_bookings"], int)
        assert "_id" not in p

    def test_profile_review_rows_have_no_contact(self, actors):
        r = requests.get(f"{API}/users/{actors['drv']['id']}/profile",
                         headers=h(actors["ctok"]), timeout=30)
        for row in r.json()["reviews"]:
            for k in ("email", "phone"):
                assert k not in row, f"review row leaks {k}"

    def test_profile_top_level_has_no_private_contact(self, actors):
        """R37: pre-acceptance the customer must not learn driver email/phone."""
        r = requests.get(f"{API}/users/{actors['drv']['id']}/profile",
                         headers=h(actors["c2tok"]), timeout=30)
        assert r.status_code == 200
        p = r.json()
        leaked = [k for k in PRIVATE_KEYS if p.get(k)]
        assert not leaked, (
            f"R37 privacy leak: /users/{{id}}/profile exposes {leaked} "
            f"to an unrelated authenticated customer (email={p.get('email')!r}, "
            f"phone={p.get('phone')!r})"
        )


# --------------------------------------------------------------------------
# PART 7 — Security
# --------------------------------------------------------------------------
class TestSecurity:
    def test_unauth_bids_401(self, actors):
        job = actors.get("bidding_job")
        jid = job["id"] if job else "does-not-matter"
        r = requests.get(f"{API}/jobs/{jid}/bids", timeout=30)
        assert r.status_code == 401, r.status_code
        r2 = requests.post(f"{API}/jobs/{jid}/bids", json={"amount": 10}, timeout=30)
        assert r2.status_code == 401, r2.status_code

    def test_unauth_profile_401(self, actors):
        r = requests.get(f"{API}/users/{actors['drv']['id']}/profile", timeout=30)
        assert r.status_code == 401, r.status_code

    def test_other_customer_cannot_read_bids(self, actors):
        job = actors["bidding_job"]
        r = requests.get(f"{API}/jobs/{job['id']}/bids", headers=h(actors["c2tok"]), timeout=30)
        assert r.status_code in (403, 404), f"cross-customer bids read -> {r.status_code}"

    def test_cross_customer_booking_blocked(self, actors):
        job = make_job(actors["ctok"], title=f"R69 Xuser {TAG}", pricing_type="fixed", price=88.0)
        ra = requests.post(f"{API}/jobs/{job['id']}/accept", headers=h(actors["dtok"]), timeout=40)
        assert ra.status_code == 200, ra.text[:300]
        rb = requests.post(f"{API}/bookings", headers=h(actors["ctok"]),
                           json={"job_id": job["id"]}, timeout=40)
        assert rb.status_code == 200, rb.text[:300]
        bid_ = rb.json()["id"]
        r = requests.get(f"{API}/bookings/{bid_}", headers=h(actors["c2tok"]), timeout=30)
        assert r.status_code in (403, 404), f"cross-user booking read -> {r.status_code}"
        rown = requests.get(f"{API}/bookings/{bid_}", headers=h(actors["ctok"]), timeout=30)
        assert rown.status_code == 200
        assert rown.json()["id"] == bid_

    def test_password_login_still_works(self, actors):
        tok, u = login(actors["cust_email"], PW)
        assert tok and u["email"] == actors["cust_email"]

    def test_passkey_login_options(self):
        r = requests.post(f"{API}/auth/passkey/login/generate",
                          json={"email": "r66_customer@cargoone.com"}, timeout=30)
        assert r.status_code == 200, f"passkey login/generate -> {r.status_code} {r.text[:300]}"
        j = r.json()
        opts = j.get("options") or j.get("publicKey") or j
        assert opts.get("challenge"), j


# --------------------------------------------------------------------------
# PART 10 — Admin visibility
# --------------------------------------------------------------------------
class TestAdmin:
    def test_admin_sees_bookings_and_job_detail(self, actors, admin_tok):
        rb = requests.get(f"{API}/admin/bookings", headers=h(admin_tok), timeout=60)
        assert rb.status_code == 200, rb.text[:300]
        payload = rb.json()
        rows = payload if isinstance(payload, list) else payload.get("bookings", [])
        assert isinstance(rows, list) and rows

        job = actors["bidding_job"]
        rj = requests.get(f"{API}/admin/jobs/{job['id']}", headers=h(admin_tok), timeout=30)
        assert rj.status_code == 200, f"admin job detail -> {rj.status_code} {rj.text[:300]}"
        d = rj.json()
        assert d.get("job", d).get("id") == job["id"]
        assert "bids" in d, d.keys()
        assert len(d["bids"]) >= 1

    def test_admin_job_detail_requires_admin(self, actors):
        job = actors["bidding_job"]
        r = requests.get(f"{API}/admin/jobs/{job['id']}", headers=h(actors["ctok"]), timeout=30)
        assert r.status_code in (401, 403), r.status_code
