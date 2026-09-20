"""R71.16.1 — regression test for native PaymentSheet refund path.

Root cause: `_customer_cancel_and_refund_impl` originally looked up the
Stripe PaymentIntent id only via `bookings.stripe_session_id` →
`payment_transactions.payment_intent_id`. Native PaymentSheet bookings
(Apple Pay, native card sheet) have `stripe_session_id = None` and
store the PI id directly on the booking at
`bookings.stripe_payment_intent_id`. Before the fix, refund always
threw "No payment_intent recorded on this booking — cannot refund",
`refund_state="failed"`, and the code raised `HTTPException(400)`
BEFORE the notification / email block, so the customer received no
cancellation notification, no cancellation email, no refund
confirmation notification, and no refund confirmation email.

The fix adds a fallback: if the session/txn lookup yields no PI id,
read `bookings.stripe_payment_intent_id` directly and use that. This
test drives the endpoint function IN-PROCESS with a mocked `stripe`
module so we can validate:

  * Native-PI booking (no stripe_session_id) → refund succeeds.
  * The Stripe SDK receives the correct PI id and amount.
  * `notifications` collection receives ONE booking_cancelled push doc
    for the customer with the correct amount in the body.
  * `email_log` records BOTH `booking_cancelled` AND
    `refund_confirmation` templates with the correct amount.
  * Idempotency: second call raises 409 and no duplicate rows.
  * Failure path: bogus PI → HTTPException(400), no false
    refund_confirmation email, no push.
"""
from __future__ import annotations

import asyncio
import os
import sys
import types
import uuid
from datetime import datetime, timezone
from unittest.mock import patch

import pytest

# Ensure backend/ is importable
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# conftest.py already loads backend/.env


def _iso() -> str:
    return datetime.now(timezone.utc).isoformat()


TAG = uuid.uuid4().hex[:8]


@pytest.fixture(scope="module")
def srv():
    """Import server module once and yield helpers."""
    import server as srv_mod  # noqa: E402
    yield srv_mod


@pytest.fixture(scope="module")
def sync_db():
    from pymongo import MongoClient
    cli = MongoClient(os.environ["MONGO_URL"])
    db = cli[os.environ["DB_NAME"]]
    yield db
    cli.close()


@pytest.fixture(scope="module")
def user_ids(sync_db, srv):
    """Seed a customer + driver directly in DB. No HTTP registration
    needed — we call the impl function directly and only require the
    id + email + name on `user` for the notification / email helpers.
    """
    cust_email = f"r71161-cust-{TAG}@example.com"
    drv_email = f"r71161-drv-{TAG}@example.com"
    cust_id = f"cust-{TAG}"
    drv_id = f"drv-{TAG}"

    sync_db.users.insert_one({
        "id": cust_id,
        "email": cust_email,
        "name": "R71161 Customer",
        "role": "customer",
        "status": "active",
        "created_at": _iso(),
    })
    sync_db.users.insert_one({
        "id": drv_id,
        "email": drv_email,
        "name": "R71161 Driver",
        "role": "driver",
        "status": "active",
        "documents_verified": True,
        "created_at": _iso(),
    })
    return {
        "customer_id": cust_id,
        "customer_email": cust_email,
        "driver_id": drv_id,
        "driver_email": drv_email,
    }


def _seed_native_pi_booking(sync_db, customer_id: str, driver_id: str, tag: str,
                            pi_id: str = "pi_test_r71161") -> tuple[str, str]:
    """Seed a paid booking with native-PI shape (no stripe_session_id)."""
    job_id = f"r71161-{tag}-job"
    booking_id = f"r71161-{tag}-bkg"
    deposit = 42.00
    driver_charge = 200.00

    sync_db.jobs.insert_one({
        "id": job_id, "customer_id": customer_id,
        "title": "R71.16.1 native-PI refund smoke",
        "category": "furniture", "category_key": "furniture",
        "service_timing": "asap", "service_type": "transport",
        "pricing_type": "fixed", "fixed_price": driver_charge,
        "accepted_price": driver_charge,
        "status": "accepted",
        "assigned_driver_id": driver_id,   # driver accepted → 20% fee
        "pickup_town": "London", "dropoff_town": "Reading",
        "created_at": _iso(),
    })
    sync_db.bookings.insert_one({
        "id": booking_id, "job_id": job_id,
        "customer_id": customer_id, "driver_id": driver_id,
        "driver_charge": driver_charge, "booking_fee": deposit,
        "total_price": driver_charge + deposit,
        "customer_total": driver_charge + deposit,
        "deposit_amount": deposit, "balance_due": driver_charge,
        "status": "deposit_paid", "payment_status": "paid",
        "stripe_session_id": None,            # native PaymentSheet
        "stripe_payment_intent_id": pi_id,    # ← field the fix reads
        "service_timing": "asap", "service_type": "transport",
        "created_at": _iso(), "paid_at": _iso(),
    })
    sync_db.payment_transactions.insert_one({
        "id": f"txn-{tag}",
        "session_id": pi_id, "payment_intent_id": pi_id,
        "kind": "native_pi",
        "amount": deposit, "currency": "gbp",
        "booking_id": booking_id, "customer_id": customer_id,
        "payment_status": "paid", "status": "paid",
        "refunds": [],
        "created_at": _iso(), "updated_at": _iso(),
    })
    return job_id, booking_id


