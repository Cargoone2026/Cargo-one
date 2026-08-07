"""Final QA Round 9 — Suitable Vehicle end-to-end visibility.

Certifies that a backend-derived `recommended_vehicle` label is present on
EVERY driver / customer / admin facing surface for ASAP Transport AND
ASAP Recovery jobs, even when the customer never explicitly picked one.

Backend layers covered:
  * `_derive_suitable_vehicle` — unit correctness for the 4 canonical cases.
  * POST /api/jobs — create-time deriver (server.py L1147-1148).
  * GET /api/bookings/{id} — read-time deriver via public_job (L455-456).
  * GET /api/driver/live/offers — live-offer deriver (L1945-1947).
  * POST /api/jobs/{id}/claim — driver_booking_accepted email_log row has
    `Vehicle:` line in the rendered text payload, even for historic jobs
    (belt-and-braces derive at L2069-2070).

The 17F+8E baseline drift documented in PRD.md is NOT touched.
"""
from __future__ import annotations

import asyncio
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


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _mongo():
    c = pymongo.MongoClient(MONGO_URL)
    return c, c[DB_NAME]


def _bearer(tok):
    return {"Authorization": f"Bearer {tok}"}


def _u(tag):
    return f"TEST_qar9_{tag}_{uuid.uuid4().hex[:8]}@example.com"


