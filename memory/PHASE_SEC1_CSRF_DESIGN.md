# SECURITY HARDENING PHASE 1 — CSRF Double-Submit Design & Audit
**Status**: READ-ONLY DESIGN. No runtime files modified. No deploy. Awaiting owner approval.
**Scope**: CSRF double-submit protection for the production React Web app at `https://cargoone.co.uk`, layered on top of the existing `HttpOnly cargoone_session` cookie. Bearer/mobile compatibility must remain intact.

---

## 1. Attack surface audit — mutating endpoints
Full enumeration of every mutating endpoint in `backend/server.py` (POST/PUT/DELETE):

### 1.1 Auth (special handling required)
| Endpoint | Method | Line | Auth today | CSRF treatment |
|---|---|---|---|---|
| `/api/auth/register` | POST | 476 | Public | **EXEMPT** — sets session; issues fresh CSRF cookie in response. |
| `/api/auth/login` | POST | 509 | Public | **EXEMPT** — same as above; also **rotates** CSRF token. |
| `/api/auth/logout` | POST | 521 | Cookie or Bearer | **EXEMPT** — must remain idempotent; clears both cookies. |
| `/api/auth/me/delete` | POST | 533 | Auth required | **PROTECTED** (cookie flow) / bypass (Bearer). |
| `/api/auth/me` | PUT | 570 | Auth required | **PROTECTED** / Bearer bypass. |
| `/api/auth/me/resubmit-verification` | POST | 1710 | Auth required | **PROTECTED** / Bearer bypass. |

### 1.2 Customer mutations (all `PROTECTED` / Bearer bypass)
| Endpoint | Method | Line |
|---|---|---|
| `/api/users/me/documents` | POST | 620 |
| `/api/jobs` | POST | 728 |
| `/api/jobs/{id}/accept` | POST | 925 |
| `/api/bids/{id}/accept` | POST | 1017 |
| `/api/bookings` | POST | 1057 |
| `/api/bookings/{id}/deposit` | POST | 1092 |
| `/api/bookings/{id}/messages` | POST | 1372 |
| `/api/bookings/{id}/complete` | POST | 1466 |
| `/api/bookings/{id}/review` | POST | 1483 |
| `/api/notifications/{id}/read` | POST | 1537 |

### 1.3 Driver mutations (all `PROTECTED` / Bearer bypass)
| Endpoint | Method | Line |
|---|---|---|
| `/api/jobs/{id}/bids` | POST | 961 |
| `/api/bookings/{id}/status` | POST | 1248 |
| `/api/tracking/{id}` | POST | 1276 |
| `/api/bookings/{id}/pod` | POST | 1424 |
| `/api/driver/vehicles` | POST/PUT/DELETE | 2435 / 2478 / 2502 |
| `/api/catalog/recommend-vehicle` | POST | 1949 |

### 1.4 Admin mutations (all `PROTECTED` / Bearer bypass)
| Endpoint | Method | Line |
|---|---|---|
| `/api/admin/documents/{id}/review` | POST | 701 |
| `/api/admin/users/{id}/approve` | POST | 1586 |
| `/api/admin/users/{id}/suspend` | POST | 1617 |
| `/api/admin/users/{id}/request-changes` | POST | 1652 |
| `/api/admin/deposit-bands` | POST/PUT/DELETE | 1857 / 1878 / 1900 |
| `/api/admin/catalog/categories` | POST/PUT/DELETE | 2031 / 2055 / 2069 |
| `/api/admin/catalog/vehicles` | POST/PUT/DELETE | 2099 / 2124 / 2138 |
| `/api/admin/catalog/capabilities` | POST/PUT/DELETE | 2171 / 2192 / 2205 |

### 1.5 Public/unauthenticated mutations
| Endpoint | Method | Line | CSRF treatment |
|---|---|---|---|
| `/api/contact` | POST | 2933 | **EXEMPT** — anonymous form; no user context to CSRF against. Anti-abuse via rate-limit/captcha (future). |
| `/api/newsletter/subscribe` | POST | 2952 | **EXEMPT** — same reasoning. |

**Total mutating endpoints**: 42 auth-required + 2 anonymous = 44 routes. Of those, **37 will be gated** by CSRF (the auth-required set minus the 3 auth-flow endpoints).

---

