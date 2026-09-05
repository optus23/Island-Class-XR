# Próximos pasos — orden acordado

Acordado con Marc el 5 de septiembre de 2026, después de desplegar el modo VR.
Este fichero es la cola de trabajo; `docs/decisiones-abiertas.md` es otra cosa
— aquello son huecos de contenido sin decidir, esto son tareas decididas y
pendientes de hacer.

El orden **es** el acuerdo. No adelantar una tarea por delante de otra.

---

## 0. VR en las gafas — HECHO

Marc confirmó que entra y funciona. Después se unificó la entrada: VR se ofrece
desde **cualquier URL** y el botón «Entrar en VR» es el puente; `?vr=1` y `/vr/`
siguen existiendo como el camino garantizado (contexto XR-compatible desde el
primer frame). Ver `CLAUDE.md`.

Sigue sin probarse en hardware: entrar en un nivel desde dentro del visor, el
rendimiento con carga, la rotación sobre el propio eje y el mirror.

---

## 1. El calendario como mapa de niveles — HECHO

28 clases sacadas de la tabla *Fall Semester Schedule* del board de Whimsical.
La procedencia y el reparto están en [`docs/calendario-origen.md`](calendario-origen.md).
El semestre de otoño **es** la regla; primavera es solo guía de Marc y no genera
un segundo mapa: la isla es una plantilla para todas sus asignaturas de RV.

Lo que queda de contenido, y no es código:

- **Enlaces de Canva.** Marc los actualiza en Whimsical y se relee el board.
  Los `canva.com/design/…/view` se convierten en incrustación añadiendo
  `?embed`; los `canva.link/…` antiguos solo sirven como enlace.
- **Los TODOs paso a paso** de las sesiones prácticas: desde crear el proyecto
  de Unity hasta la escena montada, sobre documentación oficial de Unity, AR
  Foundation, Meta Building Blocks y XRIT, más los trucos de conexión de la
  Quest. Son 8-10 tutoriales largos; van sesión a sesión, no en una ronda.

---

## 2. La interfaz de usuario dentro de VR

Títulos de nivel y paneles de información **dentro del visor**. Hoy, con las
gafas puestas, se puede navegar el mapa y seleccionar nodos, pero no se puede
leer nada: toda la UI es DOM y el DOM no existe en una sesión inmersiva.

No es una reescritura. `scripts/build-decks.mjs` ya emite las diapositivas como
datos `{ html, classes }`, y `src/ui/deck.js` es el único fichero que da por
supuesto que hay un DOM — un panel en el mundo es un hermano de ese fichero.

---

## 3. Difuminar las costuras entre biomas

Petición literal de Marc: hoy los tres biomas están separados por **una línea
recta**, y eso hace que la isla se lea como tres bloques pegados en vez de como
un sitio. Quiere que el final de un bioma y el principio del siguiente se
entremezclen con boxes — que un poco de bosque suba por encima de la línea
hacia el desierto y al revés, de forma que la frontera se dentelle en lugar de
cortar.

**Dónde vive.** `worldAtX(x)` en `src/config/worlds.js` decide el bioma por
centro más cercano, lo cual es exactamente una línea vertical en X. Esa función
es la costura, y la usan tanto el terreno como los props
(`biomeKeyAt` → `island.js:36`, `props.js:519`).

**La forma probable del arreglo:** en una banda alrededor de la frontera, que
cada columna elija bioma con un ruido determinista de `(x, z)` en vez de por
umbral duro, con la probabilidad interpolando de 0 a 1 a lo ancho de la banda.
Determinista importa: el terreno, la banda de color y los props consultan la
misma función y tienen que coincidir, o saldrán cactus sobre hierba.

**Cuidado con:** el ancho de la banda es una decisión de diseño, no un
refactor; y esto toca el vocabulario visual establecido, así que enseñar una
captura antes de darlo por bueno. El aviso de `CLAUDE.md` sobre no ensanchar el
alcance a la silueta de la isla sigue en pie — esto es una característica local
sobre una sola masa de tierra, que es la dirección aceptada.
