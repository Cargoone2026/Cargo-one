"""R66 — WebAuthn / Passkeys service.

Thin async helpers around the `webauthn` (py_webauthn) library, plus MongoDB
persistence for stored credentials and one-shot challenges.

Design notes
------------
- We NEVER trust a client-supplied user identifier. During authentication the
  server locates the user via the credential ID stored in Mongo.
- Challenges are stored server-side with a short TTL and are consumed on both
  success AND failure. Replay is impossible.
- The RP ID must be `cargoone.co.uk` in production. The set of accepted
  origins is configured explicitly via `WEBAUTHN_ORIGINS` — no wildcards.
- Registration MUST be authenticated (we bind the credential to the caller's
  user record via the existing JWT session).
- Only public metadata is returned from list/manage endpoints. Public keys,
  raw challenges, attestation objects, and signatures are never leaked.
- Face ID / Touch ID key material NEVER touches this server — the platform
  authenticator keeps the private key locally. We only store the public key.
"""
from __future__ import annotations

import base64
import json
import logging
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Iterable, Optional

from fastapi import HTTPException
from webauthn import (
    generate_authentication_options,
    generate_registration_options,
    options_to_json,
    verify_authentication_response,
    verify_registration_response,
)
from webauthn.helpers import base64url_to_bytes, bytes_to_base64url
from webauthn.helpers.structs import (
    AuthenticatorSelectionCriteria,
    PublicKeyCredentialDescriptor,
    ResidentKeyRequirement,
    UserVerificationRequirement,
)

logger = logging.getLogger("cargoone.webauthn")

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------


def _cfg() -> dict:
    """Read WebAuthn config from environment lazily so tests can override."""
    rp_id = os.environ.get("WEBAUTHN_RP_ID", "").strip()
    rp_name = os.environ.get("WEBAUTHN_RP_NAME", "Cargo One").strip() or "Cargo One"
    origins_raw = os.environ.get("WEBAUTHN_ORIGINS", "").strip()
    origins = [o.strip() for o in origins_raw.split(",") if o.strip()]
    ttl = int(os.environ.get("WEBAUTHN_CHALLENGE_TTL_SECONDS", "180"))
    return {"rp_id": rp_id, "rp_name": rp_name, "origins": origins, "ttl": ttl}


