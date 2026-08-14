"""R35 / R36 — Cancellation policy: deposit-only fee, platform-wide.

Tests the pure calculator (`_compute_cancellation_fee`) with the exact
scenarios from the product brief:

  Total booking:  £675
  Deposit paid:   £81
  Cancellation %: 20%
  → Fee:          £16.20
  → Refund:       £64.80
  Driver never sees the remaining £594 balance.

Plus:
- Pre-driver-accept cancels are free (full deposit refund).
- Post-driver-accept cancels charge the fee.
- Fee is CAPPED at the deposit itself (can never exceed).
- Min/max fee configuration is honoured.
- Endpoint file structure guarantees the R36 platform-wide change (no
  ASAP-only gate on the cancel endpoint) and that the anti-bypass
  counter is updated only post-accept.
"""
from __future__ import annotations

import re
from pathlib import Path

import pytest

# Import calculator directly.
import sys
sys.path.insert(0, "/app/backend")
from server import _compute_cancellation_fee, DEFAULT_CANCELLATION_POLICY


SRC = Path("/app/backend/server.py").read_text()


# ── (1) Product-brief example — £81 deposit, 20% policy, driver accepted ─
def test_brief_example_81_deposit_20pct_post_accept():
    r = _compute_cancellation_fee(81.0, DEFAULT_CANCELLATION_POLICY, driver_accepted=True)
    assert r["deposit_paid"] == 81.00
    assert r["cancellation_pct"] == 20.0
    assert r["cancellation_fee"] == 16.20
    assert r["refund_amount"] == 64.80
    assert r["driver_accepted"] is True
    assert r["requires_fee"] is True
    assert r["policy_applied"] is True


# ── (2) Pre-driver-accept = full refund, no fee ────────────────────────
def test_pre_accept_full_refund():
    r = _compute_cancellation_fee(81.0, DEFAULT_CANCELLATION_POLICY, driver_accepted=False)
    assert r["cancellation_fee"] == 0.0
    assert r["refund_amount"] == 81.00
    assert r["requires_fee"] is False
    assert r["policy_applied"] is False


# ── (3) Fee is capped at the deposit — never negative refund ───────────
def test_fee_capped_at_deposit():
    # 150% policy — sanity: fee still can't exceed deposit
    policy = {**DEFAULT_CANCELLATION_POLICY, "percentage": 150.0}
    r = _compute_cancellation_fee(50.0, policy, driver_accepted=True)
    assert r["cancellation_fee"] == 50.00
    assert r["refund_amount"] == 0.00


# ── (4) Min fee floor honoured ─────────────────────────────────────────
def test_min_fee_floor():
    # £10 deposit × 5% = £0.50, but min_fee = £2.
    policy = {**DEFAULT_CANCELLATION_POLICY, "percentage": 5.0, "min_fee": 2.0}
    r = _compute_cancellation_fee(10.0, policy, driver_accepted=True)
    assert r["cancellation_fee"] == 2.00
    assert r["refund_amount"] == 8.00


# ── (5) Max fee ceiling honoured ───────────────────────────────────────
def test_max_fee_ceiling():
    # £500 deposit × 40% = £200, but max_fee = £50.
    policy = {**DEFAULT_CANCELLATION_POLICY, "percentage": 40.0, "max_fee": 50.0}
    r = _compute_cancellation_fee(500.0, policy, driver_accepted=True)
    assert r["cancellation_fee"] == 50.00
    assert r["refund_amount"] == 450.00


# ── (6) Zero / negative deposit is safely clamped ──────────────────────
def test_zero_deposit_safe():
    r = _compute_cancellation_fee(0.0, DEFAULT_CANCELLATION_POLICY, driver_accepted=True)
    assert r["deposit_paid"] == 0.00
    assert r["cancellation_fee"] == 0.00
    assert r["refund_amount"] == 0.00


