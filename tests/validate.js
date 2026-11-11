'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const html = fs.readFileSync('index.html', 'utf8');
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map(match => match[1]).filter(source => source.trim());
assert.ok(scripts.length, 'Debe existir el script principal');
for (const [index, source] of scripts.entries()) {
  new vm.Script(source, { filename: 'index.html:inline-script-' + index });
}
console.log('✓ Sintaxis JavaScript: todos los scripts compilan');

const mapStart = html.indexOf('const makeRoom=');
const mapEnd = html.indexOf('const MAP_SCALE', mapStart);
assert.ok(mapStart >= 0 && mapEnd > mapStart, 'No se encuentra la definición MAP');
const mapSource = html.slice(mapStart, mapEnd);
const MAP = vm.runInNewContext(mapSource + '; MAP');
assert.equal(MAP.rooms.length, 9, 'El mapa debe incluir las nueve salas, incluidas Oxígeno y Seguridad');
assert.equal(MAP.corridors.length, 2, 'El mapa debe conservar solo dos corredores horizontales');
assert.equal([...MAP.corridors].map(c => c.id).join(','), 'upper_link,middle_link', 'No deben quedar ramales laterales ni verticales');
assert.equal(Array.from(MAP.corridors[0].points, p => p.join(',')).join(';'), '7,21;70,21', 'El pasillo superior debe llegar hasta la entrada sur de Seguridad');
assert.equal(Array.from(MAP.corridors[1].points, p => p.join(',')).join(';'), '7,35;45,35', 'El corredor central debe acabar recto y alineado con las paredes');
assert.equal(MAP.rooms.find(r => r.id === 'security').doors.length, 1, 'Seguridad debe tener una única entrada desde el pasillo superior');
assert.equal(MAP.rooms.find(r => r.id === 'security').doors[0].side, 'bottom', 'La entrada de Seguridad debe estar en el muro inferior');
assert.equal(MAP.tasks.length, 10, 'El nuevo mapa debe ofrecer diez misiones, ocho diferentes y cables repetidos');
const counts=MAP.tasks.reduce((o,t)=>(o[t.type]=(o[t.type]||0)+1,o),{});
assert.equal(counts.wires,2,'Cableado es el único tipo de misión repetido');
assert.ok(Object.entries(counts).every(([type,n])=>type==='wires'||n===1),'Las demás misiones deben ser únicas');
assert.equal(MAP.repairs.length, 6, 'El mapa debe incluir las seis estaciones de reparación');
assert.equal(MAP.vents.length, 6, 'El mapa debe tener exactamente seis conductos');
assert.equal(MAP.vents.filter(v => v.zone === 'west').length, 3, 'La zona oeste debe tener tres conductos');
assert.equal(MAP.vents.filter(v => v.zone === 'east').length, 3, 'La zona este debe tener tres conductos');
for (const zone of ['west','east']) {
  const group = MAP.vents.filter(v => v.zone === zone);
  const seen = new Set([group[0].id]), queue = [group[0].id];
  while (queue.length) { const current = queue.shift(); const vent = group.find(v => v.id === current); assert.ok(vent, 'Cada enlace debe apuntar a un conducto de la misma zona'); for (const id of vent.links) if (group.some(v => v.id === id) && !seen.has(id)) { seen.add(id); queue.push(id); } }
  assert.equal(seen.size, 3, 'Los tres conductos de la zona '+zone+' deben estar conectados');
}
assert.ok(MAP.vents.every(v => v.links.every(id => MAP.vents.find(q => q.id === id)?.zone === v.zone)), 'No debe haber conexiones entre zonas');
assert.ok(MAP.rooms.some(r => r.id === 'oxygen'), 'Debe existir la sala de Oxígeno');
assert.ok(MAP.rooms.some(r => r.id === 'security'), 'Debe existir la sala de Seguridad');
assert.equal(MAP.repairs.filter(r => r.type === 'code').length, 2, 'O₂ debe tener dos terminales de código');
assert.ok(html.includes('40000'), 'El cooldown de asesinato debe ser de 40 segundos');
assert.ok(html.includes('35000'), 'El cooldown de sabotaje debe ser de 35 segundos');
assert.ok(html.includes('6.7*0.34'), 'El sabotaje de luces conserva 34% de visibilidad radial, con sombras de paredes');
assert.equal((html.match(/data-camera="[0-3]"/g) || []).length, 4, 'Seguridad debe ofrecer cuatro cámaras');

