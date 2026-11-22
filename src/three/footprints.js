import * as THREE from 'three'
import { biomeKeyAt } from './terrain.js'
import { seasonFlags } from '../config/seasons.js'

/**
 * Footprints the avatar leaves in the snow.
 *
 * Marc: "cuando el jugador pase por la nieve ha de dejar huellas... y esta
 * feature también la podrías añadir a la parte de nieve del nivel default".
 * So this is not a Christmas prop: it runs in EVERY season, on whatever ground
 * is snow. In the ordinary map and at Halloween that is world 3's summit; at
 * Christmas the whole island is snowed in and the prints follow you from the
 * first session to the last. Which ground counts is `seasonFlags.footprints`.
 *
 * THE AVATAR WALKS ON THE ROAD, and the road keeps its cream in every season
 * (see `world.pathDone` for why its colours are not ours to touch). So a print
 * is a cool blue-grey sole pressed into the road's surface: the colour of
 * shadow in snow, which is what a footprint in snow looks like, and dark
 * enough to read on the cream without being mistaken for a marking.
 *
 * THEY FILL BACK IN. A print lives for `LIFE` seconds and shrinks to nothing
 * over the last part of it, the way new snow covers a track. That keeps the
 * trail to the stretch just walked rather than a permanent line over the
 * whole route, which would read as a second road.
 *
 * One InstancedMesh, a ring buffer of `MAX` slots: the oldest print is reused
 * for the newest. Nothing is allocated while walking.
 */

const MAX = 180
const LIFE = 32 // seconds until a print has been snowed over
const FADE = 10 // the last seconds of that, spent shrinking
const SOLE_W = 0.3
const SOLE_D = 0.46
/** Half the distance between the two feet, from the avatar's centre line. */
const GAIT = 0.24
/** A whisker above the road: enough to win the depth test, not enough to float. */
const LIFT = 0.04
const COLOUR = 0x9fb1c8

/** Does this spot count as snow, for this season? */
export function isSnowAt(x, z) {
  const mode = seasonFlags.footprints
  if (mode === 'everywhere') return true
  if (mode === 'none') return false
  return biomeKeyAt(x, z) === 'summit'
}

export function createFootprints() {
  const group = new THREE.Group()
  if (seasonFlags.footprints === 'none') return { group, update() {}, step() {} }

  const material = new THREE.MeshLambertMaterial({
    color: COLOUR,
    // The road carries -4/-8 against the terrain and the discs -6/-12 against
    // the road (see CLAUDE.md, "Clearance is not only geometry"). A print sits
    // on the road, so it needs the stronger bias too, or it flickers in and out
    // of the ribbon at a grazing angle.
    polygonOffset: true,
    polygonOffsetFactor: -6,
    polygonOffsetUnits: -12,
  })
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, MAX)
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  mesh.frustumCulled = false
  const zero = new THREE.Matrix4().makeScale(0, 0, 0)
  for (let i = 0; i < MAX; i++) mesh.setMatrixAt(i, zero)
  group.add(mesh)

  const prints = Array.from({ length: MAX }, () => ({
    x: 0,
    y: 0,
    z: 0,
    yaw: 0,
    age: Infinity,
  }))
  let next = 0
  let live = 0

  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const up = new THREE.Vector3(0, 1, 0)
  const pos = new THREE.Vector3()
  const sv = new THREE.Vector3()

  /**
   * One foot coming down.
   *
   * @param {THREE.Vector3} at the avatar's position (on the road surface)
   * @param {number} yaw the direction it is walking
   * @param {number} side -1 left foot, +1 right foot
   */
  function step(at, yaw, side) {
    // The sideways offset, perpendicular to the heading.
    const x = at.x + Math.cos(yaw) * GAIT * side
    const z = at.z - Math.sin(yaw) * GAIT * side
    if (!isSnowAt(x, z)) return
    const p = prints[next]
    next = (next + 1) % MAX
    if (p.age >= LIFE) live++
    p.x = x
    p.y = at.y + LIFT
    p.z = z
    // A slight splay outwards, like real feet, so the trail is not two rails.
    p.yaw = yaw + side * 0.12
    p.age = 0
  }

  function update(dt) {
    if (!live) return
    for (let i = 0; i < MAX; i++) {
      const p = prints[i]
      if (p.age >= LIFE) continue
      p.age += dt
      if (p.age >= LIFE) {
        live--
        mesh.setMatrixAt(i, zero)
        continue
      }
      const f = Math.min(1, (LIFE - p.age) / FADE)
      q.setFromAxisAngle(up, p.yaw)
      pos.set(p.x, p.y, p.z)
      sv.set(SOLE_W * f, 0.03, SOLE_D * f)
      m.compose(pos, q, sv)
      mesh.setMatrixAt(i, m)
    }
    mesh.instanceMatrix.needsUpdate = true
  }

  return {
    group,
    update,
    step,
    /** For the console: how many prints are on the ground now. */
    get count() {
      return live
    },
  }
}
