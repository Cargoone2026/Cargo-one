# MAPS_PHASE2_POST_DEPLOY_REPORT (v2 — post-redeploy)

**Date:** 2026-02-24
**Environment:** PRODUCTION — `https://cargoone.co.uk`
**Bundle under test:** `/static/js/main.faf2078b.js` (648,538 bytes) — NEW hash, distinct from prior `main.690ef460.js` ✅
**Test type:** READ-ONLY smoke test. **No code, credential, GCP, configuration, or deployment change made during this run.**
**Test credentials used:** disposable prod lifecycle customer (`lc-prod-cust-1784928324@x.io`).

---

## 🔴 Executive Summary — **FAIL (different root cause from v1)**

The new production bundle **does now contain the full Google Maps loader code path** (loader URL, callback, `DirectionsService`, `LatLngBounds`, `fitBounds`, etc.) — the Phase 2 rewrite is shipped. However, at runtime the `RouteMap` component still selects the SVG fallback on **every** observed scenario because `MAPS_JS_KEY` resolves to `""` at runtime.

**Root cause (v2):** The Emergent Production Custom Key `REACT_APP_GOOGLE_MAPS_JS_KEY` did NOT reach the CRA build’s `process.env`. Consequently CRA’s `getClientEnvironment()` did not include the key in the DefinePlugin object at all. The compiled expression is:

```js
const Gs = {
  NODE_ENV:"production",
  PUBLIC_URL:"",
  WDS_SOCKET_HOST: void 0,
  WDS_SOCKET_PATH: void 0,
  WDS_SOCKET_PORT:"443",
  FAST_REFRESH: !0,
  REACT_APP_BACKEND_URL:"https://cargoone.co.uk"
}.REACT_APP_GOOGLE_MAPS_JS_KEY || "";
```

`REACT_APP_GOOGLE_MAPS_JS_KEY` is **absent** from that object literal. Accessing a missing property returns `undefined`; `undefined || ""` → `""`. So `Gs === ""` at runtime, `canUseGoogle` gate falsy, SVG fallback selected. No Maps script is ever loaded.

**Distinguishing observation:** The same object literal DOES contain `REACT_APP_BACKEND_URL:"https://cargoone.co.uk"` — a value that is **different from** the pod’s `.env` (`.../preview.emergentagent.com`). That means Emergent’s deploy pipeline **is** injecting other frontend env vars into the CRA build; it is specifically **not** injecting the Custom Key we need.

**Security posture: still intact.** No leaked backend key. No unexpected outbound traffic.

Per your constraints I have **STOPPED** here and made no changes.

---

## Evidence: New production bundle hash

```
prev bundle (before redeploy): /static/js/main.690ef460.js
curr bundle (this smoke run) : /static/js/main.faf2078b.js
```
Confirmed via `curl https://cargoone.co.uk/ | grep static/js`. Not cached — different hash, so we are exercising the new deployment.

---

## Evidence: Bundle static analysis (`main.faf2078b.js`)

| Check | Expected | Observed | Result |
|---|---|---|---|
| `AIza…` Google API key literal in bundle | 0 | **0** | ✅ PASS |
| `GOOGLE_MAPS_API_KEY` (backend var name) string in bundle | 0 | **0** | ✅ PASS |
| `maps.googleapis.com` | present (loader) | **1** | ✅ present |
| `maps/api/js` | present | **1** | ✅ present |
| `libraries=marker`, `v=weekly`, `loading=async` | present | **1 each** | ✅ present |
| `cargoOneMapsCb` (our unique loader callback name) | present | **1** | ✅ present |
| `DirectionsService`, `DirectionsRenderer`, `LatLngBounds`, `fitBounds` | present | **1 each** | ✅ present |
| `canUseGoogle` third operand — must be **truthy string** at runtime | truthy | `Gs` where `Gs = {…object literal without REACT_APP_GOOGLE_MAPS_JS_KEY key…}.REACT_APP_GOOGLE_MAPS_JS_KEY || ""` → **`""`** | ❌ FAIL |

