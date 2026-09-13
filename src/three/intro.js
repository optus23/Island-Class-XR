import * as THREE from 'three'
import { createClouds } from './clouds.js'
import { course } from '../lib/levels.js'
import { prefersReducedMotion } from '../lib/motion.js'

/**
 * The opening flight: sky, clouds, the title, and a fall onto the island.
 *
 * Marc's reference is the Simpsons title sequence — a blue sky full of cloud,
 * the camera pushing through it to the title, and then down into the world. The
 * difference asked for is the ending: instead of entering through a letter, the
 * camera tilts down off the title and settles exactly where the map's own
 * camera already sits.
 *
 * IT IS NOT A SEPARATE SHOT, AND THAT IS THE WHOLE TRICK
 * There is no cut, no second camera and no fake framing to match up at the end.
 * The rig runs normally from the first frame and the intro simply blends the
 * camera from a pose high in the sky toward wherever the rig has put it THIS
 * frame — so as the blend closes, the two become the same camera and the
 * hand-over is not an event. It cannot mismatch, because there is nothing to
 * match: at t = 1 we are writing the rig's own numbers back.
 *
 * That also means the start pose is derived on the first frame rather than
 * declared: the rig has not written a camera position until then, and the
 * whole shot is defined relative to where it lands.
 *
 * WHEN IT DOES NOT PLAY
 *   - reduced motion: this is four and a half seconds of camera movement and it
 *     is exactly what that setting is asking us not to do
 *   - a shared `?level=` link: whoever followed it came for that level
 *   - `?vr=1` and `/vr/`: someone with a headset on is not here for a flypast
 * The caller decides those; this module only owns the flight.
 */

const SECONDS = 4.8

/**
 * WHERE THE SHOT STARTS, AND WHY IT IS FLAT.
 *
 * The first attempt opened 290 units up and looked DOWN at the island, on the
 * reasoning that the flight ends looking down so it should start that way. It
 * was wrong on screen: from up there the cloud band is entirely below the
 * camera, seen against the sea, and a voxel cloud viewed from directly above is
 * a white slab floating on the water. Nothing about it read as sky.
 *
 * So the camera opens looking almost LEVEL. The island is then some sixty
 * degrees below the view axis and completely out of a 40-degree frame, which
 * leaves exactly what the reference opens on: blue sky, cloud, and the title.
 * The island is not revealed by moving toward it, it is revealed by the tilt.
 */
const START_LIFT = 248
const START_BACK = 168
/** Ahead of the opening camera, and a touch below it — that is what keeps it level. */
const TITLE_AHEAD = 150
const TITLE_DROP = 10

const TITLE_W = 105 // world units
const CANVAS_W = 1024
const CANVAS_H = 260
const TITLE_H = (TITLE_W * CANVAS_H) / CANVAS_W

const FONT = 'Fredoka, ui-rounded, "Segoe UI", system-ui, sans-serif'

/** Skipping is a fast-forward, not a cut — a hard jump is the thing to avoid. */
const SKIP_SECONDS = 0.42

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)

/**
 * Position and aim are eased SEPARATELY, and that is what gives the shot its
 * three beats instead of one long slide.
 *
 * Travel is mostly an ease-in-out with a slow linear creep mixed under it. The
 * creep matters: a pure ease-in opens on a camera that is not moving at all,
 * and a pure ease-out drops 130 units in the first second — which is what the
 * first cut did, and it threw the title out of the top of the frame before
 * anyone could read it. Now the opening is a slow push through drifting cloud,
 * the dive happens in the middle, and the landing decelerates.
 *
 * The aim holds the opening framing for the first quarter, so the title is READ
 * before anything starts turning, and only then swings down onto the island.
 * That hold is the "y luego la cámara enfoca hacia abajo".
 */
const easeTravel = (t) => 0.12 * t + 0.88 * easeInOutCubic(t)
const AIM_HOLD = 0.28
/**
 * The tilt FINISHES before the travel does, and that is deliberate. Spread over
 * the whole flight it is still only a fifth of the way down at the halfway
 * point, so the island stays hidden until the last moment and the middle of the
 * shot is empty sky. Landing the aim at 0.86 leaves the closing beat as a pure
 * push in on a framing that is already correct.
 */
const AIM_LANDS = 0.86
const easeAim = (t) => easeInOutCubic(clamp01((t - AIM_HOLD) / (AIM_LANDS - AIM_HOLD)))
/** 0 outside [a, b], 1 inside, smooth at both ends. */
const ramp = (v, a, b) => clamp01((v - a) / (b - a))