def _install_stripe_stub(recorder: dict, refund_status: str = "succeeded",
                         raise_on_refund: bool = False):
    """Install a fake `stripe` module in sys.modules capturing calls.

    The server code does `import stripe as _stripe` INSIDE the refund
    function, so we swap the module at the top level and it'll pick up
    the stub. Restore any previous module via the returned cleanup.
    """
    prev = sys.modules.get("stripe")

    stub = types.ModuleType("stripe")

    class _FakeRefund:
        @staticmethod
        def create(**kwargs):
            recorder["refund_call"] = kwargs
            if raise_on_refund:
                raise RuntimeError("simulated Stripe failure")
            return {"id": f"re_test_{uuid.uuid4().hex[:16]}",
                    "status": refund_status}

    class _FakeCheckoutSession:
        @staticmethod
        def retrieve(session_id):
            recorder.setdefault("checkout_retrieve_called_with", []).append(session_id)
            # Deliberately return no payment_intent to prove the fix
            # falls back to bookings.stripe_payment_intent_id.
            return {"id": session_id, "payment_intent": None}

    class _Checkout:
        Session = _FakeCheckoutSession

    stub.Refund = _FakeRefund
    stub.checkout = _Checkout
    stub.api_key = None
    sys.modules["stripe"] = stub

    def cleanup():
        if prev is not None:
            sys.modules["stripe"] = prev
        else:
            sys.modules.pop("stripe", None)

    return cleanup


@pytest.fixture(scope="module")
def event_loop():
    """Module-scoped event loop so Motor sockets survive across
    sequential _run_on(event_loop, ) equivalents inside a single test.
    """
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


def _run_on(loop, coro):
    return loop.run_until_complete(coro)


