import * as THREE from 'three'
import { hash2, CELL_AREA_SCALE, groundHeightAt, nearestPath, landInset } from './terrain.js'
import { distributeNodes, flatness } from './paths.js'
import { worlds } from '../config/worlds.js'
import { levelsForWorld } from '../lib/levels.js'
import { biomes } from '../config/theme.js'

/**
 * Voxel set dressing.
 *
 * Every prop is a RECIPE: a list of boxes in local space. All of them — every
 * part of every prop of every kind — are baked into a single InstancedMesh of
 * unit cubes with per-instance colour and scale.
 *
 * That inversion is what lets the props be detailed. Previously each part kind
 * needed its own mesh, so more detail meant more draw calls and the props had
 * to stay crude. Here a twenty-box mushroom costs twenty instances and no
 * extra draw call, so detail is essentially free.
 *
 * Local axes: +y up, +z toward the camera side. Sizes and offsets are in world
 * units; y offsets are measured from the ground the prop stands on.
 */

/** @typedef {{x:number,y:number,z:number,w:number,h:number,d:number,c:number}} Part */
const part = (x, y, z, w, h, d, c) => ({ x, y, z, w, h, d, c })

const BARK = 0x6f4a2a
const BARK_DARK = 0x573719
const SNOW = 0xf2f7fb

/** Four spots on a mushroom cap, and similar rings elsewhere. */
function ring(y, radius, size, colour, count = 4, phase = 0) {
  const out = []
  for (let i = 0; i < count; i++) {
    const a = phase + (i / count) * Math.PI * 2
    out.push(part(Math.cos(a) * radius, y, Math.sin(a) * radius, size, size, size, colour))
  }
  return out
}

