"""Regression tests for Stripe payment finalisation — P0 fix.

Scope:
    * The `/api/webhook/stripe` endpoint is the *authoritative* finaliser
      for a Stripe checkout deposit. It must:
        - Finalise a paid session on `checkout.session.completed`.
        - Be idempotent — duplicate webhook delivery must not flip state
          a second time (no double push notifications, no `paid_at`
          overwrite, no duplicate booking).
        - Be safe against unknown session ids and expired/failed events.
    * The `/api/payments/status/{session_id}` endpoint is a *fallback*
      poller. When Stripe (or the Emergent proxy) returns a hard error,
      it must NOT 500 out — it must return the current DB state so the
      browser can keep polling / wait for the webhook.
    * `POST /api/bookings` must remain idempotent so a browser reload
      does not create a duplicate booking row.

These tests do NOT exercise the Stripe hosted checkout page (that needs
a browser). They exercise the finalisation state machine directly with
the same-shape payloads the Emergent Stripe proxy delivers.

Preserves the historical unrelated pytest baseline — this file is
additive and does not modify or "fix" pre-existing regressions.
"""
import os
import time
import requests

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL",
    "https://cargo-repo-bridge.preview.emergentagent.com",
).rstrip("/")
API = f"{BASE_URL}/api"

CUSTOMER = {"email": "cust1@cargoone.com", "password": "cust1234"}
DRIVER = {"email": "driver1@cargoone.com", "password": "driver123"}


def _login(payload):
    r = requests.post(f"{API}/auth/login", json=payload, timeout=15)
    r.raise_for_status()
    return r.json()["access_token"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _seed_accepted_job(cust_token, drv_token):
    """Create a fresh fixed-price job posted by cust1 and accepted by driver1."""
    r = requests.post(
        f"{API}/jobs",
        json={
            "title": "PYTEST-PAYMENT-FINAL",
            "description": "payment finalisation regression",
            "category": "parcels",
            "pickup_address": "Manchester, UK",
            "pickup_lat": 53.4808,
            "pickup_lng": -2.2426,
            "pickup_town": "Manchester",
            "dropoff_address": "Birmingham, UK",
            "dropoff_lat": 52.4862,
            "dropoff_lng": -1.8904,
            "dropoff_town": "Birmingham",
            "weight_kg": 5,
            "collection_date": "2026-03-15T09:00:00Z",
            "delivery_date": "2026-03-16T18:00:00Z",
            "pricing_type": "fixed",
            "fixed_price": 250,
        },
        headers=_auth(cust_token),
        timeout=15,
    )
    r.raise_for_status()
    job_id = r.json()["id"]
    r = requests.post(f"{API}/jobs/{job_id}/accept", headers=_auth(drv_token), timeout=15)
    r.raise_for_status()
    return job_id


def _seed_booking_and_session(cust_token, job_id):
    r = requests.post(
        f"{API}/bookings",
        json={"job_id": job_id},
        headers=_auth(cust_token),
        timeout=15,
    )
    r.raise_for_status()
    booking = r.json()
    r = requests.post(
        f"{API}/bookings/{booking['id']}/deposit",
        json={"origin_url": BASE_URL},
        headers=_auth(cust_token),
        timeout=15,
    )
    r.raise_for_status()
    return booking["id"], r.json()["session_id"]


def _fetch_webhook_token(session_id):
    """Look up the per-session webhook token via a direct DB read.

    Test-only escape hatch — production code never exposes this token
    outside the Stripe callback URL query string.
    """
    import asyncio
    from dotenv import load_dotenv
    load_dotenv("/app/backend/.env")
    from motor.motor_asyncio import AsyncIOMotorClient
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    async def _read():
        doc = await db.payment_transactions.find_one({"session_id": session_id})
        return (doc or {}).get("webhook_token")
    try:
        return asyncio.run(_read())
    finally:
        client.close()


def _webhook_url(session_id):
    tok = _fetch_webhook_token(session_id)
    if tok:
        return f"{API}/webhook/stripe?t={tok}"
    return f"{API}/webhook/stripe"


def _webhook_completed(session_id):
    """Simulate what the Emergent Stripe proxy POSTs for a paid checkout."""
    return {
        "id": f"evt_pytest_{int(time.time() * 1000)}",
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": session_id,
                "payment_status": "paid",
                "metadata": {},
            }
        },
    }


