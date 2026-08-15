"""R45 — Cash-on-Delivery reminder + Fixed-Price nudge coverage.

Exercises the two customer-facing enhancements shipped in R45:

1. `POST /bookings/{id}/status` — when the driver flips a booking to
   `on_route`, the server MUST fire the cash-on-delivery push + email
   exactly once (idempotent via `cash_reminder_sent_at`) and stamp the
   booking so replays don't double-send.

2. The Fixed-Price nudge is a purely frontend piece — its coverage lives
   in the component, not the API. We assert here that the underlying
   quote endpoint still surfaces `suggested_price` so the nudge has
   something to compare against.
"""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone

import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/backend/.env", override=True)

BASE = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL",
    "https://cargo-repo-bridge.preview.emergentagent.com",
).rstrip("/")
API = f"{BASE}/api"


def _iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _mongo():
    from pymongo import MongoClient
    c = MongoClient(os.environ["MONGO_URL"])
    return c, c[os.environ["DB_NAME"]]


def _register(role: str) -> dict:
    tag = uuid.uuid4().hex[:8]
    email = f"{role[:4]}-r45-{tag}@cargoone-r45.example.com"
    r = requests.post(
        f"{API}/auth/register",
        json={"email": email, "password": "Rr45Test!12345", "name": f"R45 {role} {tag}",
              "phone": "+441234599999", "role": role},
        timeout=15,
    )
    if r.status_code != 200:
        r = requests.post(
            f"{API}/auth/login",
            json={"email": email, "password": "Rr45Test!12345"},
            timeout=15,
        )
    r.raise_for_status()
    d = r.json()
    return {"token": d["access_token"], "id": d["user"]["id"], "email": email}


def _seed_active_booking(customer_id: str, driver_id: str,
                          driver_charge: float = 250.0) -> str:
    """Direct-DB seed of a job + booking already in `travelling` state so
    we can drive it to `on_route` without going through the full flow."""
    _, db = _mongo()
    job_id = f"r45-job-{uuid.uuid4().hex[:10]}"
    bkg_id = f"r45-bkg-{uuid.uuid4().hex[:10]}"
    db.jobs.insert_one({
        "id": job_id, "customer_id": customer_id,
        "title": "R45 cash reminder", "category_key": "furniture",
        "service_type": "transport", "service_timing": "scheduled",
        "pricing_type": "fixed", "fixed_price": driver_charge,
        "accepted_price": driver_charge,
        "status": "travelling", "assigned_driver_id": driver_id,
        "pickup_town": "London", "dropoff_town": "Reading",
        "created_at": _iso(),
    })
    db.bookings.insert_one({
        "id": bkg_id, "job_id": job_id,
        "customer_id": customer_id, "driver_id": driver_id,
        "driver_charge": driver_charge, "booking_fee": 33.0,
        "total_price": driver_charge + 33.0,
        "customer_total": driver_charge + 33.0,
        "deposit_amount": 33.0, "balance_due": driver_charge,
        "status": "travelling", "payment_status": "paid",
        "service_type": "transport", "service_timing": "scheduled",
        "created_at": _iso(), "paid_at": _iso(),
    })
    return bkg_id


class TestCashReminder:

    def test_on_route_fires_reminder_once(self):
        cust = _register("customer")
        drv = _register("driver")
        bkg_id = _seed_active_booking(cust["id"], drv["id"], driver_charge=317.50)

        # Driver marks on_route → cash reminder fires.
        r = requests.post(
            f"{API}/bookings/{bkg_id}/status",
            json={"status": "on_route"},
            headers={"Authorization": f"Bearer {drv['token']}"}, timeout=15,
        )
        assert r.status_code == 200, r.text

        _, db = _mongo()
        b = db.bookings.find_one({"id": bkg_id}, {"_id": 0})
        assert b["cash_reminder_sent_at"] is not None

        # Email logged with the correct template + amount in subject.
        logs = list(db.email_log.find({"booking_id": bkg_id,
                                       "template": "cash_on_delivery_reminder"}))
        assert len(logs) == 1
        subj = logs[0]["subject"]
        assert "£317.50" in subj

        # Push notification landed in the customer's tray with the amount.
        notes = list(db.notifications.find({"user_id": cust["id"],
                                              "data.booking_id": bkg_id,
                                              "data.kind": "cash_reminder"}))
        assert len(notes) == 1
        assert "£317.50" in notes[0]["title"]
        assert notes[0]["data"]["amount"] == 317.50

    def test_replay_status_does_not_double_send(self):
        cust = _register("customer")
        drv = _register("driver")
        bkg_id = _seed_active_booking(cust["id"], drv["id"], driver_charge=180.0)

        # First on_route → sends.
        r1 = requests.post(
            f"{API}/bookings/{bkg_id}/status",
            json={"status": "on_route"},
            headers={"Authorization": f"Bearer {drv['token']}"}, timeout=15,
        )
        assert r1.status_code == 200

        # Flip back and forward — must NOT trigger a second email.
        requests.post(f"{API}/bookings/{bkg_id}/status",
                       json={"status": "collected"},
                       headers={"Authorization": f"Bearer {drv['token']}"}, timeout=15)
        r2 = requests.post(f"{API}/bookings/{bkg_id}/status",
                            json={"status": "on_route"},
                            headers={"Authorization": f"Bearer {drv['token']}"}, timeout=15)
        assert r2.status_code == 200

        _, db = _mongo()
        logs = list(db.email_log.find({"booking_id": bkg_id,
                                       "template": "cash_on_delivery_reminder"}))
        assert len(logs) == 1

    def test_non_on_route_transitions_do_not_fire(self):
        cust = _register("customer")
        drv = _register("driver")
        bkg_id = _seed_active_booking(cust["id"], drv["id"], driver_charge=120.0)

        for status in ("arrived", "collected", "delivered"):
            requests.post(f"{API}/bookings/{bkg_id}/status",
                           json={"status": status},
                           headers={"Authorization": f"Bearer {drv['token']}"}, timeout=15)

        _, db = _mongo()
        logs = list(db.email_log.find({"booking_id": bkg_id,
                                       "template": "cash_on_delivery_reminder"}))
        assert logs == []


class TestFixedPriceNudgeSupport:

    def test_quote_endpoint_still_returns_suggested_price(self):
        # The frontend nudge compares against `suggested_price`. As long as
        # this endpoint keeps returning a number for a normal UK route,
        # the nudge can drive its recommendations.
        cust = _register("customer")
        params = {
            "pickup_lat": 51.5034, "pickup_lng": -0.1276,
            "dropoff_lat": 51.4545, "dropoff_lng": -2.5879,
            "service_type": "transport",
            "service_timing": "scheduled",
            "category_key": "furniture_delivery",
            "weight_kg": 200,
        }
        r = requests.get(f"{API}/quote/estimate", params=params,
                          headers={"Authorization": f"Bearer {cust['token']}"},
                          timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert isinstance(d.get("suggested_price"), (int, float))
        assert d["suggested_price"] > 0