## 2. Frontend mutating-call audit
- **Single choke-point exists**: every frontend call goes through `frontend/src/lib/api.js` (`api()` wrapper) which already sets `credentials: "include"`. No `axios`, no ad-hoc `fetch()`. This lets us inject `X-CSRF-Token` in exactly **one** place.
- Grep confirms **40 mutating call sites** across **21 files** (`AuthContext`, `BookingDetail`, `Catalog`, `Documents`, `DepositBands`, `DriverDetail`, `JobDetail`, `Profile`, `ReviewModal`, `Users`, plus 11 others).
- No component reads or writes `document.cookie` today — clean slate for the CSRF cookie.

**Result**: zero component-level changes required. All 40 call sites inherit CSRF protection via `lib/api.js`.

---

## 3. Design — Double-Submit Cookie pattern (chosen)

### 3.1 Why double-submit (not synchronizer token / not per-request)
- **No new server-side state**: no CSRF store to persist, no Redis/Mongo write path.
- **Compatible with our stateless JWT session model**.
- **Zero runtime cost per request** (constant-time string compare).
- **Standard OWASP-recommended pattern** for cookie-based JWT sessions.

### 3.2 The two cookies

| Cookie | HttpOnly | Secure | SameSite | Path | Max-Age | Purpose |
|---|---|---|---|---|---|---|
| `cargoone_session` (existing) | ✅ true | ✅ true | Lax | `/` | 30d | JWT, authenticates the request. **Unchanged.** |
| `cargoone_csrf` (**new**) | ❌ **false** | ✅ true | Lax | `/` | 30d | 32-byte random `secrets.token_urlsafe(32)`; JS-readable so SPA can echo. |

- Both host-only (no explicit `Domain` attribute) — same posture as the session cookie.
- Attacker at `evil.example` cannot read `cargoone_csrf` due to Same-Origin Policy → cannot echo the header → forged mutating request is rejected at 403.

### 3.3 Token lifecycle
1. **Issue** on `POST /auth/login` **and** `POST /auth/register` (fresh random value each time).
2. **Rotate** on every subsequent `POST /auth/login` (defence against session-fixation-style attacks).
3. **Re-issue** opportunistically on `GET /api/auth/me` if the session is valid **but** the CSRF cookie is missing (handles existing-user upgrade at deploy time — no forced re-login for anyone).
4. **Clear** on `POST /auth/logout` (server sends `Set-Cookie: cargoone_csrf=; Max-Age=0`).

### 3.4 Validation semantics
On any request where **all** of the following are true, enforce CSRF:
- `method ∈ {POST, PUT, PATCH, DELETE}`
- `path.startswith("/api/")`
- `path` **not in** `CSRF_EXEMPT`
- Request has **no** `Authorization: Bearer …` header (mobile bypass)
- Request carries the `cargoone_session` cookie

Enforcement rules:
- Missing `X-CSRF-Token` header → **403** `{"detail":"CSRF token missing"}`.
- Header present but ≠ `cargoone_csrf` cookie value → **403** `{"detail":"CSRF token invalid"}`.
- Both present and equal (constant-time `hmac.compare_digest`) → allow.

**Failure code discrimination**: `detail` prefix `"CSRF token …"` distinguishes CSRF failures from RBAC 403s (`"Requires role: …"`) and suspended-account 403s (`"Account suspended"`). Frontend can key error-toast text off the prefix.

