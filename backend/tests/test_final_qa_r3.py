"""Final QA Round 3 backend tests.

Covers:
 - POST /api/bookings/{id}/conversation/presence
 - POST /api/bookings/{id}/messages/mark-read
 - GET  /api/messages/unread-count
 - GET  /api/bookings/{id}/messages now stamps delivered_at/read_at
 - POST /api/bookings/{id}/messages fires send_new_message_email (email_log)
 - 5-minute throttle via conversation_email_state
 - Presence-based email suppression
 - POST /api/jobs/{id}/bids fires send_new_bid_email
 - ASAP POST /api/jobs with photos persists them; GET returns them
 - GET /api/booking-fee-bands/preview (source-of-truth alignment)

Auth: uses Bearer JWTs (CSRF-exempt); direct pymongo used to force a booking
into payment_status=paid, to clear/wait on email throttle state, and to
inspect email_log + conversation_email_state without waiting for Resend.
"""
import os
import time
import uuid
from datetime import datetime, timezone, timedelta

import pytest
import pymongo
import requests

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL",
    "https://cargo-repo-bridge.preview.emergentagent.com",
).rstrip("/")
API = f"{BASE_URL}/api"

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _u(tag):
    return f"TEST_qar3_{tag}_{uuid.uuid4().hex[:8]}@example.com"


