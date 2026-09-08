# Adaptar XR Island a tu asignatura

Guía para un profesor que quiere **su propia copia** de este mapa, con sus
sesiones, sus contenidos y sus colores. No hace falta saber Three.js: casi todo
se cambia editando dos archivos de datos.

Al terminar tendrás una web propia, en tu cuenta de GitHub, con tu dirección
(`https://TU-USUARIO.github.io/TU-REPO/`), y un panel para ir marcando por dónde
va la clase.

**Lo que sí hace falta:** una cuenta de GitHub, [Node.js](https://nodejs.org)
(versión 22, que es la que usa el despliegue) y un editor de texto. Nada más. No hay servidor, no hay
base de datos y no hay nada que pagar.

---

## Índice

1. [Haz tu copia](#1-haz-tu-copia)
2. [Enciende tu web](#2-enciende-tu-web)
3. [Ponte tú de profesor: el token](#3-ponte-tú-de-profesor-el-token)
4. [Cambia el nombre del curso](#4-cambia-el-nombre-del-curso)
5. [Cambia las sesiones](#5-cambia-las-sesiones-lo-importante)
6. [Pon tu contenido](#6-pon-tu-contenido)
7. [Cambia los colores](#7-cambia-los-colores)
8. [Cambia la forma de la isla](#8-cambia-la-forma-de-la-isla)
9. [Durante el curso](#9-durante-el-curso)
10. [Cuando algo falla](#10-cuando-algo-falla)
11. [Antes de enseñárselo a nadie](#11-antes-de-enseñárselo-a-nadie)

---

## 1. Haz tu copia

**Fork**, no clon. Un fork es tu propio repositorio en tu cuenta, y es lo que te
permite publicar tu web.

1. Entra en <https://github.com/optus23/Island-Class-XR>.
2. Arriba a la derecha, **Fork** → **Create fork**.
3. Ponle el nombre que quieras. Ese nombre saldrá en tu dirección web, así que
   algo corto: `mi-asignatura-xr`, por ejemplo.

Ahora bájatelo a tu ordenador. En una terminal:

```bash
git clone https://github.com/TU-USUARIO/TU-REPO.git
cd TU-REPO
npm install
npm run dev
```

Abre <http://localhost:5173> y ya tienes el mapa funcionando en tu máquina.
`npm run dev` se queda corriendo; para pararlo, Ctrl+C.

> **Si `npm run dev` va lentísimo después de un rato**, párralo y vuélvelo a
> arrancar. Consume mucha memoria con las horas y los síntomas parecen un fallo
> del código sin serlo.

---

## 2. Enciende tu web

GitHub publica tu copia gratis, pero hay que activarlo una vez.

1. En tu repositorio: **Settings** → **Pages**.
2. En **Source**, elige **GitHub Actions**.
3. Ve a la pestaña **Actions**. Si ves un aviso pidiendo permiso para ejecutar
   los flujos de trabajo, acéptalo.
4. Haz cualquier cambio y súbelo (o entra en **Actions** → el flujo `deploy` →
   **Run workflow**).

En un par de minutos tu mapa está en
`https://TU-USUARIO.github.io/TU-REPO/`.

**No tienes que tocar ninguna dirección en el código.** La ruta base se saca
sola del nombre de tu repositorio, así que funciona se llame como se llame.

Cada vez que subas un cambio a la rama `main`, la web se reconstruye sola.

> Trabajando solo, **commitea directamente en `main`** y ya está. El repositorio
> original usa una rama `develop` y pull requests porque hay dos personas
> tocándolo; tú no lo necesitas. Lo único que publica es `main`.

---

## 3. Ponte tú de profesor: el token

Los botones de profesor (avanzar la clase, la lista de alumnos, ocultar las
sesiones futuras) escriben en tu repositorio desde el navegador. Para eso
necesitan un permiso tuyo: un **token**.

Es **tu** token, de **tu** cuenta, y solo para **tu** repositorio.

1. Ve a <https://github.com/settings/personal-access-tokens>.
2. **Generate new token** → *Fine-grained token*.
3. **Repository access** → *Only select repositories* → elige tu repositorio.
4. **Permissions** → *Repository permissions* → **Contents: Read and write**.
   Esa es la única que hace falta.
5. Ponle caducidad (90 días está bien) y créalo. **Cópialo ahora**: GitHub no
   te lo vuelve a enseñar.

Ahora abre `https://TU-USUARIO.github.io/TU-REPO/admin/`, pega el token y pulsa
**Guardar y comprobar**.

**Dónde vive ese token, y dónde NO:**

- Se guarda **solo** en el `localStorage` del navegador donde lo pegaste.
- **No** va en el `.env`. Ese `GH_TOKEN` del archivo `.env` es otra cosa: lo usan
  `git` y la herramienta `gh` desde tu ordenador, y ese archivo está en el
  `.gitignore` y nunca se sube.
- **No** entra en el código ni en la web publicada. Los alumnos solo *leen*
  archivos; nunca escriben.
- Si pegas el token en otro ordenador, tendrás que volver a pegarlo allí. Es lo
  correcto: un token por navegador.
- **Olvidar token** en `/admin` lo borra de ese navegador.

Si algún día se te escapa el token a algún sitio, bórralo en GitHub y crea otro.
No hay que tocar nada más.

---

## 4. Cambia el nombre del curso

Archivo: **`src/data/levels.json`**, arriba del todo.

```json
{
  "course": {
    "title": "XR Island",
    "subtitle": "Realidad Virtual y Realidad Aumentada · Entornos de Realidad Virtual",
    "tagline": "Realidad Virtual y Aumentada"
  }
}
```

- `title` — sale en el panel del mapa y **en el título de la introducción**.
- `subtitle` — la línea larga del panel.
- `tagline` — la línea corta, **solo para la introducción**. Que sea corta de
  verdad: ocupa una pantalla entera.

La pestaña del navegador se cambia en `index.html` (`<title>`), y el nombre de
la pestaña del panel de profesor en `admin/index.html`.

---

## 5. Cambia las sesiones (lo importante)

Todo el mapa sale de **`src/data/levels.json`**. La isla, los caminos, los
castillos y las cuestas se generan solos a partir de esa lista. **No hay que
mover nada a mano.**

Una sesión mínima:

```json
{
  "id": "w1-01",
  "world": 1,
  "title": "Introducción a la asignatura",
  "category": "theory",
  "stage": "intro-theory",
  "summary": "De qué va todo esto y cómo se evalúa."
}
```

| Campo | Qué es |
| --- | --- |
| `id` | Identificador único. Sale en los enlaces (`?level=w1-01`). Cámbialo antes de empezar el curso, no después: los enlaces compartidos dejarían de funcionar. |
| `world` | 1, 2 o 3. Es el trozo de isla donde cae. |
| `title` | Lo que lee el alumno. |
| `category` | `theory`, `practical`, `project` o `boss`. Decide el color del círculo. |
| `stage` | Bloque temático. Sirve para agrupar. |
| `boss` | Un examen. Además necesita `bossTier`: `mini` (parcial), `final` o `extra` (reevaluación). |
| `optional` | `true` para actividades voluntarias. Cuelgan del día indicado en `anchorAfter` con una línea de puntos. |

### Las reglas que no puedes saltarte

Ejecuta **`npm run validate`** cada vez que toques este archivo. Te dice qué
está mal antes de que lo veas roto en pantalla. Se ejecuta sola al construir, así
que un error aquí **impide que la web se publique**.

Lo que comprueba, y por qué te importa:

- **Cada mundo con `bossSlot` necesita exactamente un examen**, y no puede estar
  ni el primero ni el último de su mundo: va *entre* dos mitades.
- **El examen final cierra el mundo 3**: tiene que ser la última sesión.
- **Ninguna fecha, en ningún sitio.** Ni `date`, ni `week`, ni `deadline`. El
  mapa no es un calendario; el avance lo mueves tú a mano. Si metes un campo con
  esos nombres, la validación falla.
- **Los nodos no pueden quedar demasiado juntos.** Si metes muchas sesiones en un
  mundo, te avisará de que hay que estirar el camino
  (ver [sección 8](#8-cambia-la-forma-de-la-isla)).
- **Una actividad opcional cuelga de una sesión normal** del mismo mundo.

### ¿Cuántas sesiones puedo poner?

La plantilla trae 28 repartidas 8 / 11 / 9. Puedes poner menos sin tocar nada
más. Si pones bastantes más en un mundo, `npm run validate` te dirá que los
círculos se pisan y tendrás que alargar el camino de ese mundo.

---

## 6. Pon tu contenido

Cada sesión puede llevar diapositivas, tareas y ejercicios.

### Diapositivas

Tres formas, de menos a más trabajo:

```jsonc
// 1. Un simple enlace (lo más fácil)
"slidesLink": "https://…"

// 2. Un PDF que se ve dentro de la web
"slides": { "type": "pdf", "source": "content/slides/mi-clase.pdf" }

// 3. Un Canva incrustado
"slides": { "type": "canva", "source": "https://www.canva.com/design/…?embed" }
```

Para el PDF, déjalo en `public/content/slides/`.

Para Canva: **Compartir → Más → Insertar**, y copia esa dirección. Tiene que
llevar `?embed`. Si copias el enlace de *edición* (lleva `/edit`), la validación
lo rechaza — y menos mal, porque cualquiera podría editarte las diapositivas.

### Ejercicios y tareas

Los archivos van en `public/content/exercises/`, en Markdown. Se enlazan desde la
sesión con el mismo `id`.

Si al principio del archivo pones esto, se convierte en una presentación de
diapositivas dentro de la web:

```markdown
---
marp: true
theme: xr-island
paginate: true
---

# Primera diapositiva

Contenido.

---

# Segunda diapositiva
```

Los `---` separan diapositivas. Sin esa cabecera, el archivo se ve como texto
normal, que también está bien.

### Tareas de la sesión

Dentro de una sesión, en `todos`:

```json
"todos": [
  {
    "id": "t1",
    "type": "objective-task",
    "objective": "Qué tiene que conseguir el alumno.",
    "starting_point": "Con qué empieza.",
    "deliverable": "Qué entrega.",
    "milestones": ["Primer paso", "Segundo paso"]
  }
]
```

Los cuatro campos son obligatorios y `milestones` no puede estar vacío.

---

## 7. Cambia los colores

Archivo: **`src/config/theme.js`**. Es el único sitio donde hay colores. Los
números están en hexadecimal con `0x` delante (`0xff0000` es rojo).

Lo que probablemente quieras tocar:

```js
export const palette = {
  completed: 0x38b000,   // verde de "ya hecho"
  theory:    0x4cc9f0,   // día de teoría
  practical: 0xf77f00,   // día de práctica
  project:   0xffdd00,   // trabajo autónomo
  locked:    0x6c757d,   // sesión aún no abierta
}
```

Y los tres biomas (`biomes`): `meadow` (pradera), `desert` (desierto) y `summit`
(nieve). Cada uno tiene `ground`, `band` y `rock` — esos tres tonos son lo que
hace que una meseta parezca una meseta. Si los pones muy parecidos, el relieve
desaparece.

**Dos trampas que te ahorro:**

- `palette.boss` **es la piedra del castillo**, no una marca de color. Si lo
  pones rojo, los castillos se vuelven rojos enteros.
- `palette.project` tiene que ser distinto de `palette.nodeRim`. Si coinciden,
  los círculos de proyecto parecen anillos vacíos.

---

## 8. Cambia la forma de la isla

Archivo: **`src/config/worlds.js`**. Solo si te hace falta.

Cada mundo tiene un `center` (dónde está en la isla) y unos `controlPoints`, que
son las esquinas del camino:

```js
controlPoints: [
  [-30, 0, 20],
  [-30, 0, -10],
  [10, 0, -10],
]
```

**Los tramos tienen que ser rectos y las esquinas de 90 grados**: entre dos
puntos seguidos solo puede cambiar la X o la Z, nunca las dos. Si cambias las
dos, `npm run validate` te lo dice. Es a propósito: los caminos en diagonal
salen retorcidos.

Para meter más sesiones en un mundo, alarga el recorrido añadiendo esquinas.
Los círculos se reparten solos a lo largo, y con ellos los caminos, las cuestas
y las casitas.

También ahí está `camera.offset` de cada mundo, que es desde dónde se mira.

---

## 9. Durante el curso

Todo esto es desde el navegador, sin tocar código.

**Avanzar la clase.** En el mapa, bloque **Profesor** de la leyenda (abajo a la
derecha): *Completar y avanzar*, *Retroceder*, *Reiniciar curso*. Cada uno hace
un commit y la web se reconstruye en uno o dos minutos.

Están en el mapa y no en `/admin` a propósito: ahí se ve al personaje caminar
hasta la sesión siguiente.

**Ocultar las sesiones futuras.** El interruptor *Ocultar las sesiones futuras*,
en ese mismo bloque. Con él activado, un alumno solo ve hasta donde ha llegado la
clase; el resto salen en gris, con candado y sin título. Tú, con tu token, sigues
viéndolo todo; para comprobar qué ven ellos, marca *Ver el mapa como un alumno*
(eso es solo de tu navegador, no cambia nada para nadie).

**Alumnos paseando por la isla.** En `/admin/`, apartado *Alumnos en la isla*:
escribes un nombre, eliges la sesión y aparece un personaje dando vueltas junto a
ese círculo. Es para premiar participación. Caben 24.

> El repositorio es **público**: cualquiera puede leer `public/npcs.json`. Usa
> apodos o nombre + inicial, nunca el nombre completo de un menor.

---

## 10. Cuando algo falla

**La web no se actualiza.** Mira abajo del todo en la leyenda: pone
`build` y unas letras. Es el commit que estás viendo. Si no coincide con el
último, tu navegador tiene la página en caché: recarga forzando (Ctrl+Shift+R).
Esto engaña muchísimo — una corrección puede estar publicada y no verse.

**`public/progress.json does not match …`** Habías pulsado dos botones muy
seguidos. Vuelve a pulsar; se relee el archivo y se reintenta solo.

**El despliegue falla en Actions.** Casi siempre es `npm run validate`. Abre el
flujo fallido en la pestaña **Actions** y lee el error: te dice el `id` de la
sesión y qué le pasa. Corrígelo, sube el cambio y se vuelve a publicar solo.

**Ejecuta `npm run validate` en tu ordenador antes de subir nada.** Te ahorra
todo este apartado.

---

## 11. Antes de enseñárselo a nadie

Tu repositorio es público y tu web también. Revisa:

- **Derechos de autor.** Diapositivas, imágenes y vídeos de libros, papers o
  material de otros cursos: que se pueda ver dentro de un campus privado no
  significa que se pueda publicar abierto.
- **Datos de alumnos.** Ni notas, ni correos, ni entregas. La única excepción
  pensada es la lista de nombres de la isla, y aun así con apodo.
- **Exámenes.** No subas nada que no quieras visible antes de la fecha. Y ten
  presente que **el historial de Git guarda lo que se subió aunque luego lo
  borres**.

Si algo no puede ser público, déjalo fuera del repositorio y enlázalo desde tu
campus.

---

## Chuleta

| Quiero cambiar… | Archivo |
| --- | --- |
| Nombre y subtítulos del curso | `src/data/levels.json` (`course`) |
| Sesiones, títulos, tareas, ejercicios | `src/data/levels.json` (`levels`) |
| Colores de todo | `src/config/theme.js` |
| Forma de los caminos y de la isla | `src/config/worlds.js` |
| Diapositivas en PDF | `public/content/slides/` |
| Ejercicios en Markdown | `public/content/exercises/` |
| Por dónde va la clase | El bloque Profesor, en el mapa |
| Alumnos destacados | `/admin/` |

```bash
npm run dev        # trabajar en local
npm run validate   # comprobar antes de subir
npm run build      # construir como lo hace GitHub
```
