"""Exhaustive, read-only audit of the Codex asset library (assets_home_oziel).

Run:  python -I tools/audit/audit_assets.py Recursos/assets_home_oziel docs/audit
Writes audit_inventory.json + audit_summary.md. Never modifies the library.
"""
import hashlib
import json
import os
import sys
from collections import Counter, defaultdict

import numpy as np
from PIL import Image

ROOT = os.path.abspath(sys.argv[1])
OUT = os.path.abspath(sys.argv[2])
os.makedirs(OUT, exist_ok=True)

FORBIDDEN_ENGINEER = {"put_scarf", "put_boots", "open_umbrella", "walk_umbrella", "hide_rain", "remove_accessories"}
HELMET = np.array([0xEF, 0xB8, 0x3D])
SCARF = np.array([0xBB, 0x55, 0x47])
BOOTS = np.array([0xBA, 0x77, 0x3D])
UMBRELLA = np.array([0x66, 0x86, 0x81])

issues = []  # (severity, area, item, message)


def issue(sev, area, item, msg):
    issues.append({"severity": sev, "area": area, "item": item, "message": msg})


def load(path):
    return json.load(open(os.path.join(ROOT, path), encoding="utf-8"))


manifest = load("asset_manifest.json")
animations = load("animations.json")
env_meta = load("metadata/environments.json")
assets = manifest["assets"]
by_id = {a["id"]: a for a in assets}

# ---------------------------------------------------------------- 1. every manifest entry
records = []
image_cache = {}


def img(rel):
    if rel not in image_cache:
        image_cache[rel] = Image.open(os.path.join(ROOT, rel))
        image_cache[rel].load()
    return image_cache[rel]


ids = Counter(a["id"] for a in assets)
for dup, n in ids.items():
    if n > 1:
        issue("error", "manifest", dup, f"id duplicated {n} times")

for a in assets:
    rel = a["path"]
    full = os.path.join(ROOT, rel)
    rec = {"id": a["id"], "path": rel, "type": a["type"], "status": "apto", "notes": []}
    if not os.path.isfile(full):
        rec["status"] = "faltante"
        issue("error", "manifest", rel, "file missing")
        records.append(rec)
        continue
    rec["bytes"] = os.path.getsize(full)
    im = Image.open(full)
    rec["size"] = list(im.size)
    rec["mode"] = im.mode
    if a.get("width") and (im.size[0] != a["width"] or im.size[1] != a["height"]):
        rec["status"] = "necesita corrección"
        issue("error", "manifest", rel, f"size {im.size} != declared {a['width']}x{a['height']}")
    if a.get("alpha"):
        if im.mode != "RGBA":
            rec["status"] = "necesita corrección"
            issue("error", "alpha", rel, f"declared alpha but mode {im.mode}")
        else:
            al = np.asarray(im)[:, :, 3]
            transparent = float((al < 255).mean())
            rec["transparentRatio"] = round(transparent, 4)
            if transparent == 0:
                rec["status"] = "necesita corrección"
                issue("error", "alpha", rel, "declared alpha but fully opaque")
            if a["type"] in ("sprite", "prop", "particle") and al.max() == 0:
                rec["status"] = "necesita corrección"
                issue("error", "alpha", rel, "fully transparent image")
    records.append(rec)

# ---------------------------------------------------------------- 2. orphans on disk
manifest_paths = {a["path"].replace("\\", "/") for a in assets}
orphans = []
for dp, _dn, fn in os.walk(ROOT):
    for f in fn:
        if not f.lower().endswith(".png"):
            continue
        rel = os.path.relpath(os.path.join(dp, f), ROOT).replace("\\", "/")
        if rel not in manifest_paths:
            orphans.append(rel)
for o in orphans:
    issue("warn", "manifest", o, "PNG on disk not in manifest")

# ---------------------------------------------------------------- 3. atlases
atlas_frames = {}  # atlasKey -> {frame: rect}
for a in assets:
    if a["type"] != "atlas":
        continue
    jpath = os.path.join(ROOT, a["jsonPath"])
    if not os.path.isfile(jpath):
        issue("error", "atlas", a["id"], "json missing")
        continue
    j = json.load(open(jpath, encoding="utf-8"))
    frames = j["frames"]
    meta = j.get("meta", {})
    im = img(a["path"])
    if meta.get("size") and (meta["size"]["w"], meta["size"]["h"]) != im.size:
        issue("error", "atlas", a["id"], f"meta.size {meta['size']} != image {im.size}")
    if os.path.basename(meta.get("image", "")) != os.path.basename(a["path"]):
        issue("warn", "atlas", a["id"], f"meta.image {meta.get('image')} mismatch")
    rects = {}
    for name, fr in frames.items():
        r = fr["frame"]
        if r["x"] + r["w"] > im.size[0] or r["y"] + r["h"] > im.size[1]:
            issue("error", "atlas", f"{a['id']}/{name}", "frame rect out of bounds")
        if fr.get("rotated"):
            issue("warn", "atlas", f"{a['id']}/{name}", "rotated frame")
        rects[name] = r
    atlas_frames[a["id"]] = rects
    if set(a.get("frameNames", rects.keys())) != set(rects.keys()):
        issue("error", "atlas", a["id"], "manifest frameNames != json frames")


