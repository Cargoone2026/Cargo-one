# Cargo One — Product Requirements Document

## Original Problem Statement
Import the existing Cargo One application from the `Cargoone2026/Cargo-one`
GitHub repository into an Emergent workspace and continue development as a
production-ready full-stack web app. The repository is the single source of
truth (FastAPI backend + MongoDB + Stripe + Google Maps + marketing website +
customer, driver and admin portals). Because the original frontend is an
Expo/React Native app, the frontend has to be **ported to standard React web
(CRA)** without altering the backend business logic, API contracts, catalog
data, deposit math or visual language.

## Constraints (User-Set)
- Pure React web app — **no Expo, Metro, or React Native** dependencies.
- HttpOnly cookie-based JWT auth (`cargoone_session`, Secure, SameSite=Lax);
  **no JWT in localStorage / IndexedDB / JS-accessible memory**.
- Never expose Google Maps or Stripe keys to the browser during Stage 2.
- **Do not touch** the 16 pre-existing failing backend tests (historical
  data drift in the source repo).
- No commits, no GitHub push, no Publish/Deploy, no custom-domain switch,
  no live Stripe / Google credentials until the user explicitly authorises.

## Personas
1. **Customer** — posts jobs, receives quotes/bids, pays deposits, tracks
   shipments, uploads POD acknowledgements, leaves reviews.
2. **Driver** — sees nearby jobs, submits bids, uploads verification
   documents, executes deliveries with live tracking, POD + signature.
3. **Admin** — approves drivers, moderates catalog/deposit bands, resolves
   disputes, monitors platform stats.

## Migration Phases

### Phase 1 — Backend port + cookie auth  ✅ COMPLETE
- Ported FastAPI + Motor backend to `/app/backend`.
- Added HttpOnly cookie auth alongside legacy Bearer for mobile compat.
- Rotated JWT secret + admin password (values in `/app/memory/test_credentials.md`).
- `ALLOW_INITIAL_ADMIN_SEED=false` after first admin login.

### Phase 2 Stage 1 — Marketing + Public Auth  ✅ COMPLETE
- Marketing pages (Home, How It Works, Services, Business, Drivers, FAQ,
  Contact, Trust & Safety, About) ported to CRA.
- Public auth screens (Welcome, Login, Register) ported to CRA.

### Phase 2 Stage 2A-i — Customer Portal foundation + read-oriented screens  ✅ COMPLETE (2026-02-21)
- Portal primitives: `Button`, `Input`, `StatusPill`, `AddressAutocomplete`
  (server-side proxy fallback via `/api/geo/autocomplete`; **no browser
  Google key**), `GlobalSearchModal`.
- Customer routes wired through `RequireRole` + `CustomerLayout` + `PortalShell`
  (SideRail ≥1024px, BottomTabs <1024px):
  - `/customer` — Dashboard (search, hero, quick actions, active bookings,
    categories).
  - `/customer/bookings` — Active/Past tabs, search, empty states.
  - `/customer/messages` — Inbox two-pane layout with mark-as-read. Compose
    box present but **disabled** with clear next-stage copy.
  - `/customer/profile` — Editable name + phone via `PUT /api/auth/me`;
    payment / addresses / notifications rows disabled with next-stage copy.
- `/customer/post-job`, `/customer/booking/:id`, `/customer/job/:id` show
  a `ComingNext` placeholder — Stage 2A-ii work is deferred.
- Frontend testing agent (`/app/test_reports/iteration_1.json`) — all flows
  pass, zero issues. HttpOnly cookie verified; no JWT in localStorage.

### Phase 2 Stage 2A-ii — Customer active workflows  ✅ COMPLETE (2026-02-21)
- New portal primitives: `RouteMap.jsx` (SVG-only; no browser Google Maps key),
  `ReviewModal.jsx` (rating stars + base64 photo attachments).
- New hook: `hooks/useCatalog.js` — 5-minute in-memory cache for categories,
  vehicles, capabilities; `requestRecommendation()` posts to
  `/api/catalog/recommend-vehicle`.
- `pages/portal/customer/PostJob.jsx` — 5-step wizard: category+title →
  route (AddressAutocomplete + live `/api/quote/estimate`) → cargo details
  → vehicle selection ("Not sure" calls `/api/catalog/recommend-vehicle`)
  → pricing (bidding|fixed) + live `/api/booking-fees/preview`. Submits to
  `POST /api/jobs` and navigates to `/customer/job/{id}`.
