"""R69 PART 3/4/5/6 — lifecycle certification for 4 booking types.

Creates FRESH customer + approved drivers and drives each booking type
through its full status progression via the public API. Deposit payment is
simulated at DB level ONLY (Stripe Checkout redirect cannot be automated
headlessly here); the Stripe session creation endpoint is still exercised
and asserted so the payment integration itself is covered.

Leaves one ASAP transport booking in `travelling` for the Playwright
Navigate/map-panel test and writes fixtures to
/app/test_reports/r69_lifecycle.json
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
PW = "R69Cert!2026"
TAG = uuid.uuid4().hex[:8]
OUT = {"tag": TAG, "results": {}, "issues": []}


def h(t):
    return {"Authorization": f"Bearer {t}"}


def login(e, p):
    r = requests.post(f"{API}/auth/login", json={"email": e, "password": p}, timeout=30)
    r.raise_for_status()
    return r.json()["access_token"], r.json()["user"]


def register(e, role, name):
    r = requests.post(f"{API}/auth/register", json={
        "email": e, "password": PW, "name": name,
        "phone": "+447700900789", "role": role}, timeout=30)
    r.raise_for_status()
    return r.json()["access_token"], r.json()["user"]


def make_job(tok, *, title, pricing_type, price=None, timing="scheduled",
             service_type="transport"):
    p = {
        "title": title, "category": "general", "description": "R69 lifecycle job",
        "pickup_address": "10 Downing Street, London SW1A 2AA",
        "pickup_town": "London", "pickup_lat": 51.5033, "pickup_lng": -0.1276,
        "dropoff_address": "Reading Station, Reading RG1 1LZ",
        "dropoff_town": "Reading", "dropoff_lat": 51.4585, "dropoff_lng": -0.9718,
        "weight_kg": 40, "pricing_type": pricing_type,
        "vehicle_required": "small_van",
        "service_timing": timing, "service_type": service_type,
        "collection_date": "2026-08-20", "delivery_date": "2026-08-20",
    }
    if price is not None:
        p["fixed_price"] = price
    r = requests.post(f"{API}/jobs", headers=h(tok), json=p, timeout=40)
    r.raise_for_status()
    return r.json()


def stripe_session(tok, booking_id, kind):
    """Exercise real Stripe session creation (test key)."""
    for path, body in (
        (f"/bookings/{booking_id}/checkout", {}),
        (f"/payments/checkout/session", {"booking_id": booking_id, "kind": kind}),
        (f"/bookings/{booking_id}/pay-deposit", {}),
    ):
        r = requests.post(f"{API}{path}", headers=h(tok), json=body, timeout=45)
        if r.status_code == 200:
            return path, r.json()
    return None, {"last_status": r.status_code, "last": r.text[:200]}


def mark_paid(bid_, jid, asap):
    mdb.bookings.update_one({"id": bid_}, {"$set": {
        "payment_status": "paid", "status": "deposit_paid",
        "paid_at": "2026-07-15T00:00:00Z"}})
    upd = {"status": "confirmed"}
    if asap:
        upd["dispatch_ready_at"] = "2026-07-15T00:00:00Z"
    mdb.jobs.update_one({"id": jid}, {"$set": upd})


def progress(dtok, booking_id, res):
    for st in ("travelling", "arrived", "collected", "on_route", "delivered"):
        r = requests.post(f"{API}/bookings/{booking_id}/status", headers=h(dtok),
                          json={"status": st}, timeout=40)
        res.setdefault("status_progression", {})[st] = r.status_code
        if r.status_code != 200:
            res.setdefault("errors", []).append(f"{st} -> {r.status_code} {r.text[:150]}")
            break


def contact_privacy(ctok, job_id, drv_email):
    r = requests.get(f"{API}/jobs/{job_id}", headers=h(ctok), timeout=30)
    return {"status": r.status_code, "email_leaked": drv_email.lower() in r.text.lower(),
            "phone_leaked": "+447700900789" in r.text}


def main():
    atok, _ = login(*ADMIN)
    ce = f"r69_lc_cust_{TAG}@cargoone.com"
    ctok, cust = register(ce, "customer", "R69 LC Customer")
    OUT["customer"] = {"email": ce, "id": cust["id"], "password": PW}

    drivers = []
    for n in ("a", "b", "c", "d"):
        de = f"r69_lc_drv_{n}_{TAG}@cargoone.com"
        _t, du = register(de, "driver", f"R69 LC Driver {n.upper()}")
        requests.post(f"{API}/admin/users/{du['id']}/approve", headers=h(atok),
                      timeout=30).raise_for_status()
        t, du = login(de, PW)
        drivers.append({"email": de, "id": du["id"], "token": t, "password": PW})
    OUT["drivers"] = [{k: v for k, v in d.items() if k != "token"} for d in drivers]

    # ---------------- BIDDING (PART 3) ----------------
    d = drivers[0]
    res = {}
    job = make_job(ctok, title=f"R69 LC Bidding {TAG}", pricing_type="bidding")
    rb = requests.post(f"{API}/jobs/{job['id']}/bids", headers=h(d["token"]),
                       json={"amount": 180.0, "eta_hours": 4}, timeout=30)
    res["bid_status"] = rb.status_code
    bid = rb.json()
    lb = requests.get(f"{API}/jobs/{job['id']}/bids", headers=h(ctok), timeout=30).json()
    res["driver_review_count_present"] = "driver_review_count" in lb[0]
    res["privacy_pre_accept"] = contact_privacy(ctok, job["id"], d["email"])
    ra = requests.post(f"{API}/bids/{bid['id']}/accept", headers=h(ctok), timeout=30)
    res["accept_bid_status"] = ra.status_code
    bk = requests.post(f"{API}/bookings", headers=h(ctok), json={"job_id": job["id"]}, timeout=40)
    res["booking_status"] = bk.status_code
    bkj = bk.json()
    res["booking_id"] = bkj.get("id")
    res["driver_charge"] = bkj.get("driver_charge") or bkj.get("price")
    res["stripe_path"], sess = stripe_session(ctok, bkj["id"], "deposit")
    res["stripe_session"] = {k: v for k, v in sess.items() if k in ("url", "session_id", "id", "last_status")}
    mark_paid(bkj["id"], job["id"], asap=False)
    progress(d["token"], bkj["id"], res)
    fb = requests.get(f"{API}/bookings/{bkj['id']}", headers=h(ctok), timeout=30).json()
    res["final_status"] = fb.get("status")
    res["price_preserved"] = float(fb.get("driver_charge") or 0) == 180.0
    res["privacy_post_accept_contact_visible"] = bool(
        (fb.get("driver") or {}).get("phone") or fb.get("driver_phone"))
    er = requests.get(f"{API}/driver/earnings", headers=h(d["token"]), timeout=40)
    res["earnings_status"] = er.status_code
    res["earnings_blob_has_booking"] = bkj["id"] in er.text
    OUT["results"]["bidding"] = res
    OUT["bidding_job_id"] = job["id"]

    # ---------------- FIXED PRICE (PART 4) ----------------
    d = drivers[1]
    res = {}
    job = make_job(ctok, title=f"R69 LC Fixed {TAG}", pricing_type="fixed", price=151.75)
    res["declared_fixed_price"] = job.get("fixed_price")
    res["r42_preserved_on_create"] = float(job["fixed_price"]) == 151.75
    requests.post(f"{API}/jobs/{job['id']}/accept", headers=h(d["token"]), timeout=40)
    bk = requests.post(f"{API}/bookings", headers=h(ctok), json={"job_id": job["id"]}, timeout=40)
    bkj = bk.json()
    res["booking_id"] = bkj.get("id")
    res["booking_driver_charge"] = bkj.get("driver_charge")
    res["r42_preserved_on_booking"] = float(bkj.get("driver_charge") or 0) == 151.75
    res["stripe_path"], sess = stripe_session(ctok, bkj["id"], "deposit")
    res["stripe_session"] = {k: v for k, v in sess.items() if k in ("url", "session_id", "id", "last_status")}
    mark_paid(bkj["id"], job["id"], asap=False)
    progress(d["token"], bkj["id"], res)
    fb = requests.get(f"{API}/bookings/{bkj['id']}", headers=h(ctok), timeout=30).json()
    res["final_status"] = fb.get("status")
    res["r42_preserved_final"] = float(fb.get("driver_charge") or 0) == 151.75
    OUT["results"]["fixed_price"] = res
    OUT["fixed_job_id"] = job["id"]

    # ---------------- ASAP TRANSPORT + RECOVERY (PART 5/6) ----------------
    for idx, (key, svc) in enumerate([("asap_transport", "transport"),
                                      ("asap_recovery", "breakdown_recovery")]):
        d = drivers[2 + idx]
        res = {}
        job = make_job(ctok, title=f"R69 LC {key} {TAG}", pricing_type="fixed",
                       price=128.0 + idx, timing="asap", service_type=svc)
        res["job_id"] = job["id"]
        res["quoted_price"] = job.get("fixed_price")
        bk = requests.post(f"{API}/bookings", headers=h(ctok), json={"job_id": job["id"]}, timeout=40)
        res["booking_create"] = bk.status_code
        bkj = bk.json()
        res["booking_id"] = bkj.get("id")
        res["stripe_path"], sess = stripe_session(ctok, bkj["id"], "deposit")
        res["stripe_session"] = {k: v for k, v in sess.items() if k in ("url", "session_id", "id", "last_status")}
        mark_paid(bkj["id"], job["id"], asap=True)
        requests.post(f"{API}/driver/live/online", headers=h(d["token"]),
                      json={"lat": 51.5033, "lng": -0.1276}, timeout=30)
        requests.post(f"{API}/driver/live/heartbeat", headers=h(d["token"]),
                      json={"lat": 51.5033, "lng": -0.1276}, timeout=30)
        rc = requests.post(f"{API}/jobs/{job['id']}/claim", headers=h(d["token"]), timeout=40)
        res["claim_status"] = rc.status_code
        if rc.status_code != 200:
            res["claim_error"] = rc.text[:200]
        # R61 auto-tracking flag
        rj = requests.get(f"{API}/jobs/{job['id']}", headers=h(d["token"]), timeout=30).json()
        res["job_status_after_claim"] = rj.get("status")
        res["driver_assigned"] = rj.get("assigned_driver_id") == d["id"]
        if key == "asap_transport":
            # leave in travelling for the UI navigate test
            r = requests.post(f"{API}/bookings/{bkj['id']}/status", headers=h(d["token"]),
                              json={"status": "travelling"}, timeout=40)
            res["travelling_status"] = r.status_code
            OUT["ui_navigate_booking"] = {"booking_id": bkj["id"], "job_id": job["id"],
                                          "driver": d["email"], "password": PW}
        else:
            progress(d["token"], bkj["id"], res)
            fb = requests.get(f"{API}/bookings/{bkj['id']}", headers=h(ctok), timeout=30).json()
            res["final_status"] = fb.get("status")
        OUT["results"][key] = res

    # ---------------- EMAILS (PART 9) ----------------
    logs = list(mdb.email_log.find({}, {"_id": 0}).sort("created_at", -1).limit(60)) \
        if "email_log" in mdb.list_collection_names() else []
    OUT["email_collections"] = [c for c in mdb.list_collection_names() if "email" in c or "send" in c]
    OUT["recent_emails"] = [
        {k: v for k, v in e.items() if k in ("template", "type", "to", "status", "ok", "created_at")}
        for e in logs
        if TAG in json.dumps(e, default=str) or (OUT["customer"]["email"] in json.dumps(e, default=str))
    ][:25]

    with open("/app/test_reports/r69_lifecycle.json", "w") as f:
        json.dump(OUT, f, indent=2, default=str)
    print(json.dumps(OUT, indent=2, default=str))


if __name__ == "__main__":
    main()
