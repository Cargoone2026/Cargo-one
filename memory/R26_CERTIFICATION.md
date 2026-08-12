# R26 ASAP PRICING ENGINE V1 — PRE-PRODUCTION CERTIFICATION

**Engine version:** `ASAP-V1.0` (`services/asap_pricing.py`)
**Audit run:** Feb 2026
**Audit script:** `/app/backend/tests/audit_r26_certification.py`
**Raw JSON report:** `/app/test_reports/audit_r26_certification.json`
**Regression baseline:** `pytest backend/tests/test_asap_pricing_r26.py test_pricing_engine.py test_booking_fee_bands.py test_final_qa_r25_1_screen_consistency.py` → **92 passed, 11 skipped**

---

## 1. Transport Dead Mileage
**Verdict:** 🔴 **NEEDS FIX**

**Evidence:**
Two identical ASAP LWB Van 40mi jobs run through `calculate_asap_quote`:

| Scenario | Nearest driver | supply | dead_mileage | driver_charge |
|---|---|---|---|---|
| A — driver right next to pickup | 0 mi | 0.0 | 0.0 | **£70** |
| B — driver 35 mi away | 35 mi | 0.0 | 0.0 | **£70** |

Also from priority scenarios: `LWB Van ASAP 40mi with driver 45 mi from pickup` → `driver_charge £70` — the same as if the driver were at pickup.

**Actual result:**
- `dead_mileage_bands_recovery` is defined and applied ONLY when `service_type == "breakdown_recovery"` (`asap_pricing.py` lines 555–559).
- For `service_type == "transport"` the `dead_mileage` uplift is ALWAYS 0 regardless of `nearest_driver_distance_mi`.
- The supply uplift is a coarse driver-count band (0/±5/±10/±20/±30%) and does **not** reflect a specific driver being far from pickup while other drivers are close — it fires on the raw count, so scenarios A and B produce identical prices.
- A far-away driver claiming a short-run LWB Van job therefore gets an economically poor offer that is entirely absorbed by the £70 minimum-charge floor.

