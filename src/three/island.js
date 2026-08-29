import * as THREE from 'three'
import { worlds } from '../config/worlds.js'
import { world as themeWorld } from '../config/theme.js'
import { buildWorldCurves, buildConnectors } from './paths.js'

/**
 * The voxel island: one InstancedMesh for the terrain columns, one for the
 * decorative props, one water plane. Three draw calls for the whole landmass.
 *
 * Terrain is generated from a land mask (world footprints + the land bridges
 * between them) so the three worlds read as a single connected island. Ground
 * under and near a path is flattened, so nodes never sit on a slope.
 */

const VOXEL = 2 // world units per terrain column
const MARGIN = 26 // half-extent of a world's footprint, X
const MARGIN_Z = 22 // half-extent, Z
const BRIDGE_HALF_WIDTH = 6.5
const PATH_FLATTEN_RADIUS = 6.5

/** Cheap deterministic hash noise — no dependency, stable across reloads. */
function hash2(x, z) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453
  return s - Math.floor(s)
}
function smoothNoise(x, z) {
  const xi = Math.floor(x)
  const zi = Math.floor(z)
  const xf = x - xi
  const zf = z - zi
  const u = xf * xf * (3 - 2 * xf)
  const v = zf * zf * (3 - 2 * zf)
  const a = hash2(xi, zi)
  const b = hash2(xi + 1, zi)
  const c = hash2(xi, zi + 1)
  const d = hash2(xi + 1, zi + 1)
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v
}

/** Distance from a point to the nearest segment of a polyline. */
function distanceToPolyline(x, z, pts) {
  let best = Infinity
  for (let i = 1; i < pts.length; i++) {
    const ax = pts[i - 1].x
    const az = pts[i - 1].z
    const bx = pts[i].x
    const bz = pts[i].z
    const dx = bx - ax
    const dz = bz - az
    const len2 = dx * dx + dz * dz
    let t = len2 === 0 ? 0 : ((x - ax) * dx + (z - az) * dz) / len2
    t = t < 0 ? 0 : t > 1 ? 1 : t
    const px = ax + t * dx
    const pz = az + t * dz
    const d = Math.hypot(x - px, z - pz)
    if (d < best) best = d
  }
  return best
}

/** Rounded-rectangle footprint for one world, as an inside-ness in world units. */
function worldInset(x, z, center) {
  const dx = Math.abs(x - center[0]) - (MARGIN - 6)
  const dz = Math.abs(z - center[2]) - (MARGIN_Z - 6)
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dz, 0))
  return 6 - outside // >0 inside, tapering at the rounded edge
}

