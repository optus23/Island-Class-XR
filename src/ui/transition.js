import { prefersReducedMotion } from '../lib/motion.js'

/**
 * Iris wipe — the shrinking circle that closes to black when Mario enters a
 * level, and opens back out on the way home.
 *
 * Implemented as one full-screen black element with a `radial-gradient` mask,
 * animated by a CSS custom property. That keeps the whole effect on the
 * compositor: no canvas work, no per-frame JS, and it costs nothing while
 * idle because the element only exists during a transition.
 *
 * The circle centres on wherever the player is on screen, so the level appears
 * to swallow the character rather than the screen merely going dark.
 */

const CLOSE_MS = 520
const OPEN_MS = 460

/**
 * Commit pending style, so the next change animates instead of being collapsed
 * into one recalculation.
 *
 * Deliberately NOT requestAnimationFrame: rAF does not fire in a hidden or
 * backgrounded tab, so gating the wipe on it meant switching tabs mid-entry
 * left the promise unresolved and the portal never opened at all. A forced
 * reflow is synchronous and always happens.
 */
function commitStyles(el) {
  void el.offsetWidth
}

/**
 * Can this browser subtract one mask layer from another?
 *
 * The shaped wipe needs "black everywhere EXCEPT this silhouette", which a
 * single mask image cannot express: outside its own box a mask image hides the
 * element, and we need the opposite. Two layers with `subtract` can. Where it
 * is unavailable the wipe quietly stays a circle rather than breaking.
 */
const canSubtractMasks =
  typeof CSS !== 'undefined' &&
  CSS.supports?.('mask-composite', 'exclude') &&
  CSS.supports?.('mask-image', 'linear-gradient(#000, #000)')

function makeLayer(cx, cy, shape) {
  const el = document.createElement('div')
  el.className = 'iris-wipe'
  if (shape === 'boss' && canSubtractMasks) el.classList.add('iris-wipe--boss')
  el.style.setProperty('--iris-x', `${cx}px`)
  el.style.setProperty('--iris-y', `${cy}px`)
  document.body.appendChild(el)
  return el
}

/** Radius that still covers the furthest screen corner from (cx, cy). */
function coveringRadius(cx, cy) {
  const w = window.innerWidth
  const h = window.innerHeight
  return Math.max(
    Math.hypot(cx, cy),
    Math.hypot(w - cx, cy),
    Math.hypot(cx, h - cy),
    Math.hypot(w - cx, h - cy)
  )
}

/**
 * Close the iris to black.
 * @returns {Promise<{open: () => Promise<void>}>} resolves once the screen is
 *   fully black — the caller swaps content here, then calls open().
 */
/**
 * @param {object} [opts]
 * @param {number} [opts.x] centre of the wipe, in client px
 * @param {number} [opts.y]
 * @param {'circle'|'boss'} [opts.shape] `boss` closes through a horned
 *   silhouette instead of a circle — the two castles get their own entrance.
 */
export function irisClose({
  x = window.innerWidth / 2,
  y = window.innerHeight / 2,
  shape = 'circle',
} = {}) {
  const reduced = prefersReducedMotion()
  const el = makeLayer(x, y, shape)
  const full = coveringRadius(x, y)

  el.style.setProperty('--iris-r', `${full}px`)

  return new Promise((resolve) => {
    const finish = () => {
      resolve({
        open() {
          return new Promise((done) => {
            if (reduced) {
              el.remove()
              done()
              return
            }
            el.style.transition = `--iris-r ${OPEN_MS}ms ease-out`
            commitStyles(el)
            el.style.setProperty('--iris-r', `${coveringRadius(x, y)}px`)
            setTimeout(() => {
              el.remove()
              done()
            }, OPEN_MS)
          })
        },
      })
    }

    if (reduced) {
      // No animation, but still a real black beat so the swap is not a jump cut.
      el.style.setProperty('--iris-r', '0px')
      setTimeout(finish, 90)
      return
    }

    el.style.transition = `--iris-r ${CLOSE_MS}ms ease-in`
    commitStyles(el)
    el.style.setProperty('--iris-r', '0px')
    setTimeout(finish, CLOSE_MS)
  })
}

/** Screen position of a world-space point, for centring the iris on the avatar. */
export function screenPositionOf(object3D, camera, container) {
  const v = object3D.getWorldPosition(new object3D.position.constructor())
  v.project(camera)
  const r = container.getBoundingClientRect()
  return {
    x: r.left + (v.x * 0.5 + 0.5) * r.width,
    y: r.top + (-v.y * 0.5 + 0.5) * r.height,
  }
}
