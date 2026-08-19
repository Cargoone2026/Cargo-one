"""R68 seed/e2e driver — creates real paid active bookings for the
Unified Map + Navigation UX smoke test. Run directly:

    cd /app/backend && python tests/r68_seed.py
"""
import json
import os
import sys
import uuid

import requests
from dotenv import dotenv_values
from pymongo import MongoClient

fe = dotenv_values("/app/frontend/.env")
BASE = (os.environ.get("REACT_APP_BACKEND_URL") or fe["REACT_APP_BACKEND_URL"]).rstrip("/")
API = f"{BASE}/api"
be = dotenv_values("/app/backend/.env")
MONGO_URL = be["MONGO_URL"]
DB_NAME = be["DB_NAME"]
mdb = MongoClient(MONGO_URL)[DB_NAME]

ADMIN = {"email": "admin@cargoone.com", "password": "Vc9O0sNDGR6SfzKDaa0L1lhp"}
PW = "R68Test!23456"
TAG = uuid.uuid4().hex[:6]
OUT = {"tag": TAG, "base": BASE, "scenarios": {}, "notes": []}


def login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    r.raise_for_status()
    return r.json()["access_token"], r.json()["user"]


def register(email, role, name):
    r = requests.post(f"{API}/auth/register", json={
        "email": email, "password": PW, "name": name,
        "phone": "+447700900123", "role": role}, timeout=30)
    if r.status_code != 200:
        raise RuntimeError(f"register {email} -> {r.status_code} {r.text[:200]}")
    return r.json()["access_token"], r.json()["user"]


def h(tok):
    return {"Authorization": f"Bearer {tok}"}


def mark_paid(booking_id, job_id, asap):
    mdb.bookings.update_one({"id": booking_id}, {"$set": {
        "payment_status": "paid", "status": "deposit_paid", "paid_at": "2026-07-01T00:00:00Z"}})
    upd = {"status": "confirmed"}
    if asap:
        upd["dispatch_ready_at"] = "2026-07-01T00:00:00Z"
    mdb.jobs.update_one({"id": job_id}, {"$set": upd})


def make_job(cust_tok, *, timing, service_type, price, title, sched=None):
    payload = {
        "title": title, "category": "general",
        "description": "R68 live smoke test job",
        "pickup_address": "10 Downing Street, London SW1A 2AA",
        "pickup_town": "London", "pickup_lat": 51.5033, "pickup_lng": -0.1276,
        "dropoff_address": "Reading Station, Reading RG1 1LZ",
        "dropoff_town": "Reading", "dropoff_lat": 51.4585, "dropoff_lng": -0.9718,
        "weight_kg": 40,
        "pricing_type": "fixed", "fixed_price": price,
        "vehicle_required": "small_van",
        "service_timing": timing, "service_type": service_type,
    }
    payload["collection_date"] = sched or "2026-07-05"
    payload["delivery_date"] = sched or "2026-07-05"
    r = requests.post(f"{API}/jobs", headers=h(cust_tok), json=payload, timeout=40)
    if r.status_code != 200:
        raise RuntimeError(f"job create -> {r.status_code} {r.text[:300]}")
    return r.json()


def make_booking(cust_tok, job_id):
    r = requests.post(f"{API}/bookings", headers=h(cust_tok), json={"job_id": job_id}, timeout=40)
    if r.status_code != 200:
        raise RuntimeError(f"booking create -> {r.status_code} {r.text[:300]}")
    return r.json()


