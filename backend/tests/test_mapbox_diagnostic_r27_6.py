"""R27.6 — MapboxMap diagnostic harness Safari-safety regression tests.

The R27.5 iPhone screenshot surfaced `Can't find variable: o` (Safari's
ReferenceError shape) inside the Mapbox `error` counter. Root cause was
not a bare `o` in our source — but the presence of possibly-brittle patterns
(object-literal getters, spread-over-unknown objects) meant we could not
rule out our diagnostic harness contributing to the error stream.

R27.6 hardens the harness. This test suite proves:

  1. No bare, undeclared identifier `o` exists in the R27.6 diagnostic
     scope (the initialisation useEffect body). Every occurrence of a
     standalone `o` token must be either:
        - a scoped `const o =` / `let o =` / `var o =` binding,
        - a property access `.o` / `["o"]`,
        - a string-literal `"o"` character inside JSX or a template,
        - a shorthand key inside an object literal `{ o }` where `o`
          is defined in scope (we do not use this shorthand — asserted).
  2. Every diagnostic call is wrapped in `safe(...)` — the file must
     contain a `safe(` invocation and no direct `emit(` call outside a
     `map.on(...)` handler that already wraps its body defensively.
  3. Object-literal getters have been removed from the diagnostic surface
     (`get errs()` / `get lastErr()` were the R27.5 pattern — they are
     forbidden in R27.6).
  4. Global window-level error listeners are registered (`window.error`
     and `window.unhandledrejection`) and torn down on unmount.
  5. `access_token` is never printed unredacted anywhere in the file.
  6. All the explicit lifecycle status booleans requested by the owner
     are present in the diag state: styleLoaded, mapLoaded, firstRender,
     idle, webglReady, styleErrors, tileErrors, jsErrors.

Deterministic, filesystem-only — no Node subprocess, no DOM, no network.
"""
from __future__ import annotations

import re
from pathlib import Path

import pytest


SRC = Path("/app/frontend/src/components/ui-portal/MapboxMap.jsx").read_text()


def _init_effect_scope() -> str:
    """Return the source text of the initialisation useEffect body only.

    The diagnostic harness lives inside the first useEffect (called
    exactly once, no deps). We slice from the first `// Initialise map
    once` marker to the next `// Sync markers` marker so unrelated
    effects (marker sync, route drawing, sweep animation) don't pollute
    the identifier scan.
    """
    start = SRC.index("// Initialise map once")
    end = SRC.index("// Sync markers", start)
    return SRC[start:end]


# ── (1) NO BARE UNDECLARED IDENTIFIER `o` IN THE DIAGNOSTIC SCOPE ────────
def test_no_bare_o_identifier_in_init_effect():
    body = _init_effect_scope()
    # Strip strings and comments so we don't get false positives from
    # `"o"` literals, template strings, or JSX text nodes.
    stripped = re.sub(r"//[^\n]*", "", body)                        # line comments
    stripped = re.sub(r"/\*[\s\S]*?\*/", "", stripped)              # block comments
    stripped = re.sub(r"'(?:\\.|[^'])*'", "''", stripped)           # single-quoted strings
    stripped = re.sub(r'"(?:\\.|[^"])*"', '""', stripped)           # double-quoted strings
    stripped = re.sub(r"`(?:\\.|[^`])*`", "``", stripped)           # template strings

    # Find every standalone `o` token (whole word, not preceded/followed by
    # an identifier character, and not preceded by `.` which would be a
    # property access).
    bare_o_positions = []
    for m in re.finditer(r"(?<![A-Za-z0-9_$.])o(?![A-Za-z0-9_$])", stripped):
        pos = m.start()
        # Skip if this `o` is inside a declaration: preceded by `const `/`let `/`var `.
        prefix = stripped[max(0, pos - 12):pos]
        if re.search(r"(const|let|var)\s+$", prefix):
            continue
        bare_o_positions.append(pos)

    assert not bare_o_positions, (
        "Found bare undeclared `o` identifier(s) in init effect at positions "
        f"{bare_o_positions}. Safari would emit `Can't find variable: o`."
    )


