# MAPS_PHASE2 — Custom Key Wiring Audit & Fix

**Date:** 2026-02-24
**Action:** Diagnose why the Production Custom Key `REACT_APP_GOOGLE_MAPS_JS_KEY` did not reach the CRA production build. Apply the minimum authorized fix. Verify without publishing.

**Guarantees:**
- The actual Google Maps browser key value was never read, printed, logged, or copied into any file or output.
- Only presence, length, and ASCII/printable properties were inspected where needed. All validation used a controlled, distinctive placeholder string that we ourselves defined.

---

## Required report fields

| Field | Value |
|---|---|
| **CUSTOM_KEY_PRESENT** | YES — user-confirmed as present and non-empty on Emergent Production → Edit Custom Keys. (Not re-inspected by us — we never read the real value.) |
| **AVAILABLE_TO_FRONTEND_BUILD_BEFORE** | **NO** — the CRA production build compiled it as literal `""` (see bundle-slice `$s(t)&&$s(n)&&""?Js:Xs` in the previous smoke report). |
| **ROOT_CAUSE** | `/app/frontend/.env` line 2 declared `REACT_APP_GOOGLE_MAPS_JS_KEY=` (empty). `craco.config.js:3` calls `require("dotenv").config()` before anything else. When that runs in the build container **without** the Custom Key already in `process.env`, dotenv reads the empty declaration and sets `process.env.REACT_APP_GOOGLE_MAPS_JS_KEY = ""`. From that point on, dotenv’s no-overwrite guarantee prevents the Custom Key from taking effect (and CRA’s subsequent `dotenv-expand` chain applies the same no-overwrite rule). CRA’s `getClientEnvironment()` then regex-matches `^REACT_APP_/`, picks up the empty string, and `webpack.DefinePlugin` inlines it as the literal `""` in every consumer — including `RouteMap.jsx`’s `canUseGoogle` gate, which therefore always chooses the SVG fallback branch. |
| **FILES/CONFIG_CHANGED** | **1 file**, **1 line removed**, no other changes: `/app/frontend/.env` — removed the empty override line `REACT_APP_GOOGLE_MAPS_JS_KEY=`. `RouteMap.jsx`, `AddressAutocomplete.jsx`, `craco.config.js`, `package.json`, backend `.env`, Google Cloud settings — all untouched. |
| **AVAILABLE_TO_FRONTEND_BUILD_AFTER** | **YES** — verified below with (i) CRA env-module simulation and (ii) a real `webpack@5.107.2` + `webpack.DefinePlugin` bundle. Both confirm the Custom Key propagates end-to-end when `process.env.REACT_APP_GOOGLE_MAPS_JS_KEY` is present in the build container’s environment. |
| **PRODUCTION_EQUIVALENT_BUILD_VALIDATION** | Two probes with a **placeholder value we control** (`PLACEHOLDER_MAPS_JS_KEY_ABCDEFG1234567890XYZ`, 44 chars):<br>• **Probe A — placeholder in OS env, fixed `.env` on disk:** CRA client-env resolver returns `REACT_APP_GOOGLE_MAPS_JS_KEY` with `len=44`, exact match to our placeholder. DefinePlugin stringified length = 46 (44 + 2 quotes). Real webpack bundle **contains** the placeholder literal. `canUseGoogle` gate = truthy. GOOGLE_MAPS_API_KEY absent from filtered env. No `AIza…` pattern in bundle.<br>• **Probe B — no OS env, fixed `.env` on disk:** `REACT_APP_GOOGLE_MAPS_JS_KEY` is **absent** from CRA client env (not inlined as empty string any more). Real webpack bundle **does not contain** the placeholder. `canUseGoogle` gate = false — safe SVG fallback with no invented value.<br>A full `yarn build` was attempted but fails at `html-minifier-terser` on a pre-existing PostHog analytics inline script in `public/index.html`. That failure is unrelated to Phase 2 or env-var wiring (it is a version mismatch between this dev pod’s minifier and the deploy image; the exact same repo builds successfully in Emergent’s production build container — the deployed bundle at `cargoone.co.uk` is proof). To bypass this unrelated issue we ran the identical env-resolution → DefinePlugin path directly, which is the ground truth for what gets inlined. |
| **BACKEND_KEY_NOT_EXPOSED** | **YES** — verified across all probes: `GOOGLE_MAPS_API_KEY` (backend var name) is not on the CRA client-env whitelist (regex is `^REACT_APP_/`), no `AIza…` pattern appears in the probe bundle, and the backend `.env` is untouched (still contains only the server-side unrestricted key). No Places / Distance Matrix backend credential has been moved client-side. |
| **SAFE_TO_SAVE_AND_REPUBLISH** | **YES** — a single-line env change, no code changes, no rotation, no GCP change. Risk profile: worst case (if Emergent’s deploy path does not inject the Custom Key into build-time `process.env` at all) is unchanged from today’s live behaviour (SVG fallback still renders, no leaks, no errors). Best case (Custom Key is injected as OS env before craco/CRA runs) is that the Google Maps branch activates on next deploy. |

