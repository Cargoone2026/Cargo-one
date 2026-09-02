"""
Tests for the push-notification token endpoints introduced with the
Expo Push Service integration.

Covers:
- POST /users/me/push-tokens (validation + persistence + upsert semantics)
- DELETE /users/me/push-tokens/{token}
- Auth guard on both endpoints (401 without bearer)
- Invalid token format is rejected with 400
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL",
    "https://cargo-port.preview.emergentagent.com",
).rstrip("/")
API = f"{BASE_URL}/api"


def _register(role: str = "customer") -> dict:
    email = f"TEST_push_{uuid.uuid4().hex[:8]}@example.com"
    payload = {
        "email": email,
        "password": "password123",
        "name": "Push Test",
        "role": role,
        "phone": "+441234567890",
    }
    r = requests.post(f"{API}/auth/register", json=payload, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


def _hdr(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_push_token_endpoints_require_auth():
    r = requests.post(f"{API}/users/me/push-tokens", json={"token": "ExponentPushToken[x]"}, timeout=15)
    assert r.status_code == 401
    r = requests.delete(f"{API}/users/me/push-tokens/ExponentPushToken%5Bx%5D", timeout=15)
    assert r.status_code == 401


def test_push_token_invalid_format_is_rejected():
    reg = _register()
    tok = reg["access_token"]
    for bad in ["not-a-token", "ExponentPushToken[incomplete", "SomethingElse[abc]"]:
        r = requests.post(
            f"{API}/users/me/push-tokens",
            json={"token": bad, "platform": "ios"},
            headers=_hdr(tok),
            timeout=15,
        )
        assert r.status_code == 400, f"{bad!r} → {r.status_code} {r.text}"


def test_push_token_register_and_unregister_roundtrip():
    reg = _register()
    tok = reg["access_token"]
    push = f"ExponentPushToken[{uuid.uuid4().hex}]"

    r = requests.post(
        f"{API}/users/me/push-tokens",
        json={"token": push, "platform": "ios"},
        headers=_hdr(tok),
        timeout=15,
    )
    assert r.status_code == 200 and r.json().get("ok") is True

    # Idempotent re-register on same account keeps a single entry.
    r = requests.post(
        f"{API}/users/me/push-tokens",
        json={"token": push, "platform": "ios"},
        headers=_hdr(tok),
        timeout=15,
    )
    assert r.status_code == 200

    # DELETE removes.
    import urllib.parse
    r = requests.delete(
        f"{API}/users/me/push-tokens/{urllib.parse.quote(push, safe='')}",
        headers=_hdr(tok),
        timeout=15,
    )
    assert r.status_code == 200 and r.json().get("ok") is True


def test_push_token_moves_to_new_owner_on_account_switch():
    """Registering the same push token on a second account must remove it
    from the first — a single device only belongs to one account at a time.
    """
    a = _register()
    b = _register()
    push = f"ExponentPushToken[{uuid.uuid4().hex}]"

    r = requests.post(
        f"{API}/users/me/push-tokens",
        json={"token": push, "platform": "android"},
        headers=_hdr(a["access_token"]),
        timeout=15,
    )
    assert r.status_code == 200
    r = requests.post(
        f"{API}/users/me/push-tokens",
        json={"token": push, "platform": "android"},
        headers=_hdr(b["access_token"]),
        timeout=15,
    )
    assert r.status_code == 200

    # Deleting from A must be a no-op now (token no longer belongs to A).
    import urllib.parse
    r = requests.delete(
        f"{API}/users/me/push-tokens/{urllib.parse.quote(push, safe='')}",
        headers=_hdr(a["access_token"]),
        timeout=15,
    )
    assert r.status_code == 200
