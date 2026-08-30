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

export const VOXEL = 2 // world units per terrain column
export const MARGIN = 42 // half-extent of a world's footprint, X
export const MARGIN_Z = 34 // half-extent, Z
export const BRIDGE_HALF_WIDTH = 7
export const PATH_FLATTEN_RADIUS = 7
export const TIER = 4 // height step for off-path plateaus
export const QUANT = 1 // near-path height step — never leave ground continuous
export const SHELF_Y = 1.5 // low coastal shelf that plateaus rise out of
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
  const dx = Math.abs(x - center[0]) - (MARGIN - 8)
  const dz = Math.abs(z - center[2]) - (MARGIN_Z - 8)
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dz, 0))
  return 8 - outside
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
