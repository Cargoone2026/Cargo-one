# Production Smoke — UK / IE / EU geography matrix

**Date:** 2026-02-27
**Environment:** PRODUCTION — `https://cargoone.co.uk`
**Bundle under test:** `/static/js/main.5a705e96.js` — NEW hash
  Bundle progression: v1 `690ef460` → v2 `faf2078b` → v3 `149f6dbb` → v5 `7359ad8a` → v6 `5a3f0ec1` → v7 `f08b98ff` → **v8 `5a705e96`** ✅

**Test type:** READ-ONLY smoke. No code / config / secret changes made during this run.
**Test credentials:** disposable prod lifecycle customer `lc-prod-cust-1784928324@x.io`.

---

## 🟢 Executive Summary — **FULL PASS**

The latest marker-size + route-colour refinement is live on all three geographic scales. Zero critical Maps errors, backend commercial values unchanged, backend key not exposed, and the branded 24×31 markers with the black polyline render correctly on both desktop and mobile across UK, Ireland (sea crossing), and Europe (cross-channel) routes.

---

## 1. Static bundle verification (`main.5a705e96.js`)

| Check | Expected | Observed | Result |
|---|---|---|---|
| New bundle hash | ≠ `f08b98ff` | **`5a705e96`** | ✅ PASS (fresh deploy, not cached) |
| `Size(24, 31)` marker size | 1 | **1** | ✅ PASS |
| `Size(28, 36)` previous size | 0 | **0** | ✅ PASS (last round replaced) |
| `Point(12, 35)` new anchor (marker float-above) | 1 | **1** | ✅ PASS |
| `#111111` (black polyline colour) | ≥1 | **403** | ✅ PASS (constant used across route + fallbacks) |
| `#1D4ED8` previous blue route colour | 0 | **0** | ✅ PASS (fully replaced) |
| `AIza…` literals | 1 (frontend browser key) | **1** | ✅ PASS |
| `GOOGLE_MAPS_API_KEY` (backend var name) | 0 | **0** | ✅ PASS |

---

## 2. Geography × viewport matrix

Three routes exercised, each on desktop 1440×900 and mobile portrait 390×844. All markers measured directly from the live DOM.

| Scope | Route | Distance (backend) | Desktop `data-map-engine` | Mobile `data-map-engine` | Summary strip | Marker sizes | Marker colours | Canvases | Screenshots |
|---|---|---|---|---|---|---|---|---|---|
| **UK** | Manchester → Birmingham (`70d9f080-…`) | **69.6 mi** | ✅ `google` | ✅ `google` | ✅ `Manchester → Birmingham   69.6 mi` | **24×31 / 24×31** | ✅ green `#16A34A` + red `#D62828` | 1 | `/tmp/geo_UK_desktop.png`, `/tmp/geo_UK_mobile.png` |
| **IE** (sea crossing) | Manchester → Dublin (`e8535abd-…`) | **165.7 mi** | ✅ `google` | ✅ `google` | ✅ `Manchester → Dublin   165.7 mi` | **24×31 / 24×31** | ✅ green + red | 3 | `/tmp/geo_IE_desktop.png`, `/tmp/geo_IE_mobile.png` |
| **EU** (cross-channel) | London → Paris (`151a0c26-…`) | **213.5 mi** | ✅ `google` | ✅ `google` | ✅ `London → Paris   213.5 mi` | **24×31 / 24×31** | ✅ green + red | 2 | `/tmp/geo_EU_desktop.png`, `/tmp/geo_EU_mobile.png` |

### Highlights from the screenshots
- **UK (Manchester → Birmingham)** — familiar M6 corridor via Stoke/Stafford. Both markers hover above their endpoints; polyline is now clearly black instead of blue; summary strip visible on top.
- **IE (Manchester → Dublin) — sea-crossing test** — `DirectionsService.route()` correctly builds the route via Liverpool, then routes over the Irish Sea to Dublin. The black polyline traces Manchester → Liverpool overland, then crosses the water in a straight ferry-style path to the D marker at Dublin. Real Google tiles showing Snowdonia, Peak District, Isle of Man labels. Auto-fit centered on the Irish Sea perfectly. On mobile, both endpoints stay comfortably inside the viewport with the widened `FIT_PADDING`.
- **EU (London → Paris) — cross-channel test** — real Google tiles showing UK, Ireland, Netherlands, Belgium, Germany, France labels. Both markers well within the viewport; black polyline visible traversing the English Channel. `fitBounds` framed the international route without cropping either marker on desktop or mobile.

