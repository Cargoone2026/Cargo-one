"""Unit tests for services/sms.py — pure normaliser + skip-when-not-configured."""

import pytest
from services.sms import _to_e164


@pytest.mark.parametrize("raw,expected", [
    # Already-canonical E.164 kept as-is
    ("+447545678466", "+447545678466"),
    ("+14155552671",  "+14155552671"),
    # UK national → +44 prefix
    ("07545678466",   "+447545678466"),
    ("07545 678 466", "+447545678466"),
    ("07545-678-466", "+447545678466"),
    ("(07545) 678 466", "+447545678466"),
    # Double-zero international prefix
    ("00447545678466", "+447545678466"),
    # Plain 11-digit no prefix
    ("14155552671", "+14155552671"),
    # Rubbish
    ("abc",         None),
    ("",            None),
    (None,          None),
    ("+0",          None),
    ("+1",          None),
    ("12345",       None),   # too short
])
def test_e164_normaliser(raw, expected):
    assert _to_e164(raw) == expected
