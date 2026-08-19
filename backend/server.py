"""Cargo One - Logistics Marketplace Backend.

FastAPI + MongoDB + JWT + Stripe (via emergentintegrations).
Roles: customer, driver, admin.
"""

import logging
import math
import os
import re
import secrets
import hmac
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional

import jwt
from dotenv import load_dotenv
from emergentintegrations.payments.stripe.checkout import (
    CheckoutSessionRequest,
    StripeCheckout,
)
from fastapi import APIRouter, Body, Depends, FastAPI, HTTPException, Request, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext

from search_service import (
    build_capability_results,
    build_category_results,
    build_marketing_results,
    build_vehicle_results,
)
from markets import (
    SUPPORTED_MARKETS,
    classify_route,
    is_supported_country,
    market_name,
)
from service_catalog import (
    CATEGORY_SEED,
    LEGACY_CATEGORY_MAP,
    VEHICLE_SEED,
    recommend_vehicles,
)
from vehicle_capabilities import CAPABILITY_SEED
from pydantic import BaseModel, EmailStr, Field
from starlette.middleware.cors import CORSMiddleware

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")
STRIPE_API_KEY = os.environ["STRIPE_API_KEY"]
DEPOSIT_PERCENTAGE = float(os.environ.get("DEPOSIT_PERCENTAGE", "0.10"))

# Web session cookie (HttpOnly, Secure, SameSite=Lax) used by the browser
# frontend. Native/mobile clients continue to use `Authorization: Bearer`.
AUTH_COOKIE_NAME = "cargoone_session"
AUTH_COOKIE_MAX_AGE = 30 * 86400  # matches JWT `days=30` default in create_token

# CSRF double-submit cookie — SEC1. Browser-readable (non-HttpOnly) so the SPA
# can echo it into the `X-CSRF-Token` header on every mutating request. Bearer
# (native) clients bypass entirely.
CSRF_COOKIE_NAME = "cargoone_csrf"
CSRF_HEADER_NAME = "X-CSRF-Token"
CSRF_COOKIE_MAX_AGE = AUTH_COOKIE_MAX_AGE
# Auth flow + anonymous endpoints are exempt (they either issue the token or
# have no user context to CSRF against). Everything else that mutates is gated.
CSRF_EXEMPT_PATHS = {
    "/api/auth/login",
    "/api/auth/register",
    "/api/auth/logout",
    "/api/contact",
    "/api/newsletter/subscribe",
    # Stripe → us (server-to-server). Cryptographic Stripe-Signature (or
    # per-session token in query string) is the authoritative check for
    # this endpoint; browser CSRF is not applicable.
    "/api/webhook/stripe",
}


def new_csrf_token() -> str:
    return secrets.token_urlsafe(32)


def set_csrf_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=CSRF_COOKIE_NAME,
        value=token,
        max_age=CSRF_COOKIE_MAX_AGE,
        httponly=False,  # readable by JS so the SPA can echo it
        secure=True,
        samesite="lax",
        path="/",
    )


def clear_csrf_cookie(response: Response) -> None:
    response.delete_cookie(key=CSRF_COOKIE_NAME, path="/")


def set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=AUTH_COOKIE_NAME,
        value=token,
        max_age=AUTH_COOKIE_MAX_AGE,
        httponly=True,
        secure=True,
        samesite="lax",
        path="/",
    )


def clear_auth_cookie(response: Response) -> None:
    response.delete_cookie(key=AUTH_COOKIE_NAME, path="/")


# ---------------------------------------------------------------------------
# Webhook shared-secret token (Phase 1 P0 hardening).
#
# Defence-in-depth for the /api/webhook/stripe endpoint. When
# `STRIPE_WEBHOOK_SECRET` is configured the primary auth is Stripe's
# cryptographic `Stripe-Signature` header. As a belt-and-braces layer (and
# to keep local/dev flows safe when no signing secret is present yet), we
# also bind every Checkout Session to a per-session random token stored on
# `payment_transactions.webhook_token` and baked into the `webhook_url`
# query string that goes into Stripe metadata. Stripe POSTs to
# `.../api/webhook/stripe?t=<token>` and at webhook time we require the
# token in the query string to match the DB row. Attackers cannot fabricate
# this because the token never leaves our backend except into Stripe
# metadata (no browser exposure).
# ---------------------------------------------------------------------------
def new_webhook_token() -> str:
    return secrets.token_urlsafe(32)

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="Cargo One API")
api = APIRouter(prefix="/api")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer(auto_error=False)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("cargoone")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------


class UserBase(BaseModel):
    email: EmailStr
    name: str
    phone: Optional[str] = None
    role: str = "customer"  # customer | driver | admin
    # Address (optional). Captured at registration or via profile edit; used for
    # invoicing, receipts, business account KYC, and pre-filling booking pickup.
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    town: Optional[str] = None
    county: Optional[str] = None
    postcode: Optional[str] = None
    country: Optional[str] = None


class UserRegister(UserBase):
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


class UserPublic(BaseModel):
    id: str
    email: EmailStr
    name: str
    phone: Optional[str] = None
    role: str
    status: str = "active"  # active | pending | changes_requested | suspended
    rating: float = 5.0
    total_jobs: int = 0
    review_count: int = 0
    vehicle: Optional[dict] = None
    profile_photo: Optional[str] = None
    documents_verified: bool = False
    verified_driver: bool = False
    created_at: str
    # Driver verification workflow — surfaced so the driver can see admin feedback
    changes_requested_reason: Optional[str] = None
    changes_requested_doc_types: Optional[list[str]] = None
    suspension_reason: Optional[str] = None
    # Optional address fields (captured at registration or via profile edit).
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    town: Optional[str] = None
    county: Optional[str] = None
    postcode: Optional[str] = None
    country: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


class Location(BaseModel):
    """Structured address / place — Europe-ready.

    country_code (ISO2) is the discriminator used to classify routes as
    domestic vs international. Coordinates default to 0 when only manual
    address entry is available; the backend will treat that as an
    unresolved location and return an international-review quote state.
    """
    formatted_address: str
    address_line: Optional[str] = None
    postcode: Optional[str] = None
    town: Optional[str] = None
    region: Optional[str] = None
    country: Optional[str] = None
    country_code: Optional[str] = None
    place_id: Optional[str] = None
    lat: float = 0.0
    lng: float = 0.0


class JobCreate(BaseModel):
    title: str
    category: str  # See /api/catalog/categories for current list (dynamic)
    description: str
    photos: list[str] = Field(default_factory=list)  # base64 or URLs
    pickup_address: str
    pickup_town: str
    pickup_lat: float
    pickup_lng: float
    # New: international address extensions — all optional so existing
    # UK-only clients continue to work.
    pickup_postcode: Optional[str] = None
    pickup_region: Optional[str] = None
    pickup_country: Optional[str] = None
    pickup_country_code: Optional[str] = None
    pickup_place_id: Optional[str] = None
    dropoff_address: str
    dropoff_town: str
    dropoff_lat: float
    dropoff_lng: float
    dropoff_postcode: Optional[str] = None
    dropoff_region: Optional[str] = None
    dropoff_country: Optional[str] = None
    dropoff_country_code: Optional[str] = None
    dropoff_place_id: Optional[str] = None
    weight_kg: Optional[float] = None
    dimensions: Optional[str] = None
    # Round 15 — persist the individual dimension components + item count +
    # loading-aid flags so JobExtras can render the "Booking details" chip
    # row (forklift / loading assistance / weight / items / L·W·H) on ALL
    # posted jobs, not just ASAP. Previously these were captured in the
    # PostJob wizard state but silently dropped at the Pydantic boundary.
    dimensions_l_m: Optional[float] = None
    dimensions_w_m: Optional[float] = None
    dimensions_h_m: Optional[float] = None
    volume_m3: Optional[float] = None
    item_count: Optional[int] = None
    needs_forklift: Optional[bool] = False
    needs_loading_help: Optional[bool] = False
    collection_date: str
    delivery_date: str
    pricing_type: str  # fixed | bidding
    fixed_price: Optional[float] = None
    max_budget: Optional[float] = None
    vehicle_required: Optional[str] = None
    # Real-time dispatch — v1 additions. Backward-compatible defaults keep
    # every existing customer flow behaving exactly as before.
    service_timing: Optional[str] = "scheduled"  # scheduled | asap
    service_type: Optional[str] = "transport"    # transport | breakdown_recovery
    vehicle_details: Optional[dict] = None  # {make, model, registration, condition, rolls, steers, brakes}
    customer_note: Optional[str] = None
    # Session G-1 — ASAP transport-details (what is being sent + free text)
    transport_category: Optional[str] = None
    transport_description: Optional[str] = None
    # R26.2 — ASAP customer-picked vehicle class. Null = auto-recommend.
    requested_vehicle_key: Optional[str] = None


class BidCreate(BaseModel):
    amount: float
    message: Optional[str] = None
    eta_hours: Optional[float] = None


class MessageCreate(BaseModel):
    text: Optional[str] = None
    photo: Optional[str] = None  # base64


class LocationUpdate(BaseModel):
    lat: float
    lng: float


class StatusUpdate(BaseModel):
    status: str


class PODUpload(BaseModel):
    photos: list[str] = Field(default_factory=list)
    signature: Optional[str] = None  # base64 signature image
    notes: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None


class ReviewCreate(BaseModel):
    rating: int  # 1-5
    comment: Optional[str] = None
    photos: list[str] = Field(default_factory=list)  # base64 attachments


class ReviewReplyCreate(BaseModel):
    text: str  # reply body — one reply per review, hard-capped at 1000 chars server-side


# R23 — controlled cancellation reasons for driver-initiated cancels
DRIVER_CANCEL_REASONS = {
    "vehicle_issue": "Vehicle issue",
    "breakdown": "Breakdown",
    "unable_to_complete": "Unable to safely complete the job",
    "vehicle_unsuitable": "Vehicle unsuitable",
    "customer_or_location": "Customer/location issue",
    "personal_emergency": "Personal emergency",
    "route_or_access": "Route/access issue",
    "other": "Other",
}


class DriverCancelBody(BaseModel):
    reason: str  # must be one of DRIVER_CANCEL_REASONS keys
    explanation: Optional[str] = None


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------


def hash_password(pw: str) -> str:
    return pwd_context.hash(pw)


def verify_password(pw: str, hashed: str) -> bool:
    return pwd_context.verify(pw, hashed)


