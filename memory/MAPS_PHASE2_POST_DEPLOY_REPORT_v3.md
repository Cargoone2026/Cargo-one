# MAPS_PHASE2_POST_DEPLOY_REPORT (v3 — post-key-injection)

**Date:** 2026-02-24
**Environment:** PRODUCTION — `https://cargoone.co.uk`
**Bundle under test:** `/static/js/main.149f6dbb.js` (648,337 bytes) — NEW hash (v1=`690ef460`, v2=`faf2078b`, v3=`149f6dbb`)
**Test type:** READ-ONLY smoke test. No changes made during this run.
**Test credentials:** disposable prod lifecycle customer `lc-prod-cust-1784928324@x.io`
**Key never displayed:** the browser key value is redacted throughout this report.

---

## 🟡 Executive Summary — **PARTIAL PASS**

**PASS:** Google Maps JS API loads, real tiles render, both markers fit into the viewport, desktop + mobile portrait + landscape + resize + remount + hard-refresh all behave identically, backend key is not exposed, commercial values unchanged. The Phase 2 rewrite is now fully live and functional at the tile / marker / bounds / lifecycle level.

**FAIL (single item):** Google Cloud project does **not** have the legacy **Directions API** enabled. Every `DirectionsService.route()` call returns `REQUEST_DENIED` / `LegacyApiNotActivatedMapError`. The straight-line polyline fallback inside `RouteMap.jsx` correctly kicks in, so the map still shows P→D visually, but the on-screen line is a geodesic straight line, **not the road-following driving route**.

Per your stop condition (“if the key itself is rejected by Google”) I have stopped and made no changes. The Maps JS **key itself is accepted** (tiles, markers, `AuthenticationService.Authenticate` all succeed). The rejection is API-service-scoped — a specific Google Cloud API is disabled for the project.

---

## Bundle-hash freshness (must be new, not cached)
| | Bundle |
|---|---|
| v1 (pre-fix) | `main.690ef460.js` |
| v2 (post-`.env`-cleanup) | `main.faf2078b.js` |
| **v3 (this run, post-key-injection)** | `main.149f6dbb.js` ✅ new |

---

## Bundle static analysis (`main.149f6dbb.js`)

| Check | Expected | Observed | Result |
|---|---|---|---|
| `AIza…` literals in JS bundle | **1** (the browser-restricted frontend key — mandatory for the loader URL construction) | **1** | ✅ PASS |
| That one `AIza…` value = backend key value? | **No** (must be a distinct browser key) | **No** — different values, both 39 chars but non-equal | ✅ PASS |
| `GOOGLE_MAPS_API_KEY` (backend var name) string | **0** | **0** | ✅ PASS |
| `maps.googleapis.com`, `maps/api/js`, `libraries=marker`, `v=weekly`, `loading=async`, `cargoOneMapsCb` | present | **1 each** | ✅ PASS |
| `DirectionsService`, `DirectionsRenderer`, `LatLngBounds`, `fitBounds` | present | **1 each** | ✅ PASS |

---

## Runtime browser probes

7 scenarios, one login, logged in as the disposable prod customer, navigating to `/customer/job/70d9f080-954d-46e6-aebd-d3ac4535f087` (Manchester → Birmingham, 69.6 Mi, £250).

| # | Scenario | Viewport | `data-map-engine` | `window.google.maps` | tile `<img>` count | canvases | Result |
|---|---|---|---|---|---|---|---|
| 1 | First load | 1920×900 | **`google`** | **true** | 23 | 2 | ✅ PASS |
| 2 | Hard refresh | 1920×900 | **`google`** | true | 23 | 2 | ✅ PASS |
| 3 | Nav away + return | 1920×900 | **`google`** | true | 23 | — | ✅ PASS |
| 4a | Remount cycle 1 | 1920×900 | **`google`** | — | 23 | — | ✅ PASS |
| 4b | Remount cycle 2 | 1920×900 | **`google`** | — | 23 | — | ✅ PASS |
| 4c | Remount cycle 3 | 1920×900 | **`google`** | — | 23 | — | ✅ PASS |
| 5 | Mobile portrait | 390×844 | **`google`** | — | 23 | — | ✅ PASS |
| 6 | Orientation → landscape | 844×390 | **`google`** | — | 23 | — | ✅ PASS |
| 7 | Viewport resize 500→1600 | dynamic | **`google`** | — | 23 | — | ✅ PASS |

