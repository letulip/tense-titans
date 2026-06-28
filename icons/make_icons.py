"""Regenerate Tense Titans PNG icons from the SVG masters.

Sources of truth:
  logo.svg           -> favicon + "any" app icons (rounded corners)
  logo-maskable.svg  -> maskable icon + apple-touch (full-bleed background)

Rasterises with macOS `qlmanage` (Quick Look), then resizes to exact sizes
with Pillow. macOS-only (no rsvg/cairosvg/inkscape needed).

    python3 icons/make_icons.py
"""
import os, subprocess, tempfile
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))


def rasterize(svg, px=512):
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(["qlmanage", "-t", "-s", str(px), "-o", tmp, svg],
                       check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        out = os.path.join(tmp, os.path.basename(svg) + ".png")
        return Image.open(out).convert("RGBA").copy()


def save(img, size, name):
    img.resize((size, size), Image.LANCZOS).save(os.path.join(HERE, name))


def main():
    rounded = rasterize(os.path.join(HERE, "logo.svg"), 512)
    masked = rasterize(os.path.join(HERE, "logo-maskable.svg"), 512)
    save(rounded, 512, "icon-512.png")
    save(rounded, 192, "icon-192.png")
    save(rounded, 32, "favicon-32.png")
    save(masked, 512, "icon-maskable-512.png")
    save(masked, 180, "apple-touch-icon.png")
    print("icons regenerated in", HERE)


if __name__ == "__main__":
    main()
