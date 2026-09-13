import '../style.css'
import {
  START_MARKER,
  levelById,
  mainSequence,
  markerProgress,
  sessionNumber,
  levelTitle,
} from '../lib/levels.js'
import {
  PROGRESS_PATH,
  readJsonFile,
  readRoster,
  settings,
  writeRoster,
} from '../lib/githubData.js'
import { MAX_NAME, MAX_NPCS, cleanName, makeNpcId } from '../lib/roster.js'
import { rememberSeeAll, seeAllChoice, seeAllLink } from '../lib/teacherView.js'

/**
 * /admin — sign in, and edit the roster of honoured students.
 *
 * WHY THE MARKER CONTROLS ARE NOT HERE AND THE ROSTER IS
 * This page used to be the whole teacher console, marker buttons included. That
 * was the wrong shape: pressing "Avanzar" here moved the marker while you stared
 * at a form, with no avatar walking and no camera following, so the button read
 * as dead. Those controls now live in the **Profesor** block of the legend, on
 * the map, where their effect is the thing you are looking at.
 *
 * The roster is the opposite case and belongs here. It is data entry — type a
 * name, pick a session, repeat — and there is nothing to watch while you type;
 * what you would want to see (a little classmate pacing around the disc) only
 * exists after the file is committed and Pages has rebuilt. A form is the right
 * surface for it, and the "Abrir el mapa" button at the bottom is how you go and
 * look.
 *
 * Edits are STAGED and saved in one go. Every save is a commit and a deploy, so
 * adding five students one commit at a time would be five deploys.
 *
 * The "Ver todo el mapa" card is the third thing here, and it is the only one
 * that works WITHOUT a token. Showing the island to a colleague used to mean
 * either handing them a GitHub token with write access to the repository, or
 * turning `lockAhead` off in `progress.json` — which is the course setting, so
 * it spoils the term for the actual class for as long as the demo lasts, and
 * costs a commit and a Pages deploy in each direction. Neither is a sane price
 * for looking at a map. It is a switch in this browser's localStorage; the
 * repository never hears about it.
 *
 * Token handling, unchanged and deliberate:
 *   - typed here, kept in THIS browser's localStorage only
 *   - never committed, never bundled, never sent anywhere but api.github.com
 *   - the public map never reads it; students only ever GET the two data files
 * A build-time constant carries the public repo slug; that is not a secret.
 */

const root = document.getElementById('admin-root')

/**
 * The sessions a villager actually fits at: every main-path level except the two
 * castles, whose building fills the pad and swallows anyone standing there.
 *
 * This list has to agree with VILLAGER_SESSIONS in main.js and with the roster
 * check in scripts/validate.mjs. Offering a castle here would let the teacher
 * save a roster that FAILS THE BUILD, which takes the whole site down with it
 * until someone edits the file by hand.
 */
const VILLAGER_SESSIONS = mainSequence.filter((l) => l.category !== 'boss')

let state = {
  currentLevelId: null,
  busy: false,
  message: null,
  tone: 'info',
  /** null until a token checks out; an array once the roster has been read. */
  roster: null,
  rosterDirty: false,
  rosterNote: null,
  rosterTone: 'info',
  /** The session a new name is filed under. Defaults to where the class is. */
  levelId: null,
  focusName: false,
  /**
   * Does THIS browser see the sessions ahead? Same key the map reads, so the
   * switch here and the one in the legend are the same switch.
   *
   * An untouched browser falls back to the token, which is the rule the map has
   * always used: whoever runs the course sees the whole course.
   */
  seeAll: seeAllChoice() ?? Boolean(settings.token),
  linkCopied: false,
}

/** Names come from a human and land in `innerHTML` below. */
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  )

/** "Mundo 1-3 · sesión 3" — the same wording the map and the legend use. */
function sessionLabel(level) {
  const n = sessionNumber(level)
  return n ? `Mundo ${n.world}-${n.index} · sesión ${n.global}` : 'Nivel opcional'
}

function say(message, tone = 'info') {
  state.message = message
  state.tone = tone
  render()
}

