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

async function loadModule(rel) {
  const tmp = path.join(os.tmpdir(), `cargoone-${path.basename(rel, ".js")}-${process.pid}.mjs`);
  fs.copyFileSync(path.join(ROOT, rel), tmp);
  try {
    return await import(pathToFileURL(tmp).href);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

async function loadData() {
  const [seo, images] = await Promise.all([loadModule("src/data/seo.js"), loadModule("src/components/marketing/images.js")]);
  return { ...seo, IMG: images.IMG, CAT: images.CATEGORY_IMAGES };
}

function headTags({ url, title, description, jsonLd, image }) {
  const p = 'data-prerender=""';
  const img = image ? [`<meta ${p} property="og:image" content="${esc(image)}" />`, `<meta ${p} name="twitter:image" content="${esc(image)}" />`] : [];
  return [
    `<meta ${p} name="description" content="${esc(description)}" />`,
    `<link ${p} rel="canonical" href="${esc(url)}" />`,
    `<meta ${p} property="og:type" content="website" />`,
    `<meta ${p} property="og:site_name" content="Cargo One" />`,
    `<meta ${p} property="og:title" content="${esc(title)}" />`,
    `<meta ${p} property="og:description" content="${esc(description)}" />`,
    `<meta ${p} property="og:url" content="${esc(url)}" />`,
    ...img,
    `<meta ${p} name="twitter:card" content="summary_large_image" />`,
    `<meta ${p} name="twitter:title" content="${esc(title)}" />`,
    `<meta ${p} name="twitter:description" content="${esc(description)}" />`,
    `<script ${p} type="application/ld+json">${ldSafe(jsonLd)}</script>`,
  ].join("\n        ");
}

function bodyContent({ h1, description, intro, lists = [], faqs, cta = ["Get an instant quote", "/auth/register?role=customer"] }) {
  let html = `<main><h1>${esc(h1)}</h1><p>${esc(intro || description)}</p>`;
  const li = (i) => (Array.isArray(i) ? `<li><a href="${esc(i[1])}">${esc(i[0])}</a></li>` : `<li>${esc(i)}</li>`);
  for (const [title, items] of lists) html += `<h2>${esc(title)}</h2><ul>${items.map(li).join("")}</ul>`;
  if (faqs) {
    html += `<h2>FAQs</h2>${faqs.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join("")}`;
    html += `<p><a href="${esc(cta[1])}">${esc(cta[0])}</a> · <a href="/services">All services</a> · <a href="/drivers">Drive with CargoOne</a></p>`;
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
  const image = page.image && page.image.startsWith("/") ? `${data.SITE_URL}${page.image}` : page.image;
  html = html.replace("</head>", `        ${headTags({ url, title: page.title, description: page.description, jsonLd, image })}\n    </head>`);
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
  const { IMG, CAT } = data;
  const svcImg = (s) => s.heroImage || CAT[s.image] || IMG.heroServices;
  const pages = [
    ...data.MARKETING_ROUTES.map((r) => ({ ...r, image: IMG[r.img] })),
    ...data.SERVICE_PAGES.map((s) => ({
      ...data.serviceSeo(s), image: svcImg(s), intro: s.intro, faqs: s.faqs, jsonLd: data.serviceJsonLd(s), detail: true,
      lists: [["What we move", s.moves], ["Vehicles used", s.vehicles]],
    })),
    ...data.BOOKING_TYPES.map((b) => ({
      ...data.bookingTypeSeo(b), image: b.heroImage || IMG[b.image] || CAT[b.image] || IMG.heroSeoBoxes, intro: b.intro, faqs: b.faqs, jsonLd: data.bookingTypeJsonLd(b), detail: true,
      lists: [["Step by step", b.steps.map((st) => `${st.title}: ${st.body}`)], ["Who it's best for", b.bestFor],
        ...(b.vehiclesFrom ? [["Recovery vehicles", data.SERVICE_BY_SLUG[b.vehiclesFrom].vehicles]] : [])],
    })),
    ...data.DRIVER_TYPES.map((d) => {
      const seo = data.driverTypeSeo(d);
      return {
        ...seo, image: d.heroImage || IMG[d.image] || CAT[d.image] || IMG.heroDrivers, intro: d.intro, faqs: d.faqs, jsonLd: data.driverJsonLd(seo, d.faqs, []), detail: true, cta: ["Sign up to drive", data.DRIVER_SIGNUP_HREF],
        lists: [["Vehicles", d.vehicles], ["Who it suits", d.suits], ["How the work flows", data.DRIVER_WORK_FLOW.map((w) => `${w.title}: ${w.body}`)], ["What you need", data.DRIVER_DOCUMENTS], ["How payment works", data.DRIVER_PAY_STEPS]],
      };
    }),
    ...data.DRIVER_CITIES.map((c) => {
      const seo = data.driverCitySeo(c);
      const faqs = data.cityFaqs(c);
      return {
        ...seo, image: IMG.heroDrivers, faqs, jsonLd: data.driverJsonLd(seo, faqs, []), detail: true, cta: ["Sign up to drive", data.DRIVER_SIGNUP_HREF],
        lists: [["Busy areas", c.areas], ["Routes", c.routes], ["How the work flows", data.DRIVER_WORK_FLOW.map((w) => `${w.title}: ${w.body}`)], ["What you need", data.DRIVER_DOCUMENTS], ["How payment works", data.DRIVER_PAY_STEPS]],
      };
    }),
    { ...data.COURIERS_INDEX_SEO, image: IMG.heroSeoBoxes, lists: [["Cities", data.LOCAL_CITIES.map((c) => [`Couriers in ${c.name}`, `/couriers/${c.slug}`])]] },
    ...data.LOCAL_CITIES.map((c) => {
      const seo = data.cityHubSeo(c);
      const faqs = data.cityHubFaqs(c);
      return {
        ...seo, image: IMG.heroSeoBoxes, faqs, jsonLd: data.cityHubJsonLd(c, faqs), detail: true,
        lists: [["Services", data.SERVICE_PAGES.map((s) => [`${s.name} in ${c.name}`, `/services/${s.slug}/${c.slug}`])], ["Areas we cover", [...c.residential, ...c.business, ...c.industrial]], ["Getting around", [c.parking, ...(c.cleanAir ? [[c.cleanAir.text, c.cleanAir.url]] : [])]], ["Nearby big cities", data.cityRoutes(c).map((r) => [`Couriers in ${r.to.name} (via ${r.roads})`, `/couriers/${r.to.slug}`])]],
      };
    }),
    ...data.SERVICE_PAGES.flatMap((s) => data.LOCAL_CITIES.map((c) => {
      const seo = data.serviceCitySeo(s, c);
      const l = data.localService(s, c);
      return {
        ...seo, image: svcImg(s), intro: l.lead, faqs: l.faqs, jsonLd: data.serviceCityJsonLd(s, c, l.faqs), detail: true,
        lists: [["What we move", s.moves], ["Vehicles", s.vehicles], ["Areas covered", l.areas], ["Popular routes", l.routes.map((r) => [`${c.name} to ${r.to.name} via the ${r.roads}`, `/services/${s.slug}/${r.to.slug}`])], ["Getting around", [...l.access, ...(c.cleanAir ? [[c.cleanAir.text, c.cleanAir.url]] : [])]], [`More in ${c.name}`, [[`All services in ${c.name}`, `/couriers/${c.slug}`], [`${s.name} across the UK`, `/services/${s.slug}`], ...data.SERVICE_PAGES.filter((o) => o.slug !== s.slug).map((o) => [`${o.name} in ${c.name}`, `/services/${o.slug}/${c.slug}`])]]],
      };
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
