# Final Marketplace & Live Mode Deployment — Handoff Package

**Date:** 2026-07-30
**Environment:** Preview (`https://cargo-repo-bridge.preview.emergentagent.com`) — ready for Save + Deploy.
**Status:** ✅ **READY TO SAVE + REPUBLISH.**

---

## 1. Deployment summary

Three verified, minimally-scoped fixes applied. Nothing else touched.

| # | Fix | File | Diff size |
|---|---|---|---|
| 1 | Exclude ASAP jobs from scheduled marketplace `/api/jobs/nearby` | `backend/server.py` | 1 line |
| 2 | Add "Live Mode" entry to driver sidebar (between Available and My Jobs) | `frontend/src/layouts/DriverLayout.jsx` | ~4 lines |
| 3 | Add "ASAP" entry to customer sidebar (between Post Job and Bookings) | `frontend/src/layouts/CustomerLayout.jsx` | ~4 lines |

No API contracts changed. No pricing / deposit / fee / commercial rules changed. No auth changes. No CSRF changes. No CORS changes. No Stripe changes. No Maps changes. No new dependencies.

## 2. Files changed

```
backend/server.py                                     (nearby_jobs filter — 1 line)
frontend/src/layouts/DriverLayout.jsx                 (nav item — Live Mode)
frontend/src/layouts/CustomerLayout.jsx               (nav item — ASAP)
```

The full change in `server.py` is exactly the filter you requested:

```py
{"status": "posted", "service_timing": {"$ne": "asap"}}
```

Legacy jobs without a `service_timing` field remain visible via `$ne`.

## 3. Regression report (preview)

### Automated — 40/40 green in ~46 s
```
tests/test_realtime_dispatch.py .....................              [21/21]
tests/test_payment_finalisation.py .......                         [ 7/ 7]
tests/test_payment_and_csrf_security.py ............               [12/12]
```
Covers: ASAP creation, breakdown-recovery, dispatch eligibility, driver Live Mode (online/offline/heartbeat/status), offer matching (radius + capability + busy rule), atomic claim (6-driver `asyncio.gather` P0 concurrency), idempotent duplicate claim, cancelled-job guard, scheduled/ASAP route guards, payment finalisation, webhook token binding, CSRF positive/negative, Bearer bypass.

### Manual on preview

| Area | Result |
|---|---|
| Customer creates fresh scheduled job `MKT-VERIFY-SCHED` → 200, `status=posted`, `service_timing="scheduled"` | ✅ |
| Customer creates ASAP job `MKT-VERIFY-ASAP` → 200, `service_timing="asap"` | ✅ |
| Driver `/api/jobs/nearby` — scheduled job present, ASAP job **excluded** (177 total, both correctly classified) | ✅ |
| Driver `/driver/jobs` page renders `MKT-VERIFY-SCHED` at top, no `MKT-VERIFY-ASAP` present | ✅ |
| Driver sidebar: `Home / Available / Live Mode / My Jobs / Earnings / Fleet / Profile` | ✅ (screenshot `/app/backend/verify_driver_nav_with_live.png`) |
| Customer sidebar: `Home / Post Job / ASAP / Bookings / Messages / Profile` | ✅ (screenshot `/app/backend/verify_customer_nav_with_asap.png`) |
| `/driver/live` still reachable and renders | ✅ (unchanged) |
| `/customer/asap` still reachable and renders | ✅ (unchanged) |
| Existing marketplace scheduled accept flow: first `POST /jobs/{id}/accept` → 200, second → **409** (atomic guard) | ✅ |
| Atomic claim on ASAP job: 6 concurrent claims → exactly 1 winner + 5×409 (pytest) | ✅ |
| Cookie-authenticated mutating POST without `X-CSRF-Token` → 403 | ✅ |
| Bearer mutating POST without CSRF header → 200 (native bypass) | ✅ |
| Stripe TEST checkout still creates session; webhook still finalises on preview | ✅ |
| RouteMap green P / red D / charcoal route / ferry+toll chips — unchanged | ✅ |

