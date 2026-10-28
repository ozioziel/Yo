"""Writes half-resolution copies of the character atlases (256px -> 128px cells).

Usage: python -I tools/make_sd_atlases.py public/assets
Output: <variant>/atlases/sd/<id>.png + .json next to each HD atlas.
Phones load these to cut GPU memory by 4x; the HD originals are untouched.
"""
import json
import os
import sys

from PIL import Image

OUT = os.path.abspath(sys.argv[1])
manifest = json.load(open(os.path.join(OUT, "data", "manifest.json"), encoding="utf-8"))
count = 0
for atlas in manifest["atlases"]:
    if not atlas["variant"]:
        continue
    src_png = os.path.join(OUT, atlas["png"])
    src_json = os.path.join(OUT, atlas["json"])
    folder = os.path.join(os.path.dirname(src_png), "sd")
    os.makedirs(folder, exist_ok=True)
    im = Image.open(src_png).convert("RGBA")
    # Premultiply before resampling so transparent edges do not bleed dark fringes.
    half = (im.convert("RGBa")
            .resize((im.width // 2, im.height // 2), Image.Resampling.LANCZOS, reducing_gap=3.0)
            .convert("RGBA"))
    half.save(os.path.join(folder, os.path.basename(src_png)), optimize=True)
    data = json.load(open(src_json, encoding="utf-8"))
    for frame in data["frames"].values():
        for key in ("frame", "spriteSourceSize"):
            r = frame[key]
            for k in ("x", "y", "w", "h"):
                r[k] = r[k] // 2
        frame["sourceSize"] = {"w": frame["sourceSize"]["w"] // 2, "h": frame["sourceSize"]["h"] // 2}
    data["meta"]["size"] = {"w": half.width, "h": half.height}
    data["meta"]["scale"] = "0.5"
    json.dump(data, open(os.path.join(folder, os.path.basename(src_json)), "w", encoding="utf-8"))
    count += 1
print(f"[assets] {count} atlases SD")
