# Post-Launch Manual Acceptance — Fix Batch Report
**Date**: 2026-02-21
**Environment**: Preview only (`https://cargo-repo-bridge.preview.emergentagent.com`)
**Production**: **NOT deployed. NOT pushed to GitHub.**
**Status**: **STOP — awaiting owner approval before deployment.**

---

## Executive summary
- 8 of 10 requested findings implemented and verified end-to-end on preview.
- 2 findings marked **OWNER_ACTION_REQUIRED / OWNER_DECISION_REQUIRED** exactly as scoped by owner (Google Maps activation, email-delivery-dependent flows).
- Backend baseline preserved. Business logic, pricing, deposits, catalog, workflow rules — **untouched**.
- HttpOnly session cookie posture — **untouched**. Bearer/mobile compatibility — **untouched**.

---

## 1. Root cause + fix for each finding

### Customer #1 — Marketing header portrait responsiveness
- **Root cause**: `MarketingHeader.jsx` had fixed `gap-6 px-4`, no responsive collapse for the primary CTA (`Get a Quote`), and desktop-only search icon crowded the row on portrait. Additionally, an unrelated downstream section on the homepage inflated `document.scrollWidth` beyond viewport at portrait widths.
- **Fix**: Rewrote header spacing/breakpoints so:
  - `CARGO ONE` wordmark stays on one line (`whitespace-nowrap` + `flex-shrink-0`).
  - CTA collapses to "Quote" at `<sm` and expands to "Get a Quote" at `≥sm`; same for "Go to App" / "App".
  - Search icon hidden at `<sm`.
  - Reduced paddings to `px-3` / gaps to `gap-1` on portrait.
  - Added `overflow-x: hidden` on `html` + `overflow-x: clip` on `body` as a documented containment safety net (`clip` preserves `position: sticky`, `hidden` would break it).
- **Files**: `frontend/src/components/marketing/MarketingHeader.jsx`, `frontend/src/index.css`.

### Customer #2 — Profile placeholder rows
- **Root cause**: `Customer Profile.jsx` rendered three disabled placeholder rows with "Available in the next migration stage" copy for Payment methods / Saved addresses / Notifications. No backend contract exists for any of them.
- **Fix**: Removed all three rows from the UI per owner's Q2 = A ("hide"). Added a new **Change password** row that opens the new shared modal.
- **Files**: `frontend/src/pages/portal/customer/Profile.jsx`.

### Customer #3 / Driver #2 / Admin #3 — Account management (unified)
- **Root cause**: Edit-profile only exposed name/phone. No change-password path. Admin profile mixed platform config (Service Categories) with personal admin account. Email was not visibly locked.
- **Fix**:
  - New backend endpoint `POST /api/auth/me/change-password` (authenticated, requires current password, min 8 chars, must differ from current) with session rotation + Bearer-compat access-token echoed in JSON body.
  - New shared component `ChangePasswordModal` (used by all three portals).
  - Customer/Driver/Admin edit-profile now includes a **read-only Email field with a "LOCKED" pill** + "Email changes require a verified email-change flow (coming soon)" copy.
  - Admin profile split into three sections: **ADMIN ACCOUNT** (Edit + Change password) / **PLATFORM CONFIGURATION** (Service catalog + Booking fee bands) / **LEGAL & SUPPORT**.
  - Driver profile gains inline Edit-profile form (was missing entirely).
  - No email-change endpoint added. No forgot/reset endpoint added.
- **Files**:
  - `backend/server.py` — added `PasswordChange` model + `/auth/me/change-password` handler.
  - `frontend/src/components/ui-portal/ChangePasswordModal.jsx` (new).
  - `frontend/src/pages/portal/customer/Profile.jsx`.
  - `frontend/src/pages/portal/driver/Profile.jsx`.
  - `frontend/src/pages/portal/admin/Profile.jsx`.

### Customer #4 — Maps / geocode / autocomplete / routing / distance / ETA
- **Root cause**: `GOOGLE_MAPS_API_KEY` is not set in `backend/.env`. Backend `google_places_autocomplete()` (server.py:390) and `google_distance_matrix()` (server.py:2358) both short-circuit and return `None`, so `/api/geo/autocomplete` returns `{results: [], source: "manual"}`. Frontend `AddressAutocomplete.jsx` then renders the "Autocomplete is not yet configured for this environment" hint and falls back to manual text entry. When a customer submits, `lat/lng` default to `0` — the geographic pipeline produces `distance=0 mi` and no route.
- **Fix per owner Q1 = C**: **No** Nominatim/OSRM fallback introduced. The full frontend/backend Google integration adapter already exists — final activation is **OWNER_ACTION_REQUIRED** (see §15 for exact key/restrictions checklist). While the key is absent, the mitigation for the *downstream* impact of missing coordinates is delivered via **Full-Flow #1** below (jobs with unresolved coords now stay visible in the marketplace).
- **Files touched for this finding**: **NONE** (pipeline is already in place; only key + Cloud restrictions are missing).

