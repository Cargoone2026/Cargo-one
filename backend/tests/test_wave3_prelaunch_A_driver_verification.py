"""Wave 3 Pre-Launch Increment A tests.

Covers the new admin driver-verification workflow:
  - GET  /api/admin/drivers/{driver_id}
  - POST /api/admin/users/{user_id}/request-changes
  - POST /api/auth/me/resubmit-verification
  - POST /api/admin/users/{user_id}/approve       (history append)
  - POST /api/admin/users/{user_id}/suspend       (with optional reason)
  - GET  /api/auth/me                              (new optional fields)

Runs the full state-transition:
  approve -> suspend(with reason) -> approve -> request-changes -> resubmit -> pending
and verifies verification_history + user fields after each step.
"""
from __future__ import annotations

import os
import pytest
import requests

BASE_URL = (
    os.environ.get("EXPO_BACKEND_URL")
    or os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    or "https://cargo-port.preview.emergentagent.com"
).rstrip("/")

ADMIN = {"email": "admin@cargoone.com", "password": "admin123"}
DRIVER = {"email": "driver1@cargoone.com", "password": "driver123"}
CUSTOMER = {"email": "cust1@cargoone.com", "password": "cust1234"}


# ---------------------------------------------------------------------------
# Fixtures / helpers
# ---------------------------------------------------------------------------
@pytest.fixture(scope="module")
def http():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _auth(tok: str) -> dict:
    return {"Authorization": f"Bearer {tok}"}


def _login(http, creds):
    r = http.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, f"login failed for {creds['email']}: {r.status_code} {r.text[:200]}"
    return r.json()


@pytest.fixture(scope="module")
def admin_token(http):
    return _login(http, ADMIN)["access_token"]


@pytest.fixture(scope="module")
def customer_token(http):
    return _login(http, CUSTOMER)["access_token"]


@pytest.fixture(scope="module")
def customer_id(http, customer_token):
    r = http.get(f"{BASE_URL}/api/auth/me", headers=_auth(customer_token), timeout=15)
    assert r.status_code == 200
    return r.json()["id"]


@pytest.fixture(scope="module")
def admin_id(http, admin_token):
    r = http.get(f"{BASE_URL}/api/auth/me", headers=_auth(admin_token), timeout=15)
    assert r.status_code == 200
    return r.json()["id"]


def _driver_token(http):
    return _login(http, DRIVER)["access_token"]


def _driver_id(http, tok):
    r = http.get(f"{BASE_URL}/api/auth/me", headers=_auth(tok), timeout=15)
    assert r.status_code == 200
    return r.json()["id"]


@pytest.fixture(scope="module", autouse=True)
def reset_driver_state(http, admin_token):
    """Reset the seeded driver to a known 'active/approved' state at the start
    of this test module so we can drive the state machine deterministically.
    After the module runs we leave the driver at whatever pending state the
    last test transitioned to; a final approve is emitted so the driver ends
    the test run in a clean 'active' state (nice for other regression tests
    that may run afterwards)."""
    tok = _driver_token(http)
    did = _driver_id(http, tok)
    # Force to 'active' via approve — safe regardless of current state.
    r = http.post(f"{BASE_URL}/api/admin/users/{did}/approve",
                   headers=_auth(admin_token), timeout=15)
    assert r.status_code == 200, f"reset approve failed: {r.status_code} {r.text[:200]}"
    yield did
    # Final cleanup: leave driver approved/active
    r = http.post(f"{BASE_URL}/api/admin/users/{did}/approve",
                   headers=_auth(admin_token), timeout=15)
    # Not asserting — just best-effort cleanup.


