/**
 * Creates a placeholder file for every content path levels.json references
 * that does not exist yet — Markdown for exercises/answers, a one-page PDF for
 * pdf-type slides.
 *
 * Existing files are NEVER touched, so this is safe to re-run after adding
 * levels: `npm run placeholders`.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '..')
const publicDir = join(repo, 'public')
const levels = JSON.parse(readFileSync(join(repo, 'src/data/levels.json'), 'utf8')).levels

let created = 0
let skipped = 0

function ensure(relPath, makeContent, encoding = 'utf8') {
  if (!relPath) return
  const full = join(publicDir, relPath)
  if (existsSync(full)) {
    skipped++
    return
  }
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, makeContent(), encoding)
  created++
  console.log(`  + ${relPath}`)
}

/** A minimal, valid one-page PDF. Offsets are computed, not guessed. */
function makePdf(title, subtitle) {
  const esc = (s) =>
    String(s)
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // Helvetica's default encoding is Latin-1
      .replace(/[\\()]/g, (c) => '\\' + c)

  const stream = [
    'BT /F1 22 Tf 60 760 Td (' + esc(title) + ') Tj ET',
    'BT /F1 12 Tf 60 730 Td (' + esc(subtitle) + ') Tj ET',
    'BT /F1 12 Tf 60 700 Td (Sustituye este archivo por las diapositivas reales.) Tj ET',
  ].join('\n')

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ' +
      '/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`,
  ]

  let pdf = '%PDF-1.4\n'
  const offsets = []
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'))
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`
  })

  const xrefAt = Buffer.byteLength(pdf, 'latin1')
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const off of offsets) pdf += `${String(off).padStart(10, '0')} 00000 n \n`
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`
  return Buffer.from(pdf, 'latin1')
}

const mdBody = (level, kind) => `# ${level.title}

> **PLACEHOLDER.** ${
  kind === 'answers'
    ? 'Escribe aquí las respuestas o la solución comentada.'
    : 'Escribe aquí el enunciado de los ejercicios.'
}
> Este archivo es Markdown normal: se renderiza tal cual en el portal del nivel.

- Mundo ${level.world} · etapa \`${level.stage}\` · categoría \`${level.category}\`
${level.optional ? '- Nivel **opcional** (para casa, no evaluable)\n' : ''}
## Contenido

1. PLACEHOLDER
2. PLACEHOLDER
`

console.log('Creating missing placeholder content…')
for (const level of levels) {
  ensure(level.exercises, () => mdBody(level, 'exercises'))
  ensure(level.answers, () => mdBody(level, 'answers'))
  if (level.slides?.type === 'pdf') {
    ensure(
      level.slides.source,
      () => makePdf(level.title, `XR Island — mundo ${level.world} — ${level.id}`),
      null
    )
  }
}
console.log(`\n${created} created, ${skipped} already existed.`)
