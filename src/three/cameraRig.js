import * as THREE from 'three'
import { worlds, CAMERA_FOV, parallax, WORLD_CAMERA_HALF_SPAN } from '../config/worlds.js'
import { prefersReducedMotion } from '../lib/motion.js'
import { groundHeightAt } from './terrain.js'

/**
 * Bounded per-world follow camera.
 *
 * Inside a world the camera tracks the avatar horizontally, but it is CLAMPED
 * to that world's band. Walk toward the next world and the camera pins at the
 * boundary while the character keeps going toward the edge of frame — the
 * classic side-scroller feel. Only when the avatar actually crosses does the
 * camera hand over to the next world's preset and pan across.
 *
 * The angle is a per-world preset, eased on crossing rather than blended
 * continuously, so each world keeps a distinct look instead of smearing
 * between them.
 *
 * Still never a free camera: no orbit, no user zoom. The only zoom is the
 * overview toggle, which frames all three worlds at once and returns to the
 * character when switched off.
 */

const FIT_WIDTH = 46 // tighter than before: the character is the focal point
const FIT_HEIGHT = 34
const MAX_FIT_SCALE = 3.5
const FOLLOW_DAMPING = 0.09 // fraction closed per 1/60s
const CROSSING_SECONDS = 0.85 // pan when moving between worlds
const OVERVIEW_SECONDS = 0.7

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)

// Viewer-controlled nudge around the preset. Deliberately tight: this is a
// look-around, not a free camera, so the world can never be viewed from an
// angle the art was not built for.
// The overview looks almost straight down — a classic Mario paper map.
const TOP_DOWN_OFFSET = [0, 96, 26]

// Wider than before. The old clamp was so tight that dragging felt like the
// camera was stuck, which is what made the map read as a flat rectangle: the
// viewer never got a second angle on it. Still bounded — the art has no back
// side, so the camera may never swing behind the island.
const ORBIT_YAW_MAX = 0.95 // ~54 degrees either way
const ORBIT_PITCH_MAX = 0.46 // ~26 degrees
/**
 * Closest the viewer may pull in. Was 0.55, which on a phone left the map
 * further away than anyone wanted. Going closer is only safe because `near` is
 * now derived from the actual camera distance and the camera is kept above the
 * ground — see update(). Without those two, zooming in either clipped the
 * terrain open or buried the camera inside a hill.
 */
const ZOOM_MIN = 0.34
// Deliberately modest. Pulling right back defeats the point of a Mario
// overworld - the whole island should be a reveal, not the default view - and
// the overview button is the sanctioned way to see all three worlds at once.
const ZOOM_MAX = 1.5

/**
 * Where the zoom starts.
 *
 * Below 1 so the map opens CLOSER than the fit-everything framing: the point
 * of a Mario overworld is that the next level is a discovery, not something
 * you can read off the horizon on the first frame.
 */
const ZOOM_DEFAULT = 0.9

/**
 * Smallest horizontal fraction of the camera offset — how far off straight
 * down the camera is always kept. sin(8 degrees) is about 0.14.
 */
const MIN_HORIZONTAL = 0.14

/** Units of air kept between the camera and the ground under it. */
const GROUND_CLEARANCE = 6
/** `near` as a fraction of the camera's distance to what it is looking at. */
const NEAR_RATIO = 0.18

