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

const STORE_KEY = 'xrisland:avatar'

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
    ],
  },
]

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
