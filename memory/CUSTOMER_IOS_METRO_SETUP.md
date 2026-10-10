# CargoOne Customer — iOS Development Build Metro Setup (LOCKED)

**Purpose**: Standard procedure for connecting the CargoOne Customer development build
on a physical iPhone to Metro running on the developer's Mac over the ZTE U50 Wi-Fi.

**Golden checkpoint at time of writing**:
- Commit: `b03a385`
- Tag: `customer-apple-pay-golden`
- State: Stripe cards + Apple Pay + push notifications + map + bids all verified
  end-to-end on physical iPhone.

**Re-verified session (2026-10-06)**:
- Highest Customer golden tag reachable from `main`: `customer-r71-16-1-golden`
  → commit `ac1feef7e47b09801c3661f98ad3522f985b937e` (R71.16.1, 2026-09-20).
- The Customer dev-client build on the physical iPhone was successfully
  connected to Metro using the command and URL below. Confirmed working.
- `n = 0` white-screen debugging episodes from this session are unrelated to
  this document — they were caused by an unrelated Metro/dev-client
  mismatch resolved by restoring Customer's locked state and restarting
  Metro from the Customer workspace with `-c`. Do not treat the Metro
  procedure below as the cause or the fix of that unrelated issue.

## Network requirement

Both the Mac and the iPhone must be joined to the **ZTE U50** Wi-Fi. The Mac's IP on
this network is DHCP-assigned and can change between sessions — never hard-code it.

## Reading the Mac's current U50 IP

```bash
ipconfig getifaddr en0
```

Example output: `192.168.0.101` (illustrative only — do not assume this value).

## Starting Metro — VERIFIED COMMAND (user-confirmed 2026-10-09)

```bash
cd ~/Documents/GitHub/Cargo-one/mobile
yarn workspace @cargoone/customer expo start -c --dev-client --lan --port 8081
```

> **CRITICAL — correct folder.** The Mac has TWO clones:
> - `~/Documents/GitHub/Cargo-one` → **Customer** Metro (port 8081). ✅
> - `~/Documents/GitHub/Cargo-one-driver-build` → **NOT for Customer.** Starting Customer
>   Metro here produced a **white screen after bundle load** (2026-10-09). Different code +
>   different `node_modules` (possible duplicate `react-native` → Hermes n=0 crash).
> - Workspace name is `@cargoone/customer` — **no space** after `@cargoone/`
>   (a space gives `Unknown workspace "@cargoone/"` and Metro never starts → white screen).
> - Type commands by hand; copying from phone/iMessage turns `--` into `—` and quotes into
>   smart quotes (git then prints its usage/help screen).
> - Any Customer device test run from the wrong clone is invalid — re-test from `Cargo-one`.
> - Before debugging a white screen: check folder (`pwd`), port owner
>   (`lsof -nP -iTCP:8081 -sTCP:LISTEN` → `lsof -p <PID> | grep cwd`), and duplicate RN
>   (`find mobile -maxdepth 5 -type d -path "*node_modules/react-native"`). Do NOT roll back code first.

Legacy alternative (older doc, from the customer directory):

```bash
cd ~/Documents/GitHub/Cargo-one/mobile/apps/customer && \
echo "Mac U50 IP: $(ipconfig getifaddr en0)" && \
npx expo start -c --dev-client --lan
```

- `-c` clears the Metro/Haste cache — mandatory when the previous session may have
  cached stale `EXPO_PUBLIC_*` values or transformed modules.
- `--dev-client` targets the installed development client (not Expo Go).
- `--lan` forces LAN mode so the iPhone can reach the Mac by IP.

## Connecting the iPhone

1. Open the CargoOne Customer development build on the iPhone.
2. On the dev-launcher, tap **"Enter URL manually"**.
3. Enter: `http://<CURRENT_MAC_U50_IP>:8081`
   - Example: `http://192.168.0.101:8081`
   - Use the IP printed by the Metro startup command above.
4. Metro should log a `BUNDLE ./index.ts` line once the app connects.

### Manual URL — exact format

The dev-launcher's parser is strict. It must be:

```
http://<IP>:8081
```

- Scheme: `http://` (required — not `https://`, not `exp://`, not scheme-less).
- Host: the Mac's current U50 IP, read live from `ipconfig getifaddr en0`.
- Port: `8081` (always — this is Metro's default. Do NOT use 8082 or any
  other port even if a previous session used one.)
- No trailing slash, no path, no query string.

**Known failures the dev-launcher reports as
`Calling the 'loadApp' function has failed → Cannot parse the provided url`**:

| What was typed | Why it fails |
|---|---|
| `192.168.0.101:8081` | Missing `http://` scheme |
| `<MAC_U50_IP>:8081` | Placeholder not substituted with a real IP |
| `http://<MAC_U50_IP>:8081` | Placeholder not substituted with a real IP |
| `exp://192.168.0.101:8081` | `exp://` is the Expo Go scheme — the dev-client wants plain `http://` |
| `https://192.168.0.101:8081` | Metro serves plain HTTP, not HTTPS |
| `http://192.168.0.101:8082` | Wrong port — Customer Metro listens on 8081 |
| `http://192.168.0.101:8081/` *(trailing slash)* | Rejected by some dev-client versions — remove the slash |

### Where to read the IP

Two equivalent sources:

1. The Mac's terminal:
   ```bash
   ipconfig getifaddr en0
   ```
2. Metro's own startup banner, immediately under the QR code — it prints a
   line like:
   ```
   › Metro waiting on exp://192.168.0.101:8081
   ```
   Take the `IP:port` portion and prepend `http://` instead of `exp://`.

## Do NOT change

- Application code
- Networking code
- Mapbox / Stripe / bookings / auth / navigation
- Repository configuration

This is a purely local developer setup procedure. Nothing in the repo needs to
change to support it — it works with the current codebase as-is.

## Running Driver Metro simultaneously with Customer Metro

Customer Metro **must stay on port 8081** (this document is authoritative).
Driver Metro runs on **port 8082** in dual-app sessions, pinned at the CLI:

```bash
cd ~/Documents/GitHub/Cargo-one && \
yarn workspace @cargoone/driver expo start -c --dev-client --lan --port 8082
```

Driver iPhone dev-launcher URL: `http://<MAC_U50_IP>:8082` (same Mac IP, port
8082). Driver's full procedure, including the known Stripe-NativeEventEmitter
failure that occurs if the Driver iPhone accidentally loads from
`:8081`, is documented in `/app/memory/DRIVER_IOS_METRO_SETUP.md`.

## Troubleshooting quick reference

| Symptom | Cause | Fix |
|---|---|---|
| Dev-client can't reach `http://<IP>:8081` | Mac and iPhone on different Wi-Fi | Confirm both on ZTE U50 |
| "Could not connect to development server" | Metro not started, or wrong IP | Re-run `ipconfig getifaddr en0`, restart Metro |
| Old JS after a code change | Metro cache | Restart Metro with `-c` |
| `EXPO_PUBLIC_STRIPE_PK` empty at runtime | `mobile/apps/customer/.env` missing / not populated | Populate `.env` from `.env.example`, restart Metro |
| Native change (entitlements, Info.plist) doesn't take effect | Metro only reloads JS | Rebuild in Xcode (`Cmd+R`) |