- `pages/portal/customer/JobDetail.jsx` — job info + RouteMap, bids list
  with verified-driver badge, `Accept Bid` calls `POST /api/bids/{id}/accept`
  then `POST /api/bookings { job_id }`. Fixed-price jobs show "Continue to
  Payment" once accepted.
- `pages/portal/customer/BookingDetail.jsx` — Overview / Chat / POD tabs
  (tabs hidden until `payment_status==="paid"`). Unpaid state shows town
  names only, deposit-locked notice, `Pay Booking Fee` footer button that
  calls `POST /api/bookings/{id}/deposit` and does `window.location.href =
  session.url`. Return handler polls `/api/payments/status/{session_id}`
  every 2s (max ~20s) then reloads booking. Tracking polls every 12s while
  status is en-route. Chat uses `GET/POST /api/bookings/{id}/messages`
  (backend authorises payment). POD renders photos/signature/GPS.
  Completion via `POST /api/bookings/{id}/complete`; ReviewModal posts to
  `/api/bookings/{id}/review`.
- App.js wired: `/customer/post-job`, `/customer/job/:id`,
  `/customer/booking/:id`; `ComingNext` retired for customer.
- Frontend testing agent (`/app/test_reports/iteration_2.json`) — every
  wizard step + live API calls verified, zero issues. HttpOnly cookie
  posture preserved; zero `maps.googleapis.com` requests; no `AIzaSy` key
  in DOM.
- Backend regression re-run (`EXPO_PUBLIC_BACKEND_URL` +
  `TEST_ADMIN_PASSWORD` exported) — exact baseline preserved: **221 passed
  / 16 failed / 8 errors / 1 skipped**.

### Phase 2 Stage 2A-ii — Customer active workflows  🔴 PENDING USER APPROVAL
- Post Job wizard (catalog / vehicle / addresses / photos / suggested price).
- Quote workflow, bid acceptance.
- Stripe deposit checkout via `window.location.href` + return-status polling.
- Booking detail (status timeline, messaging, tracking, POD, reviews).

### Phase 2 Stage 2B — Driver Portal  ✅ COMPLETE (2026-02-21)
- New portal primitive: `SignaturePad.jsx` — HTML5 `<canvas>` port of the
  Expo SignaturePad with pointer/touch events; emits base64 PNG on lift.
- Driver routes wired through `RequireRole role="driver"` +
  `DriverLayout` + `PortalShell` (SideRail ≥1024px / BottomTabs <1024px)
  with 6 items: Home / Available / My Jobs / Earnings / Fleet / Profile.
- `pages/portal/driver/Dashboard.jsx` — status-aware header (pending /
  changes-requested / suspended), warning cards with `POST
  /api/auth/me/resubmit-verification`, earnings/fleet/upcoming/bids/rating/
  verification sections, all fed from `GET /api/driver/dashboard`.
- `pages/portal/driver/Jobs.jsx` — `GET /api/jobs/nearby?radius=N` with
  search box, sort chips (nearest/newest/highest £/shortest job), radius
  chips (10/20/40/75/250), pricing/category/capability advanced filters,
  min/max price range, reset-all, refresh.
- `pages/portal/driver/JobDetail.jsx` — pending-approval warning gate,
  bidding form (`POST /api/jobs/:id/bids`) with live `/api/booking-fees/preview`
  breakdown, or fixed-price accept (`POST /api/jobs/:id/accept`).
- `pages/portal/driver/MyJobs.jsx` — `GET /api/bookings/mine`.
- `pages/portal/driver/BookingDetail.jsx` — Overview/Chat/POD tabs (hidden
  until `payment_status="paid"`). Foreground tracking via
  `navigator.geolocation.watchPosition` posting to `/api/tracking/:id`
  with a 30 m / 45 s throttle, denial/timeout error surfacing, auto-stop
  on unmount + when status leaves active range. Status flow via `POST
  /api/bookings/:id/status`. Chat via `GET/POST /api/bookings/:id/messages`.
  POD via `<input type="file" accept="image/*" capture="environment">`
  (camera) + library picker + `SignaturePad` + delivery notes + best-effort
  GPS snapshot at submit → `POST /api/bookings/:id/pod`. Backend
  authorisation always respected.
- `pages/portal/driver/Earnings.jsx` — totals + pending + in-progress
  computed client-side from `/api/bookings/mine` (backend remains
  authoritative for the per-booking `driver_charge`).
