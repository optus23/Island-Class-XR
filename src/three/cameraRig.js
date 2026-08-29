import * as THREE from 'three'
import { worlds, worldById, CAMERA_FOV, parallax } from '../config/worlds.js'

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

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

  function anchorsFor(worldId) {
    const w = worldById.get(worldId) ?? worlds[0]
    const c = new THREE.Vector3(...w.center)
    return {
      pos: c.clone().add(new THREE.Vector3(...w.camera.offset)),
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

  function goToWorld(worldId, { instant = false, seconds = 1.25 } = {}) {
    if (worldId === currentWorldId && transition >= 1) return false
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

    driftTarget.set(pointer.x * parallax.maxOffset, pointer.y * parallax.maxOffset * 0.55)
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
    update,
    get currentWorldId() {
      return currentWorldId
    },
    get isSettled() {
      return transition >= 1
    },
    /** Parallax tilt for the world group — subtle, never free rotation. */
    get tilt() {
      return { x: -drift.y * parallax.maxTilt, y: drift.x * parallax.maxTilt }
    },
  }
}
