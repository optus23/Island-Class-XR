import * as THREE from 'three'
import { hash2, CELL_AREA_SCALE, groundHeightAt, nearestPath, landInset } from './terrain.js'
import { distributeNodes, flatness } from './paths.js'
import { worlds } from '../config/worlds.js'
import { levelsForWorld } from '../lib/levels.js'
import { biomes } from '../config/theme.js'
import { seasonFlags } from '../config/seasons.js'

/**
 * Voxel set dressing.
 *
 * Every prop is a RECIPE: a list of boxes in local space. All of them — every
 * part of every prop of every kind — are baked into a single InstancedMesh of
 * unit cubes with per-instance colour and scale.
 *
 * That inversion is what lets the props be detailed. Previously each part kind
 * needed its own mesh, so more detail meant more draw calls and the props had
 * to stay crude. Here a twenty-box mushroom costs twenty instances and no
 * extra draw call, so detail is essentially free.
 *
 * Local axes: +y up, +z toward the camera side. Sizes and offsets are in world
 * units; y offsets are measured from the ground the prop stands on.
 */

/** @typedef {{x:number,y:number,z:number,w:number,h:number,d:number,c:number}} Part */
const part = (x, y, z, w, h, d, c) => ({ x, y, z, w, h, d, c })

const BARK = 0x6f4a2a
const BARK_DARK = 0x573719
const SNOW = 0xf2f7fb

/**
 * Halloween dressing. These live here beside the other prop constants rather
 * than in `theme.js` because they belong to a RECIPE, the way `BARK` does —
 * `theme.js` owns the colours the map MEANS something with, and a pumpkin
 * means nothing. The season that plants them is decided in `config/seasons.js`.
 */
/**
 * Dead bark, and it is LIGHTER than the first attempt rather than darker.
 *
 * A bare tree has no canopy to catch the moon, so against dark ground a dark
 * trunk is simply not there — the first pass came out as black specks that
 * read as litter scattered over the island rather than as a wood. The branches
 * are a shade lighter again than the trunk, which is what gives a leafless
 * silhouette any shape at all at map distance.
 */
const DEAD_BARK = 0x6b5748
const DEAD_BARK_LIGHT = 0x8a7462
const PUMPKIN = 0xe07020
const PUMPKIN_RIB = 0xb8541a
const PUMPKIN_STALK = 0x4f6b32
/** Near-white yellow: the carved face, and the only thing that reads as lit. */
const PUMPKIN_GLOW = 0xffe9a3
/** The lamppost's ironwork, and the warm pane inside its head. */
const LAMP_IRON = 0x2a2531
const LAMP_IRON_DARK = 0x1b1821
const LAMP_PANE = 0xffd98a
/** The dim spill on the ground beneath a lit one. */
const PUMPKIN_POOL = 0x8a6a35

/**
 * Christmas dressing. Same reasoning as Halloween's: these belong to a recipe,
 * not to what the map means, so they live here and not in `theme.js`.
 *
 * NO GREEN THAT COULD BE `palette.completed`, and no gift in the lilac the
 * optional nodes use. A present the colour of a completed session, standing
 * next to the road, is a second signal saying something it does not mean. The
 * greens below are pine and holly greens, darker and bluer than 0x38b000.
 */
const XMAS_RED = 0xc8102e
const XMAS_RED_DARK = 0x9b0d24
const XMAS_GREEN = 0x1f6b45
const XMAS_GREEN_DARK = 0x16523a
const XMAS_GOLD = 0xf2c14e
const XMAS_WHITE = 0xf7f9fc
const XMAS_BLUE = 0x2f5fb3
/** The star on a tree and the bulbs: near-white warm, the colour that reads as lit. */
const XMAS_STAR = 0xffe27a
const BULBS = [0xff4d4d, 0xffd24a, 0x5ec8ff, 0xff8fd0, 0xfff3c4]
const SNOWMAN = 0xf4f7fb
const SNOWMAN_SHADE = 0xdfe7f1
const COAL = 0x22272e
const CARROT = 0xf27a1a

/** One wrapped present: box, ribbon round both axes, and a bow on top. */
function gift(size, box, ribbon, y0 = 0, ox = 0, oz = 0) {
  const h = size * 0.82
  const y = y0 + h / 2
  return [
    part(ox, y, oz, size, h, size, box),
    part(ox, y, oz, size + 0.04, h + 0.04, size * 0.2, ribbon),
    part(ox, y, oz, size * 0.2, h + 0.04, size + 0.04, ribbon),
    // The bow: two loops either side of a knot, so it reads from above too.
    part(ox - size * 0.17, y0 + h + 0.09, oz, size * 0.26, 0.18, size * 0.22, ribbon),
    part(ox + size * 0.17, y0 + h + 0.09, oz, size * 0.26, 0.18, size * 0.22, ribbon),
    part(ox, y0 + h + 0.06, oz, size * 0.14, 0.14, size * 0.14, ribbon),
  ]
}

/**
 * A tiered pine with snow lying on every tier. The plain pine has one snow
 * shelf; a snowed-in island wants every ledge white, which is also what keeps
 * a forest of them from reading as dark blots on white ground.
 */
function snowyPine(b, tall = 1) {
  const t = tall
  return [
    part(0, 0.8 * t, 0, 0.6, 1.6 * t, 0.6, BARK_DARK),
    part(0, 2.0 * t, 0, 2.8, 1.1 * t, 2.8, b.foliage),
    part(0, 2.6 * t, 0, 2.9, 0.16, 2.9, SNOW),
    part(0, 3.05 * t, 0, 2.15, 1.0 * t, 2.15, b.foliage),
    part(0, 3.6 * t, 0, 2.25, 0.16, 2.25, SNOW),
    part(0, 3.95 * t, 0, 1.5, 0.9 * t, 1.5, b.foliageAlt),
    part(0, 4.45 * t, 0, 1.6, 0.15, 1.6, SNOW),
    part(0, 4.7 * t, 0, 0.9, 0.75 * t, 0.9, b.foliageAlt),
    part(0, 5.2 * t, 0, 0.55, 0.45, 0.55, SNOW),
  ]
}

/** Four spots on a mushroom cap, and similar rings elsewhere. */
function ring(y, radius, size, colour, count = 4, phase = 0) {
  const out = []
  for (let i = 0; i < count; i++) {
    const a = phase + (i / count) * Math.PI * 2
    out.push(part(Math.cos(a) * radius, y, Math.sin(a) * radius, size, size, size, colour))
  }
  return out
}