export function createCameraRig() {
  // near is deliberately far out. Nothing is ever closer than the camera's own
  // stand-off distance, and a near plane of 0.5 spent almost the entire depth
  // buffer on empty space in front of the island — which is what let the road
  // and the terrain trade pixels wherever they nearly touched.
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 12, 500)

  const ordered = [...worlds].sort((a, b) => a.center[0] - b.center[0])
  const byId = new Map(ordered.map((w) => [w.id, w]))

  // Where the camera is actually looking, and where it wants to look.
  const focus = new THREE.Vector3(...ordered[0].center)
  const desired = focus.clone()

  // Angle blend: eased from the previous world's preset to the current one.
  let angleFrom = ordered[0]
  let angleTo = ordered[0]
  let angleT = 1
  let angleDuration = CROSSING_SECONDS

  let activeWorld = ordered[0]
  let overview = false
  let overviewT = 1

  const drift = new THREE.Vector2()
  const driftTarget = new THREE.Vector2()
  const basePos = new THREE.Vector3()
  const baseTarget = new THREE.Vector3()
  const offA = new THREE.Vector3()
  const offB = new THREE.Vector3()
  const flatForward = new THREE.Vector3()
  const pitchAxis = new THREE.Vector3()
  const topDown = new THREE.Vector3()

  let aspect = 16 / 9
  let seeded = false
  let orbitYaw = 0
  let orbitPitch = 0
  let zoomMul = ZOOM_DEFAULT
  // The scale actually in use this frame, including the overview blend. Fog
  // reads this: using the follow scale alone whited-out the whole island the
  // moment the overview pulled the camera further back than fogFar.
  let activeScale = 1

  const maxSpan = Math.max(
    ...worlds.map((w) => {
      const ys = w.path.controlPoints.map((p) => p[1])
      return Math.max(...ys) - Math.min(...ys)
    })
  )

  function fitScale(width, height) {
    const spread = 2 * Math.tan((CAMERA_FOV * Math.PI) / 180 / 2)
    const needed = Math.max(width / (spread * aspect), height / spread)
    const base = Math.hypot(...ordered[0].camera.offset) || 1
    return Math.min(MAX_FIT_SCALE, Math.max(1, needed / base))
  }

  const followFit = () => fitScale(FIT_WIDTH, FIT_HEIGHT + maxSpan * 0.55)

  /** Everything, framed at once — the overview toggle. */
  function overviewFit() {
    const span = ordered[ordered.length - 1].center[0] - ordered[0].center[0]
    return fitScale(span + FIT_WIDTH * 1.6, FIT_HEIGHT + maxSpan)
  }

  function worldForX(x) {
    let best = ordered[0]
    for (const w of ordered) {
      if (Math.abs(x - w.center[0]) < Math.abs(x - best.center[0])) best = w
    }
    return best
  }

  /**
   * The camera's allowed X band for a world. Following stops here; the avatar
   * carries on toward the frame edge on its own.
   */
  function clampToWorld(world, x) {
    return clamp(x, world.center[0] - WORLD_CAMERA_HALF_SPAN, world.center[0] + WORLD_CAMERA_HALF_SPAN)
  }

  /** Point the camera should centre on. Called every frame with the avatar. */
  function follow(position, { instant = false } = {}) {
    const crossed = worldForX(position.x)
    if (crossed !== activeWorld) {
      // Only NOW does the camera move on — not while merely approaching.
      angleFrom = angleT >= 1 ? activeWorld : angleTo
      angleTo = crossed
      angleT = instant || prefersReducedMotion() ? 1 : 0
      angleDuration = CROSSING_SECONDS
      activeWorld = crossed
    }

    desired.set(clampToWorld(activeWorld, position.x), position.y, position.z)

    if (instant || !seeded || prefersReducedMotion()) {
      focus.copy(desired)
      angleT = 1
      angleFrom = angleTo = activeWorld
      seeded = true
    }
  }

  function setAspect(next) {
    if (Number.isFinite(next) && next > 0) aspect = next
  }

  /** @returns {boolean} the new state */
  function toggleOverview(force) {
    const next = force ?? !overview
    if (next === overview) return overview
    overview = next
    overviewT = prefersReducedMotion() ? 1 : 0
    return overview
  }

  const overviewCentre = new THREE.Vector3(
    (ordered[0].center[0] + ordered[ordered.length - 1].center[0]) / 2,
    0,
    ordered[0].center[2]
  )

  function update(dt, pointer = { x: 0, y: 0 }) {
    const k = prefersReducedMotion() ? 1 : 1 - Math.pow(1 - FOLLOW_DAMPING, dt * 60)
    focus.lerp(desired, k)

    if (angleT < 1) angleT = Math.min(1, angleT + dt / angleDuration)
    if (overviewT < 1) overviewT = Math.min(1, overviewT + dt / OVERVIEW_SECONDS)

    // Per-world preset, eased across a crossing.
    const t = easeInOutCubic(angleT)
    offA.set(...angleFrom.camera.offset)
    offB.set(...angleTo.camera.offset)
    const offset = offA.lerp(offB, t)
    const lookY = angleFrom.camera.lookHeight + (angleTo.camera.lookHeight - angleFrom.camera.lookHeight) * t

    // Overview eases between following the character and framing everything,
    // AND swings the angle to near-vertical so it reads as a map rather than a
    // pulled-back version of the same shot.
    const o = easeInOutCubic(overview ? overviewT : 1 - overviewT)
    const scale = followFit() + (overviewFit() - followFit()) * o
    activeScale = scale
    const centre = focus.clone().lerp(overviewCentre, o)

    topDown.set(...TOP_DOWN_OFFSET)
    offset.lerp(topDown, o)

    // Apply the viewer's clamped orbit and zoom on top of the preset.
    const shaped = offset.clone()
    if (orbitYaw !== 0) shaped.applyAxisAngle(THREE.Object3D.DEFAULT_UP, orbitYaw)
    if (orbitPitch !== 0) {
      pitchAxis.set(shaped.z, 0, -shaped.x)
      if (pitchAxis.lengthSq() > 1e-6) shaped.applyAxisAngle(pitchAxis.normalize(), orbitPitch)
    }

    // Never let the view direction reach vertical.
    //
    // lookAt() has no defined roll when forward is parallel to up: on the far
    // side of straight-down it picks the opposite one, so the whole island
    // snapped through 180 degrees between one frame and the next. The overview
    // angle is only ~15 degrees off vertical and the pitch nudge is 26, so
    // tilting up in the overview walked straight into it.
    //
    // Keeping a floor under the offset's horizontal component holds the camera
    // a few degrees short of the pole, where lookAt stays continuous.
    const minHoriz = shaped.length() * MIN_HORIZONTAL
    const horiz = Math.hypot(shaped.x, shaped.z)
    if (horiz < minHoriz) {
      if (horiz < 1e-4) shaped.z = minHoriz
      else {
        const k = minHoriz / horiz
        shaped.x *= k
        shaped.z *= k
      }
    }

    // The overview is a fixed framing of the whole island, so the viewer's own
    // zoom has to fade out as it takes over — otherwise a zoomed-in map opened
    // the overview already cropped, with a world missing off the side.
    const userZoom = zoomMul + (1 - zoomMul) * o
    basePos.copy(centre).add(shaped.multiplyScalar(scale * userZoom))
    baseTarget.set(centre.x, centre.y + lookY, centre.z)

    // Never let the camera sink into the island. Pulling in shortens the offset
    // toward a focus point that sits ON the ground, so past a certain zoom the
    // camera enters a hill and you see straight through the terrain.
    const floor = groundHeightAt(basePos.x, basePos.z) + GROUND_CLEARANCE
    if (basePos.y < floor) basePos.y = floor

    // `near` follows the distance instead of being fixed at 12.
    //
    // 12 was picked for a camera standing ~90 units out, where a near of 0.5
    // spent the whole depth buffer on empty space. Zoomed in, that same 12
    // starts slicing the foreground open. Keeping it a constant FRACTION of the
    // distance preserves exactly what that number was protecting — the far/near
    // ratio — at every zoom level.
    const dist = basePos.distanceTo(baseTarget)
    const near = clamp(dist * NEAR_RATIO, 1.5, 12)
    if (Math.abs(near - camera.near) > 0.25) {
      camera.near = near
      camera.updateProjectionMatrix()
    }

    // Horizontal only: vertical drift fights the raised, near-overhead angle.
    if (prefersReducedMotion()) driftTarget.set(0, 0)
    else driftTarget.set(pointer.x * parallax.maxOffset, 0)
    drift.lerp(driftTarget, parallax.damping)

    // Right vector from the FLATTENED view direction. Deriving it from the raw
    // forward vector degenerates as the camera approaches straight-down —
    // forward becomes parallel to up, the cross product collapses toward zero,
    // and normalising the remainder sent the mouse drift off diagonally
    // instead of straight left-right.
    const forward = baseTarget.clone().sub(basePos)
    flatForward.set(forward.x, 0, forward.z)
    if (flatForward.lengthSq() < 1e-6) flatForward.set(0, 0, 1)
    flatForward.normalize()
    const right = flatForward.clone().cross(THREE.Object3D.DEFAULT_UP).normalize()

    camera.position.copy(basePos).addScaledVector(right, drift.x)
    camera.lookAt(baseTarget)
  }

  return {
    camera,
    follow,
    setAspect,
    update,
    toggleOverview,
    /** Drag to look around, within a tight clamp. Never a free camera. */
    orbit(dx, dy) {
      // Unity's Alt + left-drag orbit, which is the reference the user gave.
      //
      // THE CAMERA MOVES OPPOSITE THE POINTER, on both axes. It feels like
      // grabbing the island and turning it: drag left, the camera swings right
      // and the island follows your hand; drag down and you end up looking at
      // it from above. Both signs are therefore negative — if one of them is
      // ever positive again, that axis is inverted.
      //
      // Verified in the running scene, not derived on paper: drag right used to
      // move the camera +24 units along its own right vector, which is Unity
      // backwards. The vertical was already correct and is untouched.
      orbitYaw = clamp(orbitYaw - dx * 0.006, -ORBIT_YAW_MAX, ORBIT_YAW_MAX)
      orbitPitch = clamp(orbitPitch - dy * 0.005, -ORBIT_PITCH_MAX, ORBIT_PITCH_MAX)
    },
    /** Wheel zoom, also clamped. */
    zoom(delta) {
      zoomMul = clamp(zoomMul * (1 + delta * 0.0012), ZOOM_MIN, ZOOM_MAX)
    },
    /**
     * Pinch zoom. Takes a RATIO rather than a delta, because that is what a
     * pinch actually measures: fingers twice as far apart means twice as
     * close, at any speed and from any starting spread.
     */
    zoomBy(ratio) {
      if (!Number.isFinite(ratio) || ratio <= 0) return
      zoomMul = clamp(zoomMul / ratio, ZOOM_MIN, ZOOM_MAX)
    },
    /** Back to the world's own preset. */
    resetView() {
      orbitYaw = 0
      orbitPitch = 0
      zoomMul = ZOOM_DEFAULT
    },
    get isNudged() {
      return orbitYaw !== 0 || orbitPitch !== 0 || zoomMul !== ZOOM_DEFAULT
    },
    get isOverview() {
      return overview
    },
    get currentWorldId() {
      return activeWorld.id
    },
    /** True while the camera is pinned and the character is walking off-centre. */
    get isPinned() {
      return Math.abs(desired.x - focus.x) < 0.5 && desired.x !== focus.x
    },
    get focusX() {
      return focus.x
    },
    /** Scale in use this frame, overview blend included — what fog must follow. */
    get fitScale() {
      return activeScale
    },
    worldById: byId,
    get tilt() {
      const n = parallax.maxOffset || 1
      return { x: 0, y: (drift.x / n) * parallax.maxTilt }
    },
  }
}
