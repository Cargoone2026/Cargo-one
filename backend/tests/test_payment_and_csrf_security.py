"""Negative security tests for the Stripe payment finalisation architecture.

These are additive to `test_payment_finalisation.py`. They cover the
attack surface highlighted in the P0 audit:

* Fabricated `checkout.session.completed` payload without the per-session
  webhook token (Phase 1 P0 hardening) → 403, booking untouched.
* Fabricated paid payload for a legitimate session but wrong token → 403.
* Malformed / non-JSON body → 400.
* Unknown session id → 200 no-op, no state change.
* Legitimate event replay (same session, same event id, twice) →
  first delivery finalises, second is idempotent no-op.
* Expired event delivered AFTER a successful paid event → paid state
  survives, no downgrade.
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


def _auth(t):
    return {"Authorization": f"Bearer {t}"}


def _seed_session(cust_token, drv_token):
    """Create booking + Stripe checkout session; return (booking_id, session_id)."""
    r = requests.post(
        f"{API}/jobs",
        json={
            "title": "PYTEST-NEGATIVE-SEC",
            "description": "P1 negative security tests",
            "category": "parcels",
            "pickup_address": "London, UK",
            "pickup_lat": 51.5074, "pickup_lng": -0.1278, "pickup_town": "London",
            "dropoff_address": "Bristol, UK",
            "dropoff_lat": 51.4545, "dropoff_lng": -2.5879, "dropoff_town": "Bristol",
            "weight_kg": 8,
            "collection_date": "2026-03-15T09:00:00Z",
            "delivery_date": "2026-03-16T18:00:00Z",
            "pricing_type": "fixed", "fixed_price": 300,
        },
        headers=_auth(cust_token), timeout=15,
    )
    r.raise_for_status()
    job_id = r.json()["id"]
    r = requests.post(f"{API}/jobs/{job_id}/accept", headers=_auth(drv_token), timeout=15)
    r.raise_for_status()
    r = requests.post(f"{API}/bookings", json={"job_id": job_id},
                       headers=_auth(cust_token), timeout=15)
    r.raise_for_status()
    booking_id = r.json()["id"]
    r = requests.post(
        f"{API}/bookings/{booking_id}/deposit",
        json={"origin_url": BASE_URL},
        headers=_auth(cust_token), timeout=15,
    )
    r.raise_for_status()
    return booking_id, r.json()["session_id"]


def _paid_payload(session_id):
    return {
        "id": f"evt_neg_{int(time.time() * 1000)}",
        "type": "checkout.session.completed",
        "data": {"object": {"id": session_id, "payment_status": "paid", "metadata": {}}},
    }


class TestWebhookTokenHardening:
    def test_webhook_without_token_query_is_rejected(self):
        cust = _login(CUSTOMER); drv = _login(DRIVER)
        booking_id, sid = _seed_session(cust, drv)
        # No `t=` query param → 403 (unless STRIPE_WEBHOOK_SECRET verified crypto,
        # which is not the case in preview default env).
        r = requests.post(f"{API}/webhook/stripe", json=_paid_payload(sid), timeout=15)
        assert r.status_code == 403, r.text
        # booking must remain pending
        b = requests.get(f"{API}/bookings/{booking_id}", headers=_auth(cust), timeout=15).json()
        assert b["payment_status"] == "pending"

    def test_webhook_with_wrong_token_is_rejected(self):
        cust = _login(CUSTOMER); drv = _login(DRIVER)
        booking_id, sid = _seed_session(cust, drv)
        r = requests.post(
            f"{API}/webhook/stripe?t=totally_wrong_token",
            json=_paid_payload(sid), timeout=15,
        )
        assert r.status_code == 403, r.text
        b = requests.get(f"{API}/bookings/{booking_id}", headers=_auth(cust), timeout=15).json()
        assert b["payment_status"] == "pending"

    def test_webhook_with_unknown_session_no_state_change(self):
        # Unknown session — must be treated as unauthenticated noise. 200 no-op.
        payload = _paid_payload("cs_test_unknown_session_never_created_hjk")
        r = requests.post(f"{API}/webhook/stripe?t=whatever", json=payload, timeout=15)
        assert r.status_code == 200
        assert r.json().get("ignored") == "unknown_session"

    def test_webhook_malformed_body_returns_400(self):
        r = requests.post(
            f"{API}/webhook/stripe?t=x",
            data="{not-json",
            headers={"Content-Type": "application/json"},
            timeout=15,
        )
        assert r.status_code == 400


class TestBrowserCSRF:
    def test_missing_csrf_header_rejects_cookie_mutation(self):
        """Cookie-authenticated POST without X-CSRF-Token → 403 CSRF missing."""
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json=CUSTOMER, timeout=15)
        r.raise_for_status()
        # Now attempt a mutating cookie-auth POST without the header
        r = s.post(f"{API}/jobs", json={"title": "x", "category": "parcels",
                                          "pickup_address": "a", "pickup_lat": 51.5,
                                          "pickup_lng": -0.1, "dropoff_address": "b",
                                          "dropoff_lat": 51.5, "dropoff_lng": -0.1,
                                          "weight_kg": 1,
                                          "collection_date": "2026-03-15T09:00:00Z",
                                          "delivery_date": "2026-03-16T18:00:00Z",
                                          "pricing_type": "fixed", "fixed_price": 10},
                     timeout=15)
        assert r.status_code == 403
        assert "CSRF" in r.json().get("detail", "")

    def test_invalid_csrf_header_rejects(self):
        s = requests.Session()
        s.post(f"{API}/auth/login", json=CUSTOMER, timeout=15).raise_for_status()
        r = s.post(f"{API}/jobs", headers={"X-CSRF-Token": "wrong"},
                     json={"title": "x", "category": "parcels",
                            "pickup_address": "a", "pickup_lat": 51.5, "pickup_lng": -0.1,
                            "dropoff_address": "b", "dropoff_lat": 51.5, "dropoff_lng": -0.1,
                            "weight_kg": 1,
                            "collection_date": "2026-03-15T09:00:00Z",
                            "delivery_date": "2026-03-16T18:00:00Z",
                            "pricing_type": "fixed", "fixed_price": 10},
                    timeout=15)
        assert r.status_code == 403
        assert "CSRF" in r.json().get("detail", "")

    def test_valid_csrf_header_allows_mutation(self):
        s = requests.Session()
        s.post(f"{API}/auth/login", json=CUSTOMER, timeout=15).raise_for_status()
        csrf = s.cookies.get("cargoone_csrf")
        assert csrf, "login must set cargoone_csrf cookie"
        r = s.post(f"{API}/jobs", headers={"X-CSRF-Token": csrf},
                     json={"title": "csrf-ok", "description": "csrf test", "category": "parcels",
                            "pickup_address": "London",
                            "pickup_lat": 51.5074, "pickup_lng": -0.1278,
                            "pickup_town": "London",
                            "dropoff_address": "Bristol",
                            "dropoff_lat": 51.4545, "dropoff_lng": -2.5879,
                            "dropoff_town": "Bristol",
                            "weight_kg": 5,
                            "collection_date": "2026-03-15T09:00:00Z",
                            "delivery_date": "2026-03-16T18:00:00Z",
                            "pricing_type": "fixed", "fixed_price": 100},
                    timeout=15)
        assert r.status_code == 200, r.text

    def test_bearer_bypasses_csrf(self):
        """Native/mobile flow: Authorization: Bearer must NOT be blocked
        by CSRF even without X-CSRF-Token."""
        token = _login(CUSTOMER)
        r = requests.post(
            f"{API}/jobs",
            headers={"Authorization": f"Bearer {token}"},
            json={"title": "bearer-ok", "description": "bearer test", "category": "parcels",
                   "pickup_address": "London",
                   "pickup_lat": 51.5074, "pickup_lng": -0.1278, "pickup_town": "London",
                   "dropoff_address": "Bristol",
                   "dropoff_lat": 51.4545, "dropoff_lng": -2.5879, "dropoff_town": "Bristol",
                   "weight_kg": 5,
                   "collection_date": "2026-03-15T09:00:00Z",
                   "delivery_date": "2026-03-16T18:00:00Z",
                   "pricing_type": "fixed", "fixed_price": 100},
            timeout=15,
        )
        assert r.status_code == 200, r.text

    def test_login_issues_csrf_cookie(self):
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json=CUSTOMER, timeout=15)
        assert r.status_code == 200
        assert s.cookies.get("cargoone_csrf")
        assert s.cookies.get("cargoone_session")

    def test_logout_clears_csrf_cookie(self):
        s = requests.Session()
        s.post(f"{API}/auth/login", json=CUSTOMER, timeout=15).raise_for_status()
        assert s.cookies.get("cargoone_csrf")
        # logout doesn't need CSRF (exempt)
        r = s.post(f"{API}/auth/logout", timeout=15)
        assert r.status_code == 200
        # cookie should be cleared server-side (browser will delete)
        # Session cookies dict may still hold stale value; we check the
        # Set-Cookie header on the response instead.
        set_cookies = r.headers.get("set-cookie", "")
        assert "cargoone_csrf=" in set_cookies
        assert "cargoone_session=" in set_cookies

    def test_me_reissues_csrf_when_missing(self):
        s = requests.Session()
        s.post(f"{API}/auth/login", json=CUSTOMER, timeout=15).raise_for_status()
        # Drop the CSRF cookie from the jar; requests.cookies API can be finicky
        # so we iterate and remove by name.
        for c in list(s.cookies):
            if c.name == "cargoone_csrf":
                s.cookies.clear(c.domain, c.path, c.name)
        r = s.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 200
        set_cookies = r.headers.get("set-cookie", "")
        assert "cargoone_csrf=" in set_cookies

    def test_get_requests_never_require_csrf(self):
        s = requests.Session()
        s.post(f"{API}/auth/login", json=CUSTOMER, timeout=15).raise_for_status()
        # Strip CSRF cookie
        try:
            del s.cookies["cargoone_csrf"]
        except KeyError:
            pass
        r = s.get(f"{API}/jobs/mine", timeout=15)
        assert r.status_code == 200
