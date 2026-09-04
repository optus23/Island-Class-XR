import '../style.css'
import { START_MARKER, levelById, markerProgress, sessionNumber } from '../lib/levels.js'

/**
 * /admin — SIGN IN, and nothing else.
 *
 * This page used to be the whole teacher console: a full-screen form plus the
 * marker controls. That was the wrong shape. Pressing "Avanzar" here moved the
 * marker but you were staring at a form, so there was no way to see the avatar
 * walk or the camera follow — the button appeared to do nothing.
 *
 * So the controls moved to where their effect is visible: the **Profesor**
 * block of the legend, on the map itself. It unlocks as soon as a token is
 * present in this browser. All this page does now is put one there, confirm it
 * works, and send you to the map.
 *
 * Token handling, unchanged and deliberate:
 *   - typed here, kept in THIS browser's localStorage only
 *   - never committed, never bundled, never sent anywhere but api.github.com
 *   - the public map never reads it; students only ever GET progress.json
 * A build-time constant carries the public repo slug; that is not a secret.
 */

const TOKEN_KEY = 'xrisland:gh-token'
const REPO_KEY = 'xrisland:gh-repo'
const BRANCH_KEY = 'xrisland:gh-branch'
const FILE_PATH = 'public/progress.json'

// eslint-disable-next-line no-undef
const BUILD_REPO = typeof __REPO_SLUG__ === 'string' ? __REPO_SLUG__ : ''

const get = (k, fallback = '') => {
  try {
    return localStorage.getItem(k) || fallback
  } catch {
    return fallback
  }
}
const set = (k, v) => {
  try {
    v ? localStorage.setItem(k, v) : localStorage.removeItem(k)
  } catch {
    /* storage disabled */
  }
}

const store = {
  get token() {
    return get(TOKEN_KEY)
  },
  set token(v) {
    set(TOKEN_KEY, v)
  },
  get repo() {
    return get(REPO_KEY, BUILD_REPO)
  },
  set repo(v) {
    set(REPO_KEY, v)
  },
  get branch() {
    return get(BRANCH_KEY, 'main')
  },
  set branch(v) {
    set(BRANCH_KEY, v)
  },
}

const root = document.getElementById('admin-root')
let state = { currentLevelId: null, busy: false, message: null, tone: 'info' }

const decodeBase64 = (b64) =>
  new TextDecoder().decode(
    Uint8Array.from(atob(b64.replace(/\s/g, '')), (c) => c.charCodeAt(0))
  )

function say(message, tone = 'info') {
  state.message = message
  state.tone = tone
  render()
}

/**
 * Verify the credentials by reading the marker. Read-only: this page never
 * writes, so a mistyped token fails here rather than halfway through a change.
 */
async function check() {
  if (!store.token || !store.repo) {
    state.currentLevelId = null
    render()
    return
  }
  state.busy = true
  render()
  try {
    const res = await fetch(
      `https://api.github.com/repos/${store.repo}/contents/${FILE_PATH}` +
        `?ref=${encodeURIComponent(store.branch)}`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          Authorization: `Bearer ${store.token}`,
        },
      }
    )
    if (res.status === 401) throw new Error('Token no válido o caducado.')
    if (res.status === 403)
      throw new Error('El token no tiene permiso "Contents: Read and write".')
    if (res.status === 404)
      throw new Error(`No existe ${FILE_PATH} en la rama ${store.branch} de ${store.repo}.`)
    if (!res.ok) throw new Error(`GitHub respondió ${res.status}.`)

    const data = await res.json()
    state.currentLevelId = JSON.parse(decodeBase64(data.content)).currentLevelId ?? START_MARKER
    say('Token correcto. Los controles ya están activos en el mapa.', 'success')
  } catch (e) {
    state.currentLevelId = null
    say(e.message, 'error')
  } finally {
    state.busy = false
    render()
  }
}

function render() {
  const current = state.currentLevelId ? levelById(state.currentLevelId) : null
  const n = current ? sessionNumber(current) : null
  const { index, total } = markerProgress(state.currentLevelId)
  const tone =
    state.tone === 'error' ? 'alert-error' : state.tone === 'success' ? 'alert-success' : ''

  root.innerHTML = `
    <main class="min-h-screen grid place-items-center p-4">
      <div class="admin-card pixel-panel rounded-xl bg-base-100 p-5 w-full max-w-md">
        <h1 class="text-xl font-bold">Acceso de profesor</h1>
        <p class="opacity-70 text-sm mt-1 mb-4">
          Solo el acceso. Los controles del curso están en el bloque
          <strong>Profesor</strong> de la leyenda, dentro del mapa.
        </p>

        <label class="form-control mb-3 block">
          <span class="label-text text-sm">Repositorio (owner/repo)</span>
          <input id="repo" type="text" class="input input-bordered input-sm w-full"
                 value="${store.repo}" placeholder="optus23/Island-Class-XR" />
        </label>

        <label class="form-control mb-3 block">
          <span class="label-text text-sm">Rama publicada</span>
          <input id="branch" type="text" class="input input-bordered input-sm w-full"
                 value="${store.branch}" placeholder="main" />
        </label>

        <label class="form-control mb-2 block">
          <span class="label-text text-sm">GitHub token (Contents: Read and write)</span>
          <input id="token" type="password" class="input input-bordered input-sm w-full"
                 value="${store.token}" placeholder="Pega aquí tu token"
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
            ? `<div class="alert ${tone} mb-4 text-sm"><span>${state.message}</span></div>`
            : ''
        }

        ${
          current
            ? `<div class="rounded-lg bg-base-200 p-3 mb-4 text-sm">
                 <p class="text-[10px] uppercase tracking-[0.15em] opacity-55 mb-1">
                   La clase está en
                 </p>
                 <p class="font-semibold">${current.title}</p>
                 <p class="opacity-70">
                   ${n ? `Mundo ${n.world}-${n.index} · sesión ${n.global} de ${n.total}` : 'Nivel opcional'}
                 </p>
                 <progress class="progress progress-success w-full mt-2 h-2"
                           value="${index}" max="${Math.max(1, total - 1)}"></progress>
               </div>`
            : ''
        }

        <a class="btn btn-block btn-sm ${current ? 'btn-success' : 'btn-outline'}"
           href="${import.meta.env.BASE_URL}">
          ${current ? 'Abrir el mapa →' : 'Volver al mapa'}
        </a>
      </div>
    </main>`

  const el = (id) => root.querySelector('#' + id)

  el('save').addEventListener('click', () => {
    store.repo = el('repo').value.trim()
    store.branch = el('branch').value.trim() || 'main'
    store.token = el('token').value.trim()
    check()
  })
  el('forget').addEventListener('click', () => {
    store.token = ''
    state.currentLevelId = null
    say('Token borrado de este navegador. Los controles del mapa se ocultan.', 'info')
  })
}

render()
if (store.token && store.repo) check()