def crop(atlas_key, frame):
    r = atlas_frames[atlas_key][frame]
    a = by_id[atlas_key]
    return np.asarray(img(a["path"]).convert("RGBA").crop((r["x"], r["y"], r["x"] + r["w"], r["y"] + r["h"])))


def color_pixels(arr, rgb, tol=18):
    m = arr[:, :, 3] > 200
    d = np.abs(arr[:, :, :3].astype(int) - rgb).max(axis=2)
    return int(((d <= tol) & m).sum())


# ---------------------------------------------------------------- 4. animations
clip_report = []
for variant, clips in animations["characters"].items():
    if variant == "engineer":
        bad = FORBIDDEN_ENGINEER & set(clips)
        if bad:
            issue("error", "engineer", variant, f"forbidden clips present {bad}")
    for clip, d in clips.items():
        rep = {"variant": variant, "clip": clip, "frames": len(d["frames"]), "fps": d["frameRate"],
               "repeat": d["repeat"], "origin": d.get("origin"), "status": "apto", "notes": []}
        hashes = []
        bottoms = []
        edge_touch = 0
        helmet_missing = 0
        scarf_frames = 0
        boots_frames = 0
        umbrella_frames = 0
        arrs = []
        for f in d["frames"]:
            key = d["atlasKey"] if isinstance(f, str) else f.get("atlasKey", d["atlasKey"])
            name = f if isinstance(f, str) else f.get("frame")
            if key not in atlas_frames or name not in atlas_frames[key]:
                rep["status"] = "faltante"
                issue("error", "animation", f"{variant}:{clip}", f"frame {key}/{name} missing")
                continue
            arr = crop(key, name)
            arrs.append(arr)
            hashes.append(hashlib.md5(arr.tobytes()).hexdigest())
            al = arr[:, :, 3]
            ys = np.where(al.max(axis=1) > 40)[0]
            xs = np.where(al.max(axis=0) > 40)[0]
            if len(ys):
                bottoms.append(int(ys.max()))
                if ys.min() == 0 or ys.max() == al.shape[0] - 1 or xs.min() == 0 or xs.max() == al.shape[1] - 1:
                    edge_touch += 1
            if variant == "engineer" and color_pixels(arr, HELMET) < 80:
                helmet_missing += 1
            if color_pixels(arr, SCARF) > 60:
                scarf_frames += 1
            if color_pixels(arr, BOOTS, 10) > 120:
                boots_frames += 1
            if color_pixels(arr, UMBRELLA, 14) > 300:
                umbrella_frames += 1
            # compare against individual frame PNG
            single = os.path.join(ROOT, d.get("framesDirectory", ""), f"{name}.png")
            if d.get("framesDirectory") and os.path.isfile(single):
                s = np.asarray(Image.open(single).convert("RGBA"))
                if s.shape != arr.shape or np.abs(s.astype(int) - arr.astype(int)).max() > 1:
                    issue("warn", "animation", f"{variant}:{clip}/{name}", "atlas frame differs from single PNG")
        uniq = len(set(hashes))
        rep["uniqueFrames"] = uniq
        if uniq <= 1:
            rep["status"] = "necesita corrección"
            issue("error", "animation", f"{variant}:{clip}", "static clip")
        if len(arrs) >= 2:
            steps = [float(np.abs(arrs[i + 1].astype(int) - arrs[i].astype(int)).mean()) for i in range(len(arrs) - 1)]
            rep["meanStep"] = round(float(np.mean(steps)), 3)
            rep["maxStep"] = round(float(np.max(steps)), 3)
            if d["repeat"] == -1:
                seam = float(np.abs(arrs[0].astype(int) - arrs[-1].astype(int)).mean())
                rep["loopSeam"] = round(seam, 3)
                if seam > 2.5 * max(rep["meanStep"], 0.5):
                    rep["notes"].append(f"loop seam {seam:.2f} vs step {rep['meanStep']:.2f}")
                    issue("warn", "loop", f"{variant}:{clip}", f"loop seam jump {seam:.2f} > 2.5x mean step {rep['meanStep']:.2f}")
            if rep["maxStep"] > 4 * max(rep["meanStep"], 0.5) and len(arrs) > 3:
                rep["notes"].append("one transition much larger than the rest")
                issue("info", "continuity", f"{variant}:{clip}", f"max step {rep['maxStep']} vs mean {rep['meanStep']}")
        if bottoms:
            rep["footBottom"] = [min(bottoms), max(bottoms)]
            if d.get("origin", [0.5, 0.9])[1] == 0.9 and (max(bottoms) > 240 or min(bottoms) < 215):
                rep["notes"].append(f"feet bottom out of 215..240: {rep['footBottom']}")
                issue("warn", "pivot", f"{variant}:{clip}", f"grounded clip bottom {rep['footBottom']}")
        if edge_touch:
            rep["notes"].append(f"{edge_touch} frames touch cell edge")
            issue("warn", "crop", f"{variant}:{clip}", f"{edge_touch} frames touch cell edge")
        if variant == "engineer":
            if helmet_missing:
                rep["notes"].append(f"helmet weak/missing in {helmet_missing} frames")
                issue("warn" if clip in ("climb", "fall_spin") else "error", "engineer", f"engineer:{clip}", f"helmet colour weak in {helmet_missing}/{len(arrs)} frames")
            if scarf_frames or umbrella_frames:
                rep["status"] = "necesita corrección"
                issue("error", "engineer", f"engineer:{clip}", f"seasonal colours: scarf {scarf_frames}, umbrella {umbrella_frames}")
        if variant == "penguin_winter" and clip not in ("put_scarf", "remove_accessories"):
            rep["scarfFrames"] = scarf_frames
            if scarf_frames < len(arrs) * 0.5 and clip not in ("climb",):
                issue("info", "outfit", f"penguin_winter:{clip}", f"scarf visible in only {scarf_frames}/{len(arrs)} frames")
        if variant == "penguin_autumn":
            rep["umbrellaFrames"] = umbrella_frames
        if variant == "penguin" and (scarf_frames or umbrella_frames) and clip not in ("put_scarf", "open_umbrella", "walk_umbrella", "hide_rain"):
            issue("warn", "outfit", f"penguin:{clip}", f"base variant shows seasonal colours scarf={scarf_frames} umbrella={umbrella_frames}")
        if "frameAnchors" in d and len(d["frameAnchors"]) != len(d["frames"]):
            issue("warn", "anchors", f"{variant}:{clip}", "frameAnchors count != frames")
        clip_report.append(rep)