### Marker sizing proof (extracted from live DOM `img.width` × `img.height`)
```
UK  desktop: [{w:24, h:31, fill:'#16A34A'}, {w:24, h:31, fill:'#D62828'}]
IE  desktop: [{w:24, h:31, fill:'#16A34A'}, {w:24, h:31, fill:'#D62828'}]
EU  desktop: [{w:24, h:31, fill:'#16A34A'}, {w:24, h:31, fill:'#D62828'}]
```
Exactly 24×31 in every case — confirms the latest ~15% additional shrink (down from 28×36) landed everywhere.

---

## 3. Console / page errors

**CRITICAL Maps errors during entire run: 0**

- `REQUEST_DENIED`: **0**
- `LegacyApiNotActivatedMapError`: **0**
- `ApiNotActivatedMapError`: **0**
- `RefererNotAllowedMapError`: **0**
- `InvalidKeyMapError`: **0**
- `MissingKeyMapError`: **0**
- `BillingNotEnabledMapError`: **0**

Only the pre-existing informational deprecation warnings (`google.maps.Marker`, `DirectionsService`, `DirectionsRenderer`) — already tracked as P3 Routes API v2 migration backlog. None of them break rendering.

---

## 4. Regressions — none

| Item | Status |
|---|---|
| Backend `GOOGLE_MAPS_API_KEY` not exposed | ✅ 0 refs in bundle |
| Bundle AIza literal ≠ backend key value | ✅ byte-for-byte non-equal |
| Backend commercial values (`distance_miles`, `duration_minutes`, price) | ✅ read-only display — UK £250 · 69.6 Mi unchanged; IE 165.7 mi; EU 213.5 mi (all backend-sourced) |
| Existing test IDs preserved | ✅ `route-map`, `route-map-summary`, `data-map-engine="google"` all present |
| `fitBounds` behaviour on wide, sea-crossing, and cross-channel routes | ✅ both markers visible + non-touching-edges on every viewport |
| Skeleton loading path | ✅ still triggered on first paint (deterministic) |
| Driver marker (blue circle) code path | ✅ shipped and unchanged (`buildDriverIcon` untouched) — not visually exercised on any of these 3 jobs because no live tracking is active |

---

## 5. Test artefacts on production (❗ need admin cleanup)

Two temporary jobs were created purely for the Ireland and Europe map tests, using the disposable lifecycle customer. Both titles explicitly say `SMOKE-TEST-…-MAP-ONLY (DO NOT BID)` and the description tells drivers not to bid.

| Job ID | Title | Route | Distance | Price |
|---|---|---|---|---|
| `e8535abd-479a-4182-b7de-d458e8ed4c38` | `SMOKE-TEST-IE-MAP-ONLY (DO NOT BID)` | Manchester → Dublin | 165.7 mi | £9999 (parked-high to deter accidental interest) |
| `151a0c26-19bf-48cd-8671-8794d27cdd5f` | `SMOKE-TEST-EU-MAP-ONLY (DO NOT BID)` | London → Paris | 213.5 mi | £9999 (same reason) |

**Why they still exist:** the API has no customer-facing cancel/delete endpoint (`POST /jobs/:id/cancel` → 404, `DELETE /jobs/:id` → 405, `PATCH /jobs/:id` → 405). Only an admin flow can remove them.

**Recommended action:** delete both via the admin panel at your convenience. In the meantime the DO-NOT-BID prefix + description + inflated £9999 fixed price should discourage any real bids. The pre-existing UK job `70d9f080-…` (Manchester → Birmingham) is your standing lifecycle test job and can stay.

---

## Compliance with hard constraints

- ✅ No code / config / secret changes made during this smoke run.
- ✅ `RouteMap.jsx` untouched since the last redeploy.
- ✅ Backend `GOOGLE_MAPS_API_KEY` untouched. Distinct from browser key. Absent from bundle.
- ✅ Pricing, booking-fee, deposit, bidding, distance-matrix, auth, Stripe, lifecycle — **all unchanged**.
- ✅ No Save-to-GitHub, no Deploy triggered by me.
- ✅ No key values printed / logged / echoed.
- ✅ No downstream backlog work (deposit lifecycle, account purge, CSRF, auth hardening) started.

Report ends. Stopped.
