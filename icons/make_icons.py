"""Generate PWA icons for Verb Quest (no external SVG deps, pure PIL)."""
from PIL import Image, ImageDraw, ImageFont
import os, math

OUT = os.path.dirname(os.path.abspath(__file__))

BG_TOP = (108, 92, 231)     # #6c5ce7
BG_BOT = (15, 18, 38)       # #0f1226
ACCENT = (255, 209, 102)    # warm star/spark yellow


def vgrad(size, top, bot):
    img = Image.new("RGB", (size, size), top)
    px = img.load()
    for y in range(size):
        t = y / (size - 1)
        r = int(top[0] + (bot[0] - top[0]) * t)
        g = int(top[1] + (bot[1] - top[1]) * t)
        b = int(top[2] + (bot[2] - top[2]) * t)
        for x in range(size):
            px[x, y] = (r, g, b)
    return img


def star(draw, cx, cy, r_out, r_in, points, fill):
    pts = []
    for i in range(points * 2):
        ang = math.pi / points * i - math.pi / 2
        r = r_out if i % 2 == 0 else r_in
        pts.append((cx + r * math.cos(ang), cy + r * math.sin(ang)))
    draw.polygon(pts, fill=fill)


def load_font(size):
    for path in [
        "/System/Library/Fonts/SFNSRounded.ttf",
        "/System/Library/Fonts/SFNS.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/Library/Fonts/Arial Bold.ttf",
    ]:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                pass
    return ImageFont.load_default()


def make(size, maskable=False):
    img = vgrad(size, BG_TOP, BG_BOT).convert("RGBA")
    draw = ImageDraw.Draw(img)
    # safe zone: maskable icons get smaller content
    pad = size * (0.20 if maskable else 0.0)
    cx, cy = size / 2, size / 2

    # rounded card behind text for non-maskable polish
    # decorative spark
    star(draw, size * 0.74, size * 0.26, size * 0.10, size * 0.04, 5, ACCENT)
    star(draw, size * 0.84, size * 0.40, size * 0.045, size * 0.018, 5, (255, 255, 255, 230))

    font = load_font(int(size * (0.34 if maskable else 0.40)))
    text = "TT"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    tx = cx - tw / 2 - bbox[0]
    ty = cy - th / 2 - bbox[1] + size * 0.02
    # shadow
    draw.text((tx + size * 0.012, ty + size * 0.012), text, font=font, fill=(0, 0, 0, 90))
    draw.text((tx, ty), text, font=font, fill=(255, 255, 255, 255))

    img = img.convert("RGB")
    return img


make(192).save(os.path.join(OUT, "icon-192.png"))
make(512).save(os.path.join(OUT, "icon-512.png"))
make(512, maskable=True).save(os.path.join(OUT, "icon-maskable-512.png"))
make(180).save(os.path.join(OUT, "apple-touch-icon.png"))
print("icons written to", OUT)
