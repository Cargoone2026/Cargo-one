# Read-only helper: counts users/jobs/bookings for quote-first flow tests
import os, sys
from pymongo import MongoClient
from dotenv import load_dotenv
load_dotenv("/app/backend/.env")
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
print("users", db.users.count_documents({}), "jobs", db.jobs.count_documents({}), "bookings", db.bookings.count_documents({}))
for e in sys.argv[1:]:
    u = db.users.find_one({"email": e})
    if not u:
        print(e, "NO USER"); continue
    uid = u.get("id")
    jobs = list(db.jobs.find({"customer_id": uid}, {"_id": 0, "id": 1, "title": 1, "created_at": 1, "pickup_address": 1, "dropoff_address": 1, "pricing_type": 1, "status": 1}))
    print(e, uid, "jobs:", len(jobs))
    for j in jobs[-5:]:
        print("   ", j)
