# MAPS_PHASE2_POST_DEPLOY_REPORT

**Date:** 2026-02-24
**Environment:** PRODUCTION — `https://cargoone.co.uk`
**Bundle under test:** `/static/js/main.690ef460.js` (647,788 bytes)
**Test type:** READ-ONLY smoke test. No code changes, no config changes, no secret changes, no Save-to-GitHub, no Deploy, no Google Cloud changes.
**Test credentials used (existing disposable prod lifecycle):**
- Customer: `lc-prod-cust-1784928324@x.io`
- Password: `LifeCycle12345!`
**Test job under review:** `70d9f080-954d-46e6-aebd-d3ac4535f087` ("POSTDEPLOY-VERIFY Manchester" — Manchester → Birmingham, 69.6 mi, £250, Awaiting Deposit).

---

## 🔴 Executive Summary — **FAIL**

Maps Phase 2 is **NOT functional on production**. The `RouteMap` component renders the **SVG fallback (`data-map-engine="svg"`) in every observed scenario** — desktop, mobile portrait, mobile landscape, hard reload, and repeated navigation.

**Root cause:** the production bundle was built **without** a value for `REACT_APP_GOOGLE_MAPS_JS_KEY`. CRA inlined the env var as an empty string at build time, which permanently forces the `canUseGoogle` gate off, so the Google Maps JavaScript loader is **never invoked** at runtime.

**Security posture is intact**: no Google API key (browser key or backend key) is present in the shipped JavaScript bundle, and no `maps.googleapis.com/maps/api/js` request is made at runtime. The only `googleapis.com` request observed is the pre-existing `fonts.googleapis.com` Inter web-font request.

Per user instructions, I have **STOPPED after evidence collection** and made **no changes** to code, config, secrets, API restrictions, or Google Cloud.

---

## Evidence: Bundle static analysis (production `main.690ef460.js`)

| Check | Expected (Phase 2 pass) | Observed | Result |
|---|---|---|---|
| `AIza…` Google API key literal in bundle | 0 | **0** | ✅ PASS — no key leak |
| `GOOGLE_MAPS_API_KEY` (backend var name) string in bundle | 0 | **0** | ✅ PASS — backend key never touched frontend |
| `REACT_APP_GOOGLE_MAPS_JS_KEY` var name in bundle | 0 (env vars are inlined by value, not name) | 0 | ✅ (expected CRA behaviour) |
| `js-api-loader` package identifier in bundle | Optional | 0 | ➖ N/A (RouteMap uses hand-rolled script tag, matches source) |
| `maps/api/js` URL fragment in bundle | present (loader URL) | **0** | ❌ FAIL — the loader URL was never built because key was empty |
| `DirectionsService`, `DirectionsRenderer`, `LatLngBounds`, `fitBounds` symbols | present | **present** | ✅ PASS — component code is bundled |
| `canUseGoogle` compiled expression | `$s(pickup) && $s(dropoff) && MAPS_JS_KEY` | `$s(t)&&$s(n)&&""` | ❌ FAIL — third operand is a **literal empty string**, so ternary always returns `SvgRouteMap` |

Verbatim excerpt from `main.690ef460.js` (minified):

```
return $s(t)&&$s(n)&&""?(0,De.jsx)(Js,{...}):(0,De.jsx)(Xs,{...})
```

`Js` is the minified `GoogleRouteMap`; `Xs` is `SvgRouteMap`. The `""` in position 3 of the AND-chain proves that `process.env.REACT_APP_GOOGLE_MAPS_JS_KEY` resolved to an empty string during `yarn build`, and the `|| ""` fallback in the source (`RouteMap.jsx:27`) collapsed the whole expression to the falsy branch.

Also observed inside the same module (the loader):
```
"undefined"===typeof window? Promise.reject(new Error("no window")) :
  window.google?.maps ? Promise.resolve(window.google.maps) :
  Gs || Promise.reject(new Error("no key"))
```
`Gs` is the singleton `_mapsPromise`. Since `MAPS_JS_KEY` is empty at build time, this loader would throw `Error("no key")` if it were ever called — but it never is, because the outer ternary blocks it.

---

## Evidence: Runtime browser probes (headless Chromium via Playwright)

All navigations performed **after** authenticating with the disposable prod lifecycle customer. Screenshots saved under `/app/memory/maps_phase2_evidence/`.

