"""R69 auth playbook spot-check: bcrypt format, httpOnly cookie, CORS,
brute-force lockout, admin seed."""
import json
import uuid

import requests
from dotenv import dotenv_values
from pymongo import MongoClient

fe = dotenv_values("/app/frontend/.env")
BASE = fe["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE}/api"
be = dotenv_values("/app/backend/.env")
mdb = MongoClient(be["MONGO_URL"])[be["DB_NAME"]]
OUT = {}

admin = mdb.users.find_one({"email": "admin@cargoone.com"})
OUT["admin_hash_prefix"] = (admin or {}).get("password_hash", "")[:4]
OUT["admin_hash_is_bcrypt_2b"] = (admin or {}).get("password_hash", "").startswith("$2b$")
OUT["admin_role"] = (admin or {}).get("role")

s = requests.Session()
r = s.post(f"{API}/auth/login", json={"email": "admin@cargoone.com",
                                      "password": "Vc9O0sNDGR6SfzKDaa0L1lhp"},
           headers={"Origin": BASE}, timeout=30)
OUT["login_status"] = r.status_code
OUT["set_cookie_headers"] = [v for k, v in r.headers.items() if k.lower() == "set-cookie"]
OUT["cookie_httponly"] = any("httponly" in (v or "").lower() for v in OUT["set_cookie_headers"])
OUT["cookie_secure"] = any("secure" in (v or "").lower() for v in OUT["set_cookie_headers"])
OUT["cors_allow_credentials"] = r.headers.get("access-control-allow-credentials")
OUT["cors_allow_origin"] = r.headers.get("access-control-allow-origin")

# brute force lockout
victim = f"r69_bf_{uuid.uuid4().hex[:8]}@cargoone.com"
requests.post(f"{API}/auth/register", json={"email": victim, "password": "R69Cert!2026",
                                            "name": "BF Test", "phone": "+447700900001",
                                            "role": "customer"}, timeout=30)
codes = []
for i in range(7):
    rr = requests.post(f"{API}/auth/login", json={"email": victim, "password": "wrong-pass"},
                       timeout=30)
    codes.append(rr.status_code)
OUT["bruteforce_codes"] = codes
OUT["lockout_triggered"] = 429 in codes or 423 in codes
good = requests.post(f"{API}/auth/login", json={"email": victim, "password": "R69Cert!2026"},
                     timeout=30)
OUT["login_after_lockout_status"] = good.status_code

json.dump(OUT, open("/app/test_reports/r69_auth_playbook.json", "w"), indent=2, default=str)
print(json.dumps(OUT, indent=2, default=str))
