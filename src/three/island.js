import * as THREE from 'three'
import { worlds, worldAtX } from '../config/worlds.js'
import { world as themeWorld, biomes, backdrop, flowers } from '../config/theme.js'
import { buildWorldCurves, buildConnectors } from './paths.js'

/**
 * The voxel island.
 *
 * Verticality is the point: ground height follows the height of the nearest
 * path, so raising a control point in worlds.js lifts a whole plateau and the
 * route climbs onto it. Cliffs then appear on their own wherever two plateaus
 * of different heights meet, and around the whole coastline.
 *
 * Each column is drawn as three stacked boxes — a grass/sand/snow CAP, a bright
 * BAND just under the lip, and the ROCK body below. That three-tone stack is
 * what makes a plateau read as a plateau instead of a coloured slab.
 *
 * Three InstancedMeshes for the terrain, whatever the island's size.
 */

const VOXEL = 2 // world units per terrain column
// Footprints deliberately OVERLAP (centres are 58 apart, half-extent is 34),
// so the three worlds fuse into one unbroken landmass. The old gaps only
// existed to justify the camera cutting between fixed positions; the follow
// camera has no cuts, so the island has no seams.
const MARGIN = 34 // half-extent of a world's footprint, X
const MARGIN_Z = 22 // half-extent, Z
const BRIDGE_HALF_WIDTH = 6.5
const PATH_FLATTEN_RADIUS = 7
const TIER = 4 // height step for off-path plateaus
const SHELF_Y = 1.5 // low coastal shelf that high plateaus rise out of

const CAP_HEIGHT = 1.1 // the walkable top
const BAND_HEIGHT = 1.4 // bright stripe below the lip
const BASE_Y = -9 // every column runs down to here, well below the water

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
  return (
    hash2(xi, zi) * (1 - u) * (1 - v) +
    hash2(xi + 1, zi) * u * (1 - v) +
    hash2(xi, zi + 1) * (1 - u) * v +
    hash2(xi + 1, zi + 1) * u * v
  )
}

/**
 * Nearest point on a polyline, returning its height as well as the distance —
 * the height is what drives the plateaus.
 */
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

/** Rounded-rectangle footprint for one world, as an inside-ness in world units. */
function worldInset(x, z, center) {
  const dx = Math.abs(x - center[0]) - (MARGIN - 6)
  const dz = Math.abs(z - center[2]) - (MARGIN_Z - 6)
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dz, 0))
  return 6 - outside
}

/** Which world's biome owns this column. Shared with the road, so the terrain
 * and the road change biome at exactly the same boundary. */
function biomeAt(x) {
  return biomes[worldAtX(x).biome] ?? biomes.meadow
}

