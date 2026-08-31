import * as THREE from 'three'
import { worlds } from '../config/worlds.js'
import { palette, world as themeWorld, resolveNodeColor } from '../config/theme.js'
import { buildWorldCurves, buildConnectors, distributeNodes } from './paths.js'
import { groundHeightAt } from './terrain.js'
import { levelsForWorld, statusFor } from '../lib/levels.js'
import { prefersReducedMotion } from '../lib/motion.js'

/**
 * Everything clickable or path-shaped on the island.
 *
 * Regular nodes live in a single InstancedMesh (one draw call for ~20 nodes);
 * the two bosses are bespoke voxel castles, because the brief differentiates
 * boss tiers by size and shape rather than colour. Both are raycastable — a
 * boss node is never decorative.
 */

const NODE_SIZE = 2.4
const NODE_LIFT = 0.62 // clear of the ground even where the road crosses a step
const UP = new THREE.Vector3(0, 1, 0)

export function createMapObjects() {
  const group = new THREE.Group()

  // --- place every level ---------------------------------------------------
  /** @type {Array<{level:object, position:THREE.Vector3, tangent:THREE.Vector3, onPath:boolean, anchorId:string|null, worldId:number}>} */
  const placed = []
  for (const w of worlds) {
    for (const p of distributeNodes(w, levelsForWorld(w.id))) {
      p.position.y += NODE_LIFT
      placed.push({ ...p, worldId: w.id })
    }
  }
  const positionById = new Map(placed.map((p) => [p.level.id, p.position.clone()]))

  // --- paths ---------------------------------------------------------------
  group.add(createPathRibbon())
  const dashed = createOptionalConnectors(placed, positionById)
  group.add(dashed)

  // --- regular nodes (instanced) ------------------------------------------
  const regular = placed.filter((p) => p.level.category !== 'boss')
  // A flat disc sunk into the road, not a floating cube — see the NSMB world
  // maps. 16 sides is plenty at this scale and keeps the silhouette crisp.
  const nodeGeo = new THREE.CylinderGeometry(NODE_SIZE * 0.46, NODE_SIZE * 0.46, 0.42, 16)
  // See island.js: per-instance colour comes from instanceColor, and turning on
  // vertexColors here would multiply it by a missing attribute and go black.
  const nodeMat = new THREE.MeshLambertMaterial()
  const nodeMesh = new THREE.InstancedMesh(nodeGeo, nodeMat, regular.length)
  nodeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage) // hover scales instances
  nodeMesh.frustumCulled = false
  nodeMesh.name = 'nodes'
  nodeMesh.userData.levels = regular.map((p) => p.level)
  group.add(nodeMesh)

  // Gold rim around every node disc, the way the reference rings each level.
  const ringGeo = new THREE.CylinderGeometry(NODE_SIZE * 0.62, NODE_SIZE * 0.62, 0.3, 16)
  const rims = new THREE.InstancedMesh(
    ringGeo,
    new THREE.MeshLambertMaterial({ color: palette.nodeRim }),
    regular.length
  )
  rims.frustumCulled = false
  group.add(rims)

  const baseMatrix = regular.map((p) => {
    const m = new THREE.Matrix4()
    // Face the node along the path so it reads as a step on the route.
    const yaw = Math.atan2(p.tangent.x, p.tangent.z)
    m.compose(
      p.position.clone(),
      new THREE.Quaternion().setFromAxisAngle(UP, yaw),
      new THREE.Vector3(1, 1, 1)
    )
    return m
  })
  baseMatrix.forEach((m, i) => nodeMesh.setMatrixAt(i, m))
  nodeMesh.instanceMatrix.needsUpdate = true

  const rimM = new THREE.Matrix4()
  const rimDrop = new THREE.Matrix4().makeTranslation(0, -0.07, 0)
  baseMatrix.forEach((m, i) => rims.setMatrixAt(i, rimM.multiplyMatrices(m, rimDrop)))
  rims.instanceMatrix.needsUpdate = true

  // --- bosses (bespoke castles) -------------------------------------------
  const bosses = placed.filter((p) => p.level.category === 'boss')
  /** @type {Array<{level:object, group:THREE.Group, pick:THREE.Mesh, parts:THREE.Mesh[]}>} */
  const bossEntries = []
  for (const p of bosses) {
    const entry = createBossCastle(p)
    bossEntries.push(entry)
    group.add(entry.group)
  }

  // --- current-position ring ----------------------------------------------
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(NODE_SIZE * 0.95, NODE_SIZE * 1.3, 4),
    new THREE.MeshBasicMaterial({
      color: palette.current,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  )
  ring.rotation.x = -Math.PI / 2
  ring.rotation.z = Math.PI / 4 // a diamond, not a square — reads as a marker
  ring.visible = false
  ring.renderOrder = 2
  group.add(ring)

  // --- colouring -----------------------------------------------------------
  const color = new THREE.Color()
  let markerId = null

  function refresh(nextMarkerId) {
    markerId = nextMarkerId

    regular.forEach((p, i) => {
      const st = statusFor(p.level, markerId)
      color.setHex(resolveNodeColor({ ...p.level, completed: st.completed }, st))
      nodeMesh.setColorAt(i, color)
    })
    if (nodeMesh.instanceColor) nodeMesh.instanceColor.needsUpdate = true

    for (const b of bossEntries) {
      const st = statusFor(b.level, markerId)
      const hex = resolveNodeColor({ ...b.level, completed: st.completed }, st)
      for (const part of b.parts) {
        if (part.userData.keepColor) continue
        part.material.color.setHex(hex)
      }
    }

    const here = positionById.get(markerId)
    if (here) {
      ring.position.set(here.x, here.y - NODE_LIFT + 0.08, here.z)
      ring.visible = true
    } else {
      ring.visible = false
    }
  }

  // --- hover ---------------------------------------------------------------
  let hoveredKey = null
  const tmp = new THREE.Matrix4()
  const scaleV = new THREE.Vector3()

  function setHovered(key) {
    if (key === hoveredKey) return
    hoveredKey = key

    regular.forEach((p, i) => {
      const on = hoveredKey === p.level.id
      scaleV.setScalar(on ? 1.22 : 1)
      tmp.copy(baseMatrix[i]).scale(scaleV)
      nodeMesh.setMatrixAt(i, tmp)
      rims.setMatrixAt(i, tmp.clone().multiply(rimDrop))
    })
    nodeMesh.instanceMatrix.needsUpdate = true
    rims.instanceMatrix.needsUpdate = true

    for (const b of bossEntries) {
      const on = hoveredKey === b.level.id
      b.group.scale.setScalar(on ? 1.12 : 1)
    }
  }

  // --- picking -------------------------------------------------------------
  const pickTargets = [nodeMesh, ...bossEntries.map((b) => b.pick)]

  /** Resolve a raycast hit to a level, or null. */
  function levelFromHit(hit) {
    if (!hit) return null
    if (hit.object === nodeMesh) return regular[hit.instanceId]?.level ?? null
    return hit.object.userData.level ?? null
  }

  // Gentle bob so the map feels alive; bosses breathe slower than nodes.
  let t = 0
  function update(dt) {
    if (prefersReducedMotion()) {
      // Hold everything still, but keep the marker clearly visible.
      for (const b of bossEntries) b.group.position.y = b.baseY
      if (ring.visible) ring.material.opacity = 0.9
      return
    }
    t += dt
    for (const b of bossEntries) {
      b.group.position.y = b.baseY + Math.sin(t * 1.1 + b.phase) * 0.12
    }
    if (ring.visible) {
      ring.rotation.z += dt * 0.6
      ring.material.opacity = 0.55 + Math.sin(t * 3) * 0.3
    }
  }

  return {
    group,
    placed,
    positionById,
    pickTargets,
    levelFromHit,
    setHovered,
    refresh,
    update,
    get markerId() {
      return markerId
    },
  }
}

