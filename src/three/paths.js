import * as THREE from 'three'
import { worlds } from '../config/worlds.js'
import { groundHeightAt } from './terrain.js'

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

function sample(curve, u) {
  const position = curve.getPointAt(u)
  // Snap to the real ground so nodes never float over, or sink into, the
  // quantised terrain the curve only approximates.
  position.y = groundHeightAt(position.x, position.z)
  return { position, tangent: curve.getTangentAt(u).normalize() }
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

    const side = level.offsetSide === 'left' ? -1 : level.offsetSide === 'right' ? 1 : n % 2 ? -1 : 1
    const distance = level.offsetDistance ?? 7.5
    const lateral = anchor.tangent.clone().cross(UP).normalize().multiplyScalar(side * distance)

    // Anchor to the ACTUAL ground under the offset position. Copying the
    // anchor's height is what buried the world-2 bonus node: a sideways offset
    // can easily land on a taller plateau than the node it hangs off.
    const position = anchor.position.clone().add(lateral)
    position.y = Math.max(groundHeightAt(position.x, position.z), anchor.position.y)

    placed.push({
      level,
      position,
      tangent: anchor.tangent.clone(),
      onPath: false,
      anchorId: anchor.level.id,
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
