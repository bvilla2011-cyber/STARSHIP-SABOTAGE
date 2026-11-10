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
assert.equal(MAP.rooms.length, 16, 'Número esperado de salas tras compactar el mapa');
assert.equal(MAP.corridors.length, 11, 'Número esperado de corredores separados para no atravesar la cafetería');
assert.equal(MAP.tasks.length, 15, 'Número esperado de tareas tras retirar las dos salas secundarias');
assert.equal(MAP.repairs.length, 5, 'Número esperado de reparaciones');
assert.equal(MAP.vents.length, 14, 'Número esperado de conductos');
assert.ok(MAP.obstacles.length > 30, 'Cada sala debe definir colisionadores para su mobiliario');
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
const sx = Math.round(60 / step), sy = Math.round(40 / step);
assert.ok(pass(60, 40), 'El spawn debe ser transitable y quedar libre de la nueva mesa SOS');
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
console.log('✓ Navegación: spawn, 15 tareas, 5 reparaciones y 14 conductos conectados');

const ventIds = new Set(MAP.vents.map(v => v.id));
for (const vent of MAP.vents) for (const link of vent.links) {
  assert.ok(ventIds.has(link), 'Conducto conectado a un ID inexistente: ' + link);
  assert.ok(MAP.vents.find(v => v.id === link).links.includes(vent.id), 'Conexión de conductos no recíproca: ' + vent.id + ' ↔ ' + link);
}
const types = new Set(['card','wires','filter','sequence','scan','route','fuel','upload']);
for (const task of MAP.tasks) assert.ok(types.has(task.type), 'Minijuego no soportado: ' + task.type);
const repairIds = new Set(MAP.repairs.map(r => r.id));
for (const id of ['electrical_wires','reactor_start','comms_fix','o2_filter','admin_card']) assert.ok(repairIds.has(id), 'Falta estación de reparación: ' + id);
console.log('✓ Datos de minijuegos, sabotajes y red de conductos coherentes');

for (const token of ['async function eliminate(', 'async function useVent(', 'async function processMeetingVotes(', 'function finishMatch(', 'function showRoleReveal(', 'function renderLobby(', 'function draw()', 'function startTask()', 'function openMiniGame(', 'async function moveUpdate(']) {
  assert.ok(html.includes(token), 'Falta sistema de juego: ' + token);
}
assert.ok(html.includes('Date.now()+10000'), 'La cuenta atrás de lobby debe ser de 10 segundos');
assert.ok(html.includes('blockedByRoomWall('), 'Falta la colisión de paredes');
assert.ok(html.includes('function collidesFurniture(') && html.includes("o.kind==='circle'"), 'El mobiliario debe tener colisión circular o rectangular');
assert.ok(html.includes('ellipse(r,cx,cy,1.72,1.12)') && html.includes("fillText('SOS',cx,cy+.32)"), 'La cafetería debe tener una mesa SOS central con botón visible y colisionador');
assert.ok(html.includes("canvas.addEventListener('click'") && html.includes("cafe.x+cafe.w/2"), 'El botón SOS debe responder al clic y a la interacción cercana');
assert.ok(html.includes('for(let i=0;i<72;i++)angles.push'), 'Las sombras deben usar mayor resolución angular');
assert.ok(!html.includes("makeRoom('laboratory'") && !html.includes("makeRoom('cargo_s'"), 'El mapa compacto no debe incluir las dos salas retiradas');
assert.ok(html.includes('ellipse(r,cx,cy,1.72,1.12)') && html.includes("fillText('SOS',cx,cy+.32)"), 'La cafetería debe tener una mesa SOS central con botón visible y colisionador');
assert.ok(html.includes("canvas.addEventListener('click'") && html.includes('function startTask()') && html.includes("cafe.x+cafe.w/2"), 'El botón SOS debe responder al clic y a la interacción cercana');
assert.ok(html.includes('for(let i=0;i<72;i++)angles.push'), 'La visibilidad y las sombras deben usar mayor resolución angular');
assert.ok(!html.includes("'LABORATORIO','medbay'") && !html.includes("'CARGA SUR','storage'"), 'El mapa compacto no debe incluir las dos salas retiradas');
assert.ok(html.includes("const visionRadius=lightsSabotage?2.35:(p.role==='impostor'?10.5:11.9)"), 'La visión normal debe ampliarse ligeramente y el sabotaje debe limitarla');
assert.ok(html.includes('El mobiliario sigue siendo sólido para el jugador, pero no proyecta sombras.'), 'Los muebles no deben proyectar sombras');
assert.ok(html.includes('const corridors=MAP.corridors||[]') && html.includes('corridorId:corridor.id'), 'Los bordes de los pasillos deben bloquear la luz');
assert.ok(html.includes('function segmentRectInterval') && html.includes('function shadowGeometryAudit()'), 'Las sombras de pasillos deben recortarse en habitaciones y cruces');
assert.ok(!html.includes('for(const o of MAP.obstacles||[]){\n  if(o.kind===\'rect\')'), 'Los obstáculos de mobiliario no deben formar parte de la oclusión de luz');
assert.ok(html.includes('window.__starshipLightLayer') && html.includes("globalCompositeOperation='destination-out'"), 'La iluminación debe usar una máscara de oscuridad con penumbra');
assert.ok(html.includes('function playVictimKillAnimation'), 'Falta animación de víctima');
assert.ok(html.includes('if(i<stage)return;n.pos=angle'), 'Las agujas activas de calibración deben animarse');
assert.ok(html.includes("players.filter(q=>q.vote?.startsWith(m.id+'|')).length"), 'El contador de votos debe refrescarse con las votaciones remotas');
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
assert.ok(html.includes("m.id+'|'+choice") && html.includes("q.vote?.startsWith(m.id+'|')"), 'Los votos deben aislarse por reunión');
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
assert.ok(html.includes("const canAct=!!p&&p.alive&&!p.inVent&&!gameState?.meeting") && html.includes("$('emergency').disabled=!sos"), 'Los controles contextuales deben respetar la proximidad y el estado del jugador');
assert.ok(html.includes('TAREA [E]') && html.includes('REPORTAR [R]') && html.includes('MAPA [M]'), 'El HUD debe mostrar los atajos');
assert.ok(html.includes('id="interact" class="action-orb" disabled') && html.includes('id="report" class="report-orb" disabled') && html.includes('id="emergency" class="sos-button" disabled'), 'Las tres acciones contextuales deben arrancar desactivadas hasta calcular proximidad');
assert.ok(html.includes("if(k==='e'&&!e.repeat)startTask()") && html.includes("if(k==='r'&&!e.repeat)reportNearbyBody()"), 'Las teclas E y R deben activar sus acciones correspondientes');
assert.ok(html.includes('window.refreshActionAvailability=function()') && html.includes('window.refreshActionAvailability();'), 'El refresco de botones debe estar disponible para el bucle principal');
assert.ok(html.includes('map-overlay-and-disabled-actions') && html.includes('background:rgba(7,21,34,.10)'), 'El mapa debe ocupar casi toda la pantalla con fondo translúcido');
assert.ok(html.includes('#emergency:disabled{filter:grayscale(1)!important;opacity:.32!important'), 'Los botones desactivados deben verse grises y atenuados');
console.log('QA OK — validación estática y conectividad superadas');
