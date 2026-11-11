/* STARSHIP SABOTAGE 3.0 — Hand-directed procedural 2D environment
   Animated in world coordinates, decorative only. All room collisions
   remain defined by the core world, never by this presentation layer. */
(function(){
'use strict';
const TAU=Math.PI*2;
const colors={cafe:'#ffe3a5',storage:'#efc48e',comms:'#ccbaff',admin:'#8affd7',electrical:'#ffe187',reactor:'#e6aaff',medbay:'#aefff0',o2:'#8fffe1',security:'#9be8ff'};
const rand=(i,j=0)=>{const q=Math.sin(i*127.1+j*311.7+43.27)*43758.545;return q-Math.floor(q)};
function rect(c,x,y,w,h,fill,stroke='',lw=.06){c.fillStyle=fill;c.fillRect(x,y,w,h);if(stroke){c.strokeStyle=stroke;c.lineWidth=lw;c.strokeRect(x,y,w,h)}}
function stroke(c,a,b,color,width=.06){c.lineWidth=width;c.strokeStyle=color;c.beginPath();c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1]);c.stroke()}
function glow(c,x,y,r,col){c.save();let g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,col);g.addColorStop(1,'#ffffff00');c.fillStyle=g;c.fillRect(x-r,y-r,2*r,2*r);c.restore()}
function beacon(c,x,y,t,col){
 c.save();const a=.42+.58*(.5+.5*Math.sin(t*3+x*2.3+y*.9));
 c.globalAlpha=a;c.fillStyle=col;c.shadowBlur=.35;c.shadowColor=col;c.beginPath();c.arc(x,y,.075,0,TAU);c.fill();c.restore();
}
function plaque(c,x,y,w,label,col,t){
 rect(c,x,y,w,.5,'#071825','#c4d0d54d',.04);
 rect(c,x+.07,y+.09,.07,.32,col);
 c.font='700 .19px system-ui';c.textAlign='left';c.textBaseline='middle';c.fillStyle='#e5f9ff';
 c.fillText(label,x+.23,y+.25,w-.32);
 rect(c,x+w-.22,y+.11,.13,.13,Math.sin(t*2+x)>0?'#a2ffb5':'#1b5549');
}
function microPanel(c,x,y,w,h,t,col,i){
 rect(c,x+.08,y+.11,w,h,'#000c13a8');
 rect(c,x,y,w,h,'#0a2434',col+'92',.045);
 rect(c,x+.12,y+.11,w-.24,h-.24,'#102e45');
 const pulse=.45+.55*Math.sin(t*2+i*.48);
 c.globalAlpha=.4+pulse*.2;c.strokeStyle=col;c.lineWidth=.055;c.beginPath();
 for(let k=0;k<6;k++){let xx=x+.17+k*(w-.34)/5,yy=y+h*.54+Math.sin(t*1.9+i*.7+k*.91)*h*.16;k?c.lineTo(xx,yy):c.moveTo(xx,yy)}c.stroke();c.globalAlpha=1;
 for(let j=0;j<3;j++)rect(c,x+.12+j*.13,y+h-.14,.07,.035,j===2?'#ffa989':'#a8ffe9');
}
function room(c,r,t,index){
 const {x,y,w,h}=r,co=colors[r.kind]||'#9edfff',cx=x+w/2,cy=y+h/2;
 c.save();c.beginPath();c.rect(x+.1,y+.1,w-.2,h-.2);c.clip();
 // Engraved hull panels with rivets, tiny safety striations, channel lights.
 for(let i=0;i<Math.floor(w/3);i++){
  let xx=x+1.3+i*3;
  rect(c,xx,y+.3,.035,.55,'#92e5ed36');
  rect(c,xx,y+h-.75,.035,.52,'#92e5ed36');
  beacon(c,xx,y+.73,t,co);beacon(c,xx,y+h-.74,t,co);
  for(let j=0;j<3;j++){let py=y+1.5+j*(h-3)/2;
   c.strokeStyle='#d4faff1a';c.lineWidth=.023;c.strokeRect(xx+.12,py,.78,.48);
   rect(c,xx+.21,py+.09,.10,.10,'#eaf8ff39');
  }
 }
 for(let j=0;j<Math.floor(h/2);j++){
  const py=y+.55+j*2.1;
  rect(c,x+.34,py,.46,.033,'#e8ffff32');rect(c,x+w-.80,py,.46,.033,'#e8ffff32');
 }
 // Low-profile maintenance hatches recessed into the deck.
 const hatches=Math.min(6,Math.max(3,Math.floor(w*h/50)));
 for(let i=0;i<hatches;i++){
  let px=x+1.8+rand(index*21,i)*Math.max(1,w-4),py=y+2+rand(index*77,i)*Math.max(1,h-4);
  if(r.kind==='cafe'&&Math.hypot(px-cx,py-cy)<6)continue;
  c.save();c.translate(px,py);c.rotate((i%2)*Math.PI/2);
  rect(c,-.42,-.24,.84,.48,'#071e2d6c','#aad8eb46',.035);
  for(let k=-1;k<=1;k++)stroke(c,[-.27,k*.10],[.27,k*.10],'#adddeb38',.024);
  rect(c,-.36,-.18,.10,.07,co+'6c');c.restore();
 }
 // Technical displays placed along the far wall, animated yet small.
 for(let i=0;i<Math.max(2,Math.min(5,Math.floor(w/6)));i++){
  let px=x+1.4+i*2.75,py=y+.73;
  microPanel(c,px,py,1.55,.88,t,co,i+index*5);
 }
 const roomTag=['DÉPOSITO','ENLACE','MANDO','ENERGÍA','HUB CENTRAL','NÚCLEO','BIOMED','SOPORTE VITAL','OBSERVACIÓN'][index]||'SECTOR';
 plaque(c,x+w-3.4,y+h-.95,3.05,roomTag,co,t);
 // Floor-safe navigation arrows and yellow industrial edge glyphs.
 for(let i=0;i<4;i++){
  const px=x+.9+i*.42,py=y+h-1.46;
  c.save();c.globalAlpha=.38;c.fillStyle=co;c.beginPath();c.moveTo(px,py-.2);c.lineTo(px+.23,py);c.lineTo(px,py+.2);c.closePath();c.fill();c.restore()
 }
 if(r.kind==='cafe'){
  // Illuminated SOS hub with four sets of directional floor paths.
  for(let i=0;i<4;i++){
   const a=i*Math.PI/2+Math.PI/4;
   c.save();c.translate(cx,cy);c.rotate(a);stroke(c,[3.1,0],[4.4,0],'#fff0ad85',.13);
   for(let j=0;j<3;j++){let xx=4.6+j*.55;rect(c,xx,-.11,.31,.21,'#ffe3a55a')}
   c.restore();
  }
  glow(c,cx,cy,3.6,'#ffe68b17');
  c.font='900 .29px system-ui';c.textAlign='center';c.fillStyle='#fff3c07d';c.fillText('SOS · CREW HUB',cx,cy+2.25);
 }
 if(r.kind==='reactor'){
  for(let i=0;i<5;i++){let a=i*TAU/5+t*.13;c.strokeStyle='#c99bff2d';c.lineWidth=.09;c.beginPath();c.arc(cx,cy,2.9+i*.30,a,a+1.8);c.stroke()}
  glow(c,cx,cy,3.9,'#a26dff1a');
 }
 if(r.kind==='medbay'){
  for(let i=0;i<7;i++){let bx=x+w-4.3+i*.43,by=y+h-2.5;
   stroke(c,[bx,by-.1],[bx+.16,by-.1-Math.sin(t*2+i)*.27],'#d4fff0bb',.055)}
  glow(c,cx,cy,3,'#8bfff023');
 }
 if(r.kind==='electrical'){
  for(let i=0;i<9;i++){let xx=x+1.5+i*.81;beacon(c,xx,y+h-1.5,t, i%3?'#ffe18a':'#ff6363')}
 }
 if(r.kind==='comms'||r.kind==='security'){
  let orbitX=cx,orbitY=cy+2.1;
  c.strokeStyle=co+'5a';c.lineWidth=.065;
  for(let k=0;k<3;k++){c.beginPath();c.arc(orbitX,orbitY,.55+k*.4,t*.4-k*.7,t*.4+Math.PI*1.2+k*.5);c.stroke()}
  beacon(c,orbitX,orbitY,t,co);
 }
 c.restore();
}
function draw(ctx,map,t=0){
 if(!ctx||!map?.rooms)return;
 const sec=t/1000;
 map.rooms.forEach((r,i)=>room(ctx,r,sec,i));
 // Isolated cable and recessed guidance marks along real corridors.
 for(const c of map.corridors||[]){
  let p=c.points;if(!p||p.length<2)continue;
  for(let i=0;i<p.length-1;i++){
   const a=p[i],b=p[i+1],len=Math.hypot(b[0]-a[0],b[1]-a[1]);
   let count=Math.floor(len/2.4);
   for(let j=0;j<count;j++){
    const q=(j+.4)/Math.max(1,count),xx=a[0]+(b[0]-a[0])*q,yy=a[1]+(b[1]-a[1])*q;
    ctx.save();ctx.translate(xx,yy);ctx.rotate(Math.atan2(b[1]-a[1],b[0]-a[0]));
    rect(ctx,-.18,-.13,.36,.26,'#102d39c9','#9edee770',.045);
    rect(ctx,-.07,-.045,.14,.09,'#83e5d681');ctx.restore();
   }
  }
 }
}
window.StarshipWorldV3={draw};
})();
