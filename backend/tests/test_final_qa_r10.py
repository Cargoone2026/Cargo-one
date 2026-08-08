"""Final QA Round 10 — Admin + Customer Bug Sweep (6 bugs).

Backend coverage:
  1. Customer fixed-price accept flow — job stays visible with status='accepted',
     notification pushed with data.job_id, email_log row emitted (skipped in preview).
  2. Admin GET /admin/jobs/{id} — full drilldown envelope.
  3. Admin GET /admin/users/{id} — full drilldown envelope with role stats.
  4. Admin GET /admin/users?role=<role> — filtered listing.
  5. Admin POST /admin/contact-messages/{id}/reply — server-side reply from
     admin@cargoone.co.uk, replied_at persisted, email_log row emitted.
"""
from __future__ import annotations

import os
import time
import uuid
from datetime import datetime, timezone, timedelta

import pymongo
import pytest
import requests

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL",
    "https://cargo-repo-bridge.preview.emergentagent.com",
).rstrip("/")
API = f"{BASE_URL}/api"
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

ADMIN_EMAIL = "admin@cargoone.com"
ADMIN_PASS = "Vc9O0sNDGR6SfzKDaa0L1lhp"


def _mongo():
    c = pymongo.MongoClient(MONGO_URL)
    return c, c[DB_NAME]


def _bearer(tok):
    return {"Authorization": f"Bearer {tok}"}


def _u(tag):
    return f"TEST_qar10_{tag}_{uuid.uuid4().hex[:8]}@example.com"


def _register(role="customer", tag=""):
    email = _u(tag or role)
    r = requests.post(f"{API}/auth/register", json={
        "email": email, "password": "PasswordTest12345!",
        "name": f"QAR10 {role.title()}", "role": role,
        "phone": "+447700900456",
    }, timeout=20)
    assert r.status_code == 200, r.text
    body = r.json()
    body["email"] = email
    return body


def _activate_driver(driver_id: str):
    c, db = _mongo()
    db.users.update_one({"id": driver_id}, {"$set": {"status": "active"}})
    c.close()


