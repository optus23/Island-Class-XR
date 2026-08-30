import { cssPalette } from '../config/theme.js'

/**
 * Bottom-right colour key, plus the teacher's debug controls.
 *
 * The debug block only appears when an admin token is already present in THIS
 * browser's localStorage — the same gate the /admin panel uses. Students never
 * see it, and it is a convenience surface, not a second source of truth: every
 * button writes through the same progress marker.
 */

const ADMIN_TOKEN_KEY = 'xrisland:gh-token'

const ROWS = [
  ['completed', 'Completado'],
  ['theory', 'Teoría'],
  ['practical', 'Práctica'],
  ['optional', 'Opcional'],
  ['boss', 'Jefe'],
]

export function hasAdminToken() {
  try {
    return Boolean(localStorage.getItem(ADMIN_TOKEN_KEY))
  } catch {
    return false
  }
}

/**
 * @param {{onAdvance:Function, onBack:Function, onReset:Function, onCompleteHere:Function}} actions
 */
export function mountLegend(actions = {}) {
  const el = document.createElement('div')
  el.className = 'legend-panel'
  document.getElementById('ui').appendChild(el)

  let open = true
  let admin = hasAdminToken()
  let busy = false
  let note = ''

  function render() {
    const swatches = ROWS.map(
      ([key, label]) => `
        <li class="legend-row">
          <span class="nav-dot ${key === 'boss' ? 'nav-dot--boss' : ''}"
                style="background:${cssPalette[key]}"></span>
          <span>${label}</span>
        </li>`
    ).join('')

    el.innerHTML = `
      <div class="legend-card">
        <button class="legend-head" data-toggle>
          <span>Leyenda</span>
          <span class="legend-head__chev">${open ? '▾' : '▸'}</span>
        </button>

        <div class="${open ? '' : 'is-collapsed'}">
          <ul class="legend-list">${swatches}</ul>

          ${
            admin
              ? `<div class="legend-admin">
                   <p class="legend-admin__title">Profesor</p>
                   <div class="legend-admin__grid">
                     <button class="legend-btn is-primary" data-act="complete" ${busy ? 'disabled' : ''}>
                       Completar y avanzar
                     </button>
                     <button class="legend-btn" data-act="back" ${busy ? 'disabled' : ''}>
                       Retroceder
                     </button>
                     <button class="legend-btn is-danger" data-act="reset" ${busy ? 'disabled' : ''}>
                       Reiniciar curso
                     </button>
                   </div>
                   ${note ? `<p class="legend-admin__note">${note}</p>` : ''}
                 </div>`
              : ''
          }
        </div>
      </div>`

    el.querySelector('[data-toggle]').addEventListener('click', () => {
      open = !open
      render()
    })

    el.querySelectorAll('[data-act]').forEach((b) =>
      b.addEventListener('click', async () => {
        const fn = {
          complete: actions.onCompleteHere,
          back: actions.onBack,
          reset: actions.onReset,
        }[b.dataset.act]
        if (!fn) return
        busy = true
        note = 'Guardando…'
        render()
        try {
          const msg = await fn()
          note = msg ?? 'Hecho.'
        } catch (e) {
          note = e?.message ?? 'Error.'
        } finally {
          busy = false
          render()
        }
      })
    )
  }

  render()

  return {
    /** Re-check the token, e.g. after the teacher signs in on /admin. */
    refreshAdmin() {
      const next = hasAdminToken()
      if (next !== admin) {
        admin = next
        render()
      }
    },
  }
}
