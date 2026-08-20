"""Generate CargoOne CUSTOMER-app icons (dimensional isometric parcel cube).

Produces:
  apps/customer/assets/icon.png            1024x1024  iOS + fallback app icon
  apps/customer/assets/adaptive-icon.png   1024x1024  Android adaptive icon foreground (transparent bg)
  apps/customer/assets/splash-icon.png      512x512   Expo splash logo (transparent bg, red mark)
  apps/customer/assets/loading-mark.png     512x512   In-app loading spinner mark (red on transparent)

Design matches the supplied reference:
  DEFAULT variant  — red rounded-square (#D62828) + white 3D parcel cube
  DARK variant     — kept for future driver app (not written here)

The cube is an isometric projection with the top rhombus split by a
vertical seam to evoke the two package flaps.
"""
import cairosvg
from PIL import Image
from io import BytesIO
import os

OUT = "/app/mobile/apps/customer/assets"
os.makedirs(OUT, exist_ok=True)

RED = "#D62828"
WHITE = "#FFFFFF"
CUBE_LEFT_SHADE = "#F5F5F5"     # front-left face — near-white
CUBE_RIGHT_SHADE = "#E8E8E8"    # front-right face — slightly darker for depth
SEAM = "#D62828"                 # top-flap seam (matches bg red, gives clean cut)
EDGE = "#C42323"                 # subtle darker red for cube edges

# 1024-canvas geometry — cube vertices (isometric 30°)
CANVAS = 1024
CX = 512
# Cube edges: N=top, E=right-top, S=front-top (where 3 faces meet), W=left-top
# BL=bottom-left, BR=bottom-right, BF=bottom-front
CUBE = dict(
    N=(512, 178),
    E=(806, 348),
    S=(512, 518),
    W=(218, 348),
    BF=(512, 858),
    BL=(218, 688),
    BR=(806, 688),
)

def poly(pts, fill, stroke=None, sw=0):
    p = " ".join(f"{x},{y}" for x, y in pts)
    s = f' stroke="{stroke}" stroke-width="{sw}" stroke-linejoin="round"' if stroke else ""
    return f'<polygon points="{p}" fill="{fill}"{s}/>'

def line(a, b, stroke, sw):
    return f'<line x1="{a[0]}" y1="{a[1]}" x2="{b[0]}" y2="{b[1]}" stroke="{stroke}" stroke-width="{sw}" stroke-linecap="round"/>'

def cube_svg(bg=RED, cube_top=WHITE, cube_left=CUBE_LEFT_SHADE, cube_right=CUBE_RIGHT_SHADE,
             seam=SEAM, edge=EDGE, radius=228, transparent_bg=False):
    c = CUBE
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {CANVAS} {CANVAS}" width="{CANVAS}" height="{CANVAS}">']
    if not transparent_bg:
        parts.append(f'<rect x="0" y="0" width="{CANVAS}" height="{CANVAS}" rx="{radius}" fill="{bg}"/>')
    # Left face  (front-left parallelogram: W -> S -> BF -> BL)
    parts.append(poly([c['W'], c['S'], c['BF'], c['BL']], cube_left, edge, 6))
    # Right face (front-right parallelogram: S -> E -> BR -> BF)
    parts.append(poly([c['S'], c['E'], c['BR'], c['BF']], cube_right, edge, 6))
    # Top face  — split into two triangles for the "flap" seam
    parts.append(poly([c['N'], c['E'], c['S']], cube_top, edge, 6))   # right triangle
    parts.append(poly([c['N'], c['S'], c['W']], cube_top, edge, 6))   # left triangle
    # Top-flap seam accent (a very subtle red line from N to S so the flap reads)
    parts.append(line(c['N'], c['S'], seam, 10))
    # Front seam — subtle vertical from S down to BF (the front-center box seam)
    parts.append(line(c['S'], c['BF'], edge, 4))
    parts.append('</svg>')
    return "\n".join(parts)

def rasterize(svg_text, out_path, size):
    png = cairosvg.svg2png(bytestring=svg_text.encode(), output_width=1024, output_height=1024)
    img = Image.open(BytesIO(png)).convert("RGBA")
    if size != 1024:
        img = img.resize((size, size), Image.LANCZOS)
    img.save(out_path, optimize=True)
    print("wrote", out_path, os.path.getsize(out_path), "bytes")

# --- 1. App icon: full red bg + white cube, 1024x1024 (iOS store + Expo standard)
rasterize(cube_svg(), os.path.join(OUT, "icon.png"), 1024)

# --- 2. Adaptive icon foreground: transparent bg + white cube (Android will supply the red bg via app.json)
rasterize(cube_svg(transparent_bg=True), os.path.join(OUT, "adaptive-icon.png"), 1024)

# --- 3. Splash logo: red cube on transparent (Expo splash config paints the bg color)
splash_svg = cube_svg(
    transparent_bg=True,
    cube_top=RED,                # invert: red cube on white splash bg
    cube_left="#B71E1E",
    cube_right="#9F1B1B",
    seam="#FFFFFF",
    edge="#B71E1E",
)
rasterize(splash_svg, os.path.join(OUT, "splash-icon.png"), 512)

# --- 4. Loading-screen mark: red cube inside a white circle (rendered by the JS component)
#    We only need the cube as a standalone red-on-transparent image; the circle
#    itself is drawn by the RN component using a plain <View>.
loading_svg = cube_svg(
    transparent_bg=True,
    cube_top=RED,
    cube_left="#B71E1E",
    cube_right="#9F1B1B",
    seam="#FFFFFF",
    edge="#B71E1E",
)
rasterize(loading_svg, os.path.join(OUT, "loading-mark.png"), 512)

print("done.")