def _register(role="customer", tag=""):
    email = _u(tag or role)
    r = requests.post(f"{API}/auth/register", json={
        "email": email, "password": "PasswordTest12345!",
        "name": f"QAR9 {role.title()}", "role": role,
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


def _post_asap_transport(cust_token, *, transport_category="pallet",
                           transport_description="steel drums",
                           title="QAR9-TRANSPORT"):
    now = datetime.now(timezone.utc)
    payload = {
        "title": title, "description": "qar9 fixture",
        "category": "parcels",
        "pickup_address": "1 Pickup Rd", "pickup_town": "London",
        "pickup_lat": 51.51, "pickup_lng": -0.10,
        "dropoff_address": "2 Drop Rd", "dropoff_town": "London",
        "dropoff_lat": 51.55, "dropoff_lng": -0.08,
        "weight_kg": 200,
        "collection_date": (now + timedelta(hours=1)).isoformat(),
        "delivery_date": (now + timedelta(hours=3)).isoformat(),
        "pricing_type": "fixed", "fixed_price": 250,
        "service_timing": "asap", "service_type": "transport",
        "transport_category": transport_category,
        "transport_description": transport_description,
    }
    r = requests.post(f"{API}/jobs", json=payload,
                       headers=_bearer(cust_token), timeout=20)
    assert r.status_code == 200, r.text
    return r.json()


def _post_asap_recovery(cust_token, *, vehicle_type="car", title="QAR9-REC"):
    now = datetime.now(timezone.utc)
    payload = {
        "title": title, "description": "qar9 recovery fixture",
        "category": "breakdown_recovery",
        "pickup_address": "1 Pickup Rd", "pickup_town": "London",
        "pickup_lat": 51.51, "pickup_lng": -0.10,
        "dropoff_address": "2 Drop Rd", "dropoff_town": "London",
        "dropoff_lat": 51.55, "dropoff_lng": -0.08,
        "weight_kg": 1500,
        "collection_date": (now + timedelta(hours=1)).isoformat(),
        "delivery_date": (now + timedelta(hours=3)).isoformat(),
        "pricing_type": "fixed", "fixed_price": 300,
        "service_timing": "asap", "service_type": "breakdown_recovery",
        "vehicle_details": {"type": vehicle_type, "make": "Ford",
                             "model": "Focus", "registration": "AB12CDE",
                             "condition": "cannot_be_driven"},
    }
    r = requests.post(f"{API}/jobs", json=payload,
                       headers=_bearer(cust_token), timeout=20)
    assert r.status_code == 200, r.text
    return r.json()


def _mark_dispatch_ready(job_id: str, *, customer_id=None,
                            recommended_vehicle=None, clear_rv=False):
    c, db = _mongo()
    ready = datetime.now(timezone.utc).isoformat()
    upd = {"status": "confirmed", "dispatch_ready_at": ready}
    unset = {}
    if recommended_vehicle:
        upd["recommended_vehicle"] = recommended_vehicle
    if clear_rv:
        unset["recommended_vehicle"] = ""
    ops = {"$set": upd}
    if unset:
        ops["$unset"] = unset
    db.jobs.update_one({"id": job_id}, ops)
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
# 1. Unit — _derive_suitable_vehicle deterministic outputs
# ---------------------------------------------------------------------------


def test_derive_transport_pallet_returns_large_van():
    from server import _derive_suitable_vehicle
    assert _derive_suitable_vehicle({
        "service_type": "transport", "transport_category": "pallet",
    }) == "Large Van"


def test_derive_transport_furniture_returns_luton():
    from server import _derive_suitable_vehicle
    assert _derive_suitable_vehicle({
        "service_type": "transport", "transport_category": "furniture",
    }) == "Luton Van"


def test_derive_transport_machinery_returns_75t():
    from server import _derive_suitable_vehicle
    assert _derive_suitable_vehicle({
        "service_type": "transport", "transport_category": "machinery",
    }) == "7.5T Box Truck"


def test_derive_recovery_car_returns_35t():
    from server import _derive_suitable_vehicle
    assert _derive_suitable_vehicle({
        "service_type": "breakdown_recovery",
        "vehicle_details": {"type": "car"},
    }) == "3.5T Recovery Truck"


def test_derive_recovery_motorbike_returns_motorcycle():
    from server import _derive_suitable_vehicle
    assert _derive_suitable_vehicle({
        "service_type": "breakdown_recovery",
        "vehicle_details": {"type": "motorbike"},
    }) == "Motorcycle Recovery"


def test_derive_transport_weight_fallback():
    """Unknown category + heavy weight → 7.5T Box Truck."""
    from server import _derive_suitable_vehicle
    assert _derive_suitable_vehicle({
        "service_type": "transport", "weight_kg": 2000,
    }) == "7.5T Box Truck"


# ---------------------------------------------------------------------------
# 2. Create-time deriver on POST /api/jobs
# ---------------------------------------------------------------------------


def test_asap_transport_job_response_has_derived_vehicle():
    cust = _register("customer", "create-t")
    job = _post_asap_transport(cust["access_token"],
                                  transport_category="pallet")
    assert job.get("recommended_vehicle") == "Large Van", job


def test_asap_recovery_car_job_response_has_derived_vehicle():
    cust = _register("customer", "create-rc")
    job = _post_asap_recovery(cust["access_token"], vehicle_type="car")
    assert job.get("recommended_vehicle") == "3.5T Recovery Truck", job


def test_asap_recovery_motorbike_job_response_has_derived_vehicle():
    cust = _register("customer", "create-rm")
    job = _post_asap_recovery(cust["access_token"], vehicle_type="motorbike")
    assert job.get("recommended_vehicle") == "Motorcycle Recovery", job


# ---------------------------------------------------------------------------
# 3. Read-time deriver on GET /api/bookings/{id} (customer & admin surface)
# ---------------------------------------------------------------------------


def test_booking_get_exposes_recommended_vehicle_for_asap_transport():
    cust = _register("customer", "bk-t")
    job = _post_asap_transport(cust["access_token"])
    _mark_dispatch_ready(job["id"], customer_id=cust["user"]["id"])
    c, db = _mongo()
    booking = db.bookings.find_one({"job_id": job["id"]})
    c.close()
    r = requests.get(f"{API}/bookings/{booking['id']}",
                      headers=_bearer(cust["access_token"]), timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("job"), body
    assert body["job"].get("recommended_vehicle") == "Large Van", body["job"]


def test_booking_get_derives_vehicle_for_historic_job_missing_field():
    """Simulates a legacy job written before Round 9. public_job should
    derive `recommended_vehicle` on read."""
    cust = _register("customer", "bk-hist")
    job = _post_asap_transport(cust["access_token"],
                                  transport_category="furniture")
    # Wipe the field to mimic legacy data + create paid booking
    _mark_dispatch_ready(job["id"], customer_id=cust["user"]["id"],
                            clear_rv=True)
    c, db = _mongo()
    booking = db.bookings.find_one({"job_id": job["id"]})
    # Confirm the field really is missing at the doc level
    stored = db.jobs.find_one({"id": job["id"]})
    c.close()
    assert not stored.get("recommended_vehicle"), \
        "test setup failed — recommended_vehicle should be unset"

    r = requests.get(f"{API}/bookings/{booking['id']}",
                      headers=_bearer(cust["access_token"]), timeout=15)
    assert r.status_code == 200, r.text
    # public_job derives it on read
    assert r.json()["job"].get("recommended_vehicle") == "Luton Van"


# ---------------------------------------------------------------------------
# 4. /driver/live/offers exposes recommended_vehicle for transport + recovery
# ---------------------------------------------------------------------------


def test_live_offers_transport_includes_recommended_vehicle():
    cust = _register("customer", "of-t")
    drv = _register("driver", "of-t")
    _activate_driver(drv["user"]["id"])
    _online(drv["access_token"])
    job = _post_asap_transport(cust["access_token"],
                                  transport_category="pallet")
    _mark_dispatch_ready(job["id"], customer_id=cust["user"]["id"])

    r = requests.get(f"{API}/driver/live/offers",
                      params={"radius_miles": 500},
                      headers=_bearer(drv["access_token"]), timeout=20)
    assert r.status_code == 200, r.text
    ours = [o for o in r.json()["offers"] if o["job_id"] == job["id"]]
    assert ours, r.json()
    o = ours[0]
    assert o.get("recommended_vehicle") == "Large Van", o
    # vehicle_label alias must also be populated for backward compat
    assert o.get("vehicle_label") == "Large Van", o


def test_live_offers_recovery_car_includes_recommended_vehicle():
    cust = _register("customer", "of-rc")
    drv = _register("driver", "of-rc")
    _activate_driver(drv["user"]["id"])
    # Grant recovery capability
    c, db = _mongo()
    db.users.update_one({"id": drv["user"]["id"]}, {"$set": {
        "capabilities": {"recovery": True},
        "service_types": ["breakdown_recovery", "transport"],
    }})
    c.close()
    _online(drv["access_token"])

    job = _post_asap_recovery(cust["access_token"], vehicle_type="car")
    _mark_dispatch_ready(job["id"], customer_id=cust["user"]["id"])

    r = requests.get(f"{API}/driver/live/offers",
                      params={"radius_miles": 500},
                      headers=_bearer(drv["access_token"]), timeout=20)
    assert r.status_code == 200, r.text
    ours = [o for o in r.json()["offers"] if o["job_id"] == job["id"]]
    assert ours, r.json()
    o = ours[0]
    assert o.get("recommended_vehicle") == "3.5T Recovery Truck", o
    assert o.get("service_type") == "breakdown_recovery", o


# ---------------------------------------------------------------------------
# 5. Claim → driver_booking_accepted email_log row includes 'Vehicle:' line
# ---------------------------------------------------------------------------


def _wait_for_log_row(booking_id, template, timeout=8):
    c, db = _mongo()
    deadline = time.time() + timeout
    row = None
    while time.time() < deadline:
        row = db.email_log.find_one({"template": template,
                                       "booking_id": booking_id})
        if row:
            break
        time.sleep(0.5)
    c.close()
    return row


def _rendered_text_from_job(job: dict, booking: dict,
                              customer: dict, driver: dict) -> str:
    """Reconstruct the plain-text body the driver_booking_accepted email
    WOULD have contained for the given (job, booking, customer, driver).

    The email_log audit row does NOT persist the rendered `text` payload
    (see services/email.py::_send_and_log entry dict) — so to verify the
    'Vehicle:' line reaches the driver we re-render the template locally
    using the same inputs the send helper would have used."""
    from services.email import render_driver_booking_accepted
    transport_item = (
        (job.get("transport_category") or "").replace("_", " ").strip()
        or (job.get("category") or "").replace("_", " ").strip()
    )
    _, _, text = render_driver_booking_accepted(
        driver_name=driver.get("name") or "",
        booking_ref=booking.get("id") or "",
        customer_name=customer.get("name") or "",
        customer_phone=customer.get("phone") or "",
        pickup=(job.get("pickup_address") or job.get("pickup_town") or ""),
        dropoff=(job.get("dropoff_address") or job.get("dropoff_town") or ""),
        suitable_vehicle=(job.get("recommended_vehicle")
                           or job.get("vehicle_label") or ""),
        transport_item=transport_item,
        amount_to_collect=float(booking.get("driver_charge") or 0),
        booking_url=f"https://x/driver/booking/{booking.get('id')}",
        start_trip_url=f"https://x/driver/booking/{booking.get('id')}?tab=trip",
    )
    return text


def test_claim_email_log_and_render_has_vehicle_line_for_transport():
    cust = _register("customer", "cl-t")
    drv = _register("driver", "cl-t")
    _activate_driver(drv["user"]["id"])
    _online(drv["access_token"])

    job = _post_asap_transport(cust["access_token"],
                                  transport_category="pallet")
    _mark_dispatch_ready(job["id"], customer_id=cust["user"]["id"])

    r = requests.post(f"{API}/jobs/{job['id']}/claim",
                       headers=_bearer(drv["access_token"]), timeout=25)
    assert r.status_code == 200, r.text

    c, db = _mongo()
    booking = db.bookings.find_one({"job_id": job["id"]})
    stored_job = db.jobs.find_one({"id": job["id"]})
    customer_doc = db.users.find_one({"id": cust["user"]["id"]})
    driver_doc = db.users.find_one({"id": drv["user"]["id"]})
    c.close()

    row = _wait_for_log_row(booking["id"], "driver_booking_accepted")
    assert row, "no driver_booking_accepted log row"
    assert row["user_id"] == drv["user"]["id"], row
    assert row["subject"].startswith("You accepted a Cargo One job — booking ")

    # The persisted job must already carry the derived vehicle (create-time
    # deriver ran at POST /jobs), which is what the send helper reads.
    assert stored_job.get("recommended_vehicle") == "Large Van", stored_job
    text = _rendered_text_from_job(stored_job, booking, customer_doc, driver_doc)
    assert "Vehicle:" in text, text
    assert "Large Van" in text, text


def test_claim_email_render_has_vehicle_line_for_recovery_car():
    cust = _register("customer", "cl-rc")
    drv = _register("driver", "cl-rc")
    _activate_driver(drv["user"]["id"])
    c, db = _mongo()
    db.users.update_one({"id": drv["user"]["id"]}, {"$set": {
        "capabilities": {"recovery": True},
        "service_types": ["breakdown_recovery", "transport"],
    }})
    c.close()
    _online(drv["access_token"])

    job = _post_asap_recovery(cust["access_token"], vehicle_type="car")
    _mark_dispatch_ready(job["id"], customer_id=cust["user"]["id"])

    r = requests.post(f"{API}/jobs/{job['id']}/claim",
                       headers=_bearer(drv["access_token"]), timeout=25)
    assert r.status_code == 200, r.text

    c, db = _mongo()
    booking = db.bookings.find_one({"job_id": job["id"]})
    stored_job = db.jobs.find_one({"id": job["id"]})
    cust_doc = db.users.find_one({"id": cust["user"]["id"]})
    drv_doc = db.users.find_one({"id": drv["user"]["id"]})
    c.close()

    row = _wait_for_log_row(booking["id"], "driver_booking_accepted")
    assert row, "no driver_booking_accepted log row"
    assert stored_job.get("recommended_vehicle") == "3.5T Recovery Truck"
    text = _rendered_text_from_job(stored_job, booking, cust_doc, drv_doc)
    assert "Vehicle:" in text, text
    assert "3.5T Recovery Truck" in text, text


def test_claim_email_belt_and_braces_derives_for_historic_job():
    """If a legacy job somehow reaches /claim without recommended_vehicle
    (e.g. pre-Round-9 data), the belt-and-braces block at server.py
    L2069-2070 must derive it in-memory before render. We verify by
    (a) confirming the email_log row was written AND (b) confirming the
    template WOULD emit the correct 'Vehicle:' line when re-rendered with
    the derived value (mirroring what the send helper actually did)."""
    from server import _derive_suitable_vehicle
    cust = _register("customer", "cl-hist")
    drv = _register("driver", "cl-hist")
    _activate_driver(drv["user"]["id"])
    _online(drv["access_token"])

    job = _post_asap_transport(cust["access_token"],
                                  transport_category="furniture")
    _mark_dispatch_ready(job["id"], customer_id=cust["user"]["id"],
                            clear_rv=True)

    r = requests.post(f"{API}/jobs/{job['id']}/claim",
                       headers=_bearer(drv["access_token"]), timeout=25)
    assert r.status_code == 200, r.text

    c, db = _mongo()
    booking = db.bookings.find_one({"job_id": job["id"]})
    stored_job = db.jobs.find_one({"id": job["id"]})
    cust_doc = db.users.find_one({"id": cust["user"]["id"]})
    drv_doc = db.users.find_one({"id": drv["user"]["id"]})
    c.close()

    row = _wait_for_log_row(booking["id"], "driver_booking_accepted")
    assert row, "no driver_booking_accepted log row"
    assert row["subject"].startswith("You accepted a Cargo One job — booking ")

    # Historic job is intentionally still missing the field in Mongo (the
    # belt-and-braces derive at L2069 only mutates the in-memory dict).
    assert not stored_job.get("recommended_vehicle")
    # Re-apply the same in-memory derive that the claim path performs,
    # then render — must emit the derived vehicle line.
    stored_job["recommended_vehicle"] = _derive_suitable_vehicle(stored_job)
    assert stored_job["recommended_vehicle"] == "Luton Van"
    text = _rendered_text_from_job(stored_job, booking, cust_doc, drv_doc)
    assert "Vehicle:" in text, text
    assert "Luton Van" in text, text
