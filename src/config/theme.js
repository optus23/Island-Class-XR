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
  boss: 0x4a5058, // dark stone — the red is an accent, not the whole castle

  // Optional / bonus levels — must never be green
  optional: 0x9d4edd, // purple / lilac

  // Locked-ahead levels (past the progress marker)
  locked: 0x6c757d,

  // Gold rim drawn around every node disc, as in the NSMB world maps.
  nodeRim: 0xf2c14e,

  // Castle accents: roofs, banners and trim pick this up against the stone.
  bossAccent: 0xb32a2a,
  bossStone: 0x6a7079,
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
    // Warmer and darker than the cream road, so the road reads over it without
    // needing a colour of its own.
    ground: 0xdfa85c,
    groundAlt: 0xcb9449,
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
    // Snow over dark rock. The gap between cap and rock has to stay wide or
    // the terracing vanishes into a flat white mass.
    // Cool white against the warm road: they differ in hue as well as value.
    ground: 0xdfe9f4,
    groundAlt: 0xc9dcec,
    band: 0x9fb3c4,
    rock: 0x5f7183,
    rockDeep: 0x3d4a57,
    trunk: 0x5b4636,
    foliage: 0x2f6b4f, // pines
    foliageAlt: 0x3d7d5c,
    boulder: 0x9aa7b3,
  },
}

/**
 * Pastel mounds standing behind the island. In the reference art the backdrop
 * is a wall of soft striped hills — it is what stops the map reading as a
 * diorama floating in empty sky.
 */
export const backdrop = {
  meadow: [0x8fd694, 0xa8e6cf, 0xbfe6a0],
  desert: [0xf2d091, 0xf7c59f, 0xe8b98a],
  summit: [0xbcd8f0, 0xd9c7ef, 0xcfe3f2],
}

/** Flower colours scattered over the ground caps. */
export const flowers = [0xffffff, 0xff8fab, 0xffd166, 0xef476f, 0xf7a8d8]

export const world = {
  sky: 0x9bd4e4,
  fog: 0x9bd4e4,
  // Barely-there haze. This used to hide the neighbouring worlds deliberately,
  // but it also swallowed the whole island the moment you zoomed out, and the
  // background never showed at all. Framing already keeps one world in view,
  // so fog only has to soften the far horizon now.
  fogNear: 260,
  fogFar: 900,

  terrain: 0x74c365,
  terrainEdge: 0x5a9e4d,
  cliff: 0xb08968,
  water: 0x4ea8de, // fallback if the shader is unavailable
  waterDeep: 0x2f7cc0,
  waterShallow: 0x62b8ea,
  waterFoam: 0xeaf7ff,

  // ONE road for all three worlds, as in the reference art: a warm cream
  // surface with a dark brown outline. The outline does most of the work —
  // it is what keeps the road readable over pale sand and over snow, so the
  // road never has to change colour per biome to stay visible.
  path: 0xf6dfa6,
  pathEdge: 0xa9763a,
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
