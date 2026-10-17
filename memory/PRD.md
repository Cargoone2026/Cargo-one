# CargoOne — Product Requirements & Status

## Original Problem Statement
Build the Cargo One Driver mobile app using an Expo monorepo with React Native, using the existing Driver Web Portal as the exact functional source of truth and the Customer mobile app as the exact visual/UX source of truth. The Customer mobile app, Driver Web app, and Backend are permanently LOCKED and strictly off-limits for modifications.

## Current Status — 🔒 BASELINE LOCKED (Phase 4 + splash fix + Phase 5 Maps + Phase 6 Live Mode + Phase 7 Startup/Face ID + Phase 8 Home Dashboard + Phase 9 UI/Interaction Polish + Phase 10 ASAP Confirm Status Fix + Phase 11 Driver POD)
- Saved to GitHub ✓
- Pulled to Mac ✓
- Built with `npx expo run:ios --device` ✓
- Installed/launched on physical iPhone ✓
- Phase 4 fully tested on physical iPhone — **PASS** ✓
- Splash fix on-device **PASS** ✓
- **Phase 5 (Maps, no Live Mode) — COMPLETE / LOCKED / PHYSICAL IPHONE TEST PASSED** ✓
- **Phase 6 (Live Mode) — COMPLETE / LOCKED / PHYSICAL IPHONE TESTED WITH KNOWN FOLLOW-UP** ✓
- **Phase 7 (Startup / Loading / Face ID) — COMPLETE / 🏆 GOLDEN LOCKED / PHYSICAL IPHONE TEST PASSED** ✓
- **Phase 8 (Driver Home Dashboard — dark redesign) — COMPLETE / 🏆 GOLDEN LOCKED / PHYSICAL IPHONE TEST PASSED** ✓
- **Phase 9 (Driver UI / Interaction Polish) — COMPLETE / 🏆 GOLDEN LOCKED / PHYSICAL IPHONE TEST PASSED** ✓
- **Phase 10 (ASAP Booking Confirm Status Fix) — COMPLETE / 🏆 GOLDEN LOCKED / PHYSICAL IPHONE TEST PASSED** ✓
- **Phase 11 (Driver POD — Proof of Delivery) — COMPLETE / 🏆 GOLDEN LOCKED / PHYSICAL IPHONE TEST PASSED** ✓

## 🔒 Locked Scope (Permanent)
- `mobile/apps/customer/` — Customer mobile app (visual reference only)
  - **Locked baseline**: tag `customer-r71-16-1-golden` → commit `ac1feef` (2026-09-20).
  - **Local iOS Metro dev-client startup (locked procedure)**: see `/app/memory/CUSTOMER_IOS_METRO_SETUP.md`.
    - Metro: run from `mobile/apps/customer` on the Mac — `npx expo start -c --dev-client --lan`
    - Dev-launcher URL on the iPhone: `http://<ipconfig getifaddr en0>:8081` (plain `http://`, port **8081**, no scheme substitution tricks).
    - Verified working end-to-end on physical iPhone, 2026-10-06.
  - **Driver Metro side-by-side (dual-app sessions)**: see `/app/memory/DRIVER_IOS_METRO_SETUP.md`.
    - Driver Metro pinned to port **8082** via `yarn workspace @cargoone/driver expo start -c --dev-client --lan --port 8082`.
    - Driver iPhone dev-launcher URL: `http://<ipconfig getifaddr en0>:8082`.
    - Known failure if Driver iPhone taps a `:8081` entry: `new NativeEventEmitter() requires a non-null argument` in `useStripe.tsx` (Driver loaded the Customer bundle). Fix: re-enter `http://<IP>:8082` manually.
    - Verified working simultaneously with Customer Metro end-to-end on both physical iPhones, 2026-10-06.
- `frontend/` — Driver web portal (functional reference only)
- `backend/` — FastAPI backend
- `packages/core/` — Shared types + API wrappers
- Driver native configuration — `expo.autolinking.exclude` list in `apps/driver/package.json` keeps Customer-only native modules out (minus `expo-location`, now intentionally autolinked for Phase 6)
- **Phase 5 Maps implementation** — the 9 files listed under "Phase 5 — Locked Files" below are LOCKED
- **Phase 6 Live Mode implementation** — the 7 files listed under "Phase 6 — Locked Files" below are LOCKED
- **Phase 7 Startup / Loading / Face ID implementation** 🏆 GOLDEN LOCKED — the 7 files listed under "Phase 7 — Locked Files" below are LOCKED
- **Phase 8 Driver Home Dashboard implementation** 🏆 GOLDEN LOCKED — `mobile/apps/driver/src/screens/Home.tsx` is LOCKED as the Phase 8 baseline
- **Phase 9 Driver UI / Interaction Polish implementation** 🏆 GOLDEN LOCKED — the 4 files listed under "Phase 9 — Locked Files" below are LOCKED
- **Phase 10 ASAP Booking Confirm Status Fix implementation** 🏆 GOLDEN LOCKED — `mobile/apps/driver/src/screens/BookingDetail.tsx` PROGRESSION map is LOCKED as the Phase 10 baseline
- **Phase 11 Driver POD (Proof of Delivery) implementation** 🏆 GOLDEN LOCKED — the files listed under "Phase 11 — Locked Files" below are LOCKED
- **Background location** — permanently out of scope; no `Always` permission, no `UIBackgroundModes: location`, no `Location.startLocationUpdatesAsync`, no `requestBackgroundPermissionsAsync`

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

### Phase 5 — Maps (NO Live Mode) 🔒 LOCKED
- Available Jobs: List/Map toggle (Customer-parity SegmentedTabs)
- Available Jobs map: multi-pickup markers, bounds-fit camera, zoom/compass controls, tap-to-select → bottom sheet with price/route/CTA
- Job Detail: embedded RouteMap preview with pickup/dropoff pins + polyline, graceful MapFallback when coords missing
- Booking Detail Overview: embedded RouteMap preview (Phase-5 Active Job Map foundation; no live tracking)
- Driver-local `RouteMap` + `MapFallback` + `JobsMap` components (visual parity with Customer `RouteMap`)
- Native: `@rnmapbox/maps@10.1.31` removed from autolinking exclude, plugin added to `app.json`
- Native Info.plist bridge via custom `withCargoOneiOSFixes.js` plugin injecting `MBXAccessToken` from `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN.trim()` — part of locked native baseline
- `expo-location` **still excluded** — no user-location, no permissions, no tracking

#### Phase 5 — Locked Files
- `mobile/apps/driver/app.json`
- `mobile/apps/driver/package.json`
- `mobile/apps/driver/plugins/withCargoOneiOSFixes.js`
- `mobile/apps/driver/src/components/JobsMap.tsx`
- `mobile/apps/driver/src/components/RouteMap.tsx`
- `mobile/apps/driver/src/screens/AvailableJobs.tsx`
- `mobile/apps/driver/src/screens/JobDetail.tsx`
- `mobile/apps/driver/src/screens/BookingDetail.tsx`
- `mobile/yarn.lock`

#### Phase 5 — Mapbox Token Root Cause & Resolution (factual record)
- **Symptom:** Native Mapbox iOS SDK returned `HTTP status code 403` on the `composite` vector-tile source when running on a physical iPhone, even though the token was correctly delivered to the native SDK via `MBXAccessToken` in `Info.plist`.
- **Root cause:** The previous "Cargo One Production" public token had 3 URL restrictions configured in the Mapbox dashboard. Mapbox explicitly documents that URL-restricted tokens are not compatible with native SDKs (restrictions are only enforceable for web `Referer` headers). The native SDK's requests therefore failed authorization at Mapbox's edge → 403.
- **Resolution:** The Driver app now uses Mapbox's **Default public token** (URLs: N/A — no URL restrictions). Composite TileJSON and Streets v8 TileJSON both return HTTP 200 with this token. The token is loaded locally through `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` in `mobile/apps/driver/.env` only.
- **Secret hygiene (hard rule):** The actual token value is NEVER to be committed. It must not appear in `app.json`, source code, tracked `Info.plist`, GitHub, or any tracked file. Only `.env.example` (placeholder) is tracked; the real `.env` is local.

