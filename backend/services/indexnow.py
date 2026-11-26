"""IndexNow ping on server start: only on production, only when the sitemap changed, max once per 24h."""
import asyncio
import hashlib
import logging
import os
import re
import socket
from datetime import datetime, timedelta, timezone

import httpx

logger = logging.getLogger("indexnow")

KEY = "1fda6f9c376334708f6245e3a0266820"
HOST = "cargoone.co.uk"
SITEMAP_URL = f"https://{HOST}/sitemap.xml"
ENDPOINT = "https://api.indexnow.org/indexnow"
STATE_ID = "sitemap"


def _is_production() -> bool:
    if os.environ.get("INDEXNOW_ENABLED") != "true":
        return False
    if os.environ.get("PRODUCTION_MODE", "").lower() != "true":
        return False
    return not socket.gethostname().startswith("agent-env-")


async def ping_if_changed(db):
    if not _is_production():
        logger.info("[indexnow] skipped (not enabled on production)")
        return
    state = await db.indexnow_state.find_one({"_id": STATE_ID}) or {}
    last = state.get("last_attempt_at")
    now = datetime.now(timezone.utc)
    if last and now - last.replace(tzinfo=timezone.utc) < timedelta(hours=24):
        logger.info("[indexnow] skipped (last ping under 24h ago)")
        return
    async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
        xml = (await client.get(SITEMAP_URL, headers={"User-Agent": "CargoOne-IndexNow/1.0"})).text
        digest = hashlib.sha256(xml.encode()).hexdigest()
        if digest == state.get("hash"):
            logger.info("[indexnow] skipped (sitemap unchanged)")
            return
        urls = [u.strip() for u in re.findall(r"<loc>([^<]+)</loc>", xml)][:10000]
        if not urls:
            logger.warning("[indexnow] skipped (no URLs in sitemap)")
            return
        res = await client.post(ENDPOINT, json={
            "host": HOST, "key": KEY, "keyLocation": f"https://{HOST}/{KEY}.txt", "urlList": urls,
        })
    update = {"last_attempt_at": now, "last_status": res.status_code, "last_url_count": len(urls)}
    if res.status_code in (200, 202):
        update.update({"hash": digest, "last_sent_at": now})
    await db.indexnow_state.update_one({"_id": STATE_ID}, {"$set": update}, upsert=True)
    logger.info("[indexnow] sent %d URLs -> HTTP %s", len(urls), res.status_code)


def schedule(db):
    async def run():
        await asyncio.sleep(30)
        try:
            await ping_if_changed(db)
        except Exception as e:
            logger.warning("[indexnow] error (ignored): %s", e)
    asyncio.get_event_loop().create_task(run())
