"""moderation.py — small pre-send content sanitizer.

Purpose:
    Cargo One's commercial model relies on the deposit + booking-fee flow;
    if drivers and customers exchange contact details before the deposit
    is paid, the platform loses revenue AND loses the audit trail that
    powers refunds and dispute resolution. This module scans user-authored
    strings (bid messages, booking chat) and redacts any pattern that
    could be used to move the conversation off-platform.

Design constraints:
    * Best-effort only — a determined bad actor will always find a way.
      Our target is to stop the honest-but-cheeky ~80% of leaks while
      keeping normal booking language ("meet at pallet 4 by the loading
      bay") totally unblocked.
    * Never raise an exception on user input. On any regex issue return
      the original text with `blocked=False` so the message pipeline
      degrades gracefully. Content moderation must never wedge chat.
    * Public API is exactly two callables:
        `sanitise(text)      -> (clean_text, blocked_flag, hits)`
        `sanitise_or_reject(text, hard_reject=True) -> clean_text or raise`
"""
from __future__ import annotations

import re
from typing import List, Tuple

# ---------------------------------------------------------------------------
# Patterns
# ---------------------------------------------------------------------------
# `re.IGNORECASE` on every rule + `re.MULTILINE` because chat is line-oriented.
_FLAGS = re.IGNORECASE | re.MULTILINE

# Explicit contact-method keywords. Kept in one list so it's obvious what
# gets flagged and easy to iterate on. Ordered from most-specific to least.
_KEYWORD_PATTERNS: List[Tuple[str, str]] = [
    # Off-platform IM / social networks
    (r"\b(whatsapp|whats[\-\s]?app|wa\.me|w\.a)\b",         "WhatsApp"),
    (r"\b(telegram|t\.me)\b",                                 "Telegram"),
    (r"\b(signal(?!\s+(strength|the|to)))\b",                "Signal"),
    (r"\b(snap(?:chat)?)\b",                                  "Snapchat"),
    (r"\b(discord)\b",                                        "Discord"),
    (r"\b(insta(?:gram)?|ig(?:\s+handle)?)\b",               "Instagram"),
    (r"\b(facebook|\bfb\b|fb\.com|messenger|m\.me)\b",       "Facebook"),
    (r"\b(twitter|\bx\.com\b)\b",                            "Twitter/X"),
    (r"\b(tiktok)\b",                                         "TikTok"),
    (r"\b(linked[\-\s]?in)\b",                                "LinkedIn"),
    (r"\b(youtube|yt\.be|youtu\.be)\b",                       "YouTube"),
    # Direct "call me / text me / DM me / off-platform" tells
    (r"\b(call\s+me\s+on|call\s+me\s+at|ring\s+me\s+on|"
      r"text\s+me\s+on|dm\s+me|message\s+me\s+off|off[\-\s]?platform|"
      r"outside\s+the\s+app|outside\s+cargo\s*one|"
      r"give\s+me\s+a\s+call|reach\s+me\s+on|contact\s+me\s+at)\b",
      "off-platform contact request"),
]

# Structural detectors — email, phone, URLs, postcodes-as-contact.
# Phone: any string with 9+ digits, optionally with +, -, (, ), or spaces.
_PHONE_RE = re.compile(
    r"(?:\+?\d[\d\s\-\(\)\.]{7,}\d)",
    _FLAGS,
)
# Email
_EMAIL_RE = re.compile(r"\b[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}\b", _FLAGS)
# URL — matches with or without scheme, catches bare domains too.
_URL_RE = re.compile(
    r"\b(?:https?://|www\.)?[a-z0-9\-]+\.(?:com|co\.uk|net|org|io|app|"
    r"me|dev|xyz|link|to|be|shop|store|info|biz|us|uk|eu)\b(?:/[^\s]*)?",
    _FLAGS,
)
# UK postcode as personal contact — matches "SW1A 1AA", "M1 2AB", etc.
# NOTE: Postcodes are legitimate booking data; we only redact them when
# they appear in a *chat/bid message* context, not in the pickup/dropoff
# address fields (which never flow through this module).
_UK_POSTCODE_RE = re.compile(
    r"\b(GIR\s?0AA|"
    r"[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2})\b",
    _FLAGS,
)

_ZALGO_RE = re.compile(r"[^\x00-\x7F]{20,}")  # obvious obfuscation walls

_REDACTED = "[hidden — share contact details after booking]"


def _redact(text: str, pattern: re.Pattern, hits: List[str], label: str) -> str:
    def repl(m: re.Match) -> str:
        hits.append(f"{label}: {m.group(0)}")
        return _REDACTED
    return pattern.sub(repl, text)


def sanitise(text: str) -> Tuple[str, bool, List[str]]:
    """Redact any obvious off-platform contact patterns.

    Returns (clean_text, blocked_flag, hits).
    `blocked_flag` is True if we redacted anything at all — the caller
    decides whether to hard-reject or just deliver the cleaned string.
    """
    if not text or not isinstance(text, str):
        return text or "", False, []

    try:
        hits: List[str] = []
        out = text

        # Structural first so keyword replacements don't consume URL/phone chars.
        out = _redact(out, _EMAIL_RE, hits, "email")
        out = _redact(out, _URL_RE, hits, "URL")
        # Phone last of structural — it's the greediest.
        # Only redact phone matches that actually have >= 9 digits (guards
        # against gluing dates / distances like "1234-5678").
        def _phone_repl(m: re.Match) -> str:
            digits = re.sub(r"\D", "", m.group(0))
            if len(digits) >= 9:
                hits.append(f"phone: {m.group(0)}")
                return _REDACTED
            return m.group(0)
        out = _PHONE_RE.sub(_phone_repl, out)

        # Postcodes only when the message already looks contact-oriented
        # (contains "meet", "come to", "address" — heuristic). Otherwise
        # postcodes like "M1 1AB" are normal booking chatter.
        if re.search(r"\b(meet|come\s+to|my\s+address|home\s+address|"
                     r"pick\s+me\s+up|visit\s+me)\b", out, _FLAGS):
            out = _redact(out, _UK_POSTCODE_RE, hits, "postcode")

        # Keywords last
        for pat, label in _KEYWORD_PATTERNS:
            out = _redact(out, re.compile(pat, _FLAGS), hits, label)

        # Obvious unicode obfuscation walls
        if _ZALGO_RE.search(out):
            hits.append("obfuscation")
            out = _ZALGO_RE.sub(_REDACTED, out)

        return out, bool(hits), hits
    except Exception:
        # Never fail the send just because moderation had a hiccup.
        return text, False, []


def sanitise_or_reject(text: str, hard_reject: bool = False) -> str:
    """Convenience wrapper.

    hard_reject=False (default): return the redacted text.
    hard_reject=True: raise ValueError with a user-safe message if anything
    was redacted (useful for bids submitted before deposit exists).
    """
    clean, blocked, hits = sanitise(text)
    if blocked and hard_reject:
        raise ValueError(
            "Contact details or off-platform references are not allowed "
            "before the booking deposit is paid. Please describe the job "
            "without phone numbers, emails, addresses, or social handles."
        )
    return clean
