# CargoOne Customer — iOS Development Build Metro Setup (LOCKED)

**Purpose**: Standard procedure for connecting the CargoOne Customer development build
on a physical iPhone to Metro running on the developer's Mac over the ZTE U50 Wi-Fi.

**Golden checkpoint at time of writing**:
- Commit: `b03a385`
- Tag: `customer-apple-pay-golden`
- State: Stripe cards + Apple Pay + push notifications + map + bids all verified
  end-to-end on physical iPhone.

## Network requirement

Both the Mac and the iPhone must be joined to the **ZTE U50** Wi-Fi. The Mac's IP on
this network is DHCP-assigned and can change between sessions — never hard-code it.

## Reading the Mac's current U50 IP

```bash
ipconfig getifaddr en0
```

Example output: `192.168.0.101` (illustrative only — do not assume this value).

## Starting Metro (from the customer directory only)

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

## Do NOT change

- Application code
- Networking code
- Mapbox / Stripe / bookings / auth / navigation
- Repository configuration

This is a purely local developer setup procedure. Nothing in the repo needs to
change to support it — it works with the current codebase as-is.

## Troubleshooting quick reference

| Symptom | Cause | Fix |
|---|---|---|
| Dev-client can't reach `http://<IP>:8081` | Mac and iPhone on different Wi-Fi | Confirm both on ZTE U50 |
| "Could not connect to development server" | Metro not started, or wrong IP | Re-run `ipconfig getifaddr en0`, restart Metro |
| Old JS after a code change | Metro cache | Restart Metro with `-c` |
| `EXPO_PUBLIC_STRIPE_PK` empty at runtime | `mobile/apps/customer/.env` missing / not populated | Populate `.env` from `.env.example`, restart Metro |
| Native change (entitlements, Info.plist) doesn't take effect | Metro only reloads JS | Rebuild in Xcode (`Cmd+R`) |
