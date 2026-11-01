import * as THREE from 'three'
import { seasonFlags } from '../config/seasons.js'

/**
 * A small, fixed pool of real point lights that follows the avatar.
 *
 * Halloween only. Night was carried entirely by the ambient until now, and the
 * map came back as "no se aprecia de la oscuridad que hay": a dark island with
 * nothing actually glowing on it reads as under-exposed rather than as night.
 *
 * MEASURED, because the cost here is not where it looks. three.js has no light
 * culling at all — the shader loops over EVERY light for EVERY lit fragment,
 * whether that light reaches the pixel or is behind the camera — so the price
 * is `lights x pixels` and nothing else. On an RTX 3060 at 786k pixels:
 *
 *     0 lights  0.52 ms      16 lights  0.89 ms
 *     4 lights  0.58 ms      32 lights  1.38 ms
 *     8 lights  0.69 ms      64 lights  2.43 ms
 *
 * and it scales linearly with pixel count: the same 26 lights cost 0.58 ms at
 * 786k pixels, 2.24 ms at 3.1M and 4.80 ms at 7.1M. A phone has roughly 3M
 * pixels and a GPU the better part of ten times slower, which is what turns
 * "26 lights is 11% of a frame" on this desktop into most of a frame there.
 *
 * Hence a HANDFUL, chosen by distance. The island can carry as many emitters
 * as it likes — lampposts, lit pumpkins, castle windows — and only the nearest
 * `seasonFlags.lights` are ever real. Everything further away keeps the bright
 * pane or carved face it already had, which at that distance reads the same.
 *
 * THE POOL IS FIXED SIZE AND NEVER GROWS OR SHRINKS. The light count is baked
 * into the shader program, so adding or removing one forces three.js to
 * recompile every material in the scene. That cost is invisible in a frame
 * average and very visible as a stutter the moment you walk past a lamppost —
 * it is also what made the first measurement of this nonsense, reporting 6
 * lights as costing more than 26. The lights are created once and only ever
 * moved and re-tinted.
 */

/**
 * Warm sodium for a lamp, pumpkin orange for a jack-o'-lantern.
 *
 * THE INTENSITIES LOOK ENORMOUS AND ARE NOT. Since three r155 a PointLight is
 * physical: `decay: 2` means the light falls off with the square of the
 * distance, and intensity is in candela. A lamp head sits 4.26 units above the
 * road, so an intensity of 5.5 — which sounds like plenty — arrives at the
 * ground as 5.5 / 4.26² ≈ 0.3, and the first build of this lit nothing at all.
 * The posts were visible and the road under them was not.
 *
 * Tuned against the screenshots, not computed: 45 puts a readable warm pool on
 * the road without blowing out the voxels right under the head.
 */
const TONE = {
  lamp: { color: 0xffc46b, intensity: 45, distance: 20 },
  // Lower to the ground and much smaller, so it needs far less to read.
  pumpkin: { color: 0xff9a3c, intensity: 9, distance: 9 },
}

/**
 * How far the focus has to move before the nearest-N list is recomputed.
 *
 * The sort is trivial — a few dozen emitters — but it is pointless every
 * frame, and re-picking while standing still makes a light flicker between two
 * emitters that are the same distance away.
 */
const REPICK_AFTER = 3

export function createSeasonLights(emitters = []) {
  const group = new THREE.Group()
  const budget = seasonFlags.lights | 0
  if (budget <= 0 || !emitters.length) return { group, update() {} }

  /**
   * NEVER TOGGLE `visible`, EITHER. An invisible light is not in the list the
   * renderer builds, so flipping one is a change in the light COUNT and
   * recompiles exactly as adding one would — the pool was fixed in size here
   * and still recompiled on the first pick, which threw a one-frame
   * `setupLights` error on every load. A slot with nothing to light is parked
   * at zero intensity instead: still in the list, still costing its loop
   * iteration, which is the price of never recompiling again.
   */
  const pool = []
  for (let i = 0; i < budget; i++) {
    const light = new THREE.PointLight(0xffc46b, 0, 1, 2)
    group.add(light)
    pool.push(light)
  }

  const last = new THREE.Vector3(Infinity, Infinity, Infinity)
  const scored = emitters.map((e) => ({ e, d: 0 }))
  const worldScale = new THREE.Vector3()

  function repick(focus) {
    for (const s of scored) {
      const dx = s.e.x - focus.x
      const dz = s.e.z - focus.z
      s.d = dx * dx + dz * dz // squared: the ordering is all that matters
    }
    scored.sort((a, b) => a.d - b.d)

    /**
     * `distance` is a WORLD-space radius and the diorama scales the whole
     * group by about 0.005 in VR, so a lamp with a 17-unit reach would light
     * the entire island from one corner of a tabletop map. Scaling it by the
     * group's own world scale keeps the falloff looking the same at both
     * sizes — the same trap the water shader fell into.
     */
    group.getWorldScale(worldScale)
    const s = worldScale.x || 1

    for (let i = 0; i < pool.length; i++) {
      const light = pool[i]
      const pick = scored[i]
      if (!pick) {
        light.intensity = 0 // parked, not hidden — see the pool comment
        continue
      }
      const tone = TONE[pick.e.kind] ?? TONE.lamp
      light.position.set(pick.e.x, pick.e.y, pick.e.z)
      light.color.setHex(tone.color)
      light.intensity = tone.intensity
      light.distance = tone.distance * s
    }
  }

  function update(_dt, focus) {
    if (!focus) return
    if (focus.distanceToSquared(last) < REPICK_AFTER * REPICK_AFTER) return
    last.copy(focus)
    repick(focus)
  }

  return {
    group,
    update,
    /** For measuring from the console: how many are actually alight. */
    get lit() {
      return pool.filter((l) => l.intensity > 0).length
    },
  }
}