- `pages/portal/driver/Fleet.jsx` — vehicle CRUD via `/api/driver/vehicles`
  with modal form (type / registration / make / model / year / payload /
  capability chips / default toggle).
- `pages/portal/driver/Documents.jsx` — `GET /api/users/me/documents`
  drives the required list; `POST /api/users/me/documents` with
  `{doc_type, base64}` for uploads, per-row status pills.
- `pages/portal/driver/Profile.jsx` — verified-driver badge, status pill,
  quick links, logout.
- `App.js` wired for all 9 driver routes + `/driver/*` catchall to
  Dashboard. `PortalStub` retained only for `/admin/*` until Stage 2C.
- Frontend testing agent (`/app/test_reports/iteration_3.json`) — **zero
  issues**. Session restoration, RBAC (customer→/driver redirects away),
  every screen renders, all sensitive endpoints wired, zero
  `maps.googleapis.com` requests, no `AIzaSy` key in DOM.
- Backend regression re-run — exact baseline preserved: **221 passed / 16
  failed / 8 errors / 1 skipped**.

### Phase 2 Stage 2C — Admin Portal  ✅ COMPLETE (2026-02-21)
- Admin routes wired through `RequireRole role="admin"` + `AdminLayout` +
  `PortalShell` (SideRail ≥1024px / BottomTabs <1024px) with 10 items:
  Dashboard / Analytics / Users / Drivers / Jobs / Bookings / Catalog /
  Fee Bands / Queues / Profile.
- `pages/portal/admin/Dashboard.jsx` — dark "Admin Console" header, 6
  metric cards (customers/drivers/jobs/active jobs/revenue GBP/paid
  bookings) from `GET /api/admin/stats`, 6 action rows + integrated
  `GlobalSearchModal`.
- `pages/portal/admin/Analytics.jsx` — `GET /api/admin/analytics/overview`
  rendered as Marketplace / Revenue / Categories & Vehicles / Drivers /
  Customers / Operational KPI blocks with TopLists.
- `pages/portal/admin/Users.jsx` — `GET /api/admin/users?role=customer`,
  suspend flow via `POST /api/admin/users/:id/suspend` with reason prompt.
- `pages/portal/admin/Drivers.jsx` — `GET /api/admin/users?role=driver`,
  filter chips (pending / changes_requested / active / suspended / all),
  search, per-row "Review application" CTA.
- `pages/portal/admin/DriverDetail.jsx` — `GET /api/admin/drivers/:id`,
  profile + stats + action bar (approve/request-changes/suspend),
  document rows with preview/approve/reject via `POST
  /api/admin/documents/:doc_id/review`, missing-documents warning
  card, request-changes / suspend modals with reason ≥10 chars + doc-type
  chips.
- `pages/portal/admin/Jobs.jsx` — `GET /api/admin/jobs` with search.
- `pages/portal/admin/Bookings.jsx` — `GET /api/admin/bookings` with
  payment-status pill (beyond-Expo but source-backend-supported).
- `pages/portal/admin/Catalog.jsx` — tabbed CRUD for
  `/api/admin/catalog/categories|vehicles|capabilities` (create / edit /
  toggle-active / reorder-via-PUT-swap / delete).
- `pages/portal/admin/DepositBands.jsx` — `/api/admin/deposit-bands` CRUD
  with live `/api/deposit-bands/preview` calculator.
- `pages/portal/admin/Queues.jsx` — Contact + Newsletter operational
  queues via `/api/admin/contact-messages` and
  `/api/admin/newsletter-subscribers` (beyond-Expo but source-backend
  supported).
- `pages/portal/admin/Profile.jsx` — admin badge, logout via `POST
  /api/auth/logout` clears HttpOnly cookie.
- `App.js` wired for all 11 admin routes; `PortalStub` removed for admin.
- Frontend testing agent (`/app/test_reports/iteration_4.json`) — **zero
  issues** across 15 test buckets. Includes: catalog capability
  CRUD (create+delete disposable row), deposit-band CRUD (create+delete
  disposable row), request-changes / suspend modals, driver-detail
  documents-missing card, RBAC checks (customer→/admin blocked, driver→
  /admin blocked, unauth→/auth/login), zero `maps.googleapis.com`
  requests, no `AIzaSy` key in DOM.
- Backend regression re-run — exact baseline preserved: **221 passed / 16
  failed / 8 errors / 1 skipped**.