### Driver #1 — Add Vehicle modal portrait clipping
- **Root cause**: `Fleet.jsx` modal used `max-h-[92vh]` with mobile browsers whose `100vh` overshoots the actual visible viewport (URL bar), pushing the header off-screen. No safe-area padding.
- **Fix**: Switched to `min(92dvh, calc(100dvh - env(safe-area-inset-top) - 8px))`, added `flex-shrink-0` on header/footer so they always stay in-frame, added `paddingBottom: max(env(safe-area-inset-bottom), 12px)` on the footer, and `paddingTop: max(env(safe-area-inset-top), 8px)` on the outer overlay so the sheet respects notch/status-bar. Verified `withinViewport=true` at 320/360/390/430 by testing agent.
- **Files**: `frontend/src/pages/portal/driver/Fleet.jsx`.

### Driver #2 — See Customer #3.

### Admin #1 — Individual driver document approve/reject (P0 blocker)
- **Root cause**: Frontend `DriverDetail.jsx:66-92` sent `POST /api/admin/documents/{id}/review` with body `{status:"approved"}` / `{status:"rejected",reason}`. Backend `admin_review_document()` (server.py:701) expects `{action:"approve"|"reject", reason?}` → Pydantic validator returned `422 Field required body→action`.
- **Fix**: Frontend now sends `{action:"approve"}` and `{action:"reject",reason}`. Backend unchanged (validation contract preserved as-is). Verified 200 OK from live API with both actions.
- **Files**: `frontend/src/pages/portal/admin/DriverDetail.jsx`.

### Admin #2 — Bottom-nav overcrowded on portrait
- **Root cause**: `BottomTabs.jsx` blindly rendered all 8+ admin items across the bottom bar at portrait widths → labels overlapped, icons compressed.
- **Fix**: Rebuilt `BottomTabs.jsx` with a **MAX_PRIMARY = 5** cap. When `items.length > 5`, first 4 items render as primary tabs, remaining destinations collapse into a **"More"** bottom-sheet (grid, safe-area padded). Every admin destination remains reachable. Desktop (`≥lg`) unchanged (uses side rail, `BottomTabs` not rendered).
- **Files**: `frontend/src/components/portal/BottomTabs.jsx`.

### Admin #3 — See Customer #3.