function paintTitle(ctx) {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  // The island's own chrome: a hard black edge and a bright rim, so the plate
  // belongs to the same world as the panels it is about to reveal.
  const title = course.title
  ctx.font = `700 132px ${FONT}`
  ctx.lineJoin = 'round'
  ctx.lineWidth = 26
  ctx.strokeStyle = '#0b0e13'
  ctx.strokeText(title, CANVAS_W / 2, 108)
  ctx.lineWidth = 11
  ctx.strokeStyle = '#f2c14e' // palette.nodeRim — the gold the level tiles use
  ctx.strokeText(title, CANVAS_W / 2, 108)
  ctx.fillStyle = '#fdfbf5'
  ctx.fillText(title, CANVAS_W / 2, 108)

  // `tagline`, not `subtitle`. The nav panel's subtitle is the full official
  // mouthful — "Realidad Virtual y Realidad Aumentada · Entornos de Realidad
  // Virtual" — which says "realidad" three times and reads as filler at title
  // size over a whole screen. The tagline is the short form, and it exists for
  // exactly this one surface.
  const tagline = course.tagline ?? course.subtitle
  let size = 46
  ctx.font = `500 ${size}px ${FONT}`
  while (size > 20 && ctx.measureText(tagline).width > CANVAS_W - 90) {
    size -= 2
    ctx.font = `500 ${size}px ${FONT}`
  }
  ctx.lineWidth = 9
  ctx.strokeStyle = 'rgba(11,14,19,0.85)'
  ctx.strokeText(tagline, CANVAS_W / 2, 206)
  ctx.fillStyle = '#eaf4ff'
  ctx.fillText(tagline, CANVAS_W / 2, 206)
}

/**
 * @param {{camera: THREE.Camera, scene: THREE.Scene, avatar: THREE.Vector3}} deps
 *   `avatar` is where the character is standing when the page opens — the
 *   title hangs above it and the clouds are scattered along the way down.
 */
