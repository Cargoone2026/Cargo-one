"""R27.9 — Root-cause fix regression tests.

Based on documented Mapbox GL v3 iOS Safari behaviour:
  * `load` event is unreliable on iOS Safari (issue #8209, #6076, #13438)
  * `AbortError` events flood the error stream during rapid tile loads
    (issue #8480, #10498) — a WebKit browser bug, Mapbox recommends
    suppressing them.

R27.9 lands the ACTUAL fixes (no more diagnostic-only cycles):
  1. `transformRequest` returns `undefined` — no request rebuilding, no
     stripping of Mapbox-internal RequestParameters. Docs: "If the
     callback returns falsy, the original URL will be used, unmodified."
  2. Multi-signal ready detection: `flipReady()` fires on ANY of `load`,
     `idle`, or `firstRender + 1500ms no fresh errors`. Guarantees
     `ready=true` even when `load` never fires (iOS Safari case).
  3. `AbortError` suppression in `map.on('error')` — logged to timeline
     but never counted against error counters, never blocks ready-flip.
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


# ── (1) transformRequest returns undefined ─────────────────────────────
def test_transform_request_returns_undefined():
    body = _init_effect_scope()
    # Find the transformRequest function.
    tr_idx = body.index("transformRequest: function")
    tr_end = body.index("},", tr_idx) + 2
    tr_block = body[tr_idx:tr_end]
    # Must return undefined (or nothing / null equivalents).
    assert "return undefined" in tr_block, \
        "transformRequest must return undefined so Mapbox uses the " \
        "original request unmodified (preserves internal signal / " \
        "credentials / headers / referrerPolicy)."
    assert "return { url: url }" not in tr_block, \
        "transformRequest must NOT return `{ url: url }` — this rebuilds " \
        "the request and can strip Mapbox-internal properties on iOS Safari."


# ── (2) flipReady exists and is called from multiple signals ───────────
def test_flip_ready_multi_signal():
    body = _init_effect_scope()
    assert "const flipReady" in body, "flipReady() helper missing"
    # Called from at least three distinct signals.
    assert 'flipReady("load")' in body, "flipReady must be called from map.on('load')"
    assert 'flipReady("idle")' in body, "flipReady must be called from map.on('idle')"
    assert 'flipReady("render-settled")' in body, \
        "flipReady must be called from a render-settled fallback"


# ── (3) Idempotent flip (readyFlipped guard) ───────────────────────────
def test_flip_ready_is_idempotent():
    body = _init_effect_scope()
    assert "readyFlipped" in body, "readyFlipped guard variable missing"
    # flipReady must return early if already flipped.
    m = re.search(r"if\s*\(\s*readyFlipped\s*\)\s*return\s*;", body)
    assert m, "flipReady must early-return when readyFlipped is true"


# ── (4) AbortError is suppressed in map.on('error') ────────────────────
def test_abort_error_suppressed():
    body = _init_effect_scope()
    handler_start = body.index('map.on("error"')
    handler_end = body.index("mapRef.current = map;", handler_start)
    handler = body[handler_start:handler_end]
    assert 'fastErrType === "AbortError"' in handler or \
           "'AbortError'" in handler, \
        "AbortError must be detected by err.name"
    assert "isAbort" in handler, "isAbort branch missing"
    assert "aborterror.suppressed" in handler, \
        "Suppressed abort must be logged via a distinct stage"
    # Suppressed aborts must NOT increment error counters (early return).
    abort_block_idx = handler.index("if (isAbort)")
    abort_block_end = handler.index("return;", abort_block_idx) + 7
    abort_block = handler[abort_block_idx:abort_block_end]
    assert "otherErrCount +=" not in abort_block, \
        "AbortError branch must not increment otherErrCount"
    assert "return;" in abort_block, "AbortError branch must early-return"


# ── (5) Post-render abort opportunistically flips ready ────────────────
def test_post_render_abort_flips_ready():
    body = _init_effect_scope()
    assert 'flipReady("abort-post-render")' in body, \
        "After firstRender, an AbortError storm must opportunistically " \
        "flip ready — otherwise iOS Safari would remain stuck on the " \
        "abort loop forever."


# ── (6) Render-settled timer cleaned up on unmount ────────────────────
def test_render_ready_timer_cleaned_up():
    body = _init_effect_scope()
    assert "renderReadyTimer" in body
    assert "clearTimeout(renderReadyTimer)" in body, \
        "renderReadyTimer must be cleared on unmount"


# ── (7) load event still supported (happy path) ────────────────────────
def test_happy_path_load_still_supported():
    body = _init_effect_scope()
    # Find the ACTUAL map.on("load") code (not the comment mentioning it).
    # Search for the function-call form (has `, function(`).
    m = re.search(r'map\.on\(\s*"load"\s*,\s*function', body)
    assert m, "map.on('load', function() {...}) code missing"
    load_block = body[m.start():m.start() + 200]
    assert 'flipReady("load")' in load_block, \
        "Happy-path load event must call flipReady('load')"


# ── (8) All R27.6/7/8 invariants still hold ───────────────────────────
def test_r27_invariants_still_hold():
    body = _init_effect_scope()
    # No object-literal getters.
    getters = re.findall(r"\bget\s+[A-Za-z_$][A-Za-z0-9_$]*\s*\(", body)
    assert getters == [], f"Object-literal getters reintroduced: {getters}"
    # safe() still exists.
    assert body.count("safe(") >= 12
    # access_token still stripped.
    assert "access_token=REDACTED" in SRC
    # Fast-path capture still exists.
    assert "fastMsg" in body
    # safeStr still exists.
    assert "const safeStr" in body


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))
