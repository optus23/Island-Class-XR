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
- **There are exactly two hand-moved data files, and `/admin` is where you sign
  in for both**: `public/progress.json` (where the class is, AND whether the
  sessions ahead are hidden — `lockAhead`) and `public/npcs.json` (which students
  walk the island). The MARKER controls are not on `/admin` — they live in the
  map's legend, because pressing "Avanzar" while staring at a form read as a
  dead button. The ROSTER editor is on
  `/admin`, because it is data entry with nothing to watch while you type. That
  split is the rule; do not move either one back.
- **The roster holds a display name and a session id. Nothing else.** No marks,
  no points, no counters, no emails, no dates — the no-calendar rule covers it
  and `validate` enforces both. The repository is public, so `/admin` says in as
  many words to use a nickname or a first name plus an initial.
- **No live in-browser AI calls, no API keys on the client.** The slide decks
  are a Markdown→HTML pipeline run at build time, not generation.
- **The course publishes no answers.** The todos are the instructions and that
  is the whole deliverable — "you send the flat-pack and the instructions, not
  the assembled furniture" (Marc, round 9). An earlier round built a global
  answer lock; it was removed rather than hardened, because the repo is public
  and `git log` keeps whatever was ever committed to it. Do not reintroduce an
  answers surface. A solved Unity project may be shared one day; that would be
  a separate repo, discussed first.
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

**The legend shows the commit the page is running** (`build <sha>`, dim, at the
bottom). Use it before believing a bug report about a fix you just shipped: JS
filenames are content-hashed, so a phone holding a cached `index.html` loads the
OLD bundle, which is still on Pages and still works. A shipped fix and a stale
page look identical from the outside. One round was spent re-diagnosing
something that was already fixed. Ask for the build id first.

Merge-to-main permission runs until **14 September 2026** — days away as of the
last round; after that, commits go to `develop` and the user merges the PR.

Pushing: Git Credential Manager caches an under-scoped credential and 403s
without re-prompting. Push with the helper reset inline:

```bash
git -c credential.helper= -c credential.helper='!f(){ echo username=x-access-token; echo "password=$GH_TOKEN"; };f' push origin <branch>
```

`npm run validate` runs as part of `npm run build`. It checks the level model,
path orthogonality, buried nodes, bonus-node clearance and the no-dates rule.
`npm run decks` runs before it (as `prebuild`) and compiles the Marp decks into
the gitignored `public/decks/`.

**If the round touches `public/progress.json` or `public/npcs.json`, merge
`main` back into `develop` first.** `/admin` and the legend write both files
straight to `main`, so `main` always carries commits `develop` has never seen.
Eleven PRs merged cleanly only because nothing on `develop` had touched
`progress.json`; the first round that did hit a conflict mid-ship. Resolve in
favour of `develop`'s shape, keeping `main`'s values — the marker is the
teacher's live position and the roster is the students actually on the island,
and neither may be rolled back.

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
| `src/three/villagers.js` | The honoured students: bodies, circuits, name plates. |
| `src/three/intro.js` | The opening flight, its title plate and its pacing. |
| `src/three/clouds.js` | Voxel clouds. Intro-only, by design. |
| `src/three/cameraRig.js` | Bounded per-world follow camera. |
| `src/lib/levels.js` | The sequence, and **the one place the lock rule lives** (`statusFor`, `safeTitle`). |
| `src/lib/githubData.js` | The write path for both public data files. |

**Session count is fixed by the calendar**, verified against the user's Whimsical
board: 11 sessions → midterm (session 12) → 15 sessions. Both Fall and Spring are
identical. Do not add or remove sessions without re-checking that board.

**What `levels.json` actually holds today** (counted, September 2026): 31 levels
= **28 on the main path** (8 / 11 / 9 per world, including the two castles) plus
**3 optional** — the two "Actitud" activities and the re-evaluation. Of the 28,
**26 are classes** and 2 are exams; the nav reads "Sesión N / 28".

Those two paragraphs disagree: the note above says 27 and 7 / 9 / 11, the data
says 28 and 8 / 11 / 9. **Nobody has re-checked the board since, so do not
"correct" either one from the other** — the numbers came from different places
and only the board settles it.

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
  **`palette.boss` IS that stone**, not a marker colour — `nodes.js` repaints
  every castle part not flagged `keepColor` with `resolveNodeColor()`, so
  setting it red once turned both castles solid red. The only exam that is red
  is the re-evaluation, which is `bossTier: 'extra'` and gets `bossAccent`.
  **A locked castle keeps that stone**: `resolveNodeColor` checks `boss` BEFORE
  `locked`, because `palette.locked` is a lighter grey and a castle wearing it
  read as a different building. The padlock and the hidden title are what say a
  session is closed; the stone is the material.
