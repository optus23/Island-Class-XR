import * as THREE from 'three'
import { hash2, groundHeightAt } from './terrain.js'
import { prefersReducedMotion } from '../lib/motion.js'
import { seasonFlags } from '../config/seasons.js'

/**
 * Santa's sleigh, crossing the sky. Christmas only.
 *
 * Marc: "debería de aparecer cada pocos segundos Santa Claus con sus renos en
 * el cielo... cruzando el mapa cada X segundos... puede ser cada 10 segundos".
 * So the sleigh is a SHOW, not an orbit: it crosses the view edge to edge in
 * about eight seconds at the ordinary zoom, is gone for three to six, and
 * comes back from the other side on a slightly different line. Always across the bit of island you are looking
 * at, because the camera follows the avatar and a sleigh crossing the far end
 * of a 300-unit island is a sleigh nobody sees.
 *
 * ACROSS THE SCREEN, NOT INTO IT. Every world's follow camera looks along -z,
 * so screen left and right are world x. A crossing mostly along x passes in
 * full profile, which is the only angle a team of reindeer reads from; one
 * flying toward the camera is a red dot getting bigger. The line wanders by
 * up to 17 degrees either way so two crossings never look like a replay.
 *
 * Decoration, like the bats were: never clickable, never on a disc, never
 * carrying course meaning.
 *
 * THE LIGHT. "Los renos deberían de tener una luz, point light, de la misma
 * forma que las farolas y las calabazas." One PointLight, riding with Rudolph,
 * tinted the red of his nose, so a pink-warm pool slides across the snow under
 * the team as it passes. ONE, and taken out of the season's light budget
 * rather than added to it (see `three/seasonLights.js` for why the budget is a
 * phone decision). Every other reindeer's harness bell glows by COLOUR, the
 * same trick the lit pumpkins use, and at this height that reads the same.
 *
 * The light is never removed or hidden between crossings: a change in the
 * light count recompiles every material in the scene. It is parked at zero
 * intensity instead, and so is the mesh's job done by `visible`, which on a
 * mesh (unlike a light) costs nothing to flip.
 *
 * Two InstancedMeshes, one Lambert and one unlit for the parts that glow, plus
 * a small one for the sparkle trail: three draw calls while it is in the sky,
 * none while it is not.
 */

const RED = 0xc8102e
const RED_DARK = 0x9b0d24
const GOLD = 0xd9a62e
const WHITE = 0xf7f9fc
const BLACK = 0x22272e
const SKIN = 0xffd9b3
const SACK = 0x8b5e34
const SACK_TIE = 0x6f4a2a
const FUR = 0x8b5a2b
const FUR_DARK = 0x5a3d26
const ANTLER = 0x6b4a2a

/** Unlit, so they read as lit against the evening sky. */
const NOSE = 0xff3b30
const BELL = 0xffe27a
const LANTERN = 0xffd27a
const SPARK = 0xfff1b0

/** The team's overall size. The avatar is ~2.6 tall; this has to read from 90 units out. */
const SCALE = 1.35

/** World units per second along the crossing. Unhurried: it is there to be watched. */
const SPEED = 11
/**
 * How long a crossing is when there is no camera to measure. With one, the
 * crossing is the width the camera can actually SEE at that height plus a
 * margin either side, so it enters at one edge and leaves at the other at any
 * zoom: a fixed 210 units was 3 seconds on screen and 9 off it at the
 * ordinary follow distance.
 */
const CROSSING = 120
const EDGE_MARGIN = 22
/**
 * Seconds of empty sky between crossings. With the crossing sized to the
 * view, this is what sets the rhythm: about ten seconds on screen, a few
 * seconds of sky, and back the other way. "Puede ser cada 10 segundos."
 */
const PAUSE_MIN = 3
const PAUSE_MAX = 6
/** Height above the ground under the avatar: over the tallest tree (about 7), well under the camera. */
const ALTITUDE = 10

/** Rudolph's light. Tuned against the screenshots, like the lamps. */
const LIGHT = { color: 0xff8a70, intensity: 150, distance: 40 }

