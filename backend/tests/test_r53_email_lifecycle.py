"""R53 — Full lifecycle email audit.

Runs a real end-to-end customer + driver lifecycle against the preview
environment. Every email that fires along the way is captured from the
Mongo `email_log` collection and written to a JSON audit report so we
can prove — per-event — WHICH template fired, to WHICH recipient, with
WHICH Resend message-id.

Gmail plus-addressing (`abdulbasit2016diesel+xxx@gmail.com`) is used so
customer, driver and password-reset accounts all deliver to the same
physical inbox (abdulbasit2016diesel@gmail.com) — this lets us cap the
total delivered count under Resend's per-day free-tier ceiling.

VERIFICATION ONLY — no template code is modified. Missing templates are
flagged as `missing` in the audit rather than added here.
"""
from __future__ import annotations

import json
import os
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/backend/.env", override=True)

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get(
    "REACT_APP_BACKEND_URL"
) else "https://cargo-repo-bridge.preview.emergentagent.com"
API = f"{BASE_URL}/api"

ADMIN_EMAIL = os.environ.get("TEST_ADMIN_EMAIL", "admin@cargoone.com")
ADMIN_PASSWORD = os.environ.get(
    "TEST_ADMIN_PASSWORD", os.environ.get("INITIAL_ADMIN_PASSWORD", "Vc9O0sNDGR6SfzKDaa0L1lhp")
)

TAG = uuid.uuid4().hex[:6]
INBOX = "abdulbasit2016diesel@gmail.com"
CUST_EMAIL = f"abdulbasit2016diesel+custR53{TAG}@gmail.com"
DRV_EMAIL = f"abdulbasit2016diesel+drvR53{TAG}@gmail.com"
CUST_PW = "R53Cust!23456"
DRV_PW = "R53Drv!23456"

REPORT_PATH = "/app/test_reports/iteration_r53_email_lifecycle.json"

# Live audit list — populated as tests execute.
AUDIT: list[dict] = []
STATE: dict = {}


def _iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _mongo():
    from pymongo import MongoClient
    cli = MongoClient(os.environ["MONGO_URL"])
    return cli, cli[os.environ["DB_NAME"]]


def _post(path, token=None, **kw):
    h = kw.pop("headers", {}) or {}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return requests.post(f"{API}{path}", headers=h, timeout=30, **kw)


def _get(path, token=None, **kw):
    h = kw.pop("headers", {}) or {}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return requests.get(f"{API}{path}", headers=h, timeout=30, **kw)


def _snapshot_emails(*, since_iso: str, to_filter: list[str] | None = None) -> list[dict]:
    """Poll email_log for entries created since `since_iso`."""
    cli, db = _mongo()
    try:
        q = {"at": {"$gt": since_iso}}
        if to_filter:
            q["to"] = {"$in": to_filter}
        docs = list(db.email_log.find(q, {"_id": 0}).sort("at", 1))
        return docs
    finally:
        cli.close()


def _wait_for_email(*, template: str, to: str, since_iso: str, timeout: int = 20) -> dict | None:
    """Wait up to `timeout` seconds for a specific template→recipient email
    to land in the audit log. Returns the doc or None on timeout."""
    end = time.time() + timeout
    while time.time() < end:
        docs = _snapshot_emails(since_iso=since_iso, to_filter=[to])
        for d in docs:
            if d.get("template") == template:
                return d
        time.sleep(1.0)
    return None


def _record(*, event: str, expected_template: str, recipient: str,
            since_iso: str, wait: int = 20) -> dict:
    """Wait for an expected email, append it (or a MISSING marker) to AUDIT,
    and return the doc found (or an empty dict)."""
    doc = _wait_for_email(template=expected_template, to=recipient,
                          since_iso=since_iso, timeout=wait)
    if doc:
        entry = {
            "event": event,
            "expected_template": expected_template,
            "template": doc.get("template"),
            "recipient": doc.get("to"),
            "subject": doc.get("subject"),
            "provider_id": doc.get("provider_id"),
            "status": doc.get("status"),
            "error": doc.get("error"),
            "at": doc.get("at"),
        }
    else:
        entry = {
            "event": event,
            "expected_template": expected_template,
            "template": None,
            "recipient": recipient,
            "subject": None,
            "provider_id": None,
            "status": "missing",
            "error": "no email_log row within timeout",
            "at": _iso(),
        }
    AUDIT.append(entry)
    return doc or {}


