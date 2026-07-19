# Cargo One — Production Readiness Checklist

_Generated at the end of Wave 3 Pre-Launch (Increment B)._

## 1. Google Maps Platform — required APIs

Enable **all four** APIs on the same Google Cloud project you'll use for
Cargo One production:

| API                            | Used by                                                   | Notes                                                                 |
| :----------------------------- | :-------------------------------------------------------- | :-------------------------------------------------------------------- |
| **Places API (New)**           | Address autocomplete (frontend + backend `/geo/autocomplete`) | Component-restricted to the 5 largest launch markets (GB, IE, FR, DE, NL) with regional bias. |
| **Maps JavaScript API**        | In-app address picker WebView + route preview             | The web/tablet quote flow embeds this via `AddressAutocomplete`.      |
| **Geocoding API**              | Backend fallback for post-coded manual entries            | Called from `/geo/autocomplete` proxy when we resolve a Place ID.     |
| **Directions API** (optional)  | Live route ETAs on driver map                              | If not enabled the app falls back to `google_distance_matrix` + haversine. |

Optional but recommended:
- **Distance Matrix API** — already used by `google_distance_matrix()` in
  `backend/server.py` for quote ETAs. Fully falls back to haversine when
  the key is unset, but enabling it improves quote accuracy.

## 2. API keys — one or two?

Recommended: **two keys** with tight restrictions.

### Frontend (browser + WebView) key
- Env var: `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`
- Google restrictions:
  - **HTTP referrers** — add the final Cargo One production domain(s):
    - `https://cargoone.co.uk/*`
    - `https://*.cargoone.co.uk/*`
    - `https://cargo-one.emergent.host/*` (Emergent preview, if still needed)
  - **API restrictions** — Maps JavaScript API, Places API only.

### Backend (server-to-server) key
- Env var: `GOOGLE_MAPS_API_KEY` (already read by `backend/server.py`).
- Google restrictions:
  - **IP addresses** — the outbound egress IP(s) of the production Kubernetes
    nodes. Ask Emergent support for the current NAT/egress range.
  - **API restrictions** — Places API, Geocoding API, Distance Matrix API.

The backend endpoint `GET /api/geo/autocomplete` gracefully returns
`{suggestions: [], source: "manual"}` when the server key is unset OR
starts with `"placeholder"`. Frontend renders the manual-entry fallback
automatically. **No code change is needed to switch to production** —
just populate the env vars and redeploy.

## 3. Billing

- Google Maps Platform requires an active billing account on the project.
- The **$200 monthly free credit** covers approximately:
  - 100 000 autocomplete-per-session requests, OR
  - 40 000 static map loads, OR
  - 40 000 dynamic map loads.
- Set a **hard budget alert** at 80 % of your intended monthly ceiling.
- Enable **Google's built-in daily quotas** to cap runaway usage.

## 4. Production environment variables

Add these to whatever secret store the deployment platform uses. **Do NOT**
commit real values to `.env.example` files in the repo.

| Name                              | Where used                | Required at launch |
| :-------------------------------- | :------------------------ | :----------------- |
| `MONGO_URL`                       | `backend/.env`            | ✅ (already configured) |
| `DB_NAME`                         | `backend/.env`            | ✅ (already configured) |
| `JWT_SECRET`                      | `backend/.env`            | ✅ (already configured) |
| `STRIPE_SECRET_KEY`               | `backend/.env`            | ✅ (test key set)  |
| `STRIPE_WEBHOOK_SECRET`           | `backend/.env`            | ✅ (test set)      |
| `GOOGLE_MAPS_API_KEY`             | `backend/.env`            | **⚠️ Add production key** |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | `frontend/.env`           | **⚠️ Add production key** |
| `EXPO_PUBLIC_BACKEND_URL`         | `frontend/.env`           | ✅ (Emergent-managed) |
| `EXPO_PACKAGER_*`                 | `frontend/.env`           | ✅ (Emergent-managed — DO NOT touch) |

## 5. Domain-restriction checklist for the day of launch

Before switching DNS to the Cargo One domain:

1. Add the final domain(s) to the Google frontend key's **HTTP referrer
   restrictions** — otherwise autocomplete will silently return 403 in
   the WebView.
2. Rotate `JWT_SECRET` to a fresh long random value and re-deploy.
3. Swap Stripe **test** keys for **live** keys (`sk_live_...`,
   `whsec_live_...`). Confirm the webhook endpoint in the Stripe dashboard
   points at the new domain: `https://cargoone.co.uk/api/webhooks/stripe`.
