# XR Island — working rules

A gamified 3D voxel course portal in the shape of a Super Mario World overworld,
for two near-identical VR/AR courses at UPC CITM. Static site, no backend.

- **Live:** https://optus23.github.io/Island-Class-XR/
- **Repo:** https://github.com/optus23/Island-Class-XR
- **Stack:** Three.js (plain, no React) + Vite (multi-page) + Tailwind v4 / DaisyUI 5
  (CSS-first config, no PostCSS file). GitHub Actions → GitHub Pages.

Priority order, in this order, always: **performance first, visual polish second,
simple for one person to maintain third.**

---

## Hard constraints

These come from the brief and are not negotiable without the user saying so.

- **No dates anywhere in map data.** No schedules, no holidays, no week numbers.
  The single exception is the manual progress marker in `public/progress.json`,
  moved by hand from `/admin`. `scripts/validate.mjs` fails the build on a stray
  `date` / `week` / `deadline` field.
- **No backend, no database.** Everything is static files plus the GitHub
  Contents API for the one marker write.
- **The admin GitHub token never touches source or the build.** It lives only in
  the `localStorage` of whoever uses `/admin`. The repo-side token lives in the
  gitignored `.env` as `GH_TOKEN` — never `VITE_`-prefixed, because Vite inlines
  `VITE_*` into the public bundle.
- **No live in-browser AI calls, no API keys on the client.**
- **Do not authenticate against or embed Atenea Virtual.**
- The content is public. The README must keep flagging that it needs a
  copyright / student-data review before publishing.

---

## Shipping

Every round of feedback ships the same way, and is not done until it is live:

```bash
git checkout -b feature/NN-name develop
# work, then:
npm run validate && npm run build
git checkout develop && git merge --no-ff feature/NN-name
gh pr create --base main --head develop
gh pr merge N --merge
gh run watch <id> --exit-status
```

Then **verify on https://optus23.github.io/Island-Class-XR/, not on localhost.**
The user checks the deployed site. Work sitting in the working tree is not done.

Merge-to-main permission runs until **14 September 2026**; after that, commits go
to `develop` and the user merges.

Pushing: Git Credential Manager caches an under-scoped credential and 403s
without re-prompting. Push with the helper reset inline:

```bash
git -c credential.helper= -c credential.helper='!f(){ echo username=x-access-token; echo "password=$GH_TOKEN"; };f' push origin <branch>
```

`npm run validate` runs as part of `npm run build`. It checks the level model,
path orthogonality, buried nodes, bonus-node clearance and the no-dates rule.

---

## How the map is built

Nothing is hardcoded per node. Reshape a world by editing data, not geometry.

| File | Owns |
| --- | --- |
| `src/config/worlds.js` | World centres, camera presets, orthogonal path control points. **Data, not geometry.** |
| `src/config/theme.js` | Every colour in the project. Single source of truth. |
| `src/data/levels.json` | The sessions. Order matters; nodes are spread along the curve at runtime. |
| `src/three/terrain.js` | **The** answer to "how high is the ground here". Everything anchors through `groundHeightAt()`. |
| `src/three/paths.js` | Node distribution by arc length, boss-slot splitting, connectors. |
| `src/three/nodes.js` | Road ribbon, stairs, node discs, castles, bridges. |
| `src/three/props.js` | Prop recipes and placement. All props bake into ONE InstancedMesh. |
| `src/three/island.js` | Terrain cap/band/body, water shader, backdrop, void pits. |
| `src/three/cameraRig.js` | Bounded per-world follow camera. |

**Session count is fixed by the calendar**, verified against the user's Whimsical
board: 11 sessions → midterm (session 12) → 15 sessions = **27**, landing as
**7 / 9 / 11** per world, plus 3 optional levels that are not sessions. Both Fall
and Spring are identical. Do not add sessions without re-checking that board.

**Never place anything by hand.** If an object needs a position, derive it from
the path template or the node list so reshaping a world moves it too.

---

## Established visual vocabulary

Changing any of these is a design decision, not a refactor.

- **One cream road** (`world.path`) with a dark brown outline, the same in all
  three worlds. The outline is what keeps it readable over sand and over snow.
- **Terrain is flat plateaus.** `PLATEAU = 2` near the route, `TIER = 4` further
  out. Fine height steps read as scratches, not as terrain — see below.
- **Wooden treads** where the road climbs from one plateau to the next, in road
  colour, two chunky steps per plateau.
- **A landmark beside each session** — toad house (red and lilac, both spotted),
  well, warp pipe, cannon, signpost, crates. Close enough that standing on the
  disc feels like arriving somewhere.