- **The biome seams are interleaved, not cut.** `biomeKeyAt(x, z)` picks per
  column near a boundary: the seam wanders in Z, a mid-frequency term throws
  fingers of one biome across it, and a per-column hash salts single voxels at
  the edges — snow reaching into the desert and sand into the snow. It replaced
  `worldAtX`, which is nearest-centre and therefore exactly a vertical cut,
  and made the island read as three slabs. **It must stay deterministic and
  position-only:** the terrain cells, the props planted on them and the
  backdrop all call it separately, and the moment it disagrees with itself you
  get cactus growing on grass.
- **The voluntary "Actitud" activities are their own nodes**, hanging off the
  class day on a dashed connector, lilac. The day itself keeps its ordinary
  theory or practice colour — it is an ordinary class. Do not go back to
  recolouring the day.
- **Two round crossings** on the route: one water, one a chasm with a dark
  bottom, each with a small wooden bridge. Different sizes and offsets — they
  must not read as one feature mirrored. The island stays **one landmass**; an
  attempt to split it into three with a river was rejected.
- **UI chrome**: solid plates, hard black outline, bright inner rim, plated title
  bars, gold level tiles, Fredoka. Dark, but in the same language as the island.
  The full-screen level portal is a separate, calmer design and is approved as-is.
- **The honoured students are villagers, not a second avatar.** A voxel
  classmate pacing a slow, lopsided circuit beside the session they earned, with
  a name plate over their head. They must never be mistaken for the AVATAR, which
  is the one figure the viewer drives: no red shirt and no cyan visor in the
  recipe, and their walk is a stroll that keeps drifting to a near-standstill
  rather than the avatar's bouncing march. They are decoration — never clickable,
  never on the disc, never carrying course meaning.
- **The plate over the avatar dismisses itself, and never covers a panel.**
  Touch anything that is not the plate — the map, the course list, the legend,
  the VR button — and it goes. On a desktop, hovering the node the avatar is
  standing on brings it back; on a phone the way back is tapping that node,
  which enters the level, and that is fine. It also refuses to sit on an open
  panel: if the space above the avatar is taken it drops below instead. Before
  this it stayed up through everything, so opening the course list left you
  reading one UI through the other.
- **One node, one label.** The hover tooltip is suppressed for the node the
  avatar is standing on, because the plate is already there, says the same
  thing, and is in the same place.
- **The site opens with a flight, not with the map.** Blue sky, voxel cloud, the
  title, and a fall onto the island that ends exactly where the follow camera
  already sits — Marc's reference is the Simpsons title sequence. It plays on
  every visit, and it is skipped for reduced motion, for a shared `?level=` link
  and for `?vr=1` / `/vr/`.
- **The road behind the class is amber, the road ahead is cream.** A green disc
  on its own was not enough feedback — the ring changed and the road it stood on
  did not — so `world.pathDone` paints the route already walked, up to the
  marker. Amber and NOT green: green is the completed node, and reusing it makes
  the whole route read as one enormous completed thing.
- **A session past the marker is LOCKED, and locked means its NAME is hidden.**
  Grey disc, padlock in the course list, "Sesión 7" instead of the title.
  Several titles are plot points, so the list read on day one is the spoiler.
  Course-wide switch in the legend, written to `progress.json`; anyone holding
  an admin token is exempt, and "Ver como alumno" drops that exemption locally.
- **Bosses** close the screen through a horned silhouette instead of a circle.
- **The level portal is ONE scrolling page.** Header, tags, tabs and content all
  scroll away together; only the back button stays (it is `position: fixed`, and
  without it a phone user has no way out — there is no Escape key). Three
  attempts at a fixed header over a scrolling body all failed, because on a
  phone held sideways the header IS the screen: 273 px of 390.
- **The iris is the only transition, in both directions.** Entering a level is
  circle in → the "MUNDO 1-6" card on the black → circle out onto the portal;
  leaving reverses it. The card must never fade: it lives above the iris
  (`z-index: 80`, appended to `body`, not `#ui`) and is only ever shown while
  the wipe is already closed. A fade anywhere in that sequence is the bug.

---

## Traps that cost real time

Every one of these was diagnosed the hard way. Do not re-derive them.