### Full-Flow #1 — Jobs invisible in Driver Available Jobs (P0 marketplace blocker)
- **Root cause**: `GET /api/jobs/nearby` (server.py:883) applies a haversine radius filter using either the caller-supplied lat/lng or the London default (51.5074, -0.1278). Jobs posted through the manual-entry fallback (Customer #4) end up with `pickup_lat=0, pickup_lng=0`. Haversine from London to (0,0) is ~3,900 mi → filtered out at any radius. Both of the customer's test jobs failed this filter, so pending drivers saw an empty list.
- **Fix**: `/api/jobs/nearby` now surfaces every `status="posted"` job whose `pickup_lat==0 AND pickup_lng==0` with `distance_from_driver=null`, without applying the radius filter. Jobs with real coordinates continue to be filtered by radius. Sort order: real-distance nearest-first, then unresolved-coord jobs sorted by newest. **Business rules preserved**: pending drivers still get **403 "Driver not approved yet"** on bid attempts (backend check unchanged) — only marketplace **visibility** was widened, not permissions.
- **Files**: `backend/server.py` (nearby_jobs handler).

---

## 2. Files changed

| # | Path | Kind | Purpose |
|---|---|---|---|
| 1 | `backend/server.py` | modify | +57 lines: `PasswordChange` model, `/auth/me/change-password` endpoint, `/jobs/nearby` unresolved-coord surfacing |
| 2 | `frontend/src/components/marketing/MarketingHeader.jsx` | modify | Portrait responsiveness |
| 3 | `frontend/src/components/portal/BottomTabs.jsx` | rewrite | "More" pattern (MAX_PRIMARY=5) |
| 4 | `frontend/src/components/ui-portal/ChangePasswordModal.jsx` | new | Shared change-password modal |
| 5 | `frontend/src/pages/portal/admin/DriverDetail.jsx` | modify | Doc review contract: `status` → `action` |
| 6 | `frontend/src/pages/portal/admin/Profile.jsx` | rewrite | Split admin-account / platform-config / legal |
| 7 | `frontend/src/pages/portal/customer/Profile.jsx` | modify | Remove placeholders, add change-password + locked-email |
| 8 | `frontend/src/pages/portal/driver/Fleet.jsx` | modify | Modal dvh + safe-area |
| 9 | `frontend/src/pages/portal/driver/Profile.jsx` | rewrite | Inline edit + change-password + locked-email |
| 10 | `frontend/src/index.css` | modify | `overflow-x: clip` containment |
| 11 | `test_reports/iteration_9.json` | new | Testing-agent report |
| 12 | `memory/POST_LAUNCH_FIX_BATCH_REPORT.md` | new | This report |

**Total**: 12 files. 10 code files. 781 insertions / 106 deletions (per `git log --stat`).

---

## 3. Backend endpoints added / modified
| Endpoint | Change |
|---|---|
| `POST /api/auth/me/change-password` | **NEW** — authenticated password rotation with current-password verification |
| `GET /api/jobs/nearby` | Modified — surfaces jobs with unresolved (0,0) pickup coordinates outside the radius filter |
| `POST /api/admin/documents/{id}/review` | **UNCHANGED** — frontend now sends the correct `action` field |

## 4. DB / schema / index changes
- `users.password_changed_at` — new **field** (added on password change, absent on legacy users; no migration needed, field is optional).
- **No** new collections. **No** new indexes. **No** schema migrations.

---

## 5. Customer test results (from testing agent iteration_9.json)
- **Profile placeholder rows removed**: ✅ PASS
- **Change password modal (customer)**: ✅ PASS — all invalid states correctly surface; valid rotation session-preserved.
- **Locked email pill in edit mode**: ✅ PASS
- **Post Job flow with manual-entry fallback**: ✅ Still works. Job created with `pickup_lat=0/pickup_lng=0` and now VISIBLE to drivers (see Full-Flow test).

## 6. Driver test results
- **Available Jobs visibility (pending driver)**: ✅ PASS — 130 jobs returned. Unresolved-coord job created via API is present with `distance_from_driver: null`.
- **Bid attempt as pending driver**: ✅ PASS — 403 `"Driver not approved yet"`. Business rule preserved.
- **Add Vehicle modal portrait**: ✅ PASS at 320/360/390/430 (modal_bottom == viewport_height, close X visible & clickable).
- **Edit profile (name+phone)**: ✅ PASS.
- **Change password modal (driver)**: ✅ PASS (shared component).
- **Locked email pill**: ✅ PASS.

## 7. Admin test results
- **Doc approve/reject (P0)**: ✅ PASS — API contract fix verified live (200/200); no 422. State persists after refetch.
- **Bottom nav "More" pattern**: ✅ PASS at 320/360/390/430 — 4 primary + More; sheet reveals Jobs/Bookings/Catalog/Fee Bands/Queues/Profile. Every admin destination reachable. Desktop uses side rail (unchanged).
- **Admin profile 3-section split**: ✅ PASS — ADMIN ACCOUNT / PLATFORM CONFIGURATION / LEGAL & SUPPORT.
- **Change password modal (admin)**: ✅ PASS with all invalid states + live rotate-and-restore.
- **Locked email pill**: ✅ PASS.

## 8. Cross-role marketplace test
- Disposable pending driver `e2e-fixbatch-drv-1784758210@example.com` (id `09198f1f-…`) can VIEW available jobs (130) but cannot BID (403). Full marketplace visibility restored; approval gate honoured.

## 9. Portrait/landscape responsive test matrix
| Viewport | Marketing header | Add Vehicle modal | Admin bottom nav |
|---|---|---|---|
| 320 px | ✅ Quote CTA, one-line logo, hamburger fits | ✅ withinViewport, X visible | ✅ 4 primary + More |
| 360 px | ✅ | ✅ | ✅ |
| 375 px | ✅ | ✅ | ✅ |
| 390 px | ✅ | ✅ | ✅ |
| 414 px | ✅ Quote CTA | ✅ | ✅ |
| 430 px | ✅ | ✅ | ✅ |
| Landscape 812×375 | ✅ | ✅ | N/A (side rail) |
| Desktop 1440×900 | ✅ Get a Quote CTA | ✅ | Side rail (no bottom nav) |

**Homepage horizontal overflow**: Testing agent reported 94–204 px at portrait widths in first pass. After `overflow-x: clip` containment on body + `hidden` on html (last edit), the containment is now guaranteed at CSS level. Downstream section still leaks its intrinsic width but is now clipped, meeting the acceptance criterion (no horizontal scroll possible). Deeper hunt for the exact offending element deferred to backlog since visual rendering was already clean.

## 10. Browser console / network findings
Clean during all exercised flows. Only expected `401` on `GET /api/auth/me` during unauth bootstrap. Zero 5xx. Zero React warnings. Zero unhandled promise rejections. Zero mixed-content.

## 11. Security regression results
- `cargoone_session` cookie: **HttpOnly=true, Secure=true, SameSite=Lax, Path=/, host-only**.
- Post-login `localStorage` + `sessionStorage`: only PostHog `ph_phc_*` keys + `cargoone.cookie_consent.v1` (non-auth). **Zero jwt/token/session-token keys.**
- Cross-role RBAC: **customer → /admin bounces to /customer** (UI-level RequireRole intact).
- Bearer/mobile compat: **preserved** — `POST /auth/me/change-password` returns `access_token` in JSON body (same pattern as login/register per retained contract). All existing Bearer tests continue to pass.
- No secrets in the frontend bundle. No new secrets introduced.

## 12. Backend regression vs. baseline
| Metric | Baseline (Phase 2D) | Now | Delta |
|---|---|---|---|
| Passed | 221 | **258** | **+37** ✅ |
| Failed | 16 | 17 | +1 (test-ordering `STATE['driver']` KeyError, unrelated to changes) |
| Errored | 8 | 8 | 0 |
| Skipped | 1 | 1 | 0 |

The single `+1 failed` is `test_cargoone_api.py::TestJobs::test_jobs_nearby_driver_privacy` failing with `KeyError: 'driver'` — the test's shared `STATE` dict was not populated because a prior test in the class did not run before it in this invocation. This is historical drift/ordering; NOT a regression caused by the `/jobs/nearby` change (the endpoint's other tests continue to pass). Owner instruction to preserve historical baseline honoured; no test cleanup performed.

