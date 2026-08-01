"""Cargo One transactional email service.

Thin async-safe wrapper around the Resend SDK. Every send is logged to Mongo
(`email_log` collection) regardless of provider outcome, and failures are
swallowed by the public helpers — the caller (booking flow, refund flow,
password reset, …) MUST NOT be interrupted by email delivery issues.

If `RESEND_API_KEY` is empty or not set (e.g. cargoone.co.uk domain not yet
verified) the service records the attempt as `skipped` and returns cleanly.

The single branded template shipped with Session D is the Deposit Receipt.
All future templates follow the same pattern: pure function returning
`(subject, html, text)`. Adding a new template is a ~30-line addition
plus one call site.
"""
from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timezone
from typing import Any

import resend

logger = logging.getLogger(__name__)

_BRAND_PRIMARY = "#111111"
_BRAND_ACCENT = "#D62828"
_BRAND_MUTED = "#6B7280"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _sender() -> str:
    return os.environ.get("EMAIL_FROM") or "noreply@cargoone.co.uk"


def _configured() -> bool:
    return bool((os.environ.get("RESEND_API_KEY") or "").strip())


async def _send_and_log(
    db,
    *,
    to: str,
    subject: str,
    html: str,
    text: str | None,
    template: str,
    booking_id: str | None = None,
    user_id: str | None = None,
) -> dict[str, Any]:
    """Fire a Resend email in a background thread and audit-log the outcome.

    NEVER raises — a failure at any layer is captured on the log doc.
    """
    entry: dict[str, Any] = {
        "at": _now_iso(),
        "to": to,
        "template": template,
        "booking_id": booking_id,
        "user_id": user_id,
        "subject": subject,
        "provider": "resend",
        "sender": _sender(),
        "status": "pending",
        "provider_id": None,
        "error": None,
    }

    if not _configured():
        entry["status"] = "skipped"
        entry["error"] = "RESEND_API_KEY not configured — email not sent"
        try:
            await db.email_log.insert_one(entry)
        except Exception:  # pragma: no cover — log failure must not crash
            pass
        logger.info("email SKIPPED (no api key): template=%s to=%s", template, to)
        return {"status": "skipped"}

    try:
        resend.api_key = os.environ["RESEND_API_KEY"]
        params = {"from": _sender(), "to": [to], "subject": subject, "html": html}
        if text:
            params["text"] = text
        resp = await asyncio.to_thread(resend.Emails.send, params)
        entry["status"] = "sent"
        entry["provider_id"] = resp.get("id") if isinstance(resp, dict) else None
    except Exception as e:  # pragma: no cover — best-effort
        entry["status"] = "failed"
        entry["error"] = str(e)[:500]
        logger.warning("email FAILED: template=%s to=%s err=%s", template, to, e)

    try:
        await db.email_log.insert_one(entry)
    except Exception:
        pass
    return {"status": entry["status"], "id": entry.get("provider_id")}


# --------------------------------------------------------------------------
# Template — shared shell (brand-consistent) + specific renderers
# --------------------------------------------------------------------------
def _shell(*, title: str, preview: str, body_html: str) -> str:
    """Responsive email shell using tables + inline CSS (deliverability-safe)."""
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:{_BRAND_PRIMARY}">
  <span style="display:none;visibility:hidden;opacity:0;color:transparent;height:0;width:0;max-height:0;max-width:0;overflow:hidden;">{preview}</span>
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f4f4f5;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;">
        <tr><td style="padding:24px 28px;border-bottom:1px solid #eeeeee;">
          <table width="100%"><tr>
            <td style="font-size:22px;font-weight:700;color:{_BRAND_PRIMARY};letter-spacing:-0.3px;">Cargo One</td>
            <td align="right" style="font-size:11px;color:{_BRAND_MUTED};text-transform:uppercase;letter-spacing:1px;">Delivered with care</td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:28px;">{body_html}</td></tr>
        <tr><td style="padding:20px 28px;background:#fafafa;border-top:1px solid #eeeeee;font-size:12px;color:{_BRAND_MUTED};line-height:1.6;">
          Cargo One · <a href="mailto:support@cargoone.co.uk" style="color:{_BRAND_MUTED};text-decoration:underline;">support@cargoone.co.uk</a><br>
          Need help? Reply to this email and we'll get right back to you.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""


