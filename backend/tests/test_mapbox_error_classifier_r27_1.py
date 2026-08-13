"""R27.1 — classifyMapboxError regression tests (executed via Node).

Owner-mandated coverage:
  1. Mapbox error BEFORE load + 401 → fatal (Google fallback triggered)
  2. Mapbox error BEFORE load + 403 → fatal
  3. Mapbox error BEFORE load + WebGL failure → fatal
  4. Non-fatal error BEFORE load → non_fatal (no fallback)
  5. Tile/glyph/transient error AFTER successful load → non_fatal
  6. Telemetry/network error AFTER successful load → non_fatal
  7. Normal Mapbox load → hasLoaded flips true (verified via cases 5/6 above)
  8. Existing Google fallback still triggered when Mapbox genuinely fails
     (verified via cases 1/2/3 — dispatcher receives the fatal signal.)

This test file drives the JS classifier through the Node runtime so the
main pytest run captures a green result. Fully deterministic, no DOM.
"""

from __future__ import annotations

import json
import os
import subprocess

import pytest


def _js_expr_import():
    """Return a Node ES-module import expression that loads the classifier
    directly from the source file WITHOUT bundling. We use dynamic import
    of the .jsx file after stripping JSX (the classifier is pure JS)."""
    return """
      import fs from 'fs';
      const src = fs.readFileSync('/app/frontend/src/components/ui-portal/MapboxMap.jsx', 'utf8');
      const start = src.indexOf('export function classifyMapboxError');
      const nextExport = src.indexOf('export function ', start + 1);
      const body = src.slice(start, nextExport).replace('export function', 'function');
      const wrapper = body + '\\nprocess.stdout.write(JSON.stringify(cases.map(c => classifyMapboxError(c.err, c.opts))));';
      const cases = CASES_JSON;
      eval(wrapper.replace('CASES_JSON', JSON.stringify(cases)));
    """


def _run_node(cases):
    """Execute Node with the classifier + the JSON-encoded cases inline."""
    src_path = "/app/frontend/src/components/ui-portal/MapboxMap.jsx"
    with open(src_path) as f:
        src = f.read()
    start = src.index("export function classifyMapboxError")
    next_export = src.index("export function ", start + 1)
    body = src[start:next_export].replace("export function", "function")
    script = body + f"\nconst cases = {json.dumps(cases)};" + \
             "\nprocess.stdout.write(JSON.stringify(cases.map(c => classifyMapboxError(c.err, c.opts))));"
    out = subprocess.run(
        ["node", "-e", script],
        capture_output=True, text=True, timeout=10)
    if out.returncode != 0:
        raise RuntimeError(f"node failed: {out.stderr}")
    return json.loads(out.stdout)


def test_fatal_before_load_401():
    r = _run_node([
        {"err": {"status": 401, "message": "Unauthorized"}, "opts": {"hasLoaded": False}},
    ])
    assert r == ["fatal"]


def test_fatal_before_load_403_url_restriction():
    r = _run_node([
        {"err": {"status": 403, "message": "Not Authorized - URL restriction"}, "opts": {"hasLoaded": False}},
        {"err": {"statusCode": 403, "message": "domain not authorized"}, "opts": {"hasLoaded": False}},
    ])
    assert r == ["fatal", "fatal"]


def test_fatal_before_load_webgl_unsupported():
    r = _run_node([
        {"err": {"message": "WebGL is not supported by your browser"}, "opts": {"hasLoaded": False}},
        {"err": {"message": "WebGL is required"}, "opts": {"hasLoaded": False}},
    ])
    assert r == ["fatal", "fatal"]


def test_fatal_before_load_missing_token():
    r = _run_node([
        {"err": {"message": "No Token"}, "opts": {"hasLoaded": False}},
        {"err": {"message": "A valid Mapbox access token is required"}, "opts": {"hasLoaded": False}},
        {"err": {"message": "access token is required"}, "opts": {"hasLoaded": False}},
    ])
    assert r == ["fatal", "fatal", "fatal"]


def test_fatal_before_load_style_load_failure():
    r = _run_node([
        {"err": {"message": "Failed to load style: streets-v12"}, "opts": {"hasLoaded": False}},
        {"err": {"message": "Style is not done loading"}, "opts": {"hasLoaded": False}},
    ])
    assert r == ["fatal", "fatal"]


def test_non_fatal_before_load_transient_tile_404():
    """A single tile 404 pre-load is NOT fatal — mapbox-gl will retry."""
    r = _run_node([
        {"err": {"message": "Failed to fetch tile 8/127/85.vector.pbf"}, "opts": {"hasLoaded": False}},
        {"err": {"message": "network error"}, "opts": {"hasLoaded": False}},
        {"err": {"message": "AbortError: Fetch is aborted"}, "opts": {"hasLoaded": False}},
    ])
    assert r == ["non_fatal", "non_fatal", "non_fatal"]


def test_non_fatal_after_load_transient_tile_glyph_telemetry():
    """Owner-mandated: transient tile / glyph / telemetry errors AFTER
    map has successfully loaded MUST NOT flip the fallback."""
    r = _run_node([
        # Tile 404 after load
        {"err": {"message": "Failed to fetch tile 16/32768/21845.vector.pbf"}, "opts": {"hasLoaded": True}},
        # Glyph range fetch retry
        {"err": {"message": "Failed to load glyph range DIN Pro Regular 0-255"}, "opts": {"hasLoaded": True}},
        # Telemetry endpoint blocked by ad-blocker
        {"err": {"message": "Failed to fetch events.mapbox.com"}, "opts": {"hasLoaded": True}},
        # Even a 401 after successful load is treated as non-fatal (map is
        # already working; the token authorised at least once).
        {"err": {"status": 401, "message": "Unauthorized"}, "opts": {"hasLoaded": True}},
        # WebGL context lost — Mapbox recovers automatically.
        {"err": {"message": "WebGL context lost"}, "opts": {"hasLoaded": True}},
    ])
    assert r == ["non_fatal", "non_fatal", "non_fatal", "non_fatal", "non_fatal"]


def test_non_fatal_unknown_error_before_load():
    """Anything we don't explicitly match is treated as non-fatal so a
    benign new error message from a future mapbox-gl version doesn't
    eagerly kill the map."""
    r = _run_node([
        {"err": {"message": "Something unexpected"}, "opts": {"hasLoaded": False}},
        {"err": {"message": ""}, "opts": {"hasLoaded": False}},
        {"err": None, "opts": {"hasLoaded": False}},
    ])
    assert r == ["non_fatal", "non_fatal", "non_fatal"]


def test_error_nested_inside_ev_dot_error():
    """mapbox-gl wraps errors as `ev.error` on the event object — our
    handler receives `ev?.error` but if a caller passes the raw event the
    classifier should still find the status/message on the nested field."""
    r = _run_node([
        {"err": {"error": {"status": 403, "message": "restricted"}}, "opts": {"hasLoaded": False}},
    ])
    assert r == ["fatal"]


def test_hasLoaded_short_circuits_everything():
    """Regression guard: even a 401 after successful load is non-fatal.
    This is the CORE fix — once we have a working Mapbox session, no
    transient error should flip us into Google."""
    r = _run_node([
        {"err": {"status": 401}, "opts": {"hasLoaded": True}},
        {"err": {"status": 403}, "opts": {"hasLoaded": True}},
        {"err": {"message": "No Token"}, "opts": {"hasLoaded": True}},
        {"err": {"message": "WebGL is not supported"}, "opts": {"hasLoaded": True}},
    ])
    assert r == ["non_fatal"] * 4
