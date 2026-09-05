# Próximos pasos — orden acordado

Acordado con Marc el 5 de septiembre de 2026, después de desplegar el modo VR.
Este fichero es la cola de trabajo; `docs/decisiones-abiertas.md` es otra cosa
— aquello son huecos de contenido sin decidir, esto son tareas decididas y
pendientes de hacer.

El orden **es** el acuerdo. No adelantar una tarea por delante de otra.

---

## 0. Verificar el modo VR en las gafas — Marc *(en curso)*

<https://optus23.github.io/Island-Class-XR/vr>

Nada de lo de abajo empieza hasta que esto esté confirmado. Sigue sin probarlo
nadie: entrar en un nivel desde dentro del visor, el rendimiento con carga, y
la rotación sobre el propio eje y el mirror (son el cuarto intento y no se han
vuelto a probar en hardware).

---

## 1. El prompt maestro — contenido de las clases *(siguiente)*

Marc lo envía cuando el punto 0 esté verificado. Traerá, en un solo mensaje:

- todas las clases con sus **títulos** explicados,
- el **orden** de las clases,
- el **color** de cada una,
- el **número de sesión**, que es lo que fija dónde cae cada nodo en el modelo
  3D — o sea que reubica la isla, no solo el texto,
- enlaces de referencia a **Canva**.

Lo que ya se sabe que hay que arreglar por el camino:

- El enlace de Canva de la sesión 1-2 es **privado** y renderiza «Este diseño es
  privado». Hacen falta URLs de **Compartir → Insertar**; el validador ya
  rechaza los `/edit` y los que no llevan `?embed`.
- Quedan **7 títulos PLACEHOLDER** en `src/data/levels.json` (`w1-intro-04`,
  `w2-pre-04`, `w2-post-04`, `w3-xrit-04`, `w3-xrit-05`, `w3-proj-04`,
  `w3-proj-05`).
- El recuento de 27 sesiones (7 / 9 / 11) está fijado por el calendario y
  verificado contra su tablero de Whimsical. Si el prompt maestro cambia el
  número de sesiones, hay que volver a mirar ese tablero **antes** de tocar
  nada — está en las reglas de `CLAUDE.md`.

Es un cambio de datos, no de geometría: `levels.json`, `worlds.js` y
`theme.js`. Nada se coloca a mano.

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