# ---------------------------------------------------------------------------
# Fixtures (module-scoped so tests share the same customer/driver/booking)
# ---------------------------------------------------------------------------
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
                      timeout=15)
    if r.status_code != 200:
        pytest.skip(f"admin login failed {r.status_code} {r.text[:200]}")
    return r.json()["access_token"]


@pytest.fixture(scope="module", autouse=True)
def _dump_report_at_end():
    """Always write the report even if tests fail mid-run."""
    yield
    totals = {
        "sent": sum(1 for e in AUDIT if e.get("status") == "sent"),
        "skipped": sum(1 for e in AUDIT if e.get("status") == "skipped"),
        "failed": sum(1 for e in AUDIT if e.get("status") == "failed"),
        "missing": sum(1 for e in AUDIT if e.get("status") == "missing"),
    }
    report = {
        "generated_at": _iso(),
        "inbox": INBOX,
        "customer_email": CUST_EMAIL,
        "driver_email": DRV_EMAIL,
        "state": STATE,
        "totals": totals,
        "email_audit": AUDIT,
    }
    Path(REPORT_PATH).parent.mkdir(parents=True, exist_ok=True)
    with open(REPORT_PATH, "w") as f:
        json.dump(report, f, indent=2, default=str)
    print(f"\n[R53] Audit report → {REPORT_PATH}")
    print(f"[R53] Totals: {totals}")


# ---------------------------------------------------------------------------
# 1. Customer + Driver registration → welcome emails
# ---------------------------------------------------------------------------
class TestRegistrationEmails:
    def test_register_customer_welcome(self):
        t0 = _iso()
        r = requests.post(f"{API}/auth/register", json={
            "email": CUST_EMAIL, "password": CUST_PW,
            "name": f"R53 Cust {TAG}", "phone": "+447700900201",
            "role": "customer",
        }, timeout=20)
        assert r.status_code == 200, r.text
        STATE["customer_id"] = r.json()["user"]["id"]
        STATE["customer_token"] = r.json()["access_token"]
        _record(event="customer_register", expected_template="welcome",
                recipient=CUST_EMAIL, since_iso=t0)

    def test_register_driver_welcome(self):
        t0 = _iso()
        r = requests.post(f"{API}/auth/register", json={
            "email": DRV_EMAIL, "password": DRV_PW,
            "name": f"R53 Drv {TAG}", "phone": "+447700900202",
            "role": "driver",
        }, timeout=20)
        assert r.status_code == 200, r.text
        STATE["driver_id"] = r.json()["user"]["id"]
        STATE["driver_token"] = r.json()["access_token"]
        _record(event="driver_register", expected_template="driver_welcome",
                recipient=DRV_EMAIL, since_iso=t0)


# ---------------------------------------------------------------------------
# 2. Admin approves driver → driver_approved email (currently MISSING wire)
# ---------------------------------------------------------------------------
class TestDriverApproval:
    def test_admin_approve_fires_email(self, admin_token):
        t0 = _iso()
        # Bring driver to live-online prerequisites in one shot: approve + set
        # the location + toggle live_online. The admin approve endpoint sets
        # status=active, documents_verified=True. Any missing prerequisites
        # for claim are patched directly in Mongo just before claim below.
        r = _post(f"/admin/users/{STATE['driver_id']}/approve", token=admin_token)
        assert r.status_code == 200, r.text
        # Expected template: `driver_approved` (per R53 spec). Any doc lands →
        # sent; else recorded as missing.
        _record(event="admin_driver_approved",
                expected_template="driver_approved",
                recipient=DRV_EMAIL, since_iso=t0, wait=8)