const RECIPES = {
  // --- vegetation ---------------------------------------------------------
  treeLeafy: (b) => [
    part(0, 1.0, 0, 0.7, 2.0, 0.7, BARK),
    part(0.36, 1.5, 0, 0.5, 0.35, 0.5, BARK_DARK), // stub branch
    part(0, 2.75, 0, 3.2, 1.3, 3.2, b.foliage),
    part(0, 3.75, 0, 2.5, 1.0, 2.5, b.foliage),
    part(0, 4.5, 0, 1.5, 0.8, 1.5, b.foliageAlt),
    // Highlight and shade blocks give the canopy a readable silhouette.
    part(-1.1, 2.9, -1.1, 1.0, 0.7, 1.0, b.foliageAlt),
    part(1.2, 3.4, 0.9, 0.8, 0.6, 0.8, b.foliageAlt),
  ],

  pine: (b) => [
    part(0, 0.8, 0, 0.6, 1.6, 0.6, BARK_DARK),
    part(0, 2.0, 0, 2.7, 1.1, 2.7, b.foliage),
    part(0, 3.0, 0, 2.1, 1.0, 2.1, b.foliage),
    part(0, 3.9, 0, 1.5, 0.9, 1.5, b.foliageAlt),
    part(0, 4.6, 0, 0.9, 0.8, 0.9, b.foliageAlt),
    part(0, 5.15, 0, 0.5, 0.5, 0.5, SNOW),
    part(0, 3.05, 0, 2.2, 0.18, 2.2, SNOW), // snow shelf
  ],

  /**
   * The Halloween tree: a winter skeleton, no canopy at all.
   *
   * "Árboles tenebrosos, estilo árboles de invierno." The scare comes from the
   * SILHOUETTE, so the whole recipe is trunk and bare branches and there is no
   * foliage block anywhere in it — one leafy cube at the top and it stops
   * reading as dead and starts reading as a tree that lost an argument.
   *
   * The branches are deliberately asymmetric and at odd heights. A voxel tree
   * built symmetrically reads as a lamppost; the island's one rule about
   * grid alignment (see the boulders) applies here too, and `planProps`
   * already gives every prop a yaw of its own.
   */
  deadTree: () => [
    part(0, 2.0, 0, 0.8, 4.0, 0.8, DEAD_BARK), // trunk
    part(0, 4.5, 0, 0.62, 1.4, 0.62, DEAD_BARK), // upper trunk, thinner
    // Lower limbs: out, then up. Thick enough to survive being a few pixels.
    part(-1.0, 3.1, 0.12, 1.5, 0.36, 0.36, DEAD_BARK),
    part(-1.68, 3.85, 0.12, 0.34, 1.6, 0.34, DEAD_BARK),
    part(-2.15, 4.6, 0.12, 1.0, 0.3, 0.3, DEAD_BARK_LIGHT),
    part(0.95, 3.8, -0.18, 1.4, 0.34, 0.34, DEAD_BARK),
    part(1.55, 4.65, -0.18, 0.32, 1.7, 0.32, DEAD_BARK),
    part(2.0, 5.5, -0.18, 0.9, 0.28, 0.28, DEAD_BARK_LIGHT),
    // A second, shorter pair the other way, so the crown has width from any
    // angle — one pair alone reads as a signpost when the yaw happens to put
    // it edge-on to the camera.
    part(0.2, 2.6, 0.95, 0.3, 0.3, 1.3, DEAD_BARK),
    part(0.2, 3.3, 1.5, 0.28, 1.2, 0.28, DEAD_BARK_LIGHT),
    part(-0.25, 3.0, -0.9, 0.3, 0.3, 1.2, DEAD_BARK),
    part(-0.25, 3.7, -1.4, 0.26, 1.1, 0.26, DEAD_BARK_LIGHT),
    // A crooked top fork, so the crown is never flat.
    part(-0.4, 5.6, 0, 0.3, 1.3, 0.3, DEAD_BARK_LIGHT),
    part(0.42, 5.4, 0.25, 0.28, 1.1, 0.28, DEAD_BARK_LIGHT),
    part(-0.75, 6.4, 0, 0.7, 0.24, 0.24, DEAD_BARK_LIGHT),
  ],

  /**
   * A jack-o'-lantern, unlit: the one that is just a pumpkin in the grass.
   *
   * Low and wide, with the ribs a shade darker — at the distance the follow
   * camera sits at, a plain orange cube is a crate, and the ribs are what say
   * pumpkin. The stalk is what says it from directly above.
   */
  pumpkin: () => [
    part(0, 0.42, 0, 1.25, 0.85, 1.25, PUMPKIN),
    part(-0.62, 0.42, 0, 0.22, 0.72, 1.0, PUMPKIN_RIB),
    part(0.62, 0.42, 0, 0.22, 0.72, 1.0, PUMPKIN_RIB),
    part(0, 0.42, 0.62, 1.0, 0.72, 0.22, PUMPKIN_RIB),
    part(0, 0.95, 0, 0.26, 0.3, 0.26, PUMPKIN_STALK),
  ],

  /**
   * And the lit one. "Unas sí, otras no" — `planProps` decides which by hash,
   * so the mix is stable across reloads like everything else on this island.
   *
   * THE GLOW IS A COLOUR, NOT A LIGHT. A real PointLight per pumpkin would be
   * a per-fragment cost across the whole terrain mesh for a prop that exists
   * by the dozen, and the scene budget is the first rule in CLAUDE.md. A
   * near-white yellow on an unshaded face reads as lit against a night this
   * dark, and costs exactly what the unlit one costs.
   */
  pumpkinLit: () => [
    part(0, 0.42, 0, 1.25, 0.85, 1.25, PUMPKIN),
    part(-0.62, 0.42, 0, 0.22, 0.72, 1.0, PUMPKIN_RIB),
    part(0.62, 0.42, 0, 0.22, 0.72, 1.0, PUMPKIN_RIB),
    part(0, 0.95, 0, 0.26, 0.3, 0.26, PUMPKIN_STALK),
    // The carved face, proud of the front so it catches no shadow from the body.
    part(-0.3, 0.52, 0.66, 0.26, 0.26, 0.14, PUMPKIN_GLOW), // left eye
    part(0.3, 0.52, 0.66, 0.26, 0.26, 0.14, PUMPKIN_GLOW), // right eye
    part(0, 0.26, 0.66, 0.62, 0.2, 0.14, PUMPKIN_GLOW), // grin
    part(-0.34, 0.38, 0.66, 0.16, 0.14, 0.14, PUMPKIN_GLOW), // its corners, turned up
    part(0.34, 0.38, 0.66, 0.16, 0.14, 0.14, PUMPKIN_GLOW),
    // A pool of light on the ground under it. Flat, wide and dim: this is the
    // cheap stand-in for the lamp that is not there.
    part(0, 0.02, 0.1, 2.0, 0.04, 2.0, PUMPKIN_POOL),
  ],

  /**
   * A roadside lamppost. Halloween only, and the only prop on the island that
   * exists to BE a light rather than to be looked at.
   *
   * Thin on purpose: it stands closer to the road than any other prop, so a
   * wide one would read as something dumped on the verge. The head is a dark
   * housing with a warm pane on all four sides, so it reads as lit from every
   * angle the follow camera can reach — a pane on the front alone goes dark
   * exactly when you orbit round to look at it.
   *
   * `planLamps` puts the matching PointLight at the head's height; see
   * `three/seasonLights.js` for why only a handful are ever lit at once.
   */
  lamppost: () => [
    part(0, 0.18, 0, 0.78, 0.36, 0.78, LAMP_IRON_DARK), // base
    part(0, 0.42, 0, 0.5, 0.2, 0.5, LAMP_IRON),
    part(0, 2.1, 0, 0.26, 3.4, 0.26, LAMP_IRON), // post
    part(0, 3.84, 0, 0.46, 0.12, 0.46, LAMP_IRON_DARK), // collar under the head
    // The head: a dark frame with a lit pane on each face.
    part(0, 4.26, 0, 0.62, 0.72, 0.62, LAMP_IRON_DARK),
    part(0, 4.26, 0.33, 0.42, 0.5, 0.06, LAMP_PANE),
    part(0, 4.26, -0.33, 0.42, 0.5, 0.06, LAMP_PANE),
    part(0.33, 4.26, 0, 0.06, 0.5, 0.42, LAMP_PANE),
    part(-0.33, 4.26, 0, 0.06, 0.5, 0.42, LAMP_PANE),
    part(0, 4.72, 0, 0.72, 0.2, 0.72, LAMP_IRON_DARK), // cap
    part(0, 4.88, 0, 0.18, 0.16, 0.18, LAMP_IRON), // finial
  ],

  // --- Christmas ---------------------------------------------------------

  /** The snowed-in pine, the island's ordinary tree in December. */
  pineSnowy: (b) => snowyPine(b),

  /**
   * The Christmas tree: a taller snowy pine wearing bulbs and a star.
   *
   * The bulbs ride the OUTSIDE of each tier, the lesson the toad house's
   * spots taught: set inside a box's half-width, a decoration is swallowed by
   * the box it decorates. Four per tier, a quarter-turn apart and offset per
   * tier, so from the follow camera there are always two or three in view.
   *
   * The star is the brightest thing on it and stands proud of the crown, so
   * it reads from across the island; `emittersFrom` hangs a real light there.
   */
  xmasTree: (b) => [
    ...snowyPine(b, 1.12),
    ...ring(2.25, 1.47, 0.34, BULBS[0], 2, 0.2),
    ...ring(2.25, 1.47, 0.34, BULBS[1], 2, 0.2 + Math.PI / 2),
    ...ring(3.42, 1.13, 0.3, BULBS[2], 2, 1.1),
    ...ring(3.42, 1.13, 0.3, BULBS[3], 2, 1.1 + Math.PI / 2),
    ...ring(4.42, 0.8, 0.28, BULBS[4], 2, 0.5),
    ...ring(4.42, 0.8, 0.28, BULBS[0], 2, 0.5 + Math.PI / 2),
    // A garland: a thin gold band round the middle tier.
    part(0, 3.15, 0, 2.24, 0.12, 2.24, XMAS_GOLD),
    // The star, in a plus shape so it reads as a star and not as a cube.
    part(0, 6.15, 0, 0.62, 0.62, 0.26, XMAS_STAR),
    part(0, 6.15, 0, 0.26, 0.62, 0.62, XMAS_STAR),
    part(0, 6.15, 0, 0.9, 0.2, 0.2, XMAS_STAR),
    part(0, 6.15, 0, 0.2, 0.9, 0.2, XMAS_STAR),
    part(0, 6.15, 0, 0.2, 0.2, 0.9, XMAS_STAR),
    // Presents under it, because that is where presents go.
    ...gift(0.8, XMAS_RED, XMAS_GOLD, 0, 1.25, 0.9),
    ...gift(0.62, XMAS_BLUE, XMAS_WHITE, 0, -1.2, 1.0),
  ],

  /** A cactus that has had a bad night: the same plant, snow on every top. */
  snowCactus: (b) => [
    part(0, 1.7, 0, 1.0, 3.4, 1.0, b.foliage),
    part(-0.85, 1.9, 0, 0.75, 0.75, 0.75, b.foliage),
    part(-1.15, 2.6, 0, 0.7, 1.4, 0.7, b.foliage),
    part(0.85, 2.5, 0, 0.75, 0.75, 0.75, b.foliage),
    part(1.15, 3.15, 0, 0.7, 1.2, 0.7, b.foliage),
    part(0, 1.7, 0.5, 0.25, 3.0, 0.25, b.foliageAlt),
    part(0, 3.5, 0, 1.08, 0.24, 1.08, SNOW),
    part(-1.15, 3.38, 0, 0.78, 0.2, 0.78, SNOW),
    part(1.15, 3.83, 0, 0.78, 0.2, 0.78, SNOW),
    // And somebody has given it a scarf.
    part(0, 2.9, 0, 1.1, 0.2, 1.1, XMAS_RED),
  ],

  /** Presents, one at a time or stacked. Low, and brightly wrapped. */
  giftRed: () => gift(1.0, XMAS_RED, XMAS_GOLD),
  giftGreen: () => gift(0.9, XMAS_GREEN, XMAS_RED),
  giftBlue: () => gift(0.95, XMAS_BLUE, XMAS_WHITE),
  giftStack: () => [
    ...gift(1.1, XMAS_WHITE, XMAS_RED),
    ...gift(0.72, XMAS_RED, XMAS_GOLD, 0.98, 0.06, -0.04),
    ...gift(0.6, XMAS_GREEN, XMAS_GOLD, 0, 0.95, 0.55),
  ],

  /**
   * A candy cane planted in the snow. The stripes are stacked boxes rather
   * than a texture: every colour on this island is a box, and a striped cube
   * stack is exactly what a voxel candy cane is. The hook turns toward +z,
   * which `planProps` then spins with the prop's own yaw.
   */
  candyCane: () => {
    const out = []
    const STRIPE = 0.32
    for (let i = 0; i < 8; i++) {
      out.push(part(0, STRIPE / 2 + i * STRIPE, 0, 0.3, STRIPE, 0.3, i % 2 ? XMAS_WHITE : XMAS_RED))
    }
    const top = 8 * STRIPE
    out.push(part(0, top + 0.15, 0.12, 0.3, 0.3, 0.54, XMAS_WHITE)) // the bend
    out.push(part(0, top + 0.15, 0.5, 0.3, 0.3, 0.3, XMAS_RED))
    out.push(part(0, top - 0.17, 0.62, 0.3, 0.34, 0.3, XMAS_WHITE)) // the hook, coming down
    out.push(part(0, top - 0.46, 0.62, 0.3, 0.24, 0.3, XMAS_RED))
    return out
  },

  /** A snowman: three balls, coal, a carrot, a scarf, a hat and two sticks. */
  snowman: () => [
    part(0, 0.75, 0, 1.6, 1.5, 1.6, SNOWMAN),
    part(0, 0.75, 0, 1.75, 1.2, 1.3, SNOWMAN_SHADE),
    part(0, 2.05, 0, 1.15, 1.1, 1.15, SNOWMAN),
    part(0, 2.95, 0, 0.82, 0.78, 0.82, SNOWMAN),
    part(0, 2.15, 0.6, 0.14, 0.14, 0.08, COAL), // buttons
    part(0, 1.85, 0.6, 0.14, 0.14, 0.08, COAL),
    part(-0.17, 3.05, 0.42, 0.12, 0.12, 0.06, COAL), // eyes
    part(0.17, 3.05, 0.42, 0.12, 0.12, 0.06, COAL),
    part(0, 2.9, 0.58, 0.14, 0.14, 0.4, CARROT),
    part(0, 2.55, 0, 0.98, 0.18, 0.98, XMAS_RED), // scarf
    part(0.32, 2.3, 0.45, 0.22, 0.48, 0.12, XMAS_RED),
    part(0, 3.42, 0, 0.92, 0.12, 0.92, COAL), // hat brim
    part(0, 3.72, 0, 0.6, 0.55, 0.6, COAL),
    part(0, 3.55, 0, 0.62, 0.12, 0.62, XMAS_RED),
    part(-0.95, 2.25, 0, 0.9, 0.1, 0.1, BARK_DARK), // stick arms
    part(0.95, 2.35, 0, 0.9, 0.1, 0.1, BARK_DARK),
    part(1.35, 2.52, 0, 0.1, 0.34, 0.1, BARK_DARK),
  ],

  /**
   * The Christmas lamppost: Halloween's post, wrapped like a candy cane, a
   * wreath under the head and a red bow on it. Same height, so the light
   * hangs where `emittersFrom` expects it.
   */
  xmasLamp: () => {
    const out = [
      part(0, 0.18, 0, 0.78, 0.36, 0.78, LAMP_IRON_DARK),
      part(0, 0.42, 0, 0.5, 0.2, 0.5, LAMP_IRON),
      part(0, 2.1, 0, 0.26, 3.4, 0.26, XMAS_WHITE),
    ]
    // Red ribbon wound up the post: bands slightly proud of it.
    for (let i = 0; i < 6; i++) out.push(part(0, 0.75 + i * 0.52, 0, 0.32, 0.17, 0.32, XMAS_RED))
    out.push(
      part(0, 3.84, 0, 0.46, 0.12, 0.46, LAMP_IRON_DARK),
      part(0, 4.26, 0, 0.62, 0.72, 0.62, LAMP_IRON_DARK),
      part(0, 4.26, 0.33, 0.42, 0.5, 0.06, LAMP_PANE),
      part(0, 4.26, -0.33, 0.42, 0.5, 0.06, LAMP_PANE),
      part(0.33, 4.26, 0, 0.06, 0.5, 0.42, LAMP_PANE),
      part(-0.33, 4.26, 0, 0.06, 0.5, 0.42, LAMP_PANE),
      part(0, 4.72, 0, 0.72, 0.2, 0.72, LAMP_IRON_DARK),
      part(0, 4.86, 0, 0.82, 0.16, 0.82, SNOW), // snow on the cap
      // The wreath, a ring of holly round the collar, with its bow.
      part(0, 3.62, 0, 0.78, 0.22, 0.78, XMAS_GREEN),
      part(0, 3.62, 0, 0.62, 0.26, 0.62, XMAS_GREEN_DARK),
      part(0, 3.5, 0.42, 0.3, 0.2, 0.08, XMAS_RED),
      part(-0.1, 3.36, 0.42, 0.08, 0.2, 0.06, XMAS_RED_DARK),
      part(0.1, 3.36, 0.42, 0.08, 0.2, 0.06, XMAS_RED_DARK),
    )
    return out
  },

  cactus: (b) => [
    part(0, 1.7, 0, 1.0, 3.4, 1.0, b.foliage),
    part(-0.85, 1.9, 0, 0.75, 0.75, 0.75, b.foliage),
    part(-1.15, 2.6, 0, 0.7, 1.4, 0.7, b.foliage),
    part(0.85, 2.5, 0, 0.75, 0.75, 0.75, b.foliage),
    part(1.15, 3.15, 0, 0.7, 1.2, 0.7, b.foliage),
    // Ribs, and a flower on top.
    part(0, 1.7, 0.5, 0.25, 3.0, 0.25, b.foliageAlt),
    part(0, 3.55, 0, 0.55, 0.35, 0.55, 0xff8fab),
  ],

  // --- Mario mushroom -----------------------------------------------------
  mushroom: () => [
    part(0, 0.65, 0, 1.1, 1.3, 1.1, 0xf7ead6),
    part(0, 1.55, 0, 2.8, 0.9, 2.8, 0xe63946),
    part(0, 2.25, 0, 2.0, 0.7, 2.0, 0xd62839),
    ...ring(1.62, 1.0, 0.62, 0xfff6ea, 4, Math.PI / 4),
    part(0, 2.62, 0, 0.9, 0.4, 0.9, 0xfff6ea),
    // Eyes, because it is a Mario mushroom and not a fungus.
    part(-0.38, 0.85, 0.58, 0.24, 0.42, 0.14, 0x22272e),
    part(0.38, 0.85, 0.58, 0.24, 0.42, 0.14, 0x22272e),
  ],

  // --- course-themed props ------------------------------------------------
  headset: () => [
    part(0, 0.75, 0, 0.4, 1.5, 0.4, 0x5b6672),
    part(0, 1.35, 0, 1.3, 0.25, 1.3, 0x6b7280),
    part(0, 2.0, 0, 2.2, 1.15, 1.2, 0x53617a),
    part(0, 2.05, 0.66, 1.8, 0.72, 0.16, 0x4cc9f0), // lens panel
    part(-0.62, 2.05, 0.72, 0.5, 0.5, 0.1, 0x9be7ff),
    part(0.62, 2.05, 0.72, 0.5, 0.5, 0.1, 0x9be7ff),
    part(0, 2.62, -0.1, 2.3, 0.3, 1.3, 0x6c7a91), // strap
    part(-1.18, 2.0, -0.1, 0.28, 0.9, 1.1, 0x6c7a91),
    part(1.18, 2.0, -0.1, 0.28, 0.9, 1.1, 0x6c7a91),
  ],

  arPhone: () => [
    part(0, 0.55, 0, 0.34, 1.1, 0.34, 0x5b6672),
    part(0, 1.9, 0, 1.15, 2.0, 0.3, 0x5b6b84),
    part(0, 1.95, 0.19, 0.9, 1.6, 0.06, 0x9be7ff),
    // The thing it is tracking, floating just above the screen.
    part(0, 3.35, 0.15, 0.62, 0.62, 0.62, 0xf2c14e),
    part(0, 3.35, 0.15, 0.72, 0.16, 0.72, 0xffe6a1),
  ],

  marker: () => [
    part(0, 0.5, 0, 0.3, 1.0, 0.3, BARK),
    part(0, 1.75, 0, 1.8, 1.8, 0.22, 0xfbfbfb),
    part(-0.45, 2.2, 0.14, 0.62, 0.62, 0.06, 0x4a5568),
    part(0.45, 1.3, 0.14, 0.62, 0.62, 0.06, 0x4a5568),
    part(-0.45, 1.3, 0.14, 0.62, 0.62, 0.06, 0xbfc7d1),
    part(0.45, 2.2, 0.14, 0.62, 0.62, 0.06, 0xbfc7d1),
  ],

  // --- terrain dressing ---------------------------------------------------
  boulder: (b) => [
    part(0, 0.5, 0, 1.9, 1.0, 1.7, b.boulder),
    part(0.5, 1.15, -0.2, 1.1, 0.8, 1.0, b.boulder),
    part(-0.55, 0.95, 0.35, 0.8, 0.6, 0.8, b.rock),
  ],

  flower: () => [
    part(0, 0.28, 0, 0.12, 0.56, 0.12, 0x3f9142),
    part(0, 0.62, 0, 0.3, 0.3, 0.3, 0xffd166),
    part(-0.26, 0.62, 0, 0.22, 0.22, 0.22, 0xff8fab),
    part(0.26, 0.62, 0, 0.22, 0.22, 0.22, 0xff8fab),
    part(0, 0.62, -0.26, 0.22, 0.22, 0.22, 0xff8fab),
    part(0, 0.62, 0.26, 0.22, 0.22, 0.22, 0xff8fab),
  ],

  grassTuft: (b) => [
    part(0, 0.3, 0, 0.16, 0.6, 0.16, b.foliage),
    part(0.22, 0.24, 0.1, 0.14, 0.48, 0.14, b.foliageAlt),
    part(-0.2, 0.2, -0.12, 0.13, 0.4, 0.13, b.foliage),
  ],

  // --- landmarks ----------------------------------------------------------
  // These are the set pieces that go on the CORNERS of the route. In the
  // reference maps almost every bend has one — a toad house, a cannon, a
  // little bridge — and it is those, far more than the terrain, that make an
  // overworld feel like a place rather than a diagram. They are placed
  // deliberately (see planLandmarks) rather than scattered.

  /** Toad house: spotted cap, round door, lantern. */
  mushroomHouse: () => [
    part(0, 1.05, 0, 3.0, 2.1, 3.0, 0xf7ead6), // walls
    part(0, 1.05, 1.5, 3.0, 2.1, 0.12, 0xfff6ea), // sunlit face
    part(0, 2.28, 0, 3.4, 0.4, 3.4, 0xe0cfb4), // eave
    part(0, 3.05, 0, 4.4, 1.35, 4.4, 0xe63946), // cap
    part(0, 3.95, 0, 3.2, 0.75, 3.2, 0xd62839),
    part(0, 4.5, 0, 1.7, 0.5, 1.7, 0xc41e3a),
    // Spots ride the OUTSIDE of each cap tier. Set inside its half-width they
    // were simply swallowed by the box they were meant to decorate.
    ...ring(3.05, 2.15, 0.95, 0xfff6ea, 6, 0.3),
    ...ring(3.95, 1.6, 0.66, 0xfff6ea, 4, 0.9),
    // Spots on the TOP faces as well. The camera looks down on this map, so
    // spots only on the sides left the roof reading as a plain red block from
    // the angle players actually see it from.
    ...ring(3.78, 1.75, 0.8, 0xfff6ea, 4, 0.0).map((q) => ({ ...q, h: 0.22 })),
    ...ring(4.78, 0.95, 0.55, 0xfff6ea, 3, 0.6).map((q) => ({ ...q, h: 0.2 })),
    part(0, 0.85, 1.58, 1.1, 1.7, 0.22, 0x8b5e34), // door
    part(0, 1.3, 1.7, 0.9, 0.75, 0.06, 0xa9763a),
    part(0.34, 0.85, 1.73, 0.16, 0.16, 0.06, 0xf2c14e), // handle
    part(-1.05, 1.5, 1.58, 0.7, 0.7, 0.16, 0x9be7ff), // windows
    part(1.05, 1.5, 1.58, 0.7, 0.7, 0.16, 0x9be7ff),
    part(-1.75, 1.9, 1.25, 0.22, 0.22, 0.22, 0xf2c14e), // lantern
  ],

  /**
   * The same house in lilac. Two colours of toad house, spotted the same way,
   * is straight out of the reference maps — and having the pair means a
   * session can be marked by a building rather than only by its disc.
   */
  mushroomHouseLilac: () => [
    part(0, 1.05, 0, 3.0, 2.1, 3.0, 0xf7ead6),
    part(0, 1.05, 1.5, 3.0, 2.1, 0.12, 0xfff6ea),
    part(0, 2.28, 0, 3.4, 0.4, 3.4, 0xe0cfb4),
    part(0, 3.05, 0, 4.4, 1.35, 4.4, 0x9d4edd),
    part(0, 3.95, 0, 3.2, 0.75, 3.2, 0x7b2fbe),
    part(0, 4.5, 0, 1.7, 0.5, 1.7, 0x6522a4),
    ...ring(3.05, 2.15, 0.95, 0xfff6ea, 6, 0.3),
    ...ring(3.95, 1.6, 0.66, 0xfff6ea, 4, 0.9),
    ...ring(3.78, 1.75, 0.8, 0xfff6ea, 4, 0.0).map((q) => ({ ...q, h: 0.22 })),
    ...ring(4.78, 0.95, 0.55, 0xfff6ea, 3, 0.6).map((q) => ({ ...q, h: 0.2 })),
    part(0, 0.85, 1.58, 1.1, 1.7, 0.22, 0x8b5e34),
    part(0, 1.3, 1.7, 0.9, 0.75, 0.06, 0xa9763a),
    part(0.34, 0.85, 1.73, 0.16, 0.16, 0.06, 0xf2c14e),
    part(-1.05, 1.5, 1.58, 0.7, 0.7, 0.16, 0x9be7ff),
    part(1.05, 1.5, 1.58, 0.7, 0.7, 0.16, 0x9be7ff),
    part(-1.75, 1.9, 1.25, 0.22, 0.22, 0.22, 0xf2c14e),
  ],

  /** The lilac cottage — the second house colour in the reference art. */
  cottage: () => [
    part(0, 1.0, 0, 2.9, 2.0, 2.6, 0xb9a0e3), // walls
    part(0, 1.0, 1.32, 2.9, 2.0, 0.12, 0xc9b4ec), // sunlit face
    part(0, 2.35, 0, 3.5, 0.7, 3.2, 0x6d4f9c), // roof, two tiers
    part(0, 2.95, 0, 2.4, 0.6, 2.2, 0x5b3f86),
    part(0, 3.4, 0, 1.2, 0.4, 1.1, 0x4b3270),
    part(1.05, 3.3, -0.6, 0.55, 1.5, 0.55, 0x8d99ae), // chimney
    part(1.05, 4.15, -0.6, 0.72, 0.24, 0.72, 0x6c757d),
    part(0, 0.8, 1.42, 0.95, 1.6, 0.12, 0x5b3f86), // door
    part(0.3, 0.8, 1.5, 0.14, 0.14, 0.06, 0xf2c14e),
    part(-0.95, 1.45, 1.42, 0.8, 0.8, 0.1, 0x9be7ff), // window
    part(-0.95, 1.45, 1.48, 0.12, 0.8, 0.06, 0xfff6ea), // mullion
    part(-0.95, 1.45, 1.48, 0.8, 0.12, 0.06, 0xfff6ea),
    part(0.95, 1.45, 1.42, 0.8, 0.8, 0.1, 0x9be7ff),
  ],

  /** Bill Blaster-ish cannon on a timber carriage. */
  cannon: () => [
    part(0, 0.35, 0, 2.4, 0.7, 1.6, 0x6f4a2a), // carriage
    part(-0.9, 0.35, 0.72, 0.7, 0.7, 0.22, 0x4a3520), // wheels
    part(0.9, 0.35, 0.72, 0.7, 0.7, 0.22, 0x4a3520),
    part(-0.9, 0.35, -0.72, 0.7, 0.7, 0.22, 0x4a3520),
    part(0.9, 0.35, -0.72, 0.7, 0.7, 0.22, 0x4a3520),
    part(0, 1.15, -0.2, 1.5, 1.2, 1.5, 0x3f4650), // breech
    part(0, 1.65, 0.35, 1.15, 1.15, 1.4, 0x4a5058), // barrel
    part(0, 2.05, 0.95, 0.95, 0.95, 1.2, 0x555d66),
    part(0, 2.3, 1.5, 0.78, 0.78, 0.5, 0x22272e), // muzzle
    part(0, 1.15, -0.95, 0.5, 0.5, 0.4, 0x22272e), // fuse block
  ],

  /** Little stone arch bridge with the gap under it. */
  archBridge: () => [
    part(0, 0.9, 0, 5.2, 0.6, 2.4, 0xcdbfa6), // deck
    part(-1.9, 0.4, 0, 1.4, 1.0, 2.4, 0xb6a68c), // piers
    part(1.9, 0.4, 0, 1.4, 1.0, 2.4, 0xb6a68c),
    part(-2.55, 0.55, 0, 0.6, 1.3, 2.6, 0xa08f74), // abutments
    part(2.55, 0.55, 0, 0.6, 1.3, 2.6, 0xa08f74),
    part(-2.4, 1.55, 1.05, 0.35, 0.9, 0.35, 0x8b5e34), // rail posts
    part(2.4, 1.55, 1.05, 0.35, 0.9, 0.35, 0x8b5e34),
    part(-2.4, 1.55, -1.05, 0.35, 0.9, 0.35, 0x8b5e34),
    part(2.4, 1.55, -1.05, 0.35, 0.9, 0.35, 0x8b5e34),
    part(0, 1.85, 1.05, 5.2, 0.22, 0.22, 0x8b5e34), // handrails
    part(0, 1.85, -1.05, 5.2, 0.22, 0.22, 0x8b5e34),
  ],

  /** Warp pipe. Nothing says Mario faster. */
  warpPipe: () => [
    part(0, 0.9, 0, 1.7, 1.8, 1.7, 0x3f9142),
    part(0, 1.3, 0.9, 1.7, 1.0, 0.14, 0x50a854), // highlight
    part(0, 2.1, 0, 2.15, 0.65, 2.15, 0x4aa84d),
    part(0, 2.42, 0, 1.5, 0.16, 1.5, 0x22402a), // dark mouth
    part(-0.95, 2.1, 0, 0.16, 0.65, 2.15, 0x2f6b33),
  ],

  /** Village well — a corner needs somewhere for people to be. */
  well: () => [
    part(0, 0.45, 0, 2.1, 0.9, 2.1, 0x9aa7b3),
    part(0, 0.95, 0, 1.75, 0.2, 1.75, 0x22272e), // water
    part(-0.85, 1.55, 0, 0.28, 1.9, 0.28, 0x8b5e34), // posts
    part(0.85, 1.55, 0, 0.28, 1.9, 0.28, 0x8b5e34),
    part(0, 2.55, 0, 2.5, 0.45, 1.9, 0xb32a2a), // roof
    part(0, 2.9, 0, 1.5, 0.35, 1.4, 0x8f2020),
    part(0, 1.95, 0, 1.6, 0.16, 0.16, 0x6f4a2a), // winch
    part(0, 1.5, 0, 0.1, 0.8, 0.1, 0xe8d9c0), // rope
    part(0, 1.05, 0, 0.42, 0.35, 0.42, 0x6f4a2a), // bucket
  ],

  /** Signpost at a fork. */
  signpost: () => [
    part(0, 0.9, 0, 0.28, 1.8, 0.28, 0x8b5e34),
    part(0.55, 1.55, 0, 1.5, 0.6, 0.16, 0xe8d9c0),
    part(0.55, 1.55, 0.09, 1.2, 0.2, 0.05, 0xa9763a),
    part(-0.45, 1.0, 0, 1.1, 0.45, 0.14, 0xe8d9c0),
    part(0, 0.12, 0, 0.9, 0.24, 0.9, 0x9aa7b3), // stone footing
  ],

  /** Checkpoint flag, for the corners that need height rather than mass. */
  bannerPole: () => [
    part(0, 0.2, 0, 1.2, 0.4, 1.2, 0x9aa7b3),
    part(0, 2.3, 0, 0.24, 4.2, 0.24, 0xe8e3d8),
    part(0.85, 3.9, 0, 1.5, 1.1, 0.1, 0x4cc9f0),
    part(0.85, 3.9, 0.06, 0.5, 0.5, 0.06, 0xfff6ea),
    part(0, 4.5, 0, 0.4, 0.4, 0.4, 0xf2c14e),
  ],

  /** Stack of supply crates — cheap, and it breaks up a long straight. */
  crates: () => [
    part(0, 0.55, 0, 1.5, 1.1, 1.5, 0xb98a4e),
    part(0, 0.55, 0.78, 1.2, 0.9, 0.1, 0x8b5e34),
    part(0.25, 1.65, -0.2, 1.2, 1.1, 1.2, 0xc79a55),
    part(0.25, 1.65, 0.42, 0.95, 0.85, 0.1, 0x8b5e34),
    part(-0.9, 0.4, 0.6, 0.8, 0.8, 0.8, 0xa9763a),
  ],
}

