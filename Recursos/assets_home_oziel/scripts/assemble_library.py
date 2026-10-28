"""Assemble real production metadata, catalogs, review UI and structural QA.
Run after the three vector producers. Pillow is the only Python dependency.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageChops
import json, re, hashlib, math, statistics

ROOT = Path(__file__).resolve().parent.parent
def read(p): return json.loads((ROOT/p).read_text(encoding='utf-8'))
def write(p, obj):
    f=ROOT/p; f.parent.mkdir(parents=True,exist_ok=True)
    f.write_text(json.dumps(obj,ensure_ascii=False,indent=2),encoding='utf-8')
def font(n=14):
    try: return ImageFont.truetype('C:/Windows/Fonts/arial.ttf',n)
    except OSError: return ImageFont.load_default()
def equivalent_rgba(a,b):
    """Compositing antialias pixels can round RGB by 1/255; alpha must be exact."""
    extrema=ImageChops.difference(a,b).getextrema()
    return all(e[1]<=1 for e in extrema[:3]) and extrema[3][1]==0
def contact(items, out, cols=6, cell=(180,170), title=''):
    if not items: return
    cw,ch=cell; rows=math.ceil(len(items)/cols)
    sheet=Image.new('RGB',(cw*cols,rows*ch+55),'#eaf0ec'); d=ImageDraw.Draw(sheet)
    d.text((18,16),title,fill='#24332e',font=font(20))
    for i,(file,label) in enumerate(items):
        im=Image.open(file).convert('RGBA'); im.thumbnail((cw-24,ch-42))
        x=(i%cols)*cw; y=(i//cols)*ch+55
        sheet.paste(im,(x+(cw-im.width)//2,y+4),im)
        d.text((x+9,y+ch-29),label[:27],fill='#34433d',font=font(12))
    (ROOT/out).parent.mkdir(parents=True,exist_ok=True);sheet.save(ROOT/out)

def main():
    cm=read('metadata/characters.json'); em=read('metadata/environments.json'); intro_meta=read('metadata/intro_ui.json')
    contact([(ROOT/a['path'],a['id']) for a in intro_meta['assets'] if a['type'] in ['prop','ui']],'previews/intro_ui_contact.png',6,(200,190),'Introducción y controles · recursos separados')
    for effect,definition in intro_meta['effects'].items():
        contact([(ROOT/f'intro/letters_fx/{effect}/frames/{key}.png',key) for key in definition['frames']],f'previews/intro_{effect}_contact.png',4,(180,170),effect)
    assets=[]
    for entry in em.get('assets',[])+intro_meta.get('assets',[])+cm.get('assets',[])+cm.get('atlases',[]):
        entry=entry.copy()
        if not entry.get('path'): continue
        if any(a['path']==entry['path'] for a in assets): continue
        assets.append(entry)
    known={a['path'] for a in assets}
    # Include every exported bitmap, individual frame and review in the inventory.
    for file in sorted(ROOT.rglob('*.png')):
        rel=file.relative_to(ROOT).as_posix()
        if rel in known: continue
        parts=file.relative_to(ROOT).parts; char=parts[1] if parts[0]=='characters' else None
        typ='preview' if parts[0] in ('previews','reference','integration') else 'sprite'
        if 'atlases' in parts: typ='atlas'
        season=next((x for x in ['winter','autumn','spring','summer'] if x in parts),None)
        extra={}
        if typ=='atlas' and file.with_suffix('.json').exists():
            atlas=json.loads(file.with_suffix('.json').read_text(encoding='utf-8'))
            extra={'jsonPath':file.with_suffix('.json').relative_to(ROOT).as_posix(),'frames':list(atlas['frames'])}
        assets.append({'id':re.sub(r'[^a-z0-9]+','_',rel.lower().removesuffix('.png')).strip('_'),'path':rel,'type':typ,'characterVariant':char,'season':season,'notes':'Fotograma individual.' if 'frames' in parts else 'Tira PNG de animación.' if 'clips' in parts else 'Referencia o previsualización.' if typ=='preview' else 'Recurso de producción.',**extra})
        known.add(rel)
    for a in assets:
        file=ROOT/a['path']
        with Image.open(file) as image:
            rgba=image.convert('RGBA'); alpha=rgba.getchannel('A')
            a.update(width=image.width,height=image.height,format='png',alpha=alpha.getextrema()[0]<255)
        for k,v in {'season':None,'dayNight':None,'characterVariant':None,'notes':'','origin':[.5,.5],'recommendedScale':1,'depth':40,'tileable':False,'dependencies':[]}.items(): a.setdefault(k,v)
        if a['type']=='atlas' and a.get('jsonPath'):
            data=read(a['jsonPath']);a['frames']=list(data['frames']); a['dependencies']=[a['jsonPath']]
            frames=list(data['frames'].values()); first=frames[0]['frame']
            a.setdefault('cellSize',[first['w'],first['h']]); a.setdefault('columns',a['width']//first['w']);a.setdefault('rows',a['height']//first['h'])
    assets.sort(key=lambda x:x['path'])
    manifest={'schemaVersion':'1.0','basePath':'assets_home_oziel/','productionDate':'2026-10-24','coordinateSystem':{'designViewport':[1920,1080],'groundY':900,'units':'pixels','worldMovement':'runtime','characterFrame':[256,256]},'rules':{'engineerOutfit':'helmet_only','seasonLevels':{'0':'winter','1':'autumn','2':'spring','3':'summer'},'autumnRain':'continuous','name':'Oziel Rodman Ramos Torrez','homeTitle':'hOme','skipButton':False},'assets':assets,'seasons':em.get('seasons',{}),'accessories':cm.get('accessories',{}),'sources':['scripts/build_characters.cjs','scripts/build_environments.cjs','scripts/build_intro_ui.cjs']}
    anim={'schemaVersion':'1.0','characters':cm['characters'],'effects':{**em.get('animations',{}),**intro_meta.get('effects',{})},'seasonLevels':manifest['rules']['seasonLevels'],'engineerOutfit':'helmet_only'}
    manifest['productionDate']='2026-10-25'
    write('asset_manifest.json',manifest);write('animations.json',anim)
    brief=(ROOT/'reference/production_brief.md').read_text(encoding='utf-8')
    requested=re.findall(r'^\| `([a-z_]+)` \| (\d+) \| (.+) \|',brief,re.M)
    write('metadata/requested_inventory.json',[{'clip':c,'targetFrames':int(n),'description':desc} for c,n,desc in requested])
    qa={'errors':[],'warnings':[],'counts':{},'atlasChecks':[],'clipChecks':[],'loopDiagnostics':[]}
    byid={a['id']:a for a in assets}
    if len(byid)!=len(assets): qa['errors'].append('ID duplicado en manifest.')
    hashes={}
    for a in assets:
        file=ROOT/a['path']
        if not file.exists(): qa['errors'].append('Falta '+a['path']);continue
        with Image.open(file) as image:
            image.load()
            if image.size!=(a['width'],a['height']):qa['errors'].append('Dimensiones '+a['path'])
            if '/frames/' in a['path'] and a['path'].startswith('characters/'):
                if image.size!=(256,256):qa['errors'].append('Frame no 256 '+a['path'])
                if image.mode!='RGBA':qa['errors'].append('Frame no RGBA '+a['path'])
                box=image.getchannel('A').getbbox() if image.mode=='RGBA' else None
                if box is None:qa['errors'].append('Frame vacío '+a['path'])
                elif box[0]==0 or box[1]==0 or box[2]==256 or box[3]==256:qa['warnings'].append('Toca borde: '+a['path'])
            if '/clips/' in a['path'] and a['path'].startswith('characters/') and (image.height!=256 or image.width%256):qa['errors'].append('Tira inválida '+a['path'])
        if a['type']=='atlas':
            if not a.get('jsonPath'):qa['errors'].append('Atlas sin JSON '+a['path']);continue
            data=read(a['jsonPath']); w,h=data['meta']['size']['w'],data['meta']['size']['h']
            if (w,h)!=(a['width'],a['height']):qa['errors'].append('Atlas tamaño JSON '+a['path'])
            if data['meta']['image']!=Path(a['path']).name:qa['errors'].append('meta.image incorrecto '+a['path'])
            for key,f in data['frames'].items():
                rect=f['frame'];x,y,fw,fh=(rect[k] for k in ['x','y','w','h'])
                if min(x,y)<0 or x+fw>w or y+fh>h:qa['errors'].append('Rect inválido '+a['id']+':'+key)
                if f.get('rotated') is not False or f.get('trimmed') is not False:qa['errors'].append('Flags atlas '+a['id'])
                if f.get('sourceSize')!={'w':fw,'h':fh}:qa['errors'].append('sourceSize '+a['id'])
                if not all(k in f for k in ['spriteSourceSize','pivot']):qa['errors'].append('Metadata incompleta '+a['id'])
            if a['path'].startswith('characters/') and (w>2048 or h>2048):qa['errors'].append('Atlas supera 2048 '+a['path'])
            qa['atlasChecks'].append({'id':a['id'],'frames':len(data['frames']),'size':[w,h]})
    for variant,clips in anim['characters'].items():
        for name,cfg in clips.items():
            atlas=byid.get(cfg['atlasKey'])
            if not atlas:qa['errors'].append('Falta atlas para '+variant+'/'+name);continue
            data=read(atlas['jsonPath']); names=cfg['frames']
            if not names:qa['errors'].append('Sin frames '+variant+'/'+name)
            image=Image.open(ROOT/atlas['path']).convert('RGBA'); frame_hashes=[]; ims=[]
            strip=Image.open(ROOT/cfg['stripPath']).convert('RGBA') if cfg.get('stripPath') else None
            for frame_index,key in enumerate(names):
                if key not in data['frames']:qa['errors'].append('Clave ausente '+key);continue
                f=data['frames'][key]['frame'];im=image.crop((f['x'],f['y'],f['x']+f['w'],f['y']+f['h']))
                frame_hashes.append(hashlib.sha256(im.tobytes()).hexdigest());ims.append(im)
                if cfg.get('framesDirectory'):
                    single=Image.open(ROOT/cfg['framesDirectory']/(key+'.png')).convert('RGBA')
                    if not equivalent_rgba(single,im):qa['errors'].append('Atlas difiere de PNG individual '+variant+'/'+key)
                if strip:
                    strip_frame=strip.crop((frame_index*256,0,(frame_index+1)*256,256))
                    if not equivalent_rgba(strip_frame,im):qa['errors'].append('Atlas difiere de tira '+variant+'/'+key)
            if len(set(frame_hashes))<2:qa['errors'].append('Clip estático '+variant+'/'+name)
            check={'variant':variant,'clip':name,'frames':len(names),'uniqueFrames':len(set(frame_hashes)),'atlas':cfg['atlasKey'],'fps':cfg['frameRate'],'loop':cfg['repeat']==-1}
            if len(set(frame_hashes))<len(names):check['deliberateHoldOrSymmetry']=True
            qa['clipChecks'].append(check)
            if cfg['repeat']==-1 and len(ims)>1:
                from PIL import ImageChops,ImageStat
                dist=lambda x,y:sum(ImageStat.Stat(ImageChops.difference(x,y)).mean)/4
                adjacent=[dist(ims[i],ims[i+1]) for i in range(len(ims)-1)]
                qa['loopDiagnostics'].append({'variant':variant,'clip':name,'edgeDifference':round(dist(ims[-1],ims[0]),3),'meanStepDifference':round(statistics.mean(adjacent),3)})
    qa['recoveryContinuity']=[]
    for variant,clips in anim['characters'].items():
        recovery=clips['get_up']; first=Image.open(ROOT/recovery['framesDirectory']/(recovery['frames'][0]+'.png')).convert('RGBA').tobytes()
        for name in ['impact_light','impact_medium','impact_heavy']:
            impact=clips[name];last=Image.open(ROOT/impact['framesDirectory']/(impact['frames'][-1]+'.png')).convert('RGBA').tobytes()
            identical=first==last
            qa['recoveryContinuity'].append({'variant':variant,'transition':name+' -> get_up','pixelExact':identical})
            if not identical:qa['errors'].append('Corte entre impacto y levantarse '+variant+'/'+name)
    result_file=ROOT/'integration/test/browser_result.json'
    if result_file.exists():qa['phaserBrowserTest']=json.loads(result_file.read_text(encoding='utf-8'))
    produced=set(anim['characters'].get('penguin',{}))
    requested_names={r[0] for r in requested}
    qa['coverage']={'requested':len(requested_names),'producedCanonical':len(produced&requested_names),'percentage':round(100*len(produced&requested_names)/len(requested_names),2) if requested_names else 0,'missing':sorted(requested_names-produced),'countsPerVariant':{v:len(c) for v,c in anim['characters'].items()}}
    qa['counts']={'png':len(assets),'atlases':sum(a['type']=='atlas' for a in assets),'characterAtlases':sum(a['type']=='atlas' and a['path'].startswith('characters/') for a in assets),'clips':sum(len(c) for c in anim['characters'].values()),'characterFrames':sum(len(c['frames']) for clips in anim['characters'].values() for c in clips.values()),'individualCharacterFramePNGs':sum(a['path'].startswith('characters/') and '/frames/' in a['path'] for a in assets),'characterStrips':sum(a['path'].startswith('characters/') and '/clips/' in a['path'] for a in assets),'backgroundLayers':sum(a['type']=='background' for a in assets),'scenarios':len(em.get('seasons',{}))*2,'props':sum(a['type']=='prop' for a in assets),'particles':sum(a['type']=='particle' for a in assets),'ui':sum(a['type']=='ui' for a in assets),'previews':sum(a['type']=='preview' for a in assets),'effectClips':len(anim['effects'])}
    write('qa_report.json',qa)
    catalog=['# Catálogo completo de imágenes','', 'Generado desde los archivos existentes. Rutas relativas a la carpeta de entrega.','', '| ID | Archivo | Tamaño px | Alfa real | Tipo | Variante / estación / luz | Uso |','|---|---|---:|---|---|---|---|']
    for a in assets:catalog.append(f"| {a['id']} | [{a['path']}]({a['path']}) | {a['width']}×{a['height']} | {'sí' if a['alpha'] else 'no'} | {a['type']} | {a.get('characterVariant') or '—'} / {a.get('season') or '—'} / {a.get('dayNight') or '—'} | {a['notes'].replace('|','/').replace(chr(10),' ')} |")
    (ROOT/'resources_catalog.md').write_text('\n'.join(catalog),encoding='utf-8')
    table=['# Catálogo completo de animaciones','', '| Variante / clip | Atlas | Frames reales | Cant. | FPS | Loop | Origen | Siguiente | Interrumpible | Notas |','|---|---|---|---:|---:|---|---|---|---|---|']
    for variant,clips in anim['characters'].items():
        for name,c in clips.items():table.append(f"| {variant}/{name} | {c['atlasKey']} | {c['frames'][0]} … {c['frames'][-1]} | {len(c['frames'])} | {c['frameRate']} | {c['repeat']} | {c['origin']} | {c.get('next')} | {c.get('interruptible')} | {c.get('notes','').replace('|','/')} |")
    (ROOT/'animations_catalog.md').write_text('\n'.join(table),encoding='utf-8')
    # Viewable from file://: data inline, atlas images loaded directly (no fetch).
    data=json.dumps({'animations':anim['characters'],'atlases':{a['id']:'../'+a['path'] for a in assets if a['type']=='atlas'}}).replace('</','<\\/')
    html='''<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Oziel · Revisión de animaciones</title><style>body{font:16px system-ui;background:#e9efeb;color:#24352d;margin:24px}select,button,input{font:inherit;padding:8px;margin:4px}canvas{display:block;border-radius:18px;background:repeating-conic-gradient(#dde4df 0 25%,#eff3ed 0 50%) 0/32px 32px;max-width:90vw;image-rendering:auto}main{max-width:1000px;margin:auto}.row{display:flex;flex-wrap:wrap;align-items:center}#meta{white-space:pre-wrap;line-height:1.6}a{color:#315c6a}</style><main><h1>Revisión de animaciones</h1><p>Modelo basado en la referencia. Selecciona una variante y una acción; las imágenes se leen de los atlases finales.</p><div class="row"><label>Variante <select id="variant"></select></label><label>Acción <select id="clip"></select></label><button id="toggle">Pausar</button><label>Velocidad <input id="speed" type="range" min="0.25" max="2" step="0.25" value="1"></label></div><canvas id="canvas" width="512" height="512"></canvas><p id="meta"></p><p><a href="environments_overview.png">Ocho escenarios</a> · <a href="intro_ui_contact.png">Objetos e interfaz</a> · <a href="../documento.md">Guía para Claude</a></p></main><script>const DATA=__DATA__;let running=true,index=0,last=0,img=new Image(),cfg=null,rects={};const v=document.querySelector('#variant'),c=document.querySelector('#clip'),canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d');for(const k of Object.keys(DATA.animations))v.add(new Option(k,k));function choose(){c.innerHTML='';for(const k of Object.keys(DATA.animations[v.value]))c.add(new Option(k,k));load()}function load(){cfg=DATA.animations[v.value][c.value];img.src=DATA.atlases[cfg.atlasKey];index=0;document.querySelector('#meta').textContent=`${cfg.frames.length} frames · ${cfg.frameRate} FPS · origen ${cfg.origin} · loop ${cfg.repeat}\n${cfg.notes||''}`;rects=DATA.rects[cfg.atlasKey]}v.onchange=choose;c.onchange=load;document.querySelector('#toggle').onclick=()=>{running=!running;document.querySelector('#toggle').textContent=running?'Pausar':'Reproducir'};function tick(now){if(cfg&&img.complete&&img.naturalWidth){if(running&&now-last>1000/cfg.frameRate/Number(document.querySelector('#speed').value)){index=(index+1)%cfg.frames.length;last=now}const r=rects[cfg.frames[index]].frame;ctx.clearRect(0,0,512,512);ctx.drawImage(img,r.x,r.y,r.w,r.h,0,0,512,512)}requestAnimationFrame(tick)}choose();requestAnimationFrame(tick);</script></html>'''
    review_data=json.loads(data);review_data['rects']={a['id']:read(a['jsonPath'])['frames'] for a in assets if a['type']=='atlas' and a.get('jsonPath')}
    html=html.replace('environments_overview.png','environments_all_eight.png')
    (ROOT/'previews/animation_review.html').write_text(html.replace('__DATA__',json.dumps(review_data,ensure_ascii=False).replace('</','<\\/')),encoding='utf-8')
    print(json.dumps({'counts':qa['counts'],'coverage':qa['coverage'],'errors':len(qa['errors']),'warnings':len(qa['warnings'])},ensure_ascii=False,indent=2))

if __name__=='__main__': main()
