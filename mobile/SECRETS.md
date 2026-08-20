## Secrets & environment (mobile)

Never commit these files:

```
mobile/apps/customer/.env
mobile/apps/driver/.env
mobile/apps/*/ios/**
mobile/apps/*/android/**
mobile/node_modules/**
mobile/**/node_modules/**
mobile/apps/*/.expo/**
```

`MAPBOX_DOWNLOADS_TOKEN` is a build-time SECRET (`sk.…` prefix, scope
`DOWNLOADS:READ`). It must only exist:
- in your local shell (`export MAPBOX_DOWNLOADS_TOKEN=…` before running
  `pod install` / `expo run:ios` — the alias line injected into the
  Podfile by `mobile/plugins/withCargoOneiOSFixes.js` forwards it to
  the `RNMAPBOX_MAPS_DOWNLOAD_TOKEN` variable that `@rnmapbox/maps`
  actually reads)
- as an EAS project secret (`eas secret:create`)
- in `~/.gradle/gradle.properties` on the Android build machine

Equivalent env var names — either works on iOS thanks to the alias:
- `MAPBOX_DOWNLOADS_TOKEN`         (Mapbox's canonical name; also used by Android)
- `RNMAPBOX_MAPS_DOWNLOAD_TOKEN`   (what `@rnmapbox/maps` reads directly)

It must NEVER appear in:
- `app.json` (previous versions used the deprecated
  `RNMapboxMapsDownloadToken` plugin option; that option baked the value
  into the Podfile and has been removed)
- `.env` files (those are for `EXPO_PUBLIC_*` runtime values only)
- source code, `~/.netrc` inside the repo, git history, GitHub secrets
  scanning logs
- backend responses
- screenshots / support tickets / chat
