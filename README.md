# XR Island

A gamified 3D course portal: a voxel island world map, in the spirit of the Super
Mario World overworld, where every node is a portal to that level's slides,
activities, exercises and answers.

Built to be reused indefinitely, for any subject. It currently backs *Realidad
Virtual y Realidad Aumentada* and *Entornos de Realidad Virtual*, whose content
is ~99% identical, but nothing in the code is specific to either.

Static site: Three.js + Vite, deployed to GitHub Pages. No backend, no database.

---

## Quick start

```bash
npm install
```

```bash
npm run dev
```

Then open the URL Vite prints. The admin panel is at `/admin/`.

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
| **Exercises** | `exercises: "content/exercises/<id>.md"` | Plain Markdown at `public/content/exercises/<id>.md` |
| **Answers** | `answers: "content/answers/<id>.md"` | `null` hides the tab entirely |
| **Activities** | `todos: [ … ]` | `objective-task` objects — objective, starting point, milestones, deliverable |
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
  "answers": "content/answers/w1-arf-04.md",   // null hides the tab
  "todos": [ /* see below */ ]
}
```

Stages: `intro-theory`, `ar-foundation`, `meta-pre-exam`, `mini-boss-midterm`,
`meta-post-exam`, `xr-toolkit`, `final-project`, `final-boss-presentation`.

After editing, run `npm run placeholders` to create any new content files, then
`npm run validate`.

### Slides: PDF or Canva

Each level picks one.

- `{"type": "pdf", "source": "content/slides/x.pdf"}` — the PDF is committed to
  this repo, so it also works offline in class.
- `{"type": "canva", "source": "https://www.canva.com/design/XXX/view?embed"}` —
  for decks with animation, video or GIFs that a PDF cannot carry.

> The Canva URL **must** be the public **Share → Embed** link. `validate` rejects
> edit links, so a private deck cannot reach the published site by accident.

### Activities (`todos`)

Native interactive activities — never a PDF, never plain text. The type today is
`objective-task`:

```jsonc
{
  "id": "w1-arf-04-t1",
  "type": "objective-task",
  "objective": "Usar AR Foundation para instanciar un modelo sobre un plano.",
  "starting_point": "Proyecto Unity con AR Foundation ya instalado.",
  "milestones": ["Escena AR mínima", "Detección de planos", "Raycast", "Build"],
  "deliverable": "Vídeo del build en el móvil + carpeta del proyecto."
}
```

Milestone checkboxes are the **student's own** notes: they live in that student's
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
an open decision and must not be guessed. See
[`docs/decisiones-abiertas.md`](docs/decisiones-abiertas.md); `npm run validate`
prints all four open decisions on every run.

`starterRepo` points at a **separate** student repository, one branch per
exercise — its Unity project never lands in this repo. It does not exist yet;
[`docs/repo-ejercicios-bloque1.md`](docs/repo-ejercicios-bloque1.md) has the
branch layout and the one-line edit that publishes the link.

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
there and nowhere else. Two rules are enforced in `resolveNodeColor()`:

- **Completed is always green**, whatever the category.
- **Optional nodes are never green**, because green means completed.

Category colours are placeholders; tune them freely.

### Reshaping the island

[`src/config/worlds.js`](src/config/worlds.js) holds each world's centre, its
fixed camera anchor, and its path as a list of spline control points. Drag those
numbers to reshape a world. `validate` will tell you if a path became too tight
for the number of levels on it.

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

## Progress marker (`/admin`)

The one manual, explicit exception to "no dates".

1. Create a **fine-grained personal access token** at
   [github.com/settings/personal-access-tokens](https://github.com/settings/personal-access-tokens).
2. Give it access to **only this repository**, with **Contents: Read and write**.
3. Open `/admin/` on the published site, paste the token, press **Guardar y releer**.
4. Use **Avanzar** to move the marker to the next level, **Reiniciar** at the end
   of the semester.

Each press writes `public/progress.json` through the GitHub Contents API, which
triggers the normal Actions deploy — the map updates in a minute or two.

**The token is never in the source code or the build.** It is stored only in the
`localStorage` of the browser you typed it into, and is sent only to
`api.github.com`. Use **Olvidar token** to clear it. Students only ever *read*
`progress.json`; the map has no admin controls in it.

Completion is derived from this single marker — there is deliberately no
per-level `completed` flag, because two sources of truth would drift.

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
- **Student data.** No names, marks, emails, submissions or recordings of
  identifiable students. Nothing in this repo needs them.
- **Exam material.** Answers are published too. Anything you would not want
  visible before an exam should not be committed until after it.

If something cannot be published openly, keep it out of this repo and link to it
from the private platform instead.

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
  three/     scene · cameraRig · paths · island · nodes · player
  ui/        nav · portal · slides · todos · markdown · hud
  lib/       levels (sequence + status) · progress (reads progress.json)
  admin/     the progress panel
public/
  content/   slides (PDF) · exercises (md) · answers (md)
  models/    glTF/GLB assets
  progress.json
scripts/     validate.mjs · make-placeholders.mjs
```

## Stack

Three.js + Vite, plain — no React, no React Three Fiber, no game engine. Tailwind
CSS + DaisyUI for the 2D layer, which is CSS classes only and adds no JS runtime.
`marked` renders the Markdown. That is the whole dependency list, and it is
deliberately short: this is maintained by one person.
