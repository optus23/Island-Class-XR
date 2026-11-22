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
 *   SEASON = 'christmas'  snowed in: elves, presents, candy canes, Santa overhead
 *
 * **SINCE 22 NOVEMBER 2026 THAT LINE IS ONLY THE FALLBACK.** The season in
 * force is worked out from the date, against the calendar the teacher keeps
 * in `/admin` (see `SEASON_CALENDAR` below). `SEASON` is what the island is on
 * a day the calendar leaves empty, and it should stay `default`.
 *
 * **HALLOWEEN IS FINISHED, AND IT KEEPS WORKING WITH THE SWITCH OFF.** Marc
 * asked, on 1 November 2026, that the whole thing survive for next year. It
 * does, because none of it is temporary: the palette patch below, the dead
 * trees, the jack-o'-lanterns, the lampposts and their lights, the vampires,
 * werewolves and zombies, the bats and the haunted keeps all live in ordinary
 * files behind `seasonFlags`, and `SEASON = 'default'` simply stops asking for
 * them. Turning it back on next October is the same one word in reverse —
 * there is nothing to restore, re-import or remember.
 *
 * Proved rather than asserted: halloween -> default -> halloween returns the
 * island to 16 instanced meshes, 59,908 instances, 6 point lights, ambient
 * 0.97 and sky 0x1a1230, which is exactly what it had before the round trip.
 *
 * It will also inherit anything that changes in `theme.js` meanwhile, since
 * the patch is laid over whatever the base says at the time. That is the
 * intended behaviour: a new biome colour next year should reach Halloween too.
 *
 * Two git tags bracket the work, as belt and braces — `pre-halloween-2026` on
 * the commit that was live before any of it, and `halloween-2026` on the
 * finished look. Neither is the mechanism; the line below is.
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
export const SEASON = 'default'

/**
 * Everything a season is allowed to switch on, with the ordinary island's
 * answers. A season that leaves one out gets the value from here, so adding a
 * flag never means editing every season.
 */
