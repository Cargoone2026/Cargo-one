"""R27.8 — Fast-path error capture + safeSwallow split regression tests.

R27.7 hid MBERR/JSERR text on the iPhone overlay despite `ot4 js4`
counters because `JSON.stringify(evObj.tile)` throws on Mapbox's
circular tile objects. The throw happened INSIDE `safe()`, which
incremented `jsErrCount` (indistinguishable from a real window error)
and BEFORE `lastMapboxError = record`, so the overlay text was null.

R27.8 splits the counters and moves the message-capture to a
guaranteed fast-path that runs OUTSIDE the safe() wrapper. This
suite locks that in.
"""
from __future__ import annotations

import re
from pathlib import Path

import pytest

SRC = Path("/app/frontend/src/components/ui-portal/MapboxMap.jsx").read_text()


def _init_effect_scope() -> str:
    start = SRC.index("// Initialise map once")
    end = SRC.index("// Sync markers", start)
    return SRC[start:end]


# ── (1) Fast-path assigns `lastMapboxError` BEFORE any safe() wrapper ─
def test_fast_path_captures_message_before_enrichment():
    body = _init_effect_scope()
    # Locate the `map.on("error", …)` handler body.
    idx = body.index('map.on("error"')
    handler_end = body.index("mapRef.current = map;", idx)
    handler = body[idx:handler_end]

    fast_msg_pos = handler.find("fastMsg")
    early_record_pos = handler.find("earlyRecord")
    last_mb_assign_pos = handler.find("lastMapboxError = earlyRecord")
    safe_enrich_pos = handler.find('safe("map.on.error.enrich"')

    assert fast_msg_pos != -1, "fastMsg fast-path variable missing"
    assert early_record_pos != -1, "earlyRecord missing"
    assert last_mb_assign_pos != -1, "lastMapboxError must be assigned to earlyRecord"
    assert safe_enrich_pos != -1, "safe() enrichment block missing"

    # Critical ordering: `lastMapboxError = earlyRecord` MUST appear
    # before the `safe("map.on.error.enrich"…)` call. Otherwise the
    # R27.7 bug returns.
    assert last_mb_assign_pos < safe_enrich_pos, (
        "lastMapboxError = earlyRecord must be assigned BEFORE the safe() "
        "enrichment block runs, so a throw inside enrichment cannot leave "
        "the overlay with a null message."
    )


# ── (2) safeSwallowCount is separate from jsErrCount ──────────────────
def test_safe_swallow_split_from_js_err_count():
    body = _init_effect_scope()
    assert "safeSwallowCount" in body, "safeSwallowCount counter missing"
    # safe() catch block increments safeSwallowCount, NOT jsErrCount.
    safe_start = body.index("const safe = (label, fn)")
    safe_end = body.index("};", safe_start + 20) + 2
    safe_block = body[safe_start:safe_end]
    assert "safeSwallowCount += 1" in safe_block, \
        "safe() must increment safeSwallowCount"
    assert "jsErrCount += 1" not in safe_block, \
        "safe() must NOT increment jsErrCount (R27.8 split)"


# ── (3) safeStr helper handles circular refs ───────────────────────────
def test_safe_stringifier_present():
    body = _init_effect_scope()
    assert "const safeStr" in body, "safeStr helper missing"
    assert "[Circular]" in body, "safeStr must handle circular refs"
    # And the error handler must use safeStr for tile / source fields.
    handler_start = body.index('map.on("error"')
    handler_end = body.index("mapRef.current = map;", handler_start)
    handler = body[handler_start:handler_end]
    assert "safeStr(evObj.tile" in handler, \
        "tile field must use safeStr, not JSON.stringify"
    # JSON.stringify on tile field is banned inside the error handler.
    assert "JSON.stringify(evObj.tile" not in handler, \
        "JSON.stringify(evObj.tile) is banned — use safeStr (handles circular refs)"


# ── (4) Overlay ALWAYS shows MBERR when otherErrors + styleErrors + tileErrors > 0
def test_overlay_always_shows_mberr_when_counter_gt_zero():
    # The overlay's MBERR line must be gated on the COUNTER, not on
    # `mbErrText` truthiness — so we always see something (even a
    # fallback message) when any Mapbox error has been counted.
    # Search JSX for the gating condition.
    m = re.search(r"\(diag\.otherErrors\s*\+\s*diag\.styleErrors\s*\+\s*diag\.tileErrors\)\s*>\s*0", SRC)
    assert m, "MBERR line must be gated on (otherErrors + styleErrors + tileErrors) > 0"


def test_overlay_always_shows_jserr_when_counter_gt_zero():
    m = re.search(r"diag\.jsErrors\s*>\s*0", SRC)
    assert m, "JSERR line must be gated on jsErrors > 0"


# ── (5) SWALLOW line surfaced when safeSwallows > 0 ─────────────────
def test_overlay_shows_swallow_when_present():
    m = re.search(r"diag\.safeSwallows\s*>\s*0", SRC)
    assert m, "SWALLOW line must be gated on safeSwallows > 0"
    assert "SWALLOW" in SRC, "Overlay must render `SWALLOW:` line"


# ── (6) SHOW FULL DIAG button present + calls snapshot() ──────────────
def test_show_full_diag_button_present():
    assert "SHOW FULL DIAG" in SRC, "Tap-to-show diagnostic button missing"
    assert "window.alert(JSON.stringify" in SRC, \
        "Button must alert full JSON via window.alert(JSON.stringify(…, 2))"
    # Button must NOT expose raw access_token — it only uses public getters.
    # Verify by ensuring only the getter accessors are referenced.
    onclick_start = SRC.index("SHOW FULL DIAG")
    onclick_context = SRC[max(0, onclick_start - 3000):onclick_start + 500]
    assert "getLastMapboxError" in onclick_context
    assert "getLastJSError" in onclick_context


# ── (7) R27.6 + R27.7 invariants still pass ────────────────────────
def test_r27_6_and_r27_7_invariants_still_pass():
    body = _init_effect_scope()
    getters = re.findall(r"\bget\s+[A-Za-z_$][A-Za-z0-9_$]*\s*\(", body)
    assert getters == [], f"Object-literal getters reintroduced: {getters}"
    # safe() still exists.
    assert body.count("safe(") >= 12
    # access_token stripped.
    assert "access_token=REDACTED" in SRC
    # Rich error record fields still present.
    for field in ["nestedMessage", "status", "sourceId", "url", "errKind"]:
        assert field in body, f"error field `{field}` regressed"


# ── (8) Fast-path fastMsg is captured OUTSIDE safe() ───────────────
def test_fast_msg_capture_is_outside_safe():
    body = _init_effect_scope()
    handler_start = body.index('map.on("error"')
    handler_end = body.index("mapRef.current = map;", handler_start)
    handler = body[handler_start:handler_end]

    # `let fastMsg = ` must appear BEFORE any `safe("…"` CALL inside the
    # handler (search for the double-quote to skip comments that mention
    # safe()).
    fast_msg_pos = handler.index("let fastMsg")
    first_safe_pos = handler.find('safe("')
    assert first_safe_pos == -1 or fast_msg_pos < first_safe_pos, (
        "fastMsg capture must happen BEFORE any safe() call in the "
        "error handler — otherwise a diagnostic throw hides the "
        "actual error message."
    )


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))
