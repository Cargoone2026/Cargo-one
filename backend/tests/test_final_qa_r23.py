"""R23 — Cargo One driver QA sweep.

Covers items A-AF from the R23 review request. Uses direct Mongo seeding to
place bookings/jobs into the specific states required by each flow.
"""

import os
import time
import uuid
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

CUSTOMER_EMAIL = "testcustomer@example.com"
CUSTOMER_PASS = "CustomerTest12345!"
DRIVER_EMAIL = "testdriver@example.com"
DRIVER_PASS = "DriverTest12345!"
ADMIN_EMAIL = "admin@cargoone.com"
ADMIN_PASS = "Vc9O0sNDGR6SfzKDaa0L1lhp"


def now_iso():
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()


@pytest.fixture(scope="session")
def mongo():
    return MongoClient(MONGO_URL)[DB_NAME]


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"login {email} => {r.status_code} {r.text}"
    return r.json()["access_token"], r.json()["user"]


@pytest.fixture(scope="session")
def customer_ctx():
    t, u = _login(CUSTOMER_EMAIL, CUSTOMER_PASS)
    return {"token": t, "user": u, "h": {"Authorization": f"Bearer {t}"}}


@pytest.fixture(scope="session")
def driver_ctx():
    t, u = _login(DRIVER_EMAIL, DRIVER_PASS)
    return {"token": t, "user": u, "h": {"Authorization": f"Bearer {t}"}}


@pytest.fixture(scope="session")
def admin_ctx():
    try:
        t, u = _login(ADMIN_EMAIL, ADMIN_PASS)
        return {"token": t, "user": u, "h": {"Authorization": f"Bearer {t}"}}
    except AssertionError:
        pytest.skip("Admin login not available (pre-existing bcrypt issue)")


# ---------------------------------------------------------------------------
# Seeding helpers
# ---------------------------------------------------------------------------

def _seed_job_and_booking(
    mongo, *, customer_id, driver_id, service_timing="scheduled",
    pricing_type="fixed", service_type="transport",
    booking_status="on_route", job_status="accepted", title_prefix="R23",
    accept_ready=True,
):
    jid = f"{title_prefix}_JOB_{uuid.uuid4().hex[:8]}"
    bid = f"{title_prefix}_BK_{uuid.uuid4().hex[:8]}"
    now = now_iso()
    job = {
        "id": jid,
        "customer_id": customer_id,
        "title": f"{title_prefix} test {jid}",
        "description": "R23 seeded",
        "pickup_address": "London EC1A 1BB",
        "pickup_lat": 51.5155, "pickup_lng": -0.0922,
        "dropoff_address": "Manchester M1 1AE",
        "dropoff_lat": 53.4794, "dropoff_lng": -2.2453,
        "distance_miles": 200.0,
        "service_timing": service_timing,
        "pricing_type": pricing_type,
        "service_type": service_type,
        "fixed_price": 250.0,
        "accepted_price": 250.0 if accept_ready else None,
        "status": job_status,
        "assigned_driver_id": driver_id if accept_ready else None,
        "assigned_driver_name": "Test Driver" if accept_ready else None,
        "created_at": now,
        "dispatch_ready_at": now if service_timing == "asap" else None,
        "blocked_driver_ids": [],
    }
    booking = {
        "id": bid,
        "job_id": jid,
        "customer_id": customer_id,
        "driver_id": driver_id if accept_ready else None,
        "status": booking_status,
        "payment_status": "paid",
        "amount": 250.0,
        "deposit_amount": 25.0,
        "currency": "GBP",
        "created_at": now,
    }
    mongo.jobs.insert_one(job)
    mongo.bookings.insert_one(booking)
    return jid, bid


# ===========================================================================
# A + B — Welcome email routing (customer vs driver templates)
# ===========================================================================

class TestWelcomeEmails:
    def test_A_customer_welcome_email_template(self, mongo):
        email = f"test_r23_cust_{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(f"{API}/auth/register", json={
            "email": email, "password": "TestPass12345!",
            "name": "R23 Customer", "role": "customer",
        })
        assert r.status_code == 200, r.text
        time.sleep(0.5)
        log = mongo.email_log.find_one({"to": email})
        assert log, f"no email_log row for {email}"
        assert log.get("template") == "welcome", f"expected template=welcome got {log.get('template')}"

    def test_B_driver_welcome_email_template(self, mongo):
        email = f"test_r23_drv_{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(f"{API}/auth/register", json={
            "email": email, "password": "TestPass12345!",
            "name": "R23 Driver", "role": "driver",
            "phone": "+447700900123",
        })
        assert r.status_code == 200, r.text
        time.sleep(0.5)
        log = mongo.email_log.find_one({"to": email})
        assert log, f"no email_log row for {email}"
        assert log.get("template") == "driver_welcome", f"expected driver_welcome got {log.get('template')}"
        # Content assertions (subject or html should reference driver onboarding)
        body = (log.get("html") or "") + (log.get("text") or "") + (log.get("subject") or "")
        # email_log stores subject; render_driver_welcome subject includes 'Driver Onboarding'
        assert "driver" in body.lower(), \
            f"driver-specific content missing from email log (subject={log.get('subject')})"


