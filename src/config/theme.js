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

  // Gold rim drawn around every node disc, as in the NSMB world maps.
  nodeRim: 0xf2c14e,
}

/**
 * One palette per world, so the three read as distinct biomes the way a Mario
 * overworld does. World 1 deliberately keeps the classic scheme — green grass
 * over warm reddish cliffs — and the other two vary from it.
 *
 * `ground` is the flat cap you walk on; `band` is the bright stripe just under
 * the lip; `rock` is the cliff face below it. That three-tone stack is what
 * makes a plateau read as a plateau rather than a coloured slab.
 */
export const biomes = {
  meadow: {
    props: 'leafy',
    road: 0xf0cf7a,
    roadEdge: 0xb98a3c,
    ground: 0x74c365,
    groundAlt: 0x5faa52,
    band: 0xc4693f,
    rock: 0xa04a2f,
    rockDeep: 0x7d3823,
    trunk: 0x8b5e34,
    foliage: 0x3f9142,
    foliageAlt: 0x50a854,
    boulder: 0x8d99ae,
  },
  desert: {
    props: 'cactus',
    // Brick road: a sand-coloured road on sand is invisible.
    road: 0xc75f3f,
    roadEdge: 0x8e3f28,
    ground: 0xe3c169,
    groundAlt: 0xd0aa55,
    band: 0xc9793c,
    rock: 0xa85f2e,
    rockDeep: 0x84461f,
    trunk: 0x9c7b4a,
    foliage: 0x4f9455, // cacti
    foliageAlt: 0x3f7d46,
    boulder: 0xb08968,
  },
  summit: {
    props: 'pine',
    road: 0xa9bccd,
    roadEdge: 0x6d8095,
    // Snow over dark rock. The gap between cap and rock has to stay wide or
    // the terracing vanishes into a flat white mass.
    ground: 0xeaf2fa,
    groundAlt: 0xd4e3f2,
    band: 0x9fb3c4,
    rock: 0x5f7183,
    rockDeep: 0x3d4a57,
    trunk: 0x5b4636,
    foliage: 0x2f6b4f, // pines
    foliageAlt: 0x3d7d5c,
    boulder: 0x9aa7b3,
  },
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

  path: 0xf0cf7a, // the road surface
  pathEdge: 0xb98a3c, // darker border under it, so the road reads as outlined
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
