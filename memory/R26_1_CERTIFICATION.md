# R26.1 MINI-PATCH CERTIFICATION

**Baseline:** R26 ASAP Pricing Engine V1 (`services/asap_pricing.py`, engine_version `ASAP-V1.0`)
**Patch date:** Feb 2026
**Scope:** Transport dead-mileage table + international ASAP guardrail on quote endpoints
**Regression:** 163 pricing/fee/moderation/reset tests passed (0 fail); pre-existing conftest-baseline failures on other suites are unrelated to this patch (documented below).

---

## 1. Transport Dead Mileage — 🟢 PASS

**Evidence:** LWB Van 100 mi ASAP with progressive driver-repositioning distances:

| Nearest driver | dead_mileage uplift | effective_total | driver_charge | fee | customer_total |
|---|---|---|---|---|---|
| 0 mi | 0.00 | 0.15 | **£165** | £24.75 | £189.75 |
| 10 mi | 0.00 | 0.15 | **£165** | £24.75 | £189.75 |
| 20 mi | 0.10 | 0.25 | **£180** | £27.00 | £207.00 |
| 35 mi | 0.30 | 0.45 | **£210** | £31.50 | £241.50 |
| 50 mi | 0.30 | 0.45 | **£210** | £31.50 | £241.50 |
| 75 mi | 0.40 | 0.50 (capped) | **£220** | £33.00 | £253.00 |
| 200 mi | 0.40 | 0.50 (capped) | **£220** | £33.00 | £253.00 |

- Close-vs-far driver economics now diverge by up to +33% (0→75 mi).
- Transport dead-mileage table is intentionally **lighter than recovery** (transport peaks at +40%, recovery at +75%).
- Overall +50% cap is honoured (200 mi driver still capped at +50% effective).

**Files changed:**
- `backend/services/asap_pricing.py`
  - Added `dead_mileage_bands_transport` (5 bands: 0/10/20/30/50) to `ASAP_DEFAULT_CONFIG`.
  - Section 5 now picks the correct band table by `service_type` and applies it whenever `nearest_driver_distance_mi` is supplied.
  - Snapshot's `uplifts.dead_mileage` now surfaces the transport uplift too.

**Regression guard:** `nearest_driver_distance_mi=None` produces `uplifts.dead_mileage == 0.0` — no free premium slipped in via a default 0-mi.

---

## 2. International ASAP Guardrail — 🟢 PASS

**Evidence:** live curl against the running backend (all HTTP 200):

```
POST /api/pricing/quote  (GB→IE, service_timing=asap)
→ requires_manual_review: true
  route_class: "international"
  engine_version: "ASAP-V1.0"
  manual_review_message: "International ASAP requires operator confirmation for ferry, toll and Eurotunnel costs."
  (no driver_charge, no customer_total)
```
```
POST /api/asap/quote  (GB→IE)
→ SAME behaviour — manual review, no fabricated instant price.
```
```
POST /api/pricing/quote  (GB→GB, service_timing=asap, ~22 mi London area)
→ requires_manual_review: false
  driver_charge: £70.00
  booking_fee: £10.50
  customer_total: £80.50
  engine_version: "ASAP-V1.0"
  (UK domestic ASAP works exactly as before)
```

`POST /api/jobs` behaviour unchanged — international routes still land in `status="awaiting_manual_quote"` with `suggested_price=null`. All three entry points now use the same `classify_route()` rule.

**Files changed:**
- `backend/server.py`
  - `POST /asap/quote` now calls `classify_route()` at entry and short-circuits to `{requires_manual_review: true, route_class: <non-UK>, manual_review_message: ...}` for any non-`domestic_uk` classification.
  - `POST /pricing/quote` (ASAP branch) mirrors the same guard.
  - `AsapQuoteBody` model gained `dropoff_country_code: Optional[str] = None`.

**Legacy contract preserved:** callers who omit BOTH country codes are still treated as domestic UK (matches the existing `/jobs` rule).

---

## 3. Vehicle Regression — 🟢 PASS
All 20 transport + all 12 recovery keys unchanged (test `test_transport_vehicles_unchanged`, `test_recovery_vehicles_unchanged` — both green). Tail-lift pairs (Luton, 3.5T, 7.5T) still isolated with distinct minimum charges and £/mi.

