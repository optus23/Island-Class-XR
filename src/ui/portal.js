import { cssPalette } from '../config/theme.js'
import { statusFor } from '../lib/levels.js'
import { renderSlides } from './slides.js'
import { renderTodos } from './todos.js'
import { loadMarkdown, renderMarkdownInto } from './markdown.js'

/**
 * The level portal.
 *
 * Which panel opens first is decided by the level's category, per the brief:
 *   theory / boss -> slides first (the lecture is the point)
 *   practical     -> the activities interface first, not slides
 *
 * A boss node opens the same portal as any other level: bosses are always
 * informative, never decorative.
 */

const STAGE_LABELS = {
  'intro-theory': 'Introducción y teoría',
  'ar-foundation': 'AR Foundation',
  'meta-pre-exam': 'Meta Building Blocks (antes del parcial)',
  'mini-boss-midterm': 'Examen parcial',
  'meta-post-exam': 'Meta Building Blocks (después del parcial)',
  'xr-toolkit': 'XR Interaction Toolkit',
  'final-project': 'Proyecto final',
  'final-boss-presentation': 'Presentación final',
}

const CATEGORY_LABELS = { theory: 'Teoría', practical: 'Práctica', boss: 'Jefe' }

let root = null
let escHandler = null
let closeHandler = null

function tabsFor(level) {
  const slides = { key: 'slides', label: 'Diapositivas' }
  const todos = { key: 'todos', label: 'Actividades' }
  const exercises = { key: 'exercises', label: 'Ejercicios' }
  const answers = { key: 'answers', label: 'Respuestas' }

  // Practical levels lead with the activities; everything else leads with slides.
  const ordered =
    level.category === 'practical' && level.todos?.length
      ? [todos, slides, exercises, answers]
      : [slides, todos, exercises, answers]

  return ordered.filter((t) => {
    if (t.key === 'todos') return Boolean(level.todos?.length)
    if (t.key === 'answers') return Boolean(level.answers)
    return true
  })
}

/** Removes the panel without notifying — used when swapping one level for another. */
function teardown() {
  if (!root) return
  root.remove()
  root = null
  if (escHandler) {
    window.removeEventListener('keydown', escHandler)
    escHandler = null
  }
}

/** Closes and notifies, so the caller can clear the URL. */
export function closePortal() {
  if (!root) return
  const notify = closeHandler
  closeHandler = null
  teardown()
  notify?.()
}

export function openPortal(level, { markerId = null, onClose = null } = {}) {
  // teardown, not closePortal: swapping levels must not fire the previous
  // portal's onClose, which would clear the URL we are about to set.
  teardown()
  closeHandler = onClose

  const status = statusFor(level, markerId)
  const accent = level.optional
    ? cssPalette.optional
    : status.completed
      ? cssPalette.completed
      : cssPalette[level.category] ?? cssPalette.theory

  const tabs = tabsFor(level)
  const badges = [
    `<span class="badge badge-sm" style="background:${accent};color:#0b0f14;border:none">
       ${CATEGORY_LABELS[level.category] ?? level.category}</span>`,
    `<span class="badge badge-sm badge-ghost">Mundo ${level.world}</span>`,
    `<span class="badge badge-sm badge-ghost">${STAGE_LABELS[level.stage] ?? level.stage}</span>`,
    level.optional ? '<span class="badge badge-sm badge-outline">Opcional</span>' : '',
    level.bossTier
      ? `<span class="badge badge-sm badge-outline">${level.bossTier === 'final' ? 'Jefe final' : 'Jefe intermedio'}</span>`
      : '',
    status.completed ? '<span class="badge badge-sm badge-success">Completado</span>' : '',
    status.current ? '<span class="badge badge-sm badge-warning">Aquí estamos</span>' : '',
  ]
    .filter(Boolean)
    .join('')

  root = document.createElement('div')
  root.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8'
  root.innerHTML = `
    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" data-close></div>

    <section role="dialog" aria-modal="true" aria-label="${level.title}"
      class="pixel-panel relative w-full max-w-4xl h-[86vh] rounded-xl bg-base-100
             text-base-content flex flex-col overflow-hidden">

      <header class="px-5 pt-4 pb-3 border-b border-base-content/15"
              style="box-shadow: inset 0 3px 0 0 ${accent}">
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0">
            <h2 class="text-xl sm:text-2xl font-bold leading-tight truncate">${level.title}</h2>
            <p class="text-sm opacity-70 mt-0.5">${level.summary ?? ''}</p>
          </div>
          <button class="btn btn-sm btn-circle btn-ghost shrink-0" data-close
                  aria-label="Cerrar">✕</button>
        </div>
        <div class="flex flex-wrap gap-1.5 mt-3">${badges}</div>
      </header>

      <nav class="px-5 pt-3 shrink-0" role="tablist">
        <div class="tabs tabs-box w-fit">
          ${tabs
            .map(
              (t, i) => `
            <button role="tab" class="tab ${i === 0 ? 'tab-active' : ''}"
                    data-tab="${t.key}">${t.label}</button>`
            )
            .join('')}
        </div>
      </nav>

      <div class="flex-1 min-h-0 overflow-auto px-5 py-4" data-panel></div>
    </section>`

  document.getElementById('ui').appendChild(root)

  const panel = root.querySelector('[data-panel]')
  const buttons = [...root.querySelectorAll('[data-tab]')]

  async function show(key) {
    buttons.forEach((b) => b.classList.toggle('tab-active', b.dataset.tab === key))
    // Slides need a fixed-height box to fill; text panels should scroll.
    panel.classList.toggle('overflow-hidden', key === 'slides')

    if (key === 'slides') {
      panel.innerHTML = '<div class="h-full" data-slot></div>'
      renderSlides(panel.querySelector('[data-slot]'), level)
      return
    }
    if (key === 'todos') {
      renderTodos(panel, level)
      return
    }
    const path = key === 'exercises' ? level.exercises : level.answers
    panel.innerHTML = '<p class="opacity-60">Cargando…</p>'
    const result = await loadMarkdown(path)
    renderMarkdownInto(
      panel,
      result,
      key === 'exercises'
        ? 'Este nivel no tiene ejercicios.'
        : 'Todavía no hay respuestas publicadas para este nivel.'
    )
  }

  buttons.forEach((b) => b.addEventListener('click', () => show(b.dataset.tab)))
  root.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', closePortal))

  escHandler = (e) => {
    if (e.key === 'Escape') closePortal()
  }
  window.addEventListener('keydown', escHandler)

  show(tabs[0].key)
  root.querySelector('[data-close].btn')?.focus()
}