4. Verify the marketing `robots.txt` (`/robots.txt`) points its `Sitemap:`
   at the new domain.
5. Warm the sitemap via Google Search Console (submit `/sitemap.xml`).

## 6. Not blocking launch

- Push notifications — deferred (Emergent Firebase build needed).
- FAQ / promo codes / banners / disputes admin UIs — flagged as "Coming soon"
  in the current admin settings. Not required for MVP launch.

---

# Test / QA Account Inventory

Total accounts in the DB: **81**.

## Real / seeded (14)

Keep these — they are legitimate seeded fixtures:

| Email                                | Role     | Status  | Origin                        |
| :----------------------------------- | :------- | :------ | :---------------------------- |
| `admin@cargoone.com`                 | admin    | active  | Backend startup seed          |
| `driver1@cargoone.com`               | driver   | pending | Main agent — Wave 3 Phase B   |
| `cust1@cargoone.com`                 | customer | active  | Main agent — Wave 3 Phase B   |
| (12 other real customer / driver signups — see `db.users.find({email:{$regex:"cargoone.com$"}})`) |

## Test fixtures (67)

Created by `testing_agent` across many pytest runs. Safely deletable.

Categorised by prefix:
- `test_cust_*`, `test_drv_*`, `test_drv2_*` — Phase 2 tests (13 accounts)
- `test_dep_*` — Deployment-readiness tests (14)
- `test_bf_*` — Booking-fee band tests (2)
- `test_customer_*`, `test_driver_*` @qa.com — Wave 3 Phase B tests (36)
- `pt*@t.com`, `driver*@t.com` — Earlier smoke tests (2)

## Recommended cleanup (post-QA, pre-launch)

```javascript
// mongo shell — DRY RUN first (find), then run the delete.
use cargoone_db

// 1) Find them
db.users.find({
  $or: [
    { email: /^test_/ },
    { email: /@qa\.com$/ },
    { email: /@t\.com$/ },
    { email: /^placeholder/ },
    { email: /^pt\d+@/ }
  ]
}, { email: 1, role: 1, status: 1 }).sort({ email: 1 })

// 2) Delete users + their orphan data (only after QA sign-off)
const testUserIds = db.users
  .find({ $or: [
    { email: /^test_/ }, { email: /@qa\.com$/ }, { email: /@t\.com$/ },
    { email: /^placeholder/ }, { email: /^pt\d+@/ } ] },
    { _id: 0, id: 1 })
  .toArray().map(u => u.id);

db.users.deleteMany({ id: { $in: testUserIds } });
db.jobs.deleteMany({ customer_id: { $in: testUserIds } });
db.bookings.deleteMany({ $or: [
  { customer_id: { $in: testUserIds } },
  { driver_id:  { $in: testUserIds } } ] });
db.bids.deleteMany({ driver_id: { $in: testUserIds } });
db.documents.deleteMany({ user_id: { $in: testUserIds } });
db.driver_vehicles.deleteMany({ driver_id: { $in: testUserIds } });
db.reviews.deleteMany({
  $or: [{ author_id: { $in: testUserIds } }, { target_id: { $in: testUserIds } }],
});
db.notifications.deleteMany({ user_id: { $in: testUserIds } });
```

⚠️ **Do not run in the current environment** — QA is still using these
accounts. Snapshot the DB, run this in a **staging clone**, verify job/
booking counts remain sensible, then apply to production immediately
after the DNS cutover and before opening customer signups.

---

# UK / Ireland / Europe readiness — status

| Item                                                         | Status |
| :----------------------------------------------------------- | :----- |
| Preset UK cities (London/Manchester/Birmingham) removed      | ✅     |
| One-primary-field search UX (postcode/Eircode/place)         | ✅     |
| International address schema (country, country_code, place_id) | ✅   |
| Backend: `/geo/markets` (16 launch markets) + `/geo/autocomplete` | ✅ |
| Backend: `/quote/estimate` extended (route_class + manual review) | ✅ |
| Backend: `POST /jobs` extended (jobs go to `awaiting_manual_quote`) | ✅ |
| UK jobs backwards compatible (no country codes → domestic_uk) | ✅  |
| GB↔IE routes correctly classified as `international`         | ✅     |
| FR↔FR / DE↔DE etc. classified as `domestic_other` (manual review) | ✅ |
| CN or unsupported country → `unsupported`                     | ✅    |
| Live Google Places autocomplete                              | ⚠️ Needs prod key |
| Country pricing rules for IE, FR, DE, NL …                   | ⏳ Deferred (structural work done, actual rules per business decision) |
| 56/56 backend tests green                                    | ✅     |
