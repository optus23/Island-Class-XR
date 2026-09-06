import * as THREE from 'three'
import { ROAD_FOOT, groundHeightAt, hash2 } from './terrain.js'
import { villagers as skin } from '../config/theme.js'
import { prefersReducedMotion } from '../lib/motion.js'

/**
 * Honoured students, pacing around the session they earned.
 *
 * The reward is being ON the map: a little voxel classmate strolling a slow
 * circuit beside a session disc with your name over their head. Purely
 * decorative — never clickable, never in the way, carrying no course meaning
 * and no marks. The roster that drives it is `public/npcs.json`, edited from
 * /admin; see `lib/roster.js` for what it is and is not allowed to hold.
 *
 * TWO DRAW CALLS, WHATEVER THE ROSTER SAYS
 * Every body is a slice of ONE InstancedMesh whose matrices are rewritten each
 * frame, exactly as the patrolling creatures work. Every name plate is a quad in
 * ONE merged geometry reading ONE canvas atlas, billboarded by rewriting 4
 * vertices per plate. Twenty-four students therefore cost the same two draw
 * calls as one, and the whole feature is ~300 instances and ~100 vertices.
 *
 * A Sprite per name would have been shorter, but a SpriteMaterial's UV offset
 * lives on the Texture, so sharing one atlas between them is impossible: it
 * would have been one texture upload and one draw call per student.
 *
 * THE LOOP IS SAMPLED ONCE, NOT SOLVED PER FRAME
 * Each villager's circuit is baked at build time into a closed polyline with a
 * height and a yaw at every point (`walkSurfaceAt` is six ground samples near
 * the road, which is not a per-frame cost anyone should pay). Walking is then
 * one index step, and the animation reads that table.
 *
 * WHY THE LOOP FITS WHERE IT DOES
 * `terrain.js` holds the ground down within `NODE_CLEAR_RADIUS` (4) of every
 * on-path node, and `npm run validate` asserts that pad is level out to r = 3.
 * So a circuit at r ≈ 2.7–3.2 is guaranteed flat ground, clear of the disc and
 * its gold rim (r ≈ 1.5), and inside the ring where `props.js` plants each
 * session's landmark (≥ 3.9). That is why the radius is what it is — it is the
 * one band that is level, empty, and still close enough to belong to the
 * session. Off-path bonus nodes get no pad, so villagers are only ever placed
 * on main-path sessions; the caller filters them.
 */

/**
 * The figure, as boxes. Local axes: +y up, +z forward (the way it faces).
 *
 * `mirror` duplicates a part at ∓x — shoes, legs, arms and eyes come in pairs.
 * `swing` moves a part fore and aft with the walk cycle: +1 with the leading
 * leg, -1 against it, so arms and legs cross the way they do when someone walks.
 */
const PARTS = [
  { y: 0.13, z: 0.04, w: 0.32, h: 0.22, d: 0.36, tint: 'shoe', mirror: 0.29, swing: 1 },
  { y: 0.5, w: 0.34, h: 0.52, d: 0.34, tint: 'trousers', mirror: 0.26, swing: 1 },
  { y: 1.13, w: 1.0, h: 0.82, d: 0.66, tint: 'shirt' },
  { y: 1.12, w: 0.26, h: 0.6, d: 0.28, tint: 'skin', mirror: 0.62, swing: -1 },
  { y: 1.8, w: 0.82, h: 0.72, d: 0.78, tint: 'skin' },
  { y: 2.19, w: 0.9, h: 0.24, d: 0.86, tint: 'hair' },
  { y: 2.02, z: 0.36, w: 0.86, h: 0.18, d: 0.12, tint: 'hair' },
  { y: 1.82, z: 0.4, w: 0.12, h: 0.14, d: 0.06, tint: 'ink', mirror: 0.2 },
]

/** PARTS with every `mirror` expanded, which is what the mesh is sized from. */
const BOXES = PARTS.flatMap((p) =>
  p.mirror ? [{ ...p, x: -p.mirror }, { ...p, x: p.mirror, swing: -(p.swing ?? 0) }] : [{ ...p, x: 0 }]
)

