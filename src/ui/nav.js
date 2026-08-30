import { worlds } from '../config/worlds.js'
import { cssPalette } from '../config/theme.js'
import {
  course,
  levelsForWorld,
  statusFor,
  markerProgress,
  sessionNumber,
} from '../lib/levels.js'

/**
 * Course index, top-left.
 *
 * Same theme and the same statusFor() the 3D map uses, so the list can never
 * disagree with the island. Selecting an entry runs the identical selectLevel()
 * a node click does — walking there, not entering.
 *
 * Collapsed by default on narrow screens so the map stays the hero.
 */

let api = null

const WORLD_ICON = { 1: '🌱', 2: '🏜️', 3: '🏔️' }

function swatch(level, status) {
  const color = level.optional
    ? cssPalette.optional
    : status.completed
      ? cssPalette.completed
      : cssPalette[level.category] ?? cssPalette.theory
  const shape = level.category === 'boss' ? 'nav-dot--boss' : ''
  return `<span class="nav-dot ${shape}" style="background:${color}"></span>`
}

export function mountNav({ markerId, onSelect, onSelectWorld, onToggleOverview }) {
  const host = document.getElementById('ui')
  const el = document.createElement('div')
  el.className = 'nav-panel'
  host.appendChild(el)

  let open = window.innerWidth >= 1024
  let currentMarker = markerId
  let playerLevelId = markerId
  let overview = false

  function render() {
    const { index, total } = markerProgress(currentMarker)
    const pct = Math.round((index / Math.max(1, total - 1)) * 100)

    const worldSections = worlds
      .map((w) => {
        const levels = levelsForWorld(w.id)
        const sessions = levels.filter((l) => !l.optional)
        const done = sessions.filter((l) => statusFor(l, currentMarker).completed).length

        const items = levels
          .map((l) => {
            const st = statusFor(l, currentMarker)
            const here = l.id === playerLevelId
            const n = sessionNumber(l)
            return `
              <li>
                <button data-level="${l.id}"
                  class="nav-item ${here ? 'is-here' : ''} ${st.completed ? 'is-done' : ''}">
                  ${swatch(l, st)}
                  <span class="nav-item__num">${n ? `${n.world}-${n.index}` : '·'}</span>
                  <span class="nav-item__title">${l.title}</span>
                  ${st.current ? '<span class="nav-item__pin" title="Aquí está la clase">📍</span>' : ''}
                  ${l.optional ? '<span class="nav-item__extra">extra</span>' : ''}
                </button>
              </li>`
          })
          .join('')

        return `
          <section class="nav-world">
            <button class="nav-world__head" data-world="${w.id}">
              <span class="nav-world__icon">${WORLD_ICON[w.id] ?? '•'}</span>
              <span class="nav-world__name">${w.name.replace(/^World \d+ — /, '')}</span>
              <span class="nav-world__count">${done}/${sessions.length}</span>
            </button>
            <ul>${items}</ul>
          </section>`
      })
      .join('')

    el.innerHTML = `
      <div class="nav-card">
        <button class="nav-head" data-toggle aria-expanded="${open}">
          <span class="nav-head__mark">XR</span>
          <span class="nav-head__text">
            <span class="nav-head__title">${course.title}</span>
            <span class="nav-head__sub">${course.subtitle}</span>
          </span>
          <span class="nav-head__chev">${open ? '▲' : '▼'}</span>
        </button>

        <div class="nav-progress" title="Sesión ${index + 1} de ${total}">
          <div class="nav-progress__bar" style="width:${pct}%"></div>
          <span class="nav-progress__label">Sesión ${index + 1} / ${total}</span>
        </div>

        <div class="nav-body ${open ? '' : 'is-collapsed'}">
          <button class="nav-overview ${overview ? 'is-on' : ''}" data-overview>
            <span>${overview ? 'Volver al personaje' : 'Ver la isla entera'}</span>
            <kbd>M</kbd>
          </button>
          <div class="nav-scroll">${worldSections}</div>
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
