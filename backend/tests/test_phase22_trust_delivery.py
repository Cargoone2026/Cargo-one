"""Phase 2.2 Trust & Delivery backend tests.

Covers: driver documents CRUD + admin review, verified_driver flag,
public profile endpoint, POD with photos+signature, photo reviews,
bid enrichment with verified_driver, and no-regression for core endpoints.
"""

import time
import uuid
import os
import pytest

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL",
    "https://cargo-one-preview.preview.emergentagent.com",
).rstrip("/")

TINY_PNG_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgAAIAAAUAAeIVWDAAAAAASUVORK5CYII="
)

REQUIRED_DOC_TYPES = [
    "driving_licence", "insurance", "vehicle_registration",
    "vehicle_photos", "profile_photo", "proof_of_address",
]

# ----------------------------- fixtures -----------------------------


def _register(api, role, email=None):
    email = email or f"test_{role}_{uuid.uuid4().hex[:8]}@example.com"
    r = api.post(f"{BASE_URL}/api/auth/register", json={
        "email": email, "password": "Passw0rd!", "name": f"T {role}", "role": role,
    })
    assert r.status_code == 200, r.text
    return r.json(), email


def _login(api, email, password="Passw0rd!"):
    r = api.post(f"{BASE_URL}/api/auth/login",
                 json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="module")
def admin_token():
    import requests
    s = requests.Session(); s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": "admin@cargoone.com", "password": "admin123"})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def driver_ctx(api_shared):
    data, email = _register(api_shared, "driver")
    return {"token": data["access_token"], "user": data["user"], "email": email}


@pytest.fixture(scope="module")
def customer_ctx(api_shared):
    data, email = _register(api_shared, "customer")
    return {"token": data["access_token"], "user": data["user"], "email": email}


@pytest.fixture(scope="module")
def api_shared():
    import requests
    s = requests.Session(); s.headers.update({"Content-Type": "application/json"})
    return s


def h(token):
    return {"Authorization": f"Bearer {token}"}


# ----------------------------- documents CRUD -----------------------------


class TestDocumentUpload:
    def test_upload_all_six_doc_types(self, api_shared, driver_ctx):
        for t in REQUIRED_DOC_TYPES:
            r = api_shared.post(
                f"{BASE_URL}/api/users/me/documents",
                json={"doc_type": t, "base64": TINY_PNG_B64,
                      "expiry_date": "2030-01-01"},
                headers=h(driver_ctx["token"]),
            )
            assert r.status_code == 200, (t, r.text)
            body = r.json()
            assert body["doc_type"] == t
            assert body["status"] == "pending"
            assert body["active"] is True
            assert "base64" not in body  # stripped

    def test_invalid_doc_type_400(self, api_shared, driver_ctx):
        r = api_shared.post(
            f"{BASE_URL}/api/users/me/documents",
            json={"doc_type": "passport", "base64": TINY_PNG_B64},
            headers=h(driver_ctx["token"]),
        )
        assert r.status_code == 400

    def test_profile_photo_sets_user_profile_photo(self, api_shared, driver_ctx):
        # re-upload profile_photo (this also tests re-upload deactivation)
        r = api_shared.post(
            f"{BASE_URL}/api/users/me/documents",
            json={"doc_type": "profile_photo", "base64": TINY_PNG_B64},
            headers=h(driver_ctx["token"]),
        )
        assert r.status_code == 200
        me = api_shared.get(f"{BASE_URL}/api/auth/me",
                            headers=h(driver_ctx["token"]))
        assert me.status_code == 200
        assert me.json().get("profile_photo") == TINY_PNG_B64

    def test_reupload_deactivates_previous(self, api_shared, driver_ctx):
        # Upload driving_licence twice, then confirm only one active
        api_shared.post(f"{BASE_URL}/api/users/me/documents",
                        json={"doc_type": "driving_licence", "base64": TINY_PNG_B64},
                        headers=h(driver_ctx["token"]))
        api_shared.post(f"{BASE_URL}/api/users/me/documents",
                        json={"doc_type": "driving_licence", "base64": TINY_PNG_B64},
                        headers=h(driver_ctx["token"]))
        r = api_shared.get(f"{BASE_URL}/api/users/me/documents",
                           headers=h(driver_ctx["token"]))
        assert r.status_code == 200
        docs = r.json()["documents"]
        licences = [d for d in docs if d["doc_type"] == "driving_licence"]
        assert len(licences) == 1

    def test_list_documents_shape(self, api_shared, driver_ctx):
        r = api_shared.get(f"{BASE_URL}/api/users/me/documents",
                           headers=h(driver_ctx["token"]))
        assert r.status_code == 200
        body = r.json()
        assert set(body["required"]) == set(REQUIRED_DOC_TYPES)
        for d in body["documents"]:
            assert "base64" not in d

    def test_get_document_by_id_includes_base64(self, api_shared, driver_ctx):
        listing = api_shared.get(f"{BASE_URL}/api/users/me/documents",
                                 headers=h(driver_ctx["token"])).json()
        doc_id = listing["documents"][0]["id"]
        r = api_shared.get(f"{BASE_URL}/api/users/me/documents/{doc_id}",
                           headers=h(driver_ctx["token"]))
        assert r.status_code == 200
        assert r.json().get("base64") == TINY_PNG_B64


