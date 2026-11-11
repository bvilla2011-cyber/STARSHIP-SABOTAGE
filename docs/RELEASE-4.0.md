# STARSHIP SABOTAGE 4.0 — revisión de entrega

Fecha: 11 de noviembre de 2026.

## Alcance y comparación técnica

El punto de partida fue `65d3da8` de `main`. La versión anterior contenía 9 habitaciones, 2 corredores, 10 tareas y 6 conductos; el README describía otra geometría. El estado de la sala era modificable por participantes desde el navegador, los roles se compartían con todos y el dinero se guardaba localmente.

La revisión de referencia se centra en el modo clásico de deducción social. Se consultaron las explicaciones oficiales de [roles](https://innersloth.zendesk.com/hc/en-us/articles/7913947403924-Roles-Explanation) y las [novedades de 2026](https://www.innersloth.com/2026-roadmap-part-2/). Los roles especiales y modos adicionales de Among Us no se han copiado; se mantienen los dos equipos originales de Starship y se completa el sistema de fantasmas, información y configuración requerido.

| Sistema | Cambio incorporado |
| --- | --- |
| Mapa | 13 salas, 3 corredores, 26 volúmenes de mobiliario y cinco mesas; geometría compartida con servidor |
| Online | Autoridad en Appwrite; presencia por jugador, Realtime, WebRTC a 20 Hz y transporte alternativo |
| Roles | Asignación aleatoria segura, compañeros impostores identificables y roles rivales ocultos |
| Fantasmas | Movimiento separado del cadáver, tareas pendientes y chat exclusivo de muertos |
| Tareas | 14 terminales, 12 interacciones, categorías comunes/cortas/largas y etapas persistentes |
| Validación de tareas | Asignación, distancia, token, tiempo mínimo y resultado verificados antes del premio |
| Sabotajes | Cinco sistemas; oxígeno con dos códigos y reactor con dos terminales concurrentes |
| Muertes y reuniones | Alcance con obstáculos, cooldowns, cadáveres persistentes y traslado sincronizado |
| Votación | Debate/voto temporizados, salto, empate, voto único y confirmación opcional |
| Eventos | Claves de evento estables y protección contra repetición de escenas de reunión/resultado |
| Controles | Teclado, joystick y acciones táctiles; S breve/mantenida resuelve el conflicto con movimiento |
| Cámaras | Cuatro vistas aisladas, personajes, cadáveres y ocultación de usuarios en conductos |
| Ajustes | Audio, calidad, idioma, accesibilidad y reglas de partida |
| Información | Ocupación en Administración y signos vitales en Enfermería/Laboratorio |
| Economía | Saldo e inventario en servidor, compras atómicas, historial y límite diario de premios |
| Tienda | Catálogo de 24 artículos, ocho ofertas diarias y reloj común a las 18:00 UTC |
| Personalización | Colores y combinaciones; equipamiento validado y apariencia constante en partida |
| Exploración | Nave completa y práctica de tareas sin otros participantes |
| Idiomas y audio | ES/EN/FR, música ambiental y efectos procedurales originales |
| Infraestructura | Pruebas obligatorias antes de Pages, paquete estático y recursos con versión |

## Fallos corregidos durante la ejecución

- La validación de la rama inicial fallaba por supuestos obsoletos sobre el polling.
- Sustituir snapshots completos reiniciaba la interpolación de jugadores remotos.
- Mover a todos los jugadores mediante una sola transacción producía contención; se separaron las filas de movimiento.
- Las altas de jugadores intentaban modificar los permisos de filas que recibían movimiento continuo, provocando conflictos 409. La pertenencia se confirma en la transacción de sala y los permisos se proyectan después, ordenados mediante un bloqueo temporal por sala.
- Appwrite rechaza cabeceras personalizadas reservadas; ahora se utiliza la identidad autenticada que inyecta la plataforma.
- Las transacciones exigen una duración mínima de 60 segundos; se corrigió ese parámetro.
- La nueva tienda consultaba un ajuste antes de inicializarlo; se corrigió el orden de arranque.
- El acceso en móvil horizontal no podía desplazarse hasta el botón de invitado; se corrigió el contenedor.
- Los residuos del minijuego de filtro tenían movimiento continuo que dificultaba pulsarlos; los objetivos interactivos son estables.
- La comprobación de victoria podía ignorar a jugadores dentro del margen de reconexión.
- El progreso global sumaba datos locales incompletos; ahora lo calcula la autoridad.
- Los cadáveres podían seguir al fantasma; ahora conservan coordenadas propias.
- La luz ambiental y las balizas podían revelar salas ocultas; la máscara es opaca y se recorta con paredes y mobiliario.
- Las correcciones de posición podían confundir un giro alrededor de una esquina con atravesar una pared; se validan recorridos con secuencia.
- Las recompensas de final de partida se liquidan en el monedero mediante una acción idempotente del servidor.

## Verificación

La validación de fuente recorre la geometría desde el punto real de aparición y comprueba acceso a todas las salas, tareas, reparaciones y conductos. Las pruebas de reglas cubren los cuatro resultados de victoria, votaciones, cadáveres, fantasmas, roles privados, compras y entradas inválidas.

| Comprobación ejecutada | Resultado | Alcance |
| --- | --- | --- |
| Validación estática y geometría | Superada | Sintaxis, recursos, versión, conexiones y acceso a tareas, reparaciones y conductos |
| Reglas de servidor | 33 pruebas superadas | Cuatro victorias, permisos, compras, fantasmas, votaciones y movimiento |
| Chromium con transporte de prueba | 6 escenarios superados | Cuatro sesiones, partida completa, CCTV, móvil horizontal, tienda, reconexión y las 12 interacciones de tareas |
| Firefox y WebKit | 4 escenarios superados | Movimiento, mapa, acceso y ajustes en resoluciones estrechas |
| Appwrite real y cuatro navegadores | Superada | Creación/unión, inicio, conexiones directas, movimiento y reconexión conservando el rol |
| Compras concurrentes en Appwrite real | Superada | Dos compras simultáneas con saldo insuficiente para ambas: una aceptada, otra rechazada; saldo e inventario coherentes |
| Ataques de prueba en Appwrite real | Superada | Lectura directa de datos privados denegada; matar como tripulante, precio falsificado y equipamiento no adquirido rechazados |

Los seis escenarios de Chromium utilizan la misma lógica de reglas del servidor sobre un transporte de prueba, con controles de tiempo y estado para reproducir cada caso. Esta evidencia se distingue de las sesiones que utilizan el SDK y el backend de producción. La comprobación de economía concurrente utilizó exclusivamente una cuenta anónima de QA con saldo preparado para la prueba; tanto esa cuenta como su perfil se eliminaron después.

La ejecución [QA 161](https://github.com/bvilla2011-cyber/STARSHIP-SABOTAGE/actions/runs/43086411306) registra la revisión del código `da9bdf4`. En la integración real cada cliente estableció tres conexiones entre pares y recibió entre 548 y 586 mensajes de movimiento durante la ventana medida. El P95 de las llamadas de autoridad fue de **1,80–3,86 segundos** por cliente; incluye inicialización, altas y sincronización, por lo que no representa la latencia de los mensajes de movimiento. Es una limitación medida del transporte de funciones y no una promesa de respuesta instantánea. WebRTC transmite posiciones a 20 Hz; no se ha medido un percentil de latencia extremo a extremo para ese canal.

Las capturas de CCTV y ajustes móviles se revisaron visualmente. Las trazas y capturas de los escenarios quedan disponibles como artefactos de Actions. Las pruebas de reglas incluyen tamaños de 4, 7, 10 y 15 participantes; la prueba de infraestructura utiliza cuatro navegadores.

## Límites y riesgos conocidos

- Las conexiones directas dependen de la red. Sin conectividad entre pares, se utiliza Appwrite; no se ha contratado un servidor TURN.
- Las acciones autoritativas pueden tardar varios segundos bajo concurrencia. La simulación local y el canal directo mantienen el movimiento independiente de estas llamadas; el transporte alternativo tiene una frecuencia inferior. No se ha certificado una latencia concreta para redes móviles adversas.
- No se certifica carga de 15 dispositivos físicos ni rendimiento de todos los teléfonos. La lógica admite 4–15 jugadores; las pruebas reales de integración utilizan cuatro sesiones.
- Las pruebas de WebKit son del motor de navegador, no de un iPhone físico. Tampoco se afirma haber realizado envíos de correo de verificación a usuarios reales como prueba.
- Los premios y compras nuevos son verificables. No existe evidencia de servidor para certificar saldos o compras antiguos guardados únicamente en el navegador; no se convierten automáticamente en saldo seguro. Los regalos con registro verificable sí se reconocen.
- El protocolo 4 no comparte salas con versiones anteriores. Los datos anteriores se conservan.
- La validación rechaza teletransportes y recompensas falsas, pero no equivale a una certificación externa contra todas las posibles trampas o ataques.

## Publicación

La integración estable se publica mediante el flujo obligatorio de [validación y Pages](https://github.com/bvilla2011-cyber/STARSHIP-SABOTAGE/actions/workflows/pages.yml). El backend utiliza `starship-authority`, protocolo 4, en el proyecto original; no se modificó PADELUM. La versión activa del backend que superó la prueba real es `6af4c02587472b77abee`.

Enlace de la versión: [STARSHIP SABOTAGE 4.0](https://bvilla2011-cyber.github.io/STARSHIP-SABOTAGE/?v=4.0.0). `version.json` permite comprobar la versión pública. El historial de GitHub conserva la implementación, las correcciones de regresiones y este informe; el resultado de Pages está registrado en Actions.
