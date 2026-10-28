"""Validate the rendered frames against strips/atlases and recovery transitions."""
from pathlib import Path
import json, hashlib
from PIL import Image, ImageChops
ROOT=Path(__file__).resolve().parents[1]
data=json.loads((ROOT/'metadata/characters.json').read_text(encoding='utf-8'))
issues=[]; repeated=[]; totals={'clips':0,'frames':0,'atlases':len(data['atlases']),'gifs':0}
atlas_cache={}
def digest(im):return hashlib.sha256(im.tobytes()).hexdigest()
def same_render(a,b):
    # libvips source-over RGBA uses premultiply/unpremultiply at antialiased edges.
    # Alpha must remain exact; RGB may differ by at most one 8-bit step.
    ex=ImageChops.difference(a,b).getextrema()
    return ex[3][1]==0 and max(q[1] for q in ex[:3])<=1
for variant,clips in data['characters'].items():
    for name,clip in clips.items():
        totals['clips']+=1
        source=[];hashes=[]
        atlas=next(a for a in data['atlases'] if a['id']==clip['atlasKey'])
        if atlas['id'] not in atlas_cache:
            atlas_cache[atlas['id']]=(Image.open(ROOT/atlas['path']).convert('RGBA'),json.loads((ROOT/atlas['jsonPath']).read_text()))
        sheet, spec=atlas_cache[atlas['id']]
        strip=Image.open(ROOT/clip['stripPath']).convert('RGBA')
        if strip.size!=(256*len(clip['frames']),256):issues.append(f'{variant}/{name}: strip size')
        for i,key in enumerate(clip['frames']):
            im=Image.open(ROOT/clip['framesDirectory']/(key+'.png')).convert('RGBA');totals['frames']+=1
            if im.size!=(256,256):issues.append(f'{variant}/{key}: size')
            alpha=im.getchannel('A');bb=alpha.getbbox()
            if not bb:issues.append(f'{variant}/{key}: transparent')
            elif min(bb[:2])<1 or max(bb[2:])>255:issues.append(f'{variant}/{key}: touches canvas {bb}')
            if alpha.getextrema()!=(0,255):issues.append(f'{variant}/{key}: alpha not real')
            h=digest(im);hashes.append(h)
            if not same_render(im,strip.crop((i*256,0,(i+1)*256,256))):issues.append(f'{variant}/{key}: strip mismatch')
            fr=spec['frames'][key]['frame'];x,y,w,hp=[fr[a] for a in ('x','y','w','h')]
            if not same_render(im,sheet.crop((x,y,x+w,y+hp))):issues.append(f'{variant}/{key}: atlas mismatch')
        if len(set(hashes))==1:issues.append(f'{variant}/{name}: entirely static')
        if len(set(hashes))<len(hashes):repeated.append({'variant':variant,'clip':name,'unique':len(set(hashes)),'total':len(hashes),'reason':'Revisited poses in a cycle or neutral one-shot endpoints; never a wholly static sequence.'})
        if name.startswith('impact_'):
            last=Image.open(ROOT/clip['framesDirectory']/(clip['frames'][-1]+'.png')).convert('RGBA')
            getup=clips['get_up'];first=Image.open(ROOT/getup['framesDirectory']/(getup['frames'][0]+'.png')).convert('RGBA')
            if digest(last)!=digest(first):issues.append(f'{variant}/{name}: get_up continuity mismatch')
for f in (ROOT/'previews').glob('characters_*.gif'):
    im=Image.open(f);totals['gifs']+=1
    if getattr(im,'n_frames',1)<2:issues.append(f'{f.name}: static GIF')
report={'passed':not issues,'totals':totals,'issues':issues,'revisitedPoses':repeated,'limitations':['Perceptual quality additionally reviewed on model/contact sheets; this script checks structural and pixel continuity, not subjective artistic fidelity.','Strip/atlas alpha is pixel exact; libvips antialiased RGB rounding tolerance is at most 1/255.']}
(ROOT/'metadata/characters_qa.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k!='revisitedPoses'},ensure_ascii=False,indent=2))
raise SystemExit(0 if not issues else 1)
