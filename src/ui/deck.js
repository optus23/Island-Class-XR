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
 * @returns {Promise<{title:string, slides:Array<{html:string,classes:string[]}>}|null>}
 */
async function loadDeck(levelId) {
  if (cache.has(levelId)) return cache.get(levelId)

  const p = (async () => {
    const index = await loadDeckIndex()
    if (!index[levelId]) return null
    const deck = await getJSON(`decks/${levelId}.json`)
    return { title: deck.title, slides: deck.slides }
  })()

  cache.set(levelId, p)
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
export async function renderDeck(el, level) {
  const deck = await loadDeck(level.id)
  if (!deck) return false

  const css = await getTheme()
  let i = 0

  el.innerHTML = `
    <div class="flex flex-col gap-2" data-deck>
      <!-- aspect-video so the height follows the width and nothing has to be
           measured. max-w caps it by HEIGHT on a wide screen: 16/9 of 68vh, so
           a desktop deck never grows so tall that it has to be scrolled. -->
      <div class="w-full max-w-[121vh] mx-auto aspect-video rounded-lg overflow-hidden
                  bg-[#0a0d12] border border-base-content/15 grid place-items-center"
           data-stage></div>

      <div class="shrink-0 flex items-center gap-2 flex-wrap">
        <button class="btn btn-sm" data-prev aria-label="Diapositiva anterior">←</button>
        <button class="btn btn-sm" data-next aria-label="Diapositiva siguiente">→</button>
        <span class="text-sm tabular-nums opacity-70" data-count></span>
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
      /* .marpit is not decoration: marp-core scopes its ENTIRE theme as
         '.marpit > section'. Extracting the bare <section> and dropping this
         wrapper left every slide unstyled — default black text on the viewer's
         near-black plate, which read as a blank black panel. */
      .scaler { width: 1280px; height: 720px; transform-origin: center center; }
      ${css}
      section { margin: 0; position: relative; overflow: hidden; }
    </style>
    <div class="fit"><div class="scaler marpit"></div></div>`

  const scaler = shadow.querySelector('.scaler')
  const fit = shadow.querySelector('.fit')

  /**
   * Fit the 1280x720 slide to the stage.
   *
   * From the WIDTH only. The stage is `aspect-video`, so its height always
   * follows its width and there is nothing else to measure. The previous
   * version took `min(width/1280, height/720)` off a `flex-1 min-h-0` box whose
   * height came from a chain of parents — and on a phone, where the portal
   * header eats most of the screen, that chain did not resolve. `rescale` then
   * measured zero, returned without setting a transform, and the slide was left
   * at its full 1280x720 inside a ~275px window: you saw a hugely magnified
   * patch of the slide's own dark background, which read as a black panel.
   *
   * If the width is still zero the element is not laid out yet, so try again on
   * the next frame rather than silently leaving no transform at all.
   */
  let retry = 0
  const rescale = () => {
    const w = fit.getBoundingClientRect().width
    if (!w) {
      if (retry++ < 20) requestAnimationFrame(rescale)
      return
    }
    retry = 0
    scaler.style.transform = `scale(${w / 1280})`
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
