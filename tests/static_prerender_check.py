# Static checks of the production build prerender output (served at localhost:5055)
import json, re, sys, urllib.request
import xml.etree.ElementTree as ET

B = "http://localhost:5055"
fails = []

def get(p):
    return urllib.request.urlopen(B + p).read().decode()

def check(cond, msg):
    print(("PASS " if cond else "FAIL ") + msg)
    if not cond:
        fails.append(msg)

for p in ["/services/man-and-van.html", "/services/man-and-van/index.html"]:
    h = get(p)
    head = h.split("</head>")[0]
    check("<title>Man and Van – Instant Quote | Cargo One</title>" in h, f"{p} title")
    check(len(re.findall(r'<meta[^>]*name="description"', h)) == 1, f"{p} one meta description")
    canon = re.findall(r'<link[^>]*rel="canonical"[^>]*href="([^"]+)"', h)
    check(canon == ["https://cargoone.co.uk/services/man-and-van"], f"{p} canonical {canon}")
    for og in ["og:title", "og:description", "og:url"]:
        check(len(re.findall(rf'property="{og}"', head)) == 1, f"{p} {og}")
    lds = re.findall(r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>', h, re.S)
    check(len(lds) == 1, f"{p} one ld+json ({len(lds)})")
    data = json.loads(lds[0])
    types = [d["@type"] for d in data]
    check(types == ["Organization", "Service", "FAQPage", "BreadcrumbList"], f"{p} ld types {types}")
    check(len(data[2]["mainEntity"]) == 5, f"{p} FAQ 5")
    check(len(data[3]["itemListElement"]) == 3, f"{p} breadcrumb 3")
    root = h.split('<div id="root">')[1]
    check("<h1>" in root, f"{p} root h1")
    check("Will the driver help with loading?" in root, f"{p} root FAQ text")
    check("<title>" in head and head.count("<title>") == 1, f"{p} single title")

idx = get("/index.html")
check("data-prerender" not in idx, "index.html has no data-prerender")
check('<div id="root"></div>' in idx, "index.html empty root (SPA fallback)")

# all prerendered routes exist both forms
from_routes = ["how-it-works","services","business","drivers","faq","contact","trust-safety","about","terms","privacy","cookies"]
svc = ["man-and-van","furniture-delivery","same-day-courier","house-removals","car-transport","vehicle-recovery","motorbike-transport","pallet-delivery","marketplace-collection","parcel-delivery","boat-transport","machinery-haulage"]
for r in from_routes + [f"services/{s}" for s in svc]:
    for f in [f"/{r}.html", f"/{r}/index.html"]:
        try:
            h = get(f)
            ok = h.count('type="application/ld+json"') == 1 and h.count('rel="canonical"') == 1 and f'href="https://cargoone.co.uk/{r}"' in h
            check(ok, f"{f} prerendered ok")
        except Exception as e:
            check(False, f"{f} {e}")

sm = get("/sitemap.xml")
root = ET.fromstring(sm)
ns = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
locs = [l.text for l in root.findall("s:url/s:loc", ns)]
check(len(locs) == 24, f"sitemap 24 locs ({len(locs)})")
check("https://cargoone.co.uk/" in locs, "sitemap has /")
check(all(f"https://cargoone.co.uk/services/{s}" in locs for s in svc), "sitemap 12 services")
check(all(not l.endswith("/") for l in locs if l != "https://cargoone.co.uk/"), "no trailing slashes")
check(len(set(locs)) == len(locs), "no duplicate locs")
llms = get("/llms.txt")
check(llms.startswith("# Cargo One"), "llms.txt served")
print("FAILS:", fails)
