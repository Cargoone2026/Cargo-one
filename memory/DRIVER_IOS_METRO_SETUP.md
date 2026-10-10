# CargoOne Driver — iOS Development Build Metro Setup (LOCKED)


> ## LOCKED DEV FOLDERS (user-verified 2026-10-09 via `lsof ... -d cwd`)
>
> | App | Start from | Command | Port |
> |---|---|---|---|
> | Customer | `~/Documents/GitHub/Cargo-one/mobile` | `yarn workspace @cargoone/customer expo start -c --dev-client --lan --port 8081` | 8081 |
> | Driver | `~/Documents/GitHub/Cargo-one-driver-build/mobile` | `yarn workspace @cargoone/driver expo start -c --dev-client --lan --port 8082` | 8082 |
>
> - Verified Driver Metro cwd: `/Users/A.B/Documents/GitHub/Cargo-one-driver-build/mobile/apps/driver` (PID 2024, port 8082).
> - NEVER start Customer Metro from `Cargo-one-driver-build` (caused white screen 2026-10-09).
> - NEVER start Driver Metro from `Cargo-one` unless the user explicitly re-verifies it.
> - Verify any running Metro: `lsof -a -p $(lsof -t -nP -iTCP:<PORT> -sTCP:LISTEN) -d cwd`
> - Type commands by hand (phone copy turns `--` into `—`). No space after `@cargoone/`.

> **Driver push v1 (2026-10-10):** `expo-notifications` is now autolinked for Driver (loaded lazily after login). Native rebuild required: `pod install` in `apps/driver/ios` + Xcode. Rollback tag on Mac: `driver-pre-push-checkpoint`.

**Purpose**: Standard procedure for connecting the CargoOne Driver development
build on a physical iPhone to Metro running on the developer's Mac over the
ZTE U50 Wi-Fi, including the exact procedure for running Driver Metro
simultaneously with Customer Metro.

**Golden checkpoint at time of writing**:
- Driver reachable golden tag: `driver-r71-16-h-golden`
- Driver app current locked baseline: Phase 1–11 (POD included).
- Both Customer Metro (port **8081**) and Driver Metro (port **8082**) have
  been verified running simultaneously end-to-end on their respective physical
  iPhones (2026-10-06).

## Network requirement

Both the Mac and the iPhone must be joined to the **ZTE U50** Wi-Fi. The Mac's
IP on this network is DHCP-assigned and can change between sessions — never
hard-code it.

## Reading the Mac's current U50 IP

```bash
ipconfig getifaddr en0
```

Example output: `192.168.0.101` (illustrative only — do not assume this value).

## Starting Driver Metro

### Case A — Driver Metro on its own (Customer Metro NOT running)

Driver can take Metro's default port **8081**:

```bash
cd ~/Documents/GitHub/Cargo-one-driver-build/mobile && \
yarn workspace @cargoone/driver expo start -c --dev-client --lan
```

Dev-launcher URL on the Driver iPhone:
```
http://<MAC_U50_IP>:8081
```

### Case B — Driver Metro alongside Customer Metro (RECOMMENDED FOR DUAL-APP WORK)

Customer Metro owns port **8081** (see `CUSTOMER_IOS_METRO_SETUP.md`). Pin
Driver Metro to port **8082** at the CLI level so Expo does not need to prompt
and so each dev-client has a deterministic URL to connect to:

```bash
cd ~/Documents/GitHub/Cargo-one-driver-build/mobile && \
yarn workspace @cargoone/driver expo start -c --dev-client --lan --port 8082
```

- `-c` → clears Driver Metro's own cache. Mandatory on first launch after any
  mismatch or whenever the Driver dev-client reports it loaded the wrong
  bundle.
- `--dev-client` → targets the installed Driver development client (NOT Expo
  Go).
- `--lan` → forces LAN mode so the iPhone can reach the Mac by IP.
- `--port 8082` → avoids collision with Customer Metro on 8081. This is a
  Metro CLI flag only — no source / package / app-config / native change.

Confirm Driver Metro's startup banner prints:
```
› Metro waiting on exp://<MAC_U50_IP>:8082
```

Each Metro instance roots at the workspace you launched it from, so:
- Metro on **8081** (started from `mobile/apps/customer`) serves Customer's
  `index.ts` → Customer bundle (includes `@stripe/stripe-react-native`,
  `expo-splash-screen`, etc.).
