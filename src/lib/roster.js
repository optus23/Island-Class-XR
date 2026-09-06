/**
 * The roster of honoured students — the names that walk the island.
 *
 * This is the second (and last) piece of hand-moved state in the project,
 * alongside the progress marker: `public/npcs.json`, written only from /admin
 * through the GitHub Contents API, read by everyone else with a plain fetch.
 *
 * WHAT IT DELIBERATELY DOES NOT HOLD
 * A display name and a session id. No marks, no points, no counters, no emails,
 * no dates — the no-calendar rule applies here exactly as it does to the map
 * data, and `scripts/validate.mjs` enforces it on this file too. Whatever a
 * name was earned for lives in the teacher's own records; the island only shows
 * that it WAS earned.
 *
 * This module holds no level data on purpose, the same reason `paths.js` does
 * not: `scripts/validate.mjs` imports it under Node, where a plain
 * `import levels.json` needs an assertion. Callers supply the set of valid
 * session ids.
 */

/**
 * How many students may wander at once.
 *
 * Not an arbitrary number: every one of them is a name plate painted into a
 * single texture atlas (see `three/villagers.js`), and past a couple of dozen
 * the island stops reading as "look who made it onto the map" and starts
 * reading as a crowd. Honouring everyone honours nobody.
 */
export const MAX_NPCS = 24

/** Longest name that still fits a plate at map scale. */
export const MAX_NAME = 26

/**
 * Cleans one typed name.
 *
 * Collapses whitespace, drops control characters and anything that could be
 * read as markup — the name is painted onto a canvas here and interpolated into
 * the /admin list, and a roster is not the place to be clever about escaping.
 * Accents, apostrophes and hyphens survive, because real names have them.
 */
export function cleanName(raw) {
  return String(raw ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME)
}

/** A short opaque id. Only has to be unique within one small list. */
export function makeNpcId() {
  return Math.random().toString(36).slice(2, 8)
}

/**
 * Normalise whatever the file (or the API) gave us into the shape the map
 * expects. Never throws: a hand-edited or truncated `npcs.json` must degrade to
 * "no villagers" rather than taking the whole map down with it.
 *
 * @param {unknown} doc parsed npcs.json
 * @param {{validLevelIds?: Set<string>}} [options] when given, entries pointing
 *   at a session that no longer exists are dropped instead of shipped to the
 *   3D layer, which cannot place them anyway
 * @returns {Array<{id: string, name: string, levelId: string}>}
 */
export function normalizeRoster(doc, { validLevelIds = null } = {}) {
  const list = Array.isArray(doc) ? doc : Array.isArray(doc?.npcs) ? doc.npcs : []
  const out = []
  const seen = new Set()
  for (const raw of list) {
    const name = cleanName(raw?.name)
    const levelId = String(raw?.levelId ?? '').trim()
    if (!name || !levelId) continue
    if (validLevelIds && !validLevelIds.has(levelId)) continue
    let id = String(raw?.id ?? '').trim() || makeNpcId()
    while (seen.has(id)) id = makeNpcId()
    seen.add(id)
    out.push({ id, name, levelId })
    if (out.length >= MAX_NPCS) break
  }
  return out
}

export const ROSTER_NOTE =
  'Alumnos destacados. Escrito solo desde /admin; los estudiantes lo leen y nunca lo escriben. ' +
  'Sin fechas, sin notas, sin correos: un nombre visible y la sesión junto a la que pasea.'

/**
 * Reads the public roster. Cache-busted for the same reason `progress.json` is:
 * Pages will happily serve a stale copy for minutes after /admin writes a new
 * one, and the teacher checks the map immediately.
 */
export async function loadRoster({ validLevelIds = null } = {}) {
  const url = `${import.meta.env.BASE_URL}npcs.json?t=${Date.now()}`
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return normalizeRoster(await res.json(), { validLevelIds })
  } catch (e) {
    // Absent or malformed is a normal state, not an error: the island simply
    // has nobody walking it yet.
    console.info('npcs.json unavailable — nobody walking the island:', e.message)
    return []
  }
}
