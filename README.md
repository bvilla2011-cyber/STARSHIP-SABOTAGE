# STARSHIP SABOTAGE

Juego social de deducción multijugador para navegador. El objetivo técnico es ofrecer los sistemas esenciales del género en un mundo **2.5D original**, sin motor 3D ni dependencia de Three.js.

## Arquitectura
- **Renderizado:** Canvas 2D con cámara, capas, profundidad simulada, iluminación y sombras.
- **Mapa:** geometría de habitaciones y corredores con colisiones y puertas explícitas.
- **Cliente:** HTML, CSS y JavaScript; diseño responsive y controles táctiles.
- **Online:** Appwrite TablesDB, sesiones autenticadas y permisos por fila.
- **Publicación:** GitHub Pages desde `main`.
- **QA:** Node.js 22, GitHub Actions y Playwright/Chromium.

## Mapa
- 18 habitaciones.
- 11 corredores (6 longitudinales y 3 transversales).
- 17 estaciones de tareas.
- 5 estaciones de reparación.
- 14 conductos con enlaces recíprocos.
- Spawn central en cafetería.

El mapa es original y mantiene convenciones del género, sin copiar literalmente planos, arte ni recursos protegidos de otros juegos.

## Sistemas de juego
- Salas por código, configuración de anfitrión y cuenta atrás de 10 segundos.
- Asignación de roles y cuatro tareas por tripulante.
- Minijuegos de tarjeta, cableado, ruta, filtro y calibración.
- Asesinato, cuerpos, reporte, reuniones, votación y expulsión.
- Sabotajes de luces, reactor, comunicaciones, oxígeno y puertas.
- Conductos para impostores.
- Joystick móvil, teclado, mapa, HUD y controles contextuales.
- Cosméticos guardados en el perfil y sincronizados en la sala.
- Reconexión de jugadores con identidad estable y transferencia de anfitrión al abandonar.

## Appwrite y permisos

La versión nueva usa exclusivamente las tablas **`rooms_v2`** y **`players_v2`**:

- `rooms_v2`: Row Security activado; solo usuarios autenticados pueden crear salas. No hay lectura ni escritura global a nivel de tabla. En el lobby la fila es legible para permitir entrar por código; durante la partida solo los miembros pueden leerla. Los miembros pueden actualizar el estado compartido y el anfitrión conserva el permiso de eliminación/transferencia.
- `players_v2`: Row Security activado; lectura pública solo para el roster y presencia. La creación requiere sesión autenticada; cada jugador solo puede actualizar o borrar su propia fila.
- El modo invitado crea una sesión anónima real de Appwrite; el ID del jugador coincide con el ID de usuario autenticado.
- Las tablas heredadas `rooms` y `players` se conservan para no destruir datos anteriores; el cliente nuevo ya no las utiliza.

**Límite de seguridad:** el estado compartido de la partida sigue siendo modificable por los miembros autorizados de la sala. Los participantes podrían manipular datos desde sus herramientas de desarrollo. Antes de una competición pública o de considerar el juego resistente a trampas, las acciones críticas deben validarse en funciones de servidor (movimiento, roles, asesinatos, tareas, sabotajes y victoria). Nunca introduzcas claves API privilegiadas en el navegador.

## Desarrollo y QA

Sirve la carpeta con un servidor estático HTTP/HTTPS (no abras `index.html` como archivo local: Appwrite necesita un origen web).

Ejecuta:

```bash
node tests/validate.js
npm install --no-save @playwright/test
npx playwright install chromium
npx playwright test tests/e2e.spec.cjs
```

La validación estática comprueba sintaxis, geometría, conectividad desde el spawn, tareas, reparaciones, conductos y sistemas esenciales. La suite E2E usa Chromium y dos sesiones independientes con un backend Appwrite simulado para comprobar creación/unión de salas, permisos, roles, votación y transferencia del anfitrión. No sustituye pruebas reales de carga ni la comprobación manual en dispositivos físicos.

## Publicación

GitHub Pages despliega desde `main`. La rama `development/spaceship-sabotage-rebuild` se mantiene separada para revisión. La publicación requiere que pasen las validaciones automatizadas; el despliegue de Pages no publica ramas de desarrollo.

### Smoke test contra Appwrite Cloud real

La prueba de dos sesiones reales se puede lanzar desde GitHub Actions con el input `live_online=true`. También se ejecuta al hacer un push cuyo mensaje incluya `[live-online]`. Usa el origen oficial de GitHub Pages para respetar CORS/plataformas de Appwrite, sirve el `index.html` de la rama probada, crea dos sesiones anónimas, crea y une una sala temporal y trata de eliminarla al terminar. No necesita claves API privilegiadas. Si falla, adjunta el artefacto `appwrite-live-diagnostics` con el error de autenticación y respuestas HTTP. El botón de invitado se registra antes de esperar la consulta de sesión para evitar perder pulsaciones.
