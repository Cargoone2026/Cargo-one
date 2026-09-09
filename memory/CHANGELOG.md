# Cargo-One CHANGELOG (R71 iOS mobile work)

## 2026-02 — Stripe prod-key diagnosis + AddressAutocomplete VirtualizedList fix
- P0 (Stripe deposit-intent): Diagnosis complete — production `STRIPE_API_KEY` is set to the placeholder string `sk_test_emergent` (16 chars, last 4 = "gent", exact match of the on-device error `sk_test_****gent`). Same placeholder is in `/app/backend/.env`. Backend code (`server.py:65 STRIPE_API_KEY = os.environ["STRIPE_API_KEY"]` + all Stripe calls) is correct; the secret value is not. Fix must be done in the production deployment environment variables (Emergent deploy → env vars → set `STRIPE_API_KEY` to the real `sk_test_...` from https://dashboard.stripe.com/test/apikeys, then redeploy/restart backend). No code change made to backend per user instruction.
- P1 (VirtualizedList warning): Root cause = `AddressAutocomplete.tsx` Modal rendered `<Page bg={colors.bg}>` (defaults `scroll=true` → wraps children in `ScrollView`) with a `<FlatList>` inside for suggestions. Fixed by adding `scroll={false}` to that Page and wrapping the manual-review branch in its own local `ScrollView`. Search-mode FlatList is now the top-level scroller. `Asap.tsx` unchanged (already had `scroll={false}`).


## 2026-09-08 — a8dcc4f — Post-device R27.12 Bids + Stripe hardening
- Backend: Stripe REST helpers now log actual error payload; API version pinned to `2023-10-16`; zero-deposit guard returns 400 early instead of an opaque 502.
- Mobile: Fixed `Bids` screen `Accept bid` (was hitting non-existent `/jobs/{jobId}/bids/{bidId}/accept` → 404). Now uses `POST /bids/{bidId}/accept` then `POST /bookings` then navigates to Payment.
- Mobile: `Bids` screen back button added; duplicate-tap protection; nested-scroll warning fixed on Bids + reviews modal.

## 2026-09-07 — d4f3477 — Payment-required Dispatch state
- Added 6th Dispatch state variant `payment_required` so failed/unpaid bookings no longer say "Looking for a driver".
- Inline "Retry payment" primary button in Dispatch bottom-sheet — no longer requires pressing Cancel first.
- `Asap.tsx` `<Page scroll={false}>` to close residual VirtualizedLists warning.

## 2026-09-06 — 9d2f79d — Native Stripe PaymentSheet + universal cancel
- Backend: `POST /bookings/{id}/deposit-intent`, `GET /payments/pi-status/{pi}`, `POST /customer/bookings/{id}/cancel`.
- Mobile: `Payment.tsx` rewritten to use Stripe PaymentSheet (in-app card + Apple Pay). Retry-safe (backend reuses same PI). Failed payment keeps booking alive with inline Retry.
- Mobile: `Dispatch.tsx` gains PageHeader back button, cancel busy state, `Cancel & request refund` copy for paid bookings.

## 2026-09-05 — 5d397a6 — ASAP web-parity Dispatch data flow
- Fixed "Preparing your route" stuck state: bookingId resolved via `myBookings()`; coords from `booking.job`; `current_search_radius_miles` surfaced.
- Web-parity redirect from `BookingDetail` to `Dispatch` for active ASAP bookings.
- Backend deposit-paid push wording branches on ASAP vs scheduled.

## 2026-09-04 — 3a2bc66 — Map-consistency + ASAP Uber-like Dispatch (initial)
- `BookingDetail` RouteMap fallback for non-active statuses.
- `JobDetail` RouteMap when coords present.
- `Dispatch` rewritten as Uber-like full-bleed map with polling + top status pill + bottom sheet.

## 2026-09-04 — 1ebb893 — Icon + Splash + dev-client verified
Tag: `customer-devclient-verified-2026-09-04`

## 2026-09-04 — 338077b — Push notifications production-verified
Tag: `customer-push-verified-2026-09-04` (KNOWN-GOOD Customer push baseline)
