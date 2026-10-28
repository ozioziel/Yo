/* Deterministic articulated vector production rig. Rebuild with bundled Node + sharp. */
const fs=require('fs'), path=require('path');
const sharp=require('C:/Users/jojoj/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp/dist/index.cjs');
const ROOT=path.resolve(__dirname,'..'), TAU=Math.PI*2;
const C={ink:'#080c0b',body:'#373837',shade:'#272927',belly:'#d8d9d8',bellyShade:'#b8bab8',ochre:'#b9874c',ochreShade:'#8b6038',helmet:'#efb83d',helmetShade:'#c78b24',scarf:'#bb5547',boots:'#ba773d',umbrella:'#668681'};
const groups={
base:{idle:6,blink:4,walk:8,run:8,look_up:6,look_around:8,curious:6,confused:6,scared:4,dragged:4,fall_normal:8,fall_spin:12,fall_flap:8,impact_light:5,impact_medium:6,impact_heavy:8,get_up:8,stumble:6,bump:6,push:6,sit_down:6,sit_idle:4,stand_up:6},
intro:{enter:8,switch_light:8,notice_name:6,group_look_up:6,carry_ladder:8,place_ladder:8,assemble_ladder:8,hold_ladder:6,climb:8,reach_rope:6,cut_rope:8,react_name_fall:8,celebrate:6},
daily:{sleep:8,wake_up:6,greet:6,play:8,chase:8,laugh:6,interact_object:8,pick_up_object:6,put_down_object:6},
weather:{notice_weather:6,weather_confused:6,remove_accessories:8,resume_after_weather:4},
winter:{put_scarf:8,shiver:6,make_snowball:8,throw_snowball:8,ice_slide:8,build_snowman:12},
autumn:{put_boots:8,open_umbrella:8,walk_umbrella:8,jump_puddle:8,play_leaves:8,hide_rain:6},
spring:{chase_butterfly:8,smell_flower:8,sit_grass:6,watch_bloom:6},
summer:{apply_sunscreen:8,build_sandcastle:12,play_beach:8,enter_water:8,swim:8,shake_water:8}
};
const LOOP=new Set(['idle','walk','run','look_around','dragged','fall_normal','fall_spin','fall_flap','sit_idle','carry_ladder','hold_ladder','climb','sleep','play','chase','shiver','make_snowball','ice_slide','walk_umbrella','hide_rain','chase_butterfly','sit_grass','play_beach','swim']);
const AIR=new Set(['dragged','fall_normal','fall_spin','fall_flap','swim']);
const EQUIP=new Set(['put_scarf','put_boots','open_umbrella','walk_umbrella','hide_rain','remove_accessories']);
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const smooth=t=>t*t*(3-2*t), lerp=(a,b,t)=>a+(b-a)*t;
const pulse=t=>Math.sin(Math.PI*clamp(t));
function node(name,at={},body=''){return `<${name} ${Object.entries(at).map(([k,v])=>`${k}="${v}"`).join(' ')}>${body}</${name}>`;}
const el=(cx,cy,rx,ry,fill,stroke=C.ink,sw=3.5)=>node('ellipse',{cx,cy,rx,ry,fill,stroke,'stroke-width':sw});
const line=(x1,y1,x2,y2,stroke=C.ink,sw=3.5)=>node('path',{d:`M${x1} ${y1}L${x2} ${y2}`,fill:'none',stroke,'stroke-width':sw,'stroke-linecap':'round'});
const p=(d,fill,sw=3.5,stroke=C.ink)=>node('path',{d,fill,stroke,'stroke-width':sw,'stroke-linecap':'round','stroke-linejoin':'round'});
const g=(tr,s)=>node('g',{transform:tr},s);
function pose(clip,i,n){
const loop=LOOP.has(clip), t=loop?i/n:i/(n-1), a=TAU*t,s=Math.sin(a),co=Math.cos(a), q=smooth(t);
let z={view:'side',rot:0,sx:1,sy:1,dy:0,eye:1,up:0,look:0,fl:-3,fr:2,leg:s*0,legR:0,legY:0,legRY:0,big:0,sit:0,scarf:1,boots:1,umbrella:1,prop:null,propProgress:t,closed:false,air:AIR.has(clip),mouth:'none',t};
if(['idle','blink'].includes(clip)){z.sy=1+.008*s;z.eye=clip==='blink'?1-.98*pulse(t):1-.92*Math.pow(Math.max(0,s),12);z.fr=2+2*s+.8*co;}
if(['walk','run','enter','chase','carry_ladder','walk_umbrella','chase_butterfly'].includes(clip)){const fast=['run','chase','chase_butterfly'].includes(clip);z.leg=(fast?22:16)*s;z.legR=-z.leg;z.legY=-6*Math.max(0,co);z.legRY=-6*Math.max(0,-co);z.dy=-(fast?6:3)*Math.abs(s);z.fl=20*s;z.fr=-17*s+3*co;z.rot=fast?-7:2*s;if(clip==='carry_ladder'){z.fl=-65;z.fr=-65;z.prop='ladder_external';}if(clip==='chase_butterfly')z.up=.55;}
if(['look_up','notice_name','group_look_up','notice_weather'].includes(clip)){z.up=q;z.fr=-7*q;z.rot=-3*q;}
if(clip==='look_around'){z.look=s;z.view=co<-.35?'front':'side';z.fr=5*s;}
if(['curious','confused','weather_confused','watch_bloom'].includes(clip)){z.view=t>.2?'front':'side';z.rot=(clip==='curious'?7:-9)*pulse(t);z.look=.6*s;z.up=.3*pulse(t);z.fr=6*pulse(t);}
if(clip==='scared'){z.view='front';z.big=q;z.fl=-8*q;z.fr=8*q;z.mouth='o';}
if(['dragged','fall_normal','fall_flap','fall_spin'].includes(clip)){z.view='front';z.big=1;z.mouth='o';z.leg=10+4*s;z.legR=-10-4*s;z.fl=-12;z.fr=12;z.dy=1.5*s;if(clip==='fall_normal'){z.rot=4*s;z.fl=-22-3*co;z.fr=22+3*co;}if(clip==='fall_flap'){z.fl=40+45*s;z.fr=-40-45*s;}if(clip==='fall_spin'){z.rot=360*t;z.view=i<3?'front':i<6?'side':i<9?'back':'quarter';z.fl=-25-15*s;z.fr=25+15*s;}}
if(clip.startsWith('impact_')){const k={impact_light:.16,impact_medium:.31,impact_heavy:.46}[clip];z.sy=1-k*pulse(t)*(1-q);z.sx=1+.7*k*pulse(t)*(1-q);z.big=.7*pulse(t)*(1-q);z.eye=lerp(1-.95*pulse(t),.3,q);z.fl=lerp(-65*pulse(t),-40,q);z.fr=lerp(65*pulse(t),2,q);z.sit=q;z.rot=18*q;z.mouth='none';}
if(clip==='get_up'){z.sit=1-q;z.rot=18*(1-q);z.fl=-40*(1-q);z.eye=.3+.7*q;}
if(clip==='stumble'){z.rot=-22*pulse(t);z.leg=28*pulse(t);z.fr=55*pulse(t);z.fl=-55*pulse(t);z.big=pulse(t);}
if(clip==='bump'){z.sx=1-.12*pulse(t);z.rot=14*pulse(t);z.fr=35*pulse(t);z.eye=1-.6*pulse(t);}
if(clip==='push'){z.rot=-13*pulse(t);z.fr=-75*pulse(t);z.fl=-30*pulse(t);z.leg=8*pulse(t);}
if(['sit_down','sit_idle','stand_up','sit_grass'].includes(clip)){z.sit=clip==='sit_down'?q:clip==='stand_up'?1-q:1;z.fr=8*z.sit;z.eye=1-(clip==='sit_idle'?.8*Math.pow(Math.max(0,s),8):0);z.sy=1+.008*s;}
if(clip==='switch_light'){z.fr=-100*pulse(t);z.up=.2;z.rot=-4*pulse(t);z.prop='switch_external';}
if(['place_ladder','assemble_ladder','hold_ladder'].includes(clip)){z.fr=-65-(clip==='assemble_ladder'?10*s:15*pulse(t));z.fl=-60;z.rot=clip==='place_ladder'?13*pulse(t):3*s;z.sit=clip==='place_ladder'?.25*pulse(t):0;z.prop='ladder_external';}
if(clip==='climb'){z.view='back';z.fl=-70-28*s;z.fr=70-28*s;z.leg=18*s;z.legR=-z.leg;z.dy=2*co;z.prop='ladder_external';}
if(['reach_rope','cut_rope'].includes(clip)){z.fr=-145*(clip==='reach_rope'?q:1);z.fl=-20;z.up=1;z.sx=1-.03*q;z.sy=1+.04*q;if(clip==='cut_rope'){z.fr=-140-6*s;z.prop='scissors';}}
if(clip==='react_name_fall'){z.view='front';z.big=pulse(t);z.fl=-65*pulse(t);z.fr=65*pulse(t);z.up=1-q;z.rot=5*s;}
if(clip==='celebrate'){z.view='front';z.fl=125*pulse(t);z.fr=-125*pulse(t);z.leg=7*s;z.legR=-z.leg;z.dy=-7*pulse(t);z.mouth='smile';}
if(['sleep','wake_up'].includes(clip)){z.sit=clip==='sleep'?1:1-q;z.eye=clip==='sleep'?.04:.04+.96*q;z.rot=clip==='sleep'?8+2*s:8*(1-q);z.sy=1+.015*s;}
if(clip==='greet'){z.view='front';z.fr=-110*pulse(t)-15*Math.sin(3*Math.PI*t)*pulse(t);z.mouth='smile';}
if(clip==='play'){z.view='front';z.rot=8*s;z.fl=-35-25*s;z.fr=35-25*s;z.leg=12*s;z.legR=-z.leg;z.mouth='smile';}
if(clip==='laugh'){z.view='front';z.eye=.3;z.sy=1-.04*Math.sin(3*Math.PI*t)**2;z.fr=-15;z.fl=15;z.mouth='smile';}
if(['interact_object','pick_up_object','put_down_object'].includes(clip)){let v=clip==='pick_up_object'?q:clip==='put_down_object'?1-q:pulse(t);z.rot=20*(clip==='pick_up_object'?pulse(t):clip==='put_down_object'?pulse(t):v);z.sit=.3*pulse(t);z.fr=-55*v;z.prop='object_external';}
if(clip==='resume_after_weather'){z.up=1-q;z.rot=5*(1-q);z.fl=-12*(1-q);}
if(clip==='remove_accessories'){z.view='front';z.fl=-95*pulse(t);z.fr=95*pulse(t);z.scarf=1-q;z.boots=1-q;z.umbrella=1-q;z.closed=t>.2;}
if(clip==='put_scarf'){z.view='front';z.scarf=q;z.fr=85*pulse(t);z.fl=-85*pulse(t);}
if(clip==='put_boots'){z.sit=.7*pulse(t);z.fr=-70*pulse(t);z.leg=18*pulse(t);z.boots=q;z.umbrella=0;}
if(clip==='open_umbrella'){z.fr=-20;z.umbrella=q;z.closed=t<.25;z.up=.5;}
if(clip==='shiver'){z.rot=2.5*Math.sin(2*a);z.sx=1+.008*Math.sin(2*a);z.fr=-18-3*s;z.fl=18+3*s;z.eye=.6;}
if(['make_snowball','build_snowman','build_sandcastle'].includes(clip)){z.sit=.4;z.rot=8+6*s;z.fl=-50-14*s;z.fr=-55+14*s;z.prop=clip==='make_snowball'?'snowball':clip==='build_snowman'?'snowman_external':'sandcastle_external';if(clip==='make_snowball'){z.view='front';z.fr=50+14*s;}}
if(clip==='throw_snowball'){z.fr=-50-100*pulse(t);z.rot=10*Math.sin(TAU*t);z.prop=t<.62?'snowball':null;z.up=.3;}
if(clip==='ice_slide'){z.rot=-20;z.fr=-45-8*s;z.fl=-65+8*s;z.leg=22;z.legR=-10;z.sit=.18;}
if(clip==='jump_puddle'){z.dy=-17*pulse(t);z.sit=.15*(1-pulse(t));z.fl=-55*pulse(t);z.fr=55*pulse(t);z.leg=12*pulse(t);z.legR=-12*pulse(t);}
if(clip==='play_leaves'){z.fr=-90*pulse(t);z.fl=-45*pulse(t);z.rot=-10*pulse(t);z.prop='leaves_external';}
if(clip==='hide_rain'){z.sit=.2;z.fr=-15;z.up=.4;z.eye=1-.4*Math.max(0,s);}
if(clip==='smell_flower'){z.rot=-18*pulse(t);z.sit=.2*pulse(t);z.eye=1-.7*pulse(t);z.fr=-20*pulse(t);z.prop='flower_external';}
if(clip==='apply_sunscreen'){z.view='front';z.fr=-20;z.fl=-120*pulse(t);z.prop='sunscreen';}
if(clip==='play_beach'){z.fl=-50-25*s;z.fr=-60+25*s;z.leg=12*s;z.legR=-z.leg;z.prop='beachball_external';}
if(clip==='enter_water'){z.sit=.6*q;z.fr=-30*q;z.fl=30*q;z.prop='water_external';}
if(clip==='swim'){z.rot=80;z.fl=-65+35*s;z.fr=65+35*s;z.leg=18*s;z.legR=-z.leg;z.eye=1-.2*co;z.prop='water_external';}
if(clip==='shake_water'){z.view='front';z.rot=12*Math.sin(3*Math.PI*t)*pulse(t);z.fl=-35*pulse(t);z.fr=35*pulse(t);z.eye=.4;z.prop='droplets';}
return z;
}
function flipper(x,y,angle,front=false){const d=front?'M0 0C18 8 24 27 17 51C14 63 5 64 1 52C-2 34 -10 15 0 0Z':'M0 0C13 9 15 25 20 48C26 69 13 76 2 67C-13 55 -13 18 0 0Z';return g(`translate(${x} ${y}) rotate(${angle})`,p(d,C.body));}
function helmet(view){return p('M-42 -165C-43 -188 -24 -198 0 -198C24 -198 42 -185 43 -166Z',C.helmet)+p('M-48 -166Q-12 -171 47 -166L49 -157Q0 -151 -49 -157Z',C.helmetShade)+p('M-4 -195L-6 -169L6 -169L4 -195',C.helmet,2)+line(-29,-181,-31,-171,C.helmetShade,3)+line(28,-181,30,-171,C.helmetShade,3);}
function umbrella(open=1){const k=.16+.84*open;return line(0,0,0,-100,C.ink,3)+p('M0 -5Q8 1 10 -7','none',2)+g(`translate(0 -103) scale(${k} 1)`,p('M-65 0Q-46 -42 0 -45Q46 -42 65 0Q48 -13 33 0Q17 -13 0 0Q-17 -13 -33 0Q-49 -13 -65 0Z',C.umbrella,3)+p('M-33 0Q-28 -31 0 -45Q28 -31 33 0', 'none',1.3,C.ink)+line(0,-45,0,0,C.ink,1.3));}
function rig(z,variant='penguin'){
const front=z.view==='front',back=z.view==='back',quarter=z.view==='quarter';
const engineering=variant==='engineer',winter=variant==='penguin_winter'||z.clip==='put_scarf',autumn=variant==='penguin_autumn'||z.clip==='put_boots';
const sitting=z.sit||0;
let legs='';
for(const [x,a,shade,ly] of [[-23,z.leg,C.ochre,z.legY||0],[20,z.legR,C.ochreShade,z.legRY||0]]){let foot=g(`translate(${x} ${-2+ly}) rotate(${a})`,p('M-22 1Q-22 -5 -3 -11L15 -10Q23 -7 18 2Z',shade)+p('M-17 -2Q-10 -7 0 -7L9 -7Q12 -4 9 -2Z',C.ochre,0));if(autumn&&z.boots>.01){const o=z.boots;foot+=g(`translate(${x} ${-4+ly+16*(1-o)}) rotate(${a})`,node('g',{opacity:o},p('M-8 -22L13 -22L14 -7Q27 -6 26 4L-24 4Q-25 -5 -8 -8Z',C.boots)+line(-20,1,23,1,C.ochreShade,2)));}legs+=foot;}
let body=p('M-43 -145C-28 -166 -9 -169 0 -168C4 -173 -10 -190 -4 -190C6 -188 13 -178 16 -174C20 -190 26 -182 28 -169C61 -152 66 -125 62 -100C59 -82 68 -62 73 -39C78 -18 75 -12 56 -8C31 -1 -6 -3 -30 -7C-62 -11 -64 -34 -60 -60C-57 -79 -48 -95 -50 -114C-52 -127 -49 -137 -43 -145Z',C.body,4.1);
body+=p('M24 -165C65 -150 66 -121 62 -100C59 -82 68 -62 73 -39C78 -18 75 -12 56 -8L34 -5C56 -28 43 -55 44 -76C53 -114 51 -141 24 -165Z',C.shade,0);
if(!back){if(front||quarter){body+=p('M-36 -143C-26 -158 18 -159 32 -140C48 -117 24 -92 33 -73C48 -47 47 -21 26 -13C10 -7 -24 -8 -36 -17C-56 -36 -42 -63 -40 -85C-39 -109 -51 -124 -36 -143Z',C.belly,0);}else{body+=p('M-42 -142C-29 -161 -2 -157 16 -145C41 -126 34 -100 18 -84C5 -70 16 -49 9 -29C5 -16 -7 -10 -24 -9C-55 -13 -64 -34 -60 -60C-57 -79 -48 -95 -50 -114C-52 -127 -49 -137 -42 -142Z',C.belly,0);body+=p('M-58 -44C-50 -22 -32 -18 -11 -22C4 -25 10 -42 10 -51C15 -27 8 -15 -4 -9L-25 -9C-47 -12 -59 -23 -58 -44Z',C.bellyShade,0);}}
const faceY=-128-12*z.up;let face='';
if(!back){
const faceMove=g(`translate(${z.look*4} ${-6*z.up})`,(()=>{
let f='';if(front){for(const xx of [-18,17]){const r=3.7+1.5*z.big;if(z.big>.05){f+=el(xx,faceY,4.5+7.5*z.big,Math.max(.8,(5+9*z.big)*z.eye),'#f3f4ed',C.ink,1.3+z.big);f+=line(xx-8,faceY-17-(xx<0?0:2),xx+8,faceY-17-(xx<0?2:0),C.ink,2);}f+=el(xx,faceY+z.big,r,Math.max(.65,r*z.eye),'#080c0b','none',0);if(z.big>.15)f+=el(xx-1.6,faceY-1,1.4,1.4,'#f7f8f4','none',0);}f+=p(`M-10 ${faceY+17*z.big+11}Q0 ${faceY+17*z.big+7} 11 ${faceY+17*z.big+11}L1 ${faceY+17*z.big+22}Z`,C.ochre,2.7);if(z.mouth==='o')f+=el(0,faceY+17*z.big+25,2.3,3.2,C.ink,'none',0);}
else{const r=3.8+4.5*z.big;f+=el(-8,faceY,r,Math.max(.65,r*z.eye),C.ink,'none',0);if(z.big>.2)f+=el(-10,faceY-2,1.4,1.4,'#fff','none',0);f+=p(`M-39 ${faceY-16}C-55 ${faceY-21} -72 ${faceY-31} -74 ${faceY-23}C-74 ${faceY-15} -54 ${faceY+1} -43 ${faceY+3}Q-33 ${faceY+3} -35 ${faceY-7}Z`,C.ochre,3.6);f+=p(`M-70 ${faceY-20}Q-51 ${faceY-2} -38 ${faceY-4}Q-38 ${faceY+1} -44 ${faceY+1}Z`,C.ochreShade,0);}
if(quarter)f+=el(14,faceY+1,2.5,Math.max(.65,2.5*z.eye),C.ink,'none',0);return f;})());face+=faceMove;
if(z.mouth==='smile')face+=p('M-9 -102Q0 -95 9 -102','none',2.3);
}
let accessories='';if(engineering)accessories+=g(`translate(0 ${-4*z.up})`,helmet(z.view));
if(winter&&z.scarf>.001){accessories+=g(`translate(0 ${-10*(1-z.scarf)})`,node('g',{opacity:z.scarf},p('M-43 -100Q-5 -86 43 -100L44 -89Q0 -76 -44 -89Z',C.scarf,3)+p('M18 -89L35 -87L40 -48L22 -49Z',C.scarf,3)+line(24,-53,38,-54,'#e0b58f',3)));}
let arms=flipper(-43,-96,z.fl,true)+flipper(front?43:28,-91,z.fr,false);
if(back)arms=flipper(-43,-100,z.fl,true)+flipper(43,-100,z.fr,false);
let torso=g(`translate(0 -7) scale(${z.sx} ${z.sy*(1-.16*sitting)})`,body+face+arms+accessories);
let s=legs+torso;
const umbrellaSafe=new Set(['idle','blink','walk','look_up','look_around','curious','confused','scared','notice_name','group_look_up','notice_weather','weather_confused','resume_after_weather','sit_idle','open_umbrella','walk_umbrella','hide_rain','shiver','remove_accessories']);
if((variant==='penguin_autumn'||['open_umbrella','walk_umbrella','hide_rain'].includes(z.clip))&&!engineering&&z.umbrella>.001&&!z.air&&umbrellaSafe.has(z.clip)){
const rr=z.fr*Math.PI/180,hx=((front?43:28)+8*Math.cos(rr)-58*Math.sin(rr))*z.sx,hy=(-91+8*Math.sin(rr)+58*Math.cos(rr))*z.sy*(1-.16*sitting)-7;
s+=g(`translate(${hx} ${hy}) rotate(${-z.rot}) scale(.9)`,umbrella(z.closed?.1:z.umbrella));}
const rr=z.fr*Math.PI/180,handx=((front||back?43:28)+8*Math.cos(rr)-58*Math.sin(rr))*z.sx,handy=((back?-100:-91)+8*Math.sin(rr)+58*Math.cos(rr))*z.sy*(1-.16*sitting)-7;
if(z.prop==='snowball'){const bx=z.clip==='make_snowball'?0:handx,by=z.clip==='make_snowball'?-62:handy-8;s+=el(bx,by,9+4*pulse(z.t),9+4*pulse(z.t),'#e8f1ef',C.ink,2.5);}
if(z.prop==='scissors'){s+=g(`translate(${handx} ${handy}) rotate(-28)`,el(-5,0,4.2,5.5,'#ca7854',C.ink,2)+el(6,0,4.2,5.5,'#ca7854',C.ink,2)+p(`M-4 -3L${2+5*Math.sin(Math.PI*z.t)} -23L4 -5L-6 -22`, '#c9d6d1',1.7));}
if(z.prop==='sunscreen'){s+=g(`translate(${handx} ${handy})`,p('M-6 -3L6 -3L7 18L-7 18Z','#e8cb8a',2)+p('M-5 -8L5 -8L5 -3L-5 -3Z','#637f74',2)+line(-2,4,3,4,'#fff',3));s+=node('g',{opacity:pulse(z.t)},p('M-18 -116Q-11 -120 -8 -114Q-11 -110 -16 -112Z','#fff3d6',0));}
if(z.prop==='droplets'){for(let j=0;j<6;j++){const a=j*TAU/6;const d=66+22*pulse(z.t);s+=el(Math.cos(a)*d,-90+Math.sin(a)*d,1.8,3.1,'#80b8c3','none',0);}}
const sc=z.air?.87:1; const transform=z.air?`translate(128 128) rotate(${z.rot}) scale(${sc}) translate(0 90)`:`translate(128 ${230+z.dy}) rotate(${z.rot} 0 -80)`;
return g(transform,s);
}
function svg(z,variant){return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 256 256">${rig(z,variant)}</svg>`;}
function anchor(z,which){
const rad=a=>a*Math.PI/180, rot=(x,y,a)=>[x*Math.cos(rad(a))-y*Math.sin(rad(a)),x*Math.sin(rad(a))+y*Math.cos(rad(a))];
let pt;if(which==='handNear'){const r=rot(8,58,z.fr);pt=[(z.view==='front'||z.view==='back'?43:28)+r[0],(z.view==='back'?-100:-91)+r[1]];}else if(which==='handFar'){const r=rot(0,52,z.fl);pt=[-43+r[0],(z.view==='back'?-100:-96)+r[1]];}else if(which==='helmet'){pt=[0,-177-4*z.up];}else{pt=[0,-93];}
pt=[pt[0]*z.sx,pt[1]*z.sy*(1-.16*z.sit)-7];
if(z.air){pt=rot(pt[0],pt[1]+90,z.rot);pt=[128+.87*pt[0],128+.87*pt[1]];}else{pt=rot(pt[0],pt[1]+80,z.rot);pt=[128+pt[0],230+z.dy-80+pt[1]];}
return pt.map(v=>Math.round(v*100)/100);
}
async function png(str,w=256,h=256){return sharp(Buffer.from(str)).resize(w,h).png().toBuffer();}
function write(rel,data){const f=path.join(ROOT,rel);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,data);}
const notes={carry_ladder:'Escalera separada de escena; sincronizar en mano cercana x~152,y~153; caminar sin hornear trayectoria.',place_ladder:'Usar prop ladder_complete, rotar a posición vertical con progreso 0..1; clip solo pose corporal.',assemble_ladder:'Segmentos de escalera externos; acoplar al gesto de aleta, fijación en frames 2 y 5.',hold_ladder:'Sostener poste externo junto a mano; clip cíclico.',climb:'Vista de espalda; manos/patas alternadas. Mover cuerpo por peldaños mediante Phaser, no desplazamiento horneado.',build_snowman:'Muñeco separado por etapas; avanzar etapa en frames 3,7,11. Cuerpo modela agachado/apilado.',build_sandcastle:'Castillo separado por etapas; avanzar etapa en frames 3,7,11; no hay castillo horneado.',enter_water:'Máscara externa sobre parte inferior, progreso 0..1; cuerpo no debe ocultarse cortando PNG.',swim:'Pose horizontal; usar capa de agua delantera para ocultar vientre inferior.',play_beach:'Pelota de playa externa: contacto frames 2 y 6.',chase_butterfly:'Mariposa externa sigue objetivo delante del pico.',smell_flower:'Flor externa en suelo frente al pico, contacto frame 4.',pick_up_object:'Prop externo se vincula a mano en frame 3.',put_down_object:'Prop externo se desvincula de mano en frame 4.',switch_light:'Interruptor externo al alcance de mano; pulsación frame 3.',cut_rope:'Tijeras temporales dibujadas en este clip; cortar cuerda externa en frame 4.',apply_sunscreen:'Botella y marca de crema visibles durante este clip; ninguna vestimenta permanente.',throw_snowball:'Bola dibujada hasta frame 4; emitir prop físico separado en frame 5.',play_leaves:'Hojas externas: emitir al elevar aleta en frame 4.'};
function nextFor(c){if(LOOP.has(c))return null;if(c.startsWith('impact_'))return 'get_up';if(['get_up','stand_up','resume_after_weather'].includes(c))return '$resume';if(c==='scared')return 'dragged';if(c==='sit_down')return 'sit_idle';if(c==='put_scarf'||c==='put_boots'||c==='open_umbrella')return 'idle';if(c==='notice_weather')return 'weather_confused';return 'idle';}
const variants={penguin:Object.keys(groups),engineer:Object.keys(groups),penguin_winter:['base','intro','daily','weather','winter'],penguin_autumn:['base','intro','daily','weather','autumn']};
async function main(){
const only=process.argv.includes('--models');
const selectedArg=process.argv.find(s=>s.startsWith('--groups=')),selected=selectedArg?new Set(selectedArg.split('=')[1].split(',')):null;
const meta=selected?JSON.parse(fs.readFileSync(path.join(ROOT,'metadata/characters.json'),'utf8')):{schemaVersion:1,characters:{},atlases:[],clips:[],inventory:Object.entries(groups).flatMap(([group,clips])=>Object.entries(clips).map(([name,count])=>({name,group,targetFrames:count}))),palette:C,notes:['SVG articulado reconstruido a partir de referencia; no calco exacto.','Cuello/casco/botas transforman dentro del mismo rig; variantes equipadas son PNG completos.','En otoño paraguas se pliega/retira de sprites aéreos/impacto; emitir prop cerrado independiente al agarrar y restaurar paraguas al terminar recuperación.','Acciones de construcción usan props separados declarados; no se afirma desplazamiento mundial en las imágenes.']};
if(selected){meta.atlases=meta.atlases.filter(a=>!selected.has(a.group));meta.clips=meta.clips.filter(c=>!selected.has(c.group));}
write('reference/style_palette.json',JSON.stringify({colors:C,lineWidthAt256:4.1,style:'2D vectorial suave, cuerpo continuo de pera, dos mechones, vientre gris claro; perfil izquierdo predeterminado.',baseScale:.65,referenceDifference:'Reconstrucción articulada; rama y puntos excluidos.'},null,2));
const accessoryDefs={
helmet:{w:128,h:72,box:'-64 -210 128 72',art:helmet('front')},
scarf:{w:128,h:96,box:'-64 -115 128 96',art:p('M-43 -100Q-5 -86 43 -100L44 -89Q0 -76 -44 -89Z',C.scarf,3)+p('M18 -89L35 -87L40 -48L22 -49Z',C.scarf,3)},
boots:{w:128,h:64,box:'-64 -38 128 64',art:g('translate(-25 0)',p('M-8 -22L13 -22L14 -7Q27 -6 26 4L-24 4Q-25 -5 -8 -8Z',C.boots))+g('translate(28 0)',p('M-8 -22L13 -22L14 -7Q27 -6 26 4L-24 4Q-25 -5 -8 -8Z',C.boots))},
umbrella_open:{w:160,h:176,box:'-80 -158 160 176',art:umbrella(1)},
umbrella_closed:{w:64,h:176,box:'-32 -158 64 176',art:umbrella(.03)}
};
meta.assets=[];for(const [id,d] of Object.entries(accessoryDefs)){const sv=`<svg xmlns="http://www.w3.org/2000/svg" width="${d.w*2}" height="${d.h*2}" viewBox="${d.box}">${d.art}</svg>`;const rel=`characters/accessories/${id}.png`;write(rel,await png(sv,d.w,d.h));write(`sources/characters/accessories/${id}.svg`,sv);meta.assets.push({id,path:rel,type:'prop',width:d.w,height:d.h,alpha:true,attachTo:id.startsWith('umbrella')?'handNear':id==='helmet'?'helmet':id==='scarf'?'neck':'feet',notes:'Prop separado para retiradas y efectos; variante persistente ya compuesta en los frames. Ingeniero solo casco.'});}
const modelViews=[['perfil_izquierdo','side',0],['perfil_derecho','side',0],['frente','front',0],['tres_cuartos','quarter',0],['espalda','back',0],['normal','side',0],['mirando_arriba','side',1],['asustado','front',0]];
for(const variant of ['penguin','engineer']){let cells=[];let rows=[];for(let j=0;j<modelViews.length;j++){let [label,v,up]=modelViews[j];const z={...pose('idle',0,6),view:v,up,big:j===7?1:0,eye:1};let art=rig(z,variant);if(j===1)art=g('translate(256 0) scale(-1 1)',art);const cell=`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="300" viewBox="0 0 256 300"><rect width="256" height="300" fill="#eef1ec"/>${art}<text x="128" y="275" text-anchor="middle" font-family="Arial" font-size="14" fill="#263833">${label}</text></svg>`;cells.push({input:await png(cell,256,300),left:(j%4)*256,top:Math.floor(j/4)*300});rows.push(cell);write(`sources/characters/${variant}_${label}.svg`,cell);}const sheet=await sharp({create:{width:1024,height:600,channels:4,background:'#eef1ec'}}).composite(cells).png().toBuffer();write(`reference/${variant==='penguin'?'character':'engineer'}_model_sheet.png`,sheet);}
if(only)return;
for(const [variant,gs] of Object.entries(variants)){
meta.characters[variant]??={};
for(const group of gs){
if(selected&&!selected.has(group))continue;
let pages=[[]],pageCount=0;
for(const [clip,count] of Object.entries(groups[group])){
if(variant==='engineer'&&EQUIP.has(clip))continue;
if(variant==='penguin'&&clip==='remove_accessories'){/* neutral removal gesture retained as transition fallback */}
if(pages[pages.length-1].length+count>64)pages.push([]);
let page=pages.length-1,atlasKey=`${variant}_${group}_${String(page).padStart(2,'0')}`;
let clipFrames=[],keys=[],anchors=[];
for(let i=0;i<count;i++){
const z=pose(clip,i,count);z.clip=clip;
/* neutral group must not imply accessories in engineer / seasonal activity */
const key=`${clip}_${String(i).padStart(3,'0')}`,sv=svg(z,variant),buf=await png(sv);
write(`characters/${variant}/frames/${clip}/${key}.png`,buf);
if(i===0||i===Math.floor(count/2)||i===count-1)write(`sources/characters/${variant}/${clip}/${key}.svg`,sv);
clipFrames.push(buf);keys.push(key);pages[page].push({key,buf,origin:z.air?[.5,.5]:[.5,.9],clip});
anchors.push({frame:key,handNear:anchor(z,'handNear'),handFar:anchor(z,'handFar'),neck:anchor(z,'neck'),helmet:anchor(z,'helmet'),ground:[128,230]});
}
const stripPath=`characters/${variant}/clips/${clip}.png`;
write(stripPath,await sharp({create:{width:count*256,height:256,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(clipFrames.map((input,i)=>({input,left:i*256,top:0}))).png().toBuffer());
const origin=AIR.has(clip)?[.5,.5]:[.5,.9],fps=clip==='run'||clip==='chase'?14:clip==='idle'||clip==='sleep'?6:10;
const entry={atlasKey,frames:keys,frameRate:fps,repeat:LOOP.has(clip)?-1:0,origin,interruptible:!clip.startsWith('impact_')&&clip!=='get_up',next:nextFor(clip),frameCount:count,durationMs:1000*count/fps,group,stripPath,framesDirectory:`characters/${variant}/frames/${clip}`,frameAnchors:anchors,notes:notes[clip]||'Articulación de cuerpo, aletas, patas y expresión. Movimiento mundial a cargo de Phaser.',facing:clip==='climb'?'back':clip==='scared'||clip==='dragged'?'front':'left_or_pose',flipSafe:!['climb','cut_rope','switch_light','place_ladder','assemble_ladder','carry_ladder','hold_ladder'].includes(clip),season:variant==='penguin_winter'?'winter':variant==='penguin_autumn'?'autumn':null};
if(variant==='engineer')entry.notes+=' Ingeniero con casco fijo al rig; sin bufanda/botas/paraguas.';
if(clip.startsWith('impact_'))entry.notes+=' Último frame idéntico al primero de get_up: pose común agachada, ojo entrecerrado, inclinación18°.';
if(variant==='penguin_autumn')entry.notes+=' Paraguas retirado durante arrastre, caída, impacto, recuperación y gestos enérgicos; usar prop umbrella_closed separado y restaurar al entrar idle/walk. Canopy vertical contrarrotado, grip sigue ancla handNear.';
meta.characters[variant][clip]=entry;meta.clips.push({variant,name:clip,...entry});
if(['idle','walk','dragged','fall_spin','fall_flap','impact_heavy','get_up','climb','apply_sunscreen','put_scarf','open_umbrella'].includes(clip)){
const gif=await sharp(await sharp({create:{width:256,height:256*count,channels:4,background:'#e7eee9'}}).composite(clipFrames.map((input,i)=>({input,left:0,top:i*256}))).raw().toBuffer(),{raw:{width:256,height:256*count,channels:4,pageHeight:256}}).gif({loop:0,delay:Math.round(1000/fps),effort:3}).toBuffer();write(`previews/characters_${variant}_${clip}.gif`,gif);
}
}
for(let page=0;page<pages.length;page++){
const fspec=pages[page],cols=Math.min(8,fspec.length),rows=Math.ceil(fspec.length/cols),w=cols*256,h=rows*256,key=`${variant}_${group}_${String(page).padStart(2,'0')}`,pngPath=`characters/${variant}/atlases/${key}.png`,jsonPath=pngPath.replace('.png','.json');
const data={frames:{},meta:{app:'oziel_articulated_svg_rig',version:'1.0',image:path.basename(pngPath),format:'RGBA8888',size:{w,h},scale:'1'}};
for(let j=0;j<fspec.length;j++){const f=fspec[j];data.frames[f.key]={frame:{x:j%cols*256,y:Math.floor(j/cols)*256,w:256,h:256},rotated:false,trimmed:false,spriteSourceSize:{x:0,y:0,w:256,h:256},sourceSize:{w:256,h:256},pivot:{x:f.origin[0],y:f.origin[1]}};}
write(pngPath,await sharp({create:{width:w,height:h,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(fspec.map((f,j)=>({input:f.buf,left:j%cols*256,top:Math.floor(j/cols)*256}))).png().toBuffer());write(jsonPath,JSON.stringify(data,null,2));
meta.atlases.push({id:key,path:pngPath,jsonPath,type:'atlas',width:w,height:h,cellWidth:256,cellHeight:256,columns:cols,rows,frameNames:fspec.map(f=>f.key),clips:[...new Set(fspec.map(f=>f.clip))],characterVariant:variant,group,alpha:true});
const thumbs=await Promise.all(fspec.map(async(f,j)=>{let thumb=await sharp(f.buf).resize(128,128).png().toBuffer();return {input:thumb,left:j%cols*144+8,top:Math.floor(j/cols)*158+4};}));
let labels='<svg xmlns="http://www.w3.org/2000/svg" width="'+cols*144+'" height="'+rows*158+'">';for(let j=0;j<fspec.length;j++)labels+=`<text x="${j%cols*144+72}" y="${Math.floor(j/cols)*158+148}" fill="#30423e" text-anchor="middle" font-family="Arial" font-size="10">${fspec[j].key}</text>`;labels+='</svg>';
write(`previews/characters_${key}_contact.png`,await sharp({create:{width:cols*144,height:rows*158,channels:4,background:'#e7eee9'}}).composite([...thumbs,{input:Buffer.from(labels),left:0,top:0}]).png().toBuffer());
}
console.log(`${variant} ${group} complete`);
}
}
write('metadata/characters.json',JSON.stringify(meta,null,2));
console.log(JSON.stringify({variants:Object.keys(meta.characters),atlases:meta.atlases.length,clips:meta.clips.length,frames:meta.clips.reduce((s,c)=>s+c.frameCount,0)}));
}
main().catch(e=>{console.error(e);process.exit(1)});
