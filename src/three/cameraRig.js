import * as THREE from 'three'
import { worlds, worldById, CAMERA_FOV, parallax } from '../config/worlds.js'
import { prefersReducedMotion } from '../lib/motion.js'

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

/**
 * How much of a world must stay visible, in world units. A world footprint is
 * 52 x 44; these are the projected extents that keep it comfortably framed.
 */
const FIT_WIDTH = 68
const FIT_HEIGHT = 48 // for a flat world; each world's own climb is added on top
/** Beyond this the island is a speck; better to crop a little than zoom to nothing. */
const MAX_FIT_SCALE = 3.5

/**
 * One camera, three fixed positions. Never free-look, never orbit.
 * Moving between worlds eases position+target together, which reads as the
 * world sliding past — the Mario World overworld pan.
 */
export function createCameraRig(startWorldId = 1) {
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.5, 400)

  const basePos = new THREE.Vector3()
  const baseTarget = new THREE.Vector3()
  const fromPos = new THREE.Vector3()
  const fromTarget = new THREE.Vector3()
  const toPos = new THREE.Vector3()
  const toTarget = new THREE.Vector3()

  // Damped parallax state, in camera-local right/up units.
  const drift = new THREE.Vector2()
  const driftTarget = new THREE.Vector2()

  let currentWorldId = startWorldId
  let transition = 1 // 1 = settled
  let duration = 1.25

  let aspect = 16 / 9

  /**
   * How far to push this world's camera OUT so the world still fits the
   * viewport. A phone in portrait has an aspect near 0.46, which narrows the
   * horizontal field so hard that only a corner of the world is visible.
   *
   * This only ever scales the offset's LENGTH — the direction, and therefore
   * the world's fixed viewing angle, is untouched. There are still exactly
   * three camera positions and still no free camera.
   */
  /** How much a world climbs, so a taller world is framed from further back. */
  function heightSpan(w) {
    const ys = w.path.controlPoints.map((p) => p[1])
    return Math.max(...ys) - Math.min(...ys)
  }

  function fitScaleFor(w) {
    const spread = 2 * Math.tan((CAMERA_FOV * Math.PI) / 180 / 2)
    // A world that climbs 16 units needs more vertical room than a flat one,
    // or its summit is cropped straight off the top of the frame.
    const needHeight = FIT_HEIGHT + heightSpan(w) * 1.15
    const needed = Math.max(FIT_WIDTH / (spread * aspect), needHeight / spread)
    const base = Math.hypot(...w.camera.offset) || 1
    return Math.min(MAX_FIT_SCALE, Math.max(1, needed / base))
  }

  function anchorsFor(worldId) {
    const w = worldById.get(worldId) ?? worlds[0]
    const c = new THREE.Vector3(...w.center)
    const offset = new THREE.Vector3(...w.camera.offset).multiplyScalar(fitScaleFor(w))
    return {
      pos: c.clone().add(offset),
      target: c.clone().add(new THREE.Vector3(...w.camera.target)),
    }
  }

  // Seed at the starting world.
  {
    const a = anchorsFor(currentWorldId)
    basePos.copy(a.pos)
    baseTarget.copy(a.target)
    fromPos.copy(a.pos)
    fromTarget.copy(a.target)
    toPos.copy(a.pos)
    toTarget.copy(a.target)
    camera.position.copy(a.pos)
    camera.lookAt(a.target)
  }

  /**
   * Called on every resize. Re-frames in place: a resize is already a visual
   * discontinuity, so easing to the new framing would just look like drift.
   * An in-flight world transition keeps easing — only its destination moves.
   */
  function setAspect(nextAspect) {
    if (!Number.isFinite(nextAspect) || nextAspect <= 0) return
    if (Math.abs(nextAspect - aspect) < 1e-4) return
    aspect = nextAspect

    const a = anchorsFor(currentWorldId)
    toPos.copy(a.pos)
    toTarget.copy(a.target)
    if (transition >= 1) {
      basePos.copy(a.pos)
      baseTarget.copy(a.target)
    }
  }

  function goToWorld(worldId, { instant = false, seconds = 1.25 } = {}) {
    if (worldId === currentWorldId && transition >= 1) return false
    if (prefersReducedMotion()) instant = true
    const a = anchorsFor(worldId)
    fromPos.copy(basePos)
    fromTarget.copy(baseTarget)
    toPos.copy(a.pos)
    toTarget.copy(a.target)
    currentWorldId = worldId
    duration = Math.max(0.001, seconds)
    transition = instant ? 1 : 0
    if (instant) {
      basePos.copy(toPos)
      baseTarget.copy(toTarget)
    }
    return true
  }

  /**
   * @param {number} dt seconds
   * @param {{x:number,y:number}} pointer normalised -1..1, {0,0} when idle
   */
  function update(dt, pointer = { x: 0, y: 0 }) {
    if (transition < 1) {
      transition = Math.min(1, transition + dt / duration)
      const e = easeInOutCubic(transition)
      basePos.lerpVectors(fromPos, toPos, e)
      baseTarget.lerpVectors(fromTarget, toTarget, e)
    }

    if (prefersReducedMotion()) driftTarget.set(0, 0)
    else driftTarget.set(pointer.x * parallax.maxOffset, pointer.y * parallax.maxOffset * 0.55)
    drift.lerp(driftTarget, parallax.damping)

    // Drift sideways in screen space, so the parallax reads the same from all
    // three fixed angles without ever rotating the camera off its rail.
    const forward = baseTarget.clone().sub(basePos).normalize()
    const right = forward.clone().cross(THREE.Object3D.DEFAULT_UP).normalize()
    const up = right.clone().cross(forward).normalize()

    camera.position
      .copy(basePos)
      .addScaledVector(right, drift.x)
      .addScaledVector(up, drift.y)
    camera.lookAt(baseTarget)
  }

  return {
    camera,
    goToWorld,
    setAspect,
    update,
    get currentWorldId() {
      return currentWorldId
    },
    get isSettled() {
      return transition >= 1
    },
    /** Current framing multiplier, so distance-based effects (fog) can follow. */
    get fitScale() {
      return fitScaleFor(worldById.get(currentWorldId) ?? worlds[0])
    },
    /**
     * Parallax tilt for the world group — subtle, never free rotation.
     * drift is in world units, so it is normalised back to -1..1 first; that
     * keeps `parallax.maxTilt` meaning what it says (radians at full pointer
     * deflection) instead of silently scaling with maxOffset.
     */
    get tilt() {
      const n = parallax.maxOffset || 1
      return { x: (-drift.y / n) * parallax.maxTilt, y: (drift.x / n) * parallax.maxTilt }
    },
  }
}