def test_negative_deposit_clamped():
    r = _compute_cancellation_fee(-100.0, DEFAULT_CANCELLATION_POLICY, driver_accepted=True)
    assert r["deposit_paid"] == 0.00
    assert r["cancellation_fee"] == 0.00
    assert r["refund_amount"] == 0.00


# ── (7) applies_after_driver_accept=False → fee always applies ─────────
def test_fee_always_when_config_disables_gate():
    policy = {**DEFAULT_CANCELLATION_POLICY, "applies_after_driver_accept": False}
    r = _compute_cancellation_fee(81.0, policy, driver_accepted=False)
    assert r["cancellation_fee"] == 16.20
    assert r["refund_amount"] == 64.80
    assert r["requires_fee"] is True


# ── (8) Fee NEVER references full booking value ────────────────────────
def test_fee_only_from_deposit_not_booking_total():
    """Regression guard for the brief's core rule."""
    # £675 booking, £81 deposit — even at 100%, fee must be capped at £81.
    policy = {**DEFAULT_CANCELLATION_POLICY, "percentage": 100.0}
    r = _compute_cancellation_fee(81.0, policy, driver_accepted=True)
    # Fee is 100% of DEPOSIT = £81, not 100% of £675.
    assert r["cancellation_fee"] == 81.00
    assert r["refund_amount"] == 0.00
    # Verify we haven't referenced the £675 booking total in the calc.
    assert r["deposit_paid"] == 81.00


# ── (9) R36 — no ASAP-only gate on the cancel endpoint ─────────────────
def test_cancel_endpoint_applies_platform_wide():
    """The R36 hardening removed the ASAP-only guard. Verify by
    string-checking the endpoint body: the old error message must be gone.
    """
    assert 'only for ASAP bookings' not in SRC, (
        "R36 requires the cancel endpoint to work across ALL job types "
        "(ASAP + scheduled + fixed + bidding). The ASAP-only 400 gate must "
        "be removed."
    )
    # And the R36 comment marker is present.
    assert "R36 — Cancellation applies platform-wide" in SRC


# ── (10) Admin config endpoints exist ──────────────────────────────────
def test_admin_config_endpoints_present():
    assert '@api.get("/admin/cancellation-policy")' in SRC
    assert '@api.put("/admin/cancellation-policy")' in SRC
    # Policy is a Pydantic model with validation.
    assert "class CancellationPolicyIn" in SRC


# ── (11) Customer preview endpoint present ─────────────────────────────
def test_customer_preview_endpoint_present():
    assert '@api.get("/customer/bookings/{booking_id}/cancel-preview")' in SRC


# ── (12) Anti-bypass counter increments only post-accept ───────────────
def test_anti_bypass_counter_gated_on_driver_accept():
    # The increment must be inside a branch checking driver_accepted.
    m = re.search(
        r'if\s+breakdown\["driver_accepted"\]:.*?post_accept_cancel_count',
        SRC, re.DOTALL,
    )
    assert m, "Anti-bypass counter must ONLY increment when driver_accepted=True"


# ── (13) Admin flagged-customers endpoint exists ───────────────────────
def test_admin_flagged_customers_endpoint():
    assert '@api.get("/admin/customers/flagged")' in SRC


# ── (14) Refund uses breakdown.refund_amount, not full deposit ─────────
def test_refund_uses_breakdown_amount_not_full_deposit():
    m = re.search(
        r'amount=int\(round\(float\(breakdown\["refund_amount"\]\)\s*\*\s*100\)\)',
        SRC,
    )
    assert m, (
        "The Stripe refund must use breakdown['refund_amount'] (deposit "
        "minus fee), not the full deposit_amount."
    )


# ── (15) Booking persists cancellation_breakdown ───────────────────────
def test_booking_persists_cancellation_breakdown():
    assert '"cancellation_breakdown"' in SRC, \
        "Booking record must persist the cancellation breakdown for later display"


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))