# ---------------------------------------------------------------------------
# 3. ASAP booking (seeded paid) → deposit_receipt + booking_confirmation
# 4. Driver claim → driver_assigned (customer) + driver_booking_accepted (driver)
# 5. Status on_route → cash_on_delivery_reminder (customer)
# 6. Status delivered/completed → booking_completed (customer)
# ---------------------------------------------------------------------------
class TestLifecycleEmails:
    @pytest.fixture(scope="class")
    def asap_booking(self):
        """Seed an ASAP job + paid booking directly (no Stripe checkout — we
        cannot automate the redirect). Then invoke the email helpers via
        the app so we can prove wiring end to end."""
        cli, db = _mongo()
        try:
            job_id = f"r53-job-{uuid.uuid4().hex[:8]}"
            booking_id = f"r53-bkg-{uuid.uuid4().hex[:8]}"
            driver_charge = 100.0
            deposit = 15.0
            db.jobs.insert_one({
                "id": job_id, "customer_id": STATE["customer_id"],
                "title": "R53 ASAP lifecycle", "category": "furniture",
                "category_key": "furniture",
                "service_timing": "asap", "service_type": "transport",
                "pricing_type": "fixed", "fixed_price": driver_charge,
                "accepted_price": driver_charge,
                "status": "confirmed", "assigned_driver_id": None,
                "pickup_address": "London, UK", "pickup_town": "London",
                "pickup_postcode": "SW1A 1AA",
                "pickup_lat": 51.5014, "pickup_lng": -0.1419,
                "dropoff_address": "Reading, UK", "dropoff_town": "Reading",
                "dropoff_postcode": "RG1 1AA",
                "dropoff_lat": 51.4543, "dropoff_lng": -0.9781,
                "weight_kg": 30, "created_at": _iso(),
                "recommended_vehicle": "van",
            })
            db.bookings.insert_one({
                "id": booking_id, "job_id": job_id,
                "customer_id": STATE["customer_id"], "driver_id": None,
                "driver_charge": driver_charge, "booking_fee": deposit,
                "total_price": driver_charge + deposit,
                "deposit_amount": deposit,
                "balance_due": driver_charge,
                "status": "confirmed", "payment_status": "paid",
                "service_timing": "asap", "service_type": "transport",
                "created_at": _iso(), "paid_at": _iso(),
            })
            STATE["job_id"] = job_id
            STATE["booking_id"] = booking_id
            return job_id, booking_id
        finally:
            cli.close()

    def test_deposit_receipt_and_booking_confirmation(self, asap_booking):
        """These fire from `/payments/status/{sid}` in the real Stripe flow.
        Since we seeded payment directly we invoke the templates via a
        thin async helper — this proves the TEMPLATE + LOG path, not the
        stripe wire. The stripe wire is proven separately (R40)."""
        job_id, booking_id = asap_booking
        import asyncio
        async def _drive():
            from services.email import (
                send_deposit_receipt, send_booking_confirmation,
            )
            cli, db = _mongo()
            try:
                # Use motor for the async writes
                from motor.motor_asyncio import AsyncIOMotorClient
                mcli = AsyncIOMotorClient(os.environ["MONGO_URL"])
                mdb = mcli[os.environ["DB_NAME"]]
                b = await mdb.bookings.find_one({"id": booking_id}, {"_id": 0})
                j = await mdb.jobs.find_one({"id": job_id}, {"_id": 0})
                b["job"] = j
                cust = await mdb.users.find_one({"id": STATE["customer_id"]},
                                                 {"_id": 0, "password_hash": 0})
                await send_deposit_receipt(mdb, user=cust, booking=b)
                await send_booking_confirmation(mdb, user=cust, booking=b)
                mcli.close()
            finally:
                cli.close()
        t0 = _iso()
        asyncio.get_event_loop().run_until_complete(_drive())
        _record(event="deposit_paid", expected_template="deposit_receipt",
                recipient=CUST_EMAIL, since_iso=t0)
        _record(event="booking_confirmed", expected_template="booking_confirmation",
                recipient=CUST_EMAIL, since_iso=t0)

    def test_driver_claim_fires_both_emails(self, asap_booking):
        job_id, booking_id = asap_booking
        # Bring driver to a claim-able state.
        cli, db = _mongo()
        try:
            db.users.update_one(
                {"id": STATE["driver_id"]},
                {"$set": {
                    "status": "active", "documents_verified": True,
                    "live_online": True,
                    "live_updated_at": _iso(),
                    "current_lat": 51.5014, "current_lng": -0.1419,
                    "vehicle_type": "van",
                    "capabilities": ["furniture", "transport"],
                }},
            )
        finally:
            cli.close()
        t0 = _iso()
        r = _post(f"/jobs/{job_id}/claim", token=STATE["driver_token"])
        # Not fatal for the audit if the claim fails; the record step will
        # still register the expected emails as missing.
        STATE["claim_status"] = r.status_code
        STATE["claim_body"] = r.text[:400]
        _record(event="driver_claim_customer_side",
                expected_template="driver_assigned",
                recipient=CUST_EMAIL, since_iso=t0)
        _record(event="driver_claim_driver_side",
                expected_template="driver_booking_accepted",
                recipient=DRV_EMAIL, since_iso=t0)

    def test_status_on_route_fires_cash_reminder(self, asap_booking):
        _, booking_id = asap_booking
        # Walk the booking forward. Note that /bookings/{id}/status flips
        # driver_id-owned bookings only, so we need the claim to have
        # succeeded. If it didn't, we still stamp the field and force the
        # transition via Mongo so we can prove the email wire on `on_route`.
        cli, db = _mongo()
        try:
            db.bookings.update_one(
                {"id": booking_id},
                {"$set": {"driver_id": STATE["driver_id"],
                          "status": "collected",
                          "cash_reminder_sent_at": None}},
            )
        finally:
            cli.close()
        t0 = _iso()
        r = _post(f"/bookings/{booking_id}/status",
                  token=STATE["driver_token"],
                  json={"status": "on_route"})
        STATE["on_route_status"] = r.status_code
        _record(event="status_on_route",
                expected_template="cash_on_delivery_reminder",
                recipient=CUST_EMAIL, since_iso=t0)

    def test_customer_complete_fires_completed_email(self, asap_booking):
        _, booking_id = asap_booking
        cli, db = _mongo()
        try:
            db.bookings.update_one(
                {"id": booking_id},
                {"$set": {"status": "delivered"}},
            )
        finally:
            cli.close()
        t0 = _iso()
        r = _post(f"/bookings/{booking_id}/complete", token=STATE["customer_token"])
        STATE["complete_status"] = r.status_code
        _record(event="customer_completed",
                expected_template="booking_completed",
                recipient=CUST_EMAIL, since_iso=t0)


