# r75: static build checks for Local SEO Wave 1 (couriers hubs + service x city)
import json, re, sys, urllib.request

BASE = "http://localhost:5058"
CITIES = ["london","birmingham","manchester","leeds","glasgow","liverpool","newcastle","sheffield","bristol","nottingham"]
SERVICES = ["man-and-van","furniture-delivery","same-day-courier","house-removals","car-transport","vehicle-recovery",
            "motorbike-transport","pallet-delivery","marketplace-collection","parcel-delivery","boat-transport","machinery-haulage"]
BANNED = [r"£", r"\brating", r"\breviews?\b", r"\bstars?\b", r"\bminutes\b", r"\bwithin \d", r"\bjobs completed", r"\d+\s*jobs\b", r"\barrive"]

fails = []
def get(p):
    return urllib.request.urlopen(BASE + p).read().decode()

def check(path, files, kind, city):
    html = None
    for f in files:
        try:
            html = get(f); break
        except Exception:
            continue
    if html is None:
        fails.append(f"{path}: no static file"); return None
    head = html.split("</head>")[0]
    t = re.findall(r"<title[^>]*>(.*?)</title>", head)
    d = re.findall(r'<meta[^>]+name="description"', head)
    can = re.findall(r'<link[^>]+rel="canonical"[^>]+href="([^"]+)"', head) or re.findall(r'<link[^>]+href="([^"]+)"[^>]+rel="canonical"', head)
    lds = re.findall(r'<script[^>]+application/ld\+json[^>]*>(.*?)</script>', html, re.S)
    if len(t) != 1: fails.append(f"{path}: titles={len(t)}")
    if len(d) != 1: fails.append(f"{path}: descriptions={len(d)}")
    if can != [f"https://cargoone.co.uk{path}"]: fails.append(f"{path}: canonical={can}")
    if len(lds) != 1:
        fails.append(f"{path}: ld+json count={len(lds)}")
    else:
        data = json.loads(lds[0])
        types = [x.get("@type") for x in data]
        if types != ["Organization","FAQPage","BreadcrumbList"]: fails.append(f"{path}: ld types {types}")
        faq = [x for x in data if x.get("@type")=="FAQPage"]
        bc = [x for x in data if x.get("@type")=="BreadcrumbList"]
        if faq and len(faq[0]["mainEntity"]) != 5: fails.append(f"{path}: faq n={len(faq[0]['mainEntity'])}")
        want = 3 if kind == "hub" else 4
        if bc and len(bc[0]["itemListElement"]) != want: fails.append(f"{path}: bc n={len(bc[0]['itemListElement'])}")
        if bc:
            for it in bc[0]["itemListElement"]:
                u = it.get("item","")
                if u.endswith("/") and u != "https://cargoone.co.uk/": fails.append(f"{path}: bc trailing slash {u}")
    main = re.search(r"<main[^>]*>(.*)</main>", html, re.S)
    if not main: fails.append(f"{path}: no <main>")
    else:
        h1 = re.findall(r"<h1", main.group(1))
        if len(h1) != 1: fails.append(f"{path}: h1 count in main={len(h1)}")
        text = re.sub(r"<[^>]+>", " ", main.group(1))
        for b in BANNED:
            m = re.search(b, text, re.I)
            if m: fails.append(f"{path}: banned '{m.group(0)}' ...{text[max(0,m.start()-60):m.end()+40]}...")
        if city == "manchester" and re.search(r"clean air zone", text, re.I): fails.append(f"{path}: Manchester mentions Clean Air Zone")
        if city in ("manchester","leeds","liverpool","nottingham") and 'data-testid="local-clean-air"' in html: fails.append(f"{path}: clean-air box present")
        if city not in ("manchester","leeds","liverpool","nottingham") and 'data-testid="local-clean-air"' not in html: fails.append(f"{path}: clean-air box missing")
        return text
    return None

leads = {}
check("/couriers", ["/couriers.html","/couriers/index.html"], "index", None)
for c in CITIES:
    check(f"/couriers/{c}", [f"/couriers/{c}.html", f"/couriers/{c}/index.html"], "hub", c)
    for s in SERVICES:
        txt = check(f"/services/{s}/{c}", [f"/services/{s}/{c}.html", f"/services/{s}/{c}/index.html"], "sc", c)
# check both variants exist for vehicle-recovery/birmingham
for f in ["/couriers/london.html","/services/man-and-van/manchester.html","/services/vehicle-recovery/birmingham/index.html"]:
    try: get(f); print("OK file", f)
    except Exception as e: fails.append(f"missing {f}: {e}")

print("FAILS:", len(fails))
for f in fails[:80]: print(" -", f)
