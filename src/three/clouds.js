import * as THREE from 'three'
import { clouds as skin } from '../config/theme.js'
import { hash2 } from './terrain.js'

/**
 * Voxel clouds, for the opening flight to fall through.
 *
 * They belong to the intro and nothing else — `three/intro.js` builds them,
 * fades them out as the camera drops below the band and disposes them once it
 * has landed. That is deliberate rather than lazy: the overview camera pulls
 * back to a couple of hundred units and looks almost straight down, so a
 * permanent cloud layer over the island would put a lid on the one shot that is
 * supposed to show the whole map.
 *
 * ONE InstancedMesh, like everything else here. A cloud is a handful of boxes
 * in the island's own vocabulary — no sprites, no soft edges — because a
 * billboarded puff beside a voxel island reads as an asset from another game.
 */

/**
 * One cloud, as boxes. x, y, z, w, h, d in cloud-local units; `top` picks the
 * brighter of the two whites, so the stack has a lit crown and a cooler
 * underside without needing a second light.
 */
const PUFFS = [
  { x: 0, y: 0, z: 0, w: 3.0, h: 1.9, d: 2.4 },
  { x: -1.5, y: 0.15, z: 0.3, w: 2.0, h: 1.6, d: 1.9 },
  { x: 1.55, y: 0.05, z: -0.25, w: 2.1, h: 1.6, d: 2.0 },
  { x: 0.2, y: 1.15, z: 0.1, w: 2.2, h: 1.5, d: 1.8, top: true },
  { x: -1.0, y: 1.0, z: -0.45, w: 1.5, h: 1.2, d: 1.3, top: true },
  { x: 1.1, y: 0.95, z: 0.45, w: 1.6, h: 1.2, d: 1.4, top: true },
  { x: 0.15, y: 2.0, z: 0, w: 1.3, h: 1.1, d: 1.1, top: true },
]

const DRIFT = 1.8 // world units per second, sideways

/**
 * @param {{count?: number, spanX?: number, spanZ?: number, low?: number,
 *   high?: number, seed?: number}} options the band to fill, in world units and
 *   relative to the group's own position — the caller parks the group on the
 *   camera's descent line so the shot works wherever the class happens to be.
 */
/**
 * The defaults are the shot, not a guess at "some clouds".
 *
 * 34 spread over 420 by 350 units left roughly one cloud in frame at a time and
 * a dive down an empty corridor — sky, not weather. Twice as many over a
 * noticeably tighter field is what makes the descent actually pass THROUGH
 * something. It is still 68 clouds in one draw call.
 */
export function createClouds({
  count = 68,
  spanX = 155,
  spanZ = 135,
  low = -140,
  high = 55,
  seed = 1,
} = {}) {
  const group = new THREE.Group()
  group.name = 'intro-clouds'

  // UNLIT, and that is not a shortcut.
  //
  // The scene's ambient is a HemisphereLight whose GROUND colour is
  // `world.terrainEdge` — dark green, so that voxel cubes standing on grass pick
  // up a little bounce from it. Two hundred units up that is simply wrong: the
  // first pass rendered these under it and they came out grey with a green rim
  // along every underside, reading as lumps of rock rather than cloud. They are
  // also seen from BELOW for the second half of the flight, which is the side
  // that light leaves darkest.
  //
  // Flat white is the reference anyway. The form comes from the stack of boxes
  // and the two tones, not from shading.
  const material = new THREE.MeshBasicMaterial({
    // Transparent from the start, not switched on at fade time: flipping
    // `transparent` mid-flight forces a shader recompile, and a stall in the
    // middle of the one continuous camera move is exactly what it must not do.
    transparent: true,
    opacity: 1,
  })

  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    material,
    count * PUFFS.length
  )
  mesh.name = 'clouds'
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  // Written from the cloud table each frame, so the mesh's own bounds are never
  // right and three has nothing correct to cull against.
  mesh.frustumCulled = false
  group.add(mesh)

  const rnd = (i, salt) => hash2(i * 12.9898 + salt * 78.233, seed * 43.7 + i * 4.1 - salt * 2.3)

  const flock = []
  for (let i = 0; i < count; i++) {
    // Biased toward the middle of the field, which is the line the camera comes
    // down. Spread evenly over the whole span, a 34-cloud band leaves the dive
    // falling through an empty corridor with the weather off to the sides.
    const hug = (u) => (u < 0.5 ? -1 : 1) * Math.pow(Math.abs(u * 2 - 1), 1.45)
    flock.push({
      x: hug(rnd(i, 1)) * spanX,
      y: low + rnd(i, 2) * (high - low),
      z: hug(rnd(i, 3)) * spanZ,
      scale: 4.0 + rnd(i, 4) * 5.4,
      // Slightly different speeds, so the band never slides as one sheet.
      speed: DRIFT * (0.55 + rnd(i, 5) * 0.9),
      yaw: rnd(i, 6) * Math.PI * 2,
    })
  }

  const col = new THREE.Color()
  flock.forEach((_, ci) => {
    PUFFS.forEach((p, pi) => {
      mesh.setColorAt(ci * PUFFS.length + pi, col.setHex(p.top ? skin.light : skin.shade))
    })
  })
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true

  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const up = new THREE.Vector3(0, 1, 0)
  const pos = new THREE.Vector3()
  const sv = new THREE.Vector3()
  const wrap = spanX + 40

  function update(dt) {
    flock.forEach((c, ci) => {
      c.x += c.speed * dt
      if (c.x > wrap) c.x -= wrap * 2
      q.setFromAxisAngle(up, c.yaw)
      const cos = Math.cos(c.yaw)
      const sin = Math.sin(c.yaw)
      PUFFS.forEach((p, pi) => {
        const ox = p.x * c.scale
        const oz = p.z * c.scale
        pos.set(
          c.x + ox * cos - oz * sin,
          c.y + p.y * c.scale,
          c.z + ox * sin + oz * cos
        )
        sv.set(p.w * c.scale, p.h * c.scale, p.d * c.scale)
        m.compose(pos, q, sv)
        mesh.setMatrixAt(ci * PUFFS.length + pi, m)
      })
    })
    mesh.instanceMatrix.needsUpdate = true
  }

  update(0)

  return {
    group,
    update,
    setOpacity(a) {
      material.opacity = a
      material.visible = a > 0.01
    },
    dispose() {
      group.remove(mesh)
      mesh.geometry.dispose()
      material.dispose()
      mesh.dispose()
    },
  }
}
