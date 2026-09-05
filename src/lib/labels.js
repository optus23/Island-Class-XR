/**
 * The human-readable names for the level model's enum-ish fields.
 *
 * Extracted from `ui/portal.js` when the VR panel needed the same words. Two
 * copies of "meta-pre-exam" means the day someone renames a stage, one surface
 * says the new name and the other quietly keeps the old one — the same reason
 * every colour lives in `config/theme.js`.
 *
 * Plain strings only, no markup: the 2D portal writes them into HTML and the
 * VR panel paints them onto a canvas, and a `<span>` would end up drawn
 * literally on the second one.
 */

export const STAGE_LABELS = {
  'intro-theory': 'Introducción y teoría',
  'ar-foundation': 'AR Foundation',
  'meta-pre-exam': 'Meta Building Blocks (antes del parcial)',
  'mini-boss-midterm': 'Examen parcial',
  'meta-post-exam': 'Meta Building Blocks (después del parcial)',
  'xr-toolkit': 'XR Interaction Toolkit',
  'final-project': 'Proyecto final',
  'final-boss-presentation': 'Presentación final',
}

export const CATEGORY_LABELS = {
  theory: 'Teoría',
  practical: 'Práctica',
  project: 'Proyecto',
  boss: 'Examen',
}

export const BOSS_TIER_LABELS = {
  mini: 'Jefe intermedio',
  final: 'Jefe final',
  extra: 'Extra',
}

// The graded practical blocks. `null` means the brief has not decided yet and
// says so out loud — an empty slot here is a question still open, not an
// oversight, so it must never render as blank.
export const SUBMISSION_LABELS = {
  build: 'Build (APK), no vídeo',
  video: 'Vídeo',
  repo: 'Repositorio',
}

export const GROUP_LABELS = {
  individual: 'Individual',
  'individual-within-group': 'Individual, dentro del grupo',
  'per-group': 'Por grupo',
}

/** What an undecided field reads as, in plain text. */
export const UNDECIDED_TEXT = 'por decidir'

export const stageLabel = (level) => STAGE_LABELS[level?.stage] ?? level?.stage ?? ''
export const categoryLabel = (level) => CATEGORY_LABELS[level?.category] ?? level?.category ?? ''

/**
 * The assessment rows for a graded block exercise, as `[label, value]` pairs of
 * plain text. Returns an empty array for every other level.
 *
 * Shared so the VR panel and the portal's strip cannot drift: the portal wraps
 * the same values in markup, this returns them bare.
 */
export function assessmentRows(level) {
  if (!level?.block) return []
  const b = level.block
  const w = level.gradeWeight

  const weight = w
    ? `${w.block} del curso · ${w.exercise ? `${w.exercise} del bloque` : `reparto ${UNDECIDED_TEXT}`}`
    : UNDECIDED_TEXT

  return [
    ['Bloque', `${b.number} · ${b.name} — ejercicio ${b.exercise} de ${b.of}`],
    ['Entrega', SUBMISSION_LABELS[level.submissionMethod] ?? UNDECIDED_TEXT],
    ['Trabajo', GROUP_LABELS[level.groupMode] ?? UNDECIDED_TEXT],
    ['Peso', weight],
  ]
}
