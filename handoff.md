# XR Island — handoff

State as of **3 September 2026**, end of the Blue Goblin content pass (round 6).
Read `CLAUDE.md` first for the durable rules; this file is what was happening.

---

## Where things stand

Everything through round 6 is **merged to `main` and live**:
<https://optus23.github.io/Island-Class-XR/>

| | |
| --- | --- |
| `main` | `2c015fa` — merge of PR #9 |
| `develop` | same content |
| Last deploy | run `33694410152`, success |
| Working tree | clean |
| Performance | ~27 draw calls, ~700k triangles, 0.05 ms/frame CPU |

Shipped rounds: [#3](https://github.com/optus23/Island-Class-XR/pull/3) ·
[#4](https://github.com/optus23/Island-Class-XR/pull/4) ·
[#5](https://github.com/optus23/Island-Class-XR/pull/5) ·
[#6](https://github.com/optus23/Island-Class-XR/pull/6) ·
[#7](https://github.com/optus23/Island-Class-XR/pull/7) ·
[#8](https://github.com/optus23/Island-Class-XR/pull/8) ·
[#9](https://github.com/optus23/Island-Class-XR/pull/9)

Verified live after the deploy: the assessment strip renders on all three
blocks, `null` fields read «por decidir», block 1 shows its pending branch, and
the console is clean.

---

## What round 6 changed — the practical blocks

The first round that is **content, not engineering**. Marc's finalised exercise
brief (three graded blocks, 30 % of the course, sharing a Blue Goblin narrative)
is now in the level model. Nothing about the map, the camera, the paths or the
interaction systems was touched.

**Where the eight exercises landed.**

| Block | Nodes | Entrega | Trabajo |
| --- | --- | --- | --- |
| 1 · AR Foundation | `w1-arf-01/02/03` | build (APK) | individual, dentro del grupo |
| 2 · Meta Building Blocks | `w2-pre-02`, `w2-pre-03`, `w2-post-03` | build (APK) | por grupo |
| 3 · XR Interaction Toolkit | `w3-xrit-02`, `w3-xrit-03` | *sin decidir* | por grupo |

Block 2 straddles the midterm castle **on purpose**, and this was the one real
judgement call of the round: exercises 1 and 2 are the short in-class ones and
go before the exam, exercise 3 is the heavy free one that finishes at home and
closes the block after it. If that ordering is wrong, it is a data move, not a
rewrite.

**Each node** got a drafted `objective-task` with 8–9 real technical
checkpoints, written from the brief rather than pasted out of it, plus a
student-facing statement in `public/content/exercises/`. The Blue Goblin beat
lives in the `objective` and the `summary`, not in a separate story field, so a
student who reads only the objective still gets the thread.

**New level fields**, validated in `validate.mjs` and rendered by the portal's
`assessmentStrip()`: `block`, `submissionMethod`, `groupMode`, `gradeWeight`,
and `starterRepo` on block 1. `null` means *not decided yet* and renders as
«por decidir»; the field being **absent** is an error. That distinction is the
whole point — see below.

**Four open decisions were carried forward, not resolved.** They live in
`_fixme` on the relevant nodes, print at the end of every `npm run validate`,
and are written up in [`docs/decisiones-abiertas.md`](docs/decisiones-abiertas.md).
Do not fill any of them in with a plausible guess:

1. the per-exercise grade split inside each block (`gradeWeight.exercise`),
2. block 1's starting point — project handed over vs. built from scratch,
3. the identity of block 2's "new threat",
4. block 3's submission method — the brief simply does not say, and it is
   deliberately **not** assumed to be the APK of blocks 1 and 2.

**The block 1 starter repository does not exist yet.** It is a separate repo,
one branch per exercise, accumulating so `03-libre` holds the full set;
`starterRepo.url` is `null` until it does, and the portal says «pendiente de
publicar». Its Unity project must never be merged into this repo —
[`docs/repo-ejercicios-bloque1.md`](docs/repo-ejercicios-bloque1.md) has the
layout and the one-line edit that publishes the link.

---

## What round 5 changed

All of it verified on the live site.

**Controls.** The drag was inverted on both axes — harmless while the orbit
clamps were tiny, obvious once they opened up. Tilting toward straight down
flipped the island 180° in a single frame. Selecting a different session
mid-walk now takes effect from wherever the avatar has got to, instead of
walking backwards to the last node first.

**The road overlap, finally.** The user reported this four rounds running and
called it z-fighting; it was never z-fighting. Two real causes, both fixed:

1. Ground followed the height of the *nearest* piece of road. At a 90° corner
   the points nearest each arm meet along the bisector — a diagonal across the
   bend — and where the arms sat on different plateaus that diagonal became a
   two-unit wall through the road and through the node standing on it. The
   shelf now comes from the **lowest** road height within 5.5 units.
2. The ribbon was one strip for the whole path, so each corner got a single
   quad joining a sideways vector along X to one along Z. That quad is twisted;
   half its surface ends up under the ground, and the terrain showed through as
   the jagged green wedge in the user's screenshots. Each straight run is now
   its own rectangular strip, extended past both ends so runs overlap and
   square off the bend.

**Crossings.** Two small round pools on the route — one water, one a chasm with
a dark bottom — each with a little wooden bridge, at different sizes and offsets.
An earlier attempt in this same round ran a river bank to bank and split the map
into three separate islands; the user rejected that outright ("hace un rewind"),
so the island is one landmass again. Keep it that way.

**Placement.** The prop planner and the node planner previously knew nothing
about each other — hence a tree growing through a bonus level and a signpost on
a session. They now share a keep-out. Bonus nodes are scored on level ground and
how far inland they sit, not on distance from the road alone. Landmarks stand
beside the session they belong to. There is a lilac toad house to go with the
red one. Patrolling creatures keep off the discs.

**Bosses.** The screen closes through a horned silhouette instead of a circle.

---

## Content the user still owes

This is the main thing standing between the site and real use.

- **7 placeholder titles** in `src/data/levels.json`: `w1-intro-04`, `w2-pre-04`,
  `w2-post-04`, `w3-xrit-04`, `w3-xrit-05`, `w3-proj-04`, `w3-proj-05` show as
  `PLACEHOLDER — sesión N (…)`. These are the slots the calendar recount opened,
  and round 6 did not touch them — none of them is one of the eight graded
  exercises.
- **The sample Canva link is private**, so session 1-2's slides render
  "Este diseño es privado". Replace it with a public Share → Embed URL. The
  validator already rejects `/edit` links and links without `?embed`.
- **Slides are still all placeholders** (`public/content/slides/*.pdf`), for the
  eight exercise sessions too.
- **Answers are still all placeholders** (`public/content/answers/*.md`),
  including the eight exercises — though for open-ended creative work a
  "solución" may not be the right shape; worth asking.
- Exercises (`public/content/exercises/*.md`): the **eight graded ones are
  written**; the rest are still placeholders.

---

## Known open items

Nothing here is blocking; none of it has been asked for yet.

- **iOS Safari PDF fallback.** Slides use `<object>`; iOS Safari does not render
  inline PDFs well. Flagged rounds ago, never implemented.
- **`prefers-reduced-motion` is honoured in code but has never been verified at
  runtime.**
- **Node 20 deprecation warning** on the Actions runners — the workflow's actions
  target Node 20 and are being forced onto 24. Harmless today.
- The main bundle is ~650 kB (170 kB gzipped) and trips Vite's chunk-size
  warning. It is almost entirely Three.js; splitting it would not help a page
  that needs Three.js immediately.
- Draw calls rise to ~77 when a castle is in frame — each castle is built from
  individual meshes rather than instanced. Cheap enough that it has not mattered.

---

## Things to be careful about next time

- **The user's diagnosis is a symptom report.** Four separate causes have now
  been reported as "z-fighting on the path". Reproduce and identify before
  changing anything — toggling meshes in the running scene (`window.__app`) is
  the fastest way.
- **Test with `window.__step(n)`, not wall-clock waits.** The in-app browser pane
  reports `document.hidden === true`, so rAF runs at about 1 fps and animations
  appear frozen or "broken" when they are fine.
- **Verify on Pages, not localhost.** The user has asked twice whether the latest
  version was actually deployed. It is the last step of every round.
- **Don't widen scope into the island's silhouette.** Two attempts at making it
  less rectangular have landed well (organic coastline, rounded corners), but the
  three-island split was a step too far. Local features on one landmass is the
  established direction.

---

## Quick start for the next session

```bash
cd C:/DATA/02_WORK/05_TeacherCITM/XRIsland/Island-Class-XR
npm install
npm run dev        # or use the preview tool with .claude/launch.json name "xr-island-dev"
npm run validate   # data + map sanity; also runs inside npm run build
```

`.env` holds `GH_TOKEN` and is gitignored — it is what `gh` and `git push` use.
Never print it, never copy it into a remote URL or `.git/config`.