# ----------------------------- admin review flow -----------------------------


class TestAdminDocReview:
    def test_admin_list_user_docs(self, api_shared, admin_token, driver_ctx):
        r = api_shared.get(
            f"{BASE_URL}/api/admin/documents/{driver_ctx['user']['id']}",
            headers=h(admin_token),
        )
        assert r.status_code == 200
        assert isinstance(r.json(), list) and len(r.json()) >= 6

    def test_admin_list_forbidden_for_driver(self, api_shared, driver_ctx):
        r = api_shared.get(
            f"{BASE_URL}/api/admin/documents/{driver_ctx['user']['id']}",
            headers=h(driver_ctx["token"]),
        )
        assert r.status_code == 403

    def test_reject_doc_stores_reason_and_notifies(self, api_shared, admin_token, driver_ctx):
        docs = api_shared.get(
            f"{BASE_URL}/api/admin/documents/{driver_ctx['user']['id']}",
            headers=h(admin_token),
        ).json()
        insurance = next(d for d in docs if d["doc_type"] == "insurance")
        r = api_shared.post(
            f"{BASE_URL}/api/admin/documents/{insurance['id']}/review",
            json={"action": "reject", "reason": "Blurry image"},
            headers=h(admin_token),
        )
        assert r.status_code == 200
        assert r.json()["status"] == "rejected"
        # Re-upload insurance so we can then approve for full-flow test
        api_shared.post(f"{BASE_URL}/api/users/me/documents",
                        json={"doc_type": "insurance", "base64": TINY_PNG_B64},
                        headers=h(driver_ctx["token"]))
        # notification
        notes = api_shared.get(f"{BASE_URL}/api/notifications",
                               headers=h(driver_ctx["token"])).json()
        assert any(n["title"] == "Document rejected" for n in notes)

    def test_approve_all_activates_driver(self, api_shared, admin_token, driver_ctx):
        docs = api_shared.get(
            f"{BASE_URL}/api/admin/documents/{driver_ctx['user']['id']}",
            headers=h(admin_token),
        ).json()
        # Approve one doc of each required type (should be exactly one active per type)
        approved_types = set()
        for d in docs:
            if d["doc_type"] in approved_types:
                continue
            r = api_shared.post(
                f"{BASE_URL}/api/admin/documents/{d['id']}/review",
                json={"action": "approve"},
                headers=h(admin_token),
            )
            assert r.status_code == 200
            approved_types.add(d["doc_type"])
        assert approved_types == set(REQUIRED_DOC_TYPES)
        me = api_shared.get(f"{BASE_URL}/api/auth/me",
                            headers=h(driver_ctx["token"])).json()
        assert me.get("documents_verified") is True, me
        assert me.get("status") == "active", me


# ----------------------------- verified_driver flag -----------------------------