assert.equal((html.match(/<canvas data-camera="[0-3]"/g) || []).length,4,'Deben existir cuatro canvas independientes, visibles simultáneamente');
assert.ok(html.includes('security-cctv.js?v=20261111-v4')&&html.includes('security-cctv.css?v=20261111-v4'),'Deben cargarse la lógica y estilos de las nuevas cámaras');
assert.ok(html.includes("e.key?.toLowerCase()!=='c'")&&html.includes('function openSecurityCameras()'),'La tecla C debe abrir y cerrar las cámaras');
assert.ok(html.includes("const nameOrigin=p;")&&!html.includes('const nameOrigin=securityCameraIndex>=0?'),'Las cámaras no deben alterar la visión principal ni revelar jugadores detrás de paredes');
const cctvCode=fs.readFileSync('security-cctv.js','utf8');
new vm.Script(cctvCode,{filename:'security-cctv.js'});
const cctvWin={StarshipVisual:{canvas(ctx,x,y,appearance){ctx.renderedSprites.push(appearance.name)}}};
vm.runInNewContext(cctvCode,{window:cctvWin});
assert.ok(cctvWin.StarshipCCTV?.renderFeed,'El sistema de cuatro transmisiones debe exponer su renderer');
const cameras=[
 {name:'CAFETERÍA',roomId:'cafeteria'},{name:'ADMINISTRACIÓN',roomId:'admin'},
 {name:'OXÍGENO',roomId:'oxygen'},{name:'REACTOR',roomId:'reactor'}
];
const players=Object.fromEntries(cameras.map((camera,i)=>{
 const room=MAP.rooms.find(r=>r.id===camera.roomId);
 return ['cctv_player_'+i,{id:'cctv_player_'+i,name:'JUGADOR '+i,x:room.x+room.w/2,y:room.y+room.h/2,alive:true}];
}));
players.outside={id:'outside',name:'PASILLO',x:44,y:21,alive:true};
players.hiddenVent={id:'hiddenVent',name:'DUCTO',x:14,y:28,alive:true,inVent:true};
const feedState={phase:'playing',players};
const recordedRooms=[];
function fakeCameraCtx(){
 const gradient=()=>({addColorStop(){}});
 return new Proxy({renderedSprites:[],createLinearGradient:gradient,createRadialGradient:gradient},{
  get(target,key){if(key in target)return target[key];if(key==='then')return undefined;return()=>{};},
  set(target,key,value){target[key]=value;return true}
 });
}
for(let i=0;i<cameras.length;i++){
 const camera=cameras[i],room=MAP.rooms.find(r=>r.id===camera.roomId),ctx=fakeCameraCtx();
 const canvas={width:0,height:0,getBoundingClientRect:()=>({width:480,height:270}),getContext:()=>ctx};
 const output=cctvWin.StarshipCCTV.renderFeed({canvas,room,state:feedState,camera,index:i,time:1200,appearance:p=>p,world:{draw(_ctx,map){
  recordedRooms.push(map.rooms.map(r=>r.id).join(','));
  assert.equal(map.corridors.length,0,'Ninguna cámara puede dibujar pasillos');
 }}});
 assert.equal(output.room,camera.roomId,'Cada transmisión pertenece a su sala');
 assert.equal(output.players.join(','),'cctv_player_'+i,'Cada cámara debe mostrar solo los personajes de su sala');
 assert.equal(ctx.renderedSprites.join(','),'JUGADOR '+i,'No debe filtrarse un personaje de otra habitación');
 assert.ok(canvas.width>=480&&canvas.height>=270,'El lienzo de cada cámara debe producir un fotograma real');
}
assert.equal(recordedRooms.join(';'),'cafeteria;admin;oxygen;reactor','Se dibuja una sala exacta por transmisión, sin mezclar habitaciones');
console.log('✓ Seguridad: cuatro cámaras simultáneas, fotogramas renderizados y aislamiento estricto por habitación');

