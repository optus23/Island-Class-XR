import { cssPalette } from '../config/theme.js'
import { statusFor } from '../lib/levels.js'

/**
 * Small screen-space extras: the hover tooltip and the first-load curtain.
 * Both are pointer-transparent so they never intercept a click meant for the map.
 */

const CATEGORY_LABELS = {
  theory: 'Teoría',
  practical: 'Práctica',
  project: 'Proyecto',
  boss: 'Examen',
}

export function createTooltip() {
  const el = document.createElement('div')
  el.className =
    'pointer-events-none fixed z-40 hidden max-w-[16rem] rounded-md px-2.5 py-1.5 ' +
    'text-sm bg-base-100/95 text-base-content shadow-lg border border-base-content/20'
  document.getElementById('ui').appendChild(el)

  let shownFor = null

  return {
    show(level, x, y, markerId) {
      if (level.id !== shownFor) {
        shownFor = level.id
        const st = statusFor(level, markerId)
        const accent = level.optional
          ? cssPalette.optional
          : st.completed
            ? cssPalette.completed
            : cssPalette[level.category] ?? cssPalette.theory
        const tags = [
          CATEGORY_LABELS[level.category] ?? level.category,
          level.optional ? 'opcional' : null,
          st.completed ? 'completado' : null,
          st.current ? 'aquí estamos' : null,
        ].filter(Boolean)

        el.innerHTML = `
          <span class="flex items-center gap-2">
            <span class="inline-block w-2.5 h-2.5 rounded-[3px] shrink-0"
                  style="background:${accent}"></span>
            <span class="font-semibold leading-tight">${level.title}</span>
          </span>
          <span class="block text-[11px] opacity-70 mt-0.5">${tags.join(' · ')}</span>`
      }
      el.classList.remove('hidden')
      // Keep the tooltip on screen near the right/bottom edges.
      const r = el.getBoundingClientRect()
      const left = Math.min(x + 16, window.innerWidth - r.width - 8)
      const top = Math.min(y + 16, window.innerHeight - r.height - 8)
      el.style.left = `${Math.max(8, left)}px`
      el.style.top = `${Math.max(8, top)}px`
    },
    hide() {
      shownFor = null
      el.classList.add('hidden')
    },
  }
}

/** Covers the canvas until the island is built and the first frame is drawn. */
export function createCurtain() {
  const el = document.createElement('div')
  el.className =
    'fixed inset-0 z-[60] grid place-items-center bg-[#9bd4e4] transition-opacity duration-500'
  el.innerHTML = `
    <div class="text-center text-[#123]">
      <div class="text-2xl font-bold tracking-wide">XR Island</div>
      <div class="mt-2 text-sm opacity-70">Construyendo la isla…</div>
    </div>`
  document.body.appendChild(el)

  let lifted = false
  const lift = () => {
    if (lifted) return
    lifted = true
    el.style.opacity = '0'
    setTimeout(() => el.remove(), 550)
  }
  // Belt and braces: a tab loaded in the background never gets a rAF callback,
  // and a curtain that outlives the page it hides is worse than no curtain.
  setTimeout(lift, 2500)

  return { lift }
}