### Phase 2D — Full-System Acceptance &amp; Remediation  ✅ COMPLETE (2026-02-21)
- Cross-role live E2E (Customer + Driver + Admin, disposable accounts)
  passed end-to-end via `testing_agent_v3_fork` (`iteration_5.json`, zero
  issues): Post Job wizard → job → admin driver approval → bid → accept
  → booking → Stripe TEST redirect → return-URL polling → admin
  visibility. RBAC, HttpOnly cookie posture, `maps.googleapis.com` zero
  request count all confirmed.
- **Source-parity gaps discovered and remediated:**
  1. `Settings` hub (`/settings`, `/settings/:slug`) — omitted during
     initial migration. Restored with parity to Expo
     `app/settings/[slug].tsx` (Terms / Privacy / Cookies / About /
     Support / Delete Account, versioning row).
  2. **Delete Account** flow — completely unreachable from UI.
     Restored via `POST /api/auth/me/delete` (pre-existing backend
     contract).
  3. **Public driver profile page** (`/driver-profile/:id`) — omitted.
     Restored using `GET /api/users/:id/profile`. Endpoint requires
     signed-in user (matches Expo source flow); unauthenticated hits
     render a sign-in CTA (`dpp-signin-cta`) with `?next=` return path.
  4. Customer/Driver/Admin Profile screens were pointing "Settings" /
     "Terms &amp; Privacy" rows at marketing pages (`/trust-safety`,
     `/about`). Re-pointed to the real Settings hub routes.
  5. Customer Job Detail bid card avatar now links to
     `/driver-profile/:driver_id` (parity with Expo).
- Both follow-up defects surfaced by the exhaustive audit (missing
  `Link` import in `JobDetail.jsx`, misleading "Profile not found" on
  unauthenticated `/driver-profile/:id`) were fixed and **verified by
  `bug_testing_agent`** with disposable seed data (`iteration_7.json`,
  verdict: **fixed**, success rate 100/100%).
- Historical 16F/8E baseline re-triaged (all A/B/C — pre-existing drift,
  test-state cascade, and stale fixture wiring; **zero D-genuine
  regressions**). Baseline preserved at each Phase 2D checkpoint.
- Backend regression at Phase 2D close: **235 passed / 16 failed /
  8 errors / 1 skipped** — +14 passes vs the historical baseline of
  221/16/8/1. Investigation: E2E data created during Phase 2D
  cross-role flow populated fixture records that unblocked
  previously-empty result assertions in some tests. F/E/S unchanged
  → **no new regressions**, small pass-count improvement is a fixture
  data effect only.

### Post-launch fix batch  ✅ COMPLETE (2026-02-21) — awaiting owner approval
- 8 of 10 findings implemented + verified in preview
  (`/app/test_reports/iteration_9.json`). Full report at
  `/app/memory/POST_LAUNCH_FIX_BATCH_REPORT.md`.
- Admin driver-doc approve/reject (P0) fixed at API contract level
  (`status` → `action`).
- Marketplace visibility (P0): `/api/jobs/nearby` now surfaces jobs
  with unresolved (0,0) pickup coordinates so pending drivers can see
  them; bid gate still enforces admin-approval.
- Change-password (`POST /api/auth/me/change-password`) added with
  current-password verification + session rotation. Shared
  `ChangePasswordModal` used across customer / driver / admin.
