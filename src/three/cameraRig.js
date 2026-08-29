import * as THREE from 'three'
import { worlds, CAMERA_FOV, parallax } from '../config/worlds.js'
import { prefersReducedMotion } from '../lib/motion.js'

/**
 * A follow camera over one continuous island.
 *
 * This used to snap between three fixed anchors, which forced the worlds to sit
 * as three separate blocks with padding between them to justify the cuts. Now
 * the camera tracks a focus point (the avatar) and its VIEWING ANGLE blends
 * between the three per-world angles according to where that focus sits on X.
 *
 * The three perspectives survive — isometric from the left over world 1,
 * frontal over world 2, isometric from the right over world 3 — but they
 * arrive as a continuous drift rather than a cut, so the island can be one
 * unbroken landmass. It is still never a free camera: the viewer cannot orbit
 * or zoom, only the focus moves.
 */

const FIT_WIDTH = 62
const FIT_HEIGHT = 46
const MAX_FIT_SCALE = 3.5
const FOLLOW_DAMPING = 0.06 // fraction closed per 1/60s — lower is smoother

const smoothstep = (t) => t * t * (3 - 2 * t)

export function createCameraRig() {
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.5, 400)

  // Worlds left to right; the angle blend walks this list.
  const ordered = [...worlds].sort((a, b) => a.center[0] - b.center[0])

  const focus = new THREE.Vector3(...ordered[0].center)
  const desiredFocus = focus.clone()
  const basePos = new THREE.Vector3()
  const baseTarget = new THREE.Vector3()

  const drift = new THREE.Vector2()
  const driftTarget = new THREE.Vector2()

  const offA = new THREE.Vector3()
  const offB = new THREE.Vector3()

  let aspect = 16 / 9
  let seeded = false

  /** The tallest climb of any world — the camera must clear the worst case. */
  const maxSpan = Math.max(
    ...worlds.map((w) => {
      const ys = w.path.controlPoints.map((p) => p[1])
      return Math.max(...ys) - Math.min(...ys)
    })
  )

  function fitScale() {
    const spread = 2 * Math.tan((CAMERA_FOV * Math.PI) / 180 / 2)
    const needHeight = FIT_HEIGHT + maxSpan * 0.9
    const needed = Math.max(FIT_WIDTH / (spread * aspect), needHeight / spread)
    const base = Math.hypot(...ordered[0].camera.offset) || 1
    return Math.min(MAX_FIT_SCALE, Math.max(1, needed / base))
  }

  /**
   * Camera offset and look-height for a given X, blended across world angles.
   * Only the HEIGHT of each world's configured target is used — its X/Z part
   * would drag the camera off the avatar it is meant to be following.
   */
  function angleAt(x) {
    const first = ordered[0]
    const last = ordered[ordered.length - 1]
    let a = first
    let b = first
    let t = 0

    if (x >= last.center[0]) {
      a = b = last
    } else if (x > first.center[0]) {
      for (let i = 0; i < ordered.length - 1; i++) {
        const lo = ordered[i].center[0]
        const hi = ordered[i + 1].center[0]
        if (x >= lo && x <= hi) {
          a = ordered[i]
          b = ordered[i + 1]
          t = smoothstep((x - lo) / (hi - lo || 1))
          break
        }
      }
    }

    offA.set(...a.camera.offset)
    offB.set(...b.camera.offset)
    const lookY = a.camera.target[1] + (b.camera.target[1] - a.camera.target[1]) * t
    return { offset: offA.lerp(offB, t).multiplyScalar(fitScale()), lookY }
  }

  /** The point the camera centres on. Called every frame with the avatar. */
  function follow(position, { instant = false } = {}) {
    desiredFocus.copy(position)
    if (instant || !seeded || prefersReducedMotion()) {
      focus.copy(desiredFocus)
      seeded = true
    }
  }

  function setAspect(next) {
    if (Number.isFinite(next) && next > 0) aspect = next
  }

  function update(dt, pointer = { x: 0, y: 0 }) {
    // Frame-rate independent damping, so the follow feels identical at 30fps
    // and 144fps rather than being tied to how often this happens to run.
    const k = prefersReducedMotion() ? 1 : 1 - Math.pow(1 - FOLLOW_DAMPING, dt * 60)
    focus.lerp(desiredFocus, k)

    const { offset, lookY } = angleAt(focus.x)
    basePos.copy(focus).add(offset)
    baseTarget.set(focus.x, focus.y + lookY, focus.z)

    if (prefersReducedMotion()) driftTarget.set(0, 0)
    else driftTarget.set(pointer.x * parallax.maxOffset, pointer.y * parallax.maxOffset * 0.55)
    drift.lerp(driftTarget, parallax.damping)

    // Drift in screen space, so parallax reads the same from every angle
    // without ever rotating the camera off its rail.
    const forward = baseTarget.clone().sub(basePos).normalize()
    const right = forward.clone().cross(THREE.Object3D.DEFAULT_UP).normalize()
    const up = right.clone().cross(forward).normalize()

    camera.position.copy(basePos).addScaledVector(right, drift.x).addScaledVector(up, drift.y)
    camera.lookAt(baseTarget)
  }

  return {
    camera,
    follow,
    setAspect,
    update,
    /** Nearest world to the current focus — used to highlight the nav. */
    get currentWorldId() {
      let best = ordered[0]
      for (const w of ordered) {
        if (Math.abs(focus.x - w.center[0]) < Math.abs(focus.x - best.center[0])) best = w
      }
      return best.id
    },
    get focusX() {
      return focus.x
    },
    get fitScale() {
      return fitScale()
    },
    get tilt() {
      const n = parallax.maxOffset || 1
      return { x: (-drift.y / n) * parallax.maxTilt, y: (drift.x / n) * parallax.maxTilt }
    },
  }
}