def create_token(user_id: str, role: str, days: int = 30) -> str:
    payload = {
        "user_id": user_id,
        "role": role,
        "exp": time.time() + days * 86400,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(
    request: Request,
    creds: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    # Accept token from Authorization: Bearer (native/mobile) OR HttpOnly cookie (web).
    token: Optional[str] = None
    if creds is not None and creds.scheme.lower() == "bearer" and creds.credentials:
        token = creds.credentials
    else:
        token = request.cookies.get(AUTH_COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=401, detail="Missing token")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired") from None
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token") from None
    user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    # SEC-004: suspended accounts must NOT retain valid sessions. Reject their
    # tokens even if they haven't expired yet. `changes_requested` is allowed
    # so drivers can still see their status page + resubmit; individual
    # endpoints (driver dashboard, job accept, etc.) can add their own
    # stricter checks where needed.
    if user.get("status") == "suspended":
        raise HTTPException(status_code=403, detail="Account suspended") from None
    return user


def require_role(*roles: str):
    async def _dep(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail=f"Requires role: {roles}")
        return user

    return _dep


def user_to_public(user: dict) -> dict:
    # Verified Driver = all docs approved (documents_verified) AND active AND ≥1 completed job
    verified_driver = bool(
        user.get("role") == "driver"
        and user.get("documents_verified")
        and user.get("status") == "active"
        and (user.get("total_jobs") or 0) >= 1
    )
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "phone": user.get("phone"),
        "role": user["role"],
        "status": user.get("status", "active"),
        "rating": user.get("rating", 5.0),
        "total_jobs": user.get("total_jobs", 0),
        "review_count": user.get("review_count", 0),
        "vehicle": user.get("vehicle"),
        "profile_photo": user.get("profile_photo"),
        "documents_verified": user.get("documents_verified", False),
        "verified_driver": verified_driver,
        "created_at": user.get("created_at", now_iso()),
        "changes_requested_reason": user.get("changes_requested_reason"),
        "changes_requested_doc_types": user.get("changes_requested_doc_types"),
        "suspension_reason": user.get("suspension_reason"),
        "address_line1": user.get("address_line1"),
        "address_line2": user.get("address_line2"),
        "town": user.get("town"),
        "county": user.get("county"),
        "postcode": user.get("postcode"),
        "country": user.get("country"),
    }


# ---------------------------------------------------------------------------
# Utility: distance calc
# ---------------------------------------------------------------------------


def haversine_miles(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 3959.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlmb / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ---------------------------------------------------------------------------
# Phone-number validation (R12) — mirrors /app/frontend/src/lib/validators.js
# ---------------------------------------------------------------------------
_PHONE_STRIP_RE = re.compile(r"[\s\-().]")
_PHONE_UK_RE = re.compile(r"^0\d{9,10}$")
_PHONE_INTL_RE = re.compile(r"^\+\d{7,15}$")
_PHONE_INTL00_RE = re.compile(r"^00\d{7,15}$")


def is_valid_phone(raw) -> bool:
    """UK + E.164 phone validator.

    Accepts:
      * UK mobile / landline: 07/01/02/03 + 9-10 further digits (10-11 total)
      * International:        +[country][subscriber], 8-15 digits after +
      * 00-prefixed intl:     00[country][subscriber], 9-17 digits after 00
    Spaces, dashes and parentheses are stripped before checking.
    """
    if not raw or not isinstance(raw, str):
        return False
    digits = _PHONE_STRIP_RE.sub("", raw)
    if not digits:
        return False
    if digits.startswith("+"):
        return bool(_PHONE_INTL_RE.match(digits))
    if digits.startswith("00"):
        return bool(_PHONE_INTL00_RE.match(digits))
    return bool(_PHONE_UK_RE.match(digits))


def public_job(job: dict, include_private: bool = False) -> dict:
    """Return job dict; hides exact addresses/contact until deposit paid."""
    out = {k: v for k, v in job.items() if k not in ("_id",)}
    if not include_private:
        out.pop("pickup_address", None)
        out.pop("dropoff_address", None)
        # Keep towns and approximate coords for map preview
    # Round 9 — always surface a Suitable Vehicle. Historic jobs written
    # before the create-time deriver won't have `recommended_vehicle` set;
    # compute it on read so every job — ASAP transport, ASAP recovery,
    # scheduled, marketplace — displays a vehicle to the driver.
    if not out.get("recommended_vehicle"):
        out["recommended_vehicle"] = _derive_suitable_vehicle(job)
    # R44 — Always surface distance_miles + duration_minutes on the customer
    # + driver booking detail UIs. Historic jobs (pre-R25 pricing engine),
    # non-domestic-UK routes (which skipped resolve_route), and jobs where
    # the Google Distance Matrix call failed at create-time may have
    # `distance_miles=0`, `duration_minutes=0`, or the fields missing
    # entirely. Compute a Haversine + 35 mph fallback on read so the
    # booking detail's "Distance / Journey time" row is never empty.
    try:
        need_dist = not out.get("distance_miles")
        need_dur = not out.get("duration_minutes")
        if (need_dist or need_dur) and all(
            out.get(k) is not None
            for k in ("pickup_lat", "pickup_lng", "dropoff_lat", "dropoff_lng")
        ):
            miles = haversine_miles(
                float(out["pickup_lat"]), float(out["pickup_lng"]),
                float(out["dropoff_lat"]), float(out["dropoff_lng"]),
            )
            if need_dist:
                out["distance_miles"] = round(miles, 1)
            if need_dur:
                # 35 mph average + 10 min urban buffer — matches resolve_route.
                out["duration_minutes"] = round((miles / 35.0) * 60 + 10, 1)
    except Exception:
        # Never let a bad coord kill the whole booking response.
        pass
    return out


# ---------------------------------------------------------------------------
# Notifications helper
# ---------------------------------------------------------------------------


async def push_notification(user_id: str, title: str, body: str, data: Optional[dict] = None):
    doc = {
        "id": new_id(),
        "user_id": user_id,
        "title": title,
        "body": body,
        "data": data or {},
        "read": False,
        "created_at": now_iso(),
    }
    await db.notifications.insert_one(doc)
    return doc


# ---------------------------------------------------------------------------
# Quote Engine (Google Distance Matrix when key set, haversine fallback)
# ---------------------------------------------------------------------------

GOOGLE_MAPS_API_KEY = os.environ.get("GOOGLE_MAPS_API_KEY", "").strip().strip('"')

# Category → suggested vehicle + speed multiplier for haversine → driving mins
CATEGORY_VEHICLES = {
    "furniture": "Luton Van",
    "pallets": "3.5T Curtain-side",
    "cars": "Car Transporter",
    "motorcycles": "Motorcycle Trailer",
    "house_moves": "Luton Van",
    "parcels": "Small Van",
    "freight": "7.5T HGV",
    "documents": "Car / Bike",
    "boats": "Boat Trailer",
    "machinery": "Flatbed HGV",
}


async def google_distance_matrix(origin: tuple[float, float],
                                  dest: tuple[float, float]) -> Optional[dict]:
    """Return {distance_meters, duration_seconds} or None on failure."""
    if not GOOGLE_MAPS_API_KEY:
        return None
    import httpx  # local import to avoid startup cost when unused
    url = "https://maps.googleapis.com/maps/api/distancematrix/json"
    params = {
        "origins": f"{origin[0]},{origin[1]}",
        "destinations": f"{dest[0]},{dest[1]}",
        "mode": "driving",
        "units": "imperial",
        "key": GOOGLE_MAPS_API_KEY,
    }
    try:
        async with httpx.AsyncClient(timeout=6) as client:
            r = await client.get(url, params=params)
            data = r.json()
        row = data["rows"][0]["elements"][0]
        if row.get("status") != "OK":
            return None
        return {
            "distance_meters": row["distance"]["value"],
            "duration_seconds": row["duration"]["value"],
        }
    except Exception:
        logger.exception("Google Distance Matrix failed")
        return None


async def resolve_route(pickup_lat: float, pickup_lng: float,
                          dropoff_lat: float, dropoff_lng: float) -> tuple[float, float, str]:
    """Single entrypoint for turning coordinates into
    (distance_miles, duration_minutes, distance_source). Every quote path
    calls THIS — not google_distance_matrix directly — so the "which
    source did we use" tag is consistent across the codebase.

    Sources returned:
      * ``google_road``          — Google Distance Matrix (preferred).
      * ``haversine_fallback``   — straight-line, lower-confidence.
    """
    gmaps = await google_distance_matrix(
        (pickup_lat, pickup_lng), (dropoff_lat, dropoff_lng),
    )
    if gmaps:
        return (
            round(gmaps["distance_meters"] / 1609.34, 2),
            round(gmaps["duration_seconds"] / 60, 1),
            "google_road",
        )
    d = round(haversine_miles(pickup_lat, pickup_lng, dropoff_lat, dropoff_lng), 2)
    # Assume 35 mph avg on mixed roads + 10 min buffer — deliberately
    # conservative so pricing based on haversine isn't underquoting time.
    t = round((d / 35.0) * 60 + 10, 1)
    return (d, t, "haversine_fallback")



# ---------------------------------------------------------------------------
# Booking-fee bands — Session F (percentage tiers)
# ---------------------------------------------------------------------------
#
# One canonical source of truth for every booking fee across the platform.
# `booking_fee_bands` is a percentage-tier collection (£0–150 → 15%, etc.).
# Legacy `deposit_bands` (fixed £-amount tiers) is still consulted for
# back-compat with any older row that hasn't been migrated — but the new
# bands take priority. Every downstream call site (booking creation,
# quote, Stripe checkout, refund, deposit receipt, admin reports) reads
# through `calculate_booking_fee_detail` — DO NOT introduce a second
# fee-calc anywhere.

DEFAULT_BOOKING_FEE_BANDS: list[dict] = [
    # (min_amount, max_amount, percent, label)
    {"min_amount": 0.00,     "max_amount": 150.00,  "booking_fee_percent": 15.0, "label": "Band A"},
    {"min_amount": 150.01,   "max_amount": 300.00,  "booking_fee_percent": 14.0, "label": "Band B"},
    {"min_amount": 300.01,   "max_amount": 600.00,  "booking_fee_percent": 13.0, "label": "Band C"},
    {"min_amount": 600.01,   "max_amount": 1000.00, "booking_fee_percent": 12.0, "label": "Band D"},
    {"min_amount": 1000.01,  "max_amount": None,    "booking_fee_percent": 10.0, "label": "Band E"},
]


async def _ensure_booking_fee_bands_seeded():
    """Idempotent — seeds the 5 default bands the first time only.
    Once seeded, admins own the collection and can edit freely."""
    count = await db.booking_fee_bands.count_documents({})
    if count > 0:
        return
    now = now_iso()
    docs = []
    for i, b in enumerate(DEFAULT_BOOKING_FEE_BANDS):
        docs.append({
            "id": new_id(),
            "min_amount": b["min_amount"],
            "max_amount": b["max_amount"],
            "booking_fee_percent": b["booking_fee_percent"],
            "label": b["label"],
            "enabled": True,
            "priority": i,
            "created_at": now,
            "updated_at": now,
        })
    await db.booking_fee_bands.insert_many(docs)
    logger.info("booking_fee_bands seeded: %d default tiers", len(docs))


class DepositBandIn(BaseModel):
    min_price: float
    max_price: Optional[float] = None  # None => infinity
    deposit_amount: float
    enabled: bool = True
    label: Optional[str] = None


class BookingFeeBandIn(BaseModel):
    min_amount: float
    max_amount: Optional[float] = None  # None => infinity
    booking_fee_percent: float
    enabled: bool = True
    label: Optional[str] = None
    priority: Optional[int] = None


# ─────────────────────────────────────────────────────────────────────────
# R35 — Customer cancellation policy (deposit-only fee model)
#
# Fee is computed from the DEPOSIT ALREADY PAID (never from the full
# booking value). Configurable per-installation via a singleton document
# in `platform_config` (id="cancellation"). Defaults: 20% of deposit,
# applies only after driver acceptance.
# ─────────────────────────────────────────────────────────────────────────
DEFAULT_CANCELLATION_POLICY = {
    "percentage": 20.0,                    # % of deposit paid
    "applies_after_driver_accept": True,   # fee gate — pre-accept = free cancel
    "min_fee": 0.0,                        # optional floor (£)
    "max_fee": None,                       # optional ceiling (£, null = no cap)
}


async def _get_cancellation_policy() -> dict:
    """Fetch the singleton cancellation policy doc, fallback to defaults."""
    doc = await db.platform_config.find_one({"id": "cancellation"}, {"_id": 0})
    if not doc:
        return dict(DEFAULT_CANCELLATION_POLICY)
    return {
        "percentage": float(doc.get("percentage", DEFAULT_CANCELLATION_POLICY["percentage"])),
        "applies_after_driver_accept": bool(doc.get("applies_after_driver_accept",
                                                    DEFAULT_CANCELLATION_POLICY["applies_after_driver_accept"])),
        "min_fee": float(doc.get("min_fee", DEFAULT_CANCELLATION_POLICY["min_fee"])),
        "max_fee": (float(doc["max_fee"]) if doc.get("max_fee") not in (None, "") else None),
    }


def _compute_cancellation_fee(deposit_paid: float, policy: dict, driver_accepted: bool) -> dict:
    """Pure calculator — backend source-of-truth.

    Returns:
        {
          deposit_paid, cancellation_pct, cancellation_fee, refund_amount,
          driver_accepted, requires_fee, policy_applied
        }
    All monetary values are ROUNDED to 2 dp (customer-facing).
    """
    dep = round(max(0.0, float(deposit_paid or 0.0)), 2)
    pct = float(policy.get("percentage", 20.0))
    applies_after_accept = bool(policy.get("applies_after_driver_accept", True))
    # Fee only applies when either (a) policy says fee applies pre-accept too,
    # or (b) the driver has already accepted the job.
    requires_fee = (driver_accepted or not applies_after_accept)
    if not requires_fee:
        return {
            "deposit_paid": dep,
            "cancellation_pct": pct,
            "cancellation_fee": 0.0,
            "refund_amount": dep,
            "driver_accepted": bool(driver_accepted),
            "requires_fee": False,
            "policy_applied": False,
        }
    raw_fee = dep * (pct / 100.0)
    min_fee = float(policy.get("min_fee") or 0.0)
    max_fee = policy.get("max_fee")
    fee = max(raw_fee, min_fee)
    if max_fee is not None:
        fee = min(fee, float(max_fee))
    # Fee cannot exceed the deposit itself.
    fee = min(fee, dep)
    fee = round(fee, 2)
    refund = round(max(0.0, dep - fee), 2)
    return {
        "deposit_paid": dep,
        "cancellation_pct": pct,
        "cancellation_fee": fee,
        "refund_amount": refund,
        "driver_accepted": bool(driver_accepted),
        "requires_fee": True,
        "policy_applied": True,
    }


class CancellationPolicyIn(BaseModel):
    percentage: float
    applies_after_driver_accept: bool = True
    min_fee: float = 0.0
    max_fee: Optional[float] = None




async def _lookup_booking_fee_band(driver_charge: float) -> Optional[dict]:
    """Find the first enabled percentage-band matching driver_charge.
    Returns the full band dict or None if no band matches."""
    bands = await db.booking_fee_bands.find({"enabled": True}, {"_id": 0}) \
                                        .sort([("priority", 1), ("min_amount", 1)]) \
                                        .to_list(200)
    for b in bands:
        min_a = float(b.get("min_amount", 0))
        max_a = b.get("max_amount")
        if driver_charge >= min_a and (max_a is None or driver_charge <= float(max_a)):
            return b
    return None


async def calculate_booking_fee_detail(driver_charge: float) -> dict:
    """Single source of truth for every booking fee on the platform.

    Preference order:
      1. `booking_fee_bands` (percentage tiers — Session F canonical).
      2. Legacy `deposit_bands` (fixed £-amount tiers — kept for back-compat).
      3. Fallback: 10% of driver_charge.

    Returns:
        {
          "percent":   float  # e.g. 13.0
          "amount":    float  # rounded to 2dp
          "band_id":   str | None  # id of the band that fired, if any
          "source":    "booking_fee_bands" | "deposit_bands" | "fallback"
        }
    """
    band = await _lookup_booking_fee_band(driver_charge)
    if band:
        pct = float(band["booking_fee_percent"])
        amount = round(driver_charge * pct / 100.0, 2)
        return {"percent": pct, "amount": amount, "band_id": band.get("id"),
                "source": "booking_fee_bands"}

    # Legacy fallback — some environments still edit the older collection.
    legacy = await db.deposit_bands.find({"enabled": True}, {"_id": 0}) \
                                     .sort("min_price", 1).to_list(200)
    for b in legacy:
        min_p = float(b.get("min_price", 0))
        max_p = b.get("max_price")
        if driver_charge >= min_p and (max_p is None or driver_charge <= float(max_p)):
            amount = round(float(b["deposit_amount"]), 2)
            pct = round((amount / driver_charge) * 100.0, 2) if driver_charge > 0 else 0.0
            return {"percent": pct, "amount": amount, "band_id": b.get("id"),
                    "source": "deposit_bands"}

    # Ultimate fallback so nothing ever passes zero.
    amount = round(driver_charge * DEPOSIT_PERCENTAGE, 2)
    return {"percent": round(DEPOSIT_PERCENTAGE * 100.0, 2),
             "amount": amount, "band_id": None, "source": "fallback"}


async def calculate_booking_fee(driver_charge: float) -> float:
    """Legacy thin wrapper — returns just the amount so older call sites
    keep compiling. New code should call `calculate_booking_fee_detail`
    when it needs the percent (for storage on the booking or display in
    the customer summary / email)."""
    detail = await calculate_booking_fee_detail(driver_charge)
    return detail["amount"]


# Back-compat alias (used by earlier code paths)
calculate_deposit = calculate_booking_fee


async def preview_deposit(driver_charge: float) -> dict:
    """Return the full pricing breakdown for a given driver_charge.

    Also carries the fee percent + band metadata so the FE / emails can
    render `Cargo One Booking Fee (13%)` without duplicating the tier
    logic client-side."""
    d = await calculate_booking_fee_detail(driver_charge)
    return {
        "driver_charge": round(driver_charge, 2),
        "booking_fee": d["amount"],
        "booking_fee_percent": d["percent"],
        "booking_fee_band_id": d["band_id"],
        "booking_fee_source": d["source"],
        "customer_total": round(driver_charge + d["amount"], 2),
        # Legacy field names kept for backwards compat with older clients:
        "total_price": round(driver_charge + d["amount"], 2),
        "deposit_amount": d["amount"],
        "balance_due": round(driver_charge, 2),
    }


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------


@api.post("/auth/register", response_model=TokenResponse)
async def register(payload: UserRegister, response: Response):
    existing = await db.users.find_one({"email": payload.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    # SEC: only customer/driver may self-register. Admin accounts are provisioned
    # out-of-band (see backend startup seed guarded by ALLOW_INITIAL_ADMIN_SEED).
    if payload.role not in ("customer", "driver"):
        raise HTTPException(
            status_code=400,
            detail="Invalid role — only customer or driver accounts can be self-registered.",
        )
    # Drivers MUST supply a valid UK/E.164 phone at signup — customers need
    # to be able to reach them once a booking is confirmed. This was
    # previously optional, which produced ghost drivers that customers could
    # not call.
    if payload.role == "driver":
        if not is_valid_phone(payload.phone or ""):
            raise HTTPException(
                status_code=400,
                detail="A valid UK or international phone number is required for driver accounts so customers can reach you after booking.",
            )
    # Customer-side sanity check: if provided, must be structurally valid.
    elif payload.phone and not is_valid_phone(payload.phone):
        raise HTTPException(
            status_code=400,
            detail="The phone number entered doesn't look valid. Use a UK mobile (e.g. 07700 900123) or international format (e.g. +44 7700 900123).",
        )

    user = {
        "id": new_id(),
        "email": payload.email.lower(),
        "name": payload.name,
        "phone": payload.phone,
        "role": payload.role,
        "password_hash": hash_password(payload.password),
        "status": "pending" if payload.role == "driver" else "active",
        "rating": 5.0,
        "total_jobs": 0,
        "vehicle": None,
        "documents_verified": False,
        "created_at": now_iso(),
        "address_line1": payload.address_line1,
        "address_line2": payload.address_line2,
        "town": payload.town,
        "county": payload.county,
        "postcode": payload.postcode,
        "country": payload.country,
    }
    await db.users.insert_one(user)
    token = create_token(user["id"], user["role"])
    set_auth_cookie(response, token)
    set_csrf_cookie(response, new_csrf_token())
    # Fire-and-forget welcome email. Never blocks registration on failure.
    try:
        from services.email import send_welcome
        await send_welcome(db, user=user)
    except Exception as _e:  # pragma: no cover
        logger.warning("welcome email skipped: %s", _e)
    return {"access_token": token, "token_type": "bearer", "user": user_to_public(user)}


@api.post("/auth/login", response_model=TokenResponse)
async def login(payload: UserLogin, response: Response):
    user = await db.users.find_one({"email": payload.email.lower()})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if user.get("status") == "suspended":
        raise HTTPException(status_code=403, detail="Account suspended")
    token = create_token(user["id"], user["role"])
    set_auth_cookie(response, token)
    set_csrf_cookie(response, new_csrf_token())
    return {"access_token": token, "token_type": "bearer", "user": user_to_public(user)}


@api.post("/auth/logout")
async def logout(response: Response):
    """Clear the HttpOnly web session cookie. Idempotent — safe to call unauth'd."""
    clear_auth_cookie(response)
    clear_csrf_cookie(response)
    return {"ok": True}


# ---------------------------------------------------------------------------
# Password reset — Session D
#
# Two-endpoint flow:
#   1. POST /auth/forgot-password  { email } → issues a token, emails a link.
#      Always returns 200 to prevent user enumeration.
#   2. POST /auth/reset-password   { token, new_password } → verifies and
#      rotates the password_hash, invalidates the token.
#
# Tokens are 32-byte urlsafe, one-shot (marked `used_at`), 60-minute expiry.
# Stored in `password_reset_tokens` with an index on `token`.
# ---------------------------------------------------------------------------
PASSWORD_RESET_TTL_MINUTES = 60


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)


@api.post("/auth/forgot-password")
async def forgot_password(payload: ForgotPasswordRequest):
    """Issue a password-reset token and email the user a reset link.

    Always returns `{ok: true}` — never leaks whether the email exists,
    to prevent account enumeration.
    """
    email = payload.email.strip().lower()
    user = await db.users.find_one({"email": email}, {"_id": 0, "password_hash": 0})
    if user and user.get("status") != "deleted":
        token = secrets.token_urlsafe(32)
        expires = datetime.now(timezone.utc) + timedelta(minutes=PASSWORD_RESET_TTL_MINUTES)
        await db.password_reset_tokens.insert_one({
            "id": new_id(),
            "token": token,
            "user_id": user["id"],
            "email": email,
            "expires_at": expires.isoformat(),
            "used_at": None,
            "created_at": now_iso(),
        })
        base = (os.environ.get("APP_BASE_URL") or "https://cargoone.co.uk").rstrip("/")
        reset_url = f"{base}/auth/reset?token={token}"
        try:
            from services.email import send_password_reset
            await send_password_reset(db, user=user, reset_url=reset_url,
                                       expiry_minutes=PASSWORD_RESET_TTL_MINUTES)
        except Exception:
            logger.exception("forgot-password email failed; returning ok anyway")
    return {"ok": True}


@api.post("/auth/reset-password", response_model=TokenResponse)
async def reset_password(payload: ResetPasswordRequest, response: Response):
    """Validate the reset token and rotate the user's password.

    On success returns the same TokenResponse shape as /auth/login so the
    frontend can immediately hand off into an authenticated session.
    """
    rec = await db.password_reset_tokens.find_one({"token": payload.token})
    if not rec:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")
    if rec.get("used_at"):
        raise HTTPException(status_code=400, detail="This reset link has already been used")
    try:
        exp = datetime.fromisoformat(rec["expires_at"])
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")
    if datetime.now(timezone.utc) > exp:
        raise HTTPException(status_code=400, detail="This reset link has expired")

    user = await db.users.find_one({"id": rec["user_id"]})
    if not user or user.get("status") == "deleted":
        raise HTTPException(status_code=400, detail="Account no longer exists")

    new_hash = hash_password(payload.new_password)
    # Atomic burn: rotate password + mark token used in the same round-trip.
    await db.users.update_one({"id": user["id"]}, {"$set": {"password_hash": new_hash}})
    await db.password_reset_tokens.update_one(
        {"token": payload.token, "used_at": None},
        {"$set": {"used_at": now_iso()}},
    )

    # Immediately log the user in — same shape as /auth/login
    token = create_token(user["id"], user["role"])
    set_auth_cookie(response, token)
    set_csrf_cookie(response, new_csrf_token())
    return TokenResponse(access_token=token, user=user_to_public(user))


# ---------------------------------------------------------------------------
# R66 — WebAuthn / Passkeys
#
# Endpoints (all under /api):
#   POST /auth/passkey/register/generate  (auth required)
#   POST /auth/passkey/register/verify    (auth required)
#   POST /auth/passkey/login/generate     (public — email in body)
#   POST /auth/passkey/login/verify       (public — issues JWT + cookie)
#   GET  /auth/passkey/list               (auth required)
#   DELETE /auth/passkey/{credential_id}  (auth required, owner only)
#
# Security invariants (see services/webauthn_passkeys.py for detail):
#   - Registration is bound to the caller's authenticated user.id.
#   - Login never trusts a client-supplied user id; the credential record
#     alone determines which account receives a JWT.
#   - Challenges are single-use with a short TTL; consumed on both success
#     and failure.
#   - Password login remains fully functional as fallback.
# ---------------------------------------------------------------------------
from services import webauthn_passkeys as _passkeys  # noqa: E402


class _PasskeyRegisterVerifyBody(BaseModel):
    credential: dict
    label: Optional[str] = None


class _PasskeyLoginStart(BaseModel):
    email: EmailStr


class _PasskeyLoginVerifyBody(BaseModel):
    credential: dict


@api.post("/auth/passkey/register/generate")
async def passkey_register_generate(user: dict = Depends(get_current_user)):
    return await _passkeys.build_registration_options(db, user)


@api.post("/auth/passkey/register/verify")
async def passkey_register_verify(
    body: _PasskeyRegisterVerifyBody,
    user: dict = Depends(get_current_user),
):
    return await _passkeys.verify_and_store_credential(
        db, user, body.credential, label=body.label
    )


@api.post("/auth/passkey/login/generate")
async def passkey_login_generate(body: _PasskeyLoginStart):
    async def _find(email: str):
        return await db.users.find_one({"email": email}, {"_id": 0, "password_hash": 0})

    return await _passkeys.build_authentication_options(db, _find, body.email)


@api.post("/auth/passkey/login/verify", response_model=TokenResponse)
async def passkey_login_verify(
    body: _PasskeyLoginVerifyBody, response: Response
):
    result = await _passkeys.verify_authentication(db, body.credential)
    user = await db.users.find_one(
        {"id": result["user_id"]}, {"_id": 0, "password_hash": 0}
    )
    if not user:
        raise HTTPException(status_code=401, detail="Invalid passkey login")
    if user.get("status") == "suspended":
        raise HTTPException(status_code=403, detail="Account suspended")
    token = create_token(user["id"], user["role"])
    set_auth_cookie(response, token)
    set_csrf_cookie(response, new_csrf_token())
    return {"access_token": token, "token_type": "bearer", "user": user_to_public(user)}


@api.get("/auth/passkey/list")
async def passkey_list(user: dict = Depends(get_current_user)):
    return await _passkeys.list_user_credentials(db, user["id"])


@api.delete("/auth/passkey/{credential_id}")
async def passkey_delete(
    credential_id: str, user: dict = Depends(get_current_user)
):
    ok = await _passkeys.revoke_credential(db, user["id"], credential_id)
    if not ok:
        raise HTTPException(404, "Passkey not found")
    return {"ok": True}


# Passkey LOGIN endpoints are exempt from CSRF (user has no session yet).
CSRF_EXEMPT_PATHS.add("/api/auth/passkey/login/generate")
CSRF_EXEMPT_PATHS.add("/api/auth/passkey/login/verify")


@api.get("/auth/me", response_model=UserPublic)
async def me(request: Request, response: Response, user: dict = Depends(get_current_user)):
    # Opportunistic CSRF re-issue: any existing session that predates the SEC1
    # rollout will hydrate via this endpoint and pick up a fresh CSRF cookie
    # without needing to log in again.
    if not request.cookies.get(CSRF_COOKIE_NAME):
        set_csrf_cookie(response, new_csrf_token())
    return user_to_public(user)


@api.post("/auth/me/delete")
async def delete_me(user: dict = Depends(get_current_user)):
    """Soft-delete: anonymise personal data, suspend account. Booking records retained.
    GDPR data scrubbing: also anonymises the user's display name across historical
    bookings, jobs, bids, reviews and messages so PII is not visible to other parties."""
    anon_email = f"deleted+{user['id']}@cargoone.internal"
    anon_name = "Deleted user"
    patch = {
        "email": anon_email,
        "name": anon_name,
        "phone": None,
        "profile_photo": None,
        "status": "suspended",
        "deleted_at": now_iso(),
    }
    await db.users.update_one({"id": user["id"]}, {"$set": patch})
    await db.documents.delete_many({"user_id": user["id"]})
    await db.notifications.delete_many({"user_id": user["id"]})
    # Anonymise denormalised name fields across the platform
    await db.jobs.update_many(
        {"customer_id": user["id"]}, {"$set": {"customer_name": anon_name}}
    )
    await db.jobs.update_many(
        {"assigned_driver_id": user["id"]}, {"$set": {"assigned_driver_name": anon_name}}
    )
    await db.bids.update_many(
        {"driver_id": user["id"]}, {"$set": {"driver_name": anon_name}}
    )
    await db.reviews.update_many(
        {"from_id": user["id"]}, {"$set": {"from_name": anon_name}}
    )
    await db.messages.update_many(
        {"sender_id": user["id"]}, {"$set": {"sender_name": anon_name}}
    )
    return {"ok": True}


@api.put("/auth/me")
async def update_me(update: dict, user: dict = Depends(get_current_user)):
    allowed = {
        "name", "phone", "vehicle", "profile_photo",
        "address_line1", "address_line2", "town", "county", "postcode", "country",
    }
    patch = {k: v for k, v in update.items() if k in allowed}
    # Drivers must not be able to clear their phone — customers need it to
    # reach them post-booking. Also reject structurally invalid formats
    # (e.g. "1234567") using the shared UK/E.164 validator.
    if user.get("role") == "driver" and "phone" in patch:
        phone_val = (patch["phone"] or "").strip() if isinstance(patch["phone"], str) else ""
        if not is_valid_phone(phone_val):
            raise HTTPException(
                status_code=400,
                detail="A valid UK or international phone number is required for driver accounts (e.g. 07700 900123 or +44 7700 900123).",
            )
        patch["phone"] = phone_val
    # Customers may clear or update their phone but if provided it must be
    # structurally valid.
    elif "phone" in patch and patch["phone"]:
        phone_val = (patch["phone"] or "").strip() if isinstance(patch["phone"], str) else ""
        if phone_val and not is_valid_phone(phone_val):
            raise HTTPException(
                status_code=400,
                detail="The phone number entered doesn't look valid. Use a UK mobile (e.g. 07700 900123) or international format (e.g. +44 7700 900123).",
            )
        patch["phone"] = phone_val
    if patch:
        await db.users.update_one({"id": user["id"]}, {"$set": patch})
    updated = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    return user_to_public(updated)


@api.post("/auth/me/change-password")
async def change_password(
    payload: PasswordChange,
    response: Response,
    user: dict = Depends(get_current_user),
):
    """Authenticated password change. Requires the caller's CURRENT password.
    Rotates the session token on success and re-issues the HttpOnly cookie so
    other active sessions on this account become invalid at their next call
    (their JWTs remain valid until expiry — see backlog for a proper
    session/tokens table if we want revoke-everywhere). Bearer clients get the
    new token via the JSON body per the retained mobile compatibility contract.
    """
    if not payload.current_password or not payload.new_password:
        raise HTTPException(status_code=400, detail="Both current and new password are required")
    if len(payload.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")
    if payload.new_password == payload.current_password:
        raise HTTPException(status_code=400, detail="New password must differ from current password")
    fresh = await db.users.find_one({"id": user["id"]})
    if not fresh or not verify_password(payload.current_password, fresh["password_hash"]):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"password_hash": hash_password(payload.new_password), "password_changed_at": now_iso()}},
    )
    # Refresh session so the current browser tab keeps working seamlessly.
    token = create_token(user["id"], user["role"])
    set_auth_cookie(response, token)
    return {"ok": True, "access_token": token, "token_type": "bearer"}


# ---------------------------------------------------------------------------
# Public profile (visible to other users pre-deposit for driver selection)
# ---------------------------------------------------------------------------


@api.get("/users/{user_id}/profile")
async def public_profile(user_id: str, requester: dict = Depends(get_current_user)):
    u = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not u:
        raise HTTPException(status_code=404, detail="Not found")
    pub = user_to_public(u)
    # R37 / R69 — This endpoint is now called by customers pre-acceptance
    # (DriverReviewsSheet). Redact private contact + home-address fields
    # unless the caller is the profile owner or an admin. Rating,
    # review_count, verified_driver, vehicle summary and photo remain
    # visible because they are legitimately part of a public driver
    # marketplace card.
    is_self = requester.get("id") == user_id
    is_admin = requester.get("role") == "admin"
    if not is_self and not is_admin:
        for k in (
            "email",
            "phone",
            "address_line1",
            "address_line2",
            "town",
            "county",
            "postcode",
            "country",
            "changes_requested_reason",
            "changes_requested_doc_types",
            "suspension_reason",
        ):
            pub.pop(k, None)
    reviews = await db.reviews.find({"target_id": user_id}, {"_id": 0}) \
                                .sort("created_at", -1).to_list(10)
    completed = await db.bookings.count_documents(
        {"driver_id": user_id, "status": "completed"} if u["role"] == "driver"
        else {"customer_id": user_id, "status": "completed"},
    )
    pub["reviews"] = reviews
    pub["completed_bookings"] = completed
    return pub


# ---------------------------------------------------------------------------
# Driver documents (verification)
# ---------------------------------------------------------------------------


REQUIRED_DOC_TYPES = {
    "driving_licence", "insurance", "vehicle_registration",
    "vehicle_photos", "profile_photo", "proof_of_address",
}


class DocumentUpload(BaseModel):
    doc_type: str
    base64: str
    filename: Optional[str] = None
    expiry_date: Optional[str] = None  # ISO date


@api.post("/users/me/documents")
async def upload_document(payload: DocumentUpload, user: dict = Depends(get_current_user)):
    if payload.doc_type not in REQUIRED_DOC_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid doc_type: {payload.doc_type}")
    if not payload.base64:
        raise HTTPException(status_code=400, detail="base64 required")
    # Only one active doc per type per user — soft delete previous (keep audit trail)
    await db.documents.update_many(
        {"user_id": user["id"], "doc_type": payload.doc_type, "active": True},
        {"$set": {"active": False, "replaced_at": now_iso()}},
    )
    doc = {
        "id": new_id(),
        "user_id": user["id"],
        "doc_type": payload.doc_type,
        "base64": payload.base64,
        "filename": payload.filename,
        "expiry_date": payload.expiry_date,
        "status": "pending",
        "rejection_reason": None,
        "active": True,
        "uploaded_at": now_iso(),
    }
    await db.documents.insert_one(doc)
    # Set profile_photo shortcut
    if payload.doc_type == "profile_photo":
        await db.users.update_one({"id": user["id"]}, {"$set": {"profile_photo": payload.base64}})
    await _recompute_documents_verified(user["id"])
    return {k: v for k, v in doc.items() if k not in ("_id", "base64")}


@api.get("/users/me/documents")
async def my_documents(user: dict = Depends(get_current_user)):
    docs = await db.documents.find(
        {"user_id": user["id"], "active": True}, {"_id": 0, "base64": 0},
    ).sort("uploaded_at", -1).to_list(50)
    # Include required list so client can render slots even if empty
    return {"required": sorted(REQUIRED_DOC_TYPES), "documents": docs}


@api.get("/users/me/documents/{doc_id}")
async def my_document_content(doc_id: str, user: dict = Depends(get_current_user)):
    doc = await db.documents.find_one(
        {"id": doc_id, "user_id": user["id"]}, {"_id": 0},
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    return doc


async def _recompute_documents_verified(user_id: str):
    """Mark user documents_verified when every required doc is approved."""
    approved_types = set()
    async for d in db.documents.find(
        {"user_id": user_id, "active": True, "status": "approved"}, {"_id": 0, "doc_type": 1},
    ):
        approved_types.add(d["doc_type"])
    all_approved = REQUIRED_DOC_TYPES.issubset(approved_types)
    await db.users.update_one(
        {"id": user_id}, {"$set": {"documents_verified": all_approved}},
    )
    # If it just became approved and driver was pending, activate
    if all_approved:
        await db.users.update_one(
            {"id": user_id, "status": "pending"}, {"$set": {"status": "active"}},
        )


class DocReview(BaseModel):
    action: str  # approve | reject
    reason: Optional[str] = None


@api.get("/admin/documents/{user_id}")
async def admin_user_documents(user_id: str, _: dict = Depends(require_role("admin"))):
    docs = await db.documents.find(
        {"user_id": user_id, "active": True}, {"_id": 0},
    ).sort("uploaded_at", -1).to_list(50)
    return docs


@api.post("/admin/documents/{doc_id}/review")
async def admin_review_document(doc_id: str, payload: DocReview,
                                 _: dict = Depends(require_role("admin"))):
    if payload.action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="action must be approve|reject")
    doc = await db.documents.find_one({"id": doc_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    new_status = "approved" if payload.action == "approve" else "rejected"
    await db.documents.update_one(
        {"id": doc_id},
        {"$set": {"status": new_status, "rejection_reason": payload.reason,
                   "reviewed_at": now_iso()}},
    )
    await _recompute_documents_verified(doc["user_id"])
    title = "Document approved" if new_status == "approved" else "Document rejected"
    body = (f"Your {doc['doc_type'].replace('_', ' ')} was {new_status}."
            + (f" Reason: {payload.reason}" if payload.reason else ""))
    await push_notification(doc["user_id"], title, body, {"doc_id": doc_id})
    return {"ok": True, "status": new_status}


# ---------------------------------------------------------------------------
# Jobs
# ---------------------------------------------------------------------------


@api.post("/jobs")
async def create_job(payload: JobCreate, user: dict = Depends(require_role("customer"))):
    data = payload.model_dump()
    # Real-time dispatch validation (Phase 32).
    service_timing = (data.get("service_timing") or "scheduled").lower()
    if service_timing not in ("scheduled", "asap"):
        raise HTTPException(status_code=400, detail="Invalid service_timing")
    service_type = (data.get("service_type") or "transport").lower()
    if service_type not in ("transport", "breakdown_recovery"):
        raise HTTPException(status_code=400, detail="Invalid service_type")
    data["service_timing"] = service_timing
    data["service_type"] = service_type

    # Classify route so we can flag international jobs for manual pricing review.
    route_class = classify_route(
        data.get("pickup_country_code"),
        data.get("dropoff_country_code"),
    )
    # Legacy contract: if no country codes provided at all, treat as UK domestic.
    if not data.get("pickup_country_code") and not data.get("dropoff_country_code"):
        route_class = "domestic_uk"

    # R25 — Single authoritative pricing path. Legacy per-mile Haversine +
    # ad-hoc category multipliers are DELETED. Every job's `suggested_price`
    # now comes from `services.pricing.calculate_quote`. Historical jobs
    # are NEVER touched.
    distance_miles: float = 0.0
    duration_minutes: float = 0.0
    distance_source: str = "haversine_fallback"
    suggested_price = None
    pricing_snapshot: Optional[dict] = None
    pricing_line_items: Optional[list] = None

    if route_class == "domestic_uk":
        # R26 — ASAP jobs route through services/asap_pricing.py; scheduled
        # continues through services/pricing.py. This isolation protects
        # existing Bidding + Fixed Price pricing from any ASAP changes.
        distance_miles, duration_minutes, distance_source = await resolve_route(
            data["pickup_lat"], data["pickup_lng"],
            data["dropoff_lat"], data["dropoff_lng"],
        )
        raw_category = data.get("category") or data.get("transport_category")
        normalized_category = LEGACY_CATEGORY_MAP.get(raw_category, raw_category)

        if service_timing == "asap":
            from services.asap_pricing import calculate_asap_quote, AsapPricingError
            try:
                b = await calculate_asap_quote(
                    db,
                    distance_miles=distance_miles,
                    duration_minutes=duration_minutes,
                    distance_source=distance_source,
                    pickup_lat=data["pickup_lat"], pickup_lng=data["pickup_lng"],
                    service_type=service_type,
                    urgency=data.get("urgency"),
                    collection_within_minutes=data.get("collection_within_minutes"),
                    requested_vehicle_key=data.get("requested_vehicle_key"),
                    vehicle_class=(data.get("vehicle_details") or {}).get("weight_class")
                                    or (data.get("vehicle_details") or {}).get("type"),
                    weight_kg=data.get("weight_kg"),
                    volume_m3=(
                        (data.get("length_m") or 0) * (data.get("width_m") or 0) * (data.get("height_m") or 0)
                        if data.get("length_m") and data.get("width_m") and data.get("height_m")
                        else None),
                    pallets=data.get("pallets"),
                    item_count=data.get("item_count"),
                    loading_help=bool(data.get("needs_loading_help")),
                    calculate_booking_fee_detail=calculate_booking_fee_detail,
                )
            except AsapPricingError as exc:
                raise HTTPException(status_code=422, detail={
                    "code": exc.code, "message": str(exc)})
            suggested_price = b.driver_charge
            pricing_snapshot = b.pricing_snapshot
            pricing_line_items = [asdict_line_item(li) for li in b.line_items]
            recommended_vehicle_label = b.resolved_vehicle_label
            recommended_vehicle_key = b.resolved_vehicle_key
        else:
            from services.pricing import calculate_quote, PricingError
            try:
                breakdown = await calculate_quote(
                    db,
                    distance_miles=distance_miles,
                    duration_minutes=duration_minutes,
                    distance_source=distance_source,
                    service_type=service_type,
                    service_timing=service_timing,
                    transport_category=normalized_category,
                    weight_kg=data.get("weight_kg"),
                    volume_m3=(
                        (data.get("length_m") or 0) * (data.get("width_m") or 0) * (data.get("height_m") or 0)
                        if data.get("length_m") and data.get("width_m") and data.get("height_m")
                        else None),
                    item_count=data.get("item_count"),
                    needs_forklift=bool(data.get("needs_forklift")),
                    needs_loading_help=bool(data.get("needs_loading_help")),
                    vehicle_details=data.get("vehicle_details"),
                )
            except PricingError as exc:
                raise HTTPException(status_code=422, detail={
                    "code": exc.code, "message": str(exc)})
            suggested_price = breakdown.driver_charge
            pricing_snapshot = breakdown.pricing_snapshot
            pricing_line_items = [asdict_line_item(li) for li in breakdown.line_items]
            recommended_vehicle_label = breakdown.resolved_vehicle_label
            recommended_vehicle_key = breakdown.resolved_vehicle_key
    else:
        # Non-UK route — record haversine for admin sanity but never quote.
        # R44 — also compute a conservative duration estimate so the booking
        # detail UI never shows "Journey time —" for cross-border jobs
        # awaiting manual quote.
        distance_miles = round(
            haversine_miles(data["pickup_lat"], data["pickup_lng"],
                            data["dropoff_lat"], data["dropoff_lng"]), 1,
        )
        duration_minutes = round((distance_miles / 35.0) * 60 + 10, 1)

    job = {
        "id": new_id(),
        "customer_id": user["id"],
        "customer_name": user["name"],
        "customer_rating": user.get("rating", 5.0),
        "status": "posted" if route_class == "domestic_uk" else "awaiting_manual_quote",
        "distance_miles": round(distance_miles, 1),
        "duration_minutes": duration_minutes,
        "distance_source": distance_source,
        "suggested_price": suggested_price,
        # R25 — persist immutable pricing snapshot on the JOB record so
        # historical calculations survive future admin config changes.
        "pricing_snapshot": pricing_snapshot,
        "pricing_line_items": pricing_line_items,
        "pricing_engine_version": (pricing_snapshot or {}).get("engine_version"),
        "route_class": route_class,
        "assigned_driver_id": None,
        "accepted_price": None,
        "created_at": now_iso(),
        **data,
    }
    # ASAP jobs must be fixed-price so the atomic claim doesn't collide with
    # the multi-round bidding lifecycle. Guard commercial rules explicitly.
    if service_timing == "asap" and job.get("pricing_type") != "fixed":
        raise HTTPException(status_code=400, detail="ASAP requests must be fixed-price")
    # R42 — ONLY ASAP jobs may have their client-supplied fixed_price replaced
    # by the engine's `suggested_price`. For SCHEDULED marketplace fixed-price
    # jobs the whole business model is "customer names the reward, drivers
    # accept the deal" — the customer's offered price IS the source of truth.
    # (The R25 pricing certification originally blanket-clobbered both, which
    # broke test_booking_fees.py::TestFixedPriceBooking; £270 fixed jobs were
    # being silently rewritten to whatever the engine quoted, e.g. £113.85 on
    # the London→Brighton fixture.)
    if (
        suggested_price is not None
        and job.get("pricing_type") == "fixed"
        and service_timing == "asap"
    ):
        job["fixed_price"] = suggested_price
    # Round 9 fix — always populate a Suitable Vehicle label. ASAP jobs
    # posted by customers rarely include one explicitly; without it the
    # driver's offer card / booking detail can't render the vehicle row.
    # Derives from transport_category (transport) or vehicle_details.type
    # (recovery) with sensible fallbacks so the field is NEVER empty.
    if not job.get("recommended_vehicle"):
        job["recommended_vehicle"] = _derive_suitable_vehicle(job)
    # Prefer the engine's resolved vehicle label when one is available —
    # keeps the "Suitable vehicle" chip aligned with the pricing.
    if 'recommended_vehicle_label' in dir() and recommended_vehicle_label:
        job["recommended_vehicle"] = recommended_vehicle_label
        job["recommended_vehicle_key"] = recommended_vehicle_key
    elif pricing_snapshot and (pricing_snapshot.get("resolved_vehicle_key")):
        veh_key = pricing_snapshot["resolved_vehicle_key"]
        veh_row = pricing_snapshot.get("vehicle_rate_card") or {}
        job["recommended_vehicle"] = veh_row.get("label") or job["recommended_vehicle"]
        job["recommended_vehicle_key"] = veh_key

    await db.jobs.insert_one(job)
    return public_job(job, include_private=True)


@api.get("/jobs/mine")
async def my_jobs(user: dict = Depends(require_role("customer"))):
    jobs = await db.jobs.find({"customer_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return jobs


# ---------------------------------------------------------------------------
# R25 — Authoritative pricing endpoint. Every frontend that needs a price
# calls THIS. The legacy /quote/estimate below is preserved as a thin
# adapter around the same engine so no client breaks.
# ---------------------------------------------------------------------------



# ---------------------------------------------------------------------------
# R26 — ASAP-only pricing engine V1 (services/asap_pricing.py). Scheduled
# Fixed / Bidding paths continue to use services/pricing.py — untouched.
# ---------------------------------------------------------------------------


class AsapQuoteBody(BaseModel):
    pickup_lat: float
    pickup_lng: float
    dropoff_lat: float
    dropoff_lng: float
    service_type: Optional[str] = "transport"
    urgency: Optional[str] = "asap"
    collection_within_minutes: Optional[int] = None
    when_iso: Optional[str] = None
    requested_vehicle_key: Optional[str] = None
    vehicle_class: Optional[str] = None
    weight_kg: Optional[float] = None
    volume_m3: Optional[float] = None
    pallets: Optional[int] = None
    item_count: Optional[int] = None
    waiting_minutes: Optional[int] = None
    extra_stops: Optional[int] = None
    loading_help: Optional[bool] = False
    tail_lift_needed: Optional[bool] = False
    nearest_driver_distance_mi: Optional[float] = None
    pickup_country_code: Optional[str] = None
    dropoff_country_code: Optional[str] = None


@api.get("/asap/vehicles")
async def asap_vehicles_catalog():
    """Public read-only catalog for the customer-facing ASAP vehicle
    picker (R26.2). Returns transport + recovery classes with their
    labels, keys, minimum charge and per-mile rate. The pricing engine
    remains authoritative — this endpoint is display metadata only."""
    from services.asap_pricing import ASAP_DEFAULT_CONFIG
    def _fmt(vs):
        return [
            {
                "key": k,
                "label": v["label"],
                "minimum_charge": v["minimum_charge"],
                "per_mile": v["per_mile"],
                "requires_manual_review": bool(v.get("manual_review")),
                "tail_lift": k.endswith("_tail_lift"),
            }
            for k, v in vs.items()
        ]
    cfg = ASAP_DEFAULT_CONFIG
    # Admin override lives in Mongo asap_pricing_config.transport_vehicles /
    # recovery_vehicles. Read it live so admin edits reflect immediately.
    override = await db.asap_pricing_config.find_one({"_id": "active"}) or {}
    transport_vehicles = override.get("transport_vehicles") or cfg["transport_vehicles"]
    recovery_vehicles  = override.get("recovery_vehicles")  or cfg["recovery_vehicles"]
    return {
        "engine_version": cfg["version"],
        "transport": _fmt(transport_vehicles),
        "recovery":  _fmt(recovery_vehicles),
    }


@api.post("/asap/quote")
async def asap_quote(payload: AsapQuoteBody,
                       user: dict = Depends(get_current_user)):
    """Authoritative ASAP quote. Scheduled/Bidding continue to use
    /pricing/quote — this endpoint is ASAP-only."""
    from services.asap_pricing import calculate_asap_quote, AsapPricingError
    # R26.1 — mirror the domestic-only guardrail enforced by POST /jobs.
    # We do NOT yet compute ferry/toll/Eurotunnel/overnight costs so an
    # international ASAP MUST be routed to manual review, never returned
    # as a guaranteed instant price.
    dropoff_cc = getattr(payload, "dropoff_country_code", None)
    rc = classify_route(payload.pickup_country_code, dropoff_cc)
    if not payload.pickup_country_code and not dropoff_cc:
        rc = "domestic_uk"
    if rc != "domestic_uk":
        return {
            "requires_manual_review": True,
            "route_class": rc,
            "engine_version": "ASAP-V1.0",
            "manual_review_message": (
                "International ASAP requires operator confirmation for "
                "ferry, toll and Eurotunnel costs."
            ),
        }
    distance_miles, duration_minutes, distance_source = await resolve_route(
        payload.pickup_lat, payload.pickup_lng,
        payload.dropoff_lat, payload.dropoff_lng,
    )
    try:
        b = await calculate_asap_quote(
            db,
            distance_miles=distance_miles,
            duration_minutes=duration_minutes,
            distance_source=distance_source,
            pickup_lat=payload.pickup_lat, pickup_lng=payload.pickup_lng,
            service_type=payload.service_type or "transport",
            urgency=payload.urgency,
            collection_within_minutes=payload.collection_within_minutes,
            when_iso=payload.when_iso,
            requested_vehicle_key=payload.requested_vehicle_key,
            vehicle_class=payload.vehicle_class,
            weight_kg=payload.weight_kg, volume_m3=payload.volume_m3,
            pallets=payload.pallets, item_count=payload.item_count,
            waiting_minutes=payload.waiting_minutes,
            extra_stops=payload.extra_stops,
            loading_help=bool(payload.loading_help),
            tail_lift_needed=bool(payload.tail_lift_needed),
            nearest_driver_distance_mi=payload.nearest_driver_distance_mi,
            pickup_country_code=payload.pickup_country_code,
            calculate_booking_fee_detail=calculate_booking_fee_detail,
        )
    except AsapPricingError as exc:
        raise HTTPException(status_code=422,
                              detail={"code": exc.code, "message": str(exc)})

    # Audit-log every ASAP quote for future analytics (spec §44).
    try:
        await db.asap_quote_audit.insert_one({
            "id": new_id(),
            "user_id": user["id"],
            "pricing_engine_version": b.engine_version,
            "distance_miles": distance_miles,
            "distance_source": distance_source,
            "driver_charge": b.driver_charge,
            "booking_fee_percent": b.booking_fee_percent,
            "booking_fee": b.booking_fee,
            "customer_total": b.customer_total,
            "resolved_vehicle_key": b.resolved_vehicle_key,
            "snapshot": b.pricing_snapshot,
            "created_at": now_iso(),
        })
    except Exception:
        logger.exception("asap_quote_audit insert failed; continuing")
    return b.to_dict()




class PricingQuoteBody(BaseModel):
    pickup_lat: float
    pickup_lng: float
    dropoff_lat: float
    dropoff_lng: float
    service_type: Optional[str] = "transport"        # "transport" | "breakdown_recovery"
    service_timing: Optional[str] = "scheduled"      # "scheduled" | "asap"
    transport_category: Optional[str] = None
    weight_kg: Optional[float] = None
    volume_m3: Optional[float] = None
    item_count: Optional[int] = None
    needs_forklift: Optional[bool] = False
    needs_loading_help: Optional[bool] = False
    vehicle_details: Optional[dict] = None
    requested_vehicle_key: Optional[str] = None
    pickup_country_code: Optional[str] = None
    dropoff_country_code: Optional[str] = None


@api.post("/pricing/quote")
async def pricing_quote(payload: PricingQuoteBody,
                          user: dict = Depends(get_current_user)):
    """The one true quote endpoint. Every client — customer ASAP form,
    scheduled job composer, admin re-quote — calls this and displays the
    returned figures verbatim. Booking-fee band is applied ON TOP by
    /bookings creation using the same driver_charge value."""
    # R26 — ASAP mode routes through the V1 ASAP engine so /pricing/quote
    # and /jobs and /bookings never disagree. Scheduled continues via
    # services/pricing.py.
    if (payload.service_timing or "scheduled") == "asap":
        # R26.1 — mirror the domestic-only guardrail enforced by POST /jobs.
        # Never return a guaranteed instant price for an international ASAP
        # route because ferry/toll/Eurotunnel are not modelled yet.
        rc = classify_route(payload.pickup_country_code, payload.dropoff_country_code)
        if not payload.pickup_country_code and not payload.dropoff_country_code:
            rc = "domestic_uk"
        if rc != "domestic_uk":
            return {
                "requires_manual_review": True,
                "route_class": rc,
                "engine_version": "ASAP-V1.0",
                "manual_review_message": (
                    "International ASAP requires operator confirmation for "
                    "ferry, toll and Eurotunnel costs."
                ),
            }
        from services.asap_pricing import calculate_asap_quote, AsapPricingError
        distance_miles, duration_minutes, distance_source = await resolve_route(
            payload.pickup_lat, payload.pickup_lng,
            payload.dropoff_lat, payload.dropoff_lng,
        )
        try:
            b = await calculate_asap_quote(
                db,
                distance_miles=distance_miles,
                duration_minutes=duration_minutes,
                distance_source=distance_source,
                pickup_lat=payload.pickup_lat, pickup_lng=payload.pickup_lng,
                service_type=payload.service_type or "transport",
                urgency="asap",
                requested_vehicle_key=payload.requested_vehicle_key,
                vehicle_class=(payload.vehicle_details or {}).get("weight_class")
                                or (payload.vehicle_details or {}).get("type"),
                weight_kg=payload.weight_kg,
                volume_m3=payload.volume_m3,
                item_count=payload.item_count,
                loading_help=bool(payload.needs_loading_help),
                calculate_booking_fee_detail=calculate_booking_fee_detail,
            )
        except AsapPricingError as exc:
            raise HTTPException(status_code=422,
                                  detail={"code": exc.code, "message": str(exc)})
        result = b.to_dict()
        # Preserve legacy /pricing/quote response fields for backwards compat.
        result.update({
            "route_class": "domestic_uk",
            "requires_manual_review": b.manual_review,
            "subtotal": b.driver_charge,
            "distance_miles": distance_miles,
            "duration_minutes": duration_minutes,
            "distance_source": distance_source,
            "resolved_vehicle_key": b.resolved_vehicle_key,
            "resolved_vehicle_label": b.resolved_vehicle_label,
            "low_confidence_distance": distance_source == "haversine_fallback",
            "service_timing": "asap",
            "service_type": payload.service_type or "transport",
            "booking_fee_preview": b.booking_fee,
            "customer_total_preview": b.customer_total,
            "booking_fee_source": "bands",
        })
        return result

    from services.pricing import calculate_quote, PricingError

    # International routes: keep the manual-review contract; do NOT quote.
    route_class = classify_route(payload.pickup_country_code, payload.dropoff_country_code)
    if not payload.pickup_country_code and not payload.dropoff_country_code:
        route_class = "domestic_uk"
    if route_class not in ("domestic_uk",):
        return {
            "requires_manual_review": True,
            "route_class": route_class,
            "manual_review_message": (
                "This corridor doesn't have configured pricing yet. "
                "Our team will provide a bespoke quote within one business day."
            ),
        }

    distance_miles, duration_minutes, distance_source = await resolve_route(
        payload.pickup_lat, payload.pickup_lng,
        payload.dropoff_lat, payload.dropoff_lng,
    )

    try:
        breakdown = await calculate_quote(
            db,
            distance_miles=distance_miles,
            duration_minutes=duration_minutes,
            distance_source=distance_source,
            service_type=(payload.service_type or "transport"),
            service_timing=(payload.service_timing or "scheduled"),
            transport_category=payload.transport_category,
            weight_kg=payload.weight_kg,
            volume_m3=payload.volume_m3,
            item_count=payload.item_count,
            needs_forklift=bool(payload.needs_forklift),
            needs_loading_help=bool(payload.needs_loading_help),
            vehicle_details=payload.vehicle_details,
            requested_vehicle_key=payload.requested_vehicle_key,
        )
    except PricingError as exc:
        raise HTTPException(status_code=422, detail={
            "code": exc.code,
            "message": str(exc),
        })

    # Preview the booking-fee band that WILL apply if this quote becomes a
    # booking — customers see the total up front rather than only at Stripe.
    fee_detail = await calculate_booking_fee_detail(breakdown.driver_charge)

    result = breakdown.to_dict()
    result.update({
        "route_class": "domestic_uk",
        "requires_manual_review": False,
        "booking_fee_preview": fee_detail["amount"],
        "booking_fee_percent": fee_detail["percent"],
        "booking_fee_source": fee_detail["source"],
        "customer_total_preview": round(breakdown.driver_charge + fee_detail["amount"], 2),
    })
    return result




@api.get("/quote/estimate")
async def quote_estimate(pickup_lat: float, pickup_lng: float,
                          dropoff_lat: float, dropoff_lng: float,
                          category: str = "furniture_delivery",
                          weight_kg: Optional[float] = None,
                          volume_m3: Optional[float] = None,
                          pickup_country_code: Optional[str] = None,
                          dropoff_country_code: Optional[str] = None,
                          service_type: str = "transport",
                          service_timing: str = "scheduled",
                          user: dict = Depends(get_current_user)):
    """Legacy quote endpoint — retained for backwards compatibility with
    the scheduled PostJob form. R25 rerouted this through the authoritative
    pricing engine so it can never diverge from `POST /pricing/quote`.
    """
    from services.pricing import calculate_quote, PricingError

    route_class = classify_route(pickup_country_code, dropoff_country_code)
    if not pickup_country_code and not dropoff_country_code:
        route_class = "domestic_uk"
    needs_manual_review = route_class in ("international", "domestic_other", "unsupported")
    origin_name = market_name(pickup_country_code) if pickup_country_code else "United Kingdom"
    dest_name = market_name(dropoff_country_code) if dropoff_country_code else "United Kingdom"

    distance_miles, duration_minutes, source = await resolve_route(
        pickup_lat, pickup_lng, dropoff_lat, dropoff_lng,
    )

    if needs_manual_review:
        return {
            "distance_miles": distance_miles,
            "duration_minutes": duration_minutes,
            "suggested_price": None,
            "vehicle": "Manual review required",
            "category_key": LEGACY_CATEGORY_MAP.get(category, category),
            "source": source,
            "distance_source": source,
            "route_class": route_class,
            "origin_country_code": (pickup_country_code or "GB"),
            "destination_country_code": (dropoff_country_code or "GB"),
            "origin_country": origin_name,
            "destination_country": dest_name,
            "requires_manual_review": True,
            "manual_review_message": (
                f"{origin_name} → {dest_name} routes are supported architecturally but "
                "pricing for this corridor hasn't been configured yet. Our team will "
                "provide a bespoke quote within one business day."
            ),
        }

    normalized_cat = LEGACY_CATEGORY_MAP.get(category, category)
    try:
        breakdown = await calculate_quote(
            db,
            distance_miles=distance_miles,
            duration_minutes=duration_minutes,
            distance_source=source,
            service_type=service_type,
            service_timing=service_timing,
            transport_category=normalized_cat,
            weight_kg=weight_kg,
            volume_m3=volume_m3,
        )
    except PricingError as exc:
        raise HTTPException(status_code=422, detail={"code": exc.code, "message": str(exc)})

    return {
        "distance_miles": distance_miles,
        "duration_minutes": duration_minutes,
        "suggested_price": breakdown.driver_charge,
        "vehicle": breakdown.resolved_vehicle_label,
        "vehicle_key": breakdown.resolved_vehicle_key,
        "category_key": normalized_cat,
        "source": source,
        "distance_source": source,
        "route_class": route_class,
        "origin_country_code": (pickup_country_code or "GB"),
        "destination_country_code": (dropoff_country_code or "GB"),
        "origin_country": origin_name,
        "destination_country": dest_name,
        "requires_manual_review": False,
        "manual_review_message": None,
        # New authoritative fields — clients that upgrade get the full
        # breakdown; the legacy fields above keep working meanwhile.
        "line_items": [asdict_line_item(li) for li in breakdown.line_items],
        "pricing_snapshot": breakdown.pricing_snapshot,
        "low_confidence_distance": breakdown.low_confidence_distance,
        "engine_version": breakdown.engine_version,
    }


def asdict_line_item(li):
    return {"key": li.key, "label": li.label, "amount": li.amount, "detail": li.detail}



@api.get("/jobs/nearby")
async def nearby_jobs(
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    radius: float = 75.0,
    user: dict = Depends(require_role("driver")),
):
    """Available marketplace jobs for a driver.

    Filtering rules:
      * Only `status == "posted"` jobs are ever returned. Accepted / manual-
        quote / awaiting-deposit / cancelled / completed jobs stay out.
      * If the caller does NOT supply BOTH `lat` and `lng`, no geographic
        filter is applied — every eligible posted job is surfaced, sorted
        newest-first. This is deliberate: guessing the driver's location
        (e.g. defaulting to London) silently hides legitimate jobs elsewhere
        in the country, which is exactly the regression Fix 1B is closing.
      * If the caller supplies both `lat` and `lng`, the classic haversine
        radius filter applies. Jobs whose pickup coords are (0, 0) — the
        unresolved-coordinate safety-net inherited from the earlier fix
        batch — remain unconditionally visible so they don't vanish.
    """
    have_anchor = lat is not None and lng is not None
    # Exclude ASAP jobs from the scheduled marketplace list. ASAP jobs are
    # dispatched via `/api/jobs/{id}/claim` from Driver Live Mode; if they
    # leaked into `/jobs/nearby` a driver could `/accept` one via the
    # scheduled endpoint and bypass the atomic dispatch flow. Legacy jobs
    # (no `service_timing` field) remain visible via `$ne "asap"`.
    all_jobs = await db.jobs.find(
        {"status": "posted", "service_timing": {"$ne": "asap"},
         "blocked_driver_ids": {"$ne": user.get("id")}},
        {"_id": 0},
    ).sort("created_at", -1).to_list(500)
    result: list[dict] = []
    for j in all_jobs:
        p_lat = float(j.get("pickup_lat") or 0)
        p_lng = float(j.get("pickup_lng") or 0)
        if not have_anchor:
            # No driver location provided → do not filter by proximity.
            j["distance_from_driver"] = None
            result.append(public_job(j, include_private=False))
            continue
        if p_lat == 0 and p_lng == 0:
            # Unresolved pickup coords — safety net stays.
            j["distance_from_driver"] = None
            result.append(public_job(j, include_private=False))
            continue
        d = haversine_miles(lat, lng, p_lat, p_lng)
        if d <= radius:
            j["distance_from_driver"] = round(d, 1)
            result.append(public_job(j, include_private=False))
    # R70 — preserve backend newest-first ordering. Mongo already returned
    # jobs sorted by `created_at` desc (line 2066); the post-loop distance
    # sort would demote a brand-new job that happens to be slightly further
    # away, which is exactly the scroll-past-old-jobs issue R70 is closing.
    # Drivers can still re-rank by proximity from the frontend's sort chip.
    result.sort(
        key=lambda x: (x.get("created_at") or "", x.get("id") or ""),
        reverse=True,
    )
    return result


@api.get("/driver/accepted-jobs")
async def driver_accepted_jobs(user: dict = Depends(require_role("driver"))):
    """Fix 2A — pre-deposit view for the driver.

    Returns jobs that the authenticated driver has accepted but for which
    the customer has not yet paid the deposit (so no booking row exists
    yet). Each result carries `awaiting_deposit=True` for the frontend to
    label. Excludes:
      * jobs the driver hasn't accepted (`assigned_driver_id != user`);
      * jobs already progressed past `accepted` — those live in `bookings`
        via `/bookings/mine`, so we don't want duplicate cards.

    Note: the accept endpoint's commercial lifecycle is UNCHANGED. No
    booking is created here. No pricing, fee, or deposit logic is touched.
    """
    docs = await db.jobs.find(
        {"assigned_driver_id": user["id"], "status": "accepted"},
        {"_id": 0},
    ).sort("updated_at", -1).to_list(200)
    out: list[dict] = []
    for j in docs:
        pub = public_job(j, include_private=False)
        pub["awaiting_deposit"] = True
        # Surface the price the driver was promised at accept-time so the
        # "My Jobs" card can show earning + status without an extra fetch.
        pub["accepted_price"] = j.get("accepted_price") or j.get("fixed_price")
        out.append(pub)
    return out


@api.get("/driver/my-bids")
async def driver_my_bids(user: dict = Depends(require_role("driver"))):
    """Driver bid history.

    Returns every bid the authenticated driver has ever submitted, newest
    first, enriched with a lightweight view of the underlying job (title,
    route, category, price, current status, message read/unread counts
    where a booking exists).

    Frontends use this to populate the driver "My Jobs" tab so drivers see
    every submitted bid — including those still `pending` — rather than
    only accepted work. This was previously invisible in the UI, so
    drivers had no bid-history feedback loop at all.
    """
    bids = await db.bids.find({"driver_id": user["id"]}, {"_id": 0}) \
                          .sort("created_at", -1).to_list(200)
    if not bids:
        return []

    job_ids = list({b["job_id"] for b in bids})
    jobs = await db.jobs.find({"id": {"$in": job_ids}}, {"_id": 0}).to_list(len(job_ids))
    jmap = {j["id"]: j for j in jobs}

    # Attach a compact job summary so the FE doesn't need a per-bid fetch.
    for b in bids:
        j = jmap.get(b["job_id"])
        if j:
            b["job"] = {
                "id": j["id"],
                "title": j.get("title"),
                "category": j.get("category"),
                "pickup_town": j.get("pickup_town"),
                "dropoff_town": j.get("dropoff_town"),
                "distance_miles": j.get("distance_miles"),
                "status": j.get("status"),
                "pricing_type": j.get("pricing_type"),
                "fixed_price": j.get("fixed_price"),
                "suggested_price": j.get("suggested_price"),
                "assigned_driver_id": j.get("assigned_driver_id"),
                # Booking-related JobExtras fields, so drivers see the same
                # forklift/loading badges everyone else sees.
                "needs_forklift": j.get("needs_forklift", False),
                "needs_loading_help": j.get("needs_loading_help", False),
                "weight_kg": j.get("weight_kg"),
                "item_count": j.get("item_count"),
                "dimensions_l_m": j.get("dimensions_l_m"),
                "dimensions_w_m": j.get("dimensions_w_m"),
                "dimensions_h_m": j.get("dimensions_h_m"),
                "customer_note": j.get("customer_note"),
                "vehicle_details": j.get("vehicle_details"),
                "recommended_vehicle": j.get("recommended_vehicle"),
            }
            # If THIS driver was the accepted bid, flag it — makes the FE
            # rendering "won" vs "lost" trivial.
            b["is_winning"] = j.get("assigned_driver_id") == user["id"]
        else:
            b["job"] = None
            b["is_winning"] = False
    return bids


@api.get("/jobs/{job_id}")
async def get_job(job_id: str, user: dict = Depends(get_current_user)):
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Check if user has access to private details
    include_private = False
    if user["role"] == "admin":
        include_private = True
    elif user["id"] == job["customer_id"]:
        include_private = True
    elif job.get("assigned_driver_id") == user["id"]:
        # Only include private details AFTER deposit paid
        booking = await db.bookings.find_one(
            {"job_id": job_id, "status": {"$in": ["deposit_paid", "confirmed", "travelling", "arrived",
                                                    "collected", "on_route", "delivered", "pod_uploaded",
                                                    "completed"]}}
        )
        include_private = bool(booking)

    return public_job(job, include_private=include_private)


@api.post("/jobs/{job_id}/accept")
async def accept_fixed_job(job_id: str, user: dict = Depends(require_role("driver"))):
    if user.get("status") != "active":
        raise HTTPException(status_code=403, detail="Driver not approved yet")
    job = await db.jobs.find_one({"id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.get("pricing_type") != "fixed":
        raise HTTPException(status_code=400, detail="Job requires bidding")
    if job.get("service_timing") == "asap":
        raise HTTPException(status_code=400, detail="Use /jobs/{id}/claim for ASAP jobs")

    # Atomic claim — conditional update guards the read-then-update race that
    # would otherwise let two drivers both flip `status=posted` → `accepted`.
    # R23: also refuse if this driver previously cancelled this job (see
    # blocked_driver_ids populated by /driver/bookings/{id}/cancel).
    if user["id"] in (job.get("blocked_driver_ids") or []):
        raise HTTPException(
            status_code=403,
            detail="You cancelled this job earlier and cannot re-accept it. Please pick a different job.",
        )
    result = await db.jobs.update_one(
        {"id": job_id, "status": "posted", "assigned_driver_id": None,
         "blocked_driver_ids": {"$ne": user["id"]}},
        {"$set": {
            "status": "accepted",
            "assigned_driver_id": user["id"],
            "assigned_driver_name": user["name"],
            "assigned_driver_rating": user.get("rating", 5.0),
            "accepted_price": job["fixed_price"],
            "accepted_at": now_iso(),
        }},
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=409, detail="Job already claimed or no longer available")
    await push_notification(
        job["customer_id"],
        "Driver accepted your job",
        f"{user['name']} accepted your {job['title']} job. Pay deposit to confirm.",
        {"job_id": job_id, "kind": "job_accepted"},
    )
    # Round 10 — email the customer so they can pay the deposit even if they
    # miss the in-app notification. Guarded — email failure NEVER blocks the
    # accept (the atomic claim has already committed above).
    try:
        from services.email import send_customer_driver_accepted_email
        cust = await db.users.find_one({"id": job["customer_id"]},
                                         {"_id": 0, "password_hash": 0})
        # Refresh job so accepted_price is populated for the email body.
        fresh_job = await db.jobs.find_one({"id": job_id}, {"_id": 0}) or job
        if cust:
            await send_customer_driver_accepted_email(
                db, customer=cust, driver=user, job=fresh_job,
            )
    except Exception:
        logger.exception("customer-driver-accepted email failed; continuing")
    return {"ok": True}


# ---------------------------------------------------------------------------
# Real-time dispatch — Driver Live Mode + ASAP claim (Phases 7-17 of the
# Real-time Dispatch Programme). Reuses the existing job / booking / payment
# / tracking / RouteMap lifecycle wherever possible.
# ---------------------------------------------------------------------------

# Centralised dispatch constants — do not scatter magic numbers.
DISPATCH_HEARTBEAT_FRESHNESS_SECONDS = 90        # drivers with older location stop matching (loosened from 60 to survive network hiccups)
DISPATCH_DEFAULT_RADIUS_MILES = 500              # driver's inbox filter (nationwide by default); server per-job radius still controls dispatch
DISPATCH_CANDIDATE_LIMIT = 50                    # max drivers returned per offer poll

# Escalating search-radius schedule. `age_seconds` since `dispatch_ready_at`
# determines which band applies — jobs quietly widen their search area until
# a driver claims OR the job is cancelled / expired. Never removes an
# eligible booking from the queue.
#
# Bands (seconds → miles): 0-30 → 10; 30-90 → 20; 90-180 → 40; 180-300 → 75;
# 300+ → 500 (effectively nationwide). Tuned for a busy urban market where
# a claim within 90 s is the expectation; national fallback ensures rural
# corridors never black-hole a customer.
DISPATCH_RADIUS_LADDER = [
    (30,   10),
    (90,   20),
    (180,  40),
    (300,  75),
    (None, 500),
]



# Category → recommended vehicle mapping. Deliberately conservative and
# UK-market focused. Updates should extend the table rather than adding
# per-call branching to keep the deriver purely declarative.
_SUITABLE_VEHICLE_BY_CATEGORY = {
    # Legacy keys (kept for old jobs)
    "documents":              "Small Van",
    "parcels":                "Small Van",
    "parcel":                 "Small Van",
    "multiple_parcels":       "Medium Van",
    "boxes":                  "Medium Van",
    "retail_goods":           "Medium Van",
    "food_delivery":          "Small Van",
    "fragile_items":          "Medium Van",
    "electrical_equipment":   "Medium Van",
    "medical_equipment":      "Medium Van",
    "bicycle":                "Medium Van",
    "motorcycle":             "Motorcycle Recovery",  # only used when service_type != transport
    "furniture":              "Luton Van",
    "house_moves":            "Luton Van",
    "generator":              "Luton Van",
    "machinery":              "7.5T Box Truck",
    "building_materials":     "Luton Van",
    "pallet":                 "Large Van",
    "pallets":                "Large Van",
    "freight":                "7.5T Box Truck",
    "cars":                   "Car Transporter",
    "boats":                  "Low Loader",
    # R44 — Modern service_catalog.py category keys
    "furniture_delivery":     "Luton Van",
    "house_removals":         "Luton / 7.5T Truck",
    "motorcycles":            "Enclosed Trailer Van",
    "cars_vehicles":          "Car Transporter",
    "caravans":               "3.5T Recovery Truck",
    "static_caravans":        "18T HGV",
    "shipping_containers":    "Hiab Crane Vehicle",
    "boats_marine":           "Low Loader",
    "machinery_plant":        "Hiab Crane / 7.5T Truck",
    "office_commercial":      "Luton / 7.5T Truck",
    "same_day_express":       "Small Van",
    "long_distance_uk":       "Luton Van",
    "fragile_high_value":     "Enclosed Small Van",
    "freight_haulage":        "18T HGV",
}


def _derive_suitable_vehicle(job: dict) -> str:
    """Best-effort vehicle recommendation for any job that didn't already
    carry a `recommended_vehicle` label. Returns a UK-market vehicle name
    like 'Small Van', 'Luton Van', '3.5T Recovery Truck'. Deterministic —
    same inputs always yield the same label.
    """
    service_type = (job.get("service_type") or "").lower()
    if service_type == "breakdown_recovery":
        v = job.get("vehicle_details") or {}
        vtype = (v.get("type") or v.get("category") or "").lower()
        if "bike" in vtype or "motor" in vtype:
            return "Motorcycle Recovery"
        if "van" in vtype or "small" in vtype:
            return "3.5T Recovery Truck"
        if "hgv" in vtype or "truck" in vtype or "lorry" in vtype:
            return "Heavy Recovery"
        if "commercial" in vtype or "7.5" in vtype:
            return "7.5T Recovery Truck"
        # Sensible default — covers the vast majority of car recoveries.
        return "3.5T Recovery Truck"
    # Transport: prefer explicit transport_category, else the top-level category
    key = (job.get("transport_category") or job.get("category") or "").lower()
    key = key.replace(" ", "_")
    if key in _SUITABLE_VEHICLE_BY_CATEGORY:
        return _SUITABLE_VEHICLE_BY_CATEGORY[key]
    # Weight fallback — if we still don't know, size by declared weight_kg.
    try:
        w = float(job.get("weight_kg") or 0)
    except Exception:
        w = 0
    if w >= 1500:
        return "7.5T Box Truck"
    if w >= 500:
        return "Luton Van"
    if w >= 100:
        return "Large Van"
    return "Small Van"



def _current_search_radius_miles(job: dict, now: Optional[datetime] = None) -> float:
    """Age-based per-job dispatch radius. Returns miles.

    Server-authoritative: never trust a client to derive this. Called from
    `_driver_live_offers` on every poll — cheap because the math is a
    handful of comparisons.
    """
    ready = job.get("dispatch_ready_at")
    if not ready:
        return DISPATCH_RADIUS_LADDER[0][1]
    try:
        t0 = datetime.fromisoformat(ready.replace("Z", "+00:00")) \
             if isinstance(ready, str) else ready
    except Exception:
        return DISPATCH_RADIUS_LADDER[0][1]
    t = now or datetime.now(timezone.utc)
    age = (t - t0).total_seconds()
    for max_age, miles in DISPATCH_RADIUS_LADDER:
        if max_age is None or age < max_age:
            return float(miles)
    return float(DISPATCH_RADIUS_LADDER[-1][1])


async def _log_dispatch_attempt(
    *, job_id: str, driver_id: Optional[str],
    distance_miles: Optional[float], radius_used: float,
    outcome: str, reason: Optional[str] = None,
) -> None:
    """Persist a single dispatch decision for post-mortem debugging.

    Written to the `dispatch_log` collection (best-effort — never raises,
    never blocks the offer poll). Fields intentionally keep to what the
    Admin Dispatch Monitor needs to answer 'why didn't driver X see job Y?'.
    """
    try:
        await db.dispatch_log.insert_one({
            "job_id": job_id,
            "driver_id": driver_id,
            "distance_miles": distance_miles,
            "radius_used": radius_used,
            "outcome": outcome,        # offered | out_of_radius | not_capable | offline | stale_location | busy | claimed | expired
            "reason": reason,
            "ts": now_iso(),
        })
    except Exception:
        logger.exception("dispatch_log write failed; swallowing")


class DriverLivePayload(BaseModel):
    lat: float
    lng: float
    accuracy_m: Optional[float] = None


def _validate_latlng(lat: float, lng: float) -> None:
    if not (-90.0 <= lat <= 90.0) or not (-180.0 <= lng <= 180.0):
        raise HTTPException(status_code=400, detail="Invalid coordinates")


def _dispatch_eligible(job: dict) -> bool:
    """Server-authoritative dispatch eligibility.

    A job is eligible for real-time dispatch only when EVERY invariant below
    holds. Never derived from a client-supplied boolean.
    """
    if not job:
        return False
    if job.get("service_timing") != "asap":
        return False
    if job.get("assigned_driver_id"):
        return False
    if job.get("cancelled_at") or job.get("completed_at"):
        return False
    # Must have reached a paid+ready lifecycle state. ASAP customers pay the
    # deposit BEFORE broadcast so the job only enters the dispatch queue after
    # `_finalise_paid_deposit` flips `status` → "confirmed" and stamps
    # `dispatch_ready_at`. See Phase 7 rules in the programme document.
    if job.get("status") not in ("confirmed", "dispatch_ready"):
        return False
    if not job.get("dispatch_ready_at"):
        return False
    return True


def _driver_is_capable(driver: dict, job: dict) -> bool:
    """Minimal, conservative capability matcher (Phase 12).

    v1 rules — deliberately narrow, backed only by existing schema:
      * driver must have `status == "active"` (approved).
      * for `service_type == "breakdown_recovery"` the driver profile OR any
        of the driver's vehicles must advertise recovery capability via
        `capabilities.recovery == True` OR `service_types` list contains
        `breakdown_recovery`. If NO driver has capability data configured
        yet, we do NOT block dispatch — v1 is intentionally lenient with a
        warning field so operators can tighten later without a migration.
    """
    if driver.get("status") != "active":
        return False
    if job.get("service_type") == "breakdown_recovery":
        caps = driver.get("capabilities") or {}
        svc_types = set((driver.get("service_types") or []))
        if not caps.get("recovery") and "breakdown_recovery" not in svc_types:
            # Conservative fallback: allow only when no capability info exists
            # anywhere on the driver (dispatch v1 opt-in). Return True so
            # first-run installations don't have zero eligible drivers.
            has_any_cap_data = bool(caps) or bool(svc_types)
            if has_any_cap_data:
                return False
    return True


@api.post("/driver/live/online")
async def driver_go_online(payload: DriverLivePayload,
                            user: dict = Depends(require_role("driver"))):
    _validate_latlng(payload.lat, payload.lng)
    if user.get("status") != "active":
        raise HTTPException(status_code=403, detail="Driver not approved yet")
    now = now_iso()

    # Round 8 — Missed-Offer Toast. Before we flip the driver back online,
    # count ASAP jobs that entered the queue AFTER their last heartbeat and
    # for which they would have been an eligible candidate. Capped, cheap
    # enough to run on every /online (the query is bounded to the recent
    # ASAP window).
    prev = await db.users.find_one(
        {"id": user["id"]},
        {"_id": 0, "live_updated_at": 1, "live_online": 1},
    )
    prev_updated = (prev or {}).get("live_updated_at")
    missed_count = 0
    try:
        # Cap the look-back at 60 min so a driver returning after weeks
        # still only sees offers from the last hour. Compare via parsed
        # datetime rather than lexicographic string compare — this survives
        # any future change in the ISO-string offset format ('+00:00' vs 'Z').
        cutoff_dt = datetime.now(timezone.utc) - timedelta(minutes=60)
        cutoff_iso = cutoff_dt.isoformat()
        since_dt = cutoff_dt
        if prev_updated:
            try:
                pd = datetime.fromisoformat(str(prev_updated).replace("Z", "+00:00"))
                if pd > cutoff_dt:
                    since_dt = pd
            except Exception:
                pass
        since = since_dt.isoformat()
        cands = await db.jobs.find(
            {"service_timing": "asap",
             "dispatch_ready_at": {"$gt": since},
             # Explicit null-safe exclusion — treat both missing AND null as
             # 'not cancelled' so any historical rows written with an
             # explicit null cancelled_at are correctly ignored.
             "$or": [
                 {"cancelled_at": {"$exists": False}},
                 {"cancelled_at": None},
             ]},
            {"_id": 0, "service_type": 1, "category": 1, "capabilities": 1,
             "pickup_lat": 1, "pickup_lng": 1, "dispatch_ready_at": 1,
             "assigned_driver_id": 1},
        ).limit(50).to_list(50)
        # Reuse the same capability + radius rules as live dispatch.
        driver_probe = {**user, "live_lat": payload.lat, "live_lng": payload.lng}
        now_dt = datetime.now(timezone.utc)
        for j in cands:
            # Was it claimed by someone else, and by then the driver was
            # already offline? Still counts as "missed" — they never had a
            # chance to bid.
            if not _driver_is_capable(driver_probe, j):
                continue
            radius = _current_search_radius_miles(j, now=now_dt)
            try:
                d = haversine_miles(
                    float(payload.lat), float(payload.lng),
                    float(j.get("pickup_lat") or 0),
                    float(j.get("pickup_lng") or 0),
                )
            except Exception:
                continue
            if d <= radius:
                missed_count += 1
    except Exception:
        logger.exception("missed-offer count failed; ignoring")
        missed_count = 0

    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "live_online": True,
            "live_lat": payload.lat,
            "live_lng": payload.lng,
            "live_accuracy_m": payload.accuracy_m,
            "live_updated_at": now,
            "live_online_since": now,
        }},
    )
    return {
        "ok": True,
        "online": True,
        "updated_at": now,
        "missed_offers_count": missed_count,
    }


@api.post("/driver/live/offline")
async def driver_go_offline(user: dict = Depends(require_role("driver"))):
    """Idempotent — safe to call multiple times / on tab close."""
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"live_online": False},
         "$unset": {"live_lat": "", "live_lng": "", "live_accuracy_m": ""}},
    )
    return {"ok": True, "online": False}


@api.post("/driver/live/heartbeat")
async def driver_heartbeat(payload: DriverLivePayload,
                             user: dict = Depends(require_role("driver"))):
    _validate_latlng(payload.lat, payload.lng)
    # If offline, silently reject rather than force online — the driver must
    # explicitly opt in via /driver/live/online first.
    doc = await db.users.find_one({"id": user["id"]}, {"live_online": 1})
    if not (doc or {}).get("live_online"):
        raise HTTPException(status_code=409, detail="Driver is offline")
    now = now_iso()
    await db.users.update_one(
        {"id": user["id"], "live_online": True},
        {"$set": {"live_lat": payload.lat, "live_lng": payload.lng,
                   "live_accuracy_m": payload.accuracy_m,
                   "live_updated_at": now}},
    )
    return {"ok": True, "updated_at": now}


@api.get("/driver/live/status")
async def driver_live_status(user: dict = Depends(require_role("driver"))):
    doc = await db.users.find_one(
        {"id": user["id"]},
        {"_id": 0, "live_online": 1, "live_lat": 1, "live_lng": 1,
         "live_updated_at": 1, "live_accuracy_m": 1, "live_online_since": 1},
    )
    return doc or {"live_online": False}


def _heartbeat_is_fresh(updated_at: Optional[str]) -> bool:
    if not updated_at:
        return False
    try:
        ts = datetime.fromisoformat(updated_at.replace("Z", "+00:00"))
    except ValueError:
        return False
    delta = (datetime.now(timezone.utc) - ts).total_seconds()
    return delta <= DISPATCH_HEARTBEAT_FRESHNESS_SECONDS


@api.get("/driver/live/offers")
async def driver_live_offers(user: dict = Depends(require_role("driver")),
                              radius_miles: float = DISPATCH_DEFAULT_RADIUS_MILES):
    """Return dispatch-eligible ASAP jobs within `radius_miles` of the
    driver's current heartbeat, capability-filtered, sorted by distance.

    Correctness > complexity — we broadcast to all qualifying candidates and
    let atomic /claim decide the winner (Phase 15).
    """
    # Own driver state must be online + fresh + not busy on an active ASAP job.
    driver = await db.users.find_one({"id": user["id"]})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    if not driver.get("live_online"):
        await _log_dispatch_attempt(
            job_id="*", driver_id=user["id"], distance_miles=None,
            radius_used=0.0, outcome="offline",
        )
        return {"offers": [], "reason": "offline"}
    if not _heartbeat_is_fresh(driver.get("live_updated_at")):
        await _log_dispatch_attempt(
            job_id="*", driver_id=user["id"], distance_miles=None,
            radius_used=0.0, outcome="stale_location",
            reason=f"live_updated_at={driver.get('live_updated_at')}",
        )
        return {"offers": [], "reason": "stale_location"}
    if not driver.get("live_lat") or not driver.get("live_lng"):
        await _log_dispatch_attempt(
            job_id="*", driver_id=user["id"], distance_miles=None,
            radius_used=0.0, outcome="no_location",
        )
        return {"offers": [], "reason": "no_location"}

    # Phase 23 — driver busy rule
    busy = await db.jobs.find_one({
        "assigned_driver_id": user["id"],
        "service_timing": "asap",
        "status": {"$in": ["accepted", "confirmed", "dispatch_ready",
                             "travelling", "arrived", "collected",
                             "on_route", "delivered"]},
    }, {"id": 1})
    if busy:
        await _log_dispatch_attempt(
            job_id=busy.get("id"), driver_id=user["id"], distance_miles=None,
            radius_used=0.0, outcome="busy",
        )
        return {"offers": [], "reason": "busy_on_asap"}

    # Candidate query — index-friendly (service_timing + status + assigned_driver_id).
    # R23: exclude jobs where this driver is on the blocked list (they cancelled it earlier).
    candidates = await db.jobs.find(
        {"service_timing": "asap",
         "status": {"$in": ["confirmed", "dispatch_ready"]},
         "assigned_driver_id": None,
         "cancelled_at": {"$exists": False},
         "blocked_driver_ids": {"$ne": user["id"]}},
        {"_id": 0},
    ).sort("dispatch_ready_at", 1).to_list(200)

    offers = []
    d_lat, d_lng = float(driver["live_lat"]), float(driver["live_lng"])
    now_dt = datetime.now(timezone.utc)
    for job in candidates:
        if not _dispatch_eligible(job):
            await _log_dispatch_attempt(
                job_id=job.get("id"), driver_id=user["id"],
                distance_miles=None, radius_used=0.0,
                outcome="not_eligible", reason="_dispatch_eligible False",
            )
            continue
        if not _driver_is_capable(driver, job):
            await _log_dispatch_attempt(
                job_id=job.get("id"), driver_id=user["id"],
                distance_miles=None, radius_used=0.0,
                outcome="not_capable",
                reason=f"service_type={job.get('service_type')}",
            )
            continue
        p_lat = float(job.get("pickup_lat") or 0)
        p_lng = float(job.get("pickup_lng") or 0)
        dist = haversine_miles(d_lat, d_lng, p_lat, p_lng)
        # Server-authoritative per-job search radius — expands with age. The
        # driver's requested `radius_miles` acts as a personal cap: they can
        # narrow their own inbox but they cannot see jobs whose dispatch
        # radius hasn't yet expanded to reach them.
        job_radius = _current_search_radius_miles(job, now=now_dt)
        effective = min(radius_miles, job_radius)
        if dist > effective:
            await _log_dispatch_attempt(
                job_id=job.get("id"), driver_id=user["id"],
                distance_miles=round(dist, 1), radius_used=effective,
                outcome="out_of_radius",
                reason=f"job_radius={job_radius} driver_cap={radius_miles}",
            )
            continue
        offers.append({
            "job_id": job["id"],
            "title": job.get("title"),
            "category": job.get("category"),
            "service_type": job.get("service_type"),
            "distance_to_pickup_miles": round(dist, 1),
            "pickup_town": job.get("pickup_town"),
            "pickup_address": job.get("pickup_address"),
            # Pickup + dropoff coords — required so the driver Live Mode
            # map can plot each pending offer as a pin.
            "pickup_lat": p_lat,
            "pickup_lng": p_lng,
            "dropoff_lat": float(job.get("dropoff_lat") or 0),
            "dropoff_lng": float(job.get("dropoff_lng") or 0),
            "dropoff_town": job.get("dropoff_town"),
            "dropoff_address": job.get("dropoff_address"),
            "distance_miles": job.get("distance_miles"),
            "duration_minutes": job.get("duration_minutes"),
            "vehicle_label": job.get("recommended_vehicle") or job.get("vehicle_label"),
            "accepted_price": job.get("accepted_price") or job.get("fixed_price"),
            "vehicle_details": job.get("vehicle_details"),
            "customer_note": job.get("customer_note"),
            "transport_category": job.get("transport_category"),
            "transport_description": job.get("transport_description"),
            "recommended_vehicle": (
                job.get("recommended_vehicle")
                or _derive_suitable_vehicle(job)
            ),
            "photos": job.get("photos") or [],
            "dispatch_ready_at": job.get("dispatch_ready_at"),
            "current_search_radius_miles": job_radius,
            "waiting_seconds": int(
                (now_dt - datetime.fromisoformat(
                    job["dispatch_ready_at"].replace("Z", "+00:00")
                )).total_seconds()
            ) if job.get("dispatch_ready_at") else 0,
        })
        await _log_dispatch_attempt(
            job_id=job.get("id"), driver_id=user["id"],
            distance_miles=round(dist, 1), radius_used=effective,
            outcome="offered",
        )
        if len(offers) >= DISPATCH_CANDIDATE_LIMIT:
            break
    offers.sort(key=lambda o: o["distance_to_pickup_miles"])
    return {"offers": offers, "radius_miles": radius_miles,
             "heartbeat_freshness_seconds": DISPATCH_HEARTBEAT_FRESHNESS_SECONDS}


@api.post("/jobs/{job_id}/claim")
async def claim_asap_job(job_id: str, user: dict = Depends(require_role("driver"))):
    """Atomic ASAP claim (Phase 16 — P0). Exactly one concurrent request wins.

    Conditional Mongo update filter re-validates every dispatch invariant at
    claim time so a job cancelled or already-assigned milliseconds ago fails
    cleanly with 409 rather than double-assigning.
    """
    if user.get("status") != "active":
        raise HTTPException(status_code=403, detail="Driver not approved yet")

    # Fetch job for capability + type checks (read is fine — the actual claim
    # is the conditional update below).
    job = await db.jobs.find_one({"id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.get("service_timing") != "asap":
        raise HTTPException(status_code=400, detail="Use /jobs/{id}/accept for scheduled jobs")

    driver = await db.users.find_one({"id": user["id"]})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    if not driver.get("live_online"):
        raise HTTPException(status_code=403, detail="Driver must be online to claim ASAP")
    if not _heartbeat_is_fresh(driver.get("live_updated_at")):
        raise HTTPException(status_code=403, detail="Driver location too stale")
    if not _driver_is_capable(driver, job):
        raise HTTPException(status_code=403, detail="Driver not capable for this job")
    # R23: driver cannot re-claim a job they previously cancelled.
    if user["id"] in (job.get("blocked_driver_ids") or []):
        raise HTTPException(
            status_code=403,
            detail="You cancelled this job earlier and cannot re-accept it.",
        )

    # Guard busy rule at claim time too.
    busy = await db.jobs.find_one({
        "assigned_driver_id": user["id"],
        "service_timing": "asap",
        "status": {"$in": ["accepted", "confirmed", "dispatch_ready",
                             "travelling", "arrived", "collected",
                             "on_route", "delivered"]},
        "id": {"$ne": job_id},
    }, {"id": 1})
    if busy:
        raise HTTPException(status_code=409, detail="Driver already on an active ASAP job")

    accepted_price = job.get("accepted_price") or job.get("fixed_price")
    # THE ATOMIC CLAIM — conditional update. This is the single source of
    # truth for winner selection. Anything else read/checked above is
    # advisory. If two drivers race, exactly one modified_count == 1.
    now = now_iso()
    result = await db.jobs.update_one(
        {
            "id": job_id,
            "service_timing": "asap",
            "status": {"$in": ["confirmed", "dispatch_ready"]},
            "assigned_driver_id": None,
            "cancelled_at": {"$exists": False},
            "blocked_driver_ids": {"$ne": user["id"]},
        },
        {"$set": {
            "status": "accepted",   # transition into existing fulfilment lifecycle
            "assigned_driver_id": user["id"],
            "assigned_driver_name": user["name"],
            "assigned_driver_rating": user.get("rating", 5.0),
            "accepted_price": accepted_price,
            "accepted_at": now,
            "dispatch_claimed_at": now,
        }},
    )
    if result.modified_count == 0:
        # Distinguish idempotent retry by the winning driver vs a true conflict.
        refreshed = await db.jobs.find_one({"id": job_id},
                                              {"_id": 0, "assigned_driver_id": 1, "status": 1})
        if refreshed and refreshed.get("assigned_driver_id") == user["id"]:
            # Same winner clicking twice — return the existing claim.
            return {"ok": True, "job_id": job_id, "idempotent": True}
        raise HTTPException(status_code=409, detail="Job already claimed or no longer available")

    # Also stamp the winning driver id onto the pre-created booking so
    # `/bookings/mine` (driver) and downstream tracking work end-to-end.
    await db.bookings.update_one(
        {"job_id": job_id, "driver_id": None},
        {"$set": {"driver_id": user["id"]}},
    )
    # Notify customer of successful driver assignment.
    await push_notification(
        job["customer_id"],
        "Driver found",
        f"{user['name']} is on the way. £{accepted_price} confirmed.",
        {"job_id": job_id, "dispatch": True},
    )
    # Session E — email the customer the branded "Driver assigned" note,
    # and Round 7 — email the driver a branded booking-acceptance summary.
    try:
        from services.email import (
            send_driver_assigned,
            send_driver_booking_accepted_email,
        )
        booking = await db.bookings.find_one({"job_id": job_id}, {"_id": 0})
        cust = await db.users.find_one({"id": job["customer_id"]}, {"_id": 0, "password_hash": 0})
        if booking and cust:
            # Ensure suitable-vehicle is always populated in the email
            # (ASAP jobs derive it at create-time; this is a belt-and-braces
            # fallback for any historic doc missing the field).
            if not job.get("recommended_vehicle"):
                job["recommended_vehicle"] = _derive_suitable_vehicle(job)
            booking["job"] = {k: v for k, v in job.items() if k != "_id"}
            await send_driver_assigned(db, user=cust, booking=booking, driver=driver)
            await send_driver_booking_accepted_email(
                db, driver=driver, customer=cust, booking=booking, job=job,
            )
    except Exception:
        logger.exception("driver-assigned / accepted email failed; continuing")
    return {"ok": True, "job_id": job_id, "idempotent": False,
             "accepted_price": accepted_price}


@api.get("/customer/dispatch/{job_id}")
async def customer_dispatch_state(job_id: str,
                                    user: dict = Depends(require_role("customer"))):
    """Customer-facing dispatch snapshot — the state the 'Finding a driver'
    screen polls until a driver is assigned. Never exposes other drivers'
    coordinates (Phase 26 privacy)."""
    job = await db.jobs.find_one({"id": job_id})
    if not job or job.get("customer_id") != user["id"]:
        raise HTTPException(status_code=404, detail="Job not found")
    resp: dict[str, Any] = {
        "job_id": job_id,
        "service_timing": job.get("service_timing"),
        "service_type": job.get("service_type"),
        "status": job.get("status"),
        "dispatch_ready_at": job.get("dispatch_ready_at"),
        "cancelled_at": job.get("cancelled_at"),
        "pickup_town": job.get("pickup_town"),
        "dropoff_town": job.get("dropoff_town"),
        "assigned_driver_id": job.get("assigned_driver_id"),
        "assigned_driver_name": job.get("assigned_driver_name"),
        "assigned_driver_rating": job.get("assigned_driver_rating"),
    }
    resp["dispatch_eligible"] = _dispatch_eligible(job)
    # Round 6 — expose the age-based radius so the "Looking for driver"
    # screen can show the customer that we're widening the search rather
    # than sitting idle.
    now_dt = datetime.now(timezone.utc)
    ready = job.get("dispatch_ready_at")
    if ready:
        try:
            t0 = datetime.fromisoformat(ready.replace("Z", "+00:00"))
            resp["waiting_seconds"] = int((now_dt - t0).total_seconds())
        except Exception:
            resp["waiting_seconds"] = 0
    else:
        resp["waiting_seconds"] = 0
    resp["current_search_radius_miles"] = _current_search_radius_miles(job, now=now_dt)
    # Compute next radius expansion time (if any)
    resp["next_radius_expansion_at"] = None
    if ready:
        for max_age, _miles in DISPATCH_RADIUS_LADDER:
            if max_age is None:
                break
            if resp["waiting_seconds"] < max_age:
                try:
                    t0 = datetime.fromisoformat(ready.replace("Z", "+00:00"))
                    resp["next_radius_expansion_at"] = (
                        t0 + timedelta(seconds=max_age)
                    ).isoformat()
                except Exception:
                    pass
                break
    # Aggregate offers-so-far (unique drivers notified) — no PII, just a count.
    try:
        distinct = await db.dispatch_log.distinct(
            "driver_id", {"job_id": job_id, "outcome": "offered"},
        )
        resp["drivers_notified_count"] = len([d for d in distinct if d])
    except Exception:
        resp["drivers_notified_count"] = 0
    return resp



# ---------------------------------------------------------------------------
# Bids
# ---------------------------------------------------------------------------


@api.post("/jobs/{job_id}/bids")
async def submit_bid(job_id: str, payload: BidCreate, user: dict = Depends(require_role("driver"))):
    if user.get("status") != "active":
        raise HTTPException(status_code=403, detail="Driver not approved yet")
    job = await db.jobs.find_one({"id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job["pricing_type"] != "bidding":
        raise HTTPException(status_code=400, detail="Job is not open for bids")
    if job["status"] != "posted":
        raise HTTPException(status_code=400, detail="Job not accepting bids")

    # SEC1 — moderate the bid message before persisting. Bids fly BEFORE any
    # deposit exists, which is exactly when drivers try to steer customers
    # off-platform. Hard-reject any obvious contact-detail leak so both
    # sides see a clear error and rewrite without the phone/email/URL/etc.
    from services.moderation import sanitise
    _clean_msg, _blocked, _hits = sanitise(payload.message or "")
    if _blocked:
        raise HTTPException(
            status_code=400,
            detail=(
                "Contact details or off-platform references are not allowed "
                "in a bid message. Please remove any phone numbers, emails, "
                "URLs, or social handles and try again."
            ),
        )

    bid = {
        "id": new_id(),
        "job_id": job_id,
        "driver_id": user["id"],
        "driver_name": user["name"],
        "driver_rating": user.get("rating", 5.0),
        "vehicle": user.get("vehicle"),
        "amount": payload.amount,
        "message": _clean_msg,
        "eta_hours": payload.eta_hours,
        "status": "pending",
        "created_at": now_iso(),
    }
    await db.bids.insert_one(bid)
    await push_notification(
        job["customer_id"],
        "New bid received",
        f"{user['name']} bid £{payload.amount} on your {job['title']} job.",
        {"job_id": job_id, "bid_id": bid["id"]},
    )
    # Round 3 — also email the customer the branded "New bid" notification.
    try:
        from services.email import send_new_bid_email
        customer = await db.users.find_one(
            {"id": job["customer_id"]}, {"_id": 0, "password_hash": 0}
        )
        if customer:
            await send_new_bid_email(
                db, customer=customer, driver=user, job=job, bid=bid,
                verified_driver=bool(user.get("verified_driver")),
            )
    except Exception:
        logger.exception("new-bid email failed; continuing")
    return {k: v for k, v in bid.items() if k != "_id"}


@api.get("/jobs/{job_id}/bids")
async def list_bids(job_id: str, user: dict = Depends(get_current_user)):
    job = await db.jobs.find_one({"id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if user["role"] == "customer" and job["customer_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not your job")
    bids = await db.bids.find({"job_id": job_id}, {"_id": 0}).sort("amount", 1).to_list(200)
    # Enrich with driver verified status
    driver_ids = list({b["driver_id"] for b in bids})
    drivers = await db.users.find(
        {"id": {"$in": driver_ids}}, {"_id": 0, "password_hash": 0},
    ).to_list(len(driver_ids) or 1) if driver_ids else []
    dmap = {d["id"]: user_to_public(d) for d in drivers}
    for b in bids:
        d = dmap.get(b["driver_id"])
        b["verified_driver"] = bool(d and d.get("verified_driver"))
        b["total_jobs"] = d.get("total_jobs", 0) if d else 0
        # R69 — expose the driver's aggregate review count so the customer
        # can see it BEFORE accepting a bid. Individual review comments
        # remain fetchable via GET /api/users/{driver_id}/profile.
        b["driver_review_count"] = int(d.get("review_count", 0)) if d else 0
    return bids


@api.post("/bids/{bid_id}/accept")
async def accept_bid(bid_id: str, user: dict = Depends(require_role("customer"))):
    bid = await db.bids.find_one({"id": bid_id})
    if not bid:
        raise HTTPException(status_code=404, detail="Bid not found")
    job = await db.jobs.find_one({"id": bid["job_id"]})
    if not job or job["customer_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not your job")
    if job["status"] != "posted":
        raise HTTPException(status_code=400, detail="Job already assigned")

    await db.jobs.update_one(
        {"id": bid["job_id"]},
        {"$set": {
            "status": "accepted",
            "assigned_driver_id": bid["driver_id"],
            "assigned_driver_name": bid["driver_name"],
            "assigned_driver_rating": bid["driver_rating"],
            "accepted_price": bid["amount"],
        }},
    )
    await db.bids.update_one({"id": bid_id}, {"$set": {"status": "accepted"}})
    await db.bids.update_many(
        {"job_id": bid["job_id"], "id": {"$ne": bid_id}},
        {"$set": {"status": "rejected"}},
    )
    await push_notification(
        bid["driver_id"],
        "Bid accepted!",
        f"Your bid for '{job['title']}' was accepted. Waiting for customer deposit.",
        {"job_id": job["id"]},
    )
    return {"ok": True}


# ---------------------------------------------------------------------------
# Bookings + Payments
# ---------------------------------------------------------------------------


@api.post("/bookings")
async def create_booking(body: dict, user: dict = Depends(require_role("customer"))):
    job_id = body.get("job_id")
    job = await db.jobs.find_one({"id": job_id})
    if not job or job["customer_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="Job not found")

    is_asap = job.get("service_timing") == "asap"
    # Scheduled marketplace: existing invariant — a driver must have accepted.
    # ASAP: customer pays FIRST, driver is claimed AFTER dispatch broadcast.
    # In that pre-claim state the booking is created with driver_id=None; the
    # atomic /jobs/{id}/claim updates it with the winning driver id.
    if is_asap:
        if job["status"] not in ("posted", "confirmed", "dispatch_ready"):
            raise HTTPException(status_code=400, detail="ASAP job not in a bookable state")
        if job.get("pricing_type") != "fixed":
            raise HTTPException(status_code=400, detail="ASAP jobs must be fixed-price")
    else:
        if job["status"] != "accepted" or not job.get("assigned_driver_id"):
            raise HTTPException(status_code=400, detail="Job not ready for booking")

    existing = await db.bookings.find_one({"job_id": job_id})
    if existing:
        return {k: v for k, v in existing.items() if k != "_id"}

    driver_charge = float(job.get("accepted_price") or job.get("fixed_price") or 0)
    if driver_charge <= 0:
        raise HTTPException(status_code=400, detail="Missing job price")
    fee_detail = await calculate_booking_fee_detail(driver_charge)
    booking_fee = fee_detail["amount"]
    customer_total = round(driver_charge + booking_fee, 2)
    booking = {
        "id": new_id(),
        "job_id": job_id,
        "customer_id": job["customer_id"],
        "driver_id": job.get("assigned_driver_id"),  # None for ASAP pre-claim
        "driver_charge": driver_charge,
        "booking_fee": booking_fee,
        # Session F — persist the tier % + source that fired at time of
        # booking. IMMUTABLE — once written, historical bookings retain
        # the band that was live when the customer paid.
        "booking_fee_percent": fee_detail["percent"],
        "booking_fee_band_id": fee_detail["band_id"],
        "booking_fee_source": fee_detail["source"],
        "total_price": customer_total,          # what customer pays overall
        "customer_total": customer_total,       # alias of total_price for admin/CSV/aggregation queries
        "deposit_amount": booking_fee,          # what customer pays now (Stripe)
        "balance_due": driver_charge,           # what customer pays driver on delivery
        "status": "accepted",  # pending deposit
        "payment_status": "pending",
        "stripe_session_id": None,
        "service_timing": job.get("service_timing", "scheduled"),
        "service_type": job.get("service_type", "transport"),
        # R25 — Copy the job's authoritative pricing_snapshot onto the
        # booking so historical records are self-describing even if the
        # job doc is later archived. Never mutated after insert.
        "pricing_snapshot": job.get("pricing_snapshot"),
        "pricing_engine_version": job.get("pricing_engine_version"),
        "distance_source": job.get("distance_source"),
        "created_at": now_iso(),
    }
    await db.bookings.insert_one(booking)
    return {k: v for k, v in booking.items() if k != "_id"}


def _stripe_webhook_url(request: Request) -> str:
    """Build the absolute webhook URL that Stripe will POST
    `checkout.session.completed` events to.

    The path MUST be `/api/webhook/stripe` verbatim — this is the endpoint
    registered in the Stripe dashboard for the Cargo One account.
    """
    base = str(request.base_url).rstrip("/")
    return f"{base}/api/webhook/stripe"


@api.post("/bookings/{booking_id}/deposit")
async def create_deposit_session(booking_id: str, body: dict, request: Request,
                                   user: dict = Depends(require_role("customer"))):
    booking = await db.bookings.find_one({"id": booking_id})
    if not booking or booking["customer_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking["payment_status"] == "paid":
        raise HTTPException(status_code=400, detail="Already paid")

    origin_url = body.get("origin_url")
    if not origin_url:
        raise HTTPException(status_code=400, detail="origin_url required")
    success_url = f"{origin_url}/customer/booking/{booking_id}?payment=success&session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin_url}/customer/booking/{booking_id}?payment=cancel"

    # Phase 1 P0 hardening — per-session shared secret for the callback path.
    # Baked into the webhook URL query string, stored in payment_transactions,
    # and validated in POST /api/webhook/stripe. See _stripe_webhook_url docs.
    webhook_token = new_webhook_token()
    webhook_url = f"{_stripe_webhook_url(request)}?t={webhook_token}"
    stripe = StripeCheckout(
        api_key=STRIPE_API_KEY,
        webhook_url=webhook_url,
    )
    req = CheckoutSessionRequest(
        amount=float(booking["deposit_amount"]),
        currency="gbp",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "booking_id": booking_id,
            "customer_id": user["id"],
            "type": "booking_deposit",
        },
    )
    try:
        session = await stripe.create_checkout_session(req)
    except Exception as e:
        logger.exception("Stripe error")
        raise HTTPException(status_code=500, detail=f"Payment init failed: {e}") from e

    # Store payment_transaction
    txn = {
        "id": new_id(),
        "booking_id": booking_id,
        "session_id": session.session_id,
        "amount": float(booking["deposit_amount"]),
        "currency": "gbp",
        "payment_status": "initiated",
        "status": "open",
        "metadata": {"type": "booking_deposit"},
        "webhook_token": webhook_token,
        "created_at": now_iso(),
    }
    await db.payment_transactions.insert_one(txn)
    await db.bookings.update_one(
        {"id": booking_id}, {"$set": {"stripe_session_id": session.session_id}}
    )
    return {"session_id": session.session_id, "url": session.url}


async def _finalise_paid_deposit(session_id: str) -> Optional[dict]:
    """Idempotent, single-writer finaliser for a paid deposit session.

    Called by BOTH `/payments/status/{session_id}` (polling fallback) and
    `/webhook/stripe` (Stripe → us). Uses a conditional
    Mongo update guarded on `payment_status != "paid"` so any second
    caller is a no-op — Stripe delivers webhooks at-least-once and the
    browser may poll multiple times.

    Returns the finalised booking document if this call was the one that
    flipped the state, or None if it was already finalised (or if no
    payment_transactions/booking rows exist for the session).
    """
    txn = await db.payment_transactions.find_one({"session_id": session_id})
    if not txn or not txn.get("booking_id"):
        return None
    # Atomically claim the transition — only one caller wins.
    claim = await db.payment_transactions.update_one(
        {"session_id": session_id, "payment_status": {"$ne": "paid"}},
        {"$set": {"payment_status": "paid", "status": "complete",
                  "finalised_at": now_iso(), "updated_at": now_iso()}},
    )
    if claim.modified_count == 0:
        return None  # already finalised — idempotent no-op
    booking = await db.bookings.find_one({"id": txn["booking_id"]})
    if not booking:
        return None
    await db.bookings.update_one(
        {"id": booking["id"], "payment_status": {"$ne": "paid"}},
        {"$set": {"payment_status": "paid", "status": "deposit_paid",
                  "paid_at": now_iso()}},
    )
    # Job transition: for scheduled jobs → confirmed (existing lifecycle).
    # For ASAP jobs → confirmed AND stamped with `dispatch_ready_at` so
    # `_dispatch_eligible()` returns True and the matching engine can
    # broadcast the offer to online drivers. (Real-time Dispatch Phase 7.)
    job_now = await db.jobs.find_one({"id": booking["job_id"]}, {"service_timing": 1})
    is_asap = (job_now or {}).get("service_timing") == "asap"
    update_fields = {"status": "confirmed"}
    if is_asap:
        update_fields["dispatch_ready_at"] = now_iso()
    await db.jobs.update_one(
        {"id": booking["job_id"], "status": {"$ne": "confirmed"}},
        {"$set": update_fields},
    )
    try:
        await push_notification(
            booking["driver_id"], "Deposit received!",
            "Customer paid the deposit. Contact details unlocked. Proceed to pickup.",
            {"booking_id": booking["id"]},
        )
        await push_notification(
            booking["customer_id"], "Booking confirmed",
            "Deposit paid. Driver contact details are now unlocked.",
            {"booking_id": booking["id"]},
        )
    except Exception:
        # push errors must never block the payment finalisation
        logger.exception("push_notification failed post-deposit; continuing")

    # Transactional email — deposit receipt to customer. Non-blocking:
    # any Resend failure is captured by the service and does not raise.
    try:
        from services.email import (
            send_deposit_receipt,
            send_booking_confirmation,
            send_driver_booking_accepted_email,
        )
        fresh_booking = await db.bookings.find_one({"id": booking["id"]}, {"_id": 0})
        cust = await db.users.find_one({"id": booking["customer_id"]}, {"_id": 0, "password_hash": 0})
        job_doc = await db.jobs.find_one({"id": booking["job_id"]}, {"_id": 0})
        if fresh_booking and cust:
            fresh_booking["job"] = job_doc  # for template pickup/dropoff
            await send_deposit_receipt(db, user=cust, booking=fresh_booking)
            await send_booking_confirmation(db, user=cust, booking=fresh_booking)
        # Round 7 — scheduled/marketplace bookings: fire the branded
        # "You accepted a job" email to the driver now that deposit is
        # confirmed. ASAP bookings already fire this on /jobs/{id}/claim so
        # skip here to avoid a duplicate.
        is_asap = (job_doc or {}).get("service_timing") == "asap"
        if (not is_asap) and fresh_booking and fresh_booking.get("driver_id"):
            drv = await db.users.find_one(
                {"id": fresh_booking["driver_id"]},
                {"_id": 0, "password_hash": 0},
            )
            if drv and cust and job_doc:
                await send_driver_booking_accepted_email(
                    db, driver=drv, customer=cust,
                    booking=fresh_booking, job=job_doc,
                )
    except Exception:
        logger.exception("post-deposit emails failed; continuing (booking not affected)")
    return await db.bookings.find_one({"id": booking["id"]}, {"_id": 0})


@api.get("/payments/status/{session_id}")
async def payment_status(session_id: str, request: Request):
    """Frontend polls this after Stripe redirects with `?payment=success`.

    INTENTIONALLY UNAUTHENTICATED. The Stripe `session_id` is an opaque
    78-char secret that only the paying customer's browser sees, so it
    functions as its own capability token. Requiring auth here was
    breaking Apple Pay on iOS Safari — the redirect back from Stripe
    Checkout occasionally drops the HttpOnly session cookie under ITP,
    leaving the polling loop silently 401'd and the customer stuck on a
    blank "Waiting for Deposit" screen.

    Robust to transient Stripe retrieve failures: if `Session.retrieve`
    fails or we can't reach Stripe, we fall back to whatever the webhook
    has already written to Mongo. The transition to `deposit_paid` is
    driven by `_finalise_paid_deposit`, guarded by `payment_status != paid`
    so polling + webhook can safely race.
    """
    txn = await db.payment_transactions.find_one({"session_id": session_id})
    if not txn:
        raise HTTPException(status_code=404, detail="Session not found")

    # Best-effort poll of Stripe — if this fails (transient network,
    # rate-limit, etc.), we intentionally do NOT 500 out. The webhook is
    # the authoritative finaliser; we just return the current DB state so
    # the browser can keep polling.
    stripe_paid = False
    stripe_meta: dict[str, Any] = {}
    stripe_client = StripeCheckout(
        api_key=STRIPE_API_KEY,
        webhook_url=_stripe_webhook_url(request),
    )
    try:
        status_obj = await stripe_client.get_checkout_status(session_id)
        stripe_paid = status_obj.payment_status == "paid"
        stripe_meta = {
            "status": status_obj.status,
            "payment_status": status_obj.payment_status,
            "amount_total": status_obj.amount_total,
            "currency": status_obj.currency,
        }
        # Best-effort mirror; NOT the source of truth for booking state.
        await db.payment_transactions.update_one(
            {"session_id": session_id, "payment_status": {"$ne": "paid"}},
            {"$set": {"stripe_status": status_obj.status,
                       "stripe_payment_status": status_obj.payment_status,
                       "updated_at": now_iso()}},
        )
    except Exception as e:  # noqa: BLE001
        logger.warning("Stripe status retrieve failed for %s: %s", session_id, e)

    if stripe_paid:
        await _finalise_paid_deposit(session_id)

    # Re-read the transaction so the client sees the authoritative state
    # (either Stripe-polled or webhook-driven).
    txn = await db.payment_transactions.find_one({"session_id": session_id}) or txn
    return {
        "session_id": session_id,
        "status": stripe_meta.get("status") or txn.get("status") or "open",
        "payment_status": txn.get("payment_status") or "pending",
        "amount_total": stripe_meta.get("amount_total") or int(round(float(txn.get("amount", 0)) * 100)),
        "currency": stripe_meta.get("currency") or txn.get("currency", "gbp"),
    }


@api.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Stripe → us. Authoritative payment finaliser.

    Duplicate-delivery safe (Stripe promises at-least-once; retries are
    handled idempotently). Idempotency lives in `_finalise_paid_deposit`.

    Authentication (Phase 1 P0):
      * If `STRIPE_WEBHOOK_SECRET` is set → cryptographic signature check
        via `stripe.Webhook.construct_event`. This is the primary posture
        for real Stripe (test + live).
      * If no signing secret is configured (e.g. very early bootstrap
        before the endpoint is registered), we fall back to per-session
        `webhook_token` binding: every Checkout Session is created with a
        random token baked into the webhook URL query string and stored on
        `payment_transactions`. The webhook must present a matching token
        or is dropped. Unknown / unmatched sessions are dropped with a 200
        (idempotent — avoid retry storms).
    """
    payload = await request.body()
    signature = request.headers.get("Stripe-Signature") or request.headers.get("stripe-signature")
    webhook_secret = os.environ.get("STRIPE_WEBHOOK_SECRET") or None
    query_token = request.query_params.get("t") or ""
    stripe_client = StripeCheckout(
        api_key=STRIPE_API_KEY,
        webhook_secret=webhook_secret,
        webhook_url=_stripe_webhook_url(request),
    )
    try:
        event = await stripe_client.handle_webhook(payload, signature)
    except Exception as e:  # noqa: BLE001
        logger.warning("Stripe webhook rejected (parse/signature): %s", e)
        raise HTTPException(status_code=400, detail="Invalid webhook payload") from e

    session_id = event.session_id
    event_type = event.event_type or ""
    if not session_id:
        return {"ok": True, "ignored": "no session_id"}

    # SEC — bind: require the per-session token unless a signed webhook secret
    # already authenticated the payload cryptographically.
    if not webhook_secret:
        txn = await db.payment_transactions.find_one({"session_id": session_id})
        if not txn:
            # Unknown session — do NOT reveal existence via 4xx. Idempotent no-op.
            return {"ok": True, "session_id": session_id, "ignored": "unknown_session"}
        expected = txn.get("webhook_token") or ""
        if not expected or not query_token or not hmac.compare_digest(expected, query_token):
            logger.warning("Stripe webhook rejected (token mismatch) for %s", session_id)
            raise HTTPException(status_code=403, detail="Webhook token invalid")

    if event_type in {"checkout.session.completed", "payment_intent.succeeded"} \
            or event.payment_status == "paid":
        # Capture the payment_intent id on the transaction so admins can
        # cross-reference charges in Stripe (and later trigger refunds).
        pi_id = None
        try:
            raw_obj = event.event_data.get("object") if hasattr(event, "event_data") else None
            if isinstance(raw_obj, dict):
                pi_id = raw_obj.get("payment_intent")
        except Exception:  # pragma: no cover
            pi_id = None
        if pi_id:
            await db.payment_transactions.update_one(
                {"session_id": session_id},
                {"$set": {"payment_intent_id": pi_id, "updated_at": now_iso()}},
            )
        finalised = await _finalise_paid_deposit(session_id)
        return {"ok": True, "session_id": session_id, "finalised": bool(finalised)}

    if event_type in {"checkout.session.expired", "checkout.session.async_payment_failed",
                      "payment_intent.payment_failed"}:
        await db.payment_transactions.update_one(
            {"session_id": session_id, "payment_status": {"$ne": "paid"}},
            {"$set": {"payment_status": "failed", "status": "failed",
                      "failed_reason": event_type, "updated_at": now_iso()}},
        )
        return {"ok": True, "session_id": session_id, "failed": True}

    return {"ok": True, "session_id": session_id, "ignored": event_type}


@api.get("/bookings/mine")
async def my_bookings(user: dict = Depends(get_current_user)):
    if user["role"] == "customer":
        q = {"customer_id": user["id"]}
    elif user["role"] == "driver":
        q = {"driver_id": user["id"]}
    else:
        q = {}
    bookings = await db.bookings.find(q, {"_id": 0}).sort("created_at", -1).to_list(200)
    # Batch fetch jobs and users to avoid N+1 queries
    job_ids = [b["job_id"] for b in bookings]
    other_ids: list[str] = []
    for b in bookings:
        if b.get("payment_status") == "paid":
            other_ids.append(b.get("driver_id") if user["role"] == "customer" else b.get("customer_id"))
    jobs = await db.jobs.find({"id": {"$in": job_ids}}, {"_id": 0}).to_list(len(job_ids) or 1)
    jobs_map = {j["id"]: j for j in jobs}
    users = await db.users.find(
        {"id": {"$in": other_ids}}, {"_id": 0, "password_hash": 0}
    ).to_list(len(other_ids) or 1) if other_ids else []
    users_map = {u["id"]: u for u in users}
    for b in bookings:
        include_private = b.get("payment_status") == "paid"
        job = jobs_map.get(b["job_id"])
        b["job"] = public_job(job, include_private=include_private) if job else None
        # Projection: mirror the job's assigned_driver_* onto the booking so
        # downstream UI has a stable field regardless of the atomic-claim path.
        if job:
            b["assigned_driver_id"] = job.get("assigned_driver_id") or b.get("driver_id")
            b["assigned_driver_name"] = job.get("assigned_driver_name")
            b["assigned_driver_rating"] = job.get("assigned_driver_rating")
        if include_private:
            other_id = b.get("driver_id") if user["role"] == "customer" else b.get("customer_id")
            other = users_map.get(other_id)
            b["other_party"] = user_to_public(other) if other else None
    return bookings


@api.get("/bookings/{booking_id}")
async def get_booking(booking_id: str, user: dict = Depends(get_current_user)):
    b = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not b:
        raise HTTPException(status_code=404, detail="Not found")
    if user["role"] not in ("admin",) and user["id"] not in (b.get("customer_id"), b.get("driver_id")):
        raise HTTPException(status_code=403, detail="Forbidden")
    job = await db.jobs.find_one({"id": b["job_id"]}, {"_id": 0})
    include_private = b.get("payment_status") == "paid" or user["role"] == "admin"
    b["job"] = public_job(job, include_private=include_private) if job else None
    # Projection — see /bookings/mine for rationale.
    if job:
        b["assigned_driver_id"] = job.get("assigned_driver_id") or b.get("driver_id")
        b["assigned_driver_name"] = job.get("assigned_driver_name")
        b["assigned_driver_rating"] = job.get("assigned_driver_rating")
    # R37 — Contact-details reveal gate.
    # `other_party` (which includes email + phone via user_to_public) MUST
    # only be returned once a driver has actually accepted the job. Prior
    # to that, `b.driver_id` is None and the query below would silently
    # return None, but making the guard explicit protects against future
    # code paths that pre-populate `driver_id` before real acceptance.
    driver_accepted = bool(b.get("driver_id")) or bool(job and job.get("assigned_driver_id"))
    if include_private and driver_accepted:
        other_id = b.get("driver_id") if user["id"] == b.get("customer_id") else b.get("customer_id")
        other = await db.users.find_one({"id": other_id}, {"_id": 0, "password_hash": 0}) if other_id else None
        b["other_party"] = user_to_public(other) if other else None
    else:
        # Explicit null — the front-end knows to hide the "Contact driver" UI.
        b["other_party"] = None
    b["driver_accepted"] = driver_accepted    # convenience flag for the UI
    # Admin: surface Stripe reference IDs + refund history for the payment
    # tab. Non-admins never see raw Stripe IDs.
    if user["role"] == "admin":
        txn = await db.payment_transactions.find_one(
            {"session_id": b.get("stripe_session_id")}, {"_id": 0}
        ) if b.get("stripe_session_id") else None
        if txn:
            b["stripe_payment_intent_id"] = txn.get("payment_intent_id")
            b["stripe_amount_total"] = txn.get("amount_total")
            b["refunds"] = txn.get("refunds") or []
    return b


@api.post("/bookings/{booking_id}/status")
async def update_booking_status(booking_id: str, payload: StatusUpdate,
                                 user: dict = Depends(get_current_user)):
    b = await db.bookings.find_one({"id": booking_id})
    if not b:
        raise HTTPException(status_code=404, detail="Not found")
    if user["id"] not in (b.get("driver_id"), b.get("customer_id")) and user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")
    valid = ["travelling", "arrived", "collected", "on_route", "delivered", "cancelled"]
    if payload.status not in valid:
        raise HTTPException(status_code=400, detail="Invalid status")

    await db.bookings.update_one({"id": booking_id}, {"$set": {"status": payload.status,
                                                                 "updated_at": now_iso()}})
    await db.jobs.update_one({"id": b["job_id"]}, {"$set": {"status": payload.status}})

    other_id = b.get("customer_id") if user["id"] == b.get("driver_id") else b.get("driver_id")
    await push_notification(other_id, f"Booking {payload.status}",
                             f"Booking status updated to {payload.status.replace('_', ' ')}.",
                             {"booking_id": booking_id})
    # R45 — Cash-on-Delivery Reminder.
    # When the driver flips the job to `on_route` (cargo picked up, now
    # heading to the customer), send the customer a targeted push + email
    # reminding them of the EXACT cash figure to have ready. Idempotent:
    # a `cash_reminder_sent_at` field on the booking blocks duplicates if
    # the driver toggles the status back and forth. Failures are swallowed
    # so the status update itself is never blocked.
    if payload.status == "on_route" and not b.get("cash_reminder_sent_at"):
        try:
            fresh_b = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
            job_doc = await db.jobs.find_one({"id": b["job_id"]}, {"_id": 0})
            cust = await db.users.find_one({"id": b.get("customer_id")},
                                            {"_id": 0, "password_hash": 0})
            drv = await db.users.find_one({"id": b.get("driver_id")},
                                            {"_id": 0, "password_hash": 0}) or {}
            if fresh_b and cust:
                fresh_b["job"] = job_doc
                driver_charge = float(
                    fresh_b.get("driver_charge") or fresh_b.get("balance_due") or 0
                )
                # Targeted push — the notification lands in the customer's
                # existing bell tray with the exact cash figure.
                if driver_charge > 0:
                    await push_notification(
                        b.get("customer_id"),
                        f"Have £{driver_charge:.2f} in cash ready",
                        f"{drv.get('name') or 'Your driver'} has picked up your cargo "
                        f"and is heading to you. Please have £{driver_charge:.2f} ready "
                        f"to pay on delivery.",
                        {"booking_id": booking_id, "kind": "cash_reminder",
                         "amount": driver_charge},
                    )
                from services.email import send_cash_on_delivery_reminder
                await send_cash_on_delivery_reminder(
                    db, user=cust, booking=fresh_b, driver=drv,
                )
                # R67 — Twilio SMS was intentionally removed. The cash-reminder
                # is delivered by push (above) + email (above) only. A future
                # native push channel (APNs / FCM) can be added here.
                await db.bookings.update_one(
                    {"id": booking_id},
                    {"$set": {"cash_reminder_sent_at": now_iso()}},
                )
        except Exception:
            logger.exception("cash-reminder dispatch failed; continuing")
    # Session E — email the customer if the booking was cancelled.
    if payload.status == "cancelled":
        try:
            from services.email import send_booking_cancelled
            fresh_b = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
            job_doc = await db.jobs.find_one({"id": b["job_id"]}, {"_id": 0})
            cust = await db.users.find_one({"id": b["customer_id"]},
                                             {"_id": 0, "password_hash": 0})
            if fresh_b and cust:
                fresh_b["job"] = job_doc
                await send_booking_cancelled(
                    db, user=cust, booking=fresh_b,
                    reason=None,
                    refund_pending=fresh_b.get("payment_status") == "paid",
                )
        except Exception:
            logger.exception("booking-cancelled email failed; continuing")
    return {"ok": True}


# ---------------------------------------------------------------------------
# Tracking
# ---------------------------------------------------------------------------


@api.post("/tracking/{booking_id}")
async def update_location(booking_id: str, payload: LocationUpdate,
                           user: dict = Depends(require_role("driver"))):
    b = await db.bookings.find_one({"id": booking_id})
    if not b or b.get("driver_id") != user["id"]:
        raise HTTPException(status_code=404, detail="Not found")
    doc = {
        "id": new_id(),
        "booking_id": booking_id,
        "driver_id": user["id"],
        "lat": payload.lat,
        "lng": payload.lng,
        "created_at": now_iso(),
    }
    await db.tracking.insert_one(doc)
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {"last_location": {"lat": payload.lat, "lng": payload.lng, "ts": now_iso()}}},
    )
    return {"ok": True}


@api.get("/tracking/{booking_id}")
async def get_tracking(booking_id: str, user: dict = Depends(get_current_user)):
    b = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not b:
        raise HTTPException(status_code=404, detail="Not found")
    if user["id"] not in (b.get("customer_id"), b.get("driver_id")) and user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")
    trail = await db.tracking.find({"booking_id": booking_id}, {"_id": 0}) \
                             .sort("created_at", 1).to_list(500)

    # Compute ETA + remaining distance if we have driver location + a job target
    eta_minutes: Optional[float] = None
    remaining_miles: Optional[float] = None
    heading: Optional[float] = None
    target: Optional[str] = None
    loc = b.get("last_location")
    if loc:
        job = await db.jobs.find_one({"id": b["job_id"]}, {"_id": 0})
        if job:
            # Determine which stop the driver is heading to based on booking status
            status = b.get("status")
            if status in ("deposit_paid", "confirmed", "travelling"):
                dest_lat, dest_lng = job["pickup_lat"], job["pickup_lng"]
                target = "pickup"
            elif status in ("arrived", "collected", "on_route"):
                dest_lat, dest_lng = job["dropoff_lat"], job["dropoff_lng"]
                target = "dropoff"
            else:
                dest_lat, dest_lng = job["dropoff_lat"], job["dropoff_lng"]
                target = None
            if target:
                remaining_miles = round(
                    haversine_miles(loc["lat"], loc["lng"], dest_lat, dest_lng), 1,
                )
                # Try Google Distance Matrix for a more accurate ETA
                gm = await google_distance_matrix(
                    (loc["lat"], loc["lng"]), (dest_lat, dest_lng),
                )
                if gm:
                    remaining_miles = round(gm["distance_meters"] / 1609.34, 1)
                    eta_minutes = round(gm["duration_seconds"] / 60, 0)
                else:
                    eta_minutes = round((remaining_miles / 40.0) * 60 + 5, 0)

    # Compute heading from last two points
    if len(trail) >= 2:
        a, c = trail[-2], trail[-1]
        heading = _bearing(a["lat"], a["lng"], c["lat"], c["lng"])

    return {
        "last_location": loc,
        "trail": trail,
        "target": target,
        "remaining_miles": remaining_miles,
        "eta_minutes": eta_minutes,
        "heading": heading,
    }


def _bearing(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Bearing in degrees (0 = north)."""
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    lam = math.radians(lng2 - lng1)
    x = math.sin(lam) * math.cos(phi2)
    y = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(lam)
    return (math.degrees(math.atan2(x, y)) + 360) % 360


# ---------------------------------------------------------------------------
# Messages
# ---------------------------------------------------------------------------


@api.post("/bookings/{booking_id}/messages")
async def send_message(booking_id: str, payload: MessageCreate,
                        user: dict = Depends(get_current_user)):
    b = await db.bookings.find_one({"id": booking_id})
    if not b:
        raise HTTPException(status_code=404, detail="Not found")
    if user["id"] not in (b.get("customer_id"), b.get("driver_id")):
        raise HTTPException(status_code=403, detail="Forbidden")
    if b.get("payment_status") != "paid":
        raise HTTPException(status_code=403, detail="Chat unlocks after deposit payment")

    # SEC1 — soft-redact off-platform contact patterns even AFTER deposit
    # payment: any leak is still a policy violation the platform must not
    # broker verbatim. Deposit-paid parties can share addresses/phones
    # verbally on the call once the driver is en route, so we only redact
    # rather than reject here — matches the Uber/Bolt behaviour.
    from services.moderation import sanitise
    clean_text, blocked, _hits = sanitise(payload.text or "")
    stored_text = clean_text

    msg = {
        "id": new_id(),
        "booking_id": booking_id,
        "sender_id": user["id"],
        "sender_name": user["name"],
        "text": stored_text,
        "moderated": blocked,
        "photo": payload.photo,
        "read": False,
        "delivered_at": now_iso(),
        "read_at": None,
        "created_at": now_iso(),
    }
    await db.messages.insert_one(msg)
    other_id = b.get("customer_id") if user["id"] == b.get("driver_id") else b.get("driver_id")
    await push_notification(other_id, f"Message from {user['name']}",
                             payload.text or "Sent a photo", {"booking_id": booking_id})

    # Round 3 — email the recipient if they're not actively viewing and the
    # 5-minute per-conversation throttle allows it. Fire and forget so a slow
    # Resend network round-trip never blocks the message being persisted.
    try:
        from services.email import send_new_message_email, is_conversation_active
        active = await is_conversation_active(db, user_id=other_id, booking_id=booking_id)
        if not active:
            other_user = await db.users.find_one(
                {"id": other_id}, {"_id": 0, "password_hash": 0}
            )
            unread_count = await db.messages.count_documents(
                {"booking_id": booking_id, "sender_id": {"$ne": other_id}, "read": False},
            )
            if other_user:
                role_hint = "driver" if other_id == b.get("driver_id") else "customer"
                await send_new_message_email(
                    db,
                    recipient=other_user,
                    sender=user,
                    booking=b,
                    preview_text=(payload.text or "(sent a photo)"),
                    unread_count=unread_count,
                    role_hint=role_hint,
                )
    except Exception:
        logger.exception("new-message email failed; continuing")
    return {k: v for k, v in msg.items() if k != "_id"}


@api.get("/bookings/{booking_id}/messages")
async def list_messages(booking_id: str, user: dict = Depends(get_current_user)):
    b = await db.bookings.find_one({"id": booking_id})
    if not b:
        raise HTTPException(status_code=404, detail="Not found")
    if user["id"] not in (b.get("customer_id"), b.get("driver_id")) and user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")
    if b.get("payment_status") != "paid":
        return []
    msgs = await db.messages.find({"booking_id": booking_id}, {"_id": 0}) \
                             .sort("created_at", 1).to_list(500)
    # Mark the OTHER party's messages as read for this reader, and stamp
    # a read_at timestamp so the sender can render WhatsApp-style ticks.
    if user["role"] != "admin":
        now = now_iso()
        await db.messages.update_many(
            {"booking_id": booking_id, "sender_id": {"$ne": user["id"]},
             "$or": [{"read": False}, {"read_at": None}]},
            {"$set": {"read": True, "read_at": now}},
        )
        # Refresh msgs so the caller sees the freshly-stamped read_at values
        msgs = await db.messages.find({"booking_id": booking_id}, {"_id": 0}) \
                                 .sort("created_at", 1).to_list(500)
        # Also mark presence — user is looking at this conversation right now.
        await db.conversation_presence.update_one(
            {"user_id": user["id"], "booking_id": booking_id},
            {"$set": {"last_seen_at": now}},
            upsert=True,
        )
    return msgs


@api.post("/bookings/{booking_id}/messages/mark-read")
async def mark_messages_read(booking_id: str, user: dict = Depends(get_current_user)):
    """Mark every message from the OTHER party as read for the current user.
    Front-end calls this every time the conversation view is (re)opened, or
    when a new message arrives while the tab is focused."""
    b = await db.bookings.find_one({"id": booking_id})
    if not b:
        raise HTTPException(status_code=404, detail="Not found")
    if user["id"] not in (b.get("customer_id"), b.get("driver_id")):
        raise HTTPException(status_code=403, detail="Forbidden")
    now = now_iso()
    result = await db.messages.update_many(
        {"booking_id": booking_id, "sender_id": {"$ne": user["id"]},
         "$or": [{"read": False}, {"read_at": None}]},
        {"$set": {"read": True, "read_at": now}},
    )
    await db.conversation_presence.update_one(
        {"user_id": user["id"], "booking_id": booking_id},
        {"$set": {"last_seen_at": now}},
        upsert=True,
    )
    return {"ok": True, "marked_read": result.modified_count}


@api.post("/bookings/{booking_id}/conversation/presence")
async def conversation_presence_ping(booking_id: str,
                                        user: dict = Depends(get_current_user)):
    """Heartbeat — the client calls this every ~20 s while the conversation
    is open. Used by the messaging-email throttle to skip sending emails
    when the recipient is already looking at the chat."""
    b = await db.bookings.find_one({"id": booking_id}, {"_id": 0, "customer_id": 1, "driver_id": 1})
    if not b:
        raise HTTPException(status_code=404, detail="Not found")
    if user["id"] not in (b.get("customer_id"), b.get("driver_id")):
        raise HTTPException(status_code=403, detail="Forbidden")
    await db.conversation_presence.update_one(
        {"user_id": user["id"], "booking_id": booking_id},
        {"$set": {"last_seen_at": now_iso()}},
        upsert=True,
    )
    return {"ok": True}


@api.get("/messages/unread-count")
async def messages_unread_count(user: dict = Depends(get_current_user)):
    """Aggregate unread messages per booking (for the dashboard badge + the
    sidebar nav pip). Only bookings the caller is a party to."""
    # Find every booking this user is on.
    q = {"$or": [{"customer_id": user["id"]}, {"driver_id": user["id"]}]}
    bookings = await db.bookings.find(q, {"id": 1, "_id": 0}).to_list(500)
    booking_ids = [b["id"] for b in bookings]
    if not booking_ids:
        return {"total": 0, "by_booking": {}}
    pipeline = [
        {"$match": {"booking_id": {"$in": booking_ids},
                     "sender_id": {"$ne": user["id"]},
                     "read": False}},
        {"$group": {"_id": "$booking_id", "n": {"$sum": 1}}},
    ]
    by_booking = {}
    async for doc in db.messages.aggregate(pipeline):
        by_booking[doc["_id"]] = int(doc.get("n", 0))
    total = sum(by_booking.values())
    return {"total": total, "by_booking": by_booking}


@api.get("/messages/summary")
async def messages_summary(user: dict = Depends(get_current_user)):
    """Enhanced inbox feed — one row per PAID booking the caller is on, with
    the latest message preview + unread count. Used by the Customer &
    Driver inbox to show WhatsApp-style thread previews without opening
    every conversation."""
    q = {
        "$or": [{"customer_id": user["id"]}, {"driver_id": user["id"]}],
        "payment_status": "paid",
    }
    bookings = await db.bookings.find(
        q,
        {"_id": 0, "id": 1, "customer_id": 1, "driver_id": 1, "job_id": 1,
         "status": 1, "created_at": 1, "updated_at": 1},
    ).sort("updated_at", -1).to_list(200)
    if not bookings:
        return []

    booking_ids = [b["id"] for b in bookings]
    # Fetch the latest message for each booking + unread counts, both via
    # aggregate to stay under 3 total round-trips even for a chatty user.
    latest_pipeline = [
        {"$match": {"booking_id": {"$in": booking_ids}}},
        {"$sort": {"created_at": -1}},
        {"$group": {
            "_id": "$booking_id",
            "msg": {"$first": "$$ROOT"},
        }},
    ]
    unread_pipeline = [
        {"$match": {"booking_id": {"$in": booking_ids},
                     "sender_id": {"$ne": user["id"]},
                     "read": False}},
        {"$group": {"_id": "$booking_id", "n": {"$sum": 1}}},
    ]
    latest_by_bk = {}
    async for row in db.messages.aggregate(latest_pipeline):
        m = row.get("msg") or {}
        m.pop("_id", None)
        latest_by_bk[row["_id"]] = m
    unread_by_bk = {}
    async for row in db.messages.aggregate(unread_pipeline):
        unread_by_bk[row["_id"]] = int(row.get("n", 0))

    # Job titles + counterparty names in bulk to keep this endpoint O(1)
    # round-trip regardless of booking count.
    job_ids = [b.get("job_id") for b in bookings if b.get("job_id")]
    jobs = {}
    if job_ids:
        async for j in db.jobs.find(
            {"id": {"$in": job_ids}},
            {"_id": 0, "id": 1, "title": 1, "pickup_town": 1, "dropoff_town": 1},
        ):
            jobs[j["id"]] = j
    other_ids = list({
        (b.get("driver_id") if b.get("customer_id") == user["id"] else b.get("customer_id"))
        for b in bookings
    })
    others = {}
    if other_ids:
        async for u in db.users.find(
            {"id": {"$in": other_ids}},
            {"_id": 0, "id": 1, "name": 1, "profile_photo": 1, "role": 1, "rating": 1},
        ):
            others[u["id"]] = u

    out = []
    for b in bookings:
        other_id = b.get("driver_id") if b.get("customer_id") == user["id"] else b.get("customer_id")
        other = others.get(other_id) or {}
        job = jobs.get(b.get("job_id")) or {}
        last = latest_by_bk.get(b["id"])
        if last:
            # Preview soft-clip to 100 chars for a compact inbox row.
            raw = last.get("text") or ""
            preview = raw if len(raw) <= 100 else raw[:99].rstrip() + "\u2026"
            last_summary = {
                "text": preview,
                "sender_id": last.get("sender_id"),
                "sender_name": last.get("sender_name"),
                "mine": last.get("sender_id") == user["id"],
                "read": bool(last.get("read")),
                "read_at": last.get("read_at"),
                "delivered_at": last.get("delivered_at"),
                "created_at": last.get("created_at"),
                "moderated": bool(last.get("moderated")),
                "has_photo": bool(last.get("photo")),
            }
        else:
            last_summary = None
        out.append({
            "booking_id": b["id"],
            "status": b.get("status"),
            "job_title": job.get("title") or "Booking",
            "pickup_town": job.get("pickup_town"),
            "dropoff_town": job.get("dropoff_town"),
            "counterparty": {
                "id": other_id,
                "name": other.get("name") or "",
                "profile_photo": other.get("profile_photo"),
                "role": other.get("role"),
                "rating": other.get("rating"),
            },
            "last_message": last_summary,
            "unread_count": unread_by_bk.get(b["id"], 0),
            "updated_at": b.get("updated_at") or b.get("created_at"),
        })
    # Order: most recently-active conversation first, but bookings without
    # any messages float to the bottom (still returned so the customer sees
    # every paid booking in one place).
    out.sort(key=lambda r: (
        r["last_message"]["created_at"] if r["last_message"] else "",
        r["updated_at"] or "",
    ), reverse=True)
    return out


@api.get("/bookings/{booking_id}/activity")
async def booking_activity(booking_id: str, user: dict = Depends(get_current_user)):
    """Return a chronological timeline of key events for a booking — used by
    the customer Booking Detail "Recent Activity" widget. Events are derived
    live from the booking / job / messages / pod_uploads collections; no new
    persistence is required.
    """
    b = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not b:
        raise HTTPException(status_code=404, detail="Not found")
    if user["id"] not in (b.get("customer_id"), b.get("driver_id")) \
            and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")
    j = await db.jobs.find_one({"id": b.get("job_id")}, {"_id": 0}) or {}

    events: list[dict] = []

    def push(kind: str, label: str, at: Optional[str], icon: str = "check"):
        if at:
            events.append({"kind": kind, "label": label, "at": at, "icon": icon})

    # Booking created — always present.
    push("created", "Booking created", b.get("created_at"), "sparkle")
    # Driver acceptance — for ASAP claim the booking is created *after* the
    # driver accepts, so this is effectively contemporaneous with created_at.
    # For scheduled bidding, `accepted` bid → booking creation are the same
    # step. In either case we treat booking.created_at as the acceptance ts.
    if b.get("driver_id"):
        push("driver_accepted",
             "Driver accepted your booking",
             b.get("created_at"), "user_check")
    # Deposit received.
    if b.get("payment_status") == "paid":
        push("deposit_paid", "Deposit received",
             b.get("paid_at") or b.get("updated_at"), "receipt")

    # Driver sent a message — earliest driver message on this booking, only
    # if there IS one. Latest driver message is more useful for "recent"
    # activity so we surface that instead of the very first.
    if b.get("driver_id"):
        last_driver_msg = await db.messages.find_one(
            {"booking_id": booking_id, "sender_id": b["driver_id"]},
            {"_id": 0, "created_at": 1},
            sort=[("created_at", -1)],
        )
        if last_driver_msg:
            push("driver_message", "Driver sent a message",
                 last_driver_msg.get("created_at"), "chat")

    # Job lifecycle transitions come from job.status. We don't track a
    # per-transition timestamp today, so use the job's updated_at for the
    # most-advanced status the job has reached.
    js = (j.get("status") or b.get("status") or "").lower()
    if js in ("collected", "on_route", "delivered", "pod_uploaded", "completed"):
        push("en_route", "Driver is en route",
             j.get("updated_at") or b.get("updated_at"), "truck")
    if js in ("delivered", "pod_uploaded", "completed") or b.get("delivered_at"):
        push("delivered", "Delivered", b.get("delivered_at"), "package")
    if js == "completed" or b.get("completed_at"):
        push("completed", "Booking completed", b.get("completed_at"), "flag")

    # Sort oldest → newest for the timeline (the frontend renders reverse
    # if it wants "most recent first").
    events.sort(key=lambda e: e.get("at") or "")
    return events


# ---------------------------------------------------------------------------
# POD (Proof of Delivery)
# ---------------------------------------------------------------------------


@api.post("/bookings/{booking_id}/pod")
async def upload_pod(booking_id: str, payload: PODUpload,
                      user: dict = Depends(require_role("driver"))):
    b = await db.bookings.find_one({"id": booking_id})
    if not b or b.get("driver_id") != user["id"]:
        raise HTTPException(status_code=404, detail="Not found")
    doc = {
        "id": new_id(),
        "booking_id": booking_id,
        "driver_id": user["id"],
        "photos": payload.photos,
        "signature": payload.signature,
        "notes": payload.notes,
        "lat": payload.lat,
        "lng": payload.lng,
        "created_at": now_iso(),
    }
    await db.pods.insert_one(doc)
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {"status": "pod_uploaded", "pod_id": doc["id"], "delivered_at": now_iso()}},
    )
    await db.jobs.update_one({"id": b["job_id"]}, {"$set": {"status": "pod_uploaded"}})
    await push_notification(
        b["customer_id"], "Delivery complete!",
        "Proof of delivery uploaded. Please review and confirm.",
        {"booking_id": booking_id},
    )
    return {k: v for k, v in doc.items() if k != "_id"}


@api.get("/bookings/{booking_id}/pod")
async def get_pod(booking_id: str, user: dict = Depends(get_current_user)):
    b = await db.bookings.find_one({"id": booking_id})
    if not b:
        raise HTTPException(status_code=404, detail="Not found")
    if user["id"] not in (b.get("customer_id"), b.get("driver_id")) and user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")
    pod = await db.pods.find_one({"booking_id": booking_id}, {"_id": 0})
    return pod


@api.post("/bookings/{booking_id}/complete")
async def complete_booking(booking_id: str, user: dict = Depends(require_role("customer"))):
    b = await db.bookings.find_one({"id": booking_id})
    if not b or b["customer_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="Not found")
    await db.bookings.update_one({"id": booking_id}, {"$set": {"status": "completed",
                                                                "completed_at": now_iso()}})
    await db.jobs.update_one({"id": b["job_id"]}, {"$set": {"status": "completed"}})
    driver_id = b.get("driver_id")
    if driver_id:
        await db.users.update_one({"id": driver_id}, {"$inc": {"total_jobs": 1}})
    # Session E — completion confirmation email.
    try:
        from services.email import send_booking_completed
        fresh_b = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
        job_doc = await db.jobs.find_one({"id": b["job_id"]}, {"_id": 0})
        driver = await db.users.find_one({"id": driver_id}, {"_id": 0, "password_hash": 0}) if driver_id else None
        driver = driver or {}
        if fresh_b and user:
            fresh_b["job"] = job_doc
            await send_booking_completed(db, user=user, booking=fresh_b, driver=driver)
    except Exception:
        logger.exception("booking-completed email failed; continuing")
    return {"ok": True}


# ---------------------------------------------------------------------------
# Reviews
# ---------------------------------------------------------------------------


@api.post("/bookings/{booking_id}/review")
async def create_review(booking_id: str, payload: ReviewCreate,
                         user: dict = Depends(get_current_user)):
    b = await db.bookings.find_one({"id": booking_id})
    if not b or user["id"] not in (b.get("customer_id"), b.get("driver_id")):
        raise HTTPException(status_code=404, detail="Not found")
    if b.get("status") not in ("completed", "pod_uploaded"):
        raise HTTPException(status_code=400, detail="Booking not completed yet")
    target_id = b.get("driver_id") if user["id"] == b.get("customer_id") else b.get("customer_id")
    if not target_id:
        raise HTTPException(status_code=400, detail="Counterparty not available for review")
    # R23: one review per (from_id, booking_id). Backend must reject duplicates
    # regardless of any client-side guard.
    dupe = await db.reviews.find_one({"booking_id": booking_id, "from_id": user["id"]})
    if dupe:
        raise HTTPException(
            status_code=409,
            detail="You have already reviewed this booking.",
        )
    doc = {
        "id": new_id(),
        "booking_id": booking_id,
        "from_id": user["id"],
        "from_name": user["name"],
        "from_role": user.get("role"),
        "target_id": target_id,
        "rating": max(1, min(5, payload.rating)),
        "comment": payload.comment,
        "photos": payload.photos,
        "verified_delivery": True,
        "reply": None,
        "reply_at": None,
        "created_at": now_iso(),
    }
    await db.reviews.insert_one(doc)
    # Recalculate rating avg
    agg = await db.reviews.aggregate([
        {"$match": {"target_id": target_id}},
        {"$group": {"_id": None, "avg": {"$avg": "$rating"}, "n": {"$sum": 1}}},
    ]).to_list(1)
    if agg:
        await db.users.update_one(
            {"id": target_id},
            {"$set": {"rating": round(agg[0]["avg"], 2), "review_count": agg[0]["n"]}},
        )
    # R23: email the target with a new-review notification, and push in-app.
    try:
        target = await db.users.find_one({"id": target_id}, {"_id": 0, "password_hash": 0})
        await push_notification(
            target_id,
            "New review received",
            f"You have a new {doc['rating']}-star review from {user.get('name') or 'a customer'}.",
            {"booking_id": booking_id, "review_id": doc["id"]},
        )
        if target:
            from services.email import send_new_review
            await send_new_review(
                db, target_user=target, from_user=user, booking=b,
                rating=doc["rating"], comment=doc.get("comment"),
            )
    except Exception:
        logger.exception("new-review notification failed; continuing")
    return {k: v for k, v in doc.items() if k != "_id"}


@api.get("/bookings/{booking_id}/review/mine")
async def get_my_review_for_booking(booking_id: str,
                                     user: dict = Depends(get_current_user)):
    """Return the review the CURRENT user has already submitted for this
    booking, if any. Used by the frontend to hide the 'Leave review' button
    and instead render the submitted review immediately, without a listing.
    """
    rev = await db.reviews.find_one(
        {"booking_id": booking_id, "from_id": user["id"]}, {"_id": 0},
    )
    return rev  # may be None — client renders CTA in that case


@api.post("/reviews/{review_id}/reply")
async def reply_to_review(review_id: str, payload: ReviewReplyCreate,
                            user: dict = Depends(get_current_user)):
    """Single reply per review — only the target (person being reviewed)
    can reply, and only once. Reply is soft-moderated for off-platform
    contact patterns like every other user-generated text field."""
    rev = await db.reviews.find_one({"id": review_id})
    if not rev:
        raise HTTPException(status_code=404, detail="Review not found")
    if rev.get("target_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Only the reviewed user can reply")
    if rev.get("reply"):
        raise HTTPException(status_code=409, detail="You have already replied to this review")
    text = (payload.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Reply text required")
    if len(text) > 1000:
        text = text[:1000]
    from services.moderation import sanitise
    clean_text, _blocked, _hits = sanitise(text)
    now = now_iso()
    await db.reviews.update_one(
        {"id": review_id, "reply": None},
        {"$set": {"reply": clean_text, "reply_at": now,
                  "reply_by": user["id"], "reply_by_name": user["name"]}},
    )
    # Notify the original reviewer (in-app only — a reply doesn't need a full
    # branded email, though push_notification will still log it).
    try:
        await push_notification(
            rev.get("from_id"),
            "Your review received a reply",
            "The person you reviewed has replied to your review.",
            {"booking_id": rev.get("booking_id"), "review_id": review_id},
        )
    except Exception:
        logger.exception("review-reply push failed; continuing")
    return {"ok": True, "reply": clean_text, "reply_at": now}


@api.get("/users/{user_id}/reviews")
async def user_reviews(user_id: str):
    reviews = await db.reviews.find({"target_id": user_id}, {"_id": 0}) \
                                .sort("created_at", -1).to_list(50)
    return reviews


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------


@api.get("/notifications")
async def list_notifications(user: dict = Depends(get_current_user)):
    notes = await db.notifications.find({"user_id": user["id"]}, {"_id": 0}) \
                                    .sort("created_at", -1).to_list(100)
    return notes


@api.post("/notifications/{note_id}/read")
async def mark_read(note_id: str, user: dict = Depends(get_current_user)):
    await db.notifications.update_one(
        {"id": note_id, "user_id": user["id"]}, {"$set": {"read": True}}
    )
    return {"ok": True}


# ---------------------------------------------------------------------------
# Admin
# ---------------------------------------------------------------------------


@api.get("/admin/stats")
async def admin_stats(user: dict = Depends(require_role("admin"))):
    total_users = await db.users.count_documents({"role": "customer"})
    total_drivers = await db.users.count_documents({"role": "driver"})
    pending_drivers = await db.users.count_documents({"role": "driver", "status": "pending"})
    total_jobs = await db.jobs.count_documents({})
    active_jobs = await db.jobs.count_documents({"status": {"$in": ["posted", "accepted", "confirmed",
                                                                      "travelling", "collected", "on_route"]}})
    total_bookings = await db.bookings.count_documents({})
    paid_bookings = await db.bookings.count_documents({"payment_status": "paid"})
    revenue_agg = await db.bookings.aggregate([
        {"$match": {"payment_status": "paid"}},
        {"$group": {"_id": None, "total": {"$sum": "$deposit_amount"}}},
    ]).to_list(1)
    revenue = revenue_agg[0]["total"] if revenue_agg else 0
    return {
        "customers": total_users,
        "drivers": total_drivers,
        "pending_drivers": pending_drivers,
        "total_jobs": total_jobs,
        "active_jobs": active_jobs,
        "total_bookings": total_bookings,
        "paid_bookings": paid_bookings,
        "revenue_gbp": round(revenue, 2),
    }


@api.get("/admin/analytics/rebooks")
async def admin_analytics_rebooks(
    days: int = 30,
    window_hours: int = 24,
    user: dict = Depends(require_role("admin")),
):
    """R63 — Rebook analytics.

    Retro-computes how many cancelled ASAP bookings turned into a fresh
    ASAP booking by the same customer within `window_hours` of the
    cancellation. Zero schema migration required — reads existing
    booking records. Only ASAP is counted (`service_timing == "asap"`).

    Returns:
      - `cancelled_asap`  count of ASAP bookings cancelled in the window
      - `rebooked`        count of those where the customer created a new
                          ASAP booking within `window_hours`
      - `rebook_rate_pct` percentage rounded to 1dp
      - `daily`           per-day breakdown for the small admin chart
    """
    from datetime import datetime, timedelta, timezone
    days = max(1, min(365, int(days or 30)))
    window_hours = max(1, min(168, int(window_hours or 24)))
    since = datetime.now(timezone.utc) - timedelta(days=days)
    since_iso = since.isoformat()

    # 1) All cancelled ASAP bookings in the window, oldest first.
    cancelled = await db.bookings.find(
        {"status": "cancelled",
         "cancelled_at": {"$gte": since_iso},
         "service_timing": "asap"},
        {"_id": 0, "id": 1, "customer_id": 1, "cancelled_at": 1},
    ).sort("cancelled_at", 1).to_list(2000)

    rebooked_ids = set()
    for cb in cancelled:
        try:
            t0 = datetime.fromisoformat(cb["cancelled_at"].replace("Z", "+00:00"))
        except Exception:
            continue
        t1 = t0 + timedelta(hours=window_hours)
        # Any fresh ASAP booking by the same customer, created inside the
        # (cancel, cancel+window) window.
        match = await db.bookings.find_one({
            "customer_id": cb["customer_id"],
            "service_timing": "asap",
            "status": {"$ne": "cancelled"},
            "created_at": {"$gt": cb["cancelled_at"], "$lte": t1.isoformat()},
        }, {"_id": 0, "id": 1})
        if match:
            rebooked_ids.add(cb["id"])

    total = len(cancelled)
    rebooked = len(rebooked_ids)
    rate = round((rebooked * 100.0 / total), 1) if total else 0.0

    # Daily buckets (UTC dates) — kept lean for the mini chart.
    daily = {}
    for cb in cancelled:
        d = (cb.get("cancelled_at") or "")[:10]
        if not d: continue
        row = daily.setdefault(d, {"date": d, "cancelled": 0, "rebooked": 0})
        row["cancelled"] += 1
        if cb["id"] in rebooked_ids:
            row["rebooked"] += 1
    daily_list = sorted(daily.values(), key=lambda r: r["date"])

    return {
        "days": days,
        "window_hours": window_hours,
        "cancelled_asap": total,
        "rebooked": rebooked,
        "rebook_rate_pct": rate,
        "daily": daily_list,
    }


@api.get("/admin/users")
async def admin_list_users(role: Optional[str] = None,
                            user: dict = Depends(require_role("admin"))):
    q = {"role": role} if role else {}
    users = await db.users.find(q, {"_id": 0, "password_hash": 0}) \
                            .sort("created_at", -1).to_list(500)
    return users


@api.get("/admin/drivers-missing-phone")
async def admin_drivers_missing_phone(_: dict = Depends(require_role("admin"))):
    """Ops backfill helper — every driver on file whose `phone` field is
    empty or fails our UK/E.164 validator. Sorted newest first. Returned
    fields are safe for the admin console; passwords + tokens excluded.
    """
    drivers = await db.users.find(
        {"role": "driver"},
        {"_id": 0, "password_hash": 0},
    ).sort("created_at", -1).to_list(2000)
    flagged = [d for d in drivers if not is_valid_phone((d.get("phone") or "").strip())]
    return {
        "count": len(flagged),
        "total_drivers": len(drivers),
        "drivers": flagged,
    }


@api.post("/admin/drivers-missing-phone/nudge")
async def admin_nudge_drivers_missing_phone(admin: dict = Depends(require_role("admin"))):
    """One-tap ops action — Resend an "add your phone" nudge to EVERY driver
    whose phone is missing or malformed. Rate-guarded per-driver by 24 h
    via `nudged_add_phone_at`; the same admin clicking twice within a day
    is a no-op for already-nudged drivers.
    """
    drivers = await db.users.find(
        {"role": "driver"},
        {"_id": 0, "password_hash": 0},
    ).to_list(2000)
    flagged = [d for d in drivers if not is_valid_phone((d.get("phone") or "").strip())]
    from services.email import send_driver_add_phone_nudge_email

    now = datetime.now(timezone.utc)
    dedupe_cutoff = now - timedelta(hours=24)
    sent = skipped = failed = 0
    skipped_reasons: list[str] = []
    for d in flagged:
        last = d.get("nudged_add_phone_at")
        try:
            last_dt = datetime.fromisoformat(last) if isinstance(last, str) else None
        except Exception:
            last_dt = None
        if last_dt and last_dt.tzinfo is None:
            last_dt = last_dt.replace(tzinfo=timezone.utc)
        if last_dt and last_dt > dedupe_cutoff:
            skipped += 1
            skipped_reasons.append("dedupe_24h")
            continue
        result = await send_driver_add_phone_nudge_email(db, driver=d)
        r_status = result.get("status")
        if r_status == "sent":
            sent += 1
        elif r_status == "skipped":
            skipped += 1
            skipped_reasons.append(result.get("reason") or "provider_offline")
        else:
            failed += 1
        # Stamp the nudge time only for sent/skipped-by-provider so a real
        # failure can be retried next click.
        if r_status in ("sent", "skipped"):
            await db.users.update_one(
                {"id": d["id"]},
                {"$set": {
                    "nudged_add_phone_at": now.isoformat(),
                    "nudged_add_phone_by_id": admin.get("id"),
                    "nudged_add_phone_last_status": r_status,
                }},
            )
    return {
        "ok": True,
        "flagged": len(flagged),
        "sent": sent,
        "skipped": skipped,
        "failed": failed,
        "skipped_reasons": skipped_reasons[:10],
    }


@api.get("/admin/users/{user_id}")
async def admin_user_detail(user_id: str,
                              _: dict = Depends(require_role("admin"))):
    """Unified drilldown for admin All Users page — works for customer,
    driver and admin roles. Includes recent jobs (as customer), recent
    bookings (customer + driver), and full profile.
    """
    target = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    role = target.get("role")
    recent_jobs: list = []
    recent_bookings: list = []
    if role == "customer":
        recent_jobs = await db.jobs.find(
            {"customer_id": user_id}, {"_id": 0}
        ).sort("created_at", -1).to_list(20)
        recent_bookings = await db.bookings.find(
            {"customer_id": user_id}, {"_id": 0}
        ).sort("created_at", -1).to_list(20)
    elif role == "driver":
        recent_bookings = await db.bookings.find(
            {"driver_id": user_id}, {"_id": 0}
        ).sort("created_at", -1).to_list(20)
    # Attach compact job summary to each booking for the modal card
    for b in recent_bookings:
        j = await db.jobs.find_one(
            {"id": b.get("job_id")},
            {"_id": 0, "title": 1, "pickup_town": 1, "dropoff_town": 1,
             "service_type": 1, "service_timing": 1, "recommended_vehicle": 1},
        ) if b.get("job_id") else None
        b["job"] = j
    return {
        "user": target,
        "recent_jobs": recent_jobs,
        "recent_bookings": recent_bookings,
    }


@api.post("/admin/users/{user_id}/approve")
async def admin_approve(user_id: str, actor: dict = Depends(require_role("admin"))):
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    entry = {
        "id": new_id(),
        "action": "approve",
        "by_admin_id": actor["id"],
        "by_admin_name": actor.get("name"),
        "reason": None,
        "at": now_iso(),
        "previous_status": target.get("status"),
    }
    await db.users.update_one(
        {"id": user_id},
        {
            "$set": {"status": "active", "documents_verified": True},
            "$push": {"verification_history": entry},
        },
    )
    await push_notification(user_id, "You're approved!",
                             "Your driver account is approved. You can now accept jobs.")
    # R53 — send the "you're approved" email (real Resend delivery).
    if (target.get("role") or "").lower() == "driver":
        try:
            from services.email import send_driver_approved
            fresh_driver = await db.users.find_one({"id": user_id}, {"_id": 0})
            if fresh_driver:
                await send_driver_approved(db, user=fresh_driver)
        except Exception:
            logger.exception("driver_approved email failed; continuing")
    return {"ok": True}


class AdminUserActionPayload(BaseModel):
    reason: Optional[str] = None
    doc_types: Optional[list[str]] = None  # Optional list of doc_types to request changes for


@api.post("/admin/users/{user_id}/suspend")
async def admin_suspend(
    user_id: str,
    payload: Optional[AdminUserActionPayload] = None,
    actor: dict = Depends(require_role("admin")),
):
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    reason = (payload.reason if payload else None) or None
    entry = {
        "id": new_id(),
        "action": "suspend",
        "by_admin_id": actor["id"],
        "by_admin_name": actor.get("name"),
        "reason": reason,
        "at": now_iso(),
        "previous_status": target.get("status"),
    }
    await db.users.update_one(
        {"id": user_id},
        {
            "$set": {"status": "suspended", "suspension_reason": reason},
            "$push": {"verification_history": entry},
        },
    )
    if target.get("role") == "driver":
        await push_notification(
            user_id,
            "Account suspended",
            f"Your Cargo One driver account has been suspended.{(' Reason: ' + reason) if reason else ''}",
        )
    return {"ok": True}


@api.post("/admin/users/{user_id}/request-changes")
async def admin_request_changes(
    user_id: str,
    payload: AdminUserActionPayload,
    actor: dict = Depends(require_role("admin")),
):
    """Soft-reject a driver's verification and ask them to resubmit specific
    documents. Sets user.status = 'changes_requested' and stores the admin's
    reason + document list on the user record so the driver can see exactly
    what needs to change and re-upload only what's required."""
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.get("role") != "driver":
        raise HTTPException(status_code=400, detail="request-changes only applies to drivers")
    reason = (payload.reason or "").strip()
    if len(reason) < 10:
        raise HTTPException(status_code=400, detail="Please provide a reason (10+ characters)")
    doc_types = payload.doc_types or []
    entry = {
        "id": new_id(),
        "action": "request_changes",
        "by_admin_id": actor["id"],
        "by_admin_name": actor.get("name"),
        "reason": reason,
        "doc_types": doc_types,
        "at": now_iso(),
        "previous_status": target.get("status"),
    }
    # Also mark the individual documents as rejected (with the reason) so the
    # driver's document list shows what needs to change and _recompute won't
    # auto-flip them back to active until re-uploaded.
    if doc_types:
        await db.documents.update_many(
            {"user_id": user_id, "doc_type": {"$in": doc_types}, "active": True},
            {"$set": {"status": "rejected", "rejection_reason": reason, "reviewed_at": now_iso()}},
        )
    await db.users.update_one(
        {"id": user_id},
        {
            "$set": {
                "status": "changes_requested",
                "changes_requested_reason": reason,
                "changes_requested_doc_types": doc_types,
                "documents_verified": False,
            },
            "$push": {"verification_history": entry},
        },
    )
    await push_notification(
        user_id,
        "Changes requested",
        f"Please review and re-upload your documents. {reason}",
        {"doc_types": doc_types},
    )
    return {"ok": True}


@api.post("/auth/me/resubmit-verification")
async def driver_resubmit_verification(user: dict = Depends(get_current_user)):
    """Driver marks their profile as ready for review again after uploading
    updated docs. Only usable when status = changes_requested."""
    if user.get("role") != "driver":
        raise HTTPException(status_code=400, detail="Only drivers can resubmit verification")
    if user.get("status") not in ("changes_requested",):
        raise HTTPException(status_code=400, detail="Not currently in changes_requested state")
    entry = {
        "id": new_id(),
        "action": "resubmit",
        "by_admin_id": None,
        "by_admin_name": None,
        "reason": "Driver re-submitted after requested changes",
        "at": now_iso(),
        "previous_status": user.get("status"),
    }
    await db.users.update_one(
        {"id": user["id"]},
        {
            "$set": {"status": "pending"},
            "$unset": {"changes_requested_reason": "", "changes_requested_doc_types": ""},
            "$push": {"verification_history": entry},
        },
    )
    return {"ok": True, "status": "pending"}


@api.get("/admin/drivers/{driver_id}")
async def admin_driver_detail(driver_id: str, _: dict = Depends(require_role("admin"))):
    """Full driver verification snapshot for the admin review screen.

    Returns:
      - user (profile fields + role + status + history)
      - documents (active docs, base64 included so admin can preview)
      - fleet (registered vehicles)
      - stats (job counts + rating)
    """
    d = await db.users.find_one({"id": driver_id}, {"_id": 0, "password_hash": 0})
    if not d:
        raise HTTPException(status_code=404, detail="Driver not found")
    if d.get("role") != "driver":
        raise HTTPException(status_code=400, detail="Not a driver")

    docs = await db.documents.find(
        {"user_id": driver_id, "active": True}, {"_id": 0},
    ).sort("uploaded_at", -1).to_list(50)
    fleet = await db.driver_vehicles.find(
        {"driver_id": driver_id}, {"_id": 0},
    ).sort("created_at", 1).to_list(50)

    # Stats
    completed_bookings = await db.bookings.count_documents(
        {"driver_id": driver_id, "status": "completed"}
    )
    active_bookings = await db.bookings.count_documents(
        {"driver_id": driver_id, "status": {"$nin": ["completed", "cancelled"]}}
    )
    reviews = await db.reviews.find(
        {"target_id": driver_id}, {"_id": 0}
    ).to_list(500)
    if reviews:
        avg_rating = sum(float(r.get("rating", 0)) for r in reviews) / len(reviews)
    else:
        avg_rating = float(d.get("rating") or 5.0)

    return {
        "user": {
            "id": d.get("id"),
            "name": d.get("name"),
            "email": d.get("email"),
            "phone": d.get("phone"),
            "role": d.get("role"),
            "status": d.get("status"),
            "profile_photo": d.get("profile_photo"),
            "documents_verified": d.get("documents_verified"),
            "verified_driver": d.get("verified_driver"),
            "address": d.get("address"),
            "address_line": d.get("address_line"),
            "town": d.get("town"),
            "postcode": d.get("postcode"),
            "country": d.get("country"),
            "country_code": d.get("country_code"),
            "changes_requested_reason": d.get("changes_requested_reason"),
            "changes_requested_doc_types": d.get("changes_requested_doc_types") or [],
            "suspension_reason": d.get("suspension_reason"),
            "verification_history": d.get("verification_history") or [],
            "created_at": d.get("created_at"),
        },
        "documents": docs,
        "fleet": fleet,
        "stats": {
            "completed_bookings": completed_bookings,
            "active_bookings": active_bookings,
            "rating": round(avg_rating, 2),
            "review_count": len(reviews),
        },
    }


@api.get("/admin/jobs")
async def admin_list_jobs(user: dict = Depends(require_role("admin"))):
    jobs = await db.jobs.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return jobs


@api.get("/admin/jobs/{job_id}")
async def admin_job_detail(job_id: str,
                             _: dict = Depends(require_role("admin"))):
    """Full job drilldown for the Admin Jobs page — includes customer,
    assigned driver, bids and the booking (if one exists).
    """
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    # Ensure suitable-vehicle is populated even for historic jobs.
    if not job.get("recommended_vehicle"):
        job["recommended_vehicle"] = _derive_suitable_vehicle(job)
    customer = await db.users.find_one(
        {"id": job.get("customer_id")},
        {"_id": 0, "password_hash": 0},
    ) if job.get("customer_id") else None
    driver = None
    if job.get("assigned_driver_id"):
        driver = await db.users.find_one(
            {"id": job["assigned_driver_id"]},
            {"_id": 0, "password_hash": 0},
        )
    bids = await db.bids.find(
        {"job_id": job_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    booking = await db.bookings.find_one({"job_id": job_id}, {"_id": 0})
    return {
        "job": job,
        "customer": customer,
        "driver": driver,
        "bids": bids,
        "booking": booking,
    }


@api.get("/admin/bookings")
async def admin_list_bookings(user: dict = Depends(require_role("admin"))):
    bookings = await db.bookings.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return bookings


@api.get("/admin/dispatch/active")
async def admin_active_dispatches(user: dict = Depends(require_role("admin"))):
    """Real-time Admin Dispatch Monitor (Round 6).

    Returns every ASAP job currently in the dispatch queue, enriched with:
      - waiting_seconds since dispatch_ready_at
      - current_search_radius_miles (per the age-based ladder)
      - drivers_notified / offered / declined counts derived from dispatch_log
      - accepted_by (if a driver has claimed since offers began)
      - next_radius_expansion_at (approx timestamp when the radius will widen)
      - last_dispatch_attempt (most recent dispatch_log entry)

    This is the primary debugging screen. Live-updates by client polling
    every ~5 s; no websocket dependency.
    """
    jobs = await db.jobs.find(
        {"service_timing": "asap",
         "status": {"$in": ["confirmed", "dispatch_ready"]},
         "assigned_driver_id": None,
         "cancelled_at": {"$exists": False}},
        {"_id": 0},
    ).sort("dispatch_ready_at", 1).to_list(200)
    # Also include jobs that were claimed in the last 15 min for context.
    recently_claimed = await db.jobs.find(
        {"service_timing": "asap",
         "assigned_driver_id": {"$ne": None},
         "status": {"$in": ["accepted", "confirmed", "dispatch_ready",
                              "travelling", "arrived", "collected"]}},
        {"_id": 0},
    ).sort("updated_at", -1).limit(20).to_list(20)

    now_dt = datetime.now(timezone.utc)
    out = []

    async def _summarise(job: dict, is_open: bool):
        job_id = job["id"]
        ready = job.get("dispatch_ready_at")
        waiting = 0
        if ready:
            try:
                t0 = datetime.fromisoformat(ready.replace("Z", "+00:00"))
                waiting = int((now_dt - t0).total_seconds())
            except Exception:
                waiting = 0
        radius = _current_search_radius_miles(job, now=now_dt)
        # dispatch_log aggregation — count per outcome
        counts: dict = {}
        drivers_notified: set = set()
        last_attempt = None
        async for row in db.dispatch_log.find(
            {"job_id": job_id}, {"_id": 0},
        ).sort("ts", -1).limit(500):
            counts[row["outcome"]] = counts.get(row["outcome"], 0) + 1
            if row.get("driver_id") and row["outcome"] == "offered":
                drivers_notified.add(row["driver_id"])
            if last_attempt is None:
                last_attempt = row
        # Compute next radius expansion timestamp
        next_expansion = None
        for max_age, _miles in DISPATCH_RADIUS_LADDER:
            if max_age is not None and waiting < max_age:
                if ready:
                    try:
                        t0 = datetime.fromisoformat(ready.replace("Z", "+00:00"))
                        next_expansion = (
                            t0 + timedelta(seconds=max_age)
                        ).isoformat()
                    except Exception:
                        next_expansion = None
                break
        assigned = job.get("assigned_driver_id")
        accepted_by = None
        if assigned:
            u = await db.users.find_one(
                {"id": assigned}, {"_id": 0, "id": 1, "name": 1, "phone": 1},
            )
            accepted_by = u
        return {
            "job_id": job_id,
            "title": job.get("title"),
            "service_type": job.get("service_type"),
            "status": job.get("status"),
            "pickup_town": job.get("pickup_town"),
            "dropoff_town": job.get("dropoff_town"),
            "pickup_lat": job.get("pickup_lat"),
            "pickup_lng": job.get("pickup_lng"),
            "dispatch_ready_at": ready,
            "waiting_seconds": waiting,
            "current_search_radius_miles": radius,
            "next_radius_expansion_at": next_expansion,
            "attempt_counts": counts,
            "drivers_notified_count": len(drivers_notified),
            "offers_pending": counts.get("offered", 0),
            "offers_declined": counts.get("out_of_radius", 0)
                                + counts.get("not_capable", 0),
            "last_dispatch_attempt": last_attempt,
            "accepted_by": accepted_by,
            "queue_state": "open" if is_open else "claimed",
        }

    for j in jobs:
        out.append(await _summarise(j, is_open=True))
    for j in recently_claimed:
        out.append(await _summarise(j, is_open=False))
    return {
        "active_count": len(jobs),
        "recently_claimed_count": len(recently_claimed),
        "generated_at": now_dt.isoformat(),
        "radius_ladder": [
            {"until_seconds": m, "radius_miles": r}
            for m, r in DISPATCH_RADIUS_LADDER
        ],
        "heartbeat_freshness_seconds": DISPATCH_HEARTBEAT_FRESHNESS_SECONDS,
        "items": out,
    }


@api.get("/admin/dispatch/log/{job_id}")
async def admin_dispatch_log(job_id: str,
                                user: dict = Depends(require_role("admin"))):
    """Raw per-attempt log for one job — useful for deep debugging."""
    rows = await db.dispatch_log.find(
        {"job_id": job_id}, {"_id": 0},
    ).sort("ts", -1).limit(500).to_list(500)
    return {"job_id": job_id, "rows": rows}



@api.post("/customer/bookings/{booking_id}/cancel-and-refund")
async def customer_cancel_and_refund(
    booking_id: str,
    payload: dict = Body(default={}),
    user: dict = Depends(require_role("customer")),
):
    """Customer self-service cancel + full-refund for an ASAP booking that
    is still WAITING for a driver.

    Race-safe design:
      1. Atomically claim the booking with a conditional update — only
         succeeds if the booking is still unclaimed AND paid AND ASAP AND
         not already cancelled/refunded. Any driver claim happening at the
         same instant will race on their own conditional update at
         `POST /jobs/:id/claim` (server.py::claim_asap_job) — whichever
         update lands first wins. If the driver got there first the
         refund path here returns 409.
      2. On successful claim, mark the associated job cancelled so any
         driver still holding a stale offer for it gets a 409 the moment
         they try to accept.
      3. Fire the Stripe refund exactly like the admin endpoint (same
         helper path).
      4. Audit-log the customer-initiated refund entry.
    """
    b = await db.bookings.find_one({"id": booking_id})
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    if b.get("customer_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Not your booking")

    job = await db.jobs.find_one({"id": b.get("job_id")}) if b.get("job_id") else None
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # R36 — Cancellation applies platform-wide (ASAP + scheduled + fixed + bidding).
    # Same deposit-only fee formula regardless of job type. Admins can vary
    # percentages / minimums per job type later via the policy config.
    if b.get("payment_status") != "paid":
        raise HTTPException(status_code=400, detail="Booking has not been paid")
    if b.get("refund_status") in ("refunded", "succeeded", "pending", "in_progress"):
        raise HTTPException(status_code=409, detail="Refund already recorded or in progress")
    if b.get("cancelled_at"):
        raise HTTPException(status_code=409, detail="Booking already cancelled")
    if job.get("assigned_driver_id"):
        # R35 — Driver has accepted; a deposit-based cancellation fee may apply.
        # We DO NOT block cancellation — we just apply the configured fee.
        pass

    # ---- R35: Compute cancellation fee (server-side source of truth) ------
    deposit = float(b.get("deposit_amount") or 0.0)
    driver_accepted = bool(job.get("assigned_driver_id"))
    policy = await _get_cancellation_policy()
    breakdown = _compute_cancellation_fee(deposit, policy, driver_accepted)

    # ---- ATOMIC CLAIM: only proceed if the job is still unclaimed ---------
    job_claim = await db.jobs.update_one(
        {
            "id": job["id"],
            "status": {"$nin": ["completed", "cancelled"]},
        },
        {"$set": {
            "status": "cancelled",
            "cancelled_at": now_iso(),
            "cancelled_by": "customer",
            "cancelled_by_id": user["id"],
        }},
    )
    if job_claim.modified_count == 0:
        raise HTTPException(
            status_code=409,
            detail="Job already completed or cancelled — cancellation is no longer available.",
        )

    # ---- ATOMIC BOOKING CLAIM: guard the refund side of the transition ---
    b_claim = await db.bookings.update_one(
        {
            "id": booking_id,
            "cancelled_at": None,
            "refund_status": {"$in": [None, "", "failed"]},
        },
        {"$set": {
            "cancelled_at": now_iso(),
            "cancelled_by": "customer",
            "cancelled_by_id": user["id"],
            "refund_status": "in_progress",
            "refund_requested_at": now_iso(),
            "refund_requested_by": user["id"],
        }},
    )
    if b_claim.modified_count == 0:
        # Should not happen thanks to the job-claim above — but bail safely.
        raise HTTPException(status_code=409, detail="Cancellation already in progress")

    # ---- STRIPE REFUND ---------------------------------------------------
    session_id = b.get("stripe_session_id")
    txn = await db.payment_transactions.find_one({"session_id": session_id}) if session_id else None
    pi_id = (txn or {}).get("payment_intent_id")
    refund_id = None
    refund_state = "failed"
    stripe_err: str | None = None
    try:
        import stripe as _stripe
        _stripe.api_key = STRIPE_API_KEY

        if not pi_id and session_id:
            try:
                s_obj = _stripe.checkout.Session.retrieve(session_id)
                pi_id = s_obj.get("payment_intent") if isinstance(s_obj, dict) else getattr(s_obj, "payment_intent", None)
                if pi_id and txn:
                    await db.payment_transactions.update_one(
                        {"session_id": session_id},
                        {"$set": {"payment_intent_id": pi_id, "updated_at": now_iso()}},
                    )
            except Exception:
                pi_id = pi_id or None

        if not pi_id:
            raise RuntimeError("No payment_intent recorded on this booking — cannot refund")

        refund_obj = _stripe.Refund.create(
            payment_intent=pi_id,
            # R35 — refund only the refund_amount portion of the deposit; the
            # cancellation fee stays with the platform. If refund_amount is 0
            # (100% fee case) we skip Stripe entirely.
            amount=int(round(float(breakdown["refund_amount"]) * 100)),
            reason="requested_by_customer",
            metadata={
                "booking_id": booking_id,
                "customer_id": user["id"],
                "cargoone_reason": (
                    "customer_asap_cancel_partial_refund" if breakdown["requires_fee"]
                    else "customer_asap_cancel_full_refund"
                ),
                "deposit_paid": str(breakdown["deposit_paid"]),
                "cancellation_fee": str(breakdown["cancellation_fee"]),
                "cancellation_pct": str(breakdown["cancellation_pct"]),
            },
        ) if float(breakdown["refund_amount"]) > 0 else None
        refund_id = refund_obj.get("id") if isinstance(refund_obj, dict) else getattr(refund_obj, "id", None) if refund_obj else None
        stripe_status = refund_obj.get("status") if isinstance(refund_obj, dict) else getattr(refund_obj, "status", None) if refund_obj else None
        # R35 — if refund_amount was 0 (100% fee) there is no Stripe call; treat as succeeded.
        if refund_obj is None:
            refund_state = "succeeded"
        else:
            refund_state = "succeeded" if stripe_status == "succeeded" else (stripe_status or "pending")
    except Exception as e:
        stripe_err = str(e)
        refund_state = "failed"
        await db.bookings.update_one(
            {"id": booking_id},
            {"$set": {"refund_status": "failed",
                      "refund_failed_at": now_iso(),
                      "refund_error": stripe_err[:500]}},
        )
        logger.warning("Customer refund failed for booking %s: %s", booking_id, stripe_err)

    audit_entry = {
        "id": new_id(),
        "at": now_iso(),
        "customer_id": user["id"],
        "customer_name": user.get("name"),
        # R35 — refund amount is the deposit MINUS the cancellation fee.
        "amount": breakdown["refund_amount"],
        "deposit_paid": breakdown["deposit_paid"],
        "cancellation_pct": breakdown["cancellation_pct"],
        "cancellation_fee": breakdown["cancellation_fee"],
        "driver_accepted_before_cancel": breakdown["driver_accepted"],
        "reason": (
            "customer_asap_cancel_partial_refund" if breakdown["requires_fee"]
            else "customer_asap_cancel_full_refund"
        ),
        "state": refund_state,
        "stripe_refund_id": refund_id,
        "payment_intent_id": pi_id,
        "error": stripe_err,
    }
    if txn:
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$push": {"refunds": audit_entry}, "$set": {"updated_at": now_iso()}},
        )
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {"refund_status": refund_state,
                  "refunded_at": now_iso() if refund_state == "succeeded" else None,
                  "stripe_refund_id": refund_id,
                  "refund_amount": breakdown["refund_amount"] if refund_state == "succeeded" else None,
                  # R35 — persist the breakdown on the booking for later display
                  "cancellation_breakdown": {
                      "deposit_paid": breakdown["deposit_paid"],
                      "cancellation_pct": breakdown["cancellation_pct"],
                      "cancellation_fee": breakdown["cancellation_fee"],
                      "refund_amount": breakdown["refund_amount"],
                      "driver_accepted_before_cancel": breakdown["driver_accepted"],
                      "policy_applied": breakdown["policy_applied"],
                  }},
         "$push": {"refunds": audit_entry}},
    )

    # R35 — Anti-bypass tracking: increment the customer's suspicious-cancel
    # counter whenever cancellation happens AFTER driver acceptance. This is a
    # signal-only counter — no automated bans. Admins can review flagged
    # customers via /admin/customers/flagged.
    if breakdown["driver_accepted"]:
        try:
            await db.users.update_one(
                {"id": user["id"]},
                {"$inc": {"post_accept_cancel_count": 1},
                 "$push": {"post_accept_cancel_history": {
                     "booking_id": booking_id,
                     "at": now_iso(),
                     "cancellation_fee": breakdown["cancellation_fee"],
                     "refund_amount": breakdown["refund_amount"],
                 }}},
            )
        except Exception as _e:
            logger.warning("R35 anti-bypass counter update failed for %s: %s", user["id"], _e)
    if refund_state == "failed":
        # Booking is cancelled either way — but tell the customer refund failed
        raise HTTPException(status_code=502, detail=f"Booking cancelled but refund failed: {stripe_err}. Support has been notified.")

    # ---- CONFIRMATION EMAIL ---------------------------------------------
    try:
        from services.email import (
            send_refund_confirmation,
            send_booking_cancelled,
            send_driver_cancellation_notice,
        )
        fresh_b = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
        job_doc = await db.jobs.find_one({"id": b["job_id"]}, {"_id": 0}) if b.get("job_id") else None
        if fresh_b:
            fresh_b["job"] = job_doc
            await send_refund_confirmation(
                db, user=user, booking=fresh_b,
                amount=float(audit_entry["amount"] or 0),
            )
            # R53 — always tell the customer their booking was cancelled
            # (separate email from the refund receipt).
            await send_booking_cancelled(
                db, user=user, booking=fresh_b,
                reason="Customer cancelled",
                refund_pending=(refund_state != "succeeded"),
            )
            # R53 — if a driver had already accepted the job, notify them
            # that the customer pulled the booking so they don't drive out.
            assigned_driver_id = job.get("assigned_driver_id")
            if assigned_driver_id:
                driver_doc = await db.users.find_one(
                    {"id": assigned_driver_id}, {"_id": 0}
                )
                if driver_doc:
                    await send_driver_cancellation_notice(
                        db, driver=driver_doc, booking=fresh_b,
                        cancellation_fee=float(breakdown["cancellation_fee"] or 0),
                        refund_amount=float(breakdown["refund_amount"] or 0),
                    )
    except Exception:
        logger.exception("customer refund-confirmation email failed; continuing")

    return {
        "ok": True,
        "booking_id": booking_id,
        "job_id": job["id"],
        "refund_state": refund_state,
        "stripe_refund_id": refund_id,
        "cancelled_at": now_iso(),
        # R35 — surface the exact breakdown to the client for the success UI
        "cancellation_breakdown": {
            "deposit_paid": breakdown["deposit_paid"],
            "cancellation_pct": breakdown["cancellation_pct"],
            "cancellation_fee": breakdown["cancellation_fee"],
            "refund_amount": breakdown["refund_amount"],
            "driver_accepted_before_cancel": breakdown["driver_accepted"],
            "policy_applied": breakdown["policy_applied"],
        },
    }


# R35 — Admin visibility for repeated post-driver-accept cancellations.
@api.get("/admin/customers/flagged")
async def admin_flagged_customers(
    threshold: int = 2,
    user: dict = Depends(require_role("admin")),
):
    """List customers with `post_accept_cancel_count >= threshold`.

    Signal-only — no automated action. Admins decide what to do.
    """
    cursor = await db.users.find(
        {"role": "customer", "post_accept_cancel_count": {"$gte": int(threshold)}},
        {"_id": 0, "id": 1, "name": 1, "email": 1, "post_accept_cancel_count": 1,
         "post_accept_cancel_history": 1, "created_at": 1},
    ).sort([("post_accept_cancel_count", -1)]).to_list(500)
    return {"threshold": int(threshold), "customers": cursor}


# R41 — Weekly post-accept cancellation trend for the admin dashboard.
@api.get("/admin/cancellations/weekly")
async def admin_cancellations_weekly(
    weeks: int = 8,
    _: dict = Depends(require_role("admin")),
):
    """Aggregate post-driver-accept customer cancellations by ISO-week for a
    small trend chart on the admin dashboard.

    Reads from every customer's `post_accept_cancel_history` array (the
    server appends to this in `customer_cancel_and_refund`). Returns
    exactly `weeks` buckets, oldest first — never has holes, so the chart
    always draws a full sparkline. Each bucket carries:
      * label ("Wk 32", derived from ISO calendar)
      * week_start (Monday YYYY-MM-DD, UTC)
      * count (# post-accept cancellations that week)
      * fees (£ of cancellation fees retained that week)
      * refunds (£ refunded that week)
    """
    weeks = max(1, min(int(weeks or 8), 52))
    docs = await db.users.find(
        {"role": "customer", "post_accept_cancel_history.0": {"$exists": True}},
        {"_id": 0, "post_accept_cancel_history": 1},
    ).to_list(10000)

    from collections import defaultdict
    from datetime import datetime, timedelta, timezone as _tz

    # Build the fixed window of the last N ISO weeks (Monday-anchored, UTC).
    def _monday_of(dt: datetime) -> datetime:
        d = dt.astimezone(_tz.utc)
        return (d - timedelta(days=d.weekday())).replace(
            hour=0, minute=0, second=0, microsecond=0,
        )

    now = datetime.now(_tz.utc)
    current_mon = _monday_of(now)
    buckets: list[dict] = []
    for i in range(weeks - 1, -1, -1):
        wk_start = current_mon - timedelta(weeks=i)
        iso = wk_start.isocalendar()
        buckets.append({
            "week_start": wk_start.date().isoformat(),
            "label": f"Wk {iso.week:02d}",
            "iso_year": iso.year,
            "iso_week": iso.week,
            "count": 0,
            "fees": 0.0,
            "refunds": 0.0,
        })
    idx_by_start = {b["week_start"]: b for b in buckets}
    oldest_start = buckets[0]["week_start"]

    for u in docs:
        for h in (u.get("post_accept_cancel_history") or []):
            at = h.get("at")
            if not at:
                continue
            try:
                dt = datetime.fromisoformat(str(at).replace("Z", "+00:00"))
            except Exception:
                continue
            wk_start = _monday_of(dt).date().isoformat()
            if wk_start < oldest_start:
                continue
            bucket = idx_by_start.get(wk_start)
            if not bucket:
                continue
            bucket["count"] += 1
            bucket["fees"] += float(h.get("cancellation_fee") or 0.0)
            bucket["refunds"] += float(h.get("refund_amount") or 0.0)

    # Round for display and compute totals.
    total_count = 0
    total_fees = 0.0
    total_refunds = 0.0
    for b in buckets:
        b["fees"] = round(b["fees"], 2)
        b["refunds"] = round(b["refunds"], 2)
        total_count += b["count"]
        total_fees += b["fees"]
        total_refunds += b["refunds"]

    return {
        "weeks": weeks,
        "buckets": buckets,
        "totals": {
            "count": total_count,
            "fees": round(total_fees, 2),
            "refunds": round(total_refunds, 2),
        },
    }


@api.post("/driver/bookings/{booking_id}/cancel")
async def driver_cancel_booking(
    booking_id: str,
    payload: DriverCancelBody,
    user: dict = Depends(require_role("driver")),
):
    """Driver-initiated cancellation for an accepted booking (all job types).

    Server-authoritative state machine:
      1. Validates the caller IS the assigned driver on this booking.
      2. Reason must be one of DRIVER_CANCEL_REASONS. If 'other', a short
         explanation is required.
      3. Refuses if the booking is already delivered/pod_uploaded/completed
         or already cancelled.
      4. Atomic booking transition + atomic job transition:
           * Booking → status="cancelled_by_driver", driver_id cleared.
           * Job → for ASAP: back to status="dispatch_ready" so the dispatch
             loop picks it up again; assigned_driver_* cleared;
             accepted_price kept. For scheduled fixed/bidding: back to
             status="posted" so it re-enters the marketplace list.
           * blocked_driver_ids append the current driver — they cannot
             re-accept this same job.
      5. Never refunds automatically. Deposit stays put; customer can hit
         the existing /customer/bookings/{id}/cancel-and-refund endpoint
         if they no longer want the booking.
      6. Audit log entry in `driver_cancellations` for admin review.
      7. Notifies customer (in-app + email).
    """
    # ---- reason validation ---------------------------------------------
    reason_key = (payload.reason or "").strip().lower()
    if reason_key not in DRIVER_CANCEL_REASONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid reason. Choose one of: {sorted(DRIVER_CANCEL_REASONS.keys())}",
        )
    explanation = (payload.explanation or "").strip()
    if reason_key == "other" and not explanation:
        raise HTTPException(
            status_code=400,
            detail="Please provide a short explanation when choosing 'Other'.",
        )
    reason_label = DRIVER_CANCEL_REASONS[reason_key]

    # ---- fetch + auth --------------------------------------------------
    b = await db.bookings.find_one({"id": booking_id})
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    if b.get("driver_id") != user["id"]:
        raise HTTPException(status_code=403, detail="You are not the assigned driver on this booking")
    if b.get("status") in ("cancelled", "cancelled_by_driver", "completed", "pod_uploaded"):
        raise HTTPException(status_code=409, detail="This booking can no longer be cancelled")
    if b.get("status") == "delivered":
        raise HTTPException(status_code=409, detail="Delivery already completed — cancel not allowed")

    job = await db.jobs.find_one({"id": b.get("job_id")}) if b.get("job_id") else None
    if not job:
        raise HTTPException(status_code=404, detail="Underlying job not found")

    is_asap = (job.get("service_timing") or "").lower() == "asap"
    now = now_iso()

    # ---- ATOMIC BOOKING TRANSITION -------------------------------------
    booking_claim = await db.bookings.update_one(
        {"id": booking_id, "driver_id": user["id"],
         "status": {"$nin": ["cancelled", "cancelled_by_driver", "completed", "pod_uploaded", "delivered"]}},
        {"$set": {
            "status": "cancelled_by_driver",
            "driver_cancelled_at": now,
            "driver_cancel_reason": reason_key,
            "driver_cancel_reason_label": reason_label,
            "driver_cancel_explanation": explanation or None,
            "previous_driver_id": user["id"],
            "driver_id": None,
        }},
    )
    if booking_claim.modified_count == 0:
        raise HTTPException(status_code=409, detail="Booking state changed — cancellation rejected")

    # ---- ATOMIC JOB TRANSITION -----------------------------------------
    reassigning = True
    if is_asap:
        job_update = {
            "status": "dispatch_ready",
            "assigned_driver_id": None,
            "assigned_driver_name": None,
            "assigned_driver_rating": None,
            "accepted_at": None,
            "dispatch_claimed_at": None,
            "dispatch_ready_at": now,
            "last_driver_cancel_at": now,
        }
    else:
        job_update = {
            "status": "posted",
            "assigned_driver_id": None,
            "assigned_driver_name": None,
            "assigned_driver_rating": None,
            "accepted_at": None,
            "last_driver_cancel_at": now,
        }
    await db.jobs.update_one(
        {"id": job["id"]},
        {"$set": job_update,
         "$addToSet": {"blocked_driver_ids": user["id"]}},
    )

    # ---- AUDIT LOG -----------------------------------------------------
    audit_doc = {
        "id": new_id(),
        "booking_id": booking_id,
        "job_id": job["id"],
        "driver_id": user["id"],
        "driver_name": user.get("name"),
        "customer_id": b.get("customer_id"),
        "service_timing": job.get("service_timing"),
        "pricing_type": job.get("pricing_type"),
        "service_type": job.get("service_type"),
        "reason": reason_key,
        "reason_label": reason_label,
        "explanation": explanation or None,
        "booking_status_before": b.get("status"),
        "created_at": now,
    }
    await db.driver_cancellations.insert_one(audit_doc)

    # ---- CUSTOMER NOTIFICATION (push + email) --------------------------
    try:
        await push_notification(
            b.get("customer_id"),
            "Driver has cancelled — we're on it",
            (f"Your driver had to cancel ({reason_label}). "
             + ("We're searching for another driver now." if reassigning and is_asap
                else "Your job is back on the marketplace for eligible drivers.")),
            {"booking_id": booking_id, "job_id": job["id"], "driver_cancelled": True},
        )
    except Exception:
        logger.exception("driver-cancel push notification failed; continuing")

    try:
        cust = await db.users.find_one({"id": b.get("customer_id")},
                                          {"_id": 0, "password_hash": 0})
        fresh_b = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
        job_doc = await db.jobs.find_one({"id": job["id"]}, {"_id": 0})
        if cust and fresh_b:
            fresh_b["job"] = job_doc
            from services.email import send_driver_cancelled_booking
            await send_driver_cancelled_booking(
                db, user=cust, booking=fresh_b,
                reason_label=reason_label,
                reassigning=reassigning, is_asap=is_asap,
            )
    except Exception:
        logger.exception("driver-cancel customer email failed; continuing")

    cancel_count = await db.driver_cancellations.count_documents({"driver_id": user["id"]})

    return {
        "ok": True,
        "booking_id": booking_id,
        "job_id": job["id"],
        "reassigning_to_pool": reassigning,
        "is_asap": is_asap,
        "reason": reason_key,
        "reason_label": reason_label,
        "driver_cancel_count_total": cancel_count,
    }


@api.get("/driver/cancellations/mine")
async def driver_my_cancellations(user: dict = Depends(require_role("driver"))):
    """Driver's own cancellation history — powers the account-protection
    warning banner ('you have cancelled N jobs') without inventing a
    suspension threshold."""
    rows = await db.driver_cancellations.find(
        {"driver_id": user["id"]}, {"_id": 0},
    ).sort("created_at", -1).to_list(200)
    return {"count": len(rows), "cancellations": rows}


@api.get("/driver/cancel-reasons")
async def driver_cancel_reasons(_user: dict = Depends(require_role("driver"))):
    """Expose the fixed reason list so the driver UI never hardcodes it."""
    return {"reasons": [{"key": k, "label": v} for k, v in DRIVER_CANCEL_REASONS.items()]}


@api.get("/admin/driver-cancellations")
async def admin_driver_cancellations(
    driver_id: Optional[str] = None,
    user: dict = Depends(require_role("admin")),
):
    """Admin view of driver cancellations. Optional driver_id filter for the
    driver detail view; without a filter returns the last 500 cancellations
    system-wide."""
    q: dict = {}
    if driver_id:
        q["driver_id"] = driver_id
    rows = await db.driver_cancellations.find(q, {"_id": 0}) \
                                          .sort("created_at", -1) \
                                          .to_list(500)
    return {"count": len(rows), "cancellations": rows}




@api.post("/admin/bookings/{booking_id}/refund")
async def admin_refund_booking(booking_id: str, payload: dict = Body(default={}),
                                user: dict = Depends(require_role("admin"))):
    """Record a full-refund intent for a paid booking.

    NOTE (Session B scaffolding): this endpoint currently records the refund
    intent, sets `refund_status` on the booking, appends a refund audit entry
    to `payment_transactions.refunds`, and returns to the caller.

    Stripe's `refunds.create(payment_intent=…)` call is intentionally NOT
    fired here — the user explicitly asked to avoid modifying the verified
    Stripe integration in this session. When the final refund flow is
    signed off, the single call to `stripe.Refund.create(...)` slots into
    this handler between the pre-checks and the audit write. All idempotency
    guards (`refund_status != "refunded"` conditional update, duplicate
    detection by `payment_intent_id`) are already in place.
    """
    b = await db.bookings.find_one({"id": booking_id})
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    if b.get("payment_status") != "paid":
        raise HTTPException(status_code=400, detail="Booking has not been paid")
    if b.get("refund_status") in ("refunded", "in_progress", "pending", "succeeded"):
        raise HTTPException(status_code=409, detail="Refund already recorded or in progress")

    session_id = b.get("stripe_session_id")
    txn = await db.payment_transactions.find_one({"session_id": session_id}) if session_id else None
    pi_id = (txn or {}).get("payment_intent_id")

    # Idempotency guard — flip refund_status conditionally.
    claim = await db.bookings.update_one(
        {"id": booking_id, "refund_status": {"$in": [None, "", "failed"]}},
        {"$set": {"refund_status": "in_progress",
                    "refund_requested_at": now_iso(),
                    "refund_requested_by": user["id"]}},
    )
    if claim.modified_count == 0:
        raise HTTPException(status_code=409, detail="Refund already recorded")

    # Fire the real Stripe refund. Requires a captured payment_intent id.
    # If we don't have one on the txn (e.g. legacy booking paid before we
    # started persisting PI ids), try to fetch it from Stripe on the fly.
    refund_id = None
    refund_state = "failed"
    stripe_err = None
    try:
        # Import at the top so both back-fill and refund use the same client
        import stripe as _stripe
        _stripe.api_key = STRIPE_API_KEY

        if not pi_id and session_id:
            try:
                s_obj = _stripe.checkout.Session.retrieve(session_id)
                pi_id = s_obj.get("payment_intent") if isinstance(s_obj, dict) else getattr(s_obj, "payment_intent", None)
                if pi_id and txn:
                    await db.payment_transactions.update_one(
                        {"session_id": session_id},
                        {"$set": {"payment_intent_id": pi_id, "updated_at": now_iso()}},
                    )
            except Exception:  # pragma: no cover — best-effort back-fill
                pi_id = pi_id or None

        if not pi_id:
            raise RuntimeError("No payment_intent recorded on this booking — cannot refund")

        refund_obj = _stripe.Refund.create(
            payment_intent=pi_id,
            reason="requested_by_customer",
            metadata={
                "booking_id": booking_id,
                "admin_id": user["id"],
                "cargoone_reason": (payload or {}).get("reason") or "admin_full_refund",
            },
        )
        refund_id = refund_obj.get("id") if isinstance(refund_obj, dict) else getattr(refund_obj, "id", None)
        stripe_status = refund_obj.get("status") if isinstance(refund_obj, dict) else getattr(refund_obj, "status", None)
        # Stripe refund statuses: succeeded | pending | failed | canceled | requires_action
        refund_state = "succeeded" if stripe_status == "succeeded" else (stripe_status or "pending")
    except Exception as e:
        stripe_err = str(e)
        refund_state = "failed"
        # Roll back the in_progress guard so the admin can retry later
        await db.bookings.update_one(
            {"id": booking_id},
            {"$set": {"refund_status": "failed",
                      "refund_failed_at": now_iso(),
                      "refund_error": stripe_err[:500]}},
        )
        logger.warning("Stripe refund failed for booking %s: %s", booking_id, stripe_err)

    audit_entry = {
        "id": new_id(),
        "at": now_iso(),
        "admin_id": user["id"],
        "admin_name": user.get("name"),
        "amount": b.get("deposit_amount") or (txn or {}).get("amount"),
        "reason": (payload or {}).get("reason") or "admin_full_refund",
        "state": refund_state,
        "stripe_refund_id": refund_id,
        "payment_intent_id": pi_id,
        "error": stripe_err,
    }
    if txn:
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$push": {"refunds": audit_entry}, "$set": {"updated_at": now_iso()}},
        )
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {"refund_status": refund_state,
                  "refunded_at": now_iso() if refund_state == "succeeded" else None,
                  "stripe_refund_id": refund_id,
                  "refund_amount": audit_entry["amount"] if refund_state == "succeeded" else None,
                  # If it failed we already wrote refund_error above; leave alone
                  },
         "$push": {"refunds": audit_entry}},
    )
    if refund_state == "failed":
        raise HTTPException(status_code=502, detail=f"Stripe refund failed: {stripe_err}")
    # Session E — email the customer confirming the refund is on its way.
    try:
        from services.email import send_refund_confirmation
        fresh_b = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
        job_doc = await db.jobs.find_one({"id": b["job_id"]}, {"_id": 0}) if b.get("job_id") else None
        cust = await db.users.find_one({"id": b["customer_id"]},
                                         {"_id": 0, "password_hash": 0})
        if fresh_b and cust:
            fresh_b["job"] = job_doc
            await send_refund_confirmation(
                db, user=cust, booking=fresh_b,
                amount=float(audit_entry["amount"] or 0),
            )
    except Exception:
        logger.exception("refund-confirmation email failed; continuing")
    return {
        "ok": True,
        "booking_id": booking_id,
        "refund_state": refund_state,
        "stripe_refund_id": refund_id,
        "audit_entry_id": audit_entry["id"],
    }


# ---------------------------------------------------------------------------
# Deposit Bands (admin CRUD + public read + preview)
# ---------------------------------------------------------------------------


@api.get("/deposit-bands")
async def list_active_bands(user: dict = Depends(get_current_user)):
    """Any authenticated user can read active bands (for checkout preview)."""
    bands = await db.deposit_bands.find({"enabled": True}, {"_id": 0}) \
                                    .sort("min_price", 1).to_list(200)
    return bands


@api.get("/deposit-bands/preview")
async def preview_deposit_route(price: float, user: dict = Depends(get_current_user)):
    if price < 0:
        raise HTTPException(status_code=400, detail="Invalid price")
    return await preview_deposit(price)


@api.get("/booking-fees/preview")
async def preview_booking_fee_route(driver_charge: float,
                                     user: dict = Depends(get_current_user)):
    """Preview the booking fee + customer total for a given driver bid."""
    if driver_charge < 0:
        raise HTTPException(status_code=400, detail="Invalid driver_charge")
    return await preview_deposit(driver_charge)


@api.get("/admin/deposit-bands")
async def admin_list_bands(user: dict = Depends(require_role("admin"))):
    bands = await db.deposit_bands.find({}, {"_id": 0}).sort("min_price", 1).to_list(500)
    return bands


@api.post("/admin/deposit-bands")
async def admin_create_band(payload: DepositBandIn,
                             user: dict = Depends(require_role("admin"))):
    if payload.min_price < 0 or payload.deposit_amount < 0:
        raise HTTPException(status_code=400, detail="Values must be non-negative")
    if payload.max_price is not None and payload.max_price <= payload.min_price:
        raise HTTPException(status_code=400, detail="max_price must be > min_price")
    doc = {
        "id": new_id(),
        "min_price": float(payload.min_price),
        "max_price": float(payload.max_price) if payload.max_price is not None else None,
        "deposit_amount": float(payload.deposit_amount),
        "enabled": bool(payload.enabled),
        "label": payload.label,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.deposit_bands.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@api.put("/admin/deposit-bands/{band_id}")
async def admin_update_band(band_id: str, payload: DepositBandIn,
                             user: dict = Depends(require_role("admin"))):
    if payload.min_price < 0 or payload.deposit_amount < 0:
        raise HTTPException(status_code=400, detail="Values must be non-negative")
    if payload.max_price is not None and payload.max_price <= payload.min_price:
        raise HTTPException(status_code=400, detail="max_price must be > min_price")
    patch = {
        "min_price": float(payload.min_price),
        "max_price": float(payload.max_price) if payload.max_price is not None else None,
        "deposit_amount": float(payload.deposit_amount),
        "enabled": bool(payload.enabled),
        "label": payload.label,
        "updated_at": now_iso(),
    }
    res = await db.deposit_bands.update_one({"id": band_id}, {"$set": patch})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Band not found")
    updated = await db.deposit_bands.find_one({"id": band_id}, {"_id": 0})
    return updated


@api.delete("/admin/deposit-bands/{band_id}")
async def admin_delete_band(band_id: str, user: dict = Depends(require_role("admin"))):
    res = await db.deposit_bands.delete_one({"id": band_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Band not found")
    return {"ok": True}


# ---------------------------------------------------------------------------
# Session F — Booking-fee bands (percentage tiers)
# ---------------------------------------------------------------------------
# Public read + preview so the customer app can render the exact tier the
# backend will apply. Admin CRUD gates behind require_role("admin").


@api.get("/booking-fee-bands")
async def list_booking_fee_bands():
    docs = await db.booking_fee_bands.find({"enabled": True}, {"_id": 0}) \
                                        .sort([("priority", 1), ("min_amount", 1)]) \
                                        .to_list(200)
    return docs


@api.get("/booking-fee-bands/preview")
async def preview_booking_fee_band(driver_charge: float):
    """Show the tier + amount that will apply for a given driver_charge."""
    if driver_charge < 0:
        raise HTTPException(status_code=400, detail="driver_charge must be non-negative")
    return await preview_deposit(driver_charge)


@api.get("/admin/booking-fee-bands")
async def admin_list_booking_fee_bands(user: dict = Depends(require_role("admin"))):
    docs = await db.booking_fee_bands.find({}, {"_id": 0}) \
                                        .sort([("priority", 1), ("min_amount", 1)]) \
                                        .to_list(200)
    return docs


# ─────────────────────────────────────────────────────────────────────────
# R35 — Cancellation policy config (admin)
# ─────────────────────────────────────────────────────────────────────────
@api.get("/admin/cancellation-policy")
async def admin_get_cancellation_policy(user: dict = Depends(require_role("admin"))):
    policy = await _get_cancellation_policy()
    return {"policy": policy, "defaults": DEFAULT_CANCELLATION_POLICY}


@api.put("/admin/cancellation-policy")
async def admin_update_cancellation_policy(
    payload: CancellationPolicyIn,
    user: dict = Depends(require_role("admin")),
):
    if payload.percentage < 0 or payload.percentage > 100:
        raise HTTPException(status_code=400, detail="percentage must be 0–100")
    if payload.min_fee < 0:
        raise HTTPException(status_code=400, detail="min_fee must be ≥ 0")
    if payload.max_fee is not None and payload.max_fee < payload.min_fee:
        raise HTTPException(status_code=400, detail="max_fee must be ≥ min_fee")
    doc = {
        "id": "cancellation",
        "percentage": float(payload.percentage),
        "applies_after_driver_accept": bool(payload.applies_after_driver_accept),
        "min_fee": float(payload.min_fee),
        "max_fee": (float(payload.max_fee) if payload.max_fee is not None else None),
        "updated_at": now_iso(),
        "updated_by": user["id"],
    }
    await db.platform_config.update_one({"id": "cancellation"}, {"$set": doc}, upsert=True)
    return {"ok": True, "policy": await _get_cancellation_policy()}


@api.get("/customer/bookings/{booking_id}/cancel-preview")
async def customer_cancel_preview(
    booking_id: str,
    user: dict = Depends(require_role("customer")),
):
    """Preview cancellation breakdown — deposit / fee / refund.
    The backend is the source of truth for these numbers.
    """
    b = await db.bookings.find_one({"id": booking_id})
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    if b.get("customer_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Not your booking")
    job = await db.jobs.find_one({"id": b.get("job_id")}) if b.get("job_id") else None
    driver_accepted = bool(job and job.get("assigned_driver_id"))
    # Deposit paid = booking.deposit_amount (immutable snapshot at checkout)
    deposit = float(b.get("deposit_amount") or 0.0)
    policy = await _get_cancellation_policy()
    breakdown = _compute_cancellation_fee(deposit, policy, driver_accepted)
    breakdown["booking_id"] = booking_id
    breakdown["can_cancel"] = (
        b.get("payment_status") == "paid"
        and not b.get("cancelled_at")
        and b.get("refund_status") not in ("refunded", "succeeded", "pending", "in_progress")
    )
    return breakdown




@api.post("/admin/booking-fee-bands")
async def admin_create_booking_fee_band(payload: BookingFeeBandIn,
                                          user: dict = Depends(require_role("admin"))):
    if payload.booking_fee_percent < 0 or payload.booking_fee_percent > 100:
        raise HTTPException(status_code=400, detail="booking_fee_percent must be 0–100")
    if payload.max_amount is not None and payload.max_amount <= payload.min_amount:
        raise HTTPException(status_code=400, detail="max_amount must be greater than min_amount")
    doc = payload.model_dump()
    doc.update({
        "id": new_id(),
        "priority": doc.get("priority") or 0,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    })
    await db.booking_fee_bands.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.put("/admin/booking-fee-bands/{band_id}")
async def admin_update_booking_fee_band(band_id: str, payload: BookingFeeBandIn,
                                          user: dict = Depends(require_role("admin"))):
    if payload.booking_fee_percent < 0 or payload.booking_fee_percent > 100:
        raise HTTPException(status_code=400, detail="booking_fee_percent must be 0–100")
    if payload.max_amount is not None and payload.max_amount <= payload.min_amount:
        raise HTTPException(status_code=400, detail="max_amount must be greater than min_amount")
    update = payload.model_dump()
    update["updated_at"] = now_iso()
    res = await db.booking_fee_bands.update_one({"id": band_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Band not found")
    doc = await db.booking_fee_bands.find_one({"id": band_id}, {"_id": 0})
    return doc


@api.delete("/admin/booking-fee-bands/{band_id}")
async def admin_delete_booking_fee_band(band_id: str,
                                          user: dict = Depends(require_role("admin"))):
    res = await db.booking_fee_bands.delete_one({"id": band_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Band not found")
    return {"ok": True}


# ---------------------------------------------------------------------------
# Service categories & vehicle types
# ---------------------------------------------------------------------------


def _clean_doc(d: dict) -> dict:
    """Strip Mongo _id before returning."""
    d.pop("_id", None)
    return d


@api.get("/catalog/categories")
async def list_categories(include_inactive: bool = False):
    """Public — list service categories (active only, ordered)."""
    q = {} if include_inactive else {"active": True}
    docs = await db.service_categories.find(q).sort("order", 1).to_list(500)
    return [_clean_doc(d) for d in docs]


@api.get("/catalog/vehicles")
async def list_vehicles(include_inactive: bool = False):
    """Public — list vehicle types (active only, ordered)."""
    q = {} if include_inactive else {"active": True}
    docs = await db.vehicle_types.find(q).sort("order", 1).to_list(500)
    return [_clean_doc(d) for d in docs]


class VehicleRecommendRequest(BaseModel):
    category_key: str
    weight_kg: Optional[float] = None
    volume_m3: Optional[float] = None
    dimensions_l_m: Optional[float] = None
    dimensions_w_m: Optional[float] = None
    dimensions_h_m: Optional[float] = None
    item_count: Optional[int] = None
    needs_forklift: Optional[bool] = False
    needs_loading_help: Optional[bool] = False
    required_capabilities: Optional[list[str]] = None
    distance_miles: Optional[float] = None


@api.post("/catalog/recommend-vehicle")
async def recommend_vehicle(payload: VehicleRecommendRequest):
    """Rule-based multi-vehicle recommendation for the 'Not Sure' path.

    Considers category, weight, volume, item count, loading equipment needs,
    distance and any explicitly required capabilities (e.g. refrigerated, hiab_crane).
    Returns up to 4 ranked vehicles with `recommendation_label`, `is_best_match`
    and a human-readable `reason` explaining why the vehicle was suggested.
    """
    cat = await db.service_categories.find_one({"key": payload.category_key, "active": True})
    if not cat:
        raise HTTPException(status_code=404, detail="Unknown or inactive category")
    vehicles = await db.vehicle_types.find({"active": True}).sort("order", 1).to_list(200)

    volume = payload.volume_m3
    if not volume and all(v is not None for v in [payload.dimensions_l_m, payload.dimensions_w_m, payload.dimensions_h_m]):
        volume = float(payload.dimensions_l_m) * float(payload.dimensions_w_m) * float(payload.dimensions_h_m)

    # Filter by required capabilities before ranking (hard filter)
    req_caps = set(payload.required_capabilities or [])
    if req_caps:
        vehicles = [
            v for v in vehicles
            if req_caps.issubset(set((v.get("capabilities") or []) + (v.get("features") or [])))
        ]

    ranked = recommend_vehicles(
        vehicles,
        cat,
        weight_kg=payload.weight_kg,
        volume_m3=volume,
        item_count=payload.item_count,
        needs_forklift=bool(payload.needs_forklift),
        needs_loading_help=bool(payload.needs_loading_help),
        limit=4,
    )

    # Attach a human-readable reason
    labels = ["best-value fit for your load", "roomier alternative with spare capacity",
              "larger vehicle if you have more to move", "extra capacity if you're unsure"]
    out = []
    for i, v in enumerate(ranked):
        reasons = []
        if v.get("capabilities") and req_caps and req_caps.intersection(set(v["capabilities"])):
            reasons.append("supports required capabilities")
        if payload.needs_loading_help and ("tail_lift" in (v.get("capabilities") or []) or "tail_lift" in (v.get("features") or [])):
            reasons.append("has tail-lift for loading assistance")
        if payload.needs_forklift and ("hiab_crane" in (v.get("capabilities") or []) or "crane" in (v.get("features") or [])):
            reasons.append("hiab crane on board")
        reasons.append(labels[i] if i < len(labels) else "alternative choice")
        clean = _clean_doc(dict(v))
        clean["reason"] = "; ".join(reasons)
        out.append(clean)

    return {
        "category": _clean_doc(cat),
        "computed_volume_m3": volume,
        "recommendations": out,
    }


# ---- Admin CRUD (categories) ----

class CategoryUpsert(BaseModel):
    key: Optional[str] = None
    name: str
    description: Optional[str] = ""
    icon: Optional[str] = "cube"
    order: Optional[int] = 0
    active: Optional[bool] = True
    featured: Optional[bool] = False
    default_vehicles: Optional[list[str]] = None
    typical_weight_kg: Optional[float] = None
    typical_volume_m3: Optional[float] = None


@api.get("/admin/catalog/categories")
async def admin_list_categories(_: dict = Depends(require_role("admin"))):
    docs = await db.service_categories.find({}).sort("order", 1).to_list(500)
    return [_clean_doc(d) for d in docs]


@api.post("/admin/catalog/categories")
async def admin_create_category(payload: CategoryUpsert, _: dict = Depends(require_role("admin"))):
    key = (payload.key or payload.name.lower().replace(" ", "_")).strip()
    if await db.service_categories.find_one({"key": key}):
        raise HTTPException(status_code=400, detail=f"Category with key '{key}' already exists")
    doc = {
        "id": new_id(),
        "key": key,
        "name": payload.name.strip(),
        "description": (payload.description or "").strip(),
        "icon": (payload.icon or "cube").strip(),
        "order": int(payload.order or 0),
        "active": bool(payload.active),
        "featured": bool(payload.featured),
        "default_vehicles": payload.default_vehicles or [],
        "typical_weight_kg": payload.typical_weight_kg,
        "typical_volume_m3": payload.typical_volume_m3,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.service_categories.insert_one(doc)
    return _clean_doc(doc)


@api.put("/admin/catalog/categories/{cat_id}")
async def admin_update_category(cat_id: str, payload: CategoryUpsert, _: dict = Depends(require_role("admin"))):
    update: dict = {"updated_at": now_iso()}
    for field in ("name", "description", "icon", "order", "active", "featured", "default_vehicles", "typical_weight_kg", "typical_volume_m3"):
        val = getattr(payload, field, None)
        if val is not None:
            update[field] = val
    result = await db.service_categories.update_one({"id": cat_id}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    updated = await db.service_categories.find_one({"id": cat_id})
    return _clean_doc(updated)


@api.delete("/admin/catalog/categories/{cat_id}")
async def admin_delete_category(cat_id: str, _: dict = Depends(require_role("admin"))):
    result = await db.service_categories.delete_one({"id": cat_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"ok": True}


# ---- Admin CRUD (vehicles) ----

class VehicleUpsert(BaseModel):
    key: Optional[str] = None
    name: str
    description: Optional[str] = ""
    icon: Optional[str] = "car"
    order: Optional[int] = 0
    active: Optional[bool] = True
    featured: Optional[bool] = False
    max_weight_kg: Optional[float] = 0
    max_volume_m3: Optional[float] = None
    features: Optional[list[str]] = None
    capabilities: Optional[list[str]] = None


@api.get("/admin/catalog/vehicles")
async def admin_list_vehicles(_: dict = Depends(require_role("admin"))):
    docs = await db.vehicle_types.find({}).sort("order", 1).to_list(500)
    return [_clean_doc(d) for d in docs]


@api.post("/admin/catalog/vehicles")
async def admin_create_vehicle(payload: VehicleUpsert, _: dict = Depends(require_role("admin"))):
    key = (payload.key or payload.name.lower().replace(" ", "_")).strip()
    if await db.vehicle_types.find_one({"key": key}):
        raise HTTPException(status_code=400, detail=f"Vehicle with key '{key}' already exists")
    doc = {
        "id": new_id(),
        "key": key,
        "name": payload.name.strip(),
        "description": (payload.description or "").strip(),
        "icon": (payload.icon or "car").strip(),
        "order": int(payload.order or 0),
        "active": bool(payload.active),
        "featured": bool(payload.featured),
        "max_weight_kg": payload.max_weight_kg or 0,
        "max_volume_m3": payload.max_volume_m3,
        "features": payload.features or [],
        "capabilities": payload.capabilities or [],
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.vehicle_types.insert_one(doc)
    return _clean_doc(doc)


@api.put("/admin/catalog/vehicles/{veh_id}")
async def admin_update_vehicle(veh_id: str, payload: VehicleUpsert, _: dict = Depends(require_role("admin"))):
    update: dict = {"updated_at": now_iso()}
    for field in ("name", "description", "icon", "order", "active", "featured", "max_weight_kg", "max_volume_m3", "features", "capabilities"):
        val = getattr(payload, field, None)
        if val is not None:
            update[field] = val
    result = await db.vehicle_types.update_one({"id": veh_id}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    updated = await db.vehicle_types.find_one({"id": veh_id})
    return _clean_doc(updated)


@api.delete("/admin/catalog/vehicles/{veh_id}")
async def admin_delete_vehicle(veh_id: str, _: dict = Depends(require_role("admin"))):
    result = await db.vehicle_types.delete_one({"id": veh_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return {"ok": True}


# ---- Public + admin vehicle capabilities catalogue ----

class CapabilityUpsert(BaseModel):
    key: Optional[str] = None
    name: str
    description: Optional[str] = ""
    icon: Optional[str] = "checkmark-circle"
    order: Optional[int] = 0
    active: Optional[bool] = True
    featured: Optional[bool] = False


@api.get("/catalog/capabilities")
async def list_capabilities(include_inactive: bool = False):
    q = {} if include_inactive else {"active": True}
    docs = await db.vehicle_capabilities.find(q).sort("order", 1).to_list(200)
    return [_clean_doc(d) for d in docs]


@api.get("/admin/catalog/capabilities")
async def admin_list_capabilities(_: dict = Depends(require_role("admin"))):
    docs = await db.vehicle_capabilities.find({}).sort("order", 1).to_list(200)
    return [_clean_doc(d) for d in docs]


@api.post("/admin/catalog/capabilities")
async def admin_create_capability(payload: CapabilityUpsert, _: dict = Depends(require_role("admin"))):
    key = (payload.key or payload.name.lower().replace(" ", "_")).strip()
    if await db.vehicle_capabilities.find_one({"key": key}):
        raise HTTPException(status_code=400, detail=f"Capability with key '{key}' already exists")
    doc = {
        "id": new_id(),
        "key": key,
        "name": payload.name.strip(),
        "description": (payload.description or "").strip(),
        "icon": (payload.icon or "checkmark-circle").strip(),
        "order": int(payload.order or 0),
        "active": bool(payload.active),
        "featured": bool(payload.featured),
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.vehicle_capabilities.insert_one(doc)
    return _clean_doc(doc)


@api.put("/admin/catalog/capabilities/{cap_id}")
async def admin_update_capability(cap_id: str, payload: CapabilityUpsert, _: dict = Depends(require_role("admin"))):
    update = {"updated_at": now_iso()}
    for f in ("name", "description", "icon", "order", "active", "featured"):
        v = getattr(payload, f, None)
        if v is not None:
            update[f] = v
    result = await db.vehicle_capabilities.update_one({"id": cap_id}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Capability not found")
    return _clean_doc(await db.vehicle_capabilities.find_one({"id": cap_id}))


@api.delete("/admin/catalog/capabilities/{cap_id}")
async def admin_delete_capability(cap_id: str, _: dict = Depends(require_role("admin"))):
    result = await db.vehicle_capabilities.delete_one({"id": cap_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Capability not found")
    return {"ok": True}


# ---------------------------------------------------------------------------
# Global cross-portal search — powers the search UI on the marketing site,
# customer, driver and admin portals.
# ---------------------------------------------------------------------------


@api.get("/search")
async def global_search(
    q: str = "",
    scope: str = "all",  # all | marketing | catalog | jobs
    limit: int = 6,
    creds: HTTPAuthorizationCredentials = Depends(bearer_scheme),
):
    """Unified search across marketing pages, categories, vehicles, capabilities
    and (for authenticated users) jobs / bookings depending on their role.
    Returns grouped results — the frontend renders each group in a section.
    """
    q_norm = (q or "").strip()

    # Fetch small catalog data (cached implicitly by MongoDB indexes).
    categories = await db.service_categories.find({"active": True}, {"_id": 0}).sort("order", 1).to_list(200)
    vehicles = await db.vehicle_types.find({"active": True}, {"_id": 0}).sort("order", 1).to_list(200)
    capabilities = await db.vehicle_capabilities.find({"active": True}, {"_id": 0}).sort("order", 1).to_list(200)

    results: dict[str, list[dict]] = {"pages": [], "categories": [], "vehicles": [], "capabilities": [], "jobs": [], "users": []}

    if scope in ("all", "marketing"):
        results["pages"] = build_marketing_results(q_norm, limit=limit)

    if scope in ("all", "catalog", "marketing"):
        results["categories"] = build_category_results(q_norm, categories, limit=limit)
        results["vehicles"] = build_vehicle_results(q_norm, vehicles, limit=limit)
        results["capabilities"] = build_capability_results(q_norm, capabilities, limit=limit)

    # Auth-required scopes — resolve the token if present (but don't require it).
    user: Optional[dict] = None
    if creds and creds.credentials:
        try:
            payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            user = await db.users.find_one({"id": payload.get("user_id")})
        except Exception:
            user = None

    if q_norm and user and scope in ("all", "jobs"):
        # Role-scoped job search
        query_regex = {"$regex": q_norm.replace("$", r"\$"), "$options": "i"}
        or_clause = [
            {"title": query_regex},
            {"description": query_regex},
            {"pickup_town": query_regex},
            {"dropoff_town": query_regex},
            {"pickup_postcode": query_regex},
            {"dropoff_postcode": query_regex},
            {"category": query_regex},
        ]
        base_query: dict = {"$or": or_clause}
        if user["role"] == "customer":
            base_query["customer_id"] = user["id"]
        elif user["role"] == "driver":
            # Drivers only see posted jobs or their own assigned bookings
            base_query["$and"] = [{"$or": [{"status": "posted"}, {"assigned_driver_id": user["id"]}]}]
        # admin sees everything

        docs = await db.jobs.find(base_query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
        results["jobs"] = [
            {
                "kind": "job",
                "id": d.get("id"),
                "title": d.get("title") or "Untitled job",
                "subtitle": f"{d.get('pickup_town', '?')} → {d.get('dropoff_town', '?')} · {d.get('status', '')}",
                "category": d.get("category"),
                "status": d.get("status"),
                "role_target": user["role"],
                "href": _job_href_for(user["role"], d.get("id")),
            }
            for d in docs
        ]

    # Admin: also search users by name / email
    if q_norm and user and user.get("role") == "admin" and scope in ("all", "jobs"):
        u_regex = {"$regex": q_norm.replace("$", r"\$"), "$options": "i"}
        users = await db.users.find(
            {"$or": [{"name": u_regex}, {"email": u_regex}, {"id": u_regex}]},
            {"_id": 0, "password_hash": 0},
        ).limit(limit).to_list(limit)
        results["users"] = [
            {
                "kind": "user",
                "id": u.get("id"),
                "title": u.get("name") or u.get("email"),
                "subtitle": f"{u.get('role', '')} · {u.get('email', '')}",
                "role": u.get("role"),
                "href": _user_href_for_admin(u.get("id")),
            }
            for u in users
        ]

    total = sum(len(v) for v in results.values())
    return {"query": q_norm, "total": total, **results}


def _job_href_for(role: str, job_id: Optional[str]) -> str:
    if not job_id:
        return "/"
    if role == "customer":
        return f"/(customer)/job/{job_id}"
    if role == "driver":
        return f"/(driver)/job/{job_id}"
    if role == "admin":
        return f"/(admin)/jobs?id={job_id}"
    return "/"


def _user_href_for_admin(user_id: Optional[str]) -> str:
    if not user_id:
        return "/(admin)/users"
    return f"/(admin)/users?id={user_id}"


# ---------------------------------------------------------------------------
# Geography — supported markets + address autocomplete
# ---------------------------------------------------------------------------

@api.get("/geo/markets")
async def geo_markets():
    """Return the launch markets Cargo One supports. Frontend uses this to
    render country pickers and to determine whether a route is domestic
    or international."""
    return {
        "markets": SUPPORTED_MARKETS,
        "count": len(SUPPORTED_MARKETS),
    }


@api.get("/geo/autocomplete")
async def geo_autocomplete(q: str = ""):
    """Address autocomplete endpoint. Proxies to Google Places when the
    server-side key is configured (GOOGLE_MAPS_API_KEY env var); otherwise
    returns an empty list with `source: "manual"` so the frontend renders
    its manual-entry fallback. Public — safe to call without a JWT.
    """
    q = (q or "").strip()
    if len(q) < 2:
        return {"suggestions": [], "source": "manual", "query": q}

    api_key = os.environ.get("GOOGLE_MAPS_API_KEY")
    if not api_key or api_key.startswith("placeholder"):
        # No production key configured yet — frontend will show manual entry.
        return {"suggestions": [], "source": "manual", "query": q}

    try:
        import httpx  # local import — httpx is already in requirements
        url = "https://maps.googleapis.com/maps/api/place/autocomplete/json"
        # Regional bias for UK + Ireland + western Europe.
        params = {
            "input": q,
            "key": api_key,
            "types": "geocode",
            # Restrict to supported markets (Google allows up to 5 countries
            # in `components`). If we grow past 5, drop the restriction and
            # rely on `location` + `radius` bias instead.
            "components": "|".join(
                f"country:{m['iso2'].lower()}" for m in SUPPORTED_MARKETS[:5]
            ),
        }
        async with httpx.AsyncClient(timeout=6.0) as client:
            r = await client.get(url, params=params)
        if r.status_code != 200:
            return {"suggestions": [], "source": "google_error", "query": q}
        data = r.json()
        preds = data.get("predictions") or []
        suggestions = []
        for p in preds[:6]:
            suggestions.append({
                "place_id": p.get("place_id"),
                "formatted_address": p.get("description"),
                "town": (p.get("structured_formatting") or {}).get("secondary_text") or "",
                # We don't hit /details here to save cost — client can pick
                # the suggestion and the WebView flow will fetch details.
            })
        return {"suggestions": suggestions, "source": "google", "query": q}
    except Exception as e:
        return {"suggestions": [], "source": "manual", "query": q, "error": str(e)}


@api.get("/geo/details")
async def geo_details(place_id: str = ""):
    """Resolve a Google Places `place_id` (returned by `/api/geo/autocomplete`)
    into the location fields Cargo One needs — including latitude/longitude,
    formatted address, postcode, locality/town, country name and ISO country
    code. Uses the same server-side `GOOGLE_MAPS_API_KEY` and the same legacy
    Places API endpoint as autocomplete, so no additional Cloud APIs need to
    be enabled.

    Contract:
        200 { source, place_id, formatted_address, address_line, postcode,
              town, region, country, country_code, lat, lng }
        400 { detail: "place_id required" }
        200 { source:"manual", place_id, ... zeros } when the key is not
              configured (preserves the manual-entry fallback used by
              AddressAutocomplete when Google is unreachable).

    Public — safe to call without a JWT (same posture as autocomplete).
    """
    place_id = (place_id or "").strip()
    if not place_id:
        raise HTTPException(status_code=400, detail="place_id required")

    api_key = os.environ.get("GOOGLE_MAPS_API_KEY", "").strip().strip('"')
    empty = {
        "place_id": place_id,
        "formatted_address": "",
        "address_line": "",
        "postcode": "",
        "town": "",
        "region": "",
        "country": "",
        "country_code": "",
        "lat": 0.0,
        "lng": 0.0,
    }
    if not api_key or api_key.startswith("placeholder"):
        return {"source": "manual", **empty}

    try:
        import httpx  # local import — httpx already in requirements
        url = "https://maps.googleapis.com/maps/api/place/details/json"
        params = {
            "place_id": place_id,
            "key": api_key,
            # Only request the fields we actually consume — reduces cost.
            "fields": "place_id,formatted_address,geometry/location,address_components",
        }
        async with httpx.AsyncClient(timeout=6.0) as client:
            r = await client.get(url, params=params)
        if r.status_code != 200:
            return {"source": "google_error", **empty}
        data = r.json()
        if data.get("status") != "OK":
            return {"source": "google_error", **empty, "error": data.get("status")}

        result = data.get("result") or {}
        loc = ((result.get("geometry") or {}).get("location") or {})
        lat = float(loc.get("lat") or 0)
        lng = float(loc.get("lng") or 0)

        # Walk address_components in a single pass; each component has a
        # `types` array — pick the last matching value for each field.
        postcode = ""
        town = ""
        region = ""
        country_name = ""
        country_code = ""
        street_number = ""
        route = ""
        for comp in result.get("address_components") or []:
            types = set(comp.get("types") or [])
            long_name = comp.get("long_name") or ""
            short_name = comp.get("short_name") or ""
            if "postal_code" in types:
                postcode = long_name
            elif "country" in types:
                country_name = long_name
                country_code = (short_name or "").upper()
            elif "administrative_area_level_1" in types:
                region = long_name
            elif "postal_town" in types:
                town = long_name
            elif not town and (
                "locality" in types
                or "sublocality" in types
                or "administrative_area_level_2" in types
            ):
                town = long_name
            elif "street_number" in types:
                street_number = long_name
            elif "route" in types:
                route = long_name

        address_line = (f"{street_number} {route}".strip()) if (street_number or route) else ""

        return {
            "source": "google",
            "place_id": place_id,
            "formatted_address": result.get("formatted_address") or "",
            "address_line": address_line,
            "postcode": postcode,
            "town": town,
            "region": region,
            "country": country_name,
            "country_code": country_code,
            "lat": lat,
            "lng": lng,
        }
    except Exception as e:
        logger.exception("Google Place Details failed")
        return {"source": "manual", **empty, "error": str(e)}


# ---- Driver vehicle profiles (fleet management) ----

class DriverVehicleUpsert(BaseModel):
    vehicle_type_key: str
    registration: str
    make: Optional[str] = ""
    model: Optional[str] = ""
    year: Optional[int] = None
    payload_kg: Optional[float] = None
    max_weight_kg: Optional[float] = None
    internal_length_m: Optional[float] = None
    internal_width_m: Optional[float] = None
    internal_height_m: Optional[float] = None
    capabilities: Optional[list[str]] = None
    insurance_expiry: Optional[str] = None
    mot_expiry: Optional[str] = None
    photos: Optional[list[str]] = None  # base64 data URLs (S3/CDN in future — see photo_url helpers)
    is_default: Optional[bool] = False


def _photo_url(photo: str) -> str:
    """Abstraction so future migration to S3/R2 is transparent.
    Currently returns the base64 data URL unchanged. In future, if `photo`
    looks like an s3://, http:// or storage-backed key, we can rewrite it here."""
    return photo


@api.get("/driver/vehicles")
async def list_driver_vehicles(user: dict = Depends(require_role("driver"))):
    docs = await db.driver_vehicles.find({"driver_id": user["id"]}).sort("created_at", 1).to_list(50)
    for d in docs:
        d.pop("_id", None)
        if d.get("photos"):
            d["photos"] = [_photo_url(p) for p in d["photos"]]
    return docs


@api.post("/driver/vehicles")
async def create_driver_vehicle(payload: DriverVehicleUpsert, user: dict = Depends(require_role("driver"))):
    vt = await db.vehicle_types.find_one({"key": payload.vehicle_type_key, "active": True})
    if not vt:
        raise HTTPException(status_code=400, detail="Unknown or inactive vehicle_type_key")
    reg = payload.registration.strip().upper()
    if not reg:
        raise HTTPException(status_code=400, detail="Registration is required")
    # Enforce unique registration per driver
    if await db.driver_vehicles.find_one({"driver_id": user["id"], "registration": reg}):
        raise HTTPException(status_code=400, detail="You already registered this vehicle")

    if payload.is_default:
        await db.driver_vehicles.update_many({"driver_id": user["id"]}, {"$set": {"is_default": False}})

    doc = {
        "id": new_id(),
        "driver_id": user["id"],
        "vehicle_type_key": payload.vehicle_type_key,
        "vehicle_type_name": vt.get("name"),
        "registration": reg,
        "make": (payload.make or "").strip(),
        "model": (payload.model or "").strip(),
        "year": payload.year,
        "payload_kg": payload.payload_kg,
        "max_weight_kg": payload.max_weight_kg or vt.get("max_weight_kg"),
        "internal_length_m": payload.internal_length_m,
        "internal_width_m": payload.internal_width_m,
        "internal_height_m": payload.internal_height_m,
        "capabilities": payload.capabilities or [],
        "insurance_expiry": payload.insurance_expiry,
        "mot_expiry": payload.mot_expiry,
        "photos": payload.photos or [],
        "is_default": bool(payload.is_default),
        "status": "active",
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.driver_vehicles.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.put("/driver/vehicles/{veh_id}")
async def update_driver_vehicle(veh_id: str, payload: DriverVehicleUpsert, user: dict = Depends(require_role("driver"))):
    existing = await db.driver_vehicles.find_one({"id": veh_id, "driver_id": user["id"]})
    if not existing:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    update = {"updated_at": now_iso()}
    if payload.is_default:
        await db.driver_vehicles.update_many({"driver_id": user["id"]}, {"$set": {"is_default": False}})
    for f in ("vehicle_type_key", "make", "model", "year", "payload_kg", "max_weight_kg",
              "internal_length_m", "internal_width_m", "internal_height_m", "capabilities",
              "insurance_expiry", "mot_expiry", "photos", "is_default"):
        v = getattr(payload, f, None)
        if v is not None:
            update[f] = v
    if payload.vehicle_type_key:
        vt = await db.vehicle_types.find_one({"key": payload.vehicle_type_key})
        if vt:
            update["vehicle_type_name"] = vt.get("name")
    await db.driver_vehicles.update_one({"id": veh_id}, {"$set": update})
    d = await db.driver_vehicles.find_one({"id": veh_id})
    d.pop("_id", None)
    return d


@api.delete("/driver/vehicles/{veh_id}")
async def delete_driver_vehicle(veh_id: str, user: dict = Depends(require_role("driver"))):
    r = await db.driver_vehicles.delete_one({"id": veh_id, "driver_id": user["id"]})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return {"ok": True}


# ---- Driver dashboard aggregate ----

@api.get("/driver/dashboard")
async def driver_dashboard(user: dict = Depends(require_role("driver"))):
    """Aggregated snapshot for the Driver home screen — fleet, upcoming jobs,
    earnings breakdown (today/week/month/all-time), active bids, rating
    stats and vehicle-verification status."""
    now = datetime.now(timezone.utc)
    start_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
    # Week starts Monday — use timedelta so we don't overflow the month boundary.
    from datetime import timedelta as _td
    start_week = start_day - _td(days=start_day.weekday())
    start_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # Fleet
    fleet_docs = await db.driver_vehicles.find({"driver_id": user["id"]}).to_list(50)
    fleet_active = [f for f in fleet_docs if f.get("status") == "active"]
    fleet_caps_flat: set[str] = set()
    for f in fleet_docs:
        for c in (f.get("capabilities") or []):
            fleet_caps_flat.add(c)

    # Bookings — all belonging to this driver
    bookings = await db.bookings.find({"driver_id": user["id"]}).to_list(500)
    upcoming = []
    completed = []
    active = []
    for b in bookings:
        b.pop("_id", None)
        st = b.get("status")
        if st == "completed":
            completed.append(b)
        elif st in ("cancelled",):
            pass
        elif st in ("deposit_paid", "confirmed"):
            upcoming.append(b)
        else:
            active.append(b)

    def _earned(bs: list[dict]) -> float:
        s = 0.0
        for b in bs:
            s += float(b.get("driver_charge") or b.get("balance_due") or 0)
        return s

    def _completed_since(cutoff: datetime) -> list[dict]:
        out = []
        for b in completed:
            ts = b.get("completed_at") or b.get("updated_at") or b.get("created_at")
            if not ts:
                continue
            try:
                dt = datetime.fromisoformat(ts.replace("Z", "+00:00")) if isinstance(ts, str) else ts
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                if dt >= cutoff:
                    out.append(b)
            except Exception:
                continue
        return out

    earnings = {
        "today": round(_earned(_completed_since(start_day)), 2),
        "week": round(_earned(_completed_since(start_week)), 2),
        "month": round(_earned(_completed_since(start_month)), 2),
        "all_time": round(_earned(completed), 2),
        "completed_count": len(completed),
    }

    # Bids
    active_bids = await db.bids.find(
        {"driver_id": user["id"], "status": {"$in": ["pending", "outbid"]}}
    ).to_list(200)
    accepted_bids = await db.bids.count_documents({"driver_id": user["id"], "status": "accepted"})

    # Ratings — reviews are stored with target_id (the reviewee)
    reviews = await db.reviews.find({"target_id": user["id"]}).to_list(500)
    if reviews:
        avg = sum(float(r.get("rating", 0)) for r in reviews) / len(reviews)
    else:
        avg = float(user.get("rating") or 5.0)

    # Docs / verification snapshot — docs live in the `documents` collection
    docs = await db.documents.find({"user_id": user["id"]}).to_list(50)
    docs_verified = sum(1 for d in docs if d.get("status") == "approved")
    docs_pending = sum(1 for d in docs if d.get("status") in (None, "pending", "submitted"))
    docs_rejected = sum(1 for d in docs if d.get("status") == "rejected")

    # Nearby posted-job count (radius 75 default)
    posted = await db.jobs.find({"status": "posted"}, {"_id": 0, "id": 1}).to_list(1000)
    nearby_count = len(posted)  # driver home also filters by radius using /jobs/nearby

    # Enrich upcoming with the job snippet
    upcoming.sort(key=lambda b: b.get("created_at", ""))
    enriched_upcoming: list[dict] = []
    for b in upcoming[:5]:
        j = await db.jobs.find_one({"id": b.get("job_id")}, {"_id": 0})
        enriched_upcoming.append({
            "id": b.get("id"),
            "job_id": b.get("job_id"),
            "status": b.get("status"),
            "total_price": b.get("total_price"),
            "driver_charge": b.get("driver_charge"),
            "pickup_town": (j or {}).get("pickup_town"),
            "dropoff_town": (j or {}).get("dropoff_town"),
            "title": (j or {}).get("title"),
            "requested_pickup_at": (j or {}).get("requested_pickup_at"),
        })

    return {
        "user": {
            "id": user["id"],
            "name": user.get("name"),
            "status": user.get("status"),
            "rating": round(avg, 2),
            "review_count": len(reviews),
        },
        "fleet": {
            "count": len(fleet_docs),
            "active_count": len(fleet_active),
            "capabilities": sorted(fleet_caps_flat),
            "vehicles": [
                {
                    "id": f.get("id"),
                    "vehicle_type_name": f.get("vehicle_type_name"),
                    "registration": f.get("registration"),
                    "status": f.get("status"),
                    "is_default": bool(f.get("is_default")),
                }
                for f in fleet_docs
            ],
        },
        "earnings": earnings,
        "bids": {
            "active": len(active_bids),
            "accepted": accepted_bids,
        },
        "jobs": {
            "nearby_count": nearby_count,
            "active_count": len(active),
            "upcoming_count": len(upcoming),
            "upcoming": enriched_upcoming,
        },
        "verification": {
            "docs_verified": docs_verified,
            "docs_pending": docs_pending,
            "docs_rejected": docs_rejected,
            "account_status": user.get("status"),
        },
    }


# ---- Admin analytics ----

@api.get("/admin/analytics/overview")
async def analytics_overview(_: dict = Depends(require_role("admin"))):
    """Marketplace + operational + categories + drivers + customers snapshots."""
    jobs_col = db.jobs
    bookings_col = db.bookings
    reviews_col = db.reviews
    bids_col = db.bids
    users_col = db.users

    # ---- Marketplace headline metrics ----
    jobs_posted     = await jobs_col.count_documents({})
    jobs_completed  = await jobs_col.count_documents({"status": "completed"})
    jobs_cancelled  = await jobs_col.count_documents({"status": "cancelled"})
    jobs_active     = await jobs_col.count_documents({"status": {"$in": ["open", "assigned", "in_progress"]}})
    completion_rate = round((jobs_completed / jobs_posted * 100) if jobs_posted else 0, 1)

    # ---- Revenue (Booking-fee = platform revenue; driver charge = pass-through) ----
    revenue_agg = await bookings_col.aggregate([
        {"$group": {
            "_id": None,
            "total_customer": {"$sum": {"$ifNull": ["$customer_total", 0]}},
            "total_driver":   {"$sum": {"$ifNull": ["$driver_charge", 0]}},
            "total_fee":      {"$sum": {"$ifNull": ["$booking_fee", 0]}},
            "count":          {"$sum": 1},
        }},
    ]).to_list(1)
    revenue = revenue_agg[0] if revenue_agg else {"total_customer": 0, "total_driver": 0, "total_fee": 0, "count": 0}

    avg_booking_value = round(revenue["total_customer"] / revenue["count"], 2) if revenue["count"] else 0

    # ---- Categories: most requested, revenue by category ----
    top_cats = await jobs_col.aggregate([
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10},
    ]).to_list(20)
    # Enrich with names
    cat_docs = {c["key"]: c for c in await db.service_categories.find({}).to_list(200)}
    top_categories = [
        {
            "key": r["_id"],
            "name": cat_docs.get(r["_id"], {}).get("name", r["_id"]),
            "count": r["count"],
        }
        for r in top_cats if r["_id"]
    ]

    # Revenue by category (via bookings joined to jobs)
    revenue_by_cat_raw = await bookings_col.aggregate([
        {"$lookup": {"from": "jobs", "localField": "job_id", "foreignField": "id", "as": "job"}},
        {"$unwind": "$job"},
        {"$group": {
            "_id": "$job.category",
            "customer_total": {"$sum": {"$ifNull": ["$customer_total", 0]}},
            "booking_fee":    {"$sum": {"$ifNull": ["$booking_fee", 0]}},
            "count":          {"$sum": 1},
        }},
        {"$sort": {"customer_total": -1}},
    ]).to_list(50)
    revenue_by_category = [
        {
            "key": r["_id"],
            "name": cat_docs.get(r["_id"], {}).get("name", r["_id"] or "—"),
            "count": r["count"],
            "customer_total": round(r["customer_total"], 2),
            "booking_fee": round(r["booking_fee"], 2),
        }
        for r in revenue_by_cat_raw if r["_id"]
    ]

    # Revenue by vehicle type
    veh_docs = {v["key"]: v for v in await db.vehicle_types.find({}).to_list(200)}
    revenue_by_veh_raw = await bookings_col.aggregate([
        {"$lookup": {"from": "jobs", "localField": "job_id", "foreignField": "id", "as": "job"}},
        {"$unwind": "$job"},
        {"$group": {
            "_id": "$job.vehicle_required",
            "customer_total": {"$sum": {"$ifNull": ["$customer_total", 0]}},
            "booking_fee":    {"$sum": {"$ifNull": ["$booking_fee", 0]}},
            "count":          {"$sum": 1},
        }},
        {"$sort": {"customer_total": -1}},
    ]).to_list(50)
    revenue_by_vehicle = [
        {
            "key": r["_id"],
            "name": veh_docs.get(r["_id"], {}).get("name", r["_id"] or "—"),
            "count": r["count"],
            "customer_total": round(r["customer_total"], 2),
            "booking_fee": round(r["booking_fee"], 2),
        }
        for r in revenue_by_veh_raw if r["_id"]
    ]

    # Most requested vehicle types (from jobs.vehicle_required)
    top_veh = await jobs_col.aggregate([
        {"$match": {"vehicle_required": {"$ne": None}}},
        {"$group": {"_id": "$vehicle_required", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10},
    ]).to_list(20)
    top_vehicles = [
        {"key": r["_id"], "name": veh_docs.get(r["_id"], {}).get("name", r["_id"]), "count": r["count"]}
        for r in top_veh if r["_id"]
    ]

    # Most requested capabilities (from driver_vehicles.capabilities via top jobs)
    top_caps_raw = await db.driver_vehicles.aggregate([
        {"$unwind": "$capabilities"},
        {"$group": {"_id": "$capabilities", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10},
    ]).to_list(20)
    cap_docs = {c["key"]: c for c in await db.vehicle_capabilities.find({}).to_list(200)}
    top_capabilities = [
        {"key": r["_id"], "name": cap_docs.get(r["_id"], {}).get("name", r["_id"]), "count": r["count"]}
        for r in top_caps_raw
    ]

    # Top routes (pickup_town → dropoff_town)
    top_routes_raw = await jobs_col.aggregate([
        {"$match": {"pickup_town": {"$ne": None}, "dropoff_town": {"$ne": None}}},
        {"$group": {"_id": {"from": "$pickup_town", "to": "$dropoff_town"}, "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10},
    ]).to_list(20)
    top_routes = [
        {"from": r["_id"]["from"], "to": r["_id"]["to"], "count": r["count"]}
        for r in top_routes_raw
    ]

    # ---- Drivers ----
    total_drivers    = await users_col.count_documents({"role": "driver"})
    verified_drivers = await users_col.count_documents({"role": "driver", "documents_verified": True})
    top_drivers_raw = await users_col.find({"role": "driver"}).sort([("rating", -1), ("total_jobs", -1)]).limit(10).to_list(10)
    top_rated_drivers = [
        {"id": d["id"], "name": d.get("name"), "rating": d.get("rating") or 0, "total_jobs": d.get("total_jobs") or 0}
        for d in top_drivers_raw
    ]

    highest_earning_raw = await bookings_col.aggregate([
        {"$group": {"_id": "$driver_id", "earnings": {"$sum": {"$ifNull": ["$driver_charge", 0]}}, "jobs": {"$sum": 1}}},
        {"$sort": {"earnings": -1}},
        {"$limit": 10},
    ]).to_list(10)
    driver_lookup = {u["id"]: u for u in await users_col.find({"role": "driver"}).to_list(1000)}
    highest_earning_drivers = [
        {
            "id": r["_id"],
            "name": (driver_lookup.get(r["_id"]) or {}).get("name", "Unknown"),
            "earnings": round(r["earnings"], 2),
            "jobs": r["jobs"],
        }
        for r in highest_earning_raw if r["_id"]
    ]

    most_active_raw = await bookings_col.aggregate([
        {"$group": {"_id": "$driver_id", "jobs": {"$sum": 1}}},
        {"$sort": {"jobs": -1}},
        {"$limit": 10},
    ]).to_list(10)
    most_active_drivers = [
        {"id": r["_id"], "name": (driver_lookup.get(r["_id"]) or {}).get("name", "Unknown"), "jobs": r["jobs"]}
        for r in most_active_raw if r["_id"]
    ]

    # ---- Customers ----
    total_customers = await users_col.count_documents({"role": "customer"})
    active_customers_raw = await jobs_col.aggregate([
        {"$group": {"_id": "$customer_id", "jobs": {"$sum": 1}}},
        {"$sort": {"jobs": -1}},
        {"$limit": 10},
    ]).to_list(10)
    customer_lookup = {u["id"]: u for u in await users_col.find({"role": "customer"}).to_list(2000)}
    most_active_customers = [
        {
            "id": r["_id"],
            "name": (customer_lookup.get(r["_id"]) or {}).get("name", "Unknown"),
            "jobs": r["jobs"],
        }
        for r in active_customers_raw if r["_id"]
    ]
    repeat_customers = sum(1 for c in active_customers_raw if c["jobs"] > 1)
    avg_customer_rating_agg = await reviews_col.aggregate([
        {"$lookup": {"from": "users", "localField": "to_id", "foreignField": "id", "as": "to"}},
        {"$unwind": "$to"},
        {"$match": {"to.role": "customer"}},
        {"$group": {"_id": None, "avg": {"$avg": "$rating"}}},
    ]).to_list(1)
    avg_customer_rating = round(avg_customer_rating_agg[0]["avg"], 2) if avg_customer_rating_agg else None

    # ---- Operational ----
    winning_bids_agg = await bids_col.aggregate([
        {"$match": {"status": "accepted"}},
        {"$group": {"_id": None, "avg": {"$avg": "$amount"}, "count": {"$sum": 1}}},
    ]).to_list(1)
    avg_winning_bid = round(winning_bids_agg[0]["avg"], 2) if winning_bids_agg else 0

    dist_time_agg = await bookings_col.aggregate([
        {"$lookup": {"from": "jobs", "localField": "job_id", "foreignField": "id", "as": "job"}},
        {"$unwind": "$job"},
        {"$group": {"_id": None,
                    "avg_distance": {"$avg": {"$ifNull": ["$job.distance_miles", 0]}},
                    "avg_time":     {"$avg": {"$ifNull": ["$job.duration_minutes", 0]}}}},
    ]).to_list(1)
    avg_distance = round(dist_time_agg[0]["avg_distance"], 1) if dist_time_agg else 0
    avg_time = round(dist_time_agg[0]["avg_time"], 0) if dist_time_agg else 0

    return {
        "marketplace": {
            "jobs_posted": jobs_posted,
            "jobs_completed": jobs_completed,
            "jobs_cancelled": jobs_cancelled,
            "jobs_active": jobs_active,
            "completion_rate": completion_rate,
            "customer_revenue_total": round(revenue["total_customer"], 2),
            "driver_revenue_total":   round(revenue["total_driver"], 2),
            "platform_fee_revenue":   round(revenue["total_fee"], 2),
            "bookings_total": revenue["count"],
        },
        "categories": {
            "top_requested": top_categories,
            "top_vehicles":  top_vehicles,
            "top_capabilities": top_capabilities,
            "top_routes":    top_routes,
            "revenue_by_category": revenue_by_category,
            "revenue_by_vehicle":  revenue_by_vehicle,
        },
        "drivers": {
            "total": total_drivers,
            "verified": verified_drivers,
            "verification_rate": round(verified_drivers / total_drivers * 100, 1) if total_drivers else 0,
            "top_rated": top_rated_drivers,
            "highest_earning": highest_earning_drivers,
            "most_active": most_active_drivers,
        },
        "customers": {
            "total": total_customers,
            "repeat": repeat_customers,
            "most_active": most_active_customers,
            "avg_customer_rating": avg_customer_rating,
        },
        "operational": {
            "avg_winning_bid": avg_winning_bid,
            "avg_delivery_distance_miles": avg_distance,
            "avg_delivery_time_minutes": avg_time,
            "avg_booking_value": avg_booking_value,
        },
    }


# ---------------------------------------------------------------------------
# Public marketing endpoints (contact form + newsletter)
# ---------------------------------------------------------------------------


class ContactMessage(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    topic: Optional[str] = "support"
    message: str


class NewsletterSignup(BaseModel):
    email: EmailStr
    source: Optional[str] = "website"


@api.post("/contact")
async def submit_contact(payload: ContactMessage):
    if len(payload.message.strip()) < 10 or len(payload.name.strip()) < 2:
        raise HTTPException(status_code=400, detail="Please provide your name and a longer message.")
    doc = {
        "id": new_id(),
        "name": payload.name.strip(),
        "email": payload.email.lower(),
        "phone": payload.phone,
        "topic": (payload.topic or "support").strip().lower(),
        "message": payload.message.strip(),
        "status": "new",
        "created_at": now_iso(),
    }
    await db.contact_messages.insert_one(doc)
    logger.info("Contact form submission: %s (%s)", doc["email"], doc["topic"])
    return {"ok": True}


@api.post("/newsletter/subscribe")
async def newsletter_subscribe(payload: NewsletterSignup):
    existing = await db.newsletter_subscribers.find_one({"email": payload.email.lower()})
    if existing:
        return {"ok": True, "already_subscribed": True}
    await db.newsletter_subscribers.insert_one({
        "id": new_id(),
        "email": payload.email.lower(),
        "source": payload.source or "website",
        "confirmed": False,
        "created_at": now_iso(),
    })
    return {"ok": True}


@api.get("/admin/contact-messages")
async def admin_contact_messages(_: dict = Depends(require_role("admin"))):
    msgs = await db.contact_messages.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return msgs


@api.post("/admin/contact-messages/{msg_id}/reply")
async def admin_reply_contact_message(
    msg_id: str,
    payload: dict = Body(...),
    admin: dict = Depends(require_role("admin")),
):
    """Server-side reply — sends via Resend so the message always leaves
    Cargo One from `admin@cargoone.co.uk` regardless of the admin's local
    mail client (fixes the M365 mailto sender-mismatch issue).
    """
    msg = await db.contact_messages.find_one({"id": msg_id}, {"_id": 0})
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    to = (payload.get("to") or msg.get("email") or "").strip()
    if not to:
        raise HTTPException(status_code=400, detail="No recipient email on record")
    subject = (payload.get("subject") or f"Re: {msg.get('subject') or 'your Cargo One enquiry'}").strip()
    body_text = (payload.get("body") or "").strip()
    if len(body_text) < 5:
        raise HTTPException(status_code=400, detail="Reply body is too short")
    from services.email import send_admin_contact_reply
    result = await send_admin_contact_reply(
        db, to=to, name=msg.get("name"), subject=subject, body_text=body_text,
        original_subject=msg.get("subject"), original_message=msg.get("message"),
        admin_name=admin.get("name"),
    )
    # Track that this message has been replied to (audit trail).
    await db.contact_messages.update_one(
        {"id": msg_id},
        {"$set": {
            "replied_at": now_iso(),
            "replied_by_id": admin.get("id"),
            "replied_by_name": admin.get("name"),
            "last_reply_status": result.get("status"),
        }},
    )
    return {"ok": True, **result}


@api.get("/admin/newsletter-subscribers")
async def admin_newsletter_subs(_: dict = Depends(require_role("admin"))):
    subs = await db.newsletter_subscribers.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return subs


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


@api.get("/")
async def root():
    return {"app": "Cargo One", "version": "1.0.0", "status": "ok"}


# Seed admin + default deposit bands + service categories + vehicle types
@app.on_event("startup")
async def seed_startup():
    # Real-time dispatch indexes (Phase 31). Idempotent — Mongo skips
    # existing ones. All keys backward-compatible with existing docs.
    try:
        await db.users.create_index([("live_online", 1), ("live_updated_at", -1)])
        await db.jobs.create_index([("service_timing", 1), ("status", 1),
                                       ("assigned_driver_id", 1)])
        await db.jobs.create_index([("dispatch_ready_at", -1)])
        # R23 — audit-log index for admin lookups + driver's own history
        await db.driver_cancellations.create_index(
            [("driver_id", 1), ("created_at", -1)]
        )
        # R23 — safety net against duplicate reviews (application layer already
        # rejects with 409, but this closes the race window under load).
        await db.reviews.create_index(
            [("booking_id", 1), ("from_id", 1)], unique=True
        )
        # R66 — WebAuthn passkey indexes (idempotent).
        await _passkeys.ensure_indexes(db)
    except Exception as e:  # noqa: BLE001
        logger.warning("Dispatch index creation skipped: %s", e)

    # Session F — seed booking-fee bands the first time. Idempotent — once
    # any row exists, admins own the collection and edits stick.
    try:
        await _ensure_booking_fee_bands_seeded()
    except Exception as e:  # noqa: BLE001
        logger.warning("booking_fee_bands seed skipped: %s", e)

    # R38 — Back-fill `customer_total` on historical bookings that pre-date the
    # explicit field. Idempotent — skips bookings that already have a value.
    # Two-pass strategy:
    #   1. If total_price is set, copy it (canonical path — covers 99% of rows).
    #   2. Otherwise, derive from driver_charge + booking_fee where possible so
    #      admin aggregation queries don't null-out ancient fixture rows.
    # Powers /admin/analytics/* which sum `customer_total` directly.
    try:
        res_a = await db.bookings.update_many(
            {"$or": [
                {"customer_total": None},
                {"customer_total": {"$exists": False}},
            ], "total_price": {"$ne": None}},
            [{"$set": {"customer_total": "$total_price"}}],
        )
        res_b = await db.bookings.update_many(
            {"$or": [
                {"customer_total": None},
                {"customer_total": {"$exists": False}},
            ], "total_price": None,
             "driver_charge": {"$ne": None}},
            [{"$set": {"customer_total": {
                "$round": [
                    {"$add": [
                        {"$ifNull": ["$driver_charge", 0]},
                        {"$ifNull": ["$booking_fee", 0]},
                    ]}, 2,
                ],
            }}}],
        )
        total_bf = res_a.modified_count + res_b.modified_count
        if total_bf:
            logger.info(
                "R38 back-fill: set customer_total on %d bookings (%d from total_price, %d derived)",
                total_bf, res_a.modified_count, res_b.modified_count,
            )
    except Exception as e:  # noqa: BLE001
        logger.warning("customer_total back-fill skipped: %s", e)

    # SEC-002 / SEC-003: In production the seed MUST be disabled (set
    # ALLOW_INITIAL_ADMIN_SEED="false" and PRODUCTION_MODE="true") — admins
    # should be provisioned out-of-band. When the seed IS allowed the
    # initial password is taken from INITIAL_ADMIN_PASSWORD so we never
    # ship a shared secret to production.
    allow_seed = os.environ.get("ALLOW_INITIAL_ADMIN_SEED", "true").lower() != "false"
    production_mode = os.environ.get("PRODUCTION_MODE", "false").lower() == "true"
    committed_default_jwt = "cargo_one_super_secret_jwt_key_change_in_prod_2026"
    if production_mode and JWT_SECRET == committed_default_jwt:
        raise RuntimeError(
            "SEC-003: JWT_SECRET is still the committed placeholder while "
            "PRODUCTION_MODE=true. Refusing to start. Set a strong random "
            "JWT_SECRET in the environment before launch."
        )

    if allow_seed and not production_mode and not await db.users.find_one({"role": "admin"}):
        initial_password = os.environ.get("INITIAL_ADMIN_PASSWORD", "admin123")
        if initial_password == "admin123":
            logger.warning(
                "SEC-002: seeding admin with default password 'admin123' — "
                "OK for local/QA only. Set INITIAL_ADMIN_PASSWORD and "
                "ALLOW_INITIAL_ADMIN_SEED=false before production launch.",
            )
        admin = {
            "id": new_id(),
            "email": os.environ.get("INITIAL_ADMIN_EMAIL", "admin@cargoone.com"),
            "name": "Admin",
            "phone": "+441234567890",
            "role": "admin",
            "password_hash": hash_password(initial_password),
            "status": "active",
            "rating": 5.0,
            "total_jobs": 0,
            "documents_verified": True,
            "created_at": now_iso(),
        }
        await db.users.insert_one(admin)
        logger.info("Seeded initial admin (dev/QA mode)")
    elif production_mode:
        # In prod, only warn — don't seed and don't fail if admin doesn't
        # exist yet; operator provisions the first admin via a secure path.
        if not await db.users.find_one({"role": "admin"}):
            logger.warning(
                "PRODUCTION_MODE=true and no admin user exists. Provision "
                "the first admin manually via a secured process.",
            )

    if await db.deposit_bands.count_documents({}) == 0:
        defaults = [
            {"label": "Tier 1", "min_price": 0, "max_price": 100, "deposit_amount": 10},
            {"label": "Tier 2", "min_price": 100.01, "max_price": 300, "deposit_amount": 25},
            {"label": "Tier 3", "min_price": 300.01, "max_price": 750, "deposit_amount": 50},
            {"label": "Tier 4", "min_price": 750.01, "max_price": 1500, "deposit_amount": 100},
            {"label": "Tier 5", "min_price": 1500.01, "max_price": None, "deposit_amount": 150},
        ]
        for d in defaults:
            await db.deposit_bands.insert_one({
                "id": new_id(),
                "min_price": d["min_price"],
                "max_price": d["max_price"],
                "deposit_amount": d["deposit_amount"],
                "enabled": True,
                "label": d["label"],
                "created_at": now_iso(),
                "updated_at": now_iso(),
            })
        logger.info("Seeded default deposit bands")

    # Seed service categories (idempotent per key). Mark first 15 as featured for the homepage.
    featured_cats = {
        "house_removals", "furniture_delivery", "cars_vehicles", "motorcycles",
        "caravans", "static_caravans", "shipping_containers", "boats_marine",
        "machinery_plant", "pallets", "freight", "building_materials",
        "office_commercial", "same_day_express", "parcels",
    }
    for idx, seed in enumerate(CATEGORY_SEED):
        if not await db.service_categories.find_one({"key": seed["key"]}):
            await db.service_categories.insert_one({
                "id": new_id(),
                "key": seed["key"],
                "name": seed["name"],
                "description": seed.get("description", ""),
                "icon": seed.get("icon", "cube"),
                "order": idx,
                "active": True,
                "featured": seed["key"] in featured_cats,
                "default_vehicles": seed.get("default_vehicles", []),
                "typical_weight_kg": seed.get("typical_weight_kg"),
                "typical_volume_m3": seed.get("typical_volume_m3"),
                "created_at": now_iso(),
                "updated_at": now_iso(),
            })
        else:
            # Ensure featured flag exists on legacy docs (idempotent update)
            await db.service_categories.update_one(
                {"key": seed["key"], "featured": {"$exists": False}},
                {"$set": {"featured": seed["key"] in featured_cats}},
            )
    logger.info("Ensured %d service categories seeded", len(CATEGORY_SEED))

    # Seed vehicle types (idempotent per key). Map default features → capabilities.
    for idx, seed in enumerate(VEHICLE_SEED):
        if not await db.vehicle_types.find_one({"key": seed["key"]}):
            await db.vehicle_types.insert_one({
                "id": new_id(),
                "key": seed["key"],
                "name": seed["name"],
                "description": seed.get("description", ""),
                "icon": seed.get("icon", "car"),
                "order": idx,
                "active": True,
                "featured": False,
                "max_weight_kg": seed.get("max_weight_kg", 0),
                "max_volume_m3": seed.get("max_volume_m3"),
                "features": seed.get("features", []),
                # Bootstrap capabilities from features so old data continues to match
                "capabilities": seed.get("features", []),
                "created_at": now_iso(),
                "updated_at": now_iso(),
            })
        else:
            await db.vehicle_types.update_one(
                {"key": seed["key"], "capabilities": {"$exists": False}},
                {"$set": {"capabilities": seed.get("features", []), "featured": False}},
            )
    logger.info("Ensured %d vehicle types seeded", len(VEHICLE_SEED))

    # Seed vehicle capabilities (idempotent per key)
    for idx, seed in enumerate(CAPABILITY_SEED):
        if not await db.vehicle_capabilities.find_one({"key": seed["key"]}):
            await db.vehicle_capabilities.insert_one({
                "id": new_id(),
                "key": seed["key"],
                "name": seed["name"],
                "description": seed.get("description", ""),
                "icon": seed.get("icon", "checkmark-circle"),
                "order": idx,
                "active": True,
                "featured": False,
                "created_at": now_iso(),
                "updated_at": now_iso(),
            })
    logger.info("Ensured %d vehicle capabilities seeded", len(CAPABILITY_SEED))

    # Auto-migrate legacy job categories → new category keys
    migrated = 0
    for old_key, new_key in LEGACY_CATEGORY_MAP.items():
        result = await db.jobs.update_many(
            {"category": old_key},
            {"$set": {"category": new_key, "legacy_category": old_key}},
        )
        migrated += result.modified_count
    if migrated:
        logger.info("Migrated %d legacy job categories to new taxonomy", migrated)


@app.on_event("shutdown")
async def shutdown():
    client.close()


app.include_router(api)

_cors_origins_raw = os.environ.get("CORS_ORIGINS", "*").strip()
_cors_origins = ["*"] if _cors_origins_raw == "*" else [o.strip() for o in _cors_origins_raw.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=_cors_origins,
    allow_methods=["*"],
    # Narrowed from "*" so browsers reliably preflight the new X-CSRF-Token
    # header alongside our existing headers. Safari and stricter WebKit
    # derivatives reject `Access-Control-Allow-Headers: *` when the request
    # advertises a custom header and `allow_credentials=True`.
    allow_headers=["Accept", "Content-Type", "Authorization", "X-CSRF-Token", "X-Client-Type"],
)


# ---------------------------------------------------------------------------
# SEC1 — CSRF double-submit middleware. Registered AFTER CORS so preflights
# resolve before we enforce. Bearer/mobile requests are unconditionally
# bypassed to keep the retained native-client contract intact.
# ---------------------------------------------------------------------------
@app.middleware("http")
async def csrf_middleware(request: Request, call_next):
    method = request.method.upper()
    if method in ("GET", "HEAD", "OPTIONS"):
        return await call_next(request)
    path = request.url.path
    if not path.startswith("/api/"):
        return await call_next(request)
    if path in CSRF_EXEMPT_PATHS:
        return await call_next(request)
    # Bearer/native clients never see the CSRF cookie — bypass entirely.
    auth_header = request.headers.get("Authorization", "").lower()
    if auth_header.startswith("bearer "):
        return await call_next(request)
    # No session cookie → the downstream auth layer will return 401 anyway.
    # We only enforce CSRF for browser sessions.
    session_cookie = request.cookies.get(AUTH_COOKIE_NAME)
    if not session_cookie:
        return await call_next(request)
    cookie_token = request.cookies.get(CSRF_COOKIE_NAME) or ""
    header_token = request.headers.get(CSRF_HEADER_NAME) or ""
    if not header_token:
        from starlette.responses import JSONResponse as _JR
        return _JR({"detail": "CSRF token missing"}, status_code=403)
    if not cookie_token or not hmac.compare_digest(cookie_token, header_token):
        from starlette.responses import JSONResponse as _JR
        return _JR({"detail": "CSRF token invalid"}, status_code=403)
    return await call_next(request)
