/**
 * The optional class timetable: "session N opens on this day at this time".
 *
 * WHY THIS DOES NOT BREAK THE NO-DATES RULE
 * The rule is that the MAP holds no calendar — no dates in `levels.json`, and
 * `validate` fails the build on a stray `date`/`week`/`deadline` field there.
 * That still holds: nothing here touches level data. A schedule is teacher
 * state, and teacher state already has exactly one home — `public/progress.json`,
 * the hand-moved file that `/admin` writes and everyone else reads. This is a
 * second field in it, next to `currentLevelId` and `lockAhead`, and it is
 * written from the same place by the same person.
 *
 * WHY IT NEEDS NO WRITES TO WORK
 * The marker is DERIVED, not advanced. Publish the timetable once and every
 * browser works out for itself where the class is — so a session opens at the
 * minute it is due, on every student's phone at once, with no token, no
 * commit and no two-minute rebuild. That was the whole complaint: "no tener
 * que cada día sacar el móvil y poner el token y darle a completar".
 *
 * THE MANUAL MARKER STILL WINS WHEN IT IS AHEAD
 * A timetable is a plan. If Marc presses "Completar y avanzar" because the
 * class got further than planned, that must not be undone by the clock five
 * minutes later — so the effective marker is whichever of the two is FURTHER
 * ALONG. Going back is still a manual act, and still works: clearing a
 * schedule entry is what takes a session back off the board.
 */

/** Times are wall-clock in this zone, wherever the reader happens to be. */
export const SCHEDULE_ZONE = 'Europe/Madrid'

/**
 * How far `timeZone` is from UTC at a given instant, in ms.
 *
 * Via `Intl`, so the DST rules come from the platform rather than from a
 * table here that would go stale. A class at 10:00 must be 10:00 in Madrid in
 * October and in March alike.
 */
function zoneOffsetMs(epochMs, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(epochMs))
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]))
  // `hour` comes back as 24 at midnight under hour12:false in some engines.
  const asIfUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second)
  return asIfUTC - epochMs
}

/**
 * `"2026-09-23T10:00"` in Madrid -> absolute epoch ms.
 *
 * Corrected TWICE on purpose. The first guess can land on the far side of a
 * DST transition from the answer — the one weekend a year where the offset
 * before and after differ — and a second pass settles it.
 *
 * @returns {number} epoch ms, or NaN if the string is not a local datetime
 */
export function zonedToEpoch(localDateTime, timeZone = SCHEDULE_ZONE) {
  if (typeof localDateTime !== 'string') return NaN
  const s = localDateTime.trim()
  // `<input type="datetime-local">` gives "2026-09-23T10:00"; allow seconds too.
  const full = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s) ? `${s}:00` : s
  const asIfUTC = Date.parse(`${full}Z`)
  if (Number.isNaN(asIfUTC)) return NaN
  const once = asIfUTC - zoneOffsetMs(asIfUTC, timeZone)
  return asIfUTC - zoneOffsetMs(once, timeZone)
}

/** Only entries naming a level that is actually on the main path. */
export function cleanSchedule(schedule, validIds) {
  const out = {}
  if (!schedule || typeof schedule !== 'object') return out
  for (const [levelId, when] of Object.entries(schedule)) {
    if (validIds && !validIds.has(levelId)) continue
    if (typeof when !== 'string' || !when.trim()) continue
    if (Number.isNaN(zonedToEpoch(when))) continue
    out[levelId] = when.trim()
  }
  return out
}

/**
 * Where the class is, given the timetable and the manual marker.
 *
 * @param {Array<{id:string}>} sequence the main path, in order
 * @param {Record<string,string>} schedule levelId -> local datetime
 * @param {string} manualMarker `currentLevelId` from progress.json
 * @param {number} [now] epoch ms, injectable so this is testable
 * @returns {string} the level id the map should treat as current
 */
export function effectiveMarker(sequence, schedule, manualMarker, now = Date.now()) {
  const ids = sequence.map((l) => l.id)
  const manualIndex = ids.indexOf(manualMarker)
  let best = manualIndex

  for (const [levelId, when] of Object.entries(schedule ?? {})) {
    const at = zonedToEpoch(when)
    if (Number.isNaN(at) || at > now) continue
    const i = ids.indexOf(levelId)
    // FURTHEST WINS, so an out-of-order timetable still behaves: the class is
    // at the last session whose time has come, not at whichever entry the
    // object happened to list last.
    if (i > best) best = i
  }

  return best >= 0 ? ids[best] : manualMarker
}

/**
 * When the NEXT scheduled session opens, or null if none is pending.
 * The map uses this to wake up exactly once rather than polling.
 */
export function nextScheduledAt(schedule, now = Date.now()) {
  let soonest = null
  for (const when of Object.values(schedule ?? {})) {
    const at = zonedToEpoch(when)
    if (Number.isNaN(at) || at <= now) continue
    if (soonest === null || at < soonest) soonest = at
  }
  return soonest
}
