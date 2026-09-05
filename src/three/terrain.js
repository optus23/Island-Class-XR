import * as THREE from 'three'
import { worlds, worldAtX } from '../config/worlds.js'
import { buildWorldCurves, buildConnectors } from './paths.js'

/**
 * The single source of truth for "how high is the ground at (x, z)".
 *
 * This used to live inside the island builder, which meant nothing else could
 * ask. Anything placed on the map therefore had to GUESS its height — optional
 * nodes copied their anchor's Y, which buried them whenever their sideways
 * offset landed on a taller plateau. Every placed object now anchors through
 * groundHeightAt() instead, so that whole class of bug is gone.
 *
 * The island mesh is built from exactly these functions, so the geometry and
 * the anchoring can never disagree.
 */

/**
 * Terrain resolution, chosen per device.
 *
 * A finer grid looks markedly better but multiplies triangle count by four
 * each time it halves, and that lands on the GPU of whatever phone a student
 * happens to own. Coarse on small/low-memory devices, fine on desktop.
 */
function pickVoxelSize() {
  if (typeof window === 'undefined') return 1 // node (validate script)
  const mem = navigator.deviceMemory ?? 8
  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches
  const small = Math.min(window.innerWidth, window.innerHeight) < 700
  if (mem <= 4 || (coarsePointer && small)) return 2
  return 1
}

export const VOXEL = pickVoxelSize()
/** Props are placed per cell, so their density must be corrected for it. */
export const CELL_AREA_SCALE = (VOXEL * VOXEL) / 4
export const MARGIN = 42 // half-extent of a world's footprint, X
export const MARGIN_Z = 46 // half-extent, Z — deep enough that the back edge is off-frame
export const BRIDGE_HALF_WIDTH = 7
export const PATH_FLATTEN_RADIUS = 13 // wide flat shelf, so the road never crosses a contour
export const TIER = 4 // height step for off-path plateaus

/**
 * Height step near the route.
 *
 * This used to be 0.5, which was the whole "artefacts along the path" problem.
 * The height field varies slowly, so a fine step turned every gentle gradient
 * into a fan of one-voxel terraces radiating away from the road; their shaded
 * side faces read as scratches drawn across the grass. Nothing was
 * z-fighting — the map was genuinely built that way.
 *
 * A coarse step gives few, tall terraces instead, which is how the reference
 * art reads: flat plateaus joined by deliberate steps. It is a factor of TIER
 * so the near and far grids line up instead of interleaving.
 */
export const PLATEAU = 2
export const QUANT = PLATEAU // kept for callers that still import the old name
export const SHELF_Y = 3.2 // coastal shelf — high enough that the island sits ON the sea
export const BASE_Y = -9 // every column runs down to here

/** Cheap deterministic hash noise — no dependency, stable across reloads. */
export function hash2(x, z) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453
  return s - Math.floor(s)
}

export function smoothNoise(x, z) {
  const xi = Math.floor(x)
  const zi = Math.floor(z)
  const xf = x - xi
  const zf = z - zi
  const u = xf * xf * (3 - 2 * xf)
  const v = zf * zf * (3 - 2 * zf)
  return (
    hash2(xi, zi) * (1 - u) * (1 - v) +
    hash2(xi + 1, zi) * u * (1 - v) +
    hash2(xi, zi + 1) * (1 - u) * v +
    hash2(xi + 1, zi + 1) * u * v
  )
}

/**
 * How far around a point the road's LOWEST height is taken.
 *
 * See `lowY` below: this is what stops a change of plateau from slicing the
 * road lengthways at a corner.
 */
const SHELF_LOOK = 5.5

/**
 * Nearest point on a polyline, with its height — the height drives plateaus.
 *
 * Also returns `lowY`: the lowest road height found anywhere within
 * SHELF_LOOK of the query point.
 *
 * That second number is the whole fix for the terrain eating the road. Ground
 * follows the height of the NEAREST piece of road, and at a 90-degree corner
 * the set of points nearest to each arm meets along the bisector — a diagonal
 * running clean across the bend. Where the two arms sit on different plateaus,
 * that diagonal became a two-unit wall through the middle of the road and
 * through the node standing on it. Taking the lowest road height in the
 * neighbourhood instead makes the corner settle on the lower of its two
 * plateaus, so the step retreats onto the high arm and crosses the road
 * squarely, where the stairs can carry it.
 */
