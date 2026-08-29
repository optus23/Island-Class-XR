import * as THREE from 'three'
import { worlds } from '../config/worlds.js'
import { palette, world as themeWorld, resolveNodeColor } from '../config/theme.js'
import { buildWorldCurves, buildConnectors, distributeNodes } from './paths.js'
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
const NODE_LIFT = 0.35 // sit just proud of the ground
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
  group.add(createPathTiles())
  const dashed = createOptionalConnectors(placed, positionById)
  group.add(dashed)

  // --- regular nodes (instanced) ------------------------------------------
  const regular = placed.filter((p) => p.level.category !== 'boss')
  const nodeGeo = new THREE.BoxGeometry(NODE_SIZE, NODE_SIZE * 0.75, NODE_SIZE)
  // See island.js: per-instance colour comes from instanceColor, and turning on
  // vertexColors here would multiply it by a missing attribute and go black.
  const nodeMat = new THREE.MeshLambertMaterial()
  const nodeMesh = new THREE.InstancedMesh(nodeGeo, nodeMat, regular.length)
  nodeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage) // hover scales instances
  nodeMesh.frustumCulled = false
  nodeMesh.name = 'nodes'
  nodeMesh.userData.levels = regular.map((p) => p.level)
  group.add(nodeMesh)

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
    })
    nodeMesh.instanceMatrix.needsUpdate = true

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

/** Mario-style stepping-stone tiles along every world path and land bridge. */
function createPathTiles() {
  const curves = [...worlds.map((w) => buildWorldCurves(w).full), ...buildConnectors()]
  const TILE_SPACING = 1.5

  const entries = []
  for (const curve of curves) {
    const count = Math.max(2, Math.round(curve.getLength() / TILE_SPACING))
    for (let i = 0; i <= count; i++) {
      const u = i / count
      entries.push({ p: curve.getPointAt(u), tan: curve.getTangentAt(u) })
    }
  }

  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1.15, 0.28, 1.15),
    new THREE.MeshLambertMaterial({ color: themeWorld.path }),
    entries.length
  )
  const m = new THREE.Matrix4()
  entries.forEach((e, i) => {
    const yaw = Math.atan2(e.tan.x, e.tan.z)
    m.compose(
      new THREE.Vector3(e.p.x, e.p.y + 0.12, e.p.z),
      new THREE.Quaternion().setFromAxisAngle(UP, yaw),
      new THREE.Vector3(1, 1, 1)
    )
    mesh.setMatrixAt(i, m)
  })
  mesh.instanceMatrix.needsUpdate = true
  mesh.frustumCulled = false
  return mesh
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
      new THREE.Vector3(d.at.x, d.at.y - NODE_LIFT + 0.14, d.at.z),
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
  const s = isFinal ? 1.5 : 1.1

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

  addBox(3.4, 1.6, 3.4, 0, 0.8, 0) // keep
  addBox(1.0, 2.6, 1.0, -1.5, 1.3, -1.5) // towers
  addBox(1.0, 2.6, 1.0, 1.5, 1.3, -1.5)
  addBox(1.0, 2.6, 1.0, -1.5, 1.3, 1.5)
  addBox(1.0, 2.6, 1.0, 1.5, 1.3, 1.5)
  if (isFinal) addBox(2.0, 2.2, 2.0, 0, 2.7, 0) // extra tier for the final boss
  // Dark gate, kept dark so the castle still reads as a castle when green.
  addBox(1.1, 1.1, 0.3, 0, 0.55, 1.75, { color: 0x2b2118, keepColor: true })

  // Invisible pick proxy: one clean box beats raycasting a dozen small ones.
  const pick = new THREE.Mesh(
    new THREE.BoxGeometry(4.4 * s, 4.4 * s, 4.4 * s),
    new THREE.MeshBasicMaterial({ visible: false })
  )
  pick.position.y = 1.8 * s
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
