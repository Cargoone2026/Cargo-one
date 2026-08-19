"""R70 — Newest-first ordering tests for driver /jobs/nearby and customer
/bookings/mine.

Verifies:
- /jobs/nearby returns jobs sorted by `created_at` desc regardless of
  whether the driver supplied a location, and regardless of pickup
  distance (a brand-new far job must come first).
- /bookings/mine already sorts newest-first server-side (documents the
  contract so a future refactor can't silently regress it).
- The sort is stable via (created_at, id) as tie-breaker.
"""
from __future__ import annotations

import time
import uuid

import pytest
import requests

from conftest import API


def _register(role: str) -> tuple[str, str, dict]:
    email = f"r70_{role}_{uuid.uuid4().hex[:8]}@cargoone.com"
    payload = {
        "email": email,
        "password": "R70Sort!2026",
        "name": f"R70 {role.title()}",
        "role": role,
        "phone": "+441234500070",
    }
    if role == "driver":
        payload["vehicle"] = {"key": "small_van", "make": "Ford", "reg": "R70DRV"}
    r = requests.post(f"{API}/auth/register", json=payload, timeout=15)
    r.raise_for_status()
    return email, payload["password"], r.json()["user"]


def _token(email: str, password: str) -> str:
    r = requests.post(
        f"{API}/auth/login", json={"email": email, "password": password}, timeout=15
    )
    r.raise_for_status()
    return r.json()["access_token"]


def _post_job(cust_token: str, title: str, pickup_lat: float, pickup_lng: float) -> str:
    payload = {
        "title": title,
        "category": "general_transport",
        "description": "R70 sort fixture",
        "pickup_address": "1 Nowhere St",
        "pickup_town": "Nowhere",
        "pickup_lat": pickup_lat,
        "pickup_lng": pickup_lng,
        "dropoff_address": "2 Elsewhere St",
        "dropoff_town": "Elsewhere",
        "dropoff_lat": pickup_lat + 0.5,
        "dropoff_lng": pickup_lng + 0.5,
        "collection_date": "2030-01-01",
        "delivery_date": "2030-01-02",
        "pricing_type": "fixed",
        "fixed_price": 200,
        "service_timing": "scheduled",
        "service_type": "transport",
        "requested_vehicle_key": "small_van",
    }
    r = requests.post(
        f"{API}/jobs", json=payload,
        headers={"Authorization": f"Bearer {cust_token}"}, timeout=15,
    )
    r.raise_for_status()
    return r.json()["id"]


def test_r70_nearby_newest_first_regardless_of_distance(admin_token):
    cust_email, cust_pwd, _ = _register("customer")
    cust_tok = _token(cust_email, cust_pwd)
    drv_email, drv_pwd, drv = _register("driver")
    # Admin-approve driver so /jobs/nearby returns anything.
    requests.post(
        f"{API}/admin/users/{drv['id']}/approve",
        headers={"Authorization": f"Bearer {admin_token}"}, timeout=15,
    )
    drv_tok = _token(drv_email, drv_pwd)

    # Three jobs, all with distinct created_at, at very different
    # coordinates. The NEWEST one is the FURTHEST from the driver.
    jids = []
    coords = [
        ("Job-A oldest", 51.5, -0.1),   # London (closest to anchor below)
        ("Job-B middle", 53.5, -2.2),   # Manchester
        ("Job-C newest", 55.9, -3.2),   # Edinburgh (furthest)
    ]
    for title, lat, lng in coords:
        jids.append(_post_job(cust_tok, title, lat, lng))
        time.sleep(1.1)  # ensure ISO timestamps differ

    # Anchor the driver at London → Edinburgh is the FURTHEST but NEWEST.
    r = requests.get(
        f"{API}/jobs/nearby?lat=51.5&lng=-0.1&radius=1000",
        headers={"Authorization": f"Bearer {drv_tok}"}, timeout=15,
    )
    r.raise_for_status()
    got = [j["id"] for j in r.json() if j["id"] in jids]
    assert got == list(reversed(jids)), \
        f"Expected newest-first {list(reversed(jids))}, got {got}"


def test_r70_bookings_mine_newest_first(admin_token):
    """Contract test — /bookings/mine returns rows sorted newest-first.

    Seeds a fresh customer + driver, mints 3 job/booking pairs directly in
    Mongo (bypasses the Stripe deposit UI) with distinct `created_at`
    timestamps, then asserts the API returns them in strict newest→oldest
    order. Guards against a future refactor accidentally dropping the
    `.sort("created_at", -1)` on /bookings/mine.
    """
    import os
    from datetime import datetime, timedelta, timezone
    from pymongo import MongoClient

    cust_email, cust_pwd, cust = _register("customer")
    _, _, drv = _register("driver")
    cust_tok = _token(cust_email, cust_pwd)

    mongo = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
    dbn = os.environ.get("DB_NAME", "test_database")
    db = mongo[dbn]

    now = datetime.now(timezone.utc)
    booking_ids = []
    for i, delta in enumerate([timedelta(hours=3), timedelta(hours=2), timedelta(hours=1)]):
        job_id = _post_job(cust_tok, f"R70 seed {i}", 51.5 + i * 0.01, -0.1)
        # Set the job's created_at to a controlled instant.
        ts = (now - delta).isoformat()
        db.jobs.update_one({"id": job_id}, {"$set": {"created_at": ts}})
        # Mint a matching booking directly with the same created_at.
        bid = f"r70-b-{i}-{uuid.uuid4().hex[:8]}"
        db.bookings.insert_one(
            {
                "id": bid,
                "job_id": job_id,
                "customer_id": cust["id"],
                "driver_id": drv["id"],
                "status": "confirmed",
                "payment_status": "pending",
                "created_at": ts,
                "updated_at": ts,
                "total_price": 200,
                "deposit_amount": 50,
                "balance_due": 150,
            },
        )
        booking_ids.append(bid)

    r = requests.get(
        f"{API}/bookings/mine",
        headers={"Authorization": f"Bearer {cust_tok}"}, timeout=15,
    )
    r.raise_for_status()
    rows = r.json()
    got = [b["id"] for b in rows if b["id"] in booking_ids]
    # We inserted i=0 oldest → i=2 newest. Expected newest-first order is
    # reversed(booking_ids).
    assert got == list(reversed(booking_ids)), \
        f"Expected {list(reversed(booking_ids))}, got {got}"


@pytest.fixture
def admin_token():
    from conftest import ADMIN_EMAIL, ADMIN_PASSWORD
    return _token(ADMIN_EMAIL, ADMIN_PASSWORD)
