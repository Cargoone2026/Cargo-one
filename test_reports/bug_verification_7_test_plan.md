# Phase 2D Bug Verification 7 Test Plan and Evidence Scripts

Skill lookup: searched `driver profile unauthenticated sign-in CTA Link import`; no relevant testing skill found. Auth JWT integration playbook checklist used for auth-related regression checks.

Focused checks performed:
1. Code inspection: verified `/app/frontend/src/pages/portal/customer/JobDetail.jsx` imports `Link` from `react-router-dom`; verified bid avatar `Link` markup targets `/driver-profile/{driver_id}`.
2. Code inspection: verified `/app/frontend/src/pages/DriverProfilePublic.jsx` sets `needsAuth` on 401/token/unauthor errors and renders `dpp-signin-required` + `dpp-signin-cta` instead of `Profile not found`.
3. Browser Fix B: fresh unauthenticated context navigated to `/driver-profile/3506677b-2008-4708-8e3f-a1cee03a6926`; asserted `driver-profile-public`, `dpp-signin-required`, `dpp-signin-cta`; CTA navigated to `/auth/login?next=%2Fdriver-profile%2F3506677b-2008-4708-8e3f-a1cee03a6926`; authenticated customer revisit rendered `dpp-header` and `dpp-stats` with Test Driver data.
4. Browser Fix A: created disposable approved driver/bid on existing customer bidding job, rendered bid card/link, clicked bid avatar and verified route `/driver-profile/dc038cef-c53e-4703-991c-c527735f93d2` with no React error.
5. Browser Fix C: registered disposable customer `e2e2d-verify-1784674659@example.com`, opened settings delete flow, confirmed deletion, verified `/api/auth/me` returned 401 after logout and re-login failed with Invalid credentials; settings terms/privacy/cookies/about/support rendered.
6. Browser Fix D: customer, driver, admin dashboards rendered with focused console errors = 0 after auth settled; cross-role redirects customer→admin, driver→admin, admin→customer returned users to their own portals.

Seed data created:
- Disposable bid driver `e2e2d-bid-driver-1784674625@example.com`, id `dc038cef-c53e-4703-991c-c527735f93d2`, approved by admin and bid `7e3249ff-7b2e-4194-b147-2ca48c4d9944` on job `f508aa78-6964-49e4-afb5-3aafed5c0c9c`.
- Disposable deleted customer `e2e2d-verify-1784674659@example.com`.

Browser console log artifacts are under `/root/.emergent/automation_output/20260721_225433`, `225714`, `225737`, `225839`.