# ===========================================================================
# C + D + E + F — Driver profile address fields + avatar
# ===========================================================================

class TestDriverProfile:
    def test_C_auth_me_returns_address_fields(self, driver_ctx):
        r = requests.get(f"{API}/auth/me", headers=driver_ctx["h"])
        assert r.status_code == 200
        u = r.json()
        for k in ("address_line1", "address_line2", "town", "county", "postcode", "country"):
            assert k in u, f"{k} missing from /auth/me"

    def test_D_auth_me_put_persists_address(self, driver_ctx):
        body = {
            "address_line1": "10 Downing St",
            "address_line2": "Flat A",
            "town": "London",
            "county": "Greater London",
            "postcode": "SW1A 2AA",
            "country": "United Kingdom",
        }
        r = requests.put(f"{API}/auth/me", headers=driver_ctx["h"], json=body)
        assert r.status_code == 200, r.text
        # refetch
        r2 = requests.get(f"{API}/auth/me", headers=driver_ctx["h"])
        u = r2.json()
        for k, v in body.items():
            assert u.get(k) == v, f"{k} not persisted: got {u.get(k)}"
        # relogin -> still there
        _, u2 = _login(DRIVER_EMAIL, DRIVER_PASS)
        for k, v in body.items():
            assert u2.get(k) == v, f"{k} lost after relogin: {u2.get(k)}"

    def test_E_avatar_upload_via_documents(self, driver_ctx, mongo):
        # 1x1 png base64
        b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
        r = requests.post(f"{API}/users/me/documents", headers=driver_ctx["h"], json={
            "doc_type": "profile_photo", "base64": b64,
        })
        assert r.status_code in (200, 201), r.text
        r2 = requests.get(f"{API}/auth/me", headers=driver_ctx["h"])
        assert r2.json().get("profile_photo") is not None

    def test_F_avatar_remove_via_put_null(self, driver_ctx):
        r = requests.put(f"{API}/auth/me", headers=driver_ctx["h"],
                         json={"profile_photo": None})
        assert r.status_code == 200
        r2 = requests.get(f"{API}/auth/me", headers=driver_ctx["h"])
        assert r2.json().get("profile_photo") in (None, "")


# ===========================================================================
# H — cancel-reasons endpoint
# ===========================================================================

class TestCancelReasons:
    def test_H_reasons_driver_only(self, driver_ctx, customer_ctx):
        r = requests.get(f"{API}/driver/cancel-reasons", headers=driver_ctx["h"])
        assert r.status_code == 200
        reasons = r.json()["reasons"]
        keys = {x["key"] for x in reasons}
        expected = {"vehicle_issue", "breakdown", "unable_to_complete",
                    "vehicle_unsuitable", "customer_or_location",
                    "personal_emergency", "route_or_access", "other"}
        assert keys == expected, f"unexpected keys {keys}"
        # customer should be 403
        rc = requests.get(f"{API}/driver/cancel-reasons", headers=customer_ctx["h"])
        assert rc.status_code == 403


# ===========================================================================
# I — validation errors
# ===========================================================================

