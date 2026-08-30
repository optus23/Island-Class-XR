import { cssPalette } from '../config/theme.js'
import { statusFor, sessionNumber } from '../lib/levels.js'
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
let keyHandler = null
let closeHandler = null
let restoreFocusTo = null

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select, textarea, iframe, [tabindex]:not([tabindex="-1"])'

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
  if (keyHandler) {
    window.removeEventListener('keydown', keyHandler, true)
    keyHandler = null
  }
  // Send focus back where it came from, or a keyboard user is dumped at the
  // top of the document every time they close a level.
  if (restoreFocusTo?.isConnected) restoreFocusTo.focus()
  restoreFocusTo = null
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
  restoreFocusTo = document.activeElement instanceof HTMLElement ? document.activeElement : null

  const status = statusFor(level, markerId)
  const accent = level.optional
    ? cssPalette.optional
    : status.completed
      ? cssPalette.completed
      : cssPalette[level.category] ?? cssPalette.theory

  const n = sessionNumber(level)
  const sessionLabel = n
    ? `Mundo ${n.world}-${n.index} · sesión ${n.global} de ${n.total}`
    : 'Nivel opcional'

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
  root.className = 'portal-screen'
  root.innerHTML = `
    <!-- The only thing allowed to overlay the full-screen UI. -->
    <button class="portal-back btn btn-sm btn-circle btn-neutral shadow-lg"
            data-close aria-label="Volver al mapa" title="Volver al mapa (Esc)">
      <span aria-hidden="true">&larr;</span>
    </button>

    <section role="dialog" aria-modal="true" aria-label="${level.title}"
             class="flex flex-col h-full min-h-0">

      <header class="shrink-0 px-5 sm:px-8 pt-5 pb-4 border-b border-base-content/10"
              style="box-shadow: inset 0 4px 0 0 ${accent}">
        <div class="pl-12 sm:pl-14">
          <p class="text-[11px] uppercase tracking-[0.2em] opacity-55 mb-1">
            ${sessionLabel}
          </p>
          <h2 class="text-2xl sm:text-4xl font-extrabold leading-tight">${level.title}</h2>
          <p class="text-sm sm:text-base opacity-70 mt-1.5 max-w-3xl">${level.summary ?? ''}</p>
          <div class="flex flex-wrap gap-1.5 mt-3">${badges}</div>
        </div>
      </header>

      <nav class="shrink-0 px-5 sm:px-8 pt-4" role="tablist">
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

      <div class="flex-1 min-h-0 overflow-auto px-5 sm:px-8 py-5" data-panel></div>
    </section>`

  document.body.appendChild(root)

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

  // Escape closes; Tab is trapped inside the dialog. Capture phase so the map's
  // own key handling never sees keys aimed at the modal.
  keyHandler = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      closePortal()
      return
    }
    if (e.key !== 'Tab' || !root) return
    const items = [...root.querySelectorAll(FOCUSABLE)].filter(
      (el) => el.offsetParent !== null || el.tagName === 'IFRAME'
    )
    if (!items.length) return
    const first = items[0]
    const last = items[items.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    } else if (!root.contains(document.activeElement)) {
      e.preventDefault()
      first.focus()
    }
  }
  window.addEventListener('keydown', keyHandler, true)

  show(tabs[0].key)
  root.querySelector('[data-close]')?.focus()
}
