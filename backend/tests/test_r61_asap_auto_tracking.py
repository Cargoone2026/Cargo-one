"""R61 — Automatic Live Tracking for ASAP jobs only.

Regression tests for the auto-start decision used by the driver-side
`/driver/booking/:id` (BookingDetail.jsx). The frontend guard is a pure
function of the booking record and the authenticated user, so the exact
policy is asserted here directly. Also covers backend authorisation and
R37 privacy invariants that R61 must not disturb.

Backend endpoints touched by R61: **none**. The existing
POST/GET /tracking/{booking_id} contracts are unchanged — R61 only
changes *when* the driver frontend starts pushing.
"""

import pytest


ACTIVE_STATUSES = {"travelling", "arrived", "collected", "on_route"}
HANDOFF_STATUSES = {"confirmed", "deposit_paid"}
TERMINAL_STATUSES = {"completed", "cancelled", "delivered", "pod_uploaded"}


def should_auto_start_tracking(*, booking, user):
    """Mirror of the useEffect gate in
    /app/frontend/src/pages/portal/driver/BookingDetail.jsx (R61).

    Auto-tracking activates for ASAP only, when the current viewer is
    the assigned driver, and the booking is in an active (post-
    acceptance) status. Terminal states never re-arm tracking.
    """
    if not booking:
        return False
    timing = booking.get("service_timing") or (booking.get("job") or {}).get("service_timing")
    if timing != "asap":
        return False                       # non-ASAP keeps manual
    if booking.get("status") in TERMINAL_STATUSES:
        return False                       # completed / delivered / pod / cancelled
    if booking.get("cancelled_at"):
        return False
    status = booking.get("status")
    if status not in ACTIVE_STATUSES and status not in HANDOFF_STATUSES:
        return False                       # e.g. searching, accepted-but-no-status
    if not user:
        return False
    if booking.get("driver_id") != user.get("id"):
        return False                       # only the assigned driver can push
    return True


# -----------------------------------------------------------------------
# 1. ASAP auto-start (Scenarios A, B, D from brief §19)
# -----------------------------------------------------------------------

class TestAsapAutoStart:
    def test_asap_transport_confirmed_auto_starts(self):
        """Scenario A/D — driver just claimed an ASAP Transport job."""
        b = {"id": "bk", "driver_id": "d1", "status": "confirmed",
             "service_timing": "asap", "service_type": "transport"}
        assert should_auto_start_tracking(booking=b, user={"id": "d1"}) is True

    def test_asap_recovery_confirmed_auto_starts(self):
        """Scenario B — ASAP Recovery must not be treated as any different."""
        b = {"id": "bk", "driver_id": "d1", "status": "confirmed",
             "service_timing": "asap", "service_type": "breakdown_recovery"}
        assert should_auto_start_tracking(booking=b, user={"id": "d1"}) is True

    @pytest.mark.parametrize("status", ["travelling", "arrived", "collected", "on_route"])
    def test_all_active_statuses_auto_start(self, status):
        """Driver re-entering the page mid-trip (Scenario driver re-entry)."""
        b = {"id": "bk", "driver_id": "d1", "status": status, "service_timing": "asap"}
        assert should_auto_start_tracking(booking=b, user={"id": "d1"}) is True

    def test_asap_service_timing_via_nested_job(self):
        """/api/bookings/{id} sometimes only exposes service_timing on
        the embedded job object (legacy shape). Both paths must count."""
        b = {"id": "bk", "driver_id": "d1", "status": "confirmed",
             "job": {"service_timing": "asap"}}
        assert should_auto_start_tracking(booking=b, user={"id": "d1"}) is True


# -----------------------------------------------------------------------
# 2. ASAP pre-accept must NOT auto-start (Scenario C — privacy)
# -----------------------------------------------------------------------

