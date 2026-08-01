"""Unit tests for services.moderation (Session E).

Validates the sanitiser catches every category of contact-detail leak
declared in the QA sprint brief while leaving normal booking chatter
completely untouched.
"""
from services.moderation import sanitise, sanitise_or_reject
import pytest


# ---------------------------------------------------------------------------
# Positive cases — MUST be redacted.
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("text,label", [
    ("Call me on 07700 900123 when you arrive", "phone"),
    ("Ring me at +44 7700900123", "phone"),
    ("Text 07700-900-123 please",               "phone"),
    ("Reach me at driver@example.com",          "email"),
    ("Contact john.smith+tag@sub.co.uk",        "email"),
    ("Check https://joesremovals.co.uk/quote",  "URL"),
    ("Visit joesremovals.co.uk for pricing",    "URL"),
    ("Add me on WhatsApp",                      "WhatsApp"),
    # wa.me and t.me match the URL detector first (TLD `.me`) — either
    # label is a correct block outcome, we only care they're redacted.
    ("wa.me/447700900123",                      "URL"),
    ("dm me on instagram",                      "Instagram"),
    ("hit me up on tiktok",                     "TikTok"),
    ("message me on telegram",                  "Telegram"),
    ("t.me/joesremovals",                       "URL"),
    ("find me on facebook",                     "Facebook"),
    ("hmu on snapchat",                         "Snapchat"),
    ("Add me on Discord",                       "Discord"),
    ("dm me on linked-in later",                "LinkedIn"),
    ("my youtube is joesvans",                  "YouTube"),
    ("call me on 07700 900 123 outside the app","off-platform contact request"),
    ("give me a call at 07700900123",           "off-platform contact request"),
    ("meet me at SW1A 1AA my home address",     "postcode"),
])
def test_sanitiser_catches_leak(text, label):
    clean, blocked, hits = sanitise(text)
    assert blocked is True, f"expected block for {text!r}"
    assert any(label.lower() in h.lower() for h in hits), f"expected {label!r} in {hits}"
    assert "[hidden" in clean


def test_sanitise_or_reject_hard_raises():
    with pytest.raises(ValueError):
        sanitise_or_reject("call me on 07700 900123", hard_reject=True)


# ---------------------------------------------------------------------------
# Negative cases — MUST pass through untouched.
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("text", [
    "Please deliver the pallet to loading bay 4",
    "I'll be parked next to the goods entrance",
    "Fragile — 3 monitors, please handle carefully",
    "Come between 9am and 5pm",
    "The freight is 1200kg, needs a tail lift",
    "Vehicle is a Ford Focus 2019",
    "£65 for a small parcel is reasonable",
    "Available Tuesday or Wednesday",
    "The route is 182 miles — approx 4 hours",
    # Postcodes on their own (no "meet me" verb) are booking data, not contact:
    "Pickup postcode is SW1A 1AA",
    "Dropoff is at M1 2AB",
])
def test_sanitiser_leaves_normal_chat_alone(text):
    clean, blocked, hits = sanitise(text)
    assert blocked is False, f"unexpected block for {text!r} → hits={hits}"
    assert clean == text


def test_sanitiser_empty_and_none():
    assert sanitise("") == ("", False, [])
    assert sanitise(None) == ("", False, [])


def test_sanitiser_never_raises_on_weird_input():
    for garbage in ("😀😀😀", "\x00\x01\x02", "a" * 5000, 123):
        clean, blocked, hits = sanitise(garbage)  # type: ignore[arg-type]
        # Either passes through as-is (non-str) or returns a string.
        assert isinstance(clean, (str, type(None))) or clean == garbage
