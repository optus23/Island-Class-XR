/**
 * What the student's own avatar looks like.
 *
 * PER STUDENT, IN THEIR OWN BROWSER. This is `localStorage` and nothing else:
 * no backend to hold it, no file in the repository, and nothing about it ever
 * reaches the teacher or another student. Two people on the same map see
 * their own figure their own way, and that is the whole feature.
 *
 * THE HEADSET NEVER COMES OFF, and that is not an oversight. The avatar is
 * the one figure the viewer drives, and it is told apart from the honoured
 * students pacing the discs by exactly two things: its silhouette and its
 * visor (see `villagers.js` — no villager may wear either). Let someone take
 * the headset off and pick a villager-ish shirt and they have made a second
 * classmate out of themselves. The lens COLOUR is a choice; the headset is
 * not. It is an XR course.
 *
 * ADDING A SEASONAL EXTRA IS ONE LINE. A pumpkin for Halloween or a santa hat
 * in December goes in the `hat` list below and appears in the picker with no
 * other change. That was asked for by name — "como sorpresa para la clase".
 */

import { activeSeason } from '../config/seasons.js'

const STORE_KEY = 'xrisland:avatar'

/**
 * THE SEASONAL WARDROBE. Marc, 22 November 2026: a pumpkin for your head at
 * Halloween, and a Santa hat, a Christmas jacket and elf boots at Christmas,
 * "un apartado de Navidad y de Halloween".
 *
 * An option carrying `season` is in the picker only while that season is on
 * the island, and comes back by itself the next year. Its `boxes` are extra
 * parts in the avatar's own model space ([w, h, d, x, y, z, colour], the frame
 * of `three/player.js`), so a piece can be more than a colour: a belt, a fur
 * hem, a curled toe. A browser still wearing one after the season ends simply
 * falls back to the first option, which `loadLook` already did for a hat that
 * had been taken out.
 *
 * NOTHING HERE MAY COVER THE VISOR. The headset is the one thing that tells
 * the avatar apart from the villagers (see the top of this file), so every
 * seasonal hat starts above the strap, at y 2.3, and the pumpkin sits ON the
 * head like a hat rather than over it like a helmet.
 */
const PUMPKIN = 0xe07020
const PUMPKIN_RIB = 0xb8541a
const PUMPKIN_GLOW = 0xffe9a3
const WITCH = 0x2a2238
const WITCH_BAND = 0x7b2fbe
const XMAS_RED = 0xc8102e
const XMAS_GREEN = 0x1f6b45
const ELF_GREEN = 0x2a8a4a
const FUR = 0xf7f9fc
const GOLD = 0xf2c14e
const INK = 0x22272e

/**
 * Each slot is a list of choices. `id` is what gets stored, so renaming a
 * LABEL is safe and renaming an `id` is not — an unknown id falls back to the
 * first entry rather than to a missing hat.
 */