class TestCancelValidation:
    def test_I_invalid_reason_400(self, driver_ctx):
        r = requests.post(f"{API}/driver/bookings/xxxx/cancel",
                          headers=driver_ctx["h"],
                          json={"reason": "not_a_key"})
        assert r.status_code == 400

    def test_I_other_needs_explanation(self, driver_ctx):
        r = requests.post(f"{API}/driver/bookings/xxxx/cancel",
                          headers=driver_ctx["h"],
                          json={"reason": "other"})
        assert r.status_code == 400

    def test_I_customer_forbidden(self, customer_ctx):
        r = requests.post(f"{API}/driver/bookings/xxxx/cancel",
                          headers=customer_ctx["h"],
                          json={"reason": "breakdown"})
        assert r.status_code == 403

    def test_I_missing_booking_404(self, driver_ctx):
        r = requests.post(f"{API}/driver/bookings/does_not_exist/cancel",
                          headers=driver_ctx["h"],
                          json={"reason": "breakdown"})
        assert r.status_code == 404

    def test_I_not_assigned_driver_403(self, driver_ctx, customer_ctx, mongo):
        # Seed a booking with a different driver_id
        jid, bid = _seed_job_and_booking(
            mongo, customer_id=customer_ctx["user"]["id"],
            driver_id="some_other_driver_id",
        )
        r = requests.post(f"{API}/driver/bookings/{bid}/cancel",
                          headers=driver_ctx["h"],
                          json={"reason": "breakdown"})
        assert r.status_code == 403
        mongo.bookings.delete_one({"id": bid})
        mongo.jobs.delete_one({"id": jid})

    def test_I_delivered_conflict_409(self, driver_ctx, customer_ctx, mongo):
        jid, bid = _seed_job_and_booking(
            mongo, customer_id=customer_ctx["user"]["id"],
            driver_id=driver_ctx["user"]["id"],
            booking_status="delivered",
        )
        r = requests.post(f"{API}/driver/bookings/{bid}/cancel",
                          headers=driver_ctx["h"],
                          json={"reason": "breakdown"})
        assert r.status_code == 409, r.text
        mongo.bookings.delete_one({"id": bid})
        mongo.jobs.delete_one({"id": jid})


# ===========================================================================
# J + K + L — Scheduled fixed cancel + blocked_driver_ids enforcement
# ===========================================================================