**Recommendation (R26.1, smallest safe change):**
```python
# services/asap_pricing.py — inside calculate_asap_quote(), replace lines 554–559
dead_uplift_pct = 0.0
if nearest_driver_distance_mi is not None:
    # NEW: apply to BOTH recovery and transport; give transport a lighter table.
    band_key = ("dead_mileage_bands_recovery"
                if service_type == "breakdown_recovery"
                else "dead_mileage_bands_transport")
    dead_uplift_pct = _band_lookup(
        cfg.get(band_key, []),
        float(nearest_driver_distance_mi), "mi", "uplift")
```
And in `ASAP_DEFAULT_CONFIG`, add:
```python
"dead_mileage_bands_transport": [
    {"max_mi": 10,   "uplift": 0.00},
    {"max_mi": 20,   "uplift": 0.10},
    {"max_mi": 30,   "uplift": 0.20},
    {"max_mi": 50,   "uplift": 0.30},
    {"max_mi": None, "uplift": 0.40},
],
```
The +50% overall cap already protects the customer from stacking abuse.
Call sites must start passing `nearest_driver_distance_mi` at quote time (the customer flow doesn't know it, but the driver-live-mode offer computation does — same variable already computed by the dispatch code for the offer card).

---

## 2. Twenty Transport Vehicle Classes
**Verdict:** 🟢 **PASS**

**Evidence:** All 20 transport + all 12 recovery keys present with distinct rate cards. Tail-lift isolation table:

| Base | Tail-lift | Base min £ / £-per-mi | Tail-lift min £ / £-per-mi | Distinct? | Extra tail-lift surcharge line item? |
|---|---|---|---|---|---|
| `luton` | `luton_tail_lift` | 100 / 1.85 | 110 / 2.00 | ✅ | none (good) |
| `3_5t_rigid` | `3_5t_rigid_tail_lift` | 100 / 1.75 | 115 / 1.95 | ✅ | none (good) |
| `7_5t_rigid` | `7_5t_rigid_tail_lift` | 175 / 2.90 | 195 / 3.15 | ✅ | none (good) |

Quote parity — 25 mi LWB run for each pair produced distinct driver charges (£100 vs £110, £100 vs £115, £175 vs £195). No `tail_lift` line item is emitted; tail-lift is priced through the vehicle rate card alone (no double-charge).

**Recovery classes:** all 12 present with distinct rate cards; Recovery keys never share pricing configuration with Transport keys (separate `transport_vehicles` and `recovery_vehicles` dicts).

**Recommendation:** None.

---

## 3. Booking Fee Boundaries
**Verdict:** 🟢 **PASS**

**Evidence:** ASAP uses `calculate_booking_fee_detail` from `server.py` (single source of truth). Boundary map:

| Driver charge £ | Band fired | Fee % | Fee £ | Customer total £ |
|---|---|---|---|---|
| 149.99 | Band A | 15.0 | 22.50 | 172.49 |
| 150.00 | Band A | 15.0 | 22.50 | 172.50 |
| 150.01 | Band B | 14.0 | 21.00 | 171.01 |
| 299.99 | Band B | 14.0 | 42.00 | 341.99 |
| 300.00 | Band B | 14.0 | 42.00 | 342.00 |
| 300.01 | Band C | 13.0 | 39.00 | 339.01 |
| 599.99 | Band C | 13.0 | 78.00 | 677.99 |
| 600.00 | Band C | 13.0 | 78.00 | 678.00 |
| 600.01 | Band D | 12.0 | 72.00 | 672.01 |

Boundaries land exactly on the correct band. Fee change at £X → £X+.01 correctly steps the % down.

**Delegation sanity:** Random ASAP quote at driver_charge £335 → engine returns £43.55 booking fee @ 13.0% — identical to what `calculate_booking_fee_detail(335)` alone returns. Confirmed by grep: the ASAP engine only computes booking fee by calling the injected `calculate_booking_fee_detail` (line 596), never re-implements bands.

**Admin-configurability sanity:** `services/asap_pricing.py` contains **zero** references to `booking_fee`, `deposit`, or any band/tier data structure — the engine has no fee logic of its own to duplicate. Editing `booking_fee_bands` in the admin console therefore automatically affects every new ASAP quote (and every non-ASAP quote) via the same function call.

**Recommendation:** None.

---

## 4. International ASAP Guardrail
**Verdict:** 🔴 **NEEDS FIX** (customer-facing but non-payment-critical)

**Evidence:** Live curl against the running backend:

```bash
POST /api/pricing/quote
{ pickup_lat: 51.5, pickup_lng: -0.1,          # London
  dropoff_lat: 53.3, dropoff_lng: -6.2,        # Dublin
  service_type: transport, service_timing: asap,
  pickup_country_code: GB, dropoff_country_code: IE,
  requested_vehicle_key: lwb_van }

→ HTTP 200 {
    requires_manual_review: false,
    route_class: "domestic_uk",       # WRONG — this is GB→IE
    driver_charge: 550.0,
    customer_total_preview: 621.5,
    engine_version: "ASAP-V1.0"
  }
```

An international ASAP quote is returned as a guaranteed instant price of **£621.50**, with `requires_manual_review: false` and `route_class` wrongly reported as `domestic_uk`. Only the regional multiplier fires — **no ferry, no toll, no Eurotunnel** is captured.

**Detailed picture** (verified by code inspection + curl):

| Path | Blocks international ASAP? |
|---|---|
| `POST /api/jobs` (customer booking creation) | ✅ Yes — sets `status="awaiting_manual_quote"`, `suggested_price=null`. Customer can NOT proceed to Stripe. |
| `POST /api/pricing/quote` (service_timing=scheduled) | ✅ Yes — returns `requires_manual_review: true`. |
| `POST /api/pricing/quote` (service_timing=asap) | 🔴 **NO** — reaches `calculate_asap_quote` unconditionally. Returns fabricated "instant" £ (see curl above). |
| `POST /api/asap/quote` | 🔴 **NO** — same code path. Returns fabricated "instant" £. |

Because the FE `AsapRequest` screen posts to `/api/pricing/quote`, a customer whose address autocomplete resolved GB → IE coordinates would see a misleading "guaranteed" total on the summary panel BEFORE the /jobs POST later gates them into `awaiting_manual_quote`.

**Recommendation (R26.1, minimal safe change):** Add a route-class classifier at the entry of both ASAP endpoints. Snippet for `POST /pricing/quote` (server.py line 1517, and mirror the same at `POST /asap/quote` line 1428):

```python
if (payload.service_timing or "scheduled") == "asap":
    # NEW — mirror the domestic-only rule already enforced for /jobs.
    rc = classify_route(payload.pickup_country_code, payload.dropoff_country_code)
    if not payload.pickup_country_code and not payload.dropoff_country_code:
        rc = "domestic_uk"
    if rc != "domestic_uk":
        return {
            "requires_manual_review": True,
            "route_class": rc,
            "manual_review_message": (
                "International ASAP requires operator confirmation for "
                "ferry, toll and Eurotunnel costs."),
        }
    # (existing engine call continues unchanged)
```
No changes to `services/asap_pricing.py` needed. This preserves every domestic ASAP result byte-for-byte and only blocks non-UK corridors from returning a fabricated instant price.

---

## 5. Manual E2E — ASAP Transport + ASAP Recovery
**Verdict:** ⏸️ **BLOCKED FOR MANUAL ACTION**

**Evidence:** A live Stripe TEST checkout + real customer/driver browser walk-through cannot be programmatically completed by the audit script — it requires the owner to enter card 4242… and observe every screen. The audit computed the exact figures each downstream screen MUST display:

| Scenario | driver_charge | fee % | booking_fee | customer_total | engine |
|---|---|---|---|---|---|
| **ASAP TRANSPORT** — LWB Van · 25 mi · ASAP | £70.00 | 15.0% | £10.50 | £80.50 | ASAP-V1.0 |
| **ASAP RECOVERY** — 3.5T Recovery · 25 mi · nearest driver 15 mi | £110.00 | 15.0% | £16.50 | £126.50 | ASAP-V1.0 |

**What the owner must verify identically on:**
1. Customer quote screen (`/customer/asap` booking summary)
2. Stripe checkout amount (Stripe hosted page)
3. `/customer/booking-confirmed/:id`
4. `/customer/booking/:id` (customer detail)
5. `/admin/bookings` (payment column) + admin payment modal
6. Driver offer card (`/driver/live`) + `/driver/booking/:id`
7. Booking `pricing_snapshot` in Mongo (`db.bookings.findOne({id: ...}).pricing_snapshot`)

If any of the four £ values differs between these seven surfaces → **FAIL**. Screen-consistency was previously verified by the R25.1 regression suite (`test_final_qa_r25_1_screen_consistency.py`, all green in the current baseline).

**Recommendation:** Owner completes the two flows on the preview URL. Report the actual values seen on each screen. If any divergence appears we open R26.2.

---

## 6. Pricing Snapshot Completeness
**Verdict:** 🟢 **PASS**

**Evidence:** Full snapshot for `LWB Van · 100 mi · ASAP · collection≤30min · loading_help · Sunday-ish` contained:

**Top-level:** `engine_version`, `service_type`, `inputs`, `resolved_vehicle_key`, `vehicle_rate_card`, `base_charges`, `uplifts`, `driver_charge_pre_min`, `minimum_charge`, `driver_charge_rounded`, `booking_fee_percent`, `booking_fee`, `customer_total`, `manual_review`, `manual_review_reason`. **(15/15)**

**Inputs (20/20):** distance_miles, duration_minutes, distance_source, urgency, collection_within_minutes, when_iso, requested_vehicle_key, vehicle_class, weight_kg, volume_m3, pallets, item_count, waiting_minutes, extra_stops, loading_help, tail_lift_needed, nearest_driver_distance_mi, pickup_country_code, pickup_lat, pickup_lng.

**Uplifts (14/14):** asap, urgency_window, night, weekend, bank_holiday, bank_holiday_label, supply, supply_driver_count, regional, dead_mileage, raw_total, effective_total, ceiling, capped.

**Base charges:** mileage, waiting, stops, loading, base_route_total.

**Immutability evidence** (code inspection):
- `server.py:1344` writes `pricing_snapshot` on the job dict at creation.
- `server.py:2818` copies the SAME snapshot to the booking record on booking creation.
- No endpoint mutates it back. Stripe finalisation, refund, review flows all read-only.
- Independent quotes ran against a modified rate card confirmed the ENGINE returns new prices for new quotes, while the STORED snapshot dict on existing jobs/bookings is byte-identical to what was written at creation.

**Time/day factors captured:** `night` (0.00–0.20), `weekend` (0.00/0.08/0.15), `bank_holiday` + `bank_holiday_label` (e.g. `"christmas_day"`).

**Missing today** (not blockers, but nice-to-add for accountability):
- Explicit `pickup_town` / `dropoff_town` on the snapshot inputs. Currently only lat/lng is stored. Job document already carries the towns so a downstream reader can join, but embedding them in the snapshot would make the snapshot fully self-describing.
- Ferry / toll / overnight line items — deferred per your spec until international scope opens.

**Recommendation:** Optionally in R26.1 add `pickup_town`, `dropoff_town`, and `job_id` to `snapshot["inputs"]` for one-look diagnostics. No change to numeric outputs.

---

## PRIORITY SCENARIO REGRESSION (all 12 owner-mandated inputs)

| # | Scenario | driver_charge | fee % | fee £ | total | effective uplift | capped |
|---|---|---|---|---|---|---|---|
| 1 | LWB Van ASAP · short 8 mi | £70 | 15 | £10.50 | £80.50 | 15% | – |
| 2 | LWB Van ASAP · 220 mi nationwide | £345 | 13 | £44.85 | £389.85 | 15% | – |
| 3 | Luton Tail Lift ASAP · 30 mi | £110 | 15 | £16.50 | £126.50 | 15% | – |
| 4 | 3.5T Rigid Tail Lift ASAP · 30 mi | £115 | 15 | £17.25 | £132.25 | 15% | – |
| 5 | 7.5T Rigid Tail Lift ASAP · 30 mi | £195 | 14 | £27.30 | £222.30 | 15% | – |
| 6 | Articulated HGV ASAP · 320 mi | £1,700 | 10 | £170.00 | £1,870.00 | 15% | – |
| 7 | Transport dead-mileage (LWB 40 mi, driver 45 mi away) | £70 | 15 | £10.50 | £80.50 | 15% | – ⚠ (see check #1) |
| 8 | ASAP Recovery 40 mi, driver 25 mi from casualty | £120 | 15 | £18.00 | £138.00 | 50% | ✅ capped |
| 9 | Sunday night ASAP LWB 60 mi | £130 | 15 | £19.50 | £149.50 | 45% | – |
| 10 | Bank Holiday (Xmas Day) ASAP LWB 40 mi | £90 | 15 | £13.50 | £103.50 | 50% | ✅ capped |

Boundary rows (already in check #3): 9 rows all correct.
International row (already in check #4): NEEDS FIX (see above).

---

## THREE-WAY ROUTING CONSISTENCY
**Verdict:** 🟢 **PASS**

All three endpoints reach the SAME `calculate_asap_quote` in `services/asap_pricing.py` — verified by grep (three call-sites, one function).

Same inputs → same figures:

| Endpoint | driver_charge | fee | total | engine_version |
|---|---|---|---|---|
| `POST /asap/quote` | £70.00 | £10.50 | £80.50 | ASAP-V1.0 |
| `POST /pricing/quote` (asap) | £70.00 | £10.50 | £80.50 | ASAP-V1.0 |
| `POST /jobs` (ASAP timing) | £70.00 | £10.50 | £80.50 | ASAP-V1.0 |

Scheduled/Fixed/Bidding continue to route through `services/pricing.py` — untouched (confirmed by grep: no shared entry point, no cross-import).

---

## MULTIPLIER CAP
**Verdict:** 🟢 **PASS**

`LWB Van · 60 mi · ASAP + Immediate window + Night + Sunday + Xmas Day + zero-driver supply`:
- **Raw stacked uplift:** +130%
- **Ceiling (normal vehicle):** +50%
- **Effective:** +50%
- **`capped: true`** correctly surfaced in the snapshot

Same conditions on Articulated HGV (heavy curve):
- **Ceiling:** +80%
- **Effective:** +80%

Both ceilings honour the spec.

---

## HISTORICAL IMMUTABILITY
**Verdict:** 🟢 **PASS**

- `pricing_snapshot` is written once at job creation and once at booking creation (copied from job).
- No code path mutates the stored dict; every downstream reader reads verbatim.
- New quotes issued after a rate-card change use the new rates; old bookings keep their original snapshot bytes intact.

Legacy bookings that were paid BEFORE R26 shipped continue to display exactly what they were charged (their snapshot pre-dates ASAP-V1.0 and is kept as-is per the "never rewrite historical prices" contract).

---

## SUMMARY

| Check | Verdict |
|---|---|
| 1 · Transport Dead Mileage | 🔴 **NEEDS FIX** |
| 2 · 20 Transport Vehicle Classes | 🟢 PASS |
| 3 · Booking Fee Boundaries | 🟢 PASS |
| 4 · International ASAP Guardrail | 🔴 **NEEDS FIX** |
| 5 · Manual E2E Transport + Recovery | ⏸️ **BLOCKED FOR MANUAL ACTION** |
| 6 · Pricing Snapshot Completeness | 🟢 PASS |
| Three-way routing consistency | 🟢 PASS |
| Priority scenarios (10 inputs) | 🟢 PASS |
| Multiplier cap (+50% / +80%) | 🟢 PASS |
| Historical immutability | 🟢 PASS |

**Automated test count:** 92 / 92 passing (0 fail, 11 skipped — unrelated env skips).

---

## PRODUCTION READINESS
**Status:** ❌ **NOT READY** — pending R26.1 mini-patch and the manual E2E walk-through.

## BLOCKERS
1. **Transport dead mileage / repositioning is not modelled.** A driver 30–50 mi away receives the same offer as a driver next door on a short-run job — the far-away driver is economically underwater. Only recovery has a repositioning table today.
2. **International ASAP quote endpoints return a fabricated instant price.** `/pricing/quote` (asap) and `/asap/quote` do not classify route class before running the engine. `/jobs` correctly gates the actual booking, but the QUOTE screen can mislead the customer with a "guaranteed" £ that ignores ferry/toll/Eurotunnel.
3. **Owner must walk the two E2E flows** (ASAP Transport + ASAP Recovery) on the preview URL and confirm £ consistency across the seven surfaces listed in check #5.

## RECOMMENDED R26.1 CHANGES
1. Add `dead_mileage_bands_transport` to `ASAP_DEFAULT_CONFIG` and generalise the `_band_lookup` call inside `calculate_asap_quote` to apply the same repositioning uplift to transport (with a lighter table than recovery). ~10 lines. Preserves existing recovery behaviour byte-for-byte.
2. Add a `classify_route` guard at the entry of `POST /pricing/quote` (asap branch) and `POST /asap/quote`, mirroring the domestic-only rule already enforced on `POST /jobs`. ~15 lines total. Preserves every domestic result unchanged.
3. Optional: extend `snapshot["inputs"]` with `pickup_town`, `dropoff_town`, `job_id`. Cosmetic; no numeric change.

Everything else in R26 is production-ready. No changes required to `services/pricing.py`, `calculate_booking_fee_detail`, `booking_fee_bands`, Stripe finalisation, RouteMap, or dispatch.

## MAPBOX STATUS
🔒 **HARD-BLOCKED** — awaiting explicit `"R26 signed off"`. No files under `RouteMap.jsx`, `Live.jsx`, `Jobs.jsx`, or any GCP/mapbox key configuration have been touched by this audit.
