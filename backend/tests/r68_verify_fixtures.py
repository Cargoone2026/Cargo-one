"""R68 re-verification: confirm seed fixtures still exist and are in expected state."""
import json
import requests

seed = json.load(open("/app/test_reports/r68_seed.json"))
BASE = seed["base"].rstrip("/")

for name, sc in seed["scenarios"].items():
    drv = sc.get("driver")
    tok = seed["driver_tokens"].get(drv)
    h = {"Authorization": f"Bearer {tok}"} if tok else {}
    r = requests.get(f"{BASE}/api/bookings/{sc['booking_id']}", headers=h, timeout=30)
    if r.status_code == 200:
        b = r.json()
        j = b.get("job") or {}
        print(name, r.status_code, b.get("status"), b.get("payment_status"),
              "asap=", j.get("is_asap") or j.get("asap"), "pickup_lat=", j.get("pickup_lat"),
              "driver_id=", b.get("driver_id"))
    else:
        print(name, r.status_code, r.text[:200])
