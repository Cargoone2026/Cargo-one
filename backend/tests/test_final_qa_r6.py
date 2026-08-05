"""Final QA Round 6 backend regression — ASAP Dispatch Radius Escalation.

Certifies the launch-blocker fix:
  * `_current_search_radius_miles` age-based ladder (10/20/40/75/500)
  * dispatch_log persistence per candidate outcome
  * GET /api/driver/live/offers escalation behaviour
  * GET /api/admin/dispatch/active monitor payload
  * GET /api/admin/dispatch/log/{job_id}
  * GET /api/customer/dispatch/{job_id} enrichment
  * Persistent queue: unclaimed jobs never disappear
  * ASAP Transport + Recovery E2E within-radius flow
  * Cancel removes from active queue
  * Non-admin blocked from admin endpoints; anonymous blocked from customer state

Strategy:
  - Bypass Stripe by direct Mongo writes to set booking.payment_status=paid and
    job.status=confirmed + job.dispatch_ready_at=NOW (identical effect to
    _finalise_paid_deposit).
  - Time-shift dispatch_ready_at into the past via Mongo to exercise each
    radius band without waiting IRL.
  - Bearer-token auth throughout (CSRF middleware bypasses Authorization: Bearer).
"""
from __future__ import annotations

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
ADMIN_EMAIL = "admin@cargoone.com"
ADMIN_PASSWORD = os.environ.get("TEST_ADMIN_PASSWORD", "Vc9O0sNDGR6SfzKDaa0L1lhp")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _mongo():
    c = pymongo.MongoClient(MONGO_URL)
    return c, c[DB_NAME]


def _bearer(tok):
    return {"Authorization": f"Bearer {tok}"}


def _u(tag):
    return f"TEST_qar6_{tag}_{uuid.uuid4().hex[:8]}@example.com"


def _register(role="customer", tag=""):
    email = _u(tag or role)
    r = requests.post(f"{API}/auth/register", json={
        "email": email, "password": "PasswordTest12345!",
        "name": f"QAR6 {role}", "role": role, "phone": "+447700900000",
    }, timeout=20)
    assert r.status_code == 200, r.text
    body = r.json()
    body["email"] = email
    return body


def _activate_driver(driver_id: str):
    c, db = _mongo()
    db.users.update_one({"id": driver_id}, {"$set": {"status": "active"}})
    c.close()


