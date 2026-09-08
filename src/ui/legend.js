import { cssPalette } from '../config/theme.js'
import { locksActive } from '../lib/levels.js'

/**
 * Bottom-right colour key, plus the teacher's controls.
 *
 * This is now the ONLY place the marker is moved from. /admin is just where a
 * token is entered; the controls live here because here is where their effect
 * is visible — press "Completar y avanzar" and you watch the avatar walk and
 * the camera follow. On the old full-screen admin page the same button moved
 * the marker with nothing on screen to show for it, which read as a dead
 * button.
 *
 * The block only appears when an admin token is present in THIS browser's
 * localStorage. Students never see it, and it is not a second source of truth:
 * every button writes through the same progress marker.
 *
 * It also carries the ONLY link to /admin. The teacher who has a token in this
 * browser has no other way of finding that page — the marker controls being
 * here is exactly what makes it invisible, and the round that added the roster
 * of honoured students put a second thing on /admin that nobody could reach.
 * Students never see the link, because they never see this block.
 */

const ADMIN_TOKEN_KEY = 'xrisland:gh-token'

// eslint-disable-next-line no-undef
const BUILD_ID = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev'

// Same order as resolveNodeColor resolves them, so the legend reads as the
// rule it describes rather than as an arbitrary list.
const ROWS = [
  ['completed', 'Completado'],
  ['theory', 'Teoría'],
  ['practical', 'Práctica'],
  ['project', 'Proyecto en equipo'],
  ['boss', 'Examen'],
  ['optional', 'Actitud / extra'], // voluntary activities and the re-evaluation
]

export function hasAdminToken() {
  try {
    return Boolean(localStorage.getItem(ADMIN_TOKEN_KEY))
  } catch {
    return false
  }
}

/**
 * @param {{onAdvance:Function, onBack:Function, onReset:Function,
 *   onCompleteHere:Function, onToggleLock:Function, onToggleSeeAll:Function,
 *   lockAhead:Function, seeAll:Function}} actions
 */
export function mountLegend(actions = {}) {
  const el = document.createElement('div')
  el.className = 'legend-panel'
  document.getElementById('ui').appendChild(el)

  // Collapsed where screen space is scarce; the map is the point.
  let open = window.innerWidth >= 900
  let admin = hasAdminToken()
  let overview = false
  let busy = false
  let note = ''
  /** {title, label} of the level the marker is on — the old "Posición actual". */
  let marker = null

  function render() {
    // "Bloqueado" only appears when there is something grey on the map to
    // explain. Listing it to a class that can see everything just invents a
    // rule they are not subject to.
    const rows = locksActive() ? [...ROWS, ['locked', 'Aún no disponible']] : ROWS
    const swatches = rows.map(
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
          <button class="legend-btn legend-map ${overview ? 'is-primary' : ''}" data-act="overview">
            ${overview ? 'Volver al personaje' : 'Mapa completo (vista cenital)'}
            <kbd>M</kbd>
          </button>
          <ul class="legend-list">${swatches}</ul>

          ${
            admin
              ? `<div class="legend-admin">
                   <p class="legend-admin__title">Profesor</p>
                   ${
                     marker
                       ? `<div class="legend-admin__marker">
                            <span class="legend-admin__marker-label">La clase está en</span>
                            <strong>${marker.title}</strong>
                            <span class="legend-admin__marker-sub">${marker.label}</span>
                          </div>`
                       : ''
                   }
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
                   <a class="legend-btn legend-admin__link"
                      href="${import.meta.env.BASE_URL}admin/">
                     Panel de profesor · alumnos y token →
                   </a>
                   <label class="legend-switch">
                     <input type="checkbox" data-switch="lock"
                            ${actions.lockAhead?.() ? 'checked' : ''} ${busy ? 'disabled' : ''} />
                     <span>Ocultar las sesiones futuras</span>
                   </label>
                   <label class="legend-switch ${actions.lockAhead?.() ? '' : 'is-muted'}">
                     <input type="checkbox" data-switch="student"
                            ${actions.seeAll?.() ? '' : 'checked'}
                            ${actions.lockAhead?.() ? '' : 'disabled'} />
                     <span>Ver el mapa como un alumno</span>
                   </label>
                   ${note ? `<p class="legend-admin__note">${note}</p>` : ''}
                 </div>`
              : ''
          }

          <!-- Which build this is. A phone holding a cached index.html loads
               the old hashed bundle, which still works — so a fix can be live
               and invisible. This makes that answerable in one glance. -->
          <p class="legend-build">build ${BUILD_ID}</p>
        </div>
      </div>`

    el.querySelector('[data-toggle]').addEventListener('click', () => {
      open = !open
      render()
    })

    // The two switches. `lock` is the COURSE setting and writes to
    // progress.json; `student` is local to this browser and only decides
    // whether this teacher's own exemption applies — so one is async and the
    // other is instant, and they must not be confused for each other.
    el.querySelectorAll('[data-switch]').forEach((input) =>
      input.addEventListener('change', async () => {
        if (input.dataset.switch === 'student') {
          actions.onToggleSeeAll?.(!input.checked)
          render()
          return
        }
        busy = true
        note = 'Guardando…'
        render()
        try {
          note = await actions.onToggleLock?.(input.checked)
        } catch (e) {
          note = e?.message ?? 'Error.'
        } finally {
          busy = false
          render()
        }
      })
    )

    el.querySelectorAll('[data-act]').forEach((b) =>
      b.addEventListener('click', async () => {
        if (b.dataset.act === 'overview') {
          actions.onToggleOverview?.()
          return
        }
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
    setOverview(on) {
      overview = on
      render()
    },
    /** Where the marker is, for the readout above the buttons. */
    setMarker(info) {
      marker = info
      if (admin) render()
    },
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
