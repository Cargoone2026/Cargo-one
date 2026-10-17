# RCA — Serving /.well-known/apple-app-site-association (cargoone.co.uk)

**Mode:** READ-ONLY investigation. No deploy, no manifest change.
**Deployment:** cargo-repo-bridge • frontend_type = **cloudflare** • template fastapi_react_mongo_shadcn_base_image • active run e6a7b153-6ca9-42df-badf-f0db11cf0139.

## Problem statement
`GET https://cargoone.co.uk/.well-known/apple-app-site-association` must return **200, no redirect, Content-Type `application/json`**, exact body `{"webcredentials":{"apps":["76XPJG3C72.co.uk.cargoone.customer","76XPJG3C72.co.uk.cargoone.driver"]}}`, and must NOT fall through to `index.html`. Today it returns `200 text/html` (index.html) with no cache-control header.

---

## 1. How the frontend is served in production
This app is a **Cloudflare-frontend** deployment, NOT nginx/CDN-in-pod:

- `build-frontend-artifacts.sh` runs `craco build`, then `s5cmd sync . s3://$BUCKET/$DEPLOYMENT_NAME/$TAG/build/` — the CRA `build/` output is uploaded to **Cloudflare R2**.
- A **platform-managed Cloudflare Worker** serves static objects from that R2 prefix and proxies `/api/*` to the k8s backend. This worker is NOT in the deployment manifest set and is not readable/editable by the user or by me.
- The pod's `nginx.conf` only defines `location /api`, `location = /health`, and a local `location /` (`try_files $uri /index.html`). For a Cloudflare frontend the public domain does NOT go through pod-nginx for static paths — the edge worker does. (Dockerfile has both `final-build` and `final-download` stages; the R2/worker path is what serves cargoone.co.uk.)

**SPA fallback / dotfiles:** There is currently **no `frontend/public/.well-known/` directory** in the source (verified: `ls` of `frontend/public` shows only favicons, index.html, manifest.json, robots.txt, sitemap.xml). Because the AASA object does not exist in R2, the worker serves the SPA `index.html` fallback — that is the whole cause of the 200/text-html observation.

**Observed anomaly — possible interception of `/.well-known/*`:** The reporter's curls show three *distinct* header behaviors:
- real R2 file (`/robots.txt`, `/manifest.json`) → correct content-type + `cache-control: public,max-age=300`
- generic unknown path → `index.html` with `cache-control: no-cache`
- `/.well-known/apple-app-site-association` AND `/.well-known/x` → `index.html` with **NO cache-control header at all**

That third, distinct behavior for the `/.well-known/*` prefix strongly suggests the edge worker (or Cloudflare) has a **separate code path for `/.well-known/*`** rather than the ordinary SPA fallback. I could not confirm this — the worker is platform-side and unreadable. This is the single biggest risk to the "just add the file" fix (see §4): if `/.well-known/*` is unconditionally special-cased, an R2 object there may still not be served.

## 2. If I add `frontend/public/.well-known/apple-app-site-association` (no extension)
- **Will it be copied into the build?** Yes. CRA/react-scripts 5.0.1 `copyPublicFolder()` uses `fs-extra.copySync(appPublic, appBuild, { filter: f => f !== appHtml })` — it copies the ENTIRE `public/` tree including dot-directories and dotfiles; the ONLY exclusion is `index.html`. So `build/.well-known/apple-app-site-association` is produced. (Note: I could not run a live in-sandbox build to show this — `yarn install` OOM-killed the eph pod, exit 137 — so this is from documented react-scripts behavior + reading the pipeline, not an observed build artifact.)
- **Will it reach R2?** Yes. `s5cmd sync .` from `build/` uploads all files, including the dot-directory; s5cmd does not skip dotfiles.
- **What Content-Type?** Derived from the **file extension** (that's why `manifest.json`→`application/json`, `robots.txt`→`text/plain`). An **extensionless** file has no extension to map, so it will get a default/sniffed type (`application/octet-stream` or `text/plain`), **NOT `application/json`**. The exact URL must stay extensionless (Apple requires `/.well-known/apple-app-site-association` with no suffix), so you cannot fix content-type by renaming.
- **Per-path header config?** This is a custom Worker + R2 setup, **not** Cloudflare Pages, so a `_headers` / `_redirects` file is **not** honored here. There is no user-facing, source-level way to set a per-path Content-Type in this hosting model.

## 3. Can a non-`/api` path be routed to the backend (port 8001)?
**No.** Both at the edge worker and in pod-nginx, **only `/api/*` is proxied to FastAPI on 8001.** Every other path (including `/.well-known/apple-app-site-association`) is handled as a static/SPA request and never reaches the backend. So you cannot have FastAPI serve that exact extensionless, non-`/api` URL in this setup.

## 4. Recommended approach
Two layers:

**(a) Make the body/200/no-redirect correct (user-source, E1 + redeploy):**
Add `frontend/public/.well-known/apple-app-site-association` containing exactly:
`{"webcredentials":{"apps":["76XPJG3C72.co.uk.cargoone.customer","76XPJG3C72.co.uk.cargoone.driver"]}}`
It will be copied into `build/` and synced to R2, so the path should stop falling back to index.html and return the real JSON body with 200 and no redirect. **Verify after redeploy** — if `/.well-known/*` turns out to be special-cased at the edge (see §1 anomaly), it may still fall through, in which case it's a platform issue.
*Practical note:* Apple's AASA fetcher (iOS 9.3+) does NOT require `application/json`; a valid JSON body, 200, no redirect is accepted regardless of content-type. So this step alone very likely makes Universal Links / webcredentials work in practice.

**(b) To meet the STRICT `Content-Type: application/json` requirement (platform/Emergent support):**
That cannot be set from app source in this Cloudflare-worker + R2 model (content-type is extension-derived; no `_headers` support; non-`/api` paths aren't proxied to the backend). Meeting the literal `application/json` requirement at that extensionless URL needs an **edge/worker rule** (serve `/.well-known/apple-app-site-association` from R2 with an overridden `application/json` content-type, or route it to the backend) — an Emergent platform change. Also ask support to confirm/clear any existing `/.well-known/*` special-casing at the edge (the header anomaly in §1).

## Evidence
- `describe_deployment_state`: frontend_type=cloudflare, domains cargoone.co.uk + www verified.
- `config.yaml`, `build-frontend-artifacts.sh`, `Dockerfile.cloudbuild`, `nginx.conf`, `entrypoint.sh` read from the deployment manifest set.
- eph sandbox (run e6a7b153…): `frontend/public` has no `.well-known`; react-scripts 5.0.1 + craco confirmed in package.json; in-sandbox build not completed (yarn install OOM, exit 137) — copy behavior stated from documented react-scripts semantics, not an observed artifact.