assert.equal(MAP.obstacles.length, 5, 'Solo las cinco mesas de cafetería tienen colisión');
assert.ok(MAP.obstacles.every(o=>o.room==='cafeteria'&&o.kind==='ellipse'),'Los bloques industriales y las sillas no deben bloquear');
assert.ok(MAP.obstacles.some(o=>o.id==='sos_table'&&o.rx===1.72&&o.ry===1.12),'La mesa SOS central debe ser sólida');
for (let i = 0; i < MAP.rooms.length; i++) for (let j = i + 1; j < MAP.rooms.length; j++) {
  const a = MAP.rooms[i], b = MAP.rooms[j];
  assert.ok(!(a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y), 'Salas solapadas: ' + a.id + ' / ' + b.id);
}

const pointInRoom = (x, y, r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
function distanceToPath(x, y, points) {
  let best = Infinity;
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1], [bx, by] = points[i];
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(x - ax - dx * t, y - ay - dy * t));
  }
  return best;
}
function inFloor(x, y) {
  return MAP.rooms.some(r => pointInRoom(x, y, r)) ||
    MAP.corridors.some(c => distanceToPath(x, y, c.points) <= c.width / 2 - .08);
}
function blockedByRoomWall(x, y, clearance = .34) {
  for (const r of MAP.rooms) {
    const door = (side, along) => r.doors.some(d =>
      d.side === side && Math.abs(along - d.offset * ((side === 'top' || side === 'bottom') ? r.w : r.h)) <= (d.width / 2 - clearance * .35));
    if (x >= r.x - clearance && x <= r.x + r.w + clearance) {
      if (Math.abs(y - r.y) < clearance && !door('top', x - r.x)) return true;
      if (Math.abs(y - (r.y + r.h)) < clearance && !door('bottom', x - r.x)) return true;
    }
    if (y >= r.y - clearance && y <= r.y + r.h + clearance) {
      if (Math.abs(x - r.x) < clearance && !door('left', y - r.y)) return true;
      if (Math.abs(x - (r.x + r.w)) < clearance && !door('right', y - r.y)) return true;
    }
  }
  return false;
}
const step = .2, width = Math.floor(MAP.w / step) + 1, height = Math.floor(MAP.h / step) + 1;
const pass = (x, y) => inFloor(x, y) && !blockedByRoomWall(x, y);
const sx = Math.round(61 / step), sy = Math.round(40 / step);
assert.ok(pass(61, 40), 'El punto de referencia de spawn debe ser transitable fuera de la mesa SOS');
const seen = new Uint8Array(width * height), queue = [sy * width + sx];
seen[queue[0]] = 1;
for (let i = 0; i < queue.length; i++) {
  const id = queue[i], x = id % width, y = Math.floor(id / width);
  for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
    const next = ny * width + nx;
    if (!seen[next] && pass(nx * step, ny * step)) { seen[next] = 1; queue.push(next); }
  }
}
const reachable = (p) => !!seen[Math.round(p.y / step) * width + Math.round(p.x / step)];
for (const point of [...MAP.tasks, ...MAP.repairs, ...MAP.vents]) {
  assert.ok(reachable(point), 'Punto inaccesible desde spawn: ' + point.id);
}
console.log('✓ Navegación: spawn, 6 tareas, 4 reparaciones y 6 conductos conectados');

