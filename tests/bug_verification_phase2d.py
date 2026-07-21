import json
import re
import time
import urllib.request
import urllib.error
from pathlib import Path

from playwright.sync_api import sync_playwright, expect

BASE_URL = "https://cargo-repo-bridge.preview.emergentagent.com"
API = f"{BASE_URL}/api"
ADMIN_EMAIL = "admin@cargoone.com"
ADMIN_PASSWORD = "Vc9O0sNDGR6SfzKDaa0L1lhp"
CUSTOMER_EMAIL = "testcustomer@example.com"
CUSTOMER_PASSWORD = "CustomerTest12345!"
DRIVER_EMAIL = "testdriver@example.com"
DRIVER_PASSWORD = "DriverTest12345!"
DISPOSABLE_EMAIL = f"e2e2d-delete-{int(time.time())}@example.com"
DISPOSABLE_PASSWORD = "E2E2dTest12345!"
OUT = Path("/app/test_reports/bug_verification_phase2d_runtime.json")

results = []
network_events = []


def record(name, status, detail=""):
    print(f"[{status}] {name}: {detail}")
    results.append({"name": name, "status": status, "detail": detail})


def api_json(path, method="GET", data=None, cookie_header=None):
    body = json.dumps(data).encode() if data is not None else None
    headers = {"Accept": "application/json"}
    if data is not None:
        headers["Content-Type"] = "application/json"
    if cookie_header:
        headers["Cookie"] = cookie_header
    req = urllib.request.Request(f"{API}{path}", data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            text = resp.read().decode()
            cookies = resp.headers.get_all("Set-Cookie") or []
            return resp.status, json.loads(text) if text else None, cookies
    except urllib.error.HTTPError as e:
        text = e.read().decode()
        try:
            payload = json.loads(text) if text else None
        except Exception:
            payload = text
        return e.code, payload, e.headers.get_all("Set-Cookie") or []


def cookie_header_from_set_cookie(cookies):
    pieces = []
    for c in cookies:
        first = c.split(";", 1)[0]
        if "=" in first:
            pieces.append(first)
    return "; ".join(pieces)


def attach_network(page):
    def on_response(resp):
        if "/api/" in resp.url and ("/auth/me/delete" in resp.url or "/users/" in resp.url and "/profile" in resp.url):
            network_events.append({"url": resp.url, "status": resp.status, "method": resp.request.method})
    page.on("response", on_response)


def login_ui(page, email, password, expected_testid):
    page.goto(f"{BASE_URL}/auth/login", wait_until="domcontentloaded")
    expect(page.get_by_test_id("login-screen")).to_be_visible(timeout=10000)
    page.get_by_test_id("login-email-input").fill(email)
    page.get_by_test_id("login-password-input").fill(password)
    page.get_by_test_id("login-submit-button").click()
    expect(page.get_by_test_id(expected_testid)).to_be_visible(timeout=20000)


def logout_api_context(context):
    try:
        context.request.post(f"{API}/auth/logout")
    except Exception:
        pass
    context.clear_cookies()


def no_error_messages(page):
    error_text = page.evaluate("""() => {
        const errorElements = Array.from(document.querySelectorAll('.error, [class*="error"], [id*="error"]'));
        return errorElements.map(el => el.textContent).join(", ");
    }""")
    if error_text:
        print(f"Found error message: {error_text}")
    else:
        print("No error messages found on the page")


def run():
    # API setup/proof: get valid driver id and register disposable account.
    st, driver_login, driver_cookies = api_json("/auth/login", "POST", {"email": DRIVER_EMAIL, "password": DRIVER_PASSWORD})
    assert st == 200, f"driver api login failed {st}: {driver_login}"
    driver_id = driver_login["user"]["id"]
    record("API setup - valid driver id", "PASS", driver_id)

    st, reg_payload, reg_cookies = api_json("/auth/register", "POST", {
        "email": DISPOSABLE_EMAIL,
        "password": DISPOSABLE_PASSWORD,
        "name": "E2E Delete User",
        "phone": "+447700999999",
        "role": "customer",
    })
    assert st == 200, f"disposable register failed {st}: {reg_payload}"
    reg_cookie_header = cookie_header_from_set_cookie(reg_cookies)
    st_me, me_payload, _ = api_json("/auth/me", "GET", cookie_header=reg_cookie_header)
    assert st_me == 200 and me_payload["email"] == DISPOSABLE_EMAIL
    record("API setup - disposable account registered and session valid", "PASS", DISPOSABLE_EMAIL)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        # Fix 1: settings hub from customer profile, all core slugs.
        context = browser.new_context(base_url=BASE_URL, viewport={"width": 1920, "height": 1080})
        page = context.new_page()
        attach_network(page)
        login_ui(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD, "customer-dashboard")
        page.goto(f"{BASE_URL}/customer/profile", wait_until="domcontentloaded")
        expect(page.get_by_test_id("customer-profile")).to_be_visible(timeout=10000)
        page.get_by_test_id("profile-settings").click()
        expect(page).to_have_url(re.compile(r"/settings$"), timeout=10000)
        expect(page.get_by_test_id("settings-home")).to_be_visible()
        for section in ["Legal", "Support", "Account"]:
            expect(page.get_by_text(section, exact=True)).to_be_visible()
        for slug, heading in [("terms", "Terms & Conditions"), ("privacy", "Privacy Policy"), ("cookies", "Cookie Policy"), ("about", "About Cargo One")]:
            page.get_by_test_id(f"settings-{slug}").click()
            expect(page).to_have_url(re.compile(fr"/settings/{slug}$"), timeout=10000)
            expect(page.get_by_test_id(f"settings-{slug}-page")).to_be_visible()
            expect(page.get_by_role("heading", name=heading)).to_be_visible()
            # body text exists below heading
            assert len(page.get_by_test_id(f"settings-{slug}-page").inner_text()) > len(heading) + 20
            page.get_by_test_id("settings-back").click()
            expect(page).to_have_url(re.compile(r"/settings$"), timeout=10000)
            expect(page.get_by_test_id("settings-home")).to_be_visible()
        page.get_by_test_id("settings-support").click()
        expect(page.get_by_test_id("settings-support-page")).to_be_visible()
        for tid in ["support-email", "support-report", "support-faq"]:
            expect(page.get_by_test_id(tid)).to_be_visible()
        no_error_messages(page)
        record("Fix 1 - customer settings hub and slugs", "PASS", page.url)
        logout_api_context(context)
        context.close()

        # Fix 2: UI delete account on disposable account.
        context = browser.new_context(base_url=BASE_URL, viewport={"width": 1920, "height": 1080})
        page = context.new_page()
        attach_network(page)
        login_ui(page, DISPOSABLE_EMAIL, DISPOSABLE_PASSWORD, "customer-dashboard")
        page.goto(f"{BASE_URL}/customer/profile", wait_until="domcontentloaded")
        expect(page.get_by_test_id("customer-profile")).to_be_visible(timeout=10000)
        page.get_by_test_id("profile-settings").click()
        expect(page.get_by_test_id("settings-home")).to_be_visible(timeout=10000)
        expect(page.get_by_test_id("settings-delete")).to_be_visible()
        page.get_by_test_id("settings-delete").click()
        expect(page).to_have_url(re.compile(r"/settings/delete-account$"), timeout=10000)
        expect(page.get_by_test_id("settings-delete-account")).to_be_visible()
        expect(page.get_by_text("Deleting your account cannot be undone", exact=False)).to_be_visible()
        page.get_by_test_id("delete-account-start").click()
        expect(page.get_by_test_id("delete-account-confirm-box")).to_be_visible()
        page.get_by_test_id("delete-account-cancel").click()
        expect(page.get_by_test_id("delete-account-confirm-box")).not_to_be_visible(timeout=5000)
        page.get_by_test_id("delete-account-start").click()
        expect(page.get_by_test_id("delete-account-confirm-box")).to_be_visible()
        with page.expect_response(lambda r: "/api/auth/me/delete" in r.url and r.request.method == "POST", timeout=20000) as resp_info:
            page.get_by_test_id("confirm-delete-account").click()
        delete_resp = resp_info.value
        assert delete_resp.status == 200, f"delete POST status {delete_resp.status}"
        expect(page).to_have_url(re.compile(r"/auth/welcome$"), timeout=15000)
        context.clear_cookies()
        page.goto(f"{BASE_URL}/auth/login", wait_until="domcontentloaded")
        page.get_by_test_id("login-email-input").fill(DISPOSABLE_EMAIL)
        page.get_by_test_id("login-password-input").fill(DISPOSABLE_PASSWORD)
        with page.expect_response(lambda r: "/api/auth/login" in r.url and r.request.method == "POST", timeout=20000) as login_resp_info:
            page.get_by_test_id("login-submit-button").click()
        login_resp = login_resp_info.value
        assert login_resp.status in (400, 401, 403), f"deleted login unexpectedly status {login_resp.status}"
        expect(page.get_by_test_id("login-error")).to_be_visible(timeout=10000)
        record("Fix 2 - delete account UI end-to-end", "PASS", f"delete POST 200; relogin status {login_resp.status}")
        context.close()

        # Fix 3: public driver profile unauthenticated.
        context = browser.new_context(base_url=BASE_URL, viewport={"width": 1920, "height": 1080})
        page = context.new_page()
        attach_network(page)
        page.goto(f"{BASE_URL}/driver-profile/{driver_id}", wait_until="domcontentloaded")
        expect(page.get_by_test_id("driver-profile-public")).to_be_visible(timeout=15000)
        expect(page).to_have_url(re.compile(fr"/driver-profile/{driver_id}$"), timeout=10000)
        expect(page.get_by_test_id("dpp-header")).to_be_visible(timeout=10000)
        header_text = page.get_by_test_id("dpp-header").inner_text()
        assert "Test Driver" in header_text and "5.0" in header_text and "transport partner" in header_text.lower(), header_text
        expect(page.get_by_test_id("dpp-stats")).to_be_visible()
        assert "/auth/login" not in page.url and "/auth/welcome" not in page.url
        record("Fix 3 - public driver profile unauthenticated", "PASS", page.url)
        context.close()

        # Regression: dashboards and cross-role redirect.
        context = browser.new_context(base_url=BASE_URL, viewport={"width": 1920, "height": 1080})
        page = context.new_page()
        login_ui(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD, "customer-dashboard")
        page.goto(f"{BASE_URL}/driver", wait_until="domcontentloaded")
        expect(page).to_have_url(re.compile(r"/customer$"), timeout=10000)
        expect(page.get_by_test_id("customer-dashboard")).to_be_visible()
        record("Regression - customer dashboard and cross-role redirect", "PASS", page.url)
        logout_api_context(context)
        context.close()

        context = browser.new_context(base_url=BASE_URL, viewport={"width": 1920, "height": 1080})
        page = context.new_page()
        login_ui(page, DRIVER_EMAIL, DRIVER_PASSWORD, "driver-home")
        page.goto(f"{BASE_URL}/driver/profile", wait_until="domcontentloaded")
        expect(page.get_by_test_id("driver-profile")).to_be_visible(timeout=10000)
        page.get_by_test_id("open-settings").click()
        expect(page).to_have_url(re.compile(r"/settings$"), timeout=10000)
        expect(page.get_by_test_id("settings-home")).to_be_visible()
        record("Regression - driver dashboard/profile settings route", "PASS", page.url)
        logout_api_context(context)
        context.close()

        context = browser.new_context(base_url=BASE_URL, viewport={"width": 1920, "height": 1080})
        page = context.new_page()
        login_ui(page, ADMIN_EMAIL, ADMIN_PASSWORD, "admin-dashboard")
        page.goto(f"{BASE_URL}/admin/profile", wait_until="domcontentloaded")
        expect(page.get_by_test_id("admin-profile")).to_be_visible(timeout=10000)
        page.get_by_test_id("admin-profile-terms").click()
        expect(page).to_have_url(re.compile(r"/settings/terms$"), timeout=10000)
        expect(page.get_by_test_id("settings-terms-page")).to_be_visible()
        page.goto(f"{BASE_URL}/admin/profile", wait_until="domcontentloaded")
        page.get_by_test_id("admin-profile-help").click()
        expect(page).to_have_url(re.compile(r"/settings/support$"), timeout=10000)
        expect(page.get_by_test_id("settings-support-page")).to_be_visible()
        record("Regression - admin dashboard/profile settings links", "PASS", page.url)
        logout_api_context(context)
        context.close()

        browser.close()

    OUT.write_text(json.dumps({"results": results, "network_events": network_events, "disposable_email": DISPOSABLE_EMAIL}, indent=2))


if __name__ == "__main__":
    try:
        run()
    except Exception as e:
        record("test runner", "FAIL", repr(e))
        OUT.write_text(json.dumps({"results": results, "network_events": network_events, "disposable_email": DISPOSABLE_EMAIL, "error": repr(e)}, indent=2))
        raise
