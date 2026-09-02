# XR Island — handoff

State as of **2 September 2026**, end of feedback round 5.
Read `CLAUDE.md` first for the durable rules; this file is what was happening.

---

## Where things stand

Everything through round 5 is **merged to `main` and live**:
<https://optus23.github.io/Island-Class-XR/>

| | |
| --- | --- |
| `main` | `232e369` — merge of PR #8 |
| `develop` | same content |
| Last deploy | run `33667382359`, success |
| Working tree | clean |
| Performance | ~27 draw calls, ~700k triangles, 0.05 ms/frame CPU |

Shipped rounds: [#3](https://github.com/optus23/Island-Class-XR/pull/3) ·
[#4](https://github.com/optus23/Island-Class-XR/pull/4) ·
[#5](https://github.com/optus23/Island-Class-XR/pull/5) ·
[#6](https://github.com/optus23/Island-Class-XR/pull/6) ·
[#7](https://github.com/optus23/Island-Class-XR/pull/7) ·
[#8](https://github.com/optus23/Island-Class-XR/pull/8)

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

- **5 placeholder titles** in `src/data/levels.json`: `w1-intro-04`, `w2-pre-04`,
  `w2-post-04`, `w3-xrit-04`, `w3-xrit-05`, `w3-proj-04`, `w3-proj-05` show as
  `PLACEHOLDER — sesión N (…)`. These are the slots the calendar recount opened.
- **The sample Canva link is private**, so session 1-2's slides render
  "Este diseño es privado". Replace it with a public Share → Embed URL. The
  validator already rejects `/edit` links and links without `?embed`.
- Real slides (`public/content/slides/*.pdf`), exercises and answers
  (`public/content/{exercises,answers}/*.md`) — all currently placeholders.

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
