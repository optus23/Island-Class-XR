import { cssPalette } from '../config/theme.js'
import { sessionNumber, sessionsRemaining } from '../lib/levels.js'
import { prefersReducedMotion } from '../lib/motion.js'

/**
 * The Mario level-start card: a dark screen with "MUNDO 1-3", the session
 * title, and a lives counter — shown as the avatar centres on a new session.
 *
 * The lives count is the easter egg, but it is not decorative: it is the
 * number of sessions still ahead in the course, so the joke carries real
 * information rather than a fake "x 3".
 *
 * Resolves when the card is done, so the caller can open the portal after it.
 * Click, Escape or Enter skips it — nobody should be made to wait twice for a
 * card they have already read.
 */

const HOLD_MS = 1250
const FADE_MS = 220

let active = null

export function hideLevelCard() {
  active?.skip()
}

export function showLevelCard(level, { markerId = null } = {}) {
  active?.skip()

  const n = sessionNumber(level)
  // Optional/bonus levels are not sessions and get no card.
  if (!n) return Promise.resolve()

  const accent = level.optional
    ? cssPalette.optional
    : cssPalette[level.category] ?? cssPalette.theory
  const lives = sessionsRemaining(level)
  const reduced = prefersReducedMotion()

  const el = document.createElement('div')
  el.className =
    'fixed inset-0 z-[55] grid place-items-center bg-[#0a0d12] text-white select-none'
  el.style.transition = reduced ? 'none' : `opacity ${FADE_MS}ms ease`
  el.style.opacity = reduced ? '1' : '0'
  el.setAttribute('role', 'status')
  el.innerHTML = `
    <div class="text-center px-6">
      <div class="flex items-center justify-center gap-3 mb-8">
        <span class="inline-block w-5 h-5 rounded-[3px]" style="background:${accent}"></span>
        <span class="text-2xl font-bold tracking-[0.2em]">&times; ${lives}</span>
      </div>

      <p class="text-4xl sm:text-5xl font-extrabold tracking-[0.18em] mb-4">
        MUNDO ${n.world}-${n.index}
      </p>
      <p class="text-lg sm:text-xl opacity-90 max-w-xl mx-auto leading-snug">${level.title}</p>

      <p class="mt-8 text-[11px] uppercase tracking-[0.25em] opacity-50">
        Sesión ${n.global} de ${n.total} · quedan ${lives}
      </p>
    </div>`

  document.getElementById('ui').appendChild(el)
  if (!reduced) requestAnimationFrame(() => (el.style.opacity = '1'))

  return new Promise((resolve) => {
    let done = false
    let holdTimer = null
    let fadeTimer = null

    const finish = () => {
      if (done) return
      done = true
      clearTimeout(holdTimer)
      clearTimeout(fadeTimer)
      window.removeEventListener('keydown', onKey, true)
      el.removeEventListener('pointerdown', finish)
      if (reduced) {
        el.remove()
      } else {
        el.style.opacity = '0'
        setTimeout(() => el.remove(), FADE_MS)
      }
      if (active?.el === el) active = null
      resolve()
    }

    const onKey = (e) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        finish()
      }
    }

    el.addEventListener('pointerdown', finish)
    window.addEventListener('keydown', onKey, true)

    // Reduced motion: show it, but do not hold the viewer in a timed animation.
    holdTimer = setTimeout(finish, reduced ? 450 : HOLD_MS)
    active = { el, skip: finish }
  })
}