Behaviour is **deterministic and stable** across all lifecycle scenarios — no intermittent SVG fallbacks any more.

Screenshots captured (during the run) show:
- Desktop: Ireland Sea + Isle of Man + Manchester + Birmingham + Wales/England labels on real Google satellite/road tiles.
- Mobile portrait: same map contents fitted into 390-wide viewport, both P and D markers visible.
- Landscape rotation: map re-fits to new aspect ratio; both markers stay visible.
- Both pickup (`P`) and dropoff (`D`) markers rendered as native `google.maps.Marker` (native marker DOM, not our SVG chips).

---

## Network trace (`maps.googleapis.com` + `maps.gstatic.com`)

**196 total maps-domain requests observed** during the run. Sample (first 12, key redacted):

```
https://maps.googleapis.com/maps/api/js?key=<REDACTED>&v=weekly&libraries=marker&loading=async&callback=__cargoOneMapsCb_1784933508612
https://maps.googleapis.com/maps-api-v3/api/js/65/10a/common.js
https://maps.googleapis.com/maps-api-v3/api/js/65/10a/marker.js
https://maps.googleapis.com/maps-api-v3/api/js/65/10a/util.js
https://maps.googleapis.com/maps-api-v3/api/js/65/10a/main.js
https://maps.googleapis.com/maps/api/mapsjs/gen_204?csp_test=true
https://maps.googleapis.com/maps-api-v3/api/js/65/10a/map.js
https://maps.googleapis.com/maps-api-v3/api/js/65/10a/geometry.js
https://maps.googleapis.com/maps-api-v3/api/js/65/10a/directions.js
https://maps.gstatic.com/mapfiles/openhand_8_8.cur
https://maps.googleapis.com/maps-api-v3/api/js/65/10a/infowindow.js
https://maps.googleapis.com/maps/api/js/AuthenticationService.Authenticate?1s...
```

- Loader URL uses the **frontend browser key** exactly as expected (`&loading=async&libraries=marker&v=weekly&callback=__cargoOneMapsCb_…`).
- `AuthenticationService.Authenticate` returned successfully — Google accepted the Maps JS + Marker library scopes for this key + HTTP referrer.
- No unexpected outbound to any other Google API.

---

## Console / page errors (Maps-related)

**Deprecation warnings (informational, not errors):**
- `google.maps.Marker` deprecated (Feb 2024) — recommendation `AdvancedMarkerElement`.
- `google.maps.DirectionsService` deprecated (Feb 25 2026) — recommendation `google.maps.routes.Route.computeRoutes`.
- `google.maps.DirectionsRenderer` deprecated (Feb 25 2026).

These are backlog items (already tracked as P3 “Migrate legacy Distance Matrix → Routes API v2”). None of them break rendering.

**Actual errors observed (recurring, one pair per mount, 7 mounts total during the run):**
```
Directions Service: You're calling a legacy API, which is not enabled for your project.
   To get newer features and more functionality, switch to the Places API (New) or Routes API.
   Learn more: https://developers.google.com/maps/legacy#LegacyApiNotActivatedMapError

MapsRequestError: DIRECTIONS_ROUTE: REQUEST_DENIED: There was an issue performing a Directions request.
   at https://maps.googleapis.com/maps-api-v3/api/js/65/10a/directions.js:8:347
```