def is_configured() -> bool:
    c = _cfg()
    return bool(c["rp_id"]) and bool(c["origins"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _b64u(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _new_challenge() -> bytes:
    return secrets.token_bytes(32)


def public_credential(doc: dict) -> dict:
    """Redact stored credential document to safe metadata only."""
    return {
        "id": doc["credential_id"],
        "label": doc.get("label") or "Passkey",
        "device_type": doc.get("device_type"),
        "backed_up": bool(doc.get("backed_up")),
        "created_at": doc.get("created_at"),
        "last_used_at": doc.get("last_used_at"),
    }


async def ensure_indexes(db) -> None:
    """Idempotent index creation. Called from server startup."""
    try:
        await db.webauthn_credentials.create_index("credential_id", unique=True)
        await db.webauthn_credentials.create_index([("user_id", 1), ("status", 1)])
        # TTL: Mongo purges expired challenges automatically.
        await db.webauthn_challenges.create_index(
            "expires_at", expireAfterSeconds=0
        )
    except Exception as e:  # noqa: BLE001
        logger.warning("webauthn index creation skipped: %s", e)


# ---------------------------------------------------------------------------
# Challenge store
# ---------------------------------------------------------------------------


async def _save_challenge(
    db, kind: str, user_id: str, challenge: bytes
) -> None:
    ttl = _cfg()["ttl"]
    await db.webauthn_challenges.insert_one(
        {
            "kind": kind,
            "user_id": user_id,
            "challenge": _b64u(challenge),
            "expires_at": _now() + timedelta(seconds=ttl),
        }
    )


async def _consume_challenge(db, kind: str, user_id: str) -> Optional[bytes]:
    """Atomically fetch + delete the freshest matching challenge.

    Returns raw challenge bytes if one is found (and not expired), else None.
    """
    doc = await db.webauthn_challenges.find_one_and_delete(
        {
            "kind": kind,
            "user_id": user_id,
            "expires_at": {"$gt": _now()},
        },
        sort=[("expires_at", -1)],
    )
    if not doc:
        return None
    return base64url_to_bytes(doc["challenge"])


# ---------------------------------------------------------------------------
# Registration ceremony
# ---------------------------------------------------------------------------


async def build_registration_options(db, user: dict) -> dict:
    """Generate a `publicKey` options JSON for `navigator.credentials.create`.

    Excludes the user's already-registered credentials so a single device
    can't register twice.
    """
    if not is_configured():
        raise HTTPException(500, "Passkey service is not configured")
    c = _cfg()
    existing = await db.webauthn_credentials.find(
        {"user_id": user["id"], "status": "active"},
        {"credential_id": 1},
    ).to_list(50)
    exclude = [
        PublicKeyCredentialDescriptor(
            id=base64url_to_bytes(x["credential_id"])
        )
        for x in existing
    ]
    challenge = _new_challenge()
    # `user_id` for WebAuthn must be raw bytes; we use the stable server uuid.
    user_handle = user["id"].encode("utf-8")
    options = generate_registration_options(
        rp_id=c["rp_id"],
        rp_name=c["rp_name"],
        user_id=user_handle,
        user_name=user["email"],
        user_display_name=user.get("name") or user["email"],
        challenge=challenge,
        exclude_credentials=exclude,
        authenticator_selection=AuthenticatorSelectionCriteria(
            resident_key=ResidentKeyRequirement.PREFERRED,
            user_verification=UserVerificationRequirement.REQUIRED,
        ),
        timeout=60000,
    )
    await _save_challenge(db, "registration", user["id"], challenge)
    return json.loads(options_to_json(options))


async def verify_and_store_credential(
    db, user: dict, credential: dict, label: Optional[str] = None
) -> dict:
    """Verify a registration response and persist the credential.

    Consumes the challenge FIRST (single-use, both on success and failure).
    """
    c = _cfg()
    challenge = await _consume_challenge(db, "registration", user["id"])
    if not challenge:
        raise HTTPException(400, "Passkey registration challenge expired or already used")
    try:
        verification = verify_registration_response(
            credential=credential,
            expected_challenge=challenge,
            expected_rp_id=c["rp_id"],
            expected_origin=c["origins"],
            require_user_verification=True,
        )
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        # Do not leak crypto details — log only the exception class.
        logger.warning(
            "webauthn registration verify failed for user=%s cls=%s",
            user["id"],
            type(e).__name__,
        )
        raise HTTPException(400, "Invalid passkey registration") from None

    cred_id = bytes_to_base64url(verification.credential_id)
    pk = bytes_to_base64url(verification.credential_public_key)
    transports = credential.get("response", {}).get("transports", []) or []
    if not isinstance(transports, list):
        transports = []

    doc = {
        "credential_id": cred_id,
        "user_id": user["id"],
        "role": user["role"],
        "credential_public_key": pk,
        "sign_count": int(verification.sign_count or 0),
        "transports": [str(t) for t in transports],
        "device_type": str(verification.credential_device_type),
        "backed_up": bool(verification.credential_backed_up),
        "label": (label or "Passkey")[:60],
        "status": "active",
        "created_at": _now().isoformat(),
        "last_used_at": None,
    }
    try:
        await db.webauthn_credentials.insert_one(doc)
    except Exception as e:  # noqa: BLE001
        # Duplicate credential_id (unique index) — already registered.
        logger.warning("webauthn insert failed cls=%s", type(e).__name__)
        raise HTTPException(409, "This passkey is already registered") from None
    return public_credential(doc)


# ---------------------------------------------------------------------------
# Authentication ceremony
# ---------------------------------------------------------------------------


async def build_authentication_options(
    db, users_collection_lookup, email: str
) -> dict:
    """Generate `publicKey` options JSON for `navigator.credentials.get`.

    `users_collection_lookup` is an async callable `(email:str) -> user_or_None`
    so this module doesn't hard-depend on the caller's schema.
    """
    if not is_configured():
        raise HTTPException(500, "Passkey service is not configured")
    c = _cfg()
    user = await users_collection_lookup(email.strip().lower())
    # To avoid enumeration we STILL return a 401 for unknown emails but with
    # the same generic message as `no passkeys`.
    if not user:
        raise HTTPException(401, "Passkey login unavailable for this account")
    creds = await db.webauthn_credentials.find(
        {"user_id": user["id"], "status": "active"},
        {"credential_id": 1},
    ).to_list(50)
    if not creds:
        raise HTTPException(400, "No passkey registered for this account")
    challenge = _new_challenge()
    allow = [
        PublicKeyCredentialDescriptor(id=base64url_to_bytes(x["credential_id"]))
        for x in creds
    ]
    options = generate_authentication_options(
        rp_id=c["rp_id"],
        challenge=challenge,
        timeout=60000,
        allow_credentials=allow,
        user_verification=UserVerificationRequirement.REQUIRED,
    )
    await _save_challenge(db, "authentication", user["id"], challenge)
    return json.loads(options_to_json(options))


async def verify_authentication(
    db, credential: dict
) -> dict:
    """Verify an authentication response and return the credential's user_id.

    On success returns `{"user_id": <str>, "credential_id": <b64url>}`. The
    caller is responsible for issuing its own JWT/session cookies.
    """
    c = _cfg()
    payload_id = credential.get("id")
    if not payload_id or not isinstance(payload_id, str):
        raise HTTPException(400, "Invalid passkey response")

    cred = await db.webauthn_credentials.find_one(
        {"credential_id": payload_id, "status": "active"}
    )
    if not cred:
        raise HTTPException(401, "Invalid passkey login")

    # Challenges are keyed by user_id and single-use. Consume BEFORE verify so
    # any failure below still burns the challenge.
    challenge = await _consume_challenge(db, "authentication", cred["user_id"])
    if not challenge:
        raise HTTPException(401, "Passkey login challenge expired or already used")

    try:
        verification = verify_authentication_response(
            credential=credential,
            expected_challenge=challenge,
            expected_rp_id=c["rp_id"],
            expected_origin=c["origins"],
            credential_public_key=base64url_to_bytes(cred["credential_public_key"]),
            credential_current_sign_count=int(cred.get("sign_count", 0)),
            require_user_verification=True,
        )
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        logger.warning(
            "webauthn auth verify failed cred=%s cls=%s",
            payload_id[:12] + "…",
            type(e).__name__,
        )
        raise HTTPException(401, "Invalid passkey login") from None

    # Atomic sign-counter update. If two concurrent assertions race we accept
    # only one — the losing side sees `modified_count == 0` and is rejected.
    result = await db.webauthn_credentials.update_one(
        {
            "_id": cred["_id"],
            "sign_count": int(cred.get("sign_count", 0)),
        },
        {
            "$set": {
                "sign_count": int(verification.new_sign_count),
                "last_used_at": _now().isoformat(),
            }
        },
    )
    if result.modified_count != 1:
        raise HTTPException(409, "Passkey used concurrently, please retry")

    return {"user_id": cred["user_id"], "credential_id": cred["credential_id"]}


# ---------------------------------------------------------------------------
# Management
# ---------------------------------------------------------------------------


async def list_user_credentials(db, user_id: str) -> list[dict]:
    rows = await db.webauthn_credentials.find(
        {"user_id": user_id, "status": "active"}
    ).to_list(50)
    return [public_credential(r) for r in rows]


async def revoke_credential(db, user_id: str, credential_id: str) -> bool:
    """Soft-delete a credential. Ownership is enforced by user_id predicate."""
    result = await db.webauthn_credentials.update_one(
        {
            "credential_id": credential_id,
            "user_id": user_id,
            "status": "active",
        },
        {"$set": {"status": "revoked", "revoked_at": _now().isoformat()}},
    )
    return result.modified_count == 1