export const PROP_KINDS = Object.keys(RECIPES)

/**
 * Snow lying on a recipe's roofs, derived from its own boxes.
 *
 * Every landmark would otherwise need a second, snowed-in copy of its recipe,
 * and eleven recipes kept in step by hand is how one of them drifts. So snow
 * is computed: every box whose top is in the upper part of the prop, and
 * which is broad enough to hold snow, gets a thin white slab on top, a shade
 * wider than itself so it reads as overhanging. Narrow parts (posts, a
 * lantern, a door handle) get none, which is also what a real snowfall does.
 *
 * Stacked tiers each get their own slab and the tier above simply stands in
 * it, so a toad house comes out snowed on every step of its cap.
 *
 * @param {Part[]} boxes
 */
function snowOn(boxes) {
  let top = 0
  for (const b of boxes) top = Math.max(top, b.y + b.h / 2)
  const out = []
  for (const b of boxes) {
    const t = b.y + b.h / 2
    if (t < top * 0.5 || b.w < 0.6 || b.d < 0.6 || b.c === SNOW) continue
    out.push(part(b.x, t + 0.09, b.z, b.w + 0.14, 0.18, b.d + 0.14, SNOW))
  }
  return out
}

/**
 * Bakes a list of placements into one InstancedMesh.
 * @param {Array<{kind:string, x:number, z:number, y:number, biome:object, scale?:number, yaw?:number}>} placements
 */