### No regressions to any listed area
- ✅ Customer Portal, ✅ Driver Portal, ✅ Admin Portal, ✅ Marketing Website
- ✅ Marketplace bookings, ✅ Driver bidding, ✅ Live Dispatch, ✅ Atomic claim
- ✅ Google Maps, ✅ RouteMap, ✅ Authentication, ✅ CSRF, ✅ Stripe, ✅ Booking lifecycle

## 4. Post-deploy production smoke checklist (for you to run AFTER Save + Deploy)

Do this from the platform's Save-to-GitHub → Deploy flow.

### Marketplace
- [ ] Log in as customer → create a fresh scheduled `PROD-VERIFY-MKT` job.
- [ ] Confirm it appears in Admin Portal.
- [ ] Log in as driver → open **Available** tab → confirm `PROD-VERIFY-MKT` is at the top of the list.
- [ ] Confirm no ASAP jobs (any `PROD-SMOKE-ASAP` type) are listed in Available.
- [ ] Driver taps Accept → job flips to `accepted`. Second Accept attempt returns 409.

### ASAP + Live Mode
- [ ] Customer sidebar shows **ASAP** entry between Post Job and Bookings.
- [ ] Driver sidebar shows **Live Mode** entry between Available and My Jobs.
- [ ] Customer taps ASAP → `/customer/asap` renders with Transport / Vehicle Recovery toggle.
- [ ] Driver taps Live Mode → `/driver/live` renders with Go Online button.
- [ ] Driver taps Go Online → prompts for location → status flips to online. `POST /driver/live/online` returns 200.
- [ ] Driver taps Go Offline → status flips back.

### Payment finalisation (proceed cautiously — depends on Emergent Stripe proxy)
> The Emergent Stripe proxy on production was not delivering webhooks during the prior smoke run (see `REALTIME_DISPATCH_PRODUCTION_SMOKE_REPORT.md §Defect`). If that proxy issue persists, the ASAP → dispatch-eligible transition will not fire. Our webhook endpoint is confirmed reachable and correct. If webhook still doesn't fire post-deploy, escalate to Emergent Support with the repro in that report.

### Non-negotiable
- [ ] No console errors on any of the four sidebar pages (customer + driver).
- [ ] No 5xx responses in Network tab.
- [ ] `/customer/asap` and `/driver/live` still accessible by URL directly.

## 5. Save + Deploy instructions

I cannot Save-to-GitHub or Deploy directly — those actions live in your chat input. Steps for you:

1. **Save to GitHub** — click the **Save** button in the chat input. This will commit the three touched files.
2. **Deploy** — click **Deploy**. Wait for the deploy pipeline to finish.
3. Run the post-deploy smoke checklist above.
4. If anything in the checklist fails, tell me which line failed and I'll debug.

## 6. What is NOT done (deliberate, per your scope guard)

- No refactoring, no additional features, no architectural changes.
- No touch to `/customer/asap`, `/driver/live`, `/driver/live/*` endpoints, `/jobs/{id}/claim`, or any other new dispatch code.
- No touch to Stripe, Maps, auth, CSRF, RouteMap, marketing site, admin.
- No touch to the historical pytest baseline (16-fail / 8-error drift preserved).
- No touch to Phase C cleanup on production data.
- No production data written this session.

---

**Confirmation of operability (once you deploy):**

- ✅ **Marketplace** — scheduled jobs will continue to appear in Driver Available Jobs; new ASAP jobs will no longer pollute the list. Bidding + acceptance workflow unchanged.
- ✅ **Customer ASAP** — page reachable via new sidebar entry `ASAP`. All existing behaviour of the page preserved.
- ✅ **Driver Live Mode** — page reachable via new sidebar entry `Live Mode`. Go Online / heartbeat / offers / atomic claim all continue to work as verified.
- ✅ **Live Dispatch (P0 atomic claim)** — unchanged from the previous production release; still proven by the 6-driver concurrency test.

`READY TO SAVE + REPUBLISH.`
