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

// Hand-crafted premium outfit geometry. One set of paths drives SVG and Canvas.
Object.assign(P,{
 suitZip:'M109 144 L111 195',
 shoulderPlateL:'M72 123 Q84 118 95 139 L88 154 Q74 155 68 145 Z',
 shoulderPlateR:'M127 136 Q141 118 151 126 L154 148 Q140 157 130 151 Z',
 breastplate:'M89 146 Q111 139 136 147 L133 175 Q110 186 90 175 Z',
 chestCore:'M104 153 L116 153 L122 163 L112 174 L101 163 Z',
 neckRing:'M89 86 Q111 72 139 84',
 wristL:'M46 163 L65 161 L63 175 L45 178 Z',
 wristR:'M157 162 L176 163 L176 177 L159 175 Z',
 belt:'M71 182 Q112 193 151 181 L150 191 Q109 204 73 191 Z',
 beltBuckle:'M105 187 L119 187 L121 196 L104 196 Z',
 visorAccent:'M106 104 Q114 86 136 85',
 hazmatCollar:'M89 91 Q96 73 113 73 Q133 74 142 89 L137 103 L127 88 L101 89 L94 106 Z',
 hazmatTube:'M80 147 Q61 139 61 115 Q61 94 87 100',
 hazmatFilter:'M77 156 L88 152 L92 168 L78 172 Z',
 hazardInsignia:'M114 157 L122 172 L106 172 Z',
 hazmatBands:'M75 185 L92 187 M127 188 L145 184 M49 168 L64 167 M158 166 L176 168',
 ninjaCowl:'M80 83 Q80 57 112 52 Q145 56 151 82 L147 97 Q136 82 108 80 Q91 85 84 96 Z',
 ninjaBandolier:'M78 119 L88 111 L145 177 L135 188 Z',
 ninjaShoulder:'M66 133 L87 130 L98 146 L86 155 L64 148 Z M133 146 L147 126 L162 133 L158 151 L144 157 Z',
 ninjaWaist:'M72 180 L149 181 L150 194 L73 192 Z',
 ninjaCloth:'M116 191 L133 193 L140 222 L123 219 Z',
 ninjaEmblem:'M113 155 L121 160 L116 169 L108 169 L103 160 Z',
 samuraiChest:'M80 135 L109 143 L141 134 L148 158 L129 179 L113 187 L94 177 L77 159 Z',
 samuraiPlate1:'M83 159 L141 156 M89 169 L135 168 M100 179 L126 178',
 samuraiPauldrons:'M68 116 L91 126 L95 141 L80 146 L61 138 Z M135 125 L155 114 L170 136 L153 147 L131 142 Z',
 samuraiFlame:'M110 161 Q99 151 112 145 Q109 158 124 159 Q130 175 112 181 Q100 173 110 161 Z',
 samuraiCracks:'M76 163 L90 151 L99 157 M137 150 L129 163 L140 169 M111 174 L116 184 M88 133 L77 139',
 samuraiGreaves:'M63 201 L96 203 L93 223 L67 229 Z M116 202 L149 202 L153 229 L118 224 Z',
 arcticHood:'M78 87 Q84 57 107 54 Q137 50 147 82 L147 97 L137 84 L124 75 L100 78 L88 96 Z',
 arcticPlates:'M76 133 L96 141 L110 133 L127 141 L145 133 L150 160 L137 185 L111 194 L83 183 L69 155 Z',
 iceShards:'M92 149 L100 172 L89 164 M113 143 L117 178 L129 165 M138 143 L133 159 L145 154 M88 181 L96 172',
 arcticFur:'M73 112 Q85 101 97 112 M127 111 Q145 99 153 111',
 arcticBoots:'M64 211 L97 215 L97 230 L59 231 Z M115 215 L150 209 L157 232 L117 231 Z',
 commanderEpaulets:'M66 120 L88 116 L95 131 L78 138 L64 133 Z M133 130 L147 115 L165 124 L159 140 L139 138 Z',
 commanderBraids:'M90 151 L133 151 M91 164 L130 164 M109 149 L109 188',
 commanderMedals:'M119 157 L126 157 L126 168 L119 168 Z M130 157 L137 157 L137 165 L130 165 Z',
 hazardVest:'M86 134 L110 144 L136 134 L151 174 L135 185 L87 185 L68 171 Z',
 hazardChevron:'M81 149 L109 164 L140 149 M85 169 L109 181 L137 166',
 hazardWarning:'M107 146 L117 146 L119 156 L105 156 Z',
 orbitalChest:'M83 133 L98 144 L111 141 L124 144 L143 133 L149 163 L134 180 L89 180 L70 161 Z',
 orbitalCores:'M100 152 L123 152 L130 161 L116 176 L97 164 Z',
 orbitalRibs:'M79 158 L95 167 M143 159 L131 168 M95 183 L128 183',
 punkJacket:'M76 128 L96 140 L107 133 L109 182 L85 187 L66 160 Z M114 136 L129 140 L149 128 L156 164 L138 187 L114 182 Z',
 punkLapel:'M94 137 L109 151 L94 163 L102 175 M128 138 L115 153 L128 165',
 punkStitches:'M68 160 L79 167 M79 173 L89 180 M142 178 L154 166',
 bootArmor:'M62 201 L97 207 L96 233 L55 235 L55 223 Z M114 209 L149 201 L162 223 L159 236 L116 235 Z',
 bootLights:'M58 223 L95 223 M118 225 L158 224',
 goldGreaves:'M64 198 L97 207 L94 229 L59 231 Z M114 207 L148 199 L160 231 L117 230 Z',
 goldEtch:'M70 209 L89 218 L82 225 M142 210 L127 219 L137 227',
 neonPants:'M65 190 L102 197 L102 220 L65 225 Z M114 197 L149 189 L154 222 L115 222 Z',
 neonSeams:'M70 204 L85 216 L95 213 M121 212 L134 203 L148 214',
 voidPants:'M65 192 L102 197 L101 225 L63 226 Z M114 198 L150 192 L155 226 L116 225 Z',
 voidSlits:'M72 204 L91 207 M72 211 L92 213 M123 212 L143 207 M125 219 L145 213',
 crownInlay:'M80 52 L91 51 L111 32 L129 52 L146 51',
 crownGem:'M109 47 L118 47 L122 54 L114 61 L106 54 Z',
 capEmblem:'M111 51 L120 57 L118 65 L109 68 L104 60 Z',
 hornShine:'M80 39 L88 50 M148 39 L143 52',
 antennaPulse:'M94 27 Q109 9 124 27 M87 23 Q109 0 131 23',
 flowerVeins:'M93 48 L110 54 L130 46 M100 68 L111 56 L130 67',
 starInlay:'M111 41 L115 51 L126 54 L118 63 L120 74 L111 68 L102 74 L104 63 L96 54 L107 51 Z',
 droneWing:'M154 104 L173 97 L179 104 L175 110 Z',
 droneLens:'M160 115 L172 115 L173 123 L159 123 Z'
});
function premiumLayers(o={}){
 const layers=[],add=(path,fill,stroke='#152330',width=2.4)=>layers.push({path,fill,stroke,width});
 const trim=safeColor(o.trim||'#bde3eb');
 if(o.suit){
  add('wristL',trim);add('wristR',trim);add('belt','#112c3b',trim,3);add('beltBuckle',trim,'#233544',2);
  if(o.outfit==='hazmat'){
   add('hazmatCollar','#233f34',trim,3);add('shoulderPlateL','#204c36','#d1ff88',3);add('shoulderPlateR','#204c36','#d1ff88',3);
   add('hazmatTube','none','#c9f85b',5);add('hazmatFilter','#233f35','#cfff86',2);add('hazardInsignia','#f0f95e','#23312a',2);
   add('hazmatBands','none','#e6ff9e',3);add('suitZip','none','#173e2d',4)
  }else if(o.outfit==='ninja'){
   add('ninjaCowl','#1b153e','#9a7fea',3);add('ninjaShoulder','#30234f','#b5a1ff',3);
   add('ninjaBandolier','#181832','#a998f5',2);add('ninjaWaist','#21173d','#9e83ed',2);add('ninjaCloth','#302457','#c9b7ff',2);add('ninjaEmblem','#a98eff','#30244e',2)
  }else if(o.outfit==='samurai'){
   add('samuraiGreaves','#81261b','#ffae62',3);add('samuraiPauldrons','#8a241b','#ffc178',4);
   add('samuraiChest','#631f1c','#ffb45e',4);add('samuraiPlate1','none','#eea55d',3);
   add('samuraiFlame','#ffc36a','#7f321c',2);add('samuraiCracks','none','#ffe5a1',3)
  }else if(o.outfit==='arctic'){
   add('arcticBoots','#d6f7ff','#426e98',3);add('arcticHood','#b0e8f1','#edfcff',5);
   add('arcticPlates','#c5f4ff','#518da4',4);add('iceShards','none','#ffffff',3);
   add('arcticFur','none','#ffffff',8);add('suitZip','none','#497eaa',3)
  }
 }else if(o.top){
  if(o.topId==='top_commander'){add('commanderEpaulets','#bd8e31','#fff0b4',4);add('commanderBraids','none','#ffe38c',3);add('commanderMedals','#e7f6ee','#b88d2a',1)}
  else if(o.topId==='top_hazard'){add('hazardVest','#e6a32c','#283746',3);add('hazardChevron','none','#1a2634',5);add('hazardWarning','#242c2e','#fff3ba',2)}
  else if(o.topId==='top_space'){add('orbitalChest','#276483','#a3f6ff',4);add('orbitalCores','#8cecff','#23415b',2);add('orbitalRibs','none','#ddfaff',2)}
  else if(o.topId==='top_punk'){add('punkJacket','#2b1836','#ef6ab8',3);add('punkLapel','none','#ffc4e3',3);add('punkStitches','none','#f879ba',2)}
 }
 if(o.bottom&&!o.suit){
  if(o.bottomId==='bottom_boots'){add('bootArmor','#284654','#8bf4fc',4);add('bootLights','none','#e9ffff',3)}
  else if(o.bottomId==='bottom_gold'){add('goldGreaves','#b78a31','#ffe6a0',4);add('goldEtch','none','#fff6c1',3)}
  else if(o.bottomId==='bottom_neon'){add('neonPants','#144735','#8cffa2',3);add('neonSeams','none','#daff75',3)}
  else if(o.bottomId==='bottom_void'){add('voidPants','#211d49','#ae8eff',3);add('voidSlits','none','#caafff',3)}
 }
 return layers;
}
function premiumHatLayers(gear){
 const l=[],add=(path,fill,stroke='#243445',width=2)=>l.push({path,fill,stroke,width});
 if(gear==='crown'){add('crownInlay','none','#fff7ba',3);add('crownGem','#f06a87','#fff4ba',2)}
 if(gear==='cap')add('capEmblem','#fff2ba','#92572e',2);
 if(gear==='horns')add('hornShine','none','#ffd2d8',3);
 if(gear==='antenna')add('antennaPulse','none','#91fcff',2);
 if(gear==='flower')add('flowerVeins','none','#ffe8fc',2);
 if(gear==='star')add('starInlay','#fff1a5','#de8c27',2);
 if(gear==='robot'){add('droneWing','#92eaff','#18364a',2);add('droneLens','#71faff','#152c3e',2)}
 return l;
}
function svgLayers(pieces){return pieces.map(v=>shape(v.path,v.fill,v.stroke,v.width)).join('')}
function canvasLayers(c,pieces){for(const l of pieces)paint(c,l.path,l.fill,l.stroke,l.width)}

