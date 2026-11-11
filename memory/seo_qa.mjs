// SEO QA: runs prerender for a given source tree against a stub template; compares with a baseline tree.
// Usage: node seo_qa.mjs <newFrontendDir> <baselineFrontendDir>
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const [, , NEW, OLD] = process.argv;
const TPL = '<!doctype html><html><head><title>x</title><meta name="description" content="x"></head><body><div id="root"></div></body></html>';

function run(dir) {
  const tmp = fs.mkdtempSync("/tmp/seoqa-");
  for (const rel of ["scripts/prerender.mjs", "src/data/seo.js", "src/components/marketing/images.js", "src/data/directory.js"]) {
    if (!fs.existsSync(path.join(dir, rel))) continue;
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
const wordCounts = {};
for (const [p, h] of Object.entries(a.pages)) {
  const vals = { title: get(h, /<title>([\s\S]*?)<\/title>/), h1: get(h, /<h1>([\s\S]*?)<\/h1>/), desc: get(h, /name="description" content="([^"]*)"/) };
  for (const k of Object.keys(vals)) (seen[k][vals[k]] ||= []).push(p);
  if (newPaths.includes(p)) {
    if (get(h, /rel="canonical" href="([^"]*)"/) !== `https://cargoone.co.uk${p}`) problems.push(`canonical ${p}`);
    if (/noindex/i.test(h)) problems.push(`noindex ${p}`);
    const t = vals.title.replace(/&amp;/g, "&");
    const d = vals.desc.replace(/&amp;/g, "&").replace(/&quot;/g, '"');
    if (t.length > 60) problems.push(`title>60 (${t.length}) ${p}: ${t}`);
    if (d.length > 155) problems.push(`desc>155 (${d.length}) ${p}`);
    if ((h.match(/<h1>/g) || []).length !== 1) problems.push(`h1 count ${p}`);
    if (/£/.test(h)) problems.push(`£ found ${p}`);
    const ld = [...h.matchAll(/application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1])).flat();
    const faq = ld.find((x) => x["@type"] === "FAQPage");
    if (!faq || faq.mainEntity.length < 3) problems.push(`faq<3 ${p}`);
    if (!ld.find((x) => x["@type"] === "BreadcrumbList")) problems.push(`no breadcrumb ${p}`);
    if (p.startsWith("/guides/")) {
      if (!ld.find((x) => x["@type"] === "Article")) problems.push(`no article ${p}`);
      const words = h.split("<main>")[1].replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
      wordCounts[p] = words;
      if (words < 900 || words > 1400) problems.push(`words ${words} ${p}`);
    }
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
console.log(JSON.stringify({ newCount: newPaths.length, changedExisting: changed, missingExisting: missing, sitemapOld: smOld, sitemapNew: smCount, sitemapDroppedOld: smMissing, sitemapMissingNew: smNewMissing, problems, wordCounts, newPaths }, null, 1));