/** [x, y, z, w, h, d, colour] in the sleigh's own frame, +z the way it flies. */
function sleighParts() {
  const p = []
  // Runners, curled up at the front, on four struts.
  for (const x of [-0.78, 0.78]) {
    p.push([x, 0.08, 0, 0.12, 0.12, 3.1, GOLD])
    p.push([x, 0.32, 1.58, 0.12, 0.44, 0.12, GOLD])
    p.push([x, 0.52, 1.42, 0.12, 0.12, 0.3, GOLD])
    p.push([x, 0.34, 0.85, 0.1, 0.38, 0.1, GOLD])
    p.push([x, 0.34, -0.85, 0.1, 0.38, 0.1, GOLD])
  }
  // The body: a red tub with a curled front and a high back.
  p.push([0, 0.78, -0.15, 1.72, 0.82, 2.3, RED])
  p.push([0, 1.12, 0.95, 1.72, 0.5, 0.34, RED])
  p.push([0, 1.5, -1.18, 1.72, 1.0, 0.32, RED_DARK])
  p.push([0, 1.2, -0.15, 1.78, 0.1, 2.36, GOLD]) // gold trim round the rim
  p.push([0, 2.02, -1.18, 1.78, 0.1, 0.38, GOLD])
  // Santa, sitting forward with the reins.
  p.push([0, 1.6, 0.25, 0.98, 0.9, 0.8, RED]) // coat
  p.push([0, 1.34, 0.25, 1.02, 0.14, 0.84, BLACK]) // belt
  p.push([0, 1.34, 0.68, 0.2, 0.16, 0.04, GOLD]) // buckle
  p.push([0, 1.18, 0.25, 1.04, 0.14, 0.86, WHITE]) // fur hem
  p.push([-0.56, 1.72, 0.55, 0.24, 0.24, 0.64, RED]) // arms, forward
  p.push([0.56, 1.72, 0.55, 0.24, 0.24, 0.64, RED])
  p.push([-0.56, 1.72, 0.9, 0.26, 0.26, 0.16, BLACK]) // mitts
  p.push([0.56, 1.72, 0.9, 0.26, 0.26, 0.16, BLACK])
  p.push([0, 2.3, 0.28, 0.62, 0.56, 0.56, SKIN]) // head
  p.push([0, 2.1, 0.58, 0.68, 0.52, 0.18, WHITE]) // beard
  p.push([0, 2.38, 0.58, 0.4, 0.1, 0.06, WHITE]) // moustache
  p.push([-0.13, 2.44, 0.57, 0.08, 0.08, 0.04, BLACK]) // eyes
  p.push([0.13, 2.44, 0.57, 0.08, 0.08, 0.04, BLACK])
  p.push([0, 2.64, 0.26, 0.68, 0.18, 0.62, WHITE]) // hat brim
  p.push([0, 2.85, 0.2, 0.48, 0.3, 0.46, RED])
  p.push([0, 3.02, 0.02, 0.3, 0.2, 0.3, RED])
  p.push([0, 3.0, -0.18, 0.2, 0.2, 0.2, WHITE]) // bobble
  // The sack behind him, with a present poking out of it.
  p.push([0, 1.62, -0.66, 1.16, 1.0, 0.84, SACK])
  p.push([0, 2.2, -0.66, 0.46, 0.24, 0.42, SACK_TIE])
  p.push([0.3, 2.28, -0.58, 0.42, 0.42, 0.42, 0x1f6b45])
  p.push([0.3, 2.28, -0.58, 0.46, 0.46, 0.1, GOLD])
  // Reins, out to the team. Two long thin boxes, which at this distance is
  // what a pair of reins is.
  p.push([-0.56, 1.55, 3.8, 0.05, 0.05, 5.8, GOLD])
  p.push([0.56, 1.55, 3.8, 0.05, 0.05, 5.8, GOLD])
  return p
}