const cached={},out='#081421',fallback='#e85d75';let uid=0;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const safeColor=x=>typeof x==='string'&&/^#[\da-fA-F]{6}$/.test(x)?x:fallback;
const hsb=(hex,amount)=>{const n=parseInt(safeColor(hex).slice(1),16),a=[(n>>16)&255,(n>>8)&255,n&255];return '#'+a.map(x=>clamp(x+amount,0,255).toString(16).padStart(2,'0')).join('')};
const safeText=x=>String(x??'').replace(/[&<>"']/g,z=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[z]));
function appearance(entity={},catalog=[]){
 const co=entity.cosmetics||{};
 const find=id=>catalog.find(i=>i.id===id);
 const skin=find(co.skin),top=find(co.torso),bottom=find(co.abajo),gear=find(co.arriba);
 return {color:safeColor(skin?.suit||entity.color||fallback),suit:skin?.suit||null,trim:safeColor(skin?.trim||'#bde3eb'),outfit:skin?.outfit||'',top:top?.trim||'',topId:top?.id||'',bottom:bottom?.trim||'',bottomId:bottom?.id||'',gear:gear?.skin||'',name:entity.name||'MONGUITO',role:entity.role||'crew'};
}
function itemAppearance(item={}){
 return {color:safeColor(item.suit||fallback),suit:item.category==='skin'?item.suit||null:null,
 trim:safeColor(item.trim||'#bde3eb'),outfit:item.outfit||'',
 top:item.category==='torso'?(item.trim||'#f3c579'):'',topId:item.category==='torso'?item.id:'',bottom:item.category==='abajo'?(item.trim||'#7ec9e1'):'',bottomId:item.category==='abajo'?item.id:'',
 gear:item.category==='arriba'?item.skin||'':'',name:item.name||'MONGUITO'};
}
const gearColors={crown:'#ffe187',antenna:'#98f2ff',halo:'#ffeea9',horns:'#ff8c9b',flower:'#ff9bc8',robot:'#9de7f4',star:'#ffe075',cap:'#d88963'};
const shape=(name,fill,stroke=out,sw=5,klass='')=>'<path'+(klass?' class="'+klass+'"':'')+' d="'+P[name]+'" fill="'+fill+'" stroke="'+stroke+'" stroke-width="'+sw+'" stroke-linecap="round" stroke-linejoin="round"/>';
function svg(raw={},opts={}){
 const o={...raw},c=safeColor(o.color||fallback),trim=safeColor(o.trim||'#bde3eb'),id='mong-'+(++uid);
 const light=hsb(c,43),deep=hsb(c,-48),gear=String(o.gear||'');
 const cls='monguito-svg '+safeText(opts.className||'')+' '+(opts.motion?'monguito-'+safeText(opts.motion):'')+' monguito-costume-'+safeText(o.outfit||o.topId||o.bottomId||'standard');
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
 svgLayers(premiumLayers(o))+shape('bodyHighlight','none','#ffffff66',4)+
 shape('visorFrame','#0b283a','#061621',7)+
 shape('visor','url(#'+id+'-glass)','#5aabbc',2)+
 shape('visorShine','#ffffffad','none',0)+shape('visorGleam','#ffffff9a','none',0)+
 '<path d="M112 134Q144 145 160 120" fill="none" stroke="#f1ffff6a" stroke-width="2.2"/>'+
 hats+svgLayers(premiumHatLayers(gear))+'</svg>';
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
 canvasLayers(ctx,premiumLayers(o));
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
 canvasLayers(ctx,premiumHatLayers(gear));
 ctx.restore();
}
window.StarshipVisual={svg,canvas,appearance,itemAppearance,paths:P,version:'2.0'};
})();