const RECIPES = {
  // --- vegetation ---------------------------------------------------------
  treeLeafy: (b) => [
    part(0, 1.0, 0, 0.7, 2.0, 0.7, BARK),
    part(0.36, 1.5, 0, 0.5, 0.35, 0.5, BARK_DARK), // stub branch
    part(0, 2.75, 0, 3.2, 1.3, 3.2, b.foliage),
    part(0, 3.75, 0, 2.5, 1.0, 2.5, b.foliage),
    part(0, 4.5, 0, 1.5, 0.8, 1.5, b.foliageAlt),
    // Highlight and shade blocks give the canopy a readable silhouette.
    part(-1.1, 2.9, -1.1, 1.0, 0.7, 1.0, b.foliageAlt),
    part(1.2, 3.4, 0.9, 0.8, 0.6, 0.8, b.foliageAlt),
  ],

  pine: (b) => [
    part(0, 0.8, 0, 0.6, 1.6, 0.6, BARK_DARK),
    part(0, 2.0, 0, 2.7, 1.1, 2.7, b.foliage),
    part(0, 3.0, 0, 2.1, 1.0, 2.1, b.foliage),
    part(0, 3.9, 0, 1.5, 0.9, 1.5, b.foliageAlt),
    part(0, 4.6, 0, 0.9, 0.8, 0.9, b.foliageAlt),
    part(0, 5.15, 0, 0.5, 0.5, 0.5, SNOW),
    part(0, 3.05, 0, 2.2, 0.18, 2.2, SNOW), // snow shelf
  ],

  cactus: (b) => [
    part(0, 1.7, 0, 1.0, 3.4, 1.0, b.foliage),
    part(-0.85, 1.9, 0, 0.75, 0.75, 0.75, b.foliage),
    part(-1.15, 2.6, 0, 0.7, 1.4, 0.7, b.foliage),
    part(0.85, 2.5, 0, 0.75, 0.75, 0.75, b.foliage),
    part(1.15, 3.15, 0, 0.7, 1.2, 0.7, b.foliage),
    // Ribs, and a flower on top.
    part(0, 1.7, 0.5, 0.25, 3.0, 0.25, b.foliageAlt),
    part(0, 3.55, 0, 0.55, 0.35, 0.55, 0xff8fab),
  ],

  // --- Mario mushroom -----------------------------------------------------
  mushroom: () => [
    part(0, 0.65, 0, 1.1, 1.3, 1.1, 0xf7ead6),
    part(0, 1.55, 0, 2.8, 0.9, 2.8, 0xe63946),
    part(0, 2.25, 0, 2.0, 0.7, 2.0, 0xd62839),
    ...ring(1.62, 1.0, 0.62, 0xfff6ea, 4, Math.PI / 4),
    part(0, 2.62, 0, 0.9, 0.4, 0.9, 0xfff6ea),
    // Eyes, because it is a Mario mushroom and not a fungus.
    part(-0.38, 0.85, 0.58, 0.24, 0.42, 0.14, 0x22272e),
    part(0.38, 0.85, 0.58, 0.24, 0.42, 0.14, 0x22272e),
  ],

  // --- course-themed props ------------------------------------------------
  headset: () => [
    part(0, 0.75, 0, 0.4, 1.5, 0.4, 0x5b6672),
    part(0, 1.35, 0, 1.3, 0.25, 1.3, 0x6b7280),
    part(0, 2.0, 0, 2.2, 1.15, 1.2, 0x53617a),
    part(0, 2.05, 0.66, 1.8, 0.72, 0.16, 0x4cc9f0), // lens panel
    part(-0.62, 2.05, 0.72, 0.5, 0.5, 0.1, 0x9be7ff),
    part(0.62, 2.05, 0.72, 0.5, 0.5, 0.1, 0x9be7ff),
    part(0, 2.62, -0.1, 2.3, 0.3, 1.3, 0x6c7a91), // strap
    part(-1.18, 2.0, -0.1, 0.28, 0.9, 1.1, 0x6c7a91),
    part(1.18, 2.0, -0.1, 0.28, 0.9, 1.1, 0x6c7a91),
  ],

  arPhone: () => [
    part(0, 0.55, 0, 0.34, 1.1, 0.34, 0x5b6672),
    part(0, 1.9, 0, 1.15, 2.0, 0.3, 0x5b6b84),
    part(0, 1.95, 0.19, 0.9, 1.6, 0.06, 0x9be7ff),
    // The thing it is tracking, floating just above the screen.
    part(0, 3.35, 0.15, 0.62, 0.62, 0.62, 0xf2c14e),
    part(0, 3.35, 0.15, 0.72, 0.16, 0.72, 0xffe6a1),
  ],

  marker: () => [
    part(0, 0.5, 0, 0.3, 1.0, 0.3, BARK),
    part(0, 1.75, 0, 1.8, 1.8, 0.22, 0xfbfbfb),
    part(-0.45, 2.2, 0.14, 0.62, 0.62, 0.06, 0x4a5568),
    part(0.45, 1.3, 0.14, 0.62, 0.62, 0.06, 0x4a5568),
    part(-0.45, 1.3, 0.14, 0.62, 0.62, 0.06, 0xbfc7d1),
    part(0.45, 2.2, 0.14, 0.62, 0.62, 0.06, 0xbfc7d1),
  ],

  // --- terrain dressing ---------------------------------------------------
  boulder: (b) => [
    part(0, 0.5, 0, 1.9, 1.0, 1.7, b.boulder),
    part(0.5, 1.15, -0.2, 1.1, 0.8, 1.0, b.boulder),
    part(-0.55, 0.95, 0.35, 0.8, 0.6, 0.8, b.rock),
  ],

  flower: () => [
    part(0, 0.28, 0, 0.12, 0.56, 0.12, 0x3f9142),
    part(0, 0.62, 0, 0.3, 0.3, 0.3, 0xffd166),
    part(-0.26, 0.62, 0, 0.22, 0.22, 0.22, 0xff8fab),
    part(0.26, 0.62, 0, 0.22, 0.22, 0.22, 0xff8fab),
    part(0, 0.62, -0.26, 0.22, 0.22, 0.22, 0xff8fab),
    part(0, 0.62, 0.26, 0.22, 0.22, 0.22, 0xff8fab),
  ],

  grassTuft: (b) => [
    part(0, 0.3, 0, 0.16, 0.6, 0.16, b.foliage),
    part(0.22, 0.24, 0.1, 0.14, 0.48, 0.14, b.foliageAlt),
    part(-0.2, 0.2, -0.12, 0.13, 0.4, 0.13, b.foliage),
  ],

  // --- landmarks ----------------------------------------------------------
  // These are the set pieces that go on the CORNERS of the route. In the
  // reference maps almost every bend has one — a toad house, a cannon, a
  // little bridge — and it is those, far more than the terrain, that make an
  // overworld feel like a place rather than a diagram. They are placed
  // deliberately (see planLandmarks) rather than scattered.

  /** Toad house: spotted cap, round door, lantern. */
  mushroomHouse: () => [
    part(0, 1.05, 0, 3.0, 2.1, 3.0, 0xf7ead6), // walls
    part(0, 1.05, 1.5, 3.0, 2.1, 0.12, 0xfff6ea), // sunlit face
    part(0, 2.28, 0, 3.4, 0.4, 3.4, 0xe0cfb4), // eave
    part(0, 3.05, 0, 4.4, 1.35, 4.4, 0xe63946), // cap
    part(0, 3.95, 0, 3.2, 0.75, 3.2, 0xd62839),
    part(0, 4.5, 0, 1.7, 0.5, 1.7, 0xc41e3a),
    // Spots ride the OUTSIDE of each cap tier. Set inside its half-width they
    // were simply swallowed by the box they were meant to decorate.
    ...ring(3.05, 2.15, 0.95, 0xfff6ea, 6, 0.3),
    ...ring(3.95, 1.6, 0.66, 0xfff6ea, 4, 0.9),
    // Spots on the TOP faces as well. The camera looks down on this map, so
    // spots only on the sides left the roof reading as a plain red block from
    // the angle players actually see it from.
    ...ring(3.78, 1.75, 0.8, 0xfff6ea, 4, 0.0).map((q) => ({ ...q, h: 0.22 })),
    ...ring(4.78, 0.95, 0.55, 0xfff6ea, 3, 0.6).map((q) => ({ ...q, h: 0.2 })),
    part(0, 0.85, 1.58, 1.1, 1.7, 0.22, 0x8b5e34), // door
    part(0, 1.3, 1.7, 0.9, 0.75, 0.06, 0xa9763a),
    part(0.34, 0.85, 1.73, 0.16, 0.16, 0.06, 0xf2c14e), // handle
    part(-1.05, 1.5, 1.58, 0.7, 0.7, 0.16, 0x9be7ff), // windows
    part(1.05, 1.5, 1.58, 0.7, 0.7, 0.16, 0x9be7ff),
    part(-1.75, 1.9, 1.25, 0.22, 0.22, 0.22, 0xf2c14e), // lantern
  ],

  /**
   * The same house in lilac. Two colours of toad house, spotted the same way,
   * is straight out of the reference maps — and having the pair means a
   * session can be marked by a building rather than only by its disc.
   */
  mushroomHouseLilac: () => [
    part(0, 1.05, 0, 3.0, 2.1, 3.0, 0xf7ead6),
    part(0, 1.05, 1.5, 3.0, 2.1, 0.12, 0xfff6ea),
    part(0, 2.28, 0, 3.4, 0.4, 3.4, 0xe0cfb4),
    part(0, 3.05, 0, 4.4, 1.35, 4.4, 0x9d4edd),
    part(0, 3.95, 0, 3.2, 0.75, 3.2, 0x7b2fbe),
    part(0, 4.5, 0, 1.7, 0.5, 1.7, 0x6522a4),
    ...ring(3.05, 2.15, 0.95, 0xfff6ea, 6, 0.3),
    ...ring(3.95, 1.6, 0.66, 0xfff6ea, 4, 0.9),
    ...ring(3.78, 1.75, 0.8, 0xfff6ea, 4, 0.0).map((q) => ({ ...q, h: 0.22 })),
    ...ring(4.78, 0.95, 0.55, 0xfff6ea, 3, 0.6).map((q) => ({ ...q, h: 0.2 })),
    part(0, 0.85, 1.58, 1.1, 1.7, 0.22, 0x8b5e34),
    part(0, 1.3, 1.7, 0.9, 0.75, 0.06, 0xa9763a),
    part(0.34, 0.85, 1.73, 0.16, 0.16, 0.06, 0xf2c14e),
    part(-1.05, 1.5, 1.58, 0.7, 0.7, 0.16, 0x9be7ff),
    part(1.05, 1.5, 1.58, 0.7, 0.7, 0.16, 0x9be7ff),
    part(-1.75, 1.9, 1.25, 0.22, 0.22, 0.22, 0xf2c14e),
  ],

  /** The lilac cottage — the second house colour in the reference art. */
  cottage: () => [
    part(0, 1.0, 0, 2.9, 2.0, 2.6, 0xb9a0e3), // walls
    part(0, 1.0, 1.32, 2.9, 2.0, 0.12, 0xc9b4ec), // sunlit face
    part(0, 2.35, 0, 3.5, 0.7, 3.2, 0x6d4f9c), // roof, two tiers
    part(0, 2.95, 0, 2.4, 0.6, 2.2, 0x5b3f86),
    part(0, 3.4, 0, 1.2, 0.4, 1.1, 0x4b3270),
    part(1.05, 3.3, -0.6, 0.55, 1.5, 0.55, 0x8d99ae), // chimney
    part(1.05, 4.15, -0.6, 0.72, 0.24, 0.72, 0x6c757d),
    part(0, 0.8, 1.42, 0.95, 1.6, 0.12, 0x5b3f86), // door
    part(0.3, 0.8, 1.5, 0.14, 0.14, 0.06, 0xf2c14e),
    part(-0.95, 1.45, 1.42, 0.8, 0.8, 0.1, 0x9be7ff), // window
    part(-0.95, 1.45, 1.48, 0.12, 0.8, 0.06, 0xfff6ea), // mullion
    part(-0.95, 1.45, 1.48, 0.8, 0.12, 0.06, 0xfff6ea),
    part(0.95, 1.45, 1.42, 0.8, 0.8, 0.1, 0x9be7ff),
  ],

  /** Bill Blaster-ish cannon on a timber carriage. */
  cannon: () => [
    part(0, 0.35, 0, 2.4, 0.7, 1.6, 0x6f4a2a), // carriage
    part(-0.9, 0.35, 0.72, 0.7, 0.7, 0.22, 0x4a3520), // wheels
    part(0.9, 0.35, 0.72, 0.7, 0.7, 0.22, 0x4a3520),
    part(-0.9, 0.35, -0.72, 0.7, 0.7, 0.22, 0x4a3520),
    part(0.9, 0.35, -0.72, 0.7, 0.7, 0.22, 0x4a3520),
    part(0, 1.15, -0.2, 1.5, 1.2, 1.5, 0x3f4650), // breech
    part(0, 1.65, 0.35, 1.15, 1.15, 1.4, 0x4a5058), // barrel
    part(0, 2.05, 0.95, 0.95, 0.95, 1.2, 0x555d66),
    part(0, 2.3, 1.5, 0.78, 0.78, 0.5, 0x22272e), // muzzle
    part(0, 1.15, -0.95, 0.5, 0.5, 0.4, 0x22272e), // fuse block
  ],

  /** Little stone arch bridge with the gap under it. */
  archBridge: () => [
    part(0, 0.9, 0, 5.2, 0.6, 2.4, 0xcdbfa6), // deck
    part(-1.9, 0.4, 0, 1.4, 1.0, 2.4, 0xb6a68c), // piers
    part(1.9, 0.4, 0, 1.4, 1.0, 2.4, 0xb6a68c),
    part(-2.55, 0.55, 0, 0.6, 1.3, 2.6, 0xa08f74), // abutments
    part(2.55, 0.55, 0, 0.6, 1.3, 2.6, 0xa08f74),
    part(-2.4, 1.55, 1.05, 0.35, 0.9, 0.35, 0x8b5e34), // rail posts
    part(2.4, 1.55, 1.05, 0.35, 0.9, 0.35, 0x8b5e34),
    part(-2.4, 1.55, -1.05, 0.35, 0.9, 0.35, 0x8b5e34),
    part(2.4, 1.55, -1.05, 0.35, 0.9, 0.35, 0x8b5e34),
    part(0, 1.85, 1.05, 5.2, 0.22, 0.22, 0x8b5e34), // handrails
    part(0, 1.85, -1.05, 5.2, 0.22, 0.22, 0x8b5e34),
  ],

  /** Warp pipe. Nothing says Mario faster. */
  warpPipe: () => [
    part(0, 0.9, 0, 1.7, 1.8, 1.7, 0x3f9142),
    part(0, 1.3, 0.9, 1.7, 1.0, 0.14, 0x50a854), // highlight
    part(0, 2.1, 0, 2.15, 0.65, 2.15, 0x4aa84d),
    part(0, 2.42, 0, 1.5, 0.16, 1.5, 0x22402a), // dark mouth
    part(-0.95, 2.1, 0, 0.16, 0.65, 2.15, 0x2f6b33),
  ],

  /** Village well — a corner needs somewhere for people to be. */
  well: () => [
    part(0, 0.45, 0, 2.1, 0.9, 2.1, 0x9aa7b3),
    part(0, 0.95, 0, 1.75, 0.2, 1.75, 0x22272e), // water
    part(-0.85, 1.55, 0, 0.28, 1.9, 0.28, 0x8b5e34), // posts
    part(0.85, 1.55, 0, 0.28, 1.9, 0.28, 0x8b5e34),
    part(0, 2.55, 0, 2.5, 0.45, 1.9, 0xb32a2a), // roof
    part(0, 2.9, 0, 1.5, 0.35, 1.4, 0x8f2020),
    part(0, 1.95, 0, 1.6, 0.16, 0.16, 0x6f4a2a), // winch
    part(0, 1.5, 0, 0.1, 0.8, 0.1, 0xe8d9c0), // rope
    part(0, 1.05, 0, 0.42, 0.35, 0.42, 0x6f4a2a), // bucket
  ],

  /** Signpost at a fork. */
  signpost: () => [
    part(0, 0.9, 0, 0.28, 1.8, 0.28, 0x8b5e34),
    part(0.55, 1.55, 0, 1.5, 0.6, 0.16, 0xe8d9c0),
    part(0.55, 1.55, 0.09, 1.2, 0.2, 0.05, 0xa9763a),
    part(-0.45, 1.0, 0, 1.1, 0.45, 0.14, 0xe8d9c0),
    part(0, 0.12, 0, 0.9, 0.24, 0.9, 0x9aa7b3), // stone footing
  ],

  /** Checkpoint flag, for the corners that need height rather than mass. */
  bannerPole: () => [
    part(0, 0.2, 0, 1.2, 0.4, 1.2, 0x9aa7b3),
    part(0, 2.3, 0, 0.24, 4.2, 0.24, 0xe8e3d8),
    part(0.85, 3.9, 0, 1.5, 1.1, 0.1, 0x4cc9f0),
    part(0.85, 3.9, 0.06, 0.5, 0.5, 0.06, 0xfff6ea),
    part(0, 4.5, 0, 0.4, 0.4, 0.4, 0xf2c14e),
  ],

  /** Stack of supply crates — cheap, and it breaks up a long straight. */
  crates: () => [
    part(0, 0.55, 0, 1.5, 1.1, 1.5, 0xb98a4e),
    part(0, 0.55, 0.78, 1.2, 0.9, 0.1, 0x8b5e34),
    part(0.25, 1.65, -0.2, 1.2, 1.1, 1.2, 0xc79a55),
    part(0.25, 1.65, 0.42, 0.95, 0.85, 0.1, 0x8b5e34),
    part(-0.9, 0.4, 0.6, 0.8, 0.8, 0.8, 0xa9763a),
  ],
}

