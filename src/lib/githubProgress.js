/**
 * Writes the public progress marker through the GitHub Contents API.
 *
 * Shared by the /admin panel and the in-map teacher controls, so there is one
 * implementation of "move the marker" rather than two that can drift.
 *
 * The token is read from THIS browser's localStorage at call time and is never
 * stored anywhere else — not in source, not in the build, not in a URL.
 */

const TOKEN_KEY = 'xrisland:gh-token'
const REPO_KEY = 'xrisland:gh-repo'
const BRANCH_KEY = 'xrisland:gh-branch'
export const FILE_PATH = 'public/progress.json'

// eslint-disable-next-line no-undef
const BUILD_REPO = typeof __REPO_SLUG__ === 'string' ? __REPO_SLUG__ : ''

const read = (k, fallback = '') => {
  try {
    return localStorage.getItem(k) || fallback
  } catch {
    return fallback
  }
}

export const settings = {
  get token() {
    return read(TOKEN_KEY)
  },
  set token(v) {
    try {
      v ? localStorage.setItem(TOKEN_KEY, v) : localStorage.removeItem(TOKEN_KEY)
    } catch {
      /* storage disabled */
    }
  },
  get repo() {
    return read(REPO_KEY, BUILD_REPO)
  },
  set repo(v) {
    try {
      localStorage.setItem(REPO_KEY, v)
    } catch {
      /* storage disabled */
    }
  },
  get branch() {
    return read(BRANCH_KEY, 'main')
  },
  set branch(v) {
    try {
      localStorage.setItem(BRANCH_KEY, v)
    } catch {
      /* storage disabled */
    }
  },
}

const encodeBase64 = (text) => {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

const decodeBase64 = (b64) => {
  const binary = atob(b64.replace(/\s/g, ''))
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)))
}

function api(path, options = {}) {
  return fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      Authorization: `Bearer ${settings.token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  })
}

function explain(status) {
  if (status === 401) return 'Token no válido o caducado.'
  if (status === 403) return 'El token no tiene permiso "Contents: Read and write".'
  if (status === 404) return `No existe ${FILE_PATH} en esa rama.`
  if (status === 409) return 'Conflicto: el archivo cambió. Vuelve a leerlo.'
  return `GitHub respondió ${status}.`
}

/** @returns {Promise<{currentLevelId:string, sha:string}>} */
export async function readProgress() {
  if (!settings.token || !settings.repo) throw new Error('Falta el token o el repositorio.')
  const res = await api(
    `/repos/${settings.repo}/contents/${FILE_PATH}?ref=${encodeURIComponent(settings.branch)}`
  )
  if (!res.ok) throw new Error(explain(res.status))
  const data = await res.json()
  const parsed = JSON.parse(decodeBase64(data.content))
  return { currentLevelId: parsed.currentLevelId, sha: data.sha }
}

/**
 * Moves the marker. Always re-reads first so the sha is fresh — otherwise two
 * clicks in a row collide with a 409.
 */
export async function writeProgress(levelId, label = 'Actualización') {
  const { sha } = await readProgress()
  const body = {
    message: `chore(progress): ${label} → ${levelId}`,
    content: encodeBase64(
      JSON.stringify(
        {
          currentLevelId: levelId,
          note: 'Moved only by the teacher controls. Students read this; they never write it.',
        },
        null,
        2
      ) + '\n'
    ),
    branch: settings.branch,
    sha,
  }
  const res = await api(`/repos/${settings.repo}/contents/${FILE_PATH}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}))
    throw new Error(detail.message ?? explain(res.status))
  }
  return levelId
}