function sayRoster(note, tone = 'info') {
  state.rosterNote = note
  state.rosterTone = tone
  render()
}

/**
 * Verify the credentials by reading both public files. Read-only: a mistyped
 * token fails here rather than halfway through a change.
 */
async function check() {
  if (!settings.token || !settings.repo) {
    state.currentLevelId = null
    state.roster = null
    render()
    return
  }
  state.busy = true
  render()
  try {
    const { doc } = await readJsonFile(PROGRESS_PATH)
    if (!doc) throw new Error(`No existe ${PROGRESS_PATH} en la rama ${settings.branch}.`)
    state.currentLevelId = doc.currentLevelId ?? START_MARKER
    // Default the picker to where the class is — the teacher is awarding points
    // for today's session — unless today is an exam, which takes no villagers.
    if (!VILLAGER_SESSIONS.some((l) => l.id === state.levelId)) {
      state.levelId = VILLAGER_SESSIONS.some((l) => l.id === state.currentLevelId)
        ? state.currentLevelId
        : VILLAGER_SESSIONS[0]?.id
    }
    // A roster that will not load must not make the token look invalid.
    try {
      state.roster = await readRoster()
      state.rosterDirty = false
      state.rosterNote = null
    } catch (e) {
      state.roster = []
      sayRoster(`No se pudo leer la lista de alumnos: ${e.message}`, 'error')
    }
    say('Token correcto. Los controles del curso ya están activos en el mapa.', 'success')
  } catch (e) {
    state.currentLevelId = null
    state.roster = null
    say(e.message, 'error')
  } finally {
    state.busy = false
    render()
  }
}

// --- roster actions ---------------------------------------------------------

function addStudent(rawName, levelId) {
  const name = cleanName(rawName)
  if (!name) {
    sayRoster('Escribe un nombre o un nickname.', 'error')
    return
  }
  if (!VILLAGER_SESSIONS.some((l) => l.id === levelId)) {
    sayRoster('Elige la sesión junto a la que quieres que pasee.', 'error')
    return
  }
  if (state.roster.length >= MAX_NPCS) {
    sayRoster(
      `La isla admite ${MAX_NPCS} alumnos a la vez. Quita alguno antes de añadir otro.`,
      'error'
    )
    return
  }
  if (state.roster.some((n) => n.name.toLowerCase() === name.toLowerCase() && n.levelId === levelId)) {
    sayRoster(`"${name}" ya pasea por esa sesión.`, 'error')
    return
  }
  state.roster.push({ id: makeNpcId(), name, levelId })
  state.rosterDirty = true
  state.focusName = true
  sayRoster(`"${name}" añadido. Pulsa «Guardar en el mapa» cuando acabes.`, 'info')
}

function removeStudent(id) {
  const gone = state.roster.find((n) => n.id === id)
  state.roster = state.roster.filter((n) => n.id !== id)
  state.rosterDirty = true
  sayRoster(
    gone
      ? `"${gone.name}" quitado. Pulsa «Guardar en el mapa» para confirmarlo.`
      : 'Quitado.',
    'info'
  )
}

async function saveRoster() {
  state.busy = true
  sayRoster('Guardando…', 'info')
  try {
    state.roster = await writeRoster(state.roster)
    state.rosterDirty = false
    sayRoster(
      `Guardado: ${state.roster.length} alumno(s). El mapa se reconstruye en 1–2 min.`,
      'success'
    )
  } catch (e) {
    sayRoster(e.message, 'error')
  } finally {
    state.busy = false
    render()
  }
}

// --- render -----------------------------------------------------------------

