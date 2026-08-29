import '../style.css'
import { mainSequence, START_MARKER, nextMarker, levelById, markerProgress } from '../lib/levels.js'

/**
 * Manual progress marker — the ONE explicit exception to "no dates" in this
 * project. Nothing here is automated by clock or calendar: the marker moves
 * only when a human presses a button.
 *
 * Token handling, deliberately:
 *   - the token is typed here and kept in THIS browser's localStorage only
 *   - it is never committed, never bundled, never sent anywhere but api.github.com
 *   - the public map never reads it; students only ever GET progress.json
 * A build-time constant carries the public repo slug; that is not a secret.
 */

const TOKEN_KEY = 'xrisland:gh-token'
const REPO_KEY = 'xrisland:gh-repo'
const BRANCH_KEY = 'xrisland:gh-branch'
const FILE_PATH = 'public/progress.json'

// eslint-disable-next-line no-undef
const BUILD_REPO = typeof __REPO_SLUG__ === 'string' ? __REPO_SLUG__ : ''

const store = {
  get token() {
    try {
      return localStorage.getItem(TOKEN_KEY) ?? ''
    } catch {
      return ''
    }
  },
  set token(v) {
    try {
      v ? localStorage.setItem(TOKEN_KEY, v) : localStorage.removeItem(TOKEN_KEY)
    } catch {
      /* storage disabled */
    }
  },
  get repo() {
    try {
      return localStorage.getItem(REPO_KEY) || BUILD_REPO
    } catch {
      return BUILD_REPO
    }
  },
  set repo(v) {
    try {
      localStorage.setItem(REPO_KEY, v)
    } catch {
      /* storage disabled */
    }
  },
  get branch() {
    try {
      return localStorage.getItem(BRANCH_KEY) || 'main'
    } catch {
      return 'main'
    }
  },
  set branch(v) {
    try {
      localStorage.setItem(BRANCH_KEY, v)
    } catch {
      /* storage disabled */
    }
  },
}

const root = document.getElementById('admin-root')
let state = { sha: null, currentLevelId: null, busy: false, message: null, tone: 'info' }

const encodeBase64 = (text) => {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

const decodeBase64 = (b64) => {
  const binary = atob(b64.replace(/\s/g, ''))
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

function api(path, options = {}) {
  return fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      Authorization: `Bearer ${store.token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  })
}

function say(message, tone = 'info') {
  state.message = message
  state.tone = tone
  render()
}

async function loadCurrent() {
  if (!store.token || !store.repo) {
    state.currentLevelId = null
    render()
    return
  }
  state.busy = true
  render()
  try {
    const res = await api(
      `/repos/${store.repo}/contents/${FILE_PATH}?ref=${encodeURIComponent(store.branch)}`
    )
    if (res.status === 401) throw new Error('Token no válido o caducado.')
    if (res.status === 403) throw new Error('El token no tiene permiso "Contents: Read and write".')
    if (res.status === 404) {
      throw new Error(`No existe ${FILE_PATH} en la rama ${store.branch} de ${store.repo}.`)
    }
    if (!res.ok) throw new Error(`GitHub respondió ${res.status}.`)

    const data = await res.json()
    state.sha = data.sha
    const parsed = JSON.parse(decodeBase64(data.content))
    state.currentLevelId = parsed.currentLevelId ?? START_MARKER
    say(`Leído desde ${store.repo}@${store.branch}.`, 'success')
  } catch (e) {
    state.currentLevelId = null
    say(e.message, 'error')
  } finally {
    state.busy = false
    render()
  }
}

async function write(nextId, label) {
  if (state.busy) return
  state.busy = true
  render()
  try {
    const body = {
      message: `chore(progress): ${label} → ${nextId}`,
      content: encodeBase64(
        JSON.stringify(
          {
            currentLevelId: nextId,
            note: 'Moved only by the /admin panel. Students read this; they never write it.',
          },
          null,
          2
        ) + '\n'
      ),
      branch: store.branch,
      ...(state.sha ? { sha: state.sha } : {}),
    }
    const res = await api(`/repos/${store.repo}/contents/${FILE_PATH}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    })
    if (res.status === 409) {
      throw new Error('Conflicto: alguien cambió el archivo. Pulsa "Releer" y repite.')
    }
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}))
      throw new Error(detail.message ?? `GitHub respondió ${res.status}.`)
    }
    const data = await res.json()
    state.sha = data.content.sha
    state.currentLevelId = nextId
    say(
      `${label} correcto. GitHub Actions reconstruirá el sitio en 1–2 minutos.`,
      'success'
    )
  } catch (e) {
    say(e.message, 'error')
  } finally {
    state.busy = false
    render()
  }
}

