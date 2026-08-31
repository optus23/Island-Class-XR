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
export const PATH_FLATTEN_RADIUS = 7
export const TIER = 4 // height step for off-path plateaus
export const QUANT = 0.5 // near-path height step — finer, to match the finer grid
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

/** Nearest point on a polyline, with its height — the height drives plateaus. */
function nearestOnPolyline(x, z, pts) {
  let bestDist = Infinity
  let bestY = 0
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
    if (d < bestDist) {
      bestDist = d
      bestY = a.y + t * (b.y - a.y)
    }
  }
  return { dist: bestDist, y: bestY }
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
  let best = { dist: Infinity, y: 0 }
  for (const pts of polylines().paths) {
    const hit = nearestOnPolyline(x, z, pts)
    if (hit.dist < best.dist) best = hit
  }
  return best
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

/** How far inside the coastline (x, z) sits. <= 0 means open water. */
export function landInset(x, z) {
  const inWorld = Math.max(...worlds.map((w) => worldInset(x, z, w.center)))
  const inBridge = BRIDGE_HALF_WIDTH - nearestBridge(x, z)
  return Math.max(inWorld, inBridge)
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
export function groundHeightAt(x, z) {
  const inside = landInset(x, z)
  if (inside <= 0) return SHELF_Y

  const path = nearestPath(x, z)
  const away = Math.min(1, Math.max(0, (path.dist - PATH_FLATTEN_RADIUS) / 14))
  const shore = Math.min(1, inside / 4)
  const hill = Math.max(0, smoothNoise(x * 0.045, z * 0.045) - 0.5) * 9

  const coastal = 1 - Math.min(1, inside / 9)
  const drop = coastal * away
  const grounded = path.y * (1 - drop) + SHELF_Y * drop

  const raw = grounded + hill * away * shore
  // ALWAYS quantised. Continuous ground made every cell a hair taller than its
  // neighbour, exposing thin dark slivers of rock between columns that read as
  // scratches across the grass. Coarse steps far from the route, fine steps
  // near it so the path can still climb.
  const step = away > 0.75 ? TIER : QUANT
  return Math.round(raw / step) * step
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
export function biomeKeyAt(x) {
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
