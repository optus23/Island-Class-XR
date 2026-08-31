import * as THREE from 'three'
import { worlds } from '../config/worlds.js'
import { groundHeightAt, nearestPath, isLand, roadTopAt } from './terrain.js'

/**
 * Turns a world's spline template + its list of levels into node positions.
 *
 * Nothing here is per-node hardcoded: the path is a curve, the level count is
 * whatever levels.json happens to hold today, and the algorithm spreads that
 * many nodes evenly along the curve by ARC LENGTH (so nodes stay equidistant
 * even where the spline bends tightly).
 *
 * World 2's template carries `bossSlotIndex`. That control point is reserved
 * for the mini-boss and splits the world into two independent halves, so
 * adding a level before the boss never shifts the nodes after it.
 */

const UP = new THREE.Vector3(0, 1, 0)

/** Control points are world-local; lift them into world space. */
function toWorldPoints(worldDef) {
  const [cx, cy, cz] = worldDef.center
  return worldDef.path.controlPoints.map(([x, y, z]) => new THREE.Vector3(x + cx, y + cy, z + cz))
}

/**
 * Builds a path out of straight runs joined by hard 90-degree corners, which
 * is what a Super Mario World overworld route looks like. Previously these
 * were centripetal Catmull-Rom splines, which read as organic and wrong.
 *
 * A CurvePath of LineCurve3 keeps the whole downstream API intact —
 * getPointAt / getTangentAt / getLength / getSpacedPoints all still work, so
 * node distribution stays arc-length correct across sharp corners.
 */
function makeCurve(points) {
  const path = new THREE.CurvePath()
  for (let i = 1; i < points.length; i++) {
    if (points[i].distanceTo(points[i - 1]) < 1e-6) continue // skip repeats
    path.add(new THREE.LineCurve3(points[i - 1].clone(), points[i].clone()))
  }
  return path
}

/**
 * Waypoints are authored axis-aligned, but a run that changes height AND a
 * horizontal axis at once still reads as one straight segment from above,
 * which is what matters for the blocky look.
 */
export function assertOrthogonal(points, label) {
  for (let i = 1; i < points.length; i++) {
    const dx = Math.abs(points[i].x - points[i - 1].x)
    const dz = Math.abs(points[i].z - points[i - 1].z)
    if (dx > 1e-6 && dz > 1e-6) {
      return `${label}: segment ${i} moves on both X and Z (${dx.toFixed(1)}, ${dz.toFixed(1)}) — paths must be orthogonal`
    }
  }
  return null
}

/**
 * @returns {{full: THREE.Curve, pre: THREE.Curve|null, post: THREE.Curve|null,
 *            bossPoint: THREE.Vector3|null}}
 */
export function buildWorldCurves(worldDef) {
  const pts = toWorldPoints(worldDef)
  const idx = worldDef.path.bossSlotIndex

  if (idx == null) {
    return { full: makeCurve(pts), pre: null, post: null, bossPoint: null }
  }
  if (idx < 1 || idx > pts.length - 2) {
    throw new Error(
      `World ${worldDef.id}: bossSlotIndex ${idx} must leave at least one control point on each side.`
    )
  }
  return {
    full: makeCurve(pts),
    pre: makeCurve(pts.slice(0, idx + 1)), // ends ON the boss slot
    post: makeCurve(pts.slice(idx)), // starts ON the boss slot
    bossPoint: pts[idx].clone(),
  }
}

/** Evenly spaced u values for `count` nodes over a curve segment. */
function spread(count, { startsAtBoss = false, endsAtBoss = false } = {}) {
  if (count <= 0) return []
  if (endsAtBoss) return Array.from({ length: count }, (_, i) => i / count) // 0 .. (n-1)/n
  if (startsAtBoss) return Array.from({ length: count }, (_, i) => (i + 1) / count) // 1/n .. 1
  if (count === 1) return [0.5]
  return Array.from({ length: count }, (_, i) => i / (count - 1)) // 0 .. 1
}

const NODE_FOOT = 1.6 // half-width of the disc's footprint

