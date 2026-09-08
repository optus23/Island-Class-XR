# XR Island — handoff

State as of **8 September 2026**.

`CLAUDE.md` holds the durable rules and the traps — **read it first**. This file
is the shorter question: where things stand right now, what has never been
looked at, and what is waiting on Marc.

---

## Where things stand

Everything is merged and live: <https://optus23.github.io/Island-Class-XR/>

| | |
| --- | --- |
| Last code change | the road skirt and the background-tab failsafe — anything on `main` after it is documentation |
| `develop` | same content as `main` |
| Working tree | clean |
| Marker | session 1, and **`lockAhead` is ON** — students see one session |
| Roster | 1 student walking the island |
| VR | live on every page; `/vr` and `?vr=1` arm the XR context eagerly |
| Merge-to-main permission | expires **14 September 2026** |

**Check the build id before believing any bug report.** The legend's bottom line
reads `build <sha>`. A phone holding a cached `index.html` loads the previous
hashed bundle, which is still on Pages and still works — so a shipped fix and a
stale page look identical. That cost a full round; do not repeat it.

### The three surfaces the teacher touches

| Where | What it does | Writes |
| --- | --- | --- |
| Legend → **Profesor** (on the map) | Advance / back / reset, and the "hide the sessions ahead" switch | `progress.json` |
| Legend → **Panel de profesor →** | The only link to `/admin` | — |
| `/admin/` | Sign in with the token, and the roster of honoured students | `npcs.json` |

Both files go straight to `main`, so **merge `main` into `develop` before any
round that touches either**. The marker and the roster are the teacher's live
state and must never be rolled back by a merge.

A teacher holding a token is exempt from the lock and sees the whole course.
"Ver el mapa como un alumno" drops that exemption in that browser only.

---

## What is actually verified

Seen working in a browser on the deployed site, or measured in the running scene.
Everything here has a number or a photograph behind it.

**The map and its feedback**

- Session discs sit clear of the terrain; `w1-03` photographed on a clean pad.
- **The road no longer floats.** Before: 89 border edge vertices above the ground
  beneath them, every one by the full 2-plateau gap, worst 2.34, at 61 of 953
  cross-sections. After: all 89 covered by skirt geometry, none missed.
  Photographed at w1-05 and w1-07, and confirmed by toggling the skirt off.
- **The amber trail**, counted rather than eyeballed: 0 amber vertices with no
  marker, 6 of 1838 on session 1, 828 on session 12 of 28, 1834 on the last.
- **The honoured students**, at four sessions, photographed at the follow
  camera's distance and zoomed in. Over 900 frames across every session and all
  three rings: never more than 0.12 off the ground away from the road, never more
  than 0.77 off the road's surface on it. 73 ms to build a full 24-student roster.

**Locking**

- All three states: as a student (28 of 31 locked with the marker on session 2,
  titles masked, discs grey), as the teacher (0 locked), and through "Ver como
  alumno" and back.
- The gate holds against a disc tap, a course-list row, a `?level=` link to a
  locked session (the param is stripped, the map opens at the marker) and a
  direct `__selectLevel` call — while an unlocked level still opens normally.
- A locked castle keeps its dark stone rather than turning the lighter locked
  grey.

**The opening flight**

- Replayed frame by frame and photographed at four points: the title card in the
  clouds, the cloud run, the tilt bringing the island up, the landing. The last
  frames step 0.125 units then 0, and the camera ends on the rig's exact resting
  pose. Skipping lands in 188 ms. A `?level=` link skips it entirely.
- **It survives a background tab.** `setAnimationLoop` gives ZERO callbacks when
  hidden, so the flight could never finish and left the whole UI invisible under
  a click-catcher. Proved fixed in a pane with rAF genuinely dead: zero frames,
  page recovered anyway.

**The teacher's writes**