const ventIds = new Set(MAP.vents.map(v => v.id));
for (const vent of MAP.vents) for (const link of vent.links) {
  assert.ok(ventIds.has(link), 'Conducto conectado a un ID inexistente: ' + link);
  assert.ok(MAP.vents.find(v => v.id === link).links.includes(vent.id), 'Conexión de conductos no recíproca: ' + vent.id + ' ↔ ' + link);
}
const types = new Set(['card','wires','filter','sequence','scan','route','fuel','upload','cipher','pulse','sort','frequency','cells']);
for (const task of MAP.tasks) assert.ok(types.has(task.type), 'Minijuego no soportado: ' + task.type);
const repairIds = new Set(MAP.repairs.map(r => r.id));
for (const id of ['electrical_wires','reactor_start','comms_fix','admin_card']) assert.ok(repairIds.has(id), 'Falta estación de reparación: ' + id);
assert.ok(!html.includes('id="claimMillionPesos"'),'No se debe mostrar el botón de monedas gratis');
assert.ok(html.includes('async function travelVentTo(')&&html.includes('function drawVentTargets(')&&!html.includes('CONDUCTOS DE SERVICIO</h2>'),'Los ductos se seleccionan con flechas visibles y cámara');
console.log('✓ Datos de minijuegos, sabotajes y red de conductos coherentes');

for (const token of ['async function eliminate(', 'async function useVent(', 'async function processMeetingVotes(', 'function finishMatch(', 'function showRoleReveal(', 'function renderLobby(', 'function draw()', 'function startTask()', 'function openMiniGame(', 'async function moveUpdate(']) {
  assert.ok(html.includes(token), 'Falta sistema de juego: ' + token);
}
assert.ok(html.includes('Date.now()+10000'), 'La cuenta atrás de lobby debe ser de 10 segundos');
assert.ok(html.includes('blockedByRoomWall('), 'Falta la colisión de paredes');
assert.ok(html.includes('function collidesFurniture(') && html.includes("o.kind==='ellipse'"), 'Las mesas deben conservar colisión elíptica');
assert.ok(html.includes('ctx.ellipse(cx,cy,1.72,1.12') && html.includes("fillText('SOS',cx,cy+.32)") && MAP.obstacles.some(o=>o.id==='sos_table'&&Math.abs(o.x-61)<.01&&Math.abs(o.y-35)<.01), 'La mesa SOS debe verse y bloquear el paso');
assert.ok(html.includes("canvas.addEventListener('click'") && html.includes("cafe.x+cafe.w/2"), 'El botón SOS debe responder al clic y a la interacción cercana');
assert.ok(html.includes('for(let i=0;i<72;i++)angles.push'), 'Las sombras deben usar mayor resolución angular');


assert.ok(html.includes("canvas.addEventListener('click'") && html.includes('function startTask()') && html.includes("cafe.x+cafe.w/2"), 'El botón SOS debe responder al clic y a la interacción cercana');
assert.ok(html.includes('for(let i=0;i<72;i++)angles.push'), 'La visibilidad y las sombras deben usar mayor resolución angular');