function sample(curve, u) {
  const position = curve.getPointAt(u)
  const t = curve.getTangentAt(u).normalize()
  // Highest ground under the whole disc, not just its centre — a node placed
  // right at a terrace step otherwise has half of itself buried.
  const sx = t.z * NODE_FOOT
  const sz = -t.x * NODE_FOOT
  position.y = Math.max(
    groundHeightAt(position.x, position.z),
    groundHeightAt(position.x + sx, position.z + sz),
    groundHeightAt(position.x - sx, position.z - sz),
    groundHeightAt(position.x + t.x * NODE_FOOT, position.z + t.z * NODE_FOOT),
    groundHeightAt(position.x - t.x * NODE_FOOT, position.z - t.z * NODE_FOOT)
  )
  return { position, tangent: t }
}

/**
 * Place one world's levels.
 *
 * Optional/bonus levels never consume a slot on the main path — they are
 * pushed sideways off the node that precedes them and get a dashed connector.
 *
 * @param {object} worldDef        entry from config/worlds.js
 * @param {Array}  worldLevels     levels for this world, already in map order
 * @returns {Array<{level, position: THREE.Vector3, tangent: THREE.Vector3,
 *                  onPath: boolean, anchorId: string|null}>}
 */
export function distributeNodes(worldDef, worldLevels) {
  const curves = buildWorldCurves(worldDef)
  const placed = []

  // Optional levels ride alongside the previous main-path level.
  const mainLevels = worldLevels.filter((l) => !l.optional)
  const optionalLevels = worldLevels.filter((l) => l.optional)

  const bossIndex = mainLevels.findIndex((l) => l.category === 'boss')
  const hasSplit = curves.pre && curves.post && bossIndex !== -1

  if (hasSplit) {
    const pre = mainLevels.slice(0, bossIndex)
    const boss = mainLevels[bossIndex]
    const post = mainLevels.slice(bossIndex + 1)

    spread(pre.length, { endsAtBoss: true }).forEach((u, i) => {
      placed.push({ level: pre[i], ...sample(curves.pre, u), onPath: true, anchorId: null })
    })

    const bossPos = curves.bossPoint.clone()
    bossPos.y = groundHeightAt(bossPos.x, bossPos.z)
    placed.push({
      level: boss,
      position: bossPos,
      tangent: curves.post.getTangentAt(0).normalize(),
      onPath: true,
      anchorId: null,
    })

    spread(post.length, { startsAtBoss: true }).forEach((u, i) => {
      placed.push({ level: post[i], ...sample(curves.post, u), onPath: true, anchorId: null })
    })
  } else {
    if (curves.pre && bossIndex === -1) {
      console.warn(
        `World ${worldDef.id} has a bossSlot but no level with category "boss" — falling back to one continuous path.`
      )
    }
    spread(mainLevels.length).forEach((u, i) => {
      placed.push({ level: mainLevels[i], ...sample(curves.full, u), onPath: true, anchorId: null })
    })
  }

  // --- optional nodes: offset perpendicular from their anchor --------------
  const byId = new Map(placed.map((p) => [p.level.id, p]))
  optionalLevels.forEach((level, n) => {
    // Anchor: explicit `anchorAfter`, else the last main level declared before
    // it in the source order.
    let anchor = level.anchorAfter ? byId.get(level.anchorAfter) : null
    if (!anchor) {
      const srcIndex = worldLevels.indexOf(level)
      for (let i = srcIndex - 1; i >= 0; i--) {
        const candidate = byId.get(worldLevels[i].id)
        if (candidate) {
          anchor = candidate
          break
        }
      }
    }
    anchor ??= placed[0]
    if (!anchor) return

    const distance = level.offsetDistance ?? 9
    const axis = anchor.tangent.clone().cross(UP).normalize()

    // Which way to branch. A fixed side (or alternating parity) regularly
    // pointed the bonus node straight back INTO the road, because the route
    // snakes and the perpendicular can face a neighbouring run. Instead, test
    // both sides and keep whichever ends up FURTHER from the road, so an
    // optional branch always reads as leaving the main path.
    const forced = level.offsetSide === 'left' ? -1 : level.offsetSide === 'right' ? 1 : null
    const dirs = forced != null ? [forced] : [1, -1]

    // Search the ANCHOR too, not just side and distance. Where the route
    // doubles back, every offset around one particular node lands near another
    // run of the same road, so no side or distance can rescue it. Allowing the
    // branch to hang off a neighbouring node instead is what actually gets it
    // clear of the path. The declared anchor stays the preference: it is tried
    // first and only beaten by a clearly better spot.
    const onPath = placed.filter((p) => p.onPath)
    const declaredIndex = onPath.indexOf(anchor)
    const anchorChoices = []
    for (let d = 0; d <= 2; d++) {
      for (const step of d === 0 ? [0] : [-d, d]) {
        const cand = onPath[declaredIndex + step]
        if (cand) anchorChoices.push({ node: cand, penalty: d * 1.5 })
      }
    }

    const candidates = []
    for (const { node, penalty } of anchorChoices) {
      const axis = node.tangent.clone().cross(UP).normalize()
      for (const dir of dirs) {
        for (const dist of [8, 10, 12, 14, 16]) {
          const at = node.position.clone().addScaledVector(axis, dir * dist)
          if (!isLand(at.x, at.z)) continue
          candidates.push({
            node,
            axis,
            dir,
            dist,
            score: nearestPath(at.x, at.z).dist - penalty,
          })
        }
      }
    }

    const best = candidates.sort((a, b) => b.score - a.score)[0]
    if (!best) return
    const useAnchor = best.node
    const lateral = best.axis.clone().multiplyScalar(best.dir * best.dist)

    // Anchor to the ACTUAL ground under the offset position. Copying the
    // anchor's height is what buried the world-2 bonus node: a sideways offset
    // can easily land on a taller plateau than the node it hangs off.
    const position = useAnchor.position.clone().add(lateral)
    position.y = Math.max(groundHeightAt(position.x, position.z), useAnchor.position.y)

    placed.push({
      level,
      position,
      tangent: useAnchor.tangent.clone(),
      onPath: false,
      anchorId: useAnchor.level.id,
    })
  })

  return placed
}