const BASE_FLAGS = {
  /**
   * What patrols the road: the Goomba-ish creature, Halloween monsters, or
   * Christmas elves with the odd reindeer among them.
   */
  walkers: 'creature',
  /** How many of them. Four is the ordinary island's "the odd Goomba". */
  walkerCount: 4,
  /** How many bats circle over the island. 0 is none, and costs nothing. */
  bats: 0,
  /** Scatter jack-o'-lanterns through the ground cover beside the road. */
  pumpkins: false,
  /** Wrapped presents in the ground cover beside the road. */
  gifts: false,
  /** Candy canes planted in the verge. */
  candyCanes: false,
  /** The odd snowman out in the fields. */
  snowmen: false,
  /**
   * 'biome' uses each biome's own tree; 'bare' plants dead ones everywhere;
   * 'xmas' plants snow-laden pines with decorated Christmas trees among them.
   */
  trees: 'biome',
  /** Snow on the roofs of every landmark: houses, wells, cannons, pipes. */
  snowCaps: false,
  /** 'stone' is the ordinary keep; 'haunted' / 'snowy' add a season's dressing. */
  castles: 'stone',
  /** The lamppost recipe: 'iron' is Halloween's, 'xmas' wears ribbon and a wreath. */
  lampStyle: 'iron',
  /** How many snowflakes are falling at once. 0 is none, and costs nothing. */
  snowfall: 0,
  /** Santa's sleigh crossing the sky every few seconds, with its own light. */
  sleigh: false,
  /**
   * Where the avatar leaves footprints: 'snow' only on snowy ground (world 3's
   * summit, in EVERY season, the ordinary one included), 'everywhere' when the
   * whole island is snowed in, 'none' to switch them off.
   */
  footprints: 'snow',
  /**
   * How many REAL point lights the map may have alight at once, and 0 is the
   * ordinary island — which has a sun, and needs none.
   *
   * It is a budget rather than a switch because three.js does no light
   * culling: every light costs on every lit pixel whether or not it reaches
   * it, so the number is the only lever there is. See `three/seasonLights.js`
   * for the measurements behind the figure.
   */
  lights: 0,
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
      lights: 6,
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
        // Lifted from 0.72 once the point lights went in. Measured against
        // the screenshots rather than reasoned: of everything tried, this is
        // what did most to stop the island reading as under-exposed, and the
        // lamps then do the local work. Any higher and it stops being night.
        ambientIntensity: 0.97,
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
   * CHRISTMAS, built 22 November 2026. Marc: "me lo imagino con nieve, con
   * bastante nieve", plus elves instead of the walkers, presents, candy canes,
   * Christmas trees, falling snow, footprints, and Santa crossing the sky with
   * a light on his reindeer.
   *
   * THE DESIGN IN ONE LINE: the CAPS go white and the CLIFFS stay. Snow is what
   * lies on top, so every biome's walkable cap turns to snow, and the bands
   * and rock faces under the lip keep their own colours. That is what keeps
   * the three worlds apart on an island that is white from end to end: red
   * cliffs under the meadow's snow, orange under the desert's, grey-blue under
   * the summit's. Repainting the cliffs white too would leave one flat white
   * slab, and the terracing is the one thing this island cannot lose.
   *
   * EVENING, NOT NIGHT. Halloween is a night; Christmas is the blue hour, the
   * moment the lights come on. Dark enough that the lampposts, the lit trees
   * and Santa's light read as light, never so dark that the snow goes grey.
   * Snow is only as bright as what lights it (the lesson Halloween learned on
   * the summit), so the ambient carries a lot here and the sun is low and warm.
   */
  christmas: {
    flags: {
      walkers: 'elves',
      walkerCount: 6,
      gifts: true,
      candyCanes: true,
      snowmen: true,
      trees: 'xmas',
      snowCaps: true,
      castles: 'snowy',
      lampStyle: 'xmas',
      // The SAME six as Halloween, one of them riding with the sleigh. See
      // `three/seasonLights.js`: the budget is a phone decision, not a theme.
      lights: 6,
      snowfall: 2400,
      sleigh: true,
      footprints: 'everywhere',
    },
    theme: {
      world: {
        sky: 0x3b5288,
        fog: 0x5b6fa4,
        // Closer than the ordinary 260/900, further than Halloween's: falling
        // snow is haze, and a little of it in the distance sells the weather.
        fogNear: 200,
        fogFar: 760,

        // Bounced light off snow is cool and strong. The hemisphere's ground
        // colour is `terrainEdge` (see `three/scene.js`), and at its ordinary
        // dark green every underside on a white island came out green.
        ambient: 0xb4c6ee,
        ambientIntensity: 1.3,
        // A low, warm sun at the end of the day: the snow faces it catch go
        // peach and the faces away from it stay blue, which is what reads as
        // a winter evening rather than as a grey one.
        sun: 0xffcf9e,
        sunIntensity: 1.55,
        sunPosition: [-55, 34, 40],

        water: 0x3e6ea6,
        waterDeep: 0x264b7c,
        waterShallow: 0x6d9fcf,
        waterFoam: 0xf4f9ff,

        terrain: 0xeef3f9,
        terrainEdge: 0x8d9bb8,
        cliff: 0x9a8a7c,
        // The road keeps its three colours, as in every season: the brown
        // outline is what already carries it over the summit's snow.
      },

      biomes: {
        meadow: {
          // Snow over a meadow: the faintest green-blue in the alternate tone,
          // so it is not the same white as the summit's.
          ground: 0xf1f5fa,
          groundAlt: 0xdbe7ee,
          foliage: 0x2f6b4f,
          foliageAlt: 0x3d7d5c,
        },
        desert: {
          // Snow over sand is warmer: a cream-white, with the orange cliffs
          // under it doing the rest.
          ground: 0xf4efe7,
          groundAlt: 0xe6dccd,
          foliage: 0x4f9455,
          foliageAlt: 0x3f7d46,
        },
        summit: {
          // Already snow. Brighter and a touch bluer, so it is still the
          // coldest of the three.
          ground: 0xf5f9fd,
          groundAlt: 0xd8e5f2,
        },
      },

      backdrop: {
        meadow: [0xcbd8ec, 0xb6c7e2, 0xdde6f3],
        desert: [0xe2dbe8, 0xcfc8e2, 0xece4ee],
        summit: [0xc2d1ea, 0xb1c0df, 0xd6e0f1],
      },

      clouds: {
        light: 0xffffff,
        shade: 0xd8e3f4,
      },
    },
  },
}