export const SLOTS = [
  {
    key: 'hat',
    labelKey: 'avatar.hat',
    options: [
      // `box` is w,h,d,x,y,z relative to the body; `null` is a bare head.
      { id: 'cap', labelKey: 'avatar.hat.cap', color: null, box: [1.15, 0.28, 0.95, 0, 2.42, 0.02] },
      { id: 'none', labelKey: 'avatar.hat.none', box: null },
      { id: 'beanie', labelKey: 'avatar.hat.beanie', color: 0x4361ee, box: [0.98, 0.42, 0.92, 0, 2.45, 0] },
      { id: 'tophat', labelKey: 'avatar.hat.tophat', color: 0x22272e, box: [0.7, 0.85, 0.7, 0, 2.72, 0] },
      { id: 'crown', labelKey: 'avatar.hat.crown', color: 0xf2c14e, box: [0.95, 0.34, 0.9, 0, 2.46, 0] },
      {
        id: 'pumpkin', labelKey: 'avatar.hat.pumpkin', season: 'halloween', color: PUMPKIN,
        boxes: [
          [1.1, 0.62, 1.0, 0, 2.64, 0, PUMPKIN],
          [0.12, 0.56, 1.04, -0.3, 2.64, 0, PUMPKIN_RIB],
          [0.12, 0.56, 1.04, 0.3, 2.64, 0, PUMPKIN_RIB],
          [0.16, 0.24, 0.16, 0, 3.06, 0, 0x4f6b32], // stalk
          [0.16, 0.14, 0.06, -0.24, 2.74, 0.52, PUMPKIN_GLOW], // carved face
          [0.16, 0.14, 0.06, 0.24, 2.74, 0.52, PUMPKIN_GLOW],
          [0.46, 0.1, 0.06, 0, 2.52, 0.52, PUMPKIN_GLOW],
        ],
      },
      {
        id: 'witch', labelKey: 'avatar.hat.witch', season: 'halloween', color: WITCH,
        boxes: [
          [1.4, 0.1, 1.3, 0, 2.4, 0, WITCH], // brim
          [0.8, 0.4, 0.75, 0, 2.64, 0, WITCH],
          [0.84, 0.1, 0.79, 0, 2.5, 0, WITCH_BAND],
          [0.55, 0.35, 0.5, 0, 2.99, -0.05, WITCH],
          [0.32, 0.32, 0.3, 0, 3.3, -0.16, WITCH], // the tip, bent back
          [0.18, 0.2, 0.18, 0, 3.52, -0.3, WITCH],
        ],
      },
      {
        id: 'santa', labelKey: 'avatar.hat.santa', season: 'christmas', color: XMAS_RED,
        boxes: [
          [1.08, 0.22, 0.98, 0, 2.45, 0, FUR], // brim
          [0.86, 0.32, 0.8, 0, 2.7, -0.02, XMAS_RED],
          [0.6, 0.26, 0.56, 0.04, 2.97, -0.12, XMAS_RED],
          [0.36, 0.22, 0.34, 0.16, 3.16, -0.26, XMAS_RED], // flopping over
          [0.28, 0.28, 0.28, 0.36, 3.12, -0.4, FUR], // bobble
        ],
      },
      {
        id: 'elf', labelKey: 'avatar.hat.elf', season: 'christmas', color: ELF_GREEN,
        boxes: [
          [1.0, 0.16, 0.94, 0, 2.42, 0, XMAS_RED],
          [0.82, 0.3, 0.78, 0, 2.64, 0, ELF_GREEN],
          [0.56, 0.3, 0.52, 0, 2.92, -0.06, ELF_GREEN],
          [0.34, 0.28, 0.32, 0, 3.2, -0.14, ELF_GREEN],
          [0.2, 0.24, 0.2, 0, 3.44, -0.22, ELF_GREEN],
          [0.17, 0.17, 0.17, 0, 3.62, -0.24, GOLD], // bell
        ],
      },
    ],
  },
  {
    key: 'visor',
    labelKey: 'avatar.visor',
    options: [
      { id: 'cyan', labelKey: 'avatar.visor.cyan', color: 0x4cc9f0 },
      { id: 'green', labelKey: 'avatar.visor.green', color: 0x38b000 },
      { id: 'magenta', labelKey: 'avatar.visor.magenta', color: 0xff5dae },
      { id: 'amber', labelKey: 'avatar.visor.amber', color: 0xffb703 },
    ],
  },
  {
    key: 'shirt',
    labelKey: 'avatar.shirt',
    options: [
      { id: 'red', labelKey: 'avatar.colour.red', color: 0xef476f },
      { id: 'blue', labelKey: 'avatar.colour.blue', color: 0x4361ee },
      { id: 'green', labelKey: 'avatar.colour.green', color: 0x38b000 },
      { id: 'purple', labelKey: 'avatar.colour.purple', color: 0x9d4edd },
      { id: 'orange', labelKey: 'avatar.colour.orange', color: 0xf77f00 },
      {
        id: 'skeleton', labelKey: 'avatar.shirt.skeleton', season: 'halloween', color: 0x1d1826,
        boxes: [
          [0.1, 0.72, 0.04, 0, 1.08, 0.42, FUR], // spine
          [0.62, 0.08, 0.04, 0, 1.32, 0.42, FUR], // ribs
          [0.68, 0.08, 0.04, 0, 1.16, 0.42, FUR],
          [0.56, 0.08, 0.04, 0, 1.0, 0.42, FUR],
          [0.4, 0.08, 0.04, 0, 0.84, 0.42, FUR],
        ],
      },
      {
        id: 'santa', labelKey: 'avatar.shirt.santa', season: 'christmas', color: XMAS_RED,
        boxes: [
          [1.16, 0.16, 0.86, 0, 0.62, 0, FUR], // fur hem
          [1.14, 0.14, 0.84, 0, 0.88, 0, INK], // belt
          [0.24, 0.16, 0.04, 0, 0.88, 0.43, GOLD], // buckle
          [0.16, 0.6, 0.04, 0, 1.22, 0.41, FUR], // fur down the front
          [0.98, 0.14, 0.7, 0, 1.52, 0, FUR], // collar
          [0.34, 0.12, 0.34, -0.68, 0.88, 0, FUR], // cuffs
          [0.34, 0.12, 0.34, 0.68, 0.88, 0, FUR],
        ],
      },
    ],
  },
  {
    key: 'trousers',
    labelKey: 'avatar.trousers',
    options: [
      { id: 'navy', labelKey: 'avatar.colour.navy', color: 0x3a4a5c },
      { id: 'grey', labelKey: 'avatar.colour.grey', color: 0x6c757d },
      { id: 'sand', labelKey: 'avatar.colour.sand', color: 0xc9a227 },
      { id: 'maroon', labelKey: 'avatar.colour.maroon', color: 0x7d3823 },
    ],
  },
  {
    key: 'shoes',
    labelKey: 'avatar.shoes',
    options: [
      { id: 'black', labelKey: 'avatar.colour.black', color: 0x2b2118 },
      { id: 'white', labelKey: 'avatar.colour.white', color: 0xe8e3d8 },
      { id: 'red', labelKey: 'avatar.colour.red', color: 0xef476f },
      { id: 'brown', labelKey: 'avatar.colour.brown', color: 0x8b5e34 },
      {
        id: 'elf', labelKey: 'avatar.shoes.elf', season: 'christmas', color: XMAS_GREEN,
        boxes: [-0.34, 0.34].flatMap((x) => [
          [0.38, 0.12, 0.4, x, 0.3, 0.05, XMAS_RED], // cuff
          [0.22, 0.14, 0.22, x, 0.2, 0.3, XMAS_GREEN], // long toe
          [0.14, 0.14, 0.14, x, 0.33, 0.38, XMAS_GREEN], // curling up
          [0.1, 0.1, 0.1, x, 0.45, 0.38, GOLD], // and a bell on it
        ]),
      },
    ],
  },
]

