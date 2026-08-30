import * as THREE from 'three'
import { worlds, CAMERA_FOV, parallax, WORLD_CAMERA_HALF_SPAN } from '../config/worlds.js'
import { prefersReducedMotion } from '../lib/motion.js'

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

export function createCameraRig() {
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.5, 500)

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

  let aspect = 16 / 9
  let seeded = false
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

    // Overview eases between following the character and framing everything.
    const o = easeInOutCubic(overview ? overviewT : 1 - overviewT)
    const scale = followFit() + (overviewFit() - followFit()) * o
    activeScale = scale
    const centre = focus.clone().lerp(overviewCentre, o)

    basePos.copy(centre).add(offset.clone().multiplyScalar(scale))
    baseTarget.set(centre.x, centre.y + lookY, centre.z)

    // Horizontal only: vertical drift fights the raised, near-overhead angle.
    if (prefersReducedMotion()) driftTarget.set(0, 0)
    else driftTarget.set(pointer.x * parallax.maxOffset, 0)
    drift.lerp(driftTarget, parallax.damping)

    const forward = baseTarget.clone().sub(basePos).normalize()
    const right = forward.clone().cross(THREE.Object3D.DEFAULT_UP).normalize()

    camera.position.copy(basePos).addScaledVector(right, drift.x)
    camera.lookAt(baseTarget)
  }

  return {
    camera,
    follow,
    setAspect,
    update,
    toggleOverview,
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
