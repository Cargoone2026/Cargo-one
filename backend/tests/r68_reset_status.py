"""R68 re-verify helper: reset a booking status for UI transition testing."""
import os
import sys
import json
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv("/app/backend/.env")
mdb = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]

bid = sys.argv[1]
status = sys.argv[2]
res = mdb.bookings.update_one({"id": bid}, {"$set": {"status": status, "payment_status": "paid"}})
print(json.dumps({"matched": res.matched_count, "modified": res.modified_count, "status": status}))
