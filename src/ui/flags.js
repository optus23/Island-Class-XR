/**
 * The three flags, as inline SVG.
 *
 * NOT emoji. Two reasons, and the second one is the deciding one:
 *   - Windows does not render regional-indicator flag emoji at all. Chrome on
 *     Windows draws 🇬🇧 as the letters "GB", which is what the first cut of
 *     the picker showed.
 *   - Catalonia has no flag emoji in Unicode. There is a subdivision sequence
 *     for it, and almost nothing renders it. The senyera was asked for by
 *     name, so it has to be drawn.
 *
 * Simplified on purpose: these are 16px tall in a dropdown. The Union Jack
 * keeps its crosses and diagonals and drops the off-centre saltire detail,
 * which is invisible at this size and costs a dozen paths.
 *
 * All three share a 60×36 viewBox so they line up in the list.
 */

const svg = (body) =>
  `<svg class="lang-flag" viewBox="0 0 60 36" width="20" height="12" aria-hidden="true">${body}</svg>`

export const FLAGS = {
  en: svg(`
    <rect width="60" height="36" fill="#012169"/>
    <path d="M0 0 60 36M60 0 0 36" stroke="#fff" stroke-width="7"/>
    <path d="M0 0 60 36M60 0 0 36" stroke="#C8102E" stroke-width="4"/>
    <path d="M30 0v36M0 18h60" stroke="#fff" stroke-width="12"/>
    <path d="M30 0v36M0 18h60" stroke="#C8102E" stroke-width="7"/>`),

  es: svg(`
    <rect width="60" height="36" fill="#AA151B"/>
    <rect y="9" width="60" height="18" fill="#F1BF00"/>`),

  // La senyera: nine bands, four of them red.
  ca: svg(`
    <rect width="60" height="36" fill="#FCDD09"/>
    <rect y="4" width="60" height="4" fill="#DA121A"/>
    <rect y="12" width="60" height="4" fill="#DA121A"/>
    <rect y="20" width="60" height="4" fill="#DA121A"/>
    <rect y="28" width="60" height="4" fill="#DA121A"/>`),
}
