"""R27.7 — Diagnostic error surfacing regression tests.

R27.6 gave us the concrete iPhone state:
    gl✓ style✓ load✗ R✓ idle✗
    req: s2 t4 g0 sp0 o0
    errs: st0 ti0 ot4 js4

R27.7 exposes the ACTUAL text of those 4 Mapbox + 4 JS errors on the
overlay AND on `window.__mapboxDiag__.current`. This test suite proves
the R27.7 additions are in place and the code stays Safari-safe.
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


# ── (1) Rich record fields on the Mapbox error handler ──────────────────
def test_mapbox_error_record_has_all_required_fields():
    body = _init_effect_scope()
    for field in [
        "timestamp", "message", "nestedMessage", "status", "source",
        "sourceId", "tile", "url", "errType", "errKind",
        "precedingStage", "precedingReqUrl", "styleState",
    ]:
        assert field in body, f"map.on(error) record missing `{field}`"


# ── (2) Signature-counting for Mapbox + JS errors ──────────────────────
def test_signature_buckets_exist_for_mb_and_js_errors():
    body = _init_effect_scope()
    assert "mbErrorSigs" in body, "Mapbox error signature bucket missing"
    assert "jsErrorSigs" in body, "JS error signature bucket missing"
    # Both buckets must increment on each error record.
    assert "mbErrorSigs[sigKey]" in body, "Mapbox signature increment missing"
    assert "jsErrorSigs[sigKey]" in body, "JS signature increment missing"


# ── (3) lastMapboxError + lastJSError exposed via accessor functions ──
def test_last_error_accessors_exposed_via_global():
    body = _init_effect_scope()
    assert "getLastMapboxError" in body, \
        "window.__mapboxDiag__.current.getLastMapboxError() not exposed"
    assert "getLastJSError" in body, \
        "window.__mapboxDiag__.current.getLastJSError() not exposed"
    # And the accessors must not be object-literal getters (R27.6 rule).
    assert not re.search(r"\bget\s+lastMapboxError\s*\(", body)
    assert not re.search(r"\bget\s+lastJSError\s*\(", body)


# ── (4) Per-lifecycle-event counters (styledata/sourcedata/data/render/idle)
def test_lifecycle_event_counters_present():
    body = _init_effect_scope()
    assert "eventCounts" in body, "eventCounts object missing"
    for evname in ["styledata", "sourcedata", "data", "render", "idle"]:
        assert f"eventCounts.{evname}" in body, \
            f"eventCounts.{evname} increment missing"


# ── (5) Overlay renders actual MBERR / JSERR text ────────────────────
def test_overlay_shows_actual_error_text():
    # These strings must appear in the JSX overlay so the user's next
    # iPhone screenshot shows the actual error message.
    assert "MBERR" in SRC, "Overlay must show `MBERR:` line with actual message"
    assert "JSERR" in SRC, "Overlay must show `JSERR:` line with actual message"
    # And must show whether errors are the same or distinct.
    assert "mbErrDistinct" in SRC, "Overlay must render mbErrDistinct count"
    assert "jsErrDistinct" in SRC, "Overlay must render jsErrDistinct count"


# ── (6) Preceding stage + preceding req URL correlated with error ──────
def test_error_records_include_preceding_context():
    body = _init_effect_scope()
    # Every rich error record must reference lastStage and lastReqUrl.
    assert "precedingStage: lastStage" in body, \
        "Mapbox error record must snapshot precedingStage"
    assert "precedingReqUrl: lastReqUrl" in body, \
        "Mapbox error record must snapshot precedingReqUrl"


# ── (7) Safe style-state snapshot (Task 8) ─────────────────────────────
def test_safe_style_state_snapshot_on_error():
    body = _init_effect_scope()
    # Layers + sources counts, but no full-dump.
    assert "map.getStyle" in body, "Error handler must call map.getStyle()"
    assert "s.layers" in body, "Style state must include layers count"
    assert "s.sources" in body, "Style state must include sources count"
    # Must be wrapped in a try/catch (getStyle can throw if the map is torn down).
    # The pattern is a try{}catch(_){} block around getStyle usage.
    assert re.search(r"try\s*\{[^}]*map\.getStyle", body), \
        "map.getStyle() must be try/catch wrapped"


# ── (8) window.onerror + unhandledrejection capture stack + line/column
def test_window_error_records_are_rich():
    body = _init_effect_scope()
    # window.onerror path must capture line, column, stack, source.
    error_scope_start = body.index("onWindowError")
    error_scope_end = body.index("onUnhandledRejection", error_scope_start)
    win_err = body[error_scope_start:error_scope_end]
    for field in ["line", "column", "stack", "source"]:
        assert field in win_err, f"window.onerror record missing `{field}`"


# ── (9) All R27.6 safety invariants still hold ────────────────────────
def test_r27_6_invariants_still_pass():
    body = _init_effect_scope()
    # Still no object-literal getters in the harness.
    getters = re.findall(r"\bget\s+[A-Za-z_$][A-Za-z0-9_$]*\s*\(", body)
    assert getters == [], f"Object-literal getters reintroduced: {getters}"
    # safe() is still used heavily.
    assert body.count("safe(") >= 12
    # access_token still stripped.
    assert "access_token=REDACTED" in SRC


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))