/** One reindeer, origin under its body. `lead` is Rudolph. */
function reindeerParts() {
  return {
    body: [
      [0, 1.1, 0, 0.6, 0.55, 1.3, FUR],
      [0, 0.9, 0.05, 0.5, 0.14, 1.0, 0xc8a27a], // pale belly
      [0, 1.45, 0.6, 0.32, 0.5, 0.32, FUR], // neck
      [0, 1.78, 0.82, 0.4, 0.36, 0.56, FUR], // head
      [-0.25, 1.92, 0.68, 0.18, 0.1, 0.08, FUR], // ears
      [0.25, 1.92, 0.68, 0.18, 0.1, 0.08, FUR],
      [-0.14, 2.12, 0.7, 0.07, 0.42, 0.07, ANTLER], // antlers
      [0.14, 2.12, 0.7, 0.07, 0.42, 0.07, ANTLER],
      [-0.3, 2.3, 0.7, 0.3, 0.07, 0.07, ANTLER],
      [0.3, 2.3, 0.7, 0.3, 0.07, 0.07, ANTLER],
      [-0.42, 2.42, 0.7, 0.07, 0.22, 0.07, ANTLER],
      [0.42, 2.42, 0.7, 0.07, 0.22, 0.07, ANTLER],
      [0, 1.25, -0.68, 0.18, 0.18, 0.1, WHITE], // tail
      [0, 1.12, 0.2, 0.64, 0.12, 0.2, RED], // harness
    ],
    // Legs, animated separately: [x, z, front?]
    legs: [
      [-0.18, 0.45, true],
      [0.18, 0.45, true],
      [-0.18, -0.45, false],
      [0.18, -0.45, false],
    ],
  }
}

/** Where the five reindeer fly, in the sleigh's frame. The last is Rudolph. */
const TEAM = [
  [-0.75, 3.3],
  [0.75, 3.3],
  [-0.75, 5.5],
  [0.75, 5.5],
  [0, 7.7],
]

const TRAIL = 40

