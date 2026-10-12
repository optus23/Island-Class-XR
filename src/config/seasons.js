/**
 * Seasonal skins for the island.
 *
 * THE ORDINARY MAP IS A SEASON LIKE ANY OTHER, and it is `default`. Nothing in
 * `theme.js` was edited to add Halloween: the base values there still describe
 * the map exactly as it looked on 12 October 2026, and a season is a PATCH laid
 * over them. So going back to the ordinary island is one word on the line
 * below, not a restoration — there is nothing to undo and nothing to remember.
 *
 *   SEASON = 'default'    the island as it always was
 *   SEASON = 'halloween'  night, monsters, pumpkins, bare trees, haunted keeps
 *   SEASON = 'christmas'  reserved — asked for in December 2026, not built yet
 *
 * There is also a git tag, `pre-halloween-2026`, on the commit that was live
 * before any of this. It is belt and braces; the line below is the switch.
 *
 * **A season may only change how the island LOOKS.** Never what it means: not a
 * node's status colour, not the lock, not a level's data. `palette.completed`
 * is green in every season for the same reason it is green at all, and the
 * road's own three colours are left alone because the separation between them
 * was searched rather than chosen (see `world.pathDone` in `theme.js`). A
 * season darkens the LIGHT and the land; it does not repaint the signposting.
 *
 * Previewing without a deploy: add `?season=halloween` (or `?season=default`)
 * to any URL. It is read once, on load, and never written anywhere — handy for
 * showing someone the island without committing to it.
 */

/** @type {'default' | 'halloween' | 'christmas'} */
export const SEASON = 'halloween'

/**
 * Everything a season is allowed to switch on, with the ordinary island's
 * answers. A season that leaves one out gets the value from here, so adding a
 * flag never means editing every season.
 */
const BASE_FLAGS = {
  /** What patrols the road: the Goomba-ish creature, or Halloween monsters. */
  walkers: 'creature',
  /** How many bats circle over the island. 0 is none, and costs nothing. */
  bats: 0,
  /** Scatter jack-o'-lanterns through the ground cover beside the road. */
  pumpkins: false,
  /** 'biome' uses each biome's own tree; 'bare' plants dead ones everywhere. */
  trees: 'biome',
  /** 'stone' is the ordinary keep; 'haunted' adds the Halloween dressing. */
  castles: 'stone',
}

/**
 * The patches themselves.
 *
 * `theme` is merged key-by-key into the matching export of `theme.js`, one
 * level deep — `{ world: { sky } }` replaces that one colour and leaves the
 * rest of `world` alone. `biomes` goes two levels deep because each biome is
 * its own object.
 */
