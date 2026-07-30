# Cargo One Stripe Migration — Verification Report

**Date:** 2026-02 (this session)
**Scope:** Migrate preview environment from the pod-provided `sk_test_emergent` proxy key to the new dedicated Cargo One Stripe account. Verify checkout, deposits, marketplace bookings, and webhook handling in test mode. No live keys touched.

---

## 1. Credentials swap

| Config | Before | After |
|---|---|---|
| `STRIPE_API_KEY` in `/app/backend/.env` | `sk_test_emergent` (Emergent proxy) | `sk_test_51TyzKZGbGUS6nuaW…` (real Cargo One test key) |
| `STRIPE_WEBHOOK_SECRET` | *not set* | *pending user — awaiting `whsec_…`* |

Codebase cleanup:
- All `Emergent proxy`, `Emergent Stripe`, `sk_test_emergent` references removed from `/app/backend/server.py` and `/app/backend/tests/*` comments/docstrings.
- Verified: `grep -rn "Emergent proxy\|Emergent Stripe\|sk_test_emergent" /app/backend /app/frontend/src` → **0 matches**.

No functional code changes were required — the Stripe wiring was already env-driven (`STRIPE_API_KEY`, `STRIPE_WEBHOOK_SECRET`) and uses `emergentintegrations.StripeCheckout`, which routes to real `api.stripe.com` when given a real key.

---

## 2. Account verification (against `api.stripe.com` with the new key)

```
GET https://api.stripe.com/v1/account
→ id:               acct_1TyzKZGbGUS6nuaW
→ country:          GB
→ default_currency: gbp
→ email:            admin@cargoone.co.uk
→ livemode:         null   (test mode)
```

Confirmed the key belongs to the new Cargo One test account.

---

## 3. Verified test scenarios (all in preview)

### 3.1 Marketplace scheduled booking — FULL BROWSER E2E ✅
| Step | Result |
|---|---|
| Customer posts fixed-price job (London → Bristol, £210) | ✅ `job_id=da1a587c-e841-4cbc-827a-7c48b228b35a` |
| Driver clicks "Accept" (`POST /api/jobs/{id}/accept`) | ✅ `{"ok":true}` |
| Customer creates booking (`POST /api/bookings`) | ✅ `booking_id=204de0f6-bed6-40bb-9c5b-5906f2979e56`, deposit=£25 |
| Customer clicks "Pay £25.00 Booking Fee" in UI | ✅ redirects to `https://checkout.stripe.com/c/pay/cs_test_a1LA5SrO…` |
| Stripe hosted page shows **"Cargo One sandbox · Sandbox"** | ✅ confirms new account |
| Currency locked to GBP £25.00 | ✅ |
| Card `4242 4242 4242 4242` / `12/34` / `123` / UK / `testcustomer@example.com` | ✅ |
| Payment cleared on Stripe | ✅ Payment Intent `pi_3Tz3GyGbGUS6nuaW1DPS8Z3y` |
| Redirect back to `/customer/booking/{id}?payment=success&session_id=…` | ✅ |
| Booking flipped to `status=deposit_paid`, `payment_status=paid`, `paid_at=2026-07-30T23:21:59Z` | ✅ |
| UI shows **"Deposit Paid"** pill; driver contact revealed | ✅ |

Finalisation was driven by `/api/payments/status/{session_id}` polling (which uses `stripe.checkout.Session.retrieve` live against Stripe). Once `whsec_…` is added and the Dashboard endpoint is registered, the webhook path will pre-empt the poller.

### 3.2 ASAP Vehicle Recovery deposit ✅
| Step | Result |
|---|---|
| Customer posts ASAP recovery job (Cobham → Guildford, £140, breakdown_recovery, VW Golf) | ✅ `job_id=fd570062-d06c-4db2-a41c-4576061aa0d3` |
| Customer creates ASAP booking (pre-claim, `driver_id=None`) | ✅ `booking_id=ec2b0ebc-546b-4fd1-888e-4ae32d30035c` |
| Deposit checkout session created | ✅ `cs_test_a18wTeUlEodP9djFLmM4MZBPhgr6SJ26hDy7ZjSNvyj6hQSPH9y3TqqMY7` |
| Session verifiable on new Cargo One account | ✅ currency=gbp, amount=2500p, livemode=false |
| Metadata includes `booking_id`, `webhook_url` with per-session token | ✅ |

Uses the identical `POST /api/bookings/{id}/deposit` code path as Marketplace; no divergence.

### 3.3 Webhook finalisation logic (synthetic payload) ✅
Tested the security posture of `/api/webhook/stripe` before real webhook secret is installed:

| Request | Expected | Actual |
|---|---|---|
| Signed `checkout.session.completed`, **wrong** or missing `?t=<token>` | 403 | ✅ `HTTP 403 {"detail":"Webhook token invalid"}` |
| Signed `checkout.session.completed`, correct `?t=<token>` | 200, booking finalised | ✅ `HTTP 200 {"ok":true, "finalised":true}` and booking `deposit_paid` |
| Duplicate delivery of same signed event | 200, idempotent (no double-finalise) | Already covered in `test_payment_finalisation.py` (`test_webhook_duplicate_delivery`) |

### 3.4 Backend regression pytest ✅
```
tests/test_payment_finalisation.py             → 15 passed
tests/test_payment_and_csrf_security.py        →  4 passed
tests/test_realtime_dispatch.py                → 21 passed
--------------------------------------------------------
TOTAL                                          → 40/40 passed
```

No regressions introduced by the credential swap or docstring cleanup.

---

## 4. Still pending (needs user action)

### 4.1 Register webhook endpoint in Stripe Dashboard
User will do this themselves. Endpoints to register:
- **Preview** (for our verification work): `https://cargo-repo-bridge.preview.emergentagent.com/api/webhook/stripe`
- **Production** (ready for launch): `https://cargoone.co.uk/api/webhook/stripe`

Events to enable on **each** endpoint:
- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`

After creating the preview endpoint, user will paste the `whsec_…` value here.

### 4.2 Add `STRIPE_WEBHOOK_SECRET` to backend `.env`
Once the `whsec_…` arrives:
1. Add `STRIPE_WEBHOOK_SECRET=whsec_…` to `/app/backend/.env`
2. `sudo supervisorctl restart backend`
3. Trigger `stripe.Webhook.construct_event` path by either:
   - Clicking "Send test webhook → `checkout.session.completed`" from the Stripe Dashboard endpoint page, or
   - Running a second real browser checkout with a 4242 card and observing the webhook fire directly

### 4.3 Live-mode switch (user-only)
When launch-ready, user will:
- Toggle Stripe Dashboard to Live mode
- Copy new `sk_live_…` and `whsec_…` from live-mode webhooks
- Add them to production secrets (**agent must not receive live keys**)
- Redeploy — no code changes required

---

## 5. Files touched in this migration

| File | Change |
|---|---|
| `/app/backend/.env` | `STRIPE_API_KEY` swapped |
| `/app/backend/server.py` | 5 doc-comment cleanups removing Emergent-proxy references (lines ~84, 130, 1650, 1725, 1788, 1844) — **zero functional changes** |
| `/app/backend/tests/test_payment_finalisation.py` | 2 docstring cleanups; tests unchanged |

---

## 6. Ready for launch

Once the webhook secret is installed and one round of dashboard-signed webhook verification passes, the preview environment is fully green. Adding the live `sk_live_…` + `whsec_…` to production secrets is a **pure configuration swap** — no code changes required.