def _admin_token():
    r = requests.post(f"{API}/auth/login", json={
        "email": ADMIN_EMAIL, "password": ADMIN_PASSWORD,
    }, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _create_asap_job(cust_token: str, *, service_type="transport",
                       category="parcels", pickup=(51.51, -0.10),
                       dropoff=(51.55, -0.08), title="QAR6-ASAP"):
    p_lat, p_lng = pickup
    d_lat, d_lng = dropoff
    now = datetime.now(timezone.utc)
    payload = {
        "title": title, "description": "qar6",
        "category": category,
        "pickup_address": "Pickup", "pickup_town": "London",
        "pickup_lat": p_lat, "pickup_lng": p_lng,
        "dropoff_address": "Drop", "dropoff_town": "London",
        "dropoff_lat": d_lat, "dropoff_lng": d_lng,
        "weight_kg": 5,
        "collection_date": (now + timedelta(hours=1)).isoformat(),
        "delivery_date": (now + timedelta(hours=3)).isoformat(),
        "pricing_type": "fixed",
        "fixed_price": 250,
        "service_timing": "asap",
        "service_type": service_type,
    }
    r = requests.post(f"{API}/jobs", json=payload,
                       headers=_bearer(cust_token), timeout=20)
    assert r.status_code == 200, r.text
    return r.json()


def _mark_dispatch_ready(job_id: str, seconds_ago: int = 0):
    """Simulate paid deposit + optionally time-shift dispatch_ready_at."""
    c, db = _mongo()
    ready = datetime.now(timezone.utc) - timedelta(seconds=seconds_ago)
    db.jobs.update_one({"id": job_id}, {"$set": {
        "status": "confirmed",
        "dispatch_ready_at": ready.isoformat(),
    }})
    c.close()


def _driver_go_online(driver_token: str, lat: float, lng: float):
    r = requests.post(f"{API}/driver/live/online", json={
        "lat": lat, "lng": lng, "accuracy_m": 5,
    }, headers=_bearer(driver_token), timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


def _poll_offers(driver_token: str, radius_miles: float = 500):
    r = requests.get(f"{API}/driver/live/offers",
                       params={"radius_miles": radius_miles},
                       headers=_bearer(driver_token), timeout=20)
    assert r.status_code == 200, r.text
    return r.json()


# ---------------------------------------------------------------------------
# 1. Radius ladder helper (via customer_dispatch_state — exercises _current_search_radius_miles)
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("seconds_ago,expected", [
    (0, 10.0),
    (30, 20.0),
    (90, 40.0),
    (180, 75.0),
    (300, 500.0),
    (900, 500.0),
])
def test_radius_ladder_bands(seconds_ago, expected):
    cust = _register("customer", "ladder")
    job = _create_asap_job(cust["access_token"], title=f"QAR6-LADDER-{seconds_ago}")
    _mark_dispatch_ready(job["id"], seconds_ago=seconds_ago)
    r = requests.get(f"{API}/customer/dispatch/{job['id']}",
                       headers=_bearer(cust["access_token"]), timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["current_search_radius_miles"] == expected, (
        f"age={seconds_ago}s got {body['current_search_radius_miles']} expected {expected}"
    )
    # waiting_seconds populated & increasing with age
    if seconds_ago > 0:
        assert body["waiting_seconds"] >= seconds_ago - 2


def test_radius_ladder_no_dispatch_ready_defaults_to_first_band():
    """A job with no dispatch_ready_at should get the tightest band (10 mi)."""
    cust = _register("customer", "nord")
    job = _create_asap_job(cust["access_token"], title="QAR6-NO-READY")
    # Do NOT mark dispatch ready
    r = requests.get(f"{API}/customer/dispatch/{job['id']}",
                       headers=_bearer(cust["access_token"]), timeout=15)
    assert r.status_code == 200
    assert r.json()["current_search_radius_miles"] == 10.0


# ---------------------------------------------------------------------------
# 2. dispatch_log rows are written for candidate outcomes
# ---------------------------------------------------------------------------

def _count_dispatch_log(job_id: str, outcome: str = None):
    c, db = _mongo()
    q = {"job_id": job_id}
    if outcome:
        q["outcome"] = outcome
    n = db.dispatch_log.count_documents(q)
    c.close()
    return n


def test_dispatch_log_offline_reason_written():
    drv = _register("driver", "offlog")
    _activate_driver(drv["user"]["id"])
    # Driver has never gone online → live_online=false → outcome=offline
    r = _poll_offers(drv["access_token"])
    assert r["offers"] == []
    assert r["reason"] == "offline"
    c, db = _mongo()
    n = db.dispatch_log.count_documents(
        {"driver_id": drv["user"]["id"], "outcome": "offline"}
    )
    c.close()
    assert n >= 1, "no 'offline' row logged"


def test_dispatch_log_offered_and_out_of_radius():
    cust = _register("customer", "logcust")
    drv = _register("driver", "logdrv")
    _activate_driver(drv["user"]["id"])
    # Driver in London
    _driver_go_online(drv["access_token"], 51.51, -0.10)

    # Case A: fresh ASAP + driver 100mi away → out_of_radius
    job_far = _create_asap_job(cust["access_token"],
                                  pickup=(53.48, -2.24),  # Manchester
                                  dropoff=(53.50, -2.20),
                                  title="QAR6-LOG-FAR")
    _mark_dispatch_ready(job_far["id"], seconds_ago=0)

    r = _poll_offers(drv["access_token"])
    far_ids = [o["job_id"] for o in r["offers"]]
    assert job_far["id"] not in far_ids
    assert _count_dispatch_log(job_far["id"], "out_of_radius") >= 1

    # Case B: nearby job → offered
    job_near = _create_asap_job(cust["access_token"],
                                   pickup=(51.50, -0.11),
                                   dropoff=(51.55, -0.08),
                                   title="QAR6-LOG-NEAR")
    _mark_dispatch_ready(job_near["id"], seconds_ago=0)
    r = _poll_offers(drv["access_token"])
    ids = [o["job_id"] for o in r["offers"]]
    assert job_near["id"] in ids, f"expected offered; offers={r}"
    assert _count_dispatch_log(job_near["id"], "offered") >= 1
    # Offer payload contains required enrichment
    offer = next(o for o in r["offers"] if o["job_id"] == job_near["id"])
    assert "current_search_radius_miles" in offer
    assert "waiting_seconds" in offer
    assert "photos" in offer
    assert isinstance(offer["photos"], list)


def test_dispatch_log_busy_when_driver_has_active_asap():
    """If driver has an accepted ASAP job, /offers returns busy + logs busy row."""
    cust = _register("customer", "busycust")
    drv = _register("driver", "busydrv")
    _activate_driver(drv["user"]["id"])
    _driver_go_online(drv["access_token"], 51.51, -0.10)

    j = _create_asap_job(cust["access_token"], title="QAR6-BUSY",
                           pickup=(51.51, -0.10), dropoff=(51.55, -0.08))
    _mark_dispatch_ready(j["id"], seconds_ago=0)

    # Claim so driver becomes busy
    claim = requests.post(f"{API}/jobs/{j['id']}/claim",
                            headers=_bearer(drv["access_token"]), timeout=15)
    assert claim.status_code == 200, claim.text

    r = _poll_offers(drv["access_token"])
    assert r.get("reason") == "busy_on_asap"
    c, db = _mongo()
    assert db.dispatch_log.count_documents({
        "driver_id": drv["user"]["id"], "outcome": "busy"
    }) >= 1
    c.close()


# ---------------------------------------------------------------------------
# 3. Escalation E2E — driver far away eventually receives after 310s time-shift
# ---------------------------------------------------------------------------

def test_e2e_driver_outside_radius_becomes_eligible_after_escalation():
    cust = _register("customer", "escalcust")
    drv = _register("driver", "escaldrv")
    _activate_driver(drv["user"]["id"])
    # Driver in Manchester (~163 mi from London pickup)
    _driver_go_online(drv["access_token"], 53.48, -2.24)

    job = _create_asap_job(cust["access_token"], title="QAR6-ESCAL",
                             pickup=(51.51, -0.10), dropoff=(51.55, -0.08))
    _mark_dispatch_ready(job["id"], seconds_ago=0)

    r = _poll_offers(drv["access_token"])
    assert job["id"] not in [o["job_id"] for o in r["offers"]], (
        "Manchester driver should NOT see London job at radius=10mi"
    )

    # Time-shift dispatch_ready_at back 310s -> band 500mi (nationwide)
    _mark_dispatch_ready(job["id"], seconds_ago=310)
    r2 = _poll_offers(drv["access_token"])
    ids = [o["job_id"] for o in r2["offers"]]
    assert job["id"] in ids, (
        f"expected escalated offer for Manchester driver; got {r2}"
    )
    offer = next(o for o in r2["offers"] if o["job_id"] == job["id"])
    assert offer["current_search_radius_miles"] == 500.0


def test_driver_own_radius_cap_narrows_inbox():
    """Driver-supplied ?radius_miles=X still caps their own inbox."""
    cust = _register("customer", "capcust")
    drv = _register("driver", "capdrv")
    _activate_driver(drv["user"]["id"])
    _driver_go_online(drv["access_token"], 53.48, -2.24)  # Manchester

    job = _create_asap_job(cust["access_token"], title="QAR6-CAP",
                             pickup=(51.51, -0.10), dropoff=(51.55, -0.08))
    _mark_dispatch_ready(job["id"], seconds_ago=310)  # server radius=500

    r = _poll_offers(drv["access_token"], radius_miles=25)
    assert job["id"] not in [o["job_id"] for o in r["offers"]], (
        "driver_cap=25 must hide job that's 160+ mi away"
    )


# ---------------------------------------------------------------------------
# 4. Admin dispatch monitor endpoints
# ---------------------------------------------------------------------------

def test_admin_dispatch_active_shape_and_auth():
    admin_tok = _admin_token()
    # Create a job to make sure there's at least one item (idempotent enough)
    cust = _register("customer", "adminmon")
    job = _create_asap_job(cust["access_token"], title="QAR6-MONITOR",
                             pickup=(51.51, -0.10), dropoff=(51.55, -0.08))
    _mark_dispatch_ready(job["id"], seconds_ago=60)

    r = requests.get(f"{API}/admin/dispatch/active",
                       headers=_bearer(admin_tok), timeout=20)
    assert r.status_code == 200, r.text
    body = r.json()
    for k in ("active_count", "recently_claimed_count", "generated_at",
               "radius_ladder", "heartbeat_freshness_seconds", "items"):
        assert k in body, f"missing key {k}"
    assert body["heartbeat_freshness_seconds"] == 90
    assert isinstance(body["radius_ladder"], list) and len(body["radius_ladder"]) == 5
    # Our job should be there
    ours = [i for i in body["items"] if i["job_id"] == job["id"]]
    assert ours, "created job not in active list"
    it = ours[0]
    for k in ("waiting_seconds", "current_search_radius_miles",
               "attempt_counts", "drivers_notified_count",
               "offers_pending", "offers_declined", "queue_state"):
        assert k in it, f"item missing {k}"
    assert it["queue_state"] == "open"

    # Non-admin blocked (403)
    cust_tok = cust["access_token"]
    r2 = requests.get(f"{API}/admin/dispatch/active",
                        headers=_bearer(cust_tok), timeout=15)
    assert r2.status_code == 403, r2.status_code


def test_admin_dispatch_log_endpoint():
    admin_tok = _admin_token()
    cust = _register("customer", "logadmin")
    drv = _register("driver", "logadmdrv")
    _activate_driver(drv["user"]["id"])
    _driver_go_online(drv["access_token"], 51.51, -0.10)

    job = _create_asap_job(cust["access_token"], title="QAR6-ADMLOG",
                             pickup=(51.51, -0.10), dropoff=(51.55, -0.08))
    _mark_dispatch_ready(job["id"], seconds_ago=0)
    _poll_offers(drv["access_token"])  # generate an 'offered' row

    r = requests.get(f"{API}/admin/dispatch/log/{job['id']}",
                       headers=_bearer(admin_tok), timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["job_id"] == job["id"]
    assert isinstance(body["rows"], list)
    assert len(body["rows"]) >= 1
    row = body["rows"][0]
    for k in ("ts", "outcome", "driver_id", "distance_miles",
               "radius_used", "reason"):
        assert k in row, f"row missing {k}"

    # Non-admin gets 403
    r2 = requests.get(f"{API}/admin/dispatch/log/{job['id']}",
                        headers=_bearer(cust["access_token"]), timeout=15)
    assert r2.status_code == 403


# ---------------------------------------------------------------------------
# 5. Customer dispatch state + auth guard
# ---------------------------------------------------------------------------

def test_customer_dispatch_state_enrichment():
    cust = _register("customer", "custst")
    job = _create_asap_job(cust["access_token"], title="QAR6-CUST-STATE")
    _mark_dispatch_ready(job["id"], seconds_ago=45)
    r = requests.get(f"{API}/customer/dispatch/{job['id']}",
                       headers=_bearer(cust["access_token"]), timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["waiting_seconds"] >= 43
    assert body["current_search_radius_miles"] == 20.0  # band B (30-90)
    assert body["next_radius_expansion_at"] is not None
    assert "drivers_notified_count" in body


def test_customer_dispatch_state_anonymous_blocked():
    r = requests.get(f"{API}/customer/dispatch/does-not-matter", timeout=10)
    assert r.status_code in (401, 403), r.status_code


# ---------------------------------------------------------------------------
# 6. Persistent queue — job never removed from active_count while unclaimed
# ---------------------------------------------------------------------------

def test_persistent_queue_no_removal_at_nationwide_band():
    """Simulate 10 minutes with no drivers -> job STILL listed at radius=500."""
    admin_tok = _admin_token()
    cust = _register("customer", "persist")
    job = _create_asap_job(cust["access_token"], title="QAR6-PERSIST",
                             pickup=(51.51, -0.10), dropoff=(51.55, -0.08))
    _mark_dispatch_ready(job["id"], seconds_ago=600)  # 10 min ago

    r = requests.get(f"{API}/admin/dispatch/active",
                       headers=_bearer(admin_tok), timeout=20)
    assert r.status_code == 200
    body = r.json()
    ours = [i for i in body["items"] if i["job_id"] == job["id"]]
    assert ours, "10-min-old unclaimed job disappeared from queue"
    assert ours[0]["current_search_radius_miles"] == 500.0
    assert ours[0]["queue_state"] == "open"


# ---------------------------------------------------------------------------
# 7. Cancel removes from queue
# ---------------------------------------------------------------------------

def test_cancel_removes_job_from_active_queue():
    admin_tok = _admin_token()
    cust = _register("customer", "cancq")
    job = _create_asap_job(cust["access_token"], title="QAR6-CANCEL",
                             pickup=(51.51, -0.10), dropoff=(51.55, -0.08))
    _mark_dispatch_ready(job["id"], seconds_ago=10)

    r = requests.get(f"{API}/admin/dispatch/active",
                       headers=_bearer(admin_tok), timeout=15)
    assert any(i["job_id"] == job["id"] for i in r.json()["items"])

    # Set cancelled_at via Mongo (simulate cancel flow)
    c, db = _mongo()
    db.jobs.update_one({"id": job["id"]}, {"$set": {
        "cancelled_at": datetime.now(timezone.utc).isoformat(),
        "status": "cancelled",
    }})
    c.close()

    r2 = requests.get(f"{API}/admin/dispatch/active",
                        headers=_bearer(admin_tok), timeout=15)
    ours = [i for i in r2.json()["items"] if i["job_id"] == job["id"]
              and i["queue_state"] == "open"]
    assert not ours, "cancelled job still listed as open"


# ---------------------------------------------------------------------------
# 8. E2E — Transport ASAP within radius: driver claims -> queue transitions
# ---------------------------------------------------------------------------

def test_e2e_transport_asap_claim_flow():
    admin_tok = _admin_token()
    cust = _register("customer", "e2etra")
    drv = _register("driver", "e2etrad")
    _activate_driver(drv["user"]["id"])
    _driver_go_online(drv["access_token"], 51.50, -0.11)

    job = _create_asap_job(cust["access_token"], title="QAR6-E2E-TRANSPORT",
                             service_type="transport",
                             pickup=(51.51, -0.10), dropoff=(51.55, -0.08))
    _mark_dispatch_ready(job["id"], seconds_ago=0)

    offers = _poll_offers(drv["access_token"])
    assert job["id"] in [o["job_id"] for o in offers["offers"]]

    claim = requests.post(f"{API}/jobs/{job['id']}/claim",
                            headers=_bearer(drv["access_token"]), timeout=15)
    assert claim.status_code == 200, claim.text
    assert claim.json().get("ok") is True

    # Monitor: job should no longer be in the OPEN list, but appear in claimed
    r = requests.get(f"{API}/admin/dispatch/active",
                       headers=_bearer(admin_tok), timeout=15)
    items = r.json()["items"]
    open_ours = [i for i in items if i["job_id"] == job["id"] and i["queue_state"] == "open"]
    claimed_ours = [i for i in items if i["job_id"] == job["id"] and i["queue_state"] == "claimed"]
    assert not open_ours, "job still open after claim"
    assert claimed_ours, "job missing from claimed section"
    assert claimed_ours[0]["accepted_by"] is not None
    assert claimed_ours[0]["accepted_by"]["id"] == drv["user"]["id"]


# ---------------------------------------------------------------------------
# 9. E2E — Recovery ASAP within radius (driver needs capability)
# ---------------------------------------------------------------------------

def test_e2e_recovery_asap_requires_capability_and_dispatches():
    cust = _register("customer", "recovcust")
    drv = _register("driver", "recovdrv")
    _activate_driver(drv["user"]["id"])
    # Give driver recovery capability so capability check passes.
    c, db = _mongo()
    db.users.update_one({"id": drv["user"]["id"]},
                          {"$set": {"capabilities": {"recovery": True},
                                     "service_types": ["breakdown_recovery",
                                                        "transport"]}})
    c.close()
    _driver_go_online(drv["access_token"], 51.50, -0.11)

    job = _create_asap_job(cust["access_token"], title="QAR6-E2E-RECOVERY",
                             service_type="breakdown_recovery",
                             category="breakdown_recovery",
                             pickup=(51.51, -0.10), dropoff=(51.55, -0.08))
    _mark_dispatch_ready(job["id"], seconds_ago=0)

    offers = _poll_offers(drv["access_token"])
    assert job["id"] in [o["job_id"] for o in offers["offers"]], (
        f"recovery driver did not receive recovery offer: {offers}"
    )
    offer = next(o for o in offers["offers"] if o["job_id"] == job["id"])
    assert offer["service_type"] == "breakdown_recovery"


def test_recovery_driver_without_capability_excluded():
    cust = _register("customer", "recovnocap")
    drv = _register("driver", "recovnocapdrv")
    _activate_driver(drv["user"]["id"])
    # Explicitly configure driver with capability info that excludes recovery.
    c, db = _mongo()
    db.users.update_one({"id": drv["user"]["id"]},
                          {"$set": {"capabilities": {"recovery": False},
                                     "service_types": ["transport"]}})
    c.close()
    _driver_go_online(drv["access_token"], 51.50, -0.11)

    job = _create_asap_job(cust["access_token"], title="QAR6-RECOV-EXCL",
                             service_type="breakdown_recovery",
                             category="breakdown_recovery",
                             pickup=(51.51, -0.10), dropoff=(51.55, -0.08))
    _mark_dispatch_ready(job["id"], seconds_ago=0)
    offers = _poll_offers(drv["access_token"])
    assert job["id"] not in [o["job_id"] for o in offers["offers"]]
    # dispatch_log should record not_capable
    c, db = _mongo()
    n = db.dispatch_log.count_documents({
        "job_id": job["id"], "driver_id": drv["user"]["id"],
        "outcome": "not_capable",
    })
    c.close()
    assert n >= 1


# ---------------------------------------------------------------------------
# 10. Multiple drivers — one near, one far — near wins immediately
# ---------------------------------------------------------------------------

def test_multi_driver_near_wins_far_only_after_escalation():
    cust = _register("customer", "multicust")
    near = _register("driver", "multinear")
    far = _register("driver", "multifar")
    _activate_driver(near["user"]["id"])
    _activate_driver(far["user"]["id"])
    _driver_go_online(near["access_token"], 51.50, -0.11)
    _driver_go_online(far["access_token"], 53.48, -2.24)

    job = _create_asap_job(cust["access_token"], title="QAR6-MULTI",
                             pickup=(51.51, -0.10), dropoff=(51.55, -0.08))
    _mark_dispatch_ready(job["id"], seconds_ago=0)

    r_near = _poll_offers(near["access_token"])
    r_far = _poll_offers(far["access_token"])
    near_ids = [o["job_id"] for o in r_near["offers"]]
    far_ids = [o["job_id"] for o in r_far["offers"]]
    assert job["id"] in near_ids, "near driver missed nearby ASAP"
    assert job["id"] not in far_ids, "far driver should NOT see it at 10mi"

    # Escalate
    _mark_dispatch_ready(job["id"], seconds_ago=310)
    r_far2 = _poll_offers(far["access_token"])
    assert job["id"] in [o["job_id"] for o in r_far2["offers"]]


# ---------------------------------------------------------------------------
# Cleanup best-effort
# ---------------------------------------------------------------------------

def test_zzz_cleanup():
    c, db = _mongo()
    # Find TEST_qar6 users and their ids
    users = list(db.users.find({"email": {"$regex": "^TEST_qar6_"}}, {"id": 1}))
    ids = [u["id"] for u in users]
    if ids:
        db.jobs.delete_many({"$or": [
            {"customer_id": {"$in": ids}},
            {"assigned_driver_id": {"$in": ids}},
        ]})
        db.dispatch_log.delete_many({"driver_id": {"$in": ids}})
        db.users.delete_many({"id": {"$in": ids}})
    c.close()