def _register(email, role):
    r = requests.post(f"{API}/auth/register", json={
        "email": email, "password": "PasswordTest12345!",
        "name": f"QA R3 {role}", "role": role, "phone": "+447700900000",
    }, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()  # {access_token, user}


def _bearer(tok):
    return {"Authorization": f"Bearer {tok}"}


def _dates():
    now = datetime.now(timezone.utc)
    return {
        "collection_date": (now + timedelta(days=2)).isoformat(),
        "delivery_date": (now + timedelta(days=3)).isoformat(),
    }


def _mongo():
    c = pymongo.MongoClient(MONGO_URL)
    return c, c[DB_NAME]


def _force_paid(booking_id):
    c, db = _mongo()
    db.bookings.update_one(
        {"id": booking_id},
        {"$set": {"payment_status": "paid", "status": "deposit_paid",
                  "paid_at": datetime.now(timezone.utc).isoformat()}},
    )
    c.close()


def _reset_email_throttle(user_id, booking_id):
    c, db = _mongo()
    db.conversation_email_state.delete_many(
        {"user_id": user_id, "booking_id": booking_id}
    )
    db.conversation_presence.delete_many(
        {"user_id": user_id, "booking_id": booking_id}
    )
    db.email_log.delete_many(
        {"user_id": user_id, "booking_id": booking_id, "template": "new_message"}
    )
    c.close()


# ---------------------------------------------------------------------------
# Session scoped booking: create customer, driver, job, booking, force paid
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def paid_booking():
    """Create a fresh customer+driver+job+booking, force-paid."""
    cust = _register(_u("cust"), "customer")
    drv = _register(_u("driver"), "driver")

    # Approve driver via admin
    admin_email = os.environ.get("TEST_ADMIN_EMAIL", "admin@cargoone.com")
    admin_pass = os.environ.get("TEST_ADMIN_PASSWORD", "Vc9O0sNDGR6SfzKDaa0L1lhp")
    ar = requests.post(f"{API}/auth/login",
                       json={"email": admin_email, "password": admin_pass}, timeout=20)
    admin_tok = ar.json()["access_token"] if ar.status_code == 200 else None

    if admin_tok:
        requests.post(f"{API}/admin/users/{drv['user']['id']}/approve",
                      headers=_bearer(admin_tok), timeout=20)

    # Create a job as customer
    job_payload = {
        "title": "QA R3 test job",
        "category": "furniture",
        "description": "QA R3 job",
        "pickup_address": "1 Test St",
        "pickup_town": "London",
        "pickup_lat": 51.5074,
        "pickup_lng": -0.1278,
        "dropoff_address": "2 Test Rd",
        "dropoff_town": "Reading",
        "dropoff_lat": 51.4543,
        "dropoff_lng": -0.9781,
        "pricing_type": "fixed",
        "fixed_price": 200.0,
        **_dates(),
    }
    jr = requests.post(f"{API}/jobs", json=job_payload,
                       headers=_bearer(cust["access_token"]), timeout=20)
    assert jr.status_code == 200, jr.text
    job = jr.json()

    # Driver accepts fixed job -> job.status=accepted
    ar2 = requests.post(f"{API}/jobs/{job['id']}/accept",
                        headers=_bearer(drv["access_token"]), timeout=20)
    assert ar2.status_code == 200, ar2.text

    # Customer creates booking (deposit-pending state)
    br = requests.post(f"{API}/bookings", json={"job_id": job['id']},
                       headers=_bearer(cust["access_token"]), timeout=20)
    assert br.status_code == 200, br.text
    booking = br.json()
    booking_id = booking.get("id")
    assert booking_id, f"Could not derive booking id from {booking}"

    _force_paid(booking_id)

    return {
        "customer": cust, "driver": drv, "job": job, "booking_id": booking_id,
    }


# ---------------------------------------------------------------------------
# 1. booking-fee-bands preview endpoint (source of truth)
# ---------------------------------------------------------------------------

def test_booking_fee_bands_preview_source_of_truth():
    # Band C: 300.01 – 600 -> 13%
    r = requests.get(f"{API}/booking-fee-bands/preview",
                     params={"driver_charge": 400.0}, timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "booking_fee" in data and "booking_fee_percent" in data
    assert data["booking_fee_percent"] == 13.0
    # 13% of 400 = 52.0 (rounded to 2dp)
    assert abs(float(data["booking_fee"]) - 52.0) < 0.5


# ---------------------------------------------------------------------------
# 2. ASAP job persists photos & GET returns them
# ---------------------------------------------------------------------------

def test_asap_job_persists_photos():
    cust = _register(_u("asap"), "customer")
    tiny = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
    payload = {
        "title": "ASAP QA R3",
        "category": "furniture",
        "description": "asap",
        "photos": [tiny, tiny],
        "pickup_address": "1 A", "pickup_town": "London",
        "pickup_lat": 51.5, "pickup_lng": -0.12,
        "dropoff_address": "2 B", "dropoff_town": "Reading",
        "dropoff_lat": 51.45, "dropoff_lng": -0.97,
        "service_timing": "asap",
        "service_type": "transport",
        "pricing_type": "fixed",
        "fixed_price": 120.0,
        **_dates(),
    }
    r = requests.post(f"{API}/jobs", json=payload,
                      headers=_bearer(cust["access_token"]), timeout=20)
    assert r.status_code == 200, r.text
    job = r.json()
    assert job.get("service_timing") == "asap"
    assert isinstance(job.get("photos"), list) and len(job["photos"]) == 2

    # GET returns them
    g = requests.get(f"{API}/jobs/{job['id']}",
                     headers=_bearer(cust["access_token"]), timeout=20)
    assert g.status_code == 200
    assert len(g.json().get("photos") or []) == 2


def test_asap_recovery_persists_photos():
    cust = _register(_u("asap_rec"), "customer")
    tiny = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
    payload = {
        "title": "ASAP Recovery QA R3",
        "category": "cars",
        "description": "asap recovery",
        "photos": [tiny],
        "pickup_address": "1 A", "pickup_town": "London",
        "pickup_lat": 51.5, "pickup_lng": -0.12,
        "dropoff_address": "2 B", "dropoff_town": "Reading",
        "dropoff_lat": 51.45, "dropoff_lng": -0.97,
        "service_timing": "asap",
        "service_type": "breakdown_recovery",
        "pricing_type": "fixed",
        "fixed_price": 250.0,
        **_dates(),
    }
    r = requests.post(f"{API}/jobs", json=payload,
                      headers=_bearer(cust["access_token"]), timeout=20)
    assert r.status_code == 200, r.text
    job = r.json()
    assert job.get("service_type") == "breakdown_recovery"
    assert len(job.get("photos") or []) == 1


# ---------------------------------------------------------------------------
# 3. Presence endpoint
# ---------------------------------------------------------------------------

def test_presence_ping_ok(paid_booking):
    cust = paid_booking["customer"]
    bid = paid_booking["booking_id"]
    r = requests.post(f"{API}/bookings/{bid}/conversation/presence",
                      headers=_bearer(cust["access_token"]), timeout=20)
    assert r.status_code == 200, r.text
    assert r.json() == {"ok": True}


def test_presence_ping_forbidden_for_stranger(paid_booking):
    stranger = _register(_u("stranger"), "customer")
    bid = paid_booking["booking_id"]
    r = requests.post(f"{API}/bookings/{bid}/conversation/presence",
                      headers=_bearer(stranger["access_token"]), timeout=20)
    assert r.status_code == 403


# ---------------------------------------------------------------------------
# 4. Send + list messages: delivered_at + read_at stamps
# ---------------------------------------------------------------------------

def test_send_message_and_read_stamps(paid_booking):
    cust = paid_booking["customer"]
    drv = paid_booking["driver"]
    bid = paid_booking["booking_id"]

    # Reset throttle state so we can also observe email_log deterministically
    _reset_email_throttle(drv["user"]["id"], bid)

    # Customer sends msg — recipient is driver
    r = requests.post(f"{API}/bookings/{bid}/messages",
                      json={"text": "Hello driver, this is a QA R3 test"},
                      headers=_bearer(cust["access_token"]), timeout=20)
    assert r.status_code == 200, r.text
    m = r.json()
    assert m.get("delivered_at"), "sent message must carry delivered_at"
    assert m.get("read_at") in (None, ""), "not-yet-read message must not have read_at"

    # Driver lists messages -> read_at gets stamped for customer's message
    lr = requests.get(f"{API}/bookings/{bid}/messages",
                      headers=_bearer(drv["access_token"]), timeout=20)
    assert lr.status_code == 200
    msgs = lr.json()
    my = [x for x in msgs if x["id"] == m["id"]]
    assert my and my[0].get("read") is True
    assert my[0].get("read_at"), "read_at must be populated after other-party read"


# ---------------------------------------------------------------------------
# 5. mark-read endpoint
# ---------------------------------------------------------------------------

def test_mark_read_endpoint(paid_booking):
    cust = paid_booking["customer"]
    drv = paid_booking["driver"]
    bid = paid_booking["booking_id"]

    _reset_email_throttle(cust["user"]["id"], bid)

    # Driver -> customer message
    r = requests.post(f"{API}/bookings/{bid}/messages",
                      json={"text": "reply from driver"},
                      headers=_bearer(drv["access_token"]), timeout=20)
    assert r.status_code == 200

    mr = requests.post(f"{API}/bookings/{bid}/messages/mark-read",
                       headers=_bearer(cust["access_token"]), timeout=20)
    assert mr.status_code == 200, mr.text
    payload = mr.json()
    assert payload.get("ok") is True
    assert payload.get("marked_read", 0) >= 1


def test_mark_read_forbidden_for_stranger(paid_booking):
    stranger = _register(_u("mr_stranger"), "customer")
    r = requests.post(f"{API}/bookings/{paid_booking['booking_id']}/messages/mark-read",
                      headers=_bearer(stranger["access_token"]), timeout=20)
    assert r.status_code == 403


# ---------------------------------------------------------------------------
# 6. Unread-count endpoint
# ---------------------------------------------------------------------------

def test_unread_count_endpoint(paid_booking):
    cust = paid_booking["customer"]
    drv = paid_booking["driver"]
    bid = paid_booking["booking_id"]

    # Customer marks-read first, then driver sends 2 new msgs.
    requests.post(f"{API}/bookings/{bid}/messages/mark-read",
                  headers=_bearer(cust["access_token"]), timeout=20)
    for i in range(2):
        r = requests.post(f"{API}/bookings/{bid}/messages",
                          json={"text": f"unread-{i}"},
                          headers=_bearer(drv["access_token"]), timeout=20)
        assert r.status_code == 200

    uc = requests.get(f"{API}/messages/unread-count",
                      headers=_bearer(cust["access_token"]), timeout=20)
    assert uc.status_code == 200, uc.text
    data = uc.json()
    assert "total" in data and "by_booking" in data
    assert data["by_booking"].get(bid, 0) >= 2
    assert data["total"] >= 2

    # Now open messages -> unread should drop to 0 for this booking
    requests.get(f"{API}/bookings/{bid}/messages",
                 headers=_bearer(cust["access_token"]), timeout=20)
    uc2 = requests.get(f"{API}/messages/unread-count",
                       headers=_bearer(cust["access_token"]), timeout=20)
    assert uc2.status_code == 200
    assert uc2.json()["by_booking"].get(bid, 0) == 0


# ---------------------------------------------------------------------------
# 7. Email flow: new_message logs to email_log & throttle blocks 2nd within 5min
# ---------------------------------------------------------------------------

def test_new_message_email_logged_and_throttled(paid_booking):
    cust = paid_booking["customer"]
    drv = paid_booking["driver"]
    bid = paid_booking["booking_id"]

    _reset_email_throttle(drv["user"]["id"], bid)

    # Ensure driver is NOT actively viewing (delete presence)
    c, db = _mongo()
    db.conversation_presence.delete_many({"user_id": drv["user"]["id"], "booking_id": bid})
    c.close()

    # 1st customer -> driver message: should log email + set throttle state
    r = requests.post(f"{API}/bookings/{bid}/messages",
                      json={"text": "throttle test 1"},
                      headers=_bearer(cust["access_token"]), timeout=20)
    assert r.status_code == 200

    # Give the fire-and-forget background code a moment
    time.sleep(1.0)

    c, db = _mongo()
    logs = list(db.email_log.find(
        {"user_id": drv["user"]["id"], "booking_id": bid, "template": "new_message"}
    ))
    state = db.conversation_email_state.find_one(
        {"user_id": drv["user"]["id"], "booking_id": bid}
    )
    c.close()
    assert len(logs) >= 1, f"expected at least 1 new_message email_log entry, got {len(logs)}"
    assert state and state.get("last_sent_at"), "conversation_email_state.last_sent_at should be set"
    # Subject line prefix
    subj = logs[-1]["subject"]
    assert "sent you a message" in subj, f"unexpected subject: {subj}"
    # Skipped (no Resend key) or sent — both acceptable
    assert logs[-1]["status"] in ("skipped", "sent", "failed")

    logs_before = len(logs)

    # 2nd message within the 5-min throttle window: NO new log
    r2 = requests.post(f"{API}/bookings/{bid}/messages",
                       json={"text": "throttle test 2"},
                       headers=_bearer(cust["access_token"]), timeout=20)
    assert r2.status_code == 200
    time.sleep(1.0)

    c, db = _mongo()
    logs_after = db.email_log.count_documents(
        {"user_id": drv["user"]["id"], "booking_id": bid, "template": "new_message"}
    )
    c.close()
    assert logs_after == logs_before, (
        f"throttle failed: {logs_after} logs after 2nd send (was {logs_before})"
    )


def test_new_message_email_suppressed_when_recipient_active(paid_booking):
    cust = paid_booking["customer"]
    drv = paid_booking["driver"]
    bid = paid_booking["booking_id"]

    _reset_email_throttle(drv["user"]["id"], bid)

    # Driver pings presence -> considered actively viewing
    pr = requests.post(f"{API}/bookings/{bid}/conversation/presence",
                       headers=_bearer(drv["access_token"]), timeout=20)
    assert pr.status_code == 200

    c, db = _mongo()
    before = db.email_log.count_documents(
        {"user_id": drv["user"]["id"], "booking_id": bid, "template": "new_message"}
    )
    c.close()

    r = requests.post(f"{API}/bookings/{bid}/messages",
                      json={"text": "should NOT email"},
                      headers=_bearer(cust["access_token"]), timeout=20)
    assert r.status_code == 200
    time.sleep(1.0)

    c, db = _mongo()
    after = db.email_log.count_documents(
        {"user_id": drv["user"]["id"], "booking_id": bid, "template": "new_message"}
    )
    c.close()
    assert after == before, "presence-active should suppress email"


# ---------------------------------------------------------------------------
# 8. Email flow: new_bid logs to email_log
# ---------------------------------------------------------------------------

def test_new_bid_email_logged():
    cust = _register(_u("bid_cust"), "customer")
    drv = _register(_u("bid_drv"), "driver")

    admin_email = os.environ.get("TEST_ADMIN_EMAIL", "admin@cargoone.com")
    admin_pass = os.environ.get("TEST_ADMIN_PASSWORD", "Vc9O0sNDGR6SfzKDaa0L1lhp")
    ar = requests.post(f"{API}/auth/login",
                       json={"email": admin_email, "password": admin_pass}, timeout=20)
    if ar.status_code == 200:
        requests.post(f"{API}/admin/users/{drv['user']['id']}/approve",
                      headers=_bearer(ar.json()["access_token"]), timeout=20)

    # Create bidding job as customer
    jr = requests.post(f"{API}/jobs", json={
        "title": "bid email test", "category": "furniture", "description": "x",
        "pickup_address": "1", "pickup_town": "London",
        "pickup_lat": 51.5, "pickup_lng": -0.12,
        "dropoff_address": "2", "dropoff_town": "Reading",
        "dropoff_lat": 51.45, "dropoff_lng": -0.97,
        "pricing_type": "bidding",
        **_dates(),
    }, headers=_bearer(cust["access_token"]), timeout=20)
    assert jr.status_code == 200, jr.text
    job = jr.json()

    br = requests.post(f"{API}/jobs/{job['id']}/bids",
                       json={"amount": 175.0, "message": "will do", "eta_hours": 2.0},
                       headers=_bearer(drv["access_token"]), timeout=20)
    assert br.status_code == 200, br.text
    time.sleep(1.0)

    c, db = _mongo()
    logs = list(db.email_log.find(
        {"user_id": cust["user"]["id"], "template": "new_bid"}
    ))
    c.close()
    assert len(logs) >= 1, "expected new_bid email_log entry after bid"
    assert "New bid" in logs[-1]["subject"]
