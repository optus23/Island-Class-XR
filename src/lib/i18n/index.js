import en from './en.js'
import es from './es.js'
import ca from './ca.js'

/**
 * The three languages, and the one function every surface reads text through.
 *
 * ENGLISH IS THE BASE. Marc's own material is written in English — it is the
 * one language all of it already shares — so `en.js` is the file that must be
 * complete, and the other two are measured against it. `scripts/validate.mjs`
 * fails the build when `es` or `ca` is missing a key `en` has, or carries one
 * it does not: "cuando modifique algo, se modifique en los tres idiomas" is a
 * build rule here, not a good intention.
 *
 * WHY CHANGING LANGUAGE RELOADS THE PAGE
 * Half the text on this site is not in the DOM. The villagers' name plates,
 * the VR level card and the gaze pad's hint are all PAINTED INTO A TEXTURE
 * once and uploaded to the GPU; the compiled Marp decks are fetched as HTML.
 * Re-rendering the panels would leave every one of those speaking the old
 * language, and chasing them individually is a standing invitation to miss
 * one. A reload is the only thing that cannot half-apply. The choice is
 * already persisted before it happens, and the opening flight is skipped on
 * the way back in — a language switch is a re-entry, not a first visit.
 */

const DICTS = { en, es, ca }

/**
 * Order matters: it is the order the dropdown lists them in.
 * The flags themselves are drawn in `ui/flags.js` — see the note there for
 * why they are SVG and not emoji.
 */
export const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'ca', label: 'Català' },
]

export const DEFAULT_LANG = 'en'
const STORE_KEY = 'xrisland:lang'

const supported = (code) => Object.prototype.hasOwnProperty.call(DICTS, code)

/**
 * Resolution order: an explicit `?lang=` in the URL, then what this browser
 * chose last, then what the browser itself asks for, then English.
 *
 * The URL wins so a link can be shared in a chosen language; it is READ ONCE
 * and then written to storage, the same way `?ver=` is handled in
 * `lib/teacherView.js`, so the address bar does not carry it around forever.
 */
function detect() {
  try {
    const fromUrl = new URLSearchParams(location.search).get('lang')
    if (fromUrl && supported(fromUrl)) return fromUrl
  } catch {
    /* no URL access — fall through */
  }
  try {
    const saved = localStorage.getItem(STORE_KEY)
    if (saved && supported(saved)) return saved
  } catch {
    /* storage blocked — fall through */
  }
  try {
    for (const tag of navigator.languages ?? [navigator.language]) {
      const code = String(tag).slice(0, 2).toLowerCase()
      if (supported(code)) return code
    }
  } catch {
    /* no navigator languages — fall through */
  }
  return DEFAULT_LANG
}

let current = DEFAULT_LANG

/** Called once, early in boot, before anything renders. */
export function initLang() {
  current = detect()
  try {
    localStorage.setItem(STORE_KEY, current)
  } catch {
    /* nothing to do: the language still applies to this page view */
  }
  try {
    document.documentElement.lang = current
  } catch {
    /* no document (validate.mjs runs this module under Node) */
  }
  return current
}

export function getLang() {
  return current
}

/**
 * Persist and reload. See the note at the top for why this is a reload.
 *
 * `lang` goes in the URL as well as in storage: a browser with storage
 * disabled (a locked-down lab machine, a private window) would otherwise
 * bounce straight back to the detected language on the way in.
 */
export function setLang(code) {
  if (!supported(code) || code === current) return
  try {
    localStorage.setItem(STORE_KEY, code)
  } catch {
    /* handled by the URL below */
  }
  const url = new URL(location.href)
  url.searchParams.set('lang', code)
  location.replace(url.toString())
}

/**
 * One string, by key.
 *
 * Falls back to English and then to the key itself, so a missing translation
 * degrades to readable English rather than to a blank panel. `validate` is
 * what stops it getting that far; this is the seatbelt.
 *
 * `vars` fills `{name}` placeholders. Values are inserted verbatim — every
 * caller here interpolates course data, never anything a visitor typed.
 */
export function t(key, vars) {
  const raw = DICTS[current]?.[key] ?? DICTS[DEFAULT_LANG]?.[key] ?? key
  if (!vars) return raw
  return raw.replace(/\{(\w+)\}/g, (whole, name) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : whole
  )
}

/** For validate.mjs, which compares the three key sets. */
export const dictionaries = DICTS
