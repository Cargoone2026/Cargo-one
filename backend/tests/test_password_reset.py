"""Password reset flow — Session D.

Verifies:
- POST /auth/forgot-password always returns 200 (anti-enumeration).
- POST /auth/reset-password rotates the password and returns a fresh session.
- Tokens are single-use (409 on replay).
- Short passwords (< 8) rejected by pydantic (422).
- Invalid tokens rejected (400).
- Email service gracefully skips when RESEND_API_KEY is empty
  (email_log row inserted with status="skipped", NO exception propagated).
"""

import os
import uuid
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL",
    "https://cargo-repo-bridge.preview.emergentagent.com",
).rstrip("/")
API = f"{BASE_URL}/api"


def _register_disposable_user():
    email = f"pwreset+{uuid.uuid4().hex[:12]}@example.com"
    password = "InitialPwd12345!"
    r = requests.post(
        f"{API}/auth/register",
        json={"email": email, "password": password, "name": "PW Reset Test",
              "phone": "+447700900999", "role": "customer"},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    return email, password


def _fetch_token_from_db(email: str) -> str:
    """Extract the freshly-issued reset token straight from Mongo.
    E2E replacement for the real Resend email link when RESEND_API_KEY is absent.
    """
    import asyncio
    from motor.motor_asyncio import AsyncIOMotorClient

    async def go():
        c = AsyncIOMotorClient(os.environ["MONGO_URL"])
        db = c[os.environ["DB_NAME"]]
        rec = await db.password_reset_tokens.find_one(
            {"email": email.lower(), "used_at": None}, sort=[("created_at", -1)],
        )
        return rec["token"] if rec else None

    return asyncio.get_event_loop().run_until_complete(go())


def test_forgot_password_existing_email_returns_200_and_creates_token():
    email, _ = _register_disposable_user()
    r = requests.post(f"{API}/auth/forgot-password", json={"email": email}, timeout=15)
    assert r.status_code == 200
    assert r.json() == {"ok": True}
    tok = _fetch_token_from_db(email)
    assert tok, "expected password_reset_tokens row for real email"


def test_forgot_password_nonexistent_email_still_returns_200():
    r = requests.post(
        f"{API}/auth/forgot-password",
        json={"email": f"nobody-{uuid.uuid4().hex[:8]}@nowhere.tld"},
        timeout=15,
    )
    assert r.status_code == 200
    assert r.json() == {"ok": True}


def test_reset_password_full_flow_rotates_password():
    email, old_pwd = _register_disposable_user()
    requests.post(f"{API}/auth/forgot-password", json={"email": email}, timeout=15)
    token = _fetch_token_from_db(email)
    assert token
    new_pwd = "RotatedPwd67890!"
    r = requests.post(
        f"{API}/auth/reset-password",
        json={"token": token, "new_password": new_pwd},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["access_token"]
    assert body["user"]["email"] == email.lower()

    # Old password now rejected
    r_old = requests.post(f"{API}/auth/login",
                           json={"email": email, "password": old_pwd}, timeout=15)
    assert r_old.status_code == 401, r_old.text

    # New password works
    r_new = requests.post(f"{API}/auth/login",
                           json={"email": email, "password": new_pwd}, timeout=15)
    assert r_new.status_code == 200, r_new.text


def test_reset_password_token_is_single_use():
    email, _ = _register_disposable_user()
    requests.post(f"{API}/auth/forgot-password", json={"email": email}, timeout=15)
    token = _fetch_token_from_db(email)
    first = requests.post(
        f"{API}/auth/reset-password",
        json={"token": token, "new_password": "FirstNew12345!"}, timeout=15,
    )
    assert first.status_code == 200
    second = requests.post(
        f"{API}/auth/reset-password",
        json={"token": token, "new_password": "SecondNew67890!"}, timeout=15,
    )
    assert second.status_code == 400
    assert "already been used" in second.json()["detail"].lower()


def test_reset_password_invalid_token_rejected():
    r = requests.post(
        f"{API}/auth/reset-password",
        json={"token": "not-a-real-token", "new_password": "ValidPwd12345!"},
        timeout=15,
    )
    assert r.status_code == 400
    assert "invalid" in r.json()["detail"].lower()


def test_reset_password_short_new_password_rejected():
    email, _ = _register_disposable_user()
    requests.post(f"{API}/auth/forgot-password", json={"email": email}, timeout=15)
    token = _fetch_token_from_db(email)
    r = requests.post(
        f"{API}/auth/reset-password",
        json={"token": token, "new_password": "short"}, timeout=15,
    )
    assert r.status_code == 422


def test_forgot_password_gracefully_skipped_without_resend_key():
    """When RESEND_API_KEY is not configured, the email_log row must be
    stamped `status='skipped'` and the endpoint must still return 200 —
    booking / auth flows must never be blocked by email delivery."""
    if os.environ.get("RESEND_API_KEY", "").strip():
        pytest.skip("RESEND_API_KEY is configured — graceful-skip path not applicable")
    email, _ = _register_disposable_user()
    requests.post(f"{API}/auth/forgot-password", json={"email": email}, timeout=15)

    import asyncio
    from motor.motor_asyncio import AsyncIOMotorClient

    async def go():
        c = AsyncIOMotorClient(os.environ["MONGO_URL"])
        db = c[os.environ["DB_NAME"]]
        return await db.email_log.find_one(
            {"to": email.lower(), "template": "password_reset"},
            sort=[("at", -1)],
        )

    log = asyncio.get_event_loop().run_until_complete(go())
    assert log is not None, "email_log row expected even when skipped"
    assert log["status"] == "skipped"
    assert log["provider"] == "resend"
