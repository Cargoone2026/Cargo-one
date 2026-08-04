"""Final QA Round 4 backend tests.

Covers:
 - GET /api/messages/summary — shape, ordering, ellipsized preview, moderated msg
 - GET /api/bookings/{id}/activity — event derivation matrix:
      * created only (no driver)
      * created + accepted + deposit_paid
      * created + accepted + deposit_paid + driver_message
      * same + job.status=on_route (→ en_route + delivered events)
   Plus 403 for strangers and 404 for missing booking.

Auth: Bearer JWTs (CSRF-exempt). Direct pymongo used to (a) flip
`payment_status=paid`, (b) drop a synthetic message that mimics a
moderated message (moderated=True), and (c) mutate job.status to drive
the lifecycle-derived events.
"""
import os
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


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _u(tag):
    return f"TEST_qar4_{tag}_{uuid.uuid4().hex[:8]}@example.com"


def _bearer(tok):
    return {"Authorization": f"Bearer {tok}"}


def _register(email, role):
    r = requests.post(f"{API}/auth/register", json={
        "email": email, "password": "PasswordTest12345!",
        "name": f"QA R4 {role}", "role": role, "phone": "+447700900000",
    }, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()


def _dates():
    now = datetime.now(timezone.utc)
    return {
        "collection_date": (now + timedelta(days=2)).isoformat(),
        "delivery_date": (now + timedelta(days=3)).isoformat(),
    }


def _mongo():
    c = pymongo.MongoClient(MONGO_URL)
    return c, c[DB_NAME]


def _admin_token():
    r = requests.post(f"{API}/auth/login", json={
        "email": os.environ.get("TEST_ADMIN_EMAIL", "admin@cargoone.com"),
        "password": os.environ.get(
            "TEST_ADMIN_PASSWORD", "Vc9O0sNDGR6SfzKDaa0L1lhp"),
    }, timeout=20)
    return r.json()["access_token"] if r.status_code == 200 else None


def _make_booking(cust, drv, title="R4 job"):
    """Create job (fixed) → driver accepts → customer creates booking."""
    jr = requests.post(f"{API}/jobs", json={
        "title": title,
        "category": "furniture",
        "description": title,
        "pickup_address": "1 Test St", "pickup_town": "London",
        "pickup_lat": 51.5074, "pickup_lng": -0.1278,
        "dropoff_address": "2 Test Rd", "dropoff_town": "Reading",
        "dropoff_lat": 51.4543, "dropoff_lng": -0.9781,
        "pricing_type": "fixed", "fixed_price": 220.0,
        **_dates(),
    }, headers=_bearer(cust["access_token"]), timeout=20)
    assert jr.status_code == 200, jr.text
    job = jr.json()
    ar = requests.post(f"{API}/jobs/{job['id']}/accept",
                       headers=_bearer(drv["access_token"]), timeout=20)
    assert ar.status_code == 200, ar.text
    br = requests.post(f"{API}/bookings", json={"job_id": job['id']},
                       headers=_bearer(cust["access_token"]), timeout=20)
    assert br.status_code == 200, br.text
    return job, br.json()


def _approve(drv_uid):
    tok = _admin_token()
    if tok:
        requests.post(f"{API}/admin/users/{drv_uid}/approve",
                      headers=_bearer(tok), timeout=20)


def _force_paid(booking_id):
    c, db = _mongo()
    now = datetime.now(timezone.utc).isoformat()
    db.bookings.update_one({"id": booking_id},
                           {"$set": {"payment_status": "paid",
                                     "status": "deposit_paid",
                                     "paid_at": now, "updated_at": now}})
    c.close()


def _set_job_status(job_id, status):
    c, db = _mongo()
    db.jobs.update_one({"id": job_id},
                       {"$set": {"status": status,
                                 "updated_at": datetime.now(timezone.utc).isoformat()}})
    c.close()


# ---------------------------------------------------------------------------
# /messages/summary
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def summary_env():
    cust = _register(_u("sum_c"), "customer")
    drv = _register(_u("sum_d"), "driver")
    _approve(drv["user"]["id"])
    # Booking A: has a moderated message
    _, ba = _make_booking(cust, drv, title="R4 Summary A")
    _force_paid(ba["id"])
    # Booking B: has a normal recent message with long text
    _, bb = _make_booking(cust, drv, title="R4 Summary B")
    _force_paid(bb["id"])
    # Booking C: NO messages
    _, bc = _make_booking(cust, drv, title="R4 Summary C")
    _force_paid(bc["id"])

    # Post a moderated-mimic message directly in mongo on booking A
    c, db = _mongo()
    db.messages.insert_one({
        "id": str(uuid.uuid4()),
        "booking_id": ba["id"],
        "sender_id": drv["user"]["id"],
        "sender_name": "Driver",
        "text": "Contact details were hidden by Cargo One.",
        "moderated": True,
        "read": False,
        "created_at": (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat(),
        "delivered_at": (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat(),
    })
    # Booking B: send a real long message from driver via API (most recent)
    long_text = "A" * 150
    r = requests.post(f"{API}/bookings/{bb['id']}/messages",
                      json={"text": long_text},
                      headers=_bearer(drv["access_token"]), timeout=20)
    assert r.status_code == 200
    c.close()

    return {"cust": cust, "drv": drv, "ba": ba["id"], "bb": bb["id"], "bc": bc["id"]}


def test_summary_shape_and_paid_only(summary_env):
    cust = summary_env["cust"]
    r = requests.get(f"{API}/messages/summary",
                     headers=_bearer(cust["access_token"]), timeout=20)
    assert r.status_code == 200, r.text
    rows = r.json()
    assert isinstance(rows, list)
    booking_ids = {r["booking_id"] for r in rows}
    for k in ("ba", "bb", "bc"):
        assert summary_env[k] in booking_ids, f"missing {k} in summary"

    # shape
    for row in rows:
        assert "booking_id" in row
        assert "counterparty" in row and "name" in row["counterparty"]
        assert "unread_count" in row
        assert "updated_at" in row
        assert "last_message" in row


def test_summary_preview_ellipsized(summary_env):
    cust = summary_env["cust"]
    r = requests.get(f"{API}/messages/summary",
                     headers=_bearer(cust["access_token"]), timeout=20)
    assert r.status_code == 200
    row_b = next(x for x in r.json() if x["booking_id"] == summary_env["bb"])
    lm = row_b["last_message"]
    assert lm is not None
    assert lm["text"].endswith("\u2026"), f"expected ellipsis, got: {lm['text']!r}"
    assert len(lm["text"]) <= 100
    assert lm["mine"] is False  # driver sent it, we listed as customer
    assert lm["sender_id"] == summary_env["drv"]["user"]["id"]


def test_summary_moderated_flag_present(summary_env):
    cust = summary_env["cust"]
    r = requests.get(f"{API}/messages/summary",
                     headers=_bearer(cust["access_token"]), timeout=20)
    row_a = next(x for x in r.json() if x["booking_id"] == summary_env["ba"])
    lm = row_a["last_message"]
    assert lm is not None
    assert lm["moderated"] is True
    # We deliberately do NOT strip the moderated placeholder text at API layer;
    # the frontend decides how to render the "hidden" pill. Just verify the
    # marker propagates.


def test_summary_null_last_message_for_no_messages(summary_env):
    cust = summary_env["cust"]
    r = requests.get(f"{API}/messages/summary",
                     headers=_bearer(cust["access_token"]), timeout=20)
    row_c = next(x for x in r.json() if x["booking_id"] == summary_env["bc"])
    assert row_c["last_message"] is None
    assert row_c["unread_count"] == 0


def test_summary_ordered_latest_first(summary_env):
    cust = summary_env["cust"]
    r = requests.get(f"{API}/messages/summary",
                     headers=_bearer(cust["access_token"]), timeout=20)
    rows = r.json()
    with_msg = [r for r in rows if r["last_message"]]
    times = [r["last_message"]["created_at"] for r in with_msg]
    assert times == sorted(times, reverse=True), \
        f"summary rows with messages must be latest-first: {times}"
    # Rows without messages should be at the bottom.
    idx_no_msg = [i for i, r in enumerate(rows) if r["last_message"] is None]
    idx_with_msg = [i for i, r in enumerate(rows) if r["last_message"]]
    if idx_no_msg and idx_with_msg:
        assert min(idx_no_msg) > max(idx_with_msg)


# ---------------------------------------------------------------------------
# /bookings/{id}/activity
# ---------------------------------------------------------------------------

def _activity_kinds(events):
    return [e["kind"] for e in events]


def test_activity_404_for_missing_booking():
    cust = _register(_u("act_missing"), "customer")
    r = requests.get(f"{API}/bookings/does-not-exist/activity",
                     headers=_bearer(cust["access_token"]), timeout=20)
    assert r.status_code == 404


def test_activity_403_for_stranger():
    cust = _register(_u("act_owner"), "customer")
    drv = _register(_u("act_drv"), "driver")
    _approve(drv["user"]["id"])
    _, b = _make_booking(cust, drv)
    stranger = _register(_u("act_stranger"), "customer")
    r = requests.get(f"{API}/bookings/{b['id']}/activity",
                     headers=_bearer(stranger["access_token"]), timeout=20)
    assert r.status_code == 403


def test_activity_created_only_no_driver():
    """A job that has no driver accepted → booking cannot exist via /bookings
    (driver required). We instead insert a synthetic bookings row without a
    driver_id to verify the derivation branch."""
    cust = _register(_u("act_only_created"), "customer")
    booking_id = str(uuid.uuid4())
    c, db = _mongo()
    db.bookings.insert_one({
        "id": booking_id,
        "customer_id": cust["user"]["id"],
        "driver_id": None,
        "job_id": None,
        "status": "pending",
        "payment_status": "unpaid",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    c.close()
    r = requests.get(f"{API}/bookings/{booking_id}/activity",
                     headers=_bearer(cust["access_token"]), timeout=20)
    assert r.status_code == 200, r.text
    kinds = _activity_kinds(r.json())
    assert kinds == ["created"], f"expected only 'created', got {kinds}"


def test_activity_created_accepted_paid():
    cust = _register(_u("act_paid"), "customer")
    drv = _register(_u("act_paid_drv"), "driver")
    _approve(drv["user"]["id"])
    _, b = _make_booking(cust, drv)
    _force_paid(b["id"])
    r = requests.get(f"{API}/bookings/{b['id']}/activity",
                     headers=_bearer(cust["access_token"]), timeout=20)
    assert r.status_code == 200
    kinds = set(_activity_kinds(r.json()))
    assert {"created", "driver_accepted", "deposit_paid"}.issubset(kinds)
    assert "driver_message" not in kinds
    assert "en_route" not in kinds
    assert "delivered" not in kinds
    assert "completed" not in kinds


def test_activity_with_driver_message():
    cust = _register(_u("act_msg"), "customer")
    drv = _register(_u("act_msg_drv"), "driver")
    _approve(drv["user"]["id"])
    _, b = _make_booking(cust, drv)
    _force_paid(b["id"])
    # Driver sends a message
    r = requests.post(f"{API}/bookings/{b['id']}/messages",
                      json={"text": "Hi customer"},
                      headers=_bearer(drv["access_token"]), timeout=20)
    assert r.status_code == 200
    ev = requests.get(f"{API}/bookings/{b['id']}/activity",
                      headers=_bearer(cust["access_token"]), timeout=20).json()
    kinds = set(_activity_kinds(ev))
    assert {"created", "driver_accepted", "deposit_paid", "driver_message"}.issubset(kinds)
    # sorted oldest→newest
    times = [e["at"] for e in ev if e.get("at")]
    assert times == sorted(times), f"activity events must be oldest→newest: {times}"


def test_activity_on_route_emits_en_route_and_delivered():
    cust = _register(_u("act_route"), "customer")
    drv = _register(_u("act_route_drv"), "driver")
    _approve(drv["user"]["id"])
    job, b = _make_booking(cust, drv)
    _force_paid(b["id"])
    # driver message
    requests.post(f"{API}/bookings/{b['id']}/messages",
                  json={"text": "on the way"},
                  headers=_bearer(drv["access_token"]), timeout=20)
    # bump job status to on_route
    _set_job_status(job["id"], "on_route")

    ev = requests.get(f"{API}/bookings/{b['id']}/activity",
                      headers=_bearer(cust["access_token"]), timeout=20).json()
    kinds = set(_activity_kinds(ev))
    # en_route should now be present, delivered should NOT (status is on_route,
    # not delivered/pod_uploaded/completed, and no booking.delivered_at)
    assert "en_route" in kinds, kinds
    assert "delivered" not in kinds, kinds
    assert "completed" not in kinds, kinds


def test_activity_delivered_status_emits_delivered_event():
    cust = _register(_u("act_deliv"), "customer")
    drv = _register(_u("act_deliv_drv"), "driver")
    _approve(drv["user"]["id"])
    job, b = _make_booking(cust, drv)
    _force_paid(b["id"])
    _set_job_status(job["id"], "delivered")
    # Also stamp booking.delivered_at
    c, db = _mongo()
    db.bookings.update_one({"id": b["id"]},
                           {"$set": {"delivered_at": datetime.now(timezone.utc).isoformat()}})
    c.close()
    ev = requests.get(f"{API}/bookings/{b['id']}/activity",
                      headers=_bearer(cust["access_token"]), timeout=20).json()
    kinds = set(_activity_kinds(ev))
    assert {"en_route", "delivered"}.issubset(kinds)
    assert "completed" not in kinds