export const PROP_KINDS = Object.keys(RECIPES)

/**
 * Bakes a list of placements into one InstancedMesh.
 * @param {Array<{kind:string, x:number, z:number, y:number, biome:object, scale?:number, yaw?:number}>} placements
 */
export function buildPropMesh(placements) {
  const parts = []
  for (const p of placements) {
    const recipe = RECIPES[p.kind]
    if (!recipe) continue
    const scale = p.scale ?? 1
    const yaw = p.yaw ?? 0
    const cos = Math.cos(yaw)
    const sin = Math.sin(yaw)
    for (const b of recipe(p.biome)) {
      // Rotate the part offset around the prop's own axis.
      const ox = b.x * cos - b.z * sin
      const oz = b.x * sin + b.z * cos
      parts.push({
        x: p.x + ox * scale,
        y: p.y + b.y * scale,
        z: p.z + oz * scale,
        w: b.w * scale,
        h: b.h * scale,
        d: b.d * scale,
        c: b.c,
        yaw,
      })
    }
  }

  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshLambertMaterial(),
    Math.max(1, parts.length)
  )
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const up = new THREE.Vector3(0, 1, 0)
  const pos = new THREE.Vector3()
  const sv = new THREE.Vector3()
  const col = new THREE.Color()

  parts.forEach((b, i) => {
    q.setFromAxisAngle(up, b.yaw)
    pos.set(b.x, b.y, b.z)
    sv.set(b.w, b.h, b.d)
    m.compose(pos, q, sv)
    mesh.setMatrixAt(i, m)
    mesh.setColorAt(i, col.setHex(b.c))
  })
  mesh.count = parts.length
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  mesh.frustumCulled = false
  return mesh
}

