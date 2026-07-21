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

### Phase 2 Stage 2C — Admin Portal  🟠 P1  (next up, requires user approval)
- Approvals, catalog CRUD, deposit-band CRUD, user/driver management,
  disputes, contact-messages queue.

### Phase 3 — Production Hardening  🟢 P2
- Attach `cargoone.co.uk` domain; add production restricted Google Maps
  keys; switch Stripe to live keys + webhooks; add CSRF double-submit
  tokens for cookie auth.

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
