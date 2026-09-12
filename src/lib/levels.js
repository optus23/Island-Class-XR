import raw from '../data/levels.json'
import { worlds } from '../config/worlds.js'

/**
 * The level list, plus the derived "where is the class right now" state.
 *
 * Completion is NOT stored per level. There is exactly one progress value —
 * the marker in public/progress.json, moved by the /admin panel — and every
 * node's status is derived from it. Two sources of truth would drift the first
 * time Marc edited one and not the other.
 */

export const course = raw.course
export const allLevels = raw.levels

/** Levels of one world, in map order. */
export function levelsForWorld(worldId) {
  return allLevels.filter((l) => l.world === worldId)
}

/**
 * The main-path sequence the progress marker walks: every non-optional level,
 * world by world, in declaration order. Optional/bonus levels sit off the path
 * and are deliberately not part of it.
 */
export const mainSequence = worlds.flatMap((w) =>
  levelsForWorld(w.id).filter((l) => !l.optional)
)

export const START_MARKER = mainSequence[0]?.id ?? null

export function levelById(id) {
  return allLevels.find((l) => l.id === id) ?? null
}

/**
 * WHAT IS HIDDEN FROM STUDENTS, AND WHO DECIDES.
 *
 * A session past the marker is LOCKED: its title, its slides and its exercises
 * are not shown, because several of them are plot points — the story a class
 * builds toward is spoiled by a session list read on day one.
 *
 * Two switches, and they are different things:
 *
 *   `lockAhead`  the COURSE setting, from `public/progress.json`. The teacher
 *                flips it from the map's legend and every student gets it.
 *   `seeAll`     THIS BROWSER ignores the lock. Set for whoever holds an admin
 *                token, so the teacher always sees the whole course, and
 *                cleared by "Ver como alumno" so they can check what the class
 *                sees without signing out.
 *
 * Both live here rather than being threaded through every call, because the
 * answer has to be identical on the map, in the course list, in the tooltip, in
 * the portal, in the VR card and on a shared link. Nine surfaces, one rule.
 */
let lockAhead = false
let seeAll = false

/** The course-wide setting, read from progress.json. */
export function setLockAhead(on) {
  lockAhead = Boolean(on)
}

/** This browser sees everything regardless — the teacher's. */
export function setSeeAll(on) {
  seeAll = Boolean(on)
}

export function locksActive() {
  return lockAhead && !seeAll
}

export function lockAheadSetting() {
  return lockAhead
}

export function seeAllSetting() {
  return seeAll
}

/**
 * Status for one level given the current marker.
 *
 * Optional levels never turn green: they are take-home extras that the linear
 * marker does not walk through, so they keep their own colour at all times.
 * They CAN be locked, though — an "Actitud" activity hanging off session 9 is
 * as much of a spoiler as session 9 — so they inherit the lock from the day
 * they hang off. `validate` guarantees that anchor is a main-path level, which
 * is what stops this recursing.
 *
 * @returns {{completed: boolean, current: boolean, locked: boolean}}
 */
export function statusFor(level, markerId) {
  if (level.optional) {
    const anchor = level.anchorAfter ? levelById(level.anchorAfter) : null
    return {
      completed: false,
      current: false,
      locked: anchor ? statusFor(anchor, markerId).locked : false,
    }
  }

  const markerIndex = mainSequence.findIndex((l) => l.id === markerId)
  const myIndex = mainSequence.findIndex((l) => l.id === level.id)
  if (markerIndex === -1 || myIndex === -1) {
    return { completed: false, current: false, locked: false }
  }
  return {
    completed: myIndex < markerIndex,
    current: myIndex === markerIndex,
    // Everything past where the class has got to. The marker session itself is
    // always open: "cero completadas, la primera; una completada, la segunda".
    locked: locksActive() && myIndex > markerIndex,
  }
}

/** Shorthand — the same rule, when only the yes/no is wanted. */
export function isLocked(level, markerId) {
  return statusFor(level, markerId).locked
}

/**
 * Sessions that carry an actual hand-in — an explicit `level.deliverable`
 * (`{ label, weight }`), placed on whichever session the calendar's
 * "Deliverables" column names. That is NOT always the session whose own
 * `contents` describes the work: a block's exercises finish on one day and
 * the calendar records the grade a week to a week and a half later, on
 * whatever class happens to fall on that row. An earlier version of this
 * function derived the flag from an "Entrega…" bullet living in the working
 * session's own `contents`, which put the AR Foundation flag on `w1-arf-03`
 * (last exercise) instead of `w2-pre-02` (the row the calendar actually
 * names) — wrong by exactly that lag. `deliverable` is set by hand, on the
 * right session, once, instead of being re-derived from prose that was never
 * about placement in the first place.
 */
export function hasDeliverable(level) {
  return Boolean(level.deliverable)
}

/** Whether a deliverable's flag should read as handed in. */
export function deliverableDone(level, markerId) {
  return statusFor(level, markerId).completed
}

/**
 * The title, or a spoiler-free stand-in when the level is locked.
 *
 * EVERY surface that prints a level's name goes through here. The session
 * number is not a spoiler and keeps the map legible — you can still see that
 * you are on 3 of 28 — but the words are what give the story away.
 */
export function safeTitle(level, markerId) {
  if (!level) return ''
  if (!isLocked(level, markerId)) return level.title
  const n = sessionNumber(level)
  return n ? `Sesión ${n.global}` : 'Actividad extra'
}

/** Step the marker forward one main-path level. Returns the new id. */
export function nextMarker(markerId) {
  const i = mainSequence.findIndex((l) => l.id === markerId)
  if (i === -1) return START_MARKER
  return mainSequence[Math.min(i + 1, mainSequence.length - 1)].id
}

/**
 * Where a level sits in the course, Mario style.
 *
 * `world-N` is its index within its own world (so "1-3" reads like WORLD 1-3),
 * and `global` is its index across all 27 sessions. Optional/bonus levels are
 * not sessions, so they get no number.
 */
export function sessionNumber(level) {
  if (!level || level.optional) return null
  const inWorld = levelsForWorld(level.world).filter((l) => !l.optional)
  const world = inWorld.findIndex((l) => l.id === level.id) + 1
  const global = mainSequence.findIndex((l) => l.id === level.id) + 1
  if (!world || !global) return null
  return { world: level.world, index: world, global, total: mainSequence.length }
}

/** Sessions still ahead — the number behind the lives counter easter egg. */
export function sessionsRemaining(level) {
  const n = sessionNumber(level)
  return n ? n.total - n.global : mainSequence.length
}

export function markerProgress(markerId) {
  const i = mainSequence.findIndex((l) => l.id === markerId)
  return { index: Math.max(0, i), total: mainSequence.length }
}