- **Castles**: grey stone, red roofs. The final boss is 2.3× the midterm's.
- **Two round crossings** on the route: one water, one a chasm with a dark
  bottom, each with a small wooden bridge. Different sizes and offsets — they
  must not read as one feature mirrored. The island stays **one landmass**; an
  attempt to split it into three with a river was rejected.
- **UI chrome**: solid plates, hard black outline, bright inner rim, plated title
  bars, gold level tiles, Fredoka. Dark, but in the same language as the island.
  The full-screen level portal is a separate, calmer design and is approved as-is.
- **Bosses** close the screen through a horned silhouette instead of a circle.
- **The iris is the only transition, in both directions.** Entering a level is
  circle in → the "MUNDO 1-6" card on the black → circle out onto the portal;
  leaving reverses it. The card must never fade: it lives above the iris
  (`z-index: 80`, appended to `body`, not `#ui`) and is only ever shown while
  the wipe is already closed. A fade anywhere in that sequence is the bug.

---

## Traps that cost real time

Every one of these was diagnosed the hard way. Do not re-derive them.

**Rendering**

- `vertexColors: true` on an `InstancedMesh` that uses `instanceColor` multiplies
  by a missing per-vertex attribute and renders **everything black**. Don't set it.
- Camera `near` matters more than `far`. At `0.5` with the camera ~90 units out,
  almost the whole depth buffer is spent on empty space. It is `12`.
- `lookAt()` has no defined roll when forward is parallel to up: crossing the pole
  flips the world 180° in one frame. The rig keeps a floor under the offset's
  horizontal component (`MIN_HORIZONTAL`).
- The road ribbon is built **per straight run**, each extended past its ends by
  half the road's width. One strip across a 90° corner produces a twisted quad
  whose triangles fold under the ground — that is the green wedge.
- Ground height near the route comes from the **lowest** road height within
  `SHELF_LOOK`, not the nearest. The nearest gives a diagonal plateau boundary
  across every corner, which cuts the road and the node in half.
- Backdrop markings must be projected onto the mound's ellipsoid surface, or they
  float in front of it like balloons.

**Input**

- `touch-action: none` on the canvas is what lets touch gestures reach the page at
  all. Without it the browser claims one finger as scroll and two as page zoom.
- Track every pointer in a `Map`. One variable means the second finger overwrites
  the first and a pinch registers as one enormous jump.
- `setPointerCapture` **throws** for a pointer the browser does not consider
  active. Call it last, wrapped in try/catch, or it takes the gesture with it.
- **Orbit is Unity's Alt + left-drag, and the camera moves OPPOSITE the
  pointer on both axes.** Drag left, the camera swings right; drag down, you end
  up looking from above. It should feel like grabbing the island and turning it.
  Both signs in `rig.orbit()` are therefore negative — a positive one means that
  axis is inverted. This has now been reported twice; don't re-derive it on
  paper, measure it: `rig.orbit(100, 0)` then compare `camera.position` against
  the camera's own right vector from `matrixWorld.extractBasis`.

**CSS**

- `--iris-r` must be registered with `@property` or the wipe snaps instead of
  animating.
- Commit pending styles with a **forced reflow**, never `requestAnimationFrame` —
  rAF does not fire in a hidden tab, which left the wipe unresolved and the portal
  never opened.
- "Everything except this shape" needs two mask layers with
  `mask-composite: exclude` (`-webkit-mask-composite: xor`). A single mask image
  hides the element outside its own box, which is the opposite. `subtract`
  composites the other way and gives the effect inside out.

**Tooling**

- `scripts/validate.mjs` runs under **Node**, so anything it imports must not pull
  in `levels.json` through a plain import — Node needs `with { type: 'json' }`.
  Keep level data out of `paths.js` and `terrain.js`.
- In the in-app browser pane `document.hidden` is `true`, so `requestAnimationFrame`
  is throttled to about 1 fps. Drive the loop with `window.__step(frames)` when
  testing; a walk that "never finishes" is usually just this.
- Debug globals (`__app`, `__map`, `__player`, `__selectLevel`, `__setOverview`,
  `__step`) exist in **dev only**. They are absent on Pages, by design.

---

## Working with this user

Feedback arrives as long dictated Spanish paragraphs bundling eight to twenty
separate items, usually with New Super Mario Bros. world-map screenshots attached.
Split the message into an explicit checklist before starting, and do the input and
playability bugs first — the blocking one is often buried mid-paragraph.

The stated cause is a hypothesis, not a finding. "Z-fighting on the path" has so
far turned out to be quantisation contours, a twisted corner quad, a patrolling
Goomba, and a diagonal plateau boundary — none of them z-fighting. Toggle meshes
in the running scene to identify the culprit before changing anything.
