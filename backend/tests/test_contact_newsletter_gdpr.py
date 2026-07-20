"""Iteration 8 tests for Cargo One backend.

Covers newly-added endpoints:
  * POST /api/contact  (+ GET /api/admin/contact-messages)
  * POST /api/newsletter/subscribe  (+ GET /api/admin/newsletter-subscribers)
  * POST /api/auth/me/delete  (GDPR data scrubbing across jobs / bids)
"""

import os
import uuid

import pytest
import requests

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL",
    "https://cargo-port.preview.emergentagent.com",
).rstrip("/")
API = f"{BASE_URL}/api"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _rand_email(prefix: str) -> str:
    return f"TEST_{prefix}_{uuid.uuid4().hex[:8]}@example.com"


def _admin_token() -> str:
    r = requests.post(
        f"{API}/auth/login",
        json={"email": "admin@cargoone.com", "password": "admin123"},
        timeout=30,
    )
    assert r.status_code == 200, f"admin login failed: {r.text}"
    return r.json()["access_token"]


def _register(role: str, name: str) -> dict:
    email = _rand_email(role)
    payload = {
        "email": email,
        "password": "password123",
        "name": name,
        "role": role,
        "phone": "+441234567890",
    }
    r = requests.post(f"{API}/auth/register", json=payload, timeout=30)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    data = r.json()
    return {
        "email": email,
        "password": "password123",
        "token": data["access_token"],
        "user": data["user"],
    }


# ---------------------------------------------------------------------------
# 1) Contact form
# ---------------------------------------------------------------------------


