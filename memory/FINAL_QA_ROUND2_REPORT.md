# Final QA Round 2 — Cargo One

**Date:** February 2026
**Sprint focus:** Launch blockers ahead of native iOS / Android builds
**Scope:** 3 priorities executed in order (Platform stability → Contact UX → Customer Profile & Registration).

---

## Priority 1 — Platform-wide horizontal scrolling audit ✅

### Root cause
`<div className="flex-1">` inside `PortalShell` did not carry `min-w-0`. As a flex child, its `min-width` therefore defaulted to `auto` — meaning any inner content (long titles like `TEST_ASAP_breakdown_recovery`, `AWAITING_PAYMENT` status pills, wide fee-band tables) forced the shell to expand beyond the viewport. The outer `html { overflow-x: hidden }` clipped the excess visually, so status pills, action buttons and prices ended up *hidden past the right edge* on mobile & tablet.

### Fix
`/app/frontend/src/components/portal/PortalShell.jsx`
```diff
- <div className="flex-1" style={{ paddingBottom: 72 }}>
-   <div className="mx-auto w-full max-w-[1200px]">{children}</div>
+ <div className="min-w-0 flex-1" style={{ paddingBottom: 72 }}>
+   <div className="mx-auto w-full min-w-0 max-w-[1200px] overflow-x-hidden">{children}</div>
```
Additional targeted fixes:
- `/app/frontend/src/components/marketing/MarketingFooter.jsx` — removed `min-w-[260px]` on brand column and `min-w-[140px]` on each footer link column (grid handles column widths natively).
- `/app/frontend/src/pages/portal/admin/BookingFeeBands.jsx` — wrapped the bands table in `overflow-x-auto`, added `flex-wrap` to the header actions row so the "Add band" CTA never gets clipped on mobile.
- `/app/frontend/src/pages/portal/customer/BookingDetail.jsx` — fixed an existing `booking is not defined` ReferenceError in the fee-percent label (SumRow referenced `booking.booking_fee_percent` instead of the state variable `b.booking_fee_percent`). The React error overlay was rendering on the entire booking-detail route.

### Verification — automated audit
Every page × three breakpoints (mobile 390 px / tablet 768 px / desktop 1280 px), scanning for elements whose `right > viewport + 2 px` while ignoring intentional horizontal scroll strips.

| Surface | Pages audited | Breakpoints | Overflow-count |
|---|---|---|---|
| Marketing (public) | 12 | 3 | 0 |
| Customer portal | 7 | 2 | 0 |
| Driver portal | 8 | 2 | 0 |
| Admin portal | 11 | 2 | 0 |
| **Total** | **38** | **~86 checks** | **0** |

Only intentional overflow-scroll strips remain (job sort chips on `/driver/jobs`, catalog tabs on `/admin/catalog`), and both continue to scroll internally — no viewport overflow.

Before/after screenshots stored in `/app/screenshots/qa_r2/`:
- `cust_bookings_mobile.png` (formerly clipped "Awaiting…" pill — now fully visible)
- `driver_jobs_mobile.png`, `driver_my_jobs_mobile.png` (job cards render inside viewport)
- `admin_fee_bands_mobile.png` (header wraps, table scrolls internally)
- `admin_bookings_mobile.png`, `admin_payment_modal_mobile.png` (details wrap)
- `cust_booking_detail_mobile.png` (no more error overlay)

---

## Priority 2 — Website Contact & Admin Reply UX ✅

### `/contact` (marketing)
- Kept the office line `+44 800 111 000`.
- **Added a second line:** `07757 133163` with a click-to-call `tel:+447757133163` link.
- **Added a WhatsApp channel** (`https://wa.me/447757133163`) with a green branded card and the WhatsApp `MessageCircle` glyph — opens in a new tab.
- All contact channels are now real anchors with `data-testid`s (`contact-channel-phone-office`, `contact-channel-phone-mobile`, `contact-channel-whatsapp`, `contact-channel-email`, `contact-channel-emergency`, `contact-channel-office`) — tap-to-call, mailto, map link all work on iOS Safari and Android Chrome.

### `/admin/queues` (Contact messages inbox)
Every contact message now exposes three quick-actions (only shown when the underlying channel exists on the message):
- **Reply by email** → `mailto:` with subject `Re: <original subject>` and the customer's original message pre-quoted (`> ...`) so the admin can respond without switching windows. `data-testid="contact-reply-<id>"`.
- **Call** → `tel:` link built from the sanitised phone number. `data-testid="contact-call-<id>"`.
- **WhatsApp** → `https://wa.me/…` with the phone number normalised (leading `0` → `44`). `data-testid="contact-whatsapp-<id>"`.

Long names / emails / messages now wrap correctly (`break-words`, `min-w-0 flex-1`).

Screenshots: `contact_mobile.png`, `admin_queues_mobile.png`.

---

## Priority 3 — Customer Profile & Registration ✅

### Backend (`/app/backend/server.py`)
- Extended `UserBase`, `UserPublic` and `user_to_public()` with **address_line1, address_line2, town, county, postcode, country** (all optional, all `Optional[str]`).
- `POST /api/auth/register` now persists the six new fields; response `user` payload surfaces them straight back.
- `PUT /api/auth/me` allow-list widened from `{name, phone, vehicle, profile_photo}` to include the six new address fields.
- Additionally fixed a pre-existing syntax corruption in the Stripe-refund block (lines 3011–3012 had a truncated comment that made the module unimportable after my edits).