function nearestOnPolyline(x, z, pts) {
  let bestDist = Infinity
  let bestY = 0
  let lowY = Infinity
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]
    const b = pts[i]
    const dx = b.x - a.x
    const dz = b.z - a.z
    const len2 = dx * dx + dz * dz
    let t = len2 === 0 ? 0 : ((x - a.x) * dx + (z - a.z) * dz) / len2
    t = t < 0 ? 0 : t > 1 ? 1 : t
    const px = a.x + t * dx
    const pz = a.z + t * dz
    const d = Math.hypot(x - px, z - pz)
    const y = a.y + t * (b.y - a.y)
    if (d < bestDist) {
      bestDist = d
      bestY = y
    }
    if (d < SHELF_LOOK && y < lowY) lowY = y
  }
  return { dist: bestDist, y: bestY, lowY: lowY === Infinity ? bestY : lowY }
}

// Sampled once, lazily — the curves never change at runtime.
let cache = null
function polylines() {
  if (cache) return cache
  const paths = []
  const bridges = []
  for (const w of worlds) paths.push(buildWorldCurves(w).full.getSpacedPoints(200))
  for (const c of buildConnectors()) {
    const pts = c.getSpacedPoints(56)
    paths.push(pts)
    bridges.push(pts)
  }
  cache = { paths, bridges }
  return cache
}

export function nearestPath(x, z) {
  let best = { dist: Infinity, y: 0, lowY: 0 }
  let lowY = Infinity
  for (const pts of polylines().paths) {
    const hit = nearestOnPolyline(x, z, pts)
    if (hit.dist < best.dist) best = hit
    // Across every path, not just the nearest one: where two runs of road pass
    // close by at different heights, the ground between them has to settle on
    // the lower, or one of them ends up buried in the other's plateau.
    if (hit.dist < SHELF_LOOK && hit.lowY < lowY) lowY = hit.lowY
  }
  return lowY === Infinity ? best : { ...best, lowY }
}

function nearestBridge(x, z) {
  let best = Infinity
  for (const pts of polylines().bridges) {
    const d = nearestOnPolyline(x, z, pts).dist
    if (d < best) best = d
  }
  return best
}

/** Rounded-rectangle footprint for one world, as an inside-ness in world units. */
function worldInset(x, z, center) {
  // Big corner radius: the footprint is closer to a rounded blob than a
  // rectangle, so the island never presents a hard 90-degree corner to the sea.
  const R = 20
  const dx = Math.abs(x - center[0]) - (MARGIN - R)
  const dz = Math.abs(z - center[2]) - (MARGIN_Z - R)
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dz, 0))

  // Two octaves of wobble at different scales: the low one carves broad bays
  // and headlands, the high one keeps the shoreline from reading as a smooth
  // machine curve. Together they give the coast an organic, drawn feel rather
  // than the boxy silhouette it had.
  const broad = (smoothNoise(x * 0.018, z * 0.018) - 0.5) * 26
  const fine = (smoothNoise(x * 0.075, z * 0.075) - 0.5) * 7
  return R - outside + broad + fine
}


/**
 * Two small crossings on the route, one at each seam between worlds.
 *
 * NEITHER cuts the island in half. An earlier attempt ran a river from edge to
 * edge and split the map into three separate landmasses, which is a different
 * place entirely — the reference art keeps one island and puts small local
 * features ON it: a stretch of water that begins and ends inland, a gap in the
 * ground, each crossed by a short bridge a couple of paces long.
 *
 * Both are lens-shaped: narrow across the road, so the bridge stays tiny, and
 * long along it, so the feature reads as a river or a chasm rather than a
 * puddle. The edge wobbles, so neither is a drawn oval.
 */
