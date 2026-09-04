import { START_MARKER } from './levels.js'

/**
 * Reads the public course state. Two fields, both moved by hand from /admin,
 * never by a date or a timer:
 *
 *   currentLevelId   where the class is right now
 *   answersUnlocked  whether the answer slides are published, FOR EVERYONE
 *
 * `answersUnlocked` is deliberately global and public rather than a per-visitor
 * setting: the whole point is that Marc flips it once and every student sees
 * the answers, the same trust model the marker already has.
 *
 * Cache-busted because GitHub Pages will happily serve a stale progress.json
 * for minutes after the admin panel writes a new one.
 */
export async function loadProgress() {
  const url = `${import.meta.env.BASE_URL}progress.json?t=${Date.now()}`
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return {
      currentLevelId: data.currentLevelId ?? START_MARKER,
      answersUnlocked: data.answersUnlocked === true,
    }
  } catch (e) {
    console.warn('progress.json unavailable, starting at the first level:', e.message)
    // Locked is the safe default: a failed fetch must never publish answers.
    return { currentLevelId: START_MARKER, answersUnlocked: false }
  }
}