**WebXR** (live on every page; the button is the bridge)

- **VR is reachable from every URL. What `?vr=1` and `/vr/` still control is
  when the WebGL context is made XR-compatible, and that is the whole safety
  property — do not collapse the two paths into one.**
  - Without them, the context is created exactly as it was before any WebXR
    work existed. The only addition is one `isSessionSupported()` call — a
    capability query that creates and migrates nothing — and a button if it
    says yes. `renderer.xr.enabled` stays off until entry.
  - With them, the context is XR-compatible from the first frame, so entry can
    never hit a GPU migration. This is the guaranteed path.
- **`makeXRCompatible()` on a live context can lose that context**, on any
  machine whose headset is on a different GPU than the one Chrome picked —
  every Quest Link setup with two adapters. Three then calls
  `new XRWebGLBinding` on a dead context and throws `InvalidStateError`. So the
  lazy arming in `scene.js` reports `'ready' | 'lost' | 'failed'`, and `vr.js`
  reloads into `?vr=1` on anything but `ready`. A standalone headset has one
  GPU and never takes that path — which is the case that matters, because that
  is where students run it.
- **Never make the plain map create an `xrCompatible` context on load.** That
  is what put every visitor one GPU migration away from a lost context, and
  three answers each one by rebuilding ~14k instanced voxels, the shore
  DataTexture and every shader.
- **The `/vr/` door is read off the document, never off `location.pathname`.**
  The deploy base comes from `GITHUB_REPOSITORY` and can be overridden with
  `BASE_PATH`, so a path-sniffing gate would quietly stop arming XR after a
  repo rename. `vr/index.html` is a third Vite entry that shares the `main`
  chunk byte for byte.
- **Stereo only. Never reintroduce a mono mode.** Two implementations were
  tried and both left the right eye facing the wrong way; stereo works
  perfectly. Leave `renderer.xr.cameraAutoUpdate` at its default.
- **Anything measured in world space breaks in VR.** The diorama scales the
  whole group by ~0.005, so a shader reading `modelMatrix * position` — the
  water's shore lookup did — falls out of range and goes flat. Derive from
  local position plus the object's own offset instead.
- **Size the diorama from a measured `Box3`, never a guessed constant.** The
  sea is 2.4x the island's width and 3.4x its depth; a scale tuned to the
  island alone put the viewer *inside* the water, 1.3 m of it behind them.
- **Rotation turns the viewer, not the model.** Spinning a two-metre model in
  front of someone reads as self-motion however centred the pivot is.

**Rendering**

- `vertexColors: true` on an `InstancedMesh` that uses `instanceColor` multiplies
  by a missing per-vertex attribute and renders **everything black**. Don't set it.
  It IS the right tool on a plain Mesh with no instanceColor — that is how the
  road ribbon carries the amber trail on one draw call. The road stairs are an
  InstancedMesh and use `setColorAt` instead. Two meshes, two mechanisms, and
  swapping them breaks one of them.
- **Every road sample carries its arc length along the WHOLE route**, which is
  only true because `createPathRibbon` assembles the curves in route order —
  world, bridge, world, bridge, world — rather than all worlds then all
  connectors. Colouring the finished stretch is then a comparison against one
  number per vertex. Break that ordering and the trail paints the wrong half.
- **Count the lift that the mesh you are measuring actually has.** The border
  ribbon sits at (max-of-5 ground) + 0.34; the road surface adds ROAD_LIFT 0.44
  on top. A check that added both to the border reported 48 floating run ends
  where there were 4, because every flush end came out at 0.78 — comfortably
  over a 0.55 threshold, and entirely imaginary.
- **Colour buffers are LINEAR, the hex you wrote is sRGB.** `new THREE.Color(hex)`
  converts on construction, so a test that compares a colour attribute against
  the raw hex components reports nonsense — cream came back as "amber" for a
  whole round of checking. Build the reference through `THREE.Color` too.
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
- **The road hangs in the air at 61 of its 953 cross-sections, and that is the
  terrain rules agreeing to disagree.** `sampleRoad` takes the HIGHEST ground
  across the ribbon's width so a quad cannot slice into a terrace; the ground
  beside the route settles on the LOWEST road height nearby so a plateau
  boundary cannot cut the road at a corner. Both are load-bearing. Where they
  differ the ribbon stands a full plateau proud of the grass — 28 sections
  floating on BOTH sides, worst 2.34 units — and from above it reads as a brown
  slab hanging in the sky. `createRoadSkirt` fills it. **Do not "fix" it by
  changing either height rule**; that is how the green wedge and the sliced
  discs come back.