Verbatim slice from the bundle (redacted for absent value):
```
const Gs = {NODE_ENV:"production",PUBLIC_URL:"",WDS_SOCKET_HOST:void 0,
            WDS_SOCKET_PATH:void 0,WDS_SOCKET_PORT:"443",FAST_REFRESH:!0,
            REACT_APP_BACKEND_URL:"https://cargoone.co.uk"}
           .REACT_APP_GOOGLE_MAPS_JS_KEY||"";
```

And the loader would build the URL as:
```
"https://maps.googleapis.com/maps/api/js?key=".concat(encodeURIComponent(Gs))
  + "&v=weekly&libraries=marker&loading=async&callback=".concat(n)
```
— but since `Gs === ""`, the outer `canUseGoogle` gate never permits this loader to run.

---

## Evidence: Runtime browser probes (Playwright + headless Chromium)

All scenarios logged in as the disposable prod customer, navigating to `/customer/job/70d9f080-954d-46e6-aebd-d3ac4535f087`.

| # | Scenario | Viewport | `data-map-engine` | `window.google.maps` | tile `<img>` count | Result |
|---|---|---|---|---|---|---|
| 1 | First load | 1920×900 | **`svg`** | undefined | 0 | FAIL |
| 2 | Hard refresh | 1920×900 | **`svg`** | undefined | 0 | FAIL |
| 3 | Navigate away + return | 1920×900 | **`svg`** | undefined | 0 | FAIL |
| 4a | Repeated mount/unmount cycle 1 | 1920×900 | **`svg`** | — | 0 | FAIL |
| 4b | Cycle 2 | 1920×900 | **`svg`** | — | 0 | FAIL |
| 4c | Cycle 3 | 1920×900 | **`svg`** | — | 0 | FAIL |
| 5 | Mobile portrait | 390×844 | **`svg`** | — | 0 | FAIL |
| 6 | Orientation → landscape | 844×390 | **`svg`** | — | 0 | FAIL |
| 7 | Viewport resize 500→1600 | dynamic | **`svg`** | — | — | FAIL |

Route-fit matrix for London↔Nelson / Reading / Manchester / Edinburgh / Penzance→Aberdeen — **not exercised**. Every path resolves through the same `canUseGoogle` gate; since the gate is currently pinned to falsy, exercising more routes cannot change the outcome, and per the same constraint we are not creating production jobs to test map fitting.

**Network requests to `maps.googleapis.com`:** 0 hits across the entire smoke run. Only `fonts.googleapis.com` (Inter web font) traffic was observed.

**Console / page errors that are Maps-related:** 0. No `Google Maps JavaScript API error`, no `RefererNotAllowedMapError`, no `ApiNotActivatedMapError`, no `InvalidKeyMapError`, no `MissingKeyMapError`, no `BillingNotEnabledMapError`. The loader is not invoked, so there is no Google-side error to observe — this is a **silent** failure driven purely by the missing build-time env var.

**Commercial values (backend-sourced) unchanged:** Job Detail still displays `69.6 Mi · Parcels` and `£250` (Fixed). ✅

---

## PASS / FAIL matrix (as requested)

| Acceptance criterion | Result |
|---|---|
| New bundle hash confirmed (not cached) | ✅ PASS (`main.faf2078b.js` — new) |
| `data-map-engine="google"` | ❌ FAIL — still `svg` |
| Maps JavaScript API network request occurs | ❌ FAIL — 0 requests |
| Real Google tiles render | ❌ FAIL — no tiles |
| Real driving route renders | ❌ FAIL |
| Pickup + dropoff markers visible on real tiles | ❌ FAIL |
| Desktop + mobile portrait | ❌ FAIL both |
| Resize / orientation / remount behaviour | ❌ FAIL (deterministic, not intermittent) |
| Short/medium/long routes | ➖ Not exercised (see rationale above) |
| No Google Maps console/API errors | ✅ PASS (vacuously — loader never invoked) |
| Backend distance/ETA/price unchanged | ✅ PASS — `69.6 Mi`, `£250` |
| Browser Maps JS key present as expected | ❌ FAIL — not present at all in DefinePlugin object |
| Backend `GOOGLE_MAPS_API_KEY` absent from browser bundle / network / storage | ✅ PASS |

**Overall: FAIL — different root cause than v1. Now the code path is fully shipped; the key value is not being injected at build time.**

---

## Diagnosis — v1 vs v2 differences (read-only)

