import { cssPalette } from '../config/theme.js'
import { locksActive } from '../lib/levels.js'
import { seeAllChoice } from '../lib/teacherView.js'
import { t } from '../lib/i18n/index.js'

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
 * ONE EXCEPTION, and it is deliberate: a browser that has been given the
 * token-free "ver todo el mapa" exemption (from /admin, or from `?ver=todo`)
 * gets a stripped-down version of this block carrying only the switch that
 * turns it back off. Without that there is no way out of the teacher's view
 * from the map itself, and the person being shown the island is exactly the
 * person who does not know that /admin exists. Nothing that writes to the
 * repository is in it — no marker buttons, no course-wide lock switch — because
 * none of that works without a token anyway.
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
const ROW_KEYS = ['completed', 'theory', 'practical', 'project', 'boss', 'optional']

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
    const rows = (locksActive() ? [...ROW_KEYS, 'locked'] : ROW_KEYS).map((key) => [
      key,
      t(`legend.row.${key}`),
    ])

    // Who gets the Profesor block: a token holder, or a browser that has been
    // handed the token-free view. `seeAllChoice()` and not `actions.seeAll()`,
    // because the moment they tick "ver como alumno" the second one goes false —
    // and a block that removes itself takes the way back with it.
    const teacher = admin || seeAllChoice() !== null

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
          <span>${t('legend.title')}</span>
          <span class="legend-head__chev">${open ? '▾' : '▸'}</span>
        </button>

        <div class="${open ? '' : 'is-collapsed'}">
          <button class="legend-btn legend-map ${overview ? 'is-primary' : ''}" data-act="overview">
            ${overview ? t('legend.backToCharacter') : t('legend.fullMap')}
            <kbd>M</kbd>
          </button>
          <ul class="legend-list">${swatches}</ul>

          ${
            teacher
              ? `<div class="legend-admin">
                   <p class="legend-admin__title">${t('legend.teacher')}</p>
                   ${
                     admin && marker
                       ? `<div class="legend-admin__marker">
                            <span class="legend-admin__marker-label">${t('legend.classIsAt')}</span>
                            <strong>${marker.title}</strong>
                            <span class="legend-admin__marker-sub">${marker.label}</span>
                          </div>`
                       : ''
                   }
                   ${
                     admin
                       ? `<div class="legend-admin__grid">
                            <button class="legend-btn is-primary" data-act="complete" ${busy ? 'disabled' : ''}>
                              ${t('legend.completeAdvance')}
                            </button>
                            <button class="legend-btn" data-act="back" ${busy ? 'disabled' : ''}>
                              ${t('legend.back')}
                            </button>
                            <button class="legend-btn is-danger" data-act="reset" ${busy ? 'disabled' : ''}>
                              ${t('legend.reset')}
                            </button>
                          </div>`
                       : ''
                   }
                   <a class="legend-btn legend-admin__link"
                      href="${import.meta.env.BASE_URL}admin/">
                     ${admin ? t('legend.adminLinkFull') : t('legend.adminLink')}
                   </a>
                   ${
                     admin
                       ? `<label class="legend-switch">
                            <input type="checkbox" data-switch="lock"
                                   ${actions.lockAhead?.() ? 'checked' : ''} ${busy ? 'disabled' : ''} />
                            <span>${t('legend.hideFuture')}</span>
                          </label>`
                       : ''
                   }
                   <label class="legend-switch ${actions.lockAhead?.() ? '' : 'is-muted'}">
                     <input type="checkbox" data-switch="student"
                            ${actions.seeAll?.() ? '' : 'checked'}
                            ${actions.lockAhead?.() ? '' : 'disabled'} />
                     <span>${t('legend.seeAsStudent')}</span>
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
        note = t('legend.saving')
        render()
        try {
          note = await actions.onToggleLock?.(input.checked)
        } catch (e) {
          note = e?.message ?? t('legend.error')
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
        note = t('legend.saving')
        render()
        try {
          const msg = await fn()
          note = msg ?? t('legend.done')
        } catch (e) {
          note = e?.message ?? t('legend.error')
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
