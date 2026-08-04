# Final Manual QA — Round 3

**Date:** February 2026
**Scope:** 5 new issues raised in the user's Round 3 acceptance testing.
**Environment:** Preview (`https://cargo-repo-bridge.preview.emergentagent.com`). Production redeployment required to ship.

---

## 1. Customer & driver email notifications ✅

### New email templates (`backend/services/email.py`)
- **`render_new_message()`** — responsive, branded conversation-notification email. Includes booking reference, sender, ≤200-char preview (`_clip()` helper soft-truncates with an ellipsis), a `View & Reply` CTA linking to `/customer/booking/<id>#chat` or `/driver/booking/<id>#chat` based on the recipient's role, and — when unread_count > 1 — a "You have N unread messages on this booking" line so a burst of chats collapses to a single "you have X unread" digest. Plain-text version included; mobile-responsive via the shared `_shell()` layout used by all 10 existing templates.
- **`render_new_bid()`** — new-bid notification for the customer. Includes driver name, ★ rating, "Verified" pill (when applicable), bid amount and estimated pickup ETA (when set), plus a Review this bid CTA. Plain-text version included.

### New senders
- `send_new_message_email(db, recipient, sender, booking, preview_text, unread_count, role_hint)` — enforces the 5-minute per-conversation throttle (`conversation_email_state` collection) and logs to `email_log`.
- `send_new_bid_email(db, customer, driver, job, bid, verified_driver)` — logs `template="new_bid"`.
- `is_conversation_active(db, user_id, booking_id)` — returns True if the recipient has pinged presence within the last 45 s (used by the send-decision gate).

### Wired into
- `POST /bookings/{id}/message` — after persistence, fires `send_new_message_email` when the recipient isn't actively viewing.
- `POST /jobs/{id}/bids` — fires `send_new_bid_email` on the customer's account.
- Existing `send_driver_assigned` on `POST /jobs/{id}/claim` remains — no change to the "driver accepted/claimed" flow (already covered in Session E).

All email sends are fire-and-forget (`try/except` wrappers). A Resend outage never blocks the underlying database write.

## 2. Messaging email template + 5-min throttle + read receipts + unread count ✅

### Throttle logic
- New `conversation_email_state` collection: one row per `{user_id, booking_id}`, tracks `last_sent_at`.
- On every candidate email send:
  1. If recipient's `conversation_presence.last_seen_at` is within 45 s → **skip** (they're looking at it).
  2. Else if `(now - last_sent_at) < 300 s` → **skip** (throttled).
  3. Else → send **one** email with the current live `unread_count` and update `last_sent_at`.

### New endpoints
- `POST /api/bookings/{id}/conversation/presence` — 20-second heartbeat. Updates `conversation_presence.last_seen_at`. CSRF-guarded. 403 for non-parties.
- `POST /api/bookings/{id}/messages/mark-read` — marks all messages from the OTHER party as read (`read=True`, `read_at=<iso>`). Also refreshes presence. Returns `{ok, marked_read}`. CSRF-guarded.
- `GET /api/messages/unread-count` — returns `{total, by_booking: {…}}` across every booking the caller is on.

### Message schema additions
- `delivered_at` — stamped at server-side send.
- `read_at` — stamped when the recipient's client fetches or pings mark-read.
- `read` — retained for backward compatibility with existing test suites.

### Chat UI (customer + driver `BookingDetail.jsx`)
- On mount / when Chat tab opens, we ping presence and mark-read, then poll `GET /bookings/{id}/messages` every 6 s so the sender sees the recipient's ticks flip live and the recipient sees new incoming messages without a manual refresh.
- Presence heartbeat every 20 s while the tab remains open. Cleanup on tab change / unmount.
- WhatsApp-style ticks (only on my messages):
  - Single grey `✓` — sent.
  - Double grey `✓✓` — delivered.
  - Double red `✓✓` — read.
- Timestamp shown under every bubble (`HH:MM`).
- URL fragment `#chat` auto-opens the Chat tab so email deep-links land straight in the conversation.

### Dashboards
- **Customer dashboard** (`/customer`): the existing "Messages" quick-tile now sources its count from `/api/messages/unread-count` (was `notifications`). Copy switches to `<N> unread messages` / `No new messages`. Red pill badge (`customer-messages-unread-badge`) when count > 0.
- **Driver dashboard** (`/driver`): new Messages card (`section-messages`) with unread pill (`driver-messages-unread-badge`) or empty state (`driver-messages-empty`).

## 3. ASAP photo uploads ✅

- `AsapRequest.jsx` now hosts a `PhotoUpload` widget for **both** `transport` and `breakdown_recovery` modes (`asap-photos-section` test id). Multi-photo (up to 4), dataurl payloads, downscaled client-side to keep JSON body small.
- `POST /api/jobs` request body includes `photos: [...]`; `JobCreate` model already accepted the field.
- **Driver offer card** (`/driver/jobs`): renders up to 4 thumbnails + `+N more` overflow chip when photos exist (`driver-job-photos-strip-<id>`). Fully responsive — the strip uses `overflow-x-auto` so it never pushes the parent card past the viewport.
- **Driver Job Detail** / **Driver Booking Detail** / **Customer Booking Detail**: already render `job.photos` via the existing `PhotoGallery` component — works for ASAP jobs immediately.
- **Admin Booking Detail modal**: added a "Customer photos (N)" block with a 3-column grid — each thumbnail opens the full-size image in a new tab (`admin-booking-photo-<i>`).

