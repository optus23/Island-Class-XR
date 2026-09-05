# WebXR immersive mode — experimental branch

**Branch:** `webxr-vr-mode` · **Not merged, and not to be merged without Marc
saying so.** `develop` and `main` are untouched by any of this.

Scope for this phase: **looking around and navigating the map**. Opening a level
ends the immersive session and hands over to the ordinary 2D portal — nothing
renders slides inside the headset.

---

## How to try it on a Quest 3

WebXR needs a secure context, so `localhost` over the network is not enough.
Two ways:

**A. The deployed site (simplest).** The branch is not deployed — Pages only
publishes `main` — so this needs a temporary deploy or a tunnel. Easiest is a
tunnel from your machine:

```bash
git checkout webxr-vr-mode
npm ci && npm run build
npx serve dist            # or: npm run preview -- --host
# then expose it over https, e.g.
npx localtunnel --port 4173
```

Open the `https://…` URL in the Quest's browser.

**B. Over USB with port forwarding.** Quest developer mode on, headset plugged
in, then on the machine:

```bash
npm run dev -- --host
adb reverse tcp:5173 tcp:5173
```

Open `http://localhost:5173/?vr=1` **in the Quest browser** — `localhost`
counts as a secure origin, so this needs no certificate.

**`?vr=1` is required.** Without it the page never touches `navigator.xr`,
never builds an XR-compatible context and never sets `renderer.xr.enabled`.
That gate exists because the map hung the moment Quest Link started, with
nobody having asked for VR: an `xrCompatible` context can be migrated to
another GPU when an XR device appears, and every migration is a lost context
that three answers by rebuilding ~14k instanced voxels, the shore texture and
every shader. The plain map has no business carrying that risk.

Either way: a button reading **«Entrar en VR»** appears at the bottom centre
**only** on `?vr=1` and only if the browser reports `immersive-vr` support. If you do not see it,
the browser said no — nothing else on the page changes.

---

## What it does

**The island is a tabletop diorama, not a world you stand in.** The whole
`worldGroup` is scaled to about 3 m across and parked at table height 1.5 m in
front of you. That is a deliberate design decision, not a shortcut:

> The desktop camera has `near = 12`, chosen because a near plane of 0.5 at ~90
> units out spent almost the whole depth buffer on empty space — that is what
> made the road and terrain trade pixels (see `CLAUDE.md`). Standing inside the
> map at 1 unit = 1 m would force `near ≈ 0.1` across a 180 m field and walk
> straight back into that hole. At diorama scale the depth range is a couple of
> metres, `near = 0.1` is free, and a map you can lean over reads better than
> one you are a giant on.

| Input | Does |
| --- | --- |
| Head | Look around, stereo, 6DoF — walk around the model |
| Point + trigger | Ray at a node → **select**, and the avatar walks there |
| Trigger on the node you are on | **Enter** → ends the session, opens the 2D portal |
| Left thumbstick | Pan the model, **in the direction you are looking** |
| Right thumbstick ← → | Rotate the model about its own centre |
| Right thumbstick ↑ ↓ | Zoom (0.4×–3.2×) |
| **Grip (either hand)** | **Re-centre the model in front of you** |

The ray turns **green** over a node and stays gold otherwise.

**Mono is the default**, and it is a straight on/off — the button beside
*Entrar en VR* toggles Mono / Estéreo. Mono copies eye 0's view and projection
onto the other eye, so both see exactly the same image. There is no half
setting: halving the eye separation properly means rebuilding each eye's
asymmetric frustum, and the first attempt at a partial version — lerping eye
positions and calling `updateMatrixWorld()` — produced two eyes with
inconsistent view matrices that looked like cameras facing different ways.

**The monitor mirrors the headset** while presenting, on alternate frames.
Without it the desktop shows only the clear colour, which is why it looked
like flat sky. The mirror viewport must be the whole DRAWING BUFFER, not the
CSS box: entering XR resizes the buffer to the headset's framebuffer, so
viewporting by CSS pixels painted a corner of it that the canvas then stretched
across the page.

The **model** moves, not the viewer — pushing a standing person around by
thumbstick is the reliable way to make them sick, and reaching over and spinning
a table map is what you would actually do.

Fog and the mouse-parallax tilt are **off** while presenting. Both are framing
tricks for a fixed 2D camera; in a headset the first reads as haze at arm's
length and the second as the world lurching when you move your head.

---

## What is NOT done

