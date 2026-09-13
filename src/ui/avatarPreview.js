import { optionFor } from '../lib/avatar.js'

/**
 * The little figure at the top of the wardrobe panel.
 *
 * AN SVG, NOT A SECOND THREE.JS SCENE. A preview big enough to read is about
 * 70px tall, and a WebGL view of it would cost a second renderer, a second
 * scene and a second render loop running next to the island — against the
 * project's first rule. A front elevation is all a wardrobe needs anyway:
 * every slot except the hat is a colour, and a colour reads the same flat.
 *
 * THE BOXES ARE THE AVATAR'S OWN. Every rectangle below is the `w, h, x, y`
 * of the matching box in `three/player.js`, in the same model units, so the
 * proportions are the figure's rather than a drawing of it — and a hat comes
 * straight out of `SLOTS`, which is what makes a seasonal extra appear here
 * with no change: a tall `box` draws a tall hat because it IS the tall box.
 */

/** Model space: x across, y up, matching `three/player.js`. */
const SKIN = '#ffd9b3'
const SHELL = '#22272e'
const STRAP = '#3b434d'

const hex = (n) => `#${n.toString(16).padStart(6, '0')}`

/** One box, in model coordinates. The group below flips y, so y is up here. */
const box = (w, h, x, y, fill) =>
  `<rect x="${(x - w / 2).toFixed(3)}" y="${(y - h / 2).toFixed(3)}" ` +
  `width="${w.toFixed(3)}" height="${h.toFixed(3)}" rx="0.05" fill="${fill}"/>`

/**
 * @param {Record<string,string>} look
 * @returns {string} an `<svg>` element, ready to drop into the panel
 */
export function avatarPreview(look) {
  const shirt = hex(optionFor('shirt', look).color)
  const trousers = hex(optionFor('trousers', look).color)
  const shoes = hex(optionFor('shoes', look).color)
  const lens = hex(optionFor('visor', look).color)

  const hat = optionFor('hat', look)
  // `color: null` means "match the shirt" — the same rule `applyLook` follows.
  const hatBox = hat?.box
    ? box(hat.box[0], hat.box[1], hat.box[3], hat.box[4], hat.color == null ? shirt : hex(hat.color))
    : ''

  // Back to front, so the headset lands on the face and the hat on top.
  const parts = [
    box(0.3, 0.65, -0.68, 1.15, SKIN), // arms
    box(0.3, 0.65, 0.68, 1.15, SKIN),
    box(0.86, 0.42, 0, 0.5, trousers), // legs
    box(0.34, 0.22, -0.34, 0.15, shoes), // shoes
    box(0.34, 0.22, 0.34, 0.15, shoes),
    box(1.1, 1.0, 0, 1.05, shirt), // torso
    box(0.9, 0.8, 0, 1.95, SKIN), // head
    box(1.02, 0.2, 0, 2.16, STRAP), // headset strap
    box(1.0, 0.52, 0, 1.98, SHELL), // visor shell — never optional
    box(0.78, 0.3, 0, 1.99, lens), // the one part of the headset that is a choice
    hatBox,
  ].join('')

  // viewBox spans the widest part (the arms, ±0.83) and the tallest hat.
  return (
    `<svg class="avatar-figure" viewBox="-1.05 0 2.1 3.25" aria-hidden="true">` +
    `<g transform="translate(0,3.25) scale(1,-1)">${parts}</g>` +
    `</svg>`
  )
}
