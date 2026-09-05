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

**A. The deployed site (simplest, and now the normal way).** VR is on `main`
and live. In the Quest browser, open:

```
https://optus23.github.io/Island-Class-XR/vr
```

That is the whole procedure — nothing to forward, nothing to tunnel, no dev
server. Everything below is only for testing an unshipped change.

**B. A tunnel from your machine** (needed only for unmerged work):

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

**One of the two doors is required — `/vr/` or `?vr=1`.** Without one the page
never touches `navigator.xr`,
never builds an XR-compatible context and never sets `renderer.xr.enabled`.
That gate exists because the map hung the moment Quest Link started, with
nobody having asked for VR: an `xrCompatible` context can be migrated to
another GPU when an XR device appears, and every migration is a lost context
that three answers by rebuilding ~14k instanced voxels, the shore texture and
every shader. The plain map has no business carrying that risk.

The two doors are equivalent: `/vr/` is a third Vite entry carrying
`data-xr="1"` on `<html>`, and it loads the same `main` chunk as `/`. It exists
because a URL you can type into a headset beats a query string. `?vr=1` still
works on any page and is what a deep link should use.

Either way: a button reading **«Entrar en VR»** appears at the bottom centre
**only** with XR armed, and only if the browser reports `immersive-vr` support. If you do not see it,
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
| Right thumbstick ← → | **Turn: the model swings around YOUR vertical axis** |
| Right thumbstick ↑ ↓ | Zoom (0.4×–3.2×) |
| **Grip (either hand)** | **Re-centre the model in front of you** |

The ray turns **green** over a node and stays gold otherwise.

**Stereo only. Do not add a mono mode back.** One existed for two rounds and
was deleted at the user's request: stereo was reported as working perfectly,
while every attempt at forcing both eyes onto a single view left the right eye
facing the wrong way and the image distorting on head movement. Two versions
were tried — lerping eye positions with `updateMatrixWorld()`, then copying
eye 0's four matrices onto eye 1 — and both failed. `renderer.xr.cameraAutoUpdate`
is back at its default; three's own per-eye handling is the thing that works.

**The monitor mirrors the headset** while presenting, every third frame.
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

**Working on a real Quest 3, over Link, in desktop Chrome:**

- entering VR (after the `xrCompatible` fix below)
- **stereo rendering** — reported as perfect
- the **water shader**, once its shore lookup stopped going through world space
- **controller rays**: pointing at a node and selecting it
- **left thumbstick** panning, in the direction you are looking

**Fixed but NOT yet re-tested by the user:**

- rotation about the viewer's own axis (three earlier attempts were all judged
  uncomfortable; this is the fourth)
- the desktop mirror (it was switched off by default during a hang hunt, which
  is why the monitor was still showing flat sky; it is back on)

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
