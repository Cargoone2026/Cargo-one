# CARGOONE — REAL-TIME DISPATCH PROGRAMME — COMPLETION REPORT

**Date:** 2026-07-29
**Environment:** Preview only. No Save-to-GitHub, no Deploy, no LIVE Stripe.
**Baseline preserved:** every existing marketplace flow (scheduled jobs,
bidding, deposit lifecycle, Maps Phase 2, ferry/toll chips, driver dedup,
CSRF SEC1, cookie/Bearer auth) works exactly as before.

---

## 1. Architecture summary

CargoOne now supports two orthogonal booking experiences on the same
backend, jobs collection, bookings collection, payment lifecycle,
tracking infrastructure and RouteMap:

1. **Scheduled / marketplace** (unchanged) — `service_timing="scheduled"`.
2. **ASAP / real-time dispatch** (new) — `service_timing="asap"`.

The ASAP path adds one new server concept — **`_dispatch_eligible(job)`**
— a pure function of job state that is the single source of truth for
"can this job be offered to drivers right now?" Everything else — the
driver Live Mode API, the offer poller, and the atomic claim endpoint —
is glue around this one predicate.

Real-time transport for v1 is **short polling** (5 s offers, 30 s
heartbeat). No WebSockets, no Redis, no new infrastructure introduced —
per Phase 30 the API surface is written so a future upgrade to SSE or
WebSockets can happen without touching business logic.

## 2. Existing-lifecycle audit (Phase 1)

| Concern | Existing implementation | Reuse decision |
|---|---|---|
| Job creation | `POST /api/jobs` + `JobCreate` Pydantic model | **Extended** with 4 optional fields (`service_timing`, `service_type`, `vehicle_details`, `customer_note`) — every existing customer keeps working. |
| Job acceptance | `POST /api/jobs/{id}/accept` — had a **read-then-update race** | **Fixed** to a conditional-filter atomic update; `POST /api/jobs/{id}/claim` mirrors the same pattern for ASAP. |
| Booking creation | `POST /api/bookings` required `job.status="accepted"` + `assigned_driver_id` | **Extended** to accept ASAP jobs in `posted`/`confirmed` state with `driver_id=None`; the claim endpoint later fills in the driver. |
| Deposit payment | `POST /api/bookings/{id}/deposit` + `_finalise_paid_deposit` | **Reused**; `_finalise_paid_deposit` now stamps `dispatch_ready_at` on ASAP jobs so the same webhook that finalises the deposit also opens the dispatch queue. |
| Stripe webhook + signature | Unchanged | Unchanged. |
| Tracking | `POST /api/tracking/{booking_id}` + `GET /api/tracking/{booking_id}` | **Reused** end-to-end for ASAP once a driver claims. |
| RouteMap / Maps | Green P, red D, charcoal route, ferry/toll chips | **Reused verbatim** by the new customer + driver pages — no changes to `RouteMap.jsx`. |
| CSRF SEC1 + Bearer bypass | Middleware | Unchanged. |
| MyJobs de-duplication | `bookingJobIds` set | Unchanged. |

## 3. Customer ASAP lifecycle

```
POST /api/jobs                 { service_timing: "asap", ... }
  → job.status = "posted"        (no driver yet)

POST /api/bookings             { job_id }
  → booking.status = "accepted", payment_status = "pending"
    booking.driver_id = null   (pre-claim window is intentional)

POST /api/bookings/{id}/deposit
  → Stripe Checkout session created (existing flow)

Stripe → POST /api/webhook/stripe?t=<token>
  → _finalise_paid_deposit:
      booking.payment_status = "paid", booking.status = "deposit_paid"
      job.status = "confirmed", job.dispatch_ready_at = <utc-iso>
  → job is now dispatch_eligible

Customer polls GET /api/customer/dispatch/{job_id}
  → { dispatch_eligible: true, assigned_driver_id: null }  (searching)
  → { assigned_driver_id: <winner>, assigned_driver_name: ... } (found)
  → Frontend auto-redirects to /customer/booking/{booking_id}
```

