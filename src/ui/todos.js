import { marked } from 'marked'
import { t } from '../lib/i18n/index.js'
import { localized } from '../lib/i18n/text.js'

/**
 * Renders the interactive activities. Never a PDF, never plain text.
 *
 * The only type today is `objective-task`: a practical objective, a starting
 * point, a numbered step-by-step guide from that start to a working mechanic,
 * and a deliverable. The renderer is keyed by type so new activity types can be
 * added later without touching the portal.
 *
 * WHY STEPS AND NOT MILESTONES
 * This used to be `milestones`: an unordered list of things the finished work
 * had to show, rendered under the heading "Hitos". The v3.0 content replaced
 * every one of them with an ordered guide a student follows top to bottom —
 * "abre este menú, añade este componente, ahora prueba en el visor". Those are
 * two different documents, so the field was renamed with the content rather
 * than left saying one thing and holding the other. Ordered list, visible
 * numbers: a student stuck at step 9 needs to be able to say "step 9".
 *
 * Step ticks are the STUDENT's own notes. They live in that student's
 * localStorage and never leave the browser — they are unrelated to the
 * teacher's progress marker in progress.json.
 */

// Deliberately NOT the old `xrisland:milestones:` key. The lists were rewritten
// and renumbered, so a tick saved against milestone 3 means nothing about step
// 3 — restoring it would silently mark the wrong instruction as done.
const STORE_PREFIX = 'xrisland:steps:'

function loadTicks(todoId, count) {
  try {
    const raw = localStorage.getItem(STORE_PREFIX + todoId)
    const arr = raw ? JSON.parse(raw) : []
    return Array.from({ length: count }, (_, i) => Boolean(arr[i]))
  } catch {
    return Array.from({ length: count }, () => false)
  }
}

function saveTicks(todoId, ticks) {
  try {
    localStorage.setItem(STORE_PREFIX + todoId, JSON.stringify(ticks))
  } catch {
    /* private mode / storage disabled — ticks simply do not persist */
  }
}

const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  )

/**
 * The step text as its author wrote it: `**Add Component**` bold, `` `Edit >
 * Project Settings` `` as code. `parseInline` and not `parse`, so it stays
 * inside the `<span>` instead of growing its own `<p>`.
 *
 * Same trust boundary as the exercise Markdown in `public/content/`: this is
 * committed to the repository by the teacher, not typed by a visitor. Nothing
 * a student enters ever reaches here — their ticks are booleans.
 *
 * Every menu path in the content keeps its `>` inside backticks, which is what
 * stops `marked` reading `Window > Package Manager` as a blockquote.
 *
 * IT GOES THROUGH `localized` FIRST, so every prose field here takes the same
 * two shapes the rest of the content does — a plain string, or `{en, es, ca}`.
 * The step-by-step guides are the longest text in the course and are still
 * Spanish-only; this is what makes translating one a DATA edit rather than a
 * code change. `npm run validate` prints the outstanding list.
 */
const md = (s) => marked.parseInline(localized(s))

/** @type {Record<string, (todo:object)=>string>} */
const renderers = {
  'objective-task': (todo) => {
    const total = todo.steps?.length ?? 0
    const ticks = loadTicks(todo.id, total)
    const done = ticks.filter(Boolean).length

    const steps = (todo.steps ?? [])
      .map(
        (s, i) => `
        <li class="flex items-start gap-3 py-1.5">
          <input type="checkbox" class="checkbox checkbox-sm mt-0.5 shrink-0"
                 data-todo="${escape(todo.id)}" data-index="${i}"
                 ${ticks[i] ? 'checked' : ''} />
          <span class="tabular-nums opacity-45 shrink-0 w-6 text-right">${i + 1}.</span>
          <span class="leading-snug ${ticks[i] ? 'line-through opacity-55' : ''}"
                data-label-for="${escape(todo.id)}-${i}">${md(s)}</span>
        </li>`
      )
      .join('')

    return `
      <article class="rounded-xl border border-base-content/15 bg-base-200/50 p-5 mb-4"
               data-todo-card="${escape(todo.id)}">
        <div class="flex items-start justify-between gap-4 mb-3">
          <div>
            <span class="badge badge-sm badge-primary mb-2">${t('todos.objective')}</span>
            <h4 class="text-lg font-semibold leading-snug">${md(todo.objective)}</h4>
          </div>
          <span class="badge badge-ghost whitespace-nowrap" data-progress-for="${escape(todo.id)}">
            ${done}/${total}
          </span>
        </div>

        <div class="mb-4">
          <p class="text-xs uppercase tracking-wide opacity-60 mb-1">${t('todos.startingPoint')}</p>
          <p class="text-sm">${md(todo.starting_point)}</p>
        </div>

        <div class="mb-4">
          <p class="text-xs uppercase tracking-wide opacity-60 mb-1">
            ${t('todos.stepGuide')}${todo.steps_note ? ` (${escape(localized(todo.steps_note))})` : ''}
          </p>
          <ul class="text-sm">${steps}</ul>
        </div>

        <div>
          <p class="text-xs uppercase tracking-wide opacity-60 mb-1">${t('todos.delivery')}</p>
          <p class="text-sm">${md(todo.deliverable)}</p>
        </div>
      </article>`
  },
}

export function renderTodos(el, level) {
  const todos = level.todos ?? []
  if (!todos.length) {
    el.innerHTML = `
      <p class="opacity-70">${t('todos.none')}</p>`
    return
  }

  el.innerHTML = todos
    .map((item) => {
      const render = renderers[item.type]
      if (!render) {
        return `<p class="text-warning">${t('todos.unsupported', { type: escape(item.type) })}</p>`
      }
      return render(item)
    })
    .join('')

  // Ticking a step updates the label, the counter and localStorage.
  el.querySelectorAll('input[type="checkbox"][data-todo]').forEach((box) => {
    box.addEventListener('change', () => {
      const todoId = box.dataset.todo
      const todo = todos.find((t) => t.id === todoId)
      const count = todo?.steps?.length ?? 0
      const ticks = loadTicks(todoId, count)
      ticks[Number(box.dataset.index)] = box.checked
      saveTicks(todoId, ticks)

      const label = el.querySelector(`[data-label-for="${todoId}-${box.dataset.index}"]`)
      label?.classList.toggle('line-through', box.checked)
      label?.classList.toggle('opacity-55', box.checked)

      const counter = el.querySelector(`[data-progress-for="${todoId}"]`)
      if (counter) counter.textContent = `${ticks.filter(Boolean).length}/${count}`
    })
  })
}
