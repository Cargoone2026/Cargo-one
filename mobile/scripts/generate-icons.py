#!/usr/bin/env python3
"""
Icon + splash generator for CargoOne Customer and Driver.

Reads the ORIGINAL box glyph from a stable snapshot in
`mobile/scripts/icon-master.png` (a copy of the driver icon captured
before any regeneration). Compositions match the reference screenshots
supplied by the product owner:

  Customer:  full-bleed terracotta #BA3A39, cream cube glyph,
             "Customer" below in near-black.
  Driver:    full-bleed black #0A0A0A, terracotta cube glyph,
             "Driver" below in white.

Text is horizontally centered on the CANVAS (not on the visible glyph
bbox) and vertically placed such that (gap-above-text) ≈ (gap-below-
text), reproducing the visual composition of the reference tiles.

Idempotent: subsequent runs re-read `icon-master.png`, never the
generated outputs, so the box glyph cannot accumulate baked-in text.
"""
from PIL import Image, ImageDraw, ImageFont, ImageChops
import os, sys

ROOT = os.path.join(os.path.dirname(__file__), "..")
MASTER = os.path.join(os.path.dirname(__file__), "icon-master.png")
FONT   = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"

TERRACOTTA_BG = (186, 58, 57)
SPLASH_RED    = (214, 40, 40)
DRIVER_BLACK  = (10, 10, 10)
CUSTOMER_TEXT = (30, 27, 24)
CUSTOMER_BOX  = (250, 240, 230)
DRIVER_TEXT   = (255, 255, 255)
DRIVER_BOX    = (192, 74, 74)


def load_master_rgba() -> Image.Image:
    """Extract the box glyph from the master snapshot: any pixel whose
    RGB deviates from solid (10,10,10) is glyph. Alpha is a smooth
    ramp — 25/255 threshold suppresses PNG noise, then 10× ramp
    preserves anti-aliased edges without introducing halos."""
    im = Image.open(MASTER).convert("RGB")
    W, H = im.size
    solid = Image.new("RGB", (W, H), DRIVER_BLACK)
    diff = ImageChops.difference(im, solid).convert("L")
    lut = [0 if v < 25 else min(255, (v - 25) * 10) for v in range(256)]
    alpha = diff.point(lut)
    # Master PNG has stray anti-aliasing specks along the outer edges
    # (visible as ~5 near-white pixels at x≈30 on rows 0 and 1023).
    # Zero any alpha within the outer 8% border so only the centered
    # box glyph survives. The real glyph bounding box lives well inside
    # this safe zone (bbox ≈ 287,152 → 737,851 on 1024²).
    margin = int(min(W, H) * 0.08)
    from PIL import ImageDraw as _ID
    mask = Image.new("L", (W, H), 0)
    _ID.Draw(mask).rectangle((margin, margin, W - margin, H - margin), fill=255)
    alpha = ImageChops.multiply(alpha, mask.point(lambda v: 255 if v else 0))
    out = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    out.paste(im.convert("RGBA"), (0, 0), alpha)
    return out


def recolor(rgba: Image.Image, rgb: tuple) -> Image.Image:
    r, g, b, a = rgba.split()
    solid = Image.new("RGB", rgba.size, rgb)
    rr, gg, bb = solid.split()
    return Image.merge("RGBA", (rr, gg, bb, a))


def tight_crop(rgba: Image.Image) -> Image.Image:
    return rgba.crop(rgba.split()[-1].getbbox())


def compose(bg, glyph_rgba, size, label, label_color,
            glyph_h_frac, glyph_top_frac,
            text_h_frac, gap_frac):
    """
    Composition strategy (matches reference tiles):
      - Glyph is scaled so its VISIBLE height == glyph_h_frac * canvas_h.
      - Glyph top edge sits at glyph_top_frac * canvas_h.
      - Text baseline is placed `gap_frac * canvas_h` below the glyph's
        bottom edge, then the text block is centered on canvas width.

    Both glyph and text are horizontally centered on the canvas x-axis,
    guaranteeing the cube+word appear as one centered composition.
    """
    W, H = size
    canvas = Image.new("RGB", (W, H), bg)

    # --- Glyph ---
    g = tight_crop(glyph_rgba)
    gw, gh = g.size
    target_h = int(H * glyph_h_frac)
    target_w = int(gw * target_h / gh)
    g = g.resize((target_w, target_h), Image.LANCZOS)
    gx = (W - target_w) // 2
    gy = int(H * glyph_top_frac)
    canvas.paste(g, (gx, gy), g)

    # --- Text ---
    font_size = int(H * text_h_frac)
    font = ImageFont.truetype(FONT, font_size)
    d = ImageDraw.Draw(canvas)
    bb = d.textbbox((0, 0), label, font=font)
    tw = bb[2] - bb[0]
    th = bb[3] - bb[1]
    tx = (W - tw) // 2 - bb[0]        # centered horizontally on canvas
    ty = gy + target_h + int(H * gap_frac) - bb[1]
    d.text((tx, ty), label, fill=label_color, font=font)
    return canvas


