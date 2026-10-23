// Postbuild: writes static HTML (head tags + basic content) for public marketing routes and sitemap.xml.
// Fail-safe: any error only logs a warning; the normal SPA build is left untouched.
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BUILD = path.join(ROOT, "build");

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const ldSafe = (o) => JSON.stringify(o).replace(/</g, "\\u003c");

async function loadData() {
  const tmp = path.join(os.tmpdir(), `cargoone-seo-${process.pid}.mjs`);
  fs.copyFileSync(path.join(ROOT, "src/data/seo.js"), tmp);
  try {
    return await import(pathToFileURL(tmp).href);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

function headTags({ url, title, description, jsonLd }) {
  const p = 'data-prerender=""';
  return [
    `<meta ${p} name="description" content="${esc(description)}" />`,
    `<link ${p} rel="canonical" href="${esc(url)}" />`,
    `<meta ${p} property="og:type" content="website" />`,
    `<meta ${p} property="og:site_name" content="Cargo One" />`,
    `<meta ${p} property="og:title" content="${esc(title)}" />`,
    `<meta ${p} property="og:description" content="${esc(description)}" />`,
    `<meta ${p} property="og:url" content="${esc(url)}" />`,
    `<meta ${p} name="twitter:card" content="summary_large_image" />`,
    `<meta ${p} name="twitter:title" content="${esc(title)}" />`,
    `<meta ${p} name="twitter:description" content="${esc(description)}" />`,
    `<script ${p} type="application/ld+json">${ldSafe(jsonLd)}</script>`,
  ].join("\n        ");
}

function bodyContent({ h1, description, intro, lists = [], faqs }) {
  let html = `<main><h1>${esc(h1)}</h1><p>${esc(intro || description)}</p>`;
  for (const [title, items] of lists) html += `<h2>${esc(title)}</h2><ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
  if (faqs) {
    html += `<h2>FAQs</h2>${faqs.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join("")}`;
    html += `<p><a href="/auth/register?role=customer">Get an instant quote</a> · <a href="/services">All services</a> · <a href="/drivers">Drive with CargoOne</a></p>`;
  }
  return `${html}</main>`;
}

function renderPage(template, page, data) {
  const url = `${data.SITE_URL}${page.path}`;
  const jsonLd = [data.ORGANIZATION_JSONLD, ...(page.jsonLd || [])];
  let html = template
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(page.title)}</title>`)
    .replace(/<meta\s+name="description"[^>]*>/, "");
  if (!html.includes('<div id="root"></div>') || !html.includes("</head>")) throw new Error("index.html shape not recognised");
  html = html.replace("</head>", `        ${headTags({ url, title: page.title, description: page.description, jsonLd })}\n    </head>`);
  return html.replace('<div id="root"></div>', `<div id="root">${bodyContent(page)}</div>`);
}

function sitemap(data, pages) {
  const urls = [{ path: "/", priority: "1.0", changefreq: "weekly" }, ...pages.map((p) => ({ path: p.path, priority: p.detail ? "0.8" : "0.7", changefreq: "monthly" }))];
  const body = urls.map((u) => `  <url>\n    <loc>${data.SITE_URL}${u.path}</loc>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

async function main() {
  const template = fs.readFileSync(path.join(BUILD, "index.html"), "utf8");
  const data = await loadData();
  const pages = [
    ...data.MARKETING_ROUTES,
    ...data.SERVICE_PAGES.map((s) => ({
      ...data.serviceSeo(s), intro: s.intro, faqs: s.faqs, jsonLd: data.serviceJsonLd(s), detail: true,
      lists: [["What we move", s.moves], ["Vehicles used", s.vehicles]],
    })),
    ...data.BOOKING_TYPES.map((b) => ({
      ...data.bookingTypeSeo(b), intro: b.intro, faqs: b.faqs, jsonLd: data.bookingTypeJsonLd(b), detail: true,
      lists: [["Step by step", b.steps.map((st) => `${st.title}: ${st.body}`)], ["Who it's best for", b.bestFor],
        ...(b.vehiclesFrom ? [["Recovery vehicles", data.SERVICE_BY_SLUG[b.vehiclesFrom].vehicles]] : [])],
    })),
  ];
  // Render everything in memory first so a failure never leaves a half-written build.
  const files = [];
  for (const page of pages) {
    const html = renderPage(template, page, data);
    const rel = page.path.replace(/^\//, "");
    files.push([`${rel}.html`, html], [path.join(rel, "index.html"), html]);
  }
  files.push(["sitemap.xml", sitemap(data, pages)]);
  for (const [rel, content] of files) {
    const out = path.join(BUILD, rel);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, content);
  }
  console.log(`[prerender] wrote ${pages.length} marketing pages (+ sitemap.xml)`);
}

main().catch((err) => {
  console.warn(`[prerender] WARNING: skipped, normal SPA build kept. ${err && err.stack ? err.stack : err}`);
  process.exit(0);
});