class TestContactForm:
    def test_valid_contact_submission(self):
        email = _rand_email("contact")
        payload = {
            "name": "TEST Contact",
            "email": email,
            "phone": "+441234567890",
            "topic": "support",
            "message": "This is a valid TEST message longer than ten chars.",
        }
        r = requests.post(f"{API}/contact", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

        # Persistence check via admin
        admin_tok = _admin_token()
        lr = requests.get(
            f"{API}/admin/contact-messages", headers=_auth(admin_tok), timeout=30
        )
        assert lr.status_code == 200, lr.text
        msgs = lr.json()
        assert isinstance(msgs, list)
        matches = [m for m in msgs if m.get("email") == email.lower()]
        assert matches, f"contact message not persisted for {email}"
        m = matches[0]
        for key in ("id", "name", "email", "phone", "topic", "message", "status", "created_at"):
            assert key in m, f"missing key {key} in stored contact: {m}"
        assert m["status"] == "new"
        assert m["name"] == "TEST Contact"
        assert m["topic"] == "support"
        assert m["message"].startswith("This is a valid TEST message")

    def test_short_message_returns_400(self):
        payload = {
            "name": "TEST Short",
            "email": _rand_email("contact_short_msg"),
            "message": "too short",  # < 10 chars
        }
        r = requests.post(f"{API}/contact", json=payload, timeout=30)
        assert r.status_code == 400, f"expected 400 got {r.status_code} {r.text}"

    def test_short_name_returns_400(self):
        payload = {
            "name": "A",  # < 2 chars
            "email": _rand_email("contact_short_name"),
            "message": "This message is long enough for validation.",
        }
        r = requests.post(f"{API}/contact", json=payload, timeout=30)
        assert r.status_code == 400, f"expected 400 got {r.status_code} {r.text}"

    def test_invalid_email_returns_422(self):
        payload = {
            "name": "TEST Bad Email",
            "email": "not-an-email",
            "message": "This message is long enough for validation.",
        }
        r = requests.post(f"{API}/contact", json=payload, timeout=30)
        assert r.status_code == 422, f"expected 422 got {r.status_code} {r.text}"

    def test_admin_contact_messages_requires_admin(self):
        # unauthenticated
        r = requests.get(f"{API}/admin/contact-messages", timeout=30)
        assert r.status_code in (401, 403)

        # non-admin user
        customer = _register("customer", "TEST NonAdmin")
        r2 = requests.get(
            f"{API}/admin/contact-messages", headers=_auth(customer["token"]), timeout=30
        )
        assert r2.status_code == 403


# ---------------------------------------------------------------------------
# 2) Newsletter
# ---------------------------------------------------------------------------


class TestNewsletter:
    def test_valid_subscription(self):
        email = _rand_email("news")
        r = requests.post(
            f"{API}/newsletter/subscribe", json={"email": email}, timeout=30
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True
        # First time -> already_subscribed should NOT be True (either absent or False)
        assert not body.get("already_subscribed")

        # Idempotent second call
        r2 = requests.post(
            f"{API}/newsletter/subscribe", json={"email": email}, timeout=30
        )
        assert r2.status_code == 200, r2.text
        body2 = r2.json()
        assert body2.get("ok") is True
        assert body2.get("already_subscribed") is True

        # Admin can see subscriber
        admin_tok = _admin_token()
        lr = requests.get(
            f"{API}/admin/newsletter-subscribers", headers=_auth(admin_tok), timeout=30
        )
        assert lr.status_code == 200
        subs = lr.json()
        assert isinstance(subs, list)
        assert any(s.get("email") == email.lower() for s in subs), (
            f"subscriber {email} not returned by admin listing"
        )

    def test_invalid_email_returns_422(self):
        r = requests.post(
            f"{API}/newsletter/subscribe", json={"email": "not-an-email"}, timeout=30
        )
        assert r.status_code == 422, f"expected 422 got {r.status_code} {r.text}"

    def test_admin_newsletter_requires_admin(self):
        r = requests.get(f"{API}/admin/newsletter-subscribers", timeout=30)
        assert r.status_code in (401, 403)


# ---------------------------------------------------------------------------
# 3) GDPR delete data scrubbing
# ---------------------------------------------------------------------------


class TestGdprDeleteScrubbing:
    @pytest.fixture(scope="class")
    def scenario(self):
        """Create customer, driver, job, bid, booking; return context.

        We use a bidding job so the driver's bid + customer's acceptance path is
        exercised (matches production flow described in server.py)."""
        admin_tok = _admin_token()
        customer = _register("customer", "John Test")
        driver = _register("driver", "Jane Driver")

        # Admin approves the driver so they can bid
        ap = requests.post(
            f"{API}/admin/users/{driver['user']['id']}/approve",
            headers=_auth(admin_tok),
            timeout=30,
        )
        assert ap.status_code == 200, ap.text

        # Customer posts a bidding job
        job_payload = {
            "title": "TEST GDPR job",
            "category": "furniture",
            "description": "gdpr test cargo",
            "pickup_town": "London",
            "dropoff_town": "Manchester",
            "pickup_address": "1 Test St, London",
            "dropoff_address": "2 Test Rd, Manchester",
            "pickup_lat": 51.5,
            "pickup_lng": -0.12,
            "dropoff_lat": 53.48,
            "dropoff_lng": -2.24,
            "collection_date": "2026-02-01",
            "delivery_date": "2026-02-02",
            "pricing_type": "bidding",
            "weight_kg": 100,
            "vehicle_required": "van",
        }
        jr = requests.post(
            f"{API}/jobs", headers=_auth(customer["token"]), json=job_payload, timeout=30
        )
        assert jr.status_code == 200, jr.text
        job = jr.json()

        # Driver bids
        br = requests.post(
            f"{API}/jobs/{job['id']}/bids",
            headers=_auth(driver["token"]),
            json={"amount": 250.0, "message": "TEST bid", "eta_hours": 8},
            timeout=30,
        )
        assert br.status_code == 200, br.text
        bid = br.json()

        # Customer accepts bid
        acc = requests.post(
            f"{API}/bids/{bid['id']}/accept",
            headers=_auth(customer["token"]),
            timeout=30,
        )
        assert acc.status_code == 200, acc.text

        # Customer creates booking
        bk = requests.post(
            f"{API}/bookings",
            headers=_auth(customer["token"]),
            json={"job_id": job["id"]},
            timeout=30,
        )
        assert bk.status_code == 200, bk.text
        booking = bk.json()

        return {
            "customer": customer,
            "driver": driver,
            "job_id": job["id"],
            "bid_id": bid["id"],
            "booking_id": booking["id"],
            "admin_tok": admin_tok,
        }

    def _get_job(self, ctx, token):
        r = requests.get(
            f"{API}/jobs/{ctx['job_id']}", headers=_auth(token), timeout=30
        )
        assert r.status_code == 200, r.text
        return r.json()

    def _get_bid(self, ctx, token):
        r = requests.get(
            f"{API}/jobs/{ctx['job_id']}/bids", headers=_auth(token), timeout=30
        )
        assert r.status_code == 200, r.text
        bids = r.json()
        match = [b for b in bids if b["id"] == ctx["bid_id"]]
        assert match, f"bid {ctx['bid_id']} not found: {bids}"
        return match[0]

    def test_names_present_before_delete(self, scenario):
        ctx = scenario
        job = self._get_job(ctx, ctx["customer"]["token"])
        assert job["customer_name"] == "John Test"
        assert job.get("assigned_driver_name") == "Jane Driver"

        bid = self._get_bid(ctx, ctx["customer"]["token"])
        assert bid["driver_name"] == "Jane Driver"

    def test_customer_delete_anonymises_customer_name_on_job(self, scenario):
        ctx = scenario
        r = requests.post(
            f"{API}/auth/me/delete",
            headers=_auth(ctx["customer"]["token"]),
            timeout=30,
        )
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

        # Admin fetches user directly to verify anonymisation
        admin_tok = ctx["admin_tok"]
        ur = requests.get(
            f"{API}/admin/users", headers=_auth(admin_tok), timeout=30
        )
        assert ur.status_code == 200
        users = ur.json()
        me = next((u for u in users if u["id"] == ctx["customer"]["user"]["id"]), None)
        assert me is not None
        assert me["name"] == "Deleted user"
        assert me["email"].startswith("deleted+")
        assert me["email"].endswith("@cargoone.internal")
        assert me["status"] == "suspended"

        # Job customer_name should be scrubbed. Driver still active so retrieve via driver.
        job = self._get_job(ctx, ctx["driver"]["token"])
        assert job["customer_name"] == "Deleted user", (
            f"customer_name not scrubbed on job: {job.get('customer_name')}"
        )
        # Driver name should be untouched at this point
        assert job.get("assigned_driver_name") == "Jane Driver"

    def test_driver_delete_anonymises_driver_name_on_job_and_bid(self, scenario):
        ctx = scenario
        r = requests.post(
            f"{API}/auth/me/delete",
            headers=_auth(ctx["driver"]["token"]),
            timeout=30,
        )
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

        # Admin fetches jobs directly (customer & driver both suspended now)
        admin_tok = ctx["admin_tok"]
        aj = requests.get(f"{API}/admin/jobs", headers=_auth(admin_tok), timeout=30)
        assert aj.status_code == 200
        jobs = aj.json()
        job = next((j for j in jobs if j["id"] == ctx["job_id"]), None)
        assert job is not None
        assert job.get("assigned_driver_name") == "Deleted user", (
            f"assigned_driver_name not scrubbed: {job.get('assigned_driver_name')}"
        )
        assert job["customer_name"] == "Deleted user"

        # Admin can hit the bids listing via the customer-only endpoint? No — needs auth
        # of the customer. Both are suspended. Verify via admin_list_users bids? There's
        # no admin bids endpoint. Fall back to Mongo state inference: register a fresh
        # admin session and check /jobs/{id}/bids which allows admin role.
        lb = requests.get(
            f"{API}/jobs/{ctx['job_id']}/bids", headers=_auth(admin_tok), timeout=30
        )
        assert lb.status_code == 200, lb.text
        bids = lb.json()
        b = next((x for x in bids if x["id"] == ctx["bid_id"]), None)
        assert b is not None
        assert b["driver_name"] == "Deleted user", (
            f"bid driver_name not scrubbed: {b.get('driver_name')}"
        )