class TestVerifiedDriverFlag:
    """verified_driver=True iff role=driver AND documents_verified AND status=active AND total_jobs>=1."""

    def test_before_first_job_false(self, api_shared, driver_ctx):
        # After doc approval, driver is verified+active but total_jobs=0 => False
        prof = api_shared.get(
            f"{BASE_URL}/api/users/{driver_ctx['user']['id']}/profile",
            headers=h(driver_ctx["token"]),
        )
        assert prof.status_code == 200
        assert prof.json().get("verified_driver") is False

    def test_after_completed_booking_true(self, api_shared, admin_token,
                                          driver_ctx, customer_ctx):
        # Create job, driver accept, booking, force-mark paid via direct
        # payment endpoint isn't possible, so we manipulate via admin path is
        # not available. Instead: simulate flow by using customer + admin approve
        # + directly hitting endpoints. For this suite we complete via bookings
        # /complete which increments total_jobs.
        job_payload = {
            "title": "TEST_verified job", "category": "parcels",
            "description": "test", "photos": [],
            "pickup_address": "1 A St", "pickup_town": "London",
            "pickup_lat": 51.5, "pickup_lng": -0.12,
            "dropoff_address": "2 B St", "dropoff_town": "Reading",
            "dropoff_lat": 51.45, "dropoff_lng": -0.97,
            "collection_date": "2030-01-01", "delivery_date": "2030-01-02",
            "pricing_type": "fixed", "fixed_price": 80.0,
        }
        job = api_shared.post(f"{BASE_URL}/api/jobs", json=job_payload,
                              headers=h(customer_ctx["token"]))
        assert job.status_code == 200, job.text
        job_id = job.json()["id"]
        acc = api_shared.post(f"{BASE_URL}/api/jobs/{job_id}/accept",
                              headers=h(driver_ctx["token"]))
        assert acc.status_code == 200, acc.text
        bk = api_shared.post(f"{BASE_URL}/api/bookings",
                             json={"job_id": job_id},
                             headers=h(customer_ctx["token"]))
        assert bk.status_code == 200, bk.text
        booking_id = bk.json()["id"]
        # Directly complete booking (customer route) — allowed regardless of status
        comp = api_shared.post(f"{BASE_URL}/api/bookings/{booking_id}/complete",
                               headers=h(customer_ctx["token"]))
        assert comp.status_code == 200, comp.text
        # Now check profile
        prof = api_shared.get(
            f"{BASE_URL}/api/users/{driver_ctx['user']['id']}/profile",
            headers=h(driver_ctx["token"]),
        ).json()
        assert prof.get("total_jobs", 0) >= 1
        assert prof.get("verified_driver") is True, prof
        # Store booking_id for later tests
        pytest.booking_id = booking_id
        pytest.job_id = job_id

    def test_non_driver_never_verified(self, api_shared, customer_ctx):
        prof = api_shared.get(
            f"{BASE_URL}/api/users/{customer_ctx['user']['id']}/profile",
            headers=h(customer_ctx["token"]),
        ).json()
        assert prof.get("verified_driver") is False

    def test_pending_driver_not_verified(self, api_shared):
        # New driver — status pending, docs_verified False
        data, _ = _register(api_shared, "driver")
        prof = api_shared.get(
            f"{BASE_URL}/api/users/{data['user']['id']}/profile",
            headers=h(data["access_token"]),
        ).json()
        assert prof.get("verified_driver") is False


# ----------------------------- public profile -----------------------------


class TestPublicProfile:
    def test_public_profile_fields(self, api_shared, customer_ctx, driver_ctx):
        r = api_shared.get(
            f"{BASE_URL}/api/users/{driver_ctx['user']['id']}/profile",
            headers=h(customer_ctx["token"]),
        )
        assert r.status_code == 200
        body = r.json()
        for k in ("id", "name", "role", "rating", "completed_bookings",
                  "reviews", "verified_driver"):
            assert k in body, (k, body)
        assert isinstance(body["reviews"], list)
        assert len(body["reviews"]) <= 10


# ----------------------------- POD with photos + signature -----------------------------


