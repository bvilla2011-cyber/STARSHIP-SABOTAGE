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
assert.equal(MAP.rooms.length, 18, 'Número esperado de salas');
assert.equal(MAP.corridors.length, 9, 'Número esperado de corredores');
assert.equal(MAP.tasks.length, 17, 'Número esperado de tareas');
assert.equal(MAP.repairs.length, 5, 'Número esperado de reparaciones');
assert.equal(MAP.vents.length, 5, 'Número esperado de conductos');

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
const sx = Math.round(60 / step), sy = Math.round(35 / step);
assert.ok(pass(60, 35), 'El spawn debe ser transitable');
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
console.log('✓ Navegación: spawn, 17 tareas, 5 reparaciones y 5 conductos conectados');

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
assert.ok(html.includes('function playVictimKillAnimation'), 'Falta animación de víctima');
assert.ok(html.includes('if(i<stage)return;n.pos=angle'), 'Las agujas activas de calibración deben animarse');
assert.ok(html.includes("players.filter(q=>q.vote?.startsWith(m.id+'|')).length"), 'El contador de votos debe refrescarse con las votaciones remotas');
assert.ok(html.includes('Permission.update(Role.user(ownerId))'), 'Las filas deben ser editables solo por su propietario autorizado');
assert.ok(html.includes('account.createAnonymousSession()'), 'El modo invitado debe usar una identidad autenticada de Appwrite');
assert.ok(html.includes('playerId=authUser.$id'), 'La identidad de jugador debe coincidir con la sesión Appwrite');
assert.ok(html.includes('async function syncRoomAccess()'), 'El anfitrión debe gestionar ACL por miembros de sala');
assert.ok(html.includes('Permission.update(Role.user(id))') && html.includes('Permission.read(Role.any())') && html.includes("signature='shared-guest-room-v2|'+phase+'|'+memberIds.join(',')") && html.includes('Permission.delete(Role.user(playerId))'), 'Las salas deben sincronizar ACL por identidad de cada invitado y limitar lectura/escritura a sus miembros');
assert.ok(html.includes("gameState.sabotage.type==='comms'") && html.includes('COMUNICACIONES INTERFERIDAS'), 'El sabotaje de comunicaciones debe bloquear las tareas normales hasta repararlo');
assert.ok(html.includes('permissions:ownerPermissions(playerId)'), 'Las filas de jugador deben tener permisos propios');
assert.ok(html.includes('protocolVersion:2'), 'Las salas nuevas deben declarar versión de protocolo');
assert.ok(html.includes("ROOMS='rooms_v2',PLAYERS='players_v2'"), 'El cliente debe usar tablas v2 con permisos limitados');
assert.ok(html.includes("m.id+'|'+choice") && html.includes("q.vote?.startsWith(m.id+'|')"), 'Los votos deben aislarse por reunión');
assert.ok(!html.includes('target.alive=q.alive') && !html.includes('own.alive=local.alive'), 'El snapshot de jugadores no debe revivir eliminados');
assert.ok(!html.includes('rowId:target.id,data:{alive:false}') && !html.includes('rowId:targetId,data:{alive:false}'), 'Un cliente no debe modificar la fila de otro jugador');
assert.ok(!html.includes('Permission.update(Role.any())') && !html.includes('permissions:perms'), 'No debe concederse escritura pública en filas nuevas');
assert.ok(html.includes('setInterval(pollRoom,450)'), 'El polling debe tener una frecuencia moderada');
assert.ok(html.includes('async function leaveCurrentRoom()'), 'Debe existir salida con transferencia de anfitrión');
assert.ok(html.includes('const returning=!!(existing&&existing.roomId===roomId'), 'Los jugadores originales deben poder reconectarse a su partida');
assert.ok(html.includes('function processSabotage()'), 'Los sabotajes temporizados deben resolverse desde el anfitrión');
assert.ok(html.includes('async function syncRoomAccess()'), 'Debe existir sincronización de permisos de sala');
assert.ok(!html.includes('three.min.js'), 'El proyecto debe conservar el renderer 2.5D Canvas');
console.log('✓ Sistemas críticos presentes; renderer 2.5D Canvas confirmado');
console.log('QA OK — validación estática y conectividad superadas');
