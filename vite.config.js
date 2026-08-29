import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'

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

export default defineConfig({
  base,
  plugins: [tailwindcss()],
  define: {
    // Baked in at build time so the /admin panel knows which repo to write
    // progress.json to. Never contains a token — only the public repo slug.
    __REPO_SLUG__: JSON.stringify(repoSlug),
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        admin: resolve(import.meta.dirname, 'admin/index.html'),
      },
    },
  },
})
