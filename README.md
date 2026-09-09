# XR Island

A gamified 3D course portal: a voxel island world map, in the spirit of the Super
Mario World overworld, where every node is a portal to that level's slides,
activities and exercises.

Built to be reused indefinitely, for any subject. It currently backs *Realidad
Virtual y Realidad Aumentada* and *Entornos de Realidad Virtual*, whose content
is ~99% identical, but nothing in the code is specific to either.

Static site: Three.js + Vite, deployed to GitHub Pages. No backend, no database.

> **¿Eres profesor y quieres tu propia copia, con tus sesiones?**
> Salta a [**Forkéalo para tu asignatura**](#forkéalo-para-tu-asignatura), al
> final. Está escrito para hacerlo a mano, sin saber Three.js.

---

## Quick start

```bash
npm install
```

```bash
npm run dev
```

Then open the URL Vite prints. Teacher sign-in is at `/admin/`; the controls
themselves are in the map's legend.

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Validates `levels.json`, then builds to `dist/` |
| `npm run preview` | Serves the built `dist/` locally |
| `npm run validate` | Checks the level data and the node layout (no browser needed) |
| `npm run placeholders` | Creates any missing content files. Never overwrites |

`npm run validate` is the fast way to find out that a level you just added broke
the map. It runs automatically as part of `build`, so a broken `levels.json` can
never reach GitHub Pages.

### Previewing exactly what Pages will serve

On GitHub Pages the site lives under `/<repo-name>/`, not `/`. Vite derives that
from the `GITHUB_REPOSITORY` variable Actions always sets, so CI needs no config
— but to reproduce it locally you must set it for **both** the build and the
preview, or the served base will not match the one baked into `index.html` and
every script 404s:

```bash
GITHUB_REPOSITORY=optus23/Island-Class-XR npm run build && GITHUB_REPOSITORY=optus23/Island-Class-XR npm run preview
```

Then open `http://localhost:4173/Island-Class-XR/`. Plain `npm run dev` needs
none of this — it serves from `/`.

---

## The three worlds

The map is one connected island holding three worlds, and it contains **no dates,
no schedule and no holidays** — by design. A holiday shifts *when* a level is
delivered, never *whether* it exists, so the calendar lives entirely outside this
repo and the map stays reusable year after year.

| World | Content | Biome | Viewing angle |
| --- | --- | --- | --- |
| 1 | Introduction and foundational theory, ending in AR Foundation | Meadow | Isometric, from the left |
| 2 | Meta Building Blocks, split in half by the midterm castle | Desert | Frontal |
| 3 | XR Interaction Toolkit, then the final project | Snowy summit | Isometric, from the right |

### The camera

The camera **follows the avatar** across one continuous island, and blends its
viewing angle between the three per-world angles as the focus moves along X. So
the three perspectives still read — iso-left, frontal, iso-right — but they
arrive as a drift rather than a cut.

That is why the island has no gaps: an earlier version snapped between three
fixed positions, and the worlds had to sit as separate padded blocks to justify
the cuts. Following removed the need for both.

It is still **never a free camera** — the viewer cannot orbit or zoom. Only the
focus moves, plus a subtle mouse parallax. Each world contributes an `offset`
(direction and distance) and a `lookHeight` in `config/worlds.js`.

### Terrain, biomes and water

Ground height follows the height of the nearest path, so raising a control
point in `worlds.js` lifts a whole plateau and the route climbs onto it; cliffs
appear wherever plateaus of different heights meet. Each column draws as a cap,
a bright band under the lip, and a rock body — that stack is what makes a
plateau read as a plateau.

The road is one colour across all three worlds (a cream surface with a dark
outline), matching the reference art. The sea is an animated shader patched
into a Lambert material via `onBeforeCompile`, so it inherits the scene's fog
and lighting instead of re-implementing them.

### Level cards

Arriving at a session shows a Mario-style card: `MUNDO <world>-<n>`, the title,
and a lives counter. The lives number is the count of sessions **remaining**,
so the easter egg carries real information. Optional levels get no card — they
are not sessions.

The single exception to "no dates" is the manual progress marker, below — and
even that moves only when a human presses a button.

---

## One level = one class session

The course runs **27 sessions per semester**, and Fall and Spring have the same
shape (the source of truth is the Calendar board in Whimsical):

| | Fall | Spring |
| --- | --- | --- |
| Scheduled slots | 29 | 29 |
| Holidays | 2 | 2 (Semana Santa) |
| **Sessions** | **27** | **27** |
| Midterm | session 12 | session 12 |

So `levels.json` holds **27 non-optional levels, 9 per world**. The midterm is
the mini-boss at the centre of world 2, and the final exam is the final boss
closing world 3 — both count as sessions.

Optional/bonus levels are **extra**: they are not sessions, sit off the main
path, and do not count toward the 27.

Holidays still never appear here. They shift *when* a session happens, not
whether it exists, so the count stays 27 either way.

---

## Where to put your content

Everything a session shows lives in **one entry** in
[`src/data/levels.json`](src/data/levels.json). There is no other place to edit.

| What | Where | Notes |
| --- | --- | --- |
| Session **title** | `title` | Shown on the map, the index, the level card and the portal header |
| One-line **summary** | `summary` | Under the title in the portal |
| **Canva** deck | `slides: { "type": "canva", "source": "<embed URL>" }` | Must be the **Share → Embed** link and contain `?embed`. `npm run validate` rejects edit links |
| **PDF** deck | `slides: { "type": "pdf", "source": "content/slides/<id>.pdf" }` | Drop the file at `public/content/slides/<id>.pdf` |
| **External** deck | `slidesLink: { "url": "https://…", "label": "…" }` | A button, not an embed. For anything that refuses to be framed |
| **Deck not made yet** | `slidesPending: true` | The portal says the slides are being prepared instead of "no lleva diapositivas". `validate` errors if it survives the deck arriving |
| **Exercises** | `exercises: "content/exercises/<id>.md"` | Plain Markdown at `public/content/exercises/<id>.md` |
| **Activities** | `todos: [ … ]` | `objective-task` objects — objective, starting point, numbered `steps`, deliverable. Optional `steps_note` qualifies the guide |
| **Generated deck** | `marp: true` in the exercise Markdown | Slides built from that Markdown at build time — see below. Beats a `slides` block |
| **Graded exercise** | `block`, `submissionMethod`, `groupMode`, `gradeWeight` | Only on the 8 exercises of the three practical blocks — see below |

Getting a Canva embed link: open the deck → **Share** → **More** → **Embed** →
copy the URL from the `src="…"` of the snippet. It looks like
`https://www.canva.com/design/DAF…/view?embed`.

After editing, run:

```bash
npm run placeholders && npm run validate
```

`placeholders` creates any missing Markdown/PDF files so nothing 404s, and
never overwrites what already exists. `validate` checks the whole model and
also runs as part of `build`, so a broken `levels.json` cannot reach Pages.

---

## Adding, editing and reordering levels

Everything lives in [`src/data/levels.json`](src/data/levels.json). **Order in
that file is order on the map**, per world. You never position a node by hand:
the path is a spline and nodes are spread along it at runtime, so adding a level
just re-spaces its neighbours.

```jsonc
{
  "id": "w1-arf-04",              // unique, stable — used by progress.json
  "title": "Título del nivel",
  "world": 1,                      // 1 | 2 | 3
  "stage": "ar-foundation",        // see the 8 stages below
  "category": "practical",         // theory | practical | boss
  "optional": false,
  "summary": "Una línea que se ve en el portal.",
  "slides": { "type": "pdf", "source": "content/slides/w1-arf-04.pdf" },
  "exercises": "content/exercises/w1-arf-04.md",
  "todos": [ /* see below */ ]
}
```

Stages: `intro-theory`, `ar-foundation`, `meta-pre-exam`, `mini-boss-midterm`,
`meta-post-exam`, `xr-toolkit`, `final-project`, `final-boss-presentation`.

After editing, run `npm run placeholders` to create any new content files, then
`npm run validate`.

### Slides: PDF, Canva, or just a link

Each level picks one.

- `{"type": "pdf", "source": "content/slides/x.pdf"}` — the PDF is committed to
  this repo, so it also works offline in class.
- `{"type": "canva", "source": "https://www.canva.com/design/XXX/view?embed"}` —
  for decks with animation, video or GIFs that a PDF cannot carry.
- `slidesLink: {"url": "https://…", "label": "Diapositivas"}` — the least work,
  and the fallback for anything that refuses to be embedded. It renders as a
  button that opens in a new tab, so the deck is never shown inside the portal.
  Both fields are required; `validate` rejects a relative URL.

> The Canva URL **must** be the public **Share → Embed** link. `validate` rejects
> edit links, so a private deck cannot reach the published site by accident.

A level with none of the three shows its contents list and says the session
carries no slides. If that is only true *for now* — the deck exists in the
calendar but has not been written — set `slidesPending: true` and the portal says
it is being prepared instead. `validate` lists every pending level on each build
and **errors** if one still carries the flag after its deck lands, so the note
cannot rot into a lie. A project or exam day, which will never have a deck, just
leaves all four fields out.

### Activities (`todos`)

Native interactive activities — never a PDF, never plain text. The type today is
`objective-task`:

```jsonc
{
  "id": "w1-arf-04-t1",
  "type": "objective-task",
  "objective": "Usar AR Foundation para instanciar un modelo sobre un plano.",
  "starting_point": "Proyecto Unity con AR Foundation ya instalado.",
  "steps": [
    "Abre `Window > Package Manager` y comprueba que **AR Foundation** está instalado.",
    "Selecciona el **XR Origin** → `Add Component` → **AR Plane Manager**.",
    "Instancia el prefab en `hit.pose` y prueba el build en el móvil."
  ],
  "deliverable": "Vídeo del build en el móvil + carpeta del proyecto."
}
```

`steps` is an **ordered** guide, rendered numbered: the student follows it top to
bottom and can say "I'm stuck on step 9". Each string may use inline Markdown —
`**bold**` and `` `code` `` — which is rendered, so keep menu paths inside
backticks (`` `Edit > Project Settings` ``) or `marked` reads the `>` as a
blockquote. Add `steps_note` when a sentence qualifies the whole guide; it prints
in brackets after the heading.

> It was called `milestones` until the step-by-step content landed. That was an
> unordered list of things the finished work had to show — a different document
> from a guide you follow in order, so it was renamed rather than left saying one
> thing and holding the other. `validate` errors on the old name.

Step checkboxes are the **student's own** notes: they live in that student's
browser (`localStorage`) and never leave it. They are unrelated to the teacher's
progress marker.

Activity content is written by you (or generated offline). The site only renders
it — there are no live AI calls in the browser and no API keys on the client.

### Graded exercises (the three practical blocks)

Eight levels carry the graded exercises of the **Blue Goblin** blocks — 30 % of
the course, 10 % per block. They are ordinary `practical` levels plus four
fields:

```jsonc
{
  "block": { "number": 1, "name": "AR Foundation", "exercise": 1, "of": 3 },
  "submissionMethod": "build",              // build | video | repo | null
  "groupMode": "individual-within-group",   // individual | individual-within-group | per-group
  "gradeWeight": { "block": "10 %", "exercise": null },
  "starterRepo": { "url": null, "branch": "01-plane-detection" }  // block 1 only
}
```

Where they sit:

| Block | Levels | Submission | Work |
| --- | --- | --- | --- |
| 1 · AR Foundation | `w1-arf-01/02/03` | build (APK) | individual, within the group |
| 2 · Meta Building Blocks | `w2-pre-02`, `w2-pre-03`, `w2-post-03` | build (APK) | per group |
| 3 · XR Interaction Toolkit | `w3-xrit-02`, `w3-xrit-03` | *undecided* | per group |

Block 2 straddles the midterm castle on purpose: exercises 1 and 2 are the short
in-class ones and sit before it, exercise 3 is the heavy one that finishes at
home and sits after.

**`null` is a real value here and means "not decided yet".** The field being
*absent* is an error; the field being `null` renders as *«por decidir»* in the
portal. `gradeWeight.exercise` is null on all eight — the per-exercise split is
an open decision and must not be guessed. Every open decision is flagged with a
`_fixme` on its own node and printed by **every** `npm run validate` run, so it
cannot quietly become permanent by being forgotten.

`starterRepo` points at a **separate** student repository — the Unity project
never lands in this repo, and the relationship between the two is a link, not a
dependency. One branch per exercise, each branched from the previous one, so the
last branch holds the complete project. It does not exist yet: `url` is `null`
and the portal shows *«pendiente de publicar»*. Creating that repo and filling
the same `url` into the three block-1 nodes is the entire job — no code
changes.

### Slides generated from Markdown (Marp)

**You no longer build decks by hand.** Put `marp: true` at the top of a level's
exercise Markdown and a slide deck appears in that level's *Diapositivas* tab.
That front-matter line is the entire opt-in — nothing to add to `levels.json`.

```markdown
---
marp: true
theme: xr-island
paginate: true
---

<!-- _class: lead -->

# Ejercicio 1 · Plane Detection

**Bloque 1 — AR Foundation** · entrega: build (APK)

---

## La historia

Un goblin azul se ha colado en el despacho del profesor…

---

```

The rules, in full:

| | |
| --- | --- |
| Opt in | `marp: true` in the front-matter. Without it the file stays plain prose in the *Ejercicios* tab. |
| New slide | a line with `---` between slides. |
| Title slide | `<!-- _class: lead -->` — centred, larger, with a glow. |
| Theme | `xr-island`, in [`scripts/marp-theme.css`](scripts/marp-theme.css). One theme for every deck; don't set another. |

The conversion happens **at build time**, under Node. Marp is a
`devDependency` and none of it is shipped: the browser downloads small JSON with
the slides already rendered, plus one shared stylesheet. Adding the pipeline
grew the bundle by 3.8 kB — the viewer, nothing else.

```bash
npm run decks      # regenerate; build and dev both do this for you
```

Output lands in `public/decks/` (gitignored, rebuilt every time). A generated
deck **wins over** a `slides` PDF/Canva block on the same level, and `validate`
warns if you leave one underneath where it can never be seen.

### Boss and optional nodes

- Exactly one `category: "boss"` level in world 2. It always lands on the
  `bossSlot` control point and splits that world into two halves, so adding a
  level before the castle never shifts the nodes after it.
- World 3's boss closes the path instead — it must be the last level listed.
- Boss nodes are always clickable and informative, never decorative.
- `optional: true` lifts a level **off** the main path and joins it to its anchor
  with a dashed line. Set `anchorAfter` to choose the anchor, and `offsetSide`
  (`left`/`right`) to pick the side.

### Colours

All colours live in [`src/config/theme.js`](src/config/theme.js) — change them
there and nowhere else. They are hex numbers with an `0x` prefix, not CSS
strings. Two rules are enforced in `resolveNodeColor()`:

- **Completed is always green**, whatever the category.
- **Optional nodes are never green**, because green means completed.

Category colours are placeholders; tune them freely. The three biomes
(`meadow`, `desert`, `summit`) each carry a `ground`, a `band` and a `rock`, and
it is that three-tone stack — cap, bright band under the lip, dark body — that
makes a plateau read as a plateau. Set them too close to each other and the
relief disappears.

**Two traps worth knowing before you touch this file:**

- `palette.boss` **is the castle stone**, not an accent. Make it red and you get
  two entirely red castles.
- `palette.project` must stay different from `palette.nodeRim`. If they match,
  project nodes render as empty rings.

### Reshaping the island

[`src/config/worlds.js`](src/config/worlds.js) holds each world's centre, its
fixed camera anchor, and its path as a list of spline control points. Drag those
numbers to reshape a world. `validate` will tell you if a path became too tight
for the number of levels on it.

**Segments must be axis-aligned and corners square**: between two consecutive
control points only X *or* Z may change, never both. `validate` enforces it, and
it is deliberate — diagonal runs make the road twist and the skirt underneath it
tear. To fit more sessions into a world, add corners to lengthen its route; the
nodes, the road, the ramps and the houses all re-space themselves.

---

## Sharing a link to one level

Append `?level=<id>` to the site URL and it opens with that level's portal
already up:

```
https://optus23.github.io/Island-Class-XR/?level=w2-boss
```

The avatar is placed directly on that node rather than walking the whole route,
since whoever followed the link came for the level. Opening a level from the map
updates the address bar too, so **Back closes the portal** and the link is always
copy-pasteable. An id that is not in `levels.json` is ignored with a console
warning and the map opens normally at the progress marker.

It is a query parameter rather than a path because GitHub Pages has no rewrite
rules — `/level/w2-boss` would 404.

---

## Progress marker — sign in at `/admin`, drive it from the map

The one manual, explicit exception to "no dates".

1. Create a **fine-grained personal access token** at
   [github.com/settings/personal-access-tokens](https://github.com/settings/personal-access-tokens).
2. Give it access to **only this repository**, with **Contents: Read and write**.
3. Open `/admin/`, paste the token, press **Guardar y comprobar**. That page is
   a small sign-in card and does nothing else — it only checks the token works
   and shows where the class currently is.
4. Go to the map. The legend now has a **Profesor** block with the marker
   readout and three buttons: **Completar y avanzar**, **Retroceder**,
   **Reiniciar curso**.

The controls live on the map on purpose. Pressing *Avanzar* on the old
full-screen admin page moved the marker with nothing on screen to show for it,
so the button read as broken. On the map you watch the avatar walk to the next
session and the camera follow it.

Each press writes `public/progress.json` through the GitHub Contents API, which
triggers the normal Actions deploy — the map updates in a minute or two.

**The token is never in the source code or the build.** It is stored only in the
`localStorage` of the browser you typed it into, and is sent only to
`api.github.com`. Use **Olvidar token** to clear it, and the Profesor block
disappears. Students only ever *read* `progress.json`.

### ¿Dónde va el token, y dónde está el panel?

Las tres dudas que salen siempre, juntas:

- **El token va en `/admin/`, en el navegador. No en `.env`.** El `GH_TOKEN` del
  `.env` es otra cosa: lo usan `git` y `gh` desde tu máquina para publicar. El de
  `/admin` vive solo en el `localStorage` de ese navegador y no se sube a ningún
  sitio.
- **Funciona igual en GitHub Pages que en localhost**, porque escribe contra
  `api.github.com` desde el navegador. No hace falta servidor: por eso el token
  lo pones tú, en tu navegador, y no está en el repositorio.
- **El panel se abre desde el mapa.** En el bloque **Profesor** de la leyenda,
  abajo del todo: *Panel de profesor · alumnos y token →*. O directamente en
  <https://optus23.github.io/Island-Class-XR/admin/>. Si ya ves ese bloque en la
  leyenda, es que ese navegador ya tiene un token guardado de antes.

Los botones del marcador (**Completar y avanzar**, **Retroceder**, **Reiniciar
curso**) están en la leyenda a propósito, no en `/admin`: ahí se ve al personaje
caminar y a la cámara seguirlo. La lista de alumnos está en `/admin` porque es
teclear nombres y no hay nada que mirar mientras lo haces.

Completion is derived from this single marker — there is deliberately no
per-level `completed` flag, because two sources of truth would drift.

### Hiding the sessions ahead

The same Profesor block carries a switch, **Ocultar las sesiones futuras**. With
it on, a student sees the course only as far as the class has reached: everything
past the marker turns grey, gets a padlock and **loses its title**, so an
unopened session cannot be a spoiler. The gate is not cosmetic — a locked level
refuses a disc tap, a row in the course list and a `?level=` deep link alike.

Anyone holding a token is exempt and keeps seeing the whole course. To check what
the students actually see, tick **Ver el mapa como un alumno**; that drops the
exemption in that browser only and changes nothing for anyone else.

The switch is stored as `lockAhead` inside `public/progress.json`, alongside the
marker, so it is one file and one commit.

### Showing the whole island without a token

The exemption has its own switch, and it does **not** need a token: `/admin/`
opens on **Ver todo el mapa**, and ticking it makes that browser see every
session. It is the same setting the legend's *Ver el mapa como un alumno* flips,
stored as one key in that browser's `localStorage` — nothing is committed and
nothing is deployed, so the class is unaffected while you demo the island to a
colleague. `?ver=todo` on the map URL does the same thing in one click (and
`?ver=alumno` undoes it); `/admin/` has the link ready to copy.

Turning `lockAhead` off instead would work too, and is the wrong tool: that is
the course-wide rule, so it spoils the term for the actual class for as long as
the demo lasts, and costs a commit and a Pages rebuild in each direction.

---

## Alumnos en la isla — `/admin`

El sistema de motivación: cuando alguien gana puntos positivos (participación,
un Kahoot del lunes…), su nombre puede aparecer paseando por el mapa.

1. Entra en `/admin/` con el token (arriba).
2. En **Alumnos en la isla**, escribe un **nombre o nickname**, elige la
   **sesión** junto a la que quieres que pasee y pulsa **Añadir**.
3. Repite con quien quieras. Los cambios se quedan en el navegador hasta que
   pulsas **Guardar en el mapa**: cada guardado es un commit y un despliegue, así
   que se guarda todo de una vez, no de uno en uno.
4. Abre el mapa. Aparece un personaje voxel dando vueltas muy despacio alrededor
   de esa sesión, con el nombre sobre la cabeza.

Para quitar a alguien, pulsa la ✕ de su fila y guarda.

Detalles que conviene saber:

- **24 plazas.** Más que eso deja de leerse como «mira quién ha llegado al mapa»
  y pasa a leerse como una multitud.
- **Se ofrecen todas las sesiones menos los dos castillos.** Un examen no admite
  a nadie: el edificio ocupa todo el espacio junto al nodo, y de todas formas
  nadie gana puntos de participación en un examen.
- **Es decoración.** No se puede pulsar, no tapa el disco de la sesión y no
  cambia nada del curso ni del marcador.
- El personaje es aleatorio pero estable: el mismo nombre sale siempre con la
  misma ropa y el mismo pelo.

Se guarda en `public/npcs.json`, que solo contiene **un nombre visible y un id de
sesión** — ni notas, ni puntos, ni correos, ni fechas. `npm run validate` falla si
aparece cualquiera de esas cosas.

---

## La entrada a la isla

Cada visita empieza con un vuelo de unos cinco segundos: cielo azul, nubes
voxel, el título **XR Island**, y la cámara inclinándose hacia abajo hasta
posarse exactamente donde se queda la cámara normal del mapa. Se salta tocando
la pantalla o pulsando cualquier tecla.

- El texto sale de `course` en `src/data/levels.json`: `title` y **`tagline`**
  (la versión corta). El `subtitle` largo se sigue usando en el panel del mapa.
- No se reproduce si el sistema pide *reduced motion*, si se entra por un enlace
  a un nivel concreto (`?level=…`) o si se entra por `/vr`.
- Las nubes existen solo durante el vuelo y se destruyen al aterrizar: la vista
  cenital sube mucho, y una capa de nubes permanente taparía el mapa entero.

Los números del plano (altura de salida, ritmo, cuándo empieza la inclinación)
están todos arriba de `src/three/intro.js`, cada uno con el motivo por el que
vale lo que vale.

---

## VR mode

Every page carries a **VR** button when the browser has a headset. There is
nothing separate to deploy and nothing to install: open the site in the Quest
browser and press it. `/vr` and `?vr=1` arm the XR context eagerly, for going
straight in.

**The island is a tabletop diorama, not a world you stand in.** The whole map is
scaled to about 3 m across and parked at table height in front of you. That is a
decision, not a shortcut: the desktop camera keeps its near plane far out because
a close one across a 180-unit field spent the entire depth buffer on empty space
and made the road and the terrain trade pixels. Standing inside the map at
1 unit = 1 m walks straight back into that. At diorama scale the depth range is a
couple of metres and a map you lean over reads better than one you are a giant
on.

| Input | Does |
| --- | --- |
| Head | Look around, stereo, 6DoF — walk around the model |
| Point + trigger | Ray at a node → select it; the avatar walks there |
| Trigger on the node you are on | Enter → ends the session and opens the 2D portal |
| Left thumbstick | Pan the model, in the direction you are looking |
| Right thumbstick ← → | Turn the model around **your** vertical axis |
| Right thumbstick ↑ ↓ | Zoom, 0.4×–3.2× |
| Grip, either hand | Re-centre the model in front of you |

**With no controllers** — a phone in a Cardboard holder — the head is the
pointer: a reticle sits in the middle of the view and holding a node in it for
about 1.4 s activates it, exactly as the trigger would. Those are the headsets
most students actually have, and a phone in a holder has no button to press.

The **model** moves, never the viewer. Pushing a standing person around by
thumbstick is the reliable way to make them ill, and reaching over to spin a
table map is what you would do anyway.

A level card floats above the model with the session under the ray — or, when the
ray is on nothing, the session the avatar is standing on, so it never goes blank.
It is a canvas painted onto a plane, because **there is no DOM inside an
immersive session**: the page's HTML is not composited into the headset, so
anything the wearer reads has to be geometry.

Not there, deliberately: **no slides and no activity checklists in the headset**
(the card is a readout, and laying slide markup out on a canvas by hand is real
work rather than a hookup), no hand tracking, no teleport locomotion, and no
AR/passthrough — `immersive-vr` only.

---

## 3D assets

The island is generated from code today, so the project runs with no asset
pipeline at all. To replace it with modelled art:

- Build in [MagicaVoxel](https://ephtracy.github.io/) or use a free
  [Kenney.nl](https://kenney.nl/assets) pack.
- Export to **glTF/GLB with vertex colours** — not textures. Vertex colours keep
  the pixel-art look and cost nothing in texture memory or draw calls.
- Drop the files in `public/models/` and load them in `src/three/island.js`.
- Keep using `InstancedMesh` for anything repeated (trees, tiles, nodes). The
  whole island is currently a handful of draw calls; keep it that way.

Performance comes first in this project, visual polish second. If a change costs
frame rate, it needs to earn it.

---

## Content is public — review before publishing

Everything in `public/content/` is served publicly on GitHub Pages, with no
login. Before you commit real material, check:

- **Third-party copyright.** Slides, images, diagrams and video from books,
  papers, vendor decks or other courses may not be redistributable. Material that
  was fine to show inside a private LMS is not automatically fine to publish
  openly on the web.
- **Student data.** No marks, emails, submissions or recordings of identifiable
  students. Nothing in this repo needs them.

  The **one deliberate exception** is `public/npcs.json`, the roster of students
  honoured on the map (see above). It is still public: anyone can read the file
  and anyone can see the names walking the island. So put a **nickname**, or a
  first name plus an initial, rather than a full legal name — especially for
  anyone under 18 — ask before putting someone on the map, and take a name off
  when asked. A display name and a session id is all the file may ever hold.
- **Exam material.** Anything you would not want
  visible before an exam should not be committed until after it.

- **Git history keeps what you take back.** Deleting a file in a later commit
  does not remove it from the repository — it stays readable in the history of
  the branch it was pushed to. Treat every push as final.

If something cannot be published openly, keep it out of this repo and link to it
from the private platform instead.

---

## Forkéalo para tu asignatura

Guía para un profesor que quiere **su propia copia** de este mapa, con sus
sesiones, sus contenidos y sus colores. No hace falta saber Three.js: casi todo
se cambia editando dos archivos de datos. Las secciones de arriba son la
referencia completa; esto es el camino corto, en orden.

Al terminar tendrás una web propia, en tu cuenta de GitHub, con tu dirección
(`https://TU-USUARIO.github.io/TU-REPO/`), y un panel para ir marcando por dónde
va la clase.

**Lo que hace falta:** una cuenta de GitHub, [Node.js](https://nodejs.org) 22 (la
versión que usa el despliegue) y un editor de texto. No hay servidor, no hay base
de datos y no hay nada que pagar.

### 1. Haz tu copia

**Fork**, no clon. Un fork es tu propio repositorio en tu cuenta, y es lo que te
permite publicar tu web.

1. Entra en <https://github.com/optus23/Island-Class-XR>.
2. Arriba a la derecha, **Fork** → **Create fork**.
3. Ponle el nombre que quieras. Ese nombre sale en tu dirección web, así que algo
   corto: `mi-asignatura-xr`, por ejemplo.

Ahora bájatelo a tu ordenador:

```bash
git clone https://github.com/TU-USUARIO/TU-REPO.git
cd TU-REPO
npm install
npm run dev
```

Abre <http://localhost:5173> y ya tienes el mapa en tu máquina. `npm run dev` se
queda corriendo; para pararlo, Ctrl+C.

> **Si `npm run dev` va lentísimo después de un rato**, párralo y arráncalo otra
> vez. Consume mucha memoria con las horas, y los síntomas parecen un fallo del
> código sin serlo.

### 2. Enciende tu web

GitHub publica tu copia gratis, pero hay que activarlo una vez.

1. En tu repositorio: **Settings** → **Pages**.
2. En **Source**, elige **GitHub Actions**.
3. Ve a la pestaña **Actions**. Si sale un aviso pidiendo permiso para ejecutar
   los flujos de trabajo, acéptalo.
4. Sube cualquier cambio (o **Actions** → flujo `deploy` → **Run workflow**).

En un par de minutos tu mapa está en `https://TU-USUARIO.github.io/TU-REPO/`.

**No tienes que tocar ninguna dirección en el código.** La ruta base se saca sola
del nombre de tu repositorio, así que funciona se llame como se llame. Cada vez
que subas algo a `main`, la web se reconstruye sola.

> Trabajando solo, **commitea directamente en `main`**. La rama `develop` y los
> pull requests de [Branch workflow](#branch-workflow) existen porque aquí hay
> dos manos tocándolo; tú no lo necesitas. Lo único que publica es `main`.

### 3. Ponte tú de profesor: el token

Los botones de profesor —avanzar la clase, la lista de alumnos, ocultar las
sesiones futuras— escriben en tu repositorio desde el navegador. Para eso
necesitan un permiso tuyo: un **token**. Es **tu** token, de **tu** cuenta, y
solo para **tu** repositorio.

1. Ve a <https://github.com/settings/personal-access-tokens>.
2. **Generate new token** → *Fine-grained token*.
3. **Repository access** → *Only select repositories* → elige el tuyo.
4. **Permissions** → *Repository permissions* → **Contents: Read and write**.
   Es la única que hace falta.
5. Ponle caducidad (90 días está bien) y créalo. **Cópialo ahora**: GitHub no te
   lo vuelve a enseñar.

Abre `https://TU-USUARIO.github.io/TU-REPO/admin/`, pega el token y pulsa
**Guardar y comprobar**.

**Dónde vive ese token, y dónde NO:**

- Se guarda **solo** en el `localStorage` del navegador donde lo pegaste, y se
  envía solo a `api.github.com`.
- **No** va en el `.env`. El `GH_TOKEN` de ese archivo es otra cosa: lo usan
  `git` y `gh` desde tu ordenador. Está en el `.gitignore` y no se sube.
- **No** entra en el código ni en la web publicada. Los alumnos solo *leen*.
- Funciona igual en tu web publicada que en `localhost`, porque escribe contra
  `api.github.com` desde el navegador. No hace falta servidor.
- Un token por navegador: en otro ordenador tendrás que pegarlo otra vez.
  **Olvidar token**, en `/admin`, lo borra de ese navegador.

Si algún día se te escapa el token, bórralo en GitHub y crea otro. No hay que
tocar nada más.

### 4. Ponle tu nombre

En **`src/data/levels.json`**, arriba del todo:

```json
{
  "course": {
    "title": "XR Island",
    "subtitle": "Realidad Virtual y Realidad Aumentada · Entornos de Realidad Virtual",
    "tagline": "Realidad Virtual y Aumentada"
  }
}
```

- `title` — el panel del mapa y **el título del vuelo de entrada**.
- `subtitle` — la línea larga del panel.
- `tagline` — la línea corta, **solo para la entrada**. Que sea corta de verdad:
  ocupa una pantalla entera.

La pestaña del navegador se cambia en `index.html` (`<title>`), y la del panel de
profesor en `admin/index.html`.

### 5. Cambia las sesiones

Toda la isla —caminos, castillos y cuestas— se genera sola a partir de la lista
`levels` de **`src/data/levels.json`**. **No hay que colocar nada a mano**: el
orden en el archivo es el orden en el mapa, y añadir una sesión re-reparte a sus
vecinas.

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
| `id` | Identificador único. Sale en los enlaces (`?level=w1-01`). Cámbialo **antes** de empezar el curso, no después: los enlaces compartidos dejarían de funcionar. |
| `world` | 1, 2 o 3. El trozo de isla donde cae. |
| `title` | Lo que lee el alumno. |
| `category` | `theory`, `practical`, `project` o `boss`. Decide el color del círculo. |
| `stage` | Bloque temático. Sirve para agrupar. |
| `optional` | `true` para actividades voluntarias. Cuelgan con una línea de puntos de la sesión que digas en `anchorAfter`. |

La lista larga de campos está en
[Where to put your content](#where-to-put-your-content) y
[Adding, editing and reordering levels](#adding-editing-and-reordering-levels).

**Ejecuta `npm run validate` cada vez que toques este archivo.** Te dice qué está
mal antes de que lo veas roto, y se ejecuta sola al construir, así que un error
aquí **impide que la web se publique**. Lo que comprueba, y por qué te importa:

- **Cada mundo con `bossSlot` necesita exactamente un examen**, y no puede ser ni
  el primero ni el último de su mundo: va *entre* dos mitades.
- **El examen final cierra el mundo 3**: tiene que ser la última sesión.
- **Ninguna fecha, en ningún sitio.** Ni `date`, ni `week`, ni `deadline`. El
  mapa no es un calendario; el avance lo mueves tú a mano. Un campo con esos
  nombres hace fallar la validación.
- **Los nodos no pueden quedar demasiado juntos.** Si metes muchas sesiones en un
  mundo, te avisa de que hay que estirar el camino
  ([Reshaping the island](#reshaping-the-island)).
- **Una actividad opcional cuelga de una sesión normal** de su mismo mundo.

La plantilla trae 28 sesiones repartidas 8 / 11 / 9. Puedes poner menos sin tocar
nada más.

### 6. Pon tu contenido

Cada sesión puede llevar diapositivas, tareas y ejercicios.

**Diapositivas**, de menos a más trabajo:

```jsonc
// 1. Un enlace y ya (lo más fácil): abre en otra pestaña
"slidesLink": { "url": "https://…", "label": "Diapositivas de la sesión" }

// 2. Un PDF que se ve dentro de la web. El archivo, en public/content/slides/
"slides": { "type": "pdf", "source": "content/slides/mi-clase.pdf" }

// 3. Un Canva incrustado
"slides": { "type": "canva", "source": "https://www.canva.com/design/…?embed" }

// 4. Todavía no las has hecho: la sesión dice "en preparación"
"slidesPending": true
```

Para Canva: **Compartir → Más → Insertar**, y copia esa dirección. Tiene que
llevar `?embed`. Si copias el enlace de *edición* (lleva `/edit`), la validación
lo rechaza — y menos mal, porque cualquiera podría editarte las diapositivas.

**Ejercicios**: Markdown en `public/content/exercises/`, enlazado desde la sesión
con `"exercises": "content/exercises/<id>.md"`. Si le pones `marp: true` en la
cabecera, ese mismo archivo se convierte en una presentación dentro de la web
— ver [Slides generated from Markdown](#slides-generated-from-markdown-marp).

**Tareas** de la sesión, en `todos`: objetivo, punto de partida, guía paso a paso
y entrega. Los cuatro campos son obligatorios y `steps` no puede estar vacío. Es
una lista **ordenada** y se numera sola, así que escríbela como se sigue: paso 1,
paso 2. Cada paso admite `**negrita**` y `` `código` `` — mete las rutas de menú
entre comillas invertidas. Las casillas que marca el alumno se quedan en **su**
navegador y no las ve nadie más; no tienen nada que ver con el marcador del
profesor.

```bash
npm run placeholders   # crea los archivos que falten; nunca pisa los que hay
npm run validate
```

### 7. Tus colores y tu isla

Los colores, todos, en **`src/config/theme.js`** — y solo ahí. La forma de la
isla, en **`src/config/worlds.js`**. Las dos secciones de arriba lo explican con
las trampas incluidas: [Colours](#colours) y
[Reshaping the island](#reshaping-the-island).

### 8. Durante el curso

Todo esto es desde el navegador, sin tocar código.

**Avanzar la clase.** En el mapa, bloque **Profesor** de la leyenda: *Completar y
avanzar*, *Retroceder*, *Reiniciar curso*. Cada uno hace un commit y la web se
reconstruye en uno o dos minutos. Están en el mapa y no en `/admin` a propósito:
ahí se ve al personaje caminar hasta la sesión siguiente.

**Ocultar las sesiones futuras.** El interruptor de ese mismo bloque. Con él
activado, el alumno solo ve hasta donde ha llegado la clase; el resto sale en
gris, con candado y sin título. Tú, con tu token, lo sigues viendo todo.

**Enseñar la isla entera a alguien.** En `/admin/`, arriba del todo: **Ver todo
el mapa**. No hace falta token. Es una preferencia de ese navegador — no cambia
nada para la clase y no toca el repositorio — y se quita desde el mismo sitio o
desde la leyenda del mapa. Si vas a enseñarlo en otro ordenador, `/admin/` te da
el enlace `?ver=todo` listo para copiar. **No apagues** *Ocultar las sesiones
futuras* para esto: ese interruptor es la regla del curso y les destripa el
temario a los alumnos mientras esté apagado.

**Alumnos paseando por la isla.** En `/admin/`, apartado *Alumnos en la isla*.
Escribes un nombre, eliges la sesión, y aparece un personaje dando vueltas junto
a ese círculo. Es para premiar participación. Caben 24.

> Tu repositorio es **público**: cualquiera puede leer `public/npcs.json`. Usa
> apodos o nombre + inicial, nunca el nombre completo de un menor.

### 9. Cuando algo falla

**La web no se actualiza.** Mira abajo del todo en la leyenda: pone `build` y
unas letras, que son el commit que estás viendo. Si no coincide con el último,
tu navegador tiene la página en caché: recarga forzando (Ctrl+Shift+R). Esto
engaña muchísimo — una corrección puede estar publicada y no verse.

**`public/progress.json does not match …`** Habías pulsado dos botones muy
seguidos. Vuelve a pulsar: se relee el archivo y se reintenta solo.

**El despliegue falla en Actions.** Casi siempre es `npm run validate`. Abre el
flujo fallido en la pestaña **Actions** y lee el error: te dice el `id` de la
sesión y qué le pasa. Corrígelo, súbelo, y se publica solo.

**Ejecuta `npm run validate` en tu ordenador antes de subir nada.** Te ahorra
todo este apartado.

### 10. Antes de enseñárselo a nadie

Tu repositorio es público y tu web también. Repasa
[Content is public](#content-is-public--review-before-publishing) entero: derechos
de autor del material que no es tuyo, cero datos de alumnos, y exámenes fuera del
repositorio hasta que toque. Y ten presente que **el historial de Git guarda lo
que subiste aunque luego lo borres**.

### Chuleta

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

---

## Branch workflow

| Branch | Purpose |
| --- | --- |
| `main` | What students see. Every push builds and deploys to GitHub Pages |
| `develop` | Integration branch holding finished work |
| `feature/*` | One per feature, branched from `develop`, merged back when done |

Only `develop` → `main` publishes. Preview a change locally with `npm run dev`
or `npm run preview` before promoting it.

```bash
git checkout -b feature/my-change develop
```

---

## Project layout

```
src/
  config/    theme.js (all colours) · worlds.js (camera anchors + path splines)
  data/      levels.json — the course content
  three/     scene · cameraRig · paths · island · nodes · player · villagers
  ui/        nav · portal · slides · todos · markdown · hud
  lib/       levels (sequence + status) · progress · roster · githubData (writes)
  admin/     sign-in, and the roster of students on the island
public/
  content/   slides (PDF) · exercises (md, Marp)
  models/    glTF/GLB assets
  progress.json   where the class is
  npcs.json       who is walking the island
scripts/     validate.mjs · make-placeholders.mjs
```

## Stack

Three.js + Vite, plain — no React, no React Three Fiber, no game engine. Tailwind
CSS + DaisyUI for the 2D layer, which is CSS classes only and adds no JS runtime.
`marked` renders the Markdown. That is the whole dependency list, and it is
deliberately short: this is maintained by one person.
