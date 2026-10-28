"""Builds the brand mark + favicon from the engineer's front-facing frame (helmet = brand yellow).

Usage: python -I tools/make_brand.py
Writes assets_overrides/brand/{mark.png, favicon.png, apple-touch.png}. Source library untouched.
"""
import os

from PIL import Image

SRC = "Recursos/assets_home_oziel/characters/engineer/frames/look_around/look_around_003.png"
OUT = "assets_overrides/brand"
os.makedirs(OUT, exist_ok=True)

im = Image.open(SRC).convert("RGBA")
# Head + helmet + upper body: a square crop centred on the face.
head = im.crop((58, 14, 214, 170))
mark = head.resize((256, 256), Image.Resampling.LANCZOS)
mark.save(os.path.join(OUT, "mark.png"), optimize=True)

# Favicon: mark on a rounded yellow tile so it reads on light and dark tabs.
def tile(size):
    from PIL import ImageDraw
    base = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(base)
    r = size // 5
    d.rounded_rectangle((0, 0, size - 1, size - 1), radius=r, fill=(239, 184, 61, 255), outline=(8, 12, 11, 255), width=max(2, size // 24))
    inner = head.resize((int(size * 0.9), int(size * 0.9)), Image.Resampling.LANCZOS)
    base.alpha_composite(inner, (int(size * 0.05), int(size * 0.08)))
    return base

tile(64).save(os.path.join(OUT, "favicon.png"), optimize=True)
tile(180).save(os.path.join(OUT, "apple-touch.png"), optimize=True)
print("brand ok")