function render() {
  const current = state.currentLevelId ? levelById(state.currentLevelId) : null
  const { index, total } = markerProgress(state.currentLevelId)
  const upcoming = state.currentLevelId ? levelById(nextMarker(state.currentLevelId)) : null
  const atEnd = current && upcoming && upcoming.id === current.id

  const toneClass =
    state.tone === 'error' ? 'alert-error' : state.tone === 'success' ? 'alert-success' : ''

  root.innerHTML = `
    <main class="min-h-screen p-6 flex justify-center">
      <div class="w-full max-w-2xl">
        <header class="mb-6">
          <h1 class="text-3xl font-bold">XR Island — panel de progreso</h1>
          <p class="opacity-70 mt-1">
            Mueve el marcador que ven los estudiantes. Manual y explícito: nunca por fecha.
          </p>
        </header>

        <section class="pixel-panel rounded-xl bg-base-100 p-5 mb-5">
          <h2 class="font-bold mb-3">Acceso</h2>

          <label class="form-control mb-3 block">
            <span class="label-text text-sm">Repositorio (owner/repo)</span>
            <input id="repo" type="text" class="input input-bordered w-full"
                   value="${store.repo}" placeholder="optus23/Island-Class-XR" />
          </label>

          <label class="form-control mb-3 block">
            <span class="label-text text-sm">Rama publicada</span>
            <input id="branch" type="text" class="input input-bordered w-full"
                   value="${store.branch}" placeholder="main" />
          </label>

          <label class="form-control mb-2 block">
            <span class="label-text text-sm">GitHub token (Contents: Read and write)</span>
            <input id="token" type="password" class="input input-bordered w-full"
                   value="${store.token}" placeholder="Pega aquí tu token"
                   autocomplete="off" spellcheck="false" />
          </label>

          <p class="text-xs opacity-60 mb-4">
            El token se guarda solo en el localStorage de este navegador. No se sube al
            repositorio, no entra en el build y los estudiantes nunca lo ven. Usa un token
            con acceso únicamente a este repositorio.
          </p>

          <div class="flex flex-wrap gap-2">
            <button id="save" class="btn btn-primary btn-sm">Guardar y releer</button>
            <button id="reload" class="btn btn-ghost btn-sm" ${store.token ? '' : 'disabled'}>
              Releer
            </button>
            <button id="forget" class="btn btn-ghost btn-sm text-error">Olvidar token</button>
          </div>
        </section>

        ${
          state.message
            ? `<div class="alert ${toneClass} mb-5 text-sm"><span>${state.message}</span></div>`
            : ''
        }

        <section class="pixel-panel rounded-xl bg-base-100 p-5">
          <h2 class="font-bold mb-3">Posición actual</h2>

          ${
            current
              ? `
            <div class="mb-4">
              <p class="text-2xl font-bold leading-tight">${current.title}</p>
              <p class="opacity-70 text-sm mt-1">
                Mundo ${current.world} · ${current.stage} · nivel ${index + 1} de ${total}
              </p>
              <progress class="progress progress-success w-full mt-3 h-2"
                        value="${index}" max="${Math.max(1, total - 1)}"></progress>
            </div>
            <p class="text-sm opacity-70 mb-4">
              ${atEnd ? 'Es el último nivel del curso.' : `Siguiente: <strong>${upcoming.title}</strong>`}
            </p>`
              : `<p class="opacity-70 mb-4">
                   Introduce el repositorio y el token para leer la posición actual.
                 </p>`
          }

          <div class="flex flex-wrap gap-2">
            <button id="advance" class="btn btn-success"
                    ${!current || state.busy || atEnd ? 'disabled' : ''}>
              ${state.busy ? '…' : 'Avanzar'}
            </button>
            <button id="reset" class="btn btn-outline btn-warning"
                    ${!current || state.busy ? 'disabled' : ''}>
              Reiniciar al inicio
            </button>
          </div>
          <p class="text-xs opacity-60 mt-3">
            Cada pulsación escribe <code>${FILE_PATH}</code> en
            <code>${store.repo || 'owner/repo'}@${store.branch}</code> y dispara el
            despliegue. El mapa público lo lee en modo solo lectura.
          </p>
        </section>
      </div>
    </main>`

  const el = (id) => root.querySelector('#' + id)

  el('save').addEventListener('click', () => {
    store.repo = el('repo').value.trim()
    store.branch = el('branch').value.trim() || 'main'
    store.token = el('token').value.trim()
    loadCurrent()
  })
  el('reload').addEventListener('click', loadCurrent)
  el('forget').addEventListener('click', () => {
    store.token = ''
    state.currentLevelId = null
    state.sha = null
    say('Token borrado de este navegador.', 'info')
  })
  el('advance')?.addEventListener('click', () =>
    write(nextMarker(state.currentLevelId), 'Avance')
  )
  el('reset')?.addEventListener('click', () => {
    if (confirm('¿Devolver el marcador al primer nivel del curso?')) {
      write(START_MARKER, 'Reinicio')
    }
  })
}

render()
if (store.token && store.repo) loadCurrent()

// Sanity: the sequence the admin walks must match the one the map draws.
if (import.meta.env.DEV) {
  console.info(`[admin] ${mainSequence.length} main-path levels, start = ${START_MARKER}`)
}