- **No slides in the headset.** Out of scope this phase, by instruction. The
  pipeline was built to allow it later: `scripts/build-decks.mjs` emits each
  slide as `{ html, classes }` data, and `src/ui/deck.js` is the only file that
  assumes a DOM. An in-world panel would be a sibling of that file.
- **No hand tracking.** `hand-tracking` is requested as an optional feature, but
  nothing consumes the joint data. Controllers only.
- **No teleport locomotion.** Not needed at diorama scale, where panning the
  model is the navigation.
- **No AR / passthrough mode.** `immersive-vr` only.
- **The 2D map's own `Entrar` affordances are unreachable while presenting** —
  by design, the trigger is the way in.

---

## Fixed on first contact: `InvalidStateError` on entering VR

First real run (Quest Link + desktop Chrome) failed with `InvalidStateError`,
a pause, Chrome reloading, and no VR. The chain:

1. `WebGLRenderer` builds its context attributes from a **fixed list** —
   `alpha, depth, stencil, antialias, premultipliedAlpha, preserveDrawingBuffer,
   powerPreference, failIfMajorPerformanceCaveat`. **`xrCompatible` is not in
   it**, so passing it to the constructor does nothing.
2. So three's `setSession()` reaches
   `if (attributes.xrCompatible !== true) await gl.makeXRCompatible()`.
3. On any machine where the headset is on a different GPU than the one Chrome
   picked — every Link setup with two adapters — that migrates the context to
   the other adapter and **the WebGL context is lost**.
4. Three then calls `new XRWebGLBinding(session, gl)` on the dead context, which
   throws `InvalidStateError`. Chrome restores the context seconds later with no
   session attached.

The fix is to create the context **by hand** with `xrCompatible: true` and hand
it to `WebGLRenderer` via `{ canvas, context }`, so the adapter is right from
the first frame and `makeXRCompatible()` is never called. See `three/scene.js`.

Two things were wrong on our side as well, and are fixed:

- `renderer.xr.setSession()` was awaited **outside** the try/catch, so its
  rejection was unhandled: the button kept saying "Entrar en VR" and the only
  trace was a console line. Both halves are now in one try, a failure detaches
  cleanly, and the reason is printed on screen under the button.
- `'layers'` was dropped from `optionalFeatures`. Three chooses the
  projection-layer path from feature detection, not from that list, so asking
  for it bought nothing and was one more thing that could be refused.

---

## Honest status: what has and has not been run

**Verified on a real Quest 3, over Link, in desktop Chrome:** the button appears
(so `isSessionSupported('immersive-vr')` is true) and pressing it requests a
session. That is as far as it got before `InvalidStateError`, which is now
fixed but **not yet re-tested**.

**Still unverified:** everything past session start — stereo rendering, the
diorama framing, the controller rays, the thumbstick locomotion, and entering a
level from inside the headset.

Treat the first headset run as a bring-up, not a demo. In particular:

1. **The 2D map changed too.** The render loop moved from
   `requestAnimationFrame` to `renderer.setAnimationLoop`, which is required —
   rAF is never called while presenting. Three falls back to rAF outside a
   session, so desktop behaviour *should* be identical, but it is a change to
   the shared path and has not been watched in a browser. **This alone is
   reason enough not to merge yet.**
2. **Thumbstick axes are a guess.** Quest controllers usually report the stick
   on axes 2/3, with 0/1 the trackpad slot; the code reads 2/3 and falls back to
   0/1. If a stick does nothing, log `gamepad.axes` first.
3. **`DIORAMA_SCALE` and `DIORAMA_AT` are eyeballed** (`src/three/vr.js`). The
   model may land too big, too small or clipping the floor. They are two
   constants at the top of the file.
4. **Water and terrain shaders were written for a 1-unit-per-unit world.**
   Scaling the group should be fine, but the animated sea in particular has not
   been looked at in stereo.
5. **Performance is unmeasured in stereo.** The desktop scene is ~27 draw calls
   and ~700k triangles; stereo roughly doubles the per-frame cost and the Quest
   3 has to hold 72–90 Hz. Watch the castles especially — they are individual
   meshes rather than instanced, and push draw calls to ~77 when in frame.

---

## Files

| | |
| --- | --- |
| `src/three/vr.js` | All of it: dolly, controllers, rays, locomotion, session |
| `src/three/scene.js` | `renderer.xr.enabled`, `setAnimationLoop`, the presenting branch |
| `src/main.js` | Wiring; `enterLevel` ends the session before any portal opens |
| `src/style.css` | `.vr-button` |
