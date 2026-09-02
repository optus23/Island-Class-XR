import * as THREE from 'three'
import { hash2 } from './terrain.js'
import { prefersReducedMotion } from '../lib/motion.js'

/**
 * Little creatures that patrol stretches of the road, the way Goombas wander a
 * Mario overworld. Purely decorative — they never block the player, are not
 * clickable, and carry no course meaning.
 *
 * All of them live in ONE InstancedMesh whose matrices are rewritten each
 * frame. A handful of creatures times a handful of parts is a few dozen
 * instances, so animating them costs one buffer upload and one draw call
 * rather than a mesh per limb.
 */

const PARTS = [
  // x, y, z, w, h, d, colour
  [0, 0.62, 0, 1.5, 1.15, 1.35, 0x8b5a2b], // body
  [0, 1.28, 0, 1.85, 0.5, 1.6, 0x6f4420], // cap
  [-0.42, 0.14, 0.12, 0.52, 0.3, 0.66, 0x3a2a1a], // feet
  [0.42, 0.14, 0.12, 0.52, 0.3, 0.66, 0x3a2a1a],
  [-0.3, 0.78, 0.7, 0.32, 0.4, 0.12, 0xf7f3ea], // eyes
  [0.3, 0.78, 0.7, 0.32, 0.4, 0.12, 0xf7f3ea],
  [-0.3, 0.74, 0.78, 0.14, 0.18, 0.08, 0x22272e], // pupils
  [0.3, 0.74, 0.78, 0.14, 0.18, 0.08, 0x22272e],
  [-0.32, 1.0, 0.72, 0.36, 0.12, 0.1, 0x3a2a1a], // brows
  [0.32, 1.0, 0.72, 0.36, 0.12, 0.1, 0x3a2a1a],
]

const SPEED = 2.6 // world units per second
/**
 * Clearance between the road surface and the bottom of the lowest box.
 *
 * The feet parts sit at y = 0.14 with height 0.3, so their underside is at
 * -0.01: a shade BELOW the origin. Anchoring the origin to the road therefore
 * pushed every creature a little into it, and the bob only ever lifted them.
 */
const FOOT_CLEAR = 0.06

/** Index margin a creature keeps from any node it passes. */
const NODE_MARGIN = 7

/**
 * @param {THREE.Vector3[]} path the grand road polyline
 * @param {number} count how many creatures to scatter along it
 * @param {number[]} [nodeIndices] where the level discs sit on that polyline;
 *   creatures patrol the stretches BETWEEN them
 */
export function createEnemies(path, count = 4, nodeIndices = []) {
  const group = new THREE.Group()
  if (path.length < 40) return { group, update() {} }

  // The open stretches of road: everything that is not within NODE_MARGIN of a
  // level. A creature standing on a disc reads as an object dumped on the
  // session rather than as something wandering the road, and it hides the one
  // thing on the map you are meant to click.
  const marks = [...nodeIndices].sort((a, b) => a - b)
  const gaps = []
  let cursor = 0
  for (const m of marks) {
    const lo = cursor
    const hi = m - NODE_MARGIN
    if (hi - lo > 8) gaps.push([lo, hi])
    cursor = Math.max(cursor, m + NODE_MARGIN)
  }
  if (path.length - 1 - cursor > 8) gaps.push([cursor, path.length - 1])
  // No node information (or a road too crowded to leave room): fall back to
  // the whole polyline rather than showing nothing.
  if (!gaps.length) gaps.push([0, path.length - 1])

  // Longest first, so a handful of creatures land on the roomiest stretches
  // rather than bunching into whichever gap came first.
  gaps.sort((a, b) => b[1] - b[0] - (a[1] - a[0]))

  const creatures = []
  for (let i = 0; i < count; i++) {
    const [lo, hi] = gaps[i % gaps.length]
    const span = hi - lo
    const half = Math.min(12 + Math.floor(hash2(i * 3.7, i * 1.9) * 10), Math.floor(span / 2))
    const centre = lo + span / 2
    creatures.push({
      from: Math.max(lo, centre - half),
      to: Math.min(hi, centre + half),
      at: centre,
      dir: hash2(i * 5.1, i * 2.3) > 0.5 ? 1 : -1,
      phase: hash2(i * 1.3, i * 4.7) * Math.PI * 2,
      scale: 0.85 + hash2(i * 2.9, i * 0.7) * 0.3,
    })
  }

  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshLambertMaterial(),
    creatures.length * PARTS.length
  )
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  mesh.frustumCulled = false

  const col = new THREE.Color()
  creatures.forEach((_, ci) => {
    PARTS.forEach((p, pi) => mesh.setColorAt(ci * PARTS.length + pi, col.setHex(p[6])))
  })
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  group.add(mesh)

  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const up = new THREE.Vector3(0, 1, 0)
  const pos = new THREE.Vector3()
  const sv = new THREE.Vector3()
  const offset = new THREE.Vector3()
  let t = 0

  function update(dt) {
    const still = prefersReducedMotion()
    if (!still) t += dt

    creatures.forEach((c, ci) => {
      if (!still) {
        // Index-space travel: the polyline is evenly sampled, so stepping the
        // index is close enough to constant speed without arc-length maths.
        c.at += c.dir * SPEED * dt * 1.6
        if (c.at >= c.to) {
          c.at = c.to
          c.dir = -1
        } else if (c.at <= c.from) {
          c.at = c.from
          c.dir = 1
        }
      }

      const i = Math.max(0, Math.min(path.length - 2, Math.floor(c.at)))
      const frac = c.at - i
      const a = path[i]
      const b = path[i + 1]
      const bob = still ? 0 : Math.abs(Math.sin(t * 5 + c.phase)) * 0.16
      const yaw = Math.atan2(b.x - a.x, b.z - a.z) + (c.dir < 0 ? Math.PI : 0)
      q.setFromAxisAngle(up, yaw)

      const bx = a.x + (b.x - a.x) * frac
      // FOOT_CLEAR lifts the recipe's origin off the road surface. Every part
      // is measured upward from y = 0, so a creature anchored exactly on the
      // road had its lowest boxes straddling it — which is why they read as
      // half-buried, sunk to the waist in the path.
      const by = a.y + (b.y - a.y) * frac + FOOT_CLEAR
      const bz = a.z + (b.z - a.z) * frac
      const cos = Math.cos(yaw)
      const sin = Math.sin(yaw)

      PARTS.forEach((p, pi) => {
        offset.set(p[0] * c.scale, p[1] * c.scale, p[2] * c.scale)
        pos.set(
          bx + offset.x * cos - offset.z * sin,
          by + offset.y + bob,
          bz + offset.x * sin + offset.z * cos
        )
        sv.set(p[3] * c.scale, p[4] * c.scale, p[5] * c.scale)
        m.compose(pos, q, sv)
        mesh.setMatrixAt(ci * PARTS.length + pi, m)
      })
    })
    mesh.instanceMatrix.needsUpdate = true
  }

  update(0)
  return { group, update }
}
