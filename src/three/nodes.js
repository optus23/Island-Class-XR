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
function ribbonGeometry(curves, halfWidth, lift) {
  const positions = []
  const indices = []
  let base = 0
  const side = new THREE.Vector3()

  for (const curve of curves) {
    const segments = Math.max(8, Math.round(curve.getLength() / 0.5))
    for (let i = 0; i <= segments; i++) {
      // Denser sampling: the road has to follow every terrain step now.
      const u = i / segments
      const p = curve.getPointAt(u)
      const t = curve.getTangentAt(u)
      // Perpendicular in the ground plane, so the road stays flat on the terrain.
      side.set(t.z, 0, -t.x).normalize().multiplyScalar(halfWidth)
      // Each edge rides the REAL ground under it, not the abstract curve, so
      // the road lies flat on the quantised terrain instead of slicing through
      // a step or hovering over one.
      const lx = p.x - side.x
      const lz = p.z - side.z
      const rx = p.x + side.x
      const rz = p.z + side.z
      positions.push(lx, groundHeightAt(lx, lz) + lift, lz)
      positions.push(rx, groundHeightAt(rx, rz) + lift, rz)
    }
    for (let i = 0; i < segments; i++) {
      const a = base + i * 2
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
    }
    base += (segments + 1) * 2
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

function createPathRibbon() {
  const curves = [...worlds.map((w) => buildWorldCurves(w).full), ...buildConnectors()]
  const group = new THREE.Group()

  const border = new THREE.Mesh(
    ribbonGeometry(curves, 1.6, 0.30),
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
    ribbonGeometry(curves, 1.2, 0.38),
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
  group.add(border, road)
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

  const STONE = 0xb9b4ad
  const ROOF_DARK = 0x2b2118
  const WINDOW = 0x243447

  // --- plinth and keep -----------------------------------------------------
  addBox(6.4, 0.7, 6.4, 0, 0.35, 0, { color: STONE, keepColor: true })
  addBox(4.2, 2.6, 4.2, 0, 1.95, 0)
  addBox(4.7, 0.5, 4.7, 0, 3.45, 0) // cornice overhang

  // --- corner towers with battlements -------------------------------------
  for (const [tx, tz] of [
    [-2.1, -2.1],
    [2.1, -2.1],
    [-2.1, 2.1],
    [2.1, 2.1],
  ]) {
    addBox(1.5, 4.4, 1.5, tx, 2.2, tz)
    addBox(1.9, 0.45, 1.9, tx, 4.6, tz) // tower cap
    // Crenellations: four small teeth per tower.
    for (const [ox, oz] of [
      [-0.55, -0.55],
      [0.55, -0.55],
      [-0.55, 0.55],
      [0.55, 0.55],
    ]) {
      addBox(0.5, 0.6, 0.5, tx + ox, 5.1, tz + oz, { color: STONE, keepColor: true })
    }
  }

  // --- gate, windows, banner ----------------------------------------------
  addBox(1.6, 2.0, 0.35, 0, 1.0, 2.25, { color: ROOF_DARK, keepColor: true })
  addBox(1.0, 0.2, 0.4, 0, 2.05, 2.3, { color: STONE, keepColor: true }) // lintel
  addBox(0.5, 0.6, 0.3, -1.2, 2.7, 2.2, { color: WINDOW, keepColor: true })
  addBox(0.5, 0.6, 0.3, 1.2, 2.7, 2.2, { color: WINDOW, keepColor: true })

  if (isFinal) {
    // The final boss gets a taller central spire and a flag.
    addBox(2.6, 3.0, 2.6, 0, 5.2, 0)
    addBox(3.0, 0.45, 3.0, 0, 6.9, 0)
    addBox(0.22, 2.2, 0.22, 0, 8.2, 0, { color: ROOF_DARK, keepColor: true })
    addBox(1.5, 0.9, 0.12, 0.8, 8.9, 0, { color: 0xf2c14e, keepColor: true })
  } else {
    addBox(0.22, 1.8, 0.22, 0, 5.0, 0, { color: ROOF_DARK, keepColor: true })
    addBox(1.2, 0.75, 0.12, 0.65, 5.5, 0, { color: 0xf2c14e, keepColor: true })
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
