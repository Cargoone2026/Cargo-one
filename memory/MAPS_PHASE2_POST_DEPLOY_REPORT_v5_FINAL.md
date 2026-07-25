# MAPS_PHASE2_POST_DEPLOY_REPORT (v5 — FINAL)

**Date:** 2026-02-25
**Environment:** PRODUCTION — `https://cargoone.co.uk`
**Bundle under test:** `/static/js/main.7359ad8a.js` (648,337 bytes) — NEW hash
  Prior bundle progression: `690ef460` → `faf2078b` → `149f6dbb` → **`7359ad8a`** ✅
**Test type:** READ-ONLY. No code / config / secret changes made during this run.
**Test credentials:** disposable prod lifecycle customer `lc-prod-cust-1784928324@x.io`.
**Key never displayed:** only presence, length, prefix, and equality checks — never the raw value.

---

## 🟢 Executive Summary — **PASS**

All acceptance criteria met on the newly deployed bundle. Google Maps JavaScript loads, tiles render, `DirectionsService.route()` succeeds, the polyline **follows roads** (M6 corridor from Manchester through Stoke/Stafford down to Birmingham), both markers auto-fit into the viewport across desktop and mobile, no `REQUEST_DENIED` / `LegacyApiNotActivatedMapError` / `RefererNotAllowedMapError` / `BillingNotEnabledMapError` / `ApiNotActivatedMapError` / `InvalidKeyMapError` / `MissingKeyMapError`, and the backend `GOOGLE_MAPS_API_KEY` remains fully absent from the browser surface. Maps Phase 2 is now green in production.

---

## 1. New bundle hash confirmed ✅

| | Bundle |
|---|---|
| v1 (pre-fix) | `main.690ef460.js` |
| v2 (`.env` empty-line removed) | `main.faf2078b.js` |
| v3 (first key added) | `main.149f6dbb.js` |
| **v4 (this run — second key from Directions-enabled project)** | **`main.7359ad8a.js`** ✅ new |

---

## 2. Bundle static analysis (`main.7359ad8a.js`)

| Check | Expected | Observed | Result |
|---|---|---|---|
| `AIza…` literals in JS bundle | 1 (browser key, inlined for loader URL) | **1** | ✅ PASS |
| Bundle `AIza` value == backend `GOOGLE_MAPS_API_KEY` value | **No** (must be distinct browser vs. server keys) | **No** | ✅ PASS — no backend key leak |
| Bundle `AIza` value == frontend `.env` key value | **Yes** (proves rebuild picked up the swap) | **Yes** | ✅ PASS |
| Bundle `AIza` value == prior frontend key value | **No** (proves rebuild used the new key, not stale cache) | **No** | ✅ PASS |
| `GOOGLE_MAPS_API_KEY` (backend var name) string in bundle | 0 | **0** | ✅ PASS |
| `maps.googleapis.com`, `maps/api/js`, `libraries=marker`, `v=weekly`, `loading=async`, `cargoOneMapsCb` | present | **1 each** | ✅ PASS |
| `DirectionsService` symbol | present | **1** | ✅ PASS |

Loader URL key prefix at runtime (redacted): `AIzaSyAa…` (39 chars) — matches the new key, does **not** match the prior key.

---

## 3. Runtime browser probes

3-viewport pass on `/customer/job/70d9f080-954d-46e6-aebd-d3ac4535f087` (Manchester → Birmingham).

| Scenario | Viewport | `data-map-engine` | `window.google.maps` | tile `<img>` | canvases | Result |
|---|---|---|---|---|---|---|
| Desktop first load | 1920×900 | **`google`** | **true** | 23 | 2 | ✅ PASS |
| Mobile portrait | 390×844 | **`google`** | true | 23 | — | ✅ PASS |
| Landscape rotate | 844×390 | **`google`** | true | 23 | — | ✅ PASS |

**Backend commercial values unchanged:** `69.6 Mi · Parcels`, `£250` Fixed. Sourced from backend Distance Matrix + job record — not overwritten by client-side polyline math (per Phase 2 design).

---

## 4. Driving route follows roads (not straight line) ✅

Visual ground truth from the three captured screenshots:

