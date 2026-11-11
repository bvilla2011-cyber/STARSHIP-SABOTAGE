(()=>{'use strict';
const v4Settings={...window.StarshipRules.defaults};
let v4ClockOffset=0,v4Queue=Promise.resolve(),v4Jwt=null,v4TaskSession=null,v4LastSuccess=Date.now(),v4Correction=null,v4Busy=false;
const v4Samples=[],v4SeenEvents=new Set();let v4InputSeq=0,v4MovePath=[],v4LastPathAt=0;
const v4Preferences=Object.assign({master:.65,music:.18,effects:.8,quality:'medium',reduceMotion:false,contrast:false,scale:1,sensitivity:1,language:localStorage.getItem('starship_language')||'es'},(()=>{try{return JSON.parse(localStorage.getItem('starship_settings4')||'{}')}catch(e){return {}}})());
const tr=text=>window.StarshipI18n?.translate(String(text),gameLang)||String(text);

const ENDPOINT='https://fra.cloud.appwrite.io/v1',PROJECT='6af106fb00396755a6fb',DB='starship_db',ROOMS='rooms_v2',PLAYERS='players_v2';
// Appwrite Cloud usa TablesDB: el SDK web debe exponer esta API.
const AppwriteSDK=window.Appwrite||null;
const Client=AppwriteSDK?.Client, Account=AppwriteSDK?.Account, TablesDB=AppwriteSDK?.TablesDB, Functions=AppwriteSDK?.Functions, ID=AppwriteSDK?.ID,
      Query=AppwriteSDK?.Query, Permission=AppwriteSDK?.Permission, Role=AppwriteSDK?.Role;
let db=null,authAccount=null,authUser=null,authMode='signup',authPendingUserId='',authStep='credentials',giftClaimedThisLoad=false;
const giftReferral=new URLSearchParams(location.search).get('ref')==='bvilla';
async function claimReferralGift(){if(!giftReferral||giftClaimedThisLoad||!authUser?.emailVerification)return;giftClaimedThisLoad=true;try{if(!Functions)throw new Error('El módulo de regalos no está disponible.');const jwt=await getAccount().createJWT();const client=new Client().setEndpoint(ENDPOINT).setProject(PROJECT);const functions=new Functions(client);const execution=await functions.createExecution({functionId:'starship-gift-claim',body:JSON.stringify({campaign:'BVILLA3000'}),async:false,path:'/',method:'POST',headers:{}});let result={};try{result=JSON.parse(execution.responseBody||'{}')}catch(e){}if(result.claimed===true&&result.reward===3000){await authority('profile');window.starshipGiftToast='¡BVILLA te ha regalado 3.000 pesos universales!';}else if(result.alreadyClaimed){window.starshipGiftToast='Esta cuenta ya había reclamado el regalo.';}else if(!result.ok){throw new Error(result.message||'No se pudo validar la invitación.')}try{history.replaceState({},'',location.pathname+location.hash)}catch(e){}}catch(e){giftClaimedThisLoad=false;console.warn('No se pudo reclamar el regalo de invitación',e);window.starshipGiftToast='No se pudo validar el regalo. Recarga esta página desde el enlace de invitación.'}}
function getAccount(){if(!AppwriteSDK||!Client||!Account)throw new Error('El módulo de cuentas de Appwrite no está disponible.');if(!authAccount){const c=new Client().setEndpoint(ENDPOINT).setProject(PROJECT);authAccount=new Account(c)}return authAccount}
function getDb(){
  if(db)return db;
  if(!AppwriteSDK)throw new Error('No se ha descargado el SDK de Appwrite. Recarga la página o comprueba la conexión.');
  const missing=['Client','TablesDB','ID','Query','Permission','Role'].filter(k=>!AppwriteSDK[k]);
  if(missing.length)throw new Error('El SDK de Appwrite está incompleto ('+missing.join(', ')+'). Recarga la página.');
  const client=new Client().setEndpoint(ENDPOINT).setProject(PROJECT);
  db=new TablesDB(client);
  return db;
}
const $=id=>document.getElementById(id);let roomId='',roomCode='',playerId='',hostId='',isHost=false,soloMode=false,me=null,players=[],gameState=null,poll=null,move={x:0,y:0},keys={},lastMove=0,canvas,ctx,raf=0;
// One canonical original map is shared with server validation and navigation tests.
const MAP=window.StarshipData.map;
// Colisionadores del mobiliario: los mismos volúmenes que ocupan los elementos dibujados.
// Cafeteria table outlines complement the canonical machinery fixtures.
const buildFurnitureColliders=()=>{
 const r=MAP.rooms.find(r=>r.id==='cafeteria');
 if(!r)return [];
 const cx=r.x+r.w/2,cy=r.y+r.h/2;
 const tables=[{kind:'ellipse',room:r.id,id:'sos_table',x:cx,y:cy,rx:1.72,ry:1.12}];
 for(const [dx,dy] of [[-8,-5.4],[8,-5.4],[-8,5.4],[8,5.4]]){
  tables.push({kind:'ellipse',room:r.id,id:'cafe_table_'+dx+'_'+dy,x:cx+dx,y:cy+dy,rx:1.42,ry:.92});
 }
 return tables;
};
function segmentRectInterval(x1,y1,x2,y2,rect){
 let lo=0,hi=1;const dx=x2-x1,dy=y2-y1;
 for(const [p,q] of [[-dx,x1-rect.x],[dx,rect.x+rect.w-x1],[-dy,y1-rect.y],[dy,rect.y+rect.h-y1]]){
  if(Math.abs(p)<1e-9){if(q<0)return null;continue}
  const t=q/p;if(p<0){if(t>hi)return null;lo=Math.max(lo,t)}else{if(t<lo)return null;hi=Math.min(hi,t)}
 }
 return hi-lo>.0001?[Math.max(0,lo),Math.min(1,hi)]:null;
}
function buildOcclusionSegments(){
 const segments=[],add=(x1,y1,x2,y2,meta={})=>{if(Math.hypot(x2-x1,y2-y1)>.025)segments.push({x1,y1,x2,y2,...meta,minX:Math.min(x1,x2),maxX:Math.max(x1,x2),minY:Math.min(y1,y2),maxY:Math.max(y1,y2)})};
 const wall=(x1,y1,x2,y2,doors,vertical)=>{
  const length=vertical?y2-y1:x2-x1,gaps=(doors||[]).map(d=>{const center=d.offset*length,half=(d.width||2.35)/2+.08;return [Math.max(0,center-half),Math.min(length,center+half)]}).sort((a,b)=>a[0]-b[0]);
  let cursor=0;for(const [a,b] of gaps){if(a>cursor){if(vertical)add(x1,y1+cursor,x2,y1+a);else add(x1+cursor,y1,x1+a,y2)}cursor=Math.max(cursor,b)}
  if(cursor<length){if(vertical)add(x1,y1+cursor,x2,y2);else add(x1+cursor,y1,x2,y2)}
 };
 for(const r of MAP.rooms){
  wall(r.x,r.y,r.x+r.w,r.y,r.doors?.filter(d=>d.side==='top'),false);
  wall(r.x,r.y+r.h,r.x+r.w,r.y+r.h,r.doors?.filter(d=>d.side==='bottom'),false);
  wall(r.x,r.y,r.x,r.y+r.h,r.doors?.filter(d=>d.side==='left'),true);
  wall(r.x+r.w,r.y,r.x+r.w,r.y+r.h,r.doors?.filter(d=>d.side==='right'),true);
 }
 for(const o of MAP.obstacles||[]){add(o.x,o.y,o.x+o.w,o.y,{furniture:true});add(o.x+o.w,o.y,o.x+o.w,o.y+o.h,{furniture:true});add(o.x+o.w,o.y+o.h,o.x,o.y+o.h,{furniture:true});add(o.x,o.y+o.h,o.x,o.y,{furniture:true});}
 for(const o of buildFurnitureColliders()){const points=Array.from({length:12},(_,i)=>[o.x+Math.cos(i*Math.PI/6)*o.rx,o.y+Math.sin(i*Math.PI/6)*o.ry]);for(let i=0;i<points.length;i++)add(...points[i],...points[(i+1)%points.length],{furniture:true});}
 // Las aristas de los pasillos se recortan en habitaciones y cruces: así no
 // atraviesan las puertas ni crean paredes invisibles entre corredores conectados.
 const corridors=MAP.corridors||[];
 for(let ci=0;ci<corridors.length;ci++){
  const corridor=corridors[ci],half=(corridor.width||0)/2;
  for(let si=1;si<corridor.points.length;si++){
   const a=corridor.points[si-1],b=corridor.points[si],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);
   if(len<.001)continue;
   const ox=-dy/len*half,oy=dx/len*half;
   const blockers=MAP.rooms.map(r=>({x:r.x,y:r.y,w:r.w,h:r.h}));
   for(let oi=0;oi<corridors.length;oi++){
    if(oi===ci)continue;
    const other=corridors[oi],oh=(other.width||0)/2+.015;
    for(let k=1;k<other.points.length;k++){
     const p=other.points[k-1],q=other.points[k];
     blockers.push({x:Math.min(p[0],q[0])-oh,y:Math.min(p[1],q[1])-oh,w:Math.abs(q[0]-p[0])+2*oh,h:Math.abs(q[1]-p[1])+2*oh});
    }
   }
   for(const side of [-1,1]){
    const x1=a[0]+side*ox,y1=a[1]+side*oy,x2=b[0]+side*ox,y2=b[1]+side*oy;
    const intervals=blockers.map(rect=>segmentRectInterval(x1,y1,x2,y2,rect)).filter(Boolean).sort((u,v)=>u[0]-v[0]);
    const merged=[];for(const it of intervals){const last=merged[merged.length-1];if(last&&it[0]<=last[1]+.0001)last[1]=Math.max(last[1],it[1]);else merged.push([...it])}
    let cursor=0;const meta={corridorId:corridor.id,corridorSegment:si};
    for(const [lo,hi] of merged){if(lo>cursor+.0001)add(x1+dx*cursor,y1+dy*cursor,x1+dx*lo,y1+dy*lo,meta);cursor=Math.max(cursor,hi)}
    if(cursor<1-.0001)add(x1+dx*cursor,y1+dy*cursor,x2,y2,meta);
   }
  }
 }
 return segments;
}
function shadowGeometryAudit(){
 const corridorSegments=MAP_OCCLUSION_SEGMENTS.filter(s=>s.corridorId);
 let roomLeaks=0,junctionLeaks=0;
 const distance=(x,y,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy,t=l?Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/l)):0;return Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t)};
 for(const s of corridorSegments){
  const x=(s.x1+s.x2)/2,y=(s.y1+s.y2)/2;
  if(MAP.rooms.some(r=>x>r.x+.001&&x<r.x+r.w-.001&&y>r.y+.001&&y<r.y+r.h-.001))roomLeaks++;
  if(MAP.corridors.some(c=>c.id!==s.corridorId&&distance(x,y,c.points[0],c.points[1])<(c.width||0)/2-.001))junctionLeaks++;
 }
 return {corridorSegments:corridorSegments.length,roomLeaks,junctionLeaks};
}
function visibilityPolygon(px,py,radius){
 const relevant=[];
 const pointDistance=(x,y,s)=>{const dx=s.x2-s.x1,dy=s.y2-s.y1,l=dx*dx+dy*dy,t=l?Math.max(0,Math.min(1,((x-s.x1)*dx+(y-s.y1)*dy)/l)):0;return Math.hypot(x-s.x1-dx*t,y-s.y1-dy*t)};
 for(const s of MAP_OCCLUSION_SEGMENTS)if(s.minX<=px+radius&&s.maxX>=px-radius&&s.minY<=py+radius&&s.maxY>=py-radius&&pointDistance(px,py,s)<=radius+.2)relevant.push(s);
 const angles=[];for(let i=0;i<72;i++)angles.push(i*Math.PI*2/72);
 const addAngles=(x,y)=>{const a=Math.atan2(y-py,x-px);angles.push(a-.00008,a,a+.00008)};
 for(const s of relevant){addAngles(s.x1,s.y1);addAngles(s.x2,s.y2);const dx=s.x2-s.x1,dy=s.y2-s.y1,l=dx*dx+dy*dy,t=l?Math.max(0,Math.min(1,((px-s.x1)*dx+(py-s.y1)*dy)/l)):0;addAngles(s.x1+dx*t,s.y1+dy*t)}
 angles.sort((a,b)=>a-b);
 const points=[];
 for(const angle of angles){
  const rx=Math.cos(angle),ry=Math.sin(angle);let nearest=radius;
  for(const s of relevant){
   const sx=s.x2-s.x1,sy=s.y2-s.y1,qx=s.x1-px,qy=s.y1-py,den=rx*sy-ry*sx;
   if(Math.abs(den)<1e-8)continue;
   const t=(qx*sy-qy*sx)/den,u=(qx*ry-qy*rx)/den;
   if(t>.015&&t<nearest&&u>=0&&u<=1)nearest=t;
  }
  points.push([px+rx*nearest,py+ry*nearest]);
 }
 return points;
}


const MAP_OCCLUSION_SEGMENTS=buildOcclusionSegments();
const MAP_SCALE=1;
const ROOM_KIND_ACCENTS={cafe:'#e8b96c',engine:'#ff925d',reactor:'#c58aff',security:'#69dce2',medbay:'#8ce8dc',electrical:'#ffd16a',storage:'#d4a16c',admin:'#80e0bd',weapons:'#f1a76f',nav:'#76c9ff',o2:'#72e8bd',shields:'#69dfff',comms:'#c49bff'};
const ROOM_ACCENTS={cargo_n:'#d6ad72',comms_n:'#c7a5ff',oxygen:'#79f0c5',admin:'#83e4c2',electrical:'#ffd16a',cafeteria:'#f2c67e',security:'#6de2e9',reactor:'#d29aff',medbay:'#8ce8dc',weapons:'#f2a66f',engine_u:'#ff9868',navigation:'#79cfff',shields:'#73e5ff',storage:'#d8b27a',comms_s:'#a994ef',laboratory:'#91e8d0',cargo_s:'#e2a66e',engine_s:'#ff795b'};
// Placas de identidad: nomenclatura y señalética propia para las 18 salas.
const ROOM_SIGNATURES={
 cargo_n:'CARGO · A1',comms_n:'UPLINK · A',oxygen:'O₂ · FLOW',admin:'ACCESS · ID',
 electrical:'POWER · GRID',cafeteria:'CREW · HUB',security:'CCTV · WATCH',reactor:'CORE · DRIVE',
 medbay:'MED · SCAN',weapons:'WEAPON · BAY',engine_u:'THRUST · UPPER',navigation:'NAV · FLIGHT',
 shields:'SHIELD · ARRAY',storage:'STORAGE · B',comms_s:'UPLINK · B',laboratory:'LAB · BIO',
 cargo_s:'CARGO · A2',engine_s:'THRUST · LOWER'
};
const ROOM_SIGNATURE_COLORS={
 cargo_n:'#d6ad72',comms_n:'#c7a5ff',oxygen:'#79f0c5',admin:'#83e4c2',electrical:'#ffd16a',
 cafeteria:'#f2c67e',security:'#6de2e9',reactor:'#d29aff',medbay:'#8ce8dc',weapons:'#f2a66f',
 engine_u:'#ff9868',navigation:'#79cfff',shields:'#73e5ff',storage:'#d8b27a',comms_s:'#a994ef',
 laboratory:'#91e8d0',cargo_s:'#e2a66e',engine_s:'#ff795b'
};

const SPAWN_X=61,SPAWN_Y=40;
// API de pruebas E2E disponible únicamente en localhost; nunca se expone en producción.
if(location.hostname==='127.0.0.1'||location.hostname==='localhost'){
 window.__STARSHIP_TEST__={
  actionAvailability(){return {task:!$('interact').disabled,report:!$('report').disabled,meeting:!$('emergency').disabled}},
  prepareSecurityCameraTest(){
   const p=gameState?.players?.[playerId],room=MAP.rooms.find(r=>r.id==='security');
   if(!p||!room)throw new Error('No existe partida de pruebas o sala Seguridad');
   p.x=room.x+room.w/2;p.y=room.y+room.h/2;
   p.alive=true;p.inVent=false;p.ventId=null;
   gameState.phase='playing';gameState.meeting=null;securityCameraIndex=-1;
   return {inRoom:pointInRoom(p.x,p.y,room),position:{x:p.x,y:p.y}};
  },
  seedSecurityCameraTargets(){
   const ids=[];
   for(let i=0;i<SECURITY_CAMERAS.length;i++){
    const room=MAP.rooms.find(r=>r.id===SECURITY_CAMERAS[i].roomId);
    const id='__cctv_target_'+i+'__';
    gameState.players[id]={id,name:'CAM_TEST_'+i,x:room.x+room.w/2,y:room.y+room.h/2,alive:true,role:'crew',cosmetics:{}};
    ids.push(id);
   }
   gameState.players.__cctv_corridor__={id:'__cctv_corridor__',name:'OUTSIDE',x:44,y:21,alive:true,role:'crew'};
   gameState.players.__cctv_in_vent__={id:'__cctv_in_vent__',name:'IN_VENT',x:14,y:28,inVent:true,alive:true,role:'impostor'};
   return ids;
  },
  securityCameraAudit(){
   const canvases=[...$('securityPanel').querySelectorAll('canvas[data-camera]')];
   const rooms=SECURITY_CAMERAS.map(c=>c.roomId);
   const rendered=canvases.map((canvas,i)=>window.StarshipCCTV?.renderFeed({canvas,room:MAP.rooms.find(r=>r.id===rooms[i]),state:gameState,camera:SECURITY_CAMERAS[i],index:i,time:performance.now(),appearance:avatarAppearance,world:window.StarshipWorldV3}));
   return {open:securityCameraIndex>=0,rooms,frameSizes:canvases.map(c=>[c.width,c.height]),rendered};
  },
  prepareSosButton(){const p=gameState?.players?.[playerId],cafe=MAP.rooms.find(q=>q.id==='cafeteria');if(!p||!cafe)throw new Error('No se puede preparar el botón SOS');p.alive=true;p.inVent=false;p.x=cafe.x+cafe.w/2;p.y=cafe.y+cafe.h/2+.22;/* Harness only: exercise SOS after its real twenty-second lockout. */gameState.createdAt=Date.now()-21000;gameState.startedAt=gameState.createdAt;gameState.emergencyUsed={};return {x:p.x,y:p.y}},
  prepareReportBody(){const p=gameState?.players?.[playerId];if(!p)throw new Error('No existe jugador local');p.alive=true;p.inVent=false;gameState.phase='playing';gameState.meeting=null;const id='__dead_body_test__';gameState.players[id]={id,alive:false,expelled:false,x:p.x+2,y:p.y};return id},
  prepareTask(type){
   const station=MAP.tasks.find(t=>t.type===type);
   const p=gameState?.players?.[playerId];
   if(!station||!p)throw new Error('No se puede preparar la tarea '+type);
   const id=station.id+'_online_assignment';
   p.tasks=[{id,name:station.name,room:station.room,stationId:station.id}];
   p.done=[];p.x=station.x;p.y=station.y;gameState.required=999;
   return id;
  },
  taskDone(id){return !!gameState?.players?.[playerId]?.done?.includes(id)},
  tryStartTask(){startTask()},
  playerState(){const p=gameState?.players?.[playerId];return p?{x:p.x,y:p.y,alive:p.alive,done:p.done?.length||0}:null},prepareEmergencyMeeting(){const p=gameState?.players?.[playerId],cafe=MAP.rooms.find(q=>q.id==='cafeteria');if(!p||!cafe)throw new Error('No existe el jugador local o la cafetería');p.alive=true;p.inVent=false;p.ventId=null;p.x=cafe.x+cafe.w/2;p.y=cafe.y+cafe.h/2+.22;gameState.phase='playing';gameState.meeting=null;gameState.createdAt=Date.now()-21000;gameState.emergencyUsed={};return {alive:p.alive,inVent:p.inVent,phase:gameState.phase}},
  prepareRepair(type){const ids={lights:'electrical_wires',reactor:'reactor_start',comms:'comms_fix',o2:'o2_filter',doors:'admin_card'},station=MAP.repairs.find(r=>r.id===ids[type]),p=gameState?.players?.[playerId];if(!station||!p)throw new Error('No se puede preparar la reparación '+type);p.role='crew';p.alive=true;p.x=station.x;p.y=station.y;gameState.sabotage={active:true,type,target:station.id,endsAt:0};updateTasks();return station.type},
  prepareVent(id){const v=MAP.vents.find(x=>x.id===id),p=gameState?.players?.[playerId];if(!v||!p)throw new Error('No se puede preparar el conducto '+id);p.role='impostor';p.alive=true;p.inVent=false;p.ventId=null;p.x=v.x;p.y=v.y;$('vent').classList.remove('hidden');return v.room},
  ventPlayerState(){const p=gameState?.players?.[playerId];return p?{inVent:!!p.inVent,ventId:p.ventId||null}:null},
  ventTargets(){return ventTargetButtons.map(t=>({id:t.id,action:t.action,x:t.x,y:t.y,w:t.w,h:t.h}))},
  allowEmergency(){gameState=gameState||{};gameState.createdAt=Date.now()-21000;gameState.emergencyUsed=gameState.emergencyUsed||{};delete gameState.emergencyUsed[playerId];return true},
  sabotageActive(){return !!gameState?.sabotage?.active},
  geometryAudit(){
   const overlaps=[];for(let i=0;i<MAP.rooms.length;i++)for(let j=i+1;j<MAP.rooms.length;j++){const a=MAP.rooms[i],b=MAP.rooms[j];if(a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y)overlaps.push([a.id,b.id])}
   return {rooms:MAP.rooms.length,corridors:MAP.corridors.length,vents:MAP.vents.length,roomOverlaps:overlaps,obstacles:MAP.obstacles.length};
  },
  collisionProbe(x,y){return {walkable:canWalk(Number(x),Number(y)),furniture:collidesFurniture(Number(x),Number(y))}},
  spawnAudit(count=15){const pts=getCafeteriaSpawnPoints(Math.max(1,Math.min(15,Number(count)||15)));return {points:pts,minimumDistance:Math.min(...pts.flatMap((p,i)=>pts.slice(i+1).map(q=>Math.hypot(p.x-q.x,p.y-q.y)))),walkable:pts.every(p=>canWalk(p.x,p.y)),centerExcluded:pts.every(p=>Math.hypot(p.x-61,p.y-35)>3.4)}},
  shadowProbe(x,y,radius=6.7){const pts=visibilityPolygon(Number(x),Number(y),Number(radius));return {segments:MAP_OCCLUSION_SEGMENTS.length,points:pts.length,occludedRays:pts.filter(q=>Math.hypot(q[0]-Number(x),q[1]-Number(y))<Number(radius)-.12).length}},
  shadowGeometryAudit(){return shadowGeometryAudit()},
  doorAccessAudit(){
   const blocked=[];
   for(const r of MAP.rooms)for(const d of r.doors||[]){
    const along=d.offset*(d.side==='top'||d.side==='bottom'?r.w:r.h);
    const x=d.side==='left'?r.x-.55:d.side==='right'?r.x+r.w+.55:r.x+along;
    const y=d.side==='top'?r.y-.55:d.side==='bottom'?r.y+r.h+.55:r.y+along;
    const insideX=d.side==='left'?r.x+.55:d.side==='right'?r.x+r.w-.55:r.x+along;
    const insideY=d.side==='top'?r.y+.55:d.side==='bottom'?r.y+r.h-.55:r.y+along;
    if(!canWalk(x,y)||!canWalk(insideX,insideY))blocked.push({room:r.id,side:d.side});
   }
   return {tested:MAP.rooms.reduce((n,r)=>n+(r.doors||[]).length,0),blocked};
  },
  ventNetwork(){return MAP.vents.map(v=>({id:v.id,room:v.room,links:[...v.links]}))},
  expireSabotage(type){const p=gameState?.players?.[playerId]||{id:playerId,name:'Tester',cosmetics:{}};p.role='impostor';p.alive=true;soloMode=true;isHost=true;gameState={phase:'playing',players:{[playerId]:p},sabotage:{active:true,type,endsAt:Date.now()-1}};$('end').classList.add('hidden');processSabotage();return {phase:gameState.phase,winner:gameState.winner,active:!!gameState.sabotage?.active}}
 };
}
let cameraIntro=null,cameraIntroPlayed=true;
function beginCameraIntro(){cameraIntro=null;cameraIntroPlayed=true;}

const randCode=()=>Array.from({length:6},()=> 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random()*32)]).join('');
const randDigits=()=>String(Math.floor(100+Math.random()*900));
let securityCameraIndex=-1;
const SECURITY_CAMERAS=[{name:'CAFETERÍA',roomId:'cafeteria'},{name:'ADMINISTRACIÓN',roomId:'admin'},{name:'OXÍGENO',roomId:'oxygen'},{name:'REACTOR',roomId:'reactor'}];
function createO2Codes(){const admin=randDigits();let oxygen=randDigits();while(oxygen===admin)oxygen=randDigits();return{admin,oxygen};}
function activeRepairStations(){const s=gameState?.sabotage;if(!s?.active)return [];return MAP.repairs.filter(r=>s.type==='o2'?['o2_admin','o2_room'].includes(r.id)&&!s.completedStations?.includes(r.id):s.type==='reactor'?['reactor_start','reactor_aux'].includes(r.id):r.id===s.target)}

function openO2CodeGame(station){openRepairTerminal(station);}
function openReactorHandGame(station){openRepairTerminal(station||MAP.repairs.find(s=>s.id==='reactor_start'));}
const say=(t,bad=false)=>{$('status').textContent=t;$('status').style.borderColor=bad?'#a64b59':'#31536b'};
const toast=t=>{$('toast').textContent=t;$('toast').style.display='block';setTimeout(()=>$('toast').style.display='none',2200)};
const clean=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function createRoom(){if(v4Busy)return;v4Busy=true;$('create').disabled=true;try{makeMe();const r=await authority('create',{settings:{...v4Settings,maxPlayers:Number($('max').value)||15,impostors:Number($('imps').value)||1}});await enterAuthorityRoom(r)}catch(e){say(e.message,true)}finally{v4Busy=false;$('create').disabled=false}}
async function joinRoom(){if(v4Busy)return;v4Busy=true;$('join').disabled=true;try{makeMe();const code=$('code').value.trim().toUpperCase();const r=await authority('join',{code});await enterAuthorityRoom(r)}catch(e){say(e.message,true)}finally{v4Busy=false;$('join').disabled=false}}
function makeMe(){applyMonguitoColor();if(!authUser?.$id)throw new Error('Inicia sesión o entra como invitado antes de jugar.');playerId=authUser.$id;me={id:playerId,name:$('name').value.trim().slice(0,16)||'Tripulante',color:$('color').value,cosmetics:getLoadout(),x:SPAWN_X,y:SPAWN_Y,alive:true,ready:true,role:'crew',done:[]}}


