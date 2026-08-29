/**
 * The shape of the island: where each world sits, where its fixed camera sits,
 * and the spline template its levels are distributed along.
 *
 * This is DATA, not geometry. Nothing here is hardcoded per-node — the number
 * of nodes on a path comes from levels.json and is distributed at runtime by
 * src/three/paths.js. Reshape a world by dragging numbers here.
 *
 * Coordinates in `controlPoints` are LOCAL to the world's `center`.
 */

/** Camera never moves freely — exactly these three positions, one per world. */
export const CAMERA_FOV = 40

export const worlds = [
  {
    id: 1,
    name: 'World 1 — Foundations & AR',
    biome: 'meadow',
    center: [-58, 0, 0],
    // Isometric, from the LEFT looking right.
    camera: { offset: [-42, 38, 38], target: [-2, 4.5, 1] }, // aimed at W1's mid-height
    path: {
      bossSlotIndex: null,
      // The y values ARE the terrain: ground follows the nearest path height,
      // so a climb here becomes a plateau with cliff faces around it.
      controlPoints: [
        [-19, 0.0, 16],
        [-10, 0.0, 8],
        [-1, 4.0, 11],
        [7, 4.0, 3],
        [1, 9.0, -5],
        [-7, 9.0, -11],
        [3, 9.0, -16],
        [14, 5.0, -10],
        [19, 2.0, -1],
      ],
    },
  },
  {
    id: 2,
    name: 'World 2 — Meta Building Blocks',
    biome: 'desert',
    center: [0, 0, 0],
    // Frontal.
    camera: { offset: [0, 30, 58], target: [0, 7.5, -3] }, // aimed at W2's mid-height
    path: {
      // The mini-boss (midterm castle) always sits on this control point, and
      // it splits the world into two equal halves: theory+BB start before it,
      // BB completion after it. Change the index to move the castle.
      bossSlotIndex: 4,
      controlPoints: [
        [-20, 2.0, 14],
        [-12, 2.0, 5],
        [-16, 6.0, -5],
        [-7, 6.0, -12],
        [0, 12.0, -16], // <- bossSlot, the castle sits on the highest mesa
        [7, 6.0, -12],
        [16, 6.0, -5],
        [12, 2.0, 5],
        [20, 2.0, 14],
      ],
    },
  },
  {
    id: 3,
    name: 'World 3 — XR Toolkit & Final Project',
    biome: 'summit',
    center: [58, 0, 0],
    // Mirror of World 1: isometric, from the RIGHT looking left.
    camera: { offset: [42, 40, 38], target: [2, 9, 1] }, // aimed at W3's mid-height
    path: {
      // World 1's shape mirrored on X *and reversed*, so the silhouette is the
      // mirror image (matching the mirrored camera) while the route still runs
      // left-to-right. Mirroring alone would start this world at the island's
      // far right edge and make the journey jump backwards over it.
      bossSlotIndex: null,
      // A steady ascent: the final boss stands at the summit, the highest
      // point on the island.
      controlPoints: [
        [-19, 2.0, -1],
        [-14, 2.0, -10],
        [-3, 6.0, -16],
        [7, 6.0, -11],
        [-1, 10.0, -5],
        [-7, 10.0, 3],
        [1, 14.0, 11],
        [10, 14.0, 8],
        [19, 14.0, 16],
      ],
    },
  },
]

export const worldById = new Map(worlds.map((w) => [w.id, w]))

/** Which world owns a given X — the biome boundary for terrain and road alike. */
export function worldAtX(x) {
  let best = worlds[0]
  for (const w of worlds) {
    if (Math.abs(x - w.center[0]) < Math.abs(x - best.center[0])) best = w
  }
  return best
}

/** Subtle mouse parallax — never free rotation. Tune or zero these out. */
export const parallax = {
  maxOffset: 2.4, // world units the camera drifts at full pointer deflection
  maxTilt: 0.085, // radians the world tips at full deflection (~4.8 degrees)
  damping: 0.055, // 0..1 per frame — lower is smoother/laggier
}