/** Top of the tallest box — where the name plate has to clear. */
const HEAD_TOP = 2.31

const SPEED = 1.55 // world units per second at a full stroll
const STRIDE = 1.7 // units per step, which sets the cadence of the bob
const BOB = 0.09 // "muy sutil": a third of what the patrolling creatures do
const SWING = 0.15 // how far arms and legs travel fore and aft

/**
 * Points around the circuit.
 *
 * Chosen against a stopwatch. Every point costs one `groundHeightAt`, which is
 * 37 microseconds because it scans every road polyline on the island, so this
 * number times the roster is what the map waits for before it can be shown: 64
 * puts a full 24-student roster at about 60 ms and an ordinary one under 25.
 * (The road's height is NOT sampled that way — see `nearestOnRoad`. Taking it
 * from `roadTopAt`, at 190 microseconds a call, cost a full second.)
 *
 * An earlier version sampled the ground coarsely and interpolated between those
 * samples to afford more points. It was wrong: the ground is a step function of
 * flat plateaus, so interpolating across a terrace edge left the villager
 * hovering up to 1.96 units above it. Every point now gets its own sample and
 * stands exactly on the surface; where a pad has a terrace edge inside the ring
 * — two of the 27 do — the villager steps down it in about a fifth of a second,
 * which reads as a step down.
 */
const LOOP_SAMPLES = 64

/**
 * The circuit's radius, and how far the lopsided oval may stray from it.
 *
 * BOTH ENDS OF THIS BAND ARE LOAD-BEARING, and both are measured.
 *
 * The outside is the flat pad `clearGroundAround` holds down around every
 * on-path node: sampling `groundHeightAt` at 180 angles around all 25 of them,
 * nothing rises above a node's own level anywhere out to r = 3.6, and at r = 4.0
 * — the pad's edge — eight of them step up by a whole plateau. 3.43 leaves a
 * margin against that edge.
 *
 * The inside is the node's gold rim at r = 1.49 plus half a body, so a villager
 * paces BESIDE the session circle and never stands on it: the disc is the one
 * thing on the map you are meant to click.
 *
 * 2.6..3.1 give or take 10.5% is 2.33 at the tightest and 3.43 at the widest,
 * which sits inside both. Three rings, so several students at one session never
 * file in line behind each other.
 *
 * `npm run validate` asserts the no-rise half of this at 1.6, 2.2, 2.8, 3 and
 * 3.4 — widen the band here and those radii have to follow.
 */
const RING = [2.6, 2.85, 3.1]
const WOBBLE = [0.07, 0.035]

/**
 * How far past the road's own footprint a villager is already standing on it.
 *
 * The road floats up to two units above the ground beneath its centre line —
 * `roadTopAt` takes the highest ground across the ribbon's whole width so a quad
 * crossing a terrace cannot slice into it — so a figure anchored to the ground
 * sinks to the waist the moment it steps on. Inside ROAD_FOOT it stands on the
 * road; over the next ROAD_BLEND units it ramps back down to the ground, which
 * is what turns stepping onto the ribbon into walking up onto it.
 */
const ROAD_BLEND = 1.3

const CELL_W = 512 // atlas pixels per name
const CELL_H = 80
const PLATE_ASPECT = CELL_H / CELL_W

/**
 * The name plate holds its SIZE ON SCREEN, not its size in the world.
 *
 * A plate fixed at a few world units is the obvious thing and it fails at the
 * only distance that matters: the follow camera sits about 90 units out, which
 * made a 3.9-unit plate 70 pixels wide and the name inside it a smudge. The
 * whole reward is reading your own name on the island, so the plate is scaled by
 * its distance from the camera — the way a label behaves rather than the way an
 * object does — and stays about 125 pixels wide whether the map is zoomed right
 * in or pulled right out.
 *
 * Clamped at both ends so it can never swell across a whole world at maximum
 * zoom-out, nor shrink to nothing with the camera inside the diorama in VR.
 * Measured in the mesh's OWN space, because in VR the island is scaled to about
 * 0.005 and a distance read in world metres would be meaningless here.
 */
