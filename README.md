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

La validación estática no certifica la jugabilidad. Las pruebas de navegador con dos sesiones independientes, reconexión, concurrencia de host y carga real siguen siendo obligatorias antes de publicar.

## Seguridad: bloqueo de producción pendiente
Las tablas `rooms` y `players` conservan permisos de tabla para `any`. El cliente permite invitados y escribe directamente en TablesDB. Restringir permisos sin migrar el protocolo rompería el multijugador; por eso no se han cambiado a ciegas. Antes de producción hay que mover las mutaciones críticas a funciones de servidor con validación de identidad, pertenencia a sala, host, movimiento, roles y acciones. Nunca introduzcas claves API privilegiadas en el navegador.

## Publicación
GitHub Pages despliega desde `main`. La rama `development/spaceship-sabotage-rebuild` permanece separada para revisión. El pull request de desarrollo se mantiene en borrador hasta completar auditoría funcional, pruebas reales y seguridad.
