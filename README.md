# STARSHIP SABOTAGE

Juego social de deducción multijugador para navegador. Objetivo técnico: ofrecer los sistemas esenciales del género en un mundo **2.5D original**, sin motor 3D ni dependencia de Three.js.

## Arquitectura
- **Renderizado:** Canvas 2D con cámara, capas, profundidad simulada, iluminación y sombras.
- **Mapa:** geometría de habitaciones y corredores con colisiones y puertas explícitas.
- **Cliente:** HTML, CSS y JavaScript; diseño responsive y controles táctiles.
- **Online:** Appwrite TablesDB para salas, jugadores, posiciones, estado y votos.
- **Publicación:** GitHub Pages desde `main`.
- **QA:** Node.js 22 y GitHub Actions.

## Mapa
- 18 habitaciones.
- 9 corredores (6 longitudinales y 3 transversales).
- 17 estaciones de tareas.
- 5 estaciones de reparación.
- 5 conductos con enlaces recíprocos.
- Spawn central en cafetería.

El mapa es original y mantiene convenciones del género, sin copiar literalmente planos, arte ni recursos protegidos de otros juegos.

## Sistemas implementados
- Salas por código, configuración de anfitrión y cuenta atrás de 10 segundos.
- Asignación de roles y tareas.
- Minijuegos de tarjeta, cableado, ruta, filtro y calibración.
- Asesinato, cuerpos, reporte, reuniones, votación y expulsión.
- Sabotajes de luces, reactor, comunicaciones, oxígeno y puertas.
- Conductos para impostores.
- Joystick móvil, teclado, mapa, HUD y controles contextuales.
- Cosméticos guardados en el perfil y sincronizados en la sala.

## Desarrollo y QA
Sirve la carpeta con un servidor estático HTTP/HTTPS (no abras `index.html` como archivo local: Appwrite necesita un origen web).

Ejecuta:

```bash
node tests/validate.js
```

El workflow `.github/workflows/qa.yml` valida sintaxis, mapa, conectividad, estaciones, conductos y presencia de sistemas esenciales en pushes y pull requests.

La suite automatizada usa Chromium y dos sesiones independientes con un backend Appwrite simulado para comprobar creación/unión de salas, ACL, asignación de roles, votación y transferencia del anfitrión. Es una prueba de integración del cliente, no sustituye una prueba real de carga ni certifica la jugabilidad en todos los dispositivos.

## Seguridad
- Appwrite tiene Row Security activado en las tablas `rooms` y `players`.
- Las filas de jugador se crean con lectura pública de datos no sensibles y escritura/eliminación restringida a la identidad propietaria.
- Las salas restringen lectura a los miembros durante la partida y limitan las escrituras a las identidades de los participantes; el anfitrión gestiona los permisos y la transferencia de autoridad.
- El modo invitado usa una sesión anónima real de Appwrite; el ID de jugador coincide con la identidad autenticada.

**Límite pendiente:** el cliente sigue enviando el estado compartido de la partida. Un participante autenticado puede manipular datos de la sala desde sus herramientas de desarrollo. Antes de abrir el juego a competición o tratarlo como producción resistente a trampas, las acciones críticas deben validarse en funciones de servidor (identidad, pertenencia, anfitrión, movimiento, roles, asesinatos, tareas y sabotajes). Nunca introduzcas claves API privilegiadas en el navegador.

## Publicación
GitHub Pages despliega desde `main`. La rama `development/spaceship-sabotage-rebuild` permanece separada para revisión. La publicación requiere que pasen la validación estática y la suite de navegador, además de revisar manualmente la experiencia real en móvil y escritorio.
