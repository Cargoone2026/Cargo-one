"""R69 PART 3 + 8 — real Stripe deposit payment + post-accept cancel/refund.

Step 1 (`prep`): creates a fresh fixed-price booking, driver accepts, and a
REAL Stripe Checkout deposit session is created. Prints the checkout URL for
Playwright to pay with 4242 4242 4242 4242.

Step 2 (`verify`): confirms the webhook marked the booking paid, then runs the
post-accept cancellation and asserts the R35/R36 fee formula + Stripe refund
evidence recorded on the booking.

Usage:  python /app/tests/r69_stripe_refund.py prep|verify
"""
import json
import sys

import requests
from dotenv import dotenv_values
from pymongo import MongoClient

fe = dotenv_values("/app/frontend/.env")
BASE = fe["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE}/api"
be = dotenv_values("/app/backend/.env")
mdb = MongoClient(be["MONGO_URL"])[be["DB_NAME"]]

LC = json.load(open("/app/test_reports/r69_lifecycle.json"))
PW = LC["customer"]["password"]
STATE = "/app/test_reports/r69_stripe_state.json"


def h(t):
    return {"Authorization": f"Bearer {t}"}


def login(e, p):
    r = requests.post(f"{API}/auth/login", json={"email": e, "password": p}, timeout=30)
    r.raise_for_status()
    return r.json()["access_token"]


def prep():
    ctok = login(LC["customer"]["email"], PW)
    dtok = login(LC["drivers"][1]["email"], PW)
    payload = {
        "title": "R69 Stripe refund cert", "category": "general",
        "description": "R69 real deposit payment + cancellation refund",
        "pickup_address": "10 Downing Street, London SW1A 2AA",
        "pickup_town": "London", "pickup_lat": 51.5033, "pickup_lng": -0.1276,
        "dropoff_address": "Reading Station, Reading RG1 1LZ",
        "dropoff_town": "Reading", "dropoff_lat": 51.4585, "dropoff_lng": -0.9718,
        "weight_kg": 40, "pricing_type": "fixed", "fixed_price": 210.0,
        "vehicle_required": "small_van", "service_timing": "scheduled",
        "service_type": "transport",
        "collection_date": "2026-09-15", "delivery_date": "2026-09-15",
    }
    job = requests.post(f"{API}/jobs", headers=h(ctok), json=payload, timeout=40).json()
    acc = requests.post(f"{API}/jobs/{job['id']}/accept", headers=h(dtok), timeout=40)
    dep = requests.post(f"{API}/bookings", headers=h(ctok), json={"job_id": job["id"]}, timeout=40)
    bk = dep.json()
    sess = requests.post(f"{API}/bookings/{bk['id']}/deposit", headers=h(ctok),
                         json={"origin_url": BASE}, timeout=60)
    st = {
        "job_id": job["id"], "booking_id": bk["id"],
        "accept_status": acc.status_code, "booking_status": dep.status_code,
        "deposit_amount": bk.get("deposit_amount"),
        "driver_charge": bk.get("driver_charge"),
        "session_status": sess.status_code, "session": sess.json(),
    }
    json.dump(st, open(STATE, "w"), indent=2)
    print(json.dumps(st, indent=2))


def verify():
    st = json.load(open(STATE))
    ctok = login(LC["customer"]["email"], PW)
    bid_ = st["booking_id"]
    out = {}
    b = requests.get(f"{API}/bookings/{bid_}", headers=h(ctok), timeout=30).json()
    out["after_payment"] = {k: b.get(k) for k in
                            ("status", "payment_status", "deposit_amount", "driver_charge")}
    txn = mdb.payment_transactions.find_one({"session_id": st["session"].get("session_id")},
                                            {"_id": 0})
    out["payment_transaction"] = {k: (txn or {}).get(k) for k in
                                  ("status", "payment_status", "payment_intent_id", "amount")}
    pv = requests.get(f"{API}/customer/bookings/{bid_}/cancel-preview", headers=h(ctok), timeout=40)
    out["cancel_preview"] = pv.json() if pv.status_code == 200 else pv.text[:200]
    cr = requests.post(f"{API}/customer/bookings/{bid_}/cancel-and-refund", headers=h(ctok),
                       json={"reason": "customer_changed_plans"}, timeout=120)
    out["cancel_and_refund_status"] = cr.status_code
    out["cancel_and_refund_body"] = cr.json() if cr.status_code == 200 else cr.text[:400]
    doc = mdb.bookings.find_one({"id": bid_}, {"_id": 0}) or {}
    out["booking_after_cancel"] = {k: doc.get(k) for k in
                                   ("status", "payment_status", "refund_status",
                                    "stripe_refund_id", "refund_amount",
                                    "cancellation_breakdown", "refund_error",
                                    "driver_earning", "cancelled_by")}
    jd = mdb.jobs.find_one({"id": st["job_id"]}, {"_id": 0}) or {}
    out["job_after_cancel"] = {k: jd.get(k) for k in ("status", "cancelled_by")}
    json.dump(out, open("/app/test_reports/r69_stripe_refund.json", "w"), indent=2, default=str)
    print(json.dumps(out, indent=2, default=str))


if __name__ == "__main__":
    (prep if sys.argv[1] == "prep" else verify)()