/**
 * One continuous road ribbon per curve, with a darker border laid underneath
 * it — the outlined road of the New Super Mario Bros. world maps, rather than
 * the scattered stepping stones this used to draw.
 *
 * A quad strip along the spline: two triangles per sample, one draw call for
 * the whole road network.
 */
/**
 * Walk a curve at a fixed spacing and record, per sample, the point, the
 * sideways vector and the ground the road has to sit on.
 *
 * Shared by the ribbon and the stairs so the two can never disagree about
 * where the road changes level.
 */
function sampleRoad(curve, halfWidth, spacing = 0.5) {
  const segments = Math.max(8, Math.round(curve.getLength() / spacing))
  const out = []
  const side = new THREE.Vector3()
  for (let i = 0; i <= segments; i++) {
    const u = i / segments
    const p = curve.getPointAt(u)
    const t = curve.getTangentAt(u)
    // Perpendicular in the ground plane, so the road stays flat on the terrain.
    side.set(t.z, 0, -t.x).normalize().multiplyScalar(halfWidth)

    // BOTH edges take the HIGHEST ground under the ribbon's whole width,
    // sampled a little beyond each side. Letting each edge follow its own
    // ground tilted the quad wherever the terrain stepped, and the low edge
    // then sliced straight through the terrace.
    const top = Math.max(
      groundHeightAt(p.x - side.x, p.z - side.z),
      groundHeightAt(p.x + side.x, p.z + side.z),
      groundHeightAt(p.x, p.z),
      groundHeightAt(p.x - side.x * 1.35, p.z - side.z * 1.35),
      groundHeightAt(p.x + side.x * 1.35, p.z + side.z * 1.35)
    )
    out.push({ p, side: side.clone(), top, yaw: Math.atan2(t.x, t.z) })
  }
  return out
}