| Aspect | v1 (bundle `690ef460`) | v2 (bundle `faf2078b`, post-redeploy) |
|---|---|---|
| Compiled `canUseGoogle` third operand | literal `""` inlined | property access `Gs = {env}.REACT_APP_GOOGLE_MAPS_JS_KEY \|\| ""` where `REACT_APP_GOOGLE_MAPS_JS_KEY` is absent from `{env}` |
| Maps loader URL / callback / marker lib strings in bundle | absent (dead-code eliminated) | present (loader shipped) |
| DirectionsService, LatLngBounds, fitBounds symbols | present but never callable via gate | same |
| Runtime request to `maps.googleapis.com/maps/api/js` | 0 | 0 |
| Root cause | empty `REACT_APP_GOOGLE_MAPS_JS_KEY=` line in `/app/frontend/.env` clobbered the value | Emergent Production Custom Key `REACT_APP_GOOGLE_MAPS_JS_KEY` was not present in the CRA build container’s `process.env` at all |

The v1 fix (removing the empty `.env` override) worked as intended and is visible in the v2 bundle: the DefinePlugin object no longer contains an empty `REACT_APP_GOOGLE_MAPS_JS_KEY:""` field. It contains **no such field at all**, which is the correct, hermetic behaviour when the env var is undefined at build time — no invented value.

**Proof that Emergent’s deploy pipeline DOES inject some frontend env vars for this project:** the same DefinePlugin object literal contains `REACT_APP_BACKEND_URL:"https://cargoone.co.uk"`, which is **different** from the pod’s `/app/frontend/.env` value (`https://cargo-repo-bridge.preview.emergentagent.com`). The pipeline overrode `REACT_APP_BACKEND_URL` with a production-scoped value. It did **not** provide a value for `REACT_APP_GOOGLE_MAPS_JS_KEY`.

**Conclusion:** the Emergent Production Custom Key you set is either not scoped to the frontend build, is not being carried into the frontend build container’s environment, or is registered under a slightly different name / case than `REACT_APP_GOOGLE_MAPS_JS_KEY`. This is a **platform-side configuration issue**, not a repository-side code issue. I cannot inspect the Emergent Custom Keys dashboard, and per your constraints I will not modify GCP, credentials, config, or deployment.

---

## Confirmation of hard constraints

- ✅ No code changes.
- ✅ No credential changes.
- ✅ No Google Cloud / API restriction changes.
- ✅ No `.env` changes during this smoke run.
- ✅ No configuration changes.
- ✅ No Save-to-GitHub, no Deploy / Save-and-Republish.
- ✅ No key values printed, logged, or leaked.
- ✅ No deposit-lifecycle test, no account purge, no backlog work started.

---

## Suggested next step for you (approve/reject only — I have executed none of this)

Options for restoring Phase 2, in priority order:

1. **Verify on Emergent Production → Edit Custom Keys** that the key is:
   - Exact name: `REACT_APP_GOOGLE_MAPS_JS_KEY` (case-sensitive, no trailing spaces).
   - Scoped/available to the frontend build (some platforms have separate frontend vs backend key stores).
   - Non-empty on save (some UIs silently drop values when the field loses focus during paste).
2. If Emergent’s Custom Keys UI does not expose an explicit "frontend build" toggle and the key looks correct, ping Emergent Support with this report — they can confirm whether the deploy pipeline emits frontend Custom Keys as `process.env.*` at CRA build time. (I am **not** contacting them on your behalf.)
3. If Emergent Custom Keys are known **not** to be exposed to the CRA build for this project template, we can add the key to the on-disk `/app/frontend/.env` in this pod before the next Save-to-GitHub + Re-publish. This is what would make `REACT_APP_BACKEND_URL` land — same mechanism should carry `REACT_APP_GOOGLE_MAPS_JS_KEY`. **I will not add the key without you explicitly authorising it and providing/confirming the value handling channel; per your constraints I must not read/print/copy the browser key value.** If you approve this path, please tell me the exact channel to receive the value (e.g., "paste into `/app/frontend/.env` yourself and I will only verify presence/length").
4. Rebuild + re-deploy, then I re-run `MAPS_PHASE2_POST_DEPLOY_SMOKE` and expect all rows to flip to PASS.
