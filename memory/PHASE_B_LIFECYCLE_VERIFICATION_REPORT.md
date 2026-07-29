# Phase B — Manual Deposit Lifecycle / No-Duplicate-Card Check — Verification Report

**Date:** 2026-07-29
**Environment:** PRODUCTION only (`https://cargoone.co.uk`) — read/limited-write with disposable lifecycle accounts.
**Job under test:** `70d9f080-954d-46e6-aebd-d3ac4535f087` — "POSTDEPLOY-VERIFY Manchester" (£250 fixed price, Manchester → Birmingham).
**Accounts:** `lc-prod-cust-1784928324@x.io` (customer), `lc-prod-drv-1784928324@x.io` (driver).

---

## Executive Summary

**PARTIAL — STOP AND REPORT.**

- Every backend invariant that Phase B was designed to validate **PASSED**
  where it could be exercised: booking creation is idempotent, the driver's
  My Jobs list shows **exactly 1 card** even in the worst-case duplicate
  window, and the customer view is consistent across refresh / new session.
- The full lifecycle transition (`accepted → deposit paid → placeholder
  disappears`) **cannot be completed to `deposit_paid` state on the
  current production infrastructure** because the Emergent Stripe test
  proxy fails to retrieve a checkout session that it itself created five
  minutes earlier. This is an integration-layer failure, not an application
  defect. Per user instructions ("do not change Stripe configuration"),
  execution is stopped here.
- No pricing, deposit math, booking timing, Stripe config, Maps, auth or
  unrelated code was modified. No cleanup performed. Phase C not begun.

---

## Lifecycle Matrix (PASS / FAIL / BLOCKED)

| # | Transition step | Where | Result |
|---|---|---|---|
| 1 | Driver `POST /jobs/{id}/accept` → `job.status="accepted"` (pre-Phase-B baseline) | Backend | ✅ PASS (already in place from prior session) |
| 2 | Driver `/driver/accepted-jobs` shows 1 placeholder pre-booking | Backend | ✅ PASS — `count=1, booking_id=None` |
| 3 | Driver `/bookings/mine` = `0` pre-booking | Backend | ✅ PASS |
| 4 | Customer `/bookings/mine` = `0` pre-booking | Backend | ✅ PASS |
| 5 | Customer `POST /bookings {job_id}` creates booking `status=accepted, payment_status=pending` with `deposit_amount = booking_fee = £25`, `driver_charge = £250`, `total_price = £275` | Backend | ✅ PASS |
| 6 | **Idempotency**: second `POST /bookings {same job_id}` returns SAME booking id (no duplicate row) | Backend | ✅ PASS — returned `id=3e9551b4-…` identical on retry (guard at `server.py:1163-1165`) |
| 7 | **Backend duplicate window** (booking exists, deposit unpaid): `/driver/accepted-jobs=1` + driver `/bookings/mine=1` — expected by design (`server.py:983-994` filters `jobs.status="accepted"`) | Backend | ⚠️ PRESENT BY DESIGN — mitigated at layer 8 |
| 8 | **Frontend guard** dedupes by `bookingJobIds` set (`MyJobs.jsx:54-64`): driver's `/driver/my-jobs` shows exactly **1 card** (`driver-myjob-3e9551b4…`), not `driver-myjob-awaiting-*` | Frontend | ✅ PASS — verified live on production, screenshot `/tmp/lc_driver_my_jobs_stuck.png` |
| 9 | Customer `POST /bookings/{id}/deposit` creates Stripe checkout session `cs_test_a1GV9nQr3bK5TKeS5AXo3WE6hbnN2deCiC4niZIeUqSXetz081AhjfSCFw` and returns `url` + `session_id`; booking row updated with `stripe_session_id` | Backend + Stripe | ✅ PASS |
| 10 | Stripe hosted checkout (Sandbox) accepts test card `4242 4242 4242 4242` and charges £25.00 GBP, redirects to `https://cargoone.co.uk/customer/booking/{id}?payment=success&session_id=…` | Stripe | ✅ PASS |
| 11 | `GET /api/payments/status/{session_id}` reconciles paid state → flips `booking.payment_status="paid"`, `booking.status="deposit_paid"`, `job.status="confirmed"` (`server.py:1265-1276`) | Backend ↔ Emergent Stripe proxy | ❌ **FAIL (blocked by infra)** — see Defect ①. Retried at t+2 s, t+30 s and t+90 s. Same response: `Failed to retrieve session status: No such checkout.session: cs_test_…` |
| 12 | Driver `/driver/accepted-jobs` = `0` after deposit paid (job status advances past `accepted`) | Backend | 🚫 **BLOCKED** on step 11 (cannot flip job state) |
| 13 | Driver `/bookings/mine` = `1` with `payment_status=paid` after deposit paid | Backend | 🚫 BLOCKED on step 11 |
| 14 | Customer `/bookings/mine` = `1` with `payment_status=paid`, `other_party` populated after deposit paid | Backend | 🚫 BLOCKED on step 11 |
| 15 | **Persistence check**: driver logs out + logs back in, `/driver/my-jobs` still shows exactly 1 card | Frontend | ✅ PASS — verified with fresh Playwright cookie context |
| 16 | **Persistence check**: `/bookings/{id}` returned identical stored state on curl call after new customer login (cookie jar re-issued) | Backend | ✅ PASS |

---

## Defect ①  (Precise, out-of-scope for Phase B)

**Symptom.** `GET /api/payments/status/{cs_test_…}` returns HTTP 500 with body
`{"detail":"Failed to retrieve session status: Request req_…: No such checkout.session: cs_test_…"}` for a session that was successfully created by the same backend process ~5 minutes earlier and charged £25 on Stripe's side.