export function buildPropMesh(placements) {
  const parts = []
  for (const p of placements) {
    const recipe = RECIPES[p.kind]
    if (!recipe) continue
    const scale = p.scale ?? 1
    const yaw = p.yaw ?? 0
    const cos = Math.cos(yaw)
    const sin = Math.sin(yaw)
    const boxes = recipe(p.biome)
    if (p.snowCap) boxes.push(...snowOn(boxes))
    for (const b of boxes) {
      // Rotate the part offset around the prop's own axis.
      const ox = b.x * cos - b.z * sin
      const oz = b.x * sin + b.z * cos
      parts.push({
        x: p.x + ox * scale,
        y: p.y + b.y * scale,
        z: p.z + oz * scale,
        w: b.w * scale,
        h: b.h * scale,
        d: b.d * scale,
        c: b.c,
        yaw,
      })
    }
  }

  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshLambertMaterial(),
    Math.max(1, parts.length)
  )
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const up = new THREE.Vector3(0, 1, 0)
  const pos = new THREE.Vector3()
  const sv = new THREE.Vector3()
  const col = new THREE.Color()

  parts.forEach((b, i) => {
    q.setFromAxisAngle(up, b.yaw)
    pos.set(b.x, b.y, b.z)
    sv.set(b.w, b.h, b.d)
    m.compose(pos, q, sv)
    mesh.setMatrixAt(i, m)
    mesh.setColorAt(i, col.setHex(b.c))
  })
  mesh.count = parts.length
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  mesh.frustumCulled = false
  return mesh
}