- **The ribbon's boundary is its two sides AND the transverse edge at each run's
  ends.** The first skirt sewed up only the sides, which left four run ends open
  — including the two beside w1-05, the biggest gap on the island at 2.34 units,
  and the one that came straight back as "ahí aún hay un techo". A run is padded
  half a road's width past each end, so at a corner that pad sticks out into open
  air and its end face is a hole you look into. Sides: 89 of 89 covered. Ends: 4
  floating, 4 capped. Both numbers are the check.
- **The skirt is coloured as TERRAIN, not as road.** One flat brown wall turned
  the floating slab into a slab on a plinth. Painted in the local biome's `band`
  over `rock` — the same stack every terrace uses — it stops being a wall and
  reads as the ground coming up to meet the road. It is therefore the one part
  of the road that changes colour per biome.
- **A node disc stands on the ROAD, and the road is not at ground height.**
  `sampleRoad` takes the HIGHEST of five samples across the ribbon's width so a
  quad crossing a terrace does not slice through it, so beside a step the road
  rides up to 2 units above the terrain under its own centre line. A disc placed
  from a single `groundHeightAt()` sank under it and the ribbon was drawn over
  the node. On-path discs use `roadTopAt() + ROAD_SURFACE_LIFT + DISC_CLEARANCE`;
  off-path bonus nodes keep the plain ground lift.
- **Clearance is not only geometry.** The road carries `polygonOffset -4/-8`
  against the terrain, and that bias also pulls it in front of anything just
  above it — 0.18 of a unit vanished at a grazing angle. Discs and rims carry a
  STRONGER bias (`-6/-12`) so they always win against the road they stand on.
- **Nothing may stand above a session disc.** On a switchback the cell beside a
  node belongs to a different run of the route, one plateau higher, and its
  column leans over the circle. `terrain.js` keeps a registry of clearings —
  `clearGroundAround()` — that clamps the ground within four units of each
  on-path node to that node's own shelf, downward only. **Register them before
  building the island mesh**: the mesh is sampled from `groundHeightAt`, so a
  pad registered afterwards moves the placement logic and leaves the geometry
  untouched. `validate` registers the same ones and asserts the invariant.

**Villagers, and anything else that walks off the road**

- **A dynamic `import()` in the console is a SECOND copy of the module, and
  `terrain.js`'s clearing registry is module state.** The copy's registry is
  EMPTY, so `groundHeightAt` reports the unclamped ground — every pad looks like
  it has a two-unit lump leaning over it, which is precisely the bug
  `clearGroundAround` exists to fix. Three rounds of measurement in one session
  said the villagers were walking through terrain; they never were. When probing
  terrain from the console, call
  `clearGroundAround(nodeClearings(allLevels))` on the copy FIRST, or compare
  against Node instead.
- **The road's surface is its CENTRE LINE height, at every point across its
  width.** `nodes.js` gives both edges of every ribbon quad the same `top`, so a
  figure standing at the road's edge belongs at the centre-line height —
  `terrain.js`'s `roadTopAt` evaluated at the figure's own off-centre position is
  a different and wrong number. Read it off `buildGrandPath()`, which is the
  polyline the avatar already walks.
- **Never smooth a finished walk height.** Averaging the heights around a
  villager's loop to soften a terrace step also averages the ramp where the loop
  climbs onto the road, and the road rides up to 2.44 units above the ground
  beside it: it sank a villager 1.37 units INTO the ribbon at one session and
  floated it half a unit over it at another. Sample the ground and blend the road
  on top; do not smooth the sum.
- **Terrain sampling has a price list, and page load pays it.** `groundHeightAt`
  is 37 microseconds (it scans every road polyline), `roadTopAt` is 190 because
  it is five of those. Sampling `roadTopAt` 144 times per villager put a full
  SECOND of blocked main thread in front of the map. Count the calls before
  adding anything that samples terrain per object.
- **The flat pad is four units wide but only guaranteed to 3.4.** Pads overlap,
  `groundHeightAt` returns the FIRST clearing containing a point, so a
  neighbour's pad one plateau higher can win. `validate` asserts nothing rises
  within 1.6, 2.2, 2.8, 3 and 3.4 of every on-path node — widen `RING` in
  `villagers.js` and those radii have to follow.
