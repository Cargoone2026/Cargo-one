"""End-to-end backend tests for Cargo One logistics API."""
import time
import uuid
import pytest


def _uniq_email(prefix):
    return f"test_{prefix}_{uuid.uuid4().hex[:10]}@example.com"


# ---- Shared state ----
STATE = {}


# =============================================================================
# Health
# =============================================================================
class TestHealth:
    def test_root(self, api, base_url):
        r = api.get(f"{base_url}/api/")
        assert r.status_code == 200
        d = r.json()
        assert d["app"] == "Cargo One" and d["status"] == "ok"


# =============================================================================
# Auth
# =============================================================================
class TestAuth:
    def test_register_customer(self, api, base_url):
        email = _uniq_email("cust")
        r = api.post(f"{base_url}/api/auth/register", json={
            "email": email, "password": "Passw0rd!", "name": "Test Customer",
            "role": "customer", "phone": "+441111111111",
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["token_type"] == "bearer" and d["access_token"]
        assert d["user"]["role"] == "customer"
        assert d["user"]["status"] == "active"
        STATE["customer"] = {"email": email, "token": d["access_token"], "user": d["user"]}

    def test_register_driver_pending(self, api, base_url):
        email = _uniq_email("drv")
        r = api.post(f"{base_url}/api/auth/register", json={
            "email": email, "password": "Passw0rd!", "name": "Test Driver",
            "role": "driver", "phone": "+442222222222",
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["user"]["role"] == "driver"
        assert d["user"]["status"] == "pending"
        STATE["driver"] = {"email": email, "token": d["access_token"], "user": d["user"]}

    def test_register_duplicate_email(self, api, base_url):
        r = api.post(f"{base_url}/api/auth/register", json={
            "email": STATE["customer"]["email"], "password": "x", "name": "dup",
            "role": "customer",
        })
        assert r.status_code == 400

    def test_login_admin_seeded(self, api, base_url):
        r = api.post(f"{base_url}/api/auth/login", json={
            "email": "admin@cargoone.com", "password": "admin123",
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["user"]["role"] == "admin"
        STATE["admin"] = {"token": d["access_token"], "user": d["user"]}

    def test_login_invalid(self, api, base_url):
        r = api.post(f"{base_url}/api/auth/login", json={
            "email": "admin@cargoone.com", "password": "wrong",
        })
        assert r.status_code == 401

    def test_me_returns_current_user(self, api, base_url):
        h = {"Authorization": f"Bearer {STATE['customer']['token']}"}
        r = api.get(f"{base_url}/api/auth/me", headers=h)
        assert r.status_code == 200
        assert r.json()["email"] == STATE["customer"]["email"]

    def test_me_no_token(self, api, base_url):
        r = api.get(f"{base_url}/api/auth/me")
        assert r.status_code == 401


# =============================================================================
# Admin driver approval (needed for driver flow)
# =============================================================================
class TestAdminApprove:
    def test_admin_stats_requires_admin(self, api, base_url):
        r = api.get(f"{base_url}/api/admin/stats",
                    headers={"Authorization": f"Bearer {STATE['customer']['token']}"})
        assert r.status_code == 403

    def test_admin_stats_ok(self, api, base_url):
        r = api.get(f"{base_url}/api/admin/stats",
                    headers={"Authorization": f"Bearer {STATE['admin']['token']}"})
        assert r.status_code == 200
        d = r.json()
        for k in ["customers", "drivers", "pending_drivers", "total_jobs",
                  "active_jobs", "total_bookings", "paid_bookings", "revenue_gbp"]:
            assert k in d

    def test_admin_list_drivers(self, api, base_url):
        r = api.get(f"{base_url}/api/admin/users?role=driver",
                    headers={"Authorization": f"Bearer {STATE['admin']['token']}"})
        assert r.status_code == 200
        drivers = r.json()
        assert any(u["id"] == STATE["driver"]["user"]["id"] for u in drivers)

    def test_admin_approve_driver(self, api, base_url):
        drv_id = STATE["driver"]["user"]["id"]
        r = api.post(f"{base_url}/api/admin/users/{drv_id}/approve",
                     headers={"Authorization": f"Bearer {STATE['admin']['token']}"})
        assert r.status_code == 200
        # verify status via me (need new login to refresh doc)
        r2 = api.post(f"{base_url}/api/auth/login", json={
            "email": STATE["driver"]["email"], "password": "Passw0rd!",
        })
        assert r2.status_code == 200
        assert r2.json()["user"]["status"] == "active"
        STATE["driver"]["token"] = r2.json()["access_token"]


# =============================================================================
# Jobs (customer create, driver browse, accept fixed, bids flow)
# =============================================================================
class TestJobs:
    def test_customer_creates_fixed_job(self, api, base_url):
        h = {"Authorization": f"Bearer {STATE['customer']['token']}"}
        payload = {
            "title": "TEST Sofa move", "category": "furniture",
            "description": "3-seater sofa", "photos": [],
            "pickup_address": "10 Downing St, London", "pickup_town": "London",
            "pickup_lat": 51.5034, "pickup_lng": -0.1276,
            "dropoff_address": "1 Church Rd, Brighton", "dropoff_town": "Brighton",
            "dropoff_lat": 50.8225, "dropoff_lng": -0.1372,
            "collection_date": "2026-02-01", "delivery_date": "2026-02-02",
            "pricing_type": "fixed", "fixed_price": 180.0,
        }
        r = api.post(f"{base_url}/api/jobs", json=payload, headers=h)
        assert r.status_code == 200, r.text
        job = r.json()
        assert job["status"] == "posted"
        assert job["distance_miles"] > 40
        assert job["suggested_price"] > 0
        assert job["customer_id"] == STATE["customer"]["user"]["id"]
        assert "pickup_address" in job  # owner sees private
        STATE["job_fixed"] = job

    def test_customer_creates_bidding_job(self, api, base_url):
        h = {"Authorization": f"Bearer {STATE['customer']['token']}"}
        payload = {
            "title": "TEST Piano move", "category": "furniture",
            "description": "Grand piano", "pickup_address": "5 Baker St",
            "pickup_town": "London", "pickup_lat": 51.5237, "pickup_lng": -0.1585,
            "dropoff_address": "22 Kings Rd", "dropoff_town": "London",
            "dropoff_lat": 51.4875, "dropoff_lng": -0.1687,
            "collection_date": "2026-02-05", "delivery_date": "2026-02-05",
            "pricing_type": "bidding", "max_budget": 400.0,
        }
        r = api.post(f"{base_url}/api/jobs", json=payload, headers=h)
        assert r.status_code == 200
        STATE["job_bid"] = r.json()

    def test_jobs_mine(self, api, base_url):
        h = {"Authorization": f"Bearer {STATE['customer']['token']}"}
        r = api.get(f"{base_url}/api/jobs/mine", headers=h)
        assert r.status_code == 200
        jobs = r.json()
        ids = [j["id"] for j in jobs]
        assert STATE["job_fixed"]["id"] in ids
        assert STATE["job_bid"]["id"] in ids

    def test_jobs_nearby_driver_privacy(self, api, base_url):
        h = {"Authorization": f"Bearer {STATE['driver']['token']}"}
        # Search near London
        r = api.get(f"{base_url}/api/jobs/nearby?lat=51.5074&lng=-0.1278&radius=100",
                    headers=h)
        assert r.status_code == 200, r.text
        results = r.json()
        assert len(results) >= 2
        # Sort ascending by distance
        distances = [j["distance_from_driver"] for j in results]
        assert distances == sorted(distances)
        # Privacy: pickup_address & dropoff_address MUST NOT be present
        for j in results:
            assert "pickup_address" not in j, f"Leaked pickup_address in nearby: {j}"
            assert "dropoff_address" not in j, f"Leaked dropoff_address in nearby: {j}"
            # Towns are OK
            assert "pickup_town" in j

    def test_jobs_nearby_forbidden_for_customer(self, api, base_url):
        h = {"Authorization": f"Bearer {STATE['customer']['token']}"}
        r = api.get(f"{base_url}/api/jobs/nearby", headers=h)
        assert r.status_code == 403

    def test_driver_accepts_fixed(self, api, base_url):
        h = {"Authorization": f"Bearer {STATE['driver']['token']}"}
        jid = STATE["job_fixed"]["id"]
        r = api.post(f"{base_url}/api/jobs/{jid}/accept", headers=h)
        assert r.status_code == 200, r.text
        # verify status via GET
        r2 = api.get(f"{base_url}/api/jobs/{jid}",
                     headers={"Authorization": f"Bearer {STATE['customer']['token']}"})
        assert r2.status_code == 200
        job = r2.json()
        assert job["status"] == "accepted"
        assert job["assigned_driver_id"] == STATE["driver"]["user"]["id"]
        assert job["accepted_price"] == 180.0

    def test_driver_cannot_accept_bidding_job(self, api, base_url):
        h = {"Authorization": f"Bearer {STATE['driver']['token']}"}
        r = api.post(f"{base_url}/api/jobs/{STATE['job_bid']['id']}/accept", headers=h)
        assert r.status_code == 400


# =============================================================================
# Bids flow
# =============================================================================
class TestBids:
    def test_submit_bid(self, api, base_url):
        h = {"Authorization": f"Bearer {STATE['driver']['token']}"}
        r = api.post(f"{base_url}/api/jobs/{STATE['job_bid']['id']}/bids",
                     json={"amount": 250.0, "message": "Can do", "eta_hours": 3},
                     headers=h)
        assert r.status_code == 200, r.text
        bid = r.json()
        assert bid["amount"] == 250.0
        assert bid["status"] == "pending"
        STATE["bid"] = bid

    def test_list_bids_as_customer(self, api, base_url):
        h = {"Authorization": f"Bearer {STATE['customer']['token']}"}
        r = api.get(f"{base_url}/api/jobs/{STATE['job_bid']['id']}/bids", headers=h)
        assert r.status_code == 200
        assert any(b["id"] == STATE["bid"]["id"] for b in r.json())

    def test_accept_bid(self, api, base_url):
        h = {"Authorization": f"Bearer {STATE['customer']['token']}"}
        r = api.post(f"{base_url}/api/bids/{STATE['bid']['id']}/accept", headers=h)
        assert r.status_code == 200
        # Verify job assignment
        r2 = api.get(f"{base_url}/api/jobs/{STATE['job_bid']['id']}", headers=h)
        job = r2.json()
        assert job["status"] == "accepted"
        assert job["assigned_driver_id"] == STATE["driver"]["user"]["id"]
        assert job["accepted_price"] == 250.0


# =============================================================================
# Bookings + Payments + Privacy
# =============================================================================
class TestBookings:
    def test_create_booking(self, api, base_url):
        h = {"Authorization": f"Bearer {STATE['customer']['token']}"}
        r = api.post(f"{base_url}/api/bookings",
                     json={"job_id": STATE["job_fixed"]["id"]}, headers=h)
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["total_price"] == 180.0
        assert b["deposit_amount"] == 18.0
        assert b["balance_due"] == 162.0
        assert b["payment_status"] == "pending"
        STATE["booking"] = b

    def test_create_booking_idempotent(self, api, base_url):
        h = {"Authorization": f"Bearer {STATE['customer']['token']}"}
        r = api.post(f"{base_url}/api/bookings",
                     json={"job_id": STATE["job_fixed"]["id"]}, headers=h)
        assert r.status_code == 200
        assert r.json()["id"] == STATE["booking"]["id"]

    def test_deposit_session_creation(self, api, base_url):
        h = {"Authorization": f"Bearer {STATE['customer']['token']}"}
        r = api.post(
            f"{base_url}/api/bookings/{STATE['booking']['id']}/deposit",
            json={"origin_url": base_url}, headers=h,
        )
        # Accept both success and specific failures based on Stripe availability
        if r.status_code != 200:
            pytest.skip(f"Stripe checkout unavailable: {r.status_code} {r.text[:200]}")
        d = r.json()
        assert d["session_id"] and d["url"]
        assert d["url"].startswith("http")
        STATE["session_id"] = d["session_id"]

    def test_payment_status_unpaid(self, api, base_url):
        if not STATE.get("session_id"):
            pytest.skip("No session_id from previous step")
        h = {"Authorization": f"Bearer {STATE['customer']['token']}"}
        r = api.get(f"{base_url}/api/payments/status/{STATE['session_id']}",
                    headers=h)
        # Status should be 200 with pending/unpaid status (not paid without checkout)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "payment_status" in d
        assert d["payment_status"] != "paid"

    def test_payment_status_bad_session(self, api, base_url):
        h = {"Authorization": f"Bearer {STATE['customer']['token']}"}
        r = api.get(f"{base_url}/api/payments/status/nonexistent_session_id",
                    headers=h)
        assert r.status_code == 404

    def test_bookings_mine_privacy(self, api, base_url):
        h = {"Authorization": f"Bearer {STATE['customer']['token']}"}
        r = api.get(f"{base_url}/api/bookings/mine", headers=h)
        assert r.status_code == 200
        bookings = r.json()
        me_b = next((b for b in bookings if b["id"] == STATE["booking"]["id"]), None)
        assert me_b is not None
        # Not paid yet: other_party should be hidden, job.pickup_address hidden
        assert me_b.get("payment_status") == "pending"
        if me_b.get("job"):
            assert "pickup_address" not in me_b["job"]
            assert "dropoff_address" not in me_b["job"]
        assert "other_party" not in me_b or me_b["other_party"] is None

    def test_messages_blocked_before_payment(self, api, base_url):
        h = {"Authorization": f"Bearer {STATE['customer']['token']}"}
        r = api.post(f"{base_url}/api/bookings/{STATE['booking']['id']}/messages",
                     json={"text": "hi"}, headers=h)
        assert r.status_code == 403
        r2 = api.get(f"{base_url}/api/bookings/{STATE['booking']['id']}/messages",
                     headers=h)
        assert r2.status_code == 200
        assert r2.json() == []


# =============================================================================
# Payment simulation via direct DB update (bypass Stripe) -> unlock features
# =============================================================================
class TestPostPaymentFeatures:
    """Simulate paid deposit to test contact reveal, chat, tracking, POD, review."""

    @pytest.fixture(autouse=True)
    def _force_paid(self, base_url):
        # Directly mark booking as paid in mongo to test post-payment flows.
        # Only set payment_status; don't clobber booking.status once flow advances.
        import pymongo, os
        client = pymongo.MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
        db = client[os.environ.get("DB_NAME", "cargoone_db")]
        existing = db.bookings.find_one({"id": STATE["booking"]["id"]})
        update = {"payment_status": "paid", "paid_at": "2026-01-15T00:00:00Z"}
        if existing and existing.get("status") in (None, "accepted", "pending"):
            update["status"] = "deposit_paid"
        db.bookings.update_one({"id": STATE["booking"]["id"]}, {"$set": update})
        client.close()

    def test_booking_privacy_after_payment(self, api, base_url):
        h = {"Authorization": f"Bearer {STATE['customer']['token']}"}
        r = api.get(f"{base_url}/api/bookings/{STATE['booking']['id']}", headers=h)
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["payment_status"] == "paid"
        assert b["job"]["pickup_address"]  # revealed
        assert b["job"]["dropoff_address"]
        assert b["other_party"]["role"] == "driver"

    def test_send_message_after_payment(self, api, base_url):
        h = {"Authorization": f"Bearer {STATE['customer']['token']}"}
        r = api.post(f"{base_url}/api/bookings/{STATE['booking']['id']}/messages",
                     json={"text": "Hello driver"}, headers=h)
        assert r.status_code == 200, r.text
        msg = r.json()
        assert msg["text"] == "Hello driver"

        r2 = api.get(f"{base_url}/api/bookings/{STATE['booking']['id']}/messages",
                     headers=h)
        assert r2.status_code == 200
        assert len(r2.json()) >= 1

    def test_tracking_update_and_get(self, api, base_url):
        dh = {"Authorization": f"Bearer {STATE['driver']['token']}"}
        ch = {"Authorization": f"Bearer {STATE['customer']['token']}"}
        r = api.post(f"{base_url}/api/tracking/{STATE['booking']['id']}",
                     json={"lat": 51.5, "lng": -0.13}, headers=dh)
        assert r.status_code == 200
        r2 = api.post(f"{base_url}/api/tracking/{STATE['booking']['id']}",
                      json={"lat": 51.4, "lng": -0.14}, headers=dh)
        assert r2.status_code == 200
        r3 = api.get(f"{base_url}/api/tracking/{STATE['booking']['id']}", headers=ch)
        assert r3.status_code == 200
        d = r3.json()
        assert d["last_location"]["lat"] == 51.4
        assert len(d["trail"]) >= 2

    def test_booking_status_update(self, api, base_url):
        dh = {"Authorization": f"Bearer {STATE['driver']['token']}"}
        for s in ["travelling", "arrived", "collected", "on_route", "delivered"]:
            r = api.post(f"{base_url}/api/bookings/{STATE['booking']['id']}/status",
                         json={"status": s}, headers=dh)
            assert r.status_code == 200, f"{s}: {r.text}"

    def test_pod_upload_and_get(self, api, base_url):
        dh = {"Authorization": f"Bearer {STATE['driver']['token']}"}
        ch = {"Authorization": f"Bearer {STATE['customer']['token']}"}
        r = api.post(f"{base_url}/api/bookings/{STATE['booking']['id']}/pod",
                     json={"photos": ["b64photo"], "signature": "b64sig",
                           "notes": "delivered ok", "lat": 50.82, "lng": -0.14},
                     headers=dh)
        assert r.status_code == 200, r.text
        r2 = api.get(f"{base_url}/api/bookings/{STATE['booking']['id']}/pod", headers=ch)
        assert r2.status_code == 200
        p = r2.json()
        assert p["notes"] == "delivered ok"

    def test_review_after_pod(self, api, base_url):
        ch = {"Authorization": f"Bearer {STATE['customer']['token']}"}
        r = api.post(f"{base_url}/api/bookings/{STATE['booking']['id']}/review",
                     json={"rating": 5, "comment": "Great!"}, headers=ch)
        assert r.status_code == 200, r.text
        rev = r.json()
        assert rev["rating"] == 5
        assert rev["target_id"] == STATE["driver"]["user"]["id"]


# =============================================================================
# Admin suspend & final teardown
# =============================================================================
class TestAdminSuspend:
    def test_suspend_driver(self, api, base_url):
        # create a throwaway driver
        email = _uniq_email("drv2")
        r = api.post(f"{base_url}/api/auth/register", json={
            "email": email, "password": "Passw0rd!", "name": "Susp Driver",
            "role": "driver",
        })
        assert r.status_code == 200
        drv_id = r.json()["user"]["id"]
        h = {"Authorization": f"Bearer {STATE['admin']['token']}"}
        r2 = api.post(f"{base_url}/api/admin/users/{drv_id}/suspend", headers=h)
        assert r2.status_code == 200
        # Login should fail with 403
        r3 = api.post(f"{base_url}/api/auth/login",
                      json={"email": email, "password": "Passw0rd!"})
        assert r3.status_code == 403
