import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

/**
 * GitHub Pages project sites are served from https://<user>.github.io/<repo>/,
 * so Vite needs `base` to match the repo name. We derive it from the
 * GITHUB_REPOSITORY env var that GitHub Actions always sets ("owner/repo"),
 * which means renaming the repo never breaks the build. Locally it stays "/".
 * Override with BASE_PATH if you ever deploy somewhere else.
 */
const repoSlug = process.env.GITHUB_REPOSITORY ?? ''
const repoName = repoSlug.split('/')[1] ?? ''
const base = process.env.BASE_PATH ?? (repoName ? `/${repoName}/` : '/')

/**
 * A stamp for the build the browser is actually running.
 *
 * Without one, "I deployed it" and "I am seeing it" are impossible to tell
 * apart. A phone holding a cached index.html loads the OLD hashed bundle, which
 * is still on Pages and still works — so a fix can be live and invisible, and a
 * round gets spent re-diagnosing something that was already fixed. That
 * happened. Now the page says which commit it is.
 */
let buildId = 'dev'
try {
  buildId = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
} catch {
  buildId = new Date().toISOString().slice(0, 16).replace('T', ' ')
}

/**
 * The season calendar from `public/progress.json`, baked into the bundle.
 *
 * It has to be known while `config/theme.js` is still evaluating, before any
 * mesh exists, so it cannot be fetched like the marker is. Saving it from
 * /admin is a commit to `main`, and a commit to `main` rebuilds the site, so
 * a baked copy is never stale for longer than a deploy. The DATE is still read
 * in the browser on every load: what is baked is the calendar, not the season.
 * See `config/seasons.js`.
 */
let seasonCalendar = []
try {
  const progress = JSON.parse(
    readFileSync(resolve(import.meta.dirname, 'public/progress.json'), 'utf8')
  )
  if (Array.isArray(progress.seasons)) seasonCalendar = progress.seasons
} catch {
  seasonCalendar = []
}

export default defineConfig({
  base,
  plugins: [tailwindcss()],
  define: {
    // Baked in at build time so the /admin panel knows which repo to write
    // progress.json to. Never contains a token — only the public repo slug.
    __REPO_SLUG__: JSON.stringify(repoSlug),
    __BUILD_ID__: JSON.stringify(buildId),
    __SEASON_CALENDAR__: JSON.stringify(seasonCalendar),
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        admin: resolve(import.meta.dirname, 'admin/index.html'),
        // Same bundle as `main` — Rollup emits one shared chunk. This entry
        // exists only so the headset has a typeable URL (`/vr`) that arrives
        // with WebXR already armed.
        vr: resolve(import.meta.dirname, 'vr/index.html'),
      },
    },
  },
})