### Phase 6 — Live Mode 🔒 LOCKED
Uber-style, map-first Driver Live Mode. Mirrors the existing Driver Web `frontend/src/pages/portal/driver/Live.jsx` 1:1 for behaviour and reuses the Phase-5 Mapbox foundation for the map canvas. Visual quality parity with the Customer `ActiveJobMap`.
- `LiveMode.tsx` replaces the previous `ComingSoon` placeholder.
- `GET /driver/live/status` on mount; retains last-known lat/lng.
- **Go Online**: foreground location permission → `Location.getCurrentPositionAsync({ accuracy: High })` → `POST /driver/live/online` with `{ lat, lng, accuracy_m }`; shows "You missed N offers" toast from `missed_offers_count`.
- **While online**: two independent loops — 30 s heartbeat (`Location.getCurrentPositionAsync` → `POST /driver/live/heartbeat`), 5 s offer poll (`GET /driver/live/offers`). Both stop on offline/unmount.
- **Map**: driver puck at live_lat/live_lng, one price pin per offer at pickup_lat/lng, tap-pin → bottom sheet.
- **Bottom sheet** (peek/half/full, pure RN, no new animation deps): per-offer card with 60 s countdown from `dispatch_ready_at`, pickup/dropoff addresses + distances/duration, price, Decline (local), Accept.
- **Accept**: inlined `api("/jobs/{id}/claim", { method: "POST" })` (keeps `packages/core` locked); HTTP 409 → "Another driver just took this job" + refresh offers; success → navigate to `BookingDetail` (fallback `JobDetail`).
- **Go Offline**: `POST /driver/live/offline` (idempotent).
- Today's earnings/jobs pill via `GET /bookings/mine` (same compute as web).
- **ASAP per-booking tracking** (`BookingDetail.tsx`): foreground-only `watchPositionAsync` for paid ASAP bookings in `{confirmed, deposit_paid, travelling, arrived, collected, on_route}`, throttled to **≥30 m moved OR ≥45 s elapsed**, posts to `/tracking/{bookingId}` via `DriverAPI.pushTracking`. Stops on unmount, terminal status, cancellation, or permission denial.
- **Native**: `expo-location@~17.0.1` added (matches Customer); removed from `expo.autolinking.exclude`. iOS Info.plist: `NSLocationWhenInUseUsageDescription` only. Config plugin: `["expo-location", { locationWhenInUsePermission }]`. Android: `ACCESS_FINE_LOCATION` + `ACCESS_COARSE_LOCATION`. **No `Always` permission, no `UIBackgroundModes`, no background location.**
- Phase-5 Mapbox token path (`EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` + `withCargoOneiOSFixes.js` MBXAccessToken bridge) reused unchanged.

#### Phase 6 — Locked Files
- `mobile/apps/driver/src/screens/LiveMode.tsx`
- `mobile/apps/driver/src/components/LiveMap.tsx`
- `mobile/apps/driver/src/components/LiveBottomSheet.tsx`
- `mobile/apps/driver/src/screens/BookingDetail.tsx` *(additive ASAP tracking effect only; existing behaviour unchanged)*
- `mobile/apps/driver/package.json` *(expo-location added, removed from exclude)*
- `mobile/apps/driver/app.json` *(expo-location plugin + Info.plist usage string + Android permissions)*
- `mobile/yarn.lock`

#### Phase 6 — Physical iPhone Test Status
- Live Mode map renders successfully on the physical iPhone ✓
- Driver location marker renders ✓
- Nearby ASAP offers load ✓
- Offer bottom sheet renders ✓
- Go Online reaches the live API ✓
- Go Offline works ✓

#### Phase 6 — Known Follow-Up Issue (not fixed in this phase)
- **`POST /driver/live/heartbeat` returns HTTP 409 during an active online session** on the physical iPhone. Backend contract (`backend/server.py:2728–2744`) raises 409 "Driver is offline" when the user record's `live_online` flag is falsy at the moment the heartbeat is processed. Mobile call sequencing matches the Driver Web Live.jsx 1:1 (heartbeat loop fires only after `setOnline(true)` which only runs after a successful `/driver/live/online`), so this is NOT a mobile sequencing bug. The 409 surfaces during the session, after Go Online succeeded. **Root cause investigation and fix are deferred to a dedicated follow-up ticket. No code changes made in this phase.** No workaround is applied; the heartbeat loop simply logs the error and schedules the next tick (visible location may become stale, which the backend then surfaces as `reason: "stale_location"` on offer polls).

### Phase 7 — Startup / Loading / Face ID 🏆 GOLDEN LOCKED
Driver cold-start experience, verified end-to-end on the physical iPhone. Replaces the plain `ActivityIndicator` with a Driver-branded animated cube loader, and gates the authenticated stack behind a passkey-aware Face ID / Touch ID prompt. Visual language is Driver-native (`#0A0A0A` dark palette + Cargo One red accents) — NOT a copy of Customer's red surface. Behaviour is a 1:1 port of Customer `BiometricGate.tsx` adapted to Driver's `AuthContext`.

- **Verified physical-iPhone sequence** (end-to-end PASS): native iOS splash → Driver branded cube loading screen → Face ID biometric gate → successful unlock → Driver dashboard.
- **Previously-seen crashes resolved and NOT returning**:
  - `ERR_SPLASH_SCREEN_CANNOT_HIDE` — architecturally impossible this phase (no JS `SplashScreen` calls, `expo-splash-screen` remains in `expo.autolinking.exclude`; the iOS static LaunchScreen storyboard generated from `app.json`.`splash` is the only native splash in the pipeline).
  - `Invariant Violation: Invalid transform translateZ: {"translateZ":46}` — resolved by rebuilding the cube as a Hermes-safe **cabinet-style isometric projection** (three parallelogram faces using only `skewX`, `skewY`, `scaleX`, `scaleY`, `rotate`, `translateX`, `translateY`). The file header explicitly bans any future reintroduction of `translateZ`, `matrix`, or any z-axis-dependent transform.