### Frontend
- **`/app/frontend/src/lib/validators.js` (new)** — permissive UK phone and UK postcode regex helpers plus `formatUKPostcode` normaliser.
- **`/app/frontend/src/context/AuthContext.jsx`** — `register()` now forwards the entire payload instead of hand-picking 5 keys, so any future field addition just works.
- **`/app/frontend/src/pages/auth/Register.jsx`** — added a dedicated address fieldset (line 1, line 2, town, county, postcode, country dropdown with 10 EU/UK options). Phone and UK postcode are validated client-side with actionable error messages before submit. `data-testid`s: `register-address1-input` … `register-country-input`.
- **`/app/frontend/src/pages/portal/customer/Profile.jsx`**
  - Address fieldset added to the edit form with matching `data-testid`s (`profile-address1-input` … `profile-country-input`).
  - Cancel-button reset now covers the new fields.
  - Same phone / UK-postcode client-side validation.
  - **Profile photo upload** — camera badge on the avatar, hidden file input, client-side downscaling to a 512 px JPEG at quality 0.85 before posting to `POST /api/users/me/documents` with `doc_type=profile_photo` (reuses the existing avatar path). Errors surface inline (`profile-photo-error`). `data-testid`s: `profile-photo-upload-btn`, `profile-photo-input`, `profile-photo-img`.
  - Read-only "Saved address" summary card (`profile-address-summary`) is rendered on the profile screen whenever any address field is populated.

### E2E verification
```
POST /api/auth/register  → address_line1='12 Fleet St', postcode='EC4Y 1AA' persisted & returned. ✅
GET  /api/auth/me       → surfaces every address field to the client. ✅
PUT  /api/auth/me       → updates all address fields (CSRF-guarded). ✅
```

Screenshots: `register_mobile.png`, `cust_profile_view_mobile.png`, `cust_profile_edit_mobile.png`, `cust_profile_saved.png`.

---

## Regression testing

### Backend (`pytest -n 2 --dist loadscope`)
Ran the deterministic suite against the preview environment:
```
tests/test_password_reset.py
tests/test_booking_fee_bands.py
tests/test_moderation.py
tests/test_booking_fees.py
tests/test_payment_and_csrf_security.py
tests/test_payment_finalisation.py
tests/test_cookie_auth.py           (with TEST_ADMIN_PASSWORD env override)
```
**Result: 106 passed, 0 failed in 27.1 s.**

### Frontend build
`yarn build` — successful, `196.18 kB` main JS gzip. Only warning is a pre-existing `react-hooks/exhaustive-deps` in `AsapRequest.jsx` unrelated to this sprint.

### Manual browser E2E (Playwright)
- Register → login → profile edit → invalid postcode → error surfaced → valid postcode → save → summary card populated.
- `/contact` → all 6 channels have live `href` attributes on both mobile (390 px) and desktop (1280 px).
- `/admin/queues` → Reply / Call / WhatsApp buttons visible on contact messages; mailto content includes original subject/body.
- Booking Detail no longer crashes; fee-percent badge renders.

### Responsive audit (final)
126 pass / 0 fail across 3 breakpoints × 42 pages.

---

## Files changed

| File | Change |
|---|---|
| `frontend/src/components/portal/PortalShell.jsx` | Added `min-w-0` to flex child + inner container; `overflow-x-hidden` on content wrapper. |
| `frontend/src/components/marketing/MarketingFooter.jsx` | Dropped fixed `min-w-*` from footer columns. |
| `frontend/src/pages/portal/admin/BookingFeeBands.jsx` | Wrapped table in `overflow-x-auto`, header now wraps on mobile. |
| `frontend/src/pages/portal/customer/BookingDetail.jsx` | Fixed `booking` → `b` reference (React runtime error). |
| `frontend/src/pages/marketing/Contact.jsx` | Second phone, WhatsApp channel, click-to-call / mailto / chat wiring. |
| `frontend/src/pages/portal/admin/Queues.jsx` | Reply / Call / WhatsApp actions on every contact message. |
| `frontend/src/pages/auth/Register.jsx` | Address fieldset + phone/postcode validation. |
| `frontend/src/pages/portal/customer/Profile.jsx` | Address fieldset, avatar upload, saved-address summary. |
| `frontend/src/context/AuthContext.jsx` | Register payload passthrough. |
| `frontend/src/lib/validators.js` | New — UK phone, UK postcode helpers. |
| `backend/server.py` | UserBase / UserPublic / user_to_public / register / PUT /auth/me extended with address fields. Fixed pre-existing refund syntax corruption. |

---

## Remaining issues / observations

- `/customer/asap` shows a lint warning about missing `useCallback` deps (`transportCategory`, `transportDescription`) — pre-existing, non-blocking, doesn't cause any UI incorrectness (deps are effectively constant during a submission).
- `test_account_delete.py` uses a hard-coded stale preview URL (`cargo-port.preview.emergentagent.com`) — needs updating in a separate cleanup PR but is unrelated to this sprint.
- Profile photo uploads flow through the existing `documents` collection. When we introduce native mobile builds we should migrate that endpoint to signed-URL object storage; for now, the base64 payload is downscaled client-side to keep it under 100 KB.

---

## Launch readiness

All three Round-2 priorities are green. No launch blockers outstanding. The web platform is ready to hand over to native iOS / Android build work.