function signInCard() {
  const current = state.currentLevelId ? levelById(state.currentLevelId) : null
  const { index, total } = markerProgress(state.currentLevelId)
  const tone =
    state.tone === 'error' ? 'alert-error' : state.tone === 'success' ? 'alert-success' : ''

  return `
    <div class="admin-card pixel-panel rounded-xl bg-base-100 p-5 w-full">
      <h2 class="text-xl font-bold">Acceso con token de GitHub</h2>
      <p class="opacity-70 text-sm mt-1 mb-4">
        Solo hace falta para <strong>mover el curso</strong> y para editar la lista de
        alumnos. Para mirar el mapa entero no lo necesitas: eso es el interruptor de
        arriba. Los controles del curso (avanzar, retroceder, reiniciar) están en el
        bloque <strong>Profesor</strong> de la leyenda, dentro del mapa.
      </p>

      <label class="form-control mb-3 block">
        <span class="label-text text-sm">Repositorio (owner/repo)</span>
        <input id="repo" type="text" class="input input-bordered input-sm w-full"
               value="${esc(settings.repo)}" placeholder="optus23/Island-Class-XR" />
      </label>

      <label class="form-control mb-3 block">
        <span class="label-text text-sm">Rama publicada</span>
        <input id="branch" type="text" class="input input-bordered input-sm w-full"
               value="${esc(settings.branch)}" placeholder="main" />
      </label>

      <label class="form-control mb-2 block">
        <span class="label-text text-sm">GitHub token (Contents: Read and write)</span>
        <input id="token" type="password" class="input input-bordered input-sm w-full"
               value="${esc(settings.token)}" placeholder="Pega aquí tu token"
               autocomplete="off" spellcheck="false" />
      </label>

      <p class="text-xs opacity-60 mb-4">
        Se guarda solo en el localStorage de este navegador. No se sube al repositorio,
        no entra en el build y los estudiantes nunca lo ven.
      </p>

      <div class="flex flex-wrap gap-2 mb-4">
        <button id="save" class="btn btn-primary btn-sm" ${state.busy ? 'disabled' : ''}>
          ${state.busy ? '…' : 'Guardar y comprobar'}
        </button>
        <button id="forget" class="btn btn-ghost btn-sm text-error">Olvidar token</button>
      </div>

      ${
        state.message
          ? `<div class="alert ${tone} mb-4 text-sm"><span>${esc(state.message)}</span></div>`
          : ''
      }

      ${
        current
          ? `<div class="rounded-lg bg-base-200 p-3 mb-4 text-sm">
               <p class="text-[10px] uppercase tracking-[0.15em] opacity-55 mb-1">
                 La clase está en
               </p>
               <p class="font-semibold">${esc(current.title)}</p>
               <p class="opacity-70">${esc(sessionLabel(current))}</p>
               <progress class="progress progress-success w-full mt-2 h-2"
                         value="${index}" max="${Math.max(1, total - 1)}"></progress>
             </div>`
          : ''
      }

      <a class="btn btn-block btn-sm ${current ? 'btn-success' : 'btn-outline'}"
         href="${import.meta.env.BASE_URL}">
        ${current ? 'Abrir el mapa →' : 'Volver al mapa'}
      </a>
    </div>`
}

/**
 * "Ver todo el mapa" — the only card on this page that needs no token.
 *
 * It writes one key in this browser's localStorage, which the map reads on boot.
 * Nothing is committed and nothing is deployed, so it cannot spoil the course
 * for the class the way turning the course-wide lock off would.
 */
