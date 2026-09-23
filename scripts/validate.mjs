/**
 * Validates levels.json against the data model and exercises the node
 * distribution algorithm against the real path templates.
 *
 * Run with `npm run validate`. It is the fastest way to find out that a level
 * you just added broke the map — no browser needed.
 */
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { worlds } from '../src/config/worlds.js'
import {
  distributeNodes,
  buildWorldCurves,
  buildConnectors,
  assertOrthogonal,
  nodeClearings,
} from '../src/three/paths.js'
import { groundHeightAt, nearestPath, clearGroundAround } from '../src/three/terrain.js'
import { MAX_NAME, MAX_NPCS, cleanName } from '../src/lib/roster.js'

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
const CATEGORIES = ['theory', 'practical', 'project', 'boss']
// 'extra' is the re-evaluation: an exam that is not a class, hanging off the
// final castle on a dashed connector. It is the ONLY boss that may be optional.
const BOSS_TIERS = ['mini', 'final', 'extra']
const SLIDE_TYPES = ['pdf', 'canva']

// The three graded practical blocks. What they are WORTH is not recorded
// anywhere in this repository — see the no-percentages rule in CLAUDE.md.
// `null` is a legal value for submissionMethod and groupMode and means
// "not decided yet". It is NOT the same as the field being absent.
// 'none' is not a missing value: it says this exercise is NOT handed in on its
// own. Block 1's hand-in happens once, at the end of the block, so exercises
// 1-1 and 1-2 have nothing to submit and the portal drops the row entirely.
// `null` still means "not decided yet" and renders as «por decidir».
const SUBMISSION_METHODS = ['build', 'video', 'repo', 'none']
/** Must agree with `deliverableKind` in `src/lib/levels.js`. */
const DELIVERABLE_KINDS = ['graded', 'optional']
const GROUP_MODES = [
  'individual',
  'individual-within-group',
  'per-group',
  // What all three blocks are today: group work whose groups may be re-formed
  // at the start of each block. Kept distinct from 'per-group' because the
  // re-forming is the part students ask about.
  'per-group-per-block',
]

// The runtime holds the ground down around every session disc before it builds
// the island. Validation samples the same terrain, so it has to do the same or
// it is checking a different island from the one that ships.
clearGroundAround(nodeClearings(levels))

const errors = []
const warnings = []
const fixmes = []
/** `slidesLabelKey` -> the level that asked for it, checked against i18n below. */
const labelKeys = new Map()
const untranslated = []
const err = (m) => errors.push(m)
const warn = (m) => warnings.push(m)

/**
 * Content text is EITHER a plain string (one language, not migrated yet) OR
 * a `{ en, es, ca }` object — see `src/lib/i18n/text.js` for why both are
 * valid. This says "is it one of those", and `noteUntranslated` below adds
 * whatever is still missing to a list that is PRINTED, not fatal: unlike the
 * interface dictionary, the course content is Marc's to write, and a
 * half-written session must stay committable.
 */
const isText = (v) =>
  typeof v === 'string' || (v && typeof v === 'object' && !Array.isArray(v))

const LANGS = ['en', 'es', 'ca']
/**
 * The same rule as `needsTranslation` in `src/lib/i18n/text.js`, restated here
 * rather than imported: that module reaches `i18n/index.js`, which reads
 * `localStorage` and `location`, and this script runs under Node.
 */
const needsTranslation = (value, lang) => {
  if (value == null) return false
  if (typeof value === 'string') return true
  return !String(value[lang] ?? '').trim()
}
const noteUntranslated = (where, value) => {
  if (value == null) return
  if (typeof value === 'string') {
    untranslated.push(`${where}: not translated (plain string)`)
    return
  }
  const missing = LANGS.filter((code) => !String(value[code] ?? '').trim())
  if (missing.length) untranslated.push(`${where}: missing ${missing.join(', ')}`)
}

