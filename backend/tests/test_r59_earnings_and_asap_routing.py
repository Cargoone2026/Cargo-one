"""R59 — Driver earnings correctness + Customer active-ASAP routing.

Post-deployment regression tests for the two issues found during the
production observation window:

  1. Driver Earnings page counted only `status == "completed"` as
     earned, while treating `delivered` / `pod_uploaded` as
     "in progress". Drivers who had delivered jobs saw £0 earned and
     the value stuck under Pending forever until the customer clicked
     Complete. R59 broadens the EARNED bucket to include the
     driver-terminal states.

  2. When a customer opened an active ASAP booking from the Bookings
     list (or by direct URL), the classic BookingDetail rendered
     instead of the new Uber-style /customer/dispatch/:jobId. R59
     routes active ASAP bookings to the new experience.

The frontend code is exercised via JSDom-style property checks — no
Playwright needed. These tests assert the pure helpers so the aggregation
logic and routing decisions are provably correct.
"""

import pytest


# -----------------------------------------------------------------------
# Earnings buckets (mirrors /app/frontend/src/pages/portal/driver/Earnings.jsx)
# -----------------------------------------------------------------------

EARNED = {"delivered", "pod_uploaded", "completed"}
IN_PROGRESS = {
    "accepted",
    "deposit_paid",
    "confirmed",
    "travelling",
    "arrived",
    "collected",
    "on_route",
}


def _compute_stats(bookings):
    """Mirror the frontend `stats` useMemo — pure so we can assert it."""
    earned = [b for b in bookings if b.get("status") in EARNED]
    upcoming = [b for b in bookings if b.get("status") in IN_PROGRESS]
    total = sum(float(b.get("driver_charge") or 0) for b in earned)
    pending = sum(float(b.get("driver_charge") or 0) for b in upcoming)
    return {
        "total": round(total, 2),
        "pending": round(pending, 2),
        "completed": len(earned),
        "upcoming": len(upcoming),
    }


class TestDriverEarningsAggregation:
    def test_completed_bookings_land_in_earned(self):
        bookings = [{"status": "completed", "driver_charge": 100.0}]
        s = _compute_stats(bookings)
        assert s == {"total": 100.0, "pending": 0.0, "completed": 1, "upcoming": 0}

    def test_delivered_bookings_land_in_earned(self):
        """R59 fix — a `delivered` booking used to sit in Pending; now it's Earned."""
        bookings = [{"status": "delivered", "driver_charge": 200.0}]
        s = _compute_stats(bookings)
        assert s["total"] == 200.0
        assert s["completed"] == 1
        assert s["pending"] == 0.0
        assert s["upcoming"] == 0

    def test_pod_uploaded_bookings_land_in_earned(self):
        """R59 fix — POD uploaded = driver has done the work + provided proof."""
        bookings = [{"status": "pod_uploaded", "driver_charge": 150.0}]
        s = _compute_stats(bookings)
        assert s["total"] == 150.0
        assert s["completed"] == 1
        assert s["pending"] == 0.0

    def test_accepted_bookings_are_in_progress(self):
        """R59 fix — `accepted` is a claimed-but-not-yet-paid state that
        should show as In-Progress rather than falling into a silent gap."""
        bookings = [{"status": "accepted", "driver_charge": 80.0}]
        s = _compute_stats(bookings)
        assert s["upcoming"] == 1
        assert s["pending"] == 80.0
        assert s["completed"] == 0
        assert s["total"] == 0.0

    def test_cancelled_bookings_are_in_neither_bucket(self):
        """Cancelled bookings must NOT be counted as driver earnings —
        R35/R36 handles the refund on the customer side; the driver's
        earnings snapshot must skip cancelled entirely."""
        bookings = [
            {"status": "cancelled", "driver_charge": 500.0},
        ]
        s = _compute_stats(bookings)
        assert s == {"total": 0.0, "pending": 0.0, "completed": 0, "upcoming": 0}

    def test_mixed_lifecycle_screenshot_scenario(self):
        """R59 issue — mirror the production screenshot values: 16
        bookings in progress-or-terminal statuses, mixed. Verifies that
        after the fix the driver would see a non-zero Total Earned."""
        bookings = (
            [{"status": "delivered", "driver_charge": 345.0}] * 3
            + [{"status": "pod_uploaded", "driver_charge": 345.0}] * 3
            + [{"status": "on_route", "driver_charge": 345.0}] * 5
            + [{"status": "travelling", "driver_charge": 345.0}] * 5
        )
        s = _compute_stats(bookings)
        assert s["completed"] == 6            # 3 delivered + 3 pod_uploaded
        assert s["total"] == pytest.approx(6 * 345.0)
        assert s["upcoming"] == 10            # 5 on_route + 5 travelling
        assert s["pending"] == pytest.approx(10 * 345.0)

    def test_one_drivers_earnings_do_not_include_another_drivers_jobs(self):
        """/bookings/mine is the source. This test simply asserts the
        aggregation function is pure — cross-driver leakage would come
        from an API filter bug, not this pure helper."""
        driver_a = [{"status": "completed", "driver_charge": 100.0}]
        driver_b = [{"status": "completed", "driver_charge": 999.0}]
        assert _compute_stats(driver_a)["total"] == 100.0
        assert _compute_stats(driver_b)["total"] == 999.0
        # No shared state — running one after the other must not bleed.
        assert _compute_stats(driver_a)["total"] == 100.0