export function createSleigh() {
  const group = new THREE.Group()
  const inert = { group, update() {}, lightCount: 0 }
  if (!seasonFlags.sleigh) return inert

  const sleigh = sleighParts()
  const deer = reindeerParts()
  const perDeer = deer.body.length + deer.legs.length
  const litCount = sleigh.length + TEAM.length * perDeer

  const box = new THREE.BoxGeometry(1, 1, 1)
  const lit = new THREE.InstancedMesh(box, new THREE.MeshLambertMaterial(), litCount)
  // Noses, bells and the lantern. Unlit so they glow against the evening.
  const glowCount = TEAM.length + TEAM.length + 1
  const glow = new THREE.InstancedMesh(box, new THREE.MeshBasicMaterial(), glowCount)
  const trail = new THREE.InstancedMesh(box, new THREE.MeshBasicMaterial({ color: SPARK }), TRAIL)
  for (const mesh of [lit, glow, trail]) {
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    // It crosses the whole frustum by design; culling on one bounding sphere
    // would blink it out halfway across.
    mesh.frustumCulled = false
    mesh.visible = false
    group.add(mesh)
  }

  const col = new THREE.Color()
  let li = 0
  for (const s of sleigh) lit.setColorAt(li++, col.setHex(s[6]))
  for (let r = 0; r < TEAM.length; r++) {
    for (const b of deer.body) lit.setColorAt(li++, col.setHex(b[6]))
    for (let k = 0; k < deer.legs.length; k++) lit.setColorAt(li++, col.setHex(FUR_DARK))
  }
  let gi = 0
  for (let r = 0; r < TEAM.length; r++) {
    // Rudolph's nose is the red one; the rest are dark, so it is HIS that shines.
    glow.setColorAt(gi++, col.setHex(r === TEAM.length - 1 ? NOSE : 0x2b2118))
  }
  for (let r = 0; r < TEAM.length; r++) glow.setColorAt(gi++, col.setHex(BELL))
  glow.setColorAt(gi++, col.setHex(LANTERN))
  lit.instanceColor.needsUpdate = true
  glow.instanceColor.needsUpdate = true

  const light = new THREE.PointLight(LIGHT.color, 0, LIGHT.distance, 2)
  group.add(light)

  // --- the flight -----------------------------------------------------------
  let flying = false
  let wait = 3 // the first one comes soon after the map opens
  let along = 0
  let span = CROSSING
  let crossings = 0
  const start = new THREE.Vector3()
  const dir = new THREE.Vector3()
  let baseY = 0
  let t = 0

  const eye = new THREE.Vector3()
  const aim = new THREE.Vector3()

  /**
   * A new crossing, through the middle of whatever the camera is looking at.
   *
   * MEASURED, NOT GUESSED. The first cut flew 17 units up and a little behind
   * the avatar, and the follow camera (43 units up, looking steeply down) put
   * it on the top edge of the frame or past it: technically in the sky, never
   * actually seen. So the lane is taken off the camera itself: walk the ray
   * from the camera to the avatar down to the sleigh's altitude, and fly
   * through THAT point. Whatever the zoom, the world or the orbit, the team
   * crosses the screen through the middle, a touch above the avatar.
   */
  function launch(focus, camera) {
    const n = crossings++
    // Alternate sides, and wander a little off pure x each time.
    const sign = n % 2 ? -1 : 1
    const wander = (hash2(n * 3.7, 11.3) - 0.5) * 0.6
    dir.set(Math.cos(wander) * sign, 0, Math.sin(wander)).normalize()

    const ground = groundHeightAt(focus.x, focus.z)
    const lift = ALTITUDE + hash2(n * 5.3, 2.2) * 4
    baseY = ground + lift
    aim.set(focus.x, baseY, focus.z)
    span = CROSSING
    if (camera) {
      camera.getWorldPosition(eye)
      group.worldToLocal(eye)
      const drop = eye.y - ground
      if (drop > lift + 1) {
        const k = (eye.y - baseY) / drop
        aim.set(eye.x + (focus.x - eye.x) * k, baseY, eye.z + (focus.z - eye.z) * k)
      }
      // How wide the view is at that distance: the crossing spans it, edge to
      // edge plus a margin, so it is in sight for the whole flight.
      if (camera.isPerspectiveCamera) {
        const halfW =
          eye.distanceTo(aim) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect
        span = Math.min(360, Math.max(70, halfW * 2 + EDGE_MARGIN * 2))
      }
    }
    // A few units further back than dead centre, and a different few each
    // time, so it passes over the upper middle of the frame and two crossings
    // never trace the same line.
    aim.z -= 6 + hash2(n * 1.9, 4.1) * 6
    start.set(aim.x - dir.x * (span / 2), 0, aim.z - dir.z * (span / 2))
    along = 0
    flying = true
    for (const mesh of [lit, glow, trail]) mesh.visible = true
  }

  function land() {
    flying = false
    wait = PAUSE_MIN + hash2(crossings * 2.3, 7.7) * (PAUSE_MAX - PAUSE_MIN)
    for (const mesh of [lit, glow, trail]) mesh.visible = false
    light.intensity = 0 // parked, never removed: see the note at the top
    for (const s of sparks) s.life = 0
  }

  // --- the sparkle trail ----------------------------------------------------
  const sparks = Array.from({ length: TRAIL }, () => ({ x: 0, y: 0, z: 0, life: 0, size: 0 }))
  let nextSpark = 0
  let sparkClock = 0
  const SPARK_LIFE = 1.5

  // --- per-frame ------------------------------------------------------------
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const up = new THREE.Vector3(0, 1, 0)
  const pos = new THREE.Vector3()
  const sv = new THREE.Vector3()
  const worldScale = new THREE.Vector3()
  const zero = new THREE.Matrix4().makeScale(0, 0, 0)
  const nose = new THREE.Vector3()

  function update(dt, focus, camera) {
    // Reduced motion: no sleigh at all. A shape sweeping across the whole sky
    // every twenty seconds is exactly the motion that setting asks us to drop,
    // and unlike the bats a parked sleigh in mid-air would make no sense.
    if (prefersReducedMotion()) {
      if (flying) land()
      return
    }
    t += dt
    if (!flying) {
      wait -= dt
      if (wait <= 0 && focus) launch(focus, camera)
      if (!flying) return
    }

    along += SPEED * dt
    if (along >= span) {
      land()
      return
    }

    // A gentle swoop: a little lower in the middle of the crossing, as if it
    // came down to look, plus the team's own slow rise and fall.
    const u = along / span
    const cx = start.x + dir.x * along
    const cz = start.z + dir.z * along
    const cy = baseY - Math.sin(u * Math.PI) * 3 + Math.sin(t * 1.3) * 0.5
    const yaw = Math.atan2(dir.x, dir.z)
    const cos = Math.cos(yaw)
    const sin = Math.sin(yaw)
    q.setFromAxisAngle(up, yaw)

    const place = (mesh, index, ox, oy, oz, w, h, d) => {
      pos.set(
        cx + (ox * cos + oz * sin) * SCALE,
        cy + oy * SCALE,
        cz + (-ox * sin + oz * cos) * SCALE
      )
      sv.set(w * SCALE, h * SCALE, d * SCALE)
      m.compose(pos, q, sv)
      mesh.setMatrixAt(index, m)
    }

    let i = 0
    for (const s of sleigh) place(lit, i++, s[0], s[1], s[2], s[3], s[4], s[5])

    let g = 0
    let noseAt = null
    TEAM.forEach(([tx, tz], r) => {
      // Each reindeer gallops on its own beat, so the team ripples.
      const phase = t * 7 + r * 1.3
      const bob = Math.sin(phase) * 0.12
      const ty = 0.25 + bob
      for (const b of deer.body) place(lit, i++, tx + b[0], ty + b[1], tz + b[2], b[3], b[4], b[5])
      for (const [lx, lz, front] of deer.legs) {
        // Front and back legs stretch in opposite directions: the flying
        // gallop of every Christmas card, done with two numbers per leg.
        const swing = Math.sin(phase + (front ? 0 : Math.PI))
        place(lit, i++, tx + lx, ty + 0.7 + Math.abs(swing) * 0.08, tz + lz + swing * 0.22, 0.14, 0.5, 0.14)
      }
      place(glow, g, tx, ty + 1.7, tz + 1.12, r === TEAM.length - 1 ? 0.2 : 0.12, 0.14, 0.1)
      if (r === TEAM.length - 1) {
        noseAt = nose.set(
          cx + (tx * cos + (tz + 1.12) * sin) * SCALE,
          cy + (ty + 1.7) * SCALE,
          cz + (-tx * sin + (tz + 1.12) * cos) * SCALE
        )
      }
      g++
    })
    TEAM.forEach(([tx, tz], r) => {
      const ty = 0.25 + Math.sin(t * 7 + r * 1.3) * 0.12
      place(glow, g++, tx, ty + 0.95, tz + 0.22, 0.12, 0.12, 0.12)
    })
    // A lantern on a hook at the front of the sleigh.
    place(glow, g++, 0.95, 1.55, 1.25, 0.22, 0.3, 0.22)
    lit.instanceMatrix.needsUpdate = true
    glow.instanceMatrix.needsUpdate = true

    // Sparkles shed from the runners, drifting down and shrinking.
    sparkClock += dt
    while (sparkClock > 0.07) {
      sparkClock -= 0.07
      const s = sparks[nextSpark]
      nextSpark = (nextSpark + 1) % TRAIL
      const side = hash2(nextSpark * 1.7, t) > 0.5 ? 1 : -1
      s.x = cx + (0.78 * side * cos + -1.4 * sin) * SCALE
      s.y = cy + 0.1
      s.z = cz + (-0.78 * side * sin + -1.4 * cos) * SCALE
      s.life = SPARK_LIFE
      s.size = 0.18 + hash2(t, nextSpark) * 0.16
    }
    sparks.forEach((s, k) => {
      if (s.life <= 0) {
        trail.setMatrixAt(k, zero)
        return
      }
      s.life -= dt
      s.y -= dt * 1.4
      const f = Math.max(0, s.life / SPARK_LIFE)
      pos.set(s.x, s.y, s.z)
      sv.setScalar(s.size * f * SCALE)
      m.compose(pos, q, sv)
      trail.setMatrixAt(k, m)
    })
    trail.instanceMatrix.needsUpdate = true

    /**
     * The light rides at Rudolph's nose. Its reach and its strength are both
     * WORLD-space quantities, so both follow the group's world scale: the VR
     * diorama shrinks the island by ~0.005, and an unscaled light there would
     * flood the whole tabletop. Intensity goes with the SQUARE of the scale
     * because physical falloff is 1/d².
     */
    group.getWorldScale(worldScale)
    const sc = worldScale.x || 1
    if (noseAt) light.position.copy(noseAt)
    // Fade in and out over the first and last few seconds, so a pool of red
    // light does not switch on in the middle of a field.
    const edge = Math.min(1, along / EDGE_MARGIN, (span - along) / EDGE_MARGIN)
    light.intensity = LIGHT.intensity * edge * sc * sc
    light.distance = LIGHT.distance * sc
  }

  return {
    group,
    update,
    /** How many of the season's lights this holds, for `createSeasonLights`. */
    lightCount: 1,
    /** For the console: is it in the sky right now? */
    get flying() {
      return flying
    },
    /** Send it now rather than waiting. Handy when checking it by eye. */
    launchNow(focus, camera) {
      launch(focus, camera)
    },
  }
}