const SEASONS = {
  default: { flags: {}, theme: {} },

  halloween: {
    flags: {
      walkers: 'monsters',
      bats: 14,
      pumpkins: true,
      trees: 'bare',
      castles: 'haunted',
    },
    theme: {
      /**
       * ONLY THE CASTLE'S STONE MOVES, and only because the stone is a
       * MATERIAL rather than a status — `theme.js` says so at the field
       * itself. Everything else in `palette` is what the map MEANS: the
       * completed green, the category colours, the lock grey, the gold rim.
       * A season that repainted those would be changing the signposting, and
       * a student would have to learn the map twice.
       *
       * `bossAccent` is deliberately NOT here. It is doing two jobs — the
       * roofs, and the whole stone of the re-evaluation castle plus its dashed
       * connector — and that second one is semantic: the re-evaluation is red
       * because it is an exam. The haunted ROOFS are recoloured inside
       * `createBossCastle` instead, where only the roof is listening.
       */
      palette: {
        boss: 0x343a44, // colder, darker keep
        bossStone: 0x4b525c,
      },

      /**
       * NIGHT, NOT BLACK. "No debe de ser de día o tan iluminado... un tono un
       * poquito más oscuro."
       *
       * The heavy lifting is done by the LIGHT — ambient, sun and sky — rather
       * than by repainting every surface, because dimming the lamps keeps
       * every colour relationship the map depends on intact. A deep violet
       * rather than true black: black flattens a voxel scene into silhouettes
       * and the terracing stops reading, which is the one thing the island
       * cannot afford to lose.
       */
      world: {
        sky: 0x1a1230,
        fog: 0x241a3d,
        // Pulled in hard. At the ordinary 260/900 the far worlds stayed
        // perfectly crisp, and a clear night reads as "the lights went out"
        // rather than as night. Haze is most of the atmosphere here.
        fogNear: 150,
        fogFar: 620,

        // Moonlight: cool, from one side, and much weaker than the sun. The
        // ambient keeps a violet cast so the shadowed faces are not grey.
        ambient: 0x5b4a8c,
        ambientIntensity: 0.72,
        sun: 0xc8d4ff,
        sunIntensity: 1.05,
        sunPosition: [-50, 60, 25],

        // Water goes from a sunny Caribbean blue to something cold and deep.
        water: 0x1d3a6b,
        waterDeep: 0x111f3f,
        waterShallow: 0x2d5a94,
        waterFoam: 0xb9c9e8,

        terrain: 0x3f5a3a,
        terrainEdge: 0x2c4029,
        cliff: 0x6a5240,

        // The road keeps its own three colours. See the note at the top: that
        // separation was measured, and moonlight already dims it plenty.
      },

      /**
       * The land itself, a notch darker and drained of warmth. Each biome
       * keeps its three-tone stack — cap, band, cliff — because that is what
       * makes a plateau read as a plateau; all three just move down together.
       */
      biomes: {
        meadow: {
          ground: 0x47603f,
          groundAlt: 0x3a5034,
          band: 0x6b3f2a,
          rock: 0x532f20,
          rockDeep: 0x3a2017,
          trunk: 0x4a3426,
          foliage: 0x2f4536,
          foliageAlt: 0x3b5442,
          boulder: 0x565f6b,
        },
        desert: {
          // Measured against the other two rather than chosen: at the first
          // pass this was 0x8a6b43 and the middle of the island read as a flat
          // field of mud, lighter than the meadow beside it. Cooler and a stop
          // down, so the three biomes still differ but none of them shouts.
          ground: 0x6f5736,
          groundAlt: 0x5e492d,
          band: 0x5e3a20,
          rock: 0x4c2c18,
          rockDeep: 0x371f11,
          trunk: 0x4a3a24,
          foliage: 0x2d5133,
          foliageAlt: 0x234128,
          boulder: 0x5a4a3d,
        },
        summit: {
          /**
           * Snow under a moon is blue, not white — and much darker than the
           * first pass had it.
           *
           * At 0x9aa8c4 world 3 was by a wide margin the brightest thing on a
           * night island, so the eye went straight to the far right and the
           * whole map read as lit from the wrong end. Snow is only ever as
           * bright as what is lighting it, and what is lighting this is a
           * moon. The three-tone stack keeps its spacing so the terracing
           * still reads; the whole stack just moves down together.
           */
          ground: 0x6d7b96,
          groundAlt: 0x5d6a85,
          band: 0x47536a,
          rock: 0x303a4b,
          rockDeep: 0x1e2531,
          trunk: 0x3b2f24,
          foliage: 0x1f4536,
          foliageAlt: 0x2a5340,
          boulder: 0x4e5968,
        },
      },

      /** The mounds on the horizon, almost silhouettes now. */
      backdrop: {
        meadow: [0x2d3b47, 0x374a52, 0x3f5450],
        desert: [0x4a3b45, 0x553f48, 0x45333f],
        summit: [0x33405c, 0x3d3a5e, 0x2e3a52],
      },

      /** Ragged cloud for the opening flight, lit by the moon. */
      clouds: {
        light: 0x8e8bb5,
        shade: 0x5f5d85,
      },
    },
  },

  /**
   * ASKED FOR IN DECEMBER, NOT BUILT. Marc: "no hace falta hacerlo de Navidad
   * hoy, pero apunta que te lo voy a pedir seguramente en diciembre."
   *
   * Left as an empty patch on purpose rather than as a guess: selecting it
   * today gives the ordinary island, which is the honest answer for a season
   * nobody has designed yet. The flags it will most likely want are already
   * in BASE_FLAGS — snow-laden trees, no monsters, and a `castles` variant.
   */
  christmas: { flags: {}, theme: {} },
}

/**
 * The season actually in force.
 *
 * Node-safe: `scripts/validate.mjs` and the Marp build run this file through
 * Node, where there is no `window`, so the URL override is guarded rather than
 * assumed. It is also wrapped because a sandboxed iframe can throw on
 * `location` rather than simply not having it.
 */
function resolveSeason() {
  try {
    if (typeof window !== 'undefined' && window.location) {
      const asked = new URLSearchParams(window.location.search).get('season')
      if (asked && Object.hasOwn(SEASONS, asked)) return asked
    }
  } catch {
    /* no URL here — fall through to the constant */
  }
  return Object.hasOwn(SEASONS, SEASON) ? SEASON : 'default'
}

const active = resolveSeason()

/** Which season is in force, for anything that wants to say so out loud. */
export const activeSeason = active

/** @type {typeof BASE_FLAGS} */
export const seasonFlags = { ...BASE_FLAGS, ...(SEASONS[active].flags ?? {}) }

/**
 * Lays this season's patch over the theme objects, IN PLACE.
 *
 * In place, and called from `theme.js` itself, because every other module
 * imports those objects by reference: a module that re-exported new ones would
 * leave half the map reading the old values depending on import order. This
 * runs while `theme.js` is still evaluating, so nothing can observe the
 * unpatched state.
 *
 * @param {Record<string, object>} targets the theme exports, by name
 */
export function applySeason(targets) {
  const patch = SEASONS[active].theme ?? {}
  for (const [name, values] of Object.entries(patch)) {
    const target = targets[name]
    if (!target) continue
    for (const [key, value] of Object.entries(values)) {
      // Two levels deep for `biomes` and `backdrop`, whose entries are
      // themselves objects (or arrays, which are replaced whole).
      if (value && typeof value === 'object' && !Array.isArray(value) && target[key]) {
        Object.assign(target[key], value)
      } else {
        target[key] = value
      }
    }
  }
}