for name, d in animations.get("effects", {}).items():
    for f in d["frames"]:
        if d["atlasKey"] not in atlas_frames or f not in atlas_frames[d["atlasKey"]]:
            issue("error", "effect", name, f"frame {f} missing")

# ---------------------------------------------------------------- 5. environments
env_report = []
for season, modes in env_meta["seasons"].items():
    for mode, comp in modes.items():
        ok = True
        for lid in comp["layers"]:
            lid = lid if isinstance(lid, str) else lid["id"]
            if lid not in by_id:
                ok = False
                issue("error", "environment", f"{season}/{mode}", f"layer {lid} missing")
            else:
                w, h = img(by_id[lid]["path"]).size
                if (w, h) != (1920, 1080):
                    ok = False
                    issue("error", "environment", lid, f"size {w}x{h}")
        env_report.append({"season": season, "mode": mode, "layers": len(comp["layers"]), "ok": ok,
                           "ambient": comp.get("ambient"), "walkBaseline": comp.get("walkBaseline")})

# ---------------------------------------------------------------- summary
sev = Counter(i["severity"] for i in issues)
status = Counter(r["status"] for r in records)
by_area = defaultdict(Counter)
for i in issues:
    by_area[i["area"]][i["severity"]] += 1

json.dump({"records": records, "clips": clip_report, "environments": env_report, "orphans": orphans,
           "issues": issues}, open(os.path.join(OUT, "audit_inventory.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)

lines = ["# Inventario automatizado (generado)", "",
         f"- Entradas del manifiesto: {len(records)}  ·  estados: {dict(status)}",
         f"- PNG en disco fuera del manifiesto: {len(orphans)}",
         f"- Atlases verificados: {len(atlas_frames)}",
         f"- Clips de personaje verificados: {len(clip_report)}",
         f"- Problemas: {dict(sev)}", "", "## Por área", ""]
for area, c in sorted(by_area.items()):
    lines.append(f"- **{area}**: {dict(c)}")
lines += ["", "## Detalle (error y warn)", ""]
for i in issues:
    if i["severity"] in ("error", "warn"):
        lines.append(f"- `{i['severity']}` [{i['area']}] `{i['item']}` — {i['message']}")
lines += ["", "## Info", ""]
for i in issues:
    if i["severity"] == "info":
        lines.append(f"- [{i['area']}] `{i['item']}` — {i['message']}")
open(os.path.join(OUT, "audit_summary.md"), "w", encoding="utf-8").write("\n".join(lines) + "\n")
print("\n".join(lines[:12 + len(by_area)]))