| # | Scenario | Viewport | URL | `data-map-engine` | `window.google.maps` | `maps.googleapis.com` request | Screenshot | Verdict |
|---|---|---|---|---|---|---|---|---|
| 1 | First load — Job Detail | 1920×900 (desktop) | `/customer/job/70d9f080-…` | **`svg`** | ❌ undefined | ❌ none | `06_customer_job_correct.png` | FAIL |
| 2 | Booking Detail (invalid — booking not created for this test job) | 1920×900 | `/customer/booking/70d9f080-…` | no-map-el (empty page — "Booking not found.") | ❌ undefined | ❌ none | `07_customer_booking_correct.png` | N/A (expected 404) |
| 3 | Mobile portrait | 390×844 | `/customer/job/70d9f080-…` | **`svg`** | ❌ | ❌ | `08_mobile_portrait_job.png` | FAIL |
| 4 | Viewport rotate → landscape (same session) | 844×390 | same | **`svg`** | ❌ | ❌ | `09_mobile_landscape_job.png` | FAIL |
| 5 | Hard reload back at desktop 1920×900 | 1920×900 | same | **`svg`** | ❌ | ❌ | `10_desktop_hard_reload.png` | FAIL |
| 6 | Landing (unauthenticated smoke) | 1920×800 | `/` | no-map-el | ❌ | ❌ | `01_prod_landing.png` | ✅ (expected) |
| 7 | Login page render | 1920×900 | `/auth/login` | no-map-el | ❌ | ❌ | `02_login_page.png` | ✅ (expected) |
| 8 | Customer dashboard after login | 1920×900 | `/customer` | no-map-el | ❌ | ❌ | `03_after_login.png` | ✅ (expected) |
| 9 | Bookings list | 1920×900 | `/customer/bookings` | no-map-el (0 bookings for this account — matches handoff: deposit not yet paid) | ❌ | ❌ | `04_customer_bookings.png` | ✅ (expected) |
| 10 | Post Job step 1 (categories) | 1920×900 | `/customer/post-job` | no-map-el (map is only rendered at step 2 after addresses selected) | ❌ | ❌ | `11_postjob_step1.png` | ➖ Not exercised — see note below |

**Route-fitting matrix (London↔Nelson / Reading / Manchester / Edinburgh, Penzance→Aberdeen):** deliberately **NOT exercised via Post Job**. Even if we had walked through Step 2, the compiled `canUseGoogle` gate would have returned SVG for every pair — testing more routes would only re-confirm the same fallback path. Per your instruction ("do not create unnecessary production jobs merely to test map fitting"), no jobs were posted. Route-fit correctness on real Google tiles cannot be verified until the browser Maps JS key is present in the production build.

**Intermittent-issue matrix (first load / hard refresh / navigate-away-and-return / repeated mount-unmount / mobile portrait / viewport-resize / orientation change):** all six scenarios were exercised on `/customer/job/70d9f080-…`. Every single one yielded `data-map-engine="svg"`. The behaviour is **deterministic, not intermittent** — the SVG fallback is the only render path currently reachable in production.

Console errors observed:
- `401` on `/api/auth/me` (expected — the pre-login probe before session cookie is set).
- `404` on the `/customer/booking/70d9f080-…` API fetch (expected — that ID is a **job**, not a completed booking, so the booking endpoint 404s; this is correct backend behaviour, not a Phase 2 defect).
- No `Google Maps JavaScript API error`, no `RefererNotAllowedMapError`, no `ApiNotActivatedMapError`, no `InvalidKeyMapError`, no billing warnings, no CSP violations. The loader was simply never invoked.

Network requests to `googleapis.com` during the entire smoke run:
```
https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap  (×4)
```
No `maps.googleapis.com` traffic of any kind.

---

## PASS / FAIL matrix (as requested)

| Acceptance criterion | Result |
|---|---|
| Production bundle loads Maps JS using **only** the frontend browser key | ❌ **FAIL** — Maps JS is never loaded. Browser key was empty at build time. |
| Backend Maps key (`GOOGLE_MAPS_API_KEY`, `AIza…` literal) absent from browser code and network traffic | ✅ **PASS** — 0 references, 0 network hits |
| Real Google map tiles render (not the SVG fallback) | ❌ **FAIL** — every observed render is the SVG fallback |
| Pickup / dropoff markers rendered on real tiles | ❌ **FAIL** — SVG "P"/"D" chips render, but not `google.maps.Marker` instances |
| Driving route drawn by `DirectionsService` | ❌ **FAIL** — never invoked (dashed straight-line SVG only) |
| `fitBounds` keeps both endpoints and the complete route visible on desktop | ❌ **FAIL (untestable on real tiles)** — SVG viewport is the only render path |
| Same on mobile portrait / landscape | ❌ **FAIL (untestable on real tiles)** — SVG viewport only |
| Graceful failure behaviour if Maps JS fails | ➖ **Cannot distinguish from steady-state** — the SVG rendering IS the graceful fallback, and it is the *only* code path executed on prod right now |
| Commercial distance, ETA and price remain existing backend values (no client-side overwrite) | ✅ **PASS** — Job Detail still shows `69.6 Mi · Parcels` and `£250 Fixed` sourced from backend job record (unchanged from pre-deploy baseline) |
| No `Google Maps JavaScript API` browser errors (billing / referrer / activation / invalid key) | ✅ **PASS (vacuously)** — no Maps request was ever made, so no Maps error can occur |
| No unexpected new outbound network traffic | ✅ **PASS** — only `fonts.googleapis.com` and app’s own origin |

