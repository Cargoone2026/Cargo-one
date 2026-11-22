"""Sign-up protection: canonical emails, disposable domains, rate limits, email codes."""
import hashlib
import logging
import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

logger = logging.getLogger("signup_guard")

DISPOSABLE_DOMAINS = {
    "beautifulcats.fun", "mailinator.com", "guerrillamail.com", "10minutemail.com", "tempmail.com",
    "temp-mail.org", "yopmail.com", "trashmail.com", "sharklasers.com", "getnada.com", "dispostable.com",
    "maildrop.cc", "throwawaymail.com", "fakeinbox.com", "mohmal.com", "emailondeck.com",
}
GMAIL_DOMAINS = {"gmail.com", "googlemail.com"}
RATE_MSG = "Too many sign-ups from this connection. Please try again later or contact support@cargoone.co.uk."
CODE_TTL = timedelta(minutes=15)
LINK_TTL = timedelta(hours=24)
MAX_CODE_ATTEMPTS = 5


def canonical_email(email: str) -> str:
    local, _, domain = (email or "").strip().lower().partition("@")
    local = local.split("+", 1)[0]
    if domain in GMAIL_DOMAINS:
        local = local.replace(".", "")
        domain = "gmail.com"
    return f"{local}@{domain}"


def is_disposable(email: str) -> bool:
    return (email or "").strip().lower().rpartition("@")[2] in DISPOSABLE_DOMAINS


def canonical_query(canon: str) -> dict:
    """Mongo filter matching users with this canonical email (new field or legacy raw email)."""
    local, _, domain = canon.partition("@")
    if domain == "gmail.com":
        body = r"\.?".join(re.escape(c) for c in local)
        rx = rf"^\.?{body}\.?(\+[^@]*)?@(gmail|googlemail)\.com$"
    else:
        rx = rf"^{re.escape(local)}(\+[^@]*)?@{re.escape(domain)}$"
    return {"$or": [{"email_canonical": canon}, {"email": {"$regex": rx, "$options": "i"}}]}


def client_ip(request) -> str:
    cf = (request.headers.get("cf-connecting-ip") or "").strip()
    if cf:
        return cf
    xff = request.headers.get("x-forwarded-for") or ""
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _since(**kw) -> datetime:
    return datetime.now(timezone.utc) - timedelta(**kw)


async def ensure_indexes(db):
    await db.signup_attempts.create_index("at", expireAfterSeconds=86400)
    await db.signup_attempts.create_index([("kind", 1), ("ip", 1), ("at", -1)])
    await db.email_verifications.create_index("user_id", unique=True)
    await db.welcome_sent.create_index("canonical", unique=True)
    await db.users.update_many({"email_verified": {"$exists": False}}, {"$set": {"email_verified": True}})


async def register_limited(db, ip: str) -> bool:
    if await db.signup_attempts.count_documents({"kind": "register", "ip": ip, "at": {"$gte": _since(hours=1)}}) >= 3:
        return True
    if await db.signup_attempts.count_documents({"kind": "register", "ip": ip, "at": {"$gte": _since(hours=24)}}) >= 10:
        return True
    return await db.signup_attempts.count_documents({"kind": "register", "at": {"$gte": _since(minutes=10)}}) >= 30


async def record(db, kind: str, ip: str, user_id: Optional[str] = None):
    await db.signup_attempts.insert_one({"kind": kind, "ip": ip, "user_id": user_id, "at": datetime.now(timezone.utc)})


async def resend_limited(db, user_id: str) -> Optional[str]:
    if await db.signup_attempts.count_documents({"kind": "code", "user_id": user_id, "at": {"$gte": _since(seconds=60)}}):
        return "Please wait a minute before requesting another code."
    if await db.signup_attempts.count_documents({"kind": "code", "user_id": user_id, "at": {"$gte": _since(hours=24)}}) >= 5:
        return "You've requested too many codes today. Please try again tomorrow or contact support@cargoone.co.uk."
    if await db.signup_attempts.count_documents({"kind": "code", "at": {"$gte": _since(minutes=10)}}) >= 30:
        return RATE_MSG
    return None


def _hash(v: str) -> str:
    return hashlib.sha256(v.encode()).hexdigest()


async def issue_code(db, user: dict, ip: str, base_url: str):
    """Create a fresh code + link for the user and email them. Never raises."""
    code = f"{secrets.randbelow(1_000_000):06d}"
    token = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)
    await db.email_verifications.update_one(
        {"user_id": user["id"]},
        {"$set": {"user_id": user["id"], "code_hash": _hash(code), "code_expires": now + CODE_TTL,
                  "token_hash": _hash(token), "token_expires": now + LINK_TTL, "attempts": 0, "created_at": now}},
        upsert=True,
    )
    await record(db, "code", ip, user["id"])
    try:
        from services.email import send_verification_code
        await send_verification_code(db, user=user, code=code, link=f"{base_url}/verify-email?token={token}")
    except Exception as e:  # pragma: no cover
        logger.warning("verification email skipped: %s", e)


async def check_code(db, user_id: str, code: str) -> Optional[str]:
    """Returns an error message, or None when the code is correct."""
    v = await db.email_verifications.find_one({"user_id": user_id})
    if not v or not v.get("code_hash"):
        return "Please request a new code."
    if v.get("attempts", 0) >= MAX_CODE_ATTEMPTS:
        return "Too many wrong attempts. Please request a new code."
    if v["code_expires"].replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        return "This code has expired. Please request a new code."
    if not secrets.compare_digest(v["code_hash"], _hash((code or "").strip())):
        await db.email_verifications.update_one({"user_id": user_id}, {"$inc": {"attempts": 1}})
        left = MAX_CODE_ATTEMPTS - v.get("attempts", 0) - 1
        return "Too many wrong attempts. Please request a new code." if left <= 0 else f"That code isn't right. {left} attempt{'s' if left != 1 else ''} left."
    return None


async def user_for_token(db, token: str) -> Optional[str]:
    v = await db.email_verifications.find_one({"token_hash": _hash(token or "")})
    if not v or v["token_expires"].replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        return None
    return v["user_id"]


async def mark_verified(db, user: dict):
    await db.users.update_one({"id": user["id"]}, {"$set": {"email_verified": True, "email_verified_at": datetime.now(timezone.utc).isoformat()}})
    await db.email_verifications.update_one({"user_id": user["id"]}, {"$set": {"code_hash": None, "token_hash": None, "used_at": datetime.now(timezone.utc)}})
    canon = user.get("email_canonical") or canonical_email(user["email"])
    try:
        await db.welcome_sent.insert_one({"canonical": canon, "user_id": user["id"], "at": datetime.now(timezone.utc)})
    except Exception:
        return
    try:
        from services.email import send_welcome
        await send_welcome(db, user=user)
    except Exception as e:  # pragma: no cover
        logger.warning("welcome email skipped: %s", e)