export function createIsland() {
  const group = new THREE.Group()

  // Sample every path (and the bridges) once — they drive both the land mask
  // and the terrain height.
  const pathPolylines = []
  const bridgePolylines = []
  for (const w of worlds) {
    pathPolylines.push(buildWorldCurves(w).full.getSpacedPoints(160))
  }
  for (const c of buildConnectors()) {
    const pts = c.getSpacedPoints(48)
    pathPolylines.push(pts)
    bridgePolylines.push(pts)
  }

  function nearestPath(x, z) {
    let best = { dist: Infinity, y: 0 }
    for (const pts of pathPolylines) {
      const hit = nearestOnPolyline(x, z, pts)
      if (hit.dist < best.dist) best = hit
    }
    return best
  }
  function nearestBridge(x, z) {
    let best = Infinity
    for (const pts of bridgePolylines) {
      const d = nearestOnPolyline(x, z, pts).dist
      if (d < best) best = d
    }
    return best
  }

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
      const inBridge = BRIDGE_HALF_WIDTH - nearestBridge(x, z)
      const inside = Math.max(inWorld, inBridge)
      if (inside <= 0) continue

      const path = nearestPath(x, z)

      // Ground sits at the path's height, so a wide flat terrace surrounds the
      // whole route and nodes never end up on a slope.
      const away = Math.min(1, Math.max(0, (path.dist - PATH_FLATTEN_RADIUS) / 14))
      const shore = Math.min(1, inside / 4)

      // Big, low-frequency mounds only. Earlier this was strong high-frequency
      // noise, and quantising it turned the whole island into corduroy instead
      // of the few clean plateaus the reference has.
      const hill = Math.max(0, smoothNoise(x * 0.045, z * 0.045) - 0.5) * 9

      // Drop toward a low shelf as the coast approaches, but only well away
      // from the route. Without this a high path lifts the ENTIRE footprint
      // into one enormous slab; with it, plateaus stay local and are ringed by
      // low ground, which is what makes them read as mesas.
      const coastal = 1 - Math.min(1, inside / 9)
      const drop = coastal * away
      const grounded = path.y * (1 - drop) + SHELF_Y * drop

      // Coarse steps far from the path give the stacked Mario silhouette;
      // near the path the ground stays continuous so the route can ramp.
      const raw = grounded + hill * away * shore
      const height = away > 0.75 ? Math.round(raw / TIER) * TIER : raw

      cells.push({ x, z, height, pathDist: path.dist, shore, biome: biomeAt(x) })
    }
  }

  // --- terrain: cap + band + rock body ------------------------------------
  const box = new THREE.BoxGeometry(VOXEL, 1, VOXEL)
  const makeLayer = (count) => {
    // No vertexColors: per-instance colour arrives via instanceColor, and
    // enabling vertexColors would multiply it by a missing per-vertex
    // attribute that defaults to black.
    const mesh = new THREE.InstancedMesh(box, new THREE.MeshLambertMaterial(), count)
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage)
    mesh.frustumCulled = false
    return mesh
  }

  const caps = makeLayer(cells.length)
  const bands = makeLayer(cells.length)
  const bodies = makeLayer(cells.length)

  const m = new THREE.Matrix4()
  const tint = new THREE.Color()
  const tmp = new THREE.Color()

  cells.forEach((c, i) => {
    const b = c.biome
    const top = c.height

    // cap
    m.makeScale(1, CAP_HEIGHT, 1)
    m.setPosition(c.x, top - CAP_HEIGHT / 2, c.z)
    caps.setMatrixAt(i, m)
    tint.setHex(b.ground).lerp(tmp.setHex(b.groundAlt), hash2(c.x, c.z) * 0.6)
    caps.setColorAt(i, tint)

    // bright band under the lip
    const bandTop = top - CAP_HEIGHT
    m.makeScale(1, BAND_HEIGHT, 1)
    m.setPosition(c.x, bandTop - BAND_HEIGHT / 2, c.z)
    bands.setMatrixAt(i, m)
    bands.setColorAt(i, tint.setHex(b.band))

    // rock body down to the base
    const bodyTop = bandTop - BAND_HEIGHT
    const bodyH = Math.max(0.1, bodyTop - BASE_Y)
    m.makeScale(1, bodyH, 1)
    m.setPosition(c.x, bodyTop - bodyH / 2, c.z)
    bodies.setMatrixAt(i, m)
    // Deeper columns darken, so tall cliff faces gain depth.
    tint.setHex(b.rock).lerp(tmp.setHex(b.rockDeep), Math.min(1, bodyH / 22))
    bodies.setColorAt(i, tint)
  })

  for (const layer of [caps, bands, bodies]) {
    layer.instanceMatrix.needsUpdate = true
    if (layer.instanceColor) layer.instanceColor.needsUpdate = true
    group.add(layer)
  }

  // --- water ---------------------------------------------------------------
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry((maxX - minX) * 2.4, (maxZ - minZ) * 3.4),
    new THREE.MeshLambertMaterial({ color: themeWorld.water })
  )
  water.rotation.x = -Math.PI / 2
  water.position.set((minX + maxX) / 2, -2.2, (minZ + maxZ) / 2)
  group.add(water)

  group.add(createProps(cells))
  group.add(createBackdrop(minX, maxX, minZ))

  return { group, terrain: caps, cells }
}

/**
 * Rows of soft pastel mounds standing behind the island.
 *
 * Without them the map reads as a diorama floating in empty sky; the reference
 * art always has a wall of hills behind the play area. Each mound is a small
 * ziggurat of stacked boxes, which keeps the voxel language while still
 * reading as a rounded hill from the map's fixed angles.
 *
 * Two rows: a near one at full colour and a far one pushed back, where the
 * scene fog thins it out into aerial perspective for free.
 */
function createBackdrop(minX, maxX, minZ) {
  const group = new THREE.Group()
  const sky = new THREE.Color(themeWorld.sky)
  const mounds = []

  /**
   * @param zBase how far behind the island this row sits
   * @param scale overall size multiplier
   * @param step  spacing between mounds
   * @param haze  0..1 blend toward the sky colour — cheap aerial perspective,
   *              so the far row reads as distance rather than as more island
   */
  const row = (zBase, scale, step, haze) => {
    for (let x = minX - 30; x <= maxX + 30; x += step) {
      const r = hash2(x * 0.31, zBase * 0.17)
      const r2 = hash2(zBase * 0.53, x * 0.11)
      const pool = backdrop[worldAtX(x).biome] ?? backdrop.meadow
      mounds.push({
        x: x + (r - 0.5) * step * 0.6,
        z: zBase - r2 * 18,
        w: (26 + r * 18) * scale,
        h: (11 + r2 * 9) * scale,
        hex: pool[Math.floor(r2 * pool.length) % pool.length],
        haze,
      })
    }
  }

  row(minZ - 34, 1.0, 26, 0.16)
  row(minZ - 68, 1.6, 40, 0.4)

  // A squashed low-poly sphere, not a stack of boxes. Stacked boxes terrace
  // far too visibly at this size and read as glaciers; a coarse sphere still
  // shows facets, so it sits happily next to the voxel island while actually
  // looking like a rounded hill.
  const mesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.5, 12, 7),
    new THREE.MeshLambertMaterial({ flatShading: true }),
    mounds.length
  )
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const p = new THREE.Vector3()
  const sv = new THREE.Vector3()
  const col = new THREE.Color()
  mounds.forEach((b, i) => {
    sv.set(b.w, b.h * 2, b.w * 0.8)
    // Sunk so only the crown shows: hills rising out of the sea, not spheres
    // resting on it.
    p.set(b.x, -b.h * 0.55, b.z)
    m.compose(p, q, sv)
    mesh.setMatrixAt(i, m)
    col.setHex(b.hex).lerp(sky, b.haze)
    mesh.setColorAt(i, col)
  })
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  mesh.frustumCulled = false
  group.add(mesh)
  return group
}