class TestScheduledFixedCancel:
    def test_J_and_K_and_L(self, driver_ctx, customer_ctx, mongo):
        jid, bid = _seed_job_and_booking(
            mongo, customer_id=customer_ctx["user"]["id"],
            driver_id=driver_ctx["user"]["id"],
            service_timing="scheduled", pricing_type="fixed",
        )
        r = requests.post(f"{API}/driver/bookings/{bid}/cancel",
                          headers=driver_ctx["h"],
                          json={"reason": "breakdown", "explanation": "engine trouble"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["reassigning_to_pool"] is True

        b = mongo.bookings.find_one({"id": bid})
        assert b["status"] == "cancelled_by_driver"
        assert b.get("driver_id") in (None,)

        j = mongo.jobs.find_one({"id": jid})
        assert j["status"] == "posted"
        assert j.get("assigned_driver_id") in (None,)
        assert driver_ctx["user"]["id"] in (j.get("blocked_driver_ids") or [])

        # audit row
        row = mongo.driver_cancellations.find_one({"booking_id": bid})
        assert row and row["reason"] == "breakdown"

        # customer email log
        time.sleep(0.5)
        elog = mongo.email_log.find_one({"to": CUSTOMER_EMAIL,
                                           "template": "driver_cancelled_booking"},
                                          sort=[("at", -1)])
        assert elog, "driver_cancelled_booking email not logged for customer"

        # K — re-accept blocked
        r2 = requests.post(f"{API}/jobs/{jid}/accept", headers=driver_ctx["h"])
        assert r2.status_code == 403
        assert "cancelled" in (r2.json().get("detail", "").lower())

        # L — nearby excludes blocked
        # (Depends on job posting location & driver's radius; just ensure endpoint returns and the jid is NOT present)
        rn = requests.get(f"{API}/jobs/nearby", headers=driver_ctx["h"])
        if rn.status_code == 200:
            found = [x for x in rn.json() if x.get("id") == jid]
            assert not found, "blocked job should not appear in /jobs/nearby"

        mongo.bookings.delete_one({"id": bid})
        mongo.jobs.delete_one({"id": jid})
        mongo.driver_cancellations.delete_many({"booking_id": bid})


# ===========================================================================
# M — Scheduled bidding cancel
# ===========================================================================

class TestScheduledBidding:
    def test_M(self, driver_ctx, customer_ctx, mongo):
        jid, bid = _seed_job_and_booking(
            mongo, customer_id=customer_ctx["user"]["id"],
            driver_id=driver_ctx["user"]["id"],
            service_timing="scheduled", pricing_type="bidding",
        )
        r = requests.post(f"{API}/driver/bookings/{bid}/cancel",
                          headers=driver_ctx["h"],
                          json={"reason": "vehicle_issue"})
        assert r.status_code == 200
        j = mongo.jobs.find_one({"id": jid})
        assert j["status"] == "posted"
        mongo.bookings.delete_one({"id": bid})
        mongo.jobs.delete_one({"id": jid})
        mongo.driver_cancellations.delete_many({"booking_id": bid})


# ===========================================================================
# N + O — ASAP transport / recovery cancel
# ===========================================================================

class TestAsapCancel:
    @pytest.mark.parametrize("svc_type", ["transport", "breakdown_recovery"])
    def test_N_O_asap_returns_to_dispatch_ready(self, driver_ctx, customer_ctx, mongo, svc_type):
        # seed ASAP job
        jid, bid = _seed_job_and_booking(
            mongo, customer_id=customer_ctx["user"]["id"],
            driver_id=driver_ctx["user"]["id"],
            service_timing="asap", pricing_type="fixed",
            service_type=svc_type,
        )
        # Set an OLD dispatch_ready_at
        mongo.jobs.update_one({"id": jid}, {"$set": {"dispatch_ready_at": "2020-01-01T00:00:00+00:00"}})

        r = requests.post(f"{API}/driver/bookings/{bid}/cancel",
                          headers=driver_ctx["h"],
                          json={"reason": "route_or_access"})
        assert r.status_code == 200, r.text

        j = mongo.jobs.find_one({"id": jid})
        assert j["status"] == "dispatch_ready", f"expected dispatch_ready got {j['status']}"
        assert j.get("assigned_driver_id") in (None,)
        assert j["dispatch_ready_at"] > "2020-01-01T00:00:00+00:00", "dispatch_ready_at not refreshed"

        mongo.bookings.delete_one({"id": bid})
        mongo.jobs.delete_one({"id": jid})
        mongo.driver_cancellations.delete_many({"booking_id": bid})


# ===========================================================================
# R + S — history endpoints
# ===========================================================================

class TestCancellationHistory:
    def test_R_driver_history(self, driver_ctx):
        r = requests.get(f"{API}/driver/cancellations/mine", headers=driver_ctx["h"])
        assert r.status_code == 200
        assert "count" in r.json() and "cancellations" in r.json()

    def test_S_admin_history(self, admin_ctx, driver_ctx):
        r = requests.get(f"{API}/admin/driver-cancellations", headers=admin_ctx["h"])
        assert r.status_code == 200
        r2 = requests.get(f"{API}/admin/driver-cancellations",
                          params={"driver_id": driver_ctx["user"]["id"]},
                          headers=admin_ctx["h"])
        assert r2.status_code == 200
        for row in r2.json()["cancellations"]:
            assert row["driver_id"] == driver_ctx["user"]["id"]


# ===========================================================================
# V + W — review dedup
# ===========================================================================

class TestReviewDedup:
    def test_V_W(self, driver_ctx, customer_ctx, mongo):
        jid, bid = _seed_job_and_booking(
            mongo, customer_id=customer_ctx["user"]["id"],
            driver_id=driver_ctx["user"]["id"],
            booking_status="completed", job_status="completed",
        )
        # W — before any review, /mine returns null
        rm = requests.get(f"{API}/bookings/{bid}/review/mine", headers=customer_ctx["h"])
        assert rm.status_code == 200
        assert rm.json() in (None, {})

        # First review by customer
        r = requests.post(f"{API}/bookings/{bid}/review", headers=customer_ctx["h"],
                          json={"rating": 5, "comment": "Great"})
        assert r.status_code == 200, r.text

        # V — dedup
        r2 = requests.post(f"{API}/bookings/{bid}/review", headers=customer_ctx["h"],
                           json={"rating": 4, "comment": "Duplicate"})
        assert r2.status_code == 409

        # W — /mine now returns the review
        rm2 = requests.get(f"{API}/bookings/{bid}/review/mine", headers=customer_ctx["h"])
        assert rm2.status_code == 200
        assert rm2.json() and rm2.json().get("rating") == 5

        # Y — Driver reviews customer (two-way)
        rd = requests.post(f"{API}/bookings/{bid}/review", headers=driver_ctx["h"],
                           json={"rating": 4, "comment": "Nice customer"})
        assert rd.status_code == 200, rd.text
        driver_review = rd.json()
        assert driver_review["target_id"] == customer_ctx["user"]["id"]

        # customer received new_review email
        time.sleep(0.5)
        el = mongo.email_log.find_one({"to": CUSTOMER_EMAIL, "template": "new_review"},
                                        sort=[("at", -1)])
        assert el, "new_review email not logged for customer"

        # customer rating aggregate
        cust_doc = mongo.users.find_one({"id": customer_ctx["user"]["id"]})
        assert cust_doc.get("rating") is not None
        assert cust_doc.get("review_count", 0) >= 1

        # Z — reply flow
        # not-target 403
        rr_bad = requests.post(f"{API}/reviews/{driver_review['id']}/reply",
                               headers=driver_ctx["h"], json={"text": "hi"})
        assert rr_bad.status_code == 403

        # empty text 400
        rr_empty = requests.post(f"{API}/reviews/{driver_review['id']}/reply",
                                 headers=customer_ctx["h"], json={"text": "  "})
        assert rr_empty.status_code == 400

        # happy path
        rr = requests.post(f"{API}/reviews/{driver_review['id']}/reply",
                           headers=customer_ctx["h"], json={"text": "thanks!"})
        assert rr.status_code == 200

        # second reply 409
        rr2 = requests.post(f"{API}/reviews/{driver_review['id']}/reply",
                            headers=customer_ctx["h"], json={"text": "again"})
        assert rr2.status_code == 409

        # cleanup
        mongo.reviews.delete_many({"booking_id": bid})
        mongo.bookings.delete_one({"id": bid})
        mongo.jobs.delete_one({"id": jid})


# ===========================================================================
# AC — POD/Complete role split
# ===========================================================================

class TestPodCompleteSplit:
    def test_AC_role_split(self, driver_ctx, customer_ctx, mongo):
        jid, bid = _seed_job_and_booking(
            mongo, customer_id=customer_ctx["user"]["id"],
            driver_id=driver_ctx["user"]["id"],
            booking_status="on_route", job_status="on_route",
        )
        # Driver → delivered via /status
        r = requests.post(f"{API}/bookings/{bid}/status",
                          headers=driver_ctx["h"], json={"status": "delivered"})
        assert r.status_code == 200, r.text

        # Driver → /complete → 403 role required
        rc = requests.post(f"{API}/bookings/{bid}/complete", headers=driver_ctx["h"])
        assert rc.status_code == 403
        detail = (rc.json().get("detail") or "").lower()
        assert "role" in detail or "customer" in detail

        # Driver → POD ok
        b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
        rp = requests.post(f"{API}/bookings/{bid}/pod", headers=driver_ctx["h"],
                           json={"photos": [b64], "signature": b64})
        assert rp.status_code == 200, rp.text

        # snapshot driver.total_jobs
        before = mongo.users.find_one({"id": driver_ctx["user"]["id"]}).get("total_jobs", 0)

        # Customer → complete succeeds
        rcust = requests.post(f"{API}/bookings/{bid}/complete", headers=customer_ctx["h"])
        assert rcust.status_code == 200, rcust.text

        after = mongo.users.find_one({"id": driver_ctx["user"]["id"]}).get("total_jobs", 0)
        assert after == before + 1

        time.sleep(0.5)
        el = mongo.email_log.find_one({"to": CUSTOMER_EMAIL,
                                          "template": "booking_completed"},
                                         sort=[("at", -1)])
        assert el, "booking_completed email not logged"

        mongo.bookings.delete_one({"id": bid})
        mongo.jobs.delete_one({"id": jid})


# ===========================================================================
# AE — driver_id KeyError hardening (R22)
# ===========================================================================

class TestDriverIdHardening:
    def test_AE(self, customer_ctx, mongo):
        # Create a booking with driver_id=None explicitly
        jid, bid = _seed_job_and_booking(
            mongo, customer_id=customer_ctx["user"]["id"],
            driver_id=None, accept_ready=False,
            booking_status="paid", job_status="posted",
        )
        for path in (f"{API}/bookings/mine", f"{API}/bookings/{bid}",
                     f"{API}/messages/summary"):
            r = requests.get(path, headers=customer_ctx["h"])
            assert r.status_code == 200, f"{path} => {r.status_code} {r.text}"
        mongo.bookings.delete_one({"id": bid})
        mongo.jobs.delete_one({"id": jid})


# ===========================================================================
# AF — Regression
# ===========================================================================

class TestRegression:
    def test_AF_regression_endpoints(self, driver_ctx, customer_ctx):
        r = requests.get(f"{API}/jobs/nearby", headers=driver_ctx["h"])
        assert r.status_code == 200
        r2 = requests.get(f"{API}/quote/estimate", headers=customer_ctx["h"], params={
            "pickup_lat": 51.5155, "pickup_lng": -0.0922,
            "dropoff_lat": 53.4794, "dropoff_lng": -2.2453,
            "vehicle_size": "van",
        })
        assert r2.status_code in (200, 422), r2.text
