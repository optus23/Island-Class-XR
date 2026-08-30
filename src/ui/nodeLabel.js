import { cssPalette } from '../config/theme.js'
import { sessionNumber, statusFor } from '../lib/levels.js'

/**
 * The small plate that floats over the avatar when you walk onto a node.
 *
 * Deliberately tiny and non-blocking: selecting a node must never cover the
 * map. The full-screen level card belongs to actually ENTERING a level, which
 * takes a second click or Enter. This is the "you are standing here, press
 * Enter" affordance in between.
 */

let el = null
let shownFor = null

function ensure() {
  if (el) return el
  el = document.createElement('div')
  el.className = 'node-label'
  el.setAttribute('aria-hidden', 'true')
  document.getElementById('ui').appendChild(el)
  return el
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