const CROSSINGS = [
  // Round, like a big well, and no two alike: different sizes, and each set
  // off from its crossing in a different direction so the pair never reads as
  // one feature mirrored across the map.
  { kind: 'water', halfX: 4.0, halfZ: 4.7, offX: 0, offZ: 2.5 },
  { kind: 'void', halfX: 5.0, halfZ: 5.6, offX: 1.5, offZ: -3.5 },
]

/** How far from a connector the missing ground still counts as bridged. */
export const BRIDGE_DECK_REACH = 5

/**
 * Where each crossing sits, taken from the connectors themselves so the
 * feature and the bridge over it can never disagree.
 */
let crossingsCache = null
export function crossings() {
  if (!crossingsCache) {
    crossingsCache = buildConnectors().map((c, i) => {
      const a = c.getPointAt(0)
      const b = c.getPointAt(1)
      const spec = CROSSINGS[i % CROSSINGS.length]
      return { ...spec, x: (a.x + b.x) / 2 + spec.offX, z: a.z + spec.offZ }
    })
  }
  return crossingsCache
}

/**
 * How deep into a crossing (x, z) sits, in world units across the road.
 * <= 0 is solid ground.
 */
function crossingCut(x, z) {
  let best = -Infinity
  for (const c of crossings()) {
    const nx = (x - c.x) / c.halfX
    const nz = (z - c.z) / c.halfZ
    const r = Math.hypot(nx, nz)
    // Wobble the rim so it reads as something worn into the ground rather than
    // stamped out of it.
    const rim = 1 + (smoothNoise(x * 0.11, z * 0.11) - 0.5) * 0.28
    const d = (rim - r) * c.halfX
    if (d > best) best = d
  }
  return best
}

/** The crossings you can fall into rather than swim in. */
export function voidCrossings() {
  return crossings().filter((c) => c.kind === 'void')
}

/** How far inside the coastline (x, z) sits. <= 0 means open water. */
export function landInset(x, z) {
  const inWorld = Math.max(...worlds.map((w) => worldInset(x, z, w.center)))
  const inBridge = BRIDGE_HALF_WIDTH - nearestBridge(x, z)
  const base = Math.max(inWorld, inBridge)

  // A crossing only ever REMOVES ground; it can never make open sea
  // shallower. Returning its own depth outright would tell the foam field
  // that points far out to sea were a few units from a shore.
  const cut = crossingCut(x, z)
  return cut > 0 ? Math.min(base, -cut) : base
}

export function isLand(x, z) {
  return landInset(x, z) > 0
}

/**
 * Top surface of the ground at (x, z), in world units.
 *
 * Ground sits at the height of the nearest path, so a wide flat terrace
 * surrounds the route; further out it drops toward a coastal shelf and steps
 * into coarse plateaus.
 */
/**
 * Flat pads carved around the session discs.
 *
 * A node stands on the road, and inside PATH_FLATTEN_RADIUS the ground is the
 * shelf of the LOWEST road nearby — but on a switchback the cell beside a node
 * can belong to a DIFFERENT run of the route, one plateau higher. Its column
 * then rises a couple of units right at the disc's edge and leans over it, and
 * you get a lump of ground floating above the session circle. Seven nodes were
 * doing it.
 *
 * So each on-path node clamps the ground around itself to its own shelf. Only
 * ever downward: a pad, never a pedestal.
 *
 * Registered before the island mesh is built, by whoever knows where the nodes
 * are — terrain must not import level data, so it cannot work them out itself.
 */
const clearings = []

/**
 * @param {Array<{x:number, z:number, r:number}>} points
 */
export function clearGroundAround(points) {
  clearings.length = 0
  for (const p of points) {
    // Height sampled with the registry EMPTY, so a pad can never be defined in
    // terms of another pad.
    clearings.push({ x: p.x, z: p.z, r2: p.r * p.r, y: groundHeightAt(p.x, p.z) })
  }
}

