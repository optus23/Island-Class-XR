import * as THREE from 'three'
import { worlds } from '../config/worlds.js'
import { world as themeWorld, biomes, backdrop, flowers } from '../config/theme.js'
import { prefersReducedMotion } from '../lib/motion.js'
import {
  VOXEL,
  TIER,
  BASE_Y,
  hash2,
  groundHeightAt,
  landInset,
  nearestPath,
  islandBounds,
  biomeKeyAt,
} from './terrain.js'

/**
 * The voxel island.
 *
 * All height and land-mask logic now lives in terrain.js, so the mesh built
 * here and the anchoring used by every placed object come from exactly the
 * same functions and cannot drift apart.
 *
 * Each column draws as three stacked boxes — a cap, a bright band under the
 * lip, and the rock body below. That three-tone stack is what makes a plateau
 * read as a plateau instead of a coloured slab.
 */

const CAP_HEIGHT = 1.1 // the walkable top
const BAND_HEIGHT = 1.4 // bright stripe below the lip

const biomeAt = (x) => biomes[biomeKeyAt(x)] ?? biomes.meadow

export function createIsland() {
  const group = new THREE.Group()

  const { minX, maxX, minZ, maxZ } = islandBounds()
  const cells = []
  for (let x = minX; x <= maxX; x += VOXEL) {
    for (let z = minZ; z <= maxZ; z += VOXEL) {
      const inside = landInset(x, z)
      if (inside <= 0) continue
      cells.push({
        x,
        z,
        height: groundHeightAt(x, z),
        pathDist: nearestPath(x, z).dist,
        shore: Math.min(1, inside / 4),
        biome: biomeAt(x),
      })
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
  const water = createWater(minX, maxX, minZ, maxZ)
  group.add(water.mesh)

  group.add(createProps(cells))
  group.add(createBackdrop(minX, maxX, minZ))

  return { group, terrain: caps, cells, update: water.update }
}

/**
 * Animated stylised sea.
 *
 * Built by patching a MeshLambertMaterial through onBeforeCompile rather than
 * writing a raw ShaderMaterial: that way the water inherits the scene's fog,
 * lighting and colour management for free. A raw shader would have to
 * re-implement all three and would drift out of step with the rest of the
 * island the moment the fog range changed.
 *
 * The pattern is deliberately quantised into a few bands, which reads as
 * pixel-art water rather than a smooth gradient.
 */
function createWater(minX, maxX, minZ, maxZ) {
  const width = (maxX - minX) * 2.4
  const depth = (maxZ - minZ) * 3.4

  const material = new THREE.MeshLambertMaterial({ color: 0xffffff })
  const uniforms = {
    uTime: { value: 0 },
    uDeep: { value: new THREE.Color(themeWorld.waterDeep) },
    uShallow: { value: new THREE.Color(themeWorld.waterShallow) },
    uFoam: { value: new THREE.Color(themeWorld.waterFoam) },
  }

  // Shared between both stages so the crests line up with the displacement.
  const WAVE = `
    uniform float uTime;
    varying vec2 vWave;
    float waterWave(vec2 p, float t) {
      // Fairly high frequencies: the plane spans hundreds of units, so gentle
      // ones produce a few enormous blobs instead of a sea.
      return sin(p.x * 0.20 + t * 1.10) * 0.50
           + sin(p.y * 0.26 - t * 0.85) * 0.40
           + sin((p.x + p.y) * 0.13 + t * 0.60) * 0.35
           + sin((p.x - p.y) * 0.09 - t * 0.35) * 0.25;
    }
  `

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
${WAVE}`)
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         // The plane is rotated -90deg about X, so its LOCAL z is world up.
         transformed.z += waterWave(position.xy, uTime) * 0.55;
         vWave = position.xy;`
      )

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform vec3 uDeep;
         uniform vec3 uShallow;
         uniform vec3 uFoam;
         ${WAVE}`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         float w = waterWave(vWave, uTime);
         float n = clamp(w * 0.5 + 0.5, 0.0, 1.0);
         // Chunky steps instead of a smooth ramp — pixel-art water.
         float band = clamp(floor(n * 6.0) / 5.0, 0.0, 1.0);
         vec3 sea = mix(uDeep, uShallow, band);
         // Foam only on the narrow tops of crests, or the sea turns milky.
         sea = mix(sea, uFoam, step(0.93, n) * 0.45);
         diffuseColor.rgb = sea;`
      )
  }

  const mesh = new THREE.Mesh(
    // Segments exist so the swell has vertices to displace.
    new THREE.PlaneGeometry(width, depth, 96, 96),
    material
  )
  mesh.rotation.x = -Math.PI / 2
  mesh.position.set((minX + maxX) / 2, -2.2, (minZ + maxZ) / 2)
  mesh.frustumCulled = false
  mesh.renderOrder = -1

  let t = 0
  return {
    mesh,
    update(dt) {
      // Frozen, not merely slowed, when the viewer asked for less motion.
      if (prefersReducedMotion()) return
      t += dt
      uniforms.uTime.value = t
    },
  }
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
      const pool = backdrop[biomeKeyAt(x)] ?? backdrop.meadow
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