/**
 * Chooses what stands where. Trees and large props stay well clear of the
 * road so they can never hide a node or the avatar; only small ground cover
 * comes near it.
 */
/**
 * Where the castles stand, straight from the path template.
 *
 * World 2 reserves a control point for its mini-boss; world 3's final boss
 * closes the route, so it sits on the last one.
 */
function bossAnchors() {
  const out = []
  for (const w of worlds) {
    const [cx, cy, cz] = w.center
    const idx = w.path.bossSlotIndex
    const cp = idx != null ? w.path.controlPoints[idx] : null
    const last = w.path.controlPoints[w.path.controlPoints.length - 1]
    const pick = cp ?? (w.id === 3 ? last : null)
    if (pick) out.push({ x: pick[0] + cx, z: pick[2] + cz })
  }
  return out
}

const BOSS_GROVE_RADIUS = 26

/** Radius around every node that scattered dressing must leave alone. */
const GROUND_KEEP_OUT = 3.4 // flowers, tufts
const BIG_KEEP_OUT = 8.5 // trees, cacti, headsets — anything that can hide a node

export function planProps(cells) {
  const out = []
  const bosses = bossAnchors()
  const big = (c) => c.pathDist > 10 && c.shore > 0.88 && nodeClearance(c.x, c.z) > BIG_KEEP_OUT
  const near = (c) => c.pathDist > 2.4 && c.pathDist < 9 && c.shore > 0.85

  /**
   * 0 out in the open, 1 right at a castle. The reference art thickens the
   * planting around every castle so it reads as the seat of the world rather
   * than a model dropped on a lawn.
   */
  const grove = (c) => {
    let best = 0
    for (const b of bosses) {
      const d = Math.hypot(c.x - b.x, c.z - b.z)
      best = Math.max(best, 1 - Math.min(1, d / BOSS_GROVE_RADIUS))
    }
    return best
  }

  // Placement is per CELL, so halving the voxel size quadruples the number of
  // candidates. Without this correction the finer grid buried the island in
  // four times the trees. `rare` keeps density per unit AREA constant.
  const rare = (p) => 1 - (1 - p) * CELL_AREA_SCALE
  const common = (p) => p * CELL_AREA_SCALE

  for (const c of cells) {
    // Nothing scattered may crowd a node. Big props keep well back so a level
    // disc is always visible from above; even ground cover leaves the disc
    // itself clear.
    const nd = nodeClearance(c.x, c.z)
    if (nd < GROUND_KEEP_OUT) continue

    const r = hash2(c.x * 3.3, c.z * 7.7)
    const yaw = hash2(c.z * 1.7, c.x * 2.9) * Math.PI * 2
    const scale = 0.85 + hash2(c.x * 0.7, c.z * 1.3) * 0.4
    const base = { x: c.x, z: c.z, y: c.height, biome: c.biome, yaw, scale }

    if (big(c)) {
      // A season may plant a different tree, and Halloween plants the same
      // dead one in all three biomes — a bare winter skeleton has no biome,
      // which is the point of it. Everything else about placement (density,
      // the grove around each castle, the keep-outs) is untouched.
      //
      // Christmas plants a snowed-in pine in every biome (a leafy oak under a
      // metre of snow is a lump), keeps the desert's cacti with snow on their
      // arms so world 2 still reads as the desert, and makes one tree
      // in seven a decorated Christmas tree. Which ones is a SECOND hash, so
      // the decorated trees are scattered rather than gathered into whichever
      // corner the placement hash happens to favour.
      const xmas = seasonFlags.trees === 'xmas'
      const decorated = xmas && hash2(c.z * 6.1, c.x * 3.7) > 0.85
      const tree =
        seasonFlags.trees === 'bare'
          ? 'deadTree'
          : decorated
            ? 'xmasTree'
            : c.biome.props === 'cactus'
              ? xmas ? 'snowCactus' : 'cactus'
              : c.biome.props === 'pine' || xmas
                ? xmas ? 'pineSnowy' : 'pine'
                : 'treeLeafy'
      // Thicker planting close to a castle, ordinary density elsewhere.
      const threshold = 0.945 - grove(c) * 0.16
      if (r > threshold) out.push({ ...base, kind: tree })
    }

    if (near(c)) {
      const t = hash2(c.x * 5.1, c.z * 2.7)
      // Jack-o'-lanterns ride in the ground-cover band, beside the road where
      // they can actually be seen, and they take the flowers' slot rather than
      // adding to it — the band is already as busy as it should be, and a
      // pumpkin standing in a flowerbed reads as clutter.
      //
      // "Unas sí, otras no": a SECOND hash decides lit or not, independent of
      // the one that chose to put a pumpkin here at all. Reusing `t` would
      // correlate the two, and every pumpkin in the rarer tail would come out
      // lit — a tidy gradient across the island instead of a mix.
      //
      // Christmas does the same with presents and candy canes: they take the
      // flowers' slot (nothing flowers in the snow), and a second hash picks
      // which of the two, and which wrapping.
      const festive = seasonFlags.gifts || seasonFlags.candyCanes
      if (seasonFlags.pumpkins && t > rare(0.955)) {
        const lit = hash2(c.z * 4.3, c.x * 8.9) > 0.45
        out.push({ ...base, kind: lit ? 'pumpkinLit' : 'pumpkin' })
      } else if (festive && t > rare(0.958)) {
        const pick = hash2(c.z * 4.3, c.x * 8.9)
        const cane = seasonFlags.candyCanes && (!seasonFlags.gifts || pick > 0.62)
        const gifts = ['giftRed', 'giftGreen', 'giftBlue', 'giftStack']
        const kind = cane ? 'candyCane' : gifts[Math.floor(pick * 6.5) % gifts.length]
        out.push({ ...base, kind, scale: cane ? 0.9 + base.scale * 0.2 : base.scale })
      } else if (festive) {
        // No flowers in the snow; the tufts stay, as sprigs poking through.
        if (t > rare(0.93) && t <= rare(0.958)) out.push({ ...base, kind: 'grassTuft' })
      } else if (t > rare(0.968)) out.push({ ...base, kind: 'flower' })
      else if (t > rare(0.93)) out.push({ ...base, kind: 'grassTuft' })
    }

    // Course-themed landmarks: rarer, and only in the mid band so they read as
    // deliberate set pieces rather than clutter.
    if (c.pathDist > 6 && c.pathDist < 12 && c.shore > 0.9 && nd > BIG_KEEP_OUT) {
      const t = hash2(c.z * 9.1, c.x * 6.3)
      if (t > rare(0.9955)) out.push({ ...base, kind: 'headset', scale: 1 })
      else if (t < common(0.0045)) out.push({ ...base, kind: 'arPhone', scale: 1 })
      else if (t > 0.5 - 0.002 * CELL_AREA_SCALE && t < 0.5 + 0.002 * CELL_AREA_SCALE)
        out.push({ ...base, kind: 'marker', scale: 1 })
      // The snowmen share the set-piece band: far enough from the road to be
      // somebody's garden, close enough to be seen. Same rarity as a headset.
      else if (seasonFlags.snowmen && t > 0.3 - 0.0035 * CELL_AREA_SCALE && t < 0.3 + 0.0035 * CELL_AREA_SCALE)
        out.push({ ...base, kind: 'snowman', scale: 0.95 })
    }
  }
  return out
}

