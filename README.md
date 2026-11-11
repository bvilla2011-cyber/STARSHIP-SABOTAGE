# STARSHIP SABOTAGE 4.0

Juego original de deducción social para navegador, con arte procedural 2D/2.5D, tripulantes e impostores, tareas, fantasmas, sabotajes, reuniones y cosméticos persistentes.

[Jugar](https://bvilla2011-cyber.github.io/STARSHIP-SABOTAGE/?v=4.0.0) · [Informe de la versión](docs/RELEASE-4.0.md)

## Reglas y mapa

- Partidas de **4 a 15 jugadores**. De 1 a 3 impostores, limitados según el tamaño de la tripulación.
- **13 habitaciones**, 3 corredores, 14 terminales de misión y 12 tipos de minijuego.
- **7 estaciones de reparación**, incluidos dos terminales diferentes para contener el reactor.
- **11 conductos** con conexiones recíprocas.
- 26 elementos de mobiliario con colisiones, además de las cinco mesas de cafetería.
- Fantasmas: los tripulantes muertos terminan tareas; los impostores muertos pueden sabotear. El chat de fantasmas nunca se entrega a los vivos.
- Luces, reactor, oxígeno, comunicaciones y puertas tienen efectos reales. El oxígeno requiere dos códigos; el reactor requiere dos tripulantes en terminales distintos.
- Tareas comunes, cortas y largas; las largas tienen dos etapas. El servidor verifica ubicación, asignación, tiempo mínimo y resultado del minijuego.
- Victoria por tareas, expulsión de impostores, paridad de jugadores o sabotaje crítico.

La geometría y el catálogo canónicos están en `shared/world.js`. El cliente y el servidor usan las mismas reglas de movimiento de `shared/rules.js`; la documentación no mantiene una segunda copia del mapa.

## Controles

| Entrada | Acción |
| --- | --- |
| WASD / flechas | Movimiento |
| E | Tarea o reparación cercana |
| R | Reportar un cadáver cercano |
| M | Abrir/cerrar mapa |
| S, toque breve de impostor | Abrir/cerrar sabotajes |
| S, mantener / flecha abajo | Mover hacia abajo |
| G | Entrar, viajar o salir de un conducto |
| Q | Reunión SOS cerca de la mesa |
| C | Abrir/cerrar las cuatro cámaras desde Seguridad |
| Escape | Cerrar paneles |

Los controles táctiles incluyen joystick y botones de acción. Matar y sabotear aparecen abajo a la derecha y se atenúan cuando no están disponibles. Los menús permiten audio, calidad gráfica, idioma, reducción de movimiento, contraste y tamaño de texto.

## Arquitectura y seguridad

- `game-client.js`: interfaz, entrada, predicción local, reconciliación y renderizado Canvas.
- `shared/world.js`: habitaciones, tareas, conductos, colisiones y 24 cosméticos originales.
- `shared/rules.js`: geometría, configuración validada y rotación diaria universal a las 18:00 UTC.
- `server/core.cjs`: reglas autoritativas independientes del transporte.
- `server/main.js`: Appwrite Function `starship-authority`, con credencial dinámica limitada a lectura/escritura de filas.
- `starship-cinematics.js`, `monguito-system.js`, `starship-world-v3.js`: dirección de eventos, personajes y escenarios.
- `security-cctv.js`: cuatro vistas simultáneas, recortadas a sus habitaciones.
- `starship-audio.js`: música y sonidos procedurales originales.
- `starship-i18n.js`: español, inglés y francés.

### Appwrite

Proyecto `6af106fb00396755a6fb`, región Frankfurt; base `starship_db`.

| Tabla | Acceso del navegador |
| --- | --- |
| `rooms_v4` | Ninguno; estado privado, roles y resultados solo mediante la función |
| `profiles_v4` | Ninguno; saldos, compras e inventarios se validan en servidor |
| `frames_v4` | Lectura restringida a miembros; escritura exclusivamente del servidor |
| `signals_v4` | Lectura para miembros y escritura de la señalización propia; no contiene roles ni monedas |

Las acciones de partida, compras y recompensas se serializan con transacciones y detección de conflictos. Los identificadores de acción impiden repetir recompensas. Cada compra verifica catálogo, precio real, saldo e inventario. Los premios de juego tienen un límite de 500 pesos diarios por cuenta; los regalos verificados tienen su propio registro único.

Los snapshots no incluyen roles rivales ni tareas privadas ajenas. No hay claves administrativas en el navegador. El servidor comprueba la identidad inyectada por Appwrite; el cliente no puede elegir qué usuario ejecuta la acción.

### Movimiento online

Los movimientos se validan en filas independientes por jugador. Esto evita la contención de escribir toda la partida por cada desplazamiento. Appwrite Realtime distribuye esos fotogramas y proporciona señalización privada para conexiones WebRTC, que transmiten movimiento a 20 Hz. Las acciones críticas siempre utilizan posiciones comprobadas por el servidor.

Cuando una red impide conexiones entre pares, la partida continúa mediante el transporte de Appwrite. La interpolación y una extrapolación limitada suavizan los movimientos; solo los eventos de aparición, reunión y conducto justifican desplazamientos instantáneos. Las rutas de entrada permiten girar por puertas sin que la reconciliación confunda el recorrido con un atajo a través de una pared.

El servidor mantiene presencia, margen de reconexión, detección de inactividad y cambio de anfitrión. No se promete latencia cero ni rendimiento idéntico en todas las redes.

### Progreso anterior

Las cuentas conservan su identidad. Los regalos `BVILLA3000` registrados en servidor se reconocen una sola vez en el saldo seguro. Los saldos y compras históricos que únicamente existían en `localStorage` no se importan como dinero verificado; sus claves antiguas no se borran. No existe un registro de servidor que permita certificar esos importes.

## Desarrollo y pruebas

```sh
npm install
npm run validate
npm test
npx playwright install --with-deps chromium firefox webkit
npm run test:browser
npx playwright test --config=playwright.compat.config.cjs
```

`tests/core.test.cjs` comprueba reglas, ganadores, permisos lógicos, fantasmas, votaciones, tareas, compras y movimiento. `tests/v4.spec.cjs` utiliza navegadores independientes con la misma lógica de servidor sobre un transporte de prueba. `tests/compat.spec.cjs` comprueba Firefox y WebKit.

La prueba de infraestructura real usa cuatro sesiones anónimas y el origen oficial de Pages, sirviendo el código exacto de la rama en revisión:

```sh
npx playwright test --config=playwright.live.config.cjs
```

Esta prueba utiliza el proyecto Appwrite real y crea usuarios y una sala temporal. No utiliza claves privilegiadas ni falsifica resultados del backend.

## Publicación

La rama `development/starship-v4` ejecuta la revisión completa. `main` publica únicamente después de superar validación de fuente, pruebas de reglas, Chromium y compatibilidad Firefox/WebKit. `tools/package-site.cjs` empaqueta solo recursos estáticos. Cada referencia de recurso de la versión utiliza `v=4.0.0`; `version.json` identifica el protocolo 4.

El informe de versión distingue comprobaciones ejecutadas, inspecciones y limitaciones de entorno. Las capturas y trazas de CI se conservan como artefactos de revisión.
