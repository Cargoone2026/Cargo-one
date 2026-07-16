"""Cargo One - Logistics Marketplace Backend.

FastAPI + MongoDB + JWT + Stripe (via emergentintegrations).
Roles: customer, driver, admin.
"""

import logging
import math
import os
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import jwt
from dotenv import load_dotenv
from emergentintegrations.payments.stripe.checkout import (
    CheckoutSessionRequest,
    StripeCheckout,
)
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
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


class UserPublic(BaseModel):
    id: str
    email: EmailStr
    name: str
    phone: Optional[str] = None
    role: str
    status: str = "active"  # active | pending | suspended
    rating: float = 5.0
    total_jobs: int = 0
    review_count: int = 0
    vehicle: Optional[dict] = None
    profile_photo: Optional[str] = None
    documents_verified: bool = False
    verified_driver: bool = False
    created_at: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


class JobCreate(BaseModel):
    title: str
    category: str  # furniture, pallets, cars, motorcycles, house_moves, parcels, freight, documents, boats, machinery
    description: str
    photos: list[str] = Field(default_factory=list)  # base64 or URLs
    pickup_address: str
    pickup_town: str
    pickup_lat: float
    pickup_lng: float
    dropoff_address: str
    dropoff_town: str
    dropoff_lat: float
    dropoff_lng: float
    weight_kg: Optional[float] = None
    dimensions: Optional[str] = None
    collection_date: str
    delivery_date: str
    pricing_type: str  # fixed | bidding
    fixed_price: Optional[float] = None
    max_budget: Optional[float] = None
    vehicle_required: Optional[str] = None


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
    creds: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    if creds is None or creds.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Missing token")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired") from None
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token") from None
    user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
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
async def register(payload: UserRegister):
    existing = await db.users.find_one({"email": payload.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    if payload.role not in ("customer", "driver", "admin"):
        raise HTTPException(status_code=400, detail="Invalid role")

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
    return {"access_token": token, "token_type": "bearer", "user": user_to_public(user)}


@api.post("/auth/login", response_model=TokenResponse)
async def login(payload: UserLogin):
    user = await db.users.find_one({"email": payload.email.lower()})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if user.get("status") == "suspended":
        raise HTTPException(status_code=403, detail="Account suspended")
    token = create_token(user["id"], user["role"])
    return {"access_token": token, "token_type": "bearer", "user": user_to_public(user)}


@api.get("/auth/me", response_model=UserPublic)
async def me(user: dict = Depends(get_current_user)):
    return user_to_public(user)


@api.post("/auth/me/delete")
async def delete_me(user: dict = Depends(get_current_user)):
    """Soft-delete: anonymise personal data, suspend account. Booking records retained."""
    patch = {
        "email": f"deleted+{user['id']}@cargoone.internal",
        "name": "Deleted user",
        "phone": None,
        "profile_photo": None,
        "status": "suspended",
        "deleted_at": now_iso(),
    }
    await db.users.update_one({"id": user["id"]}, {"$set": patch})
    await db.documents.delete_many({"user_id": user["id"]})
    await db.notifications.delete_many({"user_id": user["id"]})
    return {"ok": True}


@api.put("/auth/me")
async def update_me(update: dict, user: dict = Depends(get_current_user)):
    allowed = {"name", "phone", "vehicle", "profile_photo"}
    patch = {k: v for k, v in update.items() if k in allowed}
    if patch:
        await db.users.update_one({"id": user["id"]}, {"$set": patch})
    updated = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    return user_to_public(updated)


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
    distance = haversine_miles(
        data["pickup_lat"], data["pickup_lng"], data["dropoff_lat"], data["dropoff_lng"]
    )
    # Quote suggestion: base £1.5/mile + category multiplier
    category_mult = {
        "furniture": 1.2, "pallets": 1.4, "cars": 2.0, "motorcycles": 1.5,
        "house_moves": 1.6, "parcels": 1.0, "freight": 1.8, "documents": 0.8,
        "boats": 2.5, "machinery": 2.2,
    }.get(data["category"], 1.2)
    suggested_price = round(max(30, distance * 1.5 * category_mult), 2)

    job = {
        "id": new_id(),
        "customer_id": user["id"],
        "customer_name": user["name"],
        "customer_rating": user.get("rating", 5.0),
        "status": "posted",
        "distance_miles": round(distance, 1),
        "suggested_price": suggested_price,
        "assigned_driver_id": None,
        "accepted_price": None,
        "created_at": now_iso(),
        **data,
    }
    await db.jobs.insert_one(job)
    return public_job(job, include_private=True)


@api.get("/jobs/mine")
async def my_jobs(user: dict = Depends(require_role("customer"))):
    jobs = await db.jobs.find({"customer_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return jobs


@api.get("/quote/estimate")
async def quote_estimate(pickup_lat: float, pickup_lng: float,
                          dropoff_lat: float, dropoff_lng: float,
                          category: str = "furniture",
                          user: dict = Depends(get_current_user)):
    """Estimate distance, duration, vehicle & suggested price for a route."""
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

    category_mult = {
        "furniture": 1.2, "pallets": 1.4, "cars": 2.0, "motorcycles": 1.5,
        "house_moves": 1.6, "parcels": 1.0, "freight": 1.8, "documents": 0.8,
        "boats": 2.5, "machinery": 2.2,
    }.get(category, 1.2)
    suggested_price = round(max(30, distance_miles * 1.5 * category_mult), 2)
    vehicle = CATEGORY_VEHICLES.get(category, "Van")
    return {
        "distance_miles": distance_miles,
        "duration_minutes": duration_minutes,
        "suggested_price": suggested_price,
        "vehicle": vehicle,
        "source": source,
    }


@api.get("/jobs/nearby")
async def nearby_jobs(
    lat: float = 51.5074,
    lng: float = -0.1278,
    radius: float = 75.0,
    user: dict = Depends(require_role("driver")),
):
    all_jobs = await db.jobs.find({"status": "posted"}, {"_id": 0}).sort("created_at", -1).to_list(500)
    result = []
    for j in all_jobs:
        d = haversine_miles(lat, lng, j["pickup_lat"], j["pickup_lng"])
        if d <= radius:
            j["distance_from_driver"] = round(d, 1)
            result.append(public_job(j, include_private=False))
    result.sort(key=lambda x: x["distance_from_driver"])
    return result


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
    if job["status"] != "posted":
        raise HTTPException(status_code=400, detail="Job not available")
    if job["pricing_type"] != "fixed":
        raise HTTPException(status_code=400, detail="Job requires bidding")

    await db.jobs.update_one(
        {"id": job_id},
        {"$set": {
            "status": "accepted",
            "assigned_driver_id": user["id"],
            "assigned_driver_name": user["name"],
            "assigned_driver_rating": user.get("rating", 5.0),
            "accepted_price": job["fixed_price"],
        }},
    )
    await push_notification(
        job["customer_id"],
        "Driver accepted your job",
        f"{user['name']} accepted your {job['title']} job. Pay deposit to confirm.",
        {"job_id": job_id},
    )
    return {"ok": True}


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

    bid = {
        "id": new_id(),
        "job_id": job_id,
        "driver_id": user["id"],
        "driver_name": user["name"],
        "driver_rating": user.get("rating", 5.0),
        "vehicle": user.get("vehicle"),
        "amount": payload.amount,
        "message": payload.message,
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
    if job["status"] != "accepted" or not job.get("assigned_driver_id"):
        raise HTTPException(status_code=400, detail="Job not ready for booking")

    existing = await db.bookings.find_one({"job_id": job_id})
    if existing:
        return {k: v for k, v in existing.items() if k != "_id"}

    driver_charge = float(job["accepted_price"])
    booking_fee = await calculate_booking_fee(driver_charge)
    customer_total = round(driver_charge + booking_fee, 2)
    booking = {
        "id": new_id(),
        "job_id": job_id,
        "customer_id": job["customer_id"],
        "driver_id": job["assigned_driver_id"],
        "driver_charge": driver_charge,
        "booking_fee": booking_fee,
        "total_price": customer_total,          # what customer pays overall
        "deposit_amount": booking_fee,          # what customer pays now (Stripe)
        "balance_due": driver_charge,           # what customer pays driver on delivery
        "status": "accepted",  # pending deposit
        "payment_status": "pending",
        "stripe_session_id": None,
        "created_at": now_iso(),
    }
    await db.bookings.insert_one(booking)
    return {k: v for k, v in booking.items() if k != "_id"}


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

    stripe = StripeCheckout(api_key=STRIPE_API_KEY)
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
        "created_at": now_iso(),
    }
    await db.payment_transactions.insert_one(txn)
    await db.bookings.update_one(
        {"id": booking_id}, {"$set": {"stripe_session_id": session.session_id}}
    )
    return {"session_id": session.session_id, "url": session.url}


@api.get("/payments/status/{session_id}")
async def payment_status(session_id: str, user: dict = Depends(get_current_user)):
    txn = await db.payment_transactions.find_one({"session_id": session_id})
    if not txn:
        raise HTTPException(status_code=404, detail="Session not found")

    # Poll Stripe (idempotent: only advance booking on first confirmation)
    stripe = StripeCheckout(api_key=STRIPE_API_KEY)
    try:
        status_obj = await stripe.get_checkout_status(session_id)
    except Exception as e:
        logger.exception("Stripe status error")
        raise HTTPException(status_code=500, detail=str(e)) from e

    prev_status = txn.get("payment_status")
    await db.payment_transactions.update_one(
        {"session_id": session_id},
        {"$set": {
            "payment_status": status_obj.payment_status,
            "status": status_obj.status,
            "updated_at": now_iso(),
        }},
    )

    if status_obj.payment_status == "paid" and prev_status != "paid":
        booking = await db.bookings.find_one({"id": txn["booking_id"]})
        if booking:
            await db.bookings.update_one(
                {"id": booking["id"]},
                {"$set": {"payment_status": "paid", "status": "deposit_paid",
                          "paid_at": now_iso()}},
            )
            await db.jobs.update_one(
                {"id": booking["job_id"]},
                {"$set": {"status": "confirmed"}},
            )
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

    return {
        "status": status_obj.status,
        "payment_status": status_obj.payment_status,
        "amount_total": status_obj.amount_total,
        "currency": status_obj.currency,
    }


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
    if include_private:
        other_id = b["driver_id"] if user["id"] == b["customer_id"] else b["customer_id"]
        other = await db.users.find_one({"id": other_id}, {"_id": 0, "password_hash": 0})
        b["other_party"] = user_to_public(other) if other else None
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

    msg = {
        "id": new_id(),
        "booking_id": booking_id,
        "sender_id": user["id"],
        "sender_name": user["name"],
        "text": payload.text,
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
async def admin_approve(user_id: str, user: dict = Depends(require_role("admin"))):
    await db.users.update_one({"id": user_id}, {"$set": {"status": "active",
                                                          "documents_verified": True}})
    await push_notification(user_id, "You're approved!",
                             "Your driver account is approved. You can now accept jobs.")
    return {"ok": True}


@api.post("/admin/users/{user_id}/suspend")
async def admin_suspend(user_id: str, user: dict = Depends(require_role("admin"))):
    await db.users.update_one({"id": user_id}, {"$set": {"status": "suspended"}})
    return {"ok": True}


@api.get("/admin/jobs")
async def admin_list_jobs(user: dict = Depends(require_role("admin"))):
    jobs = await db.jobs.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return jobs


@api.get("/admin/bookings")
async def admin_list_bookings(user: dict = Depends(require_role("admin"))):
    bookings = await db.bookings.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return bookings


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
# Health
# ---------------------------------------------------------------------------


@api.get("/")
async def root():
    return {"app": "Cargo One", "version": "1.0.0", "status": "ok"}


# Seed admin + default deposit bands
@app.on_event("startup")
async def seed_startup():
    if not await db.users.find_one({"role": "admin"}):
        admin = {
            "id": new_id(),
            "email": "admin@cargoone.com",
            "name": "Admin",
            "phone": "+441234567890",
            "role": "admin",
            "password_hash": hash_password("admin123"),
            "status": "active",
            "rating": 5.0,
            "total_jobs": 0,
            "documents_verified": True,
            "created_at": now_iso(),
        }
        await db.users.insert_one(admin)
        logger.info("Seeded default admin: admin@cargoone.com / admin123")

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


@app.on_event("shutdown")
async def shutdown():
    client.close()


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