/**
 * The seasons a teacher can put on the calendar, in the order `/admin` lists
 * them. `default` is not one: it is what the island is when nothing matches.
 */
export const CALENDAR_SEASONS = ['halloween', 'christmas']

/**
 * THE SEASON CALENDAR: "Halloween runs from this day to that one, every year".
 *
 * Marc, 22 November 2026: "que en el menú de administración pudiésemos
 * determinar cuándo empieza Halloween, cuándo acaba... y que no tuviera que
 * pedírtelo yo para que cambiara el estado del mapa." So the season is no
 * longer a word somebody edits before a deploy. It is worked out from the
 * date, on every load, in every browser.
 *
 * WHERE IT LIVES. `public/progress.json`, field `seasons`, next to the class
 * timetable: teacher state, written from `/admin`, read by everyone. It is
 * NOT map data, so the no-dates rule on `levels.json` is untouched.
 *
 * WHY IT IS BAKED INTO THE BUNDLE rather than fetched. A season is a patch
 * laid over `theme.js` WHILE THAT MODULE IS EVALUATING (see `applySeason`),
 * before any mesh exists, so it has to be known synchronously; a fetch would
 * arrive after the island is built. `vite.config.js` reads the field at build
 * time into `__SEASON_CALENDAR__`. That costs nothing in practice: every save
 * from `/admin` is a commit to `main`, and every commit to `main` rebuilds the
 * site. What is baked is the CALENDAR, not the season, so the switch itself
 * still happens on the day with no deploy at all.
 *
 * RECURRING, MONTH AND DAY ONLY. "Del 20 de octubre al 2 de noviembre" is
 * true every year, so there is no year to type and nothing to renew. A range
 * may wrap the new year (Christmas runs into January). Both ends are
 * inclusive, and days are Madrid days, the same clock the timetable uses.
 *
 * @typedef {{season: string, from: string, to: string}} SeasonRange
 *   `from` / `to` are "MM-DD"
 */

/** The calendar this build was made with. Absent under Node: no seasons. */
export const SEASON_CALENDAR =
  // eslint-disable-next-line no-undef
  typeof __SEASON_CALENDAR__ !== 'undefined' && Array.isArray(__SEASON_CALENDAR__)
    ? // eslint-disable-next-line no-undef
      __SEASON_CALENDAR__
    : []

const MD = /^(\d{2})-(\d{2})$/
const DAYS_IN = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

/** "MM-DD" -> 101..1231, or NaN. 29 February is allowed; it simply never comes in some years. */
function mdNumber(md) {
  const m = MD.exec(String(md ?? ''))
  if (!m) return NaN
  const month = +m[1]
  const day = +m[2]
  if (month < 1 || month > 12 || day < 1 || day > DAYS_IN[month - 1]) return NaN
  return month * 100 + day
}

/** Is month-day `n` inside the inclusive range, wrapping over the new year? */
function inRange(n, from, to) {
  return from <= to ? n >= from && n <= to : n >= from || n <= to
}

/** Today's month-day in Madrid, as 101..1231. */
export function madridMonthDay(epochMs = Date.now()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Madrid',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(epochMs))
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]))
  return +p.month * 100 + +p.day
}

