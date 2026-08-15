"""Cargo One transactional SMS service (R46).

Mirror of `services/email.py` but for Twilio. Same design principles:
    * Every send is logged to Mongo (`sms_log` collection) regardless of
      provider outcome.
    * Failures are swallowed by the public helpers — the caller (booking
      flow, cash reminder…) MUST NOT be interrupted by SMS delivery issues.
    * If TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER are
      empty or not set, the service records the attempt as `skipped` and
      returns cleanly. This lets deploys go live without Twilio configured.

Adding a new template is one new `send_*` async helper. There's no HTML
templating — plain text SMS keeps it deliverable and cheap.
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
from datetime import datetime, timezone
from typing import Any, Optional

logger = logging.getLogger(__name__)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _configured() -> bool:
    return all(
        (os.environ.get(k) or "").strip()
        for k in ("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER")
    )


# E.164 = `+` followed by 8-15 digits. Twilio rejects anything else so we
# normalise once here to keep the caller-side simple.
_E164_RE = re.compile(r"^\+[1-9]\d{7,14}$")


def _to_e164(raw: Optional[str], default_country_code: str = "44") -> Optional[str]:
    """Best-effort E.164 normaliser for UK-first customer numbers.

    Rules:
      * Already E.164 (`+XXXXXXXXXXX`) → returned as-is.
      * Leading `0` (e.g. `07545…`) → replace with `+44` (UK default).
      * Plain 11-digit no prefix → prepend `+`.
      * Anything else → `None` (caller skips).
    """
    if not raw:
        return None
    s = re.sub(r"[\s()\-]", "", raw)
    if _E164_RE.match(s):
        return s
    if s.startswith("00"):          # e.g. 0044... → +44...
        s = "+" + s[2:]
    elif s.startswith("0"):         # UK national — strip 0, add +44
        s = "+" + default_country_code + s[1:]
    elif s.isdigit() and 10 <= len(s) <= 15:
        s = "+" + s
    return s if _E164_RE.match(s) else None


async def _send_and_log(
    db,
    *,
    to: str,
    body: str,
    template: str,
    booking_id: Optional[str] = None,
    user_id: Optional[str] = None,
) -> dict[str, Any]:
    """Fire a Twilio SMS in a background thread and audit-log the outcome.

    NEVER raises — a failure at any layer is captured on the log doc.
    """
    to_e164 = _to_e164(to)
    entry: dict[str, Any] = {
        "at": _now_iso(),
        "to": to_e164 or to,
        "template": template,
        "booking_id": booking_id,
        "user_id": user_id,
        "body_preview": body[:80],
        "provider": "twilio",
        "sender": os.environ.get("TWILIO_FROM_NUMBER"),
        "status": "pending",
        "provider_id": None,
        "error": None,
    }

    if not to_e164:
        entry["status"] = "skipped"
        entry["error"] = "invalid_or_missing_phone"
        try:
            await db.sms_log.insert_one(entry)
        except Exception:
            pass
        logger.info("sms SKIPPED (bad phone): template=%s raw=%r", template, to)
        return {"status": "skipped", "reason": "invalid_or_missing_phone"}

    if not _configured():
        entry["status"] = "skipped"
        entry["error"] = "TWILIO_* env vars not configured"
        try:
            await db.sms_log.insert_one(entry)
        except Exception:
            pass
        logger.info("sms SKIPPED (no twilio creds): template=%s to=%s", template, to_e164)
        return {"status": "skipped", "reason": "twilio_not_configured"}

    try:
        # Local import so `pip install twilio` isn't required at boot time
        # (matches services/email.py's lazy import pattern for `resend`).
        from twilio.rest import Client

        def _sync_send() -> str | None:
            client = Client(
                os.environ["TWILIO_ACCOUNT_SID"],
                os.environ["TWILIO_AUTH_TOKEN"],
            )
            msg = client.messages.create(
                body=body,
                from_=os.environ["TWILIO_FROM_NUMBER"],
                to=to_e164,
            )
            return getattr(msg, "sid", None)

        sid = await asyncio.to_thread(_sync_send)
        entry["status"] = "sent"
        entry["provider_id"] = sid
    except Exception as e:  # pragma: no cover — best-effort
        entry["status"] = "failed"
        entry["error"] = str(e)[:500]
        logger.warning("sms FAILED: template=%s to=%s err=%s", template, to_e164, e)

    try:
        await db.sms_log.insert_one(entry)
    except Exception:
        pass
    return {"status": entry["status"], "sid": entry.get("provider_id")}


# ---------------------------------------------------------------------------
# R46 — Cash-on-Delivery SMS reminder
# ---------------------------------------------------------------------------

async def send_cash_on_delivery_sms(
    db, *, user: dict, booking: dict, driver: dict,
) -> dict:
    """Fire a short SMS reminding the customer of the exact cash figure.

    Called from the same `on_route` transition as the email + push. Twilio
    lets us reach customers who won't check email in the driveway.
    """
    phone = user.get("phone")
    if not phone:
        return {"status": "skipped", "reason": "no_phone"}
    driver_charge = float(booking.get("driver_charge") or booking.get("balance_due") or 0)
    if driver_charge <= 0:
        return {"status": "skipped", "reason": "no_driver_charge"}
    driver_name = (driver or {}).get("name") or "Your driver"
    body = (
        f"Cargo One: have GBP {driver_charge:.2f} cash ready — {driver_name} has "
        f"picked up your cargo and is heading to you. "
        f"Track: https://cargoone.co.uk/customer/booking/{booking.get('id') or ''}"
    )
    return await _send_and_log(
        db,
        to=phone,
        body=body,
        template="cash_on_delivery_reminder",
        booking_id=booking.get("id"),
        user_id=user.get("id"),
    )
