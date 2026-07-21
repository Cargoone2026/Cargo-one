"""Phase 2D — Cross-role E2E workflow via API (Priority 1).

Registers disposable Customer + Driver, admin approves driver, customer posts job,
driver bids, customer accepts, booking created, deposit-checkout initiated (Stripe
URL asserted only; NO real charge).
"""
import os
import time
import requests

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://cargo-repo-bridge.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@cargoone.com"
ADMIN_PASSWORD = os.environ.get("TEST_ADMIN_PASSWORD", "Vc9O0sNDGR6SfzKDaa0L1lhp")

TS = int(time.time())
CUST_EMAIL = f"e2e2d-cust-{TS}@example.com"
DRV_EMAIL = f"e2e2d-drv-{TS}@example.com"
PWD = "E2E2dTest12345!"

state = {}


def _sess():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(email, password):
    s = _sess()
    r = s.post(f"{BASE}/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    s.headers["Authorization"] = f"Bearer {r.json()['access_token']}"
    return s, r.json()


def test_a_register_customer():
    r = _sess().post(f"{BASE}/api/auth/register", json={
        "email": CUST_EMAIL, "password": PWD,
        "name": "E2E Customer", "phone": "+447000000001", "role": "customer"
    })
    assert r.status_code in (200, 201), r.text
    state["cust_id"] = r.json().get("user", {}).get("id") or r.json().get("id")


def test_b_register_driver():
    r = _sess().post(f"{BASE}/api/auth/register", json={
        "email": DRV_EMAIL, "password": PWD,
        "name": "E2E Driver", "phone": "+447000000002", "role": "driver"
    })
    assert r.status_code in (200, 201), r.text
    state["drv_id"] = r.json().get("user", {}).get("id") or r.json().get("id")


def test_c_admin_approve_driver():
    admin, _ = _login(ADMIN_EMAIL, ADMIN_PASSWORD)
    r = admin.post(f"{BASE}/api/admin/users/{state['drv_id']}/approve", json={})
    assert r.status_code == 200, r.text


def test_d_recommend_vehicle():
    cust, _ = _login(CUST_EMAIL, PWD)
    r = cust.post(f"{BASE}/api/catalog/recommend-vehicle", json={
        "category_key": "house_removals",
        "weight_kg": 200,
        "volume_m3": 1.8,
        "item_count": 10,
    })
    assert r.status_code == 200, r.text


def test_e_customer_post_job():
    cust, _ = _login(CUST_EMAIL, PWD)
    payload = {
        "title": "E2E Test Shipment",
        "category": "house_removals",
        "description": "Phase 2D E2E test",
        "pickup_address": "1 London Rd, London, SW1A 1AA",
        "pickup_town": "London",
        "pickup_lat": 51.5074, "pickup_lng": -0.1278,
        "pickup_postcode": "SW1A 1AA", "pickup_country_code": "GB",
        "dropoff_address": "1 Manchester Rd, Manchester, M1 1AE",
        "dropoff_town": "Manchester",
        "dropoff_lat": 53.4808, "dropoff_lng": -2.2426,
        "dropoff_postcode": "M1 1AE", "dropoff_country_code": "GB",
        "weight_kg": 200,
        "dimensions": "150x100x120 cm",
        "collection_date": "2026-12-15",
        "delivery_date": "2026-12-16",
        "pricing_type": "bidding",
        "max_budget": 250.0,
        "vehicle_required": "van_luton",
    }
    r = cust.post(f"{BASE}/api/jobs", json=payload)
    assert r.status_code in (200, 201), r.text
    state["job_id"] = r.json()["id"]


def test_f_driver_bid():
    drv, _ = _login(DRV_EMAIL, PWD)
    r = drv.post(f"{BASE}/api/jobs/{state['job_id']}/bids", json={"amount": 180.0, "message": "Available"})
    assert r.status_code in (200, 201), r.text
    state["bid_id"] = r.json()["id"]


def test_g_customer_accepts_bid():
    cust, _ = _login(CUST_EMAIL, PWD)
    r = cust.post(f"{BASE}/api/bids/{state['bid_id']}/accept", json={})
    assert r.status_code == 200, r.text


def test_h_create_booking():
    cust, _ = _login(CUST_EMAIL, PWD)
    r = cust.post(f"{BASE}/api/bookings", json={"job_id": state["job_id"]})
    assert r.status_code in (200, 201), r.text
    b = r.json()
    state["booking_id"] = b["id"]
    # data consistency
    assert b["customer_id"] == state["cust_id"], f"cust mismatch: {b['customer_id']}"
    assert b["driver_id"] == state["drv_id"], f"drv mismatch: {b['driver_id']}"
    assert b["job_id"] == state["job_id"]
    assert abs(b["driver_charge"] + b["booking_fee"] - b["total_price"]) < 0.01


def test_i_deposit_checkout_stripe_url():
    cust, _ = _login(CUST_EMAIL, PWD)
    r = cust.post(f"{BASE}/api/bookings/{state['booking_id']}/deposit",
                  json={"origin_url": BASE})
    assert r.status_code == 200, r.text
    url = r.json().get("url", "")
    assert "stripe.com" in url, f"expected stripe.com url, got {url}"
    state["stripe_url"] = url


def test_j_admin_sees_booking():
    admin, _ = _login(ADMIN_EMAIL, ADMIN_PASSWORD)
    r = admin.get(f"{BASE}/api/admin/bookings")
    assert r.status_code == 200, r.text
    body = r.json()
    items = body if isinstance(body, list) else body.get("items", body.get("bookings", []))
    ids = [b.get("id") for b in items]
    assert state["booking_id"] in ids, f"booking {state['booking_id']} not in admin list of {len(ids)}"


def test_k_admin_sees_job():
    admin, _ = _login(ADMIN_EMAIL, ADMIN_PASSWORD)
    r = admin.get(f"{BASE}/api/admin/jobs")
    assert r.status_code == 200
    items = r.json() if isinstance(r.json(), list) else r.json().get("items", r.json().get("jobs", []))
    ids = [j.get("id") for j in items]
    assert state["job_id"] in ids


def test_l_customer_sees_own_booking():
    cust, _ = _login(CUST_EMAIL, PWD)
    r = cust.get(f"{BASE}/api/bookings/mine")
    assert r.status_code == 200
    items = r.json() if isinstance(r.json(), list) else r.json().get("items", [])
    assert any(b.get("id") == state["booking_id"] for b in items)


def test_m_messages_blocked_before_payment():
    cust, _ = _login(CUST_EMAIL, PWD)
    r = cust.post(f"{BASE}/api/bookings/{state['booking_id']}/messages", json={"text": "hello"})
    assert r.status_code in (400, 403), f"expected 403 before payment, got {r.status_code}: {r.text}"


def test_z_print_ids():
    print("\n=== Phase 2D E2E IDs ===")
    for k, v in state.items():
        print(f"  {k}: {v}")