const PLATE_PER_UNIT = 0.078
const PLATE_MIN_W = 2.6
const PLATE_MAX_W = 9

/**
 * How far the plate floats above the head, and how much higher each additional
 * student at the same session hangs theirs.
 *
 * The stagger is not decoration. Every plate is a quad in one merged geometry
 * and one draw call, so they cannot be depth-sorted against each other: two at
 * the same height simply overlap in buffer order and the second name is
 * unreadable. Hanging them at different heights is what keeps three students on
 * one disc all legible. Measured in plate heights, so the stack stays a stack at
 * every zoom.
 */
const PLATE_GAP = 0.85
const PLATE_STACK = 1.15

const FONT = 'Fredoka, ui-rounded, "Segoe UI", system-ui, sans-serif'

const UP = new THREE.Vector3(0, 1, 0)

/** Deterministic 0..1 from a roster id, so a name always looks the same. */
function seedOf(id, salt) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 100003
  return hash2(h * 0.013 + salt * 7.31, h * 0.029 - salt * 3.17)
}

const pick = (list, t) => list[Math.floor(t * list.length) % list.length]

/**
 * One villager's closed circuit around (cx, cz), as a table the animation reads.
 *
 * The radius is modulated by two low-frequency terms so the loop is a lopsided
 * oval rather than a circle: a figure tracing a perfect circle at constant speed
 * reads as a fairground ride, not as someone wandering about.
 */
function buildLoop(cx, cz, radius, seedA, seedB, road) {
  const phaseA = seedA * Math.PI * 2
  const phaseB = seedB * Math.PI * 2
  const radiusAt = (a) =>
    radius * (1 + WOBBLE[0] * Math.sin(a * 2 + phaseA) + WOBBLE[1] * Math.sin(a * 3 + phaseB))

  const reach = ROAD_FOOT + ROAD_BLEND
  const points = []
  for (let i = 0; i < LOOP_SAMPLES; i++) {
    const a = (i / LOOP_SAMPLES) * Math.PI * 2
    const r = radiusAt(a)
    const x = cx + Math.cos(a) * r
    const z = cz + Math.sin(a) * r

    const ground = groundHeightAt(x, z)
    // The road, read off the very polyline the avatar walks, so a villager
    // crossing it stands at exactly the height the avatar does there — and the
    // whole scan costs a couple of microseconds against the 190 that one
    // `roadTopAt` call does. The rendered ribbon is flat across its width
    // (`nodes.js` gives both its edges the same centre-line height), so the
    // centre line IS the road's surface at any point across it.
    const near = nearestOnRoad(road, x, z)
    const t = near.dist >= reach ? 0 : Math.min(1, (reach - near.dist) / ROAD_BLEND)
    points.push(new THREE.Vector3(x, ground + (near.y - ground) * t, z))
  }

  // Segment lengths, for stepping the loop at a constant speed in world units
  // rather than in samples — the lopsided radius makes those two different.
  const step = []
  let length = 0
  for (let i = 0; i < LOOP_SAMPLES; i++) {
    const d = points[i].distanceTo(points[(i + 1) % LOOP_SAMPLES])
    step.push(d)
    length += d
  }

  // Facing, from two samples either side rather than the next one along: the
  // wobble in the radius makes the immediate segment jitter by a few degrees.
  const yaw = []
  for (let i = 0; i < LOOP_SAMPLES; i++) {
    const a = points[(i - 2 + LOOP_SAMPLES) % LOOP_SAMPLES]
    const b = points[(i + 2) % LOOP_SAMPLES]
    yaw.push(Math.atan2(b.x - a.x, b.z - a.z))
  }

  return { points, step, yaw, length }
}

