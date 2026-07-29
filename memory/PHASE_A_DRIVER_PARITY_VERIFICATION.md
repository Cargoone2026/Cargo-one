# Phase A — Driver-side Route Summary / Ferry + Toll Parity — Verification Report

**Date:** 2026-07-29
**Environment:** Preview only (`https://cargo-repo-bridge.preview.emergentagent.com`)
**Scope:** Strictly driver-side `RouteMap` parity with customer-side (as instructed).

---

## Findings

Full visual & data parity was **already implemented in an earlier session** —
no code changes were required in this session. All four `RouteMap` call-sites
supply an identical `summary` prop shape.

| Call-site | File | Line | `summary` prop |
|---|---|---|---|
| Customer Job Detail | `frontend/src/pages/portal/customer/JobDetail.jsx` | L128–137 | `{ pickupTown, dropoffTown, distanceMiles, durationMinutes }` |
| Customer Booking Detail | `frontend/src/pages/portal/customer/BookingDetail.jsx` | L266–296 | Same 4 keys + `tracking?.eta_minutes ?? job.duration_minutes` fallback |
| **Driver Job Detail** | `frontend/src/pages/portal/driver/JobDetail.jsx` | L137–147 | Same 4 keys |
| **Driver Booking Detail** | `frontend/src/pages/portal/driver/BookingDetail.jsx` | L318–348 | Same 4 keys + `tracking?.eta_minutes ?? job.duration_minutes` fallback |

Ferry / Toll detection lives entirely inside the shared `RouteMap.jsx`
(`SummaryStrip` component + `GoogleRouteMap` `onFerryDetected` /
`onTollsDetected` callbacks). No duplication was introduced on the driver
side — customer-side detection is reused verbatim.

## Files inspected

- `/app/frontend/src/pages/portal/driver/JobDetail.jsx` (340 lines)
- `/app/frontend/src/pages/portal/driver/BookingDetail.jsx` (812 lines)
- `/app/frontend/src/pages/portal/customer/JobDetail.jsx` (compared L128–137)
- `/app/frontend/src/pages/portal/customer/BookingDetail.jsx` (compared L266–296)
- `/app/frontend/src/components/ui-portal/RouteMap.jsx` (594 lines, shared)

## Files changed

**None.** Parity was pre-existing; no implementation needed.

## Tests / checks performed

| Check | Method | Result |
|---|---|---|
| Grep all `RouteMap` call-sites — driver + customer | `grep -rn "RouteMap" /app/frontend/src` | 4 pages + 1 shared component ✓ |
| `summary` prop shape identical on all 4 pages | Line-level diff | Identical keys ✓ |
| Backend fields exist on job payload | `curl /api/jobs/{id}` | `pickup_town`, `dropoff_town`, `distance_miles` present ✓ |
| Driver login + navigate to Job Detail (desktop, 1280×900) | Playwright screenshot | Renders ✓ |
| `[data-testid="route-map-summary"]` present | DOM query | `'Manchester → Birmingham · 70.3 mi'` ✓ |
| `[data-testid="route-map-summary-route"]` present | DOM query | `'Manchester → Birmingham'` ✓ |
| `[data-testid="route-map-summary-distance"]` present | DOM query | `'70.3 mi'` ✓ |
| `[data-testid="route-map"]` engine | `data-map-engine` attr | `google` ✓ |
| Driver Job Detail on mobile (390×844) | Playwright screenshot | Summary strip renders, no layout break ✓ |
| Driver Booking Detail non-existent id | Playwright screenshot | "Booking not found." gate renders, no JS errors ✓ |
| Ferry / Toll chip on Manchester→Birmingham | DirectionsService | Not rendered (correct — no ferry / no tolls on this route) ✓ |
| Duration chip on job with `duration_minutes: null` | Summary strip | Not rendered (correct — nullable, gracefully skipped) ✓ |
| Existing driver-side `data-testid`s preserved | Grep pre/post | Identical (no changes made) ✓ |
| Backend / RouteMap internal logic / API contract untouched | Session diff | No modifications this session ✓ |

## Screenshots captured (preview)

- `/tmp/driver_job_detail.png` — desktop 1280×900, summary strip + Google map
- `/tmp/driver_job_detail_mobile.png` — mobile 390×844, summary strip wraps cleanly
- `/tmp/driver_booking_detail_empty.png` — driver booking detail 404 gate renders

## Notes on Driver Booking Detail visual test

No accepted bookings exist for the preview test driver
(`GET /api/driver/accepted-jobs` returned `[]`). Rather than seed a
Stripe-paid booking on preview (out of Phase A scope), parity was confirmed
via:

1. Exact line-level code parity with customer `BookingDetail.jsx` L266–296.
2. Shared `RouteMap` component used by both roles.
3. Live proof from the sibling driver page (`JobDetail`) confirming the
   `SummaryStrip` renders as designed.

## Verdict

**PASS.** Driver-side Route Summary / Ferry + Toll parity is complete and
matches the customer-side without duplicated logic. No files were modified.

---

_No API keys were printed, no secrets logged, no backend changes, no
Ferry/Toll heuristic duplicated, no test IDs altered._
