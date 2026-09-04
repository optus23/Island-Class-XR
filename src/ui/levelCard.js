import { cssPalette } from '../config/theme.js'
import { sessionNumber, sessionsRemaining } from '../lib/levels.js'
import { prefersReducedMotion } from '../lib/motion.js'

/**
 * The Mario level-start card: a dark screen with "MUNDO 1-3", the session
 * title, and a lives counter — shown INSIDE the closed iris on the way into a
 * level, so the whole entrance is one wipe: circle in, card, circle out.
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

  // No fade, in either direction, and z-index ABOVE the iris wipe (70).
  //
  // The card is only ever shown while the iris is already fully closed, so it
  // appears on a screen that is black anyway. Fading it in on top of that
  // black was the "fade to black, then the title, then the animation" the user
  // reported: two transitions stacked where the brief only ever wanted one.
  // The iris is the transition; the card just has to be there when it opens.
  const el = document.createElement('div')
  el.className =
    'level-card fixed inset-0 z-[80] grid place-items-center bg-[#0a0d12] text-white select-none'
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

  // body, not #ui: #ui carries z-index 10 and so opens its own stacking
  // context, which would trap the card underneath the iris however high its
  // own z-index went.
  document.body.appendChild(el)

  return new Promise((resolve) => {
    let done = false
    let holdTimer = null

    const finish = () => {
      if (done) return
      done = true
      clearTimeout(holdTimer)
      window.removeEventListener('keydown', onKey, true)
      el.removeEventListener('pointerdown', finish)
      // Removed outright. The caller is holding a closed iris over this, and
      // the portal mounts behind it before the iris opens — so the card must
      // be gone by then, not still fading out through the reveal.
      el.remove()
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
