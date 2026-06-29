"""Regenerate every Tense Titans icon from the single master SVG.

Source of truth:  logo.svg  (full-bleed two-swords "TT" mark)

The design is full-bleed (background reaches the edges), so the same artwork
works for normal, maskable and apple-touch icons. Rasterised with macOS
`qlmanage` (Quick Look) + Pillow for exact sizes. macOS-only.

    python3 icons/make_icons.py
"""
import os, subprocess, tempfile
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
MASTER = os.path.join(HERE, "logo.svg")


def rasterize(svg, px=512):
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(["qlmanage", "-t", "-s", str(px), "-o", tmp, svg],
                       check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        out = os.path.join(tmp, os.path.basename(svg) + ".png")
        return Image.open(out).convert("RGBA").copy()


def save(img, size, name):
    img.resize((size, size), Image.LANCZOS).save(os.path.join(HERE, name))


def main():
    base = rasterize(MASTER, 512)
    save(base, 512, "icon-512.png")
    save(base, 512, "icon-maskable-512.png")
    save(base, 192, "icon-192.png")
    save(base, 180, "apple-touch-icon.png")
    save(base, 32, "favicon-32.png")
    print("icons regenerated from logo.svg in", HERE)


if __name__ == "__main__":
    main()
