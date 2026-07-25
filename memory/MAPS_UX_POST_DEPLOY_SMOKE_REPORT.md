# Maps UX Enhancement — Post-Deploy Smoke Report

**Date:** 2026-02-25
**Environment:** PRODUCTION — `https://cargoone.co.uk`
**Bundle under test:** `/static/js/main.5a3f0ec1.js` (652,945 bytes) — NEW hash
  Bundle progression: v1 `690ef460` → v2 `faf2078b` → v3 `149f6dbb` → v5 `7359ad8a` → **v6 `5a3f0ec1`** ✅
**Test type:** READ-ONLY. No code / config / secret changes made during this run.
**Test credentials:** disposable prod lifecycle customer `lc-prod-cust-1784928324@x.io`

---

## 🟢 Executive Summary — **FULL PASS**

Every acceptance criterion for the Maps UX Enhancement Batch (branded markers, blue polyline, backend-sourced summary strip, skeleton loading, mobile + desktop parity, zero regressions) is met on the newly deployed production bundle.

---

## Static bundle analysis (`main.5a3f0ec1.js`)

| Check | Expected | Observed | Result |
|---|---|---|---|
| New bundle hash (not cached) | ≠ `7359ad8a` | **`5a3f0ec1`** | ✅ PASS |
| `AIza` literals | 1 (frontend browser key for loader URL) | **1** | ✅ PASS |
| `bundle_key == frontend_env_key` | True | **True** | ✅ PASS |
| `bundle_key == backend_env_key` | False (must be distinct) | **False** | ✅ PASS |
| `GOOGLE_MAPS_API_KEY` (backend var name) | 0 | **0** | ✅ PASS — backend key not exposed |
| Summary strip test IDs (`-summary-route`, `-summary-distance`, `-summary-duration`, `-wrapper`) | 1 each | **1 each** | ✅ PASS — new UX shipped |
| `animate-pulse` (skeleton CSS class) | present | **1** | ✅ PASS |
| `strokeWeight:6` (new blue polyline) | present | **2** | ✅ PASS (DirectionsRenderer + straight-line fallback) |
| `stroke-linejoin` (SVG teardrop marker stroke) | present | **2** | ✅ PASS |
| `#16A34A` (pickup green) | present | **45** | ✅ PASS |
| `#D62828` (dropoff red) | present | **164** | ✅ PASS |
| `#2563EB` (driver blue circle) | present | **6** | ✅ PASS |
| `#1D4ED8` (polyline blue) | present | **1** | ✅ PASS |
| `svg+xml` (marker data-URL scheme) | present | **2** | ✅ PASS |
| `cargoOneMapsCb` (loader callback) | 1 | **1** | ✅ PASS |
| `DirectionsService` symbol | 1 | **1** | ✅ PASS |

---

## Runtime browser probes

Logged in as the disposable prod lifecycle customer. Navigated to `/customer/job/70d9f080-…` (Manchester → Birmingham, 69.6 mi, £250).