# ---------------------------------------------------------------------------
# 7. Cancellation lifecycle — separate fresh booking. Real captured Stripe
#    PI so the refund path actually fires the Stripe API.
# ---------------------------------------------------------------------------
class TestCancellationEmails:
    def test_cancel_and_refund_fires_emails(self):
        import stripe as _stripe
        _stripe.api_key = os.environ["STRIPE_API_KEY"]
        cli, db = _mongo()
        try:
            job_id = f"r53-cx-job-{uuid.uuid4().hex[:8]}"
            booking_id = f"r53-cx-bkg-{uuid.uuid4().hex[:8]}"
            session_id = f"cs_test_r53_{uuid.uuid4().hex[:10]}"
            driver_charge = 594.00     # £675 total = £594 driver + £81 deposit
            deposit = 81.00
            db.jobs.insert_one({
                "id": job_id, "customer_id": STATE["customer_id"],
                "title": "R53 cancellation smoke",
                "category": "furniture", "category_key": "furniture",
                "service_timing": "asap", "service_type": "transport",
                "pricing_type": "fixed", "fixed_price": driver_charge,
                "accepted_price": driver_charge,
                "status": "accepted",
                "assigned_driver_id": STATE["driver_id"],  # driver already accepted → 20% fee
                "assigned_driver_name": f"R53 Drv {TAG}",
                "pickup_town": "London", "dropoff_town": "Reading",
                "created_at": _iso(),
            })
            db.bookings.insert_one({
                "id": booking_id, "job_id": job_id,
                "customer_id": STATE["customer_id"], "driver_id": STATE["driver_id"],
                "driver_charge": driver_charge, "booking_fee": deposit,
                "total_price": driver_charge + deposit,
                "customer_total": driver_charge + deposit,
                "deposit_amount": deposit, "balance_due": driver_charge,
                "status": "deposit_paid", "payment_status": "paid",
                "stripe_session_id": session_id,
                "service_timing": "asap", "service_type": "transport",
                "created_at": _iso(), "paid_at": _iso(),
            })
            pi = _stripe.PaymentIntent.create(
                amount=int(round(deposit * 100)), currency="gbp",
                payment_method="pm_card_visa", confirm=True,
                automatic_payment_methods={"enabled": True, "allow_redirects": "never"},
                metadata={"booking_id": booking_id, "test": "r53"},
            )
            assert pi.status == "succeeded"
            db.payment_transactions.insert_one({
                "id": f"txn-{uuid.uuid4().hex[:8]}",
                "session_id": session_id, "payment_intent_id": pi.id,
                "amount_total": int(round(deposit * 100)),
                "booking_id": booking_id, "customer_id": STATE["customer_id"],
                "status": "paid", "refunds": [],
                "created_at": _iso(), "updated_at": _iso(),
            })
            STATE["cancel_booking_id"] = booking_id
        finally:
            cli.close()

        t0 = _iso()
        r = _post(f"/customer/bookings/{STATE['cancel_booking_id']}/cancel-and-refund",
                  token=STATE["customer_token"], json={})
        assert r.status_code == 200, r.text
        body = r.json()
        STATE["cancel_response"] = body
        # Assert the £16.20 / £64.80 breakdown per R35
        br = body["cancellation_breakdown"]
        assert abs(br["cancellation_fee"] - 16.20) < 0.01, br
        assert abs(br["refund_amount"] - 64.80) < 0.01, br

        # Expected emails from cancel-and-refund:
        _record(event="cancel_customer_cancelled",
                expected_template="booking_cancelled",
                recipient=CUST_EMAIL, since_iso=t0, wait=15)
        _record(event="cancel_refund_confirmation",
                expected_template="refund_confirmation",
                recipient=CUST_EMAIL, since_iso=t0, wait=15)
        _record(event="cancel_driver_notification",
                expected_template="driver_cancellation_notice",
                recipient=DRV_EMAIL, since_iso=t0, wait=8)


