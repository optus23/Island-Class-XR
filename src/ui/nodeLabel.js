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
 */

let el = null
let shownFor = null
let enterHandler = null

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
  return el
}

/** The map supplies what "entrar" means; this module only owns the plate. */
export function onNodeLabelEnter(fn) {
  enterHandler = fn
}

export function showNodeLabel(level, { markerId = null } = {}) {
  const node = ensure()
  if (shownFor === level.id) return
  shownFor = level.id

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

/** Keep the plate pinned above the avatar. Called every frame. */
export function positionNodeLabel(screenX, screenY) {
  if (!el || !el.classList.contains('is-visible')) return
  const w = el.offsetWidth
  const x = Math.max(8, Math.min(screenX - w / 2, window.innerWidth - w - 8))
  const y = Math.max(8, screenY - 96)
  el.style.transform = `translate(${x}px, ${y}px)`
}