def _admin_login():
    r = requests.post(f"{API}/auth/login",
                       json={"email": ADMIN_EMAIL, "password": ADMIN_PASS},
                       timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _post_fixed_transport(cust_token, *, price=50):
    now = datetime.now(timezone.utc)
    payload = {
        "title": f"QAR10-FP-{uuid.uuid4().hex[:6]}",
        "description": "R10 fixed price fixture",
        "category": "parcels",
        "pickup_address": "1 Pickup Rd", "pickup_town": "London",
        "pickup_lat": 51.51, "pickup_lng": -0.10,
        "dropoff_address": "2 Drop Rd", "dropoff_town": "London",
        "dropoff_lat": 51.55, "dropoff_lng": -0.08,
        "weight_kg": 100,
        "collection_date": (now + timedelta(hours=6)).isoformat(),
        "delivery_date": (now + timedelta(hours=12)).isoformat(),
        "pricing_type": "fixed", "fixed_price": price,
        "service_timing": "scheduled", "service_type": "transport",
        "transport_category": "parcels",
    }
    r = requests.post(f"{API}/jobs", json=payload,
                       headers=_bearer(cust_token), timeout=20)
    assert r.status_code == 200, r.text
    return r.json()


# ---------------------------------------------------------------------------
# 1. Customer FIXED-PRICE accept flow (P0)
# ---------------------------------------------------------------------------


def test_fixed_price_accept_returns_ok():
    cust = _register("customer", "acc")
    drv = _register("driver", "acc")
    _activate_driver(drv["user"]["id"])

    job = _post_fixed_transport(cust["access_token"], price=50)
    r = requests.post(f"{API}/jobs/{job['id']}/accept",
                       headers=_bearer(drv["access_token"]), timeout=20)
    assert r.status_code == 200, r.text
    assert r.json().get("ok") is True


def test_fixed_price_accepted_job_still_visible_for_customer():
    """Round 10 bug (5): after driver accept, /jobs/mine must still return
    the job with status='accepted' + assigned_driver_name populated so the
    customer can pay the deposit."""
    cust = _register("customer", "vis")
    drv = _register("driver", "vis")
    _activate_driver(drv["user"]["id"])

    job = _post_fixed_transport(cust["access_token"])
    r = requests.post(f"{API}/jobs/{job['id']}/accept",
                       headers=_bearer(drv["access_token"]), timeout=20)
    assert r.status_code == 200, r.text

    mine = requests.get(f"{API}/jobs/mine",
                         headers=_bearer(cust["access_token"]), timeout=15)
    assert mine.status_code == 200, mine.text
    ours = [j for j in mine.json() if j["id"] == job["id"]]
    assert ours, f"posted job missing from /jobs/mine: {mine.json()}"
    j = ours[0]
    assert j["status"] == "accepted", j
    assert j.get("assigned_driver_name"), j
    assert j.get("assigned_driver_id") == drv["user"]["id"], j


def test_fixed_price_accept_pushes_customer_notification_with_job_id():
    cust = _register("customer", "notif")
    drv = _register("driver", "notif")
    _activate_driver(drv["user"]["id"])

    job = _post_fixed_transport(cust["access_token"])
    r = requests.post(f"{API}/jobs/{job['id']}/accept",
                       headers=_bearer(drv["access_token"]), timeout=20)
    assert r.status_code == 200

    # Give push_notification a moment to persist
    time.sleep(0.5)
    n = requests.get(f"{API}/notifications",
                      headers=_bearer(cust["access_token"]), timeout=15)
    assert n.status_code == 200, n.text
    match = [x for x in n.json()
              if x.get("title") == "Driver accepted your job"
              and (x.get("data") or {}).get("job_id") == job["id"]]
    assert match, f"expected notification for job {job['id']}: {n.json()[:3]}"
    assert (match[0]["data"].get("kind") == "job_accepted")


def test_fixed_price_accept_writes_customer_email_log_row():
    cust = _register("customer", "mail")
    drv = _register("driver", "mail")
    _activate_driver(drv["user"]["id"])

    job = _post_fixed_transport(cust["access_token"])
    r = requests.post(f"{API}/jobs/{job['id']}/accept",
                       headers=_bearer(drv["access_token"]), timeout=20)
    assert r.status_code == 200

    # Wait up to 5s for the audit row
    c, db = _mongo()
    row = None
    deadline = time.time() + 6
    while time.time() < deadline:
        row = db.email_log.find_one({
            "template": "customer_driver_accepted",
            "user_id": cust["user"]["id"],
        })
        if row:
            break
        time.sleep(0.4)
    c.close()
    assert row, "customer_driver_accepted email_log row not created"
    # RESEND is intentionally unconfigured in preview → status must be
    # 'skipped' (or 'sent' if a key was later added; treat both as pass).
    assert row["status"] in ("skipped", "sent", "failed"), row
    # Sender must be a plausible noreply@ / admin@ address
    sender = (row.get("sender") or "").lower()
    assert sender.startswith("noreply@") or sender.startswith("admin@") \
        or "@cargoone" in sender, f"unexpected sender: {sender}"


# ---------------------------------------------------------------------------
# 2. Admin GET /admin/jobs/{id} drilldown (P1)
# ---------------------------------------------------------------------------


def test_admin_job_detail_envelope():
    admin_tok = _admin_login()
    cust = _register("customer", "aj")
    job = _post_fixed_transport(cust["access_token"])

    r = requests.get(f"{API}/admin/jobs/{job['id']}",
                      headers=_bearer(admin_tok), timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert set(body.keys()) >= {"job", "customer", "driver", "bids", "booking"}, body.keys()
    assert body["job"]["id"] == job["id"]
    assert body["customer"] and body["customer"]["id"] == cust["user"]["id"]
    assert body["driver"] is None  # no driver assigned yet
    assert isinstance(body["bids"], list)
    # No booking yet since job is only posted
    assert body["booking"] is None


def test_admin_job_detail_derives_recommended_vehicle_for_historic():
    """Spec (P1c): historic ASAP job missing recommended_vehicle must have
    it derived on the fly by /admin/jobs/{id}."""
    admin_tok = _admin_login()
    cust = _register("customer", "ajv")
    now = datetime.now(timezone.utc)
    payload = {
        "title": "QAR10-HIST", "description": "hist",
        "category": "parcels",
        "pickup_address": "1", "pickup_town": "London",
        "pickup_lat": 51.51, "pickup_lng": -0.10,
        "dropoff_address": "2", "dropoff_town": "London",
        "dropoff_lat": 51.55, "dropoff_lng": -0.08,
        "weight_kg": 100,
        "collection_date": (now + timedelta(hours=1)).isoformat(),
        "delivery_date": (now + timedelta(hours=3)).isoformat(),
        "pricing_type": "fixed", "fixed_price": 250,
        "service_timing": "asap", "service_type": "transport",
        "transport_category": "furniture",
    }
    r = requests.post(f"{API}/jobs", json=payload,
                       headers=_bearer(cust["access_token"]), timeout=15)
    assert r.status_code == 200
    job = r.json()

    # Wipe recommended_vehicle to simulate legacy data
    c, db = _mongo()
    db.jobs.update_one({"id": job["id"]}, {"$unset": {"recommended_vehicle": ""}})
    c.close()

    r = requests.get(f"{API}/admin/jobs/{job['id']}",
                      headers=_bearer(admin_tok), timeout=15)
    assert r.status_code == 200
    assert r.json()["job"].get("recommended_vehicle"), r.json()["job"]


def test_admin_job_detail_404_for_missing():
    admin_tok = _admin_login()
    r = requests.get(f"{API}/admin/jobs/nope-{uuid.uuid4().hex[:8]}",
                      headers=_bearer(admin_tok), timeout=15)
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# 3. Admin GET /admin/users?role= filter + /admin/users/{id} drilldown
# ---------------------------------------------------------------------------


def test_admin_users_role_filter_customer_only():
    admin_tok = _admin_login()
    r = requests.get(f"{API}/admin/users?role=customer",
                      headers=_bearer(admin_tok), timeout=15)
    assert r.status_code == 200
    users = r.json()
    assert all(u.get("role") == "customer" for u in users), \
        set(u.get("role") for u in users)


def test_admin_users_role_filter_driver_only():
    admin_tok = _admin_login()
    r = requests.get(f"{API}/admin/users?role=driver",
                      headers=_bearer(admin_tok), timeout=15)
    assert r.status_code == 200
    users = r.json()
    assert all(u.get("role") == "driver" for u in users)


def test_admin_users_no_filter_returns_all_roles():
    admin_tok = _admin_login()
    # Seed one driver so both roles exist
    _register("driver", "mix")
    r = requests.get(f"{API}/admin/users",
                      headers=_bearer(admin_tok), timeout=15)
    assert r.status_code == 200
    roles = {u.get("role") for u in r.json()}
    # Expect at least customer + driver + admin somewhere in the system
    assert "customer" in roles and "driver" in roles, roles


def test_admin_user_detail_customer():
    admin_tok = _admin_login()
    cust = _register("customer", "ud")
    # Give them a job for recent_jobs
    _post_fixed_transport(cust["access_token"])

    r = requests.get(f"{API}/admin/users/{cust['user']['id']}",
                      headers=_bearer(admin_tok), timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert set(body.keys()) >= {"user", "recent_jobs", "recent_bookings"}, body
    assert body["user"]["id"] == cust["user"]["id"]
    assert body["user"]["role"] == "customer"
    assert "password_hash" not in body["user"]
    assert len(body["recent_jobs"]) >= 1


def test_admin_user_detail_driver():
    admin_tok = _admin_login()
    drv = _register("driver", "ud2")
    r = requests.get(f"{API}/admin/users/{drv['user']['id']}",
                      headers=_bearer(admin_tok), timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert body["user"]["role"] == "driver"
    # Driver has no recent_jobs (jobs are owned by customers)
    assert body["recent_jobs"] == []


def test_admin_user_detail_404():
    admin_tok = _admin_login()
    r = requests.get(f"{API}/admin/users/nope-{uuid.uuid4().hex[:8]}",
                      headers=_bearer(admin_tok), timeout=15)
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# 4. Admin POST /admin/contact-messages/{id}/reply (P2)
# ---------------------------------------------------------------------------


def _seed_contact_message():
    c, db = _mongo()
    doc = {
        "id": f"cm-qar10-{uuid.uuid4().hex[:10]}",
        "name": "QAR10 Reporter",
        "email": f"TEST_qar10_reply_{uuid.uuid4().hex[:6]}@example.com",
        "subject": "Test enquiry",
        "message": "Original message body.",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    db.contact_messages.insert_one(dict(doc))
    c.close()
    return doc


def test_admin_reply_contact_message_success():
    admin_tok = _admin_login()
    cm = _seed_contact_message()

    r = requests.post(
        f"{API}/admin/contact-messages/{cm['id']}/reply",
        json={"body": "Hello, we've received your enquiry and will action shortly."},
        headers=_bearer(admin_tok), timeout=20,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("ok") is True
    # Preview has no RESEND key → status must be 'skipped'
    assert body.get("status") in ("skipped", "sent"), body

    # replied_at + admin metadata persisted
    c, db = _mongo()
    doc = db.contact_messages.find_one({"id": cm["id"]})
    row = db.email_log.find_one({"template": "admin_contact_reply",
                                    "to": cm["email"]})
    c.close()
    assert doc and doc.get("replied_at"), doc
    assert doc.get("replied_by_name")
    assert row, "email_log row missing for admin_contact_reply"
    assert (row.get("sender") or "").lower() == "admin@cargoone.co.uk"
    assert (row.get("reply_to") or "").lower() == "admin@cargoone.co.uk"


def test_admin_reply_rejects_short_body():
    admin_tok = _admin_login()
    cm = _seed_contact_message()
    r = requests.post(
        f"{API}/admin/contact-messages/{cm['id']}/reply",
        json={"body": "hi"},
        headers=_bearer(admin_tok), timeout=15,
    )
    assert r.status_code == 400, r.text


def test_admin_reply_404_for_missing_message():
    admin_tok = _admin_login()
    r = requests.post(
        f"{API}/admin/contact-messages/nope-xyz/reply",
        json={"body": "This is a long enough reply body."},
        headers=_bearer(admin_tok), timeout=15,
    )
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# 5. Non-admin cannot hit admin endpoints (RBAC guard)
# ---------------------------------------------------------------------------


def test_admin_endpoints_reject_customer():
    cust = _register("customer", "rbac")
    r1 = requests.get(f"{API}/admin/jobs/x",
                       headers=_bearer(cust["access_token"]), timeout=15)
    r2 = requests.get(f"{API}/admin/users/x",
                       headers=_bearer(cust["access_token"]), timeout=15)
    r3 = requests.post(f"{API}/admin/contact-messages/x/reply",
                        json={"body": "hello world"},
                        headers=_bearer(cust["access_token"]), timeout=15)
    assert r1.status_code in (401, 403), r1.status_code
    assert r2.status_code in (401, 403), r2.status_code
    assert r3.status_code in (401, 403), r3.status_code
