/**
 * "Ver todo el mapa" — the teacher's local exemption from the session lock.
 *
 * WHY THIS EXISTS SEPARATELY FROM THE TOKEN
 * Until now the only way to see the sessions ahead was to hold a GitHub token:
 * `main.js` seeded `seeAll` from `hasAdminToken()`. That is right for the person
 * who runs the course, and wrong for everyone else who needs to LOOK at it — a
 * colleague being shown the island, the user demoing it on someone else's
 * laptop. Handing them a token with write access to the repository so they can
 * read a map is absurd, and turning `lockAhead` off in `progress.json` is worse:
 * that is the COURSE setting, so it spoils the whole term for the actual class
 * for as long as the demo lasts, and it costs a commit and a Pages deploy in
 * each direction.
 *
 * So the exemption gets its own switch, and it is:
 *
 *   - local — one key in THIS browser's localStorage, nothing committed,
 *     nothing deployed, nothing that any student can see;
 *   - reversible in one click, from the map's legend or from /admin;
 *   - independent of the token — having one still turns it on by default, which
 *     is the behaviour that already shipped.
 *
 * It hides nothing that was not already there: `levels.json` ships inside the
 * bundle, so the titles are readable by anyone who opens devtools. The lock is a
 * courtesy that stops a class reading the plot on day one, not a secret.
 */

const KEY = 'xrisland:see-all'

/** `?ver=todo` turns it on, `?ver=alumno` turns it off. */
const PARAM = 'ver'
const ON = 'todo'
const OFF = 'alumno'

const store = {
  get() {
    try {
      return localStorage.getItem(KEY)
    } catch {
      return null
    }
  },
  set(v) {
    try {
      localStorage.setItem(KEY, v ? '1' : '0')
    } catch {
      /* storage disabled — the switch then lasts one page load, which is fine */
    }
  },
}

/**
 * Has this browser been told, explicitly, one way or the other?
 *
 * Absent is NOT the same as off: it means nobody has touched the switch, and the
 * caller falls back to the token. Storing '0' is how "ver como alumno" survives
 * a reload for a teacher who does hold one.
 */
export function seeAllChoice() {
  const v = store.get()
  return v === null ? null : v === '1'
}

/** Remember the choice for this browser. */
export function rememberSeeAll(on) {
  store.set(on)
}

/**
 * Read `?ver=` and remember it, then take it back out of the address bar.
 *
 * Stripped because the parameter is a one-shot instruction, not state: leaving
 * it there means the link the teacher pastes into a chat carries the exemption
 * to whoever clicks it, and a Back that lands on the old URL turns it silently
 * on again. The switch it flipped is what persists.
 *
 * @returns {boolean|null} what the URL asked for, or null if it asked nothing.
 */
export function readSeeAllFromUrl() {
  const url = new URL(window.location.href)
  const want = url.searchParams.get(PARAM)
  if (want !== ON && want !== OFF) return null

  const on = want === ON
  rememberSeeAll(on)
  url.searchParams.delete(PARAM)
  window.history.replaceState(window.history.state, '', url)
  console.info(`[lock] vista de ${on ? 'profesor: todo el mapa visible' : 'alumno'}`)
  return on
}

/** The link that hands someone the whole map, for pasting into a message. */
export function seeAllLink(on = true) {
  const url = new URL(import.meta.env.BASE_URL, window.location.origin)
  url.searchParams.set(PARAM, on ? ON : OFF)
  return url.href
}