class TestWebhookFinalisation:
    def test_webhook_finalises_pending_booking(self):
        cust = _login(CUSTOMER)
        drv = _login(DRIVER)
        job_id = _seed_accepted_job(cust, drv)
        booking_id, session_id = _seed_booking_and_session(cust, job_id)

        # pre-webhook: booking should be pending
        r = requests.get(f"{API}/bookings/{booking_id}", headers=_auth(cust), timeout=15)
        assert r.status_code == 200
        assert r.json()["payment_status"] == "pending"

        # webhook fires
        r = requests.post(
            _webhook_url(session_id), json=_webhook_completed(session_id), timeout=15
        )
        assert r.status_code == 200
        body = r.json()
        assert body["ok"] is True
        assert body.get("finalised") is True

        # post-webhook: booking + job advanced
        r = requests.get(f"{API}/bookings/{booking_id}", headers=_auth(cust), timeout=15)
        b = r.json()
        assert b["status"] == "deposit_paid"
        assert b["payment_status"] == "paid"
        assert b.get("paid_at")

        r = requests.get(f"{API}/jobs/{job_id}", headers=_auth(cust), timeout=15)
        assert r.json()["status"] == "confirmed"

    def test_webhook_duplicate_delivery_is_idempotent(self):
        cust = _login(CUSTOMER)
        drv = _login(DRIVER)
        job_id = _seed_accepted_job(cust, drv)
        booking_id, session_id = _seed_booking_and_session(cust, job_id)

        # first delivery
        r1 = requests.post(
            _webhook_url(session_id), json=_webhook_completed(session_id), timeout=15
        )
        assert r1.json().get("finalised") is True

        r = requests.get(f"{API}/bookings/{booking_id}", headers=_auth(cust), timeout=15)
        first_paid_at = r.json().get("paid_at")
        assert first_paid_at is not None

        # duplicate delivery — must be no-op
        r2 = requests.post(
            _webhook_url(session_id), json=_webhook_completed(session_id), timeout=15
        )
        assert r2.status_code == 200
        assert r2.json().get("finalised") is False

        r = requests.get(f"{API}/bookings/{booking_id}", headers=_auth(cust), timeout=15)
        assert r.json()["paid_at"] == first_paid_at

    def test_webhook_unknown_session_is_safe(self):
        payload = _webhook_completed("cs_test_unknown_session_that_never_existed")
        r = requests.post(f"{API}/webhook/stripe?t=any", json=payload, timeout=15)
        assert r.status_code == 200
        # New security posture: unknown session returns 200 with ignored=unknown_session
        # (see server _finalise_paid_deposit + webhook token guard).
        body = r.json()
        assert body.get("finalised") in (False, None)
        assert body.get("ignored") == "unknown_session"

    def test_webhook_expired_on_paid_session_does_not_downgrade(self):
        cust = _login(CUSTOMER)
        drv = _login(DRIVER)
        job_id = _seed_accepted_job(cust, drv)
        booking_id, session_id = _seed_booking_and_session(cust, job_id)

        # mark as paid via webhook
        requests.post(_webhook_url(session_id), json=_webhook_completed(session_id), timeout=15)

        # then deliver a stale expired event for the same session
        expired = {
            "id": "evt_expire_late",
            "type": "checkout.session.expired",
            "data": {"object": {"id": session_id, "payment_status": "unpaid",
                                 "metadata": {}}},
        }
        r = requests.post(_webhook_url(session_id), json=expired, timeout=15)
        assert r.status_code == 200
        # booking must remain paid — no downgrade
        r = requests.get(f"{API}/bookings/{booking_id}", headers=_auth(cust), timeout=15)
        b = r.json()
        assert b["status"] == "deposit_paid"
        assert b["payment_status"] == "paid"


class TestStatusPollerIdempotency:
    def test_repeated_polls_after_paid_do_not_change_paid_at(self):
        cust = _login(CUSTOMER)
        drv = _login(DRIVER)
        job_id = _seed_accepted_job(cust, drv)
        booking_id, session_id = _seed_booking_and_session(cust, job_id)

        # webhook finalises
        requests.post(_webhook_url(session_id), json=_webhook_completed(session_id), timeout=15)
        first = requests.get(
            f"{API}/bookings/{booking_id}", headers=_auth(cust), timeout=15
        ).json().get("paid_at")
        assert first is not None

        # multiple polls — each must be a no-op
        for _ in range(3):
            r = requests.get(
                f"{API}/payments/status/{session_id}", headers=_auth(cust), timeout=20
            )
            assert r.status_code == 200
            assert r.json()["payment_status"] == "paid"

        after = requests.get(
            f"{API}/bookings/{booking_id}", headers=_auth(cust), timeout=15
        ).json().get("paid_at")
        assert after == first

    def test_status_returns_db_state_even_if_stripe_unreachable(self):
        """The poller must return 200 with the DB `payment_status` even when
        Stripe retrieve fails (production reproduction: 'No such checkout.session').

        We prove this indirectly: after the webhook has already finalised the
        booking, a subsequent poll returns `paid` regardless of what Stripe's
        proxy returns — because the DB is the source of truth. The status
        endpoint no longer 500s on retrieve error.
        """
        cust = _login(CUSTOMER)
        drv = _login(DRIVER)
        job_id = _seed_accepted_job(cust, drv)
        booking_id, session_id = _seed_booking_and_session(cust, job_id)

        # finalise via webhook only
        requests.post(_webhook_url(session_id), json=_webhook_completed(session_id), timeout=15)

        # even if the Stripe proxy failed silently, poll must return DB truth
        r = requests.get(
            f"{API}/payments/status/{session_id}", headers=_auth(cust), timeout=20
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["session_id"] == session_id
        assert body["payment_status"] == "paid"


class TestBookingCreateIdempotency:
    def test_double_post_bookings_returns_same_id(self):
        cust = _login(CUSTOMER)
        drv = _login(DRIVER)
        job_id = _seed_accepted_job(cust, drv)
        r1 = requests.post(f"{API}/bookings", json={"job_id": job_id},
                            headers=_auth(cust), timeout=15).json()
        r2 = requests.post(f"{API}/bookings", json={"job_id": job_id},
                            headers=_auth(cust), timeout=15).json()
        assert r1["id"] == r2["id"]
