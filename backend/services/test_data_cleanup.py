"""TEMPORARY pre-launch test-data cleanup (admin-only). Dry run reports; execute MOVES data to archive_* collections.

Remove this module and its routes after the real run.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

KEEP_EMAILS = {e.lower() for e in [
    "admin@cargoone.com",
    # customers
    "abdulbasit2016diesel@gmail.com", "ozamil@hotmail.com", "pabtechltd@gmail.com",
    # drivers
    "dpdgroupprivate@gmail.com", "onenetworkuk@gmail.com", "hbcostello@outlook.com", "thomasdorney095@gmail.com",
    "zubairisraa@gmail.com", "robertionutscurtu13@gmail.com", "rajadanishali766@gmail.com", "rajahamzar60@gmail.com",
    "simonheginbotham@gmail.com", "greghenderson1@me.com", "vbanu4469@gmail.com", "khalilhamidi83@yahoo.com",
    "mohamed786rassam@gmail.com", "giovannigrine@gmail.com", "danielnico1983@gmail.com", "robertpopescu1405@gmail.com",
    "codyh4234@gmail.com", "shehzad_14@hotmail.co.uk", "damqnovdamqn38@gmail.com", "el_parisso@wp.pl",
    "salik474@gmail.com", "salomon.uthayakumar@gmail.com", "g.hartry74@yahoo.com", "sandykunwar832@gmail.com",
    "md.yahya04@outlook.com", "prsuk7@gmail.com", "mironsergiu16@gmail.com", "patelumang445@gmail.com",
]}
NEW_SINCE = "2026-10-19"  # users created on/after this are always kept and flagged

# Moved wholesale (everyone starts fresh), including kept users' rows.
ARCHIVE_ALL = [
    "jobs", "bookings", "bids", "messages", "conversation_email_state", "conversation_presence", "reviews",
    "notifications", "tracking", "pods", "payment_transactions", "dispatch_log", "driver_cancellations",
    "admin_booking_actions", "admin_handover_log", "email_log", "sms_log", "asap_quote_audit",
]
# Moved only for archived users: (collection, user field).
ARCHIVE_PER_USER = [
    ("documents", "user_id"), ("driver_vehicles", "driver_id"),
    ("webauthn_credentials", "user_id"), ("password_reset_tokens", "user_id"),
]
UNTOUCHED = [
    "booking_fee_bands", "deposit_bands", "platform_config", "service_categories", "vehicle_types",
    "vehicle_capabilities", "contact_messages", "newsletter_subscribers", "admin_oneoff_runs", "webauthn_challenges",
]
CONFIRM_PHRASE = "ARCHIVE TEST DATA"
KEPT_USER_RESET = {
    "rating": 5.0, "review_count": 0, "total_jobs": 0,
    "post_accept_cancel_count": 0, "post_accept_cancel_history": [],
}


def _row(u: dict) -> dict:
    return {"id": u.get("id"), "name": u.get("name"), "email": u.get("email"), "role": u.get("role"),
            "created_at": u.get("created_at"), "deleted_at": u.get("deleted_at")}


async def _split_users(db) -> dict:
    users = await db.users.find({}, {"_id": 0, "id": 1, "name": 1, "email": 1, "role": 1, "created_at": 1,
                                     "deleted_at": 1}).to_list(None)
    kept, new_since, archive = [], [], []
    for u in users:
        email = (u.get("email") or "").strip().lower()
        if u.get("role") == "admin" or email in KEEP_EMAILS:
            kept.append(_row(u))
        elif str(u.get("created_at") or "") >= NEW_SINCE:
            new_since.append(_row(u))
        else:
            archive.append(_row(u))
    found = {(r["email"] or "").lower() for r in kept}
    sort = lambda rows: sorted(rows, key=lambda r: ((r["role"] or ""), (r["email"] or "")))
    return {"kept": sort(kept), "new_since": sort(new_since), "archive": sort(archive),
            "missing_keep_emails": sorted(KEEP_EMAILS - found)}


async def dry_run(db) -> dict:
    split = await _split_users(db)
    archive_ids = [u["id"] for u in split["archive"]]
    counts = {"users": len(archive_ids)}
    for c in ARCHIVE_ALL:
        counts[c] = await db[c].count_documents({})
    for c, field in ARCHIVE_PER_USER:
        counts[c] = await db[c].count_documents({field: {"$in": archive_ids}})
    kept_ids = [u["id"] for u in split["kept"] + split["new_since"]]
    return {
        "mode": "dry_run",
        "kept_count": len(split["kept"]), "kept": split["kept"],
        "missing_keep_emails": split["missing_keep_emails"],
        "new_since_cutoff": NEW_SINCE, "new_since_count": len(split["new_since"]), "new_since": split["new_since"],
        "archive_count": len(split["archive"]), "archive": split["archive"],
        "collections_to_archive": counts,
        "kept_user_resets": KEPT_USER_RESET, "kept_users_reset_count": len(kept_ids),
        "untouched_collections": UNTOUCHED,
        "execute_will": [
            "Move every user not kept (and not new since the cutoff) into archive_users, with their documents, "
            "vehicles, passkeys and reset tokens (push tokens live on the user record and move with it).",
            f"Move ALL rows of {', '.join(ARCHIVE_ALL)} into archive_<name> (support issues live on bookings).",
            "Kept users: account, password, profile, photo, vehicle, documents, approval status and push tokens unchanged; "
            "rating reset to 5.0, review_count/total_jobs/cancel stats reset to 0.",
            "Platform settings and the untouched collections listed are left as they are. Stripe is never called.",
            "Each moved row gets archived_at + archive_run_id; originals are deleted only after the copy succeeds.",
        ],
    }


async def _move(db, coll: str, query: dict, run_id: str, now: str) -> int:
    moved = 0
    while True:
        batch = await db[coll].find(query).limit(500).to_list(500)
        if not batch:
            return moved
        for d in batch:
            d["archived_at"] = now
            d["archive_run_id"] = run_id
        await db[f"archive_{coll}"].insert_many(batch, ordered=False)
        await db[coll].delete_many({"_id": {"$in": [d["_id"] for d in batch]}})
        moved += len(batch)


async def execute(db, admin: dict) -> dict:
    split = await _split_users(db)
    archive_ids = [u["id"] for u in split["archive"]]
    kept_ids = [u["id"] for u in split["kept"] + split["new_since"]]
    run_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    moved = {}
    for c, field in ARCHIVE_PER_USER:
        moved[c] = await _move(db, c, {field: {"$in": archive_ids}}, run_id, now)
    for c in ARCHIVE_ALL:
        moved[c] = await _move(db, c, {}, run_id, now)
    moved["users"] = await _move(db, "users", {"id": {"$in": archive_ids}}, run_id, now)
    reset = await db.users.update_many({"id": {"$in": kept_ids}}, {"$set": KEPT_USER_RESET})
    await db.admin_oneoff_runs.insert_one({
        "id": run_id, "kind": "test_data_archive", "admin_id": admin["id"], "admin_name": admin.get("name"),
        "moved": moved, "kept_reset": reset.modified_count, "created_at": now,
    })
    return {"mode": "execute", "run_id": run_id, "moved": moved, "kept_users_reset": reset.modified_count}