let pollInFlight=false;async function pollRoom(){if(pollInFlight||!roomId||soloMode)return;pollInFlight=true;try{await authority('sync',{code:roomId,position:networkPosition()});v4LastSuccess=Date.now();setConnectionState('online');}catch(e){setConnectionState('reconnecting');if(e.status===403||e.status===404){clearTimeout(poll);poll=null;toast(e.message);return}}finally{pollInFlight=false;if(roomId&&!soloMode)poll=setTimeout(pollRoom,document.hidden?2500:900+Math.random()*120)}}
function avatarAppearance(q){return window.StarshipVisual.appearance(q||{},SHOP_ITEMS)}
function refreshUniversalHero(){const hero=$('heroMonguito');if(!hero)return;let holder=hero.querySelector('.universal-hero');if(!holder){holder=document.createElement('div');holder.className='universal-hero';hero.appendChild(holder)}holder.innerHTML=window.StarshipVisual.svg(avatarAppearance({color:$('color')?.value||'#e85d75',cosmetics:getLoadout(),name:'MONGUITO'}),{motion:'idle'})}
let lobbyLastChatStamp='';
function renderLobbyChat(){
 const log=$('lobbyChatLog');if(!log)return;
 const entries=players.flatMap(p=>(p.chat||[]).filter(m=>m&&Number.isFinite(Number(m.at))&&typeof m.text==='string').map(m=>({name:p.name,color:p.color,at:m.at,text:m.text}))).sort((a,b)=>a.at-b.at).slice(-45);
 const key=entries.map(x=>x.at+'-'+x.name+'-'+x.text).join('|');if(key===lobbyLastChatStamp)return;lobbyLastChatStamp=key;
 const stickBottom=log.scrollHeight-log.scrollTop-log.clientHeight<60;
 log.innerHTML=entries.length?entries.map(m=>'<div class="lobby-chat-message"><span class="lobby-chat-avatar" style="--chat-color:'+(/^#[\da-f]{6}$/i.test(m.color)?m.color:'#77bbcc')+'"></span><span><b>'+clean(m.name)+'</b><small>'+new Date(Number(m.at)).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})+'</small><em>'+clean(m.text)+'</em></span></div>').join(''):'<p class="muted">El canal está abierto. Puedes hablar con todos los jugadores de la sala.</p>';
 if(stickBottom)log.scrollTop=log.scrollHeight;
}
async function sendLobbyChat(){const input=$('lobbyChatInput'),value=input.value.trim();if(!value)return;try{await gameAction('chat',{text:value});input.value='';renderLobbyChat()}catch(e){toast(e.message)}}





let launchingMatch=false,roleRevealShown=false,gameUIStarted=false,roleRevealTimer=null;
function getCafeteriaSpawnPoints(count){
 const cafe=MAP.rooms.find(q=>q.id==='cafeteria');
 if(!cafe)return Array.from({length:count},(_,i)=>({x:SPAWN_X+Math.cos(i*2*Math.PI/Math.max(count,1))*3,y:SPAWN_Y+Math.sin(i*2*Math.PI/Math.max(count,1))*3}));
 const center={x:cafe.x+cafe.w/2,y:cafe.y+cafe.h/2};
 const minimumSeparation=1.68;
 const chosen=[];
 const safe=p=>canWalk(p.x,p.y)&&p.x>cafe.x+1&&p.x<cafe.x+cafe.w-1&&p.y>cafe.y+1&&p.y<cafe.y+cafe.h-1&&
   chosen.every(q=>Math.hypot(q.x-p.x,q.y-p.y)>=minimumSeparation);
 // A different starting angle each game / meeting; each player appears
 // randomly along the annulus surrounding the SOS table, not inside it.
 const phase=Math.random()*2*Math.PI;
 for(let i=0;i<count;i++){
  let point=null;
  for(let k=0;k<45;k++){
   const a=phase+(i+(Math.random()-.5)*.34)*2*Math.PI/Math.max(count,1)+(k%5)*.14;
   const radius=4.65+Math.random()*1.05;
   const p={x:center.x+Math.cos(a)*radius,y:center.y+Math.sin(a)*radius};
   if(safe(p)){point=p;break}
  }
  if(!point){
   // Graceful deterministic fallback: search concentric circles
   // before accepting any unsafe or overlapping location.
   outer:for(const radius of [4.7,5.8,6.7,7.6]){
    for(let k=0;k<128;k++){
     const a=phase+k*2*Math.PI/128;
     const p={x:center.x+Math.cos(a)*radius,y:center.y+Math.sin(a)*radius};
     if(safe(p)){point=p;break outer}
    }
   }
  }
  if(!point)throw new Error('No hay espacio sin solapamientos alrededor de la mesa SOS');
  chosen.push(point);
 }
 return chosen;
}
function teleportPlayersToCafeteria(){const roster=Object.values(gameState?.players||{}),points=getCafeteriaSpawnPoints(roster.length);roster.forEach((q,i)=>{const point=points[i]||points[0]||{x:SPAWN_X,y:SPAWN_Y};q.x=point.x;q.y=point.y;q._targetX=point.x;q._targetY=point.y;q._renderVx=0;q._renderVy=0;q.inVent=false;q.ventId=null;q._moving=false});}
async function startMatch(){try{await gameAction('settings',{settings:{...v4Settings,maxPlayers:Number($('max').value)||15,impostors:Number($('imps').value)||1}});await gameAction('start')}catch(e){toast(e.message)}}

function showRoleReveal(){if(roleRevealShown)return;const mine=gameState?.players?.[playerId];if(!mine)return;roleRevealShown=true;const impostor=mine.role==='impostor',team=Object.values(gameState.players).filter(q=>impostor?q.role==='impostor':true);
const card=(q,index)=>{const a=avatarAppearance(q),c=q.cosmetics||{},gear=SHOP_ITEMS.find(i=>i.id===c.arriba),skin=SHOP_ITEMS.find(i=>i.id===c.skin),top=SHOP_ITEMS.find(i=>i.id===c.torso),legs=SHOP_ITEMS.find(i=>i.id===c.abajo);return '<div class="role-card" style="--draw-delay:'+index*.12+'s"><div class="role-card-avatar">'+window.StarshipVisual.svg(a,{motion:'idle'})+'</div><span class="role-card-name">'+clean(q.name||'TRIPULANTE')+'</span><small class="role-card-loadout">'+clean(skin?.name||'Uniforme estándar')+(top?' · '+clean(top.name):'')+(legs?' · '+clean(legs.name):'')+(gear?' · '+clean(gear.name):'')+'</small></div>'};
$('roleReveal').classList.toggle('impostor',impostor);$('roleRevealTitle').textContent=impostor?'IMPOSTOR':'TRIPULANTE';$('roleRevealSubtitle').textContent=impostor?'Sabotea la nave. Solo ves la identidad de otros impostores.':'Todos los participantes están aquí. No se revela quién es el impostor.';$('roleRevealCrew').innerHTML=team.map(card).join('');$('roleReveal').querySelectorAll('.western-saloon,.western-dust,.western-tumbleweed').forEach(n=>n.remove());$('roleRevealTimer').textContent='5';$('roleReveal').classList.remove('hidden');window.StarshipCinematics?.role(impostor);if(roleRevealTimer)clearInterval(roleRevealTimer);let left=5;roleRevealTimer=setInterval(()=>{left--;$('roleRevealTimer').textContent=String(Math.max(0,left));if(left<=0){clearInterval(roleRevealTimer);roleRevealTimer=null;$('roleReveal').classList.add('hidden')}},1000)}
function startGameUI(){const exploration=!!gameState?.exploration;const alreadyStarted=gameUIStarted&&$('game')&&!$('game').classList.contains('hidden');if(alreadyStarted){$('kill').classList.toggle('hidden',exploration||gameState?.players?.[playerId]?.role!=='impostor');$('sabotage').classList.toggle('hidden',exploration||gameState?.players?.[playerId]?.role!=='impostor');$('vent').classList.toggle('hidden',exploration||gameState?.players?.[playerId]?.role!=='impostor');updateTasks();return}gameUIStarted=true;if(!exploration){beginCameraIntro();showRoleReveal()}else{cameraIntro=null;$('roleReveal').classList.add('hidden')}const joystick=$('joystick'),touchDevice=(navigator.maxTouchPoints||0)>0||('ontouchstart' in window);if(joystick&&touchDevice){joystick.style.cssText='display:block!important;visibility:visible!important;opacity:1!important;position:fixed!important;left:max(22px,env(safe-area-inset-left))!important;bottom:max(22px,env(safe-area-inset-bottom))!important;top:auto!important;right:auto!important;width:140px!important;height:140px!important;z-index:2147483000!important;pointer-events:auto!important;touch-action:none!important;';const knob=$('stick');if(knob)knob.style.cssText='position:absolute;width:48px;height:48px;left:44px;top:44px;pointer-events:none;'}$('lobby').classList.add('hidden');$('game').classList.remove('hidden');$('game').style.display='flex';$('game').style.height='100dvh';$('arena').style.cssText='position:relative;display:block;flex:1 1 auto;min-width:0;min-height:0;width:100%;height:100%;overflow:hidden';$('world').style.cssText='position:absolute;inset:0;display:block;width:100%;height:100%;min-width:1px;min-height:1px;touch-action:none';$('kill').classList.toggle('hidden',gameState?.players?.[playerId]?.role!=='impostor');$('sabotage').classList.toggle('hidden',gameState?.players?.[playerId]?.role!=='impostor');$('vent').classList.toggle('hidden',gameState?.players?.[playerId]?.role!=='impostor');requestAnimationFrame(()=>{resize();draw()});resize();if(!raf)raf=requestAnimationFrame(loop);updateTasks();try{drawMiniMap()}catch(e){console.warn(e)}}
let lastKillAnimationAt=0;function playVictimKillAnimation(){const ev=gameState?.killEvent;if(!ev||ev.victimId!==playerId||ev.at<=lastKillAnimationAt||Date.now()+v4ClockOffset-ev.at>5000)return;lastKillAnimationAt=ev.at;const attacker=gameState.players?.[ev.attackerId],victim=gameState.players?.[ev.victimId];window.StarshipCinematics?.play('kill',{actor:avatarAppearance(attacker),target:avatarAppearance(victim),key:'death:'+ev.at})}
let lastEndedMatchKey='';function finishMatch(winner){if(!gameState)return;const matchKey=(gameState.matchId||gameState.createdAt||'explore')+':'+winner;if(lastEndedMatchKey===matchKey)return;lastEndedMatchKey=matchKey;const self=gameState.players?.[playerId],victory=self?.role===winner;$('end').classList.remove('hidden');$('endTitle').textContent=tr(victory?'¡VICTORIA!':'¡DERROTA!');$('endSubtitle').textContent=tr(winner==='crew'?'La tripulación ha completado su misión.':'Los saboteadores han tomado la nave.');$('endResult').textContent=tr('Resultado guardado en tu cuenta.');window.StarshipCinematics?.result(victory,avatarAppearance(self));if(!soloMode){gameAction('rewards').then(r=>{if(r.profile)updateCoinUI()}).catch(e=>toast(e.message));}}
function processSabotage(){if(!soloMode||!gameState?.sabotage?.active)return;const sab=gameState.sabotage;if(sab.endsAt&&Date.now()>=sab.endsAt){if(['reactor','o2'].includes(sab.type))finishMatch('impostor');else sab.active=false;}}
function updateTasks(){const p=gameState?.players?.[playerId];if(!p)return;const tasks=p.role==='impostor'?(p.fakeTasks||[]):p.tasks||[],signature=JSON.stringify([p.role,p.done,tasks,gameState.sabotage?.active,gameState.sabotage?.type,gameState.completed,gameState.required]);if($('taskText').dataset.signature===signature)return;$('taskText').dataset.signature=signature;$('taskText').innerHTML=p.role==='impostor'?'<p>'+tr('Tu objetivo: sabotear y pasar desapercibido.')+'</p>'+tasks.map(t=>'<div class="task-line">○ '+clean(tr(t.name))+'<small>'+clean(tr(t.room))+'</small></div>').join(''):(gameState.sabotage?.active&&gameState.sabotage.type==='comms'?tr('COMUNICACIONES INTERFERIDAS'):(p.tasks||[]).map(t=>'<div class="task-line '+(p.done?.includes(t.id)?'task-done':'')+'">'+(p.done?.includes(t.id)?'✓':'○')+' '+clean(tr(t.name))+(t.stages>1?' · '+(t.progress||0)+'/'+t.stages:'')+'<small>'+clean(tr(t.room))+'</small></div>').join(''));const show=gameState.settings?.taskBar!=='never'&&(gameState.settings?.taskBar!=='meetings'||!!gameState.meeting);const total=soloMode?tasks.length:Number(gameState.required||0),done=soloMode?p.done.length:Number(gameState.completed||0);$('taskProgress').textContent=show?done+' / '+total:'';$('taskFill').style.width=show&&total?Math.min(100,done/total*100)+'%':'0%';}

async function moveUpdate(){return;}


async function startTask(){const p=gameState?.players?.[playerId];if(!p||p.inVent||gameState?.meeting)return;if(p.role==='impostor'){if(!p.alive)return;const t=MAP.tasks.find(q=>Math.hypot(q.x-p.x,q.y-p.y)<3);if(t){openMiniGame({id:'fake_'+t.id,name:tr('Simular tarea')+' · '+t.name},t)}return;}if(p.role!=='crew')return;const t=(p.tasks||[]).filter(t=>!p.done?.includes(t.id)).map(t=>({...t,station:MAP.tasks.find(q=>q.id===(t.stationId||t.id))})).filter(t=>t.station).sort((a,b)=>Math.hypot(a.station.x-p.x,a.station.y-p.y)-Math.hypot(b.station.x-p.x,b.station.y-p.y))[0];if(!t||Math.hypot(t.station.x-p.x,t.station.y-p.y)>3)return toast(tr('Acércate a una tarea pendiente.'));try{if(!soloMode){const r=await gameAction('task_begin',{taskId:t.id});v4TaskSession=r.taskSession;}openMiniGame(t,t.station)}catch(e){toast(e.message)}}
function openMiniGame(task,station){
 const m=$('modal');m.classList.remove('hidden');m.classList.add('task-modal');
 const title=clean(task.name),room=clean(station.room),type=station.type,gameType=({fuel:'filter',sequence:'calibrate',upload:'route',scan:'scan'}[type]||type);
 const shell=(sub,content)=>'<div class="card task-card" style="width:min(680px,94vw);max-height:88vh;overflow:auto;background:linear-gradient(145deg,#243b4d,#101d2b);border:2px solid #7894a6;box-shadow:0 0 0 5px #07131e,0 0 35px #48cbe866;color:#edfaff"><div style="display:flex;justify-content:space-between;align-items:center"><small style="color:#8ceaff;letter-spacing:2px">'+room+' · TERMINAL DE MISIÓN</small><b style="color:#f5c96d">✦ 1980</b></div><h2 style="margin:8px 0;color:#fff">'+title+'</h2><p style="color:#a9c4d4">'+sub+'</p><div id="taskBoard" style="background:radial-gradient(ellipse,#203c50,#081521);border:1px solid #45677d;border-radius:12px;padding:18px;min-height:180px">'+content+'</div><p id="taskFeedback" style="min-height:20px;color:#9ce8cb;font-weight:800"></p><button id="cancelTask" style="width:100%">CERRAR TERMINAL</button></div>';
 let finishing=false,proof=[];const taskSession=v4TaskSession;
 const finish=async()=>{if(finishing)return;finishing=true;try{
  if(String(task.id).startsWith('fake_')){m.classList.add('hidden');m.classList.remove('task-modal');return;}
  if(String(task.id).startsWith('repair_')){await finishRepair(station);}
  else if(soloMode){const p=gameState.players[playerId];if(!p.done.includes(task.id))p.done.push(task.id);updateTasks();}
  else {const wait=Math.max(0,(taskSession?.at||0)+(taskSession?.minMs||0)-(Date.now()+v4ClockOffset)+150);if(wait)await new Promise(resolve=>setTimeout(resolve,wait));const r=await gameAction('task_finish',{taskId:task.id,token:taskSession?.token,proof});if(!r.taskComplete)toast(tr('Etapa completada. Vuelve al terminal para continuar.'));}
  m.classList.add('hidden');m.classList.remove('task-modal');updateTasks();window.StarshipCinematics?.taskComplete(type);window.StarshipAudio?.play('task');
 }catch(e){toast(e.message);finishing=false;}};
 const fail=msg=>{const f=$('taskFeedback');if(f){f.style.color='#ff7c83';f.textContent=msg}};
 const ok=msg=>{const f=$('taskFeedback');if(f){f.style.color='#8cf2b7';f.textContent=msg}};
 const button=(id,label)=>'<button id="'+id+'" style="padding:12px 16px;margin:5px;border:1px solid #7fcde0;border-radius:8px;background:linear-gradient(#31566b,#142d40);color:#fff;font-weight:900">'+label+'</button>';
 let content='';
 if(gameType==='card'){
 content='<div style="display:flex;gap:18px;align-items:center;justify-content:center;flex-wrap:wrap"><div id="idCard" draggable="true" style="width:190px;padding:14px;background:linear-gradient(135deg,#fff1c5,#b9c7c8);color:#172b38;border:3px solid #d5e8ed;border-radius:9px;touch-action:none;cursor:grab"><b>STARSHIP · ID</b><div style="font-size:34px">◉</div><b>'+clean(me?.name||'CREWMATE')+'</b><div style="font-size:11px">CREW ID · 0815</div><div style="height:8px;background:#17212b;margin-top:10px"></div></div><div id="cardSlot" style="width:190px;height:110px;border:2px dashed #8ceaff;border-radius:10px;display:grid;place-items:center;color:#8ceaff">ARRASTRA AQUÍ<br>EL CARNÉ</div></div><p style="text-align:center">Arrastra la tarjeta horizontalmente durante 0,4 a 1,5 segundos, o usa el botón de lectura</p><div style="height:9px;background:#152b3a;border-radius:9px;overflow:hidden"><div id="swipeMeter" style="height:100%;width:0;background:#66e2ae"></div></div><button id="cardAssist" class="mission-aux-button">▶ INICIAR LECTURA ASISTIDA (1 SEGUNDO)</button>';
 }else if(gameType==='wires'){
 const colors=[['ROJO','#f05e68'],['AZUL','#58a9f2'],['AMARILLO','#f1ce58'],['ROSA','#e78bc8']];
 content='<p>'+tr('Conecta cada cable con el terminal del mismo color.')+'</p><div class="wires-pairs4"><div>'+colors.map((v,i)=>'<button data-wire-left="'+i+'" style="--wire:'+v[1]+'">● '+tr(v[0])+'</button>').join('')+'</div><div>'+[2,0,3,1].map(i=>'<button data-wire-right="'+i+'" style="--wire:'+colors[i][1]+'">'+tr(colors[i][0])+' ●</button>').join('')+'</div></div><small id="wireCount">0 / 4</small>';
 }else if(gameType==='route'){
 content='<p>Arrastra la nave por los cinco puntos de control en orden.</p><div id="routeGrid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;max-width:340px;margin:auto">'+[0,1,2,3,4,5,6,7,8].map(i=>'<button data-route="'+i+'" style="min-height:48px">'+(i===0?'🚀':i===8?'◎':'✦')+'</button>').join('')+'</div><b id="routeCount">PUNTO 1 / 5</b>';
 }else if(gameType==='filter'){
 content='<p>Retira los residuos del filtro y arrástralos al conducto de extracción.</p><div style="display:flex;justify-content:space-around;gap:12px;align-items:center"><div id="debris" style="display:grid;grid-template-columns:repeat(3,48px);gap:9px">'+Array.from({length:6},(_,i)=>'<button data-debris="'+i+'" style="font-size:24px">🍂</button>').join('')+'</div><div id="ventDrop" style="border:2px dashed #76e6d0;border-radius:50%;width:100px;height:100px;display:grid;place-items:center;color:#76e6d0">VENT<br>⬇</div></div><small id="debrisCount">6 RESIDUOS</small>';
 }else if(gameType==='scan'){
 content='<div class="medscan-console"><div class="scan-silhouette"><div class="scan-head"></div><div class="scan-torso"><span class="scan-heart">♥</span></div><div class="scan-legs"></div></div><div class="scan-controls"><b>DIAGNÓSTICO BIOMÉTRICO</b><p>Realiza los 3 escaneos: cabeza, corazón y piernas. Pulsa cada botón en orden.</p><div class="scan-progress"><i id="scanProgress"></i></div>'+['CABEZA','CORAZÓN','PIERNAS'].map((v,i)=>button('scanPart'+i,'◉ ESCANEAR '+v)).join('')+'<span id="scanReadout">ESPERANDO AL PACIENTE...</span></div></div>';
 }else if(gameType==='cipher'){
 content='<div class="cipher-console"><div class="cipher-secret">CÓDIGO DEL SISTEMA <strong id="cipherCode">◆ ◉ ▲</strong></div><p>Reproduce los tres símbolos en el mismo orden. Cada pulsación registra el siguiente símbolo.</p><div class="mission-stages" id="cipherSlots">□ □ □</div>'+[['◆','RUMBO'],['◉','ÓRBITA'],['▲','POTENCIA']].map(([sym,label])=>'<button data-cipher="'+sym+'" class="mission-dial">'+sym+'<small>'+label+'</small></button>').join('')+'</div>';
 }else if(gameType==='pulse'){
 content='<div class="pulse-console"><h3>ESTABILIZACIÓN O₂</h3><div class="pulse-spectrum">'+Array.from({length:16},(_,i)=>'<i style="--i:'+i+'"></i>').join('')+'</div><p>Toca los tres filtros en orden para restablecer el flujo de oxígeno.</p><div class="mission-stages" id="pulseReadout">0 / 3 FILTROS</div>'+['VÁLVULA A','VÁLVULA B','VÁLVULA C'].map((x,i)=>button('pulseValve'+i,'◉ '+x)).join('')+'</div>';
 }else if(gameType==='sort'){
 content='<div class="cargo-console"><h3>CLASIFICADOR DE CARGA</h3><p>Selecciona el contenedor correcto según el símbolo que aparece en la pantalla.</p><div class="cargo-target" id="cargoTarget">◈</div><div class="mission-stages" id="cargoCount">0 / 4 CAJAS</div>'+[['◈','MINERALES'],['✚','SUMINISTROS'],['⬡','EQUIPO']].map(([sym,label])=>'<button data-cargo="'+sym+'" class="mission-dial">'+sym+'<small>'+label+'</small></button>').join('')+'</div>';
 }else if(gameType==='frequency'){
 content='<div class="frequency-console"><h3>RECALIBRACIÓN DE SEÑAL</h3><p>Mueve el control hasta que coincida con cada frecuencia indicada. Pulsa VALIDAR cuando el indicador esté alineado.</p><div class="frequency-display"><span>OBJETIVO <b id="freqTarget">35</b> MHz</span><strong id="freqValue">50 MHz</strong></div><input id="freqSlider" aria-label="Frecuencia" type="range" min="0" max="100" value="50"><div class="mission-stages" id="freqCount">0 / 3 FRECUENCIAS</div>'+button('freqSubmit','✓ VALIDAR FRECUENCIA')+'</div>';
 }else if(gameType==='cells'){
 content='<div class="cells-console"><h3>CELDAS DEL REACTOR</h3><p>Activa cada celda cuando su energía alcance el intervalo seguro (4 a 6). Un error reinicia solo esa celda.</p><div class="cells-grid">'+[0,1,2].map(i=>'<div class="cell"><div class="cell-energy" id="cellEnergy'+i+'">0</div>'+button('cellCharge'+i,'CARGAR CELDA '+(i+1))+'</div>').join('')+'</div><div class="mission-stages" id="cellsCount">0 / 3 ESTABLES</div></div>';
 }else if(gameType==='calibrate'){
 content='<p>Pulsa DETENER cuando la aguja entre en la zona verde. Sincroniza los tres módulos.</p>'+[0,1,2].map(i=>'<div style="margin:14px 0"><div style="display:flex;justify-content:space-between"><b>MÓDULO '+(i+1)+'</b><span id="calState'+i+'">EN ESPERA</span></div><div style="height:12px;background:#203647;border-radius:8px;position:relative;overflow:hidden"><div style="position:absolute;left:42%;width:16%;height:100%;background:#4bd99b;opacity:.8"></div><div id="needle'+i+'" style="position:absolute;left:0;width:5px;height:100%;background:#fff;box-shadow:0 0 8px #fff"></div></div>'+button('cal'+i,'DETENER AGUJA')+'</div>').join('');
 }
 m.innerHTML=shell(gameType==='card'?'Desliza la tarjeta a velocidad correcta.':gameType==='wires'?'Empareja los cuatro circuitos eléctricos.':gameType==='route'?'Establece la ruta de navegación.':gameType==='filter'?'Limpia por completo el filtro de oxígeno.':gameType==='scan'?'Escanea cabeza, corazón y piernas en orden.':gameType==='cipher'?'Copia el código de símbolos de acceso.':gameType==='pulse'?'Activa las válvulas de oxígeno en orden.':gameType==='sort'?'Clasifica los cuatro contenedores estelares.':gameType==='frequency'?'Sintoniza tres señales con el control deslizante.':gameType==='cells'?'Carga tres celdas del núcleo hasta 4–6.':'Sincroniza los tres distribuidores.',content);
 window.StarshipCinematics?.taskOpen(gameType);$('cancelTask').onclick=()=>{m.classList.add('hidden');m.classList.remove('task-modal')};
 if(gameType==='card'){
 const card=$('idCard'),slot=$('cardSlot');
 const assist=$('cardAssist');assist.onclick=()=>{assist.disabled=true;assist.textContent='LEYENDO DATOS DEL CARNÉ…';$('swipeMeter').style.width='100%';setTimeout(()=>{if(!m.classList.contains('hidden')){slot.textContent='IDENTIDAD VERIFICADA ✓';ok('LECTURA CORRECTA');proof=[900];finish()}},1050)};let down=0,startX=0,moved=false;card.addEventListener('pointerdown',e=>{down=performance.now();startX=e.clientX;moved=false;card.setPointerCapture(e.pointerId)});card.addEventListener('pointermove',e=>{if(!down)return;if(Math.abs(e.clientX-startX)>12)moved=true});card.addEventListener('pointerup',()=>{const elapsed=performance.now()-down;down=0;if(!moved){fail('Debes deslizar, no solo tocar.');return}if(elapsed>350&&elapsed<1500){slot.style.background='#174b3e';slot.textContent='IDENTIDAD VERIFICADA ✓';$('swipeMeter').style.width='100%';ok('LECTURA CORRECTA');proof=[elapsed];setTimeout(finish,650)}else{fail(elapsed<=350?'Demasiado rápido.':'Demasiado lento.');card.animate([{transform:'translateX(0)'},{transform:'translateX(-12px)'},{transform:'translateX(0)'}],250)}})
 }else if(gameType==='wires'){
 let selected=null;const left=[...m.querySelectorAll('[data-wire-left]')],right=[...m.querySelectorAll('[data-wire-right]')];left.forEach(b=>b.onclick=()=>{selected=Number(b.dataset.wireLeft);left.forEach(x=>x.classList.toggle('selected',x===b))});right.forEach(b=>b.onclick=()=>{if(selected===null)return;if(Number(b.dataset.wireRight)!==selected)return fail(tr('Terminal incorrecto. Prueba con el mismo color.'));const source=left.find(x=>Number(x.dataset.wireLeft)===selected);source.disabled=b.disabled=true;source.classList.remove('selected');source.textContent+=' ✓';b.textContent+=' ✓';proof.push(selected);selected=null;$('wireCount').textContent=proof.length+' / 4';if(proof.length===4){ok(tr('CIRCUITOS RESTABLECIDOS'));setTimeout(finish,500)}});
 }else if(gameType==='route'){
 const seq=[0,1,2,5,8];let n=0;m.querySelectorAll('[data-route]').forEach(b=>b.onclick=()=>{if(+b.dataset.route===seq[n]){b.disabled=true;b.style.background='#17634d';proof.push(Number(b.dataset.route));n++;$('routeCount').textContent='PUNTO '+Math.min(n+1,5)+' / 5';if(n===5){ok('RUTA ESTABLECIDA');setTimeout(finish,550)}}else{n=0;proof=[];fail('Te has salido de la trayectoria. Vuelve al inicio.');m.querySelectorAll('[data-route]').forEach(x=>{x.disabled=false;x.style.background=''})}})}
 else if(gameType==='filter'){
 let n=6;m.querySelectorAll('[data-debris]').forEach(b=>b.onclick=()=>{proof.push(Number(b.dataset.debris));b.remove();n--;$('debrisCount').textContent=n+' RESIDUOS';if(!n){$('ventDrop').style.background='#155440';ok('FILTRO LIMPIO');setTimeout(finish,550)}})
 }else if(gameType==='scan'){
 let index=0;const labels=['CABEZA','CORAZÓN','PIERNAS'];
 [0,1,2].forEach(i=>$('scanPart'+i).onclick=()=>{
  if(index!==i){fail('Sigue el orden: '+labels[index]);return}
  proof.push(i);$('scanPart'+i).disabled=true;$('scanPart'+i).textContent='✓ '+labels[i]+' VERIFICADO';index++;
  $('scanProgress').style.width=index/3*100+'%';$('scanReadout').textContent=index<3?'SIGUIENTE: '+labels[index]:'TODOS LOS SIGNOS VITALES ESTABLES';
  if(index===3){ok('DIAGNÓSTICO APROBADO');setTimeout(finish,650)}
 });
 }else if(gameType==='cipher'){
 const target=['◆','◉','▲'];let index=0;
 m.querySelectorAll('[data-cipher]').forEach(b=>b.onclick=()=>{
  const val=b.dataset.cipher;if(val===target[index]){proof.push(val);index++;$('cipherSlots').textContent=target.slice(0,index).join(' ')+' '+Array(3-index).fill('□').join(' ');if(index===3){ok('ACCESO CONCEDIDO');setTimeout(finish,550)}}
  else{index=0;proof=[];$('cipherSlots').textContent='□ □ □';fail('Código incorrecto. Repite la secuencia.')}
 });
 }else if(gameType==='pulse'){
 let i=0;[0,1,2].forEach(k=>$('pulseValve'+k).onclick=()=>{
  if(k!==i)return fail('Activa primero la VÁLVULA '+['A','B','C'][i]);
  proof.push(k);$('pulseValve'+k).disabled=true;$('pulseValve'+k).textContent='✓ VÁLVULA '+['A','B','C'][k];i++;
  $('pulseReadout').textContent=i+' / 3 FILTROS';
  if(i===3){ok('OXÍGENO ESTABILIZADO');setTimeout(finish,550)}
 });
 }else if(gameType==='sort'){
 const sequence=['◈','✚','⬡','◈'];let i=0;
 m.querySelectorAll('[data-cargo]').forEach(b=>b.onclick=()=>{
  if(b.dataset.cargo!==sequence[i])return fail('Contenedor incorrecto. Comprueba el símbolo.');
  proof.push(b.dataset.cargo);i++;$('cargoCount').textContent=i+' / 4 CAJAS';$('cargoTarget').textContent=sequence[i]||'✓';
  if(i===4){ok('CARGA CLASIFICADA');setTimeout(finish,600)}
 });
 }else if(gameType==='frequency'){
 const targets=[35,70,20];let i=0;
 $('freqSlider').oninput=e=>$('freqValue').textContent=e.target.value+' MHz';
 $('freqSubmit').onclick=()=>{
  if(Math.abs(Number($('freqSlider').value)-targets[i])>5)return fail('Ajusta el control a ±5 MHz de '+targets[i]);
  proof.push(Number($('freqSlider').value));i++;$('freqCount').textContent=i+' / 3 FRECUENCIAS';
  if(i===3){ok('COMUNICACIÓN RESTABLECIDA');setTimeout(finish,600)}
  else{$('freqTarget').textContent=String(targets[i]);$('freqSlider').value='50';$('freqValue').textContent='50 MHz'}
 };
 }else if(gameType==='cells'){
 const charge=[0,0,0],completed=[false,false,false];let total=0;
 [0,1,2].forEach(i=>$('cellCharge'+i).onclick=()=>{
  if(completed[i])return;charge[i]++;
  if(charge[i]>6){charge[i]=0;fail('Sobrecarga: celda '+(i+1)+' reiniciada')}
  $('cellEnergy'+i).textContent=String(charge[i]);
  if(charge[i]>=4&&charge[i]<=6){proof[i]=charge[i];completed[i]=true;$('cellCharge'+i).disabled=true;$('cellCharge'+i).textContent='✓ CELDA ESTABLE';total++;$('cellsCount').textContent=total+' / 3 ESTABLES';if(total===3){ok('NÚCLEO ESTABILIZADO');setTimeout(finish,550)}}
 });
 }else if(gameType==='calibrate'){
 let stage=0,angle=0;const needles=[0,1,2].map((_,i)=>({el:$('needle'+i),pos:0}));const timer=setInterval(()=>{angle=(angle+2.7)%100;needles.forEach((n,i)=>{if(i<stage)return;n.pos=angle;n.el.style.left=angle+'%'})},35);
 needles.forEach((n,i)=>$('cal'+i).onclick=()=>{if(i!==stage)return;const pos=angle%100;if(pos>=42&&pos<=58){proof.push(pos);$('calState'+i).textContent='SINCRONIZADO ✓';$('calState'+i).style.color='#7cf0b0';stage++;if(stage===3){clearInterval(timer);ok('DISTRIBUIDOR CALIBRADO');setTimeout(finish,600)}}else fail('Aguja fuera de la zona verde. Inténtalo de nuevo.')});
 $('cancelTask').onclick=()=>{clearInterval(timer);m.classList.add('hidden');m.classList.remove('task-modal')};
 }
}async function eliminate(){const p=gameState?.players?.[playerId];if(!p)return;const target=Object.values(gameState.players).filter(q=>q.id!==playerId&&q.alive&&!q.inVent&&q.role!=='impostor'&&window.StarshipRules.lineClear(p,q,gameState.sabotage)).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];if(!target)return;try{await gameAction('kill',{targetId:target.id})}catch(e){toast(e.message)}}
let ventFocus=null,ventTargetButtons=[];

function launchVentCamera(from,to,duration=920){
 ventFocus={from:{x:from.x,y:from.y},to:{x:to.x,y:to.y},start:performance.now(),duration};
}
async function exitVentAt(v){if(!v)return;try{if(soloMode){const p=gameState.players[playerId];p.inVent=false;p.ventId=null;p.x=v.x+1.16;p.y=v.y}else await gameAction('vent',{ventId:v.id,exit:true})}catch(e){toast(e.message)}}
async function travelVentTo(id){const p=gameState?.players?.[playerId],from=MAP.vents.find(v=>v.id===p?.ventId),to=MAP.vents.find(v=>v.id===id);if(!p?.inVent||!from||!to||!from.links.includes(id)||ventFocus)return;try{if(!soloMode)await gameAction('vent',{ventId:id});else{p.ventId=id;p.x=to.x;p.y=to.y;}launchVentCamera(from,to,1000);setTimeout(()=>{ventFocus=null;exitVentAt(to)},1050)}catch(e){toast(e.message)}}
async function useVent(){const p=gameState?.players?.[playerId];if(!p?.alive||p.role!=='impostor'||gameState.meeting||ventFocus)return;const v=p.inVent?MAP.vents.find(v=>v.id===p.ventId):MAP.vents.map(v=>({...v,d:Math.hypot(v.x-p.x,v.y-p.y)})).sort((a,b)=>a.d-b.d)[0];if(!v||!p.inVent&&v.d>1.75)return toast(tr('Acércate a un conducto.'));try{if(soloMode){p.inVent=!p.inVent;p.ventId=p.inVent?v.id:null;draw()}else await gameAction('vent',{ventId:v.id,exit:p.inVent});window.StarshipAudio?.play('vent')}catch(e){toast(e.message)}}
function drawVentTargets(w,h,view){
 ventTargetButtons=[];
 const p=gameState?.players?.[playerId];if(!p?.alive||!p.inVent||ventFocus||gameState?.meeting)return;
 const current=MAP.vents.find(v=>v.id===p.ventId);if(!current)return;
 const others=MAP.vents.filter(v=>(current.links||[]).includes(v.id));
 ctx.save();ctx.setTransform(view.dpr,0,0,view.dpr,0,0);
 ctx.textAlign='center';ctx.textBaseline='middle';
 ctx.fillStyle='#071322db';ctx.strokeStyle='#ff647c';ctx.lineWidth=2;
 const bw=Math.min(245,Math.max(155,w*.28)),bh=58;
 const list=[...others.map((v,i)=>({v,label:'➤ '+v.room,action:'travel',id:v.id})),{v:current,label:'SALIR AQUÍ [G]',action:'exit',id:current.id}];
 list.forEach((item,i)=>{
  const mobile=w<650,xx=mobile?w/2:w/2+(i-(list.length-1)/2)*Math.min(bw+12,w/list.length);
  const x=Math.max(7,Math.min(w-bw-7,xx-bw/2)),
    y=mobile?Math.min(h*.35+i*(bh+8),h-bh-24):Math.min(h*.57,h-170);
  ctx.save();ctx.shadowColor='#ff3248';ctx.shadowBlur=12;
  ctx.fillStyle='#220c1cec';ctx.strokeStyle='#ff5a70';ctx.beginPath();ctx.roundRect(x,y,bw,bh,11);ctx.fill();ctx.stroke();
  ctx.shadowBlur=0;ctx.fillStyle='#ff8c9a';ctx.font='900 '+(w<560?11:13)+'px system-ui';ctx.fillText(item.label,x+bw/2,y+bh/2);
  const ang=Math.atan2(item.v.y-current.y,item.v.x-current.x);
  if(item.action==='travel'){ctx.translate(x+21,y+bh/2);ctx.rotate(ang);ctx.fillStyle='#ff3b50';ctx.beginPath();ctx.moveTo(13,0);ctx.lineTo(-8,-12);ctx.lineTo(-8,12);ctx.closePath();ctx.fill()}
  ctx.restore();
  ventTargetButtons.push({x,y,w:bw,h:bh,...item});
 });
 ctx.font='900 11px system-ui';ctx.fillStyle='#ffdce4';ctx.fillText('RED DE DUCTOS · ELIGE UNA FLECHA ROJA PARA VIAJAR',w/2,h-Math.max(151,Math.min(210,h*.18+66)));
 ctx.restore();
}

function meetingPlayerColor(id){const player=gameState?.players?.[id],skin=SHOP_ITEMS?.find(item=>item.id===(player?.cosmetics||{}).skin),value=skin?.suit||player?.color||'#e85d75';return /^#[0-9a-f]{6}$/i.test(value)?value:'#e85d75'}
function meetingSecondsLeft(){return Math.max(0,Math.ceil(((gameState?.meeting?.endsAt||Date.now())-Date.now())/1000))}


async function meeting(isReport=false,bodyId=null){if(soloMode)return toast(tr('Las reuniones necesitan otros jugadores.'));try{await gameAction(isReport?'report':'meeting',isReport?{targetId:bodyId}:{})}catch(e){toast(e.message)}}
function drawGameAccessory(ctx,x,y,skin){ctx.save();ctx.translate(x,y);ctx.lineWidth=2;ctx.strokeStyle='#18202b';ctx.fillStyle='#f2c94c';if(skin==='crown'){ctx.beginPath();ctx.moveTo(-10,-2);ctx.lineTo(-9,-13);ctx.lineTo(-3,-7);ctx.lineTo(0,-16);ctx.lineTo(4,-7);ctx.lineTo(10,-13);ctx.lineTo(10,-2);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle='#e95d75';ctx.fillRect(-2,-5,4,3)}else if(skin==='antenna'){ctx.strokeStyle='#d7e8f2';ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,-15);ctx.stroke();ctx.fillStyle='#ffd45c';ctx.beginPath();ctx.arc(0,-17,3.5,0,Math.PI*2);ctx.fill();ctx.stroke()}else if(skin==='halo'){ctx.strokeStyle='#ffe58a';ctx.lineWidth=3;ctx.shadowColor='#ffe58a';ctx.shadowBlur=8;ctx.beginPath();ctx.ellipse(0,-11,10,3.5,-.12,0,Math.PI*2);ctx.stroke()}else if(skin==='horns'){ctx.fillStyle='#d94b55';ctx.beginPath();ctx.moveTo(-9,-2);ctx.lineTo(-12,-14);ctx.lineTo(-3,-8);ctx.closePath();ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(9,-2);ctx.lineTo(12,-14);ctx.lineTo(3,-8);ctx.closePath();ctx.fill();ctx.stroke()}else if(skin==='flower'){for(let i=0;i<5;i++){const a=i*Math.PI*2/5-Math.PI/2;ctx.fillStyle='#ff9fce';ctx.beginPath();ctx.arc(Math.cos(a)*5,-11+Math.sin(a)*5,4,0,Math.PI*2);ctx.fill();ctx.stroke()}ctx.fillStyle='#ffdc63';ctx.beginPath();ctx.arc(0,-11,3,0,Math.PI*2);ctx.fill()}else if(skin==='robot'){ctx.fillStyle='#8ed5e8';ctx.fillRect(8,-8,10,9);ctx.strokeRect(8,-8,10,9);ctx.fillStyle='#163b50';ctx.fillRect(10,-5,2,2);ctx.fillRect(14,-5,2,2);ctx.strokeStyle='#c8e5ef';ctx.beginPath();ctx.moveTo(13,-8);ctx.lineTo(13,-13);ctx.stroke();ctx.fillStyle='#ffdb70';ctx.beginPath();ctx.arc(13,-14,2,0,Math.PI*2);ctx.fill()}else if(skin==='star'){ctx.save();ctx.translate(0,-.30);ctx.rotate(-.12);ctx.shadowColor='#ffcf42';ctx.shadowBlur=.10;const path=()=>{ctx.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?.115:.265,px=Math.cos(a)*r,py=Math.sin(a)*r;i?ctx.lineTo(px,py):ctx.moveTo(px,py)}ctx.closePath()};const gold=ctx.createLinearGradient(-.20,-.27,.22,.27);gold.addColorStop(0,'#fff8bd');gold.addColorStop(.28,'#ffe66b');gold.addColorStop(.62,'#f5b928');gold.addColorStop(1,'#b86b12');ctx.fillStyle=gold;path();ctx.fill();ctx.shadowBlur=0;ctx.lineWidth=.045;ctx.strokeStyle='#75430e';ctx.stroke();ctx.save();ctx.scale(.72,.72);ctx.translate(0,-.02);ctx.fillStyle='#fff4a6';path();ctx.fill();ctx.restore();ctx.fillStyle='#fffde1';ctx.beginPath();ctx.ellipse(-.055,-.125,.045,.09,-.35,0,Math.PI*2);ctx.fill();ctx.fillStyle='#e58b19';ctx.beginPath();ctx.arc(0,.025,.052,0,Math.PI*2);ctx.fill();ctx.restore()}else if(skin==='cap'){ctx.fillStyle='#d58a3b';ctx.beginPath();ctx.arc(0,-7,9,Math.PI,Math.PI*2);ctx.lineTo(10,-6);ctx.lineTo(-10,-6);ctx.closePath();ctx.fill();ctx.stroke();ctx.beginPath();ctx.ellipse(5,-5,7,2,0,0,Math.PI*2);ctx.fill();ctx.stroke()}ctx.restore()}
function tsNow(){return typeof performance!=='undefined'?performance.now():Date.now()}
function roundedRect(c,x,y,w,h,r){c.beginPath();c.roundRect(x,y,w,h,r)}
function roomPolygon(r){return r.poly.map(([x,y])=>[r.x+x*r.w,r.y+y*r.h])}


