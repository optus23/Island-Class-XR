/**
 * Viewer for the slide decks compiled by scripts/build-decks.mjs.
 *
 * The deck arrives as DATA — an array of `{ html, classes }` — not as a page.
 * This module is one possible surface for it (the DOM), and deliberately the
 * only thing that knows about the DOM: projecting the same JSON onto a panel
 * inside the 3D scene later needs a sibling of this file, not a rewrite of the
 * pipeline.
 *
 * SHADOW DOM, and why it is not optional
 * Marp's compiled CSS styles bare `section`, `h1`, `li`… Injected into the page
 * it would restyle the level portal itself, which is a `<section role="dialog">`.
 * A shadow root gives the deck its own stylesheet scope in both directions with
 * no CSS rewriting and no parser.
 *
 * ANSWERS
 * The answer slides live in a separate file that is only fetched when the
 * global unlock flag is on. Locked decks never download them.
 */

const cache = new Map()
let indexPromise = null

const base = () => import.meta.env.BASE_URL

async function getJSON(path) {
  const res = await fetch(`${base()}${path}`, { cache: 'no-cache' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/** The manifest of every generated deck. Fetched once per page load. */
export function loadDeckIndex() {
  indexPromise ??= getJSON('decks/index.json')
    .then((d) => d.decks ?? {})
    .catch(() => ({})) // no decks built is a valid state, not an error
  return indexPromise
}

let themeCss = null
async function getTheme() {
  if (themeCss !== null) return themeCss
  try {
    const res = await fetch(`${base()}decks/theme.css`, { cache: 'no-cache' })
    themeCss = res.ok ? await res.text() : ''
  } catch {
    themeCss = ''
  }
  return themeCss
}

/**
 * Statement slides, plus the answer slides when unlocked.
 * @returns {Promise<{title:string, slides:Array<{html:string,classes:string[]}>, locked:number}>}
 */
async function loadDeck(levelId, unlocked) {
  const key = `${levelId}:${unlocked ? 'open' : 'locked'}`
  if (cache.has(key)) return cache.get(key)

  const p = (async () => {
    const index = await loadDeckIndex()
    const meta = index[levelId]
    if (!meta) return null

    const deck = await getJSON(`decks/${levelId}.json`)
    const slides = [...deck.slides]
    let locked = meta.answers ?? 0

    if (unlocked && locked) {
      try {
        const answers = await getJSON(`decks/${levelId}.answers.json`)
        slides.push(...answers.slides)
        locked = 0
      } catch {
        /* leave the deck locked rather than breaking it */
      }
    }
    return { title: deck.title, slides, locked }
  })()

  cache.set(key, p)
  return p
}

export async function hasDeck(levelId) {
  return Boolean((await loadDeckIndex())[levelId])
}

const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  )

/**
 * Renders the deck for `level` into `el`.
 * @returns {Promise<boolean>} false when this level has no generated deck, so
 *   the caller can fall back to the PDF/Canva viewer.
 */
export async function renderDeck(el, level, { answersUnlocked = false } = {}) {
  const deck = await loadDeck(level.id, answersUnlocked)
  if (!deck) return false

  const css = await getTheme()
  let i = 0

  el.innerHTML = `
    <div class="flex flex-col h-full gap-2" data-deck>
      <div class="flex-1 min-h-0 rounded-lg overflow-hidden bg-[#0a0d12]
                  border border-base-content/15 grid place-items-center"
           data-stage></div>

      <div class="shrink-0 flex items-center gap-2 flex-wrap">
        <button class="btn btn-sm" data-prev aria-label="Diapositiva anterior">←</button>
        <button class="btn btn-sm" data-next aria-label="Diapositiva siguiente">→</button>
        <span class="text-sm tabular-nums opacity-70" data-count></span>
        ${
          deck.locked
            ? `<span class="badge badge-sm badge-outline gap-1" title="Las respuestas se publican desde /admin y se ven para todo el mundo a la vez">
                 🔒 ${deck.locked} diapositiva${deck.locked > 1 ? 's' : ''} de respuesta bloqueada${deck.locked > 1 ? 's' : ''}
               </span>`
            : answersUnlocked
              ? '<span class="badge badge-sm badge-success">Respuestas publicadas</span>'
              : ''
        }
        <span class="text-xs opacity-50 ml-auto">Generado desde Markdown (Marp)</span>
      </div>
    </div>`

  const stage = el.querySelector('[data-stage]')
  const count = el.querySelector('[data-count]')

  // Own stylesheet scope, in both directions. See the note at the top.
  const shadow = stage.attachShadow({ mode: 'open' })
  shadow.innerHTML = `
    <style>
      :host { display: block; width: 100%; height: 100%; }
      .fit { width: 100%; height: 100%; display: grid; place-items: center; overflow: hidden; }
      .scaler { width: 1280px; height: 720px; transform-origin: center center; }
      ${css}
      section { margin: 0; position: relative; overflow: hidden; }
    </style>
    <div class="fit"><div class="scaler"></div></div>`

  const scaler = shadow.querySelector('.scaler')
  const fit = shadow.querySelector('.fit')

  const rescale = () => {
    const r = fit.getBoundingClientRect()
    if (!r.width || !r.height) return
    scaler.style.transform = `scale(${Math.min(r.width / 1280, r.height / 720)})`
  }

  const show = (n) => {
    i = Math.max(0, Math.min(n, deck.slides.length - 1))
    scaler.innerHTML = deck.slides[i].html
    count.textContent = `${i + 1} / ${deck.slides.length}`
    el.querySelector('[data-prev]').disabled = i === 0
    el.querySelector('[data-next]').disabled = i === deck.slides.length - 1
    rescale()
  }

  el.querySelector('[data-prev]').addEventListener('click', () => show(i - 1))
  el.querySelector('[data-next]').addEventListener('click', () => show(i + 1))

  // Arrow keys, but only while the deck is the visible panel. The portal traps
  // Tab and Escape itself; these are additive.
  const onKey = (e) => {
    if (!el.isConnected) {
      window.removeEventListener('keydown', onKey)
      return
    }
    if (e.key === 'ArrowRight' || e.key === 'PageDown') show(i + 1)
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') show(i - 1)
    else return
    e.preventDefault()
  }
  window.addEventListener('keydown', onKey)

  const ro = new ResizeObserver(rescale)
  ro.observe(stage)

  show(0)
  el.setAttribute('aria-label', `Presentación: ${esc(deck.title)}`)
  return true
}
