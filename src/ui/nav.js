import { worlds } from '../config/worlds.js'
import { cssPalette } from '../config/theme.js'
import { course, levelsForWorld, statusFor, markerProgress } from '../lib/levels.js'

/**
 * Top-right index of the whole course, kept in sync with the map: the same
 * colour rules, the same status, and clicking an entry drives the same
 * selectLevel() the 3D nodes do — so the menu can never disagree with the map.
 */

let api = null

function dot(level, status) {
  const color = level.optional
    ? cssPalette.optional
    : status.completed
      ? cssPalette.completed
      : cssPalette[level.category] ?? cssPalette.theory
  const shape = level.category === 'boss' ? 'rotate-45' : 'rounded-[3px]'
  return `<span class="inline-block w-2.5 h-2.5 shrink-0 ${shape}"
                style="background:${color}"></span>`
}

export function mountNav({ markerId, onSelect, onSelectWorld, onToggleOverview }) {
  const host = document.getElementById('ui')
  const el = document.createElement('div')
  el.className = 'absolute top-3 right-3 w-[19rem] max-w-[calc(100vw-1.5rem)]'
  host.appendChild(el)

  let open = window.innerWidth >= 900
  let currentMarker = markerId
  let playerLevelId = markerId
  let overview = false

  function render() {
    const { index, total } = markerProgress(currentMarker)

    const worldSections = worlds
      .map((w) => {
        const items = levelsForWorld(w.id)
          .map((l) => {
            const st = statusFor(l, currentMarker)
            const here = l.id === playerLevelId
            return `
              <li>
                <button data-level="${l.id}"
                  class="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded
                         hover:bg-base-content/10 ${here ? 'bg-base-content/15' : ''}">
                  ${dot(l, st)}
                  <span class="truncate text-sm ${st.completed ? 'opacity-60' : ''}">${l.title}</span>
                  ${l.optional ? '<span class="badge badge-xs badge-outline ml-auto shrink-0">extra</span>' : ''}
                  ${st.current ? '<span class="ml-auto shrink-0 text-xs">📍</span>' : ''}
                </button>
              </li>`
          })
          .join('')

        return `
          <section class="mb-2">
            <button class="w-full text-left px-2 py-1 text-xs uppercase tracking-wide
                           opacity-70 hover:opacity-100" data-world="${w.id}">
              ${w.name}
            </button>
            <ul>${items}</ul>
          </section>`
      })
      .join('')

    el.innerHTML = `
      <div class="pixel-panel rounded-lg bg-base-100/95 text-base-content overflow-hidden">
        <button class="w-full flex items-center justify-between gap-2 px-3 py-2
                       hover:bg-base-content/5" data-toggle>
          <span class="min-w-0">
            <span class="block font-bold leading-tight truncate">${course.title}</span>
            <span class="block text-[11px] opacity-70 truncate">${course.subtitle}</span>
          </span>
          <span class="text-xs opacity-70 shrink-0">${open ? '▲' : '▼'}</span>
        </button>

        <div class="px-3 pb-2 ${open ? '' : 'hidden'}">
          <div class="flex items-center gap-2 mb-2">
            <progress class="progress progress-success flex-1 h-1.5"
                      value="${index}" max="${Math.max(1, total - 1)}"></progress>
            <span class="text-[11px] opacity-70 shrink-0 tabular-nums">${index + 1}/${total}</span>
          </div>

          <button class="btn btn-xs btn-block mb-2 ${overview ? 'btn-primary' : 'btn-outline'}"
                  data-overview>
            ${overview ? 'Volver al personaje' : 'Ver la isla entera'}
            <kbd class="kbd kbd-xs ml-auto">M</kbd>
          </button>
          <div class="max-h-[52vh] overflow-auto pr-1">${worldSections}</div>

          <div class="mt-2 pt-2 border-t border-base-content/15">
            <p class="px-2 text-[10px] uppercase tracking-wide opacity-55 mb-1">Leyenda</p>
            <ul class="px-2 grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] opacity-80">
              ${[
                ['completed', 'Completado', 'rounded-[3px]'],
                ['theory', 'Teoría', 'rounded-[3px]'],
                ['practical', 'Práctica', 'rounded-[3px]'],
                ['optional', 'Opcional', 'rounded-[3px]'],
                ['boss', 'Jefe', 'rotate-45'],
              ]
                .map(
                  ([key, label, shape]) => `
                  <li class="flex items-center gap-1.5">
                    <span class="inline-block w-2.5 h-2.5 shrink-0 ${shape}"
                          style="background:${cssPalette[key]}"></span>
                    <span class="truncate">${label}</span>
                  </li>`
                )
                .join('')}
            </ul>
          </div>
        </div>
      </div>`

    el.querySelector('[data-toggle]').addEventListener('click', () => {
      open = !open
      render()
    })
    el.querySelector('[data-overview]')?.addEventListener('click', () => onToggleOverview?.())
    el.querySelectorAll('[data-world]').forEach((b) =>
      b.addEventListener('click', () => onSelectWorld?.(Number(b.dataset.world)))
    )
    el.querySelectorAll('[data-level]').forEach((b) =>
      b.addEventListener('click', () => onSelect(b.dataset.level))
    )
  }

  render()

  api = {
    setMarker(id) {
      currentMarker = id
      render()
    },
    setPlayerLevel(id) {
      playerLevelId = id
      render()
    },
    setOverview(on) {
      overview = on
      render()
    },
  }
  return api
}

export function navApi() {
  return api
}
