"""Generate PWA icons for Safam.

Safam = mustache in Hebrew. Terminal aesthetic: dark bg (#0C0A09),
terracotta classic handlebar mustache (#C15F3C).

The mustache is defined by explicit top-edge and bottom-edge bezier curves
for each half, giving full control over thickness taper and curl shape.
"""

from PIL import Image, ImageDraw
import os

PUBLIC_DIR = os.path.join(os.path.dirname(__file__), "..", "public")
os.makedirs(PUBLIC_DIR, exist_ok=True)

BG_COLOR = (12, 10, 9)  # #0C0A09
ACCENT_COLOR = (193, 95, 60)  # #C15F3C

SIZES = {
    "icon-192.png": 192,
    "icon-512.png": 512,
    "icon-maskable-512.png": 512,
    "apple-touch-icon.png": 180,
}


def cubic_bezier(t: float, p0, p1, p2, p3):
    u = 1 - t
    return (
        u**3 * p0[0] + 3 * u**2 * t * p1[0] + 3 * u * t**2 * p2[0] + t**3 * p3[0],
        u**3 * p0[1] + 3 * u**2 * t * p1[1] + 3 * u * t**2 * p2[1] + t**3 * p3[1],
    )


def sample(p0, p1, p2, p3, n=80):
    return [cubic_bezier(i / (n - 1), p0, p1, p2, p3) for i in range(n)]


def draw_mustache(draw: ImageDraw.Draw, s: int, maskable: bool = False):
    """Draw a classic handlebar mustache.

    Shape strategy: define each half as two outlines (top edge & bottom edge)
    that together form a filled polygon. This gives precise control over
    thickness at every point — thick at center, tapering to the curl tips.
    """
    pad = s * 0.1 if maskable else 0
    c = s - 2 * pad  # content area
    cx = s / 2
    cy = s / 2 + c * 0.02  # slightly below center

    # Key proportions (relative to content size)
    w = c * 0.40       # half-width to tip
    thick = c * 0.065   # thickness at center
    thin = c * 0.025    # thickness at tip
    droop = c * 0.08    # how far the body sags
    curl = c * 0.20     # how far the tips curl up

    for side in [1, -1]:
        # === TOP EDGE ===
        # Starts at center-top, sweeps outward, rises into curl tip
        top = sample(
            (cx, cy - thick),                                    # center top
            (cx + side * w * 0.4, cy - thick * 0.6),            # slight rise
            (cx + side * w * 0.75, cy - droop * 0.2 - thin),    # flattens
            (cx + side * w * 0.92, cy - curl * 0.35),           # approach curl
            50,
        ) + sample(
            (cx + side * w * 0.92, cy - curl * 0.35),           # curl entry
            (cx + side * w * 1.06, cy - curl * 0.75),           # curl peak outer
            (cx + side * w * 0.96, cy - curl * 1.0),            # curl top
            (cx + side * w * 0.80, cy - curl * 0.92),           # curl end (inner)
            30,
        )[1:]

        # === BOTTOM EDGE ===
        # Starts at center-bottom, droops downward, then sweeps up to curl tip
        bot = sample(
            (cx, cy + thick),                                    # center bottom
            (cx + side * w * 0.35, cy + droop * 1.4),           # deep droop
            (cx + side * w * 0.70, cy + droop * 1.0),           # still low
            (cx + side * w * 0.90, cy - curl * 0.05),           # rise to curl base
            50,
        ) + sample(
            (cx + side * w * 0.90, cy - curl * 0.05),           # curl base
            (cx + side * w * 1.01, cy - curl * 0.45),           # curl outer
            (cx + side * w * 0.94, cy - curl * 0.72),           # curl inner
            (cx + side * w * 0.80, cy - curl * 0.92),           # meet top at tip
            30,
        )[1:]

        # Combine: top edge forward, bottom edge reversed → closed polygon
        polygon = top + list(reversed(bot))
        draw.polygon(polygon, fill=ACCENT_COLOR)

    # Fill center junction cleanly
    r = thick * 1.1
    draw.ellipse([cx - r, cy - r * 0.6, cx + r, cy + r * 0.6], fill=ACCENT_COLOR)


def create_icon(size: int, maskable: bool = False) -> Image.Image:
    render = size * 3
    img = Image.new("RGBA", (render, render), BG_COLOR + (255,))
    draw = ImageDraw.Draw(img)
    draw_mustache(draw, render, maskable=maskable)
    return img.resize((size, size), Image.LANCZOS)


for filename, size in SIZES.items():
    icon = create_icon(size, maskable="maskable" in filename)
    icon.save(os.path.join(PUBLIC_DIR, filename), "PNG")
    print(f"Created {filename} ({size}x{size})")

print("Done!")