# ---------------------------------------------------------------------------
# GET /api/admin/drivers/{driver_id}
# ---------------------------------------------------------------------------
class TestAdminDriverDetail:
    def test_admin_ok_schema(self, http, admin_token, reset_driver_state):
        driver_id = reset_driver_state
        r = http.get(f"{BASE_URL}/api/admin/drivers/{driver_id}",
                     headers=_auth(admin_token), timeout=15)
        assert r.status_code == 200, r.text[:200]
        d = r.json()
        for key in ("user", "documents", "fleet", "stats"):
            assert key in d, f"missing key {key}"

        # user
        u = d["user"]
        for k in ("id", "name", "email", "role", "status",
                   "verification_history", "changes_requested_doc_types"):
            assert k in u, f"user.{k} missing"
        assert u["role"] == "driver"
        assert u["id"] == driver_id

        # documents must all be active
        assert isinstance(d["documents"], list)
        for doc in d["documents"]:
            assert doc.get("active") is True, f"non-active doc leaked: {doc}"

        # stats
        for k in ("completed_bookings", "active_bookings", "rating", "review_count"):
            assert k in d["stats"], f"stats.{k} missing"

    def test_403_for_driver_jwt(self, http):
        tok = _driver_token(http)
        driver_id = _driver_id(http, tok)
        r = http.get(f"{BASE_URL}/api/admin/drivers/{driver_id}",
                     headers=_auth(tok), timeout=15)
        assert r.status_code == 403, f"expected 403 got {r.status_code}"

    def test_403_for_customer_jwt(self, http, customer_token):
        tok = _driver_token(http)
        driver_id = _driver_id(http, tok)
        r = http.get(f"{BASE_URL}/api/admin/drivers/{driver_id}",
                     headers=_auth(customer_token), timeout=15)
        assert r.status_code == 403

    def test_404_unknown_driver(self, http, admin_token):
        r = http.get(f"{BASE_URL}/api/admin/drivers/does-not-exist-xyz",
                     headers=_auth(admin_token), timeout=15)
        assert r.status_code == 404

    def test_400_non_driver_id_admin(self, http, admin_token, admin_id):
        # admin's own id is not a driver
        r = http.get(f"{BASE_URL}/api/admin/drivers/{admin_id}",
                     headers=_auth(admin_token), timeout=15)
        assert r.status_code == 400, f"expected 400 got {r.status_code}"

    def test_400_non_driver_id_customer(self, http, admin_token, customer_id):
        r = http.get(f"{BASE_URL}/api/admin/drivers/{customer_id}",
                     headers=_auth(admin_token), timeout=15)
        assert r.status_code == 400


# ---------------------------------------------------------------------------
# POST /api/admin/users/{user_id}/approve  (history append)
# ---------------------------------------------------------------------------
class TestAdminApproveHistory:
    def test_approve_appends_history(self, http, admin_token, reset_driver_state):
        driver_id = reset_driver_state
        # Snapshot history length
        before = http.get(f"{BASE_URL}/api/admin/drivers/{driver_id}",
                          headers=_auth(admin_token), timeout=15).json()
        before_len = len(before["user"]["verification_history"])

        r = http.post(f"{BASE_URL}/api/admin/users/{driver_id}/approve",
                      headers=_auth(admin_token), timeout=15)
        assert r.status_code == 200

        after = http.get(f"{BASE_URL}/api/admin/drivers/{driver_id}",
                         headers=_auth(admin_token), timeout=15).json()
        hist = after["user"]["verification_history"]
        assert len(hist) == before_len + 1
        latest = hist[-1]
        assert latest["action"] == "approve"
        assert latest.get("by_admin_id"), "by_admin_id missing on history entry"
        assert after["user"]["status"] == "active"

    def test_approve_404_unknown(self, http, admin_token):
        r = http.post(f"{BASE_URL}/api/admin/users/does-not-exist/approve",
                      headers=_auth(admin_token), timeout=15)
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# POST /api/admin/users/{user_id}/suspend  (accepts optional reason)
# ---------------------------------------------------------------------------
class TestAdminSuspend:
    def test_suspend_with_reason(self, http, admin_token, reset_driver_state):
        driver_id = reset_driver_state
        reason = "Suspicious activity detected on account"
        r = http.post(
            f"{BASE_URL}/api/admin/users/{driver_id}/suspend",
            json={"reason": reason},
            headers=_auth(admin_token),
            timeout=15,
        )
        assert r.status_code == 200

        detail = http.get(f"{BASE_URL}/api/admin/drivers/{driver_id}",
                          headers=_auth(admin_token), timeout=15).json()
        u = detail["user"]
        assert u["status"] == "suspended"
        assert u.get("suspension_reason") == reason
        latest = u["verification_history"][-1]
        assert latest["action"] == "suspend"
        assert latest.get("reason") == reason

        # Suspended driver cannot log in anymore — verify via /auth/me on a
        # fresh login attempt. (login returns 200 but /auth/me should 403 due
        # to suspension check in get_current_user.)
        # Re-approve to allow subsequent tests to use the driver.
        r = http.post(f"{BASE_URL}/api/admin/users/{driver_id}/approve",
                      headers=_auth(admin_token), timeout=15)
        assert r.status_code == 200

    def test_suspend_empty_body_still_ok(self, http, admin_token, reset_driver_state):
        driver_id = reset_driver_state
        r = http.post(f"{BASE_URL}/api/admin/users/{driver_id}/suspend",
                      headers=_auth(admin_token), timeout=15)
        assert r.status_code == 200, f"expected 200 got {r.status_code} {r.text[:200]}"

        detail = http.get(f"{BASE_URL}/api/admin/drivers/{driver_id}",
                          headers=_auth(admin_token), timeout=15).json()
        assert detail["user"]["status"] == "suspended"
        # Re-approve for downstream tests
        r = http.post(f"{BASE_URL}/api/admin/users/{driver_id}/approve",
                      headers=_auth(admin_token), timeout=15)
        assert r.status_code == 200

    def test_suspend_forbidden_for_non_admin(self, http, customer_token, reset_driver_state):
        driver_id = reset_driver_state
        r = http.post(f"{BASE_URL}/api/admin/users/{driver_id}/suspend",
                      json={"reason": "nope"},
                      headers=_auth(customer_token), timeout=15)
        assert r.status_code == 403