// --- the course header -----------------------------------------------------
// `title` is a NAME ("XR Island") and stays one string in every language. The
// two lines under it describe the subject — the nav panel's subtitle and the
// intro plate's tagline — and both are read by a student, so both translate.
// They were plain strings and stayed Spanish under an English interface.
if (data.course) {
  if (typeof data.course.title !== 'string' || !data.course.title.trim()) {
    err('course: "title" must be a non-empty string — it is a name, not translated text')
  }
  for (const f of ['subtitle', 'tagline']) {
    if (data.course[f] === undefined) continue
    if (!isText(data.course[f])) err(`course: "${f}" must be a string or {en, es, ca}`)
    noteUntranslated(`course ${f}`, data.course[f])
  }
}

// --- per-level shape -------------------------------------------------------
const seen = new Set()
for (const l of levels) {
  const at = `level "${l.id ?? '(missing id)'}"`
  if (!l.id) err(`${at}: missing id`)
  if (seen.has(l.id)) err(`${at}: duplicate id`)
  seen.add(l.id)

  if (!l.title) err(`${at}: missing title`)
  else if (!isText(l.title)) err(`${at}: "title" must be a string or {en, es, ca}`)
  noteUntranslated(`${at} title`, l.title)
  if (l.summary !== undefined) {
    if (!isText(l.summary)) err(`${at}: "summary" must be a string or {en, es, ca}`)
    noteUntranslated(`${at} summary`, l.summary)
  }
  if (![1, 2, 3].includes(l.world)) err(`${at}: world must be 1, 2 or 3 (got ${l.world})`)
  if (!STAGES.includes(l.stage)) err(`${at}: unknown stage "${l.stage}"`)
  if (!CATEGORIES.includes(l.category)) err(`${at}: unknown category "${l.category}"`)
  if (typeof l.optional !== 'boolean') err(`${at}: "optional" must be a boolean`)

  if (l.category === 'boss') {
    if (!BOSS_TIERS.includes(l.bossTier)) {
      err(`${at}: boss needs bossTier "mini", "final" or "extra"`)
    }
    // A boss ON THE PATH can never be optional — the route has to run through
    // it. An 'extra' boss is off the path by definition and must be optional.
    if (l.optional && l.bossTier !== 'extra') {
      err(`${at}: only an "extra" boss may be optional`)
    }
    if (!l.optional && l.bossTier === 'extra') {
      err(`${at}: an "extra" boss hangs off the path, so it must be optional`)
    }
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
  if ('gradeWeight' in l) {
    err(`${at}: "gradeWeight" is not allowed — grades live in the university's own docencia platform, not on the island`)
  }
  // The flag beside a session that carries a hand-in. `kind` is a WORD, not a
  // number: it says whether the hand-in counts towards the course or is a
  // voluntary practical, and it picks the pennant's colour. It carried a
  // `weight` — a percentage — for exactly one round, which put a grade
  // straight into the tooltip — the same rule `gradeWeight` above exists to hold.
  if (l.deliverable !== undefined) {
    const d = l.deliverable
    if (!d || typeof d !== 'object' || Array.isArray(d)) {
      err(`${at}: "deliverable" must be an object — { label, kind }`)
    } else {
      if (!d.label || typeof d.label !== 'string') err(`${at}: deliverable.label must be a string`)
      if (!DELIVERABLE_KINDS.includes(d.kind)) {
        err(`${at}: deliverable.kind "${d.kind}" — use ${DELIVERABLE_KINDS.join(' | ')}`)
      }
      if ('weight' in d) {
        err(`${at}: "deliverable.weight" is not allowed — the island shows WHAT a hand-in is, never what it is worth`)
      }
      for (const k of Object.keys(d)) {
        if (!['label', 'kind'].includes(k)) err(`${at}: unknown deliverable field "${k}"`)
      }
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
    for (const f of ['submissionMethod', 'groupMode']) {
      if (!(f in l)) err(`${at}: graded exercise is missing "${f}" (null is fine, absent is not)`)
    }
  }

  for (const note of l._fixme ?? []) fixmes.push(`${l.id}: ${note}`)

  if (l.contents !== undefined) {
    l.contents?.forEach?.((c, i) => noteUntranslated(`${at} contents[${i}]`, c))
    if (!Array.isArray(l.contents) || l.contents.some((c) => !isText(c))) {
      err(`${at}: "contents" must be an array of text (a string, or {en, es, ca})`)
    }
  }
  if (l.attitudeGrade !== undefined && typeof l.attitudeGrade !== 'string') {
    err(`${at}: "attitudeGrade" must be the deliverable's name, as a string`)
  }
  // The slide deck link from the calendar's Classes column. A LINK, not an
  // embed: these are canva.link shortlinks, which are neither "?embed" URLs
  // nor "/edit" ones, so they cannot go through the `slides` block without
  // failing its Canva rule. When public embed URLs arrive they become real
  // `slides` entries and this field goes away for that level. As of the round
  // that read the board on 9 September 2026 no level uses it any more — every
  // deck the calendar names is a full canva.com/design URL — but the field
  // stays supported for anything that refuses to be framed.
  if (l.slidesLink) {
    if (!l.slidesLink.url) err(`${at}: slidesLink.url is empty`)
    else if (!/^https?:\/\//.test(l.slidesLink.url)) {
      err(`${at}: slidesLink.url must be absolute (got "${l.slidesLink.url}")`)
    }
    if (!l.slidesLink.label) err(`${at}: slidesLink.label is empty`)
    if (l.slides) err(`${at}: has both "slides" and "slidesLink" — pick one`)
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
  } else if (l.category === 'theory' && !l.slidesLink && !l.slidesPending) {
    warn(`${at}: theory level with no slides — the portal opens slides first`)
  }

  // "Marc has not made this deck yet", said out loud in the data.
  //
  // Without it a session waiting on a deck is indistinguishable from a project
  // day that will never have one, and the portal says the same flat thing about
  // both. It must not survive the deck arriving, so a level carrying a deck AND
  // the flag is an error rather than a warning — the flag is deleted in the same
  // edit that adds the `slides` block.
  if (l.slidesPending !== undefined) {
    if (l.slidesPending !== true) err(`${at}: "slidesPending" is a flag — true, or absent`)
    if (l.slides || l.slidesLink) {
      err(`${at}: has slides AND "slidesPending" — drop the flag, the deck arrived`)
    }
  }

  // "This session has no lecture of its own", said out loud, which is the only
  // thing that takes the Slides tab away. Absent is NOT the same statement:
  // thirteen levels have no deck and still want the tab, because the contents
  // list inside it is all the session has.
  if (l.slidesHidden !== undefined) {
    if (l.slidesHidden !== true) err(`${at}: "slidesHidden" is a flag — true, or absent`)
    if (l.slides || l.slidesLink || l.slidesPending) {
      err(`${at}: has "slidesHidden" AND a deck (or slidesPending) — pick one`)
    }
  }

  // What the level asks the student to hand over, shown on the first panel.
  // Prose, so it takes the same two shapes everything else does and shows up
  // in the "still to translate" list when it is only in one language.
  if (l.handIn !== undefined) {
    const h = l.handIn
    if (!h || typeof h !== 'object' || Array.isArray(h)) {
      err(`${at}: "handIn" must be an object — { note, items }`)
    } else {
      for (const k of Object.keys(h)) {
        if (!['note', 'items'].includes(k)) err(`${at}: unknown handIn field "${k}"`)
      }
      if (h.note !== undefined) {
        if (!isText(h.note)) err(`${at}: handIn.note must be a string or {en, es, ca}`)
        noteUntranslated(`${at} handIn.note`, h.note)
      }
      if (h.items !== undefined) {
        if (!Array.isArray(h.items) || !h.items.length || h.items.some((i) => !isText(i))) {
          err(`${at}: handIn.items must be a non-empty array of text`)
        } else {
          h.items.forEach((i, n) => noteUntranslated(`${at} handIn.items[${n}]`, i))
        }
      }
      if (h.note === undefined && h.items === undefined) {
        err(`${at}: "handIn" is empty — give it a note, items, or drop it`)
      }
    }
  }

  // Renames the first tab on this level alone. It is an i18n KEY and not a
  // word, because a literal would be the one label on the page that cannot be
  // translated; that the key exists in all three is checked further down,
  // where the dictionaries are already loaded.
  if (l.slidesLabelKey !== undefined) {
    if (typeof l.slidesLabelKey !== 'string' || !l.slidesLabelKey) {
      err(`${at}: "slidesLabelKey" must be an i18n key, as a string`)
    } else {
      labelKeys.set(l.slidesLabelKey, at)
    }
    if (l.slidesHidden) err(`${at}: has "slidesHidden" AND "slidesLabelKey" — a hidden tab needs no name`)
  }

  // A level with no tabs at all opens on an empty panel with no way to reach
  // anything. Mirrors `tabsFor` in ui/portal.js; if that gains a tab, so does
  // this.
  const tabs =
    (l.slidesHidden ? 0 : 1) +
    (l.todos?.length || l.exercises ? 1 : 0) +
    (l.bibliography ? 1 : 0)
  if (tabs === 0) err(`${at}: every tab is hidden — the portal would open empty`)

  for (const t of l.todos ?? []) {
    const tat = `${at} todo "${t.id}"`
    if (t.type !== 'objective-task') {
      warn(`${tat}: type "${t.type}" has no renderer yet`)
      continue
    }
    for (const f of ['objective', 'starting_point']) {
      if (!t[f]) err(`${tat}: missing "${f}"`)
      else if (!isText(t[f])) err(`${tat}: "${f}" must be a string or {en, es, ca}`)
      noteUntranslated(`${tat} ${f}`, t[f])
    }
    // OPTIONAL, and absent is a real answer: an exercise that is not handed in
    // on its own has nothing to put here. It was required until 16 September
    // 2026, which is why every exercise in block 1 carried one — and block 1
    // has a single hand-in, at the end. Absent, the portal drops the section.
    if (t.deliverable !== undefined) {
      if (!isText(t.deliverable)) err(`${tat}: "deliverable" must be a string or {en, es, ca}`)
      noteUntranslated(`${tat} deliverable`, t.deliverable)
    }
    // `steps`, not `milestones`: an ordered guide the student follows top to
    // bottom, which is what the v3.0 content replaced the achievement list with.
    if (!Array.isArray(t.steps) || t.steps.length === 0) {
      err(`${tat}: steps must be a non-empty array`)
    } else {
      // The steps are the longest prose in the course, so they are counted as
      // ONE line in the outstanding list rather than one per step — 90 entries
      // saying the same thing is a list nobody reads.
      if (t.steps.some((s) => !isText(s))) {
        err(`${tat}: every step must be a string or {en, es, ca}`)
      }
      const langs = ['en', 'es', 'ca'].filter((code) =>
        t.steps.some((s) => needsTranslation(s, code))
      )
      if (langs.length) {
        untranslated.push(`${tat} steps (${t.steps.length}): missing ${langs.join(', ')}`)
      }
    }
    if (t.milestones) err(`${tat}: "milestones" was renamed to "steps"`)
    if (t.steps_note !== undefined) {
      if (!isText(t.steps_note)) err(`${tat}: "steps_note" must be a string or {en, es, ca}`)
      noteUntranslated(`${tat} steps_note`, t.steps_note)
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
  // Only bosses ON THE PATH count towards the world's structure; an 'extra'
  // hangs off it and is placed through anchorAfter like any bonus node.
  const bosses = mine.filter((l) => l.category === 'boss' && !l.optional)
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
  // A TRANSLATED deck is `<level>.es` / `<level>.ca`, not a level id of its own
  // (`deckIdFor` in ui/deck.js looks the language up first and falls back to
  // the base). Checking the raw id against the level list warned about all
  // eight of them the moment world 1 was translated — a warning that is always
  // wrong is how people learn to ignore the warnings.
  const base = id.replace(/\.(es|ca)$/, '')
  const level = levels.find((l) => l.id === base)
  if (!level) {
    warn(`deck "${id}" has no level with that id — the file will never be opened`)
    continue
  }
  // Everything below is about the LEVEL's configuration, so a translation has
  // nothing new to say: it would repeat its base deck's warning once per
  // language.
  if (base !== id) continue
  // The generated deck wins in the viewer, so a slides block underneath it is
  // config that can never take effect.
  // Both is legal and normal: the calendar's Classes column carries the lecture
  // deck and "+ TODO's (Marp)" for the same day, and they are different
  // documents. The viewer shows the generated deck with a link to the other
  // above it. Only flag the combination the viewer cannot show.
  if (level.slides && level.slides.type === 'pdf') {
    warn(
      `level "${id}": has a generated Marp deck AND a PDF slides block — ` +
        `the deck fills the panel, so only the PDF's link survives`
    )
  }
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
/** Sessions a villager may pace around — see the roster check further down. */
const onPathIds = new Set()
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
  // Not the castles: the building fills the pad, so a villager placed at one is
  // swallowed by it. See VILLAGER_SESSIONS in main.js.
  for (const p of placed) if (p.onPath && p.level.category !== 'boss') onPathIds.add(p.level.id)

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

  // Where the ROAD rides well above the ground beneath it.
  //
  // The ribbon takes the HIGHEST of five samples across its width, so beside a
  // terrace step it sits a long way above the terrain at its centre line. A
  // node disc placed off a single groundHeightAt() then sank underneath it and
  // the cream surface was drawn over the disc — reported as "paths on top of
  // the session button". nodes.js now stands on-path discs on the ROAD's
  // surface (roadTopAt + ROAD_SURFACE_LIFT + DISC_CLEARANCE), which fixes it.
  //
  // This is a WARNING, not an error: those nodes are legal and now render
  // correctly. It flags them because their placement is the fragile case, and
  // anyone going back to a plain ground sample will re-break exactly these.
  const ROAD_HALF = 1.2
  const roadTopAt = (x, z, t) => {
    const sx = t.z * ROAD_HALF
    const sz = -t.x * ROAD_HALF
    return Math.max(
      groundHeightAt(x - sx, z - sz),
      groundHeightAt(x + sx, z + sz),
      groundHeightAt(x, z),
      groundHeightAt(x - sx * 1.35, z - sz * 1.35),
      groundHeightAt(x + sx * 1.35, z + sz * 1.35)
    )
  }
  for (const pl of placed.filter((x) => x.onPath)) {
    const gap = roadTopAt(pl.position.x, pl.position.z, pl.tangent) -
      groundHeightAt(pl.position.x, pl.position.z)
    if (gap > 1) {
      warn(
        `world ${w.id}: the road at "${pl.level.id}" rides ${gap.toFixed(2)} above the ` +
          `ground under it — its disc MUST be placed on the road surface, not the ground`
      )
    }
  }

  // Nothing may stand above a session disc. This is what the pads are for, and
  // it is the check that would have caught the seven nodes with a slab of
  // terrain leaning over them.
  for (const pl of placed.filter((x) => x.onPath)) {
    const here = groundHeightAt(pl.position.x, pl.position.z)
    let highest = here
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
      // 2.8 and 3.4 cover the band the villagers pace in — see RING in
      // three/villagers.js. Nothing may rise inside that either, or one of them
      // ends up walking through a step of terrain.
      for (const r of [1.6, 2.2, 2.8, 3, 3.4]) {
        highest = Math.max(
          highest,
          groundHeightAt(pl.position.x + Math.cos(a) * r, pl.position.z + Math.sin(a) * r)
        )
      }
    }
    if (highest > here) {
      err(
        `world ${w.id}: ground around "${pl.level.id}" rises ${(highest - here).toFixed(1)} ` +
          `above the disc — it will hang over the session circle`
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

    // AND IT MUST STAND ON THE GROUND. Off-path nodes get no flat pad, so the
    // terrain under one is whatever the terrain is — which is fine, and is
    // why the node takes its height from `groundHeightAt` and nothing else.
    // The placement used to raise a branch to its ANCHOR's shelf as well,
    // which floated the re-evaluation castle a full plateau the moment it
    // moved onto the cliff beside the final castle. A castle with daylight
    // under its walls has already been reported once, on the midterm.
    // Checked across the footprint, not just the centre: the centre was
    // never the part that floated.
    const R = pl.level.category === 'boss' ? 3.5 * (pl.level.bossTier === 'final' ? 2.3 : 0.95) : 2
    let lo = Infinity
    let hi = -Infinity
    for (let a = 0; a < 360; a += 15) {
      for (const r of [R * 0.4, R * 0.7, R]) {
        const h = groundHeightAt(
          pl.position.x + Math.cos((a * Math.PI) / 180) * r,
          pl.position.z + Math.sin((a * Math.PI) / 180) * r
        )
        lo = Math.min(lo, h)
        hi = Math.max(hi, h)
      }
    }
    const gap = pl.position.y - hi
    if (gap > 0.01) {
      err(
        `world ${w.id}: optional "${pl.level.id}" floats ${gap.toFixed(2)} above its own ground ` +
          `(node y ${pl.position.y.toFixed(2)}, terrain ${lo.toFixed(2)}..${hi.toFixed(2)})`
      )
    }
    if (pl.position.y - lo < -0.01) {
      err(
        `world ${w.id}: optional "${pl.level.id}" is buried — node y ${pl.position.y.toFixed(2)}, ` +
          `terrain ${lo.toFixed(2)}..${hi.toFixed(2)}`
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

// --- the roster of honoured students --------------------------------------
// public/npcs.json is written from /admin, not by hand, but it is a committed
// file like any other: a bad entry has to fail here rather than at runtime, and
// the no-calendar rule applies to it exactly as it does to the level data.
console.log('\n--- alumnos en la isla ---')
let roster = null
try {
  roster = JSON.parse(readFileSync(resolve(here, '../public/npcs.json'), 'utf8'))
} catch {
  warn('no public/npcs.json — nobody walks the island (fine, but /admin needs the file)')
}
if (roster) {
  const list = roster.npcs
  if (!Array.isArray(list)) {
    err('npcs.json: "npcs" must be an array')
  } else {
    if (list.length > MAX_NPCS) {
      err(`npcs.json: ${list.length} entries, the island renders ${MAX_NPCS} — the rest are dropped`)
    }
    const ids = new Set()
    for (const [i, n] of list.entries()) {
      const at = `npcs.json[${i}]`
      const name = cleanName(n?.name)
      if (!name) err(`${at}: empty name`)
      if (String(n?.name ?? '') !== name) {
        warn(`${at}: name "${n?.name}" will be shown as "${name}" (trimmed to ${MAX_NAME})`)
      }
      if (!n?.id) err(`${at}: missing id`)
      else if (ids.has(n.id)) err(`${at}: duplicate id "${n.id}"`)
      else ids.add(n.id)
      // A villager's circuit needs the flat pad that only on-path sessions get.
      if (!levels.some((l) => l.id === n?.levelId)) {
        err(`${at}: levelId "${n?.levelId}" is not a level`)
      } else if (!onPathIds.has(n.levelId)) {
        err(`${at}: "${n.levelId}" is not a session a villager fits at (off-path, or a castle)`)
      }
      for (const banned of ['date', 'week', 'points', 'score', 'grade', 'email']) {
        if (banned in (n ?? {})) {
          err(`${at}: "${banned}" is not allowed — the roster holds a name and a session, nothing else`)
        }
      }
    }
    const perSession = new Map()
    for (const n of list) perSession.set(n?.levelId, (perSession.get(n?.levelId) ?? 0) + 1)
    const crowded = [...perSession].filter(([, c]) => c > 4)
    for (const [id, c] of crowded) {
      warn(`npcs.json: ${c} alumnos alrededor de "${id}" — se pisan; el disco admite 3 con holgura`)
    }
    console.log(
      `  ${list.length} alumno(s) en ${perSession.size} sesión(es), ` +
        `${MAX_NPCS - list.length} plaza(s) libre(s)`
    )
  }
}

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
// Slides come off the calendar's Classes column. They arrived as canva.link
// shortlinks, which can only ever be a button; they are now full
// canva.com/design URLs, which frame. This is a REPORT and not a `cover` check:
// requiring at least one shortlink made sense while they were the only thing
// there, and would now fail the build for the good outcome.
{
  const embeds = levels.filter((l) => l.slides).length
  const links = levels.filter((l) => l.slidesLink).length
  const pending = levels.filter((l) => l.slidesPending)
  console.log(
    `  ${embeds ? '✓' : '·'} embedded decks (pdf/canva) — ${embeds || 'none yet; ' +
      'waiting on public Share → Embed URLs'}`
  )
  if (links) console.log(`  · decks that are a link, not an embed — ${links}`)
  if (pending.length) {
    console.log(
      `  · decks not made yet — ${pending.length}: ${pending.map((l) => l.id).join(', ')}`
    )
  }
}
cover('an objective-task todo', levels.some((l) => l.todos?.some((t) => t.type === 'objective-task')))
cover(
  'a generated Marp deck',
  Object.keys(decks).length > 0,
  `${Object.keys(decks).length} deck(s), ` +
    `${Object.values(decks).reduce((n, d) => n + d.slides, 0)} slide(s) total`
)
cover(
  'the 8 graded block exercises',
  levels.filter((l) => l.block).length === 8,
  [...blocks].sort((a, b) => a[0] - b[0]).map(([n, m]) => `bloque ${n}: ${m.length}`).join(', ')
)

// --- the class timetable, if one is published -------------------------------
// It lives in progress.json and NOT in the level data, which is what keeps the
// no-dates rule intact — see lib/schedule.js. Checked here because a key
// naming a session that no longer exists would silently never fire, and a
// timetable that quietly does nothing is worse than no timetable.
{
  const { cleanSchedule, zonedToEpoch } = await import('../src/lib/schedule.js')
  const progressPath = resolve(here, '../public/progress.json')
  let progress = null
  try {
    progress = JSON.parse(readFileSync(progressPath, 'utf8'))
  } catch (e) {
    // Absent is fine (a fresh clone). Unreadable is not — a corrupt
    // progress.json takes the marker down for the whole class.
    if (e.code !== 'ENOENT') err(`progress.json: ${e.message}`)
  }
  const raw = progress?.schedule
  if (raw && typeof raw === 'object') {
    const validIds = new Set(levels.filter((l) => !l.optional).map((l) => l.id))
    for (const [levelId, when] of Object.entries(raw)) {
      if (!validIds.has(levelId)) {
        err(`schedule: "${levelId}" is not a main-path session`)
      } else if (Number.isNaN(zonedToEpoch(when))) {
        err(`schedule: "${levelId}" has an unreadable time "${when}"`)
      }
    }
    const kept = Object.keys(cleanSchedule(raw, validIds)).length
    cover('the published timetable', kept === Object.keys(raw).length, `${kept} session(s) scheduled`)
  }
}

// --- the three languages, key for key ---------------------------------------
// "Cuando modifique algo, se modifique en los tres idiomas" — enforced here
// rather than hoped for. English is the base; Spanish and Catalan are checked
// against it in BOTH directions, so a key added to one and forgotten in the
// others fails the build, and so does a stale key left behind after a rename.
{
  const { dictionaries } = await import('../src/lib/i18n/index.js')
  const base = Object.keys(dictionaries.en).sort()
  for (const code of ['es', 'ca']) {
    const keys = new Set(Object.keys(dictionaries[code]))
    const missing = base.filter((k) => !keys.has(k))
    const extra = [...keys].filter((k) => !dictionaries.en[k]).sort()
    if (missing.length) err(`i18n ${code}: missing ${missing.length} key(s) — ${missing.join(', ')}`)
    if (extra.length) err(`i18n ${code}: has ${extra.length} key(s) English does not — ${extra.join(', ')}`)
    // An empty string renders as a blank label, which reads as a broken panel
    // rather than as an untranslated one. Better to leave the English in.
    const blank = base.filter((k) => keys.has(k) && !String(dictionaries[code][k]).trim())
    if (blank.length) err(`i18n ${code}: blank value for ${blank.join(', ')}`)
  }
  // A level naming a key that does not exist would render the key itself as
  // the tab's label — "portal.activity" in the chrome, live on the site.
  for (const [key, at] of labelKeys) {
    if (!(key in dictionaries.en)) err(`${at}: slidesLabelKey "${key}" is not an i18n key`)
  }
  cover(
    'the three languages agree',
    errors.every((e) => !e.startsWith('i18n')),
    `${base.length} keys × en/es/ca`
  )
}

// --- report ----------------------------------------------------------------
console.log(`\n${levels.length} levels, ${totalNodes} nodes placed.`)
if (fixmes.length) {
  // Open decisions from the exercise brief. Deliberately unresolved — they are
  // printed on every run so they cannot quietly become permanent.
  console.log(`\n--- open decisions (${fixmes.length}) ---`)
  for (const f of fixmes) console.log(`  ${f}`)
  console.log('  each is a _fixme on its node; leave them open until decided')
}
// A DECK IS COURSE TEXT TOO, and for four rounds nothing said so.
//
// The level's own prose shows up in the list below the moment it is a plain
// string, but the Marp deck beside it is a FILE, and a missing `<id>.es.md`
// looked exactly like a deck that did not need one. The viewer falls back to
// the base file, so a reader who picked Catalan quietly got English and the
// build said nothing. Reported as "las instrucciones estan solo en ingles".
//
// ITS OWN SECTION, not a line in the list below: that list is truncated at 25
// and the decks would sort to the bottom of it, which is where this was hiding
// in the first place.
{
  const missingDecks = []
  for (const l of levels) {
    if (!l.exercises) continue
    const base = l.exercises.replace(/\.md$/, '')
    const missing = ['es', 'ca'].filter(
      (code) => !existsSync(resolve(here, '../public', `${base}.${code}.md`))
    )
    if (missing.length) missingDecks.push(`${l.id}: missing ${missing.join(', ')}`)
  }
  // A LIST, never an error, for the same reason the prose one is not: a
  // session half-written in one language has to stay committable. Failing the
  // build here would mean blocks 2 and 3 cannot be drafted at all.
  if (missingDecks.length) {
    console.log(`
--- decks still to translate (${missingDecks.length}) ---`)
    for (const d of missingDecks) console.log(`  ${d}`)
    console.log('  a deck translates by SUFFIX: w1-arf-01.md -> w1-arf-01.es.md')
  }
}

// Course text still to translate. A LIST, not an error: `en.js`/`es.js`/`ca.js`
// are mine and must be complete, but the sessions are Marc's to write, and a
// session half-written in one language has to stay committable. The site falls
// back to English (see lib/i18n/text.js); this is the outstanding work.
if (untranslated.length) {
  console.log(`\n--- still to translate (${untranslated.length}) ---`)
  for (const u of untranslated.slice(0, 25)) console.log(`  ${u}`)
  if (untranslated.length > 25) console.log(`  …and ${untranslated.length - 25} more`)
}

for (const w of warnings) console.warn(`WARN  ${w}`)
for (const e of errors) console.error(`ERROR ${e}`)
if (errors.length) {
  console.error(`\n${errors.length} error(s).`)
  process.exit(1)
}
console.log(`OK${warnings.length ? ` (${warnings.length} warning(s))` : ''}\n`)
