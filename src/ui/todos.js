/**
 * Renders the interactive activities. Never a PDF, never plain text.
 *
 * The only type today is `objective-task`: a practical objective, a starting
 * point, a checkable milestone list running from that start to the finished
 * result, and a deliverable. The renderer is keyed by type so new activity
 * types can be added later without touching the portal.
 *
 * Milestone ticks are the STUDENT's own notes. They live in that student's
 * localStorage and never leave the browser — they are unrelated to the
 * teacher's progress marker in progress.json.
 */

const STORE_PREFIX = 'xrisland:milestones:'

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

/** @type {Record<string, (todo:object)=>string>} */
const renderers = {
  'objective-task': (todo) => {
    const ticks = loadTicks(todo.id, todo.milestones?.length ?? 0)
    const done = ticks.filter(Boolean).length
    const total = todo.milestones?.length ?? 0

    const milestones = (todo.milestones ?? [])
      .map(
        (m, i) => `
        <li class="flex items-start gap-3 py-1.5">
          <input type="checkbox" class="checkbox checkbox-sm mt-0.5 shrink-0"
                 data-todo="${escape(todo.id)}" data-index="${i}"
                 ${ticks[i] ? 'checked' : ''} />
          <span class="leading-snug ${ticks[i] ? 'line-through opacity-55' : ''}"
                data-label-for="${escape(todo.id)}-${i}">${escape(m)}</span>
        </li>`
      )
      .join('')

    return `
      <article class="rounded-xl border border-base-content/15 bg-base-200/50 p-5 mb-4"
               data-todo-card="${escape(todo.id)}">
        <div class="flex items-start justify-between gap-4 mb-3">
          <div>
            <span class="badge badge-sm badge-primary mb-2">Objetivo</span>
            <h4 class="text-lg font-semibold leading-snug">${escape(todo.objective)}</h4>
          </div>
          <span class="badge badge-ghost whitespace-nowrap" data-progress-for="${escape(todo.id)}">
            ${done}/${total}
          </span>
        </div>

        <div class="mb-4">
          <p class="text-xs uppercase tracking-wide opacity-60 mb-1">Punto de partida</p>
          <p class="text-sm">${escape(todo.starting_point)}</p>
        </div>

        <div class="mb-4">
          <p class="text-xs uppercase tracking-wide opacity-60 mb-1">Hitos</p>
          <ul class="text-sm">${milestones}</ul>
        </div>

        <div>
          <p class="text-xs uppercase tracking-wide opacity-60 mb-1">Entrega</p>
          <p class="text-sm">${escape(todo.deliverable)}</p>
        </div>
      </article>`
  },
}

export function renderTodos(el, level) {
  const todos = level.todos ?? []
  if (!todos.length) {
    el.innerHTML = `
      <p class="opacity-70">
        Este nivel no tiene actividades interactivas.
        Añádelas en <code class="text-xs">todos</code> dentro de levels.json.
      </p>`
    return
  }

  el.innerHTML = todos
    .map((t) => {
      const render = renderers[t.type]
      if (!render) {
        return `<p class="text-warning">Tipo de actividad no soportado todavía: "${escape(t.type)}".</p>`
      }
      return render(t)
    })
    .join('')

  // Ticking a milestone updates the label, the counter and localStorage.
  el.querySelectorAll('input[type="checkbox"][data-todo]').forEach((box) => {
    box.addEventListener('change', () => {
      const todoId = box.dataset.todo
      const todo = todos.find((t) => t.id === todoId)
      const count = todo?.milestones?.length ?? 0
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