/**
 * Chooses what stands where. Trees and large props stay well clear of the
 * road so they can never hide a node or the avatar; only small ground cover
 * comes near it.
 */
/**
 * Where the castles stand, straight from the path template.
 *
 * World 2 reserves a control point for its mini-boss; world 3's final boss
 * closes the route, so it sits on the last one.
 */
function bossAnchors() {
  const out = []
  for (const w of worlds) {
    const [cx, cy, cz] = w.center
    const idx = w.path.bossSlotIndex
    const cp = idx != null ? w.path.controlPoints[idx] : null
    const last = w.path.controlPoints[w.path.controlPoints.length - 1]
    const pick = cp ?? (w.id === 3 ? last : null)
    if (pick) out.push({ x: pick[0] + cx, z: pick[2] + cz })
  }
  return out
}

const BOSS_GROVE_RADIUS = 26

/** Radius around every node that scattered dressing must leave alone. */
const GROUND_KEEP_OUT = 3.4 // flowers, tufts
const BIG_KEEP_OUT = 8.5 // trees, cacti, headsets — anything that can hide a node

export function planProps(cells) {
  const out = []
  const bosses = bossAnchors()
  const big = (c) => c.pathDist > 10 && c.shore > 0.88 && nodeClearance(c.x, c.z) > BIG_KEEP_OUT
  const near = (c) => c.pathDist > 2.4 && c.pathDist < 9 && c.shore > 0.85

  /**
   * 0 out in the open, 1 right at a castle. The reference art thickens the
   * planting around every castle so it reads as the seat of the world rather
   * than a model dropped on a lawn.
   */
  const grove = (c) => {
    let best = 0
    for (const b of bosses) {
      const d = Math.hypot(c.x - b.x, c.z - b.z)
      best = Math.max(best, 1 - Math.min(1, d / BOSS_GROVE_RADIUS))
    }
    return best
  }

  // Placement is per CELL, so halving the voxel size quadruples the number of
  // candidates. Without this correction the finer grid buried the island in
  // four times the trees. `rare` keeps density per unit AREA constant.
  const rare = (p) => 1 - (1 - p) * CELL_AREA_SCALE
  const common = (p) => p * CELL_AREA_SCALE

  for (const c of cells) {
    // Nothing scattered may crowd a node. Big props keep well back so a level
    // disc is always visible from above; even ground cover leaves the disc
    // itself clear.
    const nd = nodeClearance(c.x, c.z)
    if (nd < GROUND_KEEP_OUT) continue

    const r = hash2(c.x * 3.3, c.z * 7.7)
    const yaw = hash2(c.z * 1.7, c.x * 2.9) * Math.PI * 2
    const scale = 0.85 + hash2(c.x * 0.7, c.z * 1.3) * 0.4
    const base = { x: c.x, z: c.z, y: c.height, biome: c.biome, yaw, scale }

    if (big(c)) {
      const tree =
        c.biome.props === 'cactus' ? 'cactus' : c.biome.props === 'pine' ? 'pine' : 'treeLeafy'
      // Thicker planting close to a castle, ordinary density elsewhere.
      const threshold = 0.945 - grove(c) * 0.16
      if (r > threshold) out.push({ ...base, kind: tree })
    }

    if (near(c)) {
      const t = hash2(c.x * 5.1, c.z * 2.7)
      if (t > rare(0.968)) out.push({ ...base, kind: 'flower' })
      else if (t > rare(0.93)) out.push({ ...base, kind: 'grassTuft' })
    }

    // Course-themed landmarks: rarer, and only in the mid band so they read as
    // deliberate set pieces rather than clutter.
    if (c.pathDist > 6 && c.pathDist < 12 && c.shore > 0.9 && nd > BIG_KEEP_OUT) {
      const t = hash2(c.z * 9.1, c.x * 6.3)
      if (t > rare(0.9955)) out.push({ ...base, kind: 'headset', scale: 1 })
      else if (t < common(0.0045)) out.push({ ...base, kind: 'arPhone', scale: 1 })
      else if (t > 0.5 - 0.002 * CELL_AREA_SCALE && t < 0.5 + 0.002 * CELL_AREA_SCALE)
        out.push({ ...base, kind: 'marker', scale: 1 })
    }
  }
  return out
}

