/* Editable environment production. Node + Sharp, no AI raster editing. */
const fs = require('fs');
const path = require('path');
const sharp = require('C:/Users/jojoj/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp/dist/index.cjs');
const ROOT = path.resolve(__dirname, '..');
const INK = '#152322';
const assets = [], seasons = {}, animations = {};
function svg(w,h,body) { return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><g stroke="${INK}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`; }
const p = (d,fill,other='') => `<path d="${d}" fill="${fill}" ${other}/>`;
const e = (x,y,rx,ry,fill,other='')=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" ${other}/>`;
const c = (x,y,r,fill,other='')=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" ${other}/>`;
const r = (x,y,w,h,fill,rx=0,other='')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" ${other}/>`;
const line=(x1,y1,x2,y2,color=INK,sw=5)=>`<path d="M${x1} ${y1}L${x2} ${y2}" fill="none" stroke="${color}" stroke-width="${sw}"/>`;
const group=(s,x,y,scale=1,rot=0)=>`<g transform="translate(${x} ${y}) rotate(${rot}) scale(${scale})">${s}</g>`;
async function emit(rel,w,h,body,meta={}) {
  const filename=path.join(ROOT,rel); fs.mkdirSync(path.dirname(filename),{recursive:true});
  const src=svg(w,h,body), srcrel='sources/'+rel.replace(/\.png$/,'.svg');
  fs.mkdirSync(path.dirname(path.join(ROOT,srcrel)),{recursive:true}); fs.writeFileSync(path.join(ROOT,srcrel),src);
  await sharp(Buffer.from(src),{density:w>1000?72:144}).resize(w,h).png().toFile(filename);
  const image=await sharp(filename).metadata();
  assets.push({id:rel.replace(/\.png$/,'').replaceAll('/','_'),path:rel,type:'prop',width:w,height:h,format:'PNG',alpha:!!image.hasAlpha,season:null,dayNight:null,characterVariant:null,origin:[.5,1],recommendedScale:1,notes:'Ilustración vectorial; fuente SVG editable incluida.',...meta});
  return assets.at(-1).id;
}
function cloud(x,y,s,fill='#f4f7f2'){return group(p('M-95 30 C-121 25 -118 -10 -86 -15 C-80 -58 -31 -73 -2 -41 C25 -72 65 -47 65 -17 C110 -23 122 25 87 32 Z',fill,'stroke-width="4"'),x,y,s);}
function pine(x,y,s,fill,snow=false) { return group(r(-10,-50,20,70,'#7e6855',5)+p('M0 -225 L-69 -131 L-43 -131 L-92 -54 L-62 -54 L-111 7 Q0 38 111 7 L62 -54 L92 -54 L43 -131 L69 -131 Z',fill)+(snow?p('M0 -225 L-50 -155 Q0 -132 50 -155 Z','#edf5ed')+p('M-59 -103 L-82 -61 Q-2 -37 82 -61 L59 -103 Q0 -81 -59 -103Z','#edf5ed')+p('M-85 -34 L-106 7 Q0 32 106 7 L85 -34 Q0 -10 -85 -34Z','#edf5ed'):''),x,y,s); }
function tree(x,y,s,fill,autumn=false){return group(p('M-13 0L-10 -140L-47 -182L-38 -190L0 -153L31 -205L42 -201L10 -138L15 0Z','#89705a')+e(-53,-194,60,70,fill)+e(33,-222,76,78,fill)+e(85,-172,50,58,fill)+e(-9,-160,75,50,fill)+(autumn?c(-55,-211,18,'#e5b55b','stroke="none"')+c(62,-204,20,'#df8c53','stroke="none"'):''),x,y,s);}
function palm(x,y,s,fill){return group(p('M-11 0 Q8 -99 30 -202 L47 -204 Q21 -97 14 0Z','#b88960')+p('M39 -198 Q-26 -261 -91 -216 Q-36 -201 36 -185 Q-21 -163 -61 -136 Q-13 -122 43 -182 Q66 -120 110 -107 Q105 -158 51 -190 Q119 -175 156 -199 Q102 -236 45 -200 Q76 -255 104 -272 Q47 -269 39 -198Z',fill)+c(34,-183,12,'#a8724c')+c(56,-180,10,'#a8724c'),x,y,s);}
function flower(x,y,s,color='#ed8fa6',stage=2){let b=p('M0 0Q-5 -20 1 -46','none','stroke="#4e805e" stroke-width="5"')+p('M0 -15Q-31 -34 -24 -9Q-8 -6 0 -15Z','#73a979')+p('M1 -27Q26 -49 27 -28Q13 -21 1 -27Z','#73a979');if(stage>0)b+=stage===1?p('M-9 -42Q-19 -69 0 -64Q18 -68 11 -43Z',color):[0,60,120,180,240,300].map(a=>`<g transform="translate(0 -53) rotate(${a})">${e(0,-14,10,15,color)}</g>`).join('')+c(0,-53,10,'#f1c965');return group(b,x,y,s);}
function grass(x,y,s,col='#74a275'){return group(p('M-35 0Q-45 -36 -49 -43Q-16 -32 -11 -6Q-12 -44 0 -58Q11 -35 11 -6Q24 -34 46 -39Q32 -12 35 0Z',col),x,y,s);}
function leaf(x,y,s,rot,col='#c8874f'){return group(p('M0 -35 C35 -32 39 -2 0 28 C-37 3 -29 -28 0 -35Z',col)+p('M0 27L0 -25M0 5L17 -6M0 -9L-12 -20','none','stroke-width="3"'),x,y,s,rot);}
function snowflake(x,y,s,rot=0){return group([0,60,120].map(a=>`<g transform="rotate(${a})">${line(-30,0,30,0,'#ffffff',5)+p('M-23 -9L-14 0L-23 9M23 -9L14 0L23 9','none','stroke="#ffffff" stroke-width="4"')}</g>`).join(''),x,y,s,rot);}
const palettes={winter:{day:['#dbeef1','#a9cdd3','#c9dedb','#f1f6ed','#d8e9e8'],night:['#243d56','#46697b','#71939e','#c5dddd','#9dbec7']},autumn:{day:['#d9e4df','#a1b2a1','#bbbc9b','#dfc697','#b3b184'],night:['#2b3c52','#596876','#7d847e','#baa887','#8c947d']},spring:{day:['#dff1e9','#b4d6c9','#a4c596','#c5dca0','#8fba83'],night:['#263e53','#527c83','#709e83','#a6c593','#7eae91']},summer:{day:['#d6eff0','#94c6d0','#6eb5c4','#f3d7a3','#dfc18d'],night:['#243f58','#416d88','#578f9f','#c9bd9a','#a6a68c']}};
async function buildScenes(){
for(const season of Object.keys(palettes)){seasons[season]={};for(const mode of ['day','night']){
 const [sky,far,mid,ground,fg]=palettes[season][mode],night=mode==='night';const base=`environments/${season}/${mode}/`;
 let skybody=`<defs><linearGradient id="s" x2="0" y2="1"><stop stop-color="${sky}"/><stop offset="1" stop-color="${night?'#768f98':'#f3f2df'}"/></linearGradient></defs>`+r(0,0,1920,1080,'url(#s)',0,'stroke="none"');
 if(night){skybody+=c(1550,180,62,'#e3ead0','stroke="none"')+c(1572,164,54,sky,'stroke="none"');for(let i=0;i<26;i++){let x=58+(i*227)%1810,y=90+(i*83)%430;skybody+=c(x,y,i%3?2.3:3.4,'#e2eddf','stroke="none"');}}else skybody+=c(1560,180,64,'#f0d18a','stroke="#e1bc6f" stroke-width="4"');
 skybody+=cloud(320,185,1.2,night?'#506e7e':'#f1f7f0')+cloud(1280,350,.8,night?'#496a7c':'#edf5ee')+cloud(1730,370,.55,night?'#496a7c':'#edf5ee');
 const layers=[];layers.push(await emit(base+'sky.png',1920,1080,skybody,{type:'background',season,dayNight:mode,layer:'sky',depth:0,alpha:false,origin:[0,0],notes:'Cielo opaco; permite encuadre extendido por color de borde. Zona central de texto despejada.'}));
 let farbody=p('M-60 788 Q172 550 402 742 Q670 545 918 751 Q1192 540 1430 740 Q1650 550 1980 735 L1980 1080L-60 1080Z',far,'stroke="none"');
 if(season==='winter')farbody+=p('M105 683Q190 599 290 657L248 674L220 660L189 690L166 676Z',night?'#aecbd0':'#eaf3ed','stroke="none"')+p('M1009 675Q1151 573 1261 671L1218 677L1169 653L1114 686L1081 670Z',night?'#aecbd0':'#eaf3ed','stroke="none"');
 if(season==='summer')farbody=p('M0 655Q500 628 960 650T1920 655L1920 1080L0 1080Z',far,'stroke="none"')+p('M0 704Q410 688 800 713T1600 708T1920 708','none',`stroke="${night?'#8bb7c0':'#d8ece2'}" stroke-width="6"`)+p('M1350 653L1480 599Q1530 614 1570 653Z',night?'#46636d':'#85a99b','stroke="none"');
 layers.push(await emit(base+'far_background.png',1920,1080,farbody,{type:'background',season,dayNight:mode,layer:'far_background',depth:10,origin:[0,0],parallax:.15}));
 let midbody=p('M-20 878Q265 748 554 835Q870 775 1199 836Q1489 740 1940 857L1940 1080L-20 1080Z',mid,'stroke="none"');
 if(season==='winter')midbody+=pine(130,866,1.5,night?'#4f7777':'#6e9c94',true)+pine(300,844,.8,night?'#4f7777':'#6e9c94',true)+pine(1740,866,1.2,night?'#4f7777':'#6e9c94',true)+pine(1875,840,.7,night?'#4f7777':'#6e9c94',true);
 if(season==='autumn')midbody+=tree(100,858,1.4,night?'#938d6d':'#cba064',true)+tree(1850,866,1.2,night?'#9c8069':'#d1985c',true)+leaf(155,839,.35,10)+leaf(1790,830,.4,-40);
 if(season==='spring')midbody+=tree(45,865,1.3,night?'#639383':'#8bb47e')+tree(1855,855,1.1,night?'#639383':'#8bb47e')+flower(275,854,.7,'#e6aac1')+flower(1670,860,.6,'#e7bb93');
 if(season==='summer')midbody=p('M0 727Q230 710 470 748T950 743T1450 745T1920 737L1920 1080L0 1080Z',mid,'stroke="none"')+p('M0 799Q240 781 479 810T950 808T1450 803T1920 808','none',`stroke="${night?'#b1d0cb':'#f3f2de'}" stroke-width="12"`)+p('M0 850Q260 817 520 858T1040 856T1560 849T1920 850L1920 1080L0 1080Z',ground,'stroke="none"')+p('M0 855Q260 822 520 863T1040 861T1560 854T1920 855','none',`stroke="${night?'#d2ddd2':'#fff5dc'}" stroke-width="10"`)+palm(90,875,1.25,night?'#638b7c':'#7fa780')+palm(1810,872,1.05,night?'#638b7c':'#7fa780');
 layers.push(await emit(base+'midground.png',1920,1080,midbody,{type:'background',season,dayNight:mode,layer:'midground',depth:20,origin:[0,0],parallax:.4}));
 let groundbody=p('M-10 906Q340 893 670 903T1300 902T1930 905L1930 1090L-10 1090Z',ground,`stroke="${night?'#617c7b':'#8ca39a'}" stroke-width="4"`);
 if(season==='winter')groundbody+=p('M20 972Q135 929 259 964Q318 987 366 967','none',`stroke="${fg}" stroke-width="7"`)+p('M1480 1000Q1614 954 1772 990','none',`stroke="${fg}" stroke-width="7"`);
 if(season==='autumn')groundbody+=e(290,961,128,23,night?'#719195':'#a0b7af','stroke="none"')+e(1580,1002,160,27,night?'#719195':'#a0b7af','stroke="none"')+p('M216 962Q276 953 326 961M1490 1002Q1570 992 1650 1002','none','stroke="#cbd8c7" stroke-width="4"');
 if(season==='spring')groundbody+=p('M100 959L106 947M111 961L119 950M1560 1001L1569 985M1573 1001L1572 987M800 1020L806 1008','none',`stroke="${fg}" stroke-width="5"`);
 if(season==='summer')groundbody+=p('M180 984Q223 974 260 984M1370 947Q1420 937 1477 948M990 1031Q1026 1022 1069 1030','none',`stroke="${fg}" stroke-width="4"`)+c(350,1010,4,fg,'stroke="none"')+c(1640,975,3,fg,'stroke="none"');
 layers.push(await emit(base+'ground.png',1920,1080,groundbody,{type:'background',season,dayNight:mode,layer:'ground',depth:30,origin:[0,0],walkBaseline:900,walkableRect:{x:210,y:900,width:1500,height:145},notes:'Borde visual de suelo y plataforma lógica recomendada y=900. Personajes a profundidad 40.'}));
 let fore='';
 if(season==='winter')fore=p('M-10 1085L-10 1016Q130 949 294 1035Q390 1022 460 1085Z',fg)+p('M1440 1085Q1580 1005 1714 1040Q1830 982 1930 1030L1930 1085Z',fg);
 if(season==='autumn')fore=[...Array(12)].map((_,i)=>leaf(i<6?40+i*40:1600+(i-6)*56,1045+(i%2)*15,.6,(i*57)%360,i%2?'#a57855':'#c29760')).join('');
 if(season==='spring')fore=grass(40,1080,2,fg)+grass(170,1080,1.6,fg)+grass(1830,1080,2,fg)+flower(95,1075,1.1,'#dfb1c2')+flower(1780,1080,1.2,'#edc776');
 if(season==='summer')fore=grass(40,1080,1.7,fg)+grass(1890,1080,1.9,fg)+p('M128 1060Q145 1027 173 1060Q153 1082 128 1060Z',night?'#c7b3a1':'#edc4aa')+p('M1740 1070Q1762 1033 1796 1070Z',night?'#c7b3a1':'#edc4aa');
 layers.push(await emit(base+'foreground.png',1920,1080,fore,{type:'background',season,dayNight:mode,layer:'foreground',depth:60,origin:[0,0],parallax:1.1}));
 const files=layers.map(id=>assets.find(a=>a.id===id).path);
 let comp=sharp({create:{width:1920,height:1080,channels:4,background:'#ffffff'}}).composite(files.map(f=>({input:path.join(ROOT,f)})));
 if(season==='autumn') {let rain='';for(let i=0;i<95;i++){const x=(i*239)%1920,y=(i*157)%1080;rain+=line(x,y,x-9,y+24,night?'#aec8cf':'#789ba7',2);}comp=sharp(await comp.png().toBuffer()).composite([{input:Buffer.from(svg(1920,1080,rain))}]);}
 const preview=`previews/environments_${season}_${mode}.png`;await comp.png().toFile(path.join(ROOT,preview));
 seasons[season][mode]={layers,preview,walkBaseline:900,worldSize:[1920,1080],characterDepth:40,foregroundDepth:60,centerSafeRect:{x:420,y:170,width:1080,height:610},mobile:{strategy:'Capas escaladas con cover; personajes, props y texto se recolocan con coordenadas normalizadas.',focus:[.5,.65]},ambient:season==='autumn'?'continuous_rain':season==='winter'?'snow':season==='spring'?'petals_and_butterflies':'waves'};
 }}
}
async function prop(season,name,w,h,body,type='prop',notes=''){return emit(`environments/${season}/${type==='particle'?'particles':'props'}/${name}.png`,w,h,body,{type,season:season==='common'?null:season,notes:notes||'Prop separado para composición y animación en Phaser.'});}
async function buildProps(){
 await prop('common','contact_shadow',160,40,e(80,20,74,15,'#152322','stroke="none" opacity=".18"'));
 await prop('common','sun',160,160,c(80,80,37,'#f0d18a')+[0,45,90,135,180,225,270,315].map(a=>group(line(0,-55,0,-69,'#c3a263',5),80,80,1,a)).join(''),'prop','Sol aislado; el control de día/noche está en ui/.');
 await prop('common','moon',160,160,p('M105 20C45 16 14 66 41 112C61 147 115 146 141 110C81 128 48 68 105 20Z','#ecedd0'));
 await prop('common','star',80,80,p('M40 6L49 29L74 32L55 48L60 73L40 59L18 73L24 48L5 32L30 29Z','#f4e8ab'),'particle');
 await prop('common','cloud',256,128,cloud(128,67,.96,'#edf5ef'));
 await prop('common','rock',160,100,p('M15 85L24 42L71 14L118 33L146 80Q89 104 15 85Z','#99aaa0')+p('M24 42L68 61L71 14M68 61L146 80','none','stroke="#71867c" stroke-width="4"'));
 await prop('common','log_seat',240,100,r(35,22,180,64,'#a68261',27)+e(37,54,28,33,'#d0ae7d')+e(37,54,15,20,'none','stroke="#94704f" stroke-width="4"')+p('M86 35Q130 48 195 36M95 70Q153 61 194 72','none','stroke="#755c48" stroke-width="4"'));
 for(let i=0;i<4;i++)await prop('winter',`snowflake_${i}`,80,80,snowflake(40,40,.85,i*15),'particle');
 await prop('winter','snow_grain',24,24,c(12,12,5,'#ffffff','stroke="none"'),'particle');
 await prop('winter','snowbank',300,110,p('M8 93Q6 54 62 57Q87 8 146 42Q202 8 239 62Q296 51 293 93Z','#edf5ed'));
 await prop('winter','snowy_pine',280,350,pine(140,312,1.18,'#6e9c94',true));
 await prop('winter','snow_cap',220,60,p('M8 30Q31 5 63 18Q110 1 159 15Q193 1 212 29Q216 43 197 42L160 40Q146 61 136 40L58 39Q43 61 37 40L17 42Q3 41 8 30Z','#eff6ef'));
 await prop('winter','ice_patch',300,100,p('M12 57L55 23L132 12L218 25L287 61L250 84L116 91L35 79Z','#a4d8df')+p('M69 47L139 30M137 69L208 50M224 66L250 58','none','stroke="#e9f7ee" stroke-width="7"'));
 await prop('winter','frost_letter_overlay',240,100,p('M9 26L29 9L52 27L81 9L111 29L145 11L175 27L205 8L232 28L218 53L193 45L178 77L158 43L135 52L116 82L99 47L71 55L56 89L40 47L14 53Z','#c4e6e6','opacity=".9"')+line(28,31,208,31,'#eef9ef',4));
 await prop('winter','melt_water',220,50,e(110,29,101,15,'#a4d8df','stroke="#80b8c4" stroke-width="3"'));
 await prop('winter','snowball',64,64,c(32,32,25,'#edf5ed')+p('M19 43Q32 51 45 40','none','stroke="#c1dad6" stroke-width="4"'));
 for(let st=1;st<=3;st++){let b=c(100,151,65,'#edf5ed')+p('M61 183Q93 204 132 179','none','stroke="#c3d8d4" stroke-width="5"');if(st>1)b+=c(100,79,46,'#edf5ed');if(st>2)b+=c(100,77,5,INK)+c(120,77,5,INK)+p('M111 88L147 96L111 99Z','#c78952')+c(100,137,5,INK)+c(100,157,5,INK)+p('M37 135L12 100M161 136L187 101','none','stroke="#8b6d50" stroke-width="6"')+p('M77 109Q101 120 132 107L139 123L119 126L120 157L105 155L102 125Q86 123 74 120Z','#bb7770');await prop('winter',`snowman_stage_${st}`,200,230,b);}
 await prop('winter','breath_puff',160,90,e(49,50,25,19,'#edf5ed','stroke="none" opacity=".5"')+e(82,37,32,25,'#edf5ed','stroke="none" opacity=".4"')+e(118,28,26,22,'#edf5ed','stroke="none" opacity=".25"'),'particle');
 for(let i=0;i<5;i++)await prop('autumn',`leaf_${i}`,80,90,leaf(40,45,.9,i*43,['#cf9b58','#b9774e','#d5b76c','#a98855','#c68a59'][i]),'particle');
 await prop('autumn','leaf_pile',280,130,[...Array(14)].map((_,i)=>leaf(27+(i*43)%224,70+(i%3)*13,.65,(i*61)%360,['#cf9b58','#b9774e','#d5b76c'][i%3])).join(''));
 await prop('autumn','rain_drop',24,64,p('M12 5Q-4 35 6 49Q18 62 21 45Q23 35 12 5Z','#a4c9d6','stroke="#7198aa" stroke-width="2"'),'particle','Emisión continua mientras autumn esté activo; no sincronizar con ciclo día/noche.');
 await prop('autumn','rain_streak',20,70,line(15,6,5,63,'#95b9c7',3),'particle');
 await prop('autumn','puddle',260,90,p('M15 49Q30 22 78 29Q137 1 175 26Q242 13 250 49Q246 79 187 72Q116 96 73 73Q22 85 15 49Z','#9bbac2','stroke="#6d929a" stroke-width="4"')+p('M57 47Q108 30 163 40M132 65Q179 58 211 52','none','stroke="#d8e7df" stroke-width="4"'));
 await prop('autumn','autumn_tree',300,370,tree(145,354,1.03,'#cba064',true));
 await prop('spring','grass_tuft',140,110,grass(70,105,1.3));
 for(const [i,color] of ['#e9a5ba','#edc971','#c2aad3'].entries())await prop('spring',`flower_${i}`,130,150,flower(65,142,1.55,color));
 for(let st=0;st<3;st++)await prop('spring',`flower_stage_${st}`,130,150,flower(65,142,1.55,'#e9a5ba',st));
 for(let i=0;i<3;i++)await prop('spring',`petal_${i}`,50,60,group(e(0,0,12,23,['#e9a5ba','#f0c4cd','#c5afd6'][i],'stroke="none"'),25,30,1,i*50),'particle');
 await prop('spring','bush',240,150,group(p('M15 132Q-2 89 36 77Q26 40 70 43Q86 7 124 34Q169 5 183 49Q227 41 223 79Q255 104 224 133Z','#87af82')+flower(59,116,.5,'#e8b2c4')+flower(174,106,.5,'#edcf78'),6,5,.94));
 await prop('spring','spring_tree',300,370,tree(145,354,1.03,'#8bb47e'));
 await prop('summer','sunscreen_bottle',80,140,r(22,7,36,23,'#b2d5ce',6)+p('M21 27L59 27L65 122Q42 140 15 122Z','#f5e9cc')+r(22,58,36,39,'#ddb86a',8)+c(40,77,11,'#f7df96','stroke-width="3"'));
 await prop('summer','sunscreen_cream',80,60,p('M12 46Q2 31 26 26Q44 19 39 8Q60 17 53 30Q82 27 69 46Z','#f5f3df','stroke="#b8c1ae" stroke-width="3"'));
 for(let st=1;st<=3;st++){let b=p('M14 182L40 113L224 113L251 182Z','#d9b77e')+p('M38 129L224 129','none','stroke="#b99663" stroke-width="4"');if(st>1)b+=r(58,65,149,75,'#e4c58d',5)+p('M58 65L58 43L81 43L81 60L102 60L102 43L125 43L125 60L146 60L146 43L169 43L169 60L190 60L190 43L207 43L207 65Z','#e4c58d');if(st>2)b+=r(27,57,42,114,'#e6c890',5)+r(201,57,42,114,'#e6c890',5)+p('M27 58L27 36L40 36L40 48L56 48L56 36L69 36L69 58M201 58L201 36L214 36L214 48L230 48L230 36L243 36L243 58','#e6c890')+p('M112 178L112 133Q132 108 151 133L151 178Z','#a9865d')+line(136,43,136,9,'#8a6c4d',4)+p('M136 9L171 17L136 28Z','#cc8e78');await prop('summer',`sandcastle_stage_${st}`,270,210,b);}
 await prop('summer','beach_ball',128,128,c(64,64,55,'#ede4bf')+p('M64 9Q31 31 64 64Q96 94 64 119Q112 112 119 64Q117 27 64 9Z','#cb8d75')+p('M9 64Q31 32 64 64Q86 96 119 64Q115 115 64 119Q17 112 9 64Z','#83b5b1')+c(64,64,10,'#ede4bf'));
 await prop('summer','bucket',120,130,p('M24 45L96 45L84 118Q60 131 36 118Z','#d69d76')+p('M28 42Q30 -4 90 42','none','stroke="#577f80" stroke-width="7"')+e(60,46,39,11,'#e8bf91')+p('M36 61L42 105','none','stroke="#efc5a1" stroke-width="7"'));
 await prop('summer','shovel',80,170,group(r(-12,-64,24,48,'#bb8e63',8)+r(-7,-24,14,81,'#bb8e63',5)+p('M-25 49L25 49L21 91Q0 112 -21 91Z','#89b9b7'),43,70,.85,12));
 await prop('summer','seashell',120,100,p('M15 67Q3 28 32 27Q37 2 61 14Q85 3 90 28Q119 25 106 68L72 87L47 87Z','#e5b89f')+p('M29 34L51 77M60 25L60 76M88 35L70 77','none','stroke="#b68f7c" stroke-width="4"'));
 await prop('summer','seafoam',220,80,p('M8 46Q19 27 43 40Q59 13 86 35Q103 15 124 36Q151 19 174 39Q206 23 212 49Q195 68 171 54Q148 70 123 55Q103 71 82 55Q59 70 40 54Q18 67 8 46Z','#e9eee0','stroke="#bbd6ca" stroke-width="3"'),'particle');
 await prop('summer','coastal_grass',160,140,grass(80,132,1.45,'#9baa7b'));
 await prop('summer','palm_tree',360,390,palm(150,375,1.25,'#7fa780'));
}
async function sequence(season,name,count,size,draw,fps,loop=true,notes=''){
 let frames=[];const folder=`environments/${season}/particles/${name}`;
 for(let i=0;i<count;i++){const rel=`${folder}/${name}_${String(i).padStart(3,'0')}.png`;await emit(rel,size[0],size[1],draw(i,count),{type:'particle',season,animation:name,frameIndex:i,origin:[.5,.5],notes});frames.push(rel);}
 const cols=Math.min(8,count),rows=Math.ceil(count/cols),aw=cols*size[0],ah=rows*size[1],key=`${season}_${name}`;
 const atlasrel=`environments/${season}/particles/${name}_atlas.png`,jsonrel=atlasrel.replace('.png','.json');
 await sharp({create:{width:aw,height:ah,channels:4,background:'#00000000'}}).composite(frames.map((f,i)=>({input:path.join(ROOT,f),left:i%cols*size[0],top:Math.floor(i/cols)*size[1]}))).png().toFile(path.join(ROOT,atlasrel));
 const framedata={},keys=[];frames.forEach((f,i)=>{const k=`${name}_${String(i).padStart(3,'0')}`;keys.push(k);framedata[k]={frame:{x:i%cols*size[0],y:Math.floor(i/cols)*size[1],w:size[0],h:size[1]},rotated:false,trimmed:false,spriteSourceSize:{x:0,y:0,w:size[0],h:size[1]},sourceSize:{w:size[0],h:size[1]},pivot:{x:.5,y:.5}};});
 fs.writeFileSync(path.join(ROOT,jsonrel),JSON.stringify({frames:framedata,meta:{app:'Oziel environment production',version:'1.0',image:path.basename(atlasrel),format:'RGBA8888',size:{w:aw,h:ah},scale:'1'}},null,2));
 assets.push({id:key,path:atlasrel,jsonPath:jsonrel,type:'atlas',width:aw,height:ah,format:'PNG',alpha:true,season,dayNight:null,characterVariant:null,cellWidth:size[0],cellHeight:size[1],columns:cols,rows,frames:keys,clips:[name],origin:[.5,.5],notes});
 animations[key]={atlasKey:key,frames:keys,frameRate:fps,repeat:loop?-1:0,origin:[.5,.5],interruptible:true,next:null,notes};
 const strip=`environments/${season}/particles/${name}_strip.png`;
 await sharp({create:{width:size[0]*count,height:size[1],channels:4,background:'#00000000'}}).composite(frames.map((f,i)=>({input:path.join(ROOT,f),left:i*size[0],top:0}))).png().toFile(path.join(ROOT,strip));
 assets.push({id:key+'_strip',path:strip,type:'sprite',width:size[0]*count,height:size[1],format:'PNG',alpha:true,season,dayNight:null,characterVariant:null,notes:'Tira alternativa; celda '+size.join('×')+', '+count+' fotogramas.'});
 const cw=Math.min(size[0],192),ch=Math.round(size[1]*cw/size[0]);
 const cells=[];for(const [i,f] of frames.entries()){cells.push({input:await sharp(path.join(ROOT,f)).resize(cw,ch).png().toBuffer(),left:(i%4)*cw,top:Math.floor(i/4)*(ch+24)});cells.push({input:Buffer.from(`<svg width="${cw}" height="24"><text x="${cw/2}" y="16" font-size="11" font-family="Arial" text-anchor="middle" fill="#263d3e">${name}_${String(i).padStart(3,'0')}</text></svg>`),left:i%4*cw,top:Math.floor(i/4)*(ch+24)+ch});}
 await sharp({create:{width:cw*4,height:(ch+24)*Math.ceil(count/4),channels:4,background:'#e6e8df'}}).composite(cells).png().toFile(path.join(ROOT,`previews/environments_${key}_contact.png`));
}
async function buildAnimation(){
 await sequence('spring','butterfly',8,[128,128],(i,n)=>{const t=i/n*2*Math.PI,s=.16+.84*(.5+.5*Math.cos(t));return group(`<g transform="rotate(${Math.sin(t)*4}) scale(${s} 1)">`+e(-23,0,25,33,'#d7a0b5')+e(-21,26,19,22,'#c5abd1')+e(23,0,25,33,'#d7a0b5')+e(21,26,19,22,'#c5abd1')+'</g>'+r(-4,-23,8,62,'#45565b',4)+p('M-2 -21L-11 -36M2 -21L11 -36','none','stroke-width="3"'),64,55);},12,true,'Aleteo articulado simétrico: alas pivotan desde el cuerpo, cambian anchura y leve rotación; el desplazamiento lo hace Phaser.');
 await sequence('summer','wave',8,[384,96],(i,n)=>{const t=i/n*2*Math.PI;let d='M-5 50';for(let x=0;x<=392;x+=8)d+=`L${x} ${50+10*Math.sin(x/384*4*Math.PI+t)}`;return p(d+'L392 96L-5 96Z','#80bbc3','stroke="none"')+p(d,'none','stroke="#e9eee0" stroke-width="8"');},10,true,'Dos periodos espaciales exactos; animación cíclica sin traslación global. Repetir horizontalmente.');
 await sequence('autumn','ripple',8,[192,80],(i,n)=>{const q=i/(n-1),a=1-q*.92;return e(96,40,12+74*q,4+23*q,'none',`stroke="#d8e7df" stroke-width="4" opacity="${a}"`)+e(96,40,5+43*q,2+13*q,'none',`stroke="#759ba4" stroke-width="3" opacity="${a}"`);},16,false,'Onda radial de una gota; emitir con intervalos aleatorios sobre charcos.');
 await sequence('autumn','splash',8,[192,160],(i,n)=>{const q=i/(n-1);let b='';for(let j=0;j<7;j++){const vx=(j-3)*17,vy=-68-Math.abs(j-3)*4,x=96+vx*q,y=134+vy*q+60*q*q; b+=e(x,y,3+3*(1-q),7-3*q,'#b8d6dc',`stroke="#6e9ba9" stroke-width="2" opacity="${1-q*.65}"`);}return b+e(96,140,12+70*q,4+10*q,'none',`stroke="#dce8de" stroke-width="4" opacity="${1-q*.8}"`);},16,false,'Salpicadura balística local para lluvia o salto; no mueve al personaje.');
 await sequence('summer','water_splash',8,[192,160],(i,n)=>{const q=i/(n-1);let b='';for(let j=0;j<8;j++){const a=(j/7)*Math.PI,x=96+Math.cos(a)*76*q,y=132-Math.sin(a)*96*q+20*q*q;b+=e(x,y,4-2*q,7-3*q,'#c2e5e4',`stroke="#7caeb9" stroke-width="2" opacity="${1-q*.7}"`);}return b;},16,false,'Gotas al entrar/salir del agua; prop independiente.');
}
async function previews(){
 const previewFiles=[];
 for(const season of Object.keys(palettes))for(const mode of ['day','night'])previewFiles.push(`previews/environments_${season}_${mode}.png`);
 const thumbs=await Promise.all(previewFiles.map(f=>sharp(path.join(ROOT,f)).resize(640,360).png().toBuffer()));
 await sharp({create:{width:1280,height:1440,channels:4,background:'#e6e8df'}}).composite(thumbs.map((input,i)=>({input,left:i%2*640,top:Math.floor(i/2)*360}))).png().toFile(path.join(ROOT,'previews/environments_all_eight.png'));
 const props=assets.filter(a=>a.type==='prop'||a.type==='particle'&&!a.animation);
 const cell=170,cols=8,rows=Math.ceil(props.length/cols);const thumbprops=[];
 for(const [i,a] of props.entries()){const b=await sharp(path.join(ROOT,a.path)).resize(148,135,{fit:'inside'}).png().toBuffer();const m=await sharp(b).metadata();thumbprops.push({input:b,left:(i%cols)*cell+Math.floor((cell-m.width)/2),top:Math.floor(i/cols)*cell+8});const label=Buffer.from(`<svg width="170" height="30"><text x="85" y="16" font-size="10" font-family="Arial" text-anchor="middle" fill="#243330">${a.path.split('/').at(-1).replace('.png','')}</text></svg>`);thumbprops.push({input:label,left:i%cols*cell,top:Math.floor(i/cols)*cell+140});}
 await sharp({create:{width:cols*cell,height:rows*cell,channels:4,background:'#e6e8df'}}).composite(thumbprops).png().toFile(path.join(ROOT,'previews/environments_props_contact.png'));
}
(async()=>{fs.mkdirSync(path.join(ROOT,'previews'),{recursive:true});fs.mkdirSync(path.join(ROOT,'metadata'),{recursive:true});await buildScenes();await buildProps();await buildAnimation();await previews();fs.writeFileSync(path.join(ROOT,'metadata/environments.json'),JSON.stringify({assets,seasons,animations,style:{ink:INK,strokeWidth:5,walkBaseline:900},rules:{autumnRain:'continuous_while_autumn',nightReadability:'lighter_midground_ground_separate_from_sky',letterText:'Never baked into environment textures'}},null,2));console.log(JSON.stringify({assetCount:assets.length,scenes:8,animatedEffects:Object.keys(animations),layers:40}));})().catch(e=>{console.error(e);process.exitCode=1;});