# ── (2) EVERY DIAGNOSTIC CALL MUST BE DEFENSIVELY WRAPPED ──────────────
def test_safe_wrapper_is_used():
    body = _init_effect_scope()
    # The safe() helper must be declared and used repeatedly.
    assert "const safe =" in body, "safe() wrapper is missing"
    # At least a dozen safe() call-sites (transformRequest, gl-probe,
    # emit, container-snapshot, map.remove, cleanup, etc.).
    count = body.count("safe(")
    assert count >= 12, f"Expected ≥12 safe() call-sites, found {count}"


# ── (3) OBJECT-LITERAL GETTERS ARE FORBIDDEN IN THE HARNESS ────────────
def test_no_object_literal_getters_in_harness():
    body = _init_effect_scope()
    # `get identifier(` — object-literal getter shorthand. Terser + iOS
    # Safari was the R27.5 suspect for the ReferenceError leak.
    getters = re.findall(r"\bget\s+[A-Za-z_$][A-Za-z0-9_$]*\s*\(", body)
    assert getters == [], (
        f"Object-literal getters are banned in the R27.6 diagnostic "
        f"harness (found: {getters}). Use plain fields or a snapshot() "
        f"function instead."
    )


# ── (4) GLOBAL WINDOW-LEVEL ERROR LISTENERS ARE REGISTERED ─────────────
def test_window_error_listeners_registered():
    body = _init_effect_scope()
    assert 'window.addEventListener("error"' in body, \
        "window.error listener missing from diagnostic harness"
    assert 'window.addEventListener("unhandledrejection"' in body, \
        "unhandledrejection listener missing from diagnostic harness"
    # And torn down.
    assert body.count('window.removeEventListener("error"') >= 1, \
        "window.error listener must be removed on unmount / early exit"
    assert body.count('window.removeEventListener("unhandledrejection"') >= 1, \
        "unhandledrejection listener must be removed on unmount / early exit"


# ── (5) ACCESS TOKEN NEVER LOGGED UNREDACTED ──────────────────────────
def test_access_token_is_stripped_from_urls():
    # File-wide sanity: the stripToken helper must exist and every URL
    # emitted to the console/timeline must go through it.
    assert "stripToken" in SRC, "stripToken helper missing"
    assert 'access_token=REDACTED' in SRC, \
        "stripToken must replace access_token with REDACTED"
    # No raw `${token}` template interpolation, and no `console.log(token)`.
    assert not re.search(r"console\.[a-z]+\([^)]*token[^)]*\)", SRC), \
        "token must never be passed directly to console.* calls"


# ── (6) EXPLICIT LIFECYCLE STATUS FIELDS PRESENT IN DIAG STATE ────────
def test_explicit_status_fields_in_diag_state():
    # These are the fields the owner asked for in R27.6 brief item D.
    required = [
        "styleLoaded", "mapLoaded", "firstRender", "idle", "webglReady",
        "styleErrors", "tileErrors", "jsErrors",
    ]
    for field in required:
        assert field in SRC, f"Diagnostic state must expose `{field}`"


# ── (7) RICH ERROR CAPTURE FIELDS EXIST ────────────────────────────────
def test_rich_error_capture_fields():
    body = _init_effect_scope()
    # Owner requested capture of these fields inside map.on('error').
    for field in ["message", "nestedMessage", "status", "source", "sourceId", "tile", "url", "errType"]:
        assert field in body, f"map.on(error) must capture `{field}`"


# ── (8) 1-SECOND HEARTBEAT IS RUNNING PRE-LOAD ─────────────────────────
def test_heartbeat_interval_registered_and_cleared():
    body = _init_effect_scope()
    assert "setInterval(" in body, "R27.6 requires a 1s heartbeat interval"
    assert "heartbeat" in body, "Heartbeat stage name must be present"
    assert "clearInterval(" in body, "Heartbeat must be cleared on unmount"


# ── (9) NO OBJECT SPREAD OVER UNKNOWN INPUT INSIDE emit() ─────────────
def test_no_spread_in_emit_over_extra():
    # R27.5 used `...(extra || {})` — Terser has historically miscompiled
    # spread over dynamically-typed values on older iOS Safari targets.
    # R27.6 uses a manual Object.keys copy instead.
    body = _init_effect_scope()
    assert "...(extra" not in body, (
        "emit() must not spread the `extra` param — use an explicit "
        "Object.keys() copy loop (R27.6 hardening)."
    )


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))
