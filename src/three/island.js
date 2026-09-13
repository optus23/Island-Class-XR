import * as THREE from 'three'
import { worlds } from '../config/worlds.js'
import { world as themeWorld, biomes, backdrop } from '../config/theme.js'
import { prefersReducedMotion } from '../lib/motion.js'
import { buildPropMesh, planProps, planLandmarks } from './props.js'
import {
  buildShoreField,
  CELL_AREA_SCALE,
  VOXEL,
  TIER,
  BASE_Y,
  hash2,
  groundHeightAt,
  landInset,
  nearestPath,
  islandBounds,
  biomeKeyAt,
  voidCrossings,
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

const biomeAt = (x, z) => biomes[biomeKeyAt(x, z)] ?? biomes.meadow

export function createIsland({ keepOut = [] } = {}) {
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
        biome: biomeAt(x, z),
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
    const floor = -1.2 - Math.min(c.inside, 30) * 0.95
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
  group.add(createVoidPits())

  // Scattered dressing and hand-placed corner landmarks share one mesh, so the
  // whole island still costs a single draw call for every prop on it.
  group.add(buildPropMesh([...planProps(cells), ...planLandmarks()]))
  group.add(createRelief(cells, keepOut))

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
 * The dark inside of a chasm.
 *
 * One of the two crossings is a hole rather than a river, and a hole cut in
 * the terrain would otherwise show the sea through it — which reads as water,
 * not as a drop. An elliptical plug of near-black sunk just under the rim
 * gives the gap a bottom you cannot see, and its walls darken the sides.
 */
function createVoidPits() {
  const group = new THREE.Group()
  const pits = voidCrossings()
  if (!pits.length) return group

  const geo = new THREE.CylinderGeometry(1, 0.82, 1, 20, 1, false)
  const mesh = new THREE.InstancedMesh(
    geo,
    new THREE.MeshLambertMaterial({ color: 0x121a27 }),
    pits.length
  )
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const p = new THREE.Vector3()
  const sv = new THREE.Vector3()
  const DEPTH = 14
  pits.forEach((c, i) => {
    const rim = groundHeightAt(c.x, c.z + c.halfZ + 4)
    // Just inside the rim so the plug never pokes through the ground, and its
    // top sits a little below it so you look down INTO something.
    sv.set(c.halfX * 1.96, DEPTH, c.halfZ * 1.96)
    p.set(c.x, rim - 1.2 - DEPTH / 2, c.z)
    m.compose(p, q, sv)
    mesh.setMatrixAt(i, m)
  })
  mesh.instanceMatrix.needsUpdate = true
  mesh.frustumCulled = false
  group.add(mesh)
  return group
}

/**
 * Boulders: rock outcrops scattered over the open ground.
 *
 * The terrain is deliberately flat around the route so nodes never sit on a
 * slope, which left large empty plains. These add silhouette and height
 * variation WITHOUT touching the walkable surface.
 *
 * THEY USED TO BE STACKS OF PLAIN CUBES IN THE TERRACE'S OWN BAND COLOUR, and
 * they were reported as bugs — "bloques raros que no aportan... yo creo que
 * eran árboles antiguos". Two things gave that away and both are fixed here:
 *
 *  - THE COLOUR WAS THE TERRACE'S. Painted in `band` over `groundAlt`, a
 *    block read as a piece of the hillside that had broken off and was now
 *    standing in a field. The palette has had a `boulder` colour per biome all
 *    along and this never used it. It does now, and that one change is most of
 *    the difference between "terrain bug" and "rock".
 *  - THE SILHOUETTE WAS A GRID-ALIGNED CUBE. Everything else in the voxel
 *    world is axis-aligned because it is built or grown; a rock is the one
 *    thing that is neither. Each outcrop now gets a yaw of its own and is
 *    built from overlapping boxes of different depth and width, so no two read
 *    as the same object and none of them line up with the terraces behind.
 *
 * Still one InstancedMesh, still deterministic from `hash2`, still nowhere
 * near the road.
 */
function createRelief(cells, keepOut = []) {
  const group = new THREE.Group()
  const blocks = []

  for (const c of cells) {
    // Well clear of the road: these are tall enough to hide the character.
    if (c.pathDist < 13 || c.shore < 0.9) continue
    // AND CLEAR OF THE BUILDINGS. Distance from the road is not enough: an
    // off-path node has no road beside it, so nothing stopped a rock growing
    // against the re-evaluation castle — measured at 3.6 units from a castle
    // whose plinth reaches 3.33.
    if (keepOut.some((k) => (c.x - k.x) ** 2 + (c.z - k.z) ** 2 < k.r * k.r)) continue
    const r = hash2(c.x * 1.13, c.z * 2.71)
    if (r < 1 - (1 - 0.975) * CELL_AREA_SCALE) continue

    // One yaw for the whole outcrop, so the pieces read as one rock rather
    // than as a pile of unrelated boxes. Every offset below is turned by it.
    const yaw = hash2(c.x * 0.77, c.z * 1.31) * Math.PI * 2
    const cos = Math.cos(yaw)
    const sin = Math.sin(yaw)
    const put = (dx, dz, w, h, d, y, shade) =>
      blocks.push({
        x: c.x + dx * cos - dz * sin,
        z: c.z + dx * sin + dz * cos,
        w,
        h,
        d,
        y,
        yaw,
        biome: c.biome,
        shade,
      })

    const scale = 0.75 + hash2(c.x * 2.3, c.z * 0.9) * 0.55
    const base = c.height

    // The body: wider than it is deep, so it has a long side and a short one.
    const bw = 2.9 * scale
    const bd = 2.0 * scale
    const bh = (1.5 + hash2(c.z * 5.3, c.x * 1.9) * 1.3) * scale
    put(0, 0, bw, bh, bd, base + bh / 2, 0)

    // A shoulder leaning off one side, and a smaller cap sitting back the
    // other way. Offset on BOTH axes: a piece centred on the body just makes
    // a wedding cake, which is what the old stack looked like.
    const sw = bw * (0.5 + hash2(c.x * 3.1, c.z * 4.2) * 0.25)
    const sh = bh * (0.55 + hash2(c.z * 3.7, c.x * 2.2) * 0.4)
    put(bw * 0.28, -bd * 0.18, sw, sh, bd * 0.78, base + sh / 2, -0.08)

    if (hash2(c.x * 6.1, c.z * 3.3) > 0.38) {
      const cw = bw * 0.52
      const ch = bh * 0.6
      put(-bw * 0.16, bd * 0.14, cw, ch, bd * 0.6, base + bh + ch / 2 - 0.15, 0.22)
    }

    // A pebble or two at the foot. They are what stop an outcrop looking
    // dropped in: a rock that has been there a while has bits around it.
    const pebbles = 1 + Math.floor(hash2(c.z * 7.7, c.x * 5.5) * 2)
    for (let p = 0; p < pebbles; p++) {
      const a = hash2(c.x * (9.1 + p), c.z * (4.4 + p)) * Math.PI * 2
      const dist = bw * (0.62 + hash2(c.z * (8.3 + p), c.x * (6.6 + p)) * 0.4)
      const pw = 0.42 * scale * (0.7 + hash2(c.x + p * 3, c.z + p) * 0.7)
      const ph = pw * (0.55 + hash2(c.z + p, c.x + p * 2) * 0.5)
      put(Math.cos(a) * dist, Math.sin(a) * dist, pw, ph, pw * 1.25, base + ph / 2, 0.1)
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
  const up = new THREE.Vector3(0, 1, 0)
  blocks.forEach((b, i) => {
    sv.set(b.w, b.h, b.d)
    p.set(b.x, b.y, b.z)
    // Turned off the grid. Every other voxel object here is axis-aligned
    // because it was built or grown; the rock is the one thing that was not.
    q.setFromAxisAngle(up, b.yaw)
    m.compose(p, q, sv)
    mesh.setMatrixAt(i, m)
    // STONE, not the terrace's own band — see the note above `createRelief`.
    // A little of the biome's deep rock mixed in keeps a boulder in the desert
    // warm and one in the snow cold, so it still belongs where it stands.
    col.setHex(b.biome.boulder).lerp(tmp.setHex(b.biome.rockDeep), 0.18)
    // Cheap stylised shading: the pieces that catch the sky are lighter, the
    // ones tucked under the body darker.
    if (b.shade > 0) col.lerp(tmp.setHex(0xffffff), b.shade)
    else if (b.shade < 0) col.lerp(tmp.setHex(0x000000), -b.shade)
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

  // Distance-to-shore, baked once. Sampling this is what lets the foam belong
  // to the shader — animating with the swell and hugging every inlet — rather
  // than being a ring of cubes laid around the coast by hand.
  const field = buildShoreField(256)
  const shoreTex = new THREE.DataTexture(
    field.data,
    field.size,
    field.size,
    THREE.RedFormat,
    THREE.UnsignedByteType
  )
  shoreTex.minFilter = THREE.LinearFilter
  shoreTex.magFilter = THREE.LinearFilter
  shoreTex.wrapS = THREE.ClampToEdgeWrapping
  shoreTex.wrapT = THREE.ClampToEdgeWrapping
  shoreTex.needsUpdate = true

  const uniforms = {
    uTime: { value: 0 },
    uDeep: { value: new THREE.Color(themeWorld.waterDeep) },
    uShallow: { value: new THREE.Color(themeWorld.waterShallow) },
    uFoam: { value: new THREE.Color(themeWorld.waterFoam) },
    uShore: { value: shoreTex },
    uShoreMin: { value: new THREE.Vector2(field.bounds.x0, field.bounds.z0) },
    uShoreSize: {
      value: new THREE.Vector2(
        field.bounds.x1 - field.bounds.x0,
        field.bounds.z1 - field.bounds.z0
      ),
    },
    // Where the water plane sits in ISLAND coordinates. The vertex stage adds
    // this to the local position instead of going through modelMatrix, so the
    // shore lookup survives any transform a parent applies to the whole group.
    // Must stay in step with mesh.position below.
    uPlaneAt: { value: new THREE.Vector2((minX + maxX) / 2, (minZ + maxZ) / 2) },
  }

  // Shared between both stages so the crests line up with the displacement.
  const WAVE = `
    uniform float uTime;
    varying vec2 vWave;
    varying vec2 vWorldXZ;
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
         uniform vec2 uPlaneAt;
${WAVE}`)
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         // The plane is rotated -90deg about X, so its LOCAL z is world up.
         transformed.z += waterWave(position.xy, uTime) * 0.55;
         vWave = position.xy;
         // ISLAND space, NOT world space.
         //
         // This used to be modelMatrix * position, which is the same thing
         // only while the island sits at the origin unscaled. The moment a
         // parent transforms the whole group — the VR diorama scales it by
         // 0.005 and parks it 1.8 m away — those coordinates stop matching
         // uShoreMin/uShoreSize, which are in island units. The lookup then
         // clamps to one constant and the whole sea comes out flat white with
         // the swell still animating, because the wave uses local position.
         //
         // The plane is rotated -90deg about X and offset by uPlaneAt, so its
         // local (x, y) is island (x + at.x, -y + at.y). Deriving it that way
         // is invariant to whatever any parent does.
         vWorldXZ = vec2(position.x + uPlaneAt.x, -position.y + uPlaneAt.y);`
      )

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform vec3 uDeep;
         uniform vec3 uShallow;
         uniform vec3 uFoam;
         uniform sampler2D uShore;
         uniform vec2 uShoreMin;
         uniform vec2 uShoreSize;
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
         sea = mix(sea, uFoam, step(0.88, n) * 0.6);

         // Shoreline foam: 1 at the land edge, 0 well offshore.
         vec2 uv = (vWorldXZ - uShoreMin) / uShoreSize;
         float shore = texture2D(uShore, uv).r;

         // A shallow band hugging the coast, then two hard foam lines that
         // breathe in and out with the swell — the surf running up the rocks.
         sea = mix(sea, uShallow, smoothstep(0.25, 0.72, shore));
         float surf = shore + w * 0.09 + sin(uTime * 1.4 + shore * 22.0) * 0.05;
         sea = mix(sea, uFoam, smoothstep(0.70, 0.80, surf) * 0.85);
         sea = mix(sea, uFoam, smoothstep(0.90, 0.97, surf));
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
  const trims = []

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
      const mound = {
        x: x + (r - 0.5) * step * 0.6,
        z: zBase - r2 * 18,
        w: (26 + r * 18) * scale,
        h: (11 + r2 * 9) * scale,
        hex: pool[Math.floor(r2 * pool.length) % pool.length],
        haze,
      }
      mounds.push(mound)

      // The reference hills are not flat colour: each carries a band across
      // its face and a scatter of speckles. Both are cheap here — one extra
      // instanced mesh for the whole horizon.
      // Only the near rows get them; further back they would read as noise.
      if (haze > 0.3) continue

      /**
       * Put a marking ON the hill's surface.
       *
       * The mound is an ellipsoid sunk into the sea, so its front face pulls
       * back sharply toward the crown. Placing markings at a fixed depth left
       * the high ones hanging in mid-air in front of the hill, looking like
       * balloons. `f` is the ellipsoid's cross-section at that height, which
       * both finds the real surface and shrinks the marking to fit inside the
       * silhouette.
       */
      const centreY = -mound.h * 0.55
      const surfaceAt = (y) => {
        const ny = (y - centreY) / mound.h
        return Math.sqrt(Math.max(0, 1 - ny * ny))
      }

      const shade = new THREE.Color(mound.hex).multiplyScalar(0.84).getHex()
      const pale = new THREE.Color(mound.hex).lerp(new THREE.Color(0xffffff), 0.4).getHex()

      const bandY = mound.h * (0.05 + r * 0.12)
      const bf = surfaceAt(bandY)
      trims.push({
        x: mound.x,
        y: bandY,
        z: mound.z + bf * mound.w * 0.4 * 0.97,
        w: mound.w * 0.9 * bf,
        h: mound.h * 0.14,
        hex: shade,
        haze,
      })

      const dots = 3 + Math.floor(r2 * 3)
      for (let i = 0; i < dots; i++) {
        const a = hash2(x + i * 7.3, zBase + i * 3.1)
        const b = hash2(zBase + i * 5.9, x + i * 2.2)
        const dy = mound.h * (0.25 + b * 0.55)
        const df = surfaceAt(dy)
        if (df < 0.2) continue
        const size = mound.w * (0.045 + a * 0.045)
        trims.push({
          x: mound.x + (a - 0.5) * mound.w * 0.62 * df,
          y: dy,
          z: mound.z + df * mound.w * 0.4 * 0.97,
          w: size,
          h: size,
          hex: b > 0.5 ? shade : pale,
          haze,
        })
      }
    }
  }

  // Five bands. With the fog nearly gone the horizon is genuinely visible now,
  // so it needs enough depth to read as distance rather than as a cutout.
  row(minZ - 18, 0.62, 15, 0.04)
  row(minZ - 30, 0.85, 20, 0.12)
  row(minZ - 52, 1.2, 30, 0.26)
  row(minZ - 86, 1.8, 46, 0.46)
  row(minZ - 134, 2.6, 68, 0.66) // closes the horizon

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

  // Bands and speckles: flat discs standing in front of their hill, facing the
  // camera's side. A disc rather than a sphere so the marking reads as paint
  // on the hill rather than as a lump growing out of it.
  if (trims.length) {
    const trimMesh = new THREE.InstancedMesh(
      new THREE.CircleGeometry(0.5, 10),
      new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
      trims.length
    )
    trims.forEach((t, i) => {
      sv.set(t.w, t.h, 1)
      p.set(t.x, t.y, t.z)
      m.compose(p, q, sv)
      trimMesh.setMatrixAt(i, m)
      col.setHex(t.hex).lerp(sky, t.haze)
      trimMesh.setColorAt(i, col)
    })
    trimMesh.instanceMatrix.needsUpdate = true
    if (trimMesh.instanceColor) trimMesh.instanceColor.needsUpdate = true
    trimMesh.frustumCulled = false
    group.add(trimMesh)
  }

  return group
}