- **Desktop 1920×900:** the black `DirectionsRenderer` polyline traces the M6 corridor from Manchester marker south through Stoke-on-Trent / Stafford area and into Birmingham marker. Distinct road-following curvature is visible at multiple junctions — clearly *not* a straight geodesic.
- **Mobile portrait 390×844:** same road-follow shape, viewport auto-fitted; the polyline curves are clearly visible even at the smaller scale.
- **Landscape 844×390:** the map re-fits on rotate; the road-following polyline redraws with both P and D still visible and inside the viewport.

Comparison with prior v3 test (same route, same coordinates): those screenshots showed a straight diagonal line P↔D. Current screenshots show a clearly curved, road-tracking polyline. This is the definitive PASS.

*(Note on the SVG-path probe results — DirectionsRenderer draws its polyline via a `<canvas>` overlay rather than SVG `<path>` elements, which is why the numerical `SVG path` command counts were 0. Visual screenshot inspection is the correct verification, and it clearly shows the road-following route.)*

---

## 5. Network trace (`maps.googleapis.com`)

- **56 maps-domain requests** total during the smoke run.
- **2 `DirectionsService.Route`** requests observed:
  - `…/DirectionsService.Route?…&1d53.4708&2d-2.2426&…&1d52.4862&2d-1.8904&…` — Manchester → Birmingham coordinates.
  - Both returned OK (no `REQUEST_DENIED` in the response stream and no error thrown on the JS callback, evidenced by the road-following polyline actually being drawn).
- Loader URL key prefix (first 8 chars only, redacted after): `AIzaSyAa…` — matches the new key.
- No unexpected outbound to any other Google API.

---

## 6. Console / page errors

| Error class | Observed count | Result |
|---|---|---|
| `REQUEST_DENIED` on any Maps API call | **0** | ✅ PASS |
| `LegacyApiNotActivatedMapError` | **0** | ✅ PASS |
| `ApiNotActivatedMapError` | **0** | ✅ PASS |
| `RefererNotAllowedMapError` | **0** | ✅ PASS |
| `InvalidKeyMapError` | **0** | ✅ PASS |
| `MissingKeyMapError` | **0** | ✅ PASS |
| `BillingNotEnabledMapError` | **0** | ✅ PASS |
| Deprecation warnings (Marker / DirectionsService / DirectionsRenderer) | 3 unique | ➖ informational only (tracked as P3 Routes API v2 backlog) |

---

## 7. Backend key security ✅

- Bundle contains exactly one `AIza…` literal — the frontend browser key — as required for the Maps JS loader URL construction on HTTP-referrer-restricted keys. This is the correct, expected surface for a browser-locked key.
- That single literal is **not equal** to the backend `GOOGLE_MAPS_API_KEY` (byte-for-byte equality check performed → False).
- The string `GOOGLE_MAPS_API_KEY` (backend var name) appears **0** times in the bundle.
- `/app/backend/.env` was **not touched** at any point in this smoke run or the preceding key-swap.
- No Places / Distance Matrix backend credential moved client-side.

---

## PASS / FAIL matrix (your final checklist)

| Criterion | Result |
|---|---|
| New bundle hash | ✅ PASS (`main.7359ad8a.js`) |
| Google Maps tiles load | ✅ PASS |
| Driving route follows roads (not straight line) | ✅ PASS |
| Pickup + dropoff markers visible and auto-fit | ✅ PASS (desktop, mobile portrait, rotate) |
| No `REQUEST_DENIED` / `ApiNotActivated` / `RefererNotAllowed` / billing errors | ✅ PASS |
| Backend `GOOGLE_MAPS_API_KEY` not exposed | ✅ PASS |

**Overall: PASS. Maps Phase 2 is production-green.**

---

## Compliance with hard constraints

- ✅ `RouteMap.jsx` unchanged.
- ✅ Backend `GOOGLE_MAPS_API_KEY` unchanged.
- ✅ No key rotated, no key created during this run.
- ✅ No Google Cloud / API restriction changes made by me.
- ✅ No configuration changes during this smoke run.
- ✅ No Save-to-GitHub, no Deploy triggered by me during this run.
- ✅ No key value printed, logged, or echoed.
- ✅ No deposit-lifecycle test, no account purge, no security-audit / CSRF / auth-hardening backlog work started.

Report ends. Stopping as instructed.