def render_deposit_receipt(*, name: str, booking_ref: str, amount: float,
                           pickup: str, dropoff: str, service_type: str,
                           balance_due: float | None) -> tuple[str, str, str]:
    is_recovery = (service_type == "breakdown_recovery")
    label = "Vehicle Recovery" if is_recovery else "Delivery"
    subject = f"Deposit received — Cargo One booking {booking_ref[:8]}"
    body = f"""
      <p style="margin:0 0 12px;font-size:15px;">Hi {name or 'there'},</p>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#374151;">
        Thanks — we've received your deposit and your {label.lower()} is being dispatched.
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border:1px solid #eeeeee;border-radius:10px;">
        <tr><td style="padding:16px 18px;">
          <table width="100%"><tr>
            <td style="font-size:11px;color:{_BRAND_MUTED};letter-spacing:0.6px;text-transform:uppercase;">Booking</td>
            <td align="right" style="font-size:11px;color:{_BRAND_ACCENT};font-weight:700;text-transform:uppercase;letter-spacing:0.6px;">{label}</td>
          </tr></table>
          <p style="margin:6px 0 12px;font-family:monospace;font-size:13px;color:#374151;">{booking_ref}</p>
          <div style="border-top:1px solid #eeeeee;padding-top:12px;font-size:13px;color:#374151;">
            <div style="padding:4px 0;"><span style="color:{_BRAND_MUTED};">From:</span> {pickup}</div>
            <div style="padding:4px 0;"><span style="color:{_BRAND_MUTED};">To:</span> {dropoff}</div>
          </div>
        </td></tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
        <tr>
          <td style="font-size:14px;color:{_BRAND_MUTED};">Deposit paid</td>
          <td align="right" style="font-size:20px;font-weight:700;color:{_BRAND_PRIMARY};">£{amount:.2f}</td>
        </tr>
        {f'<tr><td style="font-size:13px;color:{_BRAND_MUTED};padding-top:4px;">Balance on completion</td><td align="right" style="font-size:14px;color:#374151;padding-top:4px;">£{balance_due:.2f}</td></tr>' if balance_due else ''}
      </table>
      <p style="margin:24px 0 0;font-size:12px;color:{_BRAND_MUTED};line-height:1.6;">
        A driver will be assigned shortly. You'll receive another update the moment your driver is on the way.
      </p>
    """
    text = (f"Deposit received — booking {booking_ref[:8]}\n\n"
            f"Hi {name or 'there'},\n"
            f"We've received your £{amount:.2f} deposit for your {label.lower()}.\n"
            f"From: {pickup}\nTo: {dropoff}\n"
            + (f"Balance on completion: £{balance_due:.2f}\n" if balance_due else "")
            + f"\nBooking ref: {booking_ref}\n\nThanks,\nCargo One")
    html = _shell(title=subject, preview=f"Deposit of £{amount:.2f} received", body_html=body)
    return subject, html, text


def render_password_reset(*, name: str, reset_url: str, expiry_minutes: int = 60) -> tuple[str, str, str]:
    subject = "Reset your Cargo One password"
    body = f"""
      <p style="margin:0 0 12px;font-size:15px;">Hi {name or 'there'},</p>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#374151;">
        We received a request to reset your Cargo One password. Click the button below to set a new one — the link expires in {expiry_minutes} minutes.
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
        <tr><td>
          <a href="{reset_url}" style="display:inline-block;padding:14px 28px;background:{_BRAND_ACCENT};color:#ffffff;text-decoration:none;font-weight:600;border-radius:8px;font-size:14px;">
            Reset my password
          </a>
        </td></tr>
      </table>
      <p style="margin:0 0 6px;font-size:12px;color:{_BRAND_MUTED};line-height:1.6;">
        Or paste this link into your browser:
      </p>
      <p style="margin:0 0 20px;font-family:monospace;font-size:11px;color:#374151;word-break:break-all;">{reset_url}</p>
      <p style="margin:20px 0 0;font-size:12px;color:{_BRAND_MUTED};line-height:1.6;">
        If you didn't ask to reset your password, you can safely ignore this email — your account is still secure.
      </p>
    """
    text = (f"Hi {name or 'there'},\n\n"
            f"Reset your Cargo One password by opening this link (expires in {expiry_minutes} minutes):\n{reset_url}\n\n"
            "If you didn't request this, you can safely ignore it.\n\nCargo One")
    html = _shell(title=subject, preview="Reset your Cargo One password", body_html=body)
    return subject, html, text


# --------------------------------------------------------------------------
# Public helpers — each corresponds to one template. Never raises.
# --------------------------------------------------------------------------
async def send_deposit_receipt(db, *, user: dict, booking: dict) -> dict:
    to = user.get("email")
    if not to:
        return {"status": "skipped", "reason": "no_email"}
    subject, html, text = render_deposit_receipt(
        name=user.get("name") or "",
        booking_ref=booking.get("id") or "",
        amount=float(booking.get("deposit_amount") or 0),
        pickup=(booking.get("job") or {}).get("pickup_town") or booking.get("pickup_town") or "Pickup",
        dropoff=(booking.get("job") or {}).get("dropoff_town") or booking.get("dropoff_town") or "Destination",
        service_type=booking.get("service_type") or "transport",
        balance_due=float(booking.get("balance_due") or 0) if booking.get("balance_due") else None,
    )
    return await _send_and_log(db, to=to, subject=subject, html=html, text=text,
                                template="deposit_receipt",
                                booking_id=booking.get("id"),
                                user_id=user.get("id"))


async def send_password_reset(db, *, user: dict, reset_url: str, expiry_minutes: int = 60) -> dict:
    to = user.get("email")
    if not to:
        return {"status": "skipped", "reason": "no_email"}
    subject, html, text = render_password_reset(
        name=user.get("name") or "",
        reset_url=reset_url,
        expiry_minutes=expiry_minutes,
    )
    return await _send_and_log(db, to=to, subject=subject, html=html, text=text,
                                template="password_reset",
                                user_id=user.get("id"))
