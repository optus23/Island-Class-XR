# XR Island — handoff

State as of **6 September 2026**.

`CLAUDE.md` holds the durable rules and the traps — **read it first**. This file
is the shorter question: where things stand right now, what has never been
looked at, and what is waiting on Marc.

---

## Where things stand

Everything is merged and live: <https://optus23.github.io/Island-Class-XR/>

| | |
| --- | --- |
| `main` | `e980b7e` — merge of PR #25 |
| `develop` | same content |
| Last deploy | run `33991251554`, success |
| Working tree | clean |
| VR | live on every page; `/vr` and `?vr=1` arm the XR context eagerly |

**Check the build id before believing any bug report.** The legend's bottom line
reads `build <sha>`. A phone holding a cached `index.html` loads the previous
hashed bundle, which is still on Pages and still works — so a shipped fix and a
stale page look identical. That cost a full round; do not repeat it.

---

## What is actually verified

Seen working in a browser, on the deployed site:

- The map, the level portal, the teacher controls in the legend.
- **The Marp deck viewer** — renders with its full theme, at desktop width and
  at a 441 px stage. It was black for four rounds and nobody had looked at it.
- **The Ejercicios tab** opens on the title, not on the Marp front-matter.
- **Session discs sit clear of the terrain**; `w1-03` photographed on a clean pad.
- **The portal scrolls as one page** — measured at a simulated 880x390 landscape:
  919 px of content in a 390 px window, header scrolling away, back button
  staying put.

Seen working on a real Quest 3, over Link, by Marc:

- Entering VR, stereo rendering ("funciona a la perfección"), the water shader,
  controller rays selecting nodes, left-stick panning.

---

## What has NEVER been looked at

Be honest about this list rather than assuming it works.

- **The VR level card** (`src/three/vrPanel.js`). Built, deployed, never
  rendered — not in a headset, not in a browser. If it looks wrong, the first
  suspects are `PANEL_W/PANEL_H` and the `+0.42` vertical offset, both eyeballed,
  and whether the Fredoka webfont had loaded when the canvas was painted.
- **Gaze input** for phones in a Cardboard holder (reticle + 1.4 s dwell).
- **Rotation about the viewer's own axis** in VR — the fourth attempt at making
  turning comfortable; the previous three were all rejected as nauseating.
- **The desktop mirror** while presenting.
- **The PDF slide branch.** No level uses a PDF today; every deck is Marp or a
  Canva embed, so the `h-[78vh] min-h-[24rem]` box there is untested.
- **Entering a level from inside the headset**, and VR performance under load.

---

## Open, and waiting on Marc

- **Four decisions from the exercise brief** are deliberately unresolved: flagged
  in `_fixme` on the relevant nodes, printed by every `npm run validate`, and
  written up in [`docs/decisiones-abiertas.md`](docs/decisiones-abiertas.md).
  Do not fill any of them in with a plausible guess.
- **The block-1 starter repository does not exist yet.** `starterRepo.url` is
  `null` and the portal says "pendiente de publicar". Creating it is one repo
  plus a one-line edit in three nodes —
  [`docs/repo-ejercicios-bloque1.md`](docs/repo-ejercicios-bloque1.md).
- **Content.** 8 of 32 exercise files are Marp decks; the rest are placeholders.
  Five levels have real Canva embeds, ten have a `slidesLink` to a shortlink that
  cannot be embedded. `public/content/slides/` is still placeholder PDFs.
- **In-VR slides** were explicitly out of scope. The pipeline allows it —
  `build-decks.mjs` emits each slide as `{ html, classes }`, and `vrPanel.js`
  already paints to a canvas — but laying out real slide markup by hand on a
  canvas is a genuine piece of work, not a hookup.

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
units of sinking, +2.0 of overhang, `914px · x0.714`. The bad ones started with a
plausible story. `?debug=1` puts the deck's own measurements on screen for
exactly this reason.

---

## Quick start

```bash
cd C:/DATA/02_WORK/05_TeacherCITM/XRIsland/Island-Class-XR
npm install
npm run dev        # predev compiles the Marp decks into public/decks/
npm run validate   # data + map sanity; also runs inside npm run build
```

`.env` holds `GH_TOKEN`, gitignored — it is what `gh` and `git push` use. Never
print it, never copy it into a remote URL or `.git/config`.

**To try VR on the Quest**: open `https://optus23.github.io/Island-Class-XR/vr`
in the headset browser — nothing to forward, no tunnel. For unshipped work,
`npm run dev` plus `adb reverse tcp:5173 tcp:5173` and
`http://localhost:5173/?vr=1`. `adb` is not on PATH; it lives under Unity's
`.../PlaybackEngines/AndroidPlayer/SDK/platform-tools/`, and the forward dies
whenever the cable is touched or the headset sleeps.

**Restart the dev server between long sessions.** It leaks — 10.5 GB after a few
hours — and the symptoms look exactly like a code bug. See `CLAUDE.md`.