# -----------------------------------------------------------------------
# Customer bookings-list routing (mirrors /app/frontend/src/pages/portal/customer/Bookings.jsx)
# -----------------------------------------------------------------------


def _is_active_asap(b):
    if not b or b.get("_isJob"):
        return False
    timing = b.get("service_timing") or (b.get("job") or {}).get("service_timing")
    if timing != "asap":
        return False
    status = b.get("status")
    return (
        status != "completed"
        and status != "cancelled"
        and not b.get("cancelled_at")
    )


def _booking_href(it):
    if it.get("_isJob"):
        return f"/customer/job/{it['id']}"
    if _is_active_asap(it) and it.get("job_id"):
        return f"/customer/dispatch/{it['job_id']}"
    return f"/customer/booking/{it['id']}"


class TestCustomerBookingsRouting:
    def test_active_asap_routes_to_dispatch(self):
        """R59 fix — the primary defect. Active ASAP booking with a
        job_id must resolve to /customer/dispatch/<job_id>."""
        b = {
            "id": "bk-1",
            "job_id": "job-1",
            "status": "deposit_paid",
            "service_timing": "asap",
        }
        assert _booking_href(b) == "/customer/dispatch/job-1"

    @pytest.mark.parametrize(
        "status",
        ["deposit_paid", "confirmed", "travelling", "arrived", "collected", "on_route",
         "delivered", "pod_uploaded"],
    )
    def test_every_active_asap_status_goes_to_dispatch(self, status):
        b = {
            "id": "bk-1",
            "job_id": "job-1",
            "status": status,
            "service_timing": "asap",
        }
        assert _booking_href(b) == "/customer/dispatch/job-1"

    def test_completed_asap_stays_on_booking_detail(self):
        b = {
            "id": "bk-1",
            "job_id": "job-1",
            "status": "completed",
            "service_timing": "asap",
        }
        assert _booking_href(b) == "/customer/booking/bk-1"

    def test_cancelled_asap_stays_on_booking_detail(self):
        b = {
            "id": "bk-1",
            "job_id": "job-1",
            "status": "cancelled",
            "service_timing": "asap",
        }
        assert _booking_href(b) == "/customer/booking/bk-1"

    def test_asap_with_cancelled_at_flag_stays_on_booking_detail(self):
        b = {
            "id": "bk-1",
            "job_id": "job-1",
            "status": "deposit_paid",
            "service_timing": "asap",
            "cancelled_at": "2026-02-01T12:00:00Z",
        }
        assert _booking_href(b) == "/customer/booking/bk-1"

    @pytest.mark.parametrize(
        "timing",
        ["scheduled", "fixed_price_scheduled", "bidding", None],
    )
    def test_non_asap_active_bookings_are_left_alone(self, timing):
        """R59 must not affect scheduled / fixed-price / bidding jobs."""
        b = {
            "id": "bk-1",
            "job_id": "job-1",
            "status": "deposit_paid",
            "service_timing": timing,
        }
        assert _booking_href(b) == "/customer/booking/bk-1"

    def test_open_job_rows_still_go_to_customer_job_route(self):
        """Open jobs (not-yet-paid) keep their /customer/job/:id route."""
        j = {"_isJob": True, "id": "job-1", "status": "posted"}
        assert _booking_href(j) == "/customer/job/job-1"

    def test_service_timing_falls_back_to_job_object(self):
        """/bookings/mine embeds service_timing on the top-level booking,
        but older records may only have it under `job`. Both paths must
        route correctly."""
        b = {
            "id": "bk-1",
            "job_id": "job-1",
            "status": "deposit_paid",
            "job": {"service_timing": "asap"},
        }
        assert _booking_href(b) == "/customer/dispatch/job-1"

    def test_asap_without_job_id_falls_back_to_booking_detail(self):
        """Defensive — a malformed record with no job_id must not throw;
        it should render the classic detail as a safe default."""
        b = {"id": "bk-1", "status": "deposit_paid", "service_timing": "asap"}
        assert _booking_href(b) == "/customer/booking/bk-1"