- **Castles have no room beside them.** Villagers placed at a boss node were
  swallowed by the building, with only the edge of a name plate showing past the
  wall. So `/admin` offers 26 of the 28 main-path sessions — every one except the
  two castles. That list exists THREE times: the picker in `admin.js`,
  `VILLAGER_SESSIONS` in `main.js`, and the roster check in `validate.mjs`. They
  have to agree, and the picker is the one that matters: offering a castle there
  lets the teacher save a roster that FAILS THE BUILD, which takes the site down
  until someone edits the file by hand. It shipped that way for one deploy.

**The teacher's writes (the GitHub Contents API)**

- **Every API GET must be `cache: 'no-store'` AND cache-busted.** The Contents
  API answers with `Cache-Control: public, max-age=60, s-maxage=60`, so a plain
  `fetch` reads the file's sha out of the browser cache — the sha from before
  the last press wrote a commit — and the PUT comes back
  `409 <path> does not match <sha>`. "Completar y avanzar" followed by
  "Retroceder" reproduced it every time, and the teacher saw GitHub's own
  English sentence about a hash. `no-store` handles the browser; the `_` stamp
  handles the shared cache in front of the API. `public/progress.json` is
  fetched by the map with the same pair of precautions.
- **A 409 is retried once against a freshly read sha**, because GitHub's own
  read-after-write is eventually consistent. Safe here only because both files
  are whole documents written from state the caller is holding, not patches
  applied to whatever happens to be there. Do not copy the retry onto anything
  that merges.
- **`explain()` wins over GitHub's `message`** for statuses we know. The raw
  message for a sha clash names a hash and nothing else.
- **The legend's Profesor block carries the only link to /admin**, and it has to
  keep carrying it. With the marker controls on the map, a teacher who already
  has a token has no way of discovering that page — and the roster of honoured
  students lives there. That was reported as "no recuerdo cómo entrar como
  administrador" one round after the roster shipped.

**The opening flight**

- **It blends toward the RIG's live pose, it does not animate to a remembered
  one.** Every frame the hook runs after `rig.update`, so the camera already
  holds this frame's resting pose; the intro lerps from a sky pose toward that.
  At t = 1 it is writing the rig's own numbers back, so the hand-over cannot
  mismatch and there is nothing to cut. Measured across the last frames: 0.125
  units of camera travel, then 0. Keep it that way — an intro that animates to a
  pose captured at load will drift the moment anything about the rig changes.
- **The camera opens LEVEL, not looking down.** The first cut opened 290 units
  up looking at the island, and from there the whole cloud band is below the
  camera against the sea: a voxel cloud seen from above is a white slab floating
  on the water. Level, the island is 60 degrees below a 40-degree frame and the
  shot is sky. The island is revealed by the TILT, which is what Marc asked for.
- **The clouds are UNLIT.** The scene's ambient is a HemisphereLight whose
  ground colour is `world.terrainEdge`, dark green — good for cubes standing on
  grass, wrong two hundred units up. Lit, they came out grey with a green rim
  along every underside and read as rock. They are also seen from below for half
  the flight, which is the side lighting leaves darkest.
- **Position and aim are eased separately.** One easing for both gives one long
  slide: front-loaded travel threw the title out of frame before it could be
  read, and a single spread-out tilt left the island hidden until the last
  second with an empty middle. Travel is ease-in-out with a slow linear creep
  under it; the aim holds the opening framing to t = 0.28 and lands at 0.86.
- **The title plate ignores depth.** Clouds are scattered from a hash and one
  will sometimes park itself between the camera and the title on the opening
  frame — the one frame that has to read.
- **The clouds do not survive the intro.** The overview camera pulls back a
  couple of hundred units and looks almost straight down, so a permanent cloud
  layer would put a lid on the one shot meant to show the whole map.

**Locking the sessions ahead**

- **`statusFor` is the only place the rule lives, and `safeTitle` is the only
  place a title is masked.** Nine surfaces print a level's name — map, course
  list, tooltip, avatar plate, portal, level card, VR card, screen reader,
  shared link — and a lock that is enforced in eight of them is not a lock.
- **`selectLevel` is the single gate.** Disc tap, course-list row, arrow key, VR
  controller ray and deep link all pass through it, so the guard sits there once
  rather than at each door. The two that do NOT pass through it are the load-time
  `?level=` read and `onRouteChange` (Back/Forward restoring an older URL); both
  carry their own check for exactly that reason.
- **Locked is silent otherwise, so say something.** A tap on a grey disc that
  does nothing reads as a broken button; it raises the tooltip at the last
  pointer position for a couple of seconds instead.