### 3.5 Bearer/mobile bypass — the critical compat rule
```
if request.headers.get("Authorization", "").lower().startswith("bearer "):
    return  # skip CSRF entirely
```
This preserves the retained mobile Expo Bearer flow. Mobile clients:
- Never receive `cargoone_session` or `cargoone_csrf` cookies (they don't drive browsers).
- Continue to authenticate with `Authorization: Bearer <JWT>`.
- Are never asked for CSRF tokens.

This bypass is checked **before** the cookie/header comparison, so a mobile request with an accidentally-attached invalid CSRF header still succeeds.

### 3.6 CSRF_EXEMPT set (planned)
```python
CSRF_EXEMPT = {
    "/api/auth/login",        # public, and this is where the token is issued
    "/api/auth/register",     # public, and this is where the token is issued
    "/api/auth/logout",       # idempotent; must remain callable even w/ stale token
    "/api/contact",           # anonymous form
    "/api/newsletter/subscribe",  # anonymous form
}
```
Everything else that mutates is gated.

---

## 4. CORS implications
Current posture (`backend/server.py` lines 3159–3163):
```
allow_origins=<strict whitelist>,   # ✅ keep as-is
allow_credentials=True,             # ✅ keep as-is
allow_methods=["*"],                # ✅ keep as-is
allow_headers=["*"],                # ⚠️ narrow to explicit list
```
**Planned CORS change**: replace `allow_headers=["*"]` with:
```python
allow_headers=["Accept", "Content-Type", "Authorization", "X-CSRF-Token"]
```
Rationale: with `allow_credentials=True`, Safari and stricter WebKit derivatives reject `Access-Control-Allow-Headers: *` on preflight when the request advertises a custom header. Explicit listing is best practice and required for the `X-CSRF-Token` header to survive preflight in every browser.

**Origin whitelist stays untouched** — `https://cargoone.co.uk`, `https://www.cargoone.co.uk`. No wildcard.

---

## 5. Planned code changes (NOT yet applied)

### 5.1 `backend/server.py` — additive only, no endpoint handlers touched
1. Add constants: `CSRF_COOKIE_NAME = "cargoone_csrf"`, `CSRF_HEADER_NAME = "X-CSRF-Token"`, `CSRF_EXEMPT = {...}`.
2. Add helpers:
   - `def new_csrf_token() -> str: return secrets.token_urlsafe(32)`
   - `def set_csrf_cookie(response, token)` — same attributes table as §3.2 (HttpOnly=False, Secure, Lax, Path=/).
   - `def clear_csrf_cookie(response)`.
3. Modify **3 lines only** in existing endpoints:
   - `register` (line 505 area): after `set_auth_cookie`, call `set_csrf_cookie(response, new_csrf_token())` and return the value in `token_response.user` **wait no** — since we return the raw dict, we simply set the cookie via `response`. No JSON body change.
   - `login` (line 517 area): same additive line.
   - `logout` (line 524 area): add `clear_csrf_cookie(response)`.
4. Modify **1 endpoint** — `GET /api/auth/me` — add opportunistic re-issue: if request has session but no CSRF cookie, set one (upgrade path for pre-deploy sessions).
5. Add FastAPI middleware `csrf_middleware` registered **after** CORS middleware, **before** the router. Behaviour per §3.4/§3.5.
6. Narrow CORS `allow_headers` per §4.
7. Total added lines: ~90. Total modified lines: ~5. Zero business-logic files touched. Zero endpoint handlers touched.

### 5.2 `backend/tests/test_csrf.py` (NEW)
16 tests enumerated in §7.

### 5.3 `frontend/src/lib/api.js` — 6-line patch
```javascript
function readCsrf() {
  const m = document.cookie.match(/(?:^|;\s*)cargoone_csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}
// inside api():
const method = (opts.method || "GET").toUpperCase();
if (method !== "GET" && method !== "HEAD") {
  const csrf = readCsrf();
  if (csrf) headers["X-CSRF-Token"] = csrf;
}
```
- If the cookie is missing for a mutating call, we still send the request (backend will 403); the SPA already has 401/403 handling that redirects to `/auth/login`.
- No 401/403 retry loop added — kept simple; a stale CSRF token means the session is compromised or the user has been logged out elsewhere.

### 5.4 `frontend/src/context/AuthContext.jsx` — no change required
Set-Cookie headers on the login/register response install the cookie automatically; the SPA does not read or write it directly (only `api.js` does, at the choke-point).

### 5.5 Files that will NOT be touched
- All 42 endpoint handlers.
- All 21 frontend components with mutating calls.
- Stripe integration.
- Google Maps posture (no keys yet).
- Catalog / deposit bands / pricing / booking math.
- `backend/.env` / `frontend/.env` (no new secrets — the CSRF value is per-session random).
- DNS / Cloudflare / HSTS.
- MongoDB schema / seed data.

---

## 6. Risks & mitigations

| # | Risk | Mitigation |
|---|---|---|
| R1 | Mobile Bearer requests accidentally 403'd. | Explicit Bearer-header short-circuit in middleware, tested by `test_bearer_auth_bypasses_csrf`. |
| R2 | Users with an existing web session at deploy time have no CSRF cookie. | `GET /api/auth/me` opportunistically re-issues on next hydration. No forced re-login. |
| R3 | 403 semantic collision with existing RBAC/suspended 403s. | `detail` string prefixes (`"CSRF token …"`) unambiguously distinguish. |
| R4 | PostHog / 3rd-party scripts on cargoone.co.uk can read `cargoone_csrf`. | Acceptable — the CSRF cookie is **not** a bearer credential. Its only role is to prove same-origin execution context. Session JWT stays HttpOnly. |
| R5 | Multi-tab race: user logs out in tab A while tab B still holds stale CSRF. | Logout clears the session JWT; stale CSRF in tab B fails at auth layer (401) before CSRF check (403). |
| R6 | Preflight overhead. | No change — mutating JSON POSTs already trigger preflight. New `X-CSRF-Token` is added to existing preflight. |
| R7 | Safari `Access-Control-Allow-Headers: *` incompatibility. | Narrowed to explicit list per §4. |
| R8 | Baseline pytest breakage. | New tests live in a new file (`test_csrf.py`); existing 16f/8e baseline UNTOUCHED. Existing cookie/bearer tests continue to work because `test_cookie_auth.py` uses `requests.Session` which will auto-include both cookies once emitted. Backend baseline expected: **221 passed → 221 + 16 new = 237 passed** / 16 failed / 8 errors / 1 skipped. |
| R9 | Cross-site login from any unrelated origin. | CORS `allow_origins` whitelist stays strict; browser blocks response reading anyway. CSRF is defence-in-depth. |
| R10 | Attacker with an XSS foothold could read the CSRF cookie and forge requests. | CSRF cannot protect against XSS by design — the session cookie remains HttpOnly to limit blast radius; XSS mitigation is a separate CSP hardening item (future). |

---

## 7. Test plan (planned; NOT executed)

### 7.1 New backend tests — `backend/tests/test_csrf.py` (all 16 must pass)
1. `test_login_issues_csrf_cookie` — after `POST /auth/login`, session cookie is present + `cargoone_csrf` cookie is present, JS-readable (no HttpOnly), Secure, SameSite=Lax, host-only.
2. `test_register_issues_csrf_cookie` — same guarantees for `POST /auth/register`.
3. `test_logout_clears_both_cookies` — `POST /auth/logout` returns `Set-Cookie: cargoone_session=; Max-Age=0` and `Set-Cookie: cargoone_csrf=; Max-Age=0`.
4. `test_login_rotates_csrf` — second consecutive login on same session yields a different `cargoone_csrf` value.
5. `test_me_reissues_csrf_when_missing` — session cookie present, CSRF cookie stripped, `GET /auth/me` → 200 and Set-Cookie for a fresh CSRF.
6. `test_mutating_missing_csrf_header_returns_403` — cookie auth + no `X-CSRF-Token` on `POST /jobs` → 403 with `detail == "CSRF token missing"`.
7. `test_mutating_invalid_csrf_header_returns_403` — cookie auth + wrong header value → 403 with `detail == "CSRF token invalid"`.
8. `test_mutating_valid_csrf_header_succeeds` — cookie auth + matching header + valid body → 200/201.
9. `test_bearer_auth_bypasses_csrf` — `Authorization: Bearer <jwt>` **without** any CSRF header **succeeds** on `POST /jobs`.
10. `test_bearer_with_extra_bogus_csrf_still_succeeds` — Bearer flow ignores incorrect `X-CSRF-Token` (bypass is unconditional on Bearer presence).
11. `test_public_contact_no_csrf_required` — anonymous `POST /contact` succeeds without CSRF.
12. `test_public_newsletter_no_csrf_required` — anonymous `POST /newsletter/subscribe` succeeds without CSRF.
13. `test_get_endpoints_never_require_csrf` — `GET /auth/me`, `GET /jobs/mine`, `GET /catalog/categories` all 200 with cookie only.
14. `test_admin_delete_requires_csrf` — `DELETE /admin/deposit-bands/{id}` gated (covers PUT/DELETE not just POST).
15. `test_rbac_still_enforced_with_valid_csrf` — customer with **valid** CSRF hitting `POST /admin/users/{id}/approve` → 403 `"Requires role"` (CSRF pass, RBAC fail — CSRF does not weaken RBAC).
16. `test_cors_preflight_lists_x_csrf_token` — `OPTIONS /api/jobs` from `https://cargoone.co.uk` returns `Access-Control-Allow-Headers` containing `X-CSRF-Token` and `Authorization`.

### 7.2 Baseline regression (must remain intact)
- Full `pytest -n 0` run must show **≥ 221 passed / 16 failed / 8 errors / 1 skipped** (baseline preserved; +16 new passes from `test_csrf.py`).
- `test_cookie_auth.py::test_bearer_still_works` must still pass unchanged.
- `test_cookie_auth.py::test_login_sets_httponly_cookie` line 38 (`access_token` bearer compat) must still pass unchanged.

### 7.3 Frontend acceptance (via `testing_agent_v3_fork`)
- Login → `document.cookie` contains `cargoone_csrf=…`; `cargoone_session` NOT readable.
- Every observed mutating XHR includes `X-CSRF-Token` header equal to the cookie value.
- Devtools: delete `cargoone_csrf` cookie → next mutating call surfaces a graceful UI error (toast) and does NOT crash the app.
- Devtools: overwrite `cargoone_csrf` with garbage → 403 surfaced gracefully.
- Hard-refresh session restoration → both cookies survive → next mutation succeeds.
- Logout → both cookies cleared; `document.cookie` shows no `cargoone_csrf` residue.
- Cross-role: customer with valid CSRF still bounced from `/admin/*` (401/403).
- Zero regressions on any of the 8 marketing pages, all 3 portals, or Stripe TEST deposit redirect.

### 7.4 Cross-origin negative test
- From an unrelated origin (`https://example.com`), a scripted `fetch('https://cargoone.co.uk/api/jobs', {method:'POST', credentials:'include'})`:
  - CORS blocks response reading (already the case).
  - Even if the browser allowed the request through, the attacker cannot read `cargoone_csrf` → cannot supply `X-CSRF-Token` → backend 403.
  - Test simulated by unit-testing the middleware with a fabricated cookie-less request.

---

## 8. Rollout plan (after your approval)

1. Apply code changes to `backend/server.py` + create `backend/tests/test_csrf.py` + patch `frontend/src/lib/api.js`.
2. Run **local** `pytest -n 0` — expect 237 passed / 16 failed / 8 errors / 1 skipped.
3. Run `testing_agent_v3_fork` against the preview URL — must show all cookie flows, all portals, all mutations green.
4. Ship to production (redeploy required — one deploy).
5. Post-deploy smoke: log in as each of the three roles on `https://cargoone.co.uk`, observe `cargoone_csrf` cookie + `X-CSRF-Token` header in every mutating XHR; confirm zero 403 surprises.
6. Record baseline: **NEW baseline** `237/16/8/1` for post-CSRF regression tracking.

---

## 9. Explicit non-scope of this hardening phase
- ❌ Google Maps production keys (Phase P2-B).
- ❌ Stripe LIVE keys / webhooks (Phase P2-C).
- ❌ Mobile-endpoint separation of `access_token` (Option B recorded as future work).
- ❌ CSP / X-Frame-Options / Referrer-Policy header hardening (future security phase).
- ❌ Rate-limit / captcha on `/contact` and `/newsletter/subscribe` (future anti-abuse phase).
- ❌ DNS / TLS / HSTS changes.
- ❌ Any change to pricing, catalog, deposit math, or workflow logic.
- ❌ Backend baseline test cleanup (16f/8e stays).
- ❌ GitHub push / auto-deploy.

---

## 10. Deliverables at end of this hardening phase (when approved)
- `backend/server.py` — ~90 additive lines, ~5 modified lines (login/register/logout/me + CORS narrow).
- `backend/tests/test_csrf.py` — 16 new tests.
- `frontend/src/lib/api.js` — 6-line patch at the single choke-point.
- `PHASE_SEC1_CSRF_REPORT.md` — post-implementation report with pytest transcript + testing-agent verdict + prod smoke evidence.

---

**READY FOR YOUR APPROVAL.** No code has been changed. No redeploy triggered. Please confirm:
- (a) Approve the plan verbatim and implement in a follow-up step.
- (b) Approve with modifications (specify).
- (c) Reject / defer.