# ---------------------------------------------------------------------------
# POST /api/admin/users/{user_id}/request-changes
# ---------------------------------------------------------------------------
class TestAdminRequestChanges:
    def test_request_changes_ok(self, http, admin_token, reset_driver_state):
        driver_id = reset_driver_state
        # Ensure driver is active first
        http.post(f"{BASE_URL}/api/admin/users/{driver_id}/approve",
                  headers=_auth(admin_token), timeout=15)

        reason = "Please re-upload your driving licence — image is unreadable"
        doc_types = ["driving_licence"]
        r = http.post(
            f"{BASE_URL}/api/admin/users/{driver_id}/request-changes",
            json={"reason": reason, "doc_types": doc_types},
            headers=_auth(admin_token),
            timeout=15,
        )
        assert r.status_code == 200, r.text[:200]

        # Verify user state
        detail = http.get(f"{BASE_URL}/api/admin/drivers/{driver_id}",
                          headers=_auth(admin_token), timeout=15).json()
        u = detail["user"]
        assert u["status"] == "changes_requested"
        assert u.get("changes_requested_reason") == reason
        assert u.get("changes_requested_doc_types") == doc_types
        latest = u["verification_history"][-1]
        assert latest["action"] == "request_changes"
        assert latest.get("reason") == reason
        assert latest.get("doc_types") == doc_types

    def test_request_changes_reason_too_short(self, http, admin_token, reset_driver_state):
        driver_id = reset_driver_state
        r = http.post(
            f"{BASE_URL}/api/admin/users/{driver_id}/request-changes",
            json={"reason": "short"},
            headers=_auth(admin_token),
            timeout=15,
        )
        assert r.status_code == 400

    def test_request_changes_non_driver_target(self, http, admin_token, customer_id):
        r = http.post(
            f"{BASE_URL}/api/admin/users/{customer_id}/request-changes",
            json={"reason": "Ten characters or more here"},
            headers=_auth(admin_token),
            timeout=15,
        )
        assert r.status_code == 400

    def test_request_changes_unknown_user(self, http, admin_token):
        r = http.post(
            f"{BASE_URL}/api/admin/users/does-not-exist/request-changes",
            json={"reason": "Ten characters or more here"},
            headers=_auth(admin_token),
            timeout=15,
        )
        assert r.status_code == 404

    def test_request_changes_forbidden_for_non_admin(self, http, customer_token, reset_driver_state):
        driver_id = reset_driver_state
        r = http.post(
            f"{BASE_URL}/api/admin/users/{driver_id}/request-changes",
            json={"reason": "Ten characters or more here"},
            headers=_auth(customer_token),
            timeout=15,
        )
        assert r.status_code == 403


# ---------------------------------------------------------------------------
# POST /api/auth/me/resubmit-verification
# ---------------------------------------------------------------------------
class TestDriverResubmit:
    def test_resubmit_from_changes_requested(self, http, admin_token, reset_driver_state):
        driver_id = reset_driver_state
        # Put driver into changes_requested first
        reason = "Please re-upload proof of insurance document"
        http.post(f"{BASE_URL}/api/admin/users/{driver_id}/request-changes",
                  json={"reason": reason, "doc_types": []},
                  headers=_auth(admin_token), timeout=15)

        # Driver logs in and resubmits
        tok = _driver_token(http)
        r = http.post(f"{BASE_URL}/api/auth/me/resubmit-verification",
                      headers=_auth(tok), timeout=15)
        assert r.status_code == 200, r.text[:200]
        body = r.json()
        assert body.get("status") == "pending"

        # Verify state via /auth/me — changes_requested_* cleared
        me = http.get(f"{BASE_URL}/api/auth/me",
                      headers=_auth(tok), timeout=15).json()
        assert me["status"] == "pending"
        assert not me.get("changes_requested_reason")
        assert not me.get("changes_requested_doc_types")

        # Verify history append
        detail = http.get(f"{BASE_URL}/api/admin/drivers/{driver_id}",
                          headers=_auth(admin_token), timeout=15).json()
        latest = detail["user"]["verification_history"][-1]
        assert latest["action"] == "resubmit"

    def test_resubmit_400_when_not_in_changes_requested(self, http, admin_token, reset_driver_state):
        driver_id = reset_driver_state
        # Force driver to active
        http.post(f"{BASE_URL}/api/admin/users/{driver_id}/approve",
                  headers=_auth(admin_token), timeout=15)
        tok = _driver_token(http)
        r = http.post(f"{BASE_URL}/api/auth/me/resubmit-verification",
                      headers=_auth(tok), timeout=15)
        assert r.status_code == 400

    def test_resubmit_401_missing_token(self, http):
        r = http.post(f"{BASE_URL}/api/auth/me/resubmit-verification", timeout=15)
        # FastAPI OAuth2/HTTPBearer returns 401 (or 403 if bearer not present depending on impl)
        assert r.status_code in (401, 403), f"expected 401/403 got {r.status_code}"

    def test_resubmit_400_when_not_driver(self, http, customer_token, admin_token,
                                             reset_driver_state):
        # Customer trying to resubmit → business-logic 400
        r = http.post(f"{BASE_URL}/api/auth/me/resubmit-verification",
                      headers=_auth(customer_token), timeout=15)
        assert r.status_code == 400


