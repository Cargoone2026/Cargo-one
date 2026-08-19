"""R69 PART 3/4/8/9/10 follow-up — completion, earnings, real Stripe deposit
session creation, email sendlog evidence, admin visibility, cancellation
spot-check and driver cross-booking access.

Depends on fixtures written by tests/r69_lifecycle.py.
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

ADMIN = ("admin@cargoone.com", "Vc9O0sNDGR6SfzKDaa0L1lhp")
LC = json.load(open("/app/test_reports/r69_lifecycle.json"))
PW = LC["customer"]["password"]
OUT = {}


def h(t):
    return {"Authorization": f"Bearer {t}"}


def login(e, p):
    r = requests.post(f"{API}/auth/login", json={"email": e, "password": p}, timeout=30)
    r.raise_for_status()
    return r.json()["access_token"]


def make_job(tok, **kw):
    p = {
        "title": kw.get("title", "R69 cancel spot"), "category": "general",
        "description": "R69 cancellation spot-check",
        "pickup_address": "10 Downing Street, London SW1A 2AA",
        "pickup_town": "London", "pickup_lat": 51.5033, "pickup_lng": -0.1276,
        "dropoff_address": "Reading Station, Reading RG1 1LZ",
        "dropoff_town": "Reading", "dropoff_lat": 51.4585, "dropoff_lng": -0.9718,
        "weight_kg": 40, "pricing_type": "fixed", "fixed_price": 200.0,
        "vehicle_required": "small_van", "service_timing": "scheduled",
        "service_type": "transport",
        "collection_date": "2026-09-10", "delivery_date": "2026-09-10",
    }
    r = requests.post(f"{API}/jobs", headers=h(tok), json=p, timeout=40)
    r.raise_for_status()
    return r.json()


ctok = login(LC["customer"]["email"], PW)
atok = login(*ADMIN)
dtoks = {d["email"]: login(d["email"], PW) for d in LC["drivers"]}
drv = LC["drivers"]

# ---------------- PART 3/4 completion + earnings ----------------
comp = {}
pairs = [("bidding", drv[0]), ("fixed_price", drv[1]), ("asap_recovery", drv[3])]
for key, d in pairs:
    r = LC["results"][key]
    bid_ = r["booking_id"]
    rc = requests.post(f"{API}/bookings/{bid_}/complete", headers=h(ctok), timeout=40)
    comp[key] = {"complete_status": rc.status_code}
    fb = requests.get(f"{API}/bookings/{bid_}", headers=h(ctok), timeout=30).json()
    comp[key]["final_status"] = fb.get("status")
# asap_recovery driver is drv[3]? claim used drivers[3] for recovery -> index 3
OUT["completion"] = comp

earn = {}
for i, d in enumerate(drv):
    rd = requests.get(f"{API}/driver/dashboard", headers=h(dtoks[d["email"]]), timeout=60)
    body = rd.json() if rd.status_code == 200 else {}
    earn[d["email"]] = {
        "status": rd.status_code,
        "earnings": body.get("earnings"),
        "completed_count": len(body.get("completed") or []) if isinstance(body.get("completed"), list) else body.get("completed_jobs"),
    }
OUT["driver_earnings"] = earn

# ---------------- PART 9 emails ----------------
emails = list(mdb.email_log.find(
    {"$or": [{"to": LC["customer"]["email"]}, {"to_email": LC["customer"]["email"]}]},
    {"_id": 0}).limit(60))
if not emails:
    emails = [e for e in mdb.email_log.find({}, {"_id": 0}).sort([("_id", -1)]).limit(200)
              if LC["customer"]["email"] in json.dumps(e, default=str)]
OUT["email_sample_keys"] = sorted({k for e in emails for k in e})[:25]
OUT["emails_for_customer"] = [
    {k: v for k, v in e.items() if k in ("template", "type", "subject", "to", "to_email",
                                         "status", "ok", "provider_id", "error", "created_at")}
    for e in emails][:30]
OUT["email_count"] = len(emails)

# ---------------- PART 10 admin ----------------
rb = requests.get(f"{API}/admin/bookings", headers=h(atok), timeout=90)
rows = rb.json() if isinstance(rb.json(), list) else rb.json().get("bookings", [])
ids = {r.get("id") for r in rows}
want = {k: LC["results"][k]["booking_id"] for k in
        ("bidding", "fixed_price", "asap_transport", "asap_recovery")}
OUT["admin_bookings"] = {"status": rb.status_code, "total": len(rows),
                         "all_4_visible": {k: (v in ids) for k, v in want.items()}}
rj = requests.get(f"{API}/admin/jobs/{LC['bidding_job_id']}", headers=h(atok), timeout=40)
jd = rj.json() if rj.status_code == 200 else {}
OUT["admin_job_detail"] = {"status": rj.status_code, "keys": sorted(jd.keys()),
                           "bids": len(jd.get("bids") or []),
                           "has_customer": bool(jd.get("customer")),
                           "has_driver": bool(jd.get("driver")),
                           "has_booking": bool(jd.get("booking"))}

# ---------------- PART 7d driver cross-booking ----------------
other = requests.get(f"{API}/bookings/{LC['results']['bidding']['booking_id']}",
                     headers=h(dtoks[drv[1]["email"]]), timeout=30)
OUT["driver_cross_booking_status"] = other.status_code

# ---------------- PART 8 cancellation ----------------
canc = {}
# pre-accept cancel (no driver, no payment)
job = make_job(ctok, title="R69 pre-accept cancel")
rjd = requests.delete(f"{API}/jobs/{job['id']}", headers=h(ctok), timeout=30)
canc["pre_accept_delete_job"] = rjd.status_code
jj = requests.get(f"{API}/jobs/{job['id']}", headers=h(ctok), timeout=30)
canc["pre_accept_job_after"] = {"status_code": jj.status_code,
                                "status": (jj.json().get("status") if jj.status_code == 200 else None),
                                "driver": (jj.json().get("assigned_driver_id") if jj.status_code == 200 else None)}

# post-accept, deposit paid cancel
job2 = make_job(ctok, title="R69 post-accept cancel")
d = drv[0]
requests.post(f"{API}/jobs/{job2['id']}/accept", headers=h(dtoks[d["email"]]), timeout=40)
bk = requests.post(f"{API}/bookings", headers=h(ctok), json={"job_id": job2["id"]}, timeout=40).json()
mdb.bookings.update_one({"id": bk["id"]}, {"$set": {
    "payment_status": "paid", "status": "deposit_paid",
    "deposit_payment_intent_id": "pi_test_r69", "paid_at": "2026-07-15T00:00:00Z"}})
mdb.jobs.update_one({"id": job2["id"]}, {"$set": {"status": "confirmed"}})
pv = requests.get(f"{API}/customer/bookings/{bk['id']}/cancel-preview", headers=h(ctok), timeout=40)
canc["cancel_preview"] = {"status": pv.status_code, "body": pv.json() if pv.status_code == 200 else pv.text[:200]}
cr = requests.post(f"{API}/customer/bookings/{bk['id']}/cancel-and-refund", headers=h(ctok),
                   json={"reason": "customer_changed_plans"}, timeout=90)
canc["cancel_and_refund"] = {"status": cr.status_code,
                             "body": cr.json() if cr.status_code == 200 else cr.text[:300]}
doc = mdb.bookings.find_one({"id": bk["id"]}, {"_id": 0})
canc["booking_after"] = {k: doc.get(k) for k in
                         ("status", "payment_status", "cancellation_fee", "refund_amount",
                          "refund_id", "stripe_refund_id", "cancelled_by", "driver_earning")}
canc["booking_id"] = bk["id"]
OUT["cancellation"] = canc

# ---------------- Stripe real deposit session ----------------
job3 = make_job(ctok, title="R69 stripe session")
requests.post(f"{API}/jobs/{job3['id']}/accept", headers=h(dtoks[drv[1]["email"]]), timeout=40)
bk3 = requests.post(f"{API}/bookings", headers=h(ctok), json={"job_id": job3["id"]}, timeout=40).json()
rs = requests.post(f"{API}/bookings/{bk3['id']}/deposit", headers=h(ctok),
                   json={"origin_url": BASE}, timeout=60)
sj = rs.json() if rs.status_code == 200 else {}
OUT["stripe_deposit_session"] = {
    "status": rs.status_code,
    "has_url": bool(sj.get("url")),
    "url_host": (sj.get("url") or "")[:40],
    "session_id_present": bool(sj.get("session_id") or sj.get("id")),
    "error": None if rs.status_code == 200 else rs.text[:300],
    "booking_id": bk3["id"],
}

with open("/app/test_reports/r69_followup.json", "w") as f:
    json.dump(OUT, f, indent=2, default=str)
print(json.dumps(OUT, indent=2, default=str))