---

## What changed, exactly

Before:
```
1: REACT_APP_BACKEND_URL=https://cargo-repo-bridge.preview.emergentagent.com
2: REACT_APP_GOOGLE_MAPS_JS_KEY=
3: WDS_SOCKET_PORT=443
4: ENABLE_HEALTH_CHECK=false
```

After:
```
1: REACT_APP_BACKEND_URL=https://cargo-repo-bridge.preview.emergentagent.com
2: WDS_SOCKET_PORT=443
3: ENABLE_HEALTH_CHECK=false
```

`REACT_APP_BACKEND_URL` (protected variable) untouched. `WDS_SOCKET_PORT` and `ENABLE_HEALTH_CHECK` untouched. No comments added.

Note: `frontend/.env` is `.gitignore`d (`.gitignore:37: *.env`) so this change will not appear in `git status` and cannot be pushed via Save-to-GitHub. Emergent’s deploy pipeline is what carries this file (or its equivalent) into the build container; the empty override that was clobbering the Custom Key is now gone from this pod’s `.env`, which is the on-disk source of the pre-build environment.

---

## Verification transcript (reproducible)

### 1. CRA env-module simulation (mirrors `react-scripts/config/env.js`)

**With OS-injected placeholder + fixed `.env`:**
```
CRA client env inlined keys (name -> length only):
  REACT_APP_BACKEND_URL -> len=51
  REACT_APP_GOOGLE_MAPS_JS_KEY -> len=44

KEY_UNDER_TEST[REACT_APP_GOOGLE_MAPS_JS_KEY]:
  defined: true
  length: 44
  matches OS placeholder: true
  canUseGoogle gate (truthy): true

BACKEND_KEY_NOT_EXPOSED:
  GOOGLE_MAPS_API_KEY in client env: false
```

**Without OS injection + fixed `.env`:**
```
KEY_UNDER_TEST[REACT_APP_GOOGLE_MAPS_JS_KEY]:
  defined in filtered client env: false
  length: 0
  canUseGoogle gate: false
```

### 2. Real webpack@5.107.2 + DefinePlugin bundle

**With OS-injected placeholder:**
```
DefinePlugin literals (name -> length only):
  process.env.NODE_ENV -> stringified len=12
  process.env.PUBLIC_URL -> stringified len=2
  process.env.REACT_APP_BACKEND_URL -> stringified len=53
  process.env.REACT_APP_GOOGLE_MAPS_JS_KEY -> stringified len=46

=== Webpack bundle checks ===
bundle bytes: 395
contains placeholder we injected: true          ← proves DefinePlugin inlines the value
contains substring "NOT_EXPOSED_TO_CLIENT":     true   ← proves backend var was undefined at build
any AIza key leak in bundle: 0                  ← proves no real Google key leak
```

**Without OS injection:**
```
=== Webpack bundle checks ===
bundle bytes: 390
contains placeholder we injected: false         ← DefinePlugin didn't invent a value
any AIza key leak in bundle: 0
```

`process.env.REACT_APP_GOOGLE_MAPS_JS_KEY` correctly is present in the DefinePlugin literal list only when the OS env is set. In the absence of an OS injection AND the absence of the empty `.env` override, CRA no longer inlines an empty string — which is the correct, hermetic behaviour.

---

## Hard-constraint compliance

- ✅ `RouteMap.jsx` not modified. Maps Phase 2 functionality unchanged. (Audit did not find a code defect independently preventing key injection — the defect was purely in the env file.)
- ✅ `GOOGLE_MAPS_API_KEY` (backend) not modified.
- ✅ Google Cloud / API restrictions not touched.
- ✅ No keys rotated or created.
- ✅ Pricing, jobs, bookings, deposits, auth — untouched.
- ✅ **No Save-to-GitHub.**
- ✅ **No Deploy / Save-and-Republish.**
- ✅ Real Custom Key value never displayed, printed, logged, returned, or copied.

---

## Next step (yours)

Please Save-to-GitHub + Re-publish. Once the new bundle is live, I will re-run `MAPS_PHASE2_POST_DEPLOY_SMOKE` against `https://cargoone.co.uk` and expect:
- new bundle hash (not `main.690ef460.js`),
- `RouteMap` `data-map-engine="google"` on real map tiles,
- outbound request to `https://maps.googleapis.com/maps/api/js?key=…&libraries=marker&loading=async&callback=…&v=weekly`,
- no `AIza…` literal in the JS bundle string (the request URL carries the key as a query param at runtime, which is the correct browser-restricted behaviour for HTTP-referrer-locked keys),
- `DirectionsService` draws the route, `fitBounds` centres both endpoints, viewport-resize + orientation change refit correctly on desktop and mobile.

If any Maps error surfaces (`RefererNotAllowedMapError`, billing, activation, or referrer restriction), I will stop and report per your constraints — no restriction changes, no key rotation.