/**
 * Every node on the island, in one memoised list.
 *
 * Exists so that anything scattered over the map can be told to keep AWAY from
 * the nodes. The two systems previously knew nothing about each other, which
 * is how a tree came to grow straight through a bonus level and a signpost
 * ended up standing in the middle of a session.
 */
let nodesCache = null
export function allNodePlacements() {
  if (!nodesCache) {
    nodesCache = []
    for (const w of worlds) {
      for (const p of distributeNodes(w, levelsForWorld(w.id))) {
        nodesCache.push({ ...p, worldId: w.id })
      }
    }
  }
  return nodesCache
}

/** Distance from (x, z) to the nearest node, on the ground plane. */
export function nodeClearance(x, z) {
  let best = Infinity
  for (const n of allNodePlacements()) {
    const d = Math.hypot(x - n.position.x, z - n.position.z)
    if (d < best) best = d
  }
  return best
}

/**
 * Set pieces standing just PAST each session, off to one side of the road.
 *
 * Placement follows the reference art rather than geometry for its own sake:
 * walking the road you meet the level's disc first, and the building that
 * belongs to it a moment later, beside the road ahead. Hanging them on the
 * path's corners instead — the previous approach — put them wherever the route
 * happened to bend, which is not where the eye looks for them.
 *
 * Everything is derived from the node list, so adding or removing a session
 * re-places its landmark and nothing here needs touching.
 */