- **Cause:** the Google Cloud project that owns this browser key has the legacy **Directions API** **disabled** (or never enabled). The Maps JavaScript API and Marker libraries are enabled (proven by successful tiles + markers), but the specific API service that `DirectionsService.route()` calls is not.
- **Effect at runtime:** `RouteMap.jsx`’s `ds.route(...)` callback receives `dstatus !== "OK"`, and the pre-existing straight-line fallback branch runs, drawing a black geodesic `google.maps.Polyline` between P and D on the real map tiles. That is why the screenshots show a straight line rather than the actual road-following route through the M1 / M6 corridor.
- **No RouteMap code defect.** The component behaves exactly as designed for the “Directions failed but tiles are OK” state.

---

## PASS / FAIL matrix (per your acceptance list)

| Criterion | Result | Notes |
|---|---|---|
| New bundle hash confirmed | ✅ PASS | `main.149f6dbb.js` |
| `data-map-engine="google"` | ✅ PASS | 7/7 scenarios |
| Google map tiles load | ✅ PASS | 23 tile `<img>` + 2 canvases per mount |
| **Driving route renders** | ❌ **FAIL** | Straight-line fallback only — Directions API disabled on GCP project |
| Pickup + dropoff markers both fit on screen | ✅ PASS | Both P and D visible across desktop + mobile + rotate |
| Desktop passes | ✅ PASS | |
| Mobile portrait passes | ✅ PASS | |
| Backend `GOOGLE_MAPS_API_KEY` remains unexposed | ✅ PASS | 0 backend-value literals in bundle, backend `.env` untouched |
| Existing distance / ETA / pricing unchanged | ✅ PASS | `69.6 Mi`, `£250` — backend-sourced |
| Maps JS console/API errors | 🟡 PARTIAL | Loader + tiles + markers: 0 errors. Directions: `REQUEST_DENIED` / `LegacyApiNotActivatedMapError` per mount (informational Marker/Directions deprecation warnings additionally). |
| Browser Maps JS key present only as expected for the restricted frontend key | ✅ PASS | Key is a distinct AIza value from the backend key; appears once (as the DefinePlugin string literal used by the loader URL) |

**Overall: PARTIAL PASS.** The Maps Phase 2 rewrite is live and correct at the code level. The only failing acceptance criterion (“driving route renders”) is blocked by a Google Cloud project-side API being disabled — not a repository, key, or code issue.

---

## Compliance with your hard constraints

- ✅ `RouteMap.jsx` not modified.
- ✅ Backend `GOOGLE_MAPS_API_KEY` not modified.
- ✅ No key rotated, no key created.
- ✅ No Google Cloud / API restriction changes made by me.
- ✅ No configuration changes during this smoke run.
- ✅ No Save-to-GitHub, no Deploy triggered by me.
- ✅ No echo / print / log of the browser key value.
- ✅ No backlog work (deposit lifecycle, account purge, security audit, CSRF, auth hardening) started.

---

## What must happen next (**your action** — I will not make these changes without explicit approval)

**Option A — Fastest, keeps current code:**
Enable the legacy **Directions API** on the same Google Cloud project that owns the browser key `AIzaSy… (redacted)`. Google Cloud Console → APIs & Services → Library → search **Directions API** → **Enable**. No key change, no restriction change needed. Then re-run the same smoke test — the fallback will disappear and the road-following route will render. (You did not authorize me to touch GCP; hence I have not.)

**Option B — Longer, forward-looking:**
Promote backlog Task 9 (“Migrate legacy Distance Matrix → Routes API v2”) into this cycle. It becomes a code change to `RouteMap.jsx` (`ds.route()` → `google.maps.routes.Route.computeRoutes()`) plus enabling the **Routes API** on the same project. This also silences the DirectionsService / DirectionsRenderer deprecation warnings. Requires you to lift the “Do not modify RouteMap.jsx or Maps Phase 2 functionality” constraint.

**Option C — Ship as-is:**
The current live behaviour (real Google tiles + branded markers + straight-line polyline + backend-sourced distance / ETA / price on the sidebar) is safe, non-leaking, and visually acceptable. If you consider straight-line acceptable for now, Phase 2 can be closed as PASS-with-known-limitation and the Directions fix bundled with the Routes API v2 migration later. I have not made this call for you — pausing for you to decide.

Report ends. Stopped. No downstream work started.