/**
 * Short bridge curves joining the end of one world's path to the start of the
 * next, so the three worlds read as one continuous island.
 */
export function buildConnectors() {
  const links = []
  for (let i = 0; i < worlds.length - 1; i++) {
    const a = buildWorldCurves(worlds[i]).full
    const b = buildWorldCurves(worlds[i + 1]).full
    const from = a.getPointAt(1)
    const to = b.getPointAt(0)
    // An L, not a diagonal: run along X first, then along Z.
    const corner = new THREE.Vector3(to.x, (from.y + to.y) / 2, from.z)
    links.push(makeCurve([from, corner, to]))
  }
  return links
}

/**
 * One continuous polyline covering the whole journey: world 1, the bridge to
 * world 2, world 2, the bridge to world 3, world 3.
 *
 * The avatar walks along THIS, rather than hopping in straight lines between
 * node positions. Previously a route was just the list of node centres, so the
 * character cut corners and leapt across terrain instead of following the road
 * — the single most un-Mario thing on the map.
 *
 * Points are ground-anchored, so the walk climbs the terraces properly.
 */
export function buildGrandPath(step = 0.6) {
  const ordered = [...worlds].sort((a, b) => a.center[0] - b.center[0])
  const connectors = buildConnectors()

  const curves = []
  ordered.forEach((w, i) => {
    curves.push(buildWorldCurves(w).full)
    if (connectors[i]) curves.push(connectors[i])
  })

  const points = []
  for (const curve of curves) {
    const n = Math.max(2, Math.round(curve.getLength() / step))
    for (let i = 0; i <= n; i++) {
      const p = curve.getPointAt(i / n)
      // The ROAD's height, not the ground's — this polyline is what the avatar
      // and the creatures walk along, and the road floats above the ground
      // wherever it runs along the lip of a terrace.
      p.y = roadTopAt(p.x, p.z)
      // Skip duplicates where one curve ends and the next begins.
      if (points.length && p.distanceToSquared(points[points.length - 1]) < 1e-4) continue
      points.push(p)
    }
  }
  return points
}

/** Index of the polyline point closest to `position`. */
export function nearestIndexOn(points, position) {
  let best = 0
  let bestD = Infinity
  for (let i = 0; i < points.length; i++) {
    const d = points[i].distanceToSquared(position)
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  return best
}