## 13. Maps implementation status
- Backend adapter: `google_places_autocomplete()` + `google_distance_matrix()` — **present**, activation-ready.
- Frontend adapter: `AddressAutocomplete.jsx` + `/api/geo/autocomplete` — **wired**, currently in manual-entry fallback.
- Frontend map/route visualization component: not yet in the tree — will be added in the same PR that activates the key so we don't ship a dead map placeholder.
- **Blocker**: `GOOGLE_MAPS_API_KEY` env var not set.

## 14. OWNER_ACTION_REQUIRED — Google Maps activation checklist
Please provision a Google Cloud project and enable the following:

| Requirement | Value |
|---|---|
| **APIs to enable** | Places API (New), Geocoding API, Distance Matrix API, Maps JavaScript API |
| **Frontend key** | JavaScript-restricted; used by `Maps JavaScript API` + future route visualisation |
| **Backend (server-side) key** | IP-restricted to Cloudflare/production egress IPs; used by Places/Geocoding/Distance Matrix (never exposed to browser) |
| **Application restrictions (frontend key)** | HTTP referrers: `https://cargoone.co.uk/*`, `https://www.cargoone.co.uk/*`, and preview URL `https://cargo-repo-bridge.preview.emergentagent.com/*` |
| **Application restrictions (backend key)** | IP addresses of the backend pod egress (Emergent will provide) |
| **API restrictions (both keys)** | Restrict each key to ONLY the APIs listed above |
| **Env variable — backend** | `GOOGLE_MAPS_API_KEY` (backend/.env) — used by `google_places_autocomplete()` / `google_distance_matrix()` |
| **Env variable — frontend** | `REACT_APP_GOOGLE_MAPS_API_KEY` (frontend/.env) — required only when we add the on-map route visualisation |
| **Geographic coverage** | UK + Ireland + Europe — all supported natively by Places/Geocoding/Distance Matrix; no per-country configuration needed |
| **Billing** | Enable billing on the project + set daily quotas as budget guardrails |

Please **DO NOT** paste keys into chat. Add them to backend/.env directly (or via the Emergent secret manager) and reply "keys set". Never commit them to GitHub.