- **Optional nodes inherit the lock from their anchor**, or an "Actitud" hanging
  off session 9 gives away session 9. `validate` guarantees the anchor is a
  main-path level, which is what stops `statusFor` recursing.
- **`lockAhead` absent means OFF.** A course already running with everything
  visible must not have half of it vanish because a new field shipped.

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

**Layout** — every one of these was found on a phone, none on a desktop

- **Size from the WIDTH. Never `h-full`.** The portal is one scrolling page, so
  its height is auto and `100%` of it is nothing. This broke three separate
  things in three consecutive rounds: the Marp viewer, then the Canva iframe,
  then the contents lists. Anything that needs a box uses `aspect-video`
  (16/9 content) or an explicit `h-[Nvh]` (a PDF page is portrait), capped by
  `max-w-[121vh]` so it never grows taller than the screen.
- **`place-items: center` does not centre an item that OVERFLOWS.** The browser
  falls back to start alignment to avoid losing content. A 1280 px slide in a
  914 px stage therefore sat at `left: 0`, and scaling from its centre pushed it
  183 px right and off the edge — while working perfectly on a desktop, where
  nothing overflows. Pin at `0,0` and scale from `0,0`: the arithmetic is then
  the same at every width.
- **Marp scopes its whole compiled theme as `div.marpit > section`.** The build
  step emits bare `<section>` elements, so the viewer MUST wrap them in a
  `.marpit` parent or not one rule applies — the slide falls back to black text
  on the near-black plate and reads as a blank panel. It shipped that way and
  went unnoticed for four rounds because the deck was only ever verified as
  data: slide counts and class names, never looked at.
- **Strip the Marp front-matter before the prose renderer.** The exercise files
  are decks now; `marked` has no idea the YAML block is metadata and drew it as
  a rule plus a paragraph, so every exercise opened with a literal
  `marp: true theme: xr-island paginate: true`.

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

**Anything driven by the render loop**

- **`setAnimationLoop` gives ZERO callbacks in a hidden tab** — measured, not
  "throttled to 1 fps". So anything whose ENDING depends on a frame arriving
  must also carry a wall-clock `setTimeout`, because timers do fire in the
  background. The curtain in `ui/hud.js` has had that guard since round one; the
  opening flight shipped without it and left a background tab showing an
  invisible UI under a full-screen catcher until it was focused. Learned twice.

**Tooling**

- `scripts/validate.mjs` runs under **Node**, so anything it imports must not pull
  in `levels.json` through a plain import — Node needs `with { type: 'json' }`.
  Keep level data out of `paths.js` and `terrain.js`.
- **A long-lived `npm run dev` leaks badly.** After hours of hot reloads it was
  at 10.5 GB with 3 GB free on the machine, and the symptom was not an error:
  page loads stalled, Chrome said "la página no responde", the browser
  extension dropped its connection and a background task was killed — then the
  server died outright. It looked exactly like a code bug, and correlated with
  plugging in a headset only because Quest Link's own footprint was what tipped
  the machine over. **Check `Get-Process node` memory before believing a hang
  is yours.** A restart takes 2.5 s.
- **A window Chrome opened normally runs rAF at full speed, so anything that
  plays once on load is over before a tool call can look at it.** The opening
  flight had to be examined by calling `app.stop()` and replaying a fresh
  `createIntro` frame by frame through `rig.update` + `intro.update` + `render`.
  `__step` drives the after-camera hook (`app.tickAfterCamera`) for the same
  reason — without it the flight is unobservable in the embedded pane too.
- In the in-app browser pane `document.hidden` is `true`, so `requestAnimationFrame`
  is throttled to about 1 fps. Drive the loop with `window.__step(frames)` when
  testing; a walk that "never finishes" is usually just this. **The same window
  never runs the rendering steps, so NO `ResizeObserver` fires in it either** —
  not even a fresh one made for the test. Anything that reacts to a size change
  is unobservable there; measure it by re-rendering at the new size instead.
- **Backticks inside a template literal end it.** Writing a CSS or HTML comment
  with `` `place-items` `` inside a `` ` `` string is a parse error several lines
  later, and the message points at the wrong place. This cost time three times
  in one round. Grep for backticks in generated markup before building.
- Debug globals (`__app`, `__map`, `__player`, `__villagers`, `__selectLevel`,
  `__setOverview`, `__step`) exist in **dev only**. They are absent on Pages, by
  design — which is why anything that has to be checked on the deployed site is
  checked through the DOM and the scene graph instead.

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