class TestAsapPreAccept:
    def test_no_driver_assigned_returns_false(self):
        """If the customer is still `searching`, no driver_id is
        present on the booking — nothing to push. Also nobody would be
        viewing /driver/booking/:id in this state, but assert it anyway."""
        b = {"id": "bk", "driver_id": None, "status": "deposit_paid",
             "service_timing": "asap"}
        # Any user viewing (even the admin) must not trigger a push.
        assert should_auto_start_tracking(booking=b, user={"id": "someone"}) is False

    def test_different_driver_cannot_start(self):
        """Cross-driver isolation — driver B viewing driver A's booking
        must not push their own location against A's booking."""
        b = {"id": "bk", "driver_id": "driver-A", "status": "confirmed",
             "service_timing": "asap"}
        assert should_auto_start_tracking(booking=b, user={"id": "driver-B"}) is False

    def test_no_user_returns_false(self):
        b = {"id": "bk", "driver_id": "d1", "status": "confirmed",
             "service_timing": "asap"}
        assert should_auto_start_tracking(booking=b, user=None) is False


# -----------------------------------------------------------------------
# 3. Non-ASAP must NEVER auto-start (Scenario H — normal jobs)
# -----------------------------------------------------------------------

class TestNonAsapKeepsManual:
    @pytest.mark.parametrize(
        "timing", ["scheduled", "fixed_price_scheduled", "bidding", None],
    )
    def test_non_asap_never_auto_starts(self, timing):
        """Even with a valid driver_id + active status, non-ASAP must
        keep its existing manual Start/Stop control."""
        b = {"id": "bk", "driver_id": "d1", "status": "travelling",
             "service_timing": timing}
        assert should_auto_start_tracking(booking=b, user={"id": "d1"}) is False

    def test_non_asap_active_still_manual(self):
        b = {"id": "bk", "driver_id": "d1", "status": "on_route",
             "service_timing": "scheduled"}
        assert should_auto_start_tracking(booking=b, user={"id": "d1"}) is False


# -----------------------------------------------------------------------
# 4. Terminal states must stop / never re-arm (Scenarios E, F, completion)
# -----------------------------------------------------------------------

class TestStopConditions:
    @pytest.mark.parametrize(
        "status", ["completed", "delivered", "pod_uploaded", "cancelled"],
    )
    def test_terminal_never_auto_starts(self, status):
        """Once the trip has ended, tracking must never re-arm — even
        if the driver reopens the booking."""
        b = {"id": "bk", "driver_id": "d1", "status": status,
             "service_timing": "asap"}
        assert should_auto_start_tracking(booking=b, user={"id": "d1"}) is False

    def test_cancelled_at_flag_prevents_start(self):
        """R35/R36 sets cancelled_at even before status flips — the
        auto-tracker must respect this precursor."""
        b = {"id": "bk", "driver_id": "d1", "status": "confirmed",
             "service_timing": "asap",
             "cancelled_at": "2026-02-01T12:00:00Z"}
        assert should_auto_start_tracking(booking=b, user={"id": "d1"}) is False


# -----------------------------------------------------------------------
# 5. Backend contract preservation (no backend changes in R61)
# -----------------------------------------------------------------------

class TestBackendContractsUnchanged:
    def test_post_tracking_still_driver_only(self):
        """`POST /tracking/{booking_id}` still requires role=driver +
        driver_id match. R61 does not weaken this — the driver frontend
        starts pushing automatically, but the auth is unchanged."""
        from pathlib import Path
        src = Path("/app/backend/server.py").read_text()
        assert 'require_role("driver")' in src
        assert 'b.get("driver_id") != user["id"]' in src

    def test_get_tracking_still_customer_driver_admin_only(self):
        """`GET /tracking/{booking_id}` still restricts to booking's
        customer / driver / admin. R37 privacy preserved."""
        from pathlib import Path
        src = Path("/app/backend/server.py").read_text()
        # The 403-if-not-in list is intact.
        assert '"Forbidden"' in src


# -----------------------------------------------------------------------
# 6. R37 privacy — driver location follows the same acceptance gate
#    as contact release: only the customer of the booking can GET it.
# -----------------------------------------------------------------------

class TestR37PrivacyIntact:
    def test_customer_A_cannot_receive_driver_of_booking_B(self):
        """This is enforced by the GET /tracking/{id} auth check
        (customer_id / driver_id / admin). We assert the guard exists
        in server.py to catch accidental removal."""
        from pathlib import Path
        src = Path("/app/backend/server.py").read_text()
        # The critical auth line — do not remove.
        assert 'if user["id"] not in (b.get("customer_id"), b.get("driver_id"))' in src
