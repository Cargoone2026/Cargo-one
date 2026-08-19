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

`MAPBOX_DOWNLOADS_TOKEN` is a build-time SECRET (`sk.…` prefix). It must
only exist:
- in your local shell (`export MAPBOX_DOWNLOADS_TOKEN=…` before running
  `expo prebuild` or Xcode)
- as an EAS project secret (`eas secret:create`)
- in `~/.gradle/gradle.properties` on the Android build machine

It must NEVER appear in:
- `app.json` (uses the literal string `$MAPBOX_DOWNLOADS_TOKEN` — the
  Expo plugin substitutes at build time)
- source code, git history, GitHub secrets scanning logs
- backend responses
- screenshots / support tickets / chat