- Metro on **8082** (started from `mobile/apps/driver`) serves Driver's
  `index.ts` → Driver bundle (excludes Stripe/splash/push/secure-store/passkey
  via Driver's `expo.autolinking.exclude`).

## Connecting the Driver iPhone

1. Open the CargoOne Driver development build on the iPhone.
2. On the dev-launcher, **do not tap any `:8081` entry in the "Recently
   opened" list** — that URL belongs to Customer Metro and will crash Driver
   (see "Known failure modes" below).
3. Tap **"Enter URL manually"**.
4. Enter:
   ```
   http://<MAC_U50_IP>:8082
   ```
   - Example: `http://192.168.0.101:8082`
   - Use the IP printed by the Driver Metro startup command above
     (same IP as Customer — both Metros are on the same Mac).
5. Metro should log a `BUNDLE ./index.ts` line from the iPhone's IP once the
   Driver app connects.

Optional hardening: long-press and **remove** any `:8081` entry from the
Driver device's "Recently opened" list so it cannot be tapped by accident.
Leave Customer-device entries unchanged.

### Manual URL — exact format

The dev-launcher's parser is strict. For Driver, the URL must be:

```
http://<IP>:8082
```

- Scheme: `http://` (required — not `https://`, not `exp://`, not
  scheme-less).
- Host: the Mac's current U50 IP, read live from `ipconfig getifaddr en0`.
- Port: **`8082`** when Customer Metro is running on 8081 (recommended for
  dual-app work). Port **`8081`** only when Customer Metro is NOT running.
- No trailing slash, no path, no query string.

**Known failures the dev-launcher reports as
`Calling the 'loadApp' function has failed → Cannot parse the provided url`**:

| What was typed | Why it fails |
|---|---|
| `192.168.0.101:8082` | Missing `http://` scheme |
| `<MAC_U50_IP>:8082` | Placeholder not substituted with a real IP |
| `exp://192.168.0.101:8082` | `exp://` is the Expo Go scheme — the dev-client wants plain `http://` |
| `https://192.168.0.101:8082` | Metro serves plain HTTP, not HTTPS |
| `http://192.168.0.101:8082/` *(trailing slash)* | Rejected by some dev-client versions — remove the slash |

### Where to read the IP

Two equivalent sources:

1. The Mac's terminal:
   ```bash
   ipconfig getifaddr en0
   ```
2. Driver Metro's own startup banner, immediately under the QR code — it
   prints a line like:
   ```
   › Metro waiting on exp://192.168.0.101:8082
   ```
   Take the `IP:port` portion and prepend `http://` instead of `exp://`.

## Known failure modes

| Symptom | Cause | Fix |
|---|---|---|
| `new NativeEventEmitter() requires a non-null argument` with `useStripe.tsx` in the stack on the Driver iPhone | Driver dev-client loaded the Customer bundle from `:8081`. The Customer bundle imports `@stripe/stripe-react-native`, which Driver's native binary excludes via `expo.autolinking.exclude` → the JS tries to attach a `NativeEventEmitter` to a `null` native module. | Fully kill the Driver app, reopen the dev-launcher, enter `http://<MAC_U50_IP>:8082` manually. Confirm Driver Metro's banner shows port 8082 and `BUNDLE ./index.ts` fires from the iPhone's IP. |
| Expo prompts *"Port 8081 is in use. Use port 8082 instead?"* at Driver Metro startup | Customer Metro already owns 8081 (expected). | Accept the prompt, OR pre-pin via `--port 8082` as in Case B above (deterministic, recommended). |
| Driver iPhone shows "Could not connect to development server" at `:8082` | Driver Metro not running on 8082, or iPhone not on ZTE U50, or wrong Mac IP. | Verify Driver Metro banner shows `exp://<IP>:8082`. Re-check Wi-Fi. Re-read IP with `ipconfig getifaddr en0`. |
| Old Driver JS after a code change | Driver Metro cache. | Restart Driver Metro with `-c`. |
| Native change (entitlements, Info.plist, autolinking) doesn't take effect | Metro only reloads JS. | Rebuild Driver in Xcode (`Cmd+R`). |

### Verifying Driver Metro serves the Driver bundle (not Customer's)

Before tapping anything on the iPhone, from the Mac:

```bash
# Should be >= 1  — Driver bundle contains Phase 11 SignaturePad (POD)
curl -s "http://127.0.0.1:8082/index.bundle?platform=ios&dev=true&minify=false" \
  | grep -c "SignaturePad"

# Should be 0   — Driver bundle must NOT contain @stripe/stripe-react-native
curl -s "http://127.0.0.1:8082/index.bundle?platform=ios&dev=true&minify=false" \
  | grep -c "@stripe/stripe-react-native"
```

If the second count is non-zero, Driver Metro is serving Customer code —
stop it and relaunch strictly via `yarn workspace @cargoone/driver` as in
Case B above (not from the monorepo root with a bare `expo start`).

## Do NOT change

- Application code (Driver app is Phase 1–11 LOCKED).
- `apps/driver/package.json` (including `expo.autolinking.exclude`).
- `apps/driver/app.json`.
- Any native iOS file, Podfile, Pods.
- Any lockfile.

This is a purely local developer setup procedure. The `--port 8082` flag is
a Metro CLI argument only; nothing in the repo needs to change to support it.

## Related

- `/app/memory/CUSTOMER_IOS_METRO_SETUP.md` — Customer counterpart (port
  **8081**). Keep that document authoritative for Customer; this document is
  authoritative for Driver.