/**
 * Every node on the island, in one memoised list.
 *
 * Exists so that anything scattered over the map can be told to keep AWAY from
 * the nodes. The two systems previously knew nothing about each other, which
 * is how a tree came to grow straight through a bonus level and a signpost
 * ended up standing in the middle of a session.
 */
let nodesCache = null
export function allNodePlacements() {
  if (!nodesCache) {
    nodesCache = []
    for (const w of worlds) {
      for (const p of distributeNodes(w, levelsForWorld(w.id))) {
        nodesCache.push({ ...p, worldId: w.id })
      }
    }
  }
  return nodesCache
}

/** Distance from (x, z) to the nearest node, on the ground plane. */
export function nodeClearance(x, z) {
  let best = Infinity
  for (const n of allNodePlacements()) {
    const d = Math.hypot(x - n.position.x, z - n.position.z)
    if (d < best) best = d
  }
  return best
}

/**
 * Set pieces standing just PAST each session, off to one side of the road.
 *
 * Placement follows the reference art rather than geometry for its own sake:
 * walking the road you meet the level's disc first, and the building that
 * belongs to it a moment later, beside the road ahead. Hanging them on the
 * path's corners instead — the previous approach — put them wherever the route
 * happened to bend, which is not where the eye looks for them.
 *
 * Everything is derived from the node list, so adding or removing a session
 * re-places its landmark and nothing here needs touching.
 */
