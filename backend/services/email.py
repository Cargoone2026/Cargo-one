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
    from_addr: str | None = None,
    reply_to: str | None = None,
) -> dict[str, Any]:
    """Fire a Resend email in a background thread and audit-log the outcome.

    NEVER raises — a failure at any layer is captured on the log doc.

    `from_addr` overrides the default `EMAIL_FROM` for this send (e.g. so
    admin-desk replies leave the customer's inbox with `admin@cargoone.co.uk`
    as the visible sender). `reply_to` lets replies route back to a specific
    mailbox regardless of the from address.
    """
    sender = from_addr or _sender()
    entry: dict[str, Any] = {
        "at": _now_iso(),
        "to": to,
        "template": template,
        "booking_id": booking_id,
        "user_id": user_id,
        "subject": subject,
        "provider": "resend",
        "sender": sender,
        "reply_to": reply_to,
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
        params = {"from": sender, "to": [to], "subject": subject, "html": html}
        if text:
            params["text"] = text
        if reply_to:
            params["reply_to"] = reply_to
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
                           balance_due: float | None,
                           fee_percent: float | None = None,
                           driver_charge: float | None = None) -> tuple[str, str, str]:
    is_recovery = (service_type == "breakdown_recovery")
    label = "Vehicle Recovery" if is_recovery else "Delivery"
    subject = f"Deposit received — Cargo One booking {booking_ref[:8]}"

    # Session F — full price breakdown with the tier % that was applied.
    breakdown_html = ""
    if driver_charge is not None:
        fee_line = (f"Cargo One Booking Fee ({fee_percent:.0f}%)"
                     if fee_percent is not None else "Cargo One Booking Fee")
        breakdown_html = f"""
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;background:#fafafa;border:1px solid #eeeeee;border-radius:10px;">
          <tr><td style="padding:14px 18px;">
            <table width="100%">
              <tr>
                <td style="font-size:13px;color:#374151;">Transport price</td>
                <td align="right" style="font-size:13px;color:#374151;">£{driver_charge:.2f}</td>
              </tr>
              <tr>
                <td style="font-size:13px;color:#374151;padding-top:4px;">{fee_line}</td>
                <td align="right" style="font-size:13px;color:#374151;padding-top:4px;">£{amount:.2f}</td>
              </tr>
              <tr><td colspan="2" style="border-top:1px solid #eeeeee;padding-top:8px;"></td></tr>
              <tr>
                <td style="font-size:13px;color:{_BRAND_MUTED};padding-top:4px;">Total booking value</td>
                <td align="right" style="font-size:14px;color:#374151;font-weight:600;padding-top:4px;">£{(driver_charge + amount):.2f}</td>
              </tr>
            </table>
          </td></tr>
        </table>
        """

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
      {breakdown_html}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
        <tr>
          <td style="font-size:14px;color:{_BRAND_MUTED};">Deposit paid now</td>
          <td align="right" style="font-size:20px;font-weight:700;color:{_BRAND_PRIMARY};">£{amount:.2f}</td>
        </tr>
        {f'<tr><td style="font-size:13px;color:{_BRAND_MUTED};padding-top:4px;">Pay driver on delivery</td><td align="right" style="font-size:14px;color:#374151;padding-top:4px;">£{balance_due:.2f}</td></tr>' if balance_due else ''}
      </table>
      <p style="margin:24px 0 0;font-size:12px;color:{_BRAND_MUTED};line-height:1.6;">
        A driver will be assigned shortly. You'll receive another update the moment your driver is on the way.
      </p>
    """
    text_lines = [
        f"Deposit received — booking {booking_ref[:8]}",
        "",
        f"Hi {name or 'there'},",
    ]
    if driver_charge is not None:
        text_lines += [
            f"Transport price: £{driver_charge:.2f}",
            (f"Cargo One Booking Fee ({fee_percent:.0f}%): £{amount:.2f}"
             if fee_percent is not None else f"Cargo One Booking Fee: £{amount:.2f}"),
            f"Total booking value: £{(driver_charge + amount):.2f}",
            "",
        ]
    text_lines += [
        f"Deposit paid now: £{amount:.2f}",
    ]
    if balance_due:
        text_lines.append(f"Pay driver on delivery: £{balance_due:.2f}")
    text_lines += [
        f"From: {pickup}",
        f"To: {dropoff}",
        "",
        f"Booking ref: {booking_ref}",
        "",
        "Thanks,",
        "Cargo One",
    ]
    text = "\n".join(text_lines)
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
        # Session F — surface the applied tier % on the receipt
        fee_percent=(float(booking["booking_fee_percent"])
                      if booking.get("booking_fee_percent") is not None else None),
        driver_charge=(float(booking["driver_charge"])
                        if booking.get("driver_charge") is not None else None),
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


# --------------------------------------------------------------------------
# Session E — Lifecycle emails.
# Each renderer keeps the exact same visual shell as the Deposit Receipt so
# every branded email reads as one system. All copy is intentionally short:
# customers don't scroll transactional email, they scan.
# --------------------------------------------------------------------------
def _support_line() -> str:
    return (f"<p style=\"margin:16px 0 0;font-size:12px;color:{_BRAND_MUTED};\">"
            "Questions? Reply to this email or write to "
            f"<a href=\"mailto:support@cargoone.co.uk\" style=\"color:{_BRAND_ACCENT};\">"
            "support@cargoone.co.uk</a>.</p>")


def render_welcome(*, name: str) -> tuple[str, str, str]:
    subject = "Welcome to Cargo One"
    body = f"""
      <p style="margin:0 0 12px;font-size:15px;">Hi {name or 'there'},</p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#374151;">
        Welcome aboard — Cargo One is the UK's straight-talking marketplace for
        deliveries and vehicle recovery. We connect you with vetted drivers,
        fair prices and a real support team.
      </p>
      <p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#374151;">Here's what you can do next:</p>
      <ul style="margin:0 0 20px 18px;padding:0;font-size:14px;line-height:1.7;color:#374151;">
        <li>Post a delivery or a vehicle recovery request in under a minute.</li>
        <li>Compare instant fixed prices or open bidding from drivers.</li>
        <li>Track your driver live once your booking is confirmed.</li>
      </ul>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;">
        <tr><td>
          <a href="https://cargoone.co.uk/customer" style="display:inline-block;padding:14px 28px;background:{_BRAND_ACCENT};color:#ffffff;text-decoration:none;font-weight:600;border-radius:8px;font-size:14px;">
            Post your first booking
          </a>
        </td></tr>
      </table>
      {_support_line()}
    """
    text = (f"Hi {name or 'there'},\n\n"
            "Welcome to Cargo One — the UK's straight-talking marketplace for\n"
            "deliveries and vehicle recovery.\n\n"
            "Post your first booking: https://cargoone.co.uk/customer\n\n"
            "Questions? support@cargoone.co.uk\n\nCargo One")
    return subject, _shell(title=subject, preview="Welcome to Cargo One — let's get moving.", body_html=body), text


def _booking_route_block(pickup: str, dropoff: str, service_type: str) -> str:
    label = "Vehicle Recovery" if service_type == "breakdown_recovery" else "Delivery"
    return f"""
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border:1px solid #eeeeee;border-radius:10px;">
        <tr><td style="padding:16px 18px;">
          <table width="100%"><tr>
            <td style="font-size:11px;color:{_BRAND_MUTED};letter-spacing:0.6px;text-transform:uppercase;">Service</td>
            <td align="right" style="font-size:11px;color:{_BRAND_ACCENT};font-weight:700;text-transform:uppercase;letter-spacing:0.6px;">{label}</td>
          </tr></table>
          <div style="margin-top:8px;font-size:13px;color:#374151;">
            <div style="padding:4px 0;"><span style="color:{_BRAND_MUTED};">From:</span> {pickup}</div>
            <div style="padding:4px 0;"><span style="color:{_BRAND_MUTED};">To:</span> {dropoff}</div>
          </div>
        </td></tr>
      </table>
    """


def render_booking_confirmation(*, name: str, booking_ref: str,
                                 pickup: str, dropoff: str, service_type: str,
                                 pricing_type: str, total: float,
                                 deposit_paid: float, balance_due: float | None,
                                 vehicle_details: dict | None = None) -> tuple[str, str, str]:
    """Fires after deposit is finalised. Renders three intent-specific variants:
    Standard delivery, Marketplace (bidding), and Vehicle recovery.
    """
    is_recovery = service_type == "breakdown_recovery"
    is_marketplace = pricing_type == "bidding"
    if is_recovery:
        subject = f"Recovery booking confirmed — {booking_ref[:8]}"
        headline = "Your vehicle recovery is confirmed"
        blurb = ("A vetted recovery driver is being assigned. You'll get another "
                 "email as soon as they're on the way.")
    elif is_marketplace:
        subject = f"Marketplace booking confirmed — {booking_ref[:8]}"
        headline = "Your marketplace booking is confirmed"
        blurb = ("The driver you selected has been notified and is preparing your "
                 "pickup. You can chat with them from your booking screen.")
    else:
        subject = f"Booking confirmed — {booking_ref[:8]}"
        headline = "Your delivery is confirmed"
        blurb = ("Your driver is being scheduled. Track them live from your "
                 "Cargo One dashboard once they're on the move.")

    vehicle_block = ""
    if is_recovery and vehicle_details:
        rows = []
        if vehicle_details.get("make") or vehicle_details.get("model"):
            rows.append(f"<div style='padding:3px 0;'><span style='color:{_BRAND_MUTED};'>Vehicle:</span> "
                        f"{vehicle_details.get('make','')} {vehicle_details.get('model','')}".strip() + "</div>")
        if vehicle_details.get("registration"):
            rows.append(f"<div style='padding:3px 0;'><span style='color:{_BRAND_MUTED};'>Reg:</span> "
                        f"{vehicle_details['registration']}</div>")
        cond = vehicle_details.get("condition")
        if cond and cond != "unknown":
            rows.append(f"<div style='padding:3px 0;'><span style='color:{_BRAND_MUTED};'>Condition:</span> "
                        f"{str(cond).replace('_',' ')}</div>")
        if rows:
            vehicle_block = ("<div style='margin-top:14px;padding:12px 14px;background:#FFF7ED;"
                             "border:1px solid #FED7AA;border-radius:8px;font-size:13px;color:#7C2D12;'>"
                             "<div style='font-weight:700;margin-bottom:4px;font-size:12px;text-transform:uppercase;letter-spacing:0.6px;'>Recovery vehicle</div>"
                             + "".join(rows) + "</div>")

    balance_row = ""
    if balance_due:
        balance_row = (f"<tr><td style='font-size:13px;color:{_BRAND_MUTED};padding-top:6px;'>Pay driver on delivery</td>"
                       f"<td align='right' style='font-size:14px;color:#374151;padding-top:6px;'>£{balance_due:.2f}</td></tr>")
    body = f"""
      <p style="margin:0 0 4px;font-size:22px;font-weight:700;letter-spacing:-0.3px;color:{_BRAND_PRIMARY};">{headline}</p>
      <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#374151;">Hi {name or 'there'} — {blurb}</p>
      {_booking_route_block(pickup, dropoff, service_type)}
      {vehicle_block}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
        <tr>
          <td style="font-size:11px;color:{_BRAND_MUTED};letter-spacing:0.6px;text-transform:uppercase;">Booking ref</td>
          <td align="right" style="font-family:monospace;font-size:12px;color:#374151;">{booking_ref}</td>
        </tr>
        <tr>
          <td style="font-size:14px;color:{_BRAND_MUTED};padding-top:10px;">Deposit paid</td>
          <td align="right" style="font-size:18px;font-weight:700;color:{_BRAND_PRIMARY};padding-top:10px;">£{deposit_paid:.2f}</td>
        </tr>
        {balance_row}
        <tr>
          <td style="font-size:12px;color:{_BRAND_MUTED};padding-top:8px;">Total booking price</td>
          <td align="right" style="font-size:13px;color:#374151;padding-top:8px;">£{total:.2f}</td>
        </tr>
      </table>
      {_support_line()}
    """
    text = (f"{headline}\n\nHi {name or 'there'},\n{blurb}\n\n"
            f"From: {pickup}\nTo: {dropoff}\n"
            f"Booking ref: {booking_ref}\n"
            f"Deposit paid: £{deposit_paid:.2f}\n"
            + (f"Balance on completion: £{balance_due:.2f}\n" if balance_due else "")
            + f"Total: £{total:.2f}\n\nCargo One")
    return subject, _shell(title=subject, preview=f"{headline} — ref {booking_ref[:8]}", body_html=body), text


def render_driver_assigned(*, name: str, booking_ref: str, pickup: str, dropoff: str,
                            driver_name: str, driver_rating: float, driver_phone: str | None,
                            vehicle_label: str | None) -> tuple[str, str, str]:
    subject = f"Your driver is assigned — {booking_ref[:8]}"
    driver_bits = f"<div style='padding:3px 0;'><span style='color:{_BRAND_MUTED};'>Driver:</span> {driver_name} · ⭐ {driver_rating:.1f}</div>"
    if vehicle_label:
        driver_bits += f"<div style='padding:3px 0;'><span style='color:{_BRAND_MUTED};'>Vehicle:</span> {vehicle_label}</div>"
    if driver_phone:
        driver_bits += f"<div style='padding:3px 0;'><span style='color:{_BRAND_MUTED};'>Contact via app once en route</span></div>"
    body = f"""
      <p style="margin:0 0 4px;font-size:22px;font-weight:700;letter-spacing:-0.3px;color:{_BRAND_PRIMARY};">Your driver is on the way</p>
      <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#374151;">
        Hi {name or 'there'} — {driver_name} has accepted your booking and is en route.
      </p>
      <div style="padding:14px 16px;background:#F0FDF4;border:1px solid #BBF7D0;border-radius:10px;font-size:13px;color:#065F46;">
        {driver_bits}
      </div>
      {_booking_route_block(pickup, dropoff, "transport")}
      <p style="margin:16px 0 0;font-size:12px;color:{_BRAND_MUTED};">
        Booking ref: <span style="font-family:monospace;">{booking_ref}</span>
      </p>
      {_support_line()}
    """
    text = (f"Your driver is on the way\n\nHi {name or 'there'},\n"
            f"{driver_name} (rating {driver_rating:.1f}) has accepted your booking.\n"
            + (f"Vehicle: {vehicle_label}\n" if vehicle_label else "")
            + f"From: {pickup}\nTo: {dropoff}\nRef: {booking_ref}\n\nCargo One")
    return subject, _shell(title=subject, preview=f"{driver_name} is on the way", body_html=body), text


def render_booking_completed(*, name: str, booking_ref: str, pickup: str, dropoff: str,
                              driver_name: str, total: float) -> tuple[str, str, str]:
    subject = f"Delivery completed — {booking_ref[:8]}"
    body = f"""
      <p style="margin:0 0 4px;font-size:22px;font-weight:700;letter-spacing:-0.3px;color:{_BRAND_PRIMARY};">Delivery completed ✅</p>
      <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#374151;">
        Hi {name or 'there'} — your booking with {driver_name} has been marked complete. Thanks for choosing Cargo One.
      </p>
      {_booking_route_block(pickup, dropoff, "transport")}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;">
        <tr>
          <td style="font-size:14px;color:{_BRAND_MUTED};">Total paid</td>
          <td align="right" style="font-size:18px;font-weight:700;color:{_BRAND_PRIMARY};">£{total:.2f}</td>
        </tr>
      </table>
      <p style="margin:20px 0 0;font-size:14px;color:#374151;">
        We'd love your feedback — hit the button below to leave a quick rating for {driver_name}.
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:14px 0;">
        <tr><td>
          <a href="https://cargoone.co.uk/customer/bookings" style="display:inline-block;padding:12px 22px;background:{_BRAND_ACCENT};color:#ffffff;text-decoration:none;font-weight:600;border-radius:8px;font-size:13px;">
            Leave a review
          </a>
        </td></tr>
      </table>
      <p style="margin:16px 0 0;font-size:12px;color:{_BRAND_MUTED};">
        Booking ref: <span style="font-family:monospace;">{booking_ref}</span>
      </p>
      {_support_line()}
    """
    text = (f"Delivery completed\n\nHi {name or 'there'},\nYour booking with "
            f"{driver_name} is complete.\nFrom: {pickup}\nTo: {dropoff}\n"
            f"Total: £{total:.2f}\nRef: {booking_ref}\n\nCargo One")
    return subject, _shell(title=subject, preview=f"Delivery completed — £{total:.2f}", body_html=body), text


def render_booking_cancelled(*, name: str, booking_ref: str, pickup: str, dropoff: str,
                              reason: str | None, refund_pending: bool) -> tuple[str, str, str]:
    subject = f"Booking cancelled — {booking_ref[:8]}"
    reason_line = ""
    if reason:
        reason_line = (f"<p style='margin:0 0 12px;font-size:13px;color:#374151;'>"
                       f"<span style='color:{_BRAND_MUTED};'>Reason:</span> {reason}</p>")
    refund_line = (
        "<p style='margin:0 0 12px;font-size:13px;color:#374151;'>"
        "A refund is being processed and should appear on your card within 5–10 business days.</p>"
        if refund_pending else ""
    )
    body = f"""
      <p style="margin:0 0 4px;font-size:22px;font-weight:700;letter-spacing:-0.3px;color:{_BRAND_PRIMARY};">Booking cancelled</p>
      <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#374151;">
        Hi {name or 'there'} — your booking has been cancelled.
      </p>
      {reason_line}
      {refund_line}
      {_booking_route_block(pickup, dropoff, "transport")}
      <p style="margin:16px 0 0;font-size:12px;color:{_BRAND_MUTED};">
        Booking ref: <span style="font-family:monospace;">{booking_ref}</span>
      </p>
      {_support_line()}
    """
    text = (f"Booking cancelled\n\nHi {name or 'there'},\nYour booking has been cancelled.\n"
            + (f"Reason: {reason}\n" if reason else "")
            + ("A refund is being processed and should appear on your card within 5-10 days.\n"
               if refund_pending else "")
            + f"Ref: {booking_ref}\n\nCargo One")
    return subject, _shell(title=subject, preview="Your Cargo One booking has been cancelled", body_html=body), text


def render_refund_confirmation(*, name: str, booking_ref: str, amount: float,
                                pickup: str, dropoff: str) -> tuple[str, str, str]:
    subject = f"Refund issued — £{amount:.2f} — {booking_ref[:8]}"
    body = f"""
      <p style="margin:0 0 4px;font-size:22px;font-weight:700;letter-spacing:-0.3px;color:{_BRAND_PRIMARY};">Refund on the way</p>
      <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#374151;">
        Hi {name or 'there'} — we've issued a refund of <strong>£{amount:.2f}</strong> to your original payment card. It usually appears within 5–10 business days.
      </p>
      {_booking_route_block(pickup, dropoff, "transport")}
      <p style="margin:16px 0 0;font-size:12px;color:{_BRAND_MUTED};">
        Booking ref: <span style="font-family:monospace;">{booking_ref}</span>
      </p>
      {_support_line()}
    """
    text = (f"Refund on the way\n\nHi {name or 'there'},\nWe've refunded £{amount:.2f} "
            f"to your original card. Please allow 5-10 business days.\n"
            f"Ref: {booking_ref}\n\nCargo One")
    return subject, _shell(title=subject, preview=f"£{amount:.2f} refunded to your card", body_html=body), text


# --------------------------------------------------------------------------
# Public helpers for the new templates (never raise).
# --------------------------------------------------------------------------
async def send_welcome(db, *, user: dict) -> dict:
    to = user.get("email")
    if not to:
        return {"status": "skipped", "reason": "no_email"}
    subject, html, text = render_welcome(name=user.get("name") or "")
    return await _send_and_log(db, to=to, subject=subject, html=html, text=text,
                                template="welcome", user_id=user.get("id"))


def _job_bits(booking: dict) -> dict:
    j = booking.get("job") or {}
    return {
        "pickup": j.get("pickup_town") or booking.get("pickup_town") or "Pickup",
        "dropoff": j.get("dropoff_town") or booking.get("dropoff_town") or "Destination",
        "service_type": j.get("service_type") or booking.get("service_type") or "transport",
        "pricing_type": j.get("pricing_type") or "fixed",
        "vehicle_details": j.get("vehicle_details") or booking.get("vehicle_details"),
    }


async def send_booking_confirmation(db, *, user: dict, booking: dict) -> dict:
    to = user.get("email")
    if not to:
        return {"status": "skipped", "reason": "no_email"}
    jb = _job_bits(booking)
    subject, html, text = render_booking_confirmation(
        name=user.get("name") or "",
        booking_ref=booking.get("id") or "",
        pickup=jb["pickup"], dropoff=jb["dropoff"],
        service_type=jb["service_type"], pricing_type=jb["pricing_type"],
        total=float(booking.get("total_price") or 0),
        deposit_paid=float(booking.get("deposit_amount") or booking.get("booking_fee") or 0),
        balance_due=float(booking.get("balance_due") or booking.get("driver_charge") or 0) or None,
        vehicle_details=jb["vehicle_details"],
    )
    return await _send_and_log(db, to=to, subject=subject, html=html, text=text,
                                template="booking_confirmation",
                                booking_id=booking.get("id"),
                                user_id=user.get("id"))


async def send_driver_assigned(db, *, user: dict, booking: dict, driver: dict) -> dict:
    to = user.get("email")
    if not to:
        return {"status": "skipped", "reason": "no_email"}
    jb = _job_bits(booking)
    subject, html, text = render_driver_assigned(
        name=user.get("name") or "",
        booking_ref=booking.get("id") or "",
        pickup=jb["pickup"], dropoff=jb["dropoff"],
        driver_name=driver.get("name") or "Your driver",
        driver_rating=float(driver.get("rating") or 5.0),
        driver_phone=driver.get("phone"),
        vehicle_label=(driver.get("vehicle") or {}).get("label")
                       if isinstance(driver.get("vehicle"), dict) else None,
    )
    return await _send_and_log(db, to=to, subject=subject, html=html, text=text,
                                template="driver_assigned",
                                booking_id=booking.get("id"),
                                user_id=user.get("id"))


async def send_booking_completed(db, *, user: dict, booking: dict, driver: dict) -> dict:
    to = user.get("email")
    if not to:
        return {"status": "skipped", "reason": "no_email"}
    jb = _job_bits(booking)
    subject, html, text = render_booking_completed(
        name=user.get("name") or "",
        booking_ref=booking.get("id") or "",
        pickup=jb["pickup"], dropoff=jb["dropoff"],
        driver_name=driver.get("name") or "your driver",
        total=float(booking.get("total_price") or 0),
    )
    return await _send_and_log(db, to=to, subject=subject, html=html, text=text,
                                template="booking_completed",
                                booking_id=booking.get("id"),
                                user_id=user.get("id"))


async def send_booking_cancelled(db, *, user: dict, booking: dict,
                                  reason: str | None = None,
                                  refund_pending: bool = False) -> dict:
    to = user.get("email")
    if not to:
        return {"status": "skipped", "reason": "no_email"}
    jb = _job_bits(booking)
    subject, html, text = render_booking_cancelled(
        name=user.get("name") or "",
        booking_ref=booking.get("id") or "",
        pickup=jb["pickup"], dropoff=jb["dropoff"],
        reason=reason, refund_pending=refund_pending,
    )
    return await _send_and_log(db, to=to, subject=subject, html=html, text=text,
                                template="booking_cancelled",
                                booking_id=booking.get("id"),
                                user_id=user.get("id"))


async def send_refund_confirmation(db, *, user: dict, booking: dict, amount: float) -> dict:
    to = user.get("email")
    if not to:
        return {"status": "skipped", "reason": "no_email"}
    jb = _job_bits(booking)
    subject, html, text = render_refund_confirmation(
        name=user.get("name") or "",
        booking_ref=booking.get("id") or "",
        amount=amount,
        pickup=jb["pickup"], dropoff=jb["dropoff"],
    )
    return await _send_and_log(db, to=to, subject=subject, html=html, text=text,
                                template="refund_confirmation",
                                booking_id=booking.get("id"),
                                user_id=user.get("id"))



# ---------------------------------------------------------------------------
# Round 3 — Messaging & bidding email templates
# ---------------------------------------------------------------------------

_APP_ORIGIN = os.environ.get("APP_ORIGIN") or "https://cargoone.co.uk"


def _clip(text: str, max_len: int = 200) -> str:
    text = (text or "").strip()
    if len(text) <= max_len:
        return text
    return text[: max_len - 1].rstrip() + "\u2026"


def render_new_message(
    *,
    recipient_name: str,
    sender_name: str,
    booking_ref: str,
    preview: str,
    reply_url: str,
    unread_count: int,
) -> tuple[str, str, str]:
    """Branded conversation-notification email. Preview is soft-clipped at 200
    chars so leaked essays from a chatty driver don't blow up the inbox.
    """
    clipped = _clip(preview, 200)
    unread_line = ""
    if unread_count > 1:
        unread_line = (
            f"<p style=\"margin:0 0 12px;font-size:13px;color:{_BRAND_MUTED};\">"
            f"You have <strong>{unread_count} unread messages</strong> on this booking."
            f"</p>"
        )
    subject = f"{sender_name} sent you a message — Cargo One booking {booking_ref[:8]}"
    body = f"""
      <p style="margin:0 0 12px;font-size:15px;">Hi {recipient_name or 'there'},</p>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#374151;">
        <strong>{sender_name}</strong> just sent you a message on your Cargo One booking.
      </p>
      {unread_line}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border:1px solid #eeeeee;border-left:4px solid {_BRAND_ACCENT};border-radius:10px;">
        <tr><td style="padding:16px 18px;">
          <p style="margin:0 0 8px;font-size:11px;color:{_BRAND_MUTED};text-transform:uppercase;letter-spacing:0.6px;">
            {sender_name} · Booking {booking_ref[:8]}
          </p>
          <p style="margin:0;font-size:14px;color:#111111;line-height:1.55;white-space:pre-wrap;">{clipped}</p>
        </td></tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px;">
        <tr><td align="center">
          <a href="{reply_url}" style="display:inline-block;background:{_BRAND_ACCENT};color:#ffffff;font-weight:700;font-size:14px;padding:12px 22px;border-radius:999px;text-decoration:none;">View &amp; Reply</a>
        </td></tr>
      </table>
      <p style="margin:22px 0 0;font-size:12px;color:{_BRAND_MUTED};line-height:1.6;">
        You'll only get one email every few minutes even if the conversation is busy. Open the chat to see the full history.
      </p>
    """
    text = "\n".join([
        f"{sender_name} sent you a message on Cargo One (booking {booking_ref[:8]})",
        "",
        f"Hi {recipient_name or 'there'},",
        "",
        f"> {clipped}",
        "",
        (f"You have {unread_count} unread messages on this booking." if unread_count > 1 else ""),
        f"View & Reply: {reply_url}",
        "",
        "— Cargo One",
    ])
    text = "\n".join([ln for ln in text.split("\n") if ln or ln == ""])  # keep blank lines
    html = _shell(title=subject, preview=clipped or "New Cargo One message", body_html=body)
    return subject, html, text


def render_new_bid(
    *,
    customer_name: str,
    driver_name: str,
    job_title: str,
    amount: float,
    eta_hours: float | None,
    driver_rating: float,
    verified_driver: bool,
    review_url: str,
) -> tuple[str, str, str]:
    """Emailed to the customer whenever a driver bids on their job."""
    subject = f"New bid: £{amount:.2f} from {driver_name} — Cargo One"
    badge = ""
    if verified_driver:
        badge = (
            f"<span style=\"display:inline-block;background:#DCFCE7;color:#166534;"
            f"font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px;"
            f"letter-spacing:0.4px;text-transform:uppercase;\">Verified</span>"
        )
    eta_line = ""
    if eta_hours is not None:
        eta_line = (
            f"<tr><td style=\"font-size:13px;color:{_BRAND_MUTED};padding-top:4px;\">Estimated pickup</td>"
            f"<td align=\"right\" style=\"font-size:13px;color:#374151;padding-top:4px;\">"
            f"{'{:.1f}'.format(float(eta_hours))} h</td></tr>"
        )
    body = f"""
      <p style="margin:0 0 12px;font-size:15px;">Hi {customer_name or 'there'},</p>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#374151;">
        A driver just placed a bid on your job <strong>{job_title}</strong>.
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border:1px solid #eeeeee;border-radius:10px;">
        <tr><td style="padding:16px 18px;">
          <table width="100%"><tr>
            <td style="font-size:14px;font-weight:600;color:#111111;">{driver_name} {badge}</td>
            <td align="right" style="font-size:12px;color:{_BRAND_MUTED};">★ {float(driver_rating):.1f}</td>
          </tr></table>
          <table width="100%" style="margin-top:12px;">
            <tr>
              <td style="font-size:13px;color:{_BRAND_MUTED};">Bid amount</td>
              <td align="right" style="font-size:20px;font-weight:700;color:{_BRAND_PRIMARY};">£{amount:.2f}</td>
            </tr>
            {eta_line}
          </table>
        </td></tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px;">
        <tr><td align="center">
          <a href="{review_url}" style="display:inline-block;background:{_BRAND_ACCENT};color:#ffffff;font-weight:700;font-size:14px;padding:12px 22px;border-radius:999px;text-decoration:none;">Review this bid</a>
        </td></tr>
      </table>
      <p style="margin:22px 0 0;font-size:12px;color:{_BRAND_MUTED};line-height:1.6;">
        You can compare all bids and accept the one that suits you best.
      </p>
    """
    text = "\n".join([
        f"New bid: £{amount:.2f} from {driver_name}",
        "",
        f"Hi {customer_name or 'there'},",
        "",
        f"Job: {job_title}",
        f"Driver: {driver_name}  ★ {float(driver_rating):.1f}"
        + ("  [Verified]" if verified_driver else ""),
        f"Bid amount: £{amount:.2f}",
        (f"Estimated pickup: {float(eta_hours):.1f} h" if eta_hours is not None else ""),
        "",
        f"Review this bid: {review_url}",
        "",
        "— Cargo One",
    ])
    html = _shell(title=subject, preview=f"£{amount:.2f} from {driver_name}", body_html=body)
    return subject, html, text


async def send_new_message_email(
    db,
    *,
    recipient: dict,
    sender: dict,
    booking: dict,
    preview_text: str,
    unread_count: int,
    role_hint: str = "customer",
) -> dict:
    """Sends a new-message notification IF the 5-minute per-conversation
    throttle allows it. The caller is responsible for the "recipient is
    actively viewing" check (see `is_conversation_active`).
    """
    to = recipient.get("email")
    if not to:
        return {"status": "skipped", "reason": "no_email"}

    booking_id = booking.get("id") or ""
    recipient_id = recipient.get("id") or ""

    # Throttle — one email per {recipient, conversation} per 5 min.
    THROTTLE_SECONDS = 300
    now = datetime.now(timezone.utc)
    state = await db.conversation_email_state.find_one(
        {"user_id": recipient_id, "booking_id": booking_id}
    )
    if state and state.get("last_sent_at"):
        try:
            last = datetime.fromisoformat(state["last_sent_at"])
        except Exception:
            last = None
        if last and (now - last).total_seconds() < THROTTLE_SECONDS:
            return {"status": "skipped", "reason": "throttled"}

    # Choose the correct portal path based on the recipient role — customer
    # opens /customer/booking/<id>, driver opens /driver/booking/<id>.
    portal = "customer" if role_hint == "customer" else "driver"
    reply_url = f"{_APP_ORIGIN}/{portal}/booking/{booking_id}#chat"

    subject, html, text = render_new_message(
        recipient_name=recipient.get("name") or "",
        sender_name=sender.get("name") or "Your Cargo One contact",
        booking_ref=booking_id,
        preview=preview_text,
        reply_url=reply_url,
        unread_count=int(unread_count or 1),
    )
    result = await _send_and_log(
        db, to=to, subject=subject, html=html, text=text,
        template="new_message", booking_id=booking_id, user_id=recipient_id,
    )
    # Record last-send timestamp for the throttle regardless of Resend
    # outcome — if the send failed we still don't want to hammer them.
    await db.conversation_email_state.update_one(
        {"user_id": recipient_id, "booking_id": booking_id},
        {"$set": {"last_sent_at": now.isoformat(), "updated_at": now.isoformat()}},
        upsert=True,
    )
    return result


async def send_new_bid_email(
    db, *, customer: dict, driver: dict, job: dict, bid: dict, verified_driver: bool = False,
) -> dict:
    to = customer.get("email")
    if not to:
        return {"status": "skipped", "reason": "no_email"}
    review_url = f"{_APP_ORIGIN}/customer/job/{job.get('id') or ''}"
    subject, html, text = render_new_bid(
        customer_name=customer.get("name") or "",
        driver_name=driver.get("name") or "A driver",
        job_title=job.get("title") or "your job",
        amount=float(bid.get("amount") or 0),
        eta_hours=bid.get("eta_hours"),
        driver_rating=float(driver.get("rating") or 5.0),
        verified_driver=bool(verified_driver),
        review_url=review_url,
    )
    return await _send_and_log(
        db, to=to, subject=subject, html=html, text=text,
        template="new_bid", booking_id=None,
        user_id=customer.get("id"),
    )


async def is_conversation_active(db, *, user_id: str, booking_id: str,
                                     window_seconds: int = 45) -> bool:
    """Returns True if the user has heartbeated presence on this conversation
    within `window_seconds`. Called immediately before we decide whether to
    email them about a new message.
    """
    state = await db.conversation_presence.find_one(
        {"user_id": user_id, "booking_id": booking_id}
    )
    if not state:
        return False
    ts = state.get("last_seen_at")
    if not ts:
        return False
    try:
        last = datetime.fromisoformat(ts)
    except Exception:
        return False
    return (datetime.now(timezone.utc) - last).total_seconds() < window_seconds


# ---------------------------------------------------------------------------
# Round 7 — Driver booking-accepted email
# ---------------------------------------------------------------------------

def render_driver_booking_accepted(
    *,
    driver_name: str,
    booking_ref: str,
    customer_name: str,
    customer_phone: str,
    pickup: str,
    dropoff: str,
    suitable_vehicle: str,
    transport_item: str,
    amount_to_collect: float,
    booking_url: str,
    start_trip_url: str,
) -> tuple[str, str, str]:
    """Confirmation email sent to the driver once they've claimed / been
    assigned to a booking. Bundles every field they need to start the job
    without opening the app first."""
    subject = f"You accepted a Cargo One job — booking {booking_ref[:8]}"
    call_line = (
        f'<a href="tel:{customer_phone}" '
        f'style="color:{_BRAND_ACCENT};font-weight:600;text-decoration:none;">'
        f"{customer_phone}</a>"
        if customer_phone else "—"
    )
    amount_line = f"£{float(amount_to_collect):.2f}" if amount_to_collect else "—"
    body = f"""
      <p style="margin:0 0 12px;font-size:15px;">Hi {driver_name or 'there'},</p>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#374151;">
        You've accepted booking <strong>{booking_ref[:8]}</strong>. Here's
        everything you need to run the job:
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border:1px solid #eeeeee;border-radius:10px;">
        <tr><td style="padding:14px 16px;">
          <table width="100%" style="font-size:13px;color:#374151;">
            <tr><td style="width:42%;color:{_BRAND_MUTED};padding:6px 0;">Customer</td>
                <td style="color:#111111;font-weight:600;padding:6px 0;">{customer_name or '—'}</td></tr>
            <tr><td style="color:{_BRAND_MUTED};padding:6px 0;">Phone</td>
                <td style="padding:6px 0;">{call_line}</td></tr>
            <tr><td style="color:{_BRAND_MUTED};padding:6px 0;">Pickup</td>
                <td style="color:#111111;padding:6px 0;">{pickup or '—'}</td></tr>
            <tr><td style="color:{_BRAND_MUTED};padding:6px 0;">Drop-off</td>
                <td style="color:#111111;padding:6px 0;">{dropoff or '—'}</td></tr>
            <tr><td style="color:{_BRAND_MUTED};padding:6px 0;">Suitable vehicle</td>
                <td style="color:#111111;padding:6px 0;">{suitable_vehicle or '—'}</td></tr>
            <tr><td style="color:{_BRAND_MUTED};padding:6px 0;">Transport item</td>
                <td style="color:#111111;padding:6px 0;">{transport_item or '—'}</td></tr>
            <tr><td style="color:{_BRAND_MUTED};padding:6px 0;">Amount to collect</td>
                <td style="color:#111111;font-weight:700;padding:6px 0;">{amount_line}</td></tr>
          </table>
        </td></tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px;">
        <tr>
          <td align="center" style="padding-right:6px;">
            <a href="{start_trip_url}" style="display:inline-block;background:{_BRAND_ACCENT};color:#ffffff;font-weight:700;font-size:14px;padding:12px 22px;border-radius:999px;text-decoration:none;">Start trip</a>
          </td>
          <td align="center" style="padding-left:6px;">
            <a href="{booking_url}" style="display:inline-block;background:#ffffff;color:{_BRAND_PRIMARY};border:1px solid {_BRAND_PRIMARY};font-weight:700;font-size:14px;padding:11px 22px;border-radius:999px;text-decoration:none;">Open booking</a>
          </td>
        </tr>
      </table>
      <p style="margin:22px 0 0;font-size:12px;color:{_BRAND_MUTED};line-height:1.6;">
        Drive safe — you've got this. Message the customer from inside the
        app if anything comes up.
      </p>
    """
    text = "\n".join([
        f"You accepted a Cargo One job — booking {booking_ref[:8]}",
        "",
        f"Customer:  {customer_name or '—'}  ({customer_phone or 'no phone'})",
        f"Pickup:    {pickup or '—'}",
        f"Drop-off:  {dropoff or '—'}",
        f"Vehicle:   {suitable_vehicle or '—'}",
        f"Item:      {transport_item or '—'}",
        f"Collect:   {amount_line}",
        "",
        f"Start trip:   {start_trip_url}",
        f"Open booking: {booking_url}",
        "",
        "— Cargo One",
    ])
    html = _shell(title=subject,
                  preview=f"{customer_name or 'A customer'} · {pickup} → {dropoff}",
                  body_html=body)
    return subject, html, text


async def send_driver_booking_accepted_email(
    db, *, driver: dict, customer: dict, booking: dict, job: dict,
) -> dict:
    to = driver.get("email")
    if not to:
        return {"status": "skipped", "reason": "no_email"}
    booking_id = booking.get("id") or ""
    booking_url = f"{_APP_ORIGIN}/driver/booking/{booking_id}"
    start_trip_url = f"{_APP_ORIGIN}/driver/booking/{booking_id}?tab=trip"
    transport_item = (
        (job.get("transport_category") or "").replace("_", " ").strip()
        or (job.get("category") or "").replace("_", " ").strip()
    )
    subject, html, text = render_driver_booking_accepted(
        driver_name=driver.get("name") or "",
        booking_ref=booking_id,
        customer_name=customer.get("name") or "",
        customer_phone=customer.get("phone") or "",
        pickup=(job.get("pickup_address") or job.get("pickup_town") or ""),
        dropoff=(job.get("dropoff_address") or job.get("dropoff_town") or ""),
        suitable_vehicle=(job.get("recommended_vehicle") or job.get("vehicle_label") or ""),
        transport_item=transport_item,
        amount_to_collect=float(booking.get("driver_charge") or 0),
        booking_url=booking_url,
        start_trip_url=start_trip_url,
    )
    return await _send_and_log(
        db, to=to, subject=subject, html=html, text=text,
        template="driver_booking_accepted",
        booking_id=booking_id, user_id=driver.get("id"),
    )



# ---------------------------------------------------------------------------
# Round 10 — Fixed-price accept notification (customer)
# ---------------------------------------------------------------------------

def render_customer_driver_accepted(
    *,
    customer_name: str,
    driver_name: str,
    job_title: str,
    pickup: str,
    dropoff: str,
    accepted_price: float,
    pay_deposit_url: str,
) -> tuple[str, str, str]:
    """Customer email: a driver accepted a fixed-price job — pay to confirm."""
    subject = f"Driver accepted your job — pay deposit to confirm"
    amount_line = f"£{float(accepted_price):.2f}" if accepted_price else "—"
    body = f"""
      <p style="margin:0 0 12px;font-size:15px;">Hi {customer_name or 'there'},</p>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#374151;">
        Great news — <strong>{driver_name or 'a Cargo One driver'}</strong> has
        accepted your job <strong>{job_title or ''}</strong>. To lock the
        booking in and share collection details, please pay the deposit now.
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border:1px solid #eeeeee;border-radius:10px;">
        <tr><td style="padding:14px 16px;">
          <table width="100%" style="font-size:13px;color:#374151;">
            <tr><td style="width:42%;color:{_BRAND_MUTED};padding:6px 0;">Driver</td>
                <td style="color:#111111;font-weight:600;padding:6px 0;">{driver_name or '—'}</td></tr>
            <tr><td style="color:{_BRAND_MUTED};padding:6px 0;">Pickup</td>
                <td style="color:#111111;padding:6px 0;">{pickup or '—'}</td></tr>
            <tr><td style="color:{_BRAND_MUTED};padding:6px 0;">Drop-off</td>
                <td style="color:#111111;padding:6px 0;">{dropoff or '—'}</td></tr>
            <tr><td style="color:{_BRAND_MUTED};padding:6px 0;">Accepted price</td>
                <td style="color:#111111;font-weight:700;padding:6px 0;">{amount_line}</td></tr>
          </table>
        </td></tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px;"><tr><td align="center">
        <a href="{pay_deposit_url}" style="display:inline-block;background:{_BRAND_ACCENT};color:#ffffff;font-weight:700;font-size:14px;padding:12px 24px;border-radius:999px;text-decoration:none;">Pay deposit & confirm</a>
      </td></tr></table>
      <p style="margin:22px 0 0;font-size:12px;color:{_BRAND_MUTED};line-height:1.6;">
        Your driver is on standby. The booking is held for you — pay the
        booking fee now to release collection details.
      </p>
    """
    text = "\n".join([
        subject, "",
        f"Driver:  {driver_name or '—'}",
        f"Job:     {job_title or '—'}",
        f"Pickup:  {pickup or '—'}",
        f"Drop-off:{dropoff or '—'}",
        f"Price:   {amount_line}", "",
        f"Pay & confirm: {pay_deposit_url}",
        "", "— Cargo One",
    ])
    html = _shell(title=subject,
                  preview=f"{driver_name or 'A driver'} accepted your Cargo One job",
                  body_html=body)
    return subject, html, text


async def send_customer_driver_accepted_email(
    db, *, customer: dict, driver: dict, job: dict,
) -> dict:
    to = customer.get("email")
    if not to:
        return {"status": "skipped", "reason": "no_email"}
    job_id = job.get("id") or ""
    pay_deposit_url = f"{_APP_ORIGIN}/customer/job/{job_id}"
    subject, html, text = render_customer_driver_accepted(
        customer_name=customer.get("name") or "",
        driver_name=driver.get("name") or "",
        job_title=job.get("title") or "",
        pickup=(job.get("pickup_town") or job.get("pickup_address") or ""),
        dropoff=(job.get("dropoff_town") or job.get("dropoff_address") or ""),
        accepted_price=float(job.get("accepted_price") or job.get("fixed_price") or 0),
        pay_deposit_url=pay_deposit_url,
    )
    return await _send_and_log(
        db, to=to, subject=subject, html=html, text=text,
        template="customer_driver_accepted",
        user_id=customer.get("id"),
    )


# ---------------------------------------------------------------------------
# Round 10 — Admin reply-to-contact-message (server-side, from admin@)
# ---------------------------------------------------------------------------

async def send_admin_contact_reply(
    db, *, to: str, name: str | None, subject: str, body_text: str,
    original_subject: str | None = None, original_message: str | None = None,
    admin_name: str | None = None,
) -> dict:
    """Admin-desk reply routed through Resend so it always leaves Cargo One
    from `admin@cargoone.co.uk` regardless of the admin's local mail client.
    """
    admin_from = os.environ.get("ADMIN_REPLY_FROM") or "admin@cargoone.co.uk"
    reply_to = admin_from
    quoted = ""
    if original_message:
        quoted_lines = "\n".join(f"&gt; {ln}" for ln in original_message.splitlines())
        quoted = (
            f'<hr style="border:0;border-top:1px solid #eeeeee;margin:22px 0;">'
            f'<p style="margin:0 0 6px;font-size:12px;color:{_BRAND_MUTED};">'
            f'On {datetime.now(timezone.utc).strftime("%d %b %Y")} you wrote:'
            f'{" — " + original_subject if original_subject else ""}</p>'
            f'<pre style="margin:0;font-family:inherit;font-size:12px;color:{_BRAND_MUTED};white-space:pre-wrap;">'
            f'{quoted_lines}</pre>'
        )
    safe_body = "".join(
        f'<p style="margin:0 0 14px;font-size:14px;line-height:1.65;color:#111111;">{para}</p>'
        for para in body_text.strip().split("\n\n") if para.strip()
    ) or f'<p style="margin:0 0 14px;font-size:14px;color:#111111;">{body_text}</p>'
    signoff = (
        f'<p style="margin:22px 0 0;font-size:14px;color:#111111;">Kind regards,<br>'
        f'{admin_name or "The Cargo One team"}<br>'
        f'<a href="mailto:{admin_from}" style="color:{_BRAND_ACCENT};text-decoration:none;">{admin_from}</a></p>'
    )
    body_html = (
        f'<p style="margin:0 0 14px;font-size:15px;">Hi {name or "there"},</p>'
        f'{safe_body}{signoff}{quoted}'
    )
    html = _shell(title=subject, preview=body_text[:120], body_html=body_html)
    text = "\n".join([
        f"Hi {name or 'there'},", "",
        body_text.strip(), "",
        f"Kind regards,",
        admin_name or "The Cargo One team",
        admin_from,
    ])
    return await _send_and_log(
        db, to=to, subject=subject, html=html, text=text,
        template="admin_contact_reply",
        from_addr=admin_from, reply_to=reply_to,
    )
