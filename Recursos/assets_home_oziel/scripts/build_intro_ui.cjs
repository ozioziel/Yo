// Editable vector production: run with Node.js and Sharp.
const fs = require('fs');
const path = require('path');
const sharp = require('C:/Users/jojoj/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp/dist/index.cjs');
const root = path.resolve(__dirname, '..');
const assets = [], effects = {};
const ink = '#080d0c', ochre = '#ae7d43', gold = '#e9b84f';
const svg = (w,h,s) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><g stroke="${ink}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">${s}</g></svg>`;
const p = (d,fill,other='') => `<path d="${d}" fill="${fill}" ${other}/>`;
const line = (x1,y1,x2,y2,color=ink,width=5) => `<path d="M${x1} ${y1}L${x2} ${y2}" fill="none" stroke="${color}" stroke-width="${width}"/>`;
const circle = (x,y,r,c,extra='') => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" ${extra}/>`;
async function asset(id, rel,w,h,body,type='prop',notes='',extra={}) {
 const source = svg(w,h,body); fs.mkdirSync(path.dirname(path.join(root,rel)),{recursive:true});
 await sharp(Buffer.from(source),{density:144}).resize(w,h).png().toFile(path.join(root,rel));
 const src=path.join(root,'sources/intro',id+'.svg');fs.mkdirSync(path.dirname(src),{recursive:true});fs.writeFileSync(src,source);
 assets.push({id,path:rel,type,width:w,height:h,format:'png',alpha:true,season:null,dayNight:null,characterVariant:null,origin:[.5,.5],recommendedScale:1,layer:'prop',depth:40,tileable:false,notes,...extra});
 return path.join(root,rel);
}
const scissors = (s=1) => `<g transform="scale(${s})"><path d="M34 38L92 13Q96 10 94 17L52 54M35 58L94 85Q98 89 96 80L52 43" fill="#d7e3e3" stroke-width="5"/><ellipse cx="25" cy="31" rx="17" ry="13" fill="#e2ad54" transform="rotate(25 25 31)"/><ellipse cx="25" cy="66" rx="17" ry="13" fill="#e2ad54" transform="rotate(-25 25 66)"/>${circle(44,49,5,ochre)}</g>`;
const snow = (x,y,r=23) => `<g transform="translate(${x} ${y})">${[0,60,120].map(a=>`<g transform="rotate(${a})">${line(-r,0,r,0,'#7399a7',4)}${p(`M${-r+7} -6L${-r+12} 0L${-r+7} 6M${r-7} -6L${r-12} 0L${r-7} 6`,'none','stroke="#7399a7" stroke-width="3"')}</g>`).join('')}</g>`;
const leaf = (x,y) => `<g transform="translate(${x} ${y})">${p('M0 24C-31 7 -26 -20 13 -26C28 -2 26 14 0 24Z','#bd7b3e','stroke-width="3"')}${p('M-4 31L10 -15M1 12L-14 2M6 0L20 -7','none','stroke-width="3"')}</g>`;
const flower = (x,y) => `<g transform="translate(${x} ${y})">${[0,60,120,180,240,300].map(a=>`<ellipse cx="0" cy="-16" rx="10" ry="16" fill="#eab5c4" stroke-width="2" transform="rotate(${a})"/>`).join('')}${circle(0,0,10,gold,'stroke-width="3"')}</g>`;
const sun=(x,y,r=17)=>`<g>${[0,45,90,135,180,225,270,315].map(a=>{let t=a*Math.PI/180;return line(x+Math.cos(t)*(r+6),y+Math.sin(t)*(r+6),x+Math.cos(t)*(r+13),y+Math.sin(t)*(r+13),ochre,4)}).join('')}${circle(x,y,r,gold,'stroke-width="3"')}</g>`;
const moon=(x,y)=>p(`M${x+10} ${y-24}C${x-25} ${y-30} ${x-39} ${y+14} ${x-10} ${y+26}Q${x+10} ${y+34} ${x+24} ${y+13}Q${x-9} ${y+17} ${x+10} ${y-24}Z`,'#f3e6b6','stroke-width="3"');
async function effect(id,n,draw,fps,repeat=0,notes=''){
 const w=128,h=128,imgs=[];
 for(let i=0;i<n;i++){
  const rel=`intro/letters_fx/${id}/frames/${id}_${String(i).padStart(3,'0')}.png`;
  const f=await asset(`${id}_${String(i).padStart(3,'0')}`,rel,w,h,draw(i/(n-1),i),'sprite',notes,{effect:id,frameIndex:i});imgs.push(f);
 }
 const rel=`intro/letters_fx/${id}.png`,jrel=`intro/letters_fx/${id}.json`;
 const buf=await Promise.all(imgs.map(f=>fs.promises.readFile(f)));
 await sharp({create:{width:w*n,height:h,channels:4,background:'#00000000'}}).composite(buf.map((input,i)=>({input,left:i*w,top:0}))).png().toFile(path.join(root,rel));
 const frames={};for(let i=0;i<n;i++)frames[`${id}_${String(i).padStart(3,'0')}`]={frame:{x:i*w,y:0,w,h},rotated:false,trimmed:false,spriteSourceSize:{x:0,y:0,w,h},sourceSize:{w,h},pivot:{x:.5,y:.5}};
 fs.writeFileSync(path.join(root,jrel),JSON.stringify({frames,meta:{app:'oziel-svg-rig',version:'1',image:path.basename(rel),format:'RGBA8888',size:{w:w*n,h},scale:'1'}},null,2));
 assets.push({id,path:rel,jsonPath:jrel,type:'atlas',width:w*n,height:h,format:'png',alpha:true,season:null,dayNight:null,characterVariant:null,cellSize:[w,h],columns:n,rows:1,frames:Object.keys(frames),clips:[id],notes});
 effects[id]={atlasKey:id,frames:Object.keys(frames),frameRate:fps,repeat,origin:[.5,.5],notes};
}
(async()=>{
 await asset('rope_intact','intro/ropes/rope_intact.png',48,512,p('M24 7C18 80 30 150 23 222S28 380 24 505','none','stroke="#46392c" stroke-width="10"')+p('M24 7C18 80 30 150 23 222S28 380 24 505','none','stroke="#c4a777" stroke-width="5"'),'prop','Cuerda vertical escalable en Y; origen superior. Zona táctil recomendada 44px de ancho.',{origin:[.5,0],hitArea:{x:2,y:0,width:44,height:512}});
 await asset('rope_taut','intro/ropes/rope_taut.png',48,512,line(24,8,24,504,'#46392c',10)+line(24,8,24,504,'#c4a777',5),'prop','Estado tenso antes del corte.',{origin:[.5,0]});
 await asset('rope_cut_top','intro/ropes/rope_cut_top.png',80,256,p('M39 8Q23 96 46 167Q55 211 34 232M34 228L20 248M35 228L40 249M36 229L50 240','none','stroke="#46392c" stroke-width="9"')+p('M39 8Q23 96 46 167Q55 211 34 232','none','stroke="#c4a777" stroke-width="4"'),'prop','Cabo libre; pivot en anclaje superior.',{origin:[.5,0]});
 await asset('rope_fragment','intro/ropes/rope_fragment.png',64,128,p('M27 10Q48 43 25 68T34 116M27 10L18 4M27 10L34 3M34 116L25 124M34 116L43 123','none','stroke="#b79a6a" stroke-width="7"'),'prop','Fragmento físico efímero al corte.');
 await asset('anchor','intro/ropes/anchor.png',96,64,'<rect x="12" y="14" width="72" height="26" rx="9" fill="#7c8d8b"/>'+circle(27,27,3,'#cad2d0','stroke-width="2"')+circle(69,27,3,'#cad2d0','stroke-width="2"')+p('M38 36V49Q48 63 58 49V36','none','stroke-width="7"'),'prop','Soporte separado; cuerda sale en centro inferior.',{origin:[.5,1]});
 const ladder=(y0=12,y1=500)=>`<rect x="28" y="${y0}" width="15" height="${y1-y0}" rx="7" fill="${ochre}"/><rect x="113" y="${y0}" width="15" height="${y1-y0}" rx="7" fill="${ochre}"/>`+Array.from({length:Math.floor((y1-y0-25)/48)},(_,i)=>`<rect x="40" y="${y0+25+i*48}" width="76" height="11" rx="4" fill="#d5b17a" stroke-width="4"/>`).join('');
 await asset('ladder_complete','intro/ladder/ladder_complete.png',160,512,ladder(),'prop','Escalera entera separada; peldaños y=37+48i. Alinear manos con peldaño; no reflejar mientras se sube.',{origin:[.5,1],rungSpacing:48,railX:[35,120],rungY:Array.from({length:9},(_,i)=>37+48*i)});
 await asset('ladder_segment','intro/ladder/ladder_segment.png',160,256,ladder(12,244),'prop','Segmento apilable de escalera; montar en escena.',{origin:[.5,1],rungSpacing:48});
 await asset('ladder_foot','intro/ladder/ladder_foot.png',160,64,'<rect x="19" y="22" width="36" height="30" rx="8" fill="#343936"/><rect x="101" y="22" width="36" height="30" rx="8" fill="#343936"/>','prop','Bases de apoyo separadas de escalera.');
 for(const on of [false,true])for(const night of [false,true]){
 const id=`switch_${on?'on':'off'}${night?'_night':''}`;
 await asset(id,`intro/switch/${id}.png`,128,160,`<rect x="18" y="12" width="92" height="136" rx="17" fill="${night?'#a8baba':'#e6e9df'}"/>${circle(64,27,3,ink,'stroke="none"')}${circle(64,133,3,ink,'stroke="none"')}<rect x="42" y="49" width="44" height="62" rx="8" fill="#384340"/>${p(on?'M46 54L82 62V103L46 94Z':'M46 62L82 54V94L46 103Z',on?'#e5bf58':'#7c8b87')}${circle(64,39,4,on?'#a6cc9b':'#6b7976','stroke-width="2"')}`,'prop','Centro de contacto de aleta (64,80), escala sugerida .4 en mundo.',{interactionPoint:[64,80],dayNight:night?'night':'day'});
 }
 await asset('blackout','intro/switch/blackout.png',64,64,'<rect width="64" height="64" fill="#070a0b" stroke="none"/>','sprite','Estirar a viewport y animar alpha; independiente del interruptor día/noche.',{alpha:false,layer:'overlay',depth:1000});
 await asset('scissors_tool','intro/tools/scissors_tool.png',128,128,`<g transform="translate(10 14)">${scissors()}</g>`,'prop','Herramienta temporal; punta de corte local (104,64). Se muestra solo durante cut_rope.',{cutPoint:[104,64],gripPoint:[36,64]});
 await asset('scissors_cursor','ui/scissors_cursor.png',32,32,`<g transform="translate(1 1)">${scissors(.3)}</g>`,'ui','Cursor CSS de 32px, hotspot (27,15).',{hotspot:[27,15]});
 await asset('scissors_touch','ui/scissors_touch.png',96,96,circle(48,48,43,'#f0e7ce','stroke-width="3"')+`<g transform="translate(10 10)">${scissors(.75)}</g>`,'ui','Indicador para cuerda seleccionada con touch; no reemplaza área táctil.');
 await asset('contact_shadow','intro/letters_fx/contact_shadow.png',256,64,'<ellipse cx="128" cy="32" rx="116" ry="21" fill="#13221f" opacity=".18" stroke="none"/>','sprite','Sombra de contacto separada; escala con altura de personaje.');
 await asset('rope_shadow','intro/ropes/rope_shadow.png',48,512,'<rect x="21" y="5" width="7" height="502" rx="3" fill="#16221e" opacity=".15" stroke="none"/>','sprite','Sombra separada desplazable.');
 await asset('frost_corner','intro/letters_fx/frost_corner.png',128,128,p('M10 12H116L103 24L95 19L82 39L75 22L59 29L54 20L40 52L29 22L10 34Z','#e2f4f0','stroke="#779ba4" stroke-width="3"')+snow(90,58,13),'sprite','Escarcha modular de esquina para letras vivas; ocultar al cambiar de estación.');
 await asset('frost_melt','intro/letters_fx/frost_melt.png',128,64,p('M10 40Q33 29 57 41Q80 30 117 43Q108 59 65 56Q29 60 10 40Z','#a8d3d9','stroke="#739ca5" stroke-width="2"')+p('M50 10Q36 29 49 32Q64 32 50 10Z','#c4e6e5','stroke-width="2"'),'sprite','Estado derretido separable de la letra.');
 for(const [id,shape] of [['surprise',line(35,10,35,48)+circle(35,64,5,gold)],['curiosity',p('M17 25C17 2 55 2 55 25Q55 38 37 43V51','none')+circle(37,68,4,ochre)]])await asset(`expression_${id}`,`intro/letters_fx/expression_${id}.png`,72,88,shape,'sprite','Efecto expresivo opcional y separado del personaje.');
 await effect('fx_cut',6,(t)=>{
 let out='';for(let i=0;i<6;i++){let a=i*Math.PI/3,r=12+t*28;out+=line(64+Math.cos(a)*r,64+Math.sin(a)*r,64+Math.cos(a)*(r+13*(1-t)),64+Math.sin(a)*(r+13*(1-t)),ochre,4*(1-t)+1)}return `<g opacity="${1-t*.85}">${out}</g>`;
 },18,0,'Estallido corto al cortar cualquier cuerda; origen en punto de corte.');
 await effect('fx_dust',8,(t)=>Array.from({length:5},(_,i)=>`<ellipse cx="${24+i*20+(i-2)*t*4}" cy="${93-t*(12+Math.sin(i)*8)}" rx="${8+12*t}" ry="${5+8*t}" fill="#c9ba96" opacity="${(1-t)*.6+.03}" stroke="none"/>`).join(''),16,0,'Polvo suave tras impacto de letras/escalera.');
 await effect('fx_o_glow',8,(t)=>`<circle cx="64" cy="64" r="${24+t*25}" fill="none" stroke="#e7ba65" stroke-width="${9-7*t}" opacity="${1-t*.9}"/>`+[0,1,2,3].map(i=>{let a=i*Math.PI/2+.3,r=39+18*t;return p(`M${64+Math.cos(a)*r} ${64+Math.sin(a)*r-6}l2 4 4 2-4 2-2 4-2-4-4-2 4-2Z`,'#f2d794','stroke="none"')}).join(''),14,0,'Halo al encajar O de hOme; mantener letra como texto.');
 await effect('fx_impact',6,(t)=>p(`M12 ${94+t*7}Q${40-t*14} ${65-t*14} 62 87Q${82+t*12} ${58-t*10} 116 ${95+t*5}`,'none',`stroke="#8c9b8e" stroke-width="${5-3*t}" opacity="${1-t*.85}"`),18,0,'Arcos de golpe para apoyo de escalera o rebote de letras.');
 const icons=[()=>snow(48,48),()=>leaf(48,48),()=>flower(48,48),()=>sun(48,48)];
 for(let level=0;level<4;level++)for(const state of ['normal','hover','selected','focus']){
  const fill={normal:'#ecefe7',hover:'#faf5e8',selected:'#e4c681',focus:'#ecefe7'}[state];
  let body=`<rect x="7" y="7" width="82" height="82" rx="24" fill="${fill}" stroke-width="${state==='selected'?5:3}"/>`+icons[level]();
  if(state==='focus')body+='<rect x="2" y="2" width="92" height="92" rx="28" fill="none" stroke="#527686" stroke-width="3"/>';
  await asset(`season_${level}_${state}`,`ui/season_${level}_${state}.png`,96,96,body,'ui',`Nivel ${level}; estado ${state}; etiqueta accesible se añade en HTML.`,{season:['winter','autumn','spring','summer'][level],level,state,depth:900});
 }
 for(const night of [false,true])for(const state of ['normal','hover','focus']){
  let body=`<rect x="5" y="5" width="150" height="70" rx="35" fill="${night?'#476276':'#e0d9b5'}" stroke-width="3"/>${circle(night?120:40,40,29,state==='hover'?'#fff8e7':'#f0f1df','stroke-width="3"')}`;
  body+=night?`<g transform="translate(120 40) scale(.65) translate(-120 -40)">${moon(120,40)}</g>`:sun(40,40,12);
  if(state==='focus')body+='<rect x="1" y="1" width="158" height="78" rx="39" fill="none" stroke="#638c9b" stroke-width="2"/>';
  await asset(`day_night_${night?'night':'day'}_${state}`,`ui/day_night_${night?'night':'day'}_${state}.png`,160,80,body,'ui','Control independiente de apagón narrativo.',{dayNight:night?'night':'day',state,depth:900});
 }
 await asset('grab_cursor','ui/grab_cursor.png',32,32,p('M9 28V16Q9 12 12 14V7Q14 3 17 7V14Q20 10 22 14Q26 11 27 16V24L24 29Z','#e4c693','stroke-width="2"'),'ui','Feedback de agarre opcional, hotspot (15,17).',{hotspot:[15,17]});
 await asset('home_typography_reference','reference/home_typography_reference.png',800,240,'<text x="400" y="175" font-family="Trebuchet MS,Arial,sans-serif" font-size="178" font-weight="bold" text-anchor="middle" fill="#353936" stroke="none">h<tspan fill="#b48542">O</tspan>me</text>','preview','Referencia tipográfica únicamente. Usar texto HTML editable en integración.',{alpha:true});
 fs.writeFileSync(path.join(root,'metadata/intro_ui.json'),JSON.stringify({assets,effects,ui:{seasonLevels:{0:'winter',1:'autumn',2:'spring',3:'summer'},cursorHotspot:[27,15],homeFont:'Trebuchet MS, Arial, sans-serif'},extraDecisions:['Cursores a 32px para compatibilidad CSS; indicador táctil separado de96px.','Escarcha modular, estado derretido, sombra y bases de escalera separados.']},null,2));
 console.log(`Intro/UI: ${assets.length} imágenes; ${Object.keys(effects).length} clips FX.`);
})();