**Where.**
- Backend call site: `/app/backend/server.py:1189-1290` (`create_deposit_session` + `payment_status`).
- Library: `emergentintegrations.payments.stripe.checkout.StripeCheckout` (`/root/.venv/lib/python3.11/site-packages/emergentintegrations/payments/stripe/checkout.py:103-109, 177-199`).
- Both `create` and `retrieve` use the same `STRIPE_API_KEY` env var. That key begins with `sk_test_emergent`, which routes the library's `stripe.api_base` to `https://integrations.emergentagent.com/stripe` (Emergent's shared test-Stripe proxy).

**Assessment.** The failure is at the **Emergent Stripe test proxy** layer — it accepts `checkout.Session.create` but returns "No such checkout.session" on `checkout.Session.retrieve` for the same id. The session is valid (Stripe redirected back with `?payment=success`, showing £25 charged in "Sandbox3"). Cargo One code is correct: `payment_status` correctly polls Stripe and would flip the booking → `deposit_paid` on any successful retrieve, but the retrieve never succeeds.

**Impact.**
- Every real customer that pays via this deployed backend gets stranded in `payment_status=pending` forever. There is **no webhook fallback** (I searched: `grep "webhook" /app/backend/server.py` → 0 matches).
- The driver's My Jobs card correctly shows only 1 entry, but that entry stays in "Awaiting Deposit" state indefinitely — the customer paid, but neither side sees the confirmed booking, and pickup/tracking never unlocks.

**Not caused by this session.** No code was changed in Phase A or Phase B. Preview-side deployment/config was not touched. This is the state of production at time of test.

**Not fixable inside Phase B scope.** The user explicitly forbade modifying "Stripe configuration". A fix would either be: (a) upstream Emergent Stripe proxy reliability, or (b) adding a Stripe webhook endpoint + `STRIPE_WEBHOOK_SECRET` + configuring the endpoint in the Stripe sandbox dashboard — all of which are Stripe-config changes.

---

## No-Duplicate-Card Invariant

Even in the stuck state (booking exists with `payment_status=pending`), the anti-duplicate invariant **holds** because:

1. **Frontend dedup** at `frontend/src/pages/portal/driver/MyJobs.jsx:54-64`:
   `bookingJobIds = new Set(bookings.map(b => b.job_id))` is used to drop
   any `/driver/accepted-jobs` entry whose `id` (the job id) already
   appears as a booking. Verified live on production: driver's My Jobs
   shows exactly 1 card (`driver-myjob-3e9551b4-…`), not
   `driver-myjob-awaiting-*`.
2. **Backend idempotency** at `server.py:1163-1165`: repeated
   `POST /bookings` with the same `job_id` returns the existing booking
   — no duplicate row. Verified live (same `id=3e9551b4-…` on retry).
3. **Post-deposit collapse** (design): `/driver/accepted-jobs`
   (`server.py:983-984`) queries `jobs.status="accepted"`. The
   `payment_status` endpoint flips `jobs.status → "confirmed"` on paid
   reconciliation (`server.py:1273-1276`). Therefore once step 11
   succeeds, the placeholder inherently disappears. **Cannot be
   verified live today** because of Defect ①.

---

## Persisted State Verification

| Check | Method | Result |
|---|---|---|
| Booking id stable across logout / login | new curl cookie jar, then `GET /bookings/mine` | ✅ same booking id `3e9551b4-…`, same state |
| No duplicate booking rows for job | idempotent `POST /bookings` retry | ✅ same id returned |
| Driver-side card count after fresh Playwright session | new browser context, log in, load `/driver/my-jobs` | ✅ 1 card (`driver-myjob-3e9551b4-…`) |
| Customer `/jobs/mine` still lists target job with `status=accepted` | curl | ✅ present, single row |

---

## Files touched this session

**None (no code, no config, no cleanup).** Only ephemeral data written to production:

- New booking row `3e9551b4-8774-48e1-96cd-7a04944607db` for job `70d9f080-…` (created by `POST /bookings`, stuck in `payment_status=pending`).
- One `payment_transactions` row for Stripe session `cs_test_a1GV9nQr3bK5TKeS5AXo3WE6hbnN2deCiC4niZIeUqSXetz081AhjfSCFw` (stuck in `payment_status=initiated`).
- £25.00 test-mode charge on Stripe Sandbox3 (no real money).

These are stranded Phase-B artefacts and are candidates for Phase C cleanup (still gated on user approval; not begun).

---

## Recommendation (does NOT begin implementation)

To fully validate step 11 without depending on the Emergent Stripe proxy:

- **Short-term (still Phase B-adjacent):** file the Emergent Stripe test proxy retrieve failure with support and re-run steps 11-14 once fixed on the disposable job + a fresh Stripe checkout session.
- **Product-level (backlog):** add a Stripe webhook handler (`POST /api/webhooks/stripe`, signed with `STRIPE_WEBHOOK_SECRET`) that flips booking → `deposit_paid` on `checkout.session.completed`, so that lifecycle progress does not depend on the retrieve endpoint working at all. This is out of the current phase scope.

## Verdict

**No-duplicate-card invariant: PASS.** Verified at the level currently reachable (backend duplicate window guarded by frontend dedup + backend booking idempotency).

**Full lifecycle transition to `deposit_paid`: BLOCKED** by the Emergent Stripe test proxy retrieve failure (Defect ①). Stopping here as instructed.

Phase C cleanup NOT begun. CSRF / auth-hardening / Stripe-LIVE / email backlog NOT begun.