/**
 * Seasonal options are dropped here, ONCE, so everything downstream (the
 * picker's rows, `cycle`, `optionFor`, the default look) only ever sees what
 * is wearable today and none of it needs to know seasons exist.
 */
for (const slot of SLOTS) {
  slot.options = slot.options.filter((o) => !o.season || o.season === activeSeason)
}

/**
 * Every box the wardrobe adds to the bare figure, resolved: the hat (a plain
 * `box` or a seasonal `boxes` list) and the extras of every other slot.
 * `color: null` on a hat still means "match the shirt", the original cap's
 * rule. `three/player.js` builds these and `ui/avatarPreview.js` draws them,
 * from this one list, so the map and the wardrobe cannot disagree.
 *
 * @returns {Array<[number, number, number, number, number, number, number]>}
 */
export function lookBoxes(look) {
  const out = []
  const shirt = optionFor('shirt', look).color
  const hat = optionFor('hat', look)
  if (hat?.box) {
    const [w, h, d, x, y, z] = hat.box
    out.push([w, h, d, x, y, z, hat.color ?? shirt])
  }
  for (const slot of SLOTS) {
    const o = optionFor(slot.key, look)
    if (o?.boxes) out.push(...o.boxes)
  }
  return out
}

/** The look a browser that has never touched the picker gets. */
export const DEFAULT_LOOK = Object.fromEntries(SLOTS.map((s) => [s.key, s.options[0].id]))

/** The chosen option object for one slot, never undefined. */
export function optionFor(slotKey, look) {
  const slot = SLOTS.find((s) => s.key === slotKey)
  if (!slot) return null
  return slot.options.find((o) => o.id === look?.[slotKey]) ?? slot.options[0]
}

export function loadLook() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}')
    // Rebuilt key by key rather than spread, so a stored id that no longer
    // exists (a seasonal hat that has been taken back out) falls back to the
    // default instead of leaving that slot blank.
    return Object.fromEntries(SLOTS.map((s) => [s.key, optionFor(s.key, saved).id]))
  } catch {
    return { ...DEFAULT_LOOK }
  }
}

export function saveLook(look) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(look))
  } catch {
    /* private window, or storage disabled: the look still applies this visit */
  }
}

/** Next/previous choice in a slot, wrapping around. */
export function cycle(slotKey, look, step) {
  const slot = SLOTS.find((s) => s.key === slotKey)
  if (!slot) return look
  const i = slot.options.findIndex((o) => o.id === look[slotKey])
  const next = slot.options[(i + step + slot.options.length) % slot.options.length]
  return { ...look, [slotKey]: next.id }
}
