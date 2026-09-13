/**
 * The write path for the two public data files, through the GitHub Contents API.
 *
 *   public/progress.json  where the class is        — the legend's Profesor block
 *   public/npcs.json      who is walking the island — the /admin roster editor
 *
 * One implementation, shared by /admin and the in-map teacher controls, so
 * "read, patch, commit" cannot drift into two versions of itself. Both files are
 * public and both are read by students with a plain fetch; only this module ever
 * writes them.
 *
 * The token is read from THIS browser's localStorage at call time and is never
 * stored anywhere else — not in source, not in the build, not in a URL.
 */
import { MAX_NPCS, ROSTER_NOTE, normalizeRoster } from './roster.js'

const TOKEN_KEY = 'xrisland:gh-token'
const REPO_KEY = 'xrisland:gh-repo'
const BRANCH_KEY = 'xrisland:gh-branch'
export const PROGRESS_PATH = 'public/progress.json'
export const ROSTER_PATH = 'public/npcs.json'

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

/**
 * One request to the GitHub API, and it must NEVER come out of a cache.
 *
 * The Contents API answers a GET with `Cache-Control: public, max-age=60,
 * s-maxage=60`. A plain `fetch` honours that, so the second teacher control
 * pressed inside a minute read the file's sha from the browser's cache — the
 * sha from BEFORE the first press wrote a new commit — and the PUT came back
 * `409 public/progress.json does not match <sha>`. Pressing "Completar y
 * avanzar" and then "Retroceder" was enough to produce it every time.
 *
 * Both halves are needed: `no-store` keeps the browser out of it, and the
 * `_` stamp gives the shared cache in front of the API a URL it has never seen.
 * `public/progress.json` is fetched by the map with exactly the same pair of
 * precautions, for exactly the same reason.
 */