function ribbonGeometry(samples, lift) {
  const positions = []
  const indices = []
  let base = 0

  for (const row of samples) {
    for (const s of row) {
      positions.push(s.p.x - s.side.x, s.top + lift, s.p.z - s.side.z)
      positions.push(s.p.x + s.side.x, s.top + lift, s.p.z + s.side.z)
    }
    for (let i = 0; i < row.length - 1; i++) {
      const a = base + i * 2
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
    }
    base += row.length * 2
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

/**
 * Wooden steps wherever the road changes level.
 *
 * The ground is built from flat plateaus now (see terrain.js), so a climb
 * arrives as one clean vertical face across the road. Left bare that reads as
 * a wall the character walks through; the reference art puts a little
 * staircase at exactly these places, so we build one.
 *
 * Treads are laid from the LOW side up to the high one and each is deep enough
 * to overlap its neighbour, so the flight is solid from every angle.
 */
function createRoadStairs(samples, halfWidth) {
  const TREAD_RISE = 0.5 // world units per step
  const TREAD_DEPTH = 0.85
  const treads = []

  for (const row of samples) {
    for (let i = 1; i < row.length; i++) {
      const a = row[i - 1]
      const b = row[i]
      const rise = b.top - a.top
      if (Math.abs(rise) < 0.4) continue

      const up = rise > 0
      const low = up ? a : b
      const high = up ? b : a
      const steps = Math.max(1, Math.round(Math.abs(rise) / TREAD_RISE))
      // Centre the flight on the join, running from the low sample outward so
      // it always meets ground rather than hanging off the edge of the step.
      const dir = new THREE.Vector3().subVectors(high.p, low.p).setY(0)
      if (dir.lengthSq() < 1e-6) continue
      dir.normalize()

      for (let k = 0; k < steps; k++) {
        const y = low.top + (k + 1) * (Math.abs(rise) / steps)
        // Each tread reaches back toward the low end; the last one meets the
        // upper shelf.
        const back = (steps - k - 0.5) * TREAD_DEPTH
        const at = low.p.clone().addScaledVector(dir, -back + TREAD_DEPTH * steps * 0.5)
        treads.push({
          x: at.x,
          y: (y + low.top) / 2,
          z: at.z,
          h: y - low.top,
          yaw: low.yaw,
          w: halfWidth * 1.82,
          d: TREAD_DEPTH * 1.6,
        })
      }
    }
  }

  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshLambertMaterial({ color: themeWorld.pathStep }),
    Math.max(1, treads.length)
  )
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const pos = new THREE.Vector3()
  const sv = new THREE.Vector3()
  treads.forEach((t, i) => {
    q.setFromAxisAngle(UP, t.yaw)
    pos.set(t.x, t.y, t.z)
    sv.set(t.w, Math.max(0.2, t.h), t.d)
    m.compose(pos, q, sv)
    mesh.setMatrixAt(i, m)
  })
  mesh.count = treads.length
  mesh.instanceMatrix.needsUpdate = true
  mesh.frustumCulled = false
  return mesh
}

function createPathRibbon() {
  const curves = [...worlds.map((w) => buildWorldCurves(w).full), ...buildConnectors()]
  const group = new THREE.Group()

  const outer = curves.map((c) => sampleRoad(c, 1.6))
  const inner = curves.map((c) => sampleRoad(c, 1.2))

  const border = new THREE.Mesh(
    ribbonGeometry(outer, 0.34),
    // DoubleSide keeps the strip visible regardless of which way a curve winds.
    // polygonOffset pushes the road toward the camera in depth only, so it
    // cannot z-fight the terrain where a quad spans a terrace step.
    new THREE.MeshLambertMaterial({
      color: themeWorld.pathEdge,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -6,
    })
  )
  const road = new THREE.Mesh(
    ribbonGeometry(inner, 0.44),
    new THREE.MeshLambertMaterial({
      color: themeWorld.path,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -8,
    })
  )
  border.frustumCulled = false
  road.frustumCulled = false
  group.add(border, road, createRoadStairs(inner, 1.6))
  return group
}

/**
 * Dashed connectors joining each optional node to its anchor. Dashed, and in
 * the optional colour, so a bonus level never looks like part of the route.
 */
function createOptionalConnectors(placed, positionById) {
  const dashes = []
  const DASH = 0.55
  const GAP = 0.5

  for (const p of placed) {
    if (p.onPath || !p.anchorId) continue
    const from = positionById.get(p.anchorId)
    const to = p.position
    if (!from) continue

    const dir = to.clone().sub(from)
    const len = dir.length()
    dir.normalize()
    const yaw = Math.atan2(dir.x, dir.z)
    const step = DASH + GAP
    // Skip the first stride so the dashes start clear of the anchor node.
    for (let d = NODE_SIZE * 0.7; d < len - NODE_SIZE * 0.5; d += step) {
      const at = from.clone().addScaledVector(dir, d + DASH / 2)
      at.y = groundHeightAt(at.x, at.z)
      dashes.push({ at, yaw })
    }
  }

  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.42, 0.2, DASH),
    new THREE.MeshLambertMaterial({ color: themeWorld.pathOptional }),
    Math.max(1, dashes.length)
  )
  const m = new THREE.Matrix4()
  dashes.forEach((d, i) => {
    m.compose(
      new THREE.Vector3(d.at.x, d.at.y + 0.16, d.at.z),
      new THREE.Quaternion().setFromAxisAngle(UP, d.yaw),
      new THREE.Vector3(1, 1, 1)
    )
    mesh.setMatrixAt(i, m)
  })
  mesh.count = dashes.length
  mesh.instanceMatrix.needsUpdate = true
  mesh.frustumCulled = false
  return mesh
}