/**
 * Every reason a calendar would misbehave, in words a teacher can act on.
 *
 * Used by `/admin` BEFORE saving and by `validate` on every build, so the two
 * cannot disagree. An empty list means it is fine. Overlaps are an error,
 * not a tie-break: two seasons claiming the same day would make one of them
 * silently never appear, which looks exactly like the feature not working.
 *
 * @param {SeasonRange[]} calendar
 * @returns {string[]}
 */
export function checkSeasonCalendar(calendar) {
  const errors = []
  if (calendar == null) return errors
  if (!Array.isArray(calendar)) return ['seasons: debe ser una lista']
  const ranges = []
  calendar.forEach((r, i) => {
    const where = `seasons[${i}]`
    if (!r || typeof r !== 'object') {
      errors.push(`${where}: no es una entrada`)
      return
    }
    if (!CALENDAR_SEASONS.includes(r.season)) {
      errors.push(`${where}: temporada desconocida "${r.season}"`)
      return
    }
    const from = mdNumber(r.from)
    const to = mdNumber(r.to)
    if (Number.isNaN(from)) errors.push(`${r.season}: fecha de inicio ilegible "${r.from}"`)
    if (Number.isNaN(to)) errors.push(`${r.season}: fecha de fin ilegible "${r.to}"`)
    if (!Number.isNaN(from) && !Number.isNaN(to)) ranges.push({ season: r.season, from, to })
  })
  for (let a = 0; a < ranges.length; a++) {
    for (let b = a + 1; b < ranges.length; b++) {
      const A = ranges[a]
      const B = ranges[b]
      if (
        inRange(B.from, A.from, A.to) || inRange(B.to, A.from, A.to) ||
        inRange(A.from, B.from, B.to)
      ) {
        errors.push(`${A.season} y ${B.season} se solapan`)
      }
    }
  }
  return errors
}

/**
 * Which season the calendar puts on a given day, or null for none.
 *
 * @param {SeasonRange[]} calendar
 * @param {number} [epochMs]
 */
export function seasonForDate(calendar, epochMs = Date.now()) {
  if (!Array.isArray(calendar)) return null
  const today = madridMonthDay(epochMs)
  for (const r of calendar) {
    if (!r || !CALENDAR_SEASONS.includes(r.season)) continue
    const from = mdNumber(r.from)
    const to = mdNumber(r.to)
    if (Number.isNaN(from) || Number.isNaN(to)) continue
    if (inRange(today, from, to)) return r.season
  }
  return null
}

/**
 * The next day a season starts, for `/admin` to say "Navidad empieza en 9
 * días". Looks a year ahead and no further.
 *
 * @returns {{season: string, inDays: number} | null}
 */
export function nextSeasonStart(calendar, epochMs = Date.now()) {
  if (!Array.isArray(calendar) || !calendar.length) return null
  const DAY = 86400000
  for (let d = 1; d <= 366; d++) {
    const s = seasonForDate(calendar, epochMs + d * DAY)
    if (s && s !== seasonForDate(calendar, epochMs + (d - 1) * DAY)) return { season: s, inDays: d }
  }
  return null
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
  // 1. A preview link always wins: `?season=christmas` shows it today.
  try {
    if (typeof window !== 'undefined' && window.location) {
      const asked = new URLSearchParams(window.location.search).get('season')
      if (asked && Object.hasOwn(SEASONS, asked)) return asked
    }
  } catch {
    /* no URL here — fall through to the calendar */
  }
  // 2. The calendar published from /admin, read against today's date. Only in
  //    a browser: under Node (validate, the deck build) there is no calendar
  //    and the island is checked as the ordinary one.
  const dated = seasonForDate(SEASON_CALENDAR)
  if (dated && Object.hasOwn(SEASONS, dated)) return dated
  // 3. The constant, which is now only the fallback for "no season today".
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