- **DriverLoadingScreen.tsx**: full-bleed `#0A0A0A` surface matching the LaunchScreen; isometric cube; front face shows `assets/loading-mark.png`; Cargo-One-red edges on every face; container Z-rotation 0°→360° linear 10 s loop; scale breath 0.97↔1.03 ease-in-out 1.2 s loop reverse; 320 ms opacity fade-in; all transforms with `useNativeDriver: true`; no reanimated, no new native dep.
- **DriverBiometricGate.tsx**: Driver-branded dark/red fallback surface. Phases `checking → prompting → unlocked → failed`. Reads `/auth/passkey/list` via shared-core `listPasskeys()` (no `react-native-passkey` native dep needed; it stays in Driver's exclude list). Only prompts Face ID when `≥1 passkey` AND `hasHardwareAsync()` AND `isEnrolledAsync()`. 5-second global fuse guarantees the driver cannot be permanently locked out. One-shot per cold start; navigation inside the app does NOT re-trigger.
- **AuthContext.tsx**: 6-second `Promise.race` fuse on `coreMe()` so cold-start hydration can never hang indefinitely.
- **App.tsx**: hydration state renders `<DriverLoadingScreen/>`; authenticated stack is wrapped in `<DriverBiometricGate>`; Login stack rendered directly for `!user` (fresh users never gated).
- **Native config**: `expo-local-authentication@~14.0.1` added and autolinked; iOS `NSFaceIDUsageDescription: "Unlock the Cargo One Driver app with Face ID"` set; `withCargoOneiOSFixes.js` untouched; Mapbox config untouched; `expo-splash-screen` remains excluded; no `Always` location, no `UIBackgroundModes`, no background permissions.

#### Phase 7 — Locked Files
- `mobile/apps/driver/src/components/DriverLoadingScreen.tsx` *(Hermes-safe isometric cube; no executable `translateZ`)*
- `mobile/apps/driver/src/components/DriverBiometricGate.tsx` *(Face ID / passkey gate + fallback UI)*
- `mobile/apps/driver/src/App.tsx` *(hydration = DriverLoadingScreen; authed stack wrapped in DriverBiometricGate)*
- `mobile/apps/driver/src/AuthContext.tsx` *(6-second hydration fuse)*
- `mobile/apps/driver/app.json` *(NSFaceIDUsageDescription added; existing splash/Mapbox config untouched)*
- `mobile/apps/driver/package.json` *(expo-local-authentication added, removed from exclude; `expo-splash-screen` stays excluded)*
- `mobile/yarn.lock`

#### Phase 7 — Physical iPhone Test Status
- Cold-start renders native splash cleanly ✓
- Native splash → cube loader handoff has zero visual flash (`#0A0A0A` ↔ `#0A0A0A`) ✓
- Cube renders without Hermes invariant crash ✓
- AuthContext hydrates within fuse ✓
- Face ID prompt appears when a passkey is enrolled ✓
- Successful Face ID → Driver dashboard ✓
- `ERR_SPLASH_SCREEN_CANNOT_HIDE` did NOT return ✓

#### Phase 7 — Hard Rules (DO NOT violate in future phases)
- **DO NOT reintroduce `translateZ`, `matrix`, or any z-axis-dependent transform** anywhere in the Driver app (Hermes rejects them at the native bridge on RN 0.74).
- **DO NOT re-enable `expo-splash-screen`** or add any JS `SplashScreen.preventAutoHideAsync()` / `SplashScreen.hideAsync()` / `SplashScreen.show()` calls — the iOS static LaunchScreen is the only native splash and must remain so.
- **DO NOT modify `plugins/withCargoOneiOSFixes.js`** for startup/Face ID reasons; Mapbox and all native fixes it owns remain locked.
- **DO NOT change the biometric prompt copy** (`"Unlock Cargo One Driver"` / `"Cancel"` / `"Use passcode"`) or the fallback button labels (`"Try Face ID again"` / `"Log out"`) without an explicit new phase.
- **DO NOT shorten the 5-second gate fuse** or the 6-second AuthContext hydration fuse — they are the only safeguards against a permanently-locked boot.

### Phase 8 — Driver Home Dashboard 🏆 GOLDEN LOCKED
Dark Cargo One Driver Home redesign, verified end-to-end on the physical iPhone 14 and explicitly approved by the user as a **FULL PASS**. Reorganises the dashboard content below the Phase 2C-LOCKED PageHeader into an information-dense, operational Uber-style home. The approved visual source of truth is `memory/mockups/phase8_driver_home_v2_dark.html`.

- **Verified physical-iPhone sequence** (end-to-end PASS): iOS static LaunchScreen → Phase 7 Driver cube loader → Phase 7 Face ID biometric gate → successful unlock → **Phase 8 dark Home dashboard rendered successfully** → user explicitly approved as a FULL PASS. All previous Phase 1–7 behaviour remained intact.
- **Visual direction (locked)**: Cargo One Driver dark dashboard surface `#0A0A0A`; elevated cards `#141414`; inner surfaces `#1A1A1A`; subtle dividers `rgba(255,255,255,0.06)`; white primary typography; muted secondary typography `rgba(255,255,255,0.56)`; Cargo One red (`#D62828`) retained for the dropoff marker, notification badge, and brand accents; warm orange-red (`#F97316 → #FB923C`) for the primary "Open Live Mode" CTA; green `#10B981` for Online / success / verified states; amber `#F59E0B` for pending / in-review; yellow `#F4C430` for the vehicle registration plate chip. Feather icon language preserved. iPhone 14 target.
- **Home structure (locked)**:
  1. Existing PageHeader / bar preserved exactly (hamburger menu, "Hi {firstName}", "Ready to earn today?" subtitle, notification bell with badge, interactions, spacing, typography). Rendered on the dark surface; title/subtitle/bell content passed as JSX nodes with explicit white/muted colours so the component itself is untouched.
  2. Today / Earnings hero card: `TODAY · {date}` eyebrow + Online pill, large `£{today}.00` with offset pence, caption "Earned today · N completed deliveries", 7-segment weekday bar highlighting today, WEEK / MONTH / ALL-TIME strip **INSIDE** the hero, orange-red "Open Live Mode" CTA + 52 px trending-up icon button for Earnings details.
  3. Status banners (conditional): pending / changes_requested / suspended — unchanged semantics; Documents links wired to the real `Documents` screen.
  4. Next up: dark card, "All upcoming →" to `MyJobs`, inner `#1A1A1A` row with booking title, Deposit-paid chip, vertical route track (pickup ring + dropoff red square), price, 44 px white arrow button. Taps the full row → `BookingDetail` with `{ bookingId }`.
  5. Your bids: compact card with amber/green pending-vs-accepted progress bar, two stat tiles (Pending / Accepted), "N jobs near you · Browse →" pill → `AvailableJobs`.
  6. Documents: compact card with shield badge, "N documents in review" summary, dynamic segmented status bar (green verified / amber pending / red rejected / off), "Manage documents →" → `Documents`.
  7. Fleet: compact card with truck tile, default vehicle row (type · Default · yellow plate · status pill), "N vehicles · N active · N capabilities" footer, "Manage →" → `Fleet`.
  8. Rating + Messages: **side-by-side mini cards**. Rating 5.00 + star bar + review count → `Profile`. Messages unread count + "Open inbox →" → `MyJobs`.
- **Navigation fixes (locked)** — four pre-existing `Alert.alert("ships in a later phase")` stubs replaced with real routes to screens that already exist:
  - Pending-banner tap → `nav.navigate("Documents")`
  - Changes-requested "Update documents" → `nav.navigate("Documents")`
  - Next-up booking tap → `nav.navigate("BookingDetail", { bookingId })`
  - Documents "Manage documents →" → `nav.navigate("Documents")`
  No new routes, no new backend endpoints, no new API wrappers.
- **Implementation footprint**: contained entirely in `mobile/apps/driver/src/screens/Home.tsx`. The `DARK` palette lives as a local constant inside Home.tsx — not added to the shared theme, so no other screen or locked phase can be visually affected. Reuses existing primitives from `../ui` verbatim: `Page` (passed `bg="#0A0A0A"` via existing prop), `PageHeader`, `IconButton`, `Icon`, `PrimaryButton`, `colors.brand`, `space`. No shared primitive redesigned. No `ui.tsx` / `PageHeader` / `AppShell` changes.
- **Data flow**: existing `DriverAPI.dashboard() / listNotifications() / messagesUnreadCount() / resubmitVerification()` preserved. No backend contract changes, no new endpoints, no hard-coded mock values.
- **Native / dependency footprint**: zero. No `app.json`, `package.json`, or `yarn.lock` changes. No new deps. No native config change. No translateZ / matrix transforms. No animations beyond the primitives already in place.

#### Phase 8 — Locked Files
- `mobile/apps/driver/src/screens/Home.tsx` *(entire Phase 8 implementation; dark redesign + four stale-alert → real-route fixes)*
- `memory/mockups/phase8_driver_home_v2_dark.html` *(approved visual source of truth; stored for future reference / future-phase alignment)*

#### Phase 8 — Physical iPhone Test Status
- Driver app launched successfully on physical iPhone 14 ✓
- Phase 7 native splash → cube loader → Face ID gate flow remained intact ✓
- Successful biometric unlock reached Driver Home ✓
- Phase 8 dark Home dashboard rendered successfully ✓
- All navigation fixes verified (Documents / BookingDetail / Fleet / Available Jobs / Profile / MyJobs) ✓
- User explicitly approved the final Home dashboard as a **FULL PASS** ✓

#### Phase 8 — Hard Rules (DO NOT violate in future phases)
- **DO NOT revert the dark Cargo One Driver Home design** back to the previous light dashboard.
- **DO NOT redesign the PageHeader / bar** — Phase 2C locked, re-affirmed in Phase 7 and Phase 8.
- **DO NOT introduce a second visual theme** on the Home screen (no light-mode toggle, no hybrid).
- **DO NOT replace the approved Home composition** (hero / next-up / your-bids / documents / fleet / rating + messages ordering) without an explicit new phase/change request from the user.
- **DO NOT alter the four locked navigation fixes** (Documents x3, BookingDetail x1) without explicit authorization.
- **DO NOT modify the existing Phase 7 native startup / loading / Face ID implementation** as part of any Home work.
- **DO NOT reintroduce `translateZ` or `matrix` transforms** anywhere.
- **DO NOT re-enable `expo-splash-screen`**.
- **DO NOT modify the background-location restriction** or any Phase 6 Live Mode behaviour as part of Home work.
- **Any future Home redesign requires a new explicit phase/change request from the user.**

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

## 🏆 Phase 9 — Driver UI / Interaction Polish (COMPLETE / GOLDEN LOCKED)
Physical iPhone test result: **FULL PASS** ✓

### Phase 9 — Fixes Delivered
1. **Live Mode header** — Top-left menu/back button no longer overlaps the "Live Mode" title. Button fully visible and tappable. Safe-area handling correct (`SafeAreaView`).
2. **Live Mode bottom sheet** — "Looking for nearby jobs" handle is draggable (`PanResponder`). Vertical drag transitions between peek / half / full snap positions; short handle tap/cycle behaviour retained; horizontal gestures do not interfere; inner ScrollView remains functional.
3. **Available Jobs spacing** — List/Map segmented controls, sort chips, and pricing chips given modest additional vertical spacing. No functionality or filtering behaviour changed.
4. **Job Detail bidding keyboard** — Numeric keyboard no longer covers the bid amount/input area. Bid card auto-scrolls into view on focus via `KeyboardAvoidingView` + `ScrollView` with `automaticallyAdjustKeyboardInsets` and an `onBidFocus` handler. Bid amount, optional message, validation, cancel, and submit behaviour unchanged.
5. **Job Detail hook-order hotfix** — Fixed "Rendered more hooks than during the previous render" crash. Three Phase-9 hooks (`scrollRef = useRef`, `bidY = useRef`, `onBidFocus = useCallback`) were previously declared after the `loading`/`error` early returns and so were skipped on the initial render. They have been moved above all conditional early returns so React sees the same hook sequence on every render. Tapping an Available Job now reliably opens Job Detail.

### Phase 9 — Startup Baseline Reverified on iPhone
- Native splash passes ✓
- Driver cube loading screen passes ✓
- Face ID biometric gate passes ✓
- Dashboard loads successfully ✓

### Phase 9 — Locked Files
- `mobile/apps/driver/src/screens/LiveMode.tsx`
- `mobile/apps/driver/src/components/LiveBottomSheet.tsx`
- `mobile/apps/driver/src/screens/AvailableJobs.tsx`
- `mobile/apps/driver/src/screens/JobDetail.tsx`

### Phase 9 — Hard Rules (any future change requires an explicitly authorized new phase)
- **DO NOT** modify any of the four Phase 9 locked files without explicit new-phase authorization from the user.
- **DO NOT** redesign Home / modify Customer mobile / modify Driver web / modify backend / modify shared core/API.
- **DO NOT** modify Live Mode business logic, native dependencies, `app.json`, `package.json`, or `yarn.lock`.
- **DO NOT** change the startup architecture, re-enable `expo-splash-screen`, or re-introduce `translateZ`/`matrix` transforms.
- **DO NOT** perform unrelated cleanup inside Phase 9 files.
- **DO NOT** commit or push unless explicitly instructed — user handles Save to GitHub manually.

## 🏆 Phase 10 — ASAP Booking Confirm Status Fix (COMPLETE / GOLDEN LOCKED)
Physical iPhone test result: **FULL PASS** ✓

### Phase 10 — Verified physical-iPhone flow
Live Mode → Go Online → receive ASAP offer → Accept ASAP job → Booking Detail → Deposit Paid → tap **Confirm booking** → booking advances to **Travelling**.
- No HTTP 400.
- No "Invalid status" error.
- Existing next-step UI ("Mark arrived") appears correctly.
- All other Booking Detail flows (travelling → arrived → collected → on_route → delivered, cancellation, messages, POD, ASAP location tracking) remain functional.

### Phase 10 — Root cause (documented so this cannot regress)
Backend `POST /bookings/{booking_id}/status` (`backend/server.py:3915`) accepts only:
`travelling`, `arrived`, `collected`, `on_route`, `delivered`, `cancelled`.
It does **NOT** accept `confirmed`.
Driver Web (`frontend/src/pages/portal/driver/BookingDetail.jsx` STATUS_FLOW) correctly sends `deposit_paid → travelling`. Driver mobile previously (incorrectly) sent `deposit_paid → confirmed`, triggering HTTP 400 "Invalid status".

### Phase 10 — Fix delivered
Single-file surgical change in `mobile/apps/driver/src/screens/BookingDetail.tsx` PROGRESSION map:
```ts
{ from: "deposit_paid", to: "travelling", label: "Confirm booking", icon: "check-circle" }
```
The legacy `confirmed → travelling` fallback row is retained as a safety net for any booking already stuck in a `confirmed` state. Explanatory comment added above the PROGRESSION map documenting the backend contract so future edits cannot silently reintroduce `confirmed`.

### Phase 10 — Locked Files / Scope
- `mobile/apps/driver/src/screens/BookingDetail.tsx` — PROGRESSION map (and the surrounding backend-contract comment) are the Phase 10 baseline. Do not reintroduce `to: "confirmed"` for any `from:` row.

### Phase 10 — Hard Rules (any future change requires an explicitly authorized new phase)
- **DO NOT** change the Driver-mobile BookingDetail PROGRESSION map, CANCELLABLE set, or TRACKING_ACTIVE_STATUSES without explicit new-phase authorization.
- **DO NOT** modify backend `/bookings/{id}/status` validation / Customer / Driver Web / packages/core as part of mobile booking work.
- **DO NOT** modify any Phase 9 locked file (LiveMode, LiveBottomSheet, AvailableJobs, JobDetail).
- **DO NOT** modify any Phase 1–8 locked file.
- **DO NOT** change `app.json`, `package.json`, `yarn.lock`, or native dependencies.
- **DO NOT** commit or push unless explicitly instructed — user handles Save to GitHub manually.

## 🏆 Phase 11 — Driver POD (Proof of Delivery) (COMPLETE / GOLDEN LOCKED)
Physical iPhone test result: **FULL PASS** ✓ — complete start-to-finish POD flow verified end-to-end on-device.

### Phase 11 — Verified physical-iPhone flow
Live Mode → Go Online → ASAP offer accepted → Booking Detail → Deposit Paid → Confirm booking (Phase 10) → status progression → **POD tab** → add delivery photos (Camera + Library) → customer signature on canvas → optional delivery note → **Submit POD** → `delivered_at` set backend-side, booking status transitions to `pod_uploaded`, customer "Delivery complete!" push fires, pane flips to **POD uploaded ✓** view → reopen booking later and uploaded POD still persists via `GET /bookings/{id}/pod`.

### Phase 11 — Locked POD functionality
- POD upload / submission (`POST /bookings/{id}/pod`)
- Delivery photos (camera + photo library, multi-select, remove per-photo, base64 JPEG payload)
- Customer signature capture (native canvas via `react-native-signature-canvas` + `react-native-webview`, base64 PNG payload, Clear control, "Sign here" placeholder)
- Delivery notes (optional free text, backend default `"Delivered as agreed."`)
- GPS capture (best-effort `expo-location` snapshot at submit, swallows failures — identical to Driver Web)
- Timestamp (backend-owned on the created POD doc)
- Live submit-readiness checklist (photos count, signature captured, GPS attempted, timestamped)
- Submit gating (disabled unless ≥1 photo AND signature)
- Inline error state (friendly surface for permission denial or API error)
- Loading / submitting state on the Submit button
- **POD Uploaded** confirmation state (green banner, timestamp, notes, GPS coords, photo grid, signature image)
- Booking Detail **POD tab** (Overview / Messages / POD structure preserved from Phase 4)
- Delivery-complete customer push notification (backend-owned, triggered by the upload)
- Full physical-iPhone start-to-finish flow

### Phase 11 — Locked Files
- `mobile/apps/driver/src/components/SignaturePad.tsx` *(new file, Phase 11 baseline)*
- `mobile/apps/driver/src/screens/BookingDetail.tsx` *(PODPane + PodStep + ChecklistRow + related styles are the Phase 11 baseline — the Phase 10 PROGRESSION map inside this file remains independently locked)*
- `mobile/apps/driver/package.json` *(Phase 11 dependency set + autolinking exclude is the baseline — `expo-image-picker`, `react-native-webview`, `react-native-signature-canvas` added; `expo-image-picker` removed from `expo.autolinking.exclude`)*
- `mobile/apps/driver/app.json` *(Phase 11 iOS Info.plist permission strings and `expo-image-picker` plugin block are the baseline — `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`)*

### Phase 11 — Backend / Web / Customer / Core contract (unchanged, consumed as-is)
- Backend: `POD`/`PODUpload` schema at `backend/server.py:354–359`, endpoints at `backend/server.py:4443–4486`, status transition `→ "pod_uploaded"` and `delivered_at = now` are owned by the backend upload handler.
- Driver Web: `frontend/src/pages/portal/driver/BookingDetail.jsx` was the source-of-truth reference; **unchanged**.
- Customer: `mobile/apps/customer/src/screens/BookingDetail.tsx` POD view-only remains unchanged.
- Shared core: `mobile/packages/core/src/endpoints.ts` `DriverAPI.uploadPOD` / `DriverAPI.fetchPOD` wrappers consumed as-is; **unchanged**.

### Phase 11 — Hard Rules (any future change requires an explicitly authorized new phase)
- **DO NOT** modify any Phase 11 locked file (SignaturePad.tsx, BookingDetail.tsx POD section, package.json Phase 11 deps + autolinking exclude, app.json Phase 11 permissions + plugin) without explicit new-phase authorization.
- **DO NOT** invent new POD fields; the backend `PODUpload` schema is the sole contract.
- **DO NOT** change the Phase 10 PROGRESSION map (`deposit_paid → travelling`).
- **DO NOT** modify any Phase 9 locked file (LiveMode, LiveBottomSheet, AvailableJobs, JobDetail).
- **DO NOT** modify any Phase 1–8 locked file.
- **DO NOT** modify backend / Driver Web / Customer / `packages/core` as part of POD work.
- **DO NOT** re-add `expo-image-picker` to the autolinking exclude list; **DO NOT** remove webview/signature-canvas/image-picker from `dependencies`.
- **DO NOT** change `plugins/withCargoOneiOSFixes.js`, the startup / splash / Face ID architecture, or re-enable `expo-splash-screen`.
- **DO NOT** commit or push unless explicitly instructed — user handles Save to GitHub manually.

## 📋 Future Phases (NOT started — require explicit authorization)
Each future phase must start from the locked baseline.

### P1 — Phase 6 Follow-Up: Heartbeat 409 Root-Cause & Fix
- `POST /driver/live/heartbeat` returns HTTP 409 "Driver is offline" during an active Phase-6 session on the physical iPhone (see Phase 6 — Known Follow-Up Issue above).
- Phase-6 code remains locked; this ticket is read-only investigation first, then minimal targeted fix (likely on the mobile side only — Customer, Driver Web, backend, and shared core stay locked).

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

## Dev Environment Learnings (2026-10-09)
- Customer Metro (verified by user): `cd ~/Documents/GitHub/Cargo-one/mobile && yarn workspace @cargoone/customer expo start -c --dev-client --lan --port 8081`
- Never start Customer Metro from `~/Documents/GitHub/Cargo-one-driver-build` → white screen after bundle load. White-screen triage: check folder/port/duplicate react-native BEFORE any code rollback. See `CUSTOMER_IOS_METRO_SETUP.md`.
- Driver Metro (verified by user via lsof cwd): `cd ~/Documents/GitHub/Cargo-one-driver-build/mobile && yarn workspace @cargoone/driver expo start -c --dev-client --lan --port 8082`
- Device tests run from the wrong clone are invalid. The Messages→Chat fix still needs a re-test from `Cargo-one`.

## Chat/POD deep-link destinations (2026-10-09)
- Finding: golden baseline never had working Chat/POD routing (placeholders); not lost in rebuild. Web had the same gap for live ASAP + Dispatch `#messages` bug.
- Customer app: `resolveBookingTab(target, title)` in `pushNotifications.ts` — backend `target` wins, else title fallback ("Message from…"→chat, "Delivery complete…"→pod). Used by App.tsx PushBridge + Messages.tsx notification rows. Push title merged into payload. Keep fallback after backend deploy.
- Web: BookingDetail accepts `#chat`/`#messages`/`#pod`; deep-link skips the live-ASAP→Dispatch redirect. Dispatch Message button → `#chat`. Tested: /app/test_reports/iteration_r70_chat_pod_deeplink.json (8/8 pass).
- Backend (user deploys): server.py `send_message` push adds `"target": "chat"`; `upload_pod` push adds `"target": "pod"`.
- R71.13b diagnostic logs removed from Customer BookingDetail.tsx/Messages.tsx (2026-10-10, user-approved; routing confirmed, chat send verified on iPhone).

## Chat send fix (2026-10-09, user-approved core edit)
- Bug: `CustomerAPI.sendMessage` (packages/core/src/endpoints.ts) posted `{ body }`; backend `MessageCreate` expects `{ text }` → messages stored with empty text (pre-existing since golden). Fixed to `{ text: body }`. Verified via curl: old shape → text '', new shape → saved.
- Messages already sent with old shape stay blank (data, not fixable client-side).
- BACKLOG (P1, separate task, user said later): Driver app has NO push notifications — never registers push token; `expo-notifications` excluded from Driver autolinking. Needs Driver code + native rebuild (pod install/Xcode). Plan first, get approval.
- Pending prod redeploy: backend `server.py` (`target` on chat/POD pushes) + web portal (BookingDetail.jsx hash tabs, Dispatch.jsx #chat).

## LOCKED Customer baseline: `customer-r71-17-chat-pod-golden` (2026-10-10, user-approved)
- Commit `593358b` (annotated tag). Supersedes `customer-r71-16-1-golden` as the Customer rollback point.
- Includes: Fix A/A-2 (push dedupe), Fix B (focus refresh), Fix E (biometric loading screen), Phase 1/1b (initialTab routing + ASAP redirect exception), Phase 2/3 (Chat + POD tabs), title fallback `resolveBookingTab`, chat send fix (`{ text }`), R71.13b diagnostics removed. Verified on physical iPhone (Messages/notifications → Chat/POD, two-way chat) and production deployed.
- Customer Metro: `cd ~/Documents/GitHub/Cargo-one/mobile && yarn workspace @cargoone/customer expo start -c --dev-client --lan --port 8081`
- Do not modify Customer app without explicit user authorization.

## Driver push notifications v1 (2026-10-10, user-approved) — COMPLETE, iPhone-tested 2026-10-10
- Driver only. `package.json`: + `expo-notifications ~0.28.19`, + `expo-device ~6.0.2`; `expo-notifications` removed from autolinking exclude (rest unchanged). `app.json`: `owner: cargo-one-uk`, `extra.eas.projectId: 79d831f0-8213-4844-95f5-7ac3fadb4866`.
- New `src/pushNotifications.ts` (same logic as Customer), `src/pushRoutes.ts` (pure mapping, no native import), `src/PushBridge.tsx` (register on login / unregister on logout). `App.tsx` loads PushBridge via lazy `require` inside authenticated tree only (keeps native module out of boot chain — reason it was excluded in 276b4d0) + navigationRef.
- Routing: booking_id → BookingDetail (chat target/"Message from" → Messages tab; pod/"Delivery complete" → POD tab); job_id → JobDetail; doc_id/doc_types/"You're approved!" → Documents; else → Notifications. Driver Notifications screen uses same mapping.
- Mac: Cargo-one-driver-build → tag `driver-pre-push-checkpoint`, pull, `yarn install` (mobile), `bundle exec pod install` (apps/driver/ios), Xcode build, Driver Metro 8082. Possible blocker: APNs key for `co.uk.cargoone.driver` in EAS project.
- Rollback: `git restore --source=driver-pre-push-checkpoint -- mobile/apps/driver` + `bundle exec pod install` + rebuild. Earlier Driver golden: `driver-r71-16-h-golden`.

## LOCKED Driver baseline (pre-push): `driver-r71-17-pre-push-golden` (2026-10-10, user-approved)
- Commit `593358b` — last Driver state BEFORE push notifications v1 (`b465e02`). Supersedes `driver-r71-16-h-golden` (2026-09-22) as Driver rollback point.
- Rollback (Mac, Cargo-one-driver-build): `git restore --source=driver-r71-17-pre-push-golden -- mobile/apps/driver` → `cd mobile && yarn install` → `cd apps/driver/ios && bundle exec pod install` → Xcode rebuild.

## Driver push v1 — verified notes (2026-10-10)
- Driver push v1 COMPLETE — iPhone-tested 2026-10-10 (banner arrives; tap opens the booking's Messages tab). Customer unaffected.
- APNs push key `MDN3T637V3` (team `76XPJG3C72`) assigned to `@cargo-one-uk/cargoone-driver` via `eas credentials` (shared with Customer). `mobile/apps/driver/eas.json` added (development profile: developmentClient, internal).
- Driver iOS pods: use `bundle exec pod install` in `apps/driver/ios` — plain `pod install` fails with `quirks_mode` (Ruby `json` pin in Gemfile).
- Xcode: Push Notifications capability added in Signing & Capabilities (CargoOneDriver target).
- After a fresh install, connect the dev client via "Enter URL manually": `http://<Mac IP>:8082`.
- White screen between launch logo and app = dev-client bundling only; release/TestFlight builds don't show it.

## LOCKED Driver baseline: `driver-r71-17-push-golden` (2026-10-10, user-approved)
- Commit `36504a0` (annotated tag) — Driver push v1, iPhone-verified. Supersedes `driver-r71-17-pre-push-golden` (`593358b`) as the current Driver golden; keep that one as the pre-push rollback.
- `mobile/apps/driver/eas.json` was added after this commit (config-only, not app code) and lands in the next commit.
- Driver Metro: `cd ~/Documents/GitHub/Cargo-one-driver-build/mobile && yarn workspace @cargoone/driver expo start -c --dev-client --lan --port 8082`
- Do not modify Driver app without explicit user authorization.

## Customer JobDetail — pay deposit after driver accepts (2026-10-10, user-approved) — COMPLETE, iPhone-tested
- Bug (pre-existing since golden): scheduled fixed-price (and bid, if customer left Payment) jobs with `status=accepted` + `assigned_driver_id` showed "Awaiting Deposit" but no way to pay; only "No bids yet"/"Review bids".
- Fix (Customer `screens/JobDetail.tsx` only, mirrors web JobDetail "Continue to Payment"): accepted box (driver name + rating) + "Continue to payment" → `CustomerAPI.createBooking(jobId)` (idempotent) → `Payment`. Bids button hidden for fixed-price and awaiting-deposit jobs. ASAP explicitly excluded (`service_timing !== "asap"`).
- Verified: tsc pass; preview curl flow (fixed job → driver accept → job fields present → createBooking returns same booking twice, deposit £35). Test job left in preview DB: `f26286f6-…` "QA fixed deposit test".
- Next queue (user order): Heartbeat 409 fix → Job offer alerts (push) → TestFlight via Xcode Archive.

## LOCKED Customer baseline: `customer-r71-18-deposit-golden` (2026-10-11, user-approved)
- Commit `bd29359` (tag created on user's Mac and in agent env). Supersedes `customer-r71-17-chat-pod-golden` (`593358b`), which stays as the previous rollback.
- Adds over r71-17: JobDetail accepted box + "Continue to payment" for scheduled fixed-price/bid jobs (ASAP excluded). iPhone-tested: fixed job → driver accepts → green box → Continue to payment → deposit paid → chat/contact unlocked.
- Rollback (Mac, Cargo-one): `git restore --source=customer-r71-18-deposit-golden -- mobile/apps/customer` (or `customer-r71-17-chat-pod-golden` for the previous one).

## Tags confirmed on user's Mac (2026-10-11)
- `customer-r71-18-deposit-golden` (`bd29359`), `driver-r71-17-push-golden` (`36504a0`), `driver-r71-17-pre-push-golden` (`593358b`).

## Heartbeat 409 — PARKED: NOT REPRODUCED (2026-10-11, user decision)
- User: Live Mode online/offline works on iPhone, offers arrive, Driver web portal never opened. No changes to LiveMode.tsx or backend.
- Evidence (prod read-only, deployer RCA `/app/deployer-agent-docs/RCA_7f49054c-...MD`): `live_online` is account-global, flipped false ONLY by POST /driver/live/offline; single prod DB, 2 pods; driver heartbeats advancing normally 7 days. Prod access logs not retained. Theory if it recurs: concurrent session Go Offline + LiveMode swallows 409 (stays "online"). Fix options recorded: auto re-online on 409 / truthful offline UI / backend per-device presence.

## ASAP job offer alerts (push) v1 (2026-10-11, user-approved) — COMPLETE: iPhone-tested + production deployed 2026-10-11
- Backend `server.py`: `_send_asap_offer_alerts` / `_asap_offer_alert_loop` / `_start_asap_offer_alerts` (after `_driver_is_capable`). Steps 0/30/90/180/300 s (+1 s, matches DISPATCH_RADIUS_LADDER). Eligible: role driver, status active, live_online, live_updated_at ≤ 15 min, capable, not blocked, not busy on ASAP, within current job radius. Dedupe: atomic `$addToSet offer_alerted_driver_ids` (cross-pod safe). Push-only via `_deliver_expo_push` (NO inbox record). Logged in dispatch_log as `push_alerted`. Loop stops when `_dispatch_eligible` false or `dispatch_ready_at` changed.
- Hooks (1–2 lines each): `_finalise_paid_deposit` (only when ASAP job update modified) and driver-cancel ASAP re-dispatch.
- Push: title "New ASAP job nearby · £{accepted_price}", body "{pickup} → {dropoff} · {d} mi away", data `{type: "asap_offer", job_id}`.
- Driver `pushRoutes.ts`: `type === "asap_offer"` → LiveMode (no LiveMode.tsx change). JS only, no native rebuild.
- Preview test (/tmp/asap_alert_test.py, Expo send stubbed): locked-phone driver (5-min-old location, 0.8 mi) alerted at t=0.2 s; 15.9 mi driver alerted only at 30 s step; 20-min-stale driver never; duplicate deposit webhook no-op; no duplicate pushes; heartbeat+claim 200; cancelled job B got no further pushes; all loops exited; 0 inbox docs; 3 dispatch_log rows.
- Known limit: in-process asyncio task — a pod restart inside the 5-min window skips remaining steps (Live Mode polling unaffected).

## LOCKED Driver baseline: `driver-r71-18-offer-alerts-golden` (2026-10-11, user-created on Mac)
- Commit `55846ec` — contains ASAP offer alerts (backend `_start_asap_offer_alerts` + Driver `pushRoutes.ts` asap_offer → LiveMode). Supersedes `driver-r71-17-push-golden` (`36504a0`), kept as previous rollback; `driver-r71-17-pre-push-golden` (`593358b`) = pre-push.
- Driver/backend files identical between 55846ec and HEAD at tagging time. VERIFIED 2026-10-11: iPhone (Live Mode online → backgrounded → customer paid ASAP deposit → banner → tap opened Live Mode → Accept worked); backend deployed to production.
- Known limitations: single-server (in-process) alert task — pod restart inside the 5-min window skips remaining steps; drivers alerted in the first round are NOT re-alerted after a driver cancel/re-dispatch (`offer_alerted_driver_ids` persists on the job).

## Delivered (pod_uploaded) bookings on Customer side (2026-10-11, user-approved) — PREVIEW-TESTED (web), APP DEVICE TEST PENDING
- Root cause: POD sets booking+job `status=pod_uploaded`; Customer filters/redirect only knew completed/delivered/cancelled. `completed` only via web "Confirm delivery & complete" (no payment role — payment settled customer↔driver before POD).
- Customer app (JS only): Bookings PAST + Home active filter include pod_uploaded/delivered; BookingDetail no ASAP→Dispatch redirect for delivered; "Cancel & request refund" hidden when delivered; "Leave a review" when delivered and no review yet (`/bookings/{id}/review/mine` via core `api`, refetched on focus); Dispatch shows "Delivered" for pod_uploaded; customer theme label pod_uploaded → "Delivered".
- Web: Bookings PAST + isActiveAsap, Dashboard active filter, BookingDetail redirect guard/phase/banner hidden/review UI on pod_uploaded; customer badges map pod_uploaded → "Delivered" (shared theme.js untouched, Driver web keeps "POD Uploaded").
- Backend (approved): `DELIVERED_BOOKING_STATUSES` + 409 "This booking has been delivered and can no longer be cancelled or refunded" in `customer_cancel_booking` and `_customer_cancel_and_refund_impl`. Review endpoint already accepted pod_uploaded (no change).
- Verified: curl (409 both endpoints, review 200 on pod_uploaded); Playwright (Past list + Delivered badges, no redirect, no banner, leave-review visible / my-review card when reviewed, active ASAP still → Dispatch); Customer tsc pass. Preview test data: bookings 82dd0acb… (no review), 032abea3… (reviewed).
- Web "Confirm delivery & complete" button still shown on pod_uploaded (untouched).
- 2026-10-11 follow-up (user-approved shared-core edit, Customer path only): `CustomerAPI.submitReview` posted to non-existent `/reviews` (404). Now `POST /bookings/{id}/review` `{ rating, comment, photos: [] }`. DriverAPI untouched. Verified preview: 1st review on pod_uploaded booking saved, 2nd → 409 "You have already reviewed this booking."; Customer + Driver tsc pass. iPhone: delivered-booking fix PASSED; review submit re-test pending after pull.
- 2026-10-11 follow-up: (a) Customer app BookingDetail review button — `fetchMyReview` now runs via useEffect when the booking finishes loading (isDelivered flips) AND on focus (useFocusEffect), so "Leave a review" shows when none exists and hides after submit. tsc pass; device test pending. (b) Web BookingDetail: "Confirm delivery & complete" removed for pod_uploaded (+ unused `completeBooking` removed); backend `/bookings/{id}/complete` untouched. Playwright on fresh delivered booking dab7ebb6…: no confirm button, Leave a review → submit → my-review card shown.

## Customer app ASAP Live booking (Dispatch) parity fix (2026-10-11, user-approved) — PREVIEW-TESTED, DEVICE PENDING
- History: Dispatch/Payment/BookingConfirmed/core bookings+api unchanged since `customer-r71-16-1-golden` (only pod_uploaded line); backend dispatch/booking/tracking/claim/status unchanged → pre-existing gap, not a regression.
- Fix (Customer JS only): Dispatch takes optional `bookingId` param (BookingConfirmed + BookingDetail pass it; App.tsx type); lookup retried every dispatch poll until found (newest non-cancelled booking for job); status = furthest of booking/dispatch (STATUS_RANK); web-parity phases (Finalising booking / Finding a driver / Driver accepted / Driver on the way / Driver arriving / Cargo collected / Job in progress / Delivered); "Payment required" only if booking unpaid AND job not confirmed/dispatch_ready/deposit_paid and not dispatch_eligible; tracking polls from accepted; all polls restart on AppState active; "Open live tracking" (bounced back via BookingDetail redirect) → "Message driver" (BookingDetail initialTab chat) shown only when driver assigned + deposit paid + not delivered.
- Verified: tsc; /tmp/dispatch_state_test.js on real preview snapshots of full ASAP sequence (9/9) + 5 stale/missing-booking cases.
- 2026-10-12 iPhone results (after pull c69bbb3): Dispatch parity PASSED (deposit paid → Finding a driver; Driver accepted + Message driver → Chat/back; all live stages; lock/resume catches up; after POD Delivered + no Cancel & refund). Earlier PASSED: web Past/Leave a review/Confirm removed; app review submit endpoint fix.
- NOT YET VERIFIED (blocked by network errors on ZTE U50 hotspot ~13:50–14:05): app Past list for delivered ASAP + no cancel from Past; app "Leave a review" on fresh delivered booking (fix 3aa7df2).
- Errors seen: Customer GET /auth/me, /bookings/mine, /jobs/mine, /notifications, /messages/summary → Cloudflare 520 + "network failure"; Driver POST /tracking/{id} → "network failure". Read-only prod check requested (pods/logs/offer-alert task/tracking saves).
- 2026-10-12 prod incident RCA (deployer, read-only; `/app/deployer-agent-docs/RCA_3900a78d-...MD`): 520s were ORIGIN-SIDE. Pod OOMKilled (exit 137) at 12:58:19 UTC at tier_0 512Mi limit (restart_count=2); second replica failed startup probe until 12:58:39 → ~12:57–12:59 UTC no healthy pod. No 5xx lines (worker killed → log gap). Driver tracking for booking 19f1a973: 12 points saved 12:53:50–12:55:35, POD 12:55:48 → no tracking loss. No offer-alert errors logged. Suggested: raise tier (Deployment Panel → Resources); reduce memory: cache/throttle Google Distance Matrix on every GET /tracking, bound push fan-out/offer-alert task. Separate: prod email key invalid; Stripe uses a test-mode secret key in prod.

## Memory/OOM follow-up (2026-10-12, user-approved backend change) — PREVIEW-TESTED, DEPLOY PENDING
- `server.py`: ONE shared `httpx.AsyncClient` for Google calls (`_google_client()`; Distance Matrix + Places autocomplete + Place details; closed on shutdown). `_cached_tracking_eta(booking_id, target, …)`: ≤1 Distance Matrix call per (booking, target) per 60 s per pod; result (incl. None) reused; expired entries purged on write. GET /tracking response shape unchanged.
- Verified preview: 3 GETs /tracking within 3 s → 1 Google attempt; eta/remaining_miles/target/last_location/trail present; stubbed unit: same key cached, target change/other booking/expiry re-fetch.
- Read-only memory audit: no leaks found — `_asap_alert_tasks` bounded (≤5 min/job, removed on done); push tasks fire-and-forget; all other httpx clients are `async with` (closed); no unbounded module caches. Heavy-but-bounded admin endpoints load full docs (`to_list(1000/2000/10000)` in analytics/cancel stats) — only admin use. Per-request AsyncClient (+TLS setup) on every tracking poll was the hottest churn → fixed.
- Finding: preview `GOOGLE_MAPS_API_KEY` starts with Cyrillic "А" (U+0410) instead of Latin "A" → Google rejects it (ETA falls back to haversine). Check production key is pure ASCII (Google key prefix starts with Latin "A").
- Tier: user to raise in Deployment Panel/Manage Publishes → Resources (no rebuild, ~2 min). Recommend Launch (tier_1) minimum, Grow (tier_2) for public launch; exact RAM per tier not documented (support).
- Email (Resend): secrets `RESEND_API_KEY` (+ optional `EMAIL_FROM`, default noreply@cargoone.co.uk); domain cargoone.co.uk must be verified in Resend; redeploy after change; verify via forgot-password email + Resend → Emails log (`email_log` collection status=sent).
- Stripe live-switch CHECKLIST (do at launch, not now): backend `STRIPE_API_KEY`=live secret key, `STRIPE_PUBLISHABLE_KEY`=live publishable key, `STRIPE_WEBHOOK_SECRET`=live whsec; create live webhook endpoint `https://cargoone.co.uk/api/webhook/stripe` (events: checkout.session.completed, checkout.session.expired, checkout.session.async_payment_failed, payment_intent.succeeded, payment_intent.payment_failed); Customer app `EXPO_PUBLIC_STRIPE_PK`=pk_live in apps/customer/.env → requires new release/TestFlight build (inlined at bundle time); web has no publishable key (server-side Checkout); Driver app no Stripe; no Connect usage; Apple Pay merchant `merchant.co.uk.cargoone` certificate valid in Stripe live; verify with a small real payment + refund and Stripe webhook deliveries = 200.

## Customer app password reset fix (2026-10-12, user-approved core edit)
- core `auth.ts` `requestPasswordReset` posted to non-existent `/auth/request-password-reset` (404) → now `/auth/forgot-password` (`{ email }`, auth:false). Only Customer PasswordReset.tsx uses it (Driver uses DriverAPI.requestPasswordReset). PasswordReset PageHeader now has `onBack={() => navigation.goBack()}`.
- Verified preview: old path 404; forgot-password 200 `{ok:true}` + token issued; email_log row written (status `skipped` — preview has no RESEND_API_KEY; prod key invalid per RCA → emails won't send until key fixed); reset-password 200 → login with new password 200; token reuse 403; web `/auth/reset?token=…` renders form. Email link = `${APP_BASE_URL or https://cargoone.co.uk}/auth/reset?token=…` (web serves both /auth/reset and /auth/reset-password). testcustomer password restored. tsc pass.

## LOCKED Customer baseline: `customer-r71-19-golden` (2026-10-12, user-created on Mac; also tagged in agent env)
- Commit `8381319`. Supersedes `customer-r71-18-deposit-golden` (`bd29359`), kept as previous rollback.
- iPhone-verified: ASAP live screen (all stages, resume, Message driver), delivered → Past + "Delivered" + no cancel/refund, Leave a review in app, password reset (back button, email received, reset link, login with new password).
- Production: new `RESEND_API_KEY` works (welcome email received); server tier upgraded to Launch (2 GB); `GOOGLE_MAPS_API_KEY` fixed (plain ASCII "A").

## PRE-LAUNCH LIST (open)
- [ ] Switch Stripe to live — follow the "Stripe live-switch CHECKLIST" recorded above (backend secrets, live webhook endpoint, Customer app `EXPO_PUBLIC_STRIPE_PK` + new build, Apple Pay cert, verify with real payment + refund).
- [ ] Restrict CORS to `https://cargoone.co.uk` (currently `*`).
- [x] TestFlight builds for Customer + Driver via Xcode Archive — 1.0.0 (1) uploaded 13 Oct 2026.
- [ ] Raise iOS deployment target to 15.1 for BOTH apps (App Store Connect warning: currently 13.4 on the app target; Pods already 15.0 via Podfile.properties.json; Apple minimum iOS 15 from April 2027; Expo SDK 51 supports 15.1). Set in Xcode target → General → Minimum Deployments (ios/ is gitignored) and keep `ios.deploymentTarget` in Podfile.properties.json/plugin in sync.
- [x] (code done, pending Customer build 4) Customer app, Post Job pricing step: when `/quote/estimate` fails with `vehicle_capacity_exceeded` (or volume/weight over limits), show "This load is too large for our vehicles. Check your dimensions are in metres (e.g. 1.2 × 1.0 × 1.0)." Display only; no change to quote or pricing logic. Bundle with the iOS 15.1 / Stripe-live final build.
- [ ] Backend: stop httpx INFO logs printing the Google Maps API key.
- [x] (code done, pending Customer build 4 / Driver build 3) In-app account deletion: core deleteAccount → POST /auth/me/delete; Driver DeleteAccount screen + Settings row.
- [ ] Immediately BEFORE the Stripe live switch — One-off test data archive: move all pre-launch jobs, bookings, bids, messages, reviews, payment_transactions and driver_cancellations created before a cut-off date into archive_* collections (restorable, no hard delete), so revenue, job counts, driver earnings and ratings start at zero at launch. Keep real driver applicants. Report/dry-run first, plan approved before any code.

## iOS release / TestFlight (2026-10-13)
- App Store Connect records: "CargoOne" (`co.uk.cargoone.customer`) and "CargoOne Driver" (`co.uk.cargoone.driver`), team `76XPJG3C72`.
- First TestFlight builds uploaded 13 Oct 2026 via Xcode Archive: both apps 1.0.0 (1). EVERY future upload needs a higher Build number (CURRENT_PROJECT_VERSION) for the same version.
- ITMS-90482 (bitcode in MapboxCoreMaps / MapboxCommon / MapboxMobileEvents): permanent fix = Podfile `post_install` step "CargoOne strip bitcode" (strips `__LLVM` in place from every `Pods/**/ios-arm64/*.framework` binary via `xcrun bitcode_strip -r`; temp file in system tmp, nothing extra left in Pods; simulator slices untouched).
  - `ios/` is gitignored, so the step reaches the Mac via `mobile/plugins/withCargoOneiOSFixes.js` (`ensurePodfileBitcodeStrip`, runs on expo prebuild) and the tracked one-off patcher `mobile/scripts/apply-ios-bitcode-strip.js` (idempotent).
  - Mac, once per clone: `cd mobile && node scripts/apply-ios-bitcode-strip.js customer` (Cargo-one) / `... driver` (Cargo-one-driver-build), then `cd apps/<app>/ios && pod install` (Driver: `bundle exec pod install`). Look for "[CargoOne] stripped bitcode: …" lines.
  - Until that is done on a clone, run the manual `xcrun bitcode_strip -r` on the ios-arm64 Mapbox slices before archiving.

## 2026-06 — TestFlight round 1 fixes (build 2)
- Driver notified on customer cancel (paid + unpaid paths): `_notify_driver_customer_cancel` (one-time, flag `bookings.driver_cancel_notified_at`), called from `/customer/bookings/{id}/cancel` (unpaid) and in `finally` of `/customer/bookings/{id}/cancel-and-refund` route wrapper. Refund/fee code untouched.
- `_reject_if_cancelled`: driver `POST /bookings/{id}/status` and `/bookings/{id}/pod` → 409 on customer-cancelled bookings. `/driver/dashboard` drops `cancelled_at` bookings.
- Driver app: cancelled_at ⇒ shown as Cancelled (banner, no step/POD/cancel), 15s poll on detail, My Jobs refresh on focus. Driver web: same display normalisation (BookingDetail + MyJobs).
- Customer app AddressAutocomplete: safe-area insets in Modal; "not configured" note only after a real manual response; manual/no-coords addresses geocoded via expo-location (iOS CLGeocoder), save blocked if not found.
- Customer ASAP summary reads distance/time from `pricing_snapshot.inputs` fallback.
- Still pending: iOS deployment target 15.1, Stripe Live, CORS lock.
- ASAP live tracking (build 2): `GET /tracking/{id}` falls back to the assigned driver's Live Mode heartbeat (`live_lat/lng`, ≤120s) when `last_location` is missing/stale, active bookings only; trail/ETA cache unchanged. Driver app: `AsapTrackingBridge` (lazy-loaded after login, like PushBridge) replaces the BookingDetail-only watch; checks `/bookings/mine` on login/foreground/navigation (≥20s gap), 30s re-check only while an active paid ASAP booking exists; foreground When-In-Use watch, same 30m/45s throttle.

### Post-launch list
- Background driver tracking (Always location) — after launch prep.
- Customer map: driver pin always drawn above the A/B markers.
- Build 3 (pending Save to GitHub): PostJob (fixed/bid) keeps last successful distance/time (`routeInfo`) across failed /quote/estimate calls, cleared on address change; one 2s retry when none; "Couldn't calculate distance, tap to retry". AddressAutocomplete.pickSuggestion resets lat/lng to 0 on pick. Root cause: 422 PricingError (e.g. volume_too_large 125 m³) nulled quote → silent "—". ASAP and backend untouched. Open: httpx logs full Google API key in prod (user declined backend change for now).
- Admin "Delete user" (2026-06): `DELETE /admin/users/{id}` (admin only; 403 admin/self; 409 via `_active_booking_for` = unfinished booking either side excluding cancelled_at/deleted_at, or assigned accepted/confirmed job). Reuses `_anonymise_user` (extracted verbatim from `/auth/me/delete`, which now has the same 409 guard). Soft-deletes customer's posted/accepted jobs without booking; pending bids → withdrawn. Users list `include_deleted`; missing-phone list/nudge + admin stats user counts exclude deleted; approve/request-changes 409 on deleted. Web Users.jsx: Delete user + Show deleted.
- One-off prod test clean-up (abdulbasit2016diesel@gmail.com: 2 bookings + 2 jobs) ran and account deleted; temporary route + button removed. Audit record kept in `admin_oneoff_runs` (`test_cleanup_abdulbasit_2026_08_02`).
- App builds (Customer 4 / Driver 3), code only: Driver Register (role driver, phone required, same validator as backend, T&C/Privacy links, lands on Home pending-approval) + ForgotPassword (core requestPasswordReset); Driver DeleteAccount; core api.ts keeps `{code,message}` 422 details as ApiError.code/message; PostJob "load too large" note for vehicle_capacity_exceeded/weight_too_large/volume_too_large/too_many_items; app.json withCargoOneiOSFixes `deploymentTarget: "15.1"` (plugin now sets Podfile.properties + pbxproj IPHONEOS_DEPLOYMENT_TARGET on prebuild); customer expo-location Always keys disabled (false) + no background mode.

## Oct 2026 — Analytics removal
- Removed PostHog from frontend/public/index.html (no analytics/session recording).
- Cookie & Privacy policies (Settings.jsx LEGAL, used by /cookies /privacy) now state essential cookies only.
- Terms: "We keep a cancellation fee (currently 20% of the booking fee, ...)" (admin setting).
- CookieBanner is now a simple essential-only notice (Got it + Cookie Policy link, key cargoone.cookie_notice.v2).
- Open: emergent-main.js (preview console/network logger) still in index.html; Cloudflare Insights beacon injected at edge (not in repo).
- Added Cloudflare cookie-free visit statistics sentence to Privacy (s.7) and Cookie Policy. emergent-main.js kept by user decision.
- Driver app Documents.tsx: in-app photo upload (camera/library, q0.5, data:image/jpeg prefix) via DriverAPI.submitDoc; Upload/Replace/Resubmit labels; per-doc uploading/success/error; Submit for review (resubmitVerification) when status=changes_requested. Typecheck clean.
- Customer app.json owner/slug/EAS projectId set for push; Driver AsapTrackingBridge scheduled-booking fallback (travelling/arrived/collected/on_route, ASAP priority); Bids reviews modal SafeAreaProvider; Driver camera/photos permission wording updated.
- Round 3: customer cancel blocked (409) at collected/on_route + UI notices (app/web); /driver/dashboard counts delivered/pod_uploaded/completed; customer-facing total_jobs & verified_driver computed on read from finished bookings (_finished_job_counts); bids driver_name/driver_photo; driver photo avatars; Dispatch.tsx Your driver card (components/DriverCard.tsx); customer "Before you accept" -> "Vehicle".