/**
 * Biome props: leafy trees in the meadow, cacti in the desert, pines on the
 * summit, plus flowers close to the route. All trees are kept well clear of
 * the path so they never hide a node.
 */
function createProps(cells) {
  const props = new THREE.Group()
  const candidates = cells.filter((c) => c.pathDist > 9 && c.shore > 0.85)

  const trunks = []
  const crowns = []
  const tops = [] // second, narrower canopy tier so trees read as round
  const boulders = []
  for (const c of candidates) {
    const r = hash2(c.x * 3.3, c.z * 7.7)
    if (r > 0.945) {
      trunks.push(c)
      crowns.push(c)
      if (c.biome.props !== 'cactus') tops.push(c)
    } else if (r < 0.025) boulders.push(c)
  }

  // Flowers hug the route rather than the wilderness — they are what makes the
  // roadside feel planted instead of empty.
  const blooms = cells.filter((c) => {
    if (c.pathDist < 2.6 || c.pathDist > 9 || c.shore < 0.85) return false
    return hash2(c.x * 5.1, c.z * 2.7) > 0.82
  })

  const box = new THREE.BoxGeometry(1, 1, 1)
  const push = (list, sizeFor, yFor, colorFor) => {
    if (!list.length) return
    const mesh = new THREE.InstancedMesh(box, new THREE.MeshLambertMaterial(), list.length)
    const mm = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const s = new THREE.Vector3()
    const p = new THREE.Vector3()
    const col = new THREE.Color()
    list.forEach((c, i) => {
      const k = sizeFor(c)
      s.set(k.x, k.y, k.z)
      p.set(c.x, c.height + yFor(c, k), c.z)
      mm.compose(p, q, s)
      mesh.setMatrixAt(i, mm)
      mesh.setColorAt(i, col.setHex(colorFor(c)))
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.frustumCulled = false
    props.add(mesh)
  }

  // Trunk/stem: a cactus is a tall thin green column, a pine or a leafy tree
  // gets a short brown one.
  push(
    trunks,
    (c) => (c.biome.props === 'cactus' ? { x: 0.8, y: 3.2, z: 0.8 } : { x: 0.7, y: 1.9, z: 0.7 }),
    (_, k) => k.y / 2,
    (c) => (c.biome.props === 'cactus' ? c.biome.foliage : c.biome.trunk)
  )
  // Crown: cactus arms, a narrow pine spire, or a fat leafy canopy.
  push(
    crowns,
    (c) => {
      if (c.biome.props === 'cactus') return { x: 2.0, y: 0.9, z: 0.9 }
      if (c.biome.props === 'pine') return { x: 1.7, y: 2.6, z: 1.7 }
      const w = 2.2 + hash2(c.z, c.x) * 1.1
      return { x: w, y: w * 0.8, z: w }
    },
    (c, k) => (c.biome.props === 'cactus' ? 2.1 : 1.9 + k.y / 2 - 0.3),
    (c) => (hash2(c.x, c.z * 2) > 0.5 ? c.biome.foliage : c.biome.foliageAlt)
  )
  // Narrower cap on top of the canopy — two tiers read as a dome, one reads
  // as a cube on a stick.
  push(
    tops,
    (c) => {
      const w = 1.5 + hash2(c.z * 1.9, c.x * 2.3) * 0.7
      return { x: w, y: w * 0.7, z: w }
    },
    (c, k) => (c.biome.props === 'pine' ? 4.2 : 3.5) + k.y / 2,
    (c) => c.biome.foliageAlt
  )
  push(
    boulders,
    (c) => {
      const w = 1 + hash2(c.x * 1.7, c.z * 1.3) * 0.9
      return { x: w, y: w * 0.7, z: w }
    },
    (_, k) => k.y / 2,
    (c) => c.biome.boulder
  )
  push(
    blooms,
    () => ({ x: 0.36, y: 0.36, z: 0.36 }),
    (_, k) => k.y / 2 + 0.05,
    (c) => flowers[Math.floor(hash2(c.z * 3.7, c.x * 4.3) * flowers.length) % flowers.length]
  )

  return props
}
