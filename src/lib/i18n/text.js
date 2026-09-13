import { getLang, DEFAULT_LANG } from './index.js'

/**
 * Content text that may or may not have been translated yet.
 *
 * TWO SHAPES ARE VALID, on purpose:
 *
 *   "Gadgets immersius"                         — one language, not migrated
 *   { en: "Immersive gadgets", ca: "Gadgets…" } — translated
 *
 * The plain string is not a legacy wart to be tidied away; it is how a new
 * session gets written. Marc adds a line in whatever language it comes to him
 * in, the site shows it in every language, and `npm run validate` lists it as
 * still to translate. Demanding all three up front would mean a half-written
 * session cannot be committed at all, which is how a course ends up edited in
 * a scratch file instead.
 *
 * Unlike the INTERFACE dictionary — where a missing key fails the build,
 * because I wrote all three and there is no excuse — content falls back
 * quietly to English, then to whatever language it does have. A student
 * reading a Catalan title on an English page has lost nothing; a blank has.
 */

/** @param {string | Record<string, string> | null | undefined} value */
export function localized(value) {
  if (value == null) return ''
  if (typeof value === 'string') return value
  return value[getLang()] ?? value[DEFAULT_LANG] ?? Object.values(value).find(Boolean) ?? ''
}

/** The same, for a list: `contents` is an array of these. */
export function localizedList(value) {
  if (!Array.isArray(value)) return []
  return value.map(localized).filter(Boolean)
}

/**
 * Does this field still need translating into `lang`?
 * Used by `validate` to print the outstanding list, never by the site.
 */
export function needsTranslation(value, lang) {
  if (value == null) return false
  if (typeof value === 'string') return true
  return !String(value[lang] ?? '').trim()
}