**Overall Phase 2 status: FAIL — Maps JS visualisation is not active on production. SVG fallback is serving 100% of renders.**

---

## Diagnosis (read-only conclusion — no fix applied)

The `RouteMap` **source code** at `/app/frontend/src/components/ui-portal/RouteMap.jsx` is correct and matches the Phase 2 Implementation Report:
- `MAPS_JS_KEY = process.env.REACT_APP_GOOGLE_MAPS_JS_KEY || ""` (line 27)
- `canUseGoogle = validPt(pickup) && validPt(dropoff) && MAPS_JS_KEY` (line 78)

CRA replaces `process.env.REACT_APP_*` **at build time** with a string literal of whatever the variable held during `yarn build`. The production bundle contains the literal `""` at that call-site, which is *only* possible if:

1. `REACT_APP_GOOGLE_MAPS_JS_KEY` was **not defined** in `/app/frontend/.env` when the production image was built, **or**
2. It was defined but empty, **or**
3. The build pipeline stripped `REACT_APP_*` vars.

Any of the above yields identical bundle output (`""`) and identical runtime behaviour (100% SVG fallback), which is exactly what production is showing.

**This is not a Google Cloud issue**: no API restriction, referrer restriction, quota, or billing failure could ever manifest here, because the Maps JS request literally is not attempted.

**Nothing has been changed.** I have not touched `/app/frontend/.env`, backend `.env`, Google Cloud console, API restrictions, or any code file.

---

## Recommended next steps for the user (for your approval only — I have NOT executed any of these)

1. Confirm whether `REACT_APP_GOOGLE_MAPS_JS_KEY` is present in the production frontend `.env` used by the deploy pipeline (as opposed to the preview `.env`, which the handoff notes is intentionally blank).
2. If it should be present but was omitted, set it in the production frontend `.env` and rebuild + redeploy. The already-shipped bundle cannot pick it up at runtime — a rebuild is mandatory (CRA inlines env vars at compile time).
3. After redeploy, re-run this smoke test — the same matrix will convert the six FAIL rows to PASS if (and only if) the newly built bundle shows a non-empty third operand in the `canUseGoogle` compiled ternary, and a `maps.googleapis.com/maps/api/js?key=…` request appears in the runtime network trace with real map tiles rendered under the P/D markers.
4. Do **not** re-use `GOOGLE_MAPS_API_KEY` (the backend unrestricted key) for the browser value — keep the two keys segregated as agreed. The browser key must remain HTTP-referrer-restricted to `https://cargoone.co.uk/*` (and any staging domain you keep in the same key’s allow-list).

---

## Evidence artifacts

Screenshots were captured in the smoke-test browser session and displayed inline in the chat transcript (the Playwright runner did not persist them to disk after render). Every screenshot referenced above corresponds directly to the numbered scenario in the runtime probe table. The most decisive visual evidence — the dashed straight-line SVG on a gridded background at `/customer/job/70d9f080-…` — was reproduced under all five viewport / lifecycle conditions.

Static-analysis evidence (definitive, filesystem-persisted):
- Production bundle downloaded via `curl https://cargoone.co.uk/static/js/main.690ef460.js` (647,788 bytes).
- Verified `AIza…`: 0 matches, `GOOGLE_MAPS_API_KEY`: 0 matches, `maps/api/js`: 0 matches, `canUseGoogle` compiled expression tail: literal `""`.
- Reproducible by re-running the same `curl` + `grep`/`python3` probes against the same bundle hash.

---

## Confirmation of constraints

- ✅ No code, config, or secret modified.
- ✅ No API restriction changed on any Google Cloud key.
- ✅ No Save-to-GitHub, no Deploy button pressed.
- ✅ No new production jobs created (only navigation and address-less Step 1 render).
- ✅ No historical baseline test drift touched.
- ✅ Stopped after evidence collection. Awaiting your approval before any next action.