class TestPODAndReview:
    def test_pod_stores_photos_and_signature(self, api_shared, admin_token,
                                              driver_ctx, customer_ctx):
        # New end-to-end mini flow
        job = api_shared.post(f"{BASE_URL}/api/jobs", json={
            "title": "TEST_pod job", "category": "parcels", "description": "x",
            "photos": [], "pickup_address": "P", "pickup_town": "London",
            "pickup_lat": 51.5, "pickup_lng": -0.12,
            "dropoff_address": "D", "dropoff_town": "Reading",
            "dropoff_lat": 51.45, "dropoff_lng": -0.97,
            "collection_date": "2030-01-01", "delivery_date": "2030-01-02",
            "pricing_type": "fixed", "fixed_price": 60,
        }, headers=h(customer_ctx["token"])).json()
        api_shared.post(f"{BASE_URL}/api/jobs/{job['id']}/accept",
                        headers=h(driver_ctx["token"]))
        bk = api_shared.post(f"{BASE_URL}/api/bookings",
                             json={"job_id": job["id"]},
                             headers=h(customer_ctx["token"])).json()
        pod = api_shared.post(
            f"{BASE_URL}/api/bookings/{bk['id']}/pod",
            json={"photos": [TINY_PNG_B64, TINY_PNG_B64],
                  "signature": TINY_PNG_B64, "notes": "left at door",
                  "lat": 51.4, "lng": -0.9},
            headers=h(driver_ctx["token"]),
        )
        assert pod.status_code == 200, pod.text
        got = api_shared.get(f"{BASE_URL}/api/bookings/{bk['id']}/pod",
                             headers=h(driver_ctx["token"])).json()
        assert len(got.get("photos", [])) == 2
        assert got.get("signature") == TINY_PNG_B64

        # Complete + review with photos
        api_shared.post(f"{BASE_URL}/api/bookings/{bk['id']}/complete",
                        headers=h(customer_ctx["token"]))
        rev = api_shared.post(
            f"{BASE_URL}/api/bookings/{bk['id']}/review",
            json={"rating": 5, "comment": "great",
                  "photos": [TINY_PNG_B64]},
            headers=h(customer_ctx["token"]),
        )
        assert rev.status_code == 200, rev.text
        body = rev.json()
        assert body["verified_delivery"] is True
        assert body["photos"] == [TINY_PNG_B64]


# ----------------------------- Bid list verified_driver -----------------------------


class TestBidVerifiedFlag:
    def test_bid_list_includes_verified_flag(self, api_shared, driver_ctx, customer_ctx):
        # Create bidding job, driver bids, list bids
        job = api_shared.post(f"{BASE_URL}/api/jobs", json={
            "title": "TEST_bid job", "category": "parcels", "description": "x",
            "photos": [], "pickup_address": "P", "pickup_town": "London",
            "pickup_lat": 51.5, "pickup_lng": -0.12,
            "dropoff_address": "D", "dropoff_town": "Reading",
            "dropoff_lat": 51.45, "dropoff_lng": -0.97,
            "collection_date": "2030-01-01", "delivery_date": "2030-01-02",
            "pricing_type": "bidding", "max_budget": 100,
        }, headers=h(customer_ctx["token"])).json()
        bid = api_shared.post(f"{BASE_URL}/api/jobs/{job['id']}/bids",
                              json={"amount": 55, "message": "will do"},
                              headers=h(driver_ctx["token"]))
        assert bid.status_code == 200, bid.text
        bids = api_shared.get(f"{BASE_URL}/api/jobs/{job['id']}/bids",
                              headers=h(customer_ctx["token"])).json()
        assert len(bids) >= 1
        assert "verified_driver" in bids[0]
        # driver has completed a job by now, so should be True
        assert bids[0]["verified_driver"] is True, bids[0]


# ----------------------------- No regression -----------------------------


class TestNoRegression:
    def test_login(self, api_shared):
        r = api_shared.post(f"{BASE_URL}/api/auth/login",
                            json={"email": "admin@cargoone.com",
                                  "password": "admin123"})
        assert r.status_code == 200

    def test_booking_fees_preview(self, api_shared, admin_token):
        r = api_shared.get(f"{BASE_URL}/api/booking-fees/preview?driver_charge=200",
                           headers=h(admin_token))
        assert r.status_code == 200
        body = r.json()
        assert "booking_fee" in body and "customer_total" in body

    def test_quote_estimate(self, api_shared, admin_token):
        r = api_shared.get(
            f"{BASE_URL}/api/quote/estimate?pickup_lat=51.5&pickup_lng=-0.1"
            f"&dropoff_lat=51.45&dropoff_lng=-0.97&category=parcels",
            headers=h(admin_token),
        )
        assert r.status_code == 200
        assert "suggested_price" in r.json()

    def test_admin_deposit_bands(self, api_shared, admin_token):
        r = api_shared.get(f"{BASE_URL}/api/admin/deposit-bands",
                           headers=h(admin_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)
