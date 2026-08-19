# CargoOne Mobile — R71

Two native iOS/Android apps built on Expo + React Native:

```
/mobile
  /apps/customer        →  CargoOne Customer   (co.uk.cargoone.customer)
  /apps/driver          →  CargoOne Driver     (co.uk.cargoone.driver)
  /packages/core        →  shared api/auth/passkey/navigate/booking helpers
```

Admin **remains a web-only portal** at `cargoone.co.uk/admin` — no native admin app.

Both apps consume the existing certified CargoOne backend (**zero backend
changes for R71**). Every business rule (R26 pricing, R35/R36 cancellation,
R37 privacy, R40 refunds, R42 fixed-price, R43 dispatch, R59 earnings, R61
auto-tracking, R66 passkeys, R68 map/nav, R69 reviews, R70 newest-first)
is preserved as-is.

## Map & Navigation policy (locked, R71)

- **In-app maps** — `@rnmapbox/maps` **only**. No Google, no
  react-native-maps, no WebView. If Mapbox can't render (missing
  download token) the screen shows a clear error state — it does NOT
  silently fall back to another provider.
- **Navigate button** — external turn-by-turn handoff:
  - iOS   → `maps://?daddr={lat},{lng}&dirflg=d` (native Apple Maps app)
  - Android → `google.navigation:q={lat},{lng}` with `geo:` fallback
  - Google Maps is **never** auto-opened on iPhone.

The existing web app's Mapbox → Google fallback (R27) is untouched — it is
a Safari/WebKit compatibility mechanism specific to the web platform and
does not apply here.

---

## Prerequisites (Mac)

1. Node 20+, Yarn 1.x, Xcode 15+, Ruby 3, CocoaPods 1.15+.
2. iOS simulator: `xcode-select --install`.
3. Real device: Apple developer account + provisioning profile for the
   two bundle ids `co.uk.cargoone.customer` and `co.uk.cargoone.driver`.

## Environment variables

Create `apps/customer/.env` and `apps/driver/.env`:

```
EXPO_PUBLIC_BACKEND_URL=https://cargoone.co.uk
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.eyJ1I…                # your PUBLIC pk.* token
EXPO_PUBLIC_STRIPE_PK=pk_live_…                          # customer app only
```

**Do NOT** put the secret Mapbox download token here — it must stay
build-time only (see next section).

### How to obtain `MAPBOX_DOWNLOADS_TOKEN` (build-time secret)

The native Mapbox SDKs are hosted on a private CDN that requires a
**secret download token** at build time. This is a SEPARATE token from
your public map access token.

1. Sign in at https://account.mapbox.com/
2. Access tokens → **Create a token**
3. Name it `CargoOne native SDK downloads`
4. Under **Secret scopes** tick `DOWNLOADS:READ` (it must be a *secret*
   token — its identifier starts with `sk.…`, not `pk.…`)
5. Click **Create** and copy the `sk.…` value **once** — it is only
   shown at creation time. Store it in your password manager.

Then expose it to the native build. **Never commit it.** Two options:

- **Local Xcode build** — export in your shell before `expo prebuild`:
  ```bash
  export MAPBOX_DOWNLOADS_TOKEN=sk.eyJ…
  cd apps/customer && npx expo prebuild
  cd ../driver     && npx expo prebuild
  ```
  The `@rnmapbox/maps` config plugin (already wired in each `app.json`)
  substitutes `$MAPBOX_DOWNLOADS_TOKEN` into `~/.netrc` on iOS and into
  Gradle on Android at build time only.

- **EAS Build** — store as an EAS secret so it never touches source
  control:
  ```bash
  eas secret:create --scope project --name MAPBOX_DOWNLOADS_TOKEN --value sk.eyJ… --type string
  ```
  Do this once per app (`--scope project` inside each app folder).

If the token is missing the Xcode / Gradle build fails with a 401 from
`api.mapbox.com` — that is the intended failure mode. Do not paste the
`sk.…` value into `app.json`, `.env`, source code, git, screenshots, chat
logs or issue trackers.

---

## Build & run — iOS Customer

```bash
cd mobile
yarn install                                # workspace-wide install
export MAPBOX_DOWNLOADS_TOKEN=sk.eyJ…       # see section above
cd apps/customer
npx expo prebuild --clean                   # generates /ios and /android
cd ios && pod install && cd ..
open ios/CargoOneCustomer.xcworkspace       # Xcode
```

In Xcode:
1. Select **Signing & Capabilities** → your team + provisioning profile.
2. Product → Run (or Cmd+R) with your iPhone connected.

## Build & run — iOS Driver

```bash
cd mobile/apps/driver
npx expo prebuild --clean
cd ios && pod install && cd ..
open ios/CargoOneDriver.xcworkspace
```

Same signing steps.

## Android (Phase 2)

Android is scaffolded (`android` folder created by `expo prebuild`) but
production release requires:
- Google Play upload key
- Firebase project for FCM push (deferred — not part of R71)
- Store the same `MAPBOX_DOWNLOADS_TOKEN` in Gradle's `~/.gradle/gradle.properties`:
  ```
  MAPBOX_DOWNLOADS_TOKEN=sk.eyJ…
  ```

---

## Passkeys / Face ID

The customer + driver apps use `react-native-passkey`, which wraps
`ASAuthorizationController` on iOS. The WebAuthn RP-ID is **cargoone.co.uk**
in production — never overridden client-side.

For iOS to accept the passkey you must publish the Apple App Site
Association file at `https://cargoone.co.uk/.well-known/apple-app-site-association`:

```json
{
  "webcredentials": {
    "apps": [
      "TEAMID.co.uk.cargoone.customer",
      "TEAMID.co.uk.cargoone.driver"
    ]
  }
}
```

Replace `TEAMID` with your Apple Developer team id. This file must be
served over HTTPS with `Content-Type: application/json` and no
redirect. Both bundle ids are already listed in the app's
`associatedDomains` (`webcredentials:cargoone.co.uk`).

---

## Testing (this container)

- `packages/core` — 26/26 Jest tests pass:
  - `navigate.test.ts` — iOS `maps://` scheme, Android `google.navigation:`,
    URL escaping, missing-destination guard.
  - `bookings.test.ts` — sort newest-first (R70 parity), phase mapping
    (R68 parity), navigate target selection, formatters, R37 contact
    visibility.
  - `api.test.ts` — bearer attach, JSON parse, ApiError propagation.
- TypeScript typecheck on `packages/core` — clean.
- Backend regression (from prior runs) — 61 passed / 7 skipped / 0 failed.
- Frontend web build — unchanged.

## Explicitly NOT physically certified in this container

You must verify on a real iPhone once the Xcode build succeeds:
- Mapbox native rendering (map tiles, driver marker, route line)
- Face ID passkey registration + login
- Apple Maps handoff from Navigate
- Stripe Payment Sheet
- ASAP background location during travelling → delivered
- Real-device push (once APNs is added in Phase 2)
