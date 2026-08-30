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

/**
 * The camera follows the avatar; each world contributes a viewing ANGLE that
 * the rig blends between as the focus moves along X. It is still never a free
 * camera — the viewer cannot orbit or zoom.
 *
 * `offset`     direction and distance from the focus point (its length is
 *              rescaled to fit the viewport).
 * `lookHeight` how far above the focus the camera aims. A single number,
 *              because the rig follows the avatar for X and Z — an X/Z target
 *              here would drag the camera off the thing it is following.
 */
export const CAMERA_FOV = 40

export const worlds = [
  {
    id: 1,
    name: 'World 1 — Foundations & AR',
    biome: 'meadow',
    center: [-58, 0, 0],
    // Isometric, from the LEFT looking right.
    camera: { offset: [-26, 52, 30], lookHeight: 3 },
    path: {
      bossSlotIndex: null,
      // The y values ARE the terrain: ground follows the nearest path height,
      // so a climb here becomes a plateau with cliff faces around it.
      // Orthogonal: every run moves on ONE horizontal axis, joined by hard
      // 90-degree corners. Height may ramp along a run; from above it still
      // reads as a straight blocky segment.
      controlPoints: [
        [-28, 0, 18],
        [-28, 0, 2],
        [-10, 4, 2],
        [-10, 4, -16],
        [6, 8, -16],
        [6, 8, -2],
        [22, 8, -2],
        [22, 4, 12],
        [28, 2, 12],
      ],
    },
  },
  {
    id: 2,
    name: 'World 2 — Meta Building Blocks',
    biome: 'desert',
    center: [0, 0, 0],
    // Frontal.
    camera: { offset: [0, 56, 34], lookHeight: 4 },
    path: {
      // The mini-boss (midterm castle) always sits on this control point, and
      // it splits the world into two equal halves: theory+BB start before it,
      // BB completion after it. Change the index to move the castle.
      bossSlotIndex: 4,
      controlPoints: [
        [-28, 2, 14],
        [-28, 2, -2],
        [-12, 6, -2],
        [-12, 6, -16],
        [0, 12, -16], // <- bossSlot, castle on the highest mesa, exact centre
        [12, 6, -16],
        [12, 6, -2],
        [28, 2, -2],
        [28, 2, 14],
      ],
    },
  },
  {
    id: 3,
    name: 'World 3 — XR Toolkit & Final Project',
    biome: 'summit',
    center: [58, 0, 0],
    // Mirror of World 1: isometric, from the RIGHT looking left.
    camera: { offset: [26, 52, 30], lookHeight: 3 },
    path: {
      // World 1's shape mirrored on X *and reversed*, so the silhouette is the
      // mirror image (matching the mirrored camera) while the route still runs
      // left-to-right. Mirroring alone would start this world at the island's
      // far right edge and make the journey jump backwards over it.
      bossSlotIndex: null,
      // A steady ascent: the final boss stands at the summit, the highest
      // point on the island.
      controlPoints: [
        [-28, 2, 14],
        [-28, 2, -2],
        [-10, 6, -2],
        [-10, 6, -18],
        [8, 10, -18],
        [8, 10, 4],
        [22, 14, 4],
        [22, 14, 18],
        [28, 14, 18],
      ],
    },
  },
]

export const worldById = new Map(worlds.map((w) => [w.id, w]))

/**
 * Half-width of a world's camera track. The camera follows the player inside
 * this band and PINS at the edge, so approaching the next world pushes the
 * character toward the frame edge instead of panning early — classic
 * side-scroller behaviour. It only moves on once the player actually crosses.
 */
export const WORLD_CAMERA_HALF_SPAN = 21

/** The X at which world `a` hands over to world `b`. */
export function worldBoundary(a, b) {
  return (a.center[0] + b.center[0]) / 2
}

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
  // Horizontal only — vertical drift fights the raised, near-overhead angle.
  maxOffset: 2.2, // world units the camera drifts at full pointer deflection
  maxTilt: 0.05, // radians the world tips at full deflection
  damping: 0.055, // 0..1 per frame — lower is smoother/laggier
}