def main():
    if not os.path.exists(MASTER):
        print(f"FATAL: master snapshot missing at {MASTER}", file=sys.stderr)
        sys.exit(1)

    master = load_master_rgba()
    print(f"master alpha bbox: {master.split()[-1].getbbox()}")

    cust = recolor(master, CUSTOMER_BOX)
    drv  = recolor(master, DRIVER_BOX)

    # Reference composition (from screenshot 3):
    #   Icon tile ≈ 480px; cube ≈ 180px tall @ y≈95; text ≈ 30px @ y≈325.
    #   → glyph_h_frac ≈ 0.375,  glyph_top_frac ≈ 0.195,
    #     text_h_frac  ≈ 0.075,  gap_frac       ≈ 0.075.
    ICON = dict(size=(1024, 1024),
                glyph_h_frac=0.38, glyph_top_frac=0.19,
                text_h_frac=0.095, gap_frac=0.070)

    # Splash: same aspect but glyph smaller relative to canvas
    # (reference not supplied for splash; keeps existing centered feel).
    SPLASH_C = dict(size=(2732, 2732),
                    glyph_h_frac=0.24, glyph_top_frac=0.34,
                    text_h_frac=0.055, gap_frac=0.045)
    SPLASH_D = dict(size=(1024, 1024),
                    glyph_h_frac=0.30, glyph_top_frac=0.28,
                    text_h_frac=0.070, gap_frac=0.055)

    outputs = [
        (f"{ROOT}/apps/customer/assets/icon.png",
         compose(TERRACOTTA_BG, cust, label="Customer",
                 label_color=CUSTOMER_BOX, **ICON)),
        (f"{ROOT}/apps/customer/assets/adaptive-icon.png",
         compose(TERRACOTTA_BG, cust, label="Customer",
                 label_color=CUSTOMER_BOX, **ICON)),
        (f"{ROOT}/apps/customer/assets/loading-mark.png",
         compose(TERRACOTTA_BG, cust, label="Customer",
                 label_color=CUSTOMER_BOX, **ICON)),
        (f"{ROOT}/apps/customer/assets/splash-icon.png",
         compose(SPLASH_RED, cust, label="Customer",
                 label_color=CUSTOMER_BOX, **SPLASH_C)),

        (f"{ROOT}/apps/driver/assets/icon.png",
         compose(DRIVER_BLACK, drv, label="Driver",
                 label_color=DRIVER_TEXT, **ICON)),
        (f"{ROOT}/apps/driver/assets/adaptive-icon.png",
         compose(DRIVER_BLACK, drv, label="Driver",
                 label_color=DRIVER_TEXT, **ICON)),
        (f"{ROOT}/apps/driver/assets/loading-mark.png",
         compose(DRIVER_BLACK, drv, label="Driver",
                 label_color=DRIVER_TEXT, **ICON)),
        (f"{ROOT}/apps/driver/assets/splash-icon.png",
         compose(DRIVER_BLACK, drv, label="Driver",
                 label_color=DRIVER_TEXT, **SPLASH_D)),
    ]
    for path, img in outputs:
        img.save(path, "PNG", optimize=True)
        px = img.load()
        W, H = img.size
        corners = {px[0, 0], px[W-1, 0], px[0, H-1], px[W-1, H-1]}
        assert len(corners) == 1, f"non-uniform bg in {path}: {corners}"
        print(f"OK {os.path.relpath(path, ROOT)} {img.size} corner={corners.pop()}")


if __name__ == "__main__":
    main()
