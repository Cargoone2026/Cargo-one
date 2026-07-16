# Cargo One - Product Requirements Document

## Brand
- **Name:** Cargo One
- **Slogan:** Ship Anything. Anywhere. Instant Quotes.
- **Theme:** Modern, premium, professional logistics marketplace
- **Palette:** Red #D62828, Black #111111, Orange #FF6A00, White #FFFFFF, Grey #F4F4F4/#6B7280

## Architecture (MVP)
Single Expo React Native app (structured for easy split later) + FastAPI + MongoDB.
- **Roles:** customer, driver, admin (JWT with role claim, gated routes)
- **Route groups:** `(auth)`, `(customer)`, `(driver)`, `(admin)`
- **Maps:** Leaflet + OpenStreetMap in WebView (works everywhere; no Google API key needed for MVP)
- **Payments:** Stripe Checkout via `emergentintegrations` (test mode) — deposit-only model
- **Auth:** JWT stored in expo-secure-store; email/password with bcrypt

## Roles & Flows

### Customer
Tabs: Home, Post Job, Bookings, Messages, Profile
- Post job wizard (4 steps: category+title → route → details → pricing)
- Fixed price OR open-to-bids with max budget
- Browse own jobs + bids; accept a bid to create a booking
- Pay 10% Stripe deposit → unlocks driver contact, exact addresses, chat
- Live map tracking + status updates
- POD viewer, mark completed, leave review

### Driver
Tabs: Home, Nearby Jobs, My Jobs, Earnings, Profile
- Registration lands in `pending` until admin approves
- Documents section (licence, insurance, vehicle docs, ID, address)
- Nearby jobs with radius filter (10/20/40/75/250 mi) — sorted by distance
- Accept fixed-price OR submit bid
- Post-deposit: chat, status flow (Travelling → Arrived → Collected → On Route → Delivered)
- Live GPS tracking (expo-location foreground watch) posts to backend
- POD upload with GPS + signature + notes
- Earnings dashboard (total, pending balance, history)

### Admin
Tabs: Dashboard, Users, Drivers, Jobs, Settings
- Dashboard metrics: customers, drivers, pending approvals, jobs, revenue
- Approve/suspend drivers, suspend users
- View all jobs and bookings

## Booking Flow (privacy-first)
1. Customer posts → Driver accepts/bids → Customer accepts bid
2. Booking created with `deposit = 10% × total`; status `accepted`, payment `pending`
3. Customer pays deposit via Stripe Checkout (external browser)
4. On payment success (polled via `/payments/status/{session_id}`):
   - Booking → `deposit_paid` / `confirmed`
   - Customer + driver details, phone, exact addresses **unlock**
   - Chat unlocks; tracking unlocks
5. Driver progresses statuses; uploads POD; customer confirms → completed → reviews

## Key APIs (all `/api/*`, JWT-required unless noted)
- `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `PUT /auth/me`
- Jobs: `POST /jobs`, `GET /jobs/mine`, `GET /jobs/nearby`, `GET /jobs/{id}`, `POST /jobs/{id}/accept`
- Bids: `POST /jobs/{id}/bids`, `GET /jobs/{id}/bids`, `POST /bids/{id}/accept`
- Bookings: `POST /bookings`, `GET /bookings/mine`, `GET /bookings/{id}`, `POST /bookings/{id}/status`
- Payments: `POST /bookings/{id}/deposit`, `GET /payments/status/{session_id}`
- Messages: `POST /bookings/{id}/messages`, `GET /bookings/{id}/messages`
- Tracking: `POST /tracking/{id}` (driver), `GET /tracking/{id}`
- POD: `POST /bookings/{id}/pod`, `GET /bookings/{id}/pod`
- Complete/Review: `POST /bookings/{id}/complete`, `POST /bookings/{id}/review`
- Notifications: `GET /notifications`
- Admin: `GET /admin/stats`, `GET /admin/users`, `POST /admin/users/{id}/approve|suspend`, `GET /admin/jobs`

## Seeded Data
- Admin: `admin@cargoone.com` / `admin123` (auto-seeded on backend startup)

## Test Coverage
- 36/36 backend tests passing (auth, RBAC, jobs, bids, bookings, deposit, privacy, chat, tracking, POD, reviews, admin)

## Known Limitations
- Google Maps API key not integrated (uses Leaflet + OSM as no-key alternative)
- Push notifications not implemented (deferred until native build ready)
- POD photos & signature drawing stubbed (submits with text notes + GPS only)
- Driver document upload UI is stub (backend endpoint pending)

## RC1 — Marketing Website (June 2026)
- Public marketing site inside the same Expo app: `/`, `/how-it-works`, `/services`, `/business`, `/drivers`, `/trust-safety`, `/faq`, `/contact`, `/about`.
- Reusable components in `src/components/marketing/` (Hero, Section, FeatureCard, MarketingHeader, MarketingFooter, CookieBanner, AppStoreButtons, SEO).
- SEO: per-page `<title>`, description, OG/Twitter tags, canonical URL, JSON-LD organisation schema, GA4 + GSC verification via `EXPO_PUBLIC_GA_ID` / `EXPO_PUBLIC_GSC_TOKEN`. `public/sitemap.xml` + `public/robots.txt`.
- Contact form + newsletter subscribe endpoints (public); admin listing endpoints protected.
- Cookie consent banner with `AsyncStorage` persistence; hidden on native.
- GDPR delete-account now scrubs denormalised names on jobs, bids, reviews, messages.
- Header shows "Go to App" if user is authenticated so marketing browsing does not lock users out of their dashboard.

