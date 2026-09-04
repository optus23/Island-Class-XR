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
import { groundHeightAt, nearestPath } from '../src/three/terrain.js'

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

// The graded practical blocks — 30% of the course, 10% per block.
// `null` is a legal value for submissionMethod and groupMode and means
// "not decided yet". It is NOT the same as the field being absent.
const SUBMISSION_METHODS = ['build', 'video', 'repo']
const GROUP_MODES = ['individual', 'individual-within-group', 'per-group']

const errors = []
const warnings = []
const fixmes = []
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

  // --- graded exercise fields ---------------------------------------------
  // Checked whenever present, so a stray value on a non-exercise level is
  // caught too.
  if ('submissionMethod' in l && l.submissionMethod !== null &&
      !SUBMISSION_METHODS.includes(l.submissionMethod)) {
    err(`${at}: submissionMethod "${l.submissionMethod}" — use ${SUBMISSION_METHODS.join(' | ')} or null`)
  }
  if ('groupMode' in l && l.groupMode !== null && !GROUP_MODES.includes(l.groupMode)) {
    err(`${at}: groupMode "${l.groupMode}" — use ${GROUP_MODES.join(' | ')} or null`)
  }
  if (l.gradeWeight) {
    if (!('block' in l.gradeWeight) || !('exercise' in l.gradeWeight)) {
      err(`${at}: gradeWeight needs both "block" and "exercise" (exercise may be null)`)
    }
  }
  if (l.starterRepo) {
    if (!l.starterRepo.branch) err(`${at}: starterRepo needs a branch name`)
    if (l.starterRepo.url != null && !/^https:\/\//.test(l.starterRepo.url)) {
      err(`${at}: starterRepo.url must be an https URL, or null until the repo exists`)
    }
  }

  if (l.block) {
    const b = l.block
    if (![1, 2, 3].includes(b.number)) err(`${at}: block.number must be 1, 2 or 3`)
    if (!b.name) err(`${at}: block.name is empty`)
    if (!Number.isInteger(b.of) || b.of < 1) err(`${at}: block.of must be a positive integer`)
    if (!Number.isInteger(b.exercise) || b.exercise < 1 || b.exercise > b.of) {
      err(`${at}: block.exercise ${b.exercise} is out of range for a block of ${b.of}`)
    }
    if (l.category !== 'practical') err(`${at}: a graded block exercise must be category "practical"`)
    if (l.optional) err(`${at}: a graded block exercise cannot be optional`)
    if (!l.todos?.length) err(`${at}: a graded block exercise needs at least one todo`)
    for (const f of ['submissionMethod', 'groupMode', 'gradeWeight']) {
      if (!(f in l)) err(`${at}: graded exercise is missing "${f}" (null is fine, absent is not)`)
    }
    if (l.gradeWeight && !l.gradeWeight.block) {
      err(`${at}: gradeWeight.block is the known 10% per block — it must not be empty`)
    }
  }

  for (const note of l._fixme ?? []) fixmes.push(`${l.id}: ${note}`)

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

// --- generated Marp decks --------------------------------------------------
// `npm run decks` runs before this (prebuild), so the manifest is current.
// Missing is fine: it just means no exercise markdown has opted in yet.
let decks = {}
try {
  decks = JSON.parse(readFileSync(resolve(here, '../public/decks/index.json'), 'utf8')).decks ?? {}
} catch {
  warn('no public/decks/index.json — run `npm run decks` (build does it for you)')
}
for (const [id, deck] of Object.entries(decks)) {
  const level = levels.find((l) => l.id === id)
  if (!level) {
    warn(`deck "${id}" has no level with that id — the file will never be opened`)
    continue
  }
  // The generated deck wins in the viewer, so a slides block underneath it is
  // config that can never take effect.
  if (level.slides) {
    warn(
      `level "${id}": has a generated Marp deck AND a "${level.slides.type}" slides block — ` +
        `the deck wins, so the slides block is dead config`
    )
  }
  if (!deck.answers) warn(`deck "${id}": no slide tagged \`<!-- _class: answer -->\``)
}