function viewCard() {
  const shareable = seeAllLink(true)

  return `
    <div class="admin-card pixel-panel rounded-xl bg-base-100 p-5 w-full">
      <h1 class="text-xl font-bold">Panel de profesor</h1>
      <h2 class="text-sm font-bold uppercase tracking-[0.14em] opacity-55 mt-4 mb-1">
        Ver todo el mapa
      </h2>
      <p class="opacity-70 text-sm mb-4">
        Mientras el curso tenga ocultas las sesiones futuras, los alumnos ven en gris
        todo lo que queda por delante y sin el título. Este interruptor te salta esa
        regla <strong>solo en este navegador</strong>, y no hace falta ningún token.
      </p>

      <label class="flex items-start gap-3 cursor-pointer rounded-lg bg-base-200 p-3 mb-3">
        <input id="see-all" type="checkbox" class="toggle toggle-success mt-0.5"
               ${state.seeAll ? 'checked' : ''} />
        <span class="text-sm">
          <strong class="block">
            ${state.seeAll ? 'Vista de profesor: se ve todo' : 'Vista de alumno: sesiones futuras ocultas'}
          </strong>
          <span class="opacity-70">
            Cámbialo cuando quieras. También está en el bloque «Profesor» de la leyenda,
            dentro del mapa.
          </span>
        </span>
      </label>

      <div class="alert alert-info text-xs mb-3">
        <span>
          No cambia nada para la clase: la regla del curso sigue como está y esto no
          escribe en el repositorio. Es una preferencia de este navegador, y se borra
          si borras los datos del sitio.
        </span>
      </div>

      <p class="label-text text-sm mb-1">Enlace para abrirlo así en otro navegador</p>
      <div class="join w-full mb-1">
        <input id="see-all-link" type="text" readonly value="${esc(shareable)}"
               class="input input-bordered input-sm join-item flex-1 text-xs" />
        <button id="see-all-copy" class="btn btn-sm join-item">
          ${state.linkCopied ? '✓' : 'Copiar'}
        </button>
      </div>
      <p class="text-xs opacity-55 mb-4">
        Ábrelo una vez y ese navegador queda en vista de profesor. Es una preferencia
        local, así que no se lo des a los alumnos.
      </p>

      <a class="btn btn-block btn-sm btn-outline" href="${import.meta.env.BASE_URL}">
        Abrir el mapa →
      </a>
    </div>`
}

/**
 * The roster editor. Only rendered once a token has checked out — without one
 * there is nothing to save to, and an editor that cannot commit is a trap.
 */
function rosterCard() {
  if (!state.roster) return ''

  const options = VILLAGER_SESSIONS
    .map(
      (l) =>
        `<option value="${esc(l.id)}" ${l.id === state.levelId ? 'selected' : ''}>
           ${esc(sessionLabel(l))} — ${esc(l.title)}
         </option>`
    )
    .join('')

  // Grouped by session, in map order, so the list reads the way the island does.
  const order = new Map(VILLAGER_SESSIONS.map((l, i) => [l.id, i]))
  const rows = [...state.roster]
    .sort((a, b) => (order.get(a.levelId) ?? 99) - (order.get(b.levelId) ?? 99))
    .map((n) => {
      const level = levelById(n.levelId)
      return `
        <li class="flex items-center gap-2 rounded-lg bg-base-200 px-3 py-2">
          <span class="flex-1 min-w-0">
            <span class="font-semibold block truncate">${esc(n.name)}</span>
            <span class="text-xs opacity-60 block truncate">
              ${esc(level ? sessionLabel(level) : n.levelId)}${level ? ` — ${esc(levelTitle(level))}` : ''}
            </span>
          </span>
          <button class="btn btn-ghost btn-xs text-error shrink-0"
                  data-remove="${esc(n.id)}" aria-label="Quitar a ${esc(n.name)}"
                  ${state.busy ? 'disabled' : ''}>✕</button>
        </li>`
    })
    .join('')

  const tone =
    state.rosterTone === 'error'
      ? 'alert-error'
      : state.rosterTone === 'success'
        ? 'alert-success'
        : ''

  return `
    <div class="admin-card pixel-panel rounded-xl bg-base-100 p-5 w-full">
      <h2 class="text-xl font-bold">Alumnos en la isla</h2>
      <p class="opacity-70 text-sm mt-1 mb-4">
        Cada nombre aparece como un personaje que pasea muy despacio alrededor de la
        sesión que elijas, con su nombre sobre la cabeza. Es solo decoración: no se
        puede pulsar y no cambia nada del curso.
      </p>

      <div class="alert alert-warning text-xs mb-4">
        <span>
          <strong>Este repositorio es público.</strong> Cualquiera puede leer
          <code>public/npcs.json</code>, así que usa un <strong>nickname</strong> o
          nombre + inicial, no el nombre completo de un menor ni ningún otro dato.
          Aquí no van notas, ni puntos, ni correos.
        </span>
      </div>

      <div class="flex flex-col gap-2 mb-3">
        <label class="form-control block">
          <span class="label-text text-sm">Nombre o nickname</span>
          <input id="npc-name" type="text" class="input input-bordered input-sm w-full"
                 maxlength="${MAX_NAME}" placeholder="p. ej. Ada L."
                 autocomplete="off" spellcheck="false" />
        </label>
        <label class="form-control block">
          <span class="label-text text-sm">Sesión junto a la que pasea</span>
          <select id="npc-level" class="select select-bordered select-sm w-full">${options}</select>
        </label>
        <button id="npc-add" class="btn btn-primary btn-sm self-start"
                ${state.busy ? 'disabled' : ''}>Añadir</button>
      </div>

      ${
        rows
          ? `<ul class="flex flex-col gap-2 mb-3">${rows}</ul>`
          : `<p class="text-sm opacity-60 mb-3">
               Todavía no pasea nadie por la isla.
             </p>`
      }

      <p class="text-xs opacity-55 mb-3">
        ${state.roster.length} de ${MAX_NPCS} plazas.
        ${state.rosterDirty ? '<strong class="text-warning">Hay cambios sin guardar.</strong>' : ''}
      </p>

      ${
        state.rosterNote
          ? `<div class="alert ${tone} mb-3 text-sm"><span>${esc(state.rosterNote)}</span></div>`
          : ''
      }

      <button id="npc-save"
              class="btn btn-block btn-sm ${state.rosterDirty ? 'btn-warning' : 'btn-outline'}"
              ${state.busy || !state.rosterDirty ? 'disabled' : ''}>
        ${state.busy ? '…' : 'Guardar en el mapa'}
      </button>
    </div>`
}

