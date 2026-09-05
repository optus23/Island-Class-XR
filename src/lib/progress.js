import { START_MARKER } from './levels.js'

/**
 * Reads the public progress marker. This is the ONLY progress state in the
 * project and it moves by hand from the teacher controls in the map's legend —
 * never by date or timer.
 *
 * Cache-busted because GitHub Pages will happily serve a stale progress.json
 * for minutes after the teacher controls write a new one.
 */
export async function loadProgress() {
  const url = `${import.meta.env.BASE_URL}progress.json?t=${Date.now()}`
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return { currentLevelId: data.currentLevelId ?? START_MARKER }
  } catch (e) {
    console.warn('progress.json unavailable, starting at the first level:', e.message)
    return { currentLevelId: START_MARKER }
  }
}
