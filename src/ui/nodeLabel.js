import { cssPalette } from '../config/theme.js'
import { sessionNumber, statusFor } from '../lib/levels.js'

/**
 * The small plate that floats over the avatar when you walk onto a node.
 *
 * Deliberately tiny and non-blocking: selecting a node must never cover the
 * map. The full-screen level card belongs to actually ENTERING a level, which
 * takes a second click or Enter. This is the "you are standing here, press
 * Enter" affordance in between.
 *
 * It is a real <button>, not decoration: it says "entrar", so clicking or
 * tapping it must enter, exactly like clicking the node disc underneath. It
 * was previously a div with `aria-hidden` and `pointer-events: none`, which
 * made it a label that told you to do something it would not let you do.
 *
 * IT DISMISSES ITSELF, AND IT GETS OUT OF THE WAY
 * Two rules, both from the same report: touch anything that is not this plate
 * and it goes away, and while it is up it never sits on top of another panel.
 * Without the first it stayed on screen through everything — you opened the
 * course list and read one UI through the other. Without the second, picking a
 * session FROM that list put the plate straight back over the open panel, so
 * dismissing alone would have fixed only half of it.
 */

/** Distance from the avatar's screen point to the plate, above and below. */
const ABOVE = 96
const BELOW = 34

/**
 * Panels the plate must not cover. Their rects are re-read on a timer rather
 * than every frame: `positionNodeLabel` runs in the render loop and reading a
 * rect right after writing a transform forces a synchronous layout. They only
 * change when someone collapses a panel or turns the phone, so a fifth of a
 * second of staleness is invisible.
 */
const PANELS = '.nav-panel, .legend-panel'
const PANEL_REFRESH_MS = 200

let el = null
let shownFor = null
let enterHandler = null
let panels = []
let panelsAt = 0

function ensure() {
  if (el) return el
  el = document.createElement('button')
  el.type = 'button'
  el.className = 'node-label'
  // The map's own tap handling lives on the canvas container, so this click
  // never reaches it — but stop it anyway, so a future listener on #ui cannot
  // turn one tap into both "enter" and "select".
  el.addEventListener('click', (e) => {
    e.stopPropagation()
    enterHandler?.(shownFor)
  })
  document.getElementById('ui').appendChild(el)

  // Anything else you touch dismisses it. On `document`, in the CAPTURE phase,
  // so it cannot be swallowed by a handler that stops propagation — the map's
  // canvas, the course list, the legend's teacher buttons and the VR button are
  // all different listeners and none of them should have to know this plate
  // exists.
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (!shownFor || el.contains(e.target)) return
      hideNodeLabel()
    },
    true
  )
  return el
}

/** The map supplies what "entrar" means; this module only owns the plate. */
export function onNodeLabelEnter(fn) {
  enterHandler = fn
}

/** Which level the plate is showing, or null. */
export function nodeLabelFor() {
  return shownFor
}

export function showNodeLabel(level, { markerId = null } = {}) {
  const node = ensure()
  if (shownFor === level.id) return
  shownFor = level.id
  panelsAt = 0 // re-read the panels: one of them may have just opened

  const st = statusFor(level, markerId)
  const accent = level.optional
    ? cssPalette.optional
    : st.completed
      ? cssPalette.completed
      : cssPalette[level.category] ?? cssPalette.theory
  const n = sessionNumber(level)

  node.innerHTML = `
    <span class="node-label__tag" style="background:${accent}">
      ${n ? `${n.world}-${n.index}` : 'EXTRA'}
    </span>
    <span class="node-label__title">${level.title}</span>
    <span class="node-label__hint"><kbd>Enter</kbd> entrar</span>`
  node.setAttribute('aria-label', `Entrar en ${level.title}`)
  node.classList.add('is-visible')
}

export function hideNodeLabel() {
  shownFor = null
  el?.classList.remove('is-visible')
}

const overlaps = (a, b) =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top

/** Keep the plate pinned above the avatar. Called every frame. */
export function positionNodeLabel(screenX, screenY) {
  if (!el || !el.classList.contains('is-visible')) return
  const w = el.offsetWidth
  const h = el.offsetHeight
  const x = Math.max(8, Math.min(screenX - w / 2, window.innerWidth - w - 8))

  const now = performance.now()
  if (now - panelsAt > PANEL_REFRESH_MS) {
    panelsAt = now
    panels = [...document.querySelectorAll(PANELS)]
      .map((p) => p.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0)
  }

  // Above the avatar by preference, below it if that would land on a panel.
  // If both collide — a phone where the open course list is most of the
  // screen — stay above and let the plate win; it is on top and readable, and
  // the next thing the reader touches dismisses it anyway.
  const clamp = (y) => Math.max(8, Math.min(y, window.innerHeight - h - 8))
  let y = clamp(screenY - ABOVE)
  if (panels.length) {
    const hits = (top) => panels.some((p) => overlaps({ left: x, right: x + w, top, bottom: top + h }, p))
    if (hits(y)) {
      const below = clamp(screenY + BELOW)
      if (!hits(below)) y = below
    }
  }

  el.style.transform = `translate(${x}px, ${y}px)`
}
