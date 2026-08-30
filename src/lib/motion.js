/**
 * One place to ask whether the viewer wants motion reduced.
 *
 * The map is built out of movement — hops, camera pans, bobbing castles — and
 * for someone with vestibular sensitivity that is exactly the problem. When
 * reduced motion is set, everything still WORKS and still ends in the same
 * state; it just arrives instantly instead of animating.
 *
 * Live, not read once: the OS setting can change while the page is open.
 */

const query =
  typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null

let reduced = query?.matches ?? false
const listeners = new Set()

query?.addEventListener?.('change', (e) => {
  reduced = e.matches
  for (const fn of listeners) fn(reduced)
})

export function prefersReducedMotion() {
  return reduced
}

export function onMotionPreferenceChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