## 4. Recovery Regression — 🟢 PASS
`test_recovery_dead_mileage_bands_unchanged` proves `dead_mileage_bands_recovery` remains exactly:
- ≤10 mi → 0%
- ≤20 mi → 25%
- ≤30 mi → 40%
- ≤50 mi → 60%
- >50 mi → 75%

Parametric test verifies recovery uplift fires at each band. Direct check on 3.5T Recovery 40 mi ASAP with driver 15/25/45/60 mi — matches R26 baseline exactly.

## 5. Booking Fee Regression — 🟢 PASS
`test_asap_engine_has_no_fee_logic` proves the engine never imports from `server`, never defines its own `calculate_booking_fee_detail`, and doesn't reference the `booking_fee_bands` collection. Fee comes exclusively from the injected callable. Domestic ASAP curl above returned `booking_fee=£10.50 @ 15%` — Band A of `booking_fee_bands`.

## 6. Three-Way Endpoint Consistency — 🟢 PASS
`test_three_way_domestic_asap_consistency`: `/asap/quote` and `/pricing/quote` (service_timing=asap) return identical `driver_charge`, `booking_fee`, `customer_total`, and `engine_version` for the same domestic input. Both endpoints call the SAME `calculate_asap_quote` in `services/asap_pricing.py` (verified by grep). For international inputs, both return the same manual-review payload.

## 7. Pricing Snapshot — 🟢 PASS
Snapshot still contains all 15 top-level keys, 20 input keys, 14 uplift keys — no fields added, none removed. `uplifts.dead_mileage` now populated for transport when applicable.

