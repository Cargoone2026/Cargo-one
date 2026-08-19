"""R69 UI seed — creates fixtures for the Playwright certification run.

  * fresh customer + approved driver (driver has 2 seeded written reviews)
  * BIDDING job in `posted` state with one bid from the driver
  * FIXED PRICE job in `accepted` state (driver claimed, deposit unpaid)

Run: cd /app/backend && python tests/r69_seed.py
"""
import json
import os
import uuid

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


def h(t):
    return {"Authorization": f"Bearer {t}"}


def login(e, p):
    r = requests.post(f"{API}/auth/login", json={"email": e, "password": p}, timeout=30)
    r.raise_for_status()
    return r.json()["access_token"], r.json()["user"]


def register(e, role, name):
    r = requests.post(f"{API}/auth/register", json={
        "email": e, "password": PW, "name": name,
        "phone": "+447700900456", "role": role}, timeout=30)
    r.raise_for_status()
    return r.json()["access_token"], r.json()["user"]


def make_job(tok, *, title, pricing_type, price=None, timing="scheduled",
             service_type="transport"):
    payload = {
        "title": title, "category": "general", "description": "R69 UI seed job",
        "pickup_address": "10 Downing Street, London SW1A 2AA",
        "pickup_town": "London", "pickup_lat": 51.5033, "pickup_lng": -0.1276,
        "dropoff_address": "Reading Station, Reading RG1 1LZ",
        "dropoff_town": "Reading", "dropoff_lat": 51.4585, "dropoff_lng": -0.9718,
        "weight_kg": 40, "pricing_type": pricing_type,
        "vehicle_required": "small_van",
        "service_timing": timing, "service_type": service_type,
        "collection_date": "2026-08-12", "delivery_date": "2026-08-12",
    }
    if price is not None:
        payload["fixed_price"] = price
    r = requests.post(f"{API}/jobs", headers=h(tok), json=payload, timeout=40)
    r.raise_for_status()
    return r.json()


def main():
    atok, _ = login(ADMIN["email"], ADMIN["password"])
    ce = f"r69_cust_{TAG}@cargoone.com"
    ctok, cust = register(ce, "customer", "R69 UI Customer")
    de = f"r69_drv_{TAG}@cargoone.com"
    dtok, drv = register(de, "driver", "R69 UI Driver")
    requests.post(f"{API}/admin/users/{drv['id']}/approve", headers=h(atok), timeout=30).raise_for_status()
    dtok, drv = login(de, PW)

    rids = []
    for i, (rating, comment) in enumerate([
            (5, "Outstanding service, van was spotless and driver was early."),
            (4, "Careful with the load, kept me updated the whole way.")]):
        rid = str(uuid.uuid4())
        rids.append(rid)
        mdb.reviews.insert_one({
            "id": rid, "target_id": drv["id"], "author_id": cust["id"],
            "from_name": f"R69 Reviewer {i+1}", "rating": rating, "comment": comment,
            "created_at": f"2026-06-1{i+1}T09:00:00Z", "booking_id": f"R69SEED_{TAG}_{i}"})
    mdb.users.update_one({"id": drv["id"]},
                         {"$set": {"review_count": 2, "rating": 4.5, "total_jobs": 4}})

    bjob = make_job(ctok, title=f"R69 UI Bidding {TAG}", pricing_type="bidding")
    rb = requests.post(f"{API}/jobs/{bjob['id']}/bids", headers=h(dtok),
                       json={"amount": 172.0, "message": "Available today, fully insured.",
                             "eta_hours": 3}, timeout=30)
    rb.raise_for_status()
    bid = rb.json()

    fjob = make_job(ctok, title=f"R69 UI Fixed {TAG}", pricing_type="fixed", price=143.25)
    requests.post(f"{API}/jobs/{fjob['id']}/accept", headers=h(dtok), timeout=40).raise_for_status()

    out = {
        "tag": TAG, "base": BASE, "password": PW,
        "customer": {"email": ce, "id": cust["id"]},
        "driver": {"email": de, "id": drv["id"], "review_ids": rids},
        "bidding": {"job_id": bjob["id"], "bid_id": bid["id"], "amount": 172.0},
        "fixed": {"job_id": fjob["id"], "fixed_price": 143.25},
    }
    with open("/app/test_reports/r69_seed.json", "w") as f:
        json.dump(out, f, indent=2)
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