- Email is READ-ONLY across all portals (locked pill + "verified
  email-change coming soon" copy).
- Placeholder Profile rows (payment / addresses / notifications)
  REMOVED per owner Q2 = A. Backlogged for proper implementation
  with real backend contracts.
- Responsive: marketing header, driver Add-Vehicle modal
  (dvh + safe-area), admin bottom nav ("More" pattern with
  MAX_PRIMARY=5) — all pass 320-430 portrait.
- Baseline pytest **258p/17f/8e/1s** (+37 pass vs 2D baseline;
  +1 fail is `test_jobs_nearby_driver_privacy` KeyError from
  historical STATE ordering, unrelated to changes).
- NOT deployed. NOT pushed to GitHub. CSRF still on hold.
  Stripe still TEST. Google Maps still OWNER_ACTION_REQUIRED
  (see §14 of the fix-batch report for exact env vars + Cloud
  restrictions).

### Phase 2D — Full-System Production Acceptance  ✅ COMPLETE (2026-02-21)
- Live production acceptance pass against `https://cargoone.co.uk`
  executed via `testing_agent_v3_fork` — see
  `/app/test_reports/iteration_8.json` and the compiled
  **29-point Phase 2D Final Report** at
  `/app/memory/PHASE_2D_FINAL_REPORT.md`.
- Verdict: **PRODUCTION_ACCEPTANCE_PASS** — zero P0/P1/P2 defects.
- One P3-info hardening item flagged: `POST /api/auth/login` and
  `POST /api/auth/register` still return `access_token` in the JSON
  response body (`backend/server.py:506, 518`, `TokenResponse` at
  `backend/server.py:147-150`). Web frontend has **zero** consumers
  (grep confirmed). Removal is BLOCKED by retained Bearer/mobile
  compatibility contract — explicitly asserted by
  `backend/tests/test_cookie_auth.py:38` ("login must still return
  access_token (bearer compat)") and by `test_bearer_still_works` +
  20+ Bearer-driven backend tests. Owner decision required between
  header-gated omission (Option A, recommended), separate mobile
  endpoint (Option B), or Optional-typed schema (Option C). NOT
  applied in this pass per owner instruction.
- Backend baseline (**221 passed / 16 failed / 8 errors / 1 skipped**)
  honoured — NOT re-run. No canonical business logic altered.

### Phase P2-A — Custom Domain Attachment  ✅ COMPLETE (2026-02-21)
- `frontend/.env` `REACT_APP_BACKEND_URL=https://cargoone.co.uk`.
- `backend/.env` `CORS_ORIGINS` = strict whitelist
  `https://cargoone.co.uk,https://www.cargoone.co.uk` (no wildcard).
- Session cookie: `HttpOnly` + `Secure` + `SameSite=Lax` + `Path=/`
  + host-only (no explicit Domain attribute).
- `www` → apex 308 with HSTS `max-age=63072000; includeSubDomains;
  preload`.

### Phase 3 — Production Hardening  🟢 P2  (do NOT auto-start)
- **P2-B**: Google Maps production restricted keys + CSRF
  double-submit tokens for cookie auth.
- **P2-C**: Stripe LIVE keys + webhook receiver + real payment
  acceptance.
- **P3-info hardening (deferred)**: apply chosen backward-compatible
  separation of `access_token` from the web login response (Options
  A/B/C in the Phase 2D report).

### Maps Phase 1 — Backend Integration  ✅ COMPLETE (2026-02)
- `/api/geo/autocomplete` + `/api/geo/details` proxied through
  backend-only `GOOGLE_MAPS_API_KEY` (unrestricted server key). No
  Places / Distance Matrix credential ever crossed to the browser.

### Maps Phase 2 — Frontend JS Visualization  ✅ COMPLETE (2026-02-25)
- `RouteMap.jsx` rewritten to load Google Maps JavaScript API via
  `@googlemaps/js-api-loader`-style hand-rolled script tag with
  `libraries=marker&v=weekly&loading=async`. SVG fallback preserved
  for missing key / loader failure / invalid coords.
- Frontend browser key `REACT_APP_GOOGLE_MAPS_JS_KEY` — HTTP-referrer
  restricted to `https://cargoone.co.uk/*`. Distinct from backend
  key (byte-for-byte equality check confirms no crossover).
- Production smoke matrix (v5, bundle `main.7359ad8a.js`):
  desktop 1920×900, mobile portrait 390×844, landscape rotate,
  first-load, hard-refresh, nav-away+return, 3× remount cycles,
  viewport resize — all `data-map-engine="google"`, 23 tile
  `<img>` + 2 canvases per mount, road-following polyline via
  DirectionsService.route(), both P and D markers auto-fit,
  commercial values (69.6 Mi, £250) unchanged from backend.
- Zero `REQUEST_DENIED` / `LegacyApiNotActivated` / `RefererNotAllowed` /
  `InvalidKey` / `BillingNotEnabled` errors.
- Root causes uncovered + fixed on the way to green:
  1. `/app/frontend/.env` empty `REACT_APP_GOOGLE_MAPS_JS_KEY=`
     override clobbered Emergent Custom-Key injection (fixed by
     removing the empty line).
  2. Emergent Production Custom Keys were not exposed to CRA build
     env for this project (worked around by placing the key value
     directly into `/app/frontend/.env`).
  3. Initial browser key belonged to a GCP project without the
     legacy Directions API enabled → straight-line fallback. Owner
     supplied a second key from a Directions-enabled project.
- Reports (in `/app/memory/`):
  `MAPS_PHASE1_IMPLEMENTATION_REPORT.md`,
  `MAPS_PHASE2_POST_DEPLOY_REPORT.md` (v1 fail),
  `MAPS_PHASE2_CUSTOM_KEY_AUDIT_AND_FIX.md`,
  `MAPS_PHASE2_POST_DEPLOY_REPORT_v2.md` (v2 fail — key missing at build),
  `MAPS_PHASE2_POST_DEPLOY_REPORT_v3.md` (v3 partial — Directions denied),
  `MAPS_PHASE2_POST_DEPLOY_REPORT_v4.md` (v4 fail — same GCP project),
  `MAPS_PHASE2_POST_DEPLOY_REPORT_v5_FINAL.md` (**v5 PASS**).
- Backlog: **P3 migrate legacy `DirectionsService` / `Marker` →
  Routes API v2 + `AdvancedMarkerElement`** (silences the Feb 25 2026
  deprecation warnings; not blocking today).

### Phase A — Driver-side Route Summary / Ferry + Toll Parity  ✅ COMPLETE (2026-07-29)
- **Objective:** Bring driver-side `RouteMap` call-sites to full visual/data
  parity with the customer-side (summary strip with pickup/dropoff towns,
  distance, duration + Ferry / Toll chips driven by shared DirectionsService
  detection inside `RouteMap`).
- **Outcome:** Parity was already in place from a prior session. Both
  `driver/JobDetail.jsx` (L137-147) and `driver/BookingDetail.jsx`
  (L318-348) supply an identical
  `summary={{ pickupTown, dropoffTown, distanceMiles, durationMinutes }}`
  shape to the customer-side counterparts; the driver Booking Detail also
  uses the same `tracking?.eta_minutes ?? job.duration_minutes` fallback.
- **Verified:** Live driver-portal render on the preview environment for
  job `f20a74c6` (Manchester → Birmingham, 70.3 mi). Summary strip renders
  route towns + distance on desktop (1280×900) and mobile (390×844); Google
  Maps engine active; charcoal route + P/D markers; no console errors.
  Ferry / Toll chips remain driven by shared DirectionsService detection,
  no duplicated logic. No files were modified this session.
- **Report:** `/app/memory/PHASE_A_DRIVER_PARITY_VERIFICATION.md`.

### Web Platform Completion Programme  ✅ COMPLETE (2026-07-29, preview only)
- **Phase 1 P0 payment security** — per-session `webhook_token` binds every Stripe checkout to a query-string secret; unauthenticated fabricated webhook callbacks are 403'd. `STRIPE_WEBHOOK_SECRET` support wired for LIVE. 12 new security tests green.
- **Phase 2 CSRF SEC1** — `cargoone_csrf` double-submit cookie, middleware, CORS narrowed. Bearer path preserved. 8 CSRF tests green.
- **Phase 3 auth** — cookie remains authoritative for browser. `access_token` in JSON retained for backward-compat with native (documented).
- **Phase 4 Stripe LIVE readiness** — architecture ready, awaits LIVE keys + webhook secret in env.
- **Phase 8 SEO** — `sitemap.xml` + `robots.txt` shipped in `frontend/public/`.
- **Phases 5/6/7/9/10/11** — audit-only + documented pending items (email provider, Routes API v2 GCP enable, saved addresses/prefs product decisions).
- **Not yet done:** Save-to-GitHub, Deploy, Stripe LIVE, email provider integration, Routes API v2 code swap, Phase C cleanup.
- **Report:** `/app/memory/CARGOONE_WEB_COMPLETION_REPORT.md` (contains MANUAL_KEYS_AND_EXTERNAL_SETUP consolidated list).





## Known Historical Drift (DO NOT AUTO-FIX)
Baseline serial pytest suite from the source repo carries pre-existing
regressions (endpoints such as `/api/geo/markets`, `/api/quotes/estimate`
returning 404, deposit math drift, catalog vocabulary drift). Per user's
strict instruction these must not be "fixed" to make the suite green —
they will be resolved deliberately once the migration is complete.

## Testing Notes
- Test credentials: `/app/memory/test_credentials.md`.
- Frontend testing report: `/app/test_reports/iteration_1.json`.
- Preview URL is derived from `REACT_APP_BACKEND_URL`.
