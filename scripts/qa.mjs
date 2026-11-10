import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const inlineScripts = [...html.matchAll(/<script(?:\\s[^>]*)?>([\\s\\S]*?)<\\/script>/gi)]
  .map(match => match[1])
  .filter(script => script.trim());

assert.equal(inlineScripts.length, 1, 'Debe existir un único script principal inline');
new Function(inlineScripts[0]);

const ids = [...html.matchAll(/\\bid=["']([^"']+)["']/g)].map(match => match[1]);
const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
assert.deepEqual([...new Set(duplicates)], [], 'No puede haber IDs HTML duplicados');

const mapStart = inlineScripts[0].indexOf('const makeRoom=');
const mapEnd = inlineScripts[0].indexOf('function updateRepairArrow', mapStart);
assert.ok(mapStart >= 0 && mapEnd > mapStart, 'No se pudo localizar la definición del mapa y sus colisiones');
const mapCode = inlineScripts[0].slice(mapStart, mapEnd);

const mapReport = new Function(mapCode + `
  let gameState = null;
  const $ = () => null;
  const step = 0.2;
  const key = (x, y) => Math.round(x / step) + ',' + Math.round(y / step);
  const start = [SPAWN_X, SPAWN_Y];
  const queue = [start];
  const visited = new Set([key(...start)]);
  let head = 0;

  while (head < queue.length) {
    const [x, y] = queue[head++];
    for (const [dx, dy] of [[step,0],[-step,0],[0,step],[0,-step]]) {
      const nx = +(x + dx).toFixed(2);
      const ny = +(y + dy).toFixed(2);
      const cell = key(nx, ny);
      if (!visited.has(cell) && canWalk(nx, ny)) {
        visited.add(cell);
        queue.push([nx, ny]);
      }
    }
  }

  const reachable = (x, y) => visited.has(key(x, y));
  return {
    rooms: MAP.rooms.length,
    corridors: MAP.corridors.length,
    tasks: MAP.tasks.length,
    walkableTasks: MAP.tasks.filter(task => canWalk(task.x, task.y)).length,
    unreachableTasks: MAP.tasks.filter(task => !reachable(task.x, task.y)).map(task => task.id),
    vents: MAP.vents.length,
    unreachableVents: MAP.vents.filter(vent => !reachable(vent.x, vent.y)).map(vent => vent.id),
    repairs: MAP.repairs.length,
    unreachableRepairs: MAP.repairs.filter(point => !reachable(point.x, point.y)).map(point => point.id),
    spawnWalkable: canWalk(SPAWN_X, SPAWN_Y)
  };
`)();

assert.equal(mapReport.rooms, 18, 'El mapa debe contener 18 salas');
assert.equal(mapReport.corridors, 9, 'El mapa debe contener 9 corredores');
assert.equal(mapReport.tasks, 17, 'El mapa debe contener 17 misiones');
assert.equal(mapReport.walkableTasks, mapReport.tasks, 'Todas las misiones deben estar sobre suelo transitable');
assert.deepEqual(mapReport.unreachableTasks, [], 'Todas las misiones deben ser alcanzables desde el spawn');
assert.equal(mapReport.vents, 5, 'El mapa debe contener 5 conductos');
assert.deepEqual(mapReport.unreachableVents, [], 'Todos los conductos deben ser alcanzables');
assert.equal(mapReport.repairs, 5, 'El mapa debe contener 5 estaciones de reparación');
assert.deepEqual(mapReport.unreachableRepairs, [], 'Todas las reparaciones deben ser alcanzables');
assert.equal(mapReport.spawnWalkable, true, 'El punto de aparición debe ser transitable');

console.log('QA OK', JSON.stringify(mapReport));