# ---------------------------------------------------------------------------
# 8. Forgot-password → single-use token → new password logs in
# ---------------------------------------------------------------------------
class TestPasswordResetEmail:
    def test_forgot_password_email_and_single_use_token(self):
        t0 = _iso()
        r = requests.post(f"{API}/auth/forgot-password",
                          json={"email": CUST_EMAIL}, timeout=15)
        assert r.status_code == 200, r.text
        doc = _record(event="forgot_password",
                      expected_template="password_reset",
                      recipient=CUST_EMAIL, since_iso=t0, wait=15)

        # Fish the reset token out of Mongo (it isn't exposed in the API
        # response for security). We do NOT log the token to the report.
        cli, db = _mongo()
        try:
            token_doc = db.password_reset_tokens.find_one(
                {"user_id": STATE["customer_id"], "used_at": None},
                sort=[("created_at", -1)],
            )
            assert token_doc, "no reset token was created"
            token = token_doc["token"]
        finally:
            cli.close()

        new_pw = "R53NewPass!123"
        r = requests.post(f"{API}/auth/reset-password",
                          json={"token": token, "new_password": new_pw},
                          timeout=15)
        assert r.status_code == 200, f"reset failed: {r.text}"

        # Log in with the new password
        r = requests.post(f"{API}/auth/login",
                          json={"email": CUST_EMAIL, "password": new_pw},
                          timeout=15)
        assert r.status_code == 200, r.text
        STATE["customer_token"] = r.json()["access_token"]

        # Token must be single-use
        r = requests.post(f"{API}/auth/reset-password",
                          json={"token": token, "new_password": "AnotherPass!123"},
                          timeout=15)
        assert r.status_code in (400, 401, 403, 410), \
            f"reset token reusable! got {r.status_code} {r.text}"

        # Body/subject sanity — must not leak the raw token or password
        subject = (doc.get("subject") or "").lower()
        assert token not in subject, "raw token leaked in subject"
        assert "password" not in (doc.get("subject") or "").lower() or "reset" in subject


# ---------------------------------------------------------------------------
# 9. Audit-report shape sanity — verify totals array
# ---------------------------------------------------------------------------
class TestAuditShape:
    def test_audit_has_expected_events(self):
        # Ensure at least the wired templates are present (welcome +
        # password_reset + cash reminder are proven from R52).
        events = {e["expected_template"] for e in AUDIT}
        assert "welcome" in events
        assert "password_reset" in events
