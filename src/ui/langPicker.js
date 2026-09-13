import { LANGS, getLang, setLang, t } from '../lib/i18n/index.js'
import { FLAGS } from './flags.js'
import { hudRail, openPanel, onOtherPanelOpen } from './hudRail.js'

/**
 * The language picker, top right — the left half of the rail it shares with
 * the avatar wardrobe (see `ui/hudRail.js`).
 *
 * Top right because it is the one corner nothing else uses — the course index
 * is top left, the legend is bottom right — and because that is where a
 * visitor looks for it.
 *
 * A <details>, not a custom dropdown: it opens, closes on Escape and closes on
 * a click outside for free, and it is a button to a screen reader either way.
 * The whole panel is three items; anything more elaborate is weight for the
 * sake of it.
 *
 * Picking a language RELOADS the page — see `lib/i18n/index.js` for why that
 * is the only thing that cannot leave half the site speaking the old one.
 */
export function mountLangPicker() {
  const el = document.createElement('div')
  el.className = 'lang-picker'
  hudRail().appendChild(el)

  const current = LANGS.find((l) => l.code === getLang()) ?? LANGS[0]

  el.innerHTML = `
    <details class="lang-card">
      <summary aria-label="${t('lang.label')}" title="${t('lang.label')}">
        ${FLAGS[current.code]}
        <span class="lang-code">${current.code.toUpperCase()}</span>
        <span class="lang-chev">▾</span>
      </summary>
      <ul class="lang-list">
        ${LANGS.map(
          (l) => `
          <li>
            <button data-lang="${l.code}" class="lang-item ${l.code === current.code ? 'is-on' : ''}">
              ${FLAGS[l.code]}
              <span>${l.label}</span>
            </button>
          </li>`
        ).join('')}
      </ul>
    </details>`

  el.querySelectorAll('[data-lang]').forEach((b) =>
    b.addEventListener('click', () => setLang(b.dataset.lang))
  )

  const details = el.querySelector('details')

  // Clicking the map should close the menu, the way clicking away from any
  // other menu does. <details> does not do this by itself.
  document.addEventListener('pointerdown', (e) => {
    if (details?.open && !el.contains(e.target)) details.open = false
  })

  // One panel open at a time on the rail — see ui/hudRail.js.
  details?.addEventListener('toggle', () => {
    if (details.open) openPanel('lang')
  })
  onOtherPanelOpen('lang', () => {
    if (details) details.open = false
  })

  return el
}
