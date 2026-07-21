# Auth Testing Playbook

Focused checklist for this bug verification:
- Verify login/register requests set the cookie-backed session and `/api/auth/me` reflects the active user.
- Verify authenticated UI requests use `credentials: include` and account-specific routes render only after auth context refresh.
- For delete-account, use a disposable registered account, perform `POST /api/auth/me/delete` through the UI session, confirm logout redirect, and confirm the same email can no longer log in.
- For role smoke tests, confirm each seeded role lands on its own dashboard and cross-role routes redirect away.