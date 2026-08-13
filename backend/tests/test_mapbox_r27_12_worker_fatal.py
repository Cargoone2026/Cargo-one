"""R27.12 — Blob-worker ReferenceError → fatal Google-fallback trigger.

R27.10 shipped mapbox-gl v2.15.0 to production. iPhone Safari evidence:
- Mapbox emits ZERO errors (mbErrorSigs: {})
- But 2 window.error captured from `blob:` URL:
    "message": "ReferenceError: Can't find variable: r"
    "source":  "blob:https://cargoone.co.uk/afb8537f-..."
- Tiles never render → map appears blank behind markers.

Both mapbox-gl v3 (`o`) AND v2 (`r`) exhibit the same class of iOS
Safari WebKit JIT ReferenceError inside the minified tile-decoding
worker. Mapbox itself has not fixed this in either major version.

R27.12: when we see the blob-source + ReferenceError signature and the
map has not loaded yet, bubble a fatal error so RouteMap dispatcher
falls back to Google (which renders perfectly on iOS Safari).
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


# ── (1) Worker ReferenceError detection lives in window.onerror path ────
def test_worker_ref_error_detected_in_window_onerror():
    body = _init_effect_scope()
    # Find the onWindowError handler.
    handler_start = body.index("const onWindowError = function")
    handler_end = body.index("const onUnhandledRejection", handler_start)
    handler = body[handler_start:handler_end]

    assert "fromBlobWorker" in handler, "blob-URL detection missing"
    assert "isRefErrPattern" in handler, "ReferenceError pattern detection missing"
    # Detects both v3 shape ("Can't find variable") and Chrome/Firefox shape ("is not defined").
    assert "Can't find variable:" in handler, "Safari ReferenceError pattern missing"
    assert "is not defined" in handler, "Chrome/Firefox ReferenceError pattern missing"


# ── (2) Only fatal when map hasn't loaded yet ─────────────────────────
def test_worker_ref_error_only_fatal_pre_load():
    body = _init_effect_scope()
    handler_start = body.index("const onWindowError = function")
    handler_end = body.index("const onUnhandledRejection", handler_start)
    handler = body[handler_start:handler_end]
    # Must gate the fatal on !hasLoaded.current
    m = re.search(
        r"if\s*\(\s*fromBlobWorker\s*&&\s*isRefErrPattern\s*&&\s*!hasLoaded\.current\s*\)",
        handler,
    )
    assert m, (
        "Worker-fatal path must be gated on !hasLoaded.current — otherwise "
        "post-load harmless worker errors would trigger unnecessary fallback."
    )


# ── (3) Falls back via setInitError + onError (dispatcher swap) ─────────
def test_worker_fatal_bubbles_via_on_error():
    body = _init_effect_scope()
    handler_start = body.index("const onWindowError = function")
    handler_end = body.index("const onUnhandledRejection", handler_start)
    handler = body[handler_start:handler_end]

    # The if-fatal branch must call BOTH setInitError and onError.
    fatal_idx = handler.index("if (fromBlobWorker")
    # Use a generous slice — the if-block body contains a try/catch so
    # we can't rely on the first `}`. Take a wide window.
    fatal_block = handler[fatal_idx:fatal_idx + 800]
    assert "setInitError(err)" in fatal_block, \
        "Worker fatal must call setInitError(err) so React state re-renders the fallback"
    assert "onError && onError(err)" in fatal_block, \
        "Worker fatal must call onError so RouteMap dispatcher swaps to Google"
    # And must log to the timeline for post-mortem.
    assert 'emit("map.worker.fatal"' in fatal_block, \
        "Worker fatal must emit a distinct timeline stage"


# ── (4) Regular js errors still counted, only worker+ref+preload is fatal
def test_regular_js_errors_still_counted():
    body = _init_effect_scope()
    handler_start = body.index("const onWindowError = function")
    handler_end = body.index("const onUnhandledRejection", handler_start)
    handler = body[handler_start:handler_end]
    # jsErrCount must still increment for EVERY window.error, regardless
    # of whether it's a worker-fatal or a regular error.
    assert "jsErrCount += 1" in handler, \
        "Every window.error must still increment jsErrCount"
    # Position of jsErrCount increment must be BEFORE the fatal check.
    inc_pos = handler.index("jsErrCount += 1")
    fatal_pos = handler.index("if (fromBlobWorker")
    assert inc_pos < fatal_pos, \
        "jsErrCount must be incremented before the worker-fatal check"


# ── (5) All R27.6–R27.11 invariants still hold ────────────────────────
def test_prior_invariants_hold():
    body = _init_effect_scope()
    # No object-literal getters.
    getters = re.findall(r"\bget\s+[A-Za-z_$][A-Za-z0-9_$]*\s*\(", body)
    assert getters == [], f"Object-literal getters reintroduced: {getters}"
    # safe() heavily used.
    assert body.count("safe(") >= 12
    # access_token stripped.
    assert "access_token=REDACTED" in SRC
    # transformRequest still returns undefined (R27.9).
    tr_idx = body.index("transformRequest: function")
    tr_end = body.index("},", tr_idx) + 2
    assert "return undefined" in body[tr_idx:tr_end]
    # Multi-signal ready still present (R27.9).
    assert "const flipReady" in body
    assert 'flipReady("idle")' in body
    assert 'flipReady("render-settled")' in body
    # v2 downgrade (R27.10) still present.
    assert 'streets-v11' in body, "Style URL must be v11 (matches mapbox-gl v2 runtime)"


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))