/**
 * Nearest point on the grand road polyline, with the road's height there.
 *
 * The WHOLE polyline, not a window around the session. On a switchback another
 * run of the route passes within a few units of a node while being hundreds of
 * samples away along it — the same geometry `clearGroundAround` exists for — and
 * a windowed scan would miss it and drop the villager through that road instead
 * of onto it.
 */
function nearestOnRoad(road, x, z) {
  let best = Infinity
  let bestY = 0
  for (let i = 1; i < road.length; i++) {
    const a = road[i - 1]
    const b = road[i]
    const dx = b.x - a.x
    const dz = b.z - a.z
    const len2 = dx * dx + dz * dz
    let t = len2 === 0 ? 0 : ((x - a.x) * dx + (z - a.z) * dz) / len2
    t = t < 0 ? 0 : t > 1 ? 1 : t
    const px = x - (a.x + t * dx)
    const pz = z - (a.z + t * dz)
    const d2 = px * px + pz * pz
    if (d2 < best) {
      best = d2
      bestY = a.y + t * (b.y - a.y)
    }
  }
  return { dist: Math.sqrt(best), y: bestY }
}

/** Rounded plate with a hard black edge and a gold inner rim — the UI's chrome. */
function paintPlate(ctx, row, text) {
  const top = row * CELL_H
  ctx.clearRect(0, top, CELL_W, CELL_H)

  const pad = 7
  ctx.beginPath()
  ctx.roundRect(pad, top + pad, CELL_W - pad * 2, CELL_H - pad * 2, 18)
  ctx.fillStyle = skin.plate
  ctx.fill()
  ctx.lineWidth = 8
  ctx.strokeStyle = skin.plateEdge
  ctx.stroke()

  ctx.beginPath()
  ctx.roundRect(pad + 8, top + pad + 8, CELL_W - pad * 2 - 16, CELL_H - pad * 2 - 16, 12)
  ctx.lineWidth = 3
  ctx.strokeStyle = skin.plateRim
  ctx.stroke()

  // Shrink to fit rather than clip: "Marc Antoni Rodríguez" has to be readable
  // on the same plate as "Ada".
  const room = CELL_W - 76
  let size = 44
  ctx.font = `700 ${size}px ${FONT}`
  while (size > 18 && ctx.measureText(text).width > room) {
    size -= 2
    ctx.font = `700 ${size}px ${FONT}`
  }
  let label = text
  while (label.length > 1 && ctx.measureText(label).width > room) {
    label = label.slice(0, -1)
  }
  if (label !== text) label = label.slice(0, -1) + '…'

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = skin.plateInk
  ctx.fillText(label, CELL_W / 2, top + CELL_H / 2 + 2)
}

/**
 * @param {Array<{id: string, name: string, centre: THREE.Vector3, slot: number}>} people
 *   `centre` is the session disc to pace around; `slot` is which villager this
 *   is at that session, and spreads both the ring and the starting point.
 * @param {THREE.Vector3[]} road the grand road polyline, already at road height
 * @returns {{group: THREE.Group, update: (dt: number, camera: THREE.Camera) => void, count: number}}
 */