assert.ok(html.includes("const visionRadius=lightsSabotage?6.7*0.34:(p.role==='impostor'?10.5:6.7)"), 'La visión normal debe ampliarse ligeramente y el sabotaje debe limitarla');
assert.ok(html.includes('No furniture casts dynamic visibility shadows.'), 'Los muebles decorativos no deben proyectar sombras');
assert.ok(html.includes('const corridors=MAP.corridors||[]') && html.includes('corridorId:corridor.id'), 'Los bordes de los pasillos deben bloquear la luz');
assert.ok(html.includes('function segmentRectInterval') && html.includes('function shadowGeometryAudit()'), 'Las sombras de pasillos deben recortarse en habitaciones y cruces');
assert.ok(!html.includes('for(const o of MAP.obstacles||[]){\n  if(o.kind===\'rect\')'), 'Los obstáculos de mobiliario no deben formar parte de la oclusión de luz');
assert.ok(html.includes('window.__starshipLightLayer') && html.includes("globalCompositeOperation='destination-out'"), 'La iluminación debe usar una máscara de oscuridad con penumbra');
assert.ok(html.includes('function playVictimKillAnimation'), 'Falta animación de víctima');
assert.ok(html.includes('if(i<stage)return;n.pos=angle'), 'Las agujas activas de calibración deben animarse');
assert.ok(html.includes("alive.filter(q=>q.vote?.startsWith(m.id+'|vote:')).length"), 'El contador de votos debe refrescarse con las votaciones remotas');
assert.ok(html.includes('Permission.update(Role.user(ownerId))'), 'Las filas deben ser editables solo por su propietario autorizado');
assert.ok(html.includes('account.createAnonymousSession()'), 'El modo invitado debe usar una identidad autenticada de Appwrite');
assert.ok(html.includes('playerId=authUser.$id'), 'La identidad de jugador debe coincidir con la sesión Appwrite');
assert.ok(html.includes('async function syncRoomAccess()'), 'El anfitrión debe gestionar ACL por miembros de sala');
assert.ok(html.includes('Permission.update(Role.any())') && html.includes('Permission.read(Role.any())') && html.includes("signature='shared-guest-room-v3|'+phase") && html.includes('Permission.delete(Role.user(playerId))'), 'Las salas deben permitir sincronización guest y mantener el borrado limitado al anfitrión');
assert.ok(html.includes('function ensureCountdownTicker()') && html.includes('countdownTicker=setInterval'), 'La cuenta atrás debe avanzar y lanzar la partida aunque falle un ciclo de sondeo');
assert.ok(html.includes('prepareVent(id)') && html.includes('ventPlayerState()'), 'Las pruebas deben poder verificar entrada y salida de los conductos');
assert.ok(html.includes("$('vent').classList.remove('hidden')"), 'El control de conductos debe estar disponible para el impostor en la prueba aislada');
assert.ok(html.includes("gameState.sabotage.type==='comms'") && html.includes('COMUNICACIONES INTERFERIDAS'), 'El sabotaje de comunicaciones debe bloquear las tareas normales hasta repararlo');
assert.ok(html.includes('permissions:ownerPermissions(playerId)'), 'Las filas de jugador deben tener permisos propios');
assert.ok(html.includes('protocolVersion:2'), 'Las salas nuevas deben declarar versión de protocolo');
assert.ok(html.includes("ROOMS='rooms_v2',PLAYERS='players_v2'"), 'El cliente debe usar tablas v2 con permisos limitados');
assert.ok(html.includes("m.id+'|vote:'+choice") && html.includes("q.vote?.startsWith(m.id+'|vote:')"), 'Los votos deben aislarse por reunión y fase');
assert.ok(html.includes("endsAt:Date.now()+90000") && html.includes("m.endsAt=now+30000"), 'La reunión debe incluir 90 segundos de conversación y 30 de votación');
assert.ok(html.includes("m.id+'|chat-skip'") && html.includes("VOTO NULO · NO EXPULSAR A NADIE"), 'El debate debe poder saltarse por unanimidad y la votación debe admitir voto nulo');
assert.ok(html.includes('getCafeteriaSpawnPoints(shuffled.length)') && html.includes('teleportPlayersToCafeteria();gameState.meeting=null'), 'Los jugadores deben aparecer separados en cafetería al inicio y tras cada reunión');
assert.ok((html.match(/sos=canAct&&!sabotageActive/g)||[]).length===3 && html.includes('if(!isReport){if(gameState.sabotage?.active)return toast'), 'El botón de emergencia debe bloquearse durante sabotajes, sin impedir reportar cuerpos');
assert.ok(html.includes('meeting(true,body.id)'), 'Los reportes deben abrir la misma reunión que el botón de emergencia');
assert.ok(html.includes("activeSabotage.type!=='lights'") && html.includes('resolvedByMeeting:true'), 'Al convocar reunión deben resolverse todos los sabotajes excepto electricidad');
assert.ok(html.includes('meetingPlayerColor(msg.id)') && html.includes('meeting-message-dot'), 'El chat debe colorear cada nombre con el color del monguito');
assert.ok(html.includes('emergencyUsed:{}') && html.includes('targetWasImpostor') && html.includes('remainingImpostors') && html.includes('meeting-result-card'), 'Cada jugador debe tener un único SOS por partida y ver la revelación animada de expulsión');
assert.ok(html.includes("const nameView=") && html.includes("pointInPoly(q.x,q.y,nameView)"), 'Los nombres deben dibujarse sobre la iluminación y respetar el campo de visión');
assert.ok(!html.includes('target.alive=q.alive') && !html.includes('own.alive=local.alive'), 'El snapshot de jugadores no debe revivir eliminados');
assert.ok(!html.includes('rowId:target.id,data:{alive:false}') && !html.includes('rowId:targetId,data:{alive:false}'), 'Un cliente no debe modificar la fila de otro jugador');
assert.ok(html.includes('const ownerPermissions=ownerId=>Permission&&Role&&ownerId?') && html.includes('Permission.update(Role.user(ownerId))') && html.includes('Permission.delete(Role.user(ownerId))') && html.includes('permissions:ownerPermissions(playerId)'), 'Las filas individuales deben mantener lectura y escritura restringidas a su propietario');
assert.ok(html.includes('setInterval(pollRoom,450)'), 'El polling debe tener una frecuencia moderada');
assert.ok(html.includes('async function leaveCurrentRoom()'), 'Debe existir salida con transferencia de anfitrión');
assert.ok(html.includes('const returning=!!(existing&&existing.roomId===roomId'), 'Los jugadores originales deben poder reconectarse a su partida');
assert.ok(html.includes('function processSabotage()'), 'Los sabotajes temporizados deben resolverse desde el anfitrión');
assert.ok(html.includes('async function syncRoomAccess()'), 'Debe existir sincronización de permisos de sala');
assert.ok(!html.includes('three.min.js'), 'El proyecto debe conservar el renderer 2.5D Canvas');
console.log('✓ Sistemas críticos presentes; renderer 2.5D Canvas confirmado');
assert.ok(html.includes("if(k==='m'&&!e.repeat){e.preventDefault();toggleMapPanel();return}") && html.includes('function toggleMapPanel()'), 'La tecla M debe abrir y cerrar el mapa ampliado');
assert.ok(html.includes('width="1200" height="840"') && html.includes('g.globalAlpha=.76'), 'El mapa debe ser grande, nítido y translúcido');
assert.ok(html.includes("const canAct=!!p&&p.alive&&!p.inVent&&!gameState?.meeting") && html.includes("$('emergency').disabled=!(sos&&ready&&!used)") && html.includes('startedAt+20000') && html.includes('gameState.emergencyUsed[playerId]'), 'Los controles contextuales deben respetar la proximidad y el estado del jugador');
assert.ok(html.includes('TAREA [E]') && html.includes('REPORTAR [R]') && html.includes('MAPA [M]'), 'El HUD debe mostrar los atajos');
assert.ok(html.includes('id="interact" class="action-orb" disabled') && html.includes('id="report" class="report-orb" disabled') && html.includes('id="emergency" class="sos-button" disabled'), 'Las tres acciones contextuales deben arrancar desactivadas hasta calcular proximidad');
assert.ok(html.includes("if(k==='e'&&!e.repeat)startTask()") && html.includes("if(k==='r'&&!e.repeat)reportNearbyBody()"), 'Las teclas E y R deben activar sus acciones correspondientes');
assert.ok(html.includes('window.refreshActionAvailability=function()') && html.includes('window.refreshActionAvailability();'), 'El refresco de botones debe estar disponible para el bucle principal');
assert.ok(html.includes('map-overlay-and-disabled-actions') && html.includes('background:rgba(7,21,34,.10)'), 'El mapa debe ocupar casi toda la pantalla con fondo translúcido');
assert.ok(html.includes('#emergency:disabled{filter:grayscale(1)!important;opacity:.32!important'), 'Los botones desactivados deben verse grises y atenuados');
console.log('QA OK — validación estática y conectividad superadas');