export function createIntro({ camera, scene, avatar }) {
  const group = new THREE.Group()
  group.name = 'intro'
  scene.add(group)

  const clouds = createClouds({ seed: Math.abs(avatar.x) + 1 })
  group.add(clouds.group)

  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_W
  canvas.height = CANVAS_H
  const ctx = canvas.getContext('2d')
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.generateMipmaps = false
  texture.minFilter = THREE.LinearFilter
  texture.anisotropy = 4

  const repaint = () => {
    paintTitle(ctx)
    texture.needsUpdate = true
  }
  repaint()
  // Fredoka arrives over the network and the first frame of the intro is the
  // one moment on the whole site where a fallback face would be unmissable.
  document.fonts?.ready?.then(repaint)

  const title = new THREE.Mesh(
    new THREE.PlaneGeometry(TITLE_W, TITLE_H),
    // Drawn over everything, not depth-sorted against the sky. The clouds are
    // scattered from a hash and one of them WILL sometimes park itself between
    // the camera and the title on the opening frame — which is the one frame
    // that has to read. A title card is chrome; it belongs on top.
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    })
  )
  title.name = 'intro-title'
  title.renderOrder = 20
  title.frustumCulled = false
  group.add(title)

  /**
   * Shrink the title until it fits the frame it is actually being shown in.
   *
   * The plate is a fixed 105 units wide hanging TITLE_AHEAD in front of the
   * camera, which fits a 16:9 desktop with room to spare — and is more than
   * TWICE the visible width of a phone held upright. At 40° of vertical fov
   * and 150 units out the frame is ~109 units tall, so a 390x844 screen sees
   * about 50 units across it: the title ran off both edges, which is what
   * "se ve cortado" was.
   *
   * Scaled, not moved. Pulling the camera back would fit it too, but the
   * opening framing is tuned to the degree — level camera, island 60° below
   * a 40° frame, cloud band in the top of the shot — and moving the camera
   * moves all of it. Re-fitted every frame so rotating the phone mid-flight
   * is handled by the same line; it costs two multiplications.
   */
  const fitTitle = () => {
    const visibleH = 2 * TITLE_AHEAD * Math.tan((camera.fov * Math.PI) / 360)
    const visibleW = visibleH * camera.aspect
    title.scale.setScalar(Math.min(1, (visibleW * 0.86) / TITLE_W))
  }
  fitTitle()

  const startPos = new THREE.Vector3()
  const startQuat = new THREE.Quaternion()
  const rigPos = new THREE.Vector3()
  const rigQuat = new THREE.Quaternion()
  const look = new THREE.Matrix4()
  const up = new THREE.Vector3(0, 1, 0)
  const ahead = new THREE.Vector3()

  let armed = false
  let t = 0
  let skipping = false
  let done = false

  /**
   * BELT AND BRACES: A TAB THAT NEVER GETS A FRAME MUST NOT BE LEFT BROKEN.
   *
   * `setAnimationLoop` does not fire at all in a hidden tab — measured, zero
   * callbacks in three seconds — so a page opened in a background tab has an
   * opening flight that cannot advance. It holds `#ui` at opacity 0 and a
   * full-screen catcher over the map, and both are only cleared when the flight
   * ENDS. The page then looks broken until it is brought forward.
   *
   * A wall-clock timer finishes it regardless. `setTimeout` is throttled in a
   * background tab but it does fire, unlike rAF. Once the flight is over the
   * camera is simply the rig's, so a tab that wakes up later gets the ordinary
   * map rather than a frozen sky.
   *
   * The curtain in `ui/hud.js` carries the same guard for the same reason —
   * "a curtain that outlives the page it hides is worse than no curtain".
   */
  const failsafe = setTimeout(finish, (SECONDS + 4) * 1000)

  /** A pane over everything, so a tap skips the flight instead of picking a node. */
  const catcher = document.createElement('button')
  catcher.type = 'button'
  catcher.className = 'intro-catch'
  catcher.setAttribute('aria-label', 'Saltar la introducción')
  catcher.addEventListener('pointerdown', skip)
  document.body.appendChild(catcher)
  // Capture, and swallowed: the map's own keyboard handler walks the avatar
  // between sessions, and an arrow key pressed during the flight would both
  // skip it AND move the character somewhere nobody asked for. Modifier
  // combinations are left alone — Ctrl+R is not a request to skip.
  window.addEventListener('keydown', onKey, true)

  function onKey(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    e.stopPropagation()
    skip()
  }

  function skip() {
    if (done || skipping) return
    skipping = true
  }

  function finish() {
    if (done) return
    done = true
    clearTimeout(failsafe)
    window.removeEventListener('keydown', onKey, true)
    catcher.remove()
    scene.remove(group)
    clouds.dispose()
    title.geometry.dispose()
    title.material.dispose()
    texture.dispose()
    // Hand the screen over: `is-revealing` is what carries the 700ms fade, so
    // the panels rise as the camera settles rather than snapping on.
    const ui = document.getElementById('ui')
    if (ui) {
      ui.classList.add('is-revealing')
      ui.classList.remove('is-intro')
    }
  }

  /**
   * Called once per frame AFTER the rig has written the camera, so the camera
   * currently holds this frame's resting pose. Returns false when the flight is
   * over and the caller should stop calling.
   */
  function update(dt) {
    if (done) return false

    rigPos.copy(camera.position)
    rigQuat.copy(camera.quaternion)

    if (!armed) {
      armed = true
      startPos.set(rigPos.x, rigPos.y + START_LIFT, rigPos.z + START_BACK)

      // Everything else is placed FROM the opening camera rather than from the
      // island, so the framing is identical in all three worlds and at every
      // fit scale — the rig's offset and distance differ per world, and a shot
      // composed against the island would drift with them.
      ahead.set(avatar.x - startPos.x, 0, avatar.z - startPos.z)
      if (ahead.lengthSq() < 1e-6) ahead.set(0, 0, -1)
      ahead.normalize()

      title.position
        .copy(startPos)
        .addScaledVector(ahead, TITLE_AHEAD)
        .setY(startPos.y - TITLE_DROP)
      look.lookAt(startPos, title.position, up)
      startQuat.setFromRotationMatrix(look)

      // Park the cloud field on the flight path, straddling the way down.
      clouds.group.position.set(
        startPos.x + ahead.x * 70,
        startPos.y - 30,
        startPos.z + ahead.z * 70
      )
    }

    // Skipping accelerates the same curve rather than cutting to the end: the
    // camera keeps moving, it just arrives sooner.
    t += dt / (skipping ? SKIP_SECONDS : SECONDS)
    if (skipping) t = Math.max(t, 1 - (1 - t) * 0.86)
    const p = clamp01(t)
    const e = easeTravel(p)

    camera.position.lerpVectors(startPos, rigPos, e)
    camera.quaternion.slerpQuaternions(startQuat, rigQuat, easeAim(p))

    fitTitle()
    clouds.update(dt)
    // The cloud band and the title both belong to the top of the shot. They go
    // as the camera drops out of the sky, so the island is never seen through
    // them from below, where a voxel cloud is just a white slab.
    // Both belong to the top of the shot and both are gone before the landing:
    // from below, a voxel cloud is a white slab and the title would be a poster
    // hanging over the island.
    clouds.setOpacity(1 - ramp(p, 0.62, 0.9))
    title.material.opacity = 1 - ramp(p, 0.4, 0.62)
    title.quaternion.copy(camera.quaternion) // face the camera all the way down

    if (t >= 1) {
      finish()
      return false
    }
    return true
  }

  return { update, skip, finish, get running() { return !done } }
}

/** Whether the flight should play at all. The caller owns the reasons. */
export function introWanted({ deepLinked = false, xrEager = false } = {}) {
  // A `?lang=` in the address bar means we have just come back from the
  // language picker, which reloads the page (see lib/i18n/index.js). That is
  // a re-entry, not a first visit: sitting through the flight again every
  // time you try a language is exactly the kind of thing that makes someone
  // stop trying them.
  let switchedLanguage = false
  try {
    switchedLanguage = new URLSearchParams(location.search).has('lang')
  } catch {
    /* no URL access — treat it as a normal visit */
  }
  return !deepLinked && !xrEager && !switchedLanguage && !prefersReducedMotion()
}