export function createIsland() {
  const group = new THREE.Group()

  // Sample every path (and the bridges) once, for flattening + the land mask.
  const pathPoints = []
  const bridgePolylines = []
  for (const w of worlds) {
    pathPoints.push(buildWorldCurves(w).full.getSpacedPoints(120))
  }
  for (const c of buildConnectors()) {
    const pts = c.getSpacedPoints(40)
    pathPoints.push(pts)
    bridgePolylines.push(pts)
  }

  const nearestPath = (x, z) => Math.min(...pathPoints.map((p) => distanceToPolyline(x, z, p)))
  const nearestBridge = (x, z) =>
    bridgePolylines.length
      ? Math.min(...bridgePolylines.map((p) => distanceToPolyline(x, z, p)))
      : Infinity

  // --- land mask + heights -------------------------------------------------
  const cells = []
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

  for (let x = minX; x <= maxX; x += VOXEL) {
    for (let z = minZ; z <= maxZ; z += VOXEL) {
      const inWorld = Math.max(...worlds.map((w) => worldInset(x, z, w.center)))
      const bridgeDist = nearestBridge(x, z)
      const inBridge = BRIDGE_HALF_WIDTH - bridgeDist
      const inside = Math.max(inWorld, inBridge)
      if (inside <= 0) continue

      const pathDist = nearestPath(x, z)
      // Hills only well away from the path, and they fade out at the shoreline
      // so the island never ends in a floating cliff.
      const awayFromPath = Math.min(1, Math.max(0, (pathDist - PATH_FLATTEN_RADIUS) / 9))
      const shore = Math.min(1, inside / 5)
      const hill = (smoothNoise(x * 0.09, z * 0.09) - 0.35) * 5.2
      const height = Math.max(0, hill) * awayFromPath * shore

      cells.push({ x, z, height: Math.round(height / 0.5) * 0.5, pathDist, shore })
    }
  }

  // --- terrain InstancedMesh ----------------------------------------------
  const COLUMN_DEPTH = 7 // how far the land extends below sea level
  const geo = new THREE.BoxGeometry(VOXEL, 1, VOXEL)
  // NOT vertexColors: true. An InstancedMesh's per-instance colours arrive via
  // `instanceColor`, which three wires up on its own. Setting vertexColors also
  // makes the shader multiply by a per-VERTEX `color` attribute that a
  // BoxGeometry does not have — it defaults to black and eats every colour.
  const mat = new THREE.MeshLambertMaterial()
  const terrain = new THREE.InstancedMesh(geo, mat, cells.length)
  terrain.instanceMatrix.setUsage(THREE.StaticDrawUsage)

  const m = new THREE.Matrix4()
  const grass = new THREE.Color(themeWorld.terrain)
  const grassEdge = new THREE.Color(themeWorld.terrainEdge)
  const cliff = new THREE.Color(themeWorld.cliff)
  const tint = new THREE.Color()

  cells.forEach((c, i) => {
    const top = c.height
    const h = top + COLUMN_DEPTH
    m.makeScale(1, h, 1)
    m.setPosition(c.x, top - h / 2, c.z)
    terrain.setMatrixAt(i, m)

    // Shoreline reads as sandy cliff, inland as grass, with a touch of noise
    // so large flat areas do not band.
    const t = 1 - Math.min(1, c.shore)
    tint.copy(grass).lerp(grassEdge, hash2(c.x, c.z) * 0.35)
    tint.lerp(cliff, t * 0.85)
    terrain.setColorAt(i, tint)
  })
  terrain.instanceMatrix.needsUpdate = true
  if (terrain.instanceColor) terrain.instanceColor.needsUpdate = true
  terrain.frustumCulled = false
  group.add(terrain)

  // --- water ---------------------------------------------------------------
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry((maxX - minX) * 2.2, (maxZ - minZ) * 3.2),
    new THREE.MeshLambertMaterial({ color: themeWorld.water })
  )
  water.rotation.x = -Math.PI / 2
  water.position.set((minX + maxX) / 2, -1.6, (minZ + maxZ) / 2)
  group.add(water)

  // --- decorative props ----------------------------------------------------
  group.add(createProps(cells))

  return { group, terrain, cells }
}

/**
 * Trees and rocks, well clear of the path so they never hide a node.
 * Two InstancedMeshes, both driven off the same terrain cells.
 */
function createProps(cells) {
  const props = new THREE.Group()
  const candidates = cells.filter((c) => c.pathDist > 9 && c.shore > 0.8)

  const trunks = []
  const leaves = []
  const rocks = []
  for (const c of candidates) {
    const r = hash2(c.x * 3.3, c.z * 7.7)
    if (r > 0.955) trunks.push(c)
    else if (r < 0.022) rocks.push(c)
  }
  leaves.push(...trunks)

  const push = (list, geom, color, scaleFn, yFn) => {
    if (!list.length) return
    const mesh = new THREE.InstancedMesh(
      geom,
      new THREE.MeshLambertMaterial({ color }),
      list.length
    )
    const mm = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const s = new THREE.Vector3()
    const p = new THREE.Vector3()
    list.forEach((c, i) => {
      const k = scaleFn(c)
      s.set(k.x, k.y, k.z)
      p.set(c.x, c.height + yFn(c, k), c.z)
      mm.compose(p, q, s)
      mesh.setMatrixAt(i, mm)
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.frustumCulled = false
    props.add(mesh)
  }

  const box = new THREE.BoxGeometry(1, 1, 1)
  push(
    trunks,
    box,
    0x8b5e34,
    () => ({ x: 0.7, y: 1.8, z: 0.7 }),
    (_, k) => k.y / 2
  )
  push(
    leaves,
    box,
    0x3f9142,
    (c) => {
      const w = 2.2 + hash2(c.z, c.x) * 0.9
      return { x: w, y: w * 0.85, z: w }
    },
    (_, k) => 1.8 + k.y / 2 - 0.25
  )
  push(
    rocks,
    box,
    0x8d99ae,
    (c) => {
      const w = 1 + hash2(c.x * 1.7, c.z * 1.3) * 0.8
      return { x: w, y: w * 0.7, z: w }
    },
    (_, k) => k.y / 2
  )

  return props
}
