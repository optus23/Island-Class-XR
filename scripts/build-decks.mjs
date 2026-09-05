/**
 * Compiles every Marp-flavoured exercise Markdown into a slide deck.
 *
 * Runs under Node as part of `npm run build` (and `npm run dev`), NEVER in the
 * browser: Marp and its Markdown engine are devDependencies and none of it is
 * shipped. What the site downloads is small JSON — the slides already rendered
 * to HTML — plus one stylesheet shared by every deck.
 *
 * WHAT MAKES A FILE A DECK
 * A file in public/content/exercises/ becomes a deck when its front-matter says
 * `marp: true`. That is the whole opt-in: no entry in levels.json, no build
 * flag. Marc writes Markdown; a deck appears.
 *
 * THERE ARE NO ANSWER DECKS
 * The todos are the instructions, and a course that hands out instructions
 * does not also hand out the assembled result. An earlier version split each
 * deck into statement and answer files behind a global unlock; the whole
 * mechanism was removed rather than hardened, because the honest fix for
 * "answers must not leak from a public repo" is not to put them in one.
 *
 * OUTPUT (public/decks/, gitignored, regenerated every build)
 *   theme.css            the compiled Marp theme, shared by every deck
 *   index.json           manifest: which levels have a deck, and slide counts
 *   <level-id>.json      the slides
 *
 * Each slide is handed over as `{ html, classes }` rather than as one blob of
 * deck HTML, so the runtime decides the surface. Today that surface is DOM; a
 * VR panel could consume exactly the same JSON without this script changing.
 */
import { Marp } from '@marp-team/marp-core'
import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, basename } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const SRC_DIR = resolve(root, 'public/content/exercises')
const OUT_DIR = resolve(root, 'public/decks')
const THEME = resolve(here, 'marp-theme.css')

const marp = new Marp({
  // Plain <section> elements instead of Marp's inline-SVG scaffold. The runtime
  // scales them itself, and flat sections make slicing a deck into per-slide
  // payloads a string operation rather than SVG surgery.
  inlineSVG: false,
  html: false, // Markdown is authored content, but not a licence to inject
  math: false, // nothing in this course needs KaTeX; it is a big payload
})
marp.themeSet.default = marp.themeSet.add(readFileSync(THEME, 'utf8'))

/** Front-matter of a Marp file, as a flat map. Enough for `marp:` and `title:`. */
function frontMatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)
  if (!m) return null
  const out = {}
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line.trim())
    if (kv) out[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, '')
  }
  return out
}

/**
 * Split rendered deck HTML into its slides.
 *
 * Marp emits the sections as flat siblings and never nests one inside another,
 * so a non-greedy match is correct here and does not need a DOM.
 */
function splitSlides(html) {
  const out = []
  for (const match of html.matchAll(/<section\b([^>]*)>([\s\S]*?)<\/section>/g)) {
    const attrs = match[1]
    const cls = /class\s*=\s*"([^"]*)"/.exec(attrs)?.[1] ?? ''
    out.push({
      html: match[0],
      classes: cls.split(/\s+/).filter(Boolean),
    })
  }
  return out
}

/** First heading in a slide, used as the deck title and the slide's a11y name. */
function headingOf(slideHtml) {
  const m = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/.exec(slideHtml)
  return m ? m[1].replace(/<[^>]+>/g, '').trim() : ''
}

// --- compile ---------------------------------------------------------------

rmSync(OUT_DIR, { recursive: true, force: true })
mkdirSync(OUT_DIR, { recursive: true })

const manifest = {}
let themeCss = null
let skipped = 0

const files = readdirSync(SRC_DIR)
  .filter((f) => f.endsWith('.md'))
  .sort()

for (const file of files) {
  const id = basename(file, '.md')
  const source = readFileSync(resolve(SRC_DIR, file), 'utf8')
  const fm = frontMatter(source)

  // Not opted in. Left alone — it still renders as prose in the Ejercicios tab.
  if (fm?.marp !== 'true') {
    skipped++
    continue
  }

  const { html, css } = marp.render(source)
  themeCss ??= css

  const slides = splitSlides(html)
  if (!slides.length) {
    console.warn(`  ! ${file}: marp: true but produced no slides — check the syntax`)
    continue
  }

  const title = fm.title || headingOf(slides[0]?.html ?? '') || id

  writeFileSync(
    resolve(OUT_DIR, `${id}.json`),
    JSON.stringify({ id, title, slides }, null, 0) + '\n',
    'utf8'
  )

  manifest[id] = { title, slides: slides.length }
  console.log(`  ✓ ${id} — ${slides.length} slide(s)`)
}

if (themeCss) writeFileSync(resolve(OUT_DIR, 'theme.css'), themeCss, 'utf8')
writeFileSync(
  resolve(OUT_DIR, 'index.json'),
  JSON.stringify({ decks: manifest }, null, 2) + '\n',
  'utf8'
)

const count = Object.keys(manifest).length
console.log(
  `\ndecks: ${count} generated, ${skipped} markdown file(s) without \`marp: true\` left as prose.`
)
if (!count) {
  console.warn('No deck was generated. Add `marp: true` to an exercise front-matter.')
}
