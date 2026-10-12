import * as THREE from 'three'
import { hash2 } from './terrain.js'
import { prefersReducedMotion } from '../lib/motion.js'
import { seasonFlags } from '../config/seasons.js'

/**
 * Bats, circling over the island. Halloween only — "murciélagos por ahí
 * flotando".
 *
 * They are the one piece of Halloween dressing that is NOT on the ground, and
 * that is the whole job: the monsters replace what walked the road, and these
 * fill the air above it, which was empty in every season (the intro's clouds
 * are gone by the time the map is playable — see `three/clouds.js`).
 *
 * Decoration, like the creatures and the villagers: never clickable, never on
 * a disc, never carrying course meaning.
 *
 * ONE InstancedMesh, three boxes each — body and two wings — with the matrices
 * rewritten per frame. Fourteen bats is 42 instances: one upload and one draw
 * call, which is the same budget the patrolling creatures already run on.
 * They are deliberately not lit by anything of their own.
 */

const BODY = 0x1a141f
const WING = 0x241b2c

/** Boxes per bat. Fixed, for the same reason the walkers' recipes are. */
const BOXES = 3

/** How far the flock spreads, measured from the island's own centre line. */
const SPREAD_X = 150
const SPREAD_Z = 70

/** Height band above the terrain. Well over the trees, well under the camera. */
const LOW = 16
const HIGH = 34

export function createBats(count = seasonFlags.bats) {
  const group = new THREE.Group()
  if (!count) return { group, update() {} }

  const bats = []
  for (let i = 0; i < count; i++) {
    bats.push({
      // Each bat owns a lazy ellipse. Different radii and periods per bat, or
      // fourteen of them sweep the sky in formation like a flock of geese —
      // bats should look like they are each busy with something else.
      cx: (hash2(i * 3.1, i * 1.7) - 0.5) * 2 * SPREAD_X,
      cz: (hash2(i * 2.3, i * 5.9) - 0.5) * 2 * SPREAD_Z,
      rx: 10 + hash2(i * 4.7, i * 0.9) * 22,
      rz: 8 + hash2(i * 1.1, i * 6.3) * 16,
      y: LOW + hash2(i * 7.7, i * 2.1) * (HIGH - LOW),
      speed: 0.22 + hash2(i * 0.3, i * 3.3) * 0.33,
      phase: hash2(i * 5.5, i * 4.1) * Math.PI * 2,
      // The wing beat, which is faster than the orbit and unrelated to it.
      flap: 7 + hash2(i * 8.1, i * 1.3) * 5,
      scale: 0.8 + hash2(i * 2.7, i * 7.1) * 0.6,
      bobAmp: 0.6 + hash2(i * 6.1, i * 3.7) * 1.4,
    })
  }

  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshLambertMaterial(),
    bats.length * BOXES
  )
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  // They leave the camera's frustum constantly as they orbit; culling the
  // whole mesh on one bat's bounding sphere would blink the flock in and out.
  mesh.frustumCulled = false

  const col = new THREE.Color()
  for (let i = 0; i < bats.length; i++) {
    mesh.setColorAt(i * BOXES + 0, col.setHex(BODY))
    mesh.setColorAt(i * BOXES + 1, col.setHex(WING))
    mesh.setColorAt(i * BOXES + 2, col.setHex(WING))
  }
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  group.add(mesh)

  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const up = new THREE.Vector3(0, 1, 0)
  const pos = new THREE.Vector3()
  const sv = new THREE.Vector3()
  let t = 0

  function update(dt) {
    // Reduced motion freezes them where they are rather than removing them:
    // the sky still reads as a Halloween sky, it just stops moving. Same
    // choice the creatures and the villagers make.
    const still = prefersReducedMotion()
    if (!still) t += dt

    for (let i = 0; i < bats.length; i++) {
      const b = bats[i]
      const a = b.phase + t * b.speed
      const x = b.cx + Math.cos(a) * b.rx
      const z = b.cz + Math.sin(a) * b.rz
      const y = b.y + Math.sin(t * b.speed * 2.6 + b.phase) * b.bobAmp

      // Face along the tangent of its own ellipse, so a bat always flies
      // nose-first. No easing needed: the orbit is smooth, so the heading
      // never jumps the way a patrol's reversal does.
      const yaw = Math.atan2(-Math.sin(a) * b.rx, Math.cos(a) * b.rz)
      q.setFromAxisAngle(up, yaw)

      // Wings beat together, and the beat is a SCALE on their height plus a
      // small lift — cheaper than rotating each wing about its own hinge, and
      // at this distance indistinguishable from it.
      const beat = still ? 0.3 : Math.sin(t * b.flap + b.phase)
      const wingH = 0.1 + Math.abs(beat) * 0.42
      const wingY = beat * 0.22

      const s = b.scale
      const cos = Math.cos(yaw)
      const sin = Math.sin(yaw)
      const place = (pi, ox, oy, oz, w, h, d) => {
        pos.set(x + (ox * cos - oz * sin) * s, y + oy * s, z + (ox * sin + oz * cos) * s)
        sv.set(w * s, h * s, d * s)
        m.compose(pos, q, sv)
        mesh.setMatrixAt(i * BOXES + pi, m)
      }

      place(0, 0, 0, 0, 0.42, 0.34, 0.72) // body
      place(1, -0.62, wingY, -0.05, 0.85, wingH, 0.5) // wings
      place(2, 0.62, wingY, -0.05, 0.85, wingH, 0.5)
    }
    mesh.instanceMatrix.needsUpdate = true
  }

  update(0)
  return { group, update }
}
