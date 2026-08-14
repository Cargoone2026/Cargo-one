"""R34 — Driver Live Mode offers ordering regression.

Driver Live Mode ASAP offers list must render newest-first with a stable
tie-break by job_id, so a newly posted ASAP job appears at the top of
the list and identical timestamps don't cause the order to jump.
"""
from __future__ import annotations

import re
from pathlib import Path

import pytest

SRC = Path("/app/frontend/src/pages/portal/driver/Live.jsx").read_text()


# ── (1) useMemo-based sort exists ──────────────────────────────────────
def test_sorted_offers_use_memo_exists():
    assert "const sortedOffers" in SRC, "sortedOffers memoized derived state missing"
    assert "useMemo(" in SRC, "useMemo must be imported and used for the sort"


# ── (2) Sort is DESC on dispatch_ready_at (newest first) ───────────────
def test_sort_is_newest_first_by_dispatch_ready_at():
    # The sort comparator must reference dispatch_ready_at.
    assert "dispatch_ready_at" in SRC
    # Newest first == tb < ta returns -1 (for DESC string compare).
    m = re.search(r"tb\s*<\s*ta\s*\?\s*-1\s*:\s*1", SRC)
    assert m, "Comparator must be DESC (newest first) — 'tb < ta ? -1 : 1'"


# ── (3) Stable tie-break by job_id ─────────────────────────────────────
def test_stable_tiebreak_by_job_id():
    # Both a.job_id and b.job_id used in the comparator, DESC to match primary.
    assert "job_id" in SRC
    m = re.search(r"ib\s*<\s*ia\s*\?\s*-1\s*:\s*ib\s*>\s*ia\s*\?\s*1\s*:\s*0", SRC)
    assert m, "Tie-break must be a stable string compare on job_id"


# ── (4) Render uses sortedOffers, not raw offers ───────────────────────
def test_render_uses_sorted_offers():
    assert "{sortedOffers.map(" in SRC, \
        "Render loop must iterate sortedOffers, not the raw offers array"
    # The original offers.map at that location must be gone.
    # (offers.map may still appear in the .filter() call that removes an
    # offer after decline — that's fine.)
    lines = SRC.splitlines()
    # Only the sortedOffers.map should be inside a <ul>. Simple guard: the
    # exact prior render line must not exist.
    for i, ln in enumerate(lines):
        if ln.strip() == "{offers.map((o) => (":
            raise AssertionError(f"Line {i+1} still uses raw offers.map — must use sortedOffers")


# ── (5) Original offers state array is not mutated ─────────────────────
def test_sort_does_not_mutate_state():
    # We must clone before sort — otherwise React state mutation.
    m = re.search(r"const\s+arr\s*=\s*\[\.\.\.offers\]", SRC)
    assert m, "Sort must clone offers with [...offers] before .sort() to " \
              "avoid mutating React state"


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))
