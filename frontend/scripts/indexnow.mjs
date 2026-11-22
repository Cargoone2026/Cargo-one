// Pings IndexNow with every sitemap URL. Runs only when INDEXNOW_ENABLED=true; never fails the build.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const KEY = "1fda6f9c376334708f6245e3a0266820";
const HOST = "cargoone.co.uk";
const ENDPOINT = "https://api.indexnow.org/indexnow";
const BATCH = 10000;
const dir = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  if (process.env.INDEXNOW_ENABLED !== "true") {
    console.log("[indexnow] skipped (INDEXNOW_ENABLED is not true)");
    return;
  }
  const xml = readFileSync(path.join(dir, "..", "build", "sitemap.xml"), "utf8");
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  const dry = process.env.INDEXNOW_DRY_RUN === "true";
  for (let i = 0; i < urls.length; i += BATCH) {
    const body = { host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList: urls.slice(i, i + BATCH) };
    if (dry) {
      console.log(`[indexnow] dry run: ${urls.length} URLs; first 5:`, JSON.stringify({ ...body, urlList: body.urlList.slice(0, 5) }, null, 2));
      return;
    }
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    console.log(`[indexnow] batch ${i / BATCH + 1}: ${body.urlList.length} URLs -> HTTP ${res.status}`);
  }
}

main()
  .catch((e) => console.log(`[indexnow] error (ignored): ${e?.message || e}`))
  .finally(() => process.exit(0));