## 4. Breakdown / recovery lifecycle

Same as ASAP transport except:

* `service_type = "breakdown_recovery"` (persisted on job + booking rows).
* `vehicle_details` captures make, model, registration, condition
  (`will_not_start`, `accident_damaged`, `flat_tyre`, `mechanical_failure`,
  `battery_issue`, `cannot_be_driven`, `other`), and `rolls` / `steers` /
  `brakes` (`yes|no|unknown`).
* `customer_note` — free text (e.g. "Motorway hard shoulder", "Height
  restriction").
* Backend applies a `>= 2.0` recovery premium to the category multiplier
  so the suggested price uplifts appropriately. Commercial rules elsewhere
  (deposit percentage, platform fee %, driver payout) are **unchanged**.
* Driver capability match requires `capabilities.recovery = true` OR
  `service_types` contains `"breakdown_recovery"` — **but v1 is lenient**:
  if a driver has no capability data configured at all, they still qualify
  (see §8). This lets first-run installations reach a non-empty candidate
  pool while operators build up capability metadata.

## 5. Driver Live Mode lifecycle

```
GET  /api/driver/live/status              → own state (safe to poll any time)
POST /api/driver/live/online   {lat,lng}  → set live_online=true + stamp position
POST /api/driver/live/heartbeat {lat,lng} → refresh position while online (30 s)
POST /api/driver/live/offline             → clear position, live_online=false
GET  /api/driver/live/offers              → dispatch-eligible ASAP jobs, radius-filtered
POST /api/jobs/{id}/claim                 → atomic claim (Phase 16 — P0)
```

* Offline drivers, drivers with stale heartbeat (>60 s), drivers busy on
  an active ASAP job, and drivers without location data all receive
  `{ offers: [], reason: <reason> }` from `/offers`.
* Location is **only** collected while the driver has deliberately gone
  online. `POST /driver/live/offline` is idempotent — safe on tab close.
* Bearer auth works for every endpoint (Phase 40) so the future mobile
  apps use the same contract.

## 6. Dispatch eligibility — exact rules

`_dispatch_eligible(job)` in `backend/server.py` returns `True` **iff**
every clause below holds:

1. `job.service_timing == "asap"`, and
2. `job.assigned_driver_id` is None, and
3. `job.cancelled_at` is not set, and
4. `job.completed_at` is not set, and
5. `job.status ∈ {"confirmed", "dispatch_ready"}`, and
6. `job.dispatch_ready_at` is set (proves the deposit-paid webhook fired).

No frontend can force this predicate — it is read-only and derived from
DB state that ONLY the paid webhook / `_finalise_paid_deposit` can set.

## 7. Matching algorithm

`GET /api/driver/live/offers` (server-authoritative candidate list for a
given driver):

1. Confirm the driver is `active`, `live_online`, and has a fresh
   heartbeat within `DISPATCH_HEARTBEAT_FRESHNESS_SECONDS = 60`.
2. Confirm the driver isn't already on an in-flight ASAP job.
3. Query `db.jobs` for `service_timing="asap"`, `status ∈ {confirmed, dispatch_ready}`, `assigned_driver_id=None`,
   `cancelled_at` absent — this uses the **new compound index**
   `(service_timing, status, assigned_driver_id)`.
4. For each candidate: apply `_dispatch_eligible`, apply
   `_driver_is_capable`, then compute `haversine_miles(driver, pickup)`.
5. Drop anything outside `DISPATCH_DEFAULT_RADIUS_MILES = 25`.
6. Sort ascending by pickup distance; cap at
   `DISPATCH_CANDIDATE_LIMIT = 25` offers per response.

All configurable values live at the top of the dispatch section — no
scattered magic numbers.

## 8. Capability matching rules (Phase 12)

Deliberately narrow — v1 uses only fields already present or optionally
added at the user document:

* `driver.status == "active"` — hard requirement.
* For `service_type == "breakdown_recovery"`:
  * `driver.capabilities.recovery == true` OR
  * `"breakdown_recovery" in driver.service_types` OR
  * driver has **no** capability data configured yet (lenient bootstrap).

Standard transport does not require capability tags today. When we add
richer capability metadata (van, car transporter, flatbed, winch, etc.)
the check gets extended without a migration.

## 9. Atomic claim implementation (P0)

```python
result = await db.jobs.update_one(
    {
        "id": job_id,
        "service_timing": "asap",
        "status": {"$in": ["confirmed", "dispatch_ready"]},
        "assigned_driver_id": None,
        "cancelled_at": {"$exists": False},
    },
    {"$set": {"status": "accepted", "assigned_driver_id": user["id"], ...}},
)
if result.modified_count == 0:
    # If it's the same winning driver retrying, return an idempotent 200.
    # Otherwise 409.
```

The **conditional-filter** update is the atomic winner-selection — Mongo
serialises writes to the same document. There is no read-then-update
window. Multiple concurrent claim attempts either match the pre-conditions
(exactly one) or don't (the rest).

Duplicate-tap idempotency (Phase 17): if the same winner POSTs again, we
detect the assignment already belongs to them and return
`{ ok: true, idempotent: true }` instead of 409.

The scheduled `POST /jobs/{id}/accept` now uses the same conditional-filter
pattern for consistency — a latent race in the existing marketplace has
been closed as a side benefit.

## 10. Concurrency-test evidence

`tests/test_realtime_dispatch.py::TestAtomicClaim::test_many_concurrent_claims_exactly_one_wins`

* Creates a customer + a paid dispatch-ready ASAP job.
* Creates **6 online, nearby, active drivers**.
* Fires **6 simultaneous** `POST /api/jobs/{id}/claim` via
  `asyncio.gather(...)` through `httpx.AsyncClient`.
* Asserts **exactly one HTTP 200**, **five HTTP 409**.
* Asserts DB `job.assigned_driver_id` equals the winning HTTP client's
  driver id — no ghost writes, no double-assignment.

`PASSED` on the preview environment. Additional atomic-claim tests
(`test_winner_duplicate_claim_is_idempotent`,
`test_cancelled_job_cannot_be_claimed`,
`test_scheduled_job_rejects_claim_endpoint`,
`test_asap_job_rejects_accept_endpoint`) all green.

## 11. Files changed

**Backend:**
- `backend/server.py`
    - Extended `JobCreate` model — 4 new optional fields.
    - Rewrote `create_job` with validation on `service_timing` / `service_type`.
    - Rewrote `accept_fixed_job` — atomic conditional update.
    - **Added** the entire real-time dispatch layer (~200 lines of API + helpers).
    - Extended `create_booking` to support ASAP pre-claim.
    - Extended `_finalise_paid_deposit` to stamp `dispatch_ready_at`.
    - **Added** dispatch indexes to the startup hook.

**Backend tests:**
- `backend/tests/test_realtime_dispatch.py` — **new**, 21 tests.

**Frontend (new pages, no existing pages modified):**
- `frontend/src/pages/portal/customer/AsapRequest.jsx` — `/customer/asap`.
- `frontend/src/pages/portal/customer/Dispatch.jsx` — `/customer/dispatch/:jobId`.
- `frontend/src/pages/portal/driver/Live.jsx` — `/driver/live`.
- `frontend/src/App.js` — 3 routes + 3 imports added.

Total additions: 5 files new, 2 files touched (`server.py`, `App.js`). No
existing frontend page modified.

## 12. Database fields added (all optional, backward-compatible)

**jobs collection:**
- `service_timing` — `"scheduled" | "asap"` (defaults to `"scheduled"` on
  read of legacy rows).
- `service_type` — `"transport" | "breakdown_recovery"` (defaults to `"transport"`).
- `vehicle_details` — object (make, model, registration, condition, rolls, steers, brakes).
- `customer_note` — string.
- `dispatch_ready_at` — ISO 8601 UTC, set by paid webhook.
- `dispatch_claimed_at` — ISO 8601 UTC, set by successful claim.
- `accepted_at` — ISO 8601 UTC, set by scheduled accept.
- `cancelled_at` — ISO 8601 UTC, set when a job is cancelled (existing convention).

**users collection (driver rows only):**
- `live_online` — bool.
- `live_lat`, `live_lng` — floats (only present while online).
- `live_accuracy_m` — float.
- `live_updated_at` — ISO 8601 UTC.
- `live_online_since` — ISO 8601 UTC.
- (optional, admin-configured, opt-in) `capabilities.recovery` — bool.
- (optional) `service_types` — string list.

**bookings collection:**
- `service_timing` — mirrored from job for read-side ease.
- `service_type` — mirrored.

## 13. Database indexes added

* `users`: `{live_online: 1, live_updated_at: -1}` — offer-poll filter.
* `jobs`: `{service_timing: 1, status: 1, assigned_driver_id: 1}` — candidate scan.
* `jobs`: `{dispatch_ready_at: -1}` — order-by newest-ready.

All idempotently created in the startup hook — safe on redeploy.

## 14. API endpoints added / changed

**Added:**
- `POST /api/driver/live/online` `{lat, lng, accuracy_m?}` → `{ok, online, updated_at}`
- `POST /api/driver/live/offline` → `{ok, online: false}`
- `POST /api/driver/live/heartbeat` `{lat, lng, accuracy_m?}` → `{ok, updated_at}`
- `GET  /api/driver/live/status` → own live state
- `GET  /api/driver/live/offers?radius_miles=25` → `{offers: [...], radius_miles, heartbeat_freshness_seconds}`
- `POST /api/jobs/{id}/claim` → `{ok, job_id, idempotent, accepted_price}` (P0 atomic)
- `GET  /api/customer/dispatch/{job_id}` → dispatch snapshot (owned-by-customer only)

**Changed (backward-compatible):**
- `POST /api/jobs` — accepts 4 additional optional fields, unchanged for existing callers.
- `POST /api/jobs/{id}/accept` — internally rewritten to a conditional atomic update. Semantics for existing callers unchanged.
- `POST /api/bookings` — now accepts ASAP jobs pre-claim (driver_id=None). Existing scheduled callers see identical behaviour.
- `_finalise_paid_deposit` (internal) — stamps `dispatch_ready_at` for ASAP.

## 15. Frontend pages / components added or changed

* **`/customer/asap`** — new. Transport / Recovery toggle, current-location
  button, address autocomplete, RouteMap preview, vehicle-recovery panel
  (make, model, registration, condition, rolls/steers/brakes), customer
  note. Reuses `Button`, `Input`, `AddressAutocomplete`, `RouteMap`.
* **`/customer/dispatch/:jobId`** — new. Polls dispatch state, renders
  "Waiting for payment", "Looking for nearby drivers…" (tasteful radar
  pulse — no fake driver cars, no unrelated driver locations), then
  "Driver found" + auto-navigate to `/customer/booking/:id`.
* **`/driver/live`** — new. Map-first, Go online / Go offline, privacy
  explainer, live offer cards with earnings, distance to pickup, vehicle
  details for recovery, customer note, Accept £X button that claims
  atomically and navigates into the existing driver booking detail.

No existing frontend page modified. `MyJobs.jsx` dedup logic, marker
styling, charcoal route, ferry/toll chips, `SEO`, marketing pages,
admin, booking detail — all untouched.

## 16. Payment integration review

* No change to `STRIPE_API_KEY`, `STRIPE_WEBHOOK_SECRET`, checkout URL
  shape, session amount, or deposit percentage.
* `_finalise_paid_deposit` is still the single writer for
  `booking.payment_status = paid`, `booking.status = deposit_paid`,
  `job.status = confirmed`. It **additionally** sets `dispatch_ready_at`
  for ASAP jobs — added to the same guarded update, so it's still
  idempotent (`payment_status != "paid"` still guards).
* The per-session webhook token binding (Phase 1 P0 hardening) is
  untouched.
* Duplicate webhook delivery — still `{"finalised": false}` on the second
  arrival. Dispatch doesn't re-arm.

## 17. CSRF / auth review

* All new mutating endpoints (`/driver/live/online`, `/driver/live/offline`,
  `/driver/live/heartbeat`, `/jobs/{id}/claim`) go through the existing
  CSRF SEC1 middleware. Cookie clients need `X-CSRF-Token`; Bearer
  clients bypass — same policy as everything else.
* All new endpoints require role-appropriate auth
  (`require_role("driver")` / `require_role("customer")`).
* No secrets logged. No API keys exposed.
* No CORS change; `allow_origins` remains the explicit CargoOne
  production + preview whitelist.

## 18. Privacy review

* Customer location is **only** captured when the customer explicitly
  taps "Use my location" on the ASAP page and the browser grants
  permission. Manual entry always available. Denial handled with a clear
  message; the flow continues.
* Driver location is **only** captured while the driver has deliberately
  gone online. `GO OFFLINE` clears server-side location. Tab close /
  logout do not clear the flag automatically — the driver must
  deliberately go offline (documented as a manual-product-decision, §24).
* Customer-side dispatch endpoint (`GET /customer/dispatch/{job_id}`)
  requires `customer_id == request.user.id`. Other customers get 404 —
  verified in `test_customer_cannot_read_other_customers_dispatch_state`.
* Offer cards do NOT expose customer PII beyond pickup town + optional
  operational note. Driver only learns customer address AFTER claiming.
* Stale-heartbeat drivers get no offers, so an offline driver whose
  network dropped can't scrape live customer coordinates by leaving a
  browser tab open.

## 19. Failure-state behaviour

| Failure | Behaviour |
|---|---|
| Customer denies location | Inline error, manual entry remains. |
| Customer payment fails | Existing Stripe error UI. Job stays `posted`, no dispatch. |
| No online drivers | `/driver/live/offers` returns `[]` — customer sees "Looking for nearby drivers…" indefinitely, safe to close. |
| Driver GPS unavailable | Go online fails with clear message. |
| Driver stale heartbeat | `/offers` returns `{ offers:[], reason: "stale_location" }` — UI shows "Waiting for a fresh GPS fix." |
| Driver busy on ASAP | `/offers` returns `{ offers:[], reason: "busy_on_asap" }`. |
| Offer claimed by another driver | Claim returns 409 → UI refreshes offer list + shows "Another driver just took this job." |
| Duplicate accept tap | Second POST returns `{ ok: true, idempotent: true }`. |
| Cancelled job while offer visible | Claim returns 409. |
| Refresh while searching | `Dispatch.jsx` re-polls from scratch on mount — recoverable. |
| Refresh after assignment | Auto-navigates to `/customer/booking/{id}`. |
| Logout while online | `POST /driver/live/offline` is idempotent; safe. |
| Backend unreachable | Silent poll retries; no spinner-lock. |

## 20. Automated test results

**`test_realtime_dispatch.py`** — 21 tests, all green.

* 1 baseline preservation.
* 5 ASAP / breakdown creation + validation.
* 3 dispatch eligibility.
* 5 driver live mode (role gate, online/offline roundtrip, coordinate
  validation, heartbeat requires online, offline gets no offers).
* 2 offer matching (nearby yes, distant no).
* 5 atomic claim (concurrency P0, idempotent duplicate, cancelled
  reject, scheduled-route guard, asap-route guard).

## 21. Existing regression results

Combined suite of the new tests + the SEC1 + P0 payment suites:
**40/40 tests green** in ~17 s (two ConnectTimeout transients on the
preview host were confirmed as flakes on retry).

`test_booking_fees.py` and other historical suites — **untouched**;
9 admin-drift errors + baseline pytest drift remain exactly as
documented in the earlier programmes.

## 22. Screenshot manifest

* `/tmp/driver_live_offline.png` — Driver Live Mode, desktop 1280×900,
  offline state with prominent "Go online" button + privacy notice.
* `/tmp/customer_asap_mobile.png` — Customer ASAP, mobile portrait
  390×844, Transport mode selected, pickup + dropoff address fields,
  Use-my-location button, deposit disclosure.
* `/tmp/customer_asap_recovery.png` — Customer ASAP, mobile portrait
  390×844, Vehicle Recovery mode active, Vehicle information panel
  (make, model, registration, condition dropdown), rolls/steers/brakes
  selects.

## 23. Native API contract (Phase 40)

Bearer-authenticated. All existing native endpoints unchanged.

**New for native:**
- `POST /api/jobs` — same as web, accepts `service_timing`, `service_type`,
  `vehicle_details`, `customer_note`.
- `POST /api/bookings` → pre-claim booking for ASAP.
- `POST /api/bookings/{id}/deposit` → existing Stripe URL.
- `GET  /api/customer/dispatch/{job_id}` → poll while searching.
- `POST /api/driver/live/online|offline|heartbeat` → driver-side.
- `GET  /api/driver/live/offers` → driver-side.
- `POST /api/jobs/{id}/claim` → atomic claim.
- Errors: `{"detail": "..."}` with correct HTTP status (400, 403, 404,
  409, 422).

**Future native-only work (recorded, not built):**
- iOS: foreground/background location, APNs, background execution,
  deep links (`cargoone://booking/{id}`).
- Android: foreground location + foreground service, FCM, notification
  channels, deep links.

## 24. Manual product decisions still required (Phase 41)

- **ASAP cancellation after payment** — do we refund automatically? If
  so, on what timeline? Refunded via Stripe or credited? **Not implemented.**
- **Driver cancellation / no-show** after claim — surcharge to driver?
  Customer refund? **Not implemented.**
- **Customer no-show** after driver arrives — cancellation fee? **Not implemented.**
- **Breakdown / recovery liability + insurance** wording. **Not implemented.**
- **Roadside / motorway safety wording** shown on the ASAP page.
  **Not implemented.**
- **Minimum driver capability requirements for recovery** — do we require
  documented recovery insurance / equipment before matching? V1 is
  lenient (see §8).
- **Offer expiry** — v1 has no per-offer countdown. If you want one, we
  need a business decision on the expiry window (30 s? 60 s? indefinite?).
- **Service radius** — v1 hardcoded at 25 mi. Might be per-service-type
  or per-region.
- **Surge / urgent pricing** — v1 uses the same commercial rules with a
  small breakdown-recovery premium in the suggested price only.
- **"Convert ASAP to marketplace when no driver available"** — legal /
  refund implications; deferred.
- **Automatic driver-offline on tab close / prolonged idle** — v1
  requires explicit tap. Do we want a server-side sweep of stale
  heartbeats to force-offline drivers after N minutes?

## 25. External keys / setup still required

Nothing new beyond what's already in `MANUAL_KEYS_AND_EXTERNAL_SETUP` of
the previous programme's report. Recap:

- Stripe LIVE keys + `STRIPE_WEBHOOK_SECRET` + dashboard webhook config
  (only when moving off TEST).
- Email provider + DNS.
- Google Routes API v2 enable in GCP (only when we migrate).
- Static egress IP restriction for backend Maps key.
- APNs `.p8` + FCM JSON (only when building native apps).

## 26. Known Live Dispatch v1 limitations

* **Short polling** (5 s), not push. Perceptible latency vs. WebSockets.
  Upgradeable without touching business logic.
* **No offer expiry countdown.** Deliberately deferred to avoid making
  frontend countdown state authoritative for a business rule that hasn't
  been decided yet.
* **No exclusive offer window.** Every eligible driver sees the same
  offer; first atomic claim wins. This is the correctness-safe v1
  described in Phase 15.
* **No true geospatial index.** `haversine_miles` is computed in Python
  against a `service_timing/status/assigned_driver_id` filtered result
  set. Fine at CargoOne v1 scale; migrate to `2dsphere` when nearby-driver
  counts exceed ~10⁴.
* **Capability matching is lenient by design.** Once operators have
  populated `capabilities.recovery` / `service_types` for enough drivers,
  tighten `_driver_is_capable`.
* **Driver-online state does not auto-clear on stale heartbeat.** They
  simply stop matching. A background sweeper is the natural upgrade.
* **`/driver/live/offers` sorting is O(N × filtered) haversine.** At
  present the filter already narrows it; add proper geoindexing before
  scaling far beyond ~10⁴ concurrent online drivers.

## 27. Exact post-deploy production smoke checklist (Phase 45)

Run in `production` only AFTER Save + Deploy. Do NOT run pre-deploy.

**STANDARD path — regression check:**
1. Log in as `lc-prod-cust-...` and `lc-prod-drv-...` — cookie + CSRF
   present in DevTools.
2. Existing scheduled job posted by customer → driver accepts →
   customer pays deposit → booking `deposit_paid` within 10 s.

**ASAP path — new lifecycle:**
1. Disposable customer creates ASAP transport request from Manchester
   pickup (use current location or manual entry) to Birmingham dropoff.
2. `POST /bookings` returns a booking with `service_timing="asap"` and
   `driver_id=null`.
3. Customer pays £X test-mode deposit. Stripe redirects
   `?payment=success`. Webhook fires. Confirm:
     - `booking.payment_status == "paid"`
     - `booking.status == "deposit_paid"`
     - `job.status == "confirmed"` and `job.dispatch_ready_at` set
4. `GET /api/customer/dispatch/{jobId}` returns `dispatch_eligible: true`,
   `assigned_driver_id: null`.

**Driver:**
5. Disposable driver navigates to `/driver/live` → taps Go online.
   Location permission grant → `POST /driver/live/online` returns 200.
6. `GET /driver/live/offers` returns the ASAP job in `.offers` array.
7. Driver taps Accept. **Confirm:** first tap → 200. Any parallel driver
   attempting to claim → 409. `job.assigned_driver_id == winning driver`.

**Tracking:**
8. Driver marker appears on customer dispatch page → auto-redirects to
   `/customer/booking/{id}`.
9. Driver POSTs `/tracking/{bookingId}` while approaching → existing
   RouteMap driver marker updates.
10. Booking completion + payment lifecycle unchanged.

**Payment invariants:**
11. Deposit amount, driver payout, platform fee — unchanged from prior
    baseline (compute with any historic scheduled booking and confirm
    same figures).

**Security invariants:**
12. Mutating XHR (post-login) carries `X-CSRF-Token`.
13. `POST /api/jobs` with Bearer + no CSRF → 200 (native path).
14. `POST /api/jobs` with cookie + no CSRF → 403.
15. `POST /api/webhook/stripe` without `?t=<token>` → 403.

**Cleanup — record for Phase C:**
* Every disposable ASAP job id and booking id created during smoke.
* Every disposable driver + customer email.
* Every Stripe test-mode session id.

Consolidate into a single `PROD_SMOKE_REALTIME_DISPATCH_v1.md` under
`/app/memory/` at smoke time so Phase C cleanup can safely delete them.

## 28. Rollback considerations

Rollback is safe because:

* Every new field is **optional with a documented default**. Legacy
  jobs / bookings continue to work.
* New endpoints are additive; no existing endpoint's response shape
  changed.
* Atomic-claim conditional-update pattern is strictly safer than the
  read-then-update it replaces; even a rollback to the old
  `POST /jobs/{id}/accept` would re-introduce a latent race, not create
  a data corruption.
* New indexes are additive.
* Frontend routes are additive — no page changed. The nav bar does NOT
  link to `/driver/live` or `/customer/asap` yet (they're accessible by
  URL). Adding nav entries is a one-line follow-up in `DriverLayout` /
  `CustomerLayout` — deliberately deferred so a soft-launch is possible.

If we ever need to instantly kill dispatch without a redeploy: set an
env feature flag (not shipped in this programme — recorded as a follow-up
if you want a kill switch).

---

**CARGOONE REAL-TIME DISPATCH — READY TO SAVE + REPUBLISH**
