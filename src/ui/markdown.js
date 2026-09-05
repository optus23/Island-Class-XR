import { marked } from 'marked'

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

export async function loadMarkdown(path) {
  if (!path) return { ok: false, reason: 'none' }
  if (cache.has(path)) return cache.get(path)

  const url = `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`
  let result
  try {
    const res = await fetch(url)
    if (res.status === 404) {
      result = { ok: false, reason: 'missing', path }
    } else if (!res.ok) {
      result = { ok: false, reason: 'error', path, detail: `HTTP ${res.status}` }
    } else {
      const text = await res.text()
      result = { ok: true, html: marked.parse(stripFrontMatter(text)), path }
    }
  } catch (e) {
    result = { ok: false, reason: 'error', path, detail: e.message }
  }
  cache.set(path, result)
  return result
}

/** Renders a loaded markdown result into a container element. */
export function renderMarkdownInto(el, result, emptyLabel) {
  if (result.ok) {
    el.innerHTML = `<div class="prose-xri">${result.html}</div>`
    return
  }
  if (result.reason === 'none') {
    el.innerHTML = `<p class="opacity-60 italic">${emptyLabel}</p>`
    return
  }
  if (result.reason === 'missing') {
    el.innerHTML = `
      <div class="rounded-lg border border-dashed border-base-content/30 p-4">
        <p class="font-semibold mb-1">Pendiente de escribir</p>
        <p class="opacity-70 text-sm">
          Falta el archivo <code class="text-xs">${result.path}</code>.
          Créalo en el repositorio y aparecerá aquí sin tocar código.
        </p>
      </div>`
    return
  }
  el.innerHTML = `<p class="text-error">No se pudo cargar ${result.path} (${result.detail}).</p>`
}