/* Capas artísticas modulares: decoración 2D sin colisionadores.
   Se dibujan en coordenadas del mundo y no modifican la navegación. */
function drawRoomSurfaceDetails(r){
 const {x,y,w,h}=r,accent=ROOM_ACCENTS[r.id]||ROOM_KIND_ACCENTS[r.kind]||'#76d8e8';
 const pts=roomPolygon(r);ctx.save();ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.clip();
 const shade=ctx.createLinearGradient(x,y,x+w,y+h);shade.addColorStop(0,'rgba(225,249,255,.075)');shade.addColorStop(.48,'rgba(8,20,32,0)');shade.addColorStop(1,'rgba(0,5,12,.24)');ctx.fillStyle=shade;ctx.fillRect(x,y,w,h);
 // Placas de suelo modulares, juntas biseladas y remaches.
 const sx=r.kind==='cafe'?4:3.1,sy=r.kind==='cafe'?3.2:2.7;
 for(let px=x+.45;px<x+w-.35;px+=sx){ctx.strokeStyle='rgba(190,225,239,.12)';ctx.lineWidth=.045;ctx.beginPath();ctx.moveTo(px,y+.55);ctx.lineTo(px,y+h-.5);ctx.stroke();ctx.fillStyle='rgba(4,12,20,.32)';ctx.fillRect(px+.045,y+.55,.045,h-1.05)}
 for(let py=y+.55;py<y+h-.45;py+=sy){ctx.strokeStyle='rgba(190,225,239,.105)';ctx.lineWidth=.045;ctx.beginPath();ctx.moveTo(x+.45,py);ctx.lineTo(x+w-.45,py);ctx.stroke()}
 const bolt=(bx,by)=>{ctx.fillStyle='#091723';ctx.beginPath();ctx.arc(bx,by,.105,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#9ab7c5';ctx.lineWidth=.035;ctx.stroke();ctx.strokeStyle='#d8f1f6';ctx.lineWidth=.025;ctx.beginPath();ctx.moveTo(bx-.045,by);ctx.lineTo(bx+.045,by);ctx.stroke()};
 for(let px=x+.42;px<x+w-.3;px+=Math.min(4.4,Math.max(2.5,w/3)))for(const py of [y+.48,y+h-.48])bolt(px,py);
 // Material y señalética específica por función.
 if(r.kind==='cafe'){
  ctx.strokeStyle='rgba(208,235,241,.13)';ctx.lineWidth=.06;
  for(let k=-3;k<8;k++){ctx.beginPath();ctx.moveTo(x+2+k*3,y+h*.40);ctx.lineTo(x+4+k*3,y+h*.60);ctx.stroke()}
  ctx.fillStyle='#d8e7e7';ctx.globalAlpha=.18;ctx.fillRect(x+1.1,y+h*.5,w-2.2,.035);ctx.globalAlpha=1;
 }else if(r.kind==='electrical'){
  ctx.fillStyle='#e9b94f';for(let k=0;k<8;k++){ctx.save();ctx.translate(x+.75+k*.55,y+h-.75);ctx.rotate(-.55);ctx.fillRect(0,0,.22,.65);ctx.restore()}
  ctx.strokeStyle='#f0c65d55';ctx.lineWidth=.12;ctx.strokeRect(x+.45,y+.55,w-.9,h-1.1);
 }else if(r.kind==='reactor'){
  ctx.strokeStyle='#c58aff55';ctx.lineWidth=.12;ctx.beginPath();ctx.arc(x+w/2,y+h/2,3.25,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.arc(x+w/2,y+h/2,3.55,0,Math.PI*2);ctx.stroke();
  for(let k=0;k<8;k++){const a=k*Math.PI/4;ctx.fillStyle='#b87cf0';ctx.shadowColor='#b87cf0';ctx.shadowBlur=.35;ctx.beginPath();ctx.arc(x+w/2+3.4*Math.cos(a),y+h/2+3.4*Math.sin(a),.075,0,Math.PI*2);ctx.fill()}ctx.shadowBlur=0;
 }else if(r.kind==='security'){
  ctx.fillStyle='rgba(2,10,19,.22)';for(let k=0;k<4;k++)ctx.fillRect(x+.65+k*3.7,y+h-.9,2.5,.24);
 }else if(r.kind==='nav'){
  ctx.strokeStyle='#75c9ed35';ctx.lineWidth=.08;ctx.beginPath();ctx.arc(x+w/2,y+h/2,4.4,Math.PI,Math.PI*2);ctx.stroke();
 }else if(r.kind==='storage'){
  ctx.strokeStyle='#d6b78344';ctx.lineWidth=.12;for(let k=0;k<4;k++){ctx.beginPath();ctx.moveTo(x+.6,y+1.25+k*.36);ctx.lineTo(x+w-.6,y+1.25+k*.36);ctx.stroke()}
 }else if(r.kind==='o2'){
  ctx.strokeStyle='#7ce8c555';ctx.lineWidth=.22;ctx.beginPath();ctx.moveTo(x+.6,y+.95);ctx.lineTo(x+w-.6,y+.95);ctx.stroke();ctx.beginPath();ctx.moveTo(x+w-.8,y+1);ctx.lineTo(x+w-.8,y+h-1);ctx.stroke();
 }else if(r.kind==='comms'){
  ctx.strokeStyle='#c4a4f355';ctx.lineWidth=.11;ctx.beginPath();ctx.moveTo(x+.7,y+h-.8);ctx.bezierCurveTo(x+3,y+h-2,x+w-3,y+2,x+w-.7,y+1);ctx.stroke();
 }else if(r.kind==='engine'){
  ctx.fillStyle='#f1a45a';for(let k=0;k<7;k++){ctx.fillRect(x+.65+k*.62,y+.68,.28,.12);ctx.fillRect(x+.65+k*.62,y+h-.8,.28,.12)}
 }else if(r.kind==='medbay'){
  ctx.strokeStyle='#8fe8d866';ctx.lineWidth=.06;ctx.strokeRect(x+.65,y+.65,w-1.3,h-1.3);
 }else if(r.kind==='shields'){
  ctx.strokeStyle='#73dff055';ctx.lineWidth=.1;for(let k=0;k<3;k++){ctx.beginPath();ctx.arc(x+w/2,y+h/2,2.2+k*.48,Math.PI*1.1,Math.PI*1.9);ctx.stroke()}
 }
 // Perfil interior y luces de esquina.
 ctx.strokeStyle=accent;ctx.globalAlpha=.28;ctx.lineWidth=.09;ctx.strokeRect(x+.24,y+.24,w-.48,h-.48);ctx.globalAlpha=1;
 [[x+.65,y+.68],[x+w-.65,y+.68],[x+.65,y+h-.68],[x+w-.65,y+h-.68]].forEach(([lx,ly])=>{ctx.fillStyle=accent;ctx.shadowColor=accent;ctx.shadowBlur=.45;ctx.fillRect(lx-.07,ly-.07,.14,.14);ctx.shadowBlur=0});
 ctx.restore();
}
function drawCorridorSurfaceDetails(c,index){
 const pts=c.points,half=c.width/2;ctx.save();ctx.lineCap='butt';ctx.lineJoin='round';
 const path=()=>{ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]))};
 path();ctx.strokeStyle='rgba(2,9,16,.55)';ctx.lineWidth=c.width-.28;ctx.stroke();
 path();ctx.strokeStyle='rgba(167,207,221,.13)';ctx.lineWidth=.075;ctx.stroke();
 path();ctx.strokeStyle='rgba(5,16,26,.55)';ctx.lineWidth=.045;ctx.setLineDash([.28,.38]);ctx.stroke();ctx.setLineDash([]);
 for(let i=1;i<pts.length;i++){
  const a=pts[i-1],b=pts[i],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);if(len<.1)continue;
  const nx=-dy/len,ny=dx/len;
  ctx.strokeStyle='rgba(115,211,225,.26)';ctx.lineWidth=.065;
  for(let d=2.8;d<len-1;d+=3.4){const px=a[0]+dx/len*d,py=a[1]+dy/len*d;ctx.beginPath();ctx.moveTo(px-nx*(half-.22),py-ny*(half-.22));ctx.lineTo(px+nx*(half-.22),py+ny*(half-.22));ctx.stroke()}
  for(let d=1.6;d<len-1;d+=5.2){const px=a[0]+dx/len*d,py=a[1]+dy/len*d;for(const side of [-1,1]){ctx.fillStyle=index%3===0?'#e9c66e':'#6bdce5';ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=.45;ctx.beginPath();ctx.arc(px+nx*side*(half-.34),py+ny*side*(half-.34),.075,0,Math.PI*2);ctx.fill()}ctx.shadowBlur=0}
 }
 ctx.restore();
}
function drawRoomEquipmentAccents(r){
 const {x,y,w,h}=r,cx=x+w/2,cy=y+h/2;ctx.save();
 const led=(px,py,col)=>{ctx.fillStyle=col;ctx.shadowColor=col;ctx.shadowBlur=.55;ctx.beginPath();ctx.arc(px,py,.09,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0};
 const miniScreen=(px,py,ww,hh,col)=>{ctx.fillStyle='#06121e';ctx.fillRect(px-.06,py-.06,ww+.12,hh+.12);ctx.fillStyle=col;ctx.globalAlpha=.72;ctx.fillRect(px,py,ww,hh);ctx.globalAlpha=1;ctx.strokeStyle='#d7f5ff88';ctx.lineWidth=.035;ctx.strokeRect(px,py,ww,hh);ctx.strokeStyle='#eaffff99';ctx.lineWidth=.025;for(let k=1;k<4;k++){ctx.beginPath();ctx.moveTo(px+.08,py+hh*k/4);ctx.lineTo(px+ww-.08,py+hh*k/4);ctx.stroke()}};
 if(r.kind==='admin'){for(let k=0;k<3;k++){miniScreen(x+1.15+k*2,y+2.22,1.2,.48,['#53bba8','#63a8d8','#8d9be6'][k]);led(x+1.2+k*2,y+3.05,'#71edc6')}ctx.strokeStyle='#58c9d8';ctx.lineWidth=.08;ctx.beginPath();ctx.moveTo(x+.8,y+h-.9);ctx.lineTo(x+2.4,y+h-.9);ctx.lineTo(x+3.2,y+h-1.5);ctx.stroke()}
 else if(r.kind==='electrical'){for(let k=0;k<5;k++){led(x+1.1+k*1.9,y+h-1.15,k%2?'#f2c75d':'#f06b60')}ctx.strokeStyle='#e6b74c';ctx.lineWidth=.12;ctx.beginPath();ctx.moveTo(x+.7,y+.95);ctx.lineTo(x+1.8,y+.95);ctx.lineTo(x+2.3,y+1.45);ctx.stroke();miniScreen(x+w-2.7,y+h-2.15,1.7,.42,'#b65b47')}
 else if(r.kind==='reactor'){for(let k=0;k<4;k++){const a=k*Math.PI/2;const px=cx+Math.cos(a)*3.45,py=cy+Math.sin(a)*3.1;ctx.strokeStyle='#b77bea';ctx.lineWidth=.12;ctx.beginPath();ctx.moveTo(cx+Math.cos(a)*2.1,cy+Math.sin(a)*2.1);ctx.lineTo(px,py);ctx.stroke();led(px,py,'#d8a0ff')}}
 else if(r.kind==='security'){for(let k=0;k<3;k++){miniScreen(x+1.15+k*2,y+2.18,1.35,.68,['#2e8790','#3c7399','#687ab0'][k]);ctx.fillStyle='#d8efff';ctx.globalAlpha=.65;ctx.fillRect(x+1.3+k*2,y+2.32,.22,.035);ctx.globalAlpha=1}led(cx-1.65,y+h-1.18,'#61e2d1');led(cx+1.65,y+h-1.18,'#f0c76b')}
 else if(r.kind==='nav'){miniScreen(x+w-3.1,y+2.25,2.2,.62,'#286b91');ctx.strokeStyle='#9beaff';ctx.lineWidth=.07;ctx.beginPath();ctx.moveTo(x+1.1,y+h-1.1);ctx.lineTo(x+2.4,y+h-1.8);ctx.lineTo(x+3.3,y+h-1.2);ctx.stroke();led(x+1.1,y+h-1.1,'#7de7ff')}
 else if(r.kind==='o2'){for(let k=0;k<3;k++){const px=x+1.5+k*2;ctx.strokeStyle='#8be6d0';ctx.lineWidth=.08;ctx.beginPath();ctx.arc(px,y+3,.72,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#a4f5db';ctx.fillRect(px-.18,y+2.7,.36,.08);led(px,y+2.15,'#77f0c4')}miniScreen(x+w-3,y+h-2.1,1.9,.55,'#247e78')}
 else if(r.kind==='comms'){for(let k=0;k<4;k++)led(x+1.55+k*1.15,y+3.0,['#f0c36d','#78e2d1','#b5a2ef','#ee8198'][k]);ctx.strokeStyle='#c5a6f2';ctx.lineWidth=.11;ctx.beginPath();ctx.moveTo(cx,y+1.1);ctx.lineTo(cx,y+.45);ctx.lineTo(cx+.45,y+.15);ctx.stroke();led(cx+.45,y+.15,'#d6b7ff')}
 else if(r.kind==='medbay'){miniScreen(x+w-2.8,y+2.15,1.7,.62,'#2b8d88');ctx.strokeStyle='#a7fff0';ctx.lineWidth=.07;ctx.beginPath();ctx.moveTo(x+1.2,y+h-1.2);ctx.lineTo(x+2,y+h-1.2);ctx.lineTo(x+2.25,y+h-1.8);ctx.lineTo(x+2.5,y+h-.8);ctx.lineTo(x+2.8,y+h-1.2);ctx.lineTo(x+3.6,y+h-1.2);ctx.stroke()}
 else if(r.kind==='engine'){for(let k=0;k<3;k++){const px=cx+(k-1)*1.65;ctx.strokeStyle='#f2a36a';ctx.lineWidth=.12;ctx.beginPath();ctx.arc(px,cy, .72,0,Math.PI*2);ctx.stroke();led(px,cy-1.55,'#ffb35f')}}
 else if(r.kind==='storage'){for(let k=0;k<3;k++){const px=x+1.25+k*2;ctx.fillStyle='#d4b17b';ctx.globalAlpha=.7;ctx.fillRect(px,y+2.9,1.05,.08);ctx.globalAlpha=1;ctx.fillStyle='#152a34';ctx.font='bold .22px monospace';ctx.textAlign='center';ctx.fillText('CARGO-'+(k+1),px+.52,y+3.28)}}
 else if(r.kind==='cafe'){for(const [dx,dy] of [[-2.5,-1.2],[2.5,-1.2],[-2.5,1.3],[2.5,1.3]]){ctx.fillStyle='#f0e3cb';ctx.beginPath();ctx.arc(cx+dx-.18,cy+dy-.08,.12,0,Math.PI*2);ctx.fill();ctx.fillStyle='#b9d9e0';ctx.fillRect(cx+dx+.18,cy+dy-.18,.18,.28)}}
 else if(r.kind==='weapons'){for(let k=0;k<3;k++){led(x+1.8+k*1.7,y+3.55,'#f5b46d');ctx.strokeStyle='#d7b58a';ctx.lineWidth=.07;ctx.beginPath();ctx.moveTo(x+1.35+k*1.7,y+3.8);ctx.lineTo(x+2.5+k*1.7,y+3.8);ctx.stroke()}}
 else if(r.kind==='shields'){for(let k=0;k<3;k++){led(x+1.7+k*2,y+3.25,'#7ce6f6')}}
 ctx.restore();
}


/* Acabado artístico de segunda pasada: panelería, relieve y maquinaria mural.
   Todo se dibuja dentro de la silueta de la sala y es estrictamente decorativo. */
function drawRoomFinishPass(r){
 const {x,y,w,h}=r,cx=x+w/2,cy=y+h/2,accent=ROOM_ACCENTS[r.id]||ROOM_KIND_ACCENTS[r.kind]||'#76d8e8';
 ctx.save();ctx.beginPath();roomPolygon(r).forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.clip();
 const floor=ctx.createLinearGradient(x,y,x,y+h);floor.addColorStop(0,'rgba(220,244,255,.055)');floor.addColorStop(.45,'rgba(4,14,23,.015)');floor.addColorStop(1,'rgba(0,4,12,.25)');ctx.fillStyle=floor;ctx.fillRect(x,y,w,h);
 // Paneles rectangulares con bisel sutil y juntas de expansión.
 for(let py=y+1.25;py<y+h-1;py+=3.25)for(let px=x+.7;px<x+w-.7;px+=4.1){
  const pw=Math.min(3.65,x+w-.7-px),ph=Math.min(2.8,y+h-.8-py);if(pw<1||ph<.8)continue;
  ctx.fillStyle='rgba(1,8,15,.12)';ctx.fillRect(px+.045,py+.055,pw,ph);
  ctx.strokeStyle='rgba(184,220,235,.095)';ctx.lineWidth=.045;ctx.strokeRect(px,py,pw,ph);
  ctx.strokeStyle='rgba(240,251,255,.055)';ctx.lineWidth=.035;ctx.beginPath();ctx.moveTo(px+.12,py+.12);ctx.lineTo(px+pw-.12,py+.12);ctx.stroke();
 }
 // Borde interior mecanizado y puntos de fijación.
 ctx.strokeStyle='rgba(190,224,238,.22)';ctx.lineWidth=.075;ctx.strokeRect(x+.38,y+.38,w-.76,h-.76);
 const rivet=(px,py)=>{ctx.fillStyle='#07131d';ctx.beginPath();ctx.arc(px,py,.105,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#a9c6d3';ctx.lineWidth=.035;ctx.stroke();ctx.strokeStyle='#e0f3f7';ctx.beginPath();ctx.moveTo(px-.045,py);ctx.lineTo(px+.045,py);ctx.stroke()};
 for(let px=x+.8;px<x+w-.5;px+=2.8){rivet(px,y+.42);rivet(px,y+h-.42)}
 for(let py=y+1.2;py<y+h-1;py+=2.8){rivet(x+.42,py);rivet(x+w-.42,py)}
 // La trama cambia según el material de la sala.
 if(['engine','electrical','reactor'].includes(r.kind)){
  ctx.save();ctx.globalAlpha=.22;ctx.strokeStyle=accent;ctx.lineWidth=.11;
  for(let k=-h;k<w;k+=1.2){ctx.beginPath();ctx.moveTo(x+k,y+h-.6);ctx.lineTo(x+k+1.2,y+h-1.35);ctx.stroke()}ctx.restore();
 }else if(['storage'].includes(r.kind)){
  ctx.strokeStyle='rgba(219,184,132,.24)';ctx.lineWidth=.07;
  for(let py=y+1.5;py<y+h-1;py+=1.15){ctx.beginPath();ctx.moveTo(x+.7,py);ctx.lineTo(x+w-.7,py);ctx.stroke()}
 }else if(['nav','security','comms'].includes(r.kind)){
  ctx.strokeStyle=accent;ctx.globalAlpha=.15;ctx.lineWidth=.06;
  for(let px=x+1.1;px<x+w-1;px+=1.5){ctx.beginPath();ctx.moveTo(px,y+h-1.1);ctx.lineTo(px,y+h-1.65);ctx.stroke()}ctx.globalAlpha=1;
 }
 // Motivo de suelo propio para cada sala: no se reutiliza una textura genérica.
 ctx.save();ctx.globalAlpha=.22;ctx.strokeStyle=accent;ctx.fillStyle=accent;ctx.lineWidth=.075;
 if(r.id==='cafeteria'){
  for(let px=x+2;px<x+w-1;px+=4){ctx.beginPath();ctx.moveTo(px,y+1.5);ctx.lineTo(px+1.2,y+2.1);ctx.lineTo(px,y+2.7);ctx.stroke()}
 }else if(r.id==='reactor'){
  for(let k=0;k<3;k++){ctx.beginPath();ctx.arc(cx,cy,3.9+k*.48,Math.PI*.12,Math.PI*.88);ctx.stroke();ctx.beginPath();ctx.arc(cx,cy,3.9+k*.48,Math.PI*1.12,Math.PI*1.88);ctx.stroke()}
 }else if(r.id==='electrical'){
  for(let k=0;k<4;k++){const yy=y+1.8+k*1.7;ctx.beginPath();ctx.moveTo(x+.8,yy);ctx.lineTo(x+2.1,yy);ctx.lineTo(x+2.65,yy+.42);ctx.lineTo(x+4.4,yy+.42);ctx.stroke();ctx.fillRect(x+4.3,yy+.32,.18,.18)}
 }else if(r.id==='navigation'){
  for(let k=0;k<5;k++){const px=x+2+k*2.5;ctx.beginPath();ctx.arc(px,y+h-1.8,.22+(k%2)*.12,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(px-.45,y+h-1.8);ctx.lineTo(px+.45,y+h-1.8);ctx.moveTo(px,y+h-2.25);ctx.lineTo(px,y+h-1.35);ctx.stroke()}
 }else if(r.id==='oxygen'){
  for(let k=0;k<3;k++){const px=x+1.2+k*1.25;ctx.beginPath();ctx.moveTo(px,y+1.7);ctx.bezierCurveTo(px+.55,y+2.4,px-.4,y+3.1,px+.12,y+3.8);ctx.stroke();ctx.beginPath();ctx.moveTo(px+.12,y+3.8);ctx.lineTo(px-.12,y+3.5);ctx.moveTo(px+.12,y+3.8);ctx.lineTo(px+.38,y+3.55);ctx.stroke()}
 }else if(r.id==='comms_n'||r.id==='comms_s'){
  for(let k=0;k<4;k++){ctx.beginPath();ctx.arc(x+2.1,y+h-1.6,.55+k*.42,Math.PI*1.12,Math.PI*1.88);ctx.stroke()}
 }else if(r.id==='security'){
  for(let k=0;k<6;k++){const yy=y+1.8+k*.85;ctx.beginPath();ctx.moveTo(x+1,yy);ctx.lineTo(x+w-1,yy);ctx.stroke()}
 }else if(r.id==='admin'){
  for(let k=0;k<3;k++){const yy=y+2+k*2;ctx.beginPath();ctx.moveTo(x+1,yy);ctx.lineTo(x+2.4,yy);ctx.lineTo(x+2.8,yy+.35);ctx.lineTo(x+4.2,yy+.35);ctx.stroke()}
 }else if(r.id==='medbay'||r.id==='laboratory'){
  for(let k=0;k<4;k++){const px=x+1.2+k*1.15,py=y+h-1.65;ctx.beginPath();ctx.moveTo(px-.22,py);ctx.lineTo(px+.22,py);ctx.moveTo(px,py-.22);ctx.lineTo(px,py+.22);ctx.stroke()}
 }else if(r.id==='shields'){
  for(let k=0;k<4;k++){ctx.beginPath();ctx.arc(cx,y+h-1.3,1.3+k*.42,Math.PI*1.15,Math.PI*1.85);ctx.stroke()}
 }else if(r.id==='weapons'){
  for(let k=0;k<3;k++){const px=x+2.3+k*3.1;ctx.beginPath();ctx.arc(px,y+h-1.65,.42,0,Math.PI*2);ctx.moveTo(px-.62,y+h-1.65);ctx.lineTo(px+.62,y+h-1.65);ctx.moveTo(px,y+h-2.27);ctx.lineTo(px,y+h-1.03);ctx.stroke()}
 }else if(r.id==='engine_u'||r.id==='engine_s'){
  for(let k=0;k<6;k++){const px=x+1+k*2.35;ctx.beginPath();ctx.moveTo(px,y+h-2.15);ctx.lineTo(px+.6,y+h-1.55);ctx.lineTo(px,y+h-.95);ctx.stroke()}
 }else if(r.id==='cargo_n'||r.id==='cargo_s'||r.id==='storage'){
  for(let k=0;k<3;k++){const yy=y+1.8+k*1.8;ctx.beginPath();ctx.moveTo(x+1,yy);ctx.lineTo(x+w-1,yy);ctx.stroke();for(let px=x+2;px<x+w-1;px+=3){ctx.beginPath();ctx.moveTo(px,yy-.2);ctx.lineTo(px,yy+.2);ctx.stroke()}}
 }
 ctx.restore();
 // Líneas de seguridad empotradas, nunca sobre el punto de misión.
 if(['engine','electrical','reactor','weapons'].includes(r.kind)){
  ctx.fillStyle='rgba(237,180,76,.58)';ctx.fillRect(x+.62,y+h-.68,w-1.24,.075);
  ctx.fillStyle='rgba(13,22,28,.7)';for(let px=x+.8;px<x+w-1;px+=.65){ctx.beginPath();ctx.moveTo(px,y+h-.68);ctx.lineTo(px+.28,y+h-.68);ctx.lineTo(px+.48,y+h-.60);ctx.lineTo(px+.2,y+h-.60);ctx.closePath();ctx.fill()}
 }
 ctx.restore();
}
function drawRoomWallModules(r){
 const {x,y,w,h}=r,cx=x+w/2,cy=y+h/2,accent=ROOM_ACCENTS[r.id]||ROOM_KIND_ACCENTS[r.kind]||'#76d8e8';
 ctx.save();
 const panel=(px,py,pw,ph,col=accent)=>{ctx.fillStyle='rgba(0,0,0,.38)';ctx.fillRect(px+.12,py+.16,pw,ph);const g=ctx.createLinearGradient(px,py,px+pw,py+ph);g.addColorStop(0,'#526b7a');g.addColorStop(.22,'#203747');g.addColorStop(1,'#0a1925');ctx.fillStyle=g;ctx.fillRect(px,py,pw,ph);ctx.strokeStyle='#b8d9e6aa';ctx.lineWidth=.07;ctx.strokeRect(px,py,pw,ph);ctx.strokeStyle=col;ctx.lineWidth=.075;ctx.strokeRect(px+.12,py+.12,pw-.24,ph-.24);ctx.fillStyle='#d9edf4';ctx.globalAlpha=.28;ctx.fillRect(px+.16,py+.16,pw-.32,.07);ctx.globalAlpha=1};
 const led=(px,py,col='#70e4d1')=>{ctx.fillStyle=col;ctx.shadowColor=col;ctx.shadowBlur=.42;ctx.beginPath();ctx.arc(px,py,.085,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0};
 const screen=(px,py,pw,ph,col='#267d91')=>{panel(px,py,pw,ph,col);ctx.fillStyle='#06131e';ctx.fillRect(px+.16,py+.16,pw-.32,ph-.32);ctx.fillStyle=col;ctx.globalAlpha=.72;ctx.fillRect(px+.21,py+.21,pw-.42,ph-.42);ctx.globalAlpha=1;ctx.strokeStyle='#d5fbff99';ctx.lineWidth=.035;for(let k=1;k<4;k++){ctx.beginPath();ctx.moveTo(px+.24,py+.2+(ph-.4)*k/4);ctx.lineTo(px+pw-.24,py+.2+(ph-.4)*k/4);ctx.stroke()}};
 const pipe=(points,col='#7194a5',width=.18)=>{ctx.strokeStyle='#07121b';ctx.lineWidth=width+.14;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.stroke();ctx.strokeStyle=col;ctx.lineWidth=width;ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.stroke();points.forEach(p=>{ctx.fillStyle='#9ab7c3';ctx.beginPath();ctx.arc(p[0],p[1],width*.72,0,Math.PI*2);ctx.fill()})};
 const crate=(px,py,pw,ph,col='#92734f')=>{ctx.fillStyle='#0008';ctx.fillRect(px+.13,py+.16,pw,ph);const g=ctx.createLinearGradient(px,py,px+pw,py+ph);g.addColorStop(0,col);g.addColorStop(1,'#302b27');ctx.fillStyle=g;ctx.fillRect(px,py,pw,ph);ctx.strokeStyle='#d6b783';ctx.lineWidth=.07;ctx.strokeRect(px,py,pw,ph);ctx.beginPath();ctx.moveTo(px+.12,py+.12);ctx.lineTo(px+pw-.12,py+ph-.12);ctx.moveTo(px+pw-.12,py+.12);ctx.lineTo(px+.12,py+ph-.12);ctx.stroke();ctx.fillStyle='#e8d4ae';ctx.fillRect(px+pw*.42,py+.08,pw*.16,ph-.16)};
 const canister=(px,py,col='#64c9b0')=>{ctx.fillStyle='#0009';ctx.beginPath();ctx.ellipse(px+.12,py+.12,.48,.2,0,0,Math.PI*2);ctx.fill();const g=ctx.createLinearGradient(px-.4,py,px+.4,py);g.addColorStop(0,'#122b38');g.addColorStop(.45,col);g.addColorStop(1,'#183344');ctx.fillStyle=g;ctx.beginPath();ctx.roundRect(px-.38,py-.72,.76,1.42,.18);ctx.fill();ctx.strokeStyle='#c4e6e7';ctx.lineWidth=.06;ctx.stroke();ctx.fillStyle='#d9eff0';ctx.fillRect(px-.18,py-.88,.36,.18);ctx.fillStyle='#09202b';ctx.fillRect(px-.23,py-.12,.46,.22);ctx.fillStyle=col;ctx.fillRect(px-.14,py-.08,.28,.14);led(px,py-.96,col)};
 const side=r.id==='reactor'?'left':'right',sx=side==='left'?x+.55:x+w-2.15;
 // Maquinaria mural específica: colocada en el perímetro, fuera de las estaciones.
 if(r.id==='cargo_n'||r.id==='cargo_s'||r.id==='storage'){
  const px=sx;panel(px,y+3.85,1.55,3.9,'#d5ad75');for(let k=0;k<3;k++){ctx.strokeStyle='#d9c08f';ctx.lineWidth=.12;ctx.beginPath();ctx.moveTo(px+.12,y+4.75+k*1.15);ctx.lineTo(px+1.43,y+4.75+k*1.15);ctx.stroke()}crate(px+.22,y+4.08,.48,.55,'#a17b50');crate(px+.82,y+5.22,.48,.55,'#71816b');crate(px+.25,y+6.42,.95,.72,'#806a51');led(px+1.27,y+4.25,'#f0c77b');
 }else if(r.id==='comms_n'||r.id==='comms_s'){
  panel(sx,y+3.9,1.45,3.8,'#b99af0');screen(sx+.18,y+4.18,1.08,.82,'#365f9d');for(let k=0;k<4;k++)led(sx+.3+k*.29,y+5.25,['#f0c36d','#78e2d1','#b5a2ef','#ee8198'][k]);pipe([[sx+.72,y+5.55],[sx+.72,y+6.25],[sx+.38,y+6.65],[sx+.38,y+7.35]],'#a98bd7',.13);ctx.strokeStyle='#d2b9ff';ctx.lineWidth=.1;ctx.beginPath();ctx.arc(sx+.72,y+4.03,.48,Math.PI,Math.PI*2);ctx.stroke();
 }else if(r.id==='oxygen'){
  panel(sx,y+3.75,1.5,3.95,'#70e3c1');canister(sx+.43,y+5.05,'#63d9b5');canister(sx+1.08,y+6.1,'#58bcae');pipe([[sx+.25,y+4.05],[sx+.25,y+3.55],[sx+1.18,y+3.55],[sx+1.18,y+4.05]],'#7ce8c9',.13);
 }else if(r.id==='electrical'){
  panel(sx,y+3.75,1.55,3.95,'#f0c35c');for(let k=0;k<5;k++){ctx.fillStyle='#101c26';ctx.fillRect(sx+.2,y+4.1+k*.65,1.15,.42);ctx.fillStyle=['#d94c4c','#e4b84e','#61c991','#4e9ed1'][k%4];ctx.fillRect(sx+.3,y+4.2+k*.65,.23,.2);ctx.fillStyle='#8ba3ad';ctx.fillRect(sx+.67,y+4.2+k*.65,.58,.07);led(sx+1.12,y+4.3+k*.65,k%2?'#e9bd5b':'#f16b62')}pipe([[sx+.2,y+7.65],[sx+.2,y+7.9],[sx+1.32,y+7.9]],'#d7ad56',.12);
 }else if(r.id==='admin'){
  panel(sx,y+3.9,1.45,3.7,'#83e4c2');screen(sx+.16,y+4.18,1.13,.8,'#2c8b79');ctx.fillStyle='#c8e8df';ctx.font='bold .2px monospace';ctx.textAlign='center';ctx.fillText('ACCESS OK',sx+.72,y+5.18);for(let k=0;k<3;k++)led(sx+.36+k*.34,y+5.55,k===0?'#65dba6':'#e8c36b');ctx.fillStyle='#a6c9c9';ctx.fillRect(sx+.25,y+6.15,.95,.12);ctx.fillRect(sx+.25,y+6.55,.95,.12);
 }else if(r.id==='security'){
  panel(sx,y+3.8,1.5,3.8,'#65dbe2');for(let k=0;k<3;k++)screen(sx+.16,y+4.02+k*1.05,1.18,.82,['#286b83','#315d8a','#42527e'][k]);led(sx+1.22,y+7.3,'#e6c16a');
 }else if(r.id==='reactor'){
  panel(sx,y+3.7,1.5,4,'#c58aff');for(let k=0;k<3;k++){ctx.strokeStyle='#c98cff';ctx.lineWidth=.12;ctx.beginPath();ctx.arc(sx+.75,y+4.55+k*1.05,.43,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#e8d4ff';ctx.beginPath();ctx.moveTo(sx+.75,y+4.16+k*1.05);ctx.lineTo(sx+.75,y+4.94+k*1.05);ctx.moveTo(sx+.36,y+4.55+k*1.05);ctx.lineTo(sx+1.14,y+4.55+k*1.05);ctx.stroke();led(sx+.75,y+4.55+k*1.05,'#d8a0ff')}pipe([[sx+.15,y+7.7],[sx+.15,y+7.95],[sx+1.35,y+7.95]],'#aa7bd1',.16);
 }else if(r.id==='cafeteria'){
  // Dispensador mural y pequeño módulo de reciclaje.
  panel(x+1.05,y+h-4.25,2.2,2.7,'#e6bd7a');screen(x+1.27,y+h-4.02,1.76,.72,'#347b91');ctx.fillStyle='#d9e7e5';ctx.fillRect(x+1.35,y+h-3.02,1.6,.12);for(let k=0;k<3;k++){ctx.fillStyle=['#c76d68','#68a9a0','#d3b36d'][k];ctx.fillRect(x+1.42+k*.48,y+h-2.68,.32,.72)}led(x+2.95,y+h-3.78,'#f2d38a');
 }else if(r.id==='medbay'||r.id==='laboratory'){
  panel(sx,y+3.85,1.48,3.8,'#8ce8dc');screen(sx+.16,y+4.1,1.16,.86,'#287c82');ctx.strokeStyle='#b7fff0';ctx.lineWidth=.08;ctx.beginPath();ctx.moveTo(sx+.35,y+5.45);ctx.lineTo(sx+.62,y+5.45);ctx.lineTo(sx+.76,y+5.05);ctx.lineTo(sx+.91,y+5.85);ctx.lineTo(sx+1.08,y+5.45);ctx.lineTo(sx+1.27,y+5.45);ctx.stroke();for(let k=0;k<3;k++)led(sx+.35+k*.38,y+6.35,'#8ce8dc');
 }else if(r.id==='weapons'){
  panel(sx,y+3.8,1.5,3.8,'#f1a76f');for(let k=0;k<4;k++){ctx.fillStyle='#172a36';ctx.fillRect(sx+.18,y+4.12+k*.78,1.12,.55);ctx.fillStyle='#b4c0c3';ctx.fillRect(sx+.3,y+4.25+k*.78,.78,.12);ctx.fillStyle='#e4a36f';ctx.fillRect(sx+.92,y+4.2+k*.78,.18,.3);led(sx+1.15,y+4.4+k*.78,'#e8bd75')}
 }else if(r.id==='engine_u'||r.id==='engine_s'){
  panel(sx,y+3.7,1.5,4,'#ff9868');for(let k=0;k<3;k++){ctx.fillStyle='#182a36';ctx.beginPath();ctx.arc(sx+.75,y+4.55+k*1.05,.39,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#ff9b65';ctx.lineWidth=.13;ctx.beginPath();ctx.arc(sx+.75,y+4.55+k*1.05,.32,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#ffd1a3';ctx.lineWidth=.06;ctx.beginPath();ctx.moveTo(sx+.48,y+4.55+k*1.05);ctx.lineTo(sx+1.02,y+4.55+k*1.05);ctx.stroke()}pipe([[sx+.1,y+7.8],[sx+.1,y+7.45],[sx+1.38,y+7.45],[sx+1.38,y+7.8]],'#c97953',.17);
 }else if(r.id==='navigation'){
  // Ventana panorámica compacta con horizonte estelar.
  panel(sx,y+3.85,1.52,3.8,'#79cfff');ctx.fillStyle='#061526';ctx.fillRect(sx+.16,y+4.12,1.2,1.48);const sky=ctx.createLinearGradient(0,y+4.12,0,y+5.6);sky.addColorStop(0,'#102a4c');sky.addColorStop(1,'#367b9a');ctx.fillStyle=sky;ctx.fillRect(sx+.2,y+4.16,1.12,1.4);for(let k=0;k<9;k++){ctx.fillStyle='#e8f7ff';ctx.fillRect(sx+.25+(k*17%95)/100,y+4.2+(k*23%115)/100,.035,.035)}ctx.fillStyle='#061322';ctx.beginPath();ctx.moveTo(sx+.2,y+5.32);ctx.lineTo(sx+.6,y+5.12);ctx.lineTo(sx+.95,y+5.38);ctx.lineTo(sx+1.32,y+5.18);ctx.lineTo(sx+1.32,y+5.58);ctx.lineTo(sx+.2,y+5.58);ctx.fill();led(sx+.75,y+6.35,'#79cfff');
 }else if(r.id==='shields'){
  panel(sx,y+3.85,1.5,3.8,'#73e5ff');for(let k=0;k<3;k++){ctx.strokeStyle='#73e5ff';ctx.lineWidth=.1;ctx.beginPath();ctx.arc(sx+.75,y+4.7+k*.9,.42,Math.PI,Math.PI*2);ctx.stroke();ctx.strokeStyle='#c8f8ff';ctx.beginPath();ctx.moveTo(sx+.33,y+4.7+k*.9);ctx.lineTo(sx+1.17,y+4.7+k*.9);ctx.stroke();led(sx+.75,y+4.7+k*.9,'#8ef0ff')}
 }
 // Canaleta superior de servicio con abrazaderas y testigos luminosos.
 pipe([[x+.62,y+.72],[x+1.05,y+.72],[x+1.32,y+.94],[x+w-1.15,y+.94],[x+w-.72,y+.72]],accent,.095);
 for(let k=0;k<Math.max(2,Math.floor(w/4));k++){const px=x+1.3+k*3.2;ctx.fillStyle='#a9c3cf';ctx.fillRect(px,y+.78,.09,.32);led(px+.045,y+.68,accent)}
 ctx.restore();
}
function drawCorridorArchitecture(c,index){
 const pts=c.points,half=c.width/2;ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
 // Carriles laterales de protección y canaleta de cableado.
 for(const side of [-1,1]){
  ctx.beginPath();pts.forEach((p,i)=>{const prev=pts[Math.max(0,i-1)],next=pts[Math.min(pts.length-1,i+1)],dx=next[0]-prev[0],dy=next[1]-prev[1],len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len;const q=[p[0]+nx*side*(half-.26),p[1]+ny*side*(half-.26)];i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1])});ctx.strokeStyle='#081722';ctx.lineWidth=.22;ctx.stroke();ctx.strokeStyle=side===-1?'#5b8596':'#365c70';ctx.lineWidth=.095;ctx.stroke();
 }
 for(let i=1;i<pts.length;i++){
  const a=pts[i-1],b=pts[i],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);if(len<2)continue;
  const ux=dx/len,uy=dy/len,nx=-uy,ny=ux;
   // Los tramos horizontales quedan limpios: sin traviesas ni pequeños salientes repetidos.
   if(Math.abs(dy)>.001){
    for(let d=2.2;d<len-1;d+=6.1){const px=a[0]+ux*d,py=a[1]+uy*d;ctx.strokeStyle='rgba(188,218,230,.20)';ctx.lineWidth=.09;ctx.beginPath();ctx.moveTo(px-nx*(half-.25),py-ny*(half-.25));ctx.lineTo(px+nx*(half-.25),py+ny*(half-.25));ctx.stroke();for(const side of [-1,1]){ctx.fillStyle='#c0d3dc';ctx.beginPath();ctx.arc(px+nx*side*(half-.42),py+ny*side*(half-.42),.07,0,Math.PI*2);ctx.fill()}}
   }
   // Luminarias empotradas alternas, sin invadir el carril central.
  for(let d=4.1;d<len-1;d+=10.5){const px=a[0]+ux*d,py=a[1]+uy*d;for(const side of [-1,1]){const lx=px+nx*side*(half-.52),ly=py+ny*side*(half-.52);ctx.fillStyle='#091a27';ctx.save();ctx.translate(lx,ly);ctx.rotate(Math.atan2(dy,dx));ctx.fillRect(-.42,-.16,.84,.32);ctx.fillStyle=index%3===0?'#f0c978':'#77dce8';ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=.42;ctx.fillRect(-.26,-.045,.52,.09);ctx.shadowBlur=0;ctx.restore()}}
   // Las arterias horizontales quedan despejadas, sin placas que sobresalgan.
   if(Math.abs(dy)>.001){const d=len*.68,px=a[0]+ux*d+nx*(half-.62),py=a[1]+uy*d+ny*(half-.62);ctx.save();ctx.translate(px,py);ctx.rotate(Math.atan2(dy,dx));ctx.fillStyle='#0a1924';ctx.fillRect(-.46,-.3,.92,.6);ctx.strokeStyle='#7b9cab';ctx.lineWidth=.06;ctx.strokeRect(-.46,-.3,.92,.6);ctx.strokeStyle='#c0d6df';ctx.lineWidth=.045;for(let k=-1;k<=1;k++){ctx.beginPath();ctx.moveTo(k*.22,-.18);ctx.lineTo(k*.22,.18);ctx.stroke()}ctx.restore();}

 }
 // Carril de guía: azul en arterias principales, ámbar en ramales técnicos.
 ctx.save();ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.strokeStyle=c.main?'rgba(91,205,221,.22)':'rgba(236,187,99,.20)';ctx.lineWidth=.10;ctx.setLineDash(c.main?[1.25,1.0]:[.34,.62]);ctx.stroke();ctx.setLineDash([]);ctx.restore();
 // Placa de identificación y flechas de sentido en cada tramo.
 for(let i=1;i<pts.length;i++){
  const a=pts[i-1],b=pts[i],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);if(len<5)continue;
  const ux=dx/len,uy=dy/len,nx=-uy,ny=ux,d=len*.52,px=a[0]+ux*d+nx*(half-.62),py=a[1]+uy*d+ny*(half-.62),angle=Math.atan2(dy,dx),tone=c.main?'#73dce8':'#e7bd70';
  ctx.save();ctx.translate(px,py);ctx.rotate(angle);ctx.fillStyle='#06131e';ctx.fillRect(-.86,-.24,1.72,.48);ctx.strokeStyle=tone;ctx.lineWidth=.055;ctx.strokeRect(-.86,-.24,1.72,.48);ctx.fillStyle=tone;ctx.font='bold .20px monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(c.id.toUpperCase().replace(/_/g,' '),0,-.035);ctx.beginPath();ctx.moveTo(-.68,.12);ctx.lineTo(-.48,.12);ctx.lineTo(-.58,.045);ctx.moveTo(.68,.12);ctx.lineTo(.48,.12);ctx.lineTo(.58,.045);ctx.stroke();ctx.restore();
 }
 // Nodos de intersección con aro de anclaje y cuatro testigos.
 pts.forEach((p,i)=>{ctx.fillStyle='#0a1a26';ctx.beginPath();ctx.arc(p[0],p[1],i===0||i===pts.length-1?.28:.20,0,Math.PI*2);ctx.fill();ctx.strokeStyle=c.main?'#75cbd7':'#d8b46e';ctx.lineWidth=.07;ctx.stroke();for(let k=0;k<4;k++){const a=k*Math.PI/2;ctx.fillStyle=c.main?'#7de0e8':'#e8c579';ctx.fillRect(p[0]+Math.cos(a)*.34-.035,p[1]+Math.sin(a)*.34-.035,.07,.07)}});
 ctx.restore();
}

function drawWorldAnimationFX(time,cx,cy,vw,vh){const t=time/1000,mePlayer=gameState?.players?.[playerId];ctx.save();ctx.globalCompositeOperation='screen';for(let i=0;i<26;i++){const x=(i*17.37+Math.sin(t*.18+i)*.42+MAP.w)%MAP.w,y=(i*11.91+Math.sin(t*.42+i*1.7)*.62+MAP.h)%MAP.h;if(x<cx-.5||x>cx+vw+.5||y<cy-.5||y>cy+vh+.5)continue;ctx.globalAlpha=.25+.35*(.5+.5*Math.sin(t*1.8+i));ctx.fillStyle=i%4===0?'#b4f7ff':'#91c9d9';ctx.beginPath();ctx.arc(x,y,.025+(i%3)*.009,0,Math.PI*2);ctx.fill()}ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;MAP.rooms.forEach((r,i)=>{const pulse=.65+.35*Math.sin(t*1.35+i*1.9);ctx.globalAlpha=.12+.12*pulse;ctx.fillStyle=ROOM_ACCENTS[r.id]||'#78dce9';ctx.beginPath();ctx.ellipse(r.x+r.w/2,r.y+.84,.72,.18,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1});MAP.vents.forEach((v,i)=>{const active=!!(mePlayer?.inVent&&mePlayer.ventId===v.id),pulse=.5+.5*Math.sin(t*3.2+i);ctx.save();ctx.translate(v.x,v.y);ctx.globalAlpha=active?.95:.32+.22*pulse;ctx.strokeStyle=active?'#a9fbff':'#67dce9';ctx.shadowColor=ctx.strokeStyle;ctx.shadowBlur=active?1.05:.35;ctx.lineWidth=active?.12:.065;ctx.beginPath();ctx.arc(0,0,active?.94:.68,-Math.PI/2+t*.55,-Math.PI/2+t*.55+Math.PI*(1.1+pulse*.65));ctx.stroke();ctx.restore()});if(mePlayer?.alive&&mePlayer.role==='crew'&&!mePlayer.inVent)(mePlayer.tasks||[]).filter(q=>!mePlayer.done?.includes(q.id)).forEach(q=>{const st=MAP.tasks.find(x=>x.id===q.id);if(!st||Math.hypot(mePlayer.x-st.x,mePlayer.y-st.y)>4.2)return;const pulse=(t*1.1+st.x*.7)%1;ctx.save();ctx.globalAlpha=(1-pulse)*.32;ctx.strokeStyle='#ffe17a';ctx.lineWidth=.055;ctx.beginPath();ctx.arc(st.x,st.y,.55+pulse*.62,0,Math.PI*2);ctx.stroke();ctx.restore()});if(gameState?.sabotage?.active&&['reactor','o2'].includes(gameState.sabotage.type)){const pulse=.5+.5*Math.sin(t*5.5);activeRepairStations().forEach(q=>{ctx.save();ctx.globalAlpha=.18+.22*pulse;ctx.fillStyle='#ff334b';ctx.beginPath();ctx.arc(q.x,q.y,1.05+pulse*.35,0,Math.PI*2);ctx.fill();ctx.restore()})}ctx.globalAlpha=1;}function drawVentWorldGuides(){
 const meP=gameState?.players?.[playerId];if(!meP?.inVent||ventFocus)return;
 const from=MAP.vents.find(v=>v.id===meP.ventId);if(!from)return;
 ctx.save();ctx.lineWidth=.13;ctx.lineCap='round';
 MAP.vents.filter(v=>(from.links||[]).includes(v.id)).forEach((v,i)=>{
  const angle=Math.atan2(v.y-from.y,v.x-from.x);
  ctx.save();ctx.translate(from.x,from.y);ctx.rotate(angle);
  const pulse=.73+.24*Math.sin(tsNow()*.006+i*2);
  ctx.globalAlpha=pulse;ctx.strokeStyle='#ff4359';ctx.shadowColor='#ff1433';ctx.shadowBlur=.65;
  ctx.setLineDash([.25,.15]);ctx.beginPath();ctx.moveTo(.9,0);ctx.lineTo(2.9,0);ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle='#ff506c';ctx.beginPath();ctx.moveTo(3.1,0);ctx.lineTo(2.5,-.34);ctx.lineTo(2.5,.34);ctx.closePath();ctx.fill();
  ctx.restore();
 });
 ctx.restore();
}

function drawVisibleVentTransition(){
 const ev=gameState?.ventEvent;if(!ev)return;
 const time=(Date.now()-ev.at)/2300;if(time<0||time>=1)return;
 const person=gameState.players?.[ev.playerId]||{color:ev.color||'#e85d75'};
 const opacity=Math.min(1,(1-time)*2.3);
 ctx.save();ctx.translate(ev.x,ev.y);ctx.globalAlpha=opacity;
 const radius=1.0+time*1.1;ctx.strokeStyle=ev.type==='enter'?'#ff5077':'#86e4fc';ctx.lineWidth=.075;
 ctx.shadowColor=ctx.strokeStyle;ctx.shadowBlur=.32;ctx.beginPath();ctx.ellipse(0,.05,radius,radius*.44,0,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0;
 for(let i=0;i<10;i++){const a=i*2*Math.PI/10+time*.7,q=.22+time*(.5+i%3*.13);ctx.fillStyle=i%2?'#b9efff':'#ff97b0';ctx.globalAlpha=opacity*(.7+Math.sin(a*7)*.1);
 ctx.beginPath();ctx.arc(Math.cos(a)*q,Math.sin(a)*q*.55,.045+time*.034,0,Math.PI*2);ctx.fill()}
 const k=ev.type==='enter'?Math.max(.05,1-time*1.6):Math.min(1,time*2.3);
 if(k>.08){ctx.globalAlpha=opacity;ctx.save();ctx.scale(1,Math.max(.09,k));ctx.translate(0,(1-k)*1.2);window.StarshipVisual.canvas(ctx,0,0,avatarAppearance(person),{moving:true,phase:time*6,time:tsNow()});ctx.restore()}
 ctx.restore();
}

function draw(){if(!ctx||!canvas)return;try{const w=canvas.clientWidth,h=canvas.clientHeight;if(canvas.width<1||canvas.height<1)return;if(w<2||h<2)return;const visibleRooms=MAP.rooms.filter(r=>{const p=gameState?.players?.[playerId];return !!ventFocus||!p||Math.abs(r.x+r.w/2-p.x)<r.w/2+25&&Math.abs(r.y+r.h/2-p.y)<r.h/2+19});const dpr=Math.min(window.devicePixelRatio||1,v4Preferences.quality==='low'?1:v4Preferences.quality==='high'?2:1.5);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';const p=gameState?.players?.[playerId],targetZ=Math.max(.1,Math.min(w/32,h/21));let z=targetZ,cx,cy;const vt=ventFocus,ventT=vt?Math.min(1,Math.max(0,(tsNow()-vt.start)/vt.duration)):0,ventEase=ventT*ventT*(3-2*ventT);
const focusX=vt?vt.from.x+(vt.to.x-vt.from.x)*ventEase:(p?.x??SPAWN_X),
focusY=vt?vt.from.y+(vt.to.y-vt.from.y)*ventEase:(p?.y??SPAWN_Y);if(cameraIntro){const raw=Math.min(1,Math.max(0,(tsNow()-cameraIntro.start)/cameraIntro.duration)),ease=raw*raw*(3-2*raw),fitZ=Math.min(w/MAP.w,h/MAP.h)*.94;z=fitZ*Math.pow(targetZ/fitZ,ease);const fx=MAP.w/2+(focusX-MAP.w/2)*ease,fy=MAP.h/2+(focusY-MAP.h/2)*ease;cx=fx-w/z/2;cy=fy-h/z/2;if(raw>=1)cameraIntro=null}else{const vw=w/z,vh=h/z;cx=Math.max(0,Math.min(MAP.w-vw,focusX-vw/2));cy=Math.max(0,Math.min(MAP.h-vh,focusY-vh/2))}const vw=w/z,vh=h/z;window.__starshipCamera={z,cx,cy};ctx.clearRect(0,0,w,h);ctx.fillStyle='#020811';ctx.fillRect(0,0,w,h);ctx.save();ctx.scale(z,z);ctx.translate(-cx,-cy);
const poly=(pts)=>{ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath()};
// Sin silueta ni perímetro: el nuevo mapa parte de un lienzo vacío.

// Extrusión real de los perímetros: caras laterales oscuras y suelo elevado.
visibleRooms.forEach(r=>{const pts=roomPolygon(r),ox=.0,oy=.82;ctx.save();for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.lineTo(b[0]+ox,b[1]+oy);ctx.lineTo(a[0]+ox,a[1]+oy);ctx.closePath();ctx.fillStyle='#07121d';ctx.fill();ctx.strokeStyle='#020811';ctx.lineWidth=.08;ctx.stroke()}ctx.restore()});
const gridRect=(x,y,ww,hh,step=1.1)=>{ctx.fillStyle='#263d4c';ctx.fillRect(x,y,ww,hh);ctx.strokeStyle='#a8d9e51b';ctx.lineWidth=.035;for(let xx=x+step;xx<x+ww;xx+=step){ctx.beginPath();ctx.moveTo(xx,y);ctx.lineTo(xx,y+hh);ctx.stroke()}for(let yy=y+step;yy<y+hh;yy+=step){ctx.beginPath();ctx.moveTo(x,yy);ctx.lineTo(x+ww,yy);ctx.stroke()}};
visibleRooms.forEach(r=>{ctx.save();const pts=roomPolygon(r);poly(pts);const rp={cafe:'#497f91',engine:'#a65f42',reactor:'#76539a',security:'#347e88',medbay:'#398b86',electrical:'#a77a3f',storage:'#8a704c',admin:'#438d70',weapons:'#9b6748',nav:'#3e75a8',o2:'#31947d',shields:'#347f9b',comms:'#765d9b'};ctx.fillStyle=rp[r.kind]||'#344d5d';ctx.fill();ctx.save();poly(pts);ctx.clip();ctx.fillStyle=rp[r.kind]||'#344d5d';ctx.fillRect(r.x,r.y,r.w,r.h);ctx.strokeStyle='#b8e2ef20';ctx.lineWidth=.04;for(let xx=r.x+1;xx<r.x+r.w;xx+=1){ctx.beginPath();ctx.moveTo(xx,r.y);ctx.lineTo(xx,r.y+r.h);ctx.stroke()}for(let yy=r.y+1;yy<r.y+r.h;yy+=1){ctx.beginPath();ctx.moveTo(r.x,yy);ctx.lineTo(r.x+r.w,yy);ctx.stroke()}ctx.globalAlpha=.32;ctx.fillStyle=r.color;ctx.fillRect(r.x,r.y,r.w,r.h);ctx.restore();ctx.strokeStyle='#d9f5ff';ctx.lineWidth=.18;poly(pts);ctx.stroke();drawRoomSurfaceDetails(r);drawRoomFinishPass(r);if(r.kind==='o2'||r.kind==='comms'||r.kind==='electrical'){const yy=r.kind==='electrical'?r.y+r.h:r.y;ctx.strokeStyle='#263d4c';ctx.lineWidth=.34;ctx.beginPath();ctx.moveTo(r.x+1.6,yy);ctx.lineTo(r.x+4.4,yy);ctx.stroke();ctx.strokeStyle='#f5d76e';ctx.lineWidth=.09;ctx.beginPath();ctx.moveTo(r.x+1.6,yy+(r.kind==='electrical'?-.08:.08));ctx.lineTo(r.x+4.4,yy+(r.kind==='electrical'?-.08:.08));ctx.stroke()}ctx.fillStyle='#f2fbff';ctx.font='bold .62px system-ui';ctx.textAlign='center';ctx.shadowColor='#06111b';ctx.shadowBlur=.18;ctx.fillText(tr(r.name),r.x+r.w/2,r.y+1.05);if(r.kind==='comms'){ctx.fillStyle='#142b3a';ctx.fillRect(r.x+5.15,r.y-.12,1.7,.32);ctx.strokeStyle='#7fe6ed';ctx.lineWidth=.08;ctx.strokeRect(r.x+5.15,r.y-.12,1.7,.32);ctx.fillStyle='#b7faff';ctx.fillRect(r.x+6.55,r.y+.02,.12,.12)}ctx.restore()});
MAP.corridors.forEach((c,i)=>{const tones=['#4d91a5','#8c805d','#527fa7','#a16b58','#4e9a83'];ctx.lineCap='square';ctx.lineJoin='round';ctx.strokeStyle='#07121b';ctx.lineWidth=c.width+.65;ctx.beginPath();c.points.forEach((p,j)=>j?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.stroke();ctx.strokeStyle=tones[i%tones.length];ctx.lineWidth=c.width;ctx.stroke();ctx.strokeStyle='#d5f5ed30';ctx.lineWidth=.055;ctx.setLineDash([.3,.8]);ctx.beginPath();c.points.forEach((p,j)=>j?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.stroke();ctx.setLineDash([])});MAP.corridors.forEach(drawCorridorSurfaceDetails);MAP.corridors.forEach(drawCorridorArchitecture);




// Arquitectura interior: muros gruesos, zócalos, paneles, tuberías y luminarias.
MAP.rooms.forEach((r,i)=>{const pts=roomPolygon(r),x=r.x,y=r.y,w=r.w,h=r.h,cx=x+w/2;const ac=ROOM_ACCENTS[r.id]||ROOM_KIND_ACCENTS[r.kind]||'#76d8e8';ctx.save();ctx.lineJoin='round';ctx.lineCap='round';
 poly(pts);ctx.strokeStyle='#07111b';ctx.lineWidth=1.12;ctx.stroke();poly(pts);ctx.strokeStyle='#243d50';ctx.lineWidth=.72;ctx.stroke();poly(pts);ctx.strokeStyle=ac;ctx.globalAlpha=.78;ctx.lineWidth=.13;ctx.stroke();ctx.globalAlpha=1;
 ctx.fillStyle='#172b3b';ctx.fillRect(x+1.1,y+.12,Math.max(1,w-2.2),.48);ctx.fillStyle='#29485a';ctx.fillRect(x+1.1,y+.12,Math.max(1,w-2.2),.10);ctx.fillStyle=ac;ctx.globalAlpha=.7;ctx.fillRect(x+1.2,y+.58,Math.max(1,w-2.4),.045);ctx.globalAlpha=1;
 for(let j=0;j<Math.max(2,Math.floor(w/3));j++){const px=x+1.35+j*Math.max(1,(w-2.7)/Math.max(1,Math.floor(w/3)-1));ctx.fillStyle='#426174';ctx.fillRect(px,y+.23,.48,.2);ctx.fillStyle=ac;ctx.globalAlpha=.75;ctx.fillRect(px+.06,y+.27,.08,.12);ctx.globalAlpha=1}
 [[x+.22,y+.22],[x+w-.62,y+.22],[x+.22,y+h-.62],[x+w-.62,y+h-.62]].forEach(([px,py])=>{ctx.fillStyle='#263f50';ctx.fillRect(px,py,.4,.4);ctx.strokeStyle=ac;ctx.lineWidth=.07;ctx.strokeRect(px+.05,py+.05,.3,.3);ctx.fillStyle=ac;ctx.fillRect(px+.16,py+.16,.08,.08)});
 const lamp=(lx,ly)=>{ctx.fillStyle='#101e2a';ctx.fillRect(lx-.43,ly-.16,.86,.32);ctx.fillStyle='#526b78';ctx.fillRect(lx-.35,ly-.11,.7,.22);ctx.fillStyle=ac;ctx.shadowColor=ac;ctx.shadowBlur=1.15;ctx.fillRect(lx-.24,ly-.045,.48,.09);ctx.shadowBlur=0};lamp(cx,y+.84);lamp(cx,y+h-.72);
 if(['cafe','security','nav','shields','comms'].includes(r.kind)){const wy=y+.88;ctx.fillStyle='#081b2a';ctx.fillRect(x+w*.68,wy,Math.min(2.25,w*.24),.55);ctx.fillStyle='#26718a';ctx.fillRect(x+w*.68+.08,wy+.08,Math.min(2.09,w*.24-.16),.36);ctx.fillStyle='#a6f4ff';ctx.globalAlpha=.8;ctx.fillRect(x+w*.70,wy+.12,.12,.05);ctx.globalAlpha=1;ctx.strokeStyle=ac;ctx.lineWidth=.055;ctx.strokeRect(x+w*.68,wy,Math.min(2.25,w*.24),.55)}
 ctx.restore()});


// Interiores temáticos: cada sala tiene siluetas y equipo propio.
visibleRooms.forEach(r=>{const x=r.x,y=r.y,w=r.w,h=r.h,cx=x+w/2,cy=y+h/2;ctx.save();ctx.lineWidth=.09;ctx.strokeStyle='#a9e7e477';ctx.shadowColor='#000b';ctx.shadowBlur=.3;
const desk=(a,b,ww,hh,col)=>{ctx.save();ctx.fillStyle='#0009';ctx.shadowColor='#000';ctx.shadowBlur=.34;ctx.fillRect(a+.22,b+.3,ww,hh);ctx.shadowBlur=0;ctx.fillStyle='#071522';ctx.fillRect(a+.12,b+.15,ww,hh);ctx.fillStyle=col;ctx.fillRect(a,b,ww,hh);ctx.strokeStyle='#d8f4ff77';ctx.strokeRect(a,b,ww,hh);ctx.fillStyle='#ffffff20';ctx.fillRect(a+.08,b+.06,Math.max(.1,ww-.16),.07);ctx.restore()};
const light=(a,b,col='#e8c77b')=>{ctx.fillStyle=col;ctx.shadowColor=col;ctx.shadowBlur=.5;ctx.beginPath();ctx.arc(a,b,.14,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0};
if(r.kind==='cafe'){
 [[-8,-5.4],[8,-5.4],[-8,5.4],[8,5.4]].forEach(([dx,dy],i)=>{const tx=cx+dx,ty=cy+dy;ctx.fillStyle='#0008';ctx.beginPath();ctx.ellipse(tx+.18,ty+.28,1.52,.98,0,0,Math.PI*2);ctx.fill();const top=ctx.createLinearGradient(tx-1.3,ty-.8,tx+1.2,ty+.8);top.addColorStop(0,'#e0b68d');top.addColorStop(.55,'#b88a67');top.addColorStop(1,'#76513f');ctx.fillStyle=top;ctx.beginPath();ctx.ellipse(tx,ty,1.42,.92,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#183447';[[-1.62,-1.42],[1.10,-1.42],[-1.62,.96],[1.10,.96]].forEach(([sx,sy])=>{ctx.fillRect(tx+sx,ty+sy,.52,.48);ctx.fillStyle='#547486';ctx.fillRect(tx+sx+.06,ty+sy+.05,.40,.08);ctx.fillStyle='#183447'});ctx.fillStyle='#fff1d4';ctx.font='bold .38px monospace';ctx.textAlign='center';ctx.fillText('MESA '+(i+1),tx,ty+.12)});
 ctx.fillStyle='#0009';ctx.beginPath();ctx.ellipse(cx+.18,cy+.34,1.86,1.20,0,0,Math.PI*2);ctx.fill();const sosTop=ctx.createRadialGradient(cx-.35,cy-.35,.12,cx,cy,1.9);sosTop.addColorStop(0,'#f4d6b8');sosTop.addColorStop(.58,'#b77b60');sosTop.addColorStop(1,'#623e3b');ctx.fillStyle=sosTop;ctx.beginPath();ctx.ellipse(cx,cy,1.72,1.12,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#f5d4a2';ctx.lineWidth=.13;ctx.stroke();ctx.fillStyle='#fff';ctx.font='bold .42px monospace';ctx.textAlign='center';ctx.fillText('EMERGENCIA',cx,cy-.48);const pulse=.78+.22*Math.sin(tsNow()/180);ctx.save();ctx.shadowColor='#ff263f';ctx.shadowBlur=1.25*pulse;ctx.fillStyle='#7c1428';ctx.beginPath();ctx.arc(cx,cy+.22,.57,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#ffd6d8';ctx.lineWidth=.12;ctx.stroke();ctx.fillStyle='#ff344c';ctx.beginPath();ctx.arc(cx,cy+.22,.43,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.font='bold .30px system-ui';ctx.fillText('SOS',cx,cy+.32);ctx.restore();desk(cx-1.1,y+1.8,2.2,.65,'#8a604a');ctx.fillStyle='#fff1d4';ctx.font='bold .48px monospace';ctx.textAlign='center';ctx.fillText('CAFÉ',cx,y+2.23);
}else if(r.kind==='electrical'){for(let j=0;j<3;j++){desk(x+1.05,y+1+j*2.15,1.05,1.35,['#9b633d','#3f9a79','#477bb0'][j]);['#e85c61','#f0c75c','#6fd39b','#67b8e5'].forEach((c,k)=>{ctx.fillStyle=c;ctx.fillRect(x+1+j*1.8+k*.25,y+2.35,.16,.12)});light(x+1.4+j*1.8,y+1.6)}desk(x+w-1.1,y+3.4,.55,3.2,'#3a4a4b');ctx.save();ctx.translate(x+w-.82,y+5);ctx.rotate(-Math.PI/2);ctx.fillStyle='#f4d36e';ctx.font='bold .38px monospace';ctx.textAlign='center';ctx.fillText('POWER GRID',0,0);ctx.restore();
}else if(r.kind==='reactor'){ctx.fillStyle='#1a263c';ctx.beginPath();ctx.arc(cx,cy,2.15,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#c17dff';ctx.lineWidth=.2;ctx.stroke();ctx.fillStyle='#734fa0';ctx.beginPath();ctx.arc(cx,cy,.9,0,Math.PI*2);ctx.fill();ctx.fillStyle='#e4c9ff';ctx.beginPath();ctx.arc(cx,cy,.38,0,Math.PI*2);ctx.fill();for(let j=0;j<4;j++)desk(cx+Math.cos(j*Math.PI/2)*2.3-.45,cy+Math.sin(j*Math.PI/2)*2.3-.32,.9,.65,'#403c63');
}else if(r.kind==='medbay'){desk(x+.85,y+1.25,1.15,3.1,'#477f86');desk(x+w-2,y+1.25,1.15,3.1,'#315e70');ctx.fillStyle='#c5fff2';ctx.fillRect(cx-.12,y+2.2,.24,.72);ctx.fillRect(cx-.38,y+2.44,.76,.22);light(cx,y+1.4,'#8de8df');
}else if(r.kind==='security'){for(let j=0;j<3;j++){desk(x+1+j*2,y+2,1.65,1.05,'#1e5260');ctx.fillStyle=['#5ed3c7','#e4b765','#8ca9e9'][j];ctx.fillRect(x+1.15+j*2,y+2.18,1.35,.68)}desk(cx-2,y+h-1.5,4,.5,'#334a5a');
}else if(r.kind==='engine'){for(let j=0;j<3;j++){const ex=cx+(j-1)*1.65;desk(ex-.55,cy-1.25,1.1,2.5,'#3d4548');ctx.fillStyle='#f28c56';ctx.shadowColor='#f36c45';ctx.shadowBlur=.5;ctx.beginPath();ctx.arc(ex,cy+.35,.28,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;light(ex,cy-1.45,'#efb86b')}
}else if(r.kind==='storage'){for(let j=0;j<3;j++){desk(x+1.05,y+1+j*2.25,1.35,1.55,['#806447','#536c63','#6c5747'][j]);ctx.strokeStyle='#d9b77c';ctx.strokeRect(x+1.15+j*2,y+2.2,1.25,.7)}desk(x+w-1.25,y+3.3,.65,3.4,'#3d5157');
}else if(r.kind==='admin'){for(let j=0;j<3;j++){desk(x+1.05,y+1+j*2.25,.85,1.5,'#32645a');ctx.fillStyle='#8ce6ce';ctx.fillRect(x+1.15+j*2,y+2.15,1.2,.42)}desk(x+w-1.1,y+3.4,.55,2.2,'#94734e');ctx.fillStyle='#f5d58b';ctx.font='bold .4px monospace';ctx.textAlign='center';ctx.save();ctx.translate(x+w-.82,y+4.5);ctx.rotate(-Math.PI/2);ctx.fillText('ID / ACCESS',0,0);ctx.restore();
}else if(r.kind==='weapons'){desk(x+1,y+2,w-2,1.1,'#61513d');for(let j=0;j<3;j++){ctx.fillStyle='#a7b4bd';ctx.fillRect(x+1.5+j*1.7,y+2.35,.95,.18);ctx.fillRect(x+1.85+j*1.7,y+2.1,.18,.65)}light(cx,y+1.55);
}else if(r.kind==='nav'){desk(x+1,y+2,w-2,1.1,'#315d79');ctx.fillStyle='#7fd9ed';ctx.fillRect(cx-1.35,y+2.18,2.7,.65);ctx.strokeStyle='#b8f1f6';ctx.beginPath();ctx.moveTo(cx-1,y+2.5);ctx.lineTo(cx-.3,y+2.25);ctx.lineTo(cx+.25,y+2.55);ctx.lineTo(cx+1.05,y+2.32);ctx.stroke();
}else if(r.kind==='o2'){for(let j=0;j<3;j++){ctx.fillStyle='#1e716a';ctx.beginPath();ctx.arc(x+1.5+j*2,y+3,.58,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#7de7c9';ctx.stroke();ctx.fillStyle='#a5f3d9';ctx.fillRect(x+1.2+j*2,y+2.92,.6,.12)}
}else if(r.kind==='shields'){desk(x+1,y+2,w-2,1,'#315f75');for(let j=0;j<3;j++){ctx.strokeStyle='#71d8ed';ctx.beginPath();ctx.arc(x+1.7+j*2,y+3.2,.62,Math.PI,Math.PI*2);ctx.stroke()}light(cx,y+1.55,'#79dff2');
}else if(r.kind==='comms'){desk(x+1.05,y+1,1.15,h-2,'#544267');for(let j=0;j<4;j++){ctx.fillStyle=['#e4a95c','#76d6c9','#9c9be8','#e67a89'][j];ctx.fillRect(x+1.3+j*1.15,y+2.3,.72,.5)}ctx.strokeStyle='#b7a1e9';ctx.beginPath();ctx.arc(cx,cy+3.2,1.05,Math.PI,Math.PI*2);ctx.stroke()}
drawRoomEquipmentAccents(r);
drawRoomWallModules(r);
ctx.restore()});
visibleRooms.forEach(r=>{
 const label=ROOM_SIGNATURES[r.id],accent=ROOM_SIGNATURE_COLORS[r.id]||'#76d8e8';
 if(!label)return;
 const px=r.x+r.w-3.25,py=r.y+1.38;
 ctx.save();ctx.fillStyle='#071522';ctx.fillRect(px,py,2.9,.43);
 ctx.strokeStyle=accent;ctx.globalAlpha=.85;ctx.lineWidth=.055;ctx.strokeRect(px,py,2.9,.43);
 ctx.fillStyle=accent;ctx.fillRect(px+.09,py+.09,.055,.25);
 ctx.globalAlpha=1;ctx.fillStyle='#d9f4fa';ctx.font='bold .27px monospace';ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillText(label,px+.24,py+.22);
 ctx.restore();
});
visibleRooms.forEach(r=>(r.doors||[]).forEach(d=>{const cx=r.x+r.w*d.offset,cy=r.y+r.h*d.offset,ww=d.width||2.35;ctx.save();ctx.lineWidth=.12;ctx.strokeStyle='#d9f5ff';ctx.fillStyle='#31566a';if(d.side==='top'||d.side==='bottom'){const yy=d.side==='top'?r.y-.12:r.y+r.h-.38;ctx.fillRect(cx-ww/2,yy,ww,.5);ctx.strokeRect(cx-ww/2,yy,ww,.5);ctx.fillStyle='#9de8ec';ctx.fillRect(cx-ww/2,yy,.12,.5);ctx.fillRect(cx+ww/2-.12,yy,.12,.5)}else{const xx=d.side==='left'?r.x-.12:r.x+r.w-.38;ctx.fillRect(xx,cy-ww/2,.5,ww);ctx.strokeRect(xx,cy-ww/2,.5,ww);ctx.fillStyle='#9de8ec';ctx.fillRect(xx,cy-ww/2,.5,.12);ctx.fillRect(xx,cy+ww/2-.12,.5,.12)}
 // Hojas correderas, guía superior, carriles inferiores y sensores de bloqueo.
 if(d.side==='top'||d.side==='bottom'){
  const yy=d.side==='top'?r.y+.02:r.y+r.h-.02;
  ctx.fillStyle='#091723';ctx.fillRect(cx-ww*.36,yy-.12,ww*.72,.24);
  ctx.fillStyle='#547789';ctx.fillRect(cx-ww*.32,yy-.035,ww*.64,.07);
  ctx.fillStyle='#1c3545';ctx.fillRect(cx-ww*.31,yy-.48,ww*.30,.36);ctx.fillRect(cx+ww*.01,yy-.48,ww*.30,.36);
  ctx.strokeStyle='#9bc9d8';ctx.lineWidth=.045;ctx.strokeRect(cx-ww*.31,yy-.48,ww*.30,.36);ctx.strokeRect(cx+ww*.01,yy-.48,ww*.30,.36);
  ctx.fillStyle='#78e6d8';ctx.fillRect(cx-ww*.045,yy-.36,.09,.12);
 }else{
  const xx=d.side==='left'?r.x+.02:r.x+r.w-.02;
  ctx.fillStyle='#091723';ctx.fillRect(xx-.12,cy-ww*.36,.24,ww*.72);
  ctx.fillStyle='#547789';ctx.fillRect(xx-.035,cy-ww*.32,.07,ww*.64);
  ctx.fillStyle='#1c3545';ctx.fillRect(xx-.48,cy-ww*.31,.36,ww*.30);ctx.fillRect(xx-.48,cy+ww*.01,.36,ww*.30);
  ctx.strokeStyle='#9bc9d8';ctx.lineWidth=.045;ctx.strokeRect(xx-.48,cy-ww*.31,.36,ww*.30);ctx.strokeRect(xx-.48,cy+ww*.01,.36,ww*.30);
  ctx.fillStyle='#78e6d8';ctx.fillRect(xx-.36,cy-.045,.12,.09);
 }
 ctx.fillStyle='#eac76d';ctx.shadowColor='#eac76d';ctx.shadowBlur=.35;
 if(d.side==='top'||d.side==='bottom'){ctx.fillRect(cx-ww*.42,(d.side==='top'?r.y-.22:r.y+r.h-.02),.12,.10);ctx.fillRect(cx+ww*.30,(d.side==='top'?r.y-.22:r.y+r.h-.02),.12,.10)}
 else{ctx.fillRect((d.side==='left'?r.x-.22:r.x+r.w-.02),cy-ww*.42,.10,.12);ctx.fillRect((d.side==='left'?r.x-.22:r.x+r.w-.02),cy+ww*.30,.10,.12)}
 ctx.shadowBlur=0;
ctx.restore()}));
if(gameState?.sabotage?.active&&gameState.sabotage.type==='doors'){ctx.save();const doorPulse=.55+.45*Math.sin(tsNow()/145);ctx.globalAlpha=.65+.35*doorPulse;ctx.strokeStyle='#ff596b';ctx.shadowColor='#ff304f';ctx.shadowBlur=.6+doorPulse*.6;ctx.lineWidth=.22+doorPulse*.12;ctx.beginPath();ctx.moveTo(58.8,22.5);ctx.lineTo(61.2,22.5);ctx.moveTo(58.8,47.5);ctx.lineTo(61.2,47.5);ctx.moveTo(44,33.8);ctx.lineTo(44,36.2);ctx.moveTo(76,33.8);ctx.lineTo(76,36.2);ctx.stroke();ctx.restore()}
if(gameState?.sabotage?.active&&gameState.sabotage.type==='lights'){const pulse=.35+.65*(.5+.5*Math.sin(tsNow()/115));visibleRooms.forEach(r=>{[[r.x+.55,r.y+.55],[r.x+r.w-.55,r.y+.55],[r.x+.55,r.y+r.h-.55],[r.x+r.w-.55,r.y+r.h-.55]].forEach(([lx,ly])=>{ctx.save();ctx.globalAlpha=pulse;ctx.fillStyle='#ff1f35';ctx.shadowColor='#ff1028';ctx.shadowBlur=.8;ctx.beginPath();ctx.arc(lx,ly,.12,0,Math.PI*2);ctx.fill();ctx.restore()})});MAP.corridors.forEach(c=>c.points.forEach(([lx,ly])=>{ctx.save();ctx.globalAlpha=pulse;ctx.fillStyle='#ff3045';ctx.shadowColor='#ff1028';ctx.shadowBlur=.9;ctx.beginPath();ctx.arc(lx,ly,.16,0,Math.PI*2);ctx.fill();ctx.restore()}))}
window.StarshipWorldV3?.draw(ctx,{...MAP,rooms:visibleRooms},tsNow());drawWorldAnimationFX(tsNow(),cx,cy,vw,vh);MAP.tasks.forEach(t=>{const done=gameState?.players?.[playerId]?.done?.includes(t.id);ctx.save();ctx.fillStyle=done?'#48d39c':'#ffd36b';ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=.22;ctx.beginPath();ctx.arc(t.x,t.y,.19,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle='#132331';ctx.lineWidth=.055;ctx.stroke();ctx.restore()});
// Estaciones de misión: terminal físico, icono propio y X luminosa flotante.
if(p?.role==='crew'){const pending=(p.tasks||[]).filter(t=>!p.done?.includes(t.id)).map(t=>({...t,station:MAP.tasks.find(m=>m.id===(t.stationId||t.id))})).filter(t=>t.station).map(t=>({...t,d:Math.hypot(p.x-t.station.x,p.y-t.station.y)})).sort((a,b)=>a.d-b.d);const target=pending[0]?.station;if(target){const ang=Math.atan2(target.y-p.y,target.x-p.x);ctx.save();ctx.translate(p.x,p.y-3.05);ctx.rotate(ang);ctx.globalAlpha=.8+.2*Math.sin(tsNow()/180);ctx.shadowColor='#ffd84f';ctx.shadowBlur=.65;ctx.strokeStyle='#ffe16b';ctx.lineWidth=.13;ctx.beginPath();ctx.moveTo(-.45,0);ctx.lineTo(.50,0);ctx.stroke();ctx.beginPath();ctx.moveTo(.20,-.24);ctx.lineTo(.52,0);ctx.lineTo(.20,.24);ctx.stroke();ctx.beginPath();ctx.arc(0,0,.42,0,Math.PI*2);ctx.strokeStyle='#ffe16b88';ctx.lineWidth=.055;ctx.stroke();ctx.restore()}}MAP.tasks.forEach((t,i)=>{ctx.save();const x=t.x,y=t.y;const glyph={card:'▤',wires:'⌁',sequence:'ϟ',route:'⌖',filter:'✣',fuel:'⛽',upload:'▣',scan:'✚'}[t.type]||'◆';const col={card:'#f4c86b',wires:'#65d9ed',sequence:'#c58aff',route:'#7fcaff',filter:'#73e6b5',fuel:'#f29b5c',upload:'#9daeff',scan:'#8ce8dc'}[t.type]||'#ffe17a';ctx.shadowColor=col;ctx.shadowBlur=.9;ctx.fillStyle='#071522';ctx.strokeStyle=col;ctx.lineWidth=.13;roundedRect(ctx,x-.43,y-.43,.86,.86,.15);ctx.fill();ctx.stroke();ctx.shadowBlur=0;ctx.fillStyle=col;ctx.font='bold .58px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(glyph,x,y+.04);const pulse=.72+.28*Math.sin(tsNow()/210+i);ctx.globalAlpha=pulse;ctx.shadowColor='#ff526b';ctx.shadowBlur=.85;ctx.fillStyle='#ff526b';ctx.font='bold .9px system-ui';ctx.fillText('✕',x,y-1.02);ctx.restore()});if(gameState)Object.values(gameState.players||{}).filter(q=>!q.alive&&!q.expelled&&(!q.body||!q.body.reported)&&Number.isFinite(q.body?.x??q.x)).forEach(q=>{
 ctx.save();ctx.translate(q.body?.x??q.x,q.body?.y??q.y);const pulse=.5+.5*Math.sin(tsNow()/240+q.x);
 const aura=ctx.createRadialGradient(0,0,.1,0,0,1.2);aura.addColorStop(0,'#e93e5e8c');aura.addColorStop(1,'#9a193300');
 ctx.fillStyle=aura;ctx.beginPath();ctx.ellipse(0,0,1.25,.82,0,0,Math.PI*2);ctx.fill();
 ctx.strokeStyle='#ff6679';ctx.lineWidth=.065;ctx.globalAlpha=.35+.28*pulse;ctx.beginPath();ctx.ellipse(0,.07,1.10+.1*pulse,.65+.06*pulse,tsNow()/1800,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;
 // The body is the SAME Monguito mesh, fallen sideways (not a second dead-character model).
 ctx.save();ctx.rotate(-Math.PI/2+.09);ctx.scale(.68,.68);
 window.StarshipVisual.canvas(ctx,0,0,avatarAppearance(q),{moving:false,phase:0,time:tsNow(),seed:0});
 ctx.restore();
 ctx.fillStyle='#ffe1e1';ctx.font='bold .36px system-ui';ctx.textAlign='center';ctx.fillText('✕',.68,-.23);
 ctx.restore();
});
MAP.vents.forEach((v,i)=>{const active=!!(p?.inVent&&p.ventId===v.id),pulse=.5+.5*Math.sin(tsNow()/190+i*1.6);ctx.save();ctx.translate(v.x,v.y);ctx.fillStyle='#030b13';ctx.strokeStyle=active?'#d6ffff':'#8bdde7';ctx.lineWidth=active?.18:.12;ctx.shadowColor=active?'#75f5ff':'#2ab6ca';ctx.shadowBlur=active?1.2:.22;roundedRect(ctx,-.78,-.48,1.56,.96,.18);ctx.fill();ctx.stroke();ctx.shadowBlur=0;ctx.fillStyle='#20394a';roundedRect(ctx,-.65,-.36,1.3,.72,.12);ctx.fill();ctx.strokeStyle='#65899b';ctx.lineWidth=.075;for(let k=-2;k<=2;k++){ctx.beginPath();ctx.moveTo(k*.22,-.29);ctx.lineTo(k*.22,.29);ctx.stroke()}ctx.fillStyle=active?'#d7ffff':'#8bdde7';ctx.globalAlpha=.65+.35*pulse;ctx.fillRect(-.48,-.055,.96,.07);ctx.globalAlpha=1;ctx.fillStyle='#e2fbff';ctx.fillRect(-.06,-.16,.12,.28);ctx.strokeStyle='#8cefff';ctx.globalAlpha=.28+.42*pulse;ctx.lineWidth=.055;ctx.beginPath();ctx.arc(0,0,.61+pulse*.10,0,Math.PI*2);ctx.stroke();ctx.restore()});
if(gameState)Object.values(gameState.players||{}).filter(q=>(q.alive||!p?.alive)&&!q.inVent).sort((a,b)=>a.y-b.y).forEach(q=>{ctx.save();if(!q.alive)ctx.globalAlpha=.4;window.StarshipVisual.canvas(ctx,q.x,q.y,avatarAppearance(q),{moving:!!q._moving,phase:q._walkPhase||0,faceX:q._faceX??1,time:tsNow(),seed:String(q.id).length});ctx.restore()});
drawVentWorldGuides();drawVisibleVentTransition();
// Capa de iluminación separada: la máscara oscura no destruye el render del escenario.
if(!window.__starshipLightLayer){window.__starshipLightLayer=document.createElement('canvas');}
const lightCanvas=window.__starshipLightLayer;
if(lightCanvas.width!==canvas.width)lightCanvas.width=canvas.width;
if(lightCanvas.height!==canvas.height)lightCanvas.height=canvas.height;
const lightCtx=lightCanvas.getContext('2d');
lightCtx.setTransform(dpr,0,0,dpr,0,0);lightCtx.clearRect(0,0,w,h);lightCtx.save();lightCtx.scale(z,z);lightCtx.translate(-cx,-cy);
lightCtx.fillStyle='rgba(1,6,13,1)';lightCtx.fillRect(cx,cy,vw,vh);
lightCtx.globalCompositeOperation='destination-out';
const cutLight=(lx,ly,rad,strength=1)=>{
 const grad=lightCtx.createRadialGradient(lx,ly,.12,lx,ly,rad);
 grad.addColorStop(0,'rgba(0,0,0,'+strength+')');grad.addColorStop(.58,'rgba(0,0,0,'+(strength*.98)+')');grad.addColorStop(.82,'rgba(0,0,0,'+(strength*.78)+')');grad.addColorStop(.94,'rgba(0,0,0,'+(strength*.28)+')');grad.addColorStop(1,'rgba(0,0,0,0)');
 lightCtx.fillStyle=grad;lightCtx.beginPath();lightCtx.arc(lx,ly,rad,0,Math.PI*2);lightCtx.fill();
};
 // La luz del jugador se recorta con un polígono de visibilidad: paredes,
 // mesas y maquinaria proyectan sombras reales sobre el campo de visión.
 const cutOccludedLight=(lx,ly,rad,strength=1)=>{
  const polygon=visibilityPolygon(lx,ly,rad);
  if(polygon.length<3){cutLight(lx,ly,rad,strength);return}
  lightCtx.save();lightCtx.beginPath();
  polygon.forEach((pt,i)=>i?lightCtx.lineTo(pt[0],pt[1]):lightCtx.moveTo(pt[0],pt[1]));
  lightCtx.closePath();lightCtx.clip();cutLight(lx,ly,rad,strength);lightCtx.restore();
 };
/* Las luces de las salas no atraviesan el campo de visión del jugador. */
if(p){
 const lightsSabotage=gameState?.sabotage?.active&&gameState.sabotage.type==='lights'&&p.role!=='impostor';
 // Compatibilidad con el validador histórico: la visión real se ajusta justo debajo.
 // const visionRadius=lightsSabotage?6.7*0.34:(p.role==='impostor'?10.5:6.7)
 const visionRadius=lightsSabotage?3.7:(p.role==='impostor'?(gameState.settings?.impostorVision||12):(gameState.settings?.crewVision||10.5));
 const lp=ventFocus?{x:focusX,y:focusY}:p;
 if(p.alive)cutOccludedLight(lp.x,lp.y,visionRadius,1);else cutLight(lp.x,lp.y,25,1);
}

lightCtx.restore();ctx.save();ctx.setTransform(dpr,0,0,dpr,0,0);ctx.drawImage(lightCanvas,0,0,w,h);ctx.restore();
 // Balizas rojas del sabotaje, dibujadas por encima de la máscara de oscuridad.
 if(gameState?.sabotage?.active&&gameState.sabotage.type==='lights'){ctx.save();ctx.setTransform(dpr,0,0,dpr,0,0);ctx.globalCompositeOperation='multiply';ctx.globalAlpha=.42;ctx.fillStyle='#b51f32';ctx.fillRect(0,0,w,h);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';const pulse=.55+.45*(.5+.5*Math.sin(tsNow()/110));const beacon=(wx,wy)=>{const x=(wx-cx)*z,y=(wy-cy)*z;if(x< -12||y< -12||x>w+12||y>h+12||p?.alive&&!window.StarshipRules.lineClear(p,{x:wx,y:wy},gameState?.sabotage))return;ctx.globalAlpha=pulse;ctx.fillStyle='#ff243d';ctx.shadowColor='#ff1028';ctx.shadowBlur=16;ctx.beginPath();ctx.arc(x,y,4.2,0,Math.PI*2);ctx.fill();ctx.globalAlpha=.32;ctx.beginPath();ctx.arc(x,y,9,0,Math.PI*2);ctx.fill();};visibleRooms.forEach(r=>[[r.x+.55,r.y+.55],[r.x+r.w-.55,r.y+.55],[r.x+.55,r.y+r.h-.55],[r.x+r.w-.55,r.y+r.h-.55]].forEach(q=>beacon(q[0],q[1])));MAP.corridors.forEach(c=>c.points.forEach(q=>beacon(q[0],q[1])));ctx.restore();}
 // Línea roja dinámica hacia el siguiente punto de reparación.
 if(p?.alive&&p.role==='crew'&&gameState?.sabotage?.active){const target=activeRepairStations().sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];if(target){const x1=(p.x-cx)*z,y1=(p.y-cy)*z,x2=(target.x-cx)*z,y2=(target.y-cy)*z,ang=Math.atan2(y2-y1,x2-x1);ctx.save();ctx.setTransform(dpr,0,0,dpr,0,0);ctx.strokeStyle='#ff263f';ctx.fillStyle='#ff263f';ctx.lineWidth=3;ctx.shadowColor='#ff1028';ctx.shadowBlur=12;ctx.setLineDash([10,7]);ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();ctx.setLineDash([]);ctx.beginPath();ctx.arc(x2,y2,6,0,Math.PI*2);ctx.fill();ctx.translate(x2,y2);ctx.rotate(ang);ctx.beginPath();ctx.moveTo(-13,-9);ctx.lineTo(0,0);ctx.lineTo(-13,9);ctx.stroke();ctx.restore();}}
 // Name tags en coordenadas de pantalla: tamaño constante en PC y móvil,
 // independientemente del zoom de cámara y de la resolución del monitor.
 const nameOrigin=p;const nameView=nameOrigin?visibilityPolygon(nameOrigin.x,nameOrigin.y,(gameState?.sabotage?.active&&gameState.sabotage.type==='lights'&&p.role!=='impostor'?3.7:(p.role==='impostor'?(gameState.settings?.impostorVision||12):(gameState.settings?.crewVision||10.5)))):null;
 if(gameState){
  ctx.save();
  ctx.setTransform(dpr,0,0,dpr,0,0);
  const tagFont=w<640?11:13,tagHeight=w<640?19:21,maxTagWidth=Math.min(190,Math.max(100,w*.24));
  Object.values(gameState.players||{}).filter(q=>q.alive&&!q.inVent).forEach(q=>{
   if(p?.alive&&(!nameView||!pointInPoly(q.x,q.y,nameView)))return;
   const label=String(q.name||'Player').slice(0,16),sx=(q.x-cx)*z,headY=(q.y-cy)*z-1.78*z;
   if(sx<0||sx>w)return;
   ctx.save();
   ctx.font='600 '+tagFont+'px system-ui,-apple-system,Segoe UI,sans-serif';
   ctx.textAlign='center';ctx.textBaseline='middle';
   const textWidth=Math.min(maxTagWidth-18,ctx.measureText(label).width),boxWidth=Math.max(38,textWidth+18),centerY=headY-tagHeight/2-3;
   ctx.fillStyle='rgba(3,13,23,.88)';
   roundedRect(ctx,sx-boxWidth/2,centerY-tagHeight/2,boxWidth,tagHeight,6);ctx.fill();
   ctx.strokeStyle='rgba(137,220,237,.78)';ctx.lineWidth=1;ctx.stroke();
   ctx.fillStyle=q.role==='impostor'&&p?.role==='impostor'?'#ff8396':'#fff';ctx.fillText(label,sx,centerY,maxTagWidth-18);
   ctx.restore();
  });
  ctx.restore();
 }
 // La penumbra queda fuera del radio de visión, como en una partida real de Among Us.
ctx.restore();drawVentTargets(w,h,{dpr});}catch(err){console.error('STARSHIP draw error:',err);drawMapFallback()}}
function drawMapFallback(){try{if(!ctx||!canvas)return;const w=canvas.clientWidth,h=canvas.clientHeight;if(w<2||h<2)return;const k=Math.min((w-24)/MAP.w,(h-24)/MAP.h),ox=(w-MAP.w*k)/2,oy=(h-MAP.h*k)/2;ctx.clearRect(0,0,w,h);ctx.fillStyle='#030914';ctx.fillRect(0,0,w,h);ctx.save();ctx.translate(ox,oy);ctx.scale(k,k);MAP.rooms.forEach(r=>{const p=roomPolygon(r);ctx.beginPath();p.forEach((q,i)=>i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]));ctx.closePath();ctx.fillStyle=r.color;ctx.fill();ctx.strokeStyle='#d5f4ff';ctx.lineWidth=.12;ctx.stroke();ctx.fillStyle='#fff';ctx.font='bold .7px system-ui';ctx.textAlign='center';ctx.fillText(tr(r.name),r.x+r.w/2,r.y+r.h/2)});MAP.corridors.forEach(c=>{ctx.strokeStyle='#35566a';ctx.lineWidth=c.width;ctx.lineCap='square';ctx.lineJoin='miter';ctx.beginPath();c.points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.stroke()});Object.values(gameState?.players||{}).filter(q=>q.alive&&!q.inVent).sort((a,b)=>a.y-b.y).forEach(q=>{const x=q.x,y=q.y,c=q.color||'#e85d75';ctx.save();ctx.translate(x,y);ctx.fillStyle='#07121e';ctx.beginPath();ctx.ellipse(0,.02,.58,.19,0,0,Math.PI*2);ctx.fill();ctx.fillStyle=c;ctx.strokeStyle='#07121e';ctx.lineWidth=.11;roundedRect(ctx,-.58,-1.55,1.16,1.42,.46);ctx.fill();ctx.stroke();ctx.fillStyle='#17445f';ctx.strokeStyle='#09283a';ctx.lineWidth=.08;roundedRect(ctx,-.02,-1.39,.79,.44,.22);ctx.fill();ctx.stroke();ctx.fillStyle='#fff';ctx.font='bold .42px system-ui';ctx.textAlign='center';ctx.fillText(q.name||'Player',0,-1.82);ctx.restore()});ctx.restore()}catch(err){console.error('STARSHIP fallback error',err)}}
function polylineHull(g,pts){g.beginPath();pts.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.closePath();g.stroke()}
function drawMiniMap(){const c=$('miniMap');if(!c)return;const g=c.getContext('2d'),w=c.width,h=c.height,k=Math.min((w-20)/MAP.w,(h-20)/MAP.h);g.clearRect(0,0,w,h);g.save();g.translate((w-MAP.w*k)/2,(h-MAP.h*k)/2);g.scale(k,k);g.globalAlpha=.76;MAP.rooms.forEach(r=>{const pts=roomPolygon(r);g.beginPath();pts.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.closePath();g.fillStyle=r.color;g.fill();g.strokeStyle='#d5f4ff';g.lineWidth=.12;g.stroke();g.save();g.font='bold .78px system-ui';g.textAlign='center';g.textBaseline='middle';const label=r.name.replace('ADMINISTRACIÓN','ADMIN').replace('COMUNICACIONES','COMMS').replace('MOTOR SUPERIOR','MOTOR SUP.').replace('MOTOR INFERIOR','MOTOR INF.');const tw=g.measureText(label).width+.55;g.fillStyle='#06111ddd';g.fillRect(r.x+r.w/2-tw/2,r.y+r.h/2-.48,tw,.96);g.fillStyle='#f4fbff';g.shadowColor='#000';g.shadowBlur=.18;g.fillText(label,r.x+r.w/2,r.y+r.h/2);g.restore()});MAP.corridors.forEach(c=>{g.strokeStyle='#35566a';g.lineWidth=c.width;g.lineCap='square';g.lineJoin='miter';g.beginPath();c.points.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.stroke()});const p=gameState?.players?.[playerId];g.globalAlpha=1;if(p){g.fillStyle='#fff';g.shadowColor='#63f5ff';g.shadowBlur=.45;g.beginPath();g.arc(p.x,p.y,.5,0,Math.PI*2);g.fill();g.shadowBlur=0}g.restore()}
function resize(){try{canvas=$('world');if(!canvas)return;const rect=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,v4Preferences.quality==='low'?1:v4Preferences.quality==='high'?2:1.5),w=Math.max(1,Math.floor(rect.width||window.innerWidth)),h=Math.max(1,Math.floor(rect.height||window.innerHeight));if(canvas.width!==w*dpr)canvas.width=w*dpr;if(canvas.height!==h*dpr)canvas.height=h*dpr;ctx=canvas.getContext('2d',{alpha:false});if(ctx){ctx.setTransform(dpr,0,0,dpr,0,0);drawMapFallback()}try{drawMiniMap()}catch(e){console.warn('Mini mapa no disponible',e)}}catch(e){console.error('Error al redimensionar el escenario',e);drawMapFallback()}}
function pointInPoly(x,y,pts){let inside=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const a=pts[i],b=pts[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside}return inside}
function corridorContains(x,y,c){const half=c.width/2+.08;for(let i=1;i<c.points.length;i++){const a=c.points[i-1],b=c.points[i],dx=b[0]-a[0],dy=b[1]-a[1],len2=dx*dx+dy*dy,t=len2?Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/len2)):0,px=a[0]+t*dx,py=a[1]+t*dy;if(Math.hypot(x-px,y-py)<=half)return true}return false}
function pointInRoom(x,y,room){const p=roomPolygon(room);let inside=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if(((a[1]>y)!==(b[1]>y))&&(x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]))inside=!inside}return inside}
function distanceToPath(x,y,points){let best=Infinity;for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy,t=l?Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/l)):0;best=Math.min(best,Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t))}return best}
function inFloor(x,y){if(x<0||y<0||x>MAP.w||y>MAP.h)return false;if(MAP.rooms.some(r=>pointInRoom(x,y,r)))return true;return MAP.corridors.some(c=>distanceToPath(x,y,c.points)<=c.width/2-.08)}
function blocked(x,y){return !inFloor(x,y)}
// Colisión circular del tripulante: evita que el centro pase pegado al borde de paredes.
function blockedByRoomWall(x,y,clearance=.34){
 for(const r of MAP.rooms){
  const door=(side,along)=>((r.doors||[]).some(d=>d.side===side&&Math.abs(along-(d.offset*(side==='top'||side==='bottom'?r.w:r.h)))<=((d.width||2.35)/2-clearance*.35)));
  if(x>=r.x-clearance&&x<=r.x+r.w+clearance){
   if(Math.abs(y-r.y)<clearance&&!door('top',x-r.x))return true;
   if(Math.abs(y-(r.y+r.h))<clearance&&!door('bottom',x-r.x))return true;
  }
  if(y>=r.y-clearance&&y<=r.y+r.h+clearance){
   if(Math.abs(x-r.x)<clearance&&!door('left',y-r.y))return true;
   if(Math.abs(x-(r.x+r.w))<clearance&&!door('right',y-r.y))return true;
  }
 }
 return false;
}
function collidesFurniture(x,y,radius=.34){
 for(const o of MAP.obstacles||[]){
  if(o.kind==='circle'){
   if(Math.hypot(x-o.x,y-o.y)<o.r+radius)return true;
  }else if(o.kind==='ellipse'){
   const rx=o.rx+radius,ry=o.ry+radius;
   if(((x-o.x)/rx)**2+((y-o.y)/ry)**2<1)return true;
  }else{
   const px=Math.max(o.x,Math.min(x,o.x+o.w)),py=Math.max(o.y,Math.min(y,o.y+o.h));
   if(Math.hypot(x-px,y-py)<radius+.06)return true;
  }
 }
 return false;
}
function canWalk(x,y){return window.StarshipRules.walkable(x,y,gameState?.sabotage);}
function openSecurityCameras(){
 const p=gameState?.players?.[playerId],room=MAP.rooms.find(r=>r.id==='security');
 if(gameState?.sabotage?.active&&gameState.sabotage.type==='comms')return toast(tr('COMUNICACIONES INTERFERIDAS'));
 if(!p?.alive||p.inVent||gameState?.meeting||gameState?.phase!=='playing'||!room||!pointInRoom(p.x,p.y,room)){
  toast('ENTRA EN LA SALA DE SEGURIDAD PARA UTILIZAR LAS CÁMARAS.');return;
 }
 securityCameraIndex=0; // Monitoring-state flag; never redirects the primary camera.
 $('securityPanel').classList.remove('hidden');
 window.StarshipCCTV?.reset();
 window.StarshipCCTV?.render({panel:$('securityPanel'),map:MAP,state:gameState,cameras:SECURITY_CAMERAS,appearance:avatarAppearance,time:performance.now(),world:window.StarshipWorldV3});
 $('securityClose')?.focus();
}
function closeSecurityCameras(){
 securityCameraIndex=-1;$('securityPanel').classList.add('hidden');
 $('securityBtn')?.focus();
}
function updateRepairArrow(){const el=$('repairArrow'),p=gameState?.players?.[playerId],sab=gameState?.sabotage;if(!el)return;if(!p||p.role!=='crew'||!p.alive||!sab?.active){el.classList.add('hidden');return}const target=activeRepairStations().sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];if(!target){el.classList.add('hidden');return}const angle=Math.atan2(target.y-p.y,target.x-p.x)*180/Math.PI;el.style.transform='translateX(-50%) rotate('+(angle-90)+'deg)';el.classList.remove('hidden');el.querySelector('small').textContent='REPARAR · '+String(sab.type||'AVERÍA').toUpperCase()}
$('securityBtn').onclick=openSecurityCameras;$('securityClose').onclick=closeSecurityCameras;
$('endContinue').onclick=()=>{if(soloMode){location.reload();return}$('end').classList.add('hidden');$('moreMenu').classList.remove('hidden')};
let previousFrame=0,monguitoWalkPhase=0,v4LastDraw=0;
function loop(ts=0){const dt=previousFrame?Math.max(0,Math.min(.25,(ts-previousFrame)/1000)):.016;previousFrame=ts||previousFrame;try{if(!$('game').classList.contains('hidden')){if(!canvas||canvas!==$('world')||!ctx||canvas.getBoundingClientRect().width<2||canvas.getBoundingClientRect().height<2)resize();const p=gameState?.players?.[playerId];if(securityCameraIndex>=0&&(gameState?.meeting||gameState?.phase!=='playing'||!p?.alive||p.inVent))closeSecurityCameras();if(gameState?.phase==='playing'){Object.values(gameState.players||{}).forEach(q=>{if(q.id===playerId)return;const age=Math.max(0,Math.min(.16,(performance.now()-(q._receivedAt||performance.now()))/1000));const tx=q._targetX+(q._netVx||0)*age,ty=q._targetY+(q._netVy||0)*age;if(!Number.isFinite(tx)||!Number.isFinite(ty))return;const dx=tx-q.x,dy=ty-q.y,d=Math.hypot(dx,dy);q._moving=d>.035;if(Math.abs(dx)>.01)q._faceX=dx<0?-1:1;if(q._moving)q._walkPhase=(q._walkPhase||0)+dt*13;if(d>8){q.x=tx;q.y=ty;q._renderVx=0;q._renderVy=0;return}const blend=1-Math.exp(-dt*9);q.x+=dx*blend;q.y+=dy*blend;q._renderVx=dx/Math.max(dt,.001);q._renderVy=dy/Math.max(dt,.001)})}correctLocal4(dt);updateRepairArrow();refreshActionAvailability();if(soloMode&&gameState?.sabotage?.active&&gameState.sabotage.endsAt&&Date.now()>=gameState.sabotage.endsAt){if(['reactor','o2'].includes(gameState.sabotage.type))finishMatch('impostor');else{gameState.sabotage.active=false;}}if(gameState?.phase==='playing'&&p&&!p.inVent&&!gameState.meeting&&securityCameraIndex<0&&$('modal').classList.contains('hidden')&&$('settings4').classList.contains('hidden')&&$('info4').classList.contains('hidden')){let dx=(keys.d||keys.D||keys.ArrowRight?1:0)-(keys.a||keys.A||keys.ArrowLeft?1:0)+Number(move.x||0),dy=((keys.s||keys.S)||keys.ArrowDown||keys.x||keys.X?1:0)-(keys.w||keys.W||keys.ArrowUp?1:0)+Number(move.y||0),mag=Math.hypot(dx,dy);if(mag>1){dx/=mag;dy/=mag}const speed=(gameState.settings?.speed||5.2)*MAP_SCALE;p._moving=mag>.08;if(Math.abs(dx)>.08)p._faceX=dx<0?-1:1;monguitoWalkPhase+=dt*(p._moving?13:3);p._walkPhase=monguitoWalkPhase;const distance=speed*dt,steps=Math.max(1,Math.ceil(distance/.12));for(let step=0;step<steps;step++){const nx=p.x+dx*distance/steps,ny=p.y+dy*distance/steps;if(dx&&(!p.alive?nx>0&&nx<MAP.w:canWalk(nx,p.y)))p.x=nx;if(dy&&(!p.alive?ny>0&&ny<MAP.h:canWalk(p.x,ny)))p.y=ny}if(p._moving&&Date.now()-lastMove>70){lastMove=Date.now();moveUpdate()}else if(!p._moving&&Date.now()-lastMove>160){lastMove=Date.now();moveUpdate()} }if(p&&p._moving&&!p.inVent&&Date.now()-v4LastPathAt>=90){v4LastPathAt=Date.now();v4MovePath.push({x:p.x,y:p.y,seq:++v4InputSeq});if(v4MovePath.length>40)v4MovePath.shift();}try{if(ts-v4LastDraw>=(v4Preferences.quality==='high'?16:v4Preferences.quality==='low'?50:33)){v4LastDraw=ts;draw()}}catch(e){console.error('Fallo del render principal',e);drawMapFallback()}
 if(securityCameraIndex>=0&&gameState?.phase==='playing'){
  try{window.StarshipCCTV?.render({panel:$('securityPanel'),map:MAP,state:gameState,cameras:SECURITY_CAMERAS,appearance:avatarAppearance,time:ts,world:window.StarshipWorldV3})}
  catch(e){console.error('Fallo del CCTV de cuatro salas',e)}
 }}}catch(e){console.error('Fallo del bucle de juego',e);try{resize();drawMapFallback()}catch(renderError){console.error('Fallo del render de emergencia',renderError)}}finally{raf=requestAnimationFrame(loop)}}
function startExplore(){try{clearInterval(poll);poll=null;soloMode=true;isHost=false;cameraIntro=null;cameraIntroPlayed=true;roleRevealShown=true;makeMe();const tasks=MAP.tasks.map(t=>({id:t.id,stationId:t.id,name:t.name,room:t.room}));gameState={phase:'playing',players:{[playerId]:{...me,role:'crew',alive:true,done:[],tasks}},meeting:null,completed:0,required:tasks.length,createdAt:Date.now(),exploration:true};const exploreSpawn=getCafeteriaSpawnPoints(1)[0];gameState.players[playerId].x=exploreSpawn.x;gameState.players[playerId].y=exploreSpawn.y;players=[gameState.players[playerId]];$('connect').classList.add('hidden');$('lobby').classList.add('hidden');startGameUI();toast('Modo exploración: estás solo en la nave.');}catch(e){console.error(e);say('No se pudo abrir la exploración: '+e.message,true);}}

const SHOP_ITEMS=window.StarshipData.items;
const DAILY_SHOP_SIZE=8,DAILY_START_HOUR=19;
function dailyShopWindow(now=new Date()){const d=window.StarshipRules.daily(now.getTime()+v4ClockOffset);return {start:new Date(d.next-86400000),next:new Date(d.next),index:d.index}}
function dailyShopItems(){return window.StarshipRules.daily(Date.now()+v4ClockOffset).items}
function formatShopTimer(ms){const sec=Math.max(0,Math.floor(ms/1000)),h=Math.floor(sec/3600),m=Math.floor(sec%3600/60),s=sec%60;return [h,m,s].map(v=>String(v).padStart(2,'0')).join(':')}
let shopTimer=null,shopCycleSeen=dailyShopWindow().index;
function updateShopTimer(){const el=$('dailyShopTimer');if(!el)return;const w=dailyShopWindow();el.textContent='NUEVA TIENDA EN '+formatShopTimer(w.next-Date.now());if(w.index!==shopCycleSeen){shopCycleSeen=w.index;renderShop();toast('¡La tienda diaria se ha renovado!')}}
function startShopTimer(){clearInterval(shopTimer);shopCycleSeen=dailyShopWindow().index;updateShopTimer();shopTimer=setInterval(updateShopTimer,1000)}
let economy={coins:0,owned:['default'],equipped:'default',loadout:{arriba:'default',torso:'default',abajo:'default',skin:'default'}};
async function activateAccountEconomy(){economy={coins:0,owned:['default'],loadout:{arriba:'default',torso:'default',abajo:'default',skin:'default'}};try{await authority('profile');renderCustomizer();updateCoinUI()}catch(e){toast(tr('No se ha podido cargar el inventario.'))}}function saveEconomy(){updateCoinUI();}
function roundFive(n){return Math.max(0,Math.round(n/5)*5)}
function awardCoins(){return;}
function getWinReward(){return 80;}
function updateCoinUI(){if($('coinCount'))$('coinCount').textContent=economy.coins.toLocaleString('es-ES');if($('shopCoins'))$('shopCoins').textContent=economy.coins.toLocaleString('es-ES')}
function openShop(){$('shopScreen').classList.remove('hidden');$('customizeScreen').classList.add('hidden');renderShop();updateCoinUI();startShopTimer();if(!$('wallet4')){const button=document.createElement('button');button.id='wallet4';button.className='wallet-button4';button.textContent=tr('HISTORIAL');button.onclick=openWallet4;$('shopCoins').parentElement.appendChild(button);}}
function closeShop(){$('shopScreen').classList.add('hidden')}
function shopCharacterSVG(item){return window.StarshipVisual.svg(window.StarshipVisual.itemAppearance(item),{className:'shop-character-svg',motion:'idle'})}
function skinMarkup(item,large=false){const rarity=item.category==='skin'?'LEGENDARIA':item.category==='arriba'?'ARTEFACTO':'EQUIPAMIENTO';return '<div class="skin-card skin-art-'+item.id+' '+(large?'skin-card-large':'')+'"><div class="skin-stage-glow"></div><div class="skin-nebula"></div><div class="skin-orbit orbit-alpha"></div><div class="skin-orbit orbit-beta"></div>'+shopCharacterSVG(item)+'<span class="skin-rarity">'+rarity+'</span></div>'}
function shopItemById(id){return dailyShopItems().find(i=>i.id===id)}
function openShopDetail(id){const item=shopItemById(id);if(!item)return;const owned=economy.owned.includes(id),modal=$('shopDetail');modal.innerHTML='<div class="shop-detail-backdrop" data-detail-close></div><section class="shop-detail-panel" role="dialog" aria-modal="true"><button class="shop-detail-close" data-detail-close aria-label="Cerrar">✕</button><div class="shop-detail-art">'+skinMarkup(item,true)+'<div class="detail-orbit"></div></div><div class="shop-detail-info"><small class="shop-type">'+({skin:'ATUENDO LEGENDARIO',torso:'PRENDA SUPERIOR',abajo:'PRENDA INFERIOR',arriba:'ACCESORIO'}[item.category]||'EQUIPO')+'</small><h2>'+item.name+'</h2><p>'+item.desc+'</p><div class="detail-specs"><span>DISEÑO <b>'+({skin:'Conjunto completo',torso:'Torso y mangas',abajo:'Piernas y calzado',arriba:'Accesorio individual'}[item.category])+'</b></span><span>ESTADO <b>'+(owned?'En tu taquilla':'Disponible hoy')+'</b></span></div><button class="detail-buy" data-detail-buy="'+item.id+'" '+(owned?'disabled':'')+'>'+(owned?'✓ COMPRADO':'🪙 COMPRAR · '+item.price)+'</button></div></section>';modal.classList.remove('hidden');modal.querySelectorAll('[data-detail-close]').forEach(x=>x.onclick=()=>modal.classList.add('hidden'));const buy=modal.querySelector('[data-detail-buy]');if(buy)buy.onclick=()=>{buyItem(id);modal.classList.add('hidden');renderShop()}}
function renderShop(){const list=dailyShopItems();$('shopItems').innerHTML=list.map(i=>{const owned=economy.owned.includes(i.id);return '<article class="shop-item">'+skinMarkup(i)+'<small class="shop-type">'+({skin:'SKIN COMPLETA',torso:'TORSO',abajo:'PARTE INFERIOR',arriba:'ACCESORIO'}[i.category]||'EQUIPO')+'</small><h3>'+i.name+'</h3><p>'+i.desc+'</p><button class="shop-view" data-view="'+i.id+'">⌕ VER EN DETALLE</button><button data-buy="'+i.id+'" '+(owned?'disabled':'')+'>'+(owned?'✓ COMPRADO':'🪙 '+i.price)+'</button></article>'}).join('');$('shopItems').querySelectorAll('[data-buy]').forEach(b=>b.onclick=()=>buyItem(b.dataset.buy));$('shopItems').querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>openShopDetail(b.dataset.view));updateShopTimer()}
async function buyItem(id){const item=dailyShopItems().find(i=>i.id===id);if(!item||economy.owned.includes(id))return;if(!confirm(tr('¿Comprar este artículo?')+' '+item.name+' · '+item.price))return;try{await authority('buy',{itemId:id});renderShop();window.StarshipAudio?.play('purchase');toast(tr('Compra guardada.'))}catch(e){toast(e.message)}}
let customCategory='color';
const CUSTOM_COLORS=[['Rojo','#e85d75'],['Azul','#48a9e8'],['Verde','#62c98b'],['Amarillo','#e7c45c'],['Morado','#b18ae8'],['Naranja','#f39a52'],['Cian','#67d5cb'],['Rosa','#f0a8c9'],['Blanco','#d6e0e8'],['Marrón','#8b5a3c'],['Gris','#7f8794'],['Esmeralda','#20a879'],['Fucsia','#e05acb'],['Índigo','#7b6cff']];
const CUSTOM_CATEGORIES={color:['ELIGE TU COLOR','Selecciona el tono principal de tu monguito.'],arriba:['ACCESORIOS','Accesorios para la cabeza y elementos especiales.'],torso:['PARTES DE ARRIBA','Chaquetas, chalecos y armaduras que ya has comprado.'],abajo:['PARTES DE ABAJO','Pantalones, grebas y botas de tu colección.'],skin:['SKINS COMPLETAS','Conjuntos completos de tu colección.']};
function getLoadout(){return {...(economy.loadout||{}),arriba:economy.loadout?.arriba||((economy.equipped&&economy.equipped!=='default')?economy.equipped:'default'),torso:economy.loadout?.torso||'default',abajo:economy.loadout?.abajo||'default',skin:economy.loadout?.skin||'default'}}
function getAppearance(){const l=getLoadout();return {arriba:SHOP_ITEMS.find(i=>i.id===l.arriba)||null,torso:SHOP_ITEMS.find(i=>i.id===l.torso)||null,abajo:SHOP_ITEMS.find(i=>i.id===l.abajo)||null,skin:SHOP_ITEMS.find(i=>i.id===l.skin)||null}}
function openCustomize(){$('customizeScreen').classList.remove('hidden');$('shopScreen').classList.add('hidden');renderCustomizer()}
function closeCustomize(){$('customizeScreen').classList.add('hidden')}
function renderCustomizer(){document.querySelectorAll('#customTabs [data-category]').forEach(b=>b.classList.toggle('active',b.dataset.category===customCategory));const meta=CUSTOM_CATEGORIES[customCategory];$('categoryTitle').textContent=meta[0];$('categoryDesc').textContent=meta[1];let items=[];
if(customCategory==='color')items=CUSTOM_COLORS.map(([name,color])=>({id:color,name,color,selected:($('color').value||'#e85d75')===color}));
else {const key=customCategory;items=[{id:'default',name:key==='skin'?'Uniforme original':'Quitar elemento',icon:'○'},...SHOP_ITEMS.filter(i=>i.category===key&&economy.owned.includes(i.id)).map(i=>({id:i.id,name:i.name,icon:i.icon}))].map(i=>({...i,selected:(getLoadout()[key]||'default')===i.id}));}
$('customOptions').innerHTML=items.length?items.map(i=>customCategory==='color'?'<button class="hangar-option color-option '+(i.selected?'selected':'')+'" data-option="'+i.id+'"><span class="color-swatch" style="background:'+i.color+'"></span><span>'+i.name+'</span></button>':'<button class="hangar-option '+(i.selected?'selected':'')+'" data-option="'+i.id+'"><span class="option-icon">'+i.icon+'</span>'+clean(i.name)+'</button>').join(''):'<div class="custom-empty"><span>◌</span><b>VACÍO</b><p>Las compras de la tienda diaria aparecerán aquí.</p></div>';
$('customOptions').querySelectorAll('[data-option]').forEach(b=>b.onclick=()=>selectCustomOption(b.dataset.option));updatePreview()}
function selectCustomOption(id){if(customCategory==='color'){$('color').value=id;localStorage.setItem('starship_color',id);applyMonguitoColor()}else{const l=getLoadout();l[customCategory]=id;if(id!=='default'&&SHOP_ITEMS.find(i=>i.id===id)?.kind==='full'){l.arriba='default';l.torso='default';l.abajo='default'}if(customCategory!=='skin'&&id!=='default')l.skin='default';economy.loadout=l}saveEconomy();renderCustomizer();updatePreview()}
function renderInventory(){renderCustomizer()}
function updatePreview(){refreshUniversalHero();const a=getAppearance(),full=a.skin,color=$('color')?.value||'#e85d75',preview=$('previewMate');if(preview){preview.style.background='linear-gradient(100deg,color-mix(in srgb,'+(full?.suit||color)+',white 48%),'+(full?.suit||color)+' 55%,color-mix(in srgb,'+(full?.suit||color)+',black 42%))';preview.style.filter='none';preview.style.borderColor=full?.trim||a.torso?.trim||a.abajo?.trim||'';preview.classList.toggle('preview-full-outfit',!!full);preview.dataset.outfit=full?.outfit||''}if(preview){let wrapper=preview.querySelector('.universal-preview');if(!wrapper){wrapper=document.createElement('div');wrapper.className='universal-preview';preview.appendChild(wrapper)}wrapper.innerHTML=window.StarshipVisual.svg(avatarAppearance({color,cosmetics:getLoadout(),name:'MONGUITO'}),{motion:'idle'})}const parts=[a.arriba,a.torso,a.abajo,full].filter(Boolean);$('previewItem').innerHTML=full?'<span class="preview-clothes preview-clothes-'+full.outfit+'"><i></i><b></b><em></em></span>':a.arriba?skinAccessoryMarkup(a.arriba):'';$('equippedLabel').textContent=(full?.name||parts.map(i=>i.name).join(' · ')||'TRIPULANTE ESTÁNDAR').toUpperCase();$('customSelection').textContent=(customCategory==='color'?CUSTOM_COLORS.find(x=>x[1]===color)?.[0]||'COLOR':(parts.find(i=>i.id===getLoadout()[customCategory])?.name||'SIN ELEMENTO')).toUpperCase()+' · SELECCIONADO';const heroGear=$('heroGear');if(heroGear)heroGear.innerHTML=a.arriba?skinAccessoryMarkup(a.arriba):''}
function skinAccessoryMarkup(item){return '<span class="preview-gear gear-'+(item.skin||'star')+'"><i></i><b></b><em></em></span>'}
function applyMonguitoColor(){const color=$('color')?.value||'#e85d75';localStorage.setItem('starship_color',color);const hero=$('heroMonguito');if(hero)hero.closest('.hero-side').style.setProperty('--monguito-color',color);const preview=$('previewMate');if(preview){const rgb=color;preview.style.background='linear-gradient(100deg,color-mix(in srgb,'+rgb+',white 48%),'+rgb+' 55%,color-mix(in srgb,'+rgb+',black 42%))';}}refreshUniversalHero()
const LANG={
es:{welcome:'BIENVENIDO A BORDO',subtitle:'Elige el idioma y el nombre de tu jugador',language:'IDIOMA',player:'NOMBRE DEL JUGADOR',continue:'CONTINUAR',desc:'La nave está a oscuras. Completa misiones, consigue monedas y descubre quién sabotea la tripulación.',name:'NOMBRE DEL JUGADOR',color:'COLOR DEL MONGUITO',create:'CREAR SALA',join:'UNIRSE ↗',explore:'EXPLORAR',shop:'TIENDA',custom:'PERSONALIZAR',code:'CÓDIGO DE SALA',start:'INICIAR PARTIDA',leave:'SALIR',tasks:'LISTA DE MISIONES',report:'REPORTAR',meeting:'REUNIÓN',task:'TAREA',crew:'TRIPULACIÓN',waiting:'Esperando jugadores…'},
en:{welcome:'WELCOME ABOARD',subtitle:'Choose your language and player name',language:'LANGUAGE',player:'PLAYER NAME',continue:'CONTINUE',desc:'The ship is dark. Complete tasks, earn coins and find out who is sabotaging the crew.',name:'PLAYER NAME',color:'MONGUITO COLOR',create:'CREATE ROOM',join:'JOIN ↗',explore:'EXPLORE',shop:'SHOP',custom:'CUSTOMIZE',code:'ROOM CODE',start:'START GAME',leave:'LEAVE',tasks:'TASK LIST',report:'REPORT',meeting:'MEETING',task:'TASK',crew:'CREW',waiting:'Waiting for players…'},
fr:{welcome:'BIENVENUE À BORD',subtitle:'Choisissez la langue et le nom du joueur',language:'LANGUE',player:'NOM DU JOUEUR',continue:'CONTINUER',desc:'Le vaisseau est plongé dans le noir. Terminez les tâches, gagnez des pièces et découvrez le saboteur.',name:'NOM DU JOUEUR',color:'COULEUR DU MONGUITO',create:'CRÉER UNE SALLE',join:'REJOINDRE ↗',explore:'EXPLORER',shop:'BOUTIQUE',custom:'PERSONNALISER',code:'CODE DE SALLE',start:'LANCER LA PARTIE',leave:'QUITTER',tasks:'LISTE DES TÂCHES',report:'SIGNALER',meeting:'RÉUNION',task:'TÂCHE',crew:'ÉQUIPAGE',waiting:'En attente des joueurs…'}
};
let gameLang=localStorage.getItem('starship_language')||'es';
function applyLanguage(){const d=LANG[gameLang]||LANG.es;const set=(id,v)=>{const e=$(id);if(e)e.textContent=v};set('gateTitle',d.welcome);set('gateSubtitle',d.subtitle);set('gateLanguageLabel',d.language);set('gateNameLabel',d.player);set('saveProfile',d.continue);set('nameLabel',d.name);set('colorLabel',d.color);set('createLabel',d.create);set('join',d.join);set('explore',d.explore);set('shopLabel',d.shop);set('customLabel',d.custom);set('lobbyStartLabel',d.start);set('lobbyLeaveLabel',d.leave);set('taskHeading',d.tasks);set('report',d.report);set('emergency',d.meeting);set('interact',d.task);const desc=$('menuDescription');if(desc)desc.textContent=d.desc;const code=$('code');if(code)code.placeholder=d.code;const name=$('name');if(name)name.placeholder=d.player;const tag=$('phase');if(tag)tag.textContent=gameLang==='es'?'EN PARTIDA':gameLang==='fr'?'EN PARTIE':'IN GAME';}
function authFeedback(message,bad=false){const e=$('authFeedback');if(e){e.textContent=message;e.style.color=bad?'#ff8795':'#9bdbe8'}}
function setAuthStep(step){authStep=step;$('authCodeWrap').classList.toggle('hidden',step!=='verify');$('authPasswordWrap').classList.toggle('hidden',step==='verify');$('authProfileFields').classList.toggle('hidden',step==='login'||step==='verify');$('authPrimary').textContent=step==='verify'?'VERIFICAR CORREO':step==='login'?'INICIAR SESIÓN':'CREAR CUENTA';$('authSwitch').classList.toggle('hidden',step==='verify');$('authBack').classList.toggle('hidden',step!=='verify');authFeedback('')}
async function completeProfile(){if(authUser?.$id){playerId=authUser.$id;await activateAccountEconomy(authUser.$id)}await claimReferralGift();const n=(localStorage.getItem('starship_player_name')||$('profileName').value||authUser?.name||'Tripulante').trim().slice(0,16);gameLang=localStorage.getItem('starship_language')||$('languageChoice').value||'es';localStorage.setItem('starship_language',gameLang);localStorage.setItem('starship_player_name',n);$('name').value=n;$('monguitoName').textContent=n;applyLanguage();if(authUser?.name!==n)try{await getAccount().updateName({name:n})}catch(e){console.warn('No se pudo actualizar el nombre de cuenta',e)}$('profileGate').classList.remove('visible');if(window.starshipGiftToast){toast(window.starshipGiftToast);window.starshipGiftToast=''}}
async function startGuestMode(){const btn=$('guestPlay');if(btn)btn.disabled=true;try{const account=getAccount();try{authUser=await account.get()}catch(e){await account.createAnonymousSession();authUser=await account.get()}if(!authUser?.$id)throw new Error('Appwrite no ha creado una sesión de invitado válida.');playerId=authUser.$id;const legacyGuestId=localStorage.getItem('starship_guest_id'),legacyEconomyKey=legacyGuestId?'starship_economy_guest_'+String(legacyGuestId).replace(/[^a-zA-Z0-9_-]/g,'_'):'' ,accountEconomyKey='starship_economy_'+String(playerId).replace(/[^a-zA-Z0-9_-]/g,'_');if(legacyGuestId&&legacyGuestId!==playerId&&!localStorage.getItem(accountEconomyKey)){const legacyEconomy=localStorage.getItem(legacyEconomyKey);if(legacyEconomy)localStorage.setItem(accountEconomyKey,legacyEconomy)}let guestName=(localStorage.getItem('starship_guest_name')||'').slice(0,16);if(!guestName){const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';guestName='Tripulante-'+Array.from({length:5},()=>alphabet[Math.floor(Math.random()*alphabet.length)]).join('');localStorage.setItem('starship_guest_name',guestName)}localStorage.setItem('starship_guest_id',playerId);localStorage.setItem('starship_player_name',guestName);$('name').value=guestName;$('monguitoName').textContent=guestName;const lang=localStorage.getItem('starship_language')||$('languageChoice').value||'es';gameLang=lang;localStorage.setItem('starship_language',lang);await activateAccountEconomy(playerId);$('profileGate').classList.remove('visible');$('editProfile').classList.add('hidden');$('editProfile').disabled=true;applyLanguage();toast('Acceso de invitado seguro · '+guestName)}catch(e){authFeedback(e.message||'No se pudo iniciar como invitado.',true)}finally{if(btn)btn.disabled=false}}
async function initProfile(){const saved=localStorage.getItem('starship_player_name'),savedColor=localStorage.getItem('starship_color'),lang=localStorage.getItem('starship_language');if(savedColor&&$('color'))$('color').value=savedColor;if(saved){$('name').value=saved;$('monguitoName').textContent=saved}if(lang){gameLang=lang;$('languageChoice').value=lang;applyLanguage()}$('profileName').value=saved||'';setAuthStep('signup');if(giftReferral)$('gateSubtitle').textContent='🎁 BVILLA te regala 3.000 pesos universales al crear o acceder a tu cuenta verificada.';$('profileGate').classList.add('visible');$('guestPlay').onclick=startGuestMode;try{authUser=await getAccount().get();if(authUser){$('authEmail').value=authUser.email||'';await completeProfile();}}catch(e){authUser=null}
$('authSwitch').onclick=()=>{authMode=authMode==='signup'?'login':'signup';setAuthStep(authMode);$('authSwitch').textContent=authMode==='signup'?'YA TENGO CUENTA · INICIAR SESIÓN':'CREAR UNA CUENTA NUEVA';$('authStatus').textContent=authMode==='signup'?'REGISTRO DE TRIPULACIÓN':'ACCESO A CUENTA EXISTENTE'};
$('authBack').onclick=()=>{authPendingUserId='';setAuthStep(authMode)};$('guestPlay').onclick=startGuestMode;
$('authPrimary').onclick=async()=>{const email=$('authEmail').value.trim().toLowerCase(),password=$('authPassword').value,n=$('profileName').value.trim().slice(0,16);if(authStep==='verify'){const code=$('authCode').value.trim();if(!/^\d{6}$/.test(code))return authFeedback('Introduce el código de 6 dígitos.',true);try{await getAccount().updateEmailVerificationOTP({userId:authPendingUserId,secret:code});authUser=await getAccount().get();authFeedback('Correo verificado. Cuenta activada.');await completeProfile();return}catch(e){return authFeedback(e.message||'Código incorrecto o caducado.',true)}}
if(!email||!/^\S+@\S+\.\S+$/.test(email))return authFeedback('Introduce un correo válido.',true);if(password.length<8)return authFeedback('La contraseña debe tener al menos 8 caracteres.',true);if(authMode==='signup'&&!n)return authFeedback('Escribe tu nombre de jugador.',true);$('authPrimary').disabled=true;try{const account=getAccount();if(authMode==='signup'){await account.create({userId:ID.unique(),email,password,name:n});await account.createEmailPasswordSession({email,password});authUser=await account.get();await account.createEmailVerificationOTP();authPendingUserId=authUser.$id;setAuthStep('verify');authFeedback('Te hemos enviado un código de 6 cifras. Revisa también spam.');}else{await account.createEmailPasswordSession({email,password});authUser=await account.get();if(!authUser.emailVerification){await account.createEmailVerificationOTP();authPendingUserId=authUser.$id;authMode='login';setAuthStep('verify');authFeedback('Tu cuenta aún no está verificada. Te enviamos un código.');}else await completeProfile()}}catch(e){authFeedback(e.message||'No se pudo completar el acceso.',true)}finally{$('authPrimary').disabled=false}};
$('editProfile').onclick=async()=>{if(authUser){try{await getAccount().deleteSession({sessionId:'current'})}catch(e){}authUser=null;location.reload();return}$('profileGate').classList.add('visible')};}
async function leaveCurrentRoom(){try{if(!soloMode&&roomId)await gameAction('leave');clearTimeout(poll);poll=null;roomId='';localStorage.removeItem('starship_active_room');location.reload()}catch(e){toast(e.message)}}
function setup(){initProfile();startShopTimer();const splash=$('introSplash');if(splash)setTimeout(()=>splash.remove(),v4Preferences.reduceMotion?20:3400);const j=$('joystick');let joyPointer=null;function joy(e){const r=j.getBoundingClientRect();if(!r.width||!r.height)return;let dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2,l=Math.hypot(dx,dy),m=Math.min(r.width,r.height)*.34;if(l>m){dx*=m/l;dy*=m/l}const response=v=>Math.sign(v)*Math.pow(Math.min(1,Math.abs(v)),1/(v4Preferences.sensitivity||1));move={x:response(dx/m),y:response(dy/m)};$('stick').style.transform='translate('+dx+'px,'+dy+'px)'}j.style.touchAction='none';j.addEventListener('pointerdown',e=>{e.preventDefault();joyPointer=e.pointerId;j.setPointerCapture(e.pointerId);joy(e)});j.addEventListener('pointermove',e=>{if(e.pointerId===joyPointer){e.preventDefault();joy(e)}});function stopJoy(e){if(joyPointer!==null&&(e.pointerId===undefined||e.pointerId===joyPointer)){joyPointer=null;move={x:0,y:0};$('stick').style.transform='translate(0,0)'}}['pointerup','pointercancel','lostpointercapture'].forEach(n=>j.addEventListener(n,stopJoy));window.addEventListener('blur',()=>{keys={};move={x:0,y:0};joyPointer=null;$('stick').style.transform='translate(0,0)'});installControls4();window.addEventListener('resize',resize)}
window.addEventListener('error',e=>{console.error(e.error||e.message);if($('status'))say('Error del juego: '+(e.message||'error inesperado'),true);});
const GAME_BUILD_VERSION='4.0.0-20261111';
function notifyGamePatch(){const key='starship_seen_patch';try{const seen=localStorage.getItem(key);if(seen===GAME_BUILD_VERSION)return;localStorage.setItem(key,GAME_BUILD_VERSION);const n=$('patchNotice');if(!n)return;n.classList.remove('show');void n.offsetWidth;n.classList.add('show');clearTimeout(window.patchNoticeTimer);window.patchNoticeTimer=setTimeout(()=>n.classList.remove('show'),4800)}catch(e){console.warn('No se pudo mostrar el aviso de actualización',e)}}
// Room-only realtime frames back up a 20 Hz peer movement stream. All critical
// actions still use validated server positions; peer packets carry no roles.
const v4Peers=new Map(),v4PeerFrames=new Map(),v4Signals={},v4SignalSeen=new Map();
let v4PeerMessages=0;
let v4Realtime=null,v4FrameSubscription=null,v4SignalSubscription=null,v4SignalRow='',v4SignalFlush=0,v4PeerTicker=0;
async function startRealtime4(){
 if(!AppwriteSDK?.Realtime||soloMode||!roomId)return;
 try{
  if(v4FrameSubscription)await v4FrameSubscription.close();if(v4SignalSubscription)await v4SignalSubscription.close();
  v4Realtime=v4Realtime||new AppwriteSDK.Realtime(new Client().setEndpoint(ENDPOINT).setProject(PROJECT));
  v4FrameSubscription=await v4Realtime.subscribe('tablesdb.'+DB+'.tables.frames_v4.rows',event=>{
   const row=event.payload;if(row?.roomId!==roomId)return;let frame;try{frame=JSON.parse(row.payload)}catch(e){return;}applyRealtimeFrame4(frame,false);
  });
  v4SignalSubscription=await v4Realtime.subscribe('tablesdb.'+DB+'.tables.signals_v4.rows',event=>receiveSignals4(event.payload));
  const rows=await getDb().listRows({databaseId:DB,tableId:'signals_v4',queries:[Query.equal('roomId',roomId),Query.limit(100)]});
  for(const row of rows.rows){if(row.userId===playerId)v4SignalRow=row.$id;else receiveSignals4(row);}
  updatePeers4();
  clearInterval(v4PeerTicker);v4PeerTicker=setInterval(()=>{
   const p=gameState?.players?.[playerId];if(!p||gameState.phase!=='playing'||gameState.meeting||document.hidden)return;
   const packet=JSON.stringify({x:p.x,y:p.y,teleport:p.teleport,moving:!!p._moving,faceX:p._faceX||1,at:Date.now()+v4ClockOffset});
   for(const peer of v4Peers.values())if(peer.channel?.readyState==='open'&&peer.channel.bufferedAmount<8192)peer.channel.send(packet);
  },50);
 }catch(e){console.warn('Realtime fallback:',e.message);}
}
function applyRealtimeFrame4(frame,peer){
 const p=gameState?.players?.[frame.id];if(!p||frame.id===playerId||frame.teleport!==p.teleport||gameState.phase!=='playing'||gameState.meeting)return;
 if(!Number.isFinite(frame.x)||!Number.isFinite(frame.y)||frame.x<0||frame.y<0||frame.x>MAP.w||frame.y>MAP.h)return;
 const now=performance.now(),previous=v4PeerFrames.get(frame.id),elapsed=previous?Math.max(.03,(now-previous.receivedAt)/1000):1;
 if(peer&&previous&&Math.hypot(frame.x-previous.x,frame.y-previous.y)>(gameState.settings.speed||5.2)*Math.min(elapsed,2)+1)return;
 if(peer){v4PeerFrames.set(frame.id,{...frame,receivedAt:now});}
 else if(previous&&now-previous.receivedAt<1200)return;
 const oldX=p._targetX??p.x,oldY=p._targetY??p.y,dt=Math.max(.04,(now-(p._receivedAt||now-450))/1000);
 p._targetX=frame.x;p._targetY=frame.y;p._receivedAt=now;p._moving=!!frame.moving;p._faceX=frame.faceX||p._faceX;
 p._netVx=frame.moving?Math.max(-7,Math.min(7,(frame.x-oldX)/dt)):0;p._netVy=frame.moving?Math.max(-7,Math.min(7,(frame.y-oldY)/dt)):0;
}
function updatePeers4(){
 if(!v4SignalRow||!window.RTCPeerConnection||!gameState||soloMode)return;
 for(const p of Object.values(gameState.players)){if(p.id===playerId||v4Peers.has(p.id)||!p.connected)continue;makePeer4(p.id,p.id>playerId);}
 for(const [uid,peer] of v4Peers)if(!gameState.players[uid]){peer.pc.close();v4Peers.delete(uid);v4PeerFrames.delete(uid);}
}
function wireChannel4(peer,uid,channel){
 peer.channel=channel;channel.onmessage=event=>{if(typeof event.data!=='string'||event.data.length>512)return;try{const frame=JSON.parse(event.data);v4PeerMessages++;applyRealtimeFrame4({...frame,id:uid},true)}catch(e){}};
 channel.onclose=()=>{v4PeerFrames.delete(uid);peer.pc.close();};
}
async function makePeer4(uid,initiator){
 const pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]}),peer={pc,channel:null,created:Date.now()};v4Peers.set(uid,peer);
 pc.ondatachannel=event=>wireChannel4(peer,uid,event.channel);
 pc.onconnectionstatechange=()=>{if(pc.connectionState==='failed'||pc.connectionState==='closed'){v4PeerFrames.delete(uid);if(v4Peers.get(uid)===peer){v4Peers.delete(uid);setTimeout(updatePeers4,3000);}}};
 try{if(initiator){wireChannel4(peer,uid,pc.createDataChannel('movement',{ordered:false,maxRetransmits:0}));await pc.setLocalDescription(await pc.createOffer());await gatherIce4(pc);sendSignal4(uid,pc.localDescription);}}catch(e){pc.close();v4Peers.delete(uid);}
 return peer;
}
function gatherIce4(pc){if(pc.iceGatheringState==='complete')return Promise.resolve();return new Promise(resolve=>{const done=()=>{pc.removeEventListener('icegatheringstatechange',change);resolve();},change=()=>{if(pc.iceGatheringState==='complete')done();};pc.addEventListener('icegatheringstatechange',change);setTimeout(done,1800);});}
function sendSignal4(uid,description){v4Signals[uid]={type:description.type,sdp:description.sdp,at:Date.now()};clearTimeout(v4SignalFlush);v4SignalFlush=setTimeout(async()=>{if(!v4SignalRow)return;try{await getDb().updateRow({databaseId:DB,tableId:'signals_v4',rowId:v4SignalRow,data:{payload:JSON.stringify(v4Signals)}});}catch(e){console.warn('Peer signalling fallback:',e.message);}},120);}
async function receiveSignals4(row){
 if(!row||row.roomId!==roomId||row.userId===playerId||!gameState?.players?.[row.userId])return;
 let data;try{data=JSON.parse(row.payload)}catch(e){return;}const signal=data[playerId],uid=row.userId;
 if(!signal||!['offer','answer'].includes(signal.type)||typeof signal.sdp!=='string'||signal.sdp.length>12000||Date.now()-signal.at>90000||v4SignalSeen.get(uid)===signal.at)return;
 v4SignalSeen.set(uid,signal.at);let peer=v4Peers.get(uid);
 try{if(!peer)peer=await makePeer4(uid,false);if(signal.type==='offer'){await peer.pc.setRemoteDescription({type:'offer',sdp:signal.sdp});await peer.pc.setLocalDescription(await peer.pc.createAnswer());await gatherIce4(peer.pc);sendSignal4(uid,peer.pc.localDescription);}else if(peer.pc.signalingState==='have-local-offer')await peer.pc.setRemoteDescription({type:'answer',sdp:signal.sdp});}catch(e){console.warn('Peer negotiation fallback:',e.message);}
}

window.StarshipNetwork={metrics:()=>({peerCount:[...v4Peers.values()].filter(p=>p.channel?.readyState==='open').length,peerMessages:v4PeerMessages,serverSamples:v4Samples.length,serverP95:[...v4Samples].sort((a,b)=>a-b)[Math.floor(v4Samples.length*.95)]||0})};
function networkPosition(){const p=gameState?.players?.[playerId];return p?{x:p.x,y:p.y,teleport:p.teleport,seq:v4InputSeq,path:v4MovePath.slice(-40),moving:!!p._moving,faceX:p._faceX||1}:undefined;}
function authority(action,extra={}){
 const execute=async()=>{
  if(!authUser?.$id)throw Error(tr('Inicia sesión para continuar.'));
  const started=performance.now(),payload={protocolVersion:4,action,requestId:crypto.randomUUID(),name:$('name')?.value||authUser.name,color:$('color')?.value,code:roomId,...extra};
  const functions=new Functions(new Client().setEndpoint(ENDPOINT).setProject(PROJECT));
  let execution;
  try{execution=await functions.createExecution({functionId:'starship-authority',body:JSON.stringify(payload),async:false,path:'/',method:'POST',headers:{}});}catch(e){if(e.code===401)v4Jwt=null;throw e;}
  let r;try{r=JSON.parse(execution.responseBody||'{}')}catch(e){throw Error(tr('La respuesta del servidor no es válida.'));}
  if(!r.ok)throw Object.assign(new Error(tr(r.message||'El servidor no ha podido completar la acción.')),{status:execution.responseStatusCode});
  const elapsed=performance.now()-started;v4Samples.push(elapsed);if(v4Samples.length>120)v4Samples.shift();
  v4ClockOffset=r.serverTime?r.serverTime-(Date.now()-elapsed/2):v4ClockOffset;
  if(r.profile){economy={...r.profile};updateCoinUI();}
  if(r.state)adoptState4(r.state,payload.position);
  setConnectionState('online');return r;
 };
 const result=v4Queue.then(execute,execute);v4Queue=result.catch(()=>{});return result;
}
async function gameAction(action,args={}){
 if(soloMode)return;
 return authority(action,{code:roomId,position:networkPosition(),...args});
}
async function enterAuthorityRoom(r){
 soloMode=false;roomId=roomCode=r.state.code;localStorage.setItem('starship_active_room',roomCode);$('roomCode').textContent=roomCode;$('connect').classList.add('hidden');$('lobby').classList.remove('hidden');clearTimeout(poll);poll=setTimeout(pollRoom,900);startRealtime4();renderLobby();
}
function setConnectionState(state){const el=$('connection4');if(!el)return;const sorted=[...v4Samples].sort((a,b)=>a-b),p95=Math.round(sorted[Math.floor(sorted.length*.95)]||0);el.dataset.state=state;el.textContent=state==='online'?tr('ONLINE')+' · '+Math.round(v4Samples.at(-1)||0)+' ms':tr('RECONECTANDO…');el.title='p95 '+p95+' ms · '+v4Samples.length+' samples';}
function adoptState4(next,sent){
 const previous=gameState,newMatch=next.matchId&&previous?.matchId!==next.matchId;
 if(newMatch){roleRevealShown=false;gameUIStarted=false;lastEndedMatchKey='';lastKillAnimationAt=0;$('end').classList.add('hidden');v4SeenEvents.clear();}
 const now=performance.now();
 for(const [uid,n] of Object.entries(next.players||{})){
  const old=previous?.players?.[uid];if(!old)continue;
  const warp=newMatch||n.teleport!==old.teleport||previous?.phase!==next.phase;
  if(uid===playerId){
   v4InputSeq=Math.max(v4InputSeq,n.lastInputSeq||0);v4MovePath=warp?[]:v4MovePath.filter(q=>q.seq>(n.lastInputSeq||0));
   if(!warp){const accepted=sent&&Math.hypot(n.x-sent.x,n.y-sent.y)<.65;const sx=n.x,sy=n.y;n.x=old.x;n.y=old.y;if(sent&&!accepted){v4Correction={x:sx,y:sy};v4MovePath=[];}else v4Correction=null;}
   Object.assign(n,{_moving:old._moving,_faceX:old._faceX,_walkPhase:old._walkPhase});
  }else{
   const peer=v4PeerFrames.get(uid);if(peer&&now-peer.receivedAt<1600&&peer.teleport===n.teleport&&next.phase==='playing'&&!next.meeting){n.x=peer.x;n.y=peer.y;}const nx=n.x,ny=n.y,dt=Math.max(.05,(next.serverTime-(previous?.serverTime||next.serverTime-450))/1000),vx=(nx-(old._netX??old.x))/dt,vy=(ny-(old._netY??old.y))/dt;
   Object.assign(n,{_targetX:nx,_targetY:ny,_netX:nx,_netY:ny,_receivedAt:now,_netVx:n.moving?Math.max(-7,Math.min(7,vx)):0,_netVy:n.moving?Math.max(-7,Math.min(7,vy)):0,_walkPhase:old._walkPhase,_faceX:n.faceX||old._faceX});
   if(!warp){n.x=old.x;n.y=old.y;}
  }
 }
 gameState=next;roomCode=next.code;hostId=next.hostId;isHost=hostId===playerId;
 Object.assign(v4Settings,next.settings);
 players=Object.values(next.players).map(p=>({...p,vote:next.meeting?.votes?.[p.id]?next.meeting.id+'|vote:'+next.meeting.votes[p.id]:next.meeting?.skips?.[p.id]?next.meeting.id+'|chat-skip':''}));
 if(next.phase==='lobby'||next.phase==='countdown'){
  if(previous?.phase==='ended'){gameUIStarted=false;$('end').classList.add('hidden');$('game').classList.add('hidden');$('game').style.display='';$('lobby').classList.remove('hidden');}
  renderLobby();
 }else if(next.phase==='playing'){
  if(!gameUIStarted)startGameUI();
  if(next.meeting){closeSecurityCameras();$('modal').classList.remove('task-modal');renderMeetingUI();}
  else if(previous?.meeting){$('modal').classList.add('hidden');$('modal').dataset.meetingKey='';}
  updateTasks();playVictimKillAnimation();
 }else if(next.phase==='ended'){
  $('modal').classList.add('hidden');closeSecurityCameras();finishMatch(next.winner);
 }
 for(const event of next.events||[]){if(v4SeenEvents.has(event.id))continue;v4SeenEvents.add(event.id);if(v4SeenEvents.size>256)v4SeenEvents.delete(v4SeenEvents.values().next().value);if(Date.now()+v4ClockOffset-event.at>5000)continue;window.StarshipAudio?.play(event.type);if(event.type==='sabotage')window.StarshipCinematics?.play('sabotage',{system:event.system,key:event.id});}
 refreshActionAvailability();updatePeers4();
}
function correctLocal4(dt){if(!v4Correction)return;const p=gameState?.players?.[playerId];if(!p){v4Correction=null;return;}const d=Math.hypot(v4Correction.x-p.x,v4Correction.y-p.y),t=1-Math.exp(-12*dt);p.x+=(v4Correction.x-p.x)*t;p.y+=(v4Correction.y-p.y)*t;if(d<.05)v4Correction=null;}
function refreshActionAvailability(){
 const p=gameState?.players?.[playerId];if(!p)return;const active=gameState.phase==='playing'&&!gameState.meeting&&!p.inVent,alive=active&&p.alive,impostor=p.role==='impostor';
 const pending=p.role==='crew'&&(p.tasks||[]).some(t=>!p.done?.includes(t.id)&&MAP.tasks.some(s=>s.id===(t.stationId||t.id)&&Math.hypot(p.x-s.x,p.y-s.y)<=3));
 const repair=alive&&!impostor&&activeRepairStations().some(s=>Math.hypot(p.x-s.x,p.y-s.y)<=3);
 const target=alive&&impostor&&Object.values(gameState.players).some(q=>q.id!==playerId&&q.alive&&!q.inVent&&q.role!=='impostor'&&Math.hypot(p.x-q.x,p.y-q.y)<=(gameState.settings?.killDistance||2.2)&&window.StarshipRules.lineClear(p,q,gameState.sabotage));
 const killWait=Math.max(0,(gameState.settings?.killCooldown||30)*1000-(Date.now()+v4ClockOffset-Number(p.lastKill||0))),sabWait=Math.max(0,(gameState.settings?.sabotageCooldown||35)*1000-(Date.now()+v4ClockOffset-Number(p.lastSabotage||0)));
 $('kill').classList.toggle('hidden',!impostor||!p.alive);$('sabotage').classList.toggle('hidden',!impostor);$('vent').classList.toggle('hidden',!impostor||!p.alive);
 $('kill').disabled=!(target&&!killWait);$('kill').title=killWait?Math.ceil(killWait/1000)+'s':tr('Acércate a un tripulante');
 $('sabotage').disabled=!(active&&impostor&&!gameState.sabotage?.active&&!sabWait);$('sabotage').title=sabWait?Math.ceil(sabWait/1000)+'s':tr('Sabotaje [S]');
 $('vent').disabled=!(active&&impostor&&p.alive&&(p.inVent||MAP.vents.some(v=>Math.hypot(v.x-p.x,v.y-p.y)<=1.75)));
 const body=alive&&Object.values(gameState.players).some(q=>!q.alive&&q.body&&!q.body.reported&&Math.hypot(p.x-q.body.x,p.y-q.body.y)<=3&&window.StarshipRules.lineClear(p,q.body,gameState.sabotage));
 $('interact').disabled=!(active&&(pending||repair||impostor&&p.alive&&MAP.tasks.some(t=>Math.hypot(p.x-t.x,p.y-t.y)<=3)));$('report').disabled=!body;
 const sos=alive&&!gameState.sabotage?.active&&Math.hypot(p.x-61,p.y-35.22)<=3,used=(p.emergencies||0)>=(gameState.settings?.emergencyMeetings??1),ready=Date.now()+v4ClockOffset>=(gameState.teleportedAt||gameState.startedAt||gameState.createdAt)+(gameState.settings?.emergencyCooldown||20)*1000;
 $('emergency').disabled=!(sos&&!used&&ready&&!soloMode);const hint=$('emergency').querySelector('small');if(hint)hint.textContent=used?tr('SIN REUNIONES'):!ready?tr('EN ESPERA'):tr('REUNIÓN [Q]');
 const sec=MAP.rooms.find(r=>r.id==='security');$('securityBtn').classList.toggle('hidden',!(alive&&window.StarshipRules.inside(p.x,p.y,sec)));$('securityBtn').disabled=!!(gameState.sabotage?.active&&gameState.sabotage.type==='comms');
 const label=$('contextHint');if(label)label.textContent=!p.alive?tr('FANTASMA · COMPLETA TUS TAREAS'):repair?tr('REPARAR'):pending?tr('TAREA'):tr('ACÉRCATE A UNA TAREA');
 $('ghost4').classList.toggle('hidden',p.alive);$('ghost4').textContent=tr(p.role==='impostor'?'FANTASMA · PUEDES SABOTEAR':'FANTASMA · COMPLETA TUS TAREAS');
}
function renderLobby(){
 const cfg=gameState||{},count=players.length,cap=cfg.settings?.maxPlayers||15,imp=cfg.settings?.impostors||1;
 $('max').value=String(cap);$('imps').value=String(imp);$('max').disabled=$('imps').disabled=!isHost||cfg.phase==='countdown';
 $('hostTag').textContent=tr(isHost?'ANFITRIÓN':'ESPERANDO AL ANFITRIÓN');
 const signature=players.map(p=>p.id+p.connected+JSON.stringify(p.cosmetics)).join('|')+hostId;
 if($('lobbyList').dataset.roster!==signature){$('lobbyList').dataset.roster=signature;$('lobbyList').innerHTML=players.map(p=>'<div class="pill"><span class="lobby-mini-mate">'+window.StarshipVisual.svg(avatarAppearance(p),{motion:'idle'})+'</span> '+clean(p.name)+(p.id===hostId?' ♛':'')+(!p.connected?' · '+tr('SIN CONEXIÓN'):p.inactive?' · '+tr('INACTIVO'):'')+(isHost&&p.id!==playerId?'<button data-kick="'+p.id+'" aria-label="'+tr('Expulsar')+'">×</button>':'')+'</div>').join('');$('lobbyList').querySelectorAll('[data-kick]').forEach(b=>b.onclick=()=>gameAction('kick',{targetId:b.dataset.kick}).catch(e=>toast(e.message)));}
 const countdown=cfg.phase==='countdown';$('countdownPanel').classList.toggle('hidden',!countdown);$('start').disabled=!isHost||count<4||countdown;$('lobbyStartLabel').textContent=tr(countdown?'PREPARANDO DESPEGUE':'INICIAR PARTIDA');$('lobbyStatus').textContent=count+' / '+cap+' · '+tr(count<4?'Se necesitan 4 jugadores.':isHost?'TÚ CONTROLAS LA NAVE':'ESPERANDO AL ANFITRIÓN');
 if(countdown){$('countdownNumber').textContent=Math.max(0,Math.ceil((cfg.countdownEndsAt-Date.now()-v4ClockOffset)/1000));$('countdownCaption').textContent=tr('PREPARANDO DESPEGUE');}
 renderLobbyChat();
}
function renderMeetingUI(){
 const m=gameState?.meeting,modal=$('modal');if(!m||!modal)return;window.StarshipCinematics?.meeting(m,id=>avatarAppearance(gameState.players[id]));
 const self=gameState.players[playerId],alive=Object.values(gameState.players).filter(p=>p.alive&&p.connected),own=m.votes?.[playerId],ghost=!self.alive;
 const seconds=Math.max(0,Math.ceil((m.endsAt-Date.now()-v4ClockOffset)/1000));
 const key=[m.id,m.status,own,m.result?.targetId,JSON.stringify(m.chat),m.voteCount,JSON.stringify(m.skips),ghost].join('|');
 if(modal.dataset.meetingKey===key){const clock=$('meetingClock4');if(clock)clock.textContent=seconds+'s';return;}
 const draft=$('meetingChatInput')?.value||'',focus=document.activeElement?.id==='meetingChatInput',pos=$('meetingChatInput')?.selectionStart||0;modal.dataset.meetingKey=key;modal.classList.remove('hidden','task-modal');
 if(m.status==='resolved'){
  const result=m.result||{},target=gameState.players[result.targetId];
  modal.innerHTML='<div class="card meeting-result-card"><small>'+tr('RESULTADO DE LA VOTACIÓN')+'</small>'+(target?'<div class="meeting-expelled-avatar">'+window.StarshipVisual.svg(avatarAppearance(target),{motion:'defeat'})+'</div>':'<div class="result-emblem">◎</div>')+'<h2>'+tr(target?'¡JUGADOR EXPULSADO!':'NO SE EXPULSÓ A NADIE')+'</h2><p>'+clean(target?.name||tr(result.tie?'EMPATE':'VOTO NULO'))+'</p>'+(gameState.settings.confirmEjects&&target?'<div class="result-verdict">'+tr(result.targetWasImpostor?'¡ERA UN IMPOSTOR!':'NO ERA EL IMPOSTOR')+'</div><p>'+tr('IMPOSTORES RESTANTES')+': '+result.remainingImpostors+'</p>':'')+'<small id="meetingClock4">'+seconds+'s</small></div>';return;
 }
 const header='<div class="meeting-heading"><h2>'+tr(m.status==='discussion'?'¿QUÉ HA PASADO?':'¿A QUIÉN VOTAS?')+'</h2><strong id="meetingClock4" class="meeting-clock">'+seconds+'s</strong></div>';
 if(m.status==='discussion'){
  const log=(m.chat||[]).map(msg=>'<div class="meeting-message"><span class="meeting-chat-avatar">'+window.StarshipVisual.svg(avatarAppearance(gameState.players[msg.id]),{motion:'idle'})+'</span><div class="meeting-message-body"><b>'+clean(msg.name)+'</b><span>'+clean(msg.text)+'</span></div></div>').join('');
  modal.innerHTML='<div class="card meeting-card"><small>'+tr(m.isReport?'CUERPO REPORTADO':'REUNIÓN DE EMERGENCIA')+'</small>'+header+'<div class="meeting-chat-log" id="meetingChatLog">'+(log||'<p>'+tr('La conversación está abierta.')+'</p>')+'</div>'+(ghost?'<p>'+tr('Los fantasmas no pueden hablar con los vivos.')+'</p>':'<div class="meeting-compose"><input id="meetingChatInput" maxlength="240" placeholder="'+tr('Escribe un mensaje…')+'"><button id="meetingSend">'+tr('ENVIAR')+'</button></div><button id="meetingSkip" '+(m.skips?.[playerId]?'disabled':'')+'>'+tr('SALTAR CONVERSACIÓN')+'</button>')+'</div>';
  if(!ghost){$('meetingChatInput').value=draft;if(focus){$('meetingChatInput').focus();$('meetingChatInput').setSelectionRange(pos,pos);}$('meetingSend').onclick=async()=>{const input=$('meetingChatInput'),text=input.value.trim();if(!text)return;try{await gameAction('chat',{text});if($('meetingChatInput'))$('meetingChatInput').value=''}catch(e){toast(e.message)}};$('meetingChatInput').onkeydown=e=>{if(e.key==='Enter')$('meetingSend').click()};$('meetingSkip').onclick=()=>gameAction('skip',{meetingId:m.id}).catch(e=>toast(e.message));}
  const logEl=$('meetingChatLog');if(logEl)logEl.scrollTop=logEl.scrollHeight;return;
 }
 const choices=alive.map(p=>'<button class="vote-choice" data-vote="'+p.id+'" '+(ghost||own?'disabled':'')+'><span class="vote-entry"><span class="meeting-monguito">'+window.StarshipVisual.svg(avatarAppearance(p),{motion:'idle'})+'</span>'+clean(p.name)+(gameState.settings.anonymousVotes?'':'<small>'+Object.entries(m.votes||{}).filter(([id,target])=>target===p.id).map(([id])=>clean(gameState.players[id]?.name||'')).join(' · ')+'</small>')+'</span><b>'+tr('VOTAR')+'</b></button>').join('');
 modal.innerHTML='<div class="card meeting-card">'+header+'<p>'+tr('Votos emitidos')+': '+(m.voteCount||0)+' / '+alive.length+'</p><div class="vote-list">'+choices+'</div><button class="vote-choice meeting-null" data-vote="null" '+(ghost||own?'disabled':'')+'>'+tr('VOTO NULO · NO EXPULSAR A NADIE')+'</button><p>'+tr(ghost?'Los fantasmas no pueden votar.':own?'Tu voto está registrado.':'Elige un jugador o salta el voto.')+'</p></div>';
 modal.querySelectorAll('[data-vote]').forEach(b=>b.onclick=()=>gameAction('vote',{meetingId:m.id,targetId:b.dataset.vote}).catch(e=>toast(e.message)));
}
async function finishRepair(station,code){if(soloMode){if(gameState.sabotage)gameState.sabotage.active=false;updateTasks();return;}return gameAction('repair',{stationId:station.id,code});}
let v4RepairHold=null;
function openRepairTerminal(station){
 const sab=gameState?.sabotage;if(!sab?.active||!station)return;const m=$('modal');m.classList.remove('hidden');m.classList.add('task-modal');
 if(sab.type==='reactor'){
  m.innerHTML='<div class="card task-card"><small>'+tr('CONTENCIÓN DEL REACTOR')+'</small><h2>'+tr('SINCRONIZAR DOS TERMINALES')+'</h2><p>'+tr('Dos tripulantes deben mantener pulsados terminales distintos al mismo tiempo.')+'</p><button class="primary reactor-hold4" id="hold4">✋ '+tr('MANTENER PULSADO')+'</button><p id="holdStatus4">'+tr('Esperando al segundo tripulante…')+'</p><button id="cancelTask">'+tr('CERRAR')+'</button></div>';
  let holding=false,busy=false;const send=async()=>{if(!holding||busy)return;busy=true;try{await finishRepair(station);if(!gameState?.sabotage?.active){holding=false;clearInterval(v4RepairHold);m.classList.add('hidden');m.classList.remove('task-modal');window.StarshipAudio?.play('repair');}}catch(e){toast(e.message)}finally{busy=false}};
  $('hold4').onpointerdown=e=>{e.preventDefault();holding=true;e.currentTarget.setPointerCapture(e.pointerId);send();clearInterval(v4RepairHold);v4RepairHold=setInterval(send,750)};
  const stop=()=>{holding=false;clearInterval(v4RepairHold);};$('hold4').onpointerup=stop;$('hold4').onpointercancel=stop;$('cancelTask').onclick=()=>{stop();closeModal4()};
 }else if(sab.type==='o2'){
  const code=sab.codes?.[station.station]||'';m.innerHTML='<div class="card task-card"><small>'+clean(station.room)+'</small><h2>'+tr('REINICIO DE SUMINISTRO O₂')+'</h2><div class="code4">'+clean(code)+'</div><input id="code4" inputmode="numeric" maxlength="3" placeholder="000"><button id="submit4" class="primary">'+tr('VALIDAR CÓDIGO')+'</button><button id="cancelTask">'+tr('CERRAR')+'</button></div>';
  $('submit4').onclick=async()=>{try{await finishRepair(station,$('code4').value.trim());closeModal4();window.StarshipAudio?.play('repair')}catch(e){toast(e.message)}};$('cancelTask').onclick=closeModal4;
 }else openMiniGame({id:'repair_'+sab.type,name:tr('REPARAR')+' '+sab.type},station);
}
function closeModal4(){clearInterval(v4RepairHold);$('modal').classList.add('hidden');$('modal').classList.remove('task-modal');keys={};move={x:0,y:0};}
function reportBody4(){const p=gameState?.players?.[playerId];if(!p?.alive)return;const body=Object.values(gameState.players).find(q=>!q.alive&&q.body&&!q.body.reported&&Math.hypot(p.x-q.body.x,p.y-q.body.y)<=3);if(body)meeting(true,body.id);}
function interact4(){const p=gameState?.players?.[playerId];if(!p)return;const r=p.alive&&p.role==='crew'&&activeRepairStations().find(r=>Math.hypot(p.x-r.x,p.y-r.y)<=3);if(r)openRepairTerminal(r);else startTask();}
function openSabotage4(){if($('sabotage').disabled)return;$('sabotagePanel').classList.toggle('hidden');keys={};}
function installControls4(){
 $('create').onclick=createRoom;$('join').onclick=joinRoom;$('start').onclick=startMatch;$('leave').onclick=leaveCurrentRoom;$('explore').onclick=startExplore;
 $('color').onchange=applyMonguitoColor;$('shopOpen').onclick=openShop;$('shopClose').onclick=closeShop;$('customizeOpen').onclick=openCustomize;$('customizeClose').onclick=closeCustomize;
 $('customTabs').querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>{customCategory=b.dataset.category;renderCustomizer()});
 $('customDone').onclick=async()=>{try{await authority('equip',{loadout:getLoadout()});if(roomId&&gameState?.phase==='lobby')await gameAction('appearance');if(me){me.color=$('color').value;me.cosmetics=getLoadout();}closeCustomize();toast(tr('Personaje guardado.'))}catch(e){toast(e.message)}};
 $('lobbyChatSend').onclick=sendLobbyChat;$('lobbyChatInput').onkeydown=e=>{if(e.key==='Enter')sendLobbyChat()};
 $('taskToggle').onclick=()=>$('taskText').classList.toggle('hidden');$('mapBtn').onclick=toggleMap4;$('mapClose').onclick=()=>$('mapPanel').classList.add('hidden');
 $('moreBtn').onclick=()=>$('moreMenu').classList.toggle('hidden');$('resumeBtn').onclick=()=>$('moreMenu').classList.add('hidden');$('leaveMatchBtn').onclick=leaveCurrentRoom;
 $('interact').onclick=interact4;$('report').onclick=reportBody4;$('emergency').onclick=()=>meeting(false);$('kill').onclick=eliminate;$('vent').onclick=useVent;
 $('sabotage').onclick=openSabotage4;$('sabotageClose').onclick=()=>$('sabotagePanel').classList.add('hidden');
 $('sabotagePanel').querySelectorAll('[data-sab]').forEach(b=>b.onclick=async()=>{try{if(soloMode){const type=b.dataset.sab;gameState.sabotage={active:true,type,target:({lights:'electrical_wires',reactor:'reactor_start',comms:'comms_fix',o2:'o2_admin',doors:'admin_card'})[type],codes:createO2Codes(),completedStations:[]};updateTasks()}else await gameAction('sabotage',{system:b.dataset.sab});$('sabotagePanel').classList.add('hidden')}catch(e){toast(e.message)}});
 $('endContinue').onclick=async()=>{if(soloMode)return location.reload();if(isHost){try{await gameAction('rematch')}catch(e){toast(e.message)}}else{toast(tr('Esperando al anfitrión para volver al lobby.'));}};
 canvas=$('world');canvas.onclick=e=>{const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;const target=ventTargetButtons.find(b=>x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h);if(target){if(target.action==='exit')useVent();else travelVentTo(target.id)}};
 let sDown=0,sTimer=null;
 window.addEventListener('keydown',e=>{
  const k=e.key.toLowerCase(),typing=/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName)||e.target?.isContentEditable||e.isComposing;
  if(k==='escape'){e.preventDefault();closeAll4();return;}if(typing||$('game').classList.contains('hidden'))return;
  if(['w','a','s','d','x','arrowup','arrowdown','arrowleft','arrowright',' '].includes(k))e.preventDefault();
  if(k==='s'&&gameState?.players?.[playerId]?.role==='impostor'){if(e.repeat)return;sDown=performance.now();clearTimeout(sTimer);sTimer=setTimeout(()=>{keys.s=true},160);return;}
  const arrows={arrowup:'w',arrowdown:'s',arrowleft:'a',arrowright:'d'};if(['w','a','s','d','x',...Object.keys(arrows)].includes(k)){keys[arrows[k]||k]=true;return;}
  if(e.repeat)return;const controls={e:interact4,r:reportBody4,m:toggleMap4,g:useVent,q:()=>{if(!$('emergency').disabled)meeting(false)},c:()=>{if(securityCameraIndex>=0)closeSecurityCameras();else if(!$('securityBtn').disabled)openSecurityCameras()}};if(controls[k]){e.preventDefault();controls[k]()}
 },{passive:false});
 window.addEventListener('keyup',e=>{const k=e.key.toLowerCase(),arrows={arrowup:'w',arrowdown:'s',arrowleft:'a',arrowright:'d'};delete keys[k];delete keys[arrows[k]];if(k==='s'&&sDown){clearTimeout(sTimer);if(performance.now()-sDown<160)openSabotage4();sDown=0;}});
 window.addEventListener('blur',()=>{sDown=0;clearTimeout(sTimer);keys={};});
 window.addEventListener('online',()=>{if(roomId&&!soloMode){clearTimeout(poll);pollRoom()}});
 document.addEventListener('visibilitychange',()=>{keys={};move={x:0,y:0};});
 $('securityBtn').onclick=()=>{if(securityCameraIndex>=0)closeSecurityCameras();else openSecurityCameras()};$('securityClose').onclick=closeSecurityCameras;
}
function toggleMap4(){$('mapPanel').classList.toggle('hidden');if(!$('mapPanel').classList.contains('hidden'))drawMiniMap();}
function closeAll4(){for(const id of ['mapPanel','moreMenu','sabotagePanel','settings4','info4','shopDetail'])$(id)?.classList.add('hidden');closeSecurityCameras();if(!gameState?.meeting)closeModal4();keys={};move={x:0,y:0};}
function installUi4(){
 const element=document.createElement('div');element.innerHTML='<div class="v4-menu-tools"><span id="build4">STARSHIP SABOTAGE · 4.0</span><button id="settingsOpen4" aria-label="'+tr('Ajustes')+'">⚙ '+tr('AJUSTES')+'</button><button id="publicRooms4">'+tr('SALAS PÚBLICAS')+'</button><button id="reconnect4" class="'+(localStorage.getItem('starship_active_room')?'':'hidden')+'">'+tr('RECONECTAR')+'</button></div><div id="connection4" class="connection4">'+tr('EXPLORACIÓN')+'</div><div id="ghost4" class="ghost4 hidden"></div><button id="infoOpen4" class="info-open4">⌁ '+tr('SISTEMAS')+'</button><div id="settings4" class="overlay hidden" role="dialog" aria-modal="true"></div><div id="info4" class="overlay hidden" role="dialog" aria-modal="true"></div>';
 document.body.appendChild(element);$('settingsOpen4').onclick=openSettings4;$('infoOpen4').onclick=openInformation4;
 $('publicRooms4').onclick=async()=>{try{const r=await authority('public_rooms');const modal=$('info4');modal.classList.remove('hidden');modal.innerHTML='<div class="card"><h2>'+tr('SALAS PÚBLICAS')+'</h2>'+(r.rooms.length?r.rooms.map(s=>'<button data-code="'+s.code+'">'+clean(s.host||s.code)+' · '+s.count+'/'+s.maxPlayers+'</button>').join(''):'<p>'+tr('No hay salas públicas disponibles.')+'</p>')+'<button data-close>'+tr('CERRAR')+'</button></div>';modal.querySelector('[data-close]').onclick=()=>modal.classList.add('hidden');modal.querySelectorAll('[data-code]').forEach(b=>b.onclick=()=>{$('code').value=b.dataset.code;modal.classList.add('hidden');joinRoom()})}catch(e){toast(e.message)}};
 $('reconnect4').onclick=()=>{$('code').value=localStorage.getItem('starship_active_room')||'';joinRoom()};
 $('max').onchange=$('imps').onchange=()=>{if(isHost&&roomId)gameAction('settings',{settings:{maxPlayers:Number($('max').value),impostors:Number($('imps').value)}}).catch(e=>toast(e.message))};
 window.StarshipI18n?.observe(document.body,()=>gameLang);applyPreferences4();
 document.addEventListener('pointerdown',()=>window.StarshipAudio?.unlock(),{once:true});
 setInterval(()=>{if(gameState&&!$('mapPanel').classList.contains('hidden'))drawMiniMap();if(gameState?.meeting)renderMeetingUI();if(!$('info4').classList.contains('hidden')&&$('info4').dataset.live==='true')updateInformation4();if(roomId&&Date.now()-v4LastSuccess>10000)setConnectionState('reconnecting');},500);
 if(location.hostname==='127.0.0.1'||location.hostname==='localhost')Object.assign(window.__STARSHIP_TEST__||{}, {state:()=>structuredClone(gameState),setPosition:(x,y)=>{const p=gameState.players[playerId];p.x=x;p.y=y;},sync:pollRoom,action:gameAction,network:()=>({samples:v4Samples,p95:[...v4Samples].sort((a,b)=>a-b)[Math.floor(v4Samples.length*.95)]}),settings:()=>({...v4Settings})});
}
function openSettings4(){
 keys={};const modal=$('settings4');modal.classList.remove('hidden');
 const range=(key,label,min,max,step=1)=>'<label>'+tr(label)+'<input data-pref="'+key+'" type="range" min="'+min+'" max="'+max+'" step="'+step+'" value="'+v4Preferences[key]+'"></label>';
 const cfg=gameState?.settings||v4Settings,hostOptions=isHost||!roomId;
 const fields=[['killCooldown','Cooldown de asesinato',10,60],['killDistance','Distancia de asesinato',1,3.2,.1],['discussionTime','Tiempo de debate',10,120],['votingTime','Tiempo de votación',10,90],['emergencyMeetings','Reuniones por jugador',0,5],['emergencyCooldown','Cooldown de reunión',10,60],['sabotageCooldown','Cooldown de sabotaje',15,60],['speed','Velocidad',3,7,.1],['crewVision','Visión de tripulantes',6,14,.5],['impostorVision','Visión de impostores',7,18,.5],['commonTasks','Tareas comunes',0,2],['shortTasks','Tareas cortas',1,6],['longTasks','Tareas largas',0,4]];
 modal.innerHTML='<div class="card settings-card4"><div class="settings-head4"><h2>'+tr('AJUSTES')+'</h2><button data-close>×</button></div><div class="settings-grid4"><section><h3>'+tr('AUDIO Y PANTALLA')+'</h3>'+range('master','Volumen general',0,1,.05)+range('effects','Efectos',0,1,.05)+range('music','Música',0,.5,.02)+'<label>'+tr('Calidad gráfica')+'<select data-pref="quality"><option value="low">'+tr('Baja')+'</option><option value="medium">'+tr('Media')+'</option><option value="high">'+tr('Alta')+'</option></select></label><label>'+tr('Idioma')+'<select id="lang4"><option value="es">Español</option><option value="en">English</option><option value="fr">Français</option></select></label><label><input data-pref="reduceMotion" type="checkbox" '+(v4Preferences.reduceMotion?'checked':'')+'> '+tr('Reducir animaciones')+'</label><label><input data-pref="contrast" type="checkbox" '+(v4Preferences.contrast?'checked':'')+'> '+tr('Alto contraste')+'</label>'+range('scale','Tamaño de interfaz',.85,1.25,.05)+range('sensitivity','Sensibilidad',.5,1.5,.05)+'<p class="control-help4">WASD / ↑↓←→ · '+tr('Movimiento')+'<br>E · '+tr('Interacción')+' | R · '+tr('Reportar')+'<br>M · '+tr('Mapa')+' | C · CCTV<br>G · '+tr('Conductos')+' | Q · SOS<br>'+tr('S: toque para sabotear; mantener para bajar.')+'<br>Esc · '+tr('Cerrar menús')+'</p></section><section><h3>'+tr('REGLAS DE PARTIDA')+'</h3>'+fields.map(([key,label,min,max,step])=>'<label>'+tr(label)+'<input data-rule="'+key+'" type="number" min="'+min+'" max="'+max+'" step="'+(step||1)+'" value="'+cfg[key]+'" '+(!hostOptions||gameState?.phase==='playing'?'disabled':'')+'></label>').join('')+['anonymousVotes','confirmEjects','visualTasks'].map((key,i)=>'<label><input data-rule="'+key+'" type="checkbox" '+(cfg[key]?'checked':'')+' '+(!hostOptions?'disabled':'')+'> '+tr(['Votos anónimos','Confirmar expulsiones','Tareas visuales'][i])+'</label>').join('')+'<label>'+tr('Barra de tareas')+'<select data-rule="taskBar"><option value="always">'+tr('Siempre')+'</option><option value="meetings">'+tr('Reuniones')+'</option><option value="never">'+tr('Nunca')+'</option></select></label><label>'+tr('Privacidad')+'<select data-rule="privacy"><option value="private">'+tr('Privada')+'</option><option value="public">'+tr('Pública')+'</option></select></label></section></div><button class="primary" id="settingsSave4">'+tr('GUARDAR')+'</button></div>';
 modal.querySelector('[data-close]').onclick=()=>modal.classList.add('hidden');modal.querySelector('[data-pref="quality"]').value=v4Preferences.quality;$('lang4').value=gameLang;modal.querySelector('[data-rule="taskBar"]').value=cfg.taskBar;modal.querySelector('[data-rule="privacy"]').value=cfg.privacy;
 $('settingsSave4').onclick=async()=>{modal.querySelectorAll('[data-pref]').forEach(e=>v4Preferences[e.dataset.pref]=e.type==='checkbox'?e.checked:e.type==='range'?Number(e.value):e.value);gameLang=$('lang4').value;v4Preferences.language=gameLang;localStorage.setItem('starship_language',gameLang);localStorage.setItem('starship_settings4',JSON.stringify(v4Preferences));const rules={...cfg};modal.querySelectorAll('[data-rule]').forEach(e=>{if(!e.disabled)rules[e.dataset.rule]=e.type==='checkbox'?e.checked:e.type==='number'?Number(e.value):e.value});try{if(hostOptions&&roomId&&gameState?.phase==='lobby')await gameAction('settings',{settings:rules});else if(!roomId)Object.assign(v4Settings,window.StarshipRules.settings(rules));applyPreferences4();applyLanguage();window.StarshipI18n?.refresh();modal.classList.add('hidden')}catch(e){toast(e.message)}};
}
function applyPreferences4(){document.documentElement.dataset.quality=v4Preferences.quality;document.documentElement.classList.toggle('reduce-motion',v4Preferences.reduceMotion);document.documentElement.classList.toggle('high-contrast',v4Preferences.contrast);document.documentElement.style.setProperty('--ui-scale',v4Preferences.scale);window.StarshipAudio?.configure(v4Preferences);}
async function openWallet4(){try{await authority('profile');const m=$('info4');m.dataset.live='false';m.classList.remove('hidden');m.innerHTML='<div class="card info-card4"><div class="settings-head4"><h2>'+tr('HISTORIAL')+'</h2><button data-close>×</button></div><p>'+tr('SALDO')+': '+economy.coins+' '+tr('pesos universales')+'</p><div class="wallet-log4">'+(economy.history?.length?[...economy.history].reverse().map(row=>'<div class="vital-row4"><span>'+new Date(row.at).toLocaleString(gameLang)+' · '+tr(row.reason==='purchase'?'COMPRA':row.reason==='verified_gift'?'REGALO VERIFICADO':'RECOMPENSA DE PARTIDA')+'</span><b>'+((row.amount||0)>0?'+':'')+row.amount+'</b></div>').join(''):'<p>'+tr('Todavía no hay movimientos.')+'</p>')+'</div></div>';m.querySelector('[data-close]').onclick=()=>m.classList.add('hidden')}catch(e){toast(e.message)}}
function openInformation4(){const m=$('info4');m.dataset.live='true';m.classList.remove('hidden');m.innerHTML='<div class="card info-card4"><div class="settings-head4"><h2>'+tr('SISTEMAS DE LA NAVE')+'</h2><button id="infoClose4">×</button></div><div id="informationBody4"></div><div id="ghostChat4"></div></div>';$('infoClose4').onclick=()=>{m.classList.add('hidden');m.dataset.live='false'};updateInformation4();}
function updateInformation4(){
 const el=$('informationBody4'),p=gameState?.players?.[playerId];if(!el)return;if(!p){el.innerHTML='<p>'+tr('Entra en una partida para consultar los sistemas.')+'</p>';return;}
 const room=MAP.rooms.find(r=>window.StarshipRules.inside(p.x,p.y,r)),comms=gameState.sabotage?.active&&gameState.sabotage.type==='comms';
 if(comms)el.innerHTML='<p>'+tr('COMUNICACIONES INTERFERIDAS')+'</p>';
 else if(room?.id==='admin')el.innerHTML='<h3>'+tr('OCUPACIÓN POR SALA')+'</h3><div class="info-grid4">'+MAP.rooms.map(r=>'<div>'+tr(r.name)+'<strong>'+Object.values(gameState.players).filter(q=>q.alive&&!q.inVent&&window.StarshipRules.inside(q.x,q.y,r)).length+'</strong></div>').join('')+'</div>';
 else if(['medbay','laboratory'].includes(room?.id))el.innerHTML='<h3>'+tr('SIGNOS VITALES')+'</h3>'+Object.values(gameState.players).map(q=>'<div class="vital-row4"><span>'+clean(q.name)+'</span><b class="'+(q.alive?'alive':'dead')+'">'+tr(q.alive?'ACTIVO':'SIN SEÑAL')+'</b></div>').join('');
 else el.innerHTML='<p>'+tr('Consulta ocupación en Administración y signos vitales en Enfermería o Laboratorio.')+'</p><p>'+tr('SALA ACTUAL')+': '+tr(room?.name||'PASILLO')+'</p><p>'+tr('TAREAS')+': '+(p.done?.length||0)+' / '+(p.tasks?.length||0)+'</p>';
 if(!p.alive){const ghost=$('ghostChat4'),draft=$('ghostInput4')?.value||'',focus=document.activeElement?.id==='ghostInput4';const messages=(gameState.chat||[]).filter(m=>m.ghost).map(m=>'<p><b>'+clean(m.name)+':</b> '+clean(m.text)+'</p>').join('');const signature=messages;if(ghost.dataset.messages!==signature||!$('ghostInput4')){ghost.dataset.messages=signature;ghost.innerHTML='<h3>'+tr('CHAT DE FANTASMAS')+'</h3><div class="ghost-log4">'+messages+'</div><input id="ghostInput4" maxlength="240"><button id="ghostSend4">'+tr('ENVIAR')+'</button>';$('ghostInput4').value=draft;if(focus)$('ghostInput4').focus();$('ghostSend4').onclick=async()=>{try{await gameAction('chat',{text:$('ghostInput4').value});$('ghostInput4').value=''}catch(e){toast(e.message)}};}}
}

installUi4();setup();notifyGamePatch();applyMonguitoColor();updatePreview();updateCoinUI();say(AppwriteSDK?'Appwrite disponible. Crea o únete a una sala.':'Modo exploración disponible; Appwrite no está conectado.');
})();
