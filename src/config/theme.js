/**
 * Single source of truth for every colour in the map.
 *
 * Rules baked into this file (see resolveNodeColor):
 *   - `completed` is ALWAYS green and always wins over category colour.
 *   - Optional/bonus nodes are never green — green is reserved for completed.
 *
 * Colours are hex numbers because Three.js wants them that way; `cssPalette`
 * mirrors them as strings for the 2D DaisyUI layer so the two never drift.
 * Category colours are placeholders — change them here and nowhere else.
 */

export const palette = {
  // Status
  completed: 0x38b000, // green — reserved, never reuse for anything else
  current: 0xffd166, // the manual progress marker (see admin module)

  // Categories (not completed) — PLACEHOLDERS, tune freely
  theory: 0x4cc9f0, // cyan
  practical: 0xf77f00, // orange
  boss: 0xd62828, // red — both tiers, differentiated by size/shape not colour

  // Optional / bonus levels — must never be green
  optional: 0x9d4edd, // purple / lilac

  // Locked-ahead levels (past the progress marker)
  locked: 0x6c757d,
}

export const world = {
  sky: 0x9bd4e4,
  fog: 0x9bd4e4,
  fogNear: 60,
  fogFar: 190,

  terrain: 0x74c365,
  terrainEdge: 0x5a9e4d,
  cliff: 0xb08968,
  water: 0x4ea8de,

  path: 0xe8d8b0,
  pathOptional: 0x9d4edd, // dashed connectors to bonus nodes

  player: 0xef476f,

  ambient: 0xbcd9ff,
  ambientIntensity: 1.15,
  sun: 0xfff4d6,
  sunIntensity: 2.1,
  sunPosition: [40, 70, 30],
}

/** Mirror of `palette` for the HTML/Tailwind layer. */
export const cssPalette = Object.fromEntries(
  Object.entries(palette).map(([k, v]) => [k, '#' + v.toString(16).padStart(6, '0')])
)

/**
 * The one place node colour is decided. Order matters.
 * @param {{completed?: boolean, optional?: boolean, category?: string}} level
 * @param {{locked?: boolean}} [state]
 */
export function resolveNodeColor(level, state = {}) {
  if (level.completed) return palette.completed // wins over everything
  if (state.locked) return palette.locked
  if (level.optional) return palette.optional
  return palette[level.category] ?? palette.theory
}
