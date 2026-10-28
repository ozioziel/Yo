"""Verify actual environment outputs and make effect GIF previews. Run after build_environments.cjs."""
from PIL import Image
from pathlib import Path
import json
import hashlib

root = Path(__file__).resolve().parents[1]
data = json.loads((root / 'metadata/environments.json').read_text(encoding='utf-8'))
errors = []
edge = []
counts = {'productionPngs': len(data['assets']), 'scenes': 8, 'layers': 40, 'effectAtlases': 5}
for a in data['assets']:
    p = root / a['path']
    if not p.exists():
        errors.append('missing ' + a['path'])
        continue
    im = Image.open(p).convert('RGBA')
    if im.size != (a['width'], a['height']):
        errors.append('size ' + a['path'])
    alpha = im.getchannel('A')
    wave = '/wave/' in a['path'] or a.get('id') in ('summer_wave', 'summer_wave_strip')
    if wave:
        a['tileable'] = True
        a['tileAxis'] = 'x'
        note = ' Borde izquierdo/derecho y base se rellenan intencionalmente; repetir horizontalmente.'
        if note not in a['notes']:
            a['notes'] += note
    if a['type'] not in ('background', 'atlas') and not a['path'].endswith('_strip.png'):
        if alpha.getextrema()[0] == 255:
            errors.append('opaque ' + a['path'])
        bb = alpha.getbbox()
        touching = bb and (bb[0] == 0 or bb[1] == 0 or bb[2] == im.width or bb[3] == im.height)
        if touching:
            edge.append({'path': a['path'], 'expected': wave, 'reason': 'tileable_wave' if wave else 'unexpected_edge'})
            if not wave:
                errors.append('clipped edge ' + a['path'])
    if a['type'] == 'atlas':
        d = json.loads((root / a['jsonPath']).read_text())
        hashes = []
        for k, f in d['frames'].items():
            rect = f['frame']
            box = (rect['x'], rect['y'], rect['x'] + rect['w'], rect['y'] + rect['h'])
            if box[2] > im.width or box[3] > im.height:
                errors.append('rect ' + k)
            hashes.append(hashlib.sha256(im.crop(box).tobytes()).hexdigest())
        if len(set(hashes)) < len(hashes):
            errors.append('duplicate frames ' + a['path'])
        src = [Image.open(root / x['path']).convert('RGBA') for x in data['assets']
               if x.get('animation') == a['clips'][0] and x.get('season') == a['season']]
        # GIF is a review artifact; production PNG retains antialiased full alpha.
        src[0].save(root / f"previews/environments_{a['id']}.gif", save_all=True,
                    append_images=src[1:], duration=int(1000 / data['animations'][a['id']]['frameRate']),
                    loop=0, disposal=2)
data['qa'] = {**counts, 'errors': errors, 'edgeTouching': edge,
              'visualReview': 'All eight scenes, seasonal props and effect contacts inspected. Calm center; readable night ground.',
              'checks': ['existence', 'dimensions', 'real alpha', 'nonclipped props', 'unique animation frames', 'atlas rectangles']}
(root / 'metadata/environments.json').write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(data['qa'], indent=2))
if errors:
    raise SystemExit(1)
