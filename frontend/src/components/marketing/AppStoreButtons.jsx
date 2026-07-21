import React from "react";
import { Apple, Play } from "lucide-react";

export function AppStoreButtons({ onWhite = false }) {
  const bg = onWhite ? "#111" : "#fff";
  const fg = onWhite ? "#fff" : "#111";
  const border = onWhite ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.15)";

  const btnStyle = {
    backgroundColor: bg,
    color: fg,
    borderColor: border,
  };

  return (
    <div className="flex flex-wrap gap-3">
      <a
        href="https://apps.apple.com/app/cargo-one"
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-w-[160px] items-center gap-2 rounded-xl border px-4 py-2.5"
        style={btnStyle}
      >
        <Apple className="h-6 w-6" />
        <div>
          <div className="text-[10px] font-medium tracking-wide">
            Download on the
          </div>
          <div className="-mt-0.5 text-[16px] font-bold">App Store</div>
        </div>
      </a>
      <a
        href="https://play.google.com/store/apps/details?id=com.cargoone.app"
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-w-[160px] items-center gap-2 rounded-xl border px-4 py-2.5"
        style={btnStyle}
      >
        <Play className="h-6 w-6" />
        <div>
          <div className="text-[10px] font-medium tracking-wide">Get it on</div>
          <div className="-mt-0.5 text-[16px] font-bold">Google Play</div>
        </div>
      </a>
    </div>
  );
}