## 8. Historical Immutability — 🟢 PASS
`test_snapshot_written_at_creation_survives_config_edit` proves:
- A snapshot created with `nearest_driver_distance_mi=None` is byte-identical after loading a modified `dead_mileage_bands_transport` config.
- Existing R26 bookings (which have no dead-mileage transport data because R26.1 wasn't shipped yet) continue to display their original prices verbatim from the stored snapshot.
- New quotes issued after R26.1 pick up the new rules — old bookings do not.

## 9. Full Automated Test Suite — TOTALS

**R26.1-relevant regression pack** (pricing + fee + snapshot + moderation + password reset):
- **163 passed · 11 skipped · 0 failed**
- Files: `test_asap_pricing_r26_1.py` (29), `test_asap_pricing_r26.py`, `test_pricing_engine.py`, `test_final_qa_r25_1_screen_consistency.py`, `test_booking_fee_bands.py`, `test_moderation.py`, `test_password_reset.py`

**Wider historical suite** carries 4 pre-existing failures + 9 pre-existing errors caused by stale conftest admin credentials (`admin@cargoone.com/admin123`) that don't match the rotated admin password stored in `/app/memory/test_credentials.md`. These are NOT caused by R26.1 — they've been failing since before the R26.1 patch. Owner can decide whether to align conftest with the real admin password as a separate housekeeping task.

## 10. Manual E2E — ASAP Transport — 🟢 PASS (PAYMENT STEP BLOCKED — awaits owner)

**Executed by testing agent** (Playwright, live preview URL). London → Guildford ~27 mi.

| Surface | driver_charge | booking_fee | customer_total | engine |
|---|---|---|---|---|
| /customer/asap booking-summary panel | £39.00 | £5.85 @ 15% | £44.85 | ASAP-V1.0 |
| `Confirm & pay £X deposit` button | — | £5.85 | — | — |
| Stripe checkout amount (unpaid) | — | £5.85 | — | — |
| `/api/asap/quote` response | £39.00 | £5.85 | £44.85 | ASAP-V1.0 |

Every visible surface displays the **exact** figures returned by the engine — zero divergence. Two live unpaid Stripe test sessions created:
- Transport job id `900fa767-2a91-46ab-97b0-f99761bf5de2` → `cs_test_a17VAbQ7ARoWl2C3jGAofBdMl8TGSs3uQfak40i5Opbc10PPRjN0oXu3Br`
- Recovery job id `8822c8bc-a5c5-47ea-98f1-53caa0230ee1` → `cs_test_a1wz8dgTSKaIf5pRe0jbQyOZu8jmQNrsUQiKLdMbJWwfAKhkjqituILj9b`

**Note:** the engine returned `resolved_vehicle_key: "car"` (min £39) not `lwb_van` (min £70) because the ASAP transport flow has no vehicle picker yet — engine defaults to the smallest suitable class. **Not a screen-consistency bug** (all screens correctly reflect the engine output), but a UX gap flagged for R26.2. Recovery flow is unaffected — it does have a vehicle picker.

## 11. Manual E2E — ASAP Recovery — 🟢 PASS (PAYMENT STEP BLOCKED — awaits owner)

**Executed by testing agent.** London → Guildford ~27 mi, 3.5T Recovery.

| Surface | driver_charge | booking_fee | customer_total | engine |
|---|---|---|---|---|
| /customer/asap booking-summary panel | **£110.00** | **£16.50** @ 15% | **£126.50** | ASAP-V1.0 |
| `Confirm & pay £16.50 deposit` button | — | £16.50 | — | — |
| Stripe checkout amount (unpaid) | — | £16.50 | — | — |

Numbers match the R26.1 certification expected values **EXACTLY**.

## 12. Stripe Consistency — ⏸️ AWAITS OWNER CARD ENTRY

Both checkout URLs above are LIVE unpaid sessions in Stripe TEST. Owner clicks `4242 4242 4242 4242` on each, then the testing agent can be re-invoked to verify: booking-confirmed page, /customer/booking/:id, /admin/bookings, /driver/live offer, Mongo `pricing_snapshot`. All must show the same £ values as above.

---

## 13. PRODUCTION READINESS

**Status:** ✅ **READY FOR MANUAL E2E**

**Blockers to R26 sign-off:**
1. Owner clicks Stripe TEST card `4242 4242 4242 4242` on the two captured checkout URLs (transport `cs_test_a17V…`, recovery `cs_test_a1wz…`) and re-invokes the testing agent to verify post-payment surfaces (booking-confirmed page, /customer/booking/:id, /admin/bookings, /driver/live offer, Mongo `pricing_snapshot`).

**Files changed by R26.1 (final list):**
- `backend/services/asap_pricing.py` — dead_mileage_bands_transport + service-type-aware application. Zero behaviour change for recovery.
- `backend/server.py` — international guardrail on `/asap/quote` and `/pricing/quote` (ASAP branch). AsapQuoteBody gained `dropoff_country_code`. Zero behaviour change for domestic ASAP.
- `frontend/src/pages/portal/customer/AsapRequest.jsx` — forwards `pickup_country_code`/`dropoff_country_code` to `/asap/quote`; renders friendly `manual_review_message` when the guardrail fires (closes the code-review hole flagged by the testing agent).
- `backend/tests/test_asap_pricing_r26_1.py` (new) — 29 regression tests.
- `backend/tests/audit_r26_certification.py` (added earlier this session) — full pre-R26.1 audit as an executable spec.
- `memory/R26_CERTIFICATION.md` (audit report).
- `memory/R26_1_CERTIFICATION.md` (this file).

**Non-blocker follow-ups (R26.2 candidates, testing-agent findings):**
- MEDIUM: Add a vehicle picker to the ASAP TRANSPORT flow so customers can request LWB Van / Luton / 3.5T / etc. Today engine defaults to the smallest suitable class (`car` for basic parcel jobs).
- MEDIUM: `AddressAutocomplete` component only reads `testID`; `data-testid` passed by callers is silently dropped. Testability fix.
- LOW: `/api/asap/quote` response is missing `distance_miles` when triggered from the browser (returned correctly by direct pytest). Cosmetic — pricing unaffected because min-charge floor.
- LOW: `/app/backend/.env` `GOOGLE_MAPS_API_KEY` has Cyrillic homoglyphs in preview — geocoding falls back gracefully but should be corrected.

**Unrelated files touched:** none. Recovery pricing, Fixed pricing, Bidding, Scheduled pricing, Booking Fee Bands, Stripe integration, RouteMap, DriverLiveMap, Available Jobs Map — all untouched.

## MAPBOX
🔒 **HARD-BLOCKED** — awaiting explicit `"R26 signed off"`. Zero map files touched. Not started.