| Scenario | Viewport | `data-map-engine` | Summary strip text | Marker `<img>` count | Marker fills detected | Canvases | Result |
|---|---|---|---|---|---|---|---|
| Desktop first-load (skeleton) | 1440×900 | (loading — data-map-engine attr set, tiles pending) | present above skeleton | 0 → | pending | 0 → | ✅ never blank |
| Desktop final | 1440×900 | **`google`** | `Manchester → Birmingham   69.6 mi` | 14 (2 branded + Google's control chrome) | **`#16A34A` (green pickup)**, **`#D62828` (red dropoff)** | 1 | ✅ PASS |
| Mobile portrait | 390×844 | **`google`** | `Manchester → Birmingham   69.6 mi` | 14 | (same) | — | ✅ PASS |
| Landscape rotate | 844×390 | **`google`** | (same) | 14 | (same) | — | ✅ PASS |

Marker titles (verifies our labels are attached to the correct icons, in the correct order):
```
['Keyboard shortcuts', 'Pickup', 'Dropoff', 'Undo last edit',
 'Toggle fullscreen view', 'Zoom in', 'Zoom out', …]
```
`'Pickup'` and `'Dropoff'` come from our `RouteMap.jsx` — the rest are Google's built-in controls.

Marker fill colours extracted from the actual SVG data-URL icons rendered on the live production DOM:
```
['#16A34A', '#D62828', '#d1d1d1', '#d1d1d1', '#3c4043']
```
`#16A34A` = pickup green, `#D62828` = dropoff red. The three greys belong to Google's controls (fullscreen, keyboard shortcut, etc.). No unexpected colours.

---

## Screenshots (captured during this run)

1. **`/tmp/uxprod_01_desktop_skeleton.png`** — first 200 ms after nav. Summary strip already visible above an `animate-pulse` gradient skeleton where the tiles are landing. Proves "never blank container" behaviour on first paint.
2. **`/tmp/uxprod_02_desktop_final.png`** — desktop 1440×900 final state. Real Google tiles (Ireland, UK, Netherlands, Germany). Green **P** at Manchester, red **D** at Birmingham. Both markers well inside the viewport, not touching edges. Backend-sourced summary strip on top: `📍 Manchester → 📍 Birmingham   🧭 69.6 mi`. Existing left-hand nav, pickup/dropoff card, and £250 Fixed price card untouched.
3. **`/tmp/uxprod_03_mobile.png`** — mobile portrait 390×844. Same job. Summary strip wraps neatly. Green P + red D visible, both fitting comfortably within the narrow viewport. Skeleton behaves the same on first paint.
4. **`/tmp/uxprod_04_landscape.png`** — after orientation rotate to 844×390. Map re-fit correctly on the `orientationchange` event; both P and D still visible; no cropping; summary strip intact.

---

## Network trace

| Metric | Value |
|---|---|
| Total requests to `maps.googleapis.com` / `maps.gstatic.com` | **50** |
| `DirectionsService.Route` requests | **2** — both succeeded (no `REQUEST_DENIED` in response stream) |
| Loader URL used the **frontend browser key** (not the backend key) | ✅ (byte-equality check against both env values) |
| Unexpected outbound to any other Google API | none |

---

## Console / page errors (Maps-related)

| Error class | Observed |
|---|---|
| `REQUEST_DENIED` | **0** |
| `LegacyApiNotActivatedMapError` | **0** |
| `ApiNotActivatedMapError` | **0** |
| `RefererNotAllowedMapError` | **0** |
| `InvalidKeyMapError` | **0** |
| `MissingKeyMapError` | **0** |
| `BillingNotEnabledMapError` | **0** |
| Maps JS deprecation warnings (Marker / DirectionsService / DirectionsRenderer) | 3 unique — informational, already tracked as P3 Routes API v2 migration backlog |

---

## Regression against Phase 2 acceptance ✅

| Phase 2 criterion | Result |
|---|---|
| New bundle hash confirmed | ✅ `main.5a3f0ec1.js` |
| Google Maps tiles load | ✅ Real UK/Ireland/Netherlands basemap tiles visible in every viewport |
| Driving route via `DirectionsService.route()` succeeds | ✅ 2/2 requests OK |
| Pickup + dropoff markers both fit into viewport, never touching edges | ✅ Verified on desktop, mobile portrait, and landscape rotate |
| Desktop + mobile parity | ✅ Same content, engine, and summary text on both |
| Zero `REQUEST_DENIED` / `ApiNotActivated` / `RefererNotAllowed` / `Billing` errors | ✅ 0 across the run |
| Backend `GOOGLE_MAPS_API_KEY` not exposed | ✅ 0 refs, and the single AIza literal in the bundle is byte-for-byte **≠** backend key |
| Commercial values unchanged | ✅ `£250` and `69.6 Mi` — backend-sourced |

---

## UX-batch acceptance ✅

| UX-batch criterion | Result |
|---|---|
| Green pickup marker with white **"P"** + white outline + drop shadow | ✅ visible on all viewports |
| Red dropoff marker with white **"D"** + same styling | ✅ visible on all viewports |
| Driver marker (blue circle) — visually distinct from P/D | ✅ code path in bundle; not exercised on this job because no live tracking is active |
| Blue polyline (thicker `strokeWeight:6`, high-contrast `#1D4ED8`, `strokeOpacity:0.92`) | ✅ rendered by `DirectionsRenderer` between P and D |
| Backend-sourced route summary strip above every RouteMap | ✅ `Manchester → Birmingham   69.6 mi` (ETA row correctly hidden — `job.duration_minutes` is null on this specific job; `distance_miles` and towns come straight from backend) |
| Markers never touch screen edges (mobile + desktop) | ✅ verified with the widened `FIT_PADDING = { top: 68, right: 44, bottom: 68, left: 44 }` |
| Skeleton → map → route → markers loading order, never blank | ✅ `animate-pulse` gradient captured in the 200 ms skeleton screenshot |

---

## Confirmation of hard constraints

- ✅ No code / config / secret changes during this smoke run.
- ✅ Backend `GOOGLE_MAPS_API_KEY` untouched, distinct from the frontend browser key, absent from the bundle.
- ✅ `RouteMap.jsx` unchanged since the UX batch was deployed.
- ✅ Pricing, booking-fee, deposit, bidding, distance-matrix, auth, Stripe, lifecycle — **all unchanged**.
- ✅ No Save-to-GitHub, no Deploy triggered by me during this smoke.
- ✅ No downstream backlog work (deposit lifecycle, account purge, CSRF, auth hardening) started.

Report ends. Stopping.
