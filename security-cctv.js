/* STARSHIP SABOTAGE — SECURITY CONTROL ROOM / CCTV V4
   Four independent live in-room feeds. Each canvas clips strictly to its
   assigned room footprint: corridors and adjacent rooms are never rendered.
   Visual system only: uses existing multiplayer game state without writes. */
(function(){
'use strict';
const TAU=Math.PI*2;
const palette={cafeteria:'#eac87e',admin:'#74d5ae',oxygen:'#78eed6',reactor:'#d1a3ff'};
let lastFrame=-Infinity;
const defaultFeedSize={width:480,height:270};

function safeColor(v,fallback='#92dfe9'){return typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v)?v:fallback}
function round(c,x,y,w,h,r){c.beginPath();if(typeof c.roundRect==='function')c.roundRect(x,y,w,h,r);else c.rect(x,y,w,h)}
function pathRoom(c,room){c.beginPath();(room.poly||[[0,0],[1,0],[1,1],[0,1]]).forEach(([u,v],i)=>{const x=room.x+u*room.w,y=room.y+v*room.h;i?c.lineTo(x,y):c.moveTo(x,y)});c.closePath()}
function contains(room,x,y){if(!Number.isFinite(x)||!Number.isFinite(y))return false;
 const points=(room.poly||[[0,0],[1,0],[1,1],[0,1]]).map(([u,v])=>[room.x+u*room.w,room.y+v*room.h]);
 let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside}return inside;
}
function line(c,x1,y1,x2,y2,color,width=.06){c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke()}
function panel(c,x,y,w,h,col,t){
 c.fillStyle='#081c2c';c.fillRect(x,y,w,h);c.strokeStyle='#8bc6d66e';c.lineWidth=.065;c.strokeRect(x,y,w,h);
 c.fillStyle='#245269';c.fillRect(x+.13,y+.13,w-.26,h-.26);
 c.fillStyle=col;c.globalAlpha=.30+.17*Math.sin(t*.002+x*2);c.fillRect(x+.18,y+.18,w-.36,h*.13);c.globalAlpha=1;
 for(let j=0;j<3;j++)line(c,x+.2,y+h*.43+j*.18,x+w-.2,y+h*.43+j*.18,'#cdf9ff6b',.03);
 c.fillStyle='#c7ffd5';c.beginPath();c.arc(x+w-.2,y+h-.18,.07,0,TAU);c.fill();
}
function desk(c,x,y,w,h,col,t){
 c.fillStyle='#0a1927';c.fillRect(x-.1,y-.13,w+.2,h+.2);
 c.fillStyle='#486778';c.fillRect(x,y,w,h);c.strokeStyle='#b2d1da';c.lineWidth=.08;c.strokeRect(x,y,w,h);
 panel(c,x+w*.25,y+.08,w*.50,h*.46,col,t);
 c.fillStyle='#132939';c.fillRect(x+w*.12,y+h*.67,w*.76,.18);
 c.fillStyle='#a0c7d1';c.fillRect(x+w*.18,y+h*.72,w*.46,.045);
}
function ellipse(c,x,y,rx,ry,fill,stroke='#8ddfee',lineWidth=.08){
 c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.fillStyle=fill;c.fill();
 if(stroke){c.strokeStyle=stroke;c.lineWidth=lineWidth;c.stroke()}
}
function drawSet(c,room,t){
 const {x,y,w,h,kind}=room,cx=x+w/2,cy=y+h/2,col=palette[room.id]||'#80e7f5';
 c.save();
 // These fixtures use exactly the same world-space locations as the game.
 if(room.id==='cafeteria'){
  for(const [px,py,rx,ry] of [[cx,cy,1.72,1.12],[cx-8,cy-5.4,1.42,.92],[cx+8,cy-5.4,1.42,.92],[cx-8,cy+5.4,1.42,.92],[cx+8,cy+5.4,1.42,.92]]){
   ellipse(c,px+.12,py+.16,rx+.12,ry+.12,'#061522c9','#162d38',.12);
   ellipse(c,px,py,rx,ry,'#627c83','#d1eff6',.10);
   ellipse(c,px,py,rx*.76,ry*.76,'#2f5762','#75bfd1',.065);
   for(let j=0;j<5;j++){let a=j*TAU/5;ellipse(c,px+Math.cos(a)*rx*.61,py+Math.sin(a)*ry*.61,.065,.065,j%2?'#8bffda':'#ffc985','',0)}
  }
  c.font='900 .39px system-ui';c.textAlign='center';c.fillStyle='#f5e2a2';c.fillText('SOS',cx,cy+.15);
  for(let k=0;k<4;k++){const px=cx+Math.cos(k*Math.PI/2+Math.PI/4)*6,py=cy+Math.sin(k*Math.PI/2+Math.PI/4)*6;
   line(c,px-.7,py,px+.7,py,'#fff2be46',.09)}
 }else if(room.id==='admin'){
  desk(c,x+1.2,y+1.3,4.2,1.7,col,t);desk(c,x+w-5.7,y+1.3,4.2,1.7,col,t);
  desk(c,x+w*.32,y+h-3.1,w*.36,1.35,col,t);
  for(let i=0;i<4;i++)panel(c,x+1.3+i*1.4,y+h-.9,1,.48,col,t+i*21);
 }else if(room.id==='oxygen'){
  ellipse(c,cx,cy,3.1,2.8,'#0a2b31','#51ab9d',.16);
  ellipse(c,cx,cy,2.3,2.1,'#1d5c55','#b4fff0',.15);
  ellipse(c,cx,cy,1.45,1.3,'#2b8581','#d0fffb',.12);
  for(let i=0;i<12;i++){const a=i*TAU/12+t*.0002;line(c,cx+Math.cos(a)*1.7,cy+Math.sin(a)*1.6,cx+Math.cos(a)*2.15,cy+Math.sin(a)*1.95,'#b6fff4a1',.08)}
  panel(c,x+1,y+1,2,1.2,col,t);
  panel(c,x+w-3.1,y+h-2.3,2,1.2,col,t);
 }else if(room.id==='reactor'){
  for(let k=0;k<4;k++){const r=4.1-k*.65;ellipse(c,cx,cy,r,r*.68,k%2?'#123349':'#20425c',k%2?'#8459bf':'#c9abff',.13)}
  const pulse=.5+.5*Math.sin(t*.0025);
  ellipse(c,cx,cy,.8+pulse*.2,.68+pulse*.15,'#86e3ff','#efdcff',.12);
  for(let i=0;i<8;i++){const a=i*TAU/8;
   line(c,cx+Math.cos(a)*4.2,cy+Math.sin(a)*2.7,cx+Math.cos(a)*5.3,cy+Math.sin(a)*3.6,'#b99cfa',.13)}
  desk(c,x+1.2,y+1.3,3,1.7,col,t);
  desk(c,x+w-4.5,y+h-3,3,1.7,col,t);
 }
 // Light fixtures and maintenance labels appear only within this clipped room.
 for(let i=0;i<4;i++){
  const xx=x+1.2+(w-2.4)*i/3,yy=y+.55;
  c.fillStyle=i%2?'#a0edfd':'#ffe6a3';c.globalAlpha=.4+.4*Math.sin(t*.003+i);
  c.fillRect(xx,yy,.58,.07);c.globalAlpha=1;
 }
 c.restore();
}
function renderFeed({canvas,room,state,camera,index,time,appearance,world}){
 const layout=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,1.5);
 const width=Math.max(1,Math.floor(layout.width||defaultFeedSize.width)),height=Math.max(1,Math.floor(layout.height||defaultFeedSize.height));
 const pw=Math.ceil(width*dpr),ph=Math.ceil(height*dpr);
 if(canvas.width!==pw)canvas.width=pw;
 if(canvas.height!==ph)canvas.height=ph;
 const c=canvas.getContext('2d',{alpha:false});if(!c)return {room:room.id,players:[],rendered:false};
 c.setTransform(dpr,0,0,dpr,0,0);c.globalAlpha=1;c.fillStyle='#020b13';c.fillRect(0,0,width,height);
 // Fit the WHOLE room; letterboxed margins are opaque console background,
 // never exterior world imagery. Every object is clipped to the room polygon.
 const pad=10,scale=Math.min((width-pad*2)/room.w,(height-pad*2)/room.h);
 const ox=(width-room.w*scale)/2,oy=(height-room.h*scale)/2;
 c.save();c.translate(ox-room.x*scale,oy-room.y*scale);c.scale(scale,scale);
 pathRoom(c,room);c.save();c.clip();
 const grad=c.createLinearGradient(room.x,room.y,room.x+room.w,room.y+room.h);
 grad.addColorStop(0,'#254a59');grad.addColorStop(.47,'#112839');grad.addColorStop(1,'#081f2a');
 c.fillStyle=grad;c.fillRect(room.x,room.y,room.w,room.h);
 if(world&&typeof world.draw==='function')world.draw(c,{rooms:[room],corridors:[]},time);
 drawSet(c,room,time);
 const shown=[];
 const players=Object.values(state?.players||{}).filter(p=>p&&!p.expelled&&!p.inVent&&(p.alive||p.body&&!p.body.reported));
 players.sort((a,b)=>(a.y||0)-(b.y||0));
 for(const p of players){
  const x=Number(p.alive?p.x:(p.body?.x??p.x)),y=Number(p.alive?p.y:(p.body?.y??p.y));
  if(!contains(room,x,y))continue;
  shown.push(p.id);
  if(!p.alive){
   c.save();c.translate(x,y);c.rotate(Math.PI/2);
   if(window.StarshipVisual?.canvas)window.StarshipVisual.canvas(c,0,0,appearance(p),{time,seed:2});
   c.restore();
   ellipse(c,x+.28,y-.35,.14,.14,'#f95b79','#ffb6c0',.04);
  }else{
   if(window.StarshipVisual?.canvas)window.StarshipVisual.canvas(c,x,y,appearance(p),{time,seed:String(p.id||'').length,moving:!!p._moving,phase:p._walkPhase||0,faceX:p._faceX||1});
   c.save();c.font='800 .36px system-ui';c.textAlign='center';c.textBaseline='middle';
   const label=String(p.name||'TRIPULANTE').slice(0,16);
   c.lineWidth=.12;c.strokeStyle='#041522';c.strokeText(label,x,y-.25);
   c.fillStyle='#e9ffff';c.fillText(label,x,y-.25);c.restore();
  }
 }
 // Static room-only task markers (never show tasks in other rooms).
 for(const task of state?.phase==='playing'?(state?.cameraTasks||[]):[]){
  if(!contains(room,task.x,task.y))continue;
  ellipse(c,task.x,task.y,.20,.20,'#dcf8a0','#72f1b6',.06);
 }
 c.restore();
 pathRoom(c,room);c.strokeStyle='#78b3c4';c.lineWidth=.13;c.stroke();
 c.restore();
 // Surveillance screen overlay: timestamp, scanlines and signal/REC indicator.
 c.save();c.setTransform(dpr,0,0,dpr,0,0);
 const lines=Math.ceil(height/7);
 c.strokeStyle='#b8f2ff0b';c.lineWidth=1;
 for(let i=0;i<lines;i++){let yy=i*7+(Math.floor(time/140)%7);c.beginPath();c.moveTo(0,yy);c.lineTo(width,yy);c.stroke()}
 const vign=c.createRadialGradient(width*.5,height*.5,height*.13,width*.5,height*.5,Math.max(width,height)*.75);
 vign.addColorStop(0,'#030c1300');vign.addColorStop(1,'#02070eaf');c.fillStyle=vign;c.fillRect(0,0,width,height);
 c.fillStyle='#061928b9';round(c,9,8,Math.min(width-18,137),23,5);c.fill();
 c.font='900 11px system-ui';c.textAlign='left';c.fillStyle='#e1f9fa';c.fillText('CAM 0'+(index+1)+' · '+camera.name.slice(0,15),16,24);
 c.fillStyle='#ff4766';c.beginPath();c.arc(width-29,17,5,0,TAU);c.fill();
 c.fillStyle='#ffd1d9';c.font='800 10px system-ui';c.textAlign='right';c.fillText('● LIVE',width-39,20);
 const clock=new Date(Date.now()).toLocaleTimeString('es-ES',{hour12:false});
 c.fillStyle='#c1eff7';c.font='800 10px monospace';c.textAlign='right';c.fillText(clock,width-10,height-10);
 c.fillStyle='#b5f1d7';c.font='800 9px monospace';c.textAlign='left';c.fillText('SECTOR AISLADO · TRANSMISIÓN',10,height-10);
 c.restore();
 return {room:room.id,players:shown,rendered:true};
}
function render({panel,map,state,cameras,appearance,time=performance.now(),world}){
 if(!panel||panel.classList.contains('hidden')||!map?.rooms)return [];
 if(time-lastFrame<33)return [];
 lastFrame=time;
 const out=[];
 panel.querySelectorAll('canvas[data-camera]').forEach(canvas=>{
  const index=Number(canvas.dataset.camera),camera=cameras[index];
  if(!camera)return;
  const room=map.rooms.find(r=>r.id===camera.roomId);
  if(!room)return;
  out.push(renderFeed({canvas,room,state,camera,index,time,appearance,world}));
 });
 return out;
}
function reset(){lastFrame=-Infinity}
window.StarshipCCTV={render,renderFeed,contains,reset,version:'4.0'};
})();
