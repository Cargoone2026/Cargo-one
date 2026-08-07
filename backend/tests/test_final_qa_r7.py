"""Final QA Round 7 — Driver acceptance UX + branded driver-accepted email.

Certifies:
 * render_driver_booking_accepted output shape (subject, CTAs, plain text)
 * send_driver_booking_accepted_email writes email_log row with correct
   template + status='skipped' (RESEND_API_KEY unset in preview)
 * Wiring on POST /jobs/{id}/claim (ASAP) — one email_log row per claim
 * Non-double-send safety (idempotent claim does not double-log)
 * Wiring on _finalise_paid_deposit for non-ASAP (source-inspection guard
   + direct-invocation of helper to prove branded email produces a log row)
 * /driver/live/offers response exposes the fields AcceptanceInfo needs:
      transport_category, transport_description, recommended_vehicle
      (vehicle_label alias accepted), photos, current_search_radius_miles,
      vehicle_details
"""
from __future__ import annotations

import asyncio
import os
import re
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
ADMIN_PASSWORD = os.environ.get("TEST_ADMIN_PASSWORD", "Vc9O0sNDGR6SfzKDaa0L1lhp")


def _mongo():
    c = pymongo.MongoClient(MONGO_URL)
    return c, c[DB_NAME]


def _bearer(tok):
    return {"Authorization": f"Bearer {tok}"}


def _u(tag):
    return f"TEST_qar7_{tag}_{uuid.uuid4().hex[:8]}@example.com"


def _register(role="customer", tag=""):
    email = _u(tag or role)
    r = requests.post(f"{API}/auth/register", json={
        "email": email, "password": "PasswordTest12345!",
        "name": f"QAR7 {role.title()}", "role": role,
        "phone": "+447700900123",
    }, timeout=20)
    assert r.status_code == 200, r.text
    body = r.json()
    body["email"] = email
    return body


def _activate_driver(driver_id: str):
    c, db = _mongo()
    db.users.update_one({"id": driver_id}, {"$set": {"status": "active"}})
    c.close()


def _create_asap_job(cust_token, *, service_type="transport",
                       category="parcels",
                       transport_category="pallet",
                       transport_description="machine parts",
                       recommended_vehicle="Large Van",
                       vehicle_details=None,
                       pickup=(51.51, -0.10), dropoff=(51.55, -0.08),
                       title="QAR7-ASAP"):
    now = datetime.now(timezone.utc)
    payload = {
        "title": title, "description": "qar7 fixture",
        "category": category,
        "pickup_address": "Pickup Rd", "pickup_town": "London",
        "pickup_lat": pickup[0], "pickup_lng": pickup[1],
        "dropoff_address": "Drop Rd", "dropoff_town": "London",
        "dropoff_lat": dropoff[0], "dropoff_lng": dropoff[1],
        "weight_kg": 5,
        "collection_date": (now + timedelta(hours=1)).isoformat(),
        "delivery_date": (now + timedelta(hours=3)).isoformat(),
        "pricing_type": "fixed", "fixed_price": 250,
        "service_timing": "asap", "service_type": service_type,
        "transport_category": transport_category,
        "transport_description": transport_description,
    }
    # `recommended_vehicle` is not on JobCreate model — must be set via
    # direct Mongo write (see _mark_dispatch_ready `recommended_vehicle=`).
    _rv = recommended_vehicle
    if vehicle_details:
        payload["vehicle_details"] = vehicle_details
    r = requests.post(f"{API}/jobs", json=payload,
                       headers=_bearer(cust_token), timeout=20)
    assert r.status_code == 200, r.text
    body = r.json()
    body["_recommended_vehicle"] = _rv
    return body