export function createVillagers(people = [], road = []) {
  const group = new THREE.Group()
  group.name = 'villagers'
  if (!people.length || road.length < 2) return { group, update() {}, count: 0 }

  const crew = people.map((p) => {
    const ring = seedOf(p.id, 1)
    const loop = buildLoop(
      p.centre.x,
      p.centre.z,
      RING[(p.slot + Math.floor(ring * 3)) % RING.length],
      seedOf(p.id, 2),
      seedOf(p.id, 3),
      road
    )
    return {
      loop,
      // Golden-angle offset per slot, so two students at one session start on
      // opposite sides of the disc without either knowing how many there are.
      at: (((p.slot * 0.6180339887 + seedOf(p.id, 4)) % 1) * loop.length),
      walked: 0,
      phase: seedOf(p.id, 5) * Math.PI * 2,
      scale: 0.94 + seedOf(p.id, 6) * 0.14,
      slot: p.slot,
      headX: p.centre.x,
      headY: p.centre.y + HEAD_TOP + PLATE_GAP,
      headZ: p.centre.z,
      colors: {
        shirt: pick(skin.shirt, seedOf(p.id, 7)),
        trousers: pick(skin.trousers, seedOf(p.id, 8)),
        skin: pick(skin.skin, seedOf(p.id, 9)),
        hair: pick(skin.hair, seedOf(p.id, 10)),
        shoe: skin.shoe,
        ink: skin.ink,
      },
    }
  })

  // --- bodies: one instanced mesh -----------------------------------------

  const bodies = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshLambertMaterial(),
    crew.length * BOXES.length
  )
  bodies.name = 'villager-bodies'
  bodies.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  // The matrices are written from the loop tables, not from this mesh's own
  // bounds, so three has nothing correct to cull against.
  bodies.frustumCulled = false

  const col = new THREE.Color()
  crew.forEach((v, ci) => {
    BOXES.forEach((b, bi) => {
      bodies.setColorAt(ci * BOXES.length + bi, col.setHex(v.colors[b.tint]))
    })
  })
  if (bodies.instanceColor) bodies.instanceColor.needsUpdate = true
  group.add(bodies)

  // --- name plates: one atlas, one merged mesh ------------------------------

  const canvas = document.createElement('canvas')
  canvas.width = CELL_W
  canvas.height = CELL_H * crew.length
  const ctx = canvas.getContext('2d')

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  // No mipmaps: the atlas packs the plates one above another, and a mip chain
  // averages each row into its neighbours until every plate has a ghost of the
  // next name bleeding through it.
  texture.generateMipmaps = false
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.anisotropy = 4

  const paintAll = () => {
    people.forEach((p, i) => paintPlate(ctx, i, p.name))
    texture.needsUpdate = true
  }

  paintAll()
  // Fredoka arrives over the network, and whichever of the two wins the race is
  // a coin toss. Repaint once it has landed rather than shipping the fallback.
  document.fonts?.ready?.then(paintAll)

  const quads = crew.length
  const positions = new Float32Array(quads * 4 * 3)
  const uvs = new Float32Array(quads * 4 * 2)
  const index = new Uint16Array(quads * 6)
  for (let i = 0; i < quads; i++) {
    // Canvas row 0 is at the TOP of the image, and v = 1 is the top of a
    // texture, so the rows run downward in v.
    const v1 = 1 - i / quads
    const v0 = 1 - (i + 1) / quads
    uvs.set([0, v0, 1, v0, 1, v1, 0, v1], i * 8)
    const o = i * 4
    index.set([o, o + 1, o + 2, o, o + 2, o + 3], i * 6)
  }
  const plateGeo = new THREE.BufferGeometry()
  plateGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  plateGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  plateGeo.setIndex(new THREE.BufferAttribute(index, 1))

  const plates = new THREE.Mesh(
    plateGeo,
    // Unlit, and it does not write depth: a plate is a readout, and two of them
    // overlapping must not punch a hole in each other. It still TESTS depth, so
    // a name behind a hill is hidden by the hill, which is what makes them feel
    // like part of the island.
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      alphaTest: 0.02,
    })
  )
  plates.name = 'villager-names'
  plates.frustumCulled = false
  plates.renderOrder = 6
  group.add(plates)

  // --- animation -----------------------------------------------------------

  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const pos = new THREE.Vector3()
  const sv = new THREE.Vector3()
  const foot = new THREE.Vector3()
  const right = new THREE.Vector3()
  const up = new THREE.Vector3()
  const eye = new THREE.Vector3()
  const inverse = new THREE.Matrix4()
  let t = 0

  /** Where along the loop `at` world units lands, plus the facing there. */
  function sampleLoop(loop, at) {
    let travelled = at % loop.length
    if (travelled < 0) travelled += loop.length
    let i = 0
    while (i < LOOP_SAMPLES - 1 && travelled > loop.step[i]) {
      travelled -= loop.step[i]
      i++
    }
    const frac = loop.step[i] > 1e-6 ? Math.min(1, travelled / loop.step[i]) : 0
    const a = loop.points[i]
    const b = loop.points[(i + 1) % LOOP_SAMPLES]
    foot.lerpVectors(a, b, frac)
    return loop.yaw[i]
  }

  function update(dt, camera) {
    const still = prefersReducedMotion()
    if (!still) t += dt

    crew.forEach((v, ci) => {
      if (!still) {
        // A stroll, not a patrol: the speed breathes between a near-standstill
        // and a walk on a slow cycle of its own, which is what stops a ring of
        // figures reading as clockwork. Squaring it makes the pauses linger.
        const ease = 0.5 + 0.5 * Math.sin(t * 0.34 + v.phase)
        const speed = SPEED * (0.1 + 0.9 * ease * ease)
        v.at += speed * dt
        v.walked += speed * dt
      }

      const yaw = sampleLoop(v.loop, v.at)
      q.setFromAxisAngle(UP, yaw)
      const cos = Math.cos(yaw)
      const sin = Math.sin(yaw)

      // The cadence comes from DISTANCE WALKED, not from time: tied to time, a
      // villager slowing to a near-stop keeps bobbing on the spot.
      const stepPhase = (v.walked / STRIDE) * Math.PI
      const bob = still ? 0 : Math.abs(Math.sin(stepPhase)) * BOB
      const swing = still ? 0 : Math.sin(stepPhase) * SWING

      BOXES.forEach((b, bi) => {
        const dz = (b.z ?? 0) + (b.swing ?? 0) * swing
        const ox = (b.x ?? 0) * v.scale
        const oz = dz * v.scale
        pos.set(
          foot.x + ox * cos - oz * sin,
          foot.y + (b.y + bob) * v.scale,
          foot.z + ox * sin + oz * cos
        )
        sv.set(b.w * v.scale, b.h * v.scale, b.d * v.scale)
        m.compose(pos, q, sv)
        bodies.setMatrixAt(ci * BOXES.length + bi, m)
      })

      // Where the plate hangs from. Its SIZE is decided below, against the
      // camera, so only the anchor is known here.
      v.headX = foot.x
      v.headY = foot.y + (HEAD_TOP + PLATE_GAP) * v.scale
      v.headZ = foot.z
    })
    bodies.instanceMatrix.needsUpdate = true

    // Billboard every plate with the camera's own right and up, brought into
    // local space — the group carries the parallax tilt on the map and the
    // diorama's scale in VR, and a plate built from world axes would shear with
    // both.
    plates.updateWorldMatrix(true, false)
    inverse.copy(plates.matrixWorld).invert()
    right.setFromMatrixColumn(camera.matrixWorld, 0).transformDirection(inverse)
    up.setFromMatrixColumn(camera.matrixWorld, 1).transformDirection(inverse)
    eye.setFromMatrixPosition(camera.matrixWorld).applyMatrix4(inverse)

    crew.forEach((v, i) => {
      const dist = Math.hypot(eye.x - v.headX, eye.y - v.headY, eye.z - v.headZ)
      const w = Math.min(PLATE_MAX_W, Math.max(PLATE_MIN_W, dist * PLATE_PER_UNIT))
      const h = w * PLATE_ASPECT
      const hw = w / 2
      const hh = h / 2
      const cx = v.headX
      const cy = v.headY + hh + v.slot * h * PLATE_STACK
      const cz = v.headZ
      const o = i * 12
      for (let c = 0; c < 4; c++) {
        // 0 bottom-left, 1 bottom-right, 2 top-right, 3 top-left — the winding
        // the index buffer above was built for.
        const sx = c === 0 || c === 3 ? -hw : hw
        const sy = c < 2 ? -hh : hh
        positions[o + c * 3] = cx + right.x * sx + up.x * sy
        positions[o + c * 3 + 1] = cy + right.y * sx + up.y * sy
        positions[o + c * 3 + 2] = cz + right.z * sx + up.z * sy
      }
    })
    plateGeo.attributes.position.needsUpdate = true
  }

  return { group, update, count: crew.length }
}
