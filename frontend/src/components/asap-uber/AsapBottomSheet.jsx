import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * AsapBottomSheet — draggable, snappable bottom sheet for the ASAP UX.
 *
 * Behaviour is intentionally close to native ride-hailing sheets:
 *   • 3 snap points: peek / half / full
 *   • Drag the top handle (or the pill area) to change snap
 *   • Momentum: fling up → snaps to next-up; fling down → next-down
 *   • Content region scrolls independently once at full snap
 *   • Backdrop is transparent — the map stays visible & interactive
 *     until the sheet is at `full`
 *
 * Snap points are computed from the parent's viewport height so the
 * component works consistently on phones, tablets and desktop. The
 * consumer can override with pixel-values via the `snapPoints` prop.
 *
 * Props:
 *   snap             — controlled current snap ('peek' | 'half' | 'full')
 *   onSnapChange     — (nextSnap) => void
 *   defaultSnap      — uncontrolled initial snap (default 'peek')
 *   snapPoints       — optional override { peek, half, full } in px
 *   header           — optional node rendered above the scroll region
 *                      (always visible; typically a status line + count)
 *   children         — the sheet body content (scrolls when full)
 *   maxWidth         — CSS max-width value for the sheet (default '640px')
 *   sheetTestId      — data-testid for the sheet element
 *
 * Layout: the sheet is `absolute inset-x-0 bottom-0` inside its parent.
 * It uses `translateY(<offset>)` transforms rather than resizing so the
 * animation is on the compositor thread (60fps on mobile).
 */

const DEFAULT_SNAP_POINTS_VH = { peek: 22, half: 55, full: 92 };
const DRAG_TRIGGER_PX = 40;      // min drag distance to change snap
const FLICK_VELOCITY_PX_MS = 0.6; // px/ms — beyond this counts as a "flick"

function usePointer(onStart, onMove, onEnd) {
  const active = useRef(false);
  return {
    onPointerDown: (e) => {
      // Ignore multi-touch (native browsers handle scroll from second finger).
      if (e.pointerType === "touch" && e.isPrimary === false) return;
      active.current = true;
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      onStart(e);
    },
    onPointerMove: (e) => {
      if (!active.current) return;
      onMove(e);
    },
    onPointerUp: (e) => {
      if (!active.current) return;
      active.current = false;
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      onEnd(e);
    },
    onPointerCancel: () => { active.current = false; },
  };
}

export function AsapBottomSheet({
  snap: controlledSnap,
  onSnapChange,
  defaultSnap = "peek",
  snapPoints,
  header,
  children,
  maxWidth = "640px",
  sheetTestId = "asap-bottom-sheet",
}) {
  const [uncontrolledSnap, setUncontrolledSnap] = useState(defaultSnap);
  const isControlled = controlledSnap !== undefined;
  const snap = isControlled ? controlledSnap : uncontrolledSnap;

  const [viewportH, setViewportH] = useState(
    typeof window !== "undefined" ? window.innerHeight : 800
  );
  useEffect(() => {
    const onResize = () => setViewportH(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const points = React.useMemo(
    () => snapPoints || {
      peek: Math.round(viewportH * (DEFAULT_SNAP_POINTS_VH.peek / 100)),
      half: Math.round(viewportH * (DEFAULT_SNAP_POINTS_VH.half / 100)),
      full: Math.round(viewportH * (DEFAULT_SNAP_POINTS_VH.full / 100)),
    },
    [snapPoints, viewportH]
  );

  const setSnap = useCallback(
    (next) => {
      if (isControlled) {
        onSnapChange && onSnapChange(next);
      } else {
        setUncontrolledSnap(next);
        onSnapChange && onSnapChange(next);
      }
    },
    [isControlled, onSnapChange]
  );

  const targetHeight = points[snap] || points.peek;

  const sheetRef = useRef(null);
  const dragState = useRef({ startY: 0, startHeight: 0, startTime: 0, dragging: false });
  const [dragHeight, setDragHeight] = useState(null); // px override during drag

  const beginDrag = useCallback(
    (e) => {
      dragState.current = {
        startY: e.clientY,
        startHeight: targetHeight,
        startTime: Date.now(),
        dragging: true,
      };
      setDragHeight(targetHeight);
    },
    [targetHeight]
  );

  const moveDrag = useCallback(
    (e) => {
      if (!dragState.current.dragging) return;
      const dy = dragState.current.startY - e.clientY; // + when dragging up
      const next = Math.min(
        points.full,
        Math.max(96, dragState.current.startHeight + dy) // never below the handle
      );
      setDragHeight(next);
    },
    [points.full]
  );

  const endDrag = useCallback(
    (e) => {
      if (!dragState.current.dragging) return;
      const dt = Math.max(1, Date.now() - dragState.current.startTime);
      const dy = dragState.current.startY - (e?.clientY ?? dragState.current.startY);
      const velocity = dy / dt;
      const finalHeight = dragHeight ?? targetHeight;

      // Determine snap: flick wins, otherwise nearest.
      let next = snap;
      if (Math.abs(velocity) > FLICK_VELOCITY_PX_MS && Math.abs(dy) > 10) {
        const order = ["peek", "half", "full"];
        const idx = order.indexOf(snap);
        next = order[Math.min(order.length - 1, Math.max(0, idx + (velocity > 0 ? 1 : -1)))];
      } else if (Math.abs(finalHeight - targetHeight) > DRAG_TRIGGER_PX) {
        // Nearest by height
        const entries = Object.entries(points);
        entries.sort((a, b) => Math.abs(a[1] - finalHeight) - Math.abs(b[1] - finalHeight));
        next = entries[0][0];
      }
      dragState.current.dragging = false;
      setDragHeight(null);
      if (next !== snap) setSnap(next);
    },
    [dragHeight, targetHeight, snap, points, setSnap]
  );

  const pointerHandlers = usePointer(beginDrag, moveDrag, endDrag);

  // Ensure sheet re-measures if the viewport height changes (rotation).
  useLayoutEffect(() => { setDragHeight(null); }, [viewportH]);

  const activeHeight = dragHeight != null ? dragHeight : targetHeight;

  return (
    <div
      ref={sheetRef}
      role="dialog"
      aria-label="ASAP status sheet"
      data-testid={sheetTestId}
      data-snap={snap}
      className="pointer-events-auto absolute inset-x-0 bottom-0 z-30 mx-auto flex flex-col rounded-t-3xl bg-white shadow-[0_-16px_40px_-16px_rgba(0,0,0,0.35)]"
      style={{
        height: `${activeHeight}px`,
        maxWidth,
        transition: dragState.current.dragging ? "none" : "height 220ms cubic-bezier(0.22, 1, 0.36, 1)",
        touchAction: "none",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {/* Handle + optional header — always draggable */}
      <div
        {...pointerHandlers}
        className="shrink-0 cursor-grab select-none px-4 pb-2 pt-2 active:cursor-grabbing"
        data-testid={`${sheetTestId}-handle`}
      >
        <div className="mx-auto h-1.5 w-10 rounded-full bg-neutral-300" aria-hidden="true" />
        {header ? <div className="mt-3">{header}</div> : null}
      </div>

      {/* Scrollable body — only scrolls at full snap so the map stays
          interactive at half/peek. */}
      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6"
        style={{ touchAction: snap === "full" ? "auto" : "none" }}
        data-testid={`${sheetTestId}-body`}
      >
        {children}
      </div>
    </div>
  );
}

export default AsapBottomSheet;