const LANDMARKS_BY_BIOME = {
  meadow: ['mushroomHouse', 'mushroomHouseLilac', 'well', 'warpPipe', 'cottage', 'signpost'],
  desert: ['mushroomHouseLilac', 'cannon', 'mushroomHouse', 'warpPipe', 'well', 'crates'],
  summit: ['mushroomHouse', 'cottage', 'mushroomHouseLilac', 'bannerPole', 'warpPipe', 'well'],
}

/**
 * How far past the node, and how far to the side.
 *
 * Close. The point is that the building belongs to THAT session: standing on
 * the disc you should feel you have arrived somewhere, which needs the house
 * at your shoulder, not across a field. The first pair of values is where it
 * lands almost always; the rest are fallbacks for a cramped spot.
 */
const AHEAD = [1.5, 3.5, 0, 5.5]
const ASIDE = [4.6, 5.6, 7]
/** Off the road, but only just — measured to the road's centre line. */
const LANDMARK_ROAD_CLEARANCE = 4.2
const LANDMARK_NODE_CLEARANCE = 3.9

export function planLandmarks() {
  const out = []
  const nodes = allNodePlacements()

  let ordinal = -1
  for (const n of nodes) {
    // Bosses have their own castle, and a bonus node is already the landmark.
    if (!n.onPath || n.level.category === 'boss') continue
    ordinal++

    const biome = biomes[worlds.find((w) => w.id === n.worldId)?.biome] ?? biomes.meadow
    const kinds = LANDMARKS_BY_BIOME[worlds.find((w) => w.id === n.worldId)?.biome] ??
      LANDMARKS_BY_BIOME.meadow

    const fwd = n.tangent.clone().setY(0)
    if (fwd.lengthSq() < 1e-6) continue
    fwd.normalize()
    const side = { x: fwd.z, z: -fwd.x }

    // Prefer the side the road is NOT about to turn toward, then try the other.
    const seed = hash2(n.position.x, n.position.z)
    const sides = seed > 0.5 ? [1, -1] : [-1, 1]

    let spot = null
    for (const dir of sides) {
      for (const ahead of AHEAD) {
        for (const aside of ASIDE) {
          const x = n.position.x + fwd.x * ahead + side.x * dir * aside
          const z = n.position.z + fwd.z * ahead + side.z * dir * aside
          if (landInset(x, z) < 7) continue
          if (nearestPath(x, z).dist < LANDMARK_ROAD_CLEARANCE) continue
          if (nodeClearance(x, z) < LANDMARK_NODE_CLEARANCE) continue
          // Level ground only: a house half-sunk into a terrace looks broken.
          if (flatness(x, z) > 0.01) continue
          spot = { x, z, dir }
          break
        }
        if (spot) break
      }
      if (spot) break
    }
    if (!spot) continue

    out.push({
      // Cycle rather than hash: hashing left whole kinds unplaced, so the
      // warp pipe and the lilac house simply never appeared on the map.
      kind: kinds[ordinal % kinds.length],
      x: spot.x,
      z: spot.z,
      y: groundHeightAt(spot.x, spot.z),
      biome,
      // Face the road: the door and the cannon muzzle should look at it.
      yaw: Math.atan2(-side.x * spot.dir, -side.z * spot.dir),
      scale: 0.78 + hash2(spot.x, spot.z) * 0.14,
    })
  }

  return out
}