const LANDMARKS_BY_BIOME = {
  meadow: ['mushroomHouse', 'mushroomHouseLilac', 'well', 'warpPipe', 'cottage', 'signpost'],
  desert: ['mushroomHouseLilac', 'cannon', 'mushroomHouse', 'warpPipe', 'well', 'crates'],
  summit: ['mushroomHouse', 'cottage', 'mushroomHouseLilac', 'bannerPole', 'warpPipe', 'well'],
}

/**
 * How far past the node, and how far to the side.
 *
 * Close. The point is that the building belongs to THAT session: standing on
 * the disc you should feel you have arrived somewhere, which needs the house
 * at your shoulder, not across a field. The first pair of values is where it
 * lands almost always; the rest are fallbacks for a cramped spot.
 */
const AHEAD = [1.5, 3.5, 0, 5.5]
const ASIDE = [4.6, 5.6, 7]
/** Off the road, but only just — measured to the road's centre line. */
const LANDMARK_ROAD_CLEARANCE = 4.2
const LANDMARK_NODE_CLEARANCE = 3.9

export function planLandmarks() {
  const out = []
  const nodes = allNodePlacements()

  let ordinal = -1
  for (const n of nodes) {
    // Bosses have their own castle, and a bonus node is already the landmark.
    if (!n.onPath || n.level.category === 'boss') continue
    ordinal++

    const biome = biomes[worlds.find((w) => w.id === n.worldId)?.biome] ?? biomes.meadow
    const kinds = LANDMARKS_BY_BIOME[worlds.find((w) => w.id === n.worldId)?.biome] ??
      LANDMARKS_BY_BIOME.meadow

    const fwd = n.tangent.clone().setY(0)
    if (fwd.lengthSq() < 1e-6) continue
    fwd.normalize()
    const side = { x: fwd.z, z: -fwd.x }

    // Prefer the side the road is NOT about to turn toward, then try the other.
    const seed = hash2(n.position.x, n.position.z)
    const sides = seed > 0.5 ? [1, -1] : [-1, 1]

    let spot = null
    for (const dir of sides) {
      for (const ahead of AHEAD) {
        for (const aside of ASIDE) {
          const x = n.position.x + fwd.x * ahead + side.x * dir * aside
          const z = n.position.z + fwd.z * ahead + side.z * dir * aside
          if (landInset(x, z) < 7) continue
          if (nearestPath(x, z).dist < LANDMARK_ROAD_CLEARANCE) continue
          if (nodeClearance(x, z) < LANDMARK_NODE_CLEARANCE) continue
          // Level ground only: a house half-sunk into a terrace looks broken.
          if (flatness(x, z) > 0.01) continue
          spot = { x, z, dir }
          break
        }
        if (spot) break
      }
      if (spot) break
    }
    if (!spot) continue

    out.push({
      // Cycle rather than hash: hashing left whole kinds unplaced, so the
      // warp pipe and the lilac house simply never appeared on the map.
      kind: kinds[ordinal % kinds.length],
      x: spot.x,
      z: spot.z,
      y: groundHeightAt(spot.x, spot.z),
      biome,
      // Face the road: the door and the cannon muzzle should look at it.
      yaw: Math.atan2(-side.x * spot.dir, -side.z * spot.dir),
      scale: 0.78 + hash2(spot.x, spot.z) * 0.14,
      // Snowed in at Christmas: see `snowOn` for how the snow finds the roof.
      snowCap: seasonFlags.snowCaps,
    })
  }

  return out
}

