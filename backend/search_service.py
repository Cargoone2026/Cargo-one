"""Cargo One — cross-portal search & driver dashboard helpers.

Kept separate from server.py so the search / aggregation logic can grow
without further bloating the main app module.
"""
from __future__ import annotations

from typing import Any, Optional


# ---------------------------------------------------------------------------
# Static marketing / info result set. Used by the global search modal so
# users on the marketing site (or logged-in users) can quickly jump to any
# section — even before we have live data-driven records to search.
# ---------------------------------------------------------------------------
MARKETING_ROUTES: list[dict[str, Any]] = [
    {"kind": "page", "title": "How It Works",       "subtitle": "3-step guide from post to proof of delivery", "href": "/how-it-works",  "keywords": ["guide", "steps", "process", "how", "post job", "quote", "delivery"]},
    {"kind": "page", "title": "Services",           "subtitle": "Everything Cargo One moves — all categories",  "href": "/services",       "keywords": ["services", "categories", "what we move", "movers"]},
    {"kind": "page", "title": "Business Accounts",  "subtitle": "SLAs, invoicing, multi-user, API access",       "href": "/business",       "keywords": ["business", "b2b", "invoicing", "corporate", "enterprise", "api"]},
    {"kind": "page", "title": "Become a Driver",    "subtitle": "Earn on your schedule — apply as a driver",     "href": "/drivers",        "keywords": ["driver", "earn", "work", "become", "sign up", "carrier", "join"]},
    {"kind": "page", "title": "Trust & Safety",     "subtitle": "Vetting, insurance, disputes and safety",        "href": "/trust-safety",   "keywords": ["safety", "trust", "insurance", "vetting", "checks", "disputes"]},
    {"kind": "page", "title": "FAQ",                "subtitle": "Answers to common questions",                    "href": "/faq",            "keywords": ["faq", "help", "questions", "answers", "support"]},
    {"kind": "page", "title": "Contact Us",         "subtitle": "Talk to our support team",                       "href": "/contact",        "keywords": ["contact", "email", "help", "support", "phone"]},
    {"kind": "page", "title": "About Cargo One",    "subtitle": "Our story, mission and team",                    "href": "/about",          "keywords": ["about", "story", "mission", "team", "company"]},
    {"kind": "page", "title": "Get a Quote",        "subtitle": "Post a job in under 60 seconds",                 "href": "/(auth)/register?role=customer", "keywords": ["quote", "price", "book", "post", "sign up", "customer"]},
]


def _matches(query: str, *fields: Optional[str]) -> bool:
    q = (query or "").strip().lower()
    if not q:
        return False
    for f in fields:
        if f and q in str(f).lower():
            return True
    return False


def _match_keywords(query: str, keywords: list[str]) -> bool:
    q = (query or "").strip().lower()
    if not q:
        return False
    return any(q in k.lower() or k.lower() in q for k in keywords)


def score_marketing_route(query: str, page: dict) -> int:
    q = (query or "").strip().lower()
    if not q:
        return 0
    score = 0
    if q == page["title"].lower():
        score += 100
    if q in page["title"].lower():
        score += 40
    if q in page["subtitle"].lower():
        score += 20
    if _match_keywords(q, page.get("keywords", [])):
        score += 30
    return score


def score_category(query: str, cat: dict) -> int:
    q = (query or "").strip().lower()
    score = 0
    if not q:
        return 0
    name = (cat.get("name") or "").lower()
    key = (cat.get("key") or "").lower()
    desc = (cat.get("description") or "").lower()
    if q == name or q == key:
        score += 100
    if q in name:
        score += 40
    if q in key:
        score += 25
    if q in desc:
        score += 15
    return score


def score_vehicle(query: str, veh: dict) -> int:
    q = (query or "").strip().lower()
    score = 0
    if not q:
        return 0
    name = (veh.get("name") or "").lower()
    key = (veh.get("key") or "").lower()
    desc = (veh.get("description") or "").lower()
    if q == name or q == key:
        score += 100
    if q in name:
        score += 40
    if q in key:
        score += 25
    if q in desc:
        score += 15
    for feat in (veh.get("features") or []):
        if q in feat.lower():
            score += 10
    return score


def score_capability(query: str, cap: dict) -> int:
    q = (query or "").strip().lower()
    score = 0
    if not q:
        return 0
    name = (cap.get("name") or "").lower()
    key = (cap.get("key") or "").lower()
    desc = (cap.get("description") or "").lower()
    if q == name or q == key:
        score += 100
    if q in name:
        score += 35
    if q in key:
        score += 20
    if q in desc:
        score += 10
    return score


def build_marketing_results(query: str, limit: int = 5) -> list[dict]:
    if not query:
        # No query — return a few defaults so the modal is useful when empty.
        return [
            {"kind": "page", "title": p["title"], "subtitle": p["subtitle"], "href": p["href"]}
            for p in MARKETING_ROUTES[:limit]
        ]
    scored = [(score_marketing_route(query, p), p) for p in MARKETING_ROUTES]
    scored = [(s, p) for s, p in scored if s > 0]
    scored.sort(key=lambda t: -t[0])
    return [
        {"kind": "page", "title": p["title"], "subtitle": p["subtitle"], "href": p["href"]}
        for _, p in scored[:limit]
    ]


def build_category_results(query: str, categories: list[dict], limit: int = 6) -> list[dict]:
    scored = [(score_category(query, c), c) for c in categories]
    scored = [(s, c) for s, c in scored if s > 0]
    scored.sort(key=lambda t: -t[0])
    out = []
    for _, c in scored[:limit]:
        out.append({
            "kind": "category",
            "key": c.get("key"),
            "title": c.get("name"),
            "subtitle": (c.get("description") or "")[:120],
            "icon": c.get("icon"),
            "href": f"/services#{c.get('key')}",
        })
    return out


def build_vehicle_results(query: str, vehicles: list[dict], limit: int = 6) -> list[dict]:
    scored = [(score_vehicle(query, v), v) for v in vehicles]
    scored = [(s, v) for s, v in scored if s > 0]
    scored.sort(key=lambda t: -t[0])
    out = []
    for _, v in scored[:limit]:
        max_w = v.get("max_weight_kg") or 0
        capacity_str = f"Up to {int(max_w)}kg" if max_w else "Custom capacity"
        out.append({
            "kind": "vehicle",
            "key": v.get("key"),
            "title": v.get("name"),
            "subtitle": capacity_str,
            "icon": v.get("icon"),
            "href": f"/services#vehicle-{v.get('key')}",
        })
    return out


def build_capability_results(query: str, capabilities: list[dict], limit: int = 4) -> list[dict]:
    scored = [(score_capability(query, c), c) for c in capabilities]
    scored = [(s, c) for s, c in scored if s > 0]
    scored.sort(key=lambda t: -t[0])
    out = []
    for _, c in scored[:limit]:
        out.append({
            "kind": "capability",
            "key": c.get("key"),
            "title": c.get("name"),
            "subtitle": (c.get("description") or "")[:120],
            "icon": c.get("icon"),
            "href": f"/services#capability-{c.get('key')}",
        })
    return out
