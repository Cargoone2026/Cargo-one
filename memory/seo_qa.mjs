// SEO QA: runs prerender for a given source tree against a stub template; compares with a baseline tree.
// Usage: node seo_qa.mjs <newFrontendDir> <baselineFrontendDir>
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const [, , NEW, OLD] = process.argv;
const TPL = '<!doctype html><html><head><title>x</title><meta name="description" content="x"></head><body><div id="root"></div></body></html>';

function run(dir) {
  const tmp = fs.mkdtempSync("/tmp/seoqa-");
  for (const rel of ["scripts/prerender.mjs", "src/data/seo.js", "src/components/marketing/images.js"]) {
    fs.mkdirSync(path.join(tmp, path.dirname(rel)), { recursive: true });
    fs.copyFileSync(path.join(dir, rel), path.join(tmp, rel));
  }
  fs.mkdirSync(path.join(tmp, "build"));
  fs.writeFileSync(path.join(tmp, "build/index.html"), TPL);
  console.log(execSync(`node ${tmp}/scripts/prerender.mjs`).toString().trim());
  const pages = {};
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
    const f = path.join(d, e.name);
    if (e.isDirectory()) walk(f);
    else if (e.name === "index.html" && f !== path.join(tmp, "build/index.html")) pages["/" + path.relative(path.join(tmp, "build"), d)] = fs.readFileSync(f, "utf8");
  });
  walk(path.join(tmp, "build"));
  const sitemap = fs.readFileSync(path.join(tmp, "build/sitemap.xml"), "utf8");
  return { pages, sitemap, tmp };
}

const a = run(NEW);
const b = run(OLD);
const newPaths = Object.keys(a.pages).filter((p) => !(p in b.pages)).sort();
const changed = Object.keys(b.pages).filter((p) => a.pages[p] !== b.pages[p]);
const missing = Object.keys(b.pages).filter((p) => !(p in a.pages));
const get = (h, re) => (h.match(re) || [])[1];
const seen = { title: {}, h1: {}, desc: {} };
const problems = [];
for (const [p, h] of Object.entries(a.pages)) {
  const vals = { title: get(h, /<title>([\s\S]*?)<\/title>/), h1: get(h, /<h1>([\s\S]*?)<\/h1>/), desc: get(h, /name="description" content="([^"]*)"/) };
  for (const k of Object.keys(vals)) (seen[k][vals[k]] ||= []).push(p);
  if (newPaths.includes(p)) {
    if (get(h, /rel="canonical" href="([^"]*)"/) !== `https://cargoone.co.uk${p}`) problems.push(`canonical ${p}`);
    if (/noindex/i.test(h)) problems.push(`noindex ${p}`);
  }
}
for (const k of Object.keys(seen)) for (const [v, ps] of Object.entries(seen[k])) if (ps.length > 1) problems.push(`dup ${k} "${v}" -> ${ps.join(", ")}`);
// Internal links on new pages must resolve to a prerendered page or a known SPA route.
const known = new Set([...Object.keys(a.pages), "/", "/services", "/couriers", "/drivers", "/auth/register"]);
for (const p of newPaths) for (const [, href] of a.pages[p].matchAll(/href="(\/[^"]*)"/g)) {
  const clean = href.split("?")[0].replace(/\/$/, "") || "/";
  if (!known.has(clean)) problems.push(`broken link ${p} -> ${href}`);
}
const smCount = (a.sitemap.match(/<loc>/g) || []).length;
const smOld = (b.sitemap.match(/<loc>/g) || []).length;
const smMissing = [...b.sitemap.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]).filter((u) => !a.sitemap.includes(`<loc>${u}</loc>`));
const smNewMissing = newPaths.filter((p) => !a.sitemap.includes(`<loc>https://cargoone.co.uk${p}</loc>`));
console.log(JSON.stringify({ newCount: newPaths.length, changedExisting: changed, missingExisting: missing, sitemapOld: smOld, sitemapNew: smCount, sitemapDroppedOld: smMissing, sitemapMissingNew: smNewMissing, problems, newPaths }, null, 1));
