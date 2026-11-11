/* STARSHIP SABOTAGE — SINGLE SOURCE OF TRUTH FOR THE MONGUITO
   Canonical vector paths render in SVG (home/lobby/shop/customization/roles/end screens)
   and directly to Canvas (in-match). Cosmetics are presentation only. */
(function(){
'use strict';
const P={
 backpack:'M61 116 Q39 110 38 133 L38 180 Q40 195 63 194 L74 171 Z',
 leftLeg:'M75 164 Q91 162 101 167 L101 216 Q100 229 87 232 L67 232 Q58 224 64 214 Z',
 rightLeg:'M116 166 Q130 160 143 164 L151 213 Q159 228 145 232 L121 232 Q108 225 111 213 Z',
 leftBoot:'M64 209 Q81 215 101 210 L101 230 Q95 238 72 238 L57 237 Q52 226 64 209 Z',
 rightBoot:'M112 210 Q131 217 148 208 Q160 221 159 235 Q134 241 113 235 Q106 228 112 210 Z',
 leftArm:'M73 121 Q55 111 47 127 L43 166 Q45 186 63 185 L75 168 Z',
 rightArm:'M146 122 Q167 112 175 128 L177 169 Q174 189 158 184 L144 168 Z',
 body:'M72 88 Q73 62 97 54 Q123 46 144 63 Q155 78 152 106 L157 168 Q158 188 137 198 Q110 210 82 198 Q63 190 64 169 Z',
 bodyHighlight:'M82 78 Q97 62 112 62 M76 98 L75 161 Q78 180 89 186',
 visorFrame:'M112 79 Q138 73 160 84 Q173 97 165 117 Q159 135 132 138 L107 136 Q96 131 97 114 Q98 91 112 79 Z',
 visor:'M113 86 Q138 80 158 91 Q166 101 158 115 Q151 128 130 130 L111 129 Q104 125 105 114 Q105 98 113 86 Z',
 visorShine:'M113 96 Q129 86 147 91 Q151 93 150 96 Q130 93 117 105 Q110 108 109 104 Z',
 visorGleam:'M152 106 Q157 107 154 115 L149 119 Q146 119 148 114 Z',
 shirt:'M67 136 Q111 147 153 136 L155 172 Q147 190 111 198 Q76 192 65 172 Z',
 coat:'M92 146 L108 151 L110 192 L85 188 Z M114 150 L130 145 L138 190 L113 195 Z',
 pants:'M66 186 Q88 194 101 195 L101 216 Q90 226 64 217 Z M117 196 Q139 191 153 184 L151 218 Q130 226 113 217 Z',
 chestStripe:'M71 148 Q112 161 151 146',
 gloveLeft:'M42 162 Q53 163 67 157 L65 183 Q52 189 43 174 Z',
 gloveRight:'M156 158 Q168 164 177 160 L177 174 Q167 190 157 183 Z',
 crown:'M74 60 L74 28 L91 44 L110 20 L130 44 L150 27 L147 60 Z',
 horns:'M81 68 Q66 44 75 26 Q92 35 100 59 Z M130 58 Q146 31 153 26 Q161 47 147 69 Z',
 antenna:'M109 58 L109 32',
 flower:'M110 47 Q96 27 83 40 Q78 53 98 57 Q82 65 96 76 Q110 80 112 62 Q126 79 139 66 Q144 49 119 55 Q127 37 110 47 Z',
 cap:'M74 77 Q79 44 111 43 Q144 43 150 77 L159 84 Q140 92 123 86 L76 84 Z',
 star:'M111 29 L120 47 L141 50 L127 66 L132 85 L111 75 L91 85 L96 66 L81 50 L102 47 Z'
};
const cached={},out='#081421',fallback='#e85d75';let uid=0;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const safeColor=x=>typeof x==='string'&&/^#[\da-fA-F]{6}$/.test(x)?x:fallback;
const hsb=(hex,amount)=>{const n=parseInt(safeColor(hex).slice(1),16),a=[(n>>16)&255,(n>>8)&255,n&255];return '#'+a.map(x=>clamp(x+amount,0,255).toString(16).padStart(2,'0')).join('')};
const safeText=x=>String(x??'').replace(/[&<>"']/g,z=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[z]));
function appearance(entity={},catalog=[]){
 const co=entity.cosmetics||{};
 const find=id=>catalog.find(i=>i.id===id);
 const skin=find(co.skin),top=find(co.torso),bottom=find(co.abajo),gear=find(co.arriba);
 return {color:safeColor(skin?.suit||entity.color||fallback),suit:skin?.suit||null,trim:safeColor(skin?.trim||'#bde3eb'),outfit:skin?.outfit||'',top:top?.trim||'',bottom:bottom?.trim||'',gear:gear?.skin||'',name:entity.name||'MONGUITO',role:entity.role||'crew'};
}
function itemAppearance(item={}){
 return {color:safeColor(item.suit||fallback),suit:item.category==='skin'?item.suit||null:null,
 trim:safeColor(item.trim||'#bde3eb'),outfit:item.outfit||'',
 top:item.category==='torso'?(item.trim||'#f3c579'):'',bottom:item.category==='abajo'?(item.trim||'#7ec9e1'):'',
 gear:item.category==='arriba'?item.skin||'':'',name:item.name||'MONGUITO'};
}
const gearColors={crown:'#ffe187',antenna:'#98f2ff',halo:'#ffeea9',horns:'#ff8c9b',flower:'#ff9bc8',robot:'#9de7f4',star:'#ffe075',cap:'#d88963'};
const shape=(name,fill,stroke=out,sw=5,klass='')=>'<path'+(klass?' class="'+klass+'"':'')+' d="'+P[name]+'" fill="'+fill+'" stroke="'+stroke+'" stroke-width="'+sw+'" stroke-linecap="round" stroke-linejoin="round"/>';
function svg(raw={},opts={}){
 const o={...raw},c=safeColor(o.color||fallback),trim=safeColor(o.trim||'#bde3eb'),id='mong-'+(++uid);
 const light=hsb(c,43),deep=hsb(c,-48),gear=String(o.gear||'');
 const cls='monguito-svg '+safeText(opts.className||'')+' '+(opts.motion?'monguito-'+safeText(opts.motion):'');
 let hats='';
 if(gear==='halo')hats='<ellipse cx="112" cy="25" rx="39" ry="9" fill="none" stroke="#ffeaa4" stroke-width="7" opacity=".96"/>';
 else if(gear==='robot')hats='<g stroke="#092636" stroke-width="4"><rect x="151" y="105" width="28" height="27" rx="7" fill="#a9dbe6"/><circle cx="162" cy="118" r="5" fill="#5af4ff"/></g>';
 else if(P[gear])hats=shape(gear,gearColors[gear]||'#e6c36d','#20303f',5,'monguito-hat');
 if(gear==='antenna')hats+='<circle cx="109" cy="24" r="8" fill="#eaff94" stroke="#253b42" stroke-width="4"/>';
 if(gear==='flower')hats+='<circle cx="110" cy="54" r="8" fill="#ffe274"/>';
 return '<svg class="'+cls+'" viewBox="0 0 220 250" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="'+safeText(o.name||'Monguito')+'"><defs><linearGradient id="'+id+'-suit" x1="0" y1="0" x2="1" y2="1"><stop stop-color="'+light+'"/><stop offset=".39" stop-color="'+c+'"/><stop offset="1" stop-color="'+deep+'"/></linearGradient><linearGradient id="'+id+'-glass" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f7ffff"/><stop offset=".34" stop-color="#c0f5ff"/><stop offset=".69" stop-color="#68c6df"/><stop offset="1" stop-color="#24577a"/></linearGradient></defs>'+
 '<ellipse cx="110" cy="239" rx="64" ry="8" fill="#020713" opacity=".32"/>'+
 shape('backpack',deep,out,6)+
 '<g class="monguito-leg-left">'+shape('leftLeg','url(#'+id+'-suit)',out,7)+shape('leftBoot',trim,out,5)+'</g>'+
 '<g class="monguito-leg-right">'+shape('rightLeg','url(#'+id+'-suit)',out,7)+shape('rightBoot',trim,out,5)+'</g>'+
 '<g class="monguito-arm-left">'+shape('leftArm','url(#'+id+'-suit)',out,6)+'</g>'+
 '<g class="monguito-arm-right">'+shape('rightArm','url(#'+id+'-suit)',out,6)+'</g>'+
 shape('body','url(#'+id+'-suit)',out,8)+
 (o.suit?shape('shirt',safeColor(o.suit),trim,3)+shape('chestStripe', 'none',trim,2.2):
  (o.top?shape('shirt',safeColor(o.top),out,4)+shape('coat','none','#fff5c4',2.5):''))+
 (o.bottom?shape('pants',safeColor(o.bottom),out,4):'')+
 shape('bodyHighlight','none','#ffffff66',4)+
 shape('visorFrame','#0b283a','#061621',7)+
 shape('visor','url(#'+id+'-glass)','#5aabbc',2)+
 shape('visorShine','#ffffffad','none',0)+shape('visorGleam','#ffffff9a','none',0)+
 '<path d="M112 134Q144 145 160 120" fill="none" stroke="#f1ffff6a" stroke-width="2.2"/>'+
 hats+'</svg>';
}
function path(n){return cached[n]||(cached[n]=new Path2D(P[n]))}
function paint(c,n,fill,stroke=out,sw=5){
 c.beginPath();c.fillStyle=fill;c.fill(path(n));if(stroke&&stroke!=='none'){c.strokeStyle=stroke;c.lineWidth=sw;c.lineJoin='round';c.lineCap='round';c.stroke(path(n))}
}
function gradient(c,a,b){const g=c.createLinearGradient(64,68,165,185);g.addColorStop(0,hsb(a,44));g.addColorStop(.36,a);g.addColorStop(1,hsb(a,-48));return g}
function canvas(ctx,x,y,o={},motion={}){
 if(typeof Path2D==='undefined')return;
 const col=safeColor(o.color||fallback),trim=safeColor(o.trim||'#bde3eb'),grad=gradient(ctx,col);
 const moving=!!motion.moving,phase=motion.phase||0,amp=moving?Math.sin(phase)*.25:0;
 const bob=moving?Math.abs(Math.sin(phase))*7:Math.sin((motion.time||0)*.002+(motion.seed||1))*1.4;
 ctx.save();ctx.translate(x,y-bob*.0105);ctx.scale(.0105,.0105);
 if((motion.faceX??1)<0)ctx.scale(-1,1);
 ctx.translate(-110,-227);
 ctx.fillStyle='#010a1390';ctx.beginPath();ctx.ellipse(110,239,65,8,0,0,Math.PI*2);ctx.fill();
 paint(ctx,'backpack',hsb(col,-45),out,6);
 for(let i=0;i<2;i++){
  ctx.save();ctx.translate(i?125:88,167);ctx.rotate((i?-1:1)*amp);
  ctx.translate(i?-125:-88,-167);
  paint(ctx,i?'rightLeg':'leftLeg',grad,out,7);paint(ctx,i?'rightBoot':'leftBoot',trim,out,5);ctx.restore()
 }
 for(let i=0;i<2;i++){
  ctx.save();const originX=i?147:72;ctx.translate(originX,121);ctx.rotate((i?1:-1)*amp*.75);ctx.translate(-originX,-121);
  paint(ctx,i?'rightArm':'leftArm',grad,out,6);ctx.restore();
 }
 paint(ctx,'body',grad,out,8);
 if(o.suit){paint(ctx,'shirt',safeColor(o.suit),trim,3);paint(ctx,'chestStripe','transparent',trim,2.3)}
 else if(o.top){paint(ctx,'shirt',safeColor(o.top),out,3.5);paint(ctx,'coat','transparent','#ffffff8c',2.5)}
 if(o.bottom)paint(ctx,'pants',safeColor(o.bottom),out,3.5);
 paint(ctx,'bodyHighlight','transparent','#ffffff65',3.5);
 paint(ctx,'visorFrame','#0d2a3b',out,7);
 const glass=ctx.createLinearGradient(105,79,165,142);
 glass.addColorStop(0,'#fcffff');glass.addColorStop(.42,'#c5f4ff');glass.addColorStop(.76,'#75cadd');glass.addColorStop(1,'#245578');
 paint(ctx,'visor',glass,'#50899e',2);
 paint(ctx,'visorShine','#ffffff9a','none',0);
 paint(ctx,'visorGleam','#ffffffc9','none',0);
 const gear=String(o.gear||'');
 if(P[gear]){paint(ctx,gear,gearColors[gear]||'#e8d9b0','#1d2933',5);if(gear==='antenna'){ctx.fillStyle='#e8ff9d';ctx.beginPath();ctx.arc(109,24,8,0,Math.PI*2);ctx.fill()}if(gear==='flower'){ctx.fillStyle='#ffeb7d';ctx.beginPath();ctx.arc(110,54,7,0,Math.PI*2);ctx.fill()}}
 if(gear==='halo'){ctx.strokeStyle='#fff1a7';ctx.lineWidth=7;ctx.beginPath();ctx.ellipse(112,25,39,9,0,0,Math.PI*2);ctx.stroke()}
 if(gear==='robot'){ctx.fillStyle='#a9dce8';ctx.fillRect(151,105,28,27);ctx.fillStyle='#5af4ff';ctx.fillRect(160,116,8,6)}
 ctx.restore();
}
window.StarshipVisual={svg,canvas,appearance,itemAppearance,paths:P,version:'2.0'};
})();