def _mark_dispatch_ready(job_id: str, seconds_ago=0, extra=None,
                            *, recommended_vehicle=None, customer_id=None,
                            create_booking=True):
    """Simulate a paid deposit for ASAP: flip job to confirmed +
    dispatch_ready_at + create a booking with payment_status='paid' so the
    /claim wire finds a real booking row."""
    c, db = _mongo()
    ready = datetime.now(timezone.utc) - timedelta(seconds=seconds_ago)
    upd = {"status": "confirmed", "dispatch_ready_at": ready.isoformat()}
    if recommended_vehicle:
        upd["recommended_vehicle"] = recommended_vehicle
    if extra:
        upd.update(extra)
    db.jobs.update_one({"id": job_id}, {"$set": upd})
    if create_booking:
        job = db.jobs.find_one({"id": job_id})
        if job and not db.bookings.find_one({"job_id": job_id}):
            db.bookings.insert_one({
                "id": f"bk-{uuid.uuid4().hex[:12]}",
                "job_id": job_id,
                "customer_id": customer_id or job.get("customer_id"),
                "driver_id": None,
                "amount_total": float(job.get("fixed_price") or 250),
                "driver_charge": float(job.get("fixed_price") or 250),
                "payment_status": "paid",
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
    c.close()


def _online(driver_token, lat=51.51, lng=-0.10):
    r = requests.post(f"{API}/driver/live/online",
                       json={"lat": lat, "lng": lng, "accuracy_m": 5},
                       headers=_bearer(driver_token), timeout=15)
    assert r.status_code == 200, r.text


# ---------------------------------------------------------------------------
# 1. render_driver_booking_accepted output (pure function)
# ---------------------------------------------------------------------------

def test_render_driver_booking_accepted_shape():
    from services.email import render_driver_booking_accepted
    subj, html, text = render_driver_booking_accepted(
        driver_name="Alex", booking_ref="abcdef1234567890",
        customer_name="Sam", customer_phone="+447700900123",
        pickup="1 Pickup Rd, London", dropoff="2 Drop Rd, London",
        suitable_vehicle="Large Van", transport_item="pallet",
        amount_to_collect=125.50,
        booking_url="https://ex.test/driver/booking/abcdef1234567890",
        start_trip_url="https://ex.test/driver/booking/abcdef1234567890?tab=trip",
    )
    # Subject prefix and short ref (8 chars)
    assert subj.startswith("You accepted a Cargo One job — booking "), subj
    assert "abcdef12" in subj and " abcdef123" not in subj  # trimmed to 8

    # HTML has Start trip + Open booking CTAs and both URLs
    assert "Start trip" in html
    assert "Open booking" in html
    assert "?tab=trip" in html
    assert "/driver/booking/abcdef1234567890" in html
    # Basic content
    assert "Large Van" in html
    assert "pallet" in html
    assert "£125.50" in html

    # Plain-text mirrors both URLs (a CTA link each)
    assert "Start trip:" in text and "Open booking:" in text
    assert "?tab=trip" in text
    assert "/driver/booking/abcdef1234567890" in text


def test_render_driver_booking_accepted_missing_phone_and_amount():
    from services.email import render_driver_booking_accepted
    subj, html, text = render_driver_booking_accepted(
        driver_name="", booking_ref="deadbeefcafebabe",
        customer_name="", customer_phone="",
        pickup="", dropoff="", suitable_vehicle="",
        transport_item="", amount_to_collect=0,
        booking_url="https://ex.test/b", start_trip_url="https://ex.test/b?tab=trip",
    )
    assert "deadbeef" in subj
    # Graceful fallbacks (— placeholder) — must not crash
    assert "—" in html
    assert "—" in text


# ---------------------------------------------------------------------------
# 2. Wiring: ASAP /jobs/{id}/claim writes driver_booking_accepted row
# ---------------------------------------------------------------------------

def _count_email_log(*, template, booking_id=None, user_id=None):
    c, db = _mongo()
    q = {"template": template}
    if booking_id:
        q["booking_id"] = booking_id
    if user_id:
        q["user_id"] = user_id
    n = db.email_log.count_documents(q)
    c.close()
    return n


def test_asap_claim_wires_driver_booking_accepted_email_once():
    cust = _register("customer", "claim")
    drv = _register("driver", "claim")
    _activate_driver(drv["user"]["id"])
    _online(drv["access_token"], 51.51, -0.10)

    job = _create_asap_job(
        cust["access_token"],
        transport_category="pallet",
        transport_description="machine parts",
        recommended_vehicle="Large Van",
        title="QAR7-CLAIM",
    )
    _mark_dispatch_ready(job["id"], seconds_ago=0,
                          recommended_vehicle="Large Van")

    # Give background _dispatch_offers_to_online_drivers a moment then claim
    r = requests.post(f"{API}/jobs/{job['id']}/claim",
                       headers=_bearer(drv["access_token"]), timeout=25)
    assert r.status_code == 200, r.text
    assert r.json().get("ok") is True

    # Look up booking id
    c, db = _mongo()
    booking = db.bookings.find_one({"job_id": job["id"]})
    c.close()
    assert booking, "booking should be auto-created for ASAP job"

    # Retry a few times because the email send is fire-and-forget async
    import time
    deadline = time.time() + 8
    n = 0
    while time.time() < deadline:
        n = _count_email_log(
            template="driver_booking_accepted",
            booking_id=booking["id"],
        )
        if n >= 1:
            break
        time.sleep(0.5)
    assert n == 1, f"expected exactly 1 driver_booking_accepted row, got {n}"

    # user_id on log row equals driver
    c, db = _mongo()
    row = db.email_log.find_one({
        "template": "driver_booking_accepted",
        "booking_id": booking["id"],
    })
    c.close()
    assert row["user_id"] == drv["user"]["id"], row
    # Preview has RESEND_API_KEY unset -> status='skipped' is expected but
    # accept 'sent' too if configured
    assert row["status"] in ("skipped", "sent"), row["status"]
    assert row["subject"].startswith("You accepted a Cargo One job — booking "), row["subject"]


def test_asap_claim_is_idempotent_and_does_not_double_log():
    cust = _register("customer", "idem")
    drv = _register("driver", "idem")
    _activate_driver(drv["user"]["id"])
    _online(drv["access_token"], 51.51, -0.10)

    job = _create_asap_job(cust["access_token"], title="QAR7-IDEM")
    _mark_dispatch_ready(job["id"], seconds_ago=0)

    r1 = requests.post(f"{API}/jobs/{job['id']}/claim",
                         headers=_bearer(drv["access_token"]), timeout=25)
    assert r1.status_code == 200, r1.text
    r2 = requests.post(f"{API}/jobs/{job['id']}/claim",
                         headers=_bearer(drv["access_token"]), timeout=25)
    # Second claim by same driver should be a no-op / idempotent
    assert r2.status_code == 200, r2.text
    body = r2.json()
    assert body.get("idempotent") is True or body.get("ok") is True

    import time
    time.sleep(2)
    c, db = _mongo()
    booking = db.bookings.find_one({"job_id": job["id"]})
    n = db.email_log.count_documents({
        "template": "driver_booking_accepted",
        "booking_id": booking["id"],
    })
    c.close()
    assert n == 1, f"expected 1 driver_booking_accepted row after idempotent claim, got {n}"


# ---------------------------------------------------------------------------
# 3. Source-inspection guard on _finalise_paid_deposit wire (non-ASAP path)
# ---------------------------------------------------------------------------

def test_finalise_paid_deposit_wires_driver_email_for_non_asap():
    """The non-ASAP branch of _finalise_paid_deposit must call
    send_driver_booking_accepted_email guarded by (a) is_asap==False AND
    (b) fresh_booking.driver_id present. This gate avoids double-sends
    with the ASAP /claim wire."""
    src = open("/app/backend/server.py").read()
    fn_start = src.index("async def _finalise_paid_deposit")
    fn_end = src.index("\n@api.", fn_start)
    body = src[fn_start:fn_end]
    assert "send_driver_booking_accepted_email" in body, \
        "_finalise_paid_deposit no longer wires the driver-accepted email"
    # Guard against double-send: must check is_asap AND driver_id
    assert re.search(r"is_asap\s*=", body), "is_asap flag not computed"
    assert "not is_asap" in body, "no is_asap guard around driver email"
    assert '"driver_id"' in body or "fresh_booking.get(\"driver_id\")" in body


def test_driver_email_helper_writes_email_log_row_when_invoked_directly():
    """Direct-invoke send_driver_booking_accepted_email against the live
    Mongo to prove it produces an email_log row on the non-ASAP path
    without needing a real Stripe webhook."""
    from motor.motor_asyncio import AsyncIOMotorClient
    from services.email import send_driver_booking_accepted_email

    async def run():
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        driver = {"id": f"drv-{uuid.uuid4().hex[:6]}",
                    "email": f"TEST_qar7_drv_{uuid.uuid4().hex[:6]}@example.com",
                    "name": "Direct-Wire Driver"}
        customer = {"id": "cust-x", "name": "Cust X", "phone": "+447700900999"}
        booking_id = f"bk-{uuid.uuid4().hex[:12]}"
        booking = {"id": booking_id, "driver_charge": 199.99}
        job = {"pickup_address": "10 Pick", "dropoff_address": "20 Drop",
                "recommended_vehicle": "Luton", "transport_category": "pallet"}
        out = await send_driver_booking_accepted_email(
            db, driver=driver, customer=customer, booking=booking, job=job,
        )
        assert out.get("status") in ("skipped", "sent"), out
        row = await db.email_log.find_one({
            "template": "driver_booking_accepted",
            "booking_id": booking_id,
        })
        assert row is not None, "no log row inserted"
        assert row["to"] == driver["email"]
        assert row["subject"].startswith("You accepted a Cargo One job — booking ")
        client.close()

    asyncio.get_event_loop().run_until_complete(run()) if not asyncio.get_event_loop().is_running() else asyncio.run(run())


# ---------------------------------------------------------------------------
# 4. /driver/live/offers exposes fields AcceptanceInfo needs
# ---------------------------------------------------------------------------

def test_live_offers_exposes_acceptance_info_fields():
    """AcceptanceInfo reads job.transport_category, transport_description,
    recommended_vehicle (or vehicle_label alias), photos, vehicle_details,
    and current_search_radius_miles from the offer payload."""
    cust = _register("customer", "offers")
    drv = _register("driver", "offers")
    _activate_driver(drv["user"]["id"])
    _online(drv["access_token"], 51.51, -0.10)

    job = _create_asap_job(cust["access_token"],
                             transport_category="pallet",
                             transport_description="machine parts",
                             recommended_vehicle="Large Van",
                             title="QAR7-OFFERS")
    _mark_dispatch_ready(job["id"], seconds_ago=0,
                          recommended_vehicle="Large Van")

    r = requests.get(f"{API}/driver/live/offers",
                       params={"radius_miles": 500},
                       headers=_bearer(drv["access_token"]), timeout=20)
    assert r.status_code == 200, r.text
    offers = r.json()["offers"]
    ours = [o for o in offers if o["job_id"] == job["id"]]
    assert ours, f"created ASAP job not offered to driver: {r.json()}"
    o = ours[0]

    # Mandatory Round 7 fields
    for k in ("current_search_radius_miles", "photos", "vehicle_details"):
        assert k in o, f"offer missing field {k}: keys={list(o.keys())}"
    # Suitable Vehicle — recommended_vehicle OR vehicle_label alias accepted
    assert (o.get("recommended_vehicle") == "Large Van"
             or o.get("vehicle_label") == "Large Van"), (
        f"neither recommended_vehicle nor vehicle_label present: {o}"
    )
    # Transport Item + Description
    assert o.get("transport_category") == "pallet", (
        f"offer missing transport_category — AcceptanceInfo cannot render "
        f"Transport Item on driver Live popup: {o}"
    )
    assert o.get("transport_description") == "machine parts", (
        f"offer missing transport_description — AcceptanceInfo cannot render "
        f"Description on driver Live popup: {o}"
    )


def test_recovery_offer_exposes_vehicle_details():
    cust = _register("customer", "rec")
    drv = _register("driver", "rec")
    _activate_driver(drv["user"]["id"])
    # ensure capability
    c, db = _mongo()
    db.users.update_one({"id": drv["user"]["id"]}, {"$set": {
        "capabilities": {"recovery": True},
        "service_types": ["breakdown_recovery", "transport"],
    }})
    c.close()
    _online(drv["access_token"], 51.51, -0.10)

    job = _create_asap_job(
        cust["access_token"], service_type="breakdown_recovery",
        category="breakdown_recovery",
        transport_category=None, transport_description=None,
        recommended_vehicle="3.5T Recovery Truck",
        vehicle_details={"make": "Range Rover", "model": "Velar",
                          "registration": "AB12CDE",
                          "condition": "cannot_be_driven"},
        title="QAR7-REC",
    )
    _mark_dispatch_ready(job["id"], seconds_ago=0,
                          recommended_vehicle="3.5T Recovery Truck")

    r = requests.get(f"{API}/driver/live/offers",
                       params={"radius_miles": 500},
                       headers=_bearer(drv["access_token"]), timeout=20)
    assert r.status_code == 200, r.text
    ours = [o for o in r.json()["offers"] if o["job_id"] == job["id"]]
    assert ours, f"recovery ASAP not offered: {r.json()}"
    o = ours[0]
    assert o.get("service_type") == "breakdown_recovery"
    vd = o.get("vehicle_details") or {}
    assert vd.get("make") == "Range Rover"
    assert vd.get("model") == "Velar"
    assert vd.get("registration") == "AB12CDE"
    assert vd.get("condition") == "cannot_be_driven"
    assert (o.get("vehicle_label") == "3.5T Recovery Truck"
             or o.get("recommended_vehicle") == "3.5T Recovery Truck")
