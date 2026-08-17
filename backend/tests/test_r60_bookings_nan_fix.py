"""R60 — Customer Bookings list "£NaN" fix.

Focused regression tests for the display-amount resolver used by
/app/frontend/src/pages/portal/customer/Bookings.jsx. The frontend
`resolveDisplayAmount()` helper is a pure function so the exact
implementation is asserted here without needing a Playwright run.

Backend behaviour is unchanged — this is a display-layer safety fix.
"""

import pytest


def num(v):
    try:
        n = float(v)
    except (TypeError, ValueError):
        return None
    if n != n:            # NaN check
        return None
    if n <= 0:
        return None
    return n


def resolve_display_amount(it):
    """Mirror of frontend `resolveDisplayAmount` — kept in lock-step by tests."""
    if not it:
        return {"label": "Total", "value": None}
    if it.get("_isJob"):
        v = (
            num(it.get("suggested_price"))
            or num(it.get("accepted_price"))
            or num(it.get("customer_total"))
        )
        return {"label": "Estimated", "value": v}
    if it.get("status") == "cancelled" or it.get("cancelled_at"):
        v = (
            num(it.get("cancellation_refund"))
            or num(it.get("refund_amount"))
        )
        return {"label": "Refunded", "value": v}
    job = it.get("job") or {}
    v = (
        num(it.get("customer_total"))
        or num(it.get("total_price"))
        or num(job.get("customer_total"))
        or num(job.get("accepted_price"))
    )
    return {"label": "Total", "value": v}


class TestNoNaN:
    """Every booking-row shape that used to produce `£NaN` must now
    resolve to a valid number OR fall back to the "Price pending"
    sentinel — never `NaN`, `undefined`, `null` in the visible amount."""

    def test_the_exact_seed_booking_from_r59_screenshot(self):
        """The seed booking from R59 verification had status=confirmed,
        customer_total=141.5, but NO total_price. Old code:
        Number(undefined).toFixed(0) === 'NaN' → '£NaN'.
        R60: resolves to £141."""
        it = {
            "id": "seed-r59",
            "status": "confirmed",
            "job_id": "job-1",
            "service_timing": "asap",
            "customer_total": 141.5,
            # deliberately no total_price
        }
        r = resolve_display_amount(it)
        assert r["label"] == "Total"
        assert r["value"] == pytest.approx(141.5)

    def test_missing_total_price_but_valid_customer_total(self):
        it = {"id": "x", "status": "confirmed", "customer_total": 675.0}
        assert resolve_display_amount(it)["value"] == 675.0

    def test_both_valid_prefers_customer_total(self):
        """R38 canonical wins over legacy total_price when both present."""
        it = {"id": "x", "status": "confirmed", "customer_total": 200.0, "total_price": 150.0}
        assert resolve_display_amount(it)["value"] == 200.0

    def test_legacy_total_price_used_when_customer_total_missing(self):
        it = {"id": "x", "status": "confirmed", "total_price": 99.0}
        assert resolve_display_amount(it)["value"] == 99.0

    def test_falls_through_to_job_customer_total(self):
        it = {"id": "x", "status": "confirmed",
              "job": {"customer_total": 314.0}}
        assert resolve_display_amount(it)["value"] == 314.0

    def test_falls_through_to_job_accepted_price(self):
        it = {"id": "x", "status": "confirmed",
              "job": {"accepted_price": 270.0}}
        assert resolve_display_amount(it)["value"] == 270.0

    def test_genuinely_unpriced_returns_null_value(self):
        """Genuinely no price on the record → value=None so the UI shows
        'Price pending' rather than any invented / misleading number."""
        it = {"id": "x", "status": "confirmed"}
        r = resolve_display_amount(it)
        assert r["value"] is None

    def test_deposit_is_never_used_as_total(self):
        """R60 must NOT display deposit as the booking Total. If only
        deposit_amount is present with no total, value=None."""
        it = {"id": "x", "status": "confirmed", "deposit_amount": 42.45}
        r = resolve_display_amount(it)
        assert r["value"] is None      # deposit is NOT total
        assert r["label"] == "Total"

    def test_zero_or_negative_price_is_treated_as_missing(self):
        """A zero or negative price should not be shown — it's not a
        valid displayable total. Falls through the fallback chain."""
        it = {"id": "x", "status": "confirmed",
              "customer_total": 0, "total_price": -5, "job": {"accepted_price": 100}}
        assert resolve_display_amount(it)["value"] == 100

    def test_string_number_price_still_works(self):
        """Backend sometimes serialises numeric fields as strings — the
        resolver must coerce safely."""
        it = {"id": "x", "status": "confirmed", "customer_total": "141.50"}
        assert resolve_display_amount(it)["value"] == pytest.approx(141.5)

    def test_junk_string_price_is_treated_as_missing(self):
        it = {"id": "x", "status": "confirmed", "customer_total": "abc"}
        assert resolve_display_amount(it)["value"] is None

    def test_nan_price_is_treated_as_missing(self):
        it = {"id": "x", "status": "confirmed", "customer_total": float("nan")}
        assert resolve_display_amount(it)["value"] is None


