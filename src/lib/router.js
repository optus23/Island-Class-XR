import { levelById } from './levels.js'

/**
 * Shareable level links: `?level=w2-boss` opens the map on that node with its
 * portal already up, so a level can be pasted into an email or a chat.
 *
 * A query parameter rather than a path, because GitHub Pages serves this as a
 * static site with no rewrite rules — a real path like /level/w2-boss would
 * 404. The query survives the Pages base path for free.
 */

const PARAM = 'level'

/** @returns {object|null} the level named by the URL, if it exists. */
export function readLevelFromUrl() {
  const id = new URLSearchParams(window.location.search).get(PARAM)
  if (!id) return null
  const level = levelById(id)
  if (!level) {
    console.warn(`URL asks for level "${id}", which is not in levels.json — ignoring.`)
    return null
  }
  return level
}

/**
 * Reflect the open level in the address bar.
 * @param {string|null} levelId null clears it (back to the plain map)
 * @param {{replace?: boolean}} [opts] replace avoids stacking history entries
 */
export function setLevelInUrl(levelId, { replace = false } = {}) {
  const url = new URL(window.location.href)
  if (levelId) url.searchParams.set(PARAM, levelId)
  else url.searchParams.delete(PARAM)

  if (url.href === window.location.href) return
  // pushState so Back closes the portal instead of leaving the site.
  window.history[replace ? 'replaceState' : 'pushState']({ [PARAM]: levelId ?? null }, '', url)
}

/**
 * Fires when the user navigates with Back/Forward. Note that pushState itself
 * never triggers popstate, so this cannot loop with setLevelInUrl.
 */
export function onRouteChange(handler) {
  window.addEventListener('popstate', () => handler(readLevelFromUrl()))
}
