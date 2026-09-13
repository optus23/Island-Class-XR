/**
 * The top-right rail: one row holding the language picker and the avatar
 * wardrobe, in that order.
 *
 * WHY A SHARED ROW AND NOT TWO CORNERS OF THEIR OWN. The avatar button used
 * to sit BELOW the language button, and the language menu opens downward —
 * so opening it dropped the list straight under a floating button that then
 * sat on top of its own options. Reported as "cuando despliegas el dropdown
 * del idioma, queda por debajo del botón y queda raro". Side by side, each
 * menu opens into empty space under its own button and nothing overlaps.
 *
 * It is also what fixes the phone: three things (course index, language,
 * avatar) were laid out as if they had three corners to themselves, and on a
 * 390px screen they piled on top of each other. Two of them in one row leaves
 * the index a row of its own underneath — see `.nav-panel` in the phone media
 * query.
 *
 * ONLY ONE PANEL IS OPEN AT A TIME. Both menus hang off the same short rail
 * and are wide enough to reach across it, so two open at once would overlap
 * whatever the anchoring. Each announces itself through `openPanel` and the
 * other closes.
 */

const OPEN_EVENT = 'xri:hud-panel-open'

let rail = null

/** The rail element, created on first use. Both pickers mount into it. */
export function hudRail() {
  if (rail?.isConnected) return rail
  rail = document.createElement('div')
  rail.className = 'hud-rail'
  document.getElementById('ui').appendChild(rail)
  return rail
}

/**
 * Say that `owner`'s panel just opened. Everyone else's `onOtherPanelOpen`
 * fires so they can close.
 */
export function openPanel(owner) {
  document.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { owner } }))
}

/** Run `close` whenever a panel that is NOT `owner` opens. */
export function onOtherPanelOpen(owner, close) {
  document.addEventListener(OPEN_EVENT, (e) => {
    if (e.detail?.owner !== owner) close()
  })
}