- Stale-sha recovery, driven against a stubbed API that moves the file under the
  write: every GET goes out `no-store` and cache-busted, a 409 is retried once
  against a fresh sha and succeeds, and a 409 that will not clear reports in
  Spanish rather than GitHub's sentence about a hash.
- **The real `api.github.com` path is exercised by Marc, and it works** — his own
  commits are on `main`: marker moves, `lockAhead` on and off, and one roster
  save. That was the last thing on this list that had only ever been stubbed.

**The 2D layer**

- The Marp deck viewer renders with its full theme, at desktop width and at a
  441 px stage. It was black for four rounds and nobody had looked at it.
- The Ejercicios tab opens on the title, not on the Marp front-matter.
- The portal scrolls as one page — measured at a simulated 880x390 landscape:
  919 px of content in a 390 px window, header scrolling away, back button
  staying put.
- The plate over the avatar dismisses itself, driven with real pointer events:
  tap the map or the course list and it goes, touch the plate and it stays, hover
  the avatar's own node on a desktop and it returns, drag from over that node and
  it does NOT return mid-drag, and with a panel grown over its usual spot it
  drops below the avatar and back.
- The `/admin` roster editor: add, duplicate guard, empty-name guard, remove, and
  one save producing one commit with the right payload and a fresh sha. Nothing
  on the page fits worse than 358 px.

**On a real Quest 3, over Link, by Marc**

- Entering VR, stereo rendering ("funciona a la perfección"), the water shader,
  controller rays selecting nodes, left-stick panning.

---

## What has NEVER been looked at

Be honest about this list rather than assuming it works.

- **Everything added since the VR round, inside a headset.** The villagers' name
  plates, the locked sessions on the VR card, the amber road and the road skirt
  have all shipped without anyone putting the Quest on. The plates are the most
  likely to be wrong: they size themselves against the camera's distance measured
  in the mesh's own space, which is the part that should survive the diorama's
  0.005 scale, but "should" is doing the work. Suspects are `PLATE_PER_UNIT` and
  its `PLATE_MIN_W` / `PLATE_MAX_W` clamps.
- **The VR level card** (`src/three/vrPanel.js`). Built, deployed, never
  rendered — not in a headset, not in a browser. Suspects are `PANEL_W/PANEL_H`
  and the `+0.42` vertical offset, both eyeballed, and whether Fredoka had loaded
  when the canvas was painted.
- **The opening flight in a headset.** It is skipped on `/vr` and `?vr=1` by
  design, but someone entering VR from the plain map has just watched it.
- **Gaze input** for phones in a Cardboard holder (reticle + 1.4 s dwell).
- **Rotation about the viewer's own axis** in VR — the fourth attempt at making
  turning comfortable; the previous three were rejected as nauseating.
- **The desktop mirror** while presenting.
- **The PDF slide branch.** No level uses a PDF today, so the
  `h-[78vh] min-h-[24rem]` box there is untested.
- **Entering a level from inside the headset**, and VR performance under load.
- **A phone.** Every layout claim in this file was measured by simulating a
  narrow viewport on a desktop, never on real hardware — and this project's own
  history says that is not the same thing.

---

## Open, and waiting on Marc

- **Four decisions from the exercise brief** are deliberately unresolved: flagged
  in `_fixme` on the relevant nodes, printed by every `npm run validate`, and
  written up in [`docs/decisiones-abiertas.md`](docs/decisiones-abiertas.md).
  Do not fill any of them in with a plausible guess.
- **The session count disagrees with itself.** `CLAUDE.md` records the calendar
  as 27 sessions at 7 / 9 / 11 per world; `levels.json` holds 28 on the main path
  at 8 / 11 / 9. Only the Whimsical board settles which is right, and nobody has
  re-checked it. Do not reconcile them by editing one to match the other.
- **The block-1 starter repository does not exist yet.** `starterRepo.url` is
  `null` and the portal says "pendiente de publicar". One repo plus a one-line
  edit in three nodes — [`docs/repo-ejercicios-bloque1.md`](docs/repo-ejercicios-bloque1.md).