/**
 * A voxel castle. The final boss is bigger and gets an extra tower tier than
 * the mini-boss, so the two read differently without breaking the colour rules.
 */
function createBossCastle(placement) {
  const isFinal = placement.level.bossTier === 'final'
  // The final boss should dwarf the midterm castle, not merely edge it out.
  const s = isFinal ? 2.3 : 0.95

  const g = new THREE.Group()
  g.position.copy(placement.position)
  const baseY = g.position.y

  const parts = []
  const addBox = (w, h, d, x, y, z, opts = {}) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w * s, h * s, d * s),
      new THREE.MeshLambertMaterial({ color: opts.color ?? palette.boss })
    )
    mesh.position.set(x * s, y * s, z * s)
    mesh.userData.keepColor = Boolean(opts.keepColor)
    g.add(mesh)
    parts.push(mesh)
    return mesh
  }

  const STONE = palette.bossStone
  const STONE_LIGHT = 0x878d96
  const ROOF = palette.bossAccent
  const ROOF_DARK = 0x7d1f1f
  const WOOD = 0x3a2a1a
  const WINDOW = 0xffd98a

  // --- plinth, steps and keep ---------------------------------------------
  addBox(7.0, 0.5, 7.0, 0, 0.25, 0, { color: STONE_LIGHT, keepColor: true })
  addBox(6.2, 0.5, 6.2, 0, 0.72, 0, { color: STONE, keepColor: true })
  addBox(2.0, 0.3, 0.8, 0, 0.62, 3.3, { color: STONE_LIGHT, keepColor: true }) // stair
  addBox(1.6, 0.3, 0.7, 0, 0.34, 3.9, { color: STONE_LIGHT, keepColor: true })
  addBox(4.2, 2.8, 4.2, 0, 2.35, 0)
  addBox(4.7, 0.45, 4.7, 0, 3.95, 0) // cornice overhang
  // Red roof over the keep — the accent the stone is there to set off.
  addBox(4.0, 0.7, 4.0, 0, 4.5, 0, { color: ROOF, keepColor: true })
  addBox(2.8, 0.6, 2.8, 0, 5.1, 0, { color: ROOF, keepColor: true })
  addBox(1.6, 0.5, 1.6, 0, 5.6, 0, { color: ROOF_DARK, keepColor: true })

  // --- corner towers with battlements -------------------------------------
  for (const [tx, tz] of [
    [-2.1, -2.1],
    [2.1, -2.1],
    [-2.1, 2.1],
    [2.1, 2.1],
  ]) {
    addBox(1.5, 4.9, 1.5, tx, 2.45, tz)
    addBox(1.9, 0.4, 1.9, tx, 5.05, tz) // tower cap
    addBox(1.7, 0.9, 1.7, tx, 5.7, tz, { color: ROOF, keepColor: true }) // red turret roof
    addBox(0.9, 0.5, 0.9, tx, 6.3, tz, { color: ROOF_DARK, keepColor: true })
    addBox(0.45, 0.5, 0.3, tx, 3.4, tz + 0.8, { color: WINDOW, keepColor: true })
    // Crenellations: four small teeth per tower.
    for (const [ox, oz] of [
      [-0.55, -0.55],
      [0.55, -0.55],
      [-0.55, 0.55],
      [0.55, 0.55],
    ]) {
      addBox(0.42, 0.55, 0.42, tx + ox, 5.5, tz + oz, { color: STONE_LIGHT, keepColor: true })
    }
  }

  // --- gate, windows, banner ----------------------------------------------
  addBox(1.7, 2.2, 0.35, 0, 2.05, 2.25, { color: WOOD, keepColor: true }) // gate
  addBox(0.16, 2.2, 0.1, 0, 2.05, 2.45, { color: STONE_LIGHT, keepColor: true }) // gate band
  addBox(2.1, 0.3, 0.45, 0, 3.25, 2.3, { color: STONE_LIGHT, keepColor: true }) // lintel
  addBox(0.5, 0.65, 0.3, -1.3, 3.0, 2.2, { color: WINDOW, keepColor: true })
  addBox(0.5, 0.65, 0.3, 1.3, 3.0, 2.2, { color: WINDOW, keepColor: true })

  if (isFinal) {
    // The final boss gets a central spire above the roof, and a flag.
    addBox(2.6, 3.2, 2.6, 0, 7.2, 0)
    addBox(3.0, 0.4, 3.0, 0, 8.95, 0, { color: STONE_LIGHT, keepColor: true })
    addBox(2.4, 1.5, 2.4, 0, 9.85, 0, { color: ROOF, keepColor: true })
    addBox(1.2, 0.8, 1.2, 0, 10.9, 0, { color: ROOF_DARK, keepColor: true })
    addBox(0.5, 0.6, 0.3, 0, 7.4, 1.35, { color: WINDOW, keepColor: true })
    addBox(0.2, 2.4, 0.2, 0, 12.4, 0, { color: WOOD, keepColor: true })
    addBox(1.6, 0.95, 0.12, 0.85, 13.2, 0, { color: 0xf2c14e, keepColor: true })
  } else {
    addBox(0.2, 2.0, 0.2, 0, 6.8, 0, { color: WOOD, keepColor: true })
    addBox(1.3, 0.8, 0.12, 0.7, 7.4, 0, { color: 0xf2c14e, keepColor: true })
  }

  const pick = new THREE.Mesh(
    new THREE.BoxGeometry(7 * s, 8 * s, 7 * s),
    new THREE.MeshBasicMaterial({ visible: false })
  )
  pick.position.y = 3.4 * s
  pick.userData.level = placement.level
  g.add(pick)

  return {
    level: placement.level,
    group: g,
    pick,
    parts,
    baseY,
    phase: isFinal ? 1.7 : 0,
  }
}