export function groundHeightAt(x, z) {
  const inside = landInset(x, z)
  if (inside <= 0) {
    // Over the channel the road is still level: a bridge deck carries it
    // across at the height of the land on both banks. Everywhere else out to
    // sea, the coastal shelf.
    const span = nearestPath(x, z)
    if (span.dist < BRIDGE_DECK_REACH) return Math.round(span.lowY / PLATEAU) * PLATEAU
    return SHELF_Y
  }

  const path = nearestPath(x, z)

  // Snap the PATH's own height to the plateau grid before anything else.
  // A run that ramps from 0 to 4 used to drag the surrounding ground up with
  // it continuously, so the corridor itself was terraced into a fine staircase
  // crossing the road. Snapped first, each stretch of route sits on one flat
  // shelf and the climb happens at a small number of clean steps.
  //
  // From the LOWEST road height nearby rather than the nearest one — see
  // nearestOnPolyline for why the nearest one cut the road in half at corners.
  const shelf = Math.round(path.lowY / PLATEAU) * PLATEAU

  const away = Math.min(1, Math.max(0, (path.dist - PATH_FLATTEN_RADIUS) / 16))
  const shore = Math.min(1, inside / 4)
  const hill = Math.max(0, smoothNoise(x * 0.045, z * 0.045) - 0.5) * 9

  const coastal = 1 - Math.min(1, inside / 9)
  const drop = coastal * away
  const grounded = shelf * (1 - drop) + SHELF_Y * drop

  const raw = grounded + hill * away * shore
  // One step for the whole island. Mixing a fine step near the route with a
  // coarse one further out put a seam wherever the two grids disagreed, on top
  // of the contour fan the fine step created in the first place.
  const step = away > 0.8 ? TIER : PLATEAU
  const height = Math.round(raw / step) * step

  // Nothing may stand above a session disc. Downward only.
  for (const c of clearings) {
    const dx = x - c.x
    const dz = z - c.z
    if (dx * dx + dz * dz <= c.r2 && height > c.y) return c.y
  }
  return height
}

/** How far the road's surface floats above the ground it covers. */
export const ROAD_LIFT = 0.44
/** Half-width of the road's footprint, used when sampling the ground under it. */
export const ROAD_FOOT = 1.6

/**
 * Height of the walkable ROAD surface at (x, z) — not the raw ground.
 *
 * The ribbon takes the HIGHEST ground under its whole width so it never slices
 * into a terrace, which means the road sits above the ground directly beneath
 * its centre wherever it runs along the lip of a step. Anything that walks the
 * road has to use this same number, or it sinks: the patrolling creatures were
 * buried to the waist for exactly this reason, having anchored to the centre
 * sample alone.
 */
export function roadTopAt(x, z) {
  return (
    Math.max(
      groundHeightAt(x, z),
      groundHeightAt(x + ROAD_FOOT, z),
      groundHeightAt(x - ROAD_FOOT, z),
      groundHeightAt(x, z + ROAD_FOOT),
      groundHeightAt(x, z - ROAD_FOOT)
    ) + ROAD_LIFT
  )
}

/**
 * Drop an object onto the ground. THE way anything gets its Y — never copy a
 * neighbour's height and hope.
 * @param {THREE.Vector3} v mutated in place
 * @param {number} lift how far above the surface to sit
 */
export function anchorToGround(v, lift = 0) {
  v.y = groundHeightAt(v.x, v.z) + lift
  return v
}

/** Which biome owns a column. Shared by terrain, road and props. */
/**
 * How wide the mixing zone is, in world units, either side of a seam, and how
 * far the seam itself meanders back and forth along Z.
 *
 * A world is 58 units across, so 9 means roughly the last sixth of one biome
 * interleaves with the first sixth of the next. Wider than about 14 and the
 * island stops reading as three places.
 */
const BLEND_WIDTH = 9
const BLEND_WOBBLE = 5.5

