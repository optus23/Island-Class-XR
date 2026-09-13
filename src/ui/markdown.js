import { marked } from 'marked'
import { t, getLang, DEFAULT_LANG } from '../lib/i18n/index.js'

/**
 * Loads a Markdown file from the repo's public content folder and renders it.
 *
 * Content is authored by Marc and committed to this repo, so it is trusted
 * input — but a missing file is the common case while a course is being
 * written, so that path gets a real, friendly state rather than an exception.
 */

marked.setOptions({ gfm: true, breaks: false })

/**
 * Strips the Marp front-matter before the prose renderer sees it.
 *
 * The exercise files are Marp decks now, so they open with a YAML block:
 *
 *     ---
 *     marp: true
 *     theme: xr-island
 *     ---
 *
 * `marked` has no idea that is metadata. It rendered the fences as horizontal
 * rules and the keys as a paragraph, so every exercise began with a literal
 * "marp: true theme: xr-island paginate: true". The slide separators further
 * down stay: as prose they read as section rules, which is what they are.
 */
const stripFrontMatter = (text) => text.replace(/^\uFEFF?---\r?\n[\s\S]*?\r?\n---\r?\n/, '')

const cache = new Map()

/**
 * `content/exercises/w1-arf-01.md` + `es` -> `content/exercises/w1-arf-01.es.md`
 *
 * A SUFFIX and not a folder per language, deliberately: the translations of
 * one exercise sort next to each other in the directory, so a missing one is
 * visible by looking at the folder rather than by remembering to check three
 * of them.
 */
const withLang = (path, lang) => path.replace(/\.md$/i, `.${lang}.md`)

/**
 * One fetch. `null` when the file is not there, which is a normal state.
 *
 * A 404 IS NOT THE ONLY WAY A FILE IS MISSING. The dev server answers an
 * unknown path with `index.html` and a 200 — the SPA fallback — so asking for
 * `w1-arf-01.ca.md` before that translation exists came back "successful"
 * and the exercises panel rendered the page's own HTML source as the
 * exercise. Caught by opening a Catalan exercise and finding `<meta
 * charset>` in it. So the content type is checked, and the body is sniffed
 * as well: a static host that serves `.md` as `text/plain` would slip past
 * the first test and is caught by the second.
 */
async function fetchMarkdown(path) {
  const url = `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`
  const res = await fetch(url)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  if ((res.headers.get('content-type') ?? '').includes('text/html')) return null
  const text = await res.text()
  if (/^\s*(<!doctype html|<html[\s>])/i.test(text)) return null
  return text
}

/**
 * The reader's language if that file exists, otherwise the base file.
 *
 * The base file (`w1-arf-01.md`, no suffix) is whatever language it was
 * written in, and it is the fallback rather than a fourth language — the
 * course has 32 exercise files, and requiring three translations of each
 * before any of them can be shown would mean showing none of them. When the
 * fallback is what gets rendered, the panel says so: `md.fallbackNotice`.
 */
export async function loadMarkdown(path) {
  if (!path) return { ok: false, reason: 'none' }
  const lang = getLang()
  const key = `${lang}:${path}`
  if (cache.has(key)) return cache.get(key)

  let result
  try {
    const translated = await fetchMarkdown(withLang(path, lang))
    const text = translated ?? (await fetchMarkdown(path))
    if (text == null) {
      result = { ok: false, reason: 'missing', path }
    } else {
      result = {
        ok: true,
        html: marked.parse(stripFrontMatter(text)),
        path,
        // Only when a translation was ASKED for and not found. English is the
        // base language, so an English reader on the base file has not fallen
        // back to anything and should not be told they have.
        fallback: !translated && lang !== DEFAULT_LANG,
      }
    }
  } catch (e) {
    result = { ok: false, reason: 'error', path, detail: e.message }
  }
  cache.set(key, result)
  return result
}

/** Renders a loaded markdown result into a container element. */
export function renderMarkdownInto(el, result, emptyLabel) {
  if (result.ok) {
    // Quiet, and above the text rather than after it: the point is to set the
    // reader's expectation before they start reading, not to apologise once
    // they have finished.
    const notice = result.fallback
      ? `<p class="text-xs opacity-55 italic mb-3">${t('md.fallbackNotice')}</p>`
      : ''
    el.innerHTML = `${notice}<div class="prose-xri">${result.html}</div>`
    return
  }
  if (result.reason === 'none') {
    el.innerHTML = `<p class="opacity-60 italic">${emptyLabel}</p>`
    return
  }
  if (result.reason === 'missing') {
    el.innerHTML = `
      <div class="rounded-lg border border-dashed border-base-content/30 p-4">
        <p class="font-semibold mb-1">${t('md.pendingTitle')}</p>
        <p class="opacity-70 text-sm">
          ${t('md.pendingBody', { path: `<code class="text-xs">${result.path}</code>` })}
        </p>
      </div>`
    return
  }
  el.innerHTML = `<p class="text-error">${t('md.loadError', { path: result.path, detail: result.detail })}</p>`
}
