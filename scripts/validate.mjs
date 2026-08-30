/**
 * Validates levels.json against the data model and exercises the node
 * distribution algorithm against the real path templates.
 *
 * Run with `npm run validate`. It is the fastest way to find out that a level
 * you just added broke the map — no browser needed.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { worlds } from '../src/config/worlds.js'
import { distributeNodes, buildWorldCurves, buildConnectors, assertOrthogonal } from '../src/three/paths.js'
import { groundHeightAt } from '../src/three/terrain.js'

const here = dirname(fileURLToPath(import.meta.url))
const data = JSON.parse(readFileSync(resolve(here, '../src/data/levels.json'), 'utf8'))
const levels = data.levels

const STAGES = [
  'intro-theory',
  'ar-foundation',
  'meta-pre-exam',
  'mini-boss-midterm',
  'meta-post-exam',
  'xr-toolkit',
  'final-project',
  'final-boss-presentation',
]
const CATEGORIES = ['theory', 'practical', 'boss']
const BOSS_TIERS = ['mini', 'final']
const SLIDE_TYPES = ['pdf', 'canva']

const errors = []
const warnings = []
const err = (m) => errors.push(m)
const warn = (m) => warnings.push(m)

// --- per-level shape -------------------------------------------------------
const seen = new Set()
for (const l of levels) {
  const at = `level "${l.id ?? '(missing id)'}"`
  if (!l.id) err(`${at}: missing id`)
  if (seen.has(l.id)) err(`${at}: duplicate id`)
  seen.add(l.id)

  if (!l.title) err(`${at}: missing title`)
  if (![1, 2, 3].includes(l.world)) err(`${at}: world must be 1, 2 or 3 (got ${l.world})`)
  if (!STAGES.includes(l.stage)) err(`${at}: unknown stage "${l.stage}"`)
  if (!CATEGORIES.includes(l.category)) err(`${at}: unknown category "${l.category}"`)
  if (typeof l.optional !== 'boolean') err(`${at}: "optional" must be a boolean`)

  if (l.category === 'boss') {
    if (!BOSS_TIERS.includes(l.bossTier)) err(`${at}: boss needs bossTier "mini" or "final"`)
    if (l.optional) err(`${at}: a boss can never be optional`)
  } else if (l.bossTier) {
    err(`${at}: bossTier is only valid when category is "boss"`)
  }

  if (l.slides) {
    if (!SLIDE_TYPES.includes(l.slides.type)) err(`${at}: slides.type must be pdf or canva`)
    if (!l.slides.source) err(`${at}: slides.source is empty`)
    if (l.slides.type === 'canva' && !/[?&]embed\b/.test(l.slides.source ?? '')) {
      err(`${at}: Canva link must be the public Share → Embed URL (needs "?embed")`)
    }
    if (l.slides.type === 'canva' && /\/edit\b/.test(l.slides.source ?? '')) {
      err(`${at}: Canva link is an EDIT link — never publish that`)
    }
  } else if (l.category === 'theory') {
    warn(`${at}: theory level with no slides — the portal opens slides first`)
  }

  for (const t of l.todos ?? []) {
    const tat = `${at} todo "${t.id}"`
    if (t.type !== 'objective-task') {
      warn(`${tat}: type "${t.type}" has no renderer yet`)
      continue
    }
    for (const f of ['objective', 'starting_point', 'deliverable']) {
      if (!t[f]) err(`${tat}: missing "${f}"`)
    }
    if (!Array.isArray(t.milestones) || t.milestones.length === 0) {
      err(`${tat}: milestones must be a non-empty array`)
    }
  }

  // The map is date-free by design; catch a stray field early.
  for (const banned of ['date', 'dates', 'week', 'deadline', 'dueDate', 'schedule']) {
    if (banned in l) err(`${at}: "${banned}" is not allowed — the map holds no calendar`)
  }
}

// --- anchors ---------------------------------------------------------------
for (const l of levels.filter((x) => x.optional && x.anchorAfter)) {
  const anchor = levels.find((x) => x.id === l.anchorAfter)
  if (!anchor) err(`level "${l.id}": anchorAfter "${l.anchorAfter}" does not exist`)
  else if (anchor.world !== l.world) err(`level "${l.id}": anchor is in another world`)
  else if (anchor.optional) err(`level "${l.id}": anchor must be a main-path level`)
}

// --- per-world structure ---------------------------------------------------
for (const w of worlds) {
  const mine = levels.filter((l) => l.world === w.id)
  const bosses = mine.filter((l) => l.category === 'boss')
  const hasSlot = w.path.bossSlotIndex != null

  if (mine.length === 0) err(`world ${w.id}: has no levels`)
  if (hasSlot && bosses.length !== 1) {
    err(`world ${w.id}: bossSlot needs exactly 1 boss level, found ${bosses.length}`)
  }
  if (!hasSlot && bosses.length > 1) {
    err(`world ${w.id}: ${bosses.length} bosses but no bossSlot to split on`)
  }
  if (hasSlot) {
    const main = mine.filter((l) => !l.optional)
    const bi = main.findIndex((l) => l.category === 'boss')
    if (bi === 0 || bi === main.length - 1) {
      err(`world ${w.id}: the mini-boss must sit BETWEEN two halves, not at an end`)
    }
  }
}

// --- exercise the distribution algorithm ----------------------------------
console.log('\n--- node distribution ---')
let totalNodes = 0
for (const w of worlds) {
  const mine = levels.filter((l) => l.world === w.id)
  let placed
  try {
    placed = distributeNodes(w, mine)
  } catch (e) {
    err(`world ${w.id}: distributeNodes threw — ${e.message}`)
    continue
  }
  totalNodes += placed.length

  if (placed.length !== mine.length) {
    err(`world ${w.id}: placed ${placed.length} nodes for ${mine.length} levels`)
  }
  for (const p of placed) {
    if (![p.position.x, p.position.y, p.position.z].every(Number.isFinite)) {
      err(`world ${w.id}: level "${p.level.id}" got a non-finite position`)
    }
  }

  // Paths must stay blocky: straight runs joined by 90-degree corners.
  const diagonal = assertOrthogonal(
    w.path.controlPoints.map((c) => ({ x: c[0], z: c[2] })),
    `world ${w.id}`
  )
  if (diagonal) err(diagonal)

  // Nothing may be buried. This is the check that would have caught the
  // world-2 bonus node sitting under the terrain.
  for (const pl of placed) {
    const ground = groundHeightAt(pl.position.x, pl.position.z)
    if (pl.position.y < ground - 0.01) {
      err(
        `world ${w.id}: "${pl.level.id}" is ${(ground - pl.position.y).toFixed(2)} BELOW the ` +
          `ground at its own position — anchor it with groundHeightAt()`
      )
    }
  }

  // Nodes are spread evenly by ARC LENGTH, which is the correct definition of
  // "evenly distributed along the path". Straight-line distance between
  // neighbours is therefore *expected* to shrink where the spline bends —
  // that is curvature, not a spacing bug. So we only assert what actually
  // hurts: nodes close enough to collide, or a curve so tight for this many
  // levels that the path doubles back on itself visually.
  const onPath = placed.filter((p) => p.onPath)
  const gaps = onPath.slice(1).map((p, i) => p.position.distanceTo(onPath[i].position))
  const min = Math.min(...gaps)
  const max = Math.max(...gaps)

  const NODE_CLEARANCE = 5 // world units; node discs are ~2.4 across
  if (min < NODE_CLEARANCE) {
    err(
      `world ${w.id}: nodes only ${min.toFixed(2)} apart (min ${NODE_CLEARANCE}) — ` +
        `too many levels for this path, stretch the control points`
    )
  }
  if (max / min > 2.2) {
    warn(
      `world ${w.id}: chord spacing varies a lot (${min.toFixed(2)}–${max.toFixed(2)}) — ` +
        `the spline may bend too sharply for ${onPath.length} nodes`
    )
  }

  const boss = placed.find((p) => p.level.category === 'boss')
  let bossNote = ''
  if (boss) {
    const curves = buildWorldCurves(w)
    if (curves.bossPoint) {
      // World 2: the mini-boss must land exactly on the reserved slot.
      const off = boss.position.distanceTo(curves.bossPoint)
      if (off > 1e-6) err(`world ${w.id}: mini-boss is ${off.toFixed(4)} off its bossSlot`)
      bossNote = ', mini-boss exactly on slot ✓'
    } else {
      // No slot (world 3): the final boss closes the world, so it must be the
      // last main-path node and sit at the very end of the curve.
      const onPathOnly = placed.filter((p) => p.onPath)
      const isLast = onPathOnly[onPathOnly.length - 1]?.level.id === boss.level.id
      if (!isLast) err(`world ${w.id}: the final boss must be the last level on the path`)
      const off = boss.position.distanceTo(curves.full.getPointAt(1))
      if (off > 1e-6) err(`world ${w.id}: final boss is ${off.toFixed(4)} off the path end`)
      bossNote = ', final boss closes the path ✓'
    }
  }

  console.log(
    `  world ${w.id}: ${placed.length} nodes ` +
      `(${onPath.length} on path, ${placed.length - onPath.length} optional off-path), ` +
      `gap ${min.toFixed(2)}–${max.toFixed(2)}${bossNote}`
  )
}

const connectors = buildConnectors()
console.log(`  ${connectors.length} inter-world connectors built`)

// --- coverage the brief asks for ------------------------------------------
console.log('\n--- coverage ---')
const cover = (label, ok, detail) => {
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) err(`coverage: ${label}`)
}
const missingStages = STAGES.filter((s) => !levels.some((l) => l.stage === s))
cover('all 8 stages present', missingStages.length === 0, missingStages.join(', ') || '8/8')
cover(
  'both boss tiers',
  BOSS_TIERS.every((t) => levels.some((l) => l.bossTier === t)),
  levels.filter((l) => l.category === 'boss').map((l) => `${l.id}:${l.bossTier}`).join(', ')
)
cover('at least one optional node', levels.some((l) => l.optional),
  levels.filter((l) => l.optional).map((l) => l.id).join(', '))
cover('a PDF slide example', levels.some((l) => l.slides?.type === 'pdf'))
cover('a Canva slide example', levels.some((l) => l.slides?.type === 'canva'))
cover('an objective-task todo', levels.some((l) => l.todos?.some((t) => t.type === 'objective-task')))

// --- report ----------------------------------------------------------------
console.log(`\n${levels.length} levels, ${totalNodes} nodes placed.`)
for (const w of warnings) console.warn(`WARN  ${w}`)
for (const e of errors) console.error(`ERROR ${e}`)
if (errors.length) {
  console.error(`\n${errors.length} error(s).`)
  process.exit(1)
}
console.log(`OK${warnings.length ? ` (${warnings.length} warning(s))` : ''}\n`)
