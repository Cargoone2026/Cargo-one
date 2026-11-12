# Cleanup of GA4 conversion retest accounts/jobs (iteration r78), explicit email list only
import os, asyncio
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv("/app/backend/.env")
EMAILS = [f"conv-test2-{s}@example.com" for s in [
    "1794514906-warm", "1794514979-colddrv", "1794514993-coldcust", "1794515007-colddrv2",
    "1794515046-dbg", "1794515090-ess", "1794515119-coldjob"]]


async def main():
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    users = await db.users.find({"email": {"$in": EMAILS}}, {"_id": 0, "id": 1, "email": 1, "role": 1}).to_list(100)
    ids = [u["id"] for u in users]
    print("users found:", users)
    jobs = await db.jobs.find({"customer_id": {"$in": ids}}, {"_id": 0, "id": 1, "pricing_type": 1}).to_list(100)
    job_ids = [j["id"] for j in jobs]
    print("jobs found:", jobs)
    for name in await db.list_collection_names():
        coll = db[name]
        for field in ["user_id", "customer_id", "driver_id", "owner_id"]:
            n = await coll.count_documents({field: {"$in": ids}}) if ids else 0
            if n:
                r = await coll.delete_many({field: {"$in": ids}})
                print(f"deleted {r.deleted_count} from {name} by {field}")
        n = await coll.count_documents({"job_id": {"$in": job_ids}}) if job_ids else 0
        if n:
            r = await coll.delete_many({"job_id": {"$in": job_ids}})
            print(f"deleted {r.deleted_count} from {name} by job_id")
        n = await coll.count_documents({"email": {"$in": EMAILS}})
        if n:
            r = await coll.delete_many({"email": {"$in": EMAILS}})
            print(f"deleted {r.deleted_count} from {name} by email")
    print("remaining users:", await db.users.count_documents({"email": {"$in": EMAILS}}),
          "remaining jobs:", await db.jobs.count_documents({"id": {"$in": job_ids}}))

asyncio.run(main())
