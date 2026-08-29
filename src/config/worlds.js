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
    center: [-58, 0, 0],
    // Isometric, from the LEFT looking right.
    camera: { offset: [-36, 30, 32], target: [0, 2, -2] },
    path: {
      bossSlotIndex: null,
      controlPoints: [
        [-19, 0.0, 16],
        [-10, 0.5, 8],
        [-1, 0.0, 11],
        [7, 1.2, 3],
        [1, 0.6, -5],
        [-7, 0.0, -11],
        [3, 1.0, -16],
        [14, 0.4, -10],
        [19, 0.0, -1],
      ],
    },
  },
  {
    id: 2,
    name: 'World 2 — Meta Building Blocks',
    center: [0, 0, 0],
    // Frontal.
    camera: { offset: [0, 23, 48], target: [0, 2, -4] },
    path: {
      // The mini-boss (midterm castle) always sits on this control point, and
      // it splits the world into two equal halves: theory+BB start before it,
      // BB completion after it. Change the index to move the castle.
      bossSlotIndex: 4,
      controlPoints: [
        [-20, 0.0, 14],
        [-12, 0.5, 5],
        [-16, 0.0, -5],
        [-7, 1.0, -12],
        [0, 2.6, -16], // <- bossSlot
        [7, 1.0, -12],
        [16, 0.0, -5],
        [12, 0.5, 5],
        [20, 0.0, 14],
      ],
    },
  },
  {
    id: 3,
    name: 'World 3 — XR Toolkit & Final Project',
    center: [58, 0, 0],
    // Mirror of World 1: isometric, from the RIGHT looking left.
    camera: { offset: [36, 30, 32], target: [0, 2, -2] },
    path: {
      bossSlotIndex: null,
      controlPoints: [
        [19, 0.0, 16],
        [10, 0.5, 8],
        [1, 0.0, 11],
        [-7, 1.2, 3],
        [-1, 0.6, -5],
        [7, 0.0, -11],
        [-3, 1.0, -16],
        [-14, 0.4, -10],
        [-19, 0.0, -1],
      ],
    },
  },
]

export const worldById = new Map(worlds.map((w) => [w.id, w]))

/** Subtle mouse parallax — never free rotation. Tune or zero these out. */
export const parallax = {
  maxOffset: 2.4, // world units the camera drifts
  maxTilt: 0.035, // radians the world tips
  damping: 0.055, // 0..1 per frame — lower is smoother/laggier
}