function api(path, options = {}) {
  const url = new URL(`https://api.github.com${path}`)
  if (!options.method || options.method === 'GET') url.searchParams.set('_', Date.now())
  return fetch(url, {
    ...options,
    cache: 'no-store',
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      Authorization: `Bearer ${settings.token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  })
}

function explain(status, path, githubSays = '') {
  if (status === 401)
    return 'Token no válido o caducado. Pégalo de nuevo en /admin (Configuración → Developer settings → Fine-grained tokens).'
  if (status === 403)
    return 'El token no tiene permiso "Contents: Read and write" sobre este repositorio.'
  if (status === 404) return `No existe ${path} en la rama ${settings.branch} de ${settings.repo}.`
  if (status === 409)
    return (
      `Otro cambio llegó antes que éste a ${path}. Vuelve a pulsar el botón: ` +
      'se lee el archivo de nuevo y se reintenta.'
    )
  // Anything unexpected keeps GitHub's own words: they are in English and
  // usually unhelpful, but they are the only clue left.
  return `GitHub respondió ${status}.${githubSays ? ` ${githubSays}` : ''}`
}

/**
 * One JSON file plus its sha, or `{doc: null, sha: null}` if it is not there.
 *
 * A missing file is a normal state for the roster — the island simply has nobody
 * walking it — so it is reported rather than thrown. The sha comes back because
 * every write needs it: without a fresh one, two clicks in a row collide with a
 * 409.
 *
 * @param {string} path repo-relative, e.g. 'public/npcs.json'
 * @returns {Promise<{doc: unknown, sha: string|null}>}
 */
export async function readJsonFile(path) {
  if (!settings.token || !settings.repo) throw new Error('Falta el token o el repositorio.')
  const res = await api(
    `/repos/${settings.repo}/contents/${path}?ref=${encodeURIComponent(settings.branch)}`
  )
  if (res.status === 404) return { doc: null, sha: null }
  if (!res.ok) throw new Error(explain(res.status, path))
  const data = await res.json()
  return { doc: JSON.parse(decodeBase64(data.content)), sha: data.sha }
}

/**
 * Commit a JSON document, creating the file if it does not exist yet.
 *
 * `knownSha` is the sha the caller has already read, so a read-modify-write is
 * one round trip rather than two.
 *
 * A 409 is retried ONCE against a freshly read sha. With the cache defeated
 * above that should not happen any more, but GitHub's own read-after-write is
 * eventually consistent, and a teacher pressing two controls in a row is
 * exactly the case that would find it. Retrying is safe here: both files are
 * whole documents written from state the caller is holding, not patches applied
 * to whatever happens to be there.
 */
export async function writeJsonFile(path, doc, message, { knownSha } = {}) {
  const body = (sha) =>
    JSON.stringify({
      message,
      content: encodeBase64(JSON.stringify(doc, null, 2) + '\n'),
      branch: settings.branch,
      ...(sha ? { sha } : {}),
    })

  let sha = knownSha ?? (await readJsonFile(path)).sha
  let res = await api(`/repos/${settings.repo}/contents/${path}`, {
    method: 'PUT',
    body: body(sha),
  })
  if (res.status === 409) {
    sha = (await readJsonFile(path)).sha
    res = await api(`/repos/${settings.repo}/contents/${path}`, {
      method: 'PUT',
      body: body(sha),
    })
  }
  if (!res.ok) {
    // `explain` first: GitHub's own message for a sha clash is
    // "<path> does not match <sha>", which told the teacher nothing.
    const detail = await res.json().catch(() => ({}))
    throw new Error(explain(res.status, path, detail.message))
  }
  return doc
}

/**
 * The whole document plus its sha.
 *
 * Returns the document rather than one field, so a writer that only cares about
 * the marker still preserves anything else the file grows later.
 *
 * @returns {Promise<{doc:object, sha:string}>}
 */
export async function readProgress() {
  const { doc, sha } = await readJsonFile(PROGRESS_PATH)
  if (!doc) throw new Error(explain(404, PROGRESS_PATH))
  return { doc, sha }
}

const NOTE = 'Moved only by the teacher controls. Students read this; they never write it.'

/**
 * Read-modify-write of progress.json.
 *
 * Always re-reads first, so the sha is fresh — otherwise two clicks in a row
 * collide with a 409 — and so that a patch to one field preserves the other.
 */
async function patchProgress(patch, message) {
  const { doc, sha } = await readProgress()
  return writeJsonFile(PROGRESS_PATH, { ...doc, ...patch, note: NOTE }, message, {
    knownSha: sha,
  })
}

/**
 * Turns the "hide the sessions ahead" rule on or off for the whole course.
 *
 * The same read-modify-write as the marker, so one field cannot clobber the
 * other — which is exactly why `patchProgress` merges rather than replaces.
 */
export async function writeLockAhead(on) {
  await patchProgress(
    { lockAhead: Boolean(on) },
    `chore(progress): sesiones futuras ${on ? 'ocultas' : 'visibles'}`
  )
  return Boolean(on)
}

/** Moves the marker. */
export async function writeProgress(levelId, label = 'Actualización') {
  await patchProgress({ currentLevelId: levelId }, `chore(progress): ${label} → ${levelId}`)
  return levelId
}

/**
 * Publishes the class timetable.
 *
 * Same read-modify-write as everything else in this file, so it cannot
 * clobber the marker someone moved from the map thirty seconds ago. See
 * `lib/schedule.js` for what the timetable is and why it lives here rather
 * than anywhere near the level data.
 */
export async function writeSchedule(schedule) {
  const entries = Object.keys(schedule ?? {}).length
  await patchProgress(
    { schedule: schedule ?? {} },
    `chore(progress): calendario de sesiones (${entries})`
  )
  return schedule ?? {}
}


// --- the roster of honoured students ---------------------------------------

/**
 * The roster as the map will read it. A missing file means an empty list, not an
 * error — that is the state the repository ships in.
 */
export async function readRoster() {
  const { doc } = await readJsonFile(ROSTER_PATH)
  return normalizeRoster(doc)
}

/**
 * Commit the whole roster at once.
 *
 * The whole list, not one entry: /admin stages adds and removals locally and
 * saves once, because every write here is a commit and a Pages deploy. Adding
 * five names one commit at a time would be five deploys and five minutes.
 *
 * @param {Array<{id: string, name: string, levelId: string}>} npcs
 */
export async function writeRoster(npcs) {
  const clean = normalizeRoster({ npcs }).slice(0, MAX_NPCS)
  await writeJsonFile(
    ROSTER_PATH,
    { npcs: clean, note: ROSTER_NOTE },
    `chore(npcs): ${clean.length} alumno(s) paseando por la isla`
  )
  return clean
}