def main():
    admin_tok, _ = login(**ADMIN)
    OUT["notes"].append("admin login ok")

    cust_email = f"r68_customer_{TAG}@cargoone.com"
    cust_tok, cust = register(cust_email, "customer", "R68 Customer")
    OUT["customer"] = {"email": cust_email, "password": PW, "id": cust["id"]}

    drivers = []
    for n in ("a", "b", "c", "d"):
        de = f"r68_driver_{n}_{TAG}@cargoone.com"
        dtok, du = register(de, "driver", f"R68 Driver {n.upper()}")
        ra = requests.post(f"{API}/admin/users/{du['id']}/approve", headers=h(admin_tok), timeout=30)
        if ra.status_code not in (200, 204):
            raise RuntimeError(f"approve -> {ra.status_code} {ra.text[:200]}")
        dtok, du = login(de, PW)
        assert du["status"] == "active", du
        drivers.append({"email": de, "password": PW, "id": du["id"], "token": dtok})
    OUT["drivers"] = [{k: v for k, v in d.items() if k != "token"} for d in drivers]

    # ---- ASAP scenarios (claim path) --------------------------------------
    for idx, (key, svc) in enumerate([("asap_transport", "transport"),
                                      ("asap_recovery", "breakdown_recovery")]):
        d = drivers[idx]
        job = make_job(cust_tok, timing="asap", service_type=svc, price=120.0 + idx,
                       title=f"R68 {key} {TAG}")
        bk = make_booking(cust_tok, job["id"])
        mark_paid(bk["id"], job["id"], asap=True)
        requests.post(f"{API}/driver/live/online", headers=h(d["token"]),
                      json={"lat": 51.5033, "lng": -0.1276}, timeout=30)
        requests.post(f"{API}/driver/live/heartbeat", headers=h(d["token"]),
                      json={"lat": 51.5033, "lng": -0.1276}, timeout=30)
        rc = requests.post(f"{API}/jobs/{job['id']}/claim", headers=h(d["token"]), timeout=40)
        claimed = rc.status_code == 200
        if not claimed:
            OUT["notes"].append(f"{key}: claim failed {rc.status_code} {rc.text[:200]}")
        OUT["scenarios"][key] = {"job_id": job["id"], "booking_id": bk["id"],
                                 "driver": d["email"], "claimed_via_api": claimed,
                                 "claim_status": rc.status_code}

    # ---- Fixed price (scheduled, accept path) ----------------------------
    for key, sched, drv in [("fixed_price", "2026-08-10", drivers[2]),
                            ("big_job_scheduled", "2026-09-15", drivers[3])]:
        price = 270.0 if key == "fixed_price" else 850.0
        job = make_job(cust_tok, timing="scheduled", service_type="transport",
                       price=price, title=f"R68 {key} {TAG}", sched=sched)
        ra = requests.post(f"{API}/jobs/{job['id']}/accept", headers=h(drv["token"]), timeout=40)
        if ra.status_code != 200:
            raise RuntimeError(f"{key} accept -> {ra.status_code} {ra.text[:300]}")
        bk = make_booking(cust_tok, job["id"])
        mark_paid(bk["id"], job["id"], asap=False)
        OUT["scenarios"][key] = {"job_id": job["id"], "booking_id": bk["id"],
                                 "driver": drv["email"], "accept_status": ra.status_code}

    # ---- Quote-stage (unpaid) booking for TEST 5 -------------------------
    job = make_job(cust_tok, timing="scheduled", service_type="transport", price=180.0,
                   title=f"R68 quote_stage {TAG}", sched="2026-08-20")
    ra = requests.post(f"{API}/jobs/{job['id']}/accept", headers=h(drivers[2]["token"]), timeout=40)
    bk = make_booking(cust_tok, job["id"])
    OUT["scenarios"]["quote_stage_unpaid"] = {
        "job_id": job["id"], "booking_id": bk["id"], "driver": drivers[2]["email"],
        "payment_status": bk.get("payment_status"), "accept_status": ra.status_code}

    # ---- Missing pickup coords for TEST 6 --------------------------------
    job = make_job(cust_tok, timing="scheduled", service_type="transport", price=200.0,
                   title=f"R68 nocoords {TAG}", sched="2026-08-25")
    ra = requests.post(f"{API}/jobs/{job['id']}/accept", headers=h(drivers[3]["token"]), timeout=40)
    bk = make_booking(cust_tok, job["id"])
    mark_paid(bk["id"], job["id"], asap=False)
    mdb.jobs.update_one({"id": job["id"]},
                        {"$unset": {"pickup_lat": "", "pickup_lng": ""}})
    requests.post(f"{API}/bookings/{bk['id']}/status", headers=h(drivers[3]["token"]),
                  json={"status": "travelling"}, timeout=30)
    OUT["scenarios"]["missing_coords"] = {"job_id": job["id"], "booking_id": bk["id"],
                                          "driver": drivers[3]["email"]}

    # driver tokens saved separately (needed by the playwright/status driver)
    OUT["driver_tokens"] = {d["email"]: d["token"] for d in drivers}
    OUT["customer_token"] = cust_tok
    with open("/app/test_reports/r68_seed.json", "w") as f:
        json.dump(OUT, f, indent=2)
    print(json.dumps({k: v for k, v in OUT.items() if k not in ("driver_tokens", "customer_token")}, indent=2))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print("SEED FAILED:", e)
        with open("/app/test_reports/r68_seed_partial.json", "w") as f:
            json.dump(OUT, f, indent=2)
        sys.exit(1)
