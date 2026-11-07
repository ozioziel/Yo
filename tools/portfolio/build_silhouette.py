"""Turn Oziel's full-body photo into the star silhouette used by /portafolio.

Steps:
  1. cut him out of the background with rembg (model isnet-general-use); the
     mask is cached next to the photo, so later runs need no network,
  2. clean the mask: keep the largest piece and close tiny holes (the real
     gaps between the arms and the body stay open),
  3. crop to the body and scale it to a fixed height so the sampling below
     behaves the same for any photo,
  4. sample star positions: dense on the outline ("contorno"), medium on the
     photo's own details (hair, glasses, collar, buttons, shoes) and sparse
     inside.

Output (committed): src/pages/portfolio/space/silhouette.json
  data = [x, y, b, x, y, b, ...] as integers, shuffled so the first N
  points are an even subset (phones use fewer stars):
    x = round((X + 0.5) * scale), y = round(Y * scale), b = brightness 1..9
  where Y = 0 at the soles, 1 at the top of the hair, and X is measured in
  the same unit from the centre of the body's bounding box.

Usage:
  python -I tools/portfolio/build_silhouette.py [--photo path] [--preview out.png]
"""

from __future__ import annotations

import argparse
import json
import pathlib

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

ROOT = pathlib.Path(__file__).resolve().parents[2]
PHOTO = ROOT / "Planificacion" / "silueta" / "foto-cuerpo.jpg"
OUT = ROOT / "src" / "pages" / "portfolio" / "space" / "silhouette.json"

FIGURE_PX = 1000  # body height after scaling (head top to soles)
PAD = 12
COUNT = 11000
SCALE = 2000


def model_mask(photo: Image.Image, cache: pathlib.Path) -> np.ndarray:
    if not cache.exists():
        from rembg import new_session, remove  # only needed the first time

        remove(photo, session=new_session("isnet-general-use"), only_mask=True).save(cache)
    return np.asarray(Image.open(cache).convert("L")) > 128


def clean(mask: np.ndarray) -> np.ndarray:
    labels, n = ndimage.label(mask)
    if n > 1:
        sizes = ndimage.sum(mask, labels, range(1, n + 1))
        mask = labels == (int(np.argmax(sizes)) + 1)
    mask = ndimage.binary_opening(mask, iterations=2)
    holes = ndimage.binary_fill_holes(mask) & ~mask
    hl, hn = ndimage.label(holes)
    if hn:
        hs = ndimage.sum(holes, hl, range(1, hn + 1))
        small = np.isin(hl, np.where(hs < 400)[0] + 1)
        mask = mask | small
    return mask


def crop_and_scale(photo: Image.Image, mask: np.ndarray) -> tuple[Image.Image, np.ndarray]:
    ys, xs = np.where(mask)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    k = FIGURE_PX / (y1 - y0)
    box = (x0, y0, x1, y1)
    w = round((x1 - x0) * k)
    pic = photo.crop(box).resize((w, FIGURE_PX), Image.LANCZOS)
    m = Image.fromarray((mask[y0:y1, x0:x1] * 255).astype(np.uint8)).resize((w, FIGURE_PX), Image.LANCZOS)
    canvas = Image.new("RGB", (w + 2 * PAD, FIGURE_PX + 2 * PAD))
    canvas.paste(pic, (PAD, PAD))
    mcanvas = np.zeros((FIGURE_PX + 2 * PAD, w + 2 * PAD), bool)
    mcanvas[PAD : PAD + FIGURE_PX, PAD : PAD + w] = np.asarray(m) > 128
    return canvas, mcanvas


def photo_edges(photo: Image.Image) -> np.ndarray:
    import cv2  # installed with rembg

    # local contrast first: the dark shirt's buttons, pocket and creases would vanish otherwise
    gray = np.asarray(photo.convert("L"))
    gray = cv2.createCLAHE(clipLimit=2.6, tileGridSize=(8, 8)).apply(gray)
    g = np.asarray(Image.fromarray(gray).filter(ImageFilter.GaussianBlur(1.1))).astype(np.float32)
    gx = ndimage.sobel(g, axis=1)
    gy = ndimage.sobel(g, axis=0)
    mag = np.hypot(gx, gy)
    return np.clip(mag / np.percentile(mag, 98), 0, 1) ** 1.3


def sample(body: np.ndarray, details: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    inner = ndimage.binary_erosion(body, iterations=3)
    contour = body & ~inner
    details = details * inner
    weight = body * 0.12 + details * 1.45 + contour * 2.6
    bright = np.where(contour, 1.0, np.clip(0.35 + details * 0.9, 0, 1))

    h, w = body.shape
    flat = weight.ravel() / weight.sum()
    idx = rng.choice(flat.size, size=COUNT, replace=False, p=flat)
    ys, xs = np.divmod(idx, w)
    jx = xs + rng.random(COUNT)
    jy = ys + rng.random(COUNT)
    b = bright.ravel()[idx] * (0.75 + 0.25 * rng.random(COUNT))

    top, soles = PAD, PAD + FIGURE_PX
    center = w / 2
    X = (jx - center) / FIGURE_PX
    Y = (soles - jy) / FIGURE_PX
    return np.stack(
        [np.round((X + 0.5) * SCALE), np.round(Y * SCALE), np.clip(np.round(b * 9), 1, 9)], axis=1
    ).astype(int)


def preview(points: np.ndarray, path: pathlib.Path) -> None:
    w, h = 900, 1100
    img = Image.new("RGB", (w, h), (2, 4, 12))
    d = ImageDraw.Draw(img)
    for x, y, b in points:
        px = (x / SCALE - 0.5) * 1000 + w / 2
        py = h - 50 - y / SCALE * 1000
        v = int(90 + b * 18)
        r = 0.6 + b * 0.12
        d.ellipse([px - r, py - r, px + r, py + r], fill=(v, v, min(255, v + 20)))
    img.save(path)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--photo", type=pathlib.Path, default=PHOTO)
    ap.add_argument("--preview", type=pathlib.Path)
    args = ap.parse_args()

    photo = Image.open(args.photo).convert("RGB")
    cache = args.photo.with_name(f"mascara-{args.photo.stem}.png")
    mask = clean(model_mask(photo, cache))
    pic, body = crop_and_scale(photo, mask)
    rng = np.random.default_rng(147)
    points = sample(body, photo_edges(pic), rng)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps(
            {
                "about": f"Star silhouette of Oziel from {args.photo.name}, built by tools/portfolio/build_silhouette.py",
                "scale": SCALE,
                "count": int(len(points)),
                "data": points.ravel().tolist(),
            },
            separators=(",", ":"),
        )
    )
    print(f"{len(points)} stars -> {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} KB)")
    if args.preview:
        preview(points, args.preview)


if __name__ == "__main__":
    main()