/** The seams, left to right: the X where one world hands over to the next. */
const seams = [...worlds]
  .sort((a, b) => a.center[0] - b.center[0])
  .slice(0, -1)
  .map((w, i, all) => {
    const next = [...worlds].sort((a, b) => a.center[0] - b.center[0])[i + 1]
    return { x: (w.center[0] + next.center[0]) / 2, left: w.biome, right: next.biome }
  })

/**
 * Which biome dresses the ground at (x, z).
 *
 * NOT a straight line. `worldAtX` picks by nearest centre, which is exactly a
 * vertical cut in X, and three of those made the island read as three slabs
 * stacked side by side. Near a seam the choice is made per column instead, so
 * snow reaches down into the desert and sand climbs into the snow, and the two
 * interlock rather than meet.
 *
 * Three terms, coarse to fine, and each one is doing a different job:
 *   - the seam itself wanders in Z, so the join is not straight even before
 *     anything mixes;
 *   - a mid-frequency term throws fingers and islands of one biome across it;
 *   - a per-column hash salts single voxels at the far edges, which is what
 *     makes it read as interleaved rather than as a wobbly line.
 *
 * MUST STAY DETERMINISTIC AND POSITION-ONLY. The terrain cells, the props
 * planted on them and the backdrop all call this separately; the moment it
 * disagrees with itself you get cactus growing on grass.
 */
export function biomeKeyAt(x, z = 0) {
  for (let i = 0; i < seams.length; i++) {
    const seam = seams[i]
    const wobble = (smoothNoise(z / 27 + i * 13, i * 37.5) - 0.5) * 2 * BLEND_WOBBLE
    const d = (x - (seam.x + wobble)) / BLEND_WIDTH
    if (d <= -1.6 || d >= 1.6) continue // clear of this seam

    const mix =
      (smoothNoise(x / 6.5 + i * 19, z / 6.5 + 3) - 0.5) * 1.5 +
      (smoothNoise(x / 2.6 + 41, z / 2.6 + 17) - 0.5) * 0.7 +
      (hash2(x * 1.7 + i, z * 1.9) - 0.5) * 0.35
    return d + mix > 0 ? seam.right : seam.left
  }
  return worldAtX(x).biome
}

/** Bounds of the whole island footprint. */
export function islandBounds() {
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const w of worlds) {
    minX = Math.min(minX, w.center[0] - MARGIN)
    maxX = Math.max(maxX, w.center[0] + MARGIN)
    minZ = Math.min(minZ, w.center[2] - MARGIN_Z)
    maxZ = Math.max(maxZ, w.center[2] + MARGIN_Z)
  }
  return { minX, maxX, minZ, maxZ }
}

/**
 * A coarse field of "how far is land from here", baked once into a texture the
 * water shader can sample.
 *
 * This is what lets foam live in the SHADER rather than being hand-placed
 * blocks around the coast. Those blocks read as exactly what they were —
 * cubes someone laid out by hand — and could not animate with the waves.
 *
 * Red channel: 1 at the shoreline, falling to 0 by FOAM_REACH units offshore.
 * A 256-wide field over a ~250-unit island is roughly one texel per unit,
 * which is ample for a soft foam band.
 */
export const FOAM_REACH = 9

export function buildShoreField(size = 256) {
  const { minX, maxX, minZ, maxZ } = islandBounds()
  const pad = 24
  const x0 = minX - pad
  const x1 = maxX + pad
  const z0 = minZ - pad
  const z1 = maxZ + pad

  const data = new Uint8Array(size * size)
  for (let j = 0; j < size; j++) {
    const z = z0 + ((j + 0.5) / size) * (z1 - z0)
    for (let i = 0; i < size; i++) {
      const x = x0 + ((i + 0.5) / size) * (x1 - x0)
      const inset = landInset(x, z)
      // Only water matters; inset > 0 is land and is hidden by the island.
      const dist = inset > 0 ? 0 : -inset
      const v = 1 - Math.min(1, dist / FOAM_REACH)
      data[j * size + i] = Math.round(v * 255)
    }
  }

  return { data, size, bounds: { x0, x1, z0, z1 } }
}
