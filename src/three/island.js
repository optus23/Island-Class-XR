import * as THREE from 'three'
import { worlds } from '../config/worlds.js'
import { world as themeWorld, biomes, backdrop } from '../config/theme.js'
import { prefersReducedMotion } from '../lib/motion.js'
import { buildPropMesh, planProps } from './props.js'
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
        inside,
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

    // Rock body. Its depth grows with how far inland the column sits, so the
    // island's underside tapers to a point instead of ending in a flat slab —
    // the floating-island silhouette from the reference art.
    const bodyTop = bandTop - BAND_HEIGHT
    const floor = 0.5 - Math.min(c.inside, 26) * 0.62
    const bodyH = Math.max(0.4, bodyTop - floor)
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
  group.add(createShoreFoam(minX, maxX, minZ, maxZ))

  group.add(buildPropMesh(planProps(cells)))
  group.add(createRelief(cells))

  const backdropGroup = createBackdrop(minX, maxX, minZ)
  group.add(backdropGroup)

  return {
    group,
    backdrop: backdropGroup,
    terrain: caps,
    cells,
    update: water.update,
  }
}

/**
 * A ring of white foam hugging the coastline.
 *
 * The water shader cannot know where the land is, so the contact line between
 * sea and island read as a hard edge. This lays foam tiles in the narrow band
 * either side of the shore, which is what actually sells "island sitting in
 * water" rather than "mesh intersecting a blue plane".
 */
function createShoreFoam(minX, maxX, minZ, maxZ) {
  const group = new THREE.Group()
  const tiles = []
  const STEP = VOXEL

  for (let x = minX - 6; x <= maxX + 6; x += STEP) {
    for (let z = minZ - 6; z <= maxZ + 6; z += STEP) {
      const inset = landInset(x, z)
      // The band straddling the coastline, just outside it.
      if (inset > 1.6 || inset < -3.4) continue
      const t = (inset + 3.4) / 5.0 // 0 offshore .. 1 at the land edge
      tiles.push({ x, z, t, jitter: hash2(x * 2.3, z * 1.7) })
    }
  }
  if (!tiles.length) return group

  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshLambertMaterial({ transparent: true, opacity: 0.92 }),
    tiles.length
  )
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const p = new THREE.Vector3()
  const sv = new THREE.Vector3()
  const col = new THREE.Color()
  const foam = new THREE.Color(themeWorld.waterFoam)
  const shallow = new THREE.Color(themeWorld.waterShallow)

  tiles.forEach((tile, i) => {
    const w = STEP * (0.85 + tile.jitter * 0.3)
    sv.set(w, 0.42, w)
    p.set(tile.x, -1.75 + tile.jitter * 0.16, tile.z)
    m.compose(p, q, sv)
    mesh.setMatrixAt(i, m)
    // Whitest right at the land edge, fading out to sea.
    col.copy(shallow).lerp(foam, Math.min(1, tile.t * 1.15))
    mesh.setColorAt(i, col)
  })
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  mesh.frustumCulled = false
  group.add(mesh)
  return group
}

/**
 * Free-standing blocks and stepped stacks scattered over the ground.
 *
 * The terrain itself is deliberately flat around the route so nodes never sit
 * on a slope, which left large empty plains. These add silhouette and height
 * variation WITHOUT touching the walkable surface, so the map gains
 * verticality without the path becoming unreadable.
 */
function createRelief(cells) {
  const group = new THREE.Group()
  const blocks = []

  for (const c of cells) {
    if (c.pathDist < 8 || c.shore < 0.9) continue
    const r = hash2(c.x * 1.13, c.z * 2.71)
    if (r < 0.975) continue

    // A stack of 1-3 cubes, each narrower than the one below.
    const tiers = 1 + Math.floor(hash2(c.z * 5.3, c.x * 1.9) * 3)
    let y = c.height
    for (let i = 0; i < tiers; i++) {
      const w = (3.2 - i * 0.7) * (0.8 + hash2(c.x + i, c.z) * 0.4)
      const h = 1.6 + hash2(c.z + i, c.x) * 1.6
      blocks.push({ x: c.x, z: c.z, w, h, y: y + h / 2, biome: c.biome, tier: i })
      y += h
    }
  }

  if (!blocks.length) return group

  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshLambertMaterial(),
    blocks.length
  )
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const p = new THREE.Vector3()
  const sv = new THREE.Vector3()
  const col = new THREE.Color()
  const tmp = new THREE.Color()
  blocks.forEach((b, i) => {
    sv.set(b.w, b.h, b.w)
    p.set(b.x, b.y, b.z)
    m.compose(p, q, sv)
    mesh.setMatrixAt(i, m)
    // Higher tiers catch more light — cheap stylised shading.
    col.setHex(b.biome.band).lerp(tmp.setHex(b.biome.groundAlt), 0.35 + b.tier * 0.2)
    mesh.setColorAt(i, col)
  })
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  mesh.frustumCulled = false
  group.add(mesh)
  return group
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
         // Three flat tones, hard edges: toon water, not a gradient.
         vec3 sea = uDeep;
         sea = mix(sea, uShallow, step(0.42, n));
         sea = mix(sea, uFoam, step(0.88, n) * 0.75);
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
    // Deliberately far past the island bounds: at the raised camera angle the
    // end of a row used to slide into frame as a hard seam against open sky.
    for (let x = minX - 140; x <= maxX + 140; x += step) {
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
  row(minZ - 112, 2.4, 62, 0.62) // closes the horizon

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