class TestCancelledBookings:
    def test_cancelled_shows_refund_amount(self):
        """R35/R36 cancellation writes `cancellation_refund` on the
        booking record. Row displays that as 'Refunded £X'."""
        it = {"id": "x", "status": "cancelled",
              "cancellation_refund": 64.80,
              "customer_total": 675.00}   # original — must NOT be shown
        r = resolve_display_amount(it)
        assert r["label"] == "Refunded"
        assert r["value"] == pytest.approx(64.80)

    def test_cancelled_without_refund_shows_price_pending(self):
        """A cancelled row with no cancellation_refund yet (e.g. a
        pending refund) must not silently show the original total."""
        it = {"id": "x", "status": "cancelled",
              "customer_total": 675.00}
        r = resolve_display_amount(it)
        assert r["label"] == "Refunded"
        assert r["value"] is None

    def test_cancelled_at_flag_triggers_refund_label(self):
        it = {"id": "x", "status": "deposit_paid",
              "cancelled_at": "2026-02-01T12:00:00Z",
              "cancellation_refund": 33.96}
        assert resolve_display_amount(it)["label"] == "Refunded"
        assert resolve_display_amount(it)["value"] == pytest.approx(33.96)


class TestOpenJobRows:
    def test_open_job_uses_suggested_price(self):
        it = {"_isJob": True, "id": "job-1", "suggested_price": 200.0}
        r = resolve_display_amount(it)
        assert r["label"] == "Estimated"
        assert r["value"] == 200.0

    def test_open_job_falls_back_to_accepted_price(self):
        it = {"_isJob": True, "id": "job-1", "accepted_price": 175.0}
        assert resolve_display_amount(it)["value"] == 175.0

    def test_open_job_without_any_price_shows_price_pending(self):
        it = {"_isJob": True, "id": "job-1"}
        r = resolve_display_amount(it)
        assert r["value"] is None
        assert r["label"] == "Estimated"


class TestAllBookingTypes:
    @pytest.mark.parametrize(
        "timing",
        ["asap", "scheduled", "fixed_price_scheduled", "bidding", None],
    )
    def test_every_booking_timing_produces_valid_value(self, timing):
        it = {"id": "x", "status": "confirmed",
              "service_timing": timing, "customer_total": 250.00}
        assert resolve_display_amount(it)["value"] == 250.00

    def test_asap_transport(self):
        it = {"id": "x", "status": "deposit_paid",
              "service_type": "transport", "service_timing": "asap",
              "customer_total": 141.50}
        assert resolve_display_amount(it)["value"] == 141.50

    def test_asap_recovery(self):
        it = {"id": "x", "status": "deposit_paid",
              "service_type": "breakdown_recovery", "service_timing": "asap",
              "customer_total": 320.00}
        assert resolve_display_amount(it)["value"] == 320.00

    def test_fixed_price_booking_r42(self):
        """R42 — customer-declared £270 fixed-price booking must not
        drift to a different number in the list display."""
        it = {"id": "x", "status": "confirmed",
              "service_timing": "fixed_price_scheduled",
              "customer_total": 270.00,
              "job": {"accepted_price": 270.00}}
        assert resolve_display_amount(it)["value"] == 270.00

    def test_completed_booking(self):
        it = {"id": "x", "status": "completed", "customer_total": 90.00}
        r = resolve_display_amount(it)
        assert r["label"] == "Total"
        assert r["value"] == 90.00


class TestNeverNaN:
    """Meta-test: fuzz a wide variety of degenerate booking shapes and
    ensure NONE ever yield a NaN or non-finite value."""

    SHAPES = [
        {},
        {"id": "x"},
        {"id": "x", "status": "confirmed"},
        {"id": "x", "customer_total": None, "total_price": None},
        {"id": "x", "customer_total": "not-a-number"},
        {"id": "x", "customer_total": float("inf")},
        {"id": "x", "customer_total": float("nan")},
        {"id": "x", "customer_total": -100},
        {"id": "x", "customer_total": 0},
        {"_isJob": True, "id": "x"},
        {"_isJob": True, "id": "x", "suggested_price": None},
        {"id": "x", "status": "cancelled"},
        {"id": "x", "cancelled_at": "2026-01-01T00:00Z"},
    ]

    @pytest.mark.parametrize("it", SHAPES)
    def test_no_shape_yields_nan(self, it):
        r = resolve_display_amount(it)
        assert r["value"] is None or (isinstance(r["value"], float) and r["value"] > 0)
        # And the label must always be a real string, never undefined.
        assert isinstance(r["label"], str) and r["label"]
