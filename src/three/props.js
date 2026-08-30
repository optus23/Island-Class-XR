import * as THREE from 'three'
import { hash2 } from './terrain.js'

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
    part(0, 2.0, 0, 2.2, 1.15, 1.2, 0x22272e),
    part(0, 2.05, 0.66, 1.8, 0.72, 0.16, 0x4cc9f0), // lens panel
    part(-0.62, 2.05, 0.72, 0.5, 0.5, 0.1, 0x9be7ff),
    part(0.62, 2.05, 0.72, 0.5, 0.5, 0.1, 0x9be7ff),
    part(0, 2.62, -0.1, 2.3, 0.3, 1.3, 0x3b434d), // strap
    part(-1.18, 2.0, -0.1, 0.28, 0.9, 1.1, 0x3b434d),
    part(1.18, 2.0, -0.1, 0.28, 0.9, 1.1, 0x3b434d),
  ],

  arPhone: () => [
    part(0, 0.55, 0, 0.34, 1.1, 0.34, 0x5b6672),
    part(0, 1.9, 0, 1.15, 2.0, 0.3, 0x22272e),
    part(0, 1.95, 0.19, 0.9, 1.6, 0.06, 0x9be7ff),
    // The thing it is tracking, floating just above the screen.
    part(0, 3.35, 0.15, 0.62, 0.62, 0.62, 0xf2c14e),
    part(0, 3.35, 0.15, 0.72, 0.16, 0.72, 0xffe6a1),
  ],

  marker: () => [
    part(0, 0.5, 0, 0.3, 1.0, 0.3, BARK),
    part(0, 1.75, 0, 1.8, 1.8, 0.22, 0xf5f5f5),
    part(-0.45, 2.2, 0.14, 0.62, 0.62, 0.06, 0x22272e),
    part(0.45, 1.3, 0.14, 0.62, 0.62, 0.06, 0x22272e),
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
export function planProps(cells) {
  const out = []
  const big = (c) => c.pathDist > 10 && c.shore > 0.88
  const near = (c) => c.pathDist > 2.4 && c.pathDist < 9 && c.shore > 0.85

  for (const c of cells) {
    const r = hash2(c.x * 3.3, c.z * 7.7)
    const yaw = hash2(c.z * 1.7, c.x * 2.9) * Math.PI * 2
    const scale = 0.85 + hash2(c.x * 0.7, c.z * 1.3) * 0.4
    const base = { x: c.x, z: c.z, y: c.height, biome: c.biome, yaw, scale }

    if (big(c)) {
      const tree =
        c.biome.props === 'cactus' ? 'cactus' : c.biome.props === 'pine' ? 'pine' : 'treeLeafy'
      if (r > 0.945) out.push({ ...base, kind: tree })
      else if (r < 0.022) out.push({ ...base, kind: 'boulder' })
      else if (r > 0.9375 && r < 0.9395) out.push({ ...base, kind: 'mushroom', scale: scale * 1.1 })
    }

    if (near(c)) {
      const t = hash2(c.x * 5.1, c.z * 2.7)
      if (t > 0.968) out.push({ ...base, kind: 'flower' })
      else if (t > 0.93) out.push({ ...base, kind: 'grassTuft' })
    }

    // Course-themed landmarks: rarer, and only in the mid band so they read as
    // deliberate set pieces rather than clutter.
    if (c.pathDist > 6 && c.pathDist < 12 && c.shore > 0.9) {
      const t = hash2(c.z * 9.1, c.x * 6.3)
      if (t > 0.9955) out.push({ ...base, kind: 'headset', scale: 1 })
      else if (t < 0.0045) out.push({ ...base, kind: 'arPhone', scale: 1 })
      else if (t > 0.4975 && t < 0.5015) out.push({ ...base, kind: 'marker', scale: 1 })
    }
  }
  return out
}
