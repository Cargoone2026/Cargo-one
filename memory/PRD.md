# CargoOne — Product Requirements & Status

## Original Problem Statement
Build the Cargo One Driver mobile app using an Expo monorepo with React Native, using the existing Driver Web Portal as the exact functional source of truth and the Customer mobile app as the exact visual/UX source of truth. The Customer mobile app, Driver Web app, and Backend are permanently LOCKED and strictly off-limits for modifications.

## Current Status — 🔒 BASELINE LOCKED (Phase 4 + splash fix) + Phase 5 pending-test
- Saved to GitHub ✓
- Pulled to Mac ✓
- Built with `npx expo run:ios --device` ✓
- Installed/launched on physical iPhone ✓
- Fully tested on physical iPhone — **PASS** ✓
- Splash fix on-device **PASS** ✓
- **Phase 5 (Maps, no Live Mode) — pending user prebuild + physical iPhone test**

## 🔒 Locked Scope (Permanent)
- `mobile/apps/customer/` — Customer mobile app (visual reference only)
- `frontend/` — Driver web portal (functional reference only)
- `backend/` — FastAPI backend
- `packages/core/` — Shared types + API wrappers
- Driver native configuration — `expo.autolinking.exclude` list in `apps/driver/package.json` keeps Customer-only native modules out
- **Live Mode** — remains a placeholder stub; no Mapbox / expo-location / live tracking

## Driver Mobile Baseline Features
### Phase 1 — Auth
- Login / authentication (bearer token via AsyncStorage)

### Phase 2 / 2B / 2C — Shell + Dashboard
- Home dashboard (dashboard API data)
- Customer-parity visual system (ui.tsx primitives, theme tokens)
- Animated slide-out drawer navigation (AppShell.tsx)
- `@expo/vector-icons` Feather glyphs

### Phase 3 — Available Jobs & Job Details
- Available Jobs list (search, filter, sort, pull-to-refresh)
- Job Details (fixed-price Accept + bidding Submit)

### Phase 4 — Remaining Driver Functions
- My Jobs (bookings + accepted + bids merged, segmented tabs, search)
- Booking Details (Overview / Messages / POD tabs)
- Booking messaging (inline chat with composer; text-only, no attachments)
- Booking status progression (confirmed → travelling → arrived → collected → on_route → delivered)
- Booking cancellation (reason picker)
- POD view-only
- Earnings (dark hero + stat tiles + recent deliveries)
- Fleet (list + add/edit/delete via VehicleEdit)
- Profile (identity card + Edit Profile + Change Password + address summary + reviews preview)
- Edit Profile
- Change Password
- Documents view-only (verification status)
- Notifications (list + detail + deep-links)
- Settings (Legal / Support / Account / Logout)
- Legal (Terms / Privacy / Cookies)
- Logout

### Phase 5 — Maps (NO Live Mode)
- Available Jobs: List/Map toggle (Customer-parity SegmentedTabs)
- Available Jobs map: multi-pickup markers, bounds-fit camera, zoom/compass controls, tap-to-select → bottom sheet with price/route/CTA
- Job Detail: embedded RouteMap preview with pickup/dropoff pins + polyline, graceful MapFallback when coords missing
- Booking Detail Overview: embedded RouteMap preview (Phase-5 Active Job Map foundation; no live tracking)
- Driver-local `RouteMap` + `MapFallback` + `JobsMap` components (visual parity with Customer `RouteMap`)
- Native: `@rnmapbox/maps@10.1.31` removed from autolinking exclude, plugin added to `app.json`
- `expo-location` **still excluded** — no user-location, no permissions, no tracking

## Code Architecture
- `/app/backend/` — FastAPI (LOCKED)
- `/app/frontend/` — React web Customer + Driver portals (LOCKED)
- `/app/mobile/` — Expo monorepo
  - `apps/customer/` — Customer mobile (STRICTLY LOCKED)
  - `apps/driver/` — Driver mobile (ACTIVE)
  - `packages/core/` — Shared types, auth, API endpoints (LOCKED)

## Key Driver API Endpoints (all pre-existing)
- `GET /driver/dashboard`
- `GET /jobs/nearby`, `GET /jobs/:id`, `POST /jobs/:id/accept`, `POST /jobs/:id/bids`
- `GET /bookings/mine`, `GET /driver/accepted-jobs`, `GET /driver/my-bids`
- `GET /bookings/:id`, `POST /bookings/:id/status`
- `GET/POST /bookings/:id/messages`, `POST /bookings/:id/messages/mark-read`
- `GET /bookings/:id/pod`
- `GET /driver/cancel-reasons`, `POST /driver/bookings/:id/cancel`
- `GET /driver/vehicles`, `POST/PUT /driver/vehicles[/:id]`, `DELETE /driver/vehicles/:id`
- `GET /catalog/capabilities`, `GET /catalog/vehicles`
- `GET /users/me/documents`
- `GET /notifications`, `POST /notifications/:id/read`
- `PUT /auth/me`, `POST /auth/me/change-password`
- `GET /users/:id/reviews`

## Known Limitations (backend-driven, not invented)
- POD **capture** omitted — needs `expo-image-picker` + signature canvas (excluded native deps)
- Document **upload** omitted — same reason; status viewing works
- Profile photo **upload** omitted — same reason; display works
- Reviews reply **omitted** from Profile — API exists (`replyToReview`) for a later phase
- **Delete account** omitted — backend has no Driver self-delete endpoint
- **Notification chime** omitted on mobile — uses pull-to-refresh instead

## 📋 Future Phases (NOT started — require explicit authorization)
Each future phase must start from the locked baseline.

### P1 — Phase 6: Live Mode (biggest; requires one more native dep)
- `expo-location` (foreground + background permissions) — currently excluded
- Driver online/offline toggle, heartbeat, ASAP offer accept
- Live route presentation using existing `JobsMap` / `RouteMap` foundation from Phase 5
- Native autolinking change required

### P2 — POD Capture
- `expo-image-picker` (photo capture of delivery)
- Signature canvas library
- POD upload to `/bookings/:id/pod`

### P2 — Documents Upload
- `expo-image-picker` (shared with POD)
- Upload to `/users/me/documents`

### P2 — Profile Photo Upload
- `expo-image-picker`
- Upload via `/users/me/documents` with `doc_type: profile_photo`

### P3 — Passkeys (Face ID / Touch ID)
- `react-native-passkey`
- Settings → Passkeys row

### P3 — Push Notifications
- `expo-notifications` + chime
- Register token via `/users/me/push-tokens`

### P3 — Review Reply from Profile
- Already-existing `replyToReview` endpoint
- Inline textarea on each review row

## Development Guardrails
- Driver web is the functional source of truth
- Customer mobile is the visual source of truth
- Reuse existing API wrappers; never invent endpoints
- Never modify Customer / Driver web / backend / shared core
- Native autolinking excludes must only be touched when a new native dep is explicitly authorized
- No commits/pushes by the agent — user handles Save to GitHub manually
