"""Cargo One - Logistics Marketplace Backend.

FastAPI + MongoDB + JWT + Stripe (via emergentintegrations).
Roles: customer, driver, admin.
"""

import logging
import math
import os
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


def public_job(job: dict, include_private: bool = False) -> dict:
    """Return job dict; hides exact addresses/contact until deposit paid."""
    out = {k: v for k, v in job.items() if k not in ("_id",)}
    if not include_private:
        out.pop("pickup_address", None)
        out.pop("dropoff_address", None)
        # Keep towns and approximate coords for map preview
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


# ---------------------------------------------------------------------------
# Deposit bands
# ---------------------------------------------------------------------------


class DepositBandIn(BaseModel):
    min_price: float
    max_price: Optional[float] = None  # None => infinity
    deposit_amount: float
    enabled: bool = True
    label: Optional[str] = None


async def calculate_booking_fee(driver_charge: float) -> float:
    """Find the first enabled band matching driver_charge. Fallback to DEPOSIT_PERCENTAGE."""
    bands = await db.deposit_bands.find({"enabled": True}, {"_id": 0}) \
                                    .sort("min_price", 1).to_list(200)
    for b in bands:
        min_p = float(b.get("min_price", 0))
        max_p = b.get("max_price")
        if driver_charge >= min_p and (max_p is None or driver_charge <= float(max_p)):
            return round(float(b["deposit_amount"]), 2)
    return round(driver_charge * DEPOSIT_PERCENTAGE, 2)


# Back-compat alias (used by earlier code paths)
calculate_deposit = calculate_booking_fee