class TestNativePIRefund:
    def test_success_path_notifications_and_emails(self, srv, sync_db, user_ids, event_loop):
        job_id, booking_id = _seed_native_pi_booking(
            sync_db, user_ids["customer_id"], user_ids["driver_id"], TAG,
            pi_id="pi_test_r71161_success",
        )
        recorder = {}
        cleanup = _install_stripe_stub(recorder, refund_status="succeeded")

        # Spy on the email helpers so we can capture exact `amount` used
        # in the refund confirmation. The endpoint uses `from
        # services.email import send_refund_confirmation, ...` INSIDE
        # the function, so patching the module attribute here is picked
        # up on next call.
        import services.email as email_mod
        real_refund_conf = email_mod.send_refund_confirmation
        real_bkg_cancel = email_mod.send_booking_cancelled

        async def _spy_refund_conf(db, *, user, booking, amount):
            recorder["refund_conf_amount"] = amount
            recorder["refund_conf_user_id"] = user.get("id")
            recorder["refund_conf_booking_id"] = booking.get("id")
            return await real_refund_conf(db, user=user, booking=booking, amount=amount)

        async def _spy_bkg_cancel(db, *, user, booking, reason=None, refund_pending=False):
            recorder.setdefault("bkg_cancel_calls", []).append({
                "user_id": user.get("id"),
                "booking_id": booking.get("id"),
                "reason": reason,
                "refund_pending": refund_pending,
            })
            return await real_bkg_cancel(
                db, user=user, booking=booking,
                reason=reason, refund_pending=refund_pending,
            )

        email_mod.send_refund_confirmation = _spy_refund_conf
        email_mod.send_booking_cancelled = _spy_bkg_cancel

        try:
            user = {
                "id": user_ids["customer_id"],
                "email": user_ids["customer_email"],
                "name": "R71161 Customer",
                "role": "customer",
            }
            result = _run_on(event_loop, 
                srv._customer_cancel_and_refund_impl(booking_id, {}, user),
            )
        finally:
            cleanup()
            email_mod.send_refund_confirmation = real_refund_conf
            email_mod.send_booking_cancelled = real_bkg_cancel

        # ---- API response ----
        assert result["refund_state"] == "succeeded", result
        assert result["stripe_refund_id"].startswith("re_test_"), result
        br = result["cancellation_breakdown"]
        # 20% of £42 deposit = £8.40 fee, £33.60 refund
        assert abs(br["cancellation_fee"] - 8.40) < 0.01, br
        assert abs(br["refund_amount"] - 33.60) < 0.01, br

        # ---- Stripe SDK received the correct PI id + amount ----
        rc = recorder.get("refund_call")
        assert rc is not None, "stripe.Refund.create was never called"
        assert rc["payment_intent"] == "pi_test_r71161_success", rc
        assert rc["amount"] == int(round(33.60 * 100)), rc

        # ---- Refund confirmation email was invoked with the correct amount
        assert abs(recorder.get("refund_conf_amount", 0) - 33.60) < 0.01, recorder
        assert recorder.get("refund_conf_booking_id") == booking_id

        # ---- booking_cancelled email was invoked exactly once, not marked
        # refund_pending (refund succeeded)
        bcs = recorder.get("bkg_cancel_calls", [])
        assert len(bcs) == 1, bcs
        assert bcs[0]["refund_pending"] is False, bcs

        # ---- Booking state ----
        fresh = sync_db.bookings.find_one({"id": booking_id})
        assert fresh["refund_status"] == "succeeded"
        assert abs(float(fresh["refund_amount"]) - 33.60) < 0.01
        assert fresh["stripe_refund_id"] == result["stripe_refund_id"]
        assert fresh["cancelled_at"]

        # ---- Notifications (source of truth for in-app inbox) ----
        notifs = list(sync_db.notifications.find(
            {"user_id": user_ids["customer_id"], "data.booking_id": booking_id},
        ))
        assert len(notifs) == 1, notifs
        n = notifs[0]
        assert n["title"] == "Booking cancelled"
        assert "33.60" in n["body"], n["body"]
        assert n["data"]["type"] == "booking_cancelled"
        assert n["data"]["refund_state"] == "succeeded"

        # ---- Email log — both templates recorded ----
        emails = list(sync_db.email_log.find(
            {"user_id": user_ids["customer_id"], "booking_id": booking_id},
        ))
        templates = sorted({e.get("template") for e in emails})
        assert "booking_cancelled" in templates, templates
        assert "refund_confirmation" in templates, templates

        # ---- Idempotency ----
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as excinfo:
            _run_on(event_loop, 
                srv._customer_cancel_and_refund_impl(booking_id, {}, user),
            )
        assert excinfo.value.status_code == 409

        notifs2 = list(sync_db.notifications.find(
            {"user_id": user_ids["customer_id"], "data.booking_id": booking_id},
        ))
        assert len(notifs2) == 1, "duplicate notification created on repeat cancel"
        emails2 = list(sync_db.email_log.find(
            {"user_id": user_ids["customer_id"], "booking_id": booking_id},
        ))
        assert len(emails2) == len(emails), "duplicate email logged on repeat cancel"

    def test_failure_path_does_not_send_success_confirmation(self, srv, sync_db, user_ids, event_loop):
        tag = f"fail{uuid.uuid4().hex[:6]}"
        job_id, booking_id = _seed_native_pi_booking(
            sync_db, user_ids["customer_id"], user_ids["driver_id"], tag,
            pi_id="pi_test_r71161_fail",
        )
        recorder = {}
        cleanup = _install_stripe_stub(recorder, raise_on_refund=True)
        try:
            user = {
                "id": user_ids["customer_id"],
                "email": user_ids["customer_email"],
                "name": "R71161 Customer",
                "role": "customer",
            }
            from fastapi import HTTPException
            with pytest.raises(HTTPException) as excinfo:
                _run_on(event_loop, 
                    srv._customer_cancel_and_refund_impl(booking_id, {}, user),
                )
            assert excinfo.value.status_code == 400
            assert "refund failed" in str(excinfo.value.detail).lower()
        finally:
            cleanup()

        # Booking marked cancelled + refund failed
        fresh = sync_db.bookings.find_one({"id": booking_id})
        assert fresh["cancelled_at"]
        assert fresh["refund_status"] == "failed", fresh

        # NO refund_confirmation email
        emails = list(sync_db.email_log.find(
            {"user_id": user_ids["customer_id"], "booking_id": booking_id},
        ))
        templates = {e.get("template") for e in emails}
        assert "refund_confirmation" not in templates, (
            "false refund_confirmation email was sent for a FAILED refund"
        )

        # NO cancellation push for this booking
        notifs = list(sync_db.notifications.find(
            {"user_id": user_ids["customer_id"], "data.booking_id": booking_id},
        ))
        assert notifs == [], notifs