// --- graded practical blocks ----------------------------------------------
// Each block's exercises must be numbered 1..of, once each, and must appear on
// the map in that order — the narrative only works read front to back.
const blocks = new Map()
for (const l of levels.filter((x) => x.block)) {
  const key = l.block.number
  if (!blocks.has(key)) blocks.set(key, [])
  blocks.get(key).push(l)
}
for (const [number, mine] of [...blocks].sort((a, b) => a[0] - b[0])) {
  const of = mine[0].block.of
  const seenEx = new Set()
  for (const l of mine) {
    if (l.block.of !== of) err(`block ${number}: "${l.id}" says block.of ${l.block.of}, siblings say ${of}`)
    if (seenEx.has(l.block.exercise)) err(`block ${number}: two levels claim exercise ${l.block.exercise}`)
    seenEx.add(l.block.exercise)
  }
  if (mine.length !== of) {
    err(`block ${number}: ${mine.length} exercise levels but block.of says ${of}`)
  }
  // Map order is declaration order, so the indices must already ascend.
  const order = mine.map((l) => l.block.exercise)
  if (order.some((n, i) => i > 0 && n < order[i - 1])) {
    err(`block ${number}: exercises are out of order on the map (${order.join(', ')})`)
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

  // An optional branch must genuinely leave the road, not hug it.
  const MIN_BRANCH_CLEARANCE = 4.5
  for (const pl of placed.filter((x) => !x.onPath)) {
    const d = nearestPath(pl.position.x, pl.position.z).dist
    if (d < MIN_BRANCH_CLEARANCE) {
      err(
        `world ${w.id}: optional "${pl.level.id}" is only ${d.toFixed(2)} from the road ` +
          `(min ${MIN_BRANCH_CLEARANCE}) — it reads as part of the main path`
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
    // Compared on the GROUND PLANE only. Y is not the curve's to decide —
    // every placed object is anchored through groundHeightAt(), so the moment
    // the terrain quantisation changed, an exact 3D match started failing for
    // a castle that was standing in precisely the right place.
    const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z)
    if (curves.bossPoint) {
      // World 2: the mini-boss must land exactly on the reserved slot.
      const off = flat(boss.position, curves.bossPoint)
      if (off > 1e-6) err(`world ${w.id}: mini-boss is ${off.toFixed(4)} off its bossSlot`)
      bossNote = ', mini-boss exactly on slot ✓'
    } else {
      // No slot (world 3): the final boss closes the world, so it must be the
      // last main-path node and sit at the very end of the curve.
      const onPathOnly = placed.filter((p) => p.onPath)
      const isLast = onPathOnly[onPathOnly.length - 1]?.level.id === boss.level.id
      if (!isLast) err(`world ${w.id}: the final boss must be the last level on the path`)
      const off = flat(boss.position, curves.full.getPointAt(1))
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
cover(
  'a generated Marp deck',
  Object.keys(decks).length > 0,
  `${Object.keys(decks).length} deck(s), ` +
    `${Object.values(decks).reduce((n, d) => n + d.answers, 0)} answer slide(s) held back`
)
cover(
  'the 8 graded block exercises',
  levels.filter((l) => l.block).length === 8,
  [...blocks].sort((a, b) => a[0] - b[0]).map(([n, m]) => `bloque ${n}: ${m.length}`).join(', ')
)

// --- report ----------------------------------------------------------------
console.log(`\n${levels.length} levels, ${totalNodes} nodes placed.`)
if (fixmes.length) {
  // Open decisions from the exercise brief. Deliberately unresolved — they are
  // printed on every run so they cannot quietly become permanent.
  console.log(`\n--- open decisions (${fixmes.length}) ---`)
  for (const f of fixmes) console.log(`  ${f}`)
  console.log('  full list: docs/decisiones-abiertas.md')
}
for (const w of warnings) console.warn(`WARN  ${w}`)
for (const e of errors) console.error(`ERROR ${e}`)
if (errors.length) {
  console.error(`\n${errors.length} error(s).`)
  process.exit(1)
}
console.log(`OK${warnings.length ? ` (${warnings.length} warning(s))` : ''}\n`)