async def preview_deposit(driver_charge: float) -> dict:
    """Return pricing breakdown for a given driver_charge."""
    fee = await calculate_booking_fee(driver_charge)
    return {
        "driver_charge": round(driver_charge, 2),
        "booking_fee": fee,
        "customer_total": round(driver_charge + fee, 2),
        # Legacy field names kept for backwards compat with older clients:
        "total_price": round(driver_charge + fee, 2),
        "deposit_amount": fee,
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
    }
    await db.users.insert_one(user)
    token = create_token(user["id"], user["role"])
    set_auth_cookie(response, token)
    set_csrf_cookie(response, new_csrf_token())
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
    allowed = {"name", "phone", "vehicle", "profile_photo"}
    patch = {k: v for k, v in update.items() if k in allowed}
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

    distance = haversine_miles(
        data["pickup_lat"], data["pickup_lng"], data["dropoff_lat"], data["dropoff_lng"]
    )
    # Classify route so we can flag international jobs for manual pricing review.
    route_class = classify_route(
        data.get("pickup_country_code"),
        data.get("dropoff_country_code"),
    )
    # Legacy contract: if no country codes provided at all, treat as UK domestic.
    if not data.get("pickup_country_code") and not data.get("dropoff_country_code"):
        route_class = "domestic_uk"

    # Quote suggestion: base £1.5/mile + category multiplier
    category_mult = {
        "furniture": 1.2, "pallets": 1.4, "cars": 2.0, "motorcycles": 1.5,
        "house_moves": 1.6, "parcels": 1.0, "freight": 1.8, "documents": 0.8,
        "boats": 2.5, "machinery": 2.2,
    }.get(data["category"], 1.2)
    if service_type == "breakdown_recovery":
        category_mult = max(category_mult, 2.0)  # recovery premium already baked into commercial rules
    suggested_price = round(max(30, distance * 1.5 * category_mult), 2)

    job = {
        "id": new_id(),
        "customer_id": user["id"],
        "customer_name": user["name"],
        "customer_rating": user.get("rating", 5.0),
        "status": "posted" if route_class == "domestic_uk" else "awaiting_manual_quote",
        "distance_miles": round(distance, 1),
        "suggested_price": suggested_price if route_class == "domestic_uk" else None,
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
    await db.jobs.insert_one(job)
    return public_job(job, include_private=True)


@api.get("/jobs/mine")
async def my_jobs(user: dict = Depends(require_role("customer"))):
    jobs = await db.jobs.find({"customer_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return jobs


@api.get("/quote/estimate")
async def quote_estimate(pickup_lat: float, pickup_lng: float,
                          dropoff_lat: float, dropoff_lng: float,
                          category: str = "furniture_delivery",
                          weight_kg: Optional[float] = None,
                          volume_m3: Optional[float] = None,
                          pickup_country_code: Optional[str] = None,
                          dropoff_country_code: Optional[str] = None,
                          user: dict = Depends(get_current_user)):
    """Estimate distance, duration, vehicle & suggested price for a route.

    Route classification (via markets.classify_route) is included in the
    response so the frontend can render a "manual review required" state
    for international routes that don't yet have configured pricing.
    Existing UK jobs remain fully backwards compatible — the endpoint
    still accepts calls without country codes and returns a UK price
    quote when only lat/lng are provided.
    """
    route_class = classify_route(pickup_country_code, dropoff_country_code)
    # Preserve pre-existing behaviour: if the caller didn't send country
    # codes at all, treat the route as domestic-UK (legacy contract).
    if not pickup_country_code and not dropoff_country_code:
        route_class = "domestic_uk"

    # Try Google Distance Matrix first
    gmaps = await google_distance_matrix(
        (pickup_lat, pickup_lng), (dropoff_lat, dropoff_lng),
    )
    if gmaps:
        distance_miles = round(gmaps["distance_meters"] / 1609.34, 1)
        duration_minutes = round(gmaps["duration_seconds"] / 60, 0)
        source = "google"
    else:
        distance_miles = round(
            haversine_miles(pickup_lat, pickup_lng, dropoff_lat, dropoff_lng), 1,
        )
        # Assume 40 mph avg on mixed roads + 10 min buffer
        duration_minutes = round((distance_miles / 40.0) * 60 + 10, 0)
        source = "haversine"

    # Category multipliers keyed by NEW slugs. Fall back to legacy map, then to 1.2.
    category_mult = {
        # Light / same-day
        "documents": 0.8, "parcels": 1.0, "same_day_express": 1.2,
        # Standard
        "furniture_delivery": 1.2, "single_items": 1.1, "auction_marketplace": 1.2,
        "garden_outdoor": 1.2, "retail_business": 1.2, "office_commercial": 1.4,
        "house_removals": 1.6, "long_distance_uk": 1.3,
        # Freight & pallets
        "pallets": 1.4, "freight": 1.8, "event_equipment": 1.5,
        # Heavy / specialist
        "motorcycles": 1.5, "cars_vehicles": 2.0, "vans": 2.0,
        "machinery_plant": 2.2, "agricultural": 2.2, "building_materials": 1.8,
        "boats_marine": 2.5, "shipping_containers": 2.6,
        "caravans": 2.0, "static_caravans": 3.0, "fragile_high_value": 1.8,
        "other": 1.2,
    }
    # Support legacy category slugs gracefully
    normalized = LEGACY_CATEGORY_MAP.get(category, category)
    mult = category_mult.get(normalized, 1.2)
    suggested_price = round(max(30, distance_miles * 1.5 * mult), 2)

    # Look up the category doc + pick the first default vehicle as the recommendation
    cat_doc = await db.service_categories.find_one({"key": normalized, "active": True})
    vehicle_label = "Van"
    if cat_doc:
        default_keys = cat_doc.get("default_vehicles") or []
        if default_keys:
            veh = await db.vehicle_types.find_one({"key": default_keys[0], "active": True})
            if veh:
                vehicle_label = veh.get("name") or vehicle_label

    # Adjust price if the customer has hinted at volume/weight
    if weight_kg and weight_kg > 500:
        suggested_price = round(suggested_price * (1 + min(2.0, weight_kg / 3000.0)), 2)
    if volume_m3 and volume_m3 > 10:
        suggested_price = round(suggested_price * (1 + min(1.5, volume_m3 / 40.0)), 2)

    # International-review handling — do NOT invent pricing for routes we
    # don't have a configured rule for.
    needs_manual_review = route_class in ("international", "domestic_other", "unsupported")
    origin_name = market_name(pickup_country_code) if pickup_country_code else "United Kingdom"
    dest_name = market_name(dropoff_country_code) if dropoff_country_code else "United Kingdom"

    return {
        "distance_miles": distance_miles,
        "duration_minutes": duration_minutes,
        "suggested_price": None if needs_manual_review else suggested_price,
        "vehicle": vehicle_label,
        "category_key": normalized,
        "source": source,
        # Route classification (new — clients can render an international
        # quote-review card when this is not "domestic_uk").
        "route_class": route_class,
        "origin_country_code": (pickup_country_code or "GB"),
        "destination_country_code": (dropoff_country_code or "GB"),
        "origin_country": origin_name,
        "destination_country": dest_name,
        "requires_manual_review": needs_manual_review,
        "manual_review_message": (
            f"{origin_name} → {dest_name} routes are supported architecturally but "
            "pricing for this corridor hasn't been configured yet. Our team will "
            "provide a bespoke quote within one business day."
            if needs_manual_review else None
        ),
    }


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
        {"status": "posted", "service_timing": {"$ne": "asap"}},
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
    # Sort: geolocated jobs nearest-first, then unresolved-coord / no-anchor
    # jobs (Mongo already sorted newest-first).
    result.sort(key=lambda x: (x.get("distance_from_driver") is None, x.get("distance_from_driver") or 0))
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
    result = await db.jobs.update_one(
        {"id": job_id, "status": "posted", "assigned_driver_id": None},
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
        {"job_id": job_id},
    )
    return {"ok": True}


# ---------------------------------------------------------------------------
# Real-time dispatch — Driver Live Mode + ASAP claim (Phases 7-17 of the
# Real-time Dispatch Programme). Reuses the existing job / booking / payment
# / tracking / RouteMap lifecycle wherever possible.
# ---------------------------------------------------------------------------

# Centralised dispatch constants — do not scatter magic numbers.
DISPATCH_HEARTBEAT_FRESHNESS_SECONDS = 60        # drivers with older location stop matching
DISPATCH_DEFAULT_RADIUS_MILES = 25               # candidate filter radius for ASAP offers
DISPATCH_CANDIDATE_LIMIT = 25                    # max drivers returned per offer poll


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
    return {"ok": True, "online": True, "updated_at": now}


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
        return {"offers": [], "reason": "offline"}
    if not _heartbeat_is_fresh(driver.get("live_updated_at")):
        return {"offers": [], "reason": "stale_location"}
    if not driver.get("live_lat") or not driver.get("live_lng"):
        return {"offers": [], "reason": "no_location"}

    # Phase 23 — driver busy rule: if the driver has an in-flight ASAP
    # assignment (accepted / travelling / arrived / collected / on_route)
    # they do NOT receive new immediate work. Scheduled future work does not
    # block ASAP offers.
    busy = await db.jobs.find_one({
        "assigned_driver_id": user["id"],
        "service_timing": "asap",
        "status": {"$in": ["accepted", "confirmed", "dispatch_ready",
                             "travelling", "arrived", "collected",
                             "on_route", "delivered"]},
    }, {"id": 1})
    if busy:
        return {"offers": [], "reason": "busy_on_asap"}

    # Candidate query — index-friendly (service_timing + status + assigned_driver_id).
    candidates = await db.jobs.find(
        {"service_timing": "asap",
         "status": {"$in": ["confirmed", "dispatch_ready"]},
         "assigned_driver_id": None,
         "cancelled_at": {"$exists": False}},
        {"_id": 0},
    ).sort("dispatch_ready_at", 1).to_list(200)

    offers = []
    d_lat, d_lng = float(driver["live_lat"]), float(driver["live_lng"])
    for job in candidates:
        if not _dispatch_eligible(job):
            continue
        if not _driver_is_capable(driver, job):
            continue
        p_lat = float(job.get("pickup_lat") or 0)
        p_lng = float(job.get("pickup_lng") or 0)
        dist = haversine_miles(d_lat, d_lng, p_lat, p_lng)
        if dist > radius_miles:
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
            # map can plot each pending offer as a pin. These are already
            # implied by `distance_to_pickup_miles`; making them explicit
            # unlocks visual dispatch decisions without leaking anything
            # a driver couldn't derive from the existing offer feed.
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
            "dispatch_ready_at": job.get("dispatch_ready_at"),
        })
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
    booking_fee = await calculate_booking_fee(driver_charge)
    customer_total = round(driver_charge + booking_fee, 2)
    booking = {
        "id": new_id(),
        "job_id": job_id,
        "customer_id": job["customer_id"],
        "driver_id": job.get("assigned_driver_id"),  # None for ASAP pre-claim
        "driver_charge": driver_charge,
        "booking_fee": booking_fee,
        "total_price": customer_total,          # what customer pays overall
        "deposit_amount": booking_fee,          # what customer pays now (Stripe)
        "balance_due": driver_charge,           # what customer pays driver on delivery
        "status": "accepted",  # pending deposit
        "payment_status": "pending",
        "stripe_session_id": None,
        "service_timing": job.get("service_timing", "scheduled"),
        "service_type": job.get("service_type", "transport"),
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
        from services.email import send_deposit_receipt
        fresh_booking = await db.bookings.find_one({"id": booking["id"]}, {"_id": 0})
        cust = await db.users.find_one({"id": booking["customer_id"]}, {"_id": 0, "password_hash": 0})
        job_doc = await db.jobs.find_one({"id": booking["job_id"]}, {"_id": 0})
        if fresh_booking and cust:
            fresh_booking["job"] = job_doc  # for template pickup/dropoff
            await send_deposit_receipt(db, user=cust, booking=fresh_booking)
    except Exception:
        logger.exception("deposit-receipt email failed; continuing (booking not affected)")
    return await db.bookings.find_one({"id": booking["id"]}, {"_id": 0})


@api.get("/payments/status/{session_id}")
async def payment_status(session_id: str, request: Request,
                          user: dict = Depends(get_current_user)):
    """Frontend polls this after Stripe redirects with `?payment=success`.

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
            other_ids.append(b["driver_id"] if user["role"] == "customer" else b["customer_id"])
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
            other_id = b["driver_id"] if user["role"] == "customer" else b["customer_id"]
            other = users_map.get(other_id)
            b["other_party"] = user_to_public(other) if other else None
    return bookings


@api.get("/bookings/{booking_id}")
async def get_booking(booking_id: str, user: dict = Depends(get_current_user)):
    b = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not b:
        raise HTTPException(status_code=404, detail="Not found")
    if user["role"] not in ("admin",) and user["id"] not in (b["customer_id"], b["driver_id"]):
        raise HTTPException(status_code=403, detail="Forbidden")
    job = await db.jobs.find_one({"id": b["job_id"]}, {"_id": 0})
    include_private = b.get("payment_status") == "paid" or user["role"] == "admin"
    b["job"] = public_job(job, include_private=include_private) if job else None
    # Projection — see /bookings/mine for rationale.
    if job:
        b["assigned_driver_id"] = job.get("assigned_driver_id") or b.get("driver_id")
        b["assigned_driver_name"] = job.get("assigned_driver_name")
        b["assigned_driver_rating"] = job.get("assigned_driver_rating")
    if include_private:
        other_id = b["driver_id"] if user["id"] == b["customer_id"] else b["customer_id"]
        other = await db.users.find_one({"id": other_id}, {"_id": 0, "password_hash": 0})
        b["other_party"] = user_to_public(other) if other else None
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
    if user["id"] not in (b["driver_id"], b["customer_id"]) and user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")
    valid = ["travelling", "arrived", "collected", "on_route", "delivered", "cancelled"]
    if payload.status not in valid:
        raise HTTPException(status_code=400, detail="Invalid status")

    await db.bookings.update_one({"id": booking_id}, {"$set": {"status": payload.status,
                                                                 "updated_at": now_iso()}})
    await db.jobs.update_one({"id": b["job_id"]}, {"$set": {"status": payload.status}})

    other_id = b["customer_id"] if user["id"] == b["driver_id"] else b["driver_id"]
    await push_notification(other_id, f"Booking {payload.status}",
                             f"Booking status updated to {payload.status.replace('_', ' ')}.",
                             {"booking_id": booking_id})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Tracking
# ---------------------------------------------------------------------------


@api.post("/tracking/{booking_id}")
async def update_location(booking_id: str, payload: LocationUpdate,
                           user: dict = Depends(require_role("driver"))):
    b = await db.bookings.find_one({"id": booking_id})
    if not b or b["driver_id"] != user["id"]:
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
    if user["id"] not in (b["customer_id"], b["driver_id"]) and user["role"] != "admin":
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
    if user["id"] not in (b["customer_id"], b["driver_id"]):
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
        "created_at": now_iso(),
    }
    await db.messages.insert_one(msg)
    other_id = b["customer_id"] if user["id"] == b["driver_id"] else b["driver_id"]
    await push_notification(other_id, f"Message from {user['name']}",
                             payload.text or "Sent a photo", {"booking_id": booking_id})
    return {k: v for k, v in msg.items() if k != "_id"}


@api.get("/bookings/{booking_id}/messages")
async def list_messages(booking_id: str, user: dict = Depends(get_current_user)):
    b = await db.bookings.find_one({"id": booking_id})
    if not b:
        raise HTTPException(status_code=404, detail="Not found")
    if user["id"] not in (b["customer_id"], b["driver_id"]) and user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")
    if b.get("payment_status") != "paid":
        return []
    msgs = await db.messages.find({"booking_id": booking_id}, {"_id": 0}) \
                             .sort("created_at", 1).to_list(500)
    # mark as read for the reader
    await db.messages.update_many(
        {"booking_id": booking_id, "sender_id": {"$ne": user["id"]}, "read": False},
        {"$set": {"read": True}},
    )
    return msgs


# ---------------------------------------------------------------------------
# POD (Proof of Delivery)
# ---------------------------------------------------------------------------


@api.post("/bookings/{booking_id}/pod")
async def upload_pod(booking_id: str, payload: PODUpload,
                      user: dict = Depends(require_role("driver"))):
    b = await db.bookings.find_one({"id": booking_id})
    if not b or b["driver_id"] != user["id"]:
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
    if user["id"] not in (b["customer_id"], b["driver_id"]) and user["role"] != "admin":
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
    await db.users.update_one({"id": b["driver_id"]}, {"$inc": {"total_jobs": 1}})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Reviews
# ---------------------------------------------------------------------------


@api.post("/bookings/{booking_id}/review")
async def create_review(booking_id: str, payload: ReviewCreate,
                         user: dict = Depends(get_current_user)):
    b = await db.bookings.find_one({"id": booking_id})
    if not b or user["id"] not in (b["customer_id"], b["driver_id"]):
        raise HTTPException(status_code=404, detail="Not found")
    if b.get("status") not in ("completed", "pod_uploaded"):
        raise HTTPException(status_code=400, detail="Booking not completed yet")
    target_id = b["driver_id"] if user["id"] == b["customer_id"] else b["customer_id"]
    doc = {
        "id": new_id(),
        "booking_id": booking_id,
        "from_id": user["id"],
        "from_name": user["name"],
        "target_id": target_id,
        "rating": max(1, min(5, payload.rating)),
        "comment": payload.comment,
        "photos": payload.photos,
        "verified_delivery": True,
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
    return {k: v for k, v in doc.items() if k != "_id"}


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


@api.get("/admin/users")
async def admin_list_users(role: Optional[str] = None,
                            user: dict = Depends(require_role("admin"))):
    q = {"role": role} if role else {}
    users = await db.users.find(q, {"_id": 0, "password_hash": 0}) \
                            .sort("created_at", -1).to_list(500)
    return users


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


@api.get("/admin/bookings")
async def admin_list_bookings(user: dict = Depends(require_role("admin"))):
    bookings = await db.bookings.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return bookings


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
    except Exception as e:  # noqa: BLE001
        logger.warning("Dispatch index creation skipped: %s", e)

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
