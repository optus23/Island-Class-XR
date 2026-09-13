import * as THREE from 'three'
import { world as themeWorld } from '../config/theme.js'
import { prefersReducedMotion } from '../lib/motion.js'
import { loadLook, optionFor } from '../lib/avatar.js'

/**
 * The student avatar: a little voxel figure that hops from node to node along
 * the route, 8-bit Mario style but built out of boxes so it belongs in the
 * voxel island.
 *
 * It never teleports — asking it to go three levels ahead makes it hop through
 * every node in between, which is what makes the map read as a journey.
 */

const WALK_SPEED = 13 // world units per second
const STRIDE = 2.2 // world units per bounce — sets the walk cadence
const BOUNCE = 0.42 // how high each step lifts the body
const UP = new THREE.Vector3(0, 1, 0)

export function createPlayer() {
  const group = new THREE.Group()
  const body = new THREE.Group()
  group.add(body)

  const box = (w, h, d, color, x, y, z) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshLambertMaterial({ color })
    )
    mesh.position.set(x, y, z)
    body.add(mesh)
    return mesh
  }

  const torso = box(1.1, 1.0, 0.8, themeWorld.player, 0, 1.05, 0)
  box(0.9, 0.8, 0.85, 0xffd9b3, 0, 1.95, 0) // head
  // Legs, between the torso and the feet. They were missing — the figure went
  // straight from shirt to shoes — and there is no "trousers" to choose
  // without them.
  const legs = box(0.86, 0.42, 0.62, 0x3a4a5c, 0, 0.5, 0)
  // THE HEADSET IS NOT OPTIONAL. It is half of what tells the avatar apart
  // from the villagers pacing the discs; see lib/avatar.js. The lens colour
  // is a choice, the headset is not.
  box(1.0, 0.52, 0.34, 0x22272e, 0, 1.98, 0.44) // visor shell
  const lens = box(0.78, 0.3, 0.1, 0x4cc9f0, 0, 1.99, 0.62)
  box(1.02, 0.2, 0.8, 0x3b434d, 0, 2.16, 0.06) // strap
  const shoeL = box(0.34, 0.22, 0.36, 0x2b2118, -0.34, 0.15, 0.05)
  const shoeR = box(0.34, 0.22, 0.36, 0x2b2118, 0.34, 0.15, 0.05)
  box(0.3, 0.65, 0.3, 0xffd9b3, -0.68, 1.15, 0) // arms
  box(0.3, 0.65, 0.3, 0xffd9b3, 0.68, 1.15, 0)

  /**
   * The hat is the only part that can be absent, so it is the only one that
   * gets built and thrown away rather than recoloured. Kept in a variable so
   * `applyLook` can replace it without touching anything else.
   */
  let hat = null

  /**
   * Restyle in place. Colours are swapped on the existing materials and only
   * the hat is rebuilt, so changing a shirt does not rebuild the figure — and
   * does not interrupt a hop that is halfway through.
   */
  function applyLook(look) {
    torso.material.color.setHex(optionFor('shirt', look).color)
    legs.material.color.setHex(optionFor('trousers', look).color)
    lens.material.color.setHex(optionFor('visor', look).color)
    const shoe = optionFor('shoes', look).color
    shoeL.material.color.setHex(shoe)
    shoeR.material.color.setHex(shoe)

    if (hat) {
      body.remove(hat)
      hat.geometry.dispose()
      hat.material.dispose()
      hat = null
    }
    const choice = optionFor('hat', look)
    if (choice?.box) {
      const [w, h, d, x, y, z] = choice.box
      // `color: null` means "match the shirt" — that is what the original cap
      // did, and it is still the default.
      hat = box(w, h, d, choice.color ?? optionFor('shirt', look).color, x, y, z)
    }
  }

  applyLook(loadLook())

  /** @type {THREE.Vector3[]} */
  let waypoints = []
  let segment = 0
  let segmentT = 0
  let moving = false
  let onArrive = null
  let currentLevelId = null
  let travelled = 0
  let lastSegmentT = 0

  const from = new THREE.Vector3()
  const to = new THREE.Vector3()
  let idleT = 0

  function snapTo(position, levelId) {
    group.position.copy(position)
    currentLevelId = levelId
    waypoints = []
    moving = false
  }

  /**
   * @param {THREE.Vector3[]} route waypoints to visit in order (excluding the
   *   player's current position)
   * @param {string} levelId the level the route ends on
   */
  function travel(route, levelId, done) {
    if (!route.length) {
      currentLevelId = levelId
      done?.()
      return
    }
    // Reduced motion: land on the destination without hopping the whole route.
    if (prefersReducedMotion()) {
      group.position.copy(route[route.length - 1])
      body.position.y = 0
      body.scale.set(1, 1, 1)
      waypoints = []
      moving = false
      currentLevelId = levelId
      done?.()
      return
    }
    waypoints = route.map((p) => p.clone())
    segment = 0
    segmentT = 0
    lastSegmentT = 0
    travelled = 0
    moving = true
    onArrive = done
    currentLevelId = levelId
    from.copy(group.position)
    to.copy(waypoints[0])
  }

  function update(dt) {
    if (!moving) {
      if (prefersReducedMotion()) {
        body.position.y = 0
        body.scale.set(1, 1, 1)
        return
      }
      // Idle breathing so the avatar never looks frozen.
      idleT += dt
      body.position.y = Math.sin(idleT * 2.4) * 0.06
      body.scale.set(1, 1, 1)
      return
    }

    const dist = from.distanceTo(to)
    segmentT += dist > 0.0001 ? (dt * WALK_SPEED) / dist : 1

    if (segmentT >= 1) {
      group.position.copy(to)
      segment++
      if (segment >= waypoints.length) {
        moving = false
        body.position.y = 0
        body.scale.set(1, 1, 1)
        const cb = onArrive
        onArrive = null
        cb?.()
        return
      }
      segmentT = 0
      lastSegmentT = 0
      from.copy(group.position)
      to.copy(waypoints[segment])
      return
    }

    group.position.lerpVectors(from, to, segmentT)

    // A continuous walk cycle driven by DISTANCE TRAVELLED, not by segment.
    // The old code arced once per segment, which turned a route into a series
    // of long leaps between node centres. Now the route is a dense polyline
    // along the road, so the bounce has to come from distance or the character
    // would vibrate once per sample.
    travelled += from.distanceTo(to) * (segmentT - lastSegmentT)
    lastSegmentT = segmentT
    const phase = (travelled / STRIDE) * Math.PI
    const bounce = Math.abs(Math.sin(phase))
    body.position.y = bounce * BOUNCE
    const squash = 1 + bounce * 0.09
    body.scale.set(2 - squash, squash, 2 - squash)

    // Face the direction of travel.
    const dir = to.clone().sub(from)
    if (dir.lengthSq() > 1e-6) {
      const yaw = Math.atan2(dir.x, dir.z)
      group.quaternion.slerp(new THREE.Quaternion().setFromAxisAngle(UP, yaw), 0.18)
    }
  }

  /** Stop where we stand. The caller decides what level we now count as. */
  function cancel() {
    waypoints = []
    moving = false
    onArrive = null
    body.position.y = 0
    body.scale.set(1, 1, 1)
  }

  return {
    group,
    travel,
    snapTo,
    cancel,
    update,
    applyLook,
    get isMoving() {
      return moving
    },
    get levelId() {
      return currentLevelId
    },
  }
}