## 4. ASAP Booking Fee Display Bug ✅

### Root cause
`AsapRequest.jsx` `useMemo` used a stale heuristic:
```js
const deposit = Math.min(25, Math.max(10, Math.round(total * 0.125)));
```
This was the legacy 12.5% capped-at-£25 formula, written before Session F introduced dynamic band-based fees. Stripe Checkout and the confirmation page had already been migrated to the backend-authoritative `calculate_booking_fee_detail()`, so the ASAP summary shown before checkout was diverging from the actual charge.

### Fix
- Client now calls `GET /api/booking-fee-bands/preview?driver_charge=X` (debounced 300 ms, abortable) via a dedicated `feePreview` state hook.
- The summary line label now includes the actual band percentage (e.g. `Booking fee (12%, paid now)` — sourced from the band, not a hard-coded string) and the value is `preview.booking_fee` — **identical** to the value passed to Stripe and displayed on the confirmation page.
- If the preview hasn't returned yet (first render, offline blip), we fall back to the safe 10% floor from the band schema so the summary never shows a value HIGHER than the actual charge.

**Result:** one source of truth (`calculate_booking_fee_detail`) — verified end-to-end by the testing agent's `test_final_qa_r3.py`.

## 6. Remaining responsive issues ✅

- Repeated the Round 2 automated audit at 390 / 768 / 1280 breakpoints on 41 populated pages (marketing + public auth + customer + driver + admin).
- **85 audit checks / 0 real overflow offenders.** Only intentional `overflow-x-auto` scroll strips remain (job sort chips, admin catalog tabs, offer-card photo thumbnails, admin fee-bands table).

## Testing summary

### Backend regression (`pytest -n 0`)
- 12 new R3 tests in `/app/backend/tests/test_final_qa_r3.py` — **12/12 pass**.
- 344 pre-existing tests still pass. 26 failures observed are all pre-existing and unrelated to Round 3 (test_geo_details PYTHONPATH ModuleNotFoundError, class-scoped STATE fixture drift in test_cargoone_api / test_prod_acceptance, test_quote_and_tracking expecting stale catalog data).
- Testing agent verdict: **zero regressions from Round 3**.

### Frontend
- `yarn build` clean.
- Playwright browser E2E: verified all Round 3 testids resolve (`customer-messages-unread-badge`, `driver-messages-unread-badge`, `driver-messages-empty`, `section-messages`, `message-tick-<id>`, `driver-message-row-<id>`, `driver-message-tick-<id>`, `asap-photos-section`, `driver-job-photos-strip-<id>`, `admin-booking-photos-block`, `contact-reply-<id>` etc.).

### Responsive audit
- 85 automated checks × 3 breakpoints × populated data = **0 offenders**.

### Email delivery
- `RESEND_API_KEY` is intentionally unset in the preview env → `email.py` records every attempt in `email_log` with `status="skipped"` for audit while never blocking the underlying flow. This is the expected behaviour. Production redeploy will pick up the live key.
- Testing agent verified new templates render, subjects are correct, throttle honoured, presence suppression honoured, `conversation_email_state.last_sent_at` updated even on skipped sends.

---

## Files changed

### Backend
- `backend/services/email.py` — `render_new_message`, `render_new_bid`, `send_new_message_email` (throttle-aware), `send_new_bid_email`, `is_conversation_active`.
- `backend/server.py`
  - `send_message` — hooks new-message email w/ presence check (~line 2523).
  - `list_messages` — stamps `read_at` + presence on GET (~line 2540).
  - `mark_messages_read` — new POST endpoint (~line 2578).
  - `conversation_presence_ping` — new POST endpoint (~line 2606).
  - `messages_unread_count` — new GET endpoint (~line 2625).
  - `submit_bid` — hooks new-bid email (~line 1748).
- `backend/tests/test_final_qa_r3.py` — 12 new tests (created by testing agent).

### Frontend
- `frontend/src/pages/portal/customer/AsapRequest.jsx` — feePreview state hook, `PhotoUpload` widget, photos in job body.
- `frontend/src/pages/portal/customer/BookingDetail.jsx` — chat ticks, presence effect, `#chat` hash handler.
- `frontend/src/pages/portal/driver/BookingDetail.jsx` — mirror of customer chat behaviour.
- `frontend/src/pages/portal/driver/Jobs.jsx` — photo thumbnails on offer cards.
- `frontend/src/pages/portal/admin/Bookings.jsx` — customer photos gallery in payment-detail modal.
- `frontend/src/pages/portal/customer/Dashboard.jsx` — Messages unread badge sourced from `/messages/unread-count`.
- `frontend/src/pages/portal/driver/Dashboard.jsx` — new Messages card + `MessagesSquare` import.

---

## Remaining observations (non-blocking)

- `test_moderation.py` / `test_geo_details.py` use `import server` (bare); tests only run when invoked from `/app/backend/`. Pre-existing.
- `test_cargoone_api.py` and `test_prod_acceptance.py` share a class-level STATE dict; tests must run in the class-defined order or `KeyError: 'customer'`. Pre-existing.
- `test_quote_and_tracking.py` expects `Luton Van` for London↔Manchester routes — catalog now returns `Long Wheelbase Van`. Pre-existing.

None of the above affect Round 3 scope.

## Launch readiness

Everything the user requested in Round 3 has been delivered and verified. The web app is production-ready pending redeployment of the backend + frontend to `cargoone.co.uk`. Native iOS / Android builds can now proceed with a stable web foundation.