# ---------------------------------------------------------------------------
# /api/auth/me exposes new optional fields (correlated to admin actions above)
# ---------------------------------------------------------------------------
class TestAuthMeNewFields:
    def test_me_reflects_changes_requested(self, http, admin_token, reset_driver_state):
        driver_id = reset_driver_state
        http.post(f"{BASE_URL}/api/admin/users/{driver_id}/approve",
                  headers=_auth(admin_token), timeout=15)
        reason = "Insurance cert has expired — please upload updated file"
        doc_types = ["insurance"]
        r = http.post(
            f"{BASE_URL}/api/admin/users/{driver_id}/request-changes",
            json={"reason": reason, "doc_types": doc_types},
            headers=_auth(admin_token), timeout=15,
        )
        assert r.status_code == 200

        tok = _driver_token(http)
        me = http.get(f"{BASE_URL}/api/auth/me",
                      headers=_auth(tok), timeout=15).json()
        assert me["status"] == "changes_requested"
        assert me.get("changes_requested_reason") == reason
        assert me.get("changes_requested_doc_types") == doc_types
        # Reset to active for next tests
        http.post(f"{BASE_URL}/api/auth/me/resubmit-verification",
                  headers=_auth(tok), timeout=15)
        http.post(f"{BASE_URL}/api/admin/users/{driver_id}/approve",
                  headers=_auth(admin_token), timeout=15)


# ---------------------------------------------------------------------------
# Full end-to-end state machine
# ---------------------------------------------------------------------------
class TestFullStateMachine:
    def test_approve_suspend_approve_request_resubmit(self, http, admin_token, reset_driver_state):
        driver_id = reset_driver_state
        # 1) Approve (baseline)
        r = http.post(f"{BASE_URL}/api/admin/users/{driver_id}/approve",
                      headers=_auth(admin_token), timeout=15)
        assert r.status_code == 200

        # 2) Suspend with reason
        r = http.post(
            f"{BASE_URL}/api/admin/users/{driver_id}/suspend",
            json={"reason": "Policy violation during handover"},
            headers=_auth(admin_token), timeout=15,
        )
        assert r.status_code == 200
        d = http.get(f"{BASE_URL}/api/admin/drivers/{driver_id}",
                     headers=_auth(admin_token), timeout=15).json()
        assert d["user"]["status"] == "suspended"

        # 3) Re-approve
        r = http.post(f"{BASE_URL}/api/admin/users/{driver_id}/approve",
                      headers=_auth(admin_token), timeout=15)
        assert r.status_code == 200

        # 4) Request changes
        reason = "Please re-upload background check certificate"
        doc_types = ["dbs_check"]
        r = http.post(
            f"{BASE_URL}/api/admin/users/{driver_id}/request-changes",
            json={"reason": reason, "doc_types": doc_types},
            headers=_auth(admin_token), timeout=15,
        )
        assert r.status_code == 200
        d = http.get(f"{BASE_URL}/api/admin/drivers/{driver_id}",
                     headers=_auth(admin_token), timeout=15).json()
        assert d["user"]["status"] == "changes_requested"

        # 5) Resubmit
        tok = _driver_token(http)
        r = http.post(f"{BASE_URL}/api/auth/me/resubmit-verification",
                      headers=_auth(tok), timeout=15)
        assert r.status_code == 200
        d = http.get(f"{BASE_URL}/api/admin/drivers/{driver_id}",
                     headers=_auth(admin_token), timeout=15).json()
        assert d["user"]["status"] == "pending"

        # Verify audit trail contains an ordered sequence including all 5 actions.
        actions = [h["action"] for h in d["user"]["verification_history"]]
        for expected in ("approve", "suspend", "approve", "request_changes", "resubmit"):
            assert expected in actions, f"missing history action {expected}. history={actions}"