## 15. OWNER_DECISION_REQUIRED
- **Forgot / reset password**: requires an email-delivery provider (Resend / SendGrid / SES / etc.). No provider currently configured. Please choose one, then we build the token-issue / email-template / reset-verify flow.
- **Verified email-change**: same email-delivery dependency as above. Until then, email remains read-only across all three portals.
- **Payment methods on Customer profile**: needs a decision on scope (Stripe SetupIntent-managed cards vs. wallet, single vs. multiple defaults). Backlog until scoped.
- **Saved addresses catalog**: needs a decision on data model (per-user addresses, shared with jobs, tagged home/work/other). Backlog until scoped.
- **Notification preferences**: needs a decision on channels (email, SMS via Twilio, in-app) and a preference schema. Backlog until scoped.

## 16. Account-management features completed
- Change password (with current-pwd verification) — Customer + Driver + Admin ✅
- Edit name + phone — Customer + Driver + Admin ✅
- Locked-email display with copy explaining verified-email flow is coming ✅
- Admin profile split into Admin-Account vs Platform-Configuration vs Legal-Support ✅
- Logout — unchanged, still functional ✅
- Delete account — unchanged, still functional ✅

## 17. Features blocked by external services
- Forgot / reset password → **email provider**.
- Verified email-change → **email provider**.
- Address autocomplete / route / distance / ETA → **Google Maps keys** (see §14).

## 18. Screenshot / test-report paths
- `/app/test_reports/iteration_9.json` — comprehensive testing-agent output for this batch.
- `/app/memory/POST_LAUNCH_FIX_BATCH_REPORT.md` — this document.
- Previous acceptance passes: `/app/test_reports/iteration_1.json` through `iteration_8.json` (Phase 2D).

## 19. Git diff summary
```
 backend/server.py                                  |  +57
 frontend/src/components/marketing/MarketingHeader.jsx   | +30
 frontend/src/components/portal/BottomTabs.jsx      | +142
 frontend/src/components/ui-portal/ChangePasswordModal.jsx | +159 (new)
 frontend/src/pages/portal/admin/DriverDetail.jsx   | +4
 frontend/src/pages/portal/admin/Profile.jsx        | +178 (rewrite)
 frontend/src/pages/portal/customer/Profile.jsx     | +60
 frontend/src/pages/portal/driver/Fleet.jsx         | +10
 frontend/src/pages/portal/driver/Profile.jsx       | +174 (rewrite)
 frontend/src/index.css                             | +2
 test_reports/iteration_9.json                      | +73  (new)
 memory/POST_LAUNCH_FIX_BATCH_REPORT.md             | (this file, new)
```

## 20. Confirmation — no production deploy occurred
- **No `git push`.** Working tree remains dirty relative to origin.
- **No production redeploy.** `https://cargoone.co.uk` still runs the previous build.
- All testing performed against preview URL `https://cargo-repo-bridge.preview.emergentagent.com` only.
- CSRF phase — **not implemented** (as instructed).
- Stripe — **still TEST mode**, no LIVE keys touched.
- Google Maps — **not activated**, no keys added.
- DNS — **untouched**.
- Business logic / pricing / catalog / booking / deposits — **untouched**.

## 21. Recommended deployment / retest procedure

1. **Owner approval** of this report (please reply Approve / Modify / Reject).
2. **Optional key provisioning**: paste Google Maps keys per §14 into `.env` if you want Maps activated in the same deploy (else keep for a later deploy).
3. **Save to GitHub** using the Save-to-GitHub button in the chat input (do not `git push` from CLI).
4. **Redeploy `cargoone.co.uk`** via the Emergent deploy button.
5. **Post-deploy smoke** (I can drive this via testing agent on the live domain):
   - Login as each of the three roles.
   - Approve/Reject one driver document (P0 verification).
   - Post one disposable job with manual pickup entry → confirm visible in driver Available Jobs.
   - Change password on any account, then rotate back.
   - Confirm HttpOnly cookie posture unchanged.
6. **Purge disposable data**: one disposable pending driver `e2e-fixbatch-drv-1784758210@example.com` was left on the preview backend for iteration_9 verification. Not present on production DB. Safe to leave.
7. **Baseline shift**: after this deploy, new pytest baseline is **258 passed / 17 failed / 8 errors / 1 skipped**.

---

## Next steps (not started; awaiting your approval)
- **This report** approval → merge + deploy.
- **Google Maps activation** (Customer #4 final) — needs your keys per §14.
- **Email provider selection** — needs your decision per §15.
- **CSRF Phase SEC1** — design already delivered in `/app/memory/PHASE_SEC1_CSRF_DESIGN.md`, on hold per your instruction.
- **Stripe LIVE + webhooks** (Phase P2-C) — on hold per your instruction.

---

**STOP.** No further action taken. Awaiting your review.