- **Content.** 8 of 32 exercise files are Marp decks; the rest are placeholders.
  5 levels have real Canva embeds, 10 have a `slidesLink` to a shortlink that
  cannot be embedded. `public/content/slides/` is still placeholder PDFs.
- **In-VR slides** were explicitly out of scope. The pipeline allows it —
  `build-decks.mjs` emits each slide as `{ html, classes }` and `vrPanel.js`
  already paints to a canvas — but laying out real slide markup by hand on a
  canvas is a genuine piece of work, not a hookup.
- **Sharing the template.** [`docs/adaptar-a-tu-asignatura.md`](docs/adaptar-a-tu-asignatura.md)
  is written for another teacher to fork and adapt by hand. Nobody has actually
  followed it end to end, so the first person who does is the test.

---

## The pattern this project keeps repeating

Worth reading before the next round, because it has now cost several.

**A layout that works on a desktop tells you nothing about a phone.** Three
consecutive rounds shipped a fix that was sound in reasoning and wrong on a
390 px screen: a height chain that never resolved, a centred grid that does not
centre an overflowing item, an iframe that lost the box it was sizing against.
Every one of them was invisible at 1569 px wide.

**Verifying data is not verifying a view.** The deck was checked for slide counts
and class names, and shipped black for four rounds. If the deliverable is
something a person looks at, look at it.

**Measure before theorising.** The good rounds all started with a number: 1.82
units of sinking, +2.0 of overhang, `914px · x0.714`, 89 floating vertices. The
bad ones started with a plausible story.

**And then check what you are measuring AGAINST.** The villagers round spent
three passes fixing a two-unit hole in the ground that did not exist: a dynamic
`import()` from the console is a second copy of `terrain.js`, its clearing
registry is empty, and `groundHeightAt` therefore reported the unclamped terrain
every pad exists to hide. Two "fixes" were shipped against that phantom before
the probe itself was tested. The same round, a colour check reported cream as
amber because it compared a linear colour buffer against sRGB hex. **A
measurement is a piece of code and it can be the thing that is broken.**

**The guard you wrote once, write again for the thing you build on top.** The
curtain has had a wall-clock failsafe since round one, with a comment saying
exactly why. The opening flight was built on the same render loop and shipped
without one, and a background tab was left with an invisible UI under a
full-screen catcher. The lesson was already written down; it just was not
carried forward.

---

## Quick start

```bash
cd C:/DATA/02_WORK/05_TeacherCITM/XRIsland/Island-Class-XR
npm install
npm run dev        # predev compiles the Marp decks into public/decks/
npm run validate   # data + map sanity; also runs inside npm run build
```

`.env` holds `GH_TOKEN`, gitignored — it is what `gh` and `git push` use. It is
NOT the token the teacher pastes into `/admin`; that one lives only in a
browser's `localStorage`. Never print either, and never copy one into a remote
URL or `.git/config`.

**To try VR on the Quest**: open `https://optus23.github.io/Island-Class-XR/vr`
in the headset browser — nothing to forward, no tunnel. For unshipped work,
`npm run dev` plus `adb reverse tcp:5173 tcp:5173` and
`http://localhost:5173/?vr=1`. `adb` is not on PATH; it lives under Unity's
`.../PlaybackEngines/AndroidPlayer/SDK/platform-tools/`, and the forward dies
whenever the cable is touched or the headset sleeps.

**Restart the dev server between long sessions.** It leaks — 10.5 GB after a few
hours — and the symptoms look exactly like a code bug. See `CLAUDE.md`.

**Testing the intro is awkward on purpose.** A normally-opened Chrome window runs
the flight to completion before a tool call can look at it; an embedded pane
never runs it at all. Both are covered in `CLAUDE.md` under Tooling.
