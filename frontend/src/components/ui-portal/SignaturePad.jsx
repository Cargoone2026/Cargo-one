import React, { useCallback, useEffect, useRef, useState } from "react";
import { Eraser, Check } from "lucide-react";

/**
 * SignaturePad — HTML5 canvas port of the Expo SignaturePad.
 *
 * On lift, emits a base64 PNG data-URL via onChange. Fully
 * pointer-event-driven so it works on desktop mouse + mobile touch
 * without extra libraries.
 */
export function SignaturePad({
  onChange,
  height = 200,
  testID = "signature-pad",
}) {
  const canvasRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [empty, setEmpty] = useState(true);
  const lastRef = useRef(null);

  const setup = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    canvas.width = Math.floor(w * ratio);
    canvas.height = Math.floor(height * ratio);
    const ctx = canvas.getContext("2d");
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111111";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, height);
  }, [height]);

  useEffect(() => {
    setup();
    const onResize = () => setup();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [setup]);

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: (e.clientX ?? e.touches?.[0]?.clientX ?? 0) - rect.left,
      y: (e.clientY ?? e.touches?.[0]?.clientY ?? 0) - rect.top,
    };
  };

  const start = (e) => {
    e.preventDefault();
    setDrawing(true);
    lastRef.current = getPos(e);
  };
  const move = (e) => {
    if (!drawing) return;
    e.preventDefault();
    const p = getPos(e);
    const ctx = canvasRef.current.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(lastRef.current.x, lastRef.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastRef.current = p;
  };
  const end = () => {
    if (!drawing) return;
    setDrawing(false);
    setEmpty(false);
    const dataUrl = canvasRef.current.toDataURL("image/png");
    onChange?.(dataUrl);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.clientWidth, height);
    setEmpty(true);
    onChange?.(null);
  };

  return (
    <div className="rounded-[12px] border border-[#E5E7EB] bg-white" data-testid={testID}>
      <canvas
        ref={canvasRef}
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
        style={{ width: "100%", height, touchAction: "none", cursor: "crosshair" }}
        data-testid={`${testID}-canvas`}
      />
      <div className="flex items-center justify-between border-t border-[#E5E7EB] px-3 py-2 text-[12px]">
        <span className={`inline-flex items-center gap-1 ${empty ? "text-[#9CA3AF]" : "text-[#16A34A]"}`}>
          {empty ? "Sign above" : <><Check className="h-3.5 w-3.5" /> Captured</>}
        </span>
        <button
          type="button"
          onClick={clear}
          data-testid={`${testID}-clear`}
          className="inline-flex items-center gap-1 rounded-full bg-[#F4F4F4] px-3 py-1 text-[12px] font-semibold text-[#111111] hover:bg-[#E5E7EB]"
        >
          <Eraser className="h-3.5 w-3.5" />
          Clear
        </button>
      </div>
    </div>
  );
}
