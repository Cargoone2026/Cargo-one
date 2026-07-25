# MAPS_PHASE2 — Directions API verification (v4)

**Date:** 2026-02-25 (post-user-enabled-Directions-API)
**Environment:** PRODUCTION — `https://cargoone.co.uk`
**Bundle under test:** `main.149f6dbb.js` — unchanged from v3 (no redeploy needed; only Google Cloud API enablement changed, which is server-side at Google).
**Test type:** READ-ONLY. No code/config changes.

---

## 🔴 Result: **STILL FAILING** — same error as before Directions API was toggled on.

### 1. Frontend is using `REACT_APP_GOOGLE_MAPS_JS_KEY` ✅
- Loader URL observed: `https://maps.googleapis.com/maps/api/js?key=<REDACTED>&v=weekly&libraries=marker&loading=async&callback=__cargoOneMapsCb_...` — matches the frontend browser-restricted key (not the backend one).
- `AuthenticationService.Authenticate` returns success (tiles + markers render normally).

### 2. Google Maps JavaScript loads successfully ✅
- `data-map-engine="google"` on desktop (1920×900), mobile portrait (390×844), landscape rotate (844×390).
- `window.google.maps` defined.
- Real Google tiles + native `google.maps.Marker` for pickup (P) + dropoff (D) both visible and fitted into the viewport.

### 3. `DirectionsService.route()` still returns `REQUEST_DENIED` ❌
- 2 `DirectionsService.Route` requests observed at:
  `https://maps.googleapis.com/maps/api/js/DirectionsService.Route?5m4&1m3&1m2&1d53.4708&2d-2.2426&5m4&1m3&1m2&1d52.4862&2d-1.8904&6e0&7b0&12sen-US&23e1&r_url=https%3A%2F%2Fcargoone.co.uk%2Fcustomer%2Fjob%2F70d9f080-…`
  (53.4708,-2.2426 = Manchester; 52.4862,-1.8904 = Birmingham — correct coordinates).
- **Both requests fail with the same errors as before.**

### 4. Route is a straight line, not road-following ❌
- Visually confirmed on desktop + mobile screenshots — a straight geodesic line between P and D (Manchester → Birmingham diagonal), not following the M6 corridor.
- `RouteMap.jsx`'s straight-line fallback branch is being taken because `ds.route()` returns non-OK status.

---

## 📋 Exact browser-console errors (verbatim, deduplicated)

```
error: Directions Service: You're calling a legacy API, which is not enabled for your project.
   To get newer features and more functionality, switch to the Places API (New) or Routes API.
   Learn more: https://developers.google.com/maps/legacy#LegacyApiNotActivatedMapError
```

```
error: MapsRequestError: DIRECTIONS_ROUTE: REQUEST_DENIED: There was an issue performing a Directions request.
   at https://maps.googleapis.com/maps-api-v3/api/js/65/10a/directions.js:8:347
   at Xna.qh (https://maps.googleapis.com/maps-api-v3/api/js/65/10a/directions.js:4:420)
   at Object.c [as _jmjqs6] (https://maps.googleapis.com/maps-api-v3/api/js/65/10a/common.js:115:77)
```

**Error class:** `LegacyApiNotActivatedMapError` + `REQUEST_DENIED` on `DIRECTIONS_ROUTE`.
**Error class NOT observed:** `RefererNotAllowedMapError`, `InvalidKeyMapError`, `MissingKeyMapError`, `BillingNotEnabledMapError`, `ApiNotActivatedMapError`. So the failure is scoped specifically to the **legacy Directions API service** being unavailable to this project — not the key, not the referrer restriction, not billing.

---

## 🔎 Interpretation (no key changes requested)

The error class `LegacyApiNotActivatedMapError` is Google's *specific* signal that:
- The Maps JavaScript API is enabled on the project (proved by tiles + markers rendering) ✅
- The key is otherwise valid (proved by `AuthenticationService.Authenticate` success) ✅
- **The specific service the SDK is calling is the "legacy Directions API"** and that service is **not enabled on this project** at the time these requests were made ❌

Common causes when a user has just clicked "Enable" but still sees this error:

1. **Different Google Cloud project.** If you have multiple projects, the Directions API may have been enabled on a project other than the one that owns the browser key `AIzaSy…` (the same project as the Maps JavaScript API). Google routes each call by key → project, so enabling on a sibling project has no effect. **Fix:** in GCP Console, ensure the project selector at the top matches the project that owns the browser key; verify Maps JavaScript API and Directions API are both green in *that* project.

2. **Enabled the wrong "Directions" product.** Google now offers two:
   - **Directions API** (the legacy one this SDK code path calls) — icon usually says "Directions API".
   - **Routes API** (the new one — `google.maps.routes.Route.computeRoutes()`).
   The current code (`google.maps.DirectionsService`) needs the **legacy Directions API**. If you enabled Routes API instead, the SDK will still fail. **Fix:** enable "**Directions API**" specifically. (Both can be enabled at once, no conflict.)

3. **Propagation delay.** Google Cloud API enablement is typically effective within ~1 minute, but can occasionally lag for up to ~5 minutes. **Fix:** wait ~5 min, then reload the page and re-observe.

4. **API restrictions on the key.** If the browser key has API restrictions ("Restrict key" → "Restrict key to selected APIs"), the allow-list may include Maps JavaScript API + Places + Static Maps but **not Directions API**. This is a common tightening pattern. **Fix:** either add "Directions API" to that key's API allow-list, or remove the API restriction (leave only the HTTP-referrer restriction intact).

I have **not** made any of these changes — per your instruction to "provide the exact Google error shown in the browser console before requesting any further key changes", I've reported the errors verbatim and stopped.

---

## What I did NOT touch this run
- `/app/frontend/.env` — unchanged.
- `/app/backend/.env` — unchanged.
- `RouteMap.jsx` — unchanged.
- Google Cloud Console — no access, no changes.
- API restrictions on the browser key — no changes.
- Backend `GOOGLE_MAPS_API_KEY` — unchanged.
- No Save-to-GitHub, no Deploy.

---

## Suggested next step (**for your action** — I execute none unprompted)

Please verify **inside the same Google Cloud project that owns the browser key** (the one whose allow-list currently permits `https://cargoone.co.uk/*` for referrer):
1. **APIs & Services → Enabled APIs & Services** — you should see BOTH:
   - `Maps JavaScript API` (green — confirmed working)
   - `Directions API` (the legacy one, not "Routes API")
2. **APIs & Services → Credentials → your browser key → API restrictions:** if "Restrict key" is toggled on, ensure "Directions API" is in the allow-list.
3. Reload `https://cargoone.co.uk/customer/job/70d9f080-…` after ~30 s and let me know — I'll re-run the same 3-screen probe and expect the console errors to disappear + the straight line to become a road-following polyline.

If Directions API is confirmed enabled on the *correct* project with no restrictions blocking it and the error persists, that would point to a Google-side issue and warrant a support ticket — no key change on your side is required.