function render() {
  // A column, not `place-items: center`. The page can now be taller than the
  // viewport, and centring an item that overflows falls back to start alignment
  // in one axis and clips in the other — the trap that cost this project three
  // rounds on the level portal.
  root.innerHTML = `
    <main class="min-h-screen flex flex-col items-center gap-4 p-4 py-6">
      <div class="w-full max-w-md flex flex-col gap-4">
        ${viewCard()}
        ${signInCard()}
        ${rosterCard()}
      </div>
    </main>`

  const el = (id) => root.querySelector('#' + id)

  el('save').addEventListener('click', () => {
    settings.repo = el('repo').value.trim()
    settings.branch = el('branch').value.trim() || 'main'
    settings.token = el('token').value.trim()
    check()
  })
  el('forget').addEventListener('click', () => {
    settings.token = ''
    state.currentLevelId = null
    state.roster = null
    say('Token borrado de este navegador. Los controles del mapa se ocultan.', 'info')
  })

  // The view switch. Instant and local — no request, no commit, no deploy —
  // which is the whole point of it existing next to the token form rather than
  // being another thing the token unlocks.
  el('see-all').addEventListener('change', (e) => {
    state.seeAll = e.target.checked
    state.linkCopied = false
    rememberSeeAll(state.seeAll)
    render()
  })
  const linkInput = el('see-all-link')
  linkInput.addEventListener('focus', () => linkInput.select())
  el('see-all-copy').addEventListener('click', async () => {
    const input = linkInput
    try {
      await navigator.clipboard.writeText(input.value)
      state.linkCopied = true
      render()
    } catch {
      // No clipboard permission (or an insecure context). Selecting the text is
      // the fallback that works everywhere, and it is what the user would do.
      input.select()
    }
  })

  if (!state.roster) return

  const nameInput = el('npc-name')
  const levelSelect = el('npc-level')

  // Remembered without a re-render, so the picker keeps its place while several
  // students from the same class are typed in one after another.
  levelSelect.addEventListener('change', () => {
    state.levelId = levelSelect.value
  })

  const submit = () => {
    addStudent(nameInput.value, levelSelect.value)
  }
  el('npc-add').addEventListener('click', submit)
  nameInput.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    submit()
  })

  root.querySelectorAll('[data-remove]').forEach((b) =>
    b.addEventListener('click', () => removeStudent(b.dataset.remove))
  )
  el('npc-save').addEventListener('click', saveRoster)

  // Straight back to the name field after an add, so a list of students is typed
  // without reaching for the mouse between each one.
  if (state.focusName) {
    state.focusName = false
    nameInput.focus()
  }
}

render()
if (settings.token && settings.repo) check()
