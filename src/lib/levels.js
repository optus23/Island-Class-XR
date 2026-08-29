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
 * Status for one level given the current marker.
 *
 * Optional levels never turn green: they are take-home extras that the linear
 * marker does not walk through, so they keep their own colour at all times.
 *
 * @returns {{completed: boolean, current: boolean, locked: boolean}}
 */
export function statusFor(level, markerId) {
  if (level.optional) return { completed: false, current: false, locked: false }

  const markerIndex = mainSequence.findIndex((l) => l.id === markerId)
  const myIndex = mainSequence.findIndex((l) => l.id === level.id)
  if (markerIndex === -1 || myIndex === -1) {
    return { completed: false, current: false, locked: false }
  }
  return {
    completed: myIndex < markerIndex,
    current: myIndex === markerIndex,
    locked: false, // nothing is hidden from students; ahead-of-marker is just "not done"
  }
}

/** Step the marker forward one main-path level. Returns the new id. */
export function nextMarker(markerId) {
  const i = mainSequence.findIndex((l) => l.id === markerId)
  if (i === -1) return START_MARKER
  return mainSequence[Math.min(i + 1, mainSequence.length - 1)].id
}

export function markerProgress(markerId) {
  const i = mainSequence.findIndex((l) => l.id === markerId)
  return { index: Math.max(0, i), total: mainSequence.length }
}