/**
 * Roadside lampposts, one per session. Halloween only.
 *
 * THESE ARE THE ISLAND'S LIGHT SOURCES, so unlike every other prop they are
 * placed to be NEAR the road rather than clear of it: a lamp four metres into
 * the field lights the field. `LAMP_ROAD` is therefore much tighter than
 * `LANDMARK_ROAD_CLEARANCE` — the post is 0.26 wide, so it fits where a house
 * never could.
 *
 * It takes the side the LANDMARK did not, so a session reads as a little place
 * with something on each verge rather than a pile on one side. The landmark
 * search runs first and is deterministic, so asking it again here costs one
 * more pass over the nodes and cannot disagree with what was actually built.
 *
 * Bosses get one too: a castle gate with a lamp beside it is the whole point.
 */
const LAMP_ROAD = 2.55 // from the path centre line; the road's own foot is 1.6
const LAMP_NODE = 2.9 // never on a session disc
const LAMP_ASIDE = [2.9, 3.4, 4.2]
const LAMP_AHEAD = [2.6, -2.6, 4.4, -4.4, 0]

export function planLamps() {
  if (seasonFlags.lights <= 0) return []

  // Which side each node's landmark took, so the lamp can take the other.
  const landmarkSide = new Map()
  for (const l of planLandmarks()) landmarkSide.set(`${l.x.toFixed(2)},${l.z.toFixed(2)}`, l)

  const out = []
  for (const n of allNodePlacements()) {
    if (!n.onPath) continue

    const fwd = n.tangent.clone().setY(0)
    if (fwd.lengthSq() < 1e-6) continue
    fwd.normalize()
    const side = { x: fwd.z, z: -fwd.x }

    // Prefer the verge the landmark is not on; fall back to the other.
    let taken = 0
    for (const l of landmarkSide.values()) {
      if (Math.hypot(l.x - n.position.x, l.z - n.position.z) < 9) {
        taken = Math.sign((l.x - n.position.x) * side.x + (l.z - n.position.z) * side.z) || 0
      }
    }
    const sides = taken ? [-taken, taken] : [1, -1]

    let spot = null
    for (const dir of sides) {
      for (const ahead of LAMP_AHEAD) {
        for (const aside of LAMP_ASIDE) {
          const x = n.position.x + fwd.x * ahead + side.x * dir * aside
          const z = n.position.z + fwd.z * ahead + side.z * dir * aside
          if (landInset(x, z) < 5) continue
          if (nearestPath(x, z).dist < LAMP_ROAD) continue
          if (nodeClearance(x, z) < LAMP_NODE) continue
          if (flatness(x, z) > 0.01) continue
          spot = { x, z }
          break
        }
        if (spot) break
      }
      if (spot) break
    }
    if (!spot) continue

    out.push({
      kind: seasonFlags.lampStyle === 'xmas' ? 'xmasLamp' : 'lamppost',
      x: spot.x,
      z: spot.z,
      y: groundHeightAt(spot.x, spot.z),
      biome: biomes.meadow, // the recipe uses no biome colour; any entry does
      yaw: 0, // square to the grid, like everything built rather than grown
      scale: 1,
    })
  }
  return out
}

/**
 * Where a real light could usefully stand, in world space.
 *
 * Collected from the placements that were actually BUILT rather than guessed
 * at, so a lamp the clearance search rejected never gets a light hanging in
 * the air where it would have been. `three/seasonLights.js` lights only the
 * nearest handful of these; the rest carry their own bright pane or face,
 * which at map distance reads the same.
 *
 * @param {Array} placements everything handed to `buildPropMesh`
 */
export function emittersFrom(placements) {
  const out = []
  for (const p of placements) {
    if (p.kind === 'lamppost' || p.kind === 'xmasLamp') {
      out.push({ x: p.x, y: p.y + 4.26, z: p.z, kind: 'lamp' })
    } else if (p.kind === 'xmasTree') {
      // The star, scaled with the tree it crowns: planProps gives every tree a
      // scale of its own, and a light at the unscaled height floats over a
      // small tree and sits inside a big one.
      out.push({ x: p.x, y: p.y + 6.15 * (p.scale ?? 1), z: p.z, kind: 'tree' })
    } else if (p.kind === 'pumpkinLit') {
      out.push({ x: p.x, y: p.y + 0.5, z: p.z, kind: 'pumpkin' })
    }
  }
  return out
}
