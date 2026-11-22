import * as THREE from 'three'
import { hash2 } from './terrain.js'
import { prefersReducedMotion } from '../lib/motion.js'
import { seasonFlags } from '../config/seasons.js'

/**
 * Falling snow. Christmas only — "ha de estar nevando... no muy rápido, nieve
 * no muy pesada".
 *
 * ONE `Points` and ALL THE MOTION IN THE VERTEX SHADER. A flake's position is
 * a pure function of its seed and the clock, so nothing is uploaded per frame:
 * the CPU writes three uniforms and the GPU does the falling, the drift and
 * the wrap. 2400 flakes cost one draw call and 2400 vertices, which is less
 * than one villager's worth of matrices being rewritten.
 *
 * THE SNOW IS A BOX THAT FOLLOWS THE AVATAR, and each flake wraps round it.
 * Covering the whole island would put most of the flakes where the camera
 * never looks. Wrapping in WORLD space rather than moving the box with the
 * avatar is what keeps flakes from sliding sideways as you walk: a flake that
 * leaves one side of the box comes back in the other, but while it is in view
 * it falls where it is.
 *
 * LIGHT SNOW. Slow (1.1 to 2.3 units a second, against an avatar 2.6 tall),
 * small, and drifting on a lazy sideways sway: the reference is a still
 * evening, not a blizzard. It must never get in the way of reading the map.
 *
 * VR: point size is in pixels and positions are in the group's local space,
 * so the size is multiplied by the group's world scale or the diorama would be
 * buried under flakes two hundred times too big — the same trap the water
 * shader and the lights fell into.
 */

const BOX_W = 200
const BOX_H = 70
const BOX_D = 150

/** Round soft flake drawn on a 32px canvas once. */
function flakeTexture() {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = c.height = 32
  const g = c.getContext('2d')
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.45, 'rgba(255,255,255,0.85)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 32, 32)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export function createSnowfall(count = seasonFlags.snowfall) {
  const group = new THREE.Group()
  if (!count) return { group, update() {} }

  const positions = new Float32Array(count * 3)
  const seeds = new Float32Array(count * 4)
  for (let i = 0; i < count; i++) {
    positions[i * 3 + 0] = (hash2(i * 1.31, 7.1) - 0.5) * BOX_W
    positions[i * 3 + 1] = hash2(i * 2.17, 3.3) * BOX_H
    positions[i * 3 + 2] = (hash2(i * 0.73, 9.9) - 0.5) * BOX_D
    seeds[i * 4 + 0] = hash2(i * 4.1, 1.7) // fall speed
    seeds[i * 4 + 1] = hash2(i * 3.3, 5.1) * Math.PI * 2 // sway phase
    seeds[i * 4 + 2] = hash2(i * 6.7, 2.9) // size
    seeds[i * 4 + 3] = hash2(i * 8.3, 4.4) * Math.PI * 2 // second phase
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4))

  const material = new THREE.ShaderMaterial({
    uniforms: {
      ...THREE.UniformsLib.fog,
      uTime: { value: 0 },
      uFocus: { value: new THREE.Vector3() },
      uBox: { value: new THREE.Vector3(BOX_W, BOX_H, BOX_D) },
      uPixel: { value: 400 },
      uMap: { value: flakeTexture() },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uFocus;
      uniform vec3 uBox;
      uniform float uPixel;
      attribute vec4 aSeed;
      varying float vAlpha;
      #include <fog_pars_vertex>
      void main() {
        vec3 p = position;
        float speed = 1.1 + aSeed.x * 1.2;
        // Fall, and wrap round the box's height.
        p.y = mod(p.y - uTime * speed, uBox.y);
        // A lazy sway on two different periods, so flakes never move in step.
        p.x += sin(uTime * 0.55 + aSeed.y) * 1.3 + uTime * 0.35;
        p.z += cos(uTime * 0.47 + aSeed.w) * 1.1;
        // Wrap x and z round the focus, in WORLD space (see the header).
        p.x = uFocus.x + mod(p.x - uFocus.x + uBox.x * 0.5, uBox.x) - uBox.x * 0.5;
        p.z = uFocus.z + mod(p.z - uFocus.z + uBox.z * 0.5, uBox.z) - uBox.z * 0.5;
        p.y += uFocus.y - 8.0;
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        float size = 0.28 + aSeed.z * 0.34;
        gl_PointSize = max(1.0, size * uPixel / -mvPosition.z);
        // Thin out at the top and bottom of the box, so the wrap is never seen
        // as a line of flakes appearing out of nothing.
        float h = mod(position.y - uTime * speed, uBox.y) / uBox.y;
        vAlpha = smoothstep(0.0, 0.12, h) * smoothstep(1.0, 0.8, h);
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      varying float vAlpha;
      #include <fog_pars_fragment>
      void main() {
        vec4 tex = texture2D(uMap, gl_PointCoord);
        gl_FragColor = vec4(vec3(1.0), tex.a * vAlpha * 0.9);
        if (gl_FragColor.a < 0.02) discard;
        #include <fog_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    fog: true,
  })

  const points = new THREE.Points(geo, material)
  // The box moves with the avatar; a bounding sphere computed once would cull
  // the whole snowfall the moment you walked out of it.
  points.frustumCulled = false
  // Drawn after the island, so the flakes never punch holes in the water.
  points.renderOrder = 2
  group.add(points)

  const worldScale = new THREE.Vector3()
  const size = new THREE.Vector2()
  let t = 0

  /**
   * @param {number} dt
   * @param {THREE.Vector3} focus the avatar, in the group's local space
   * @param {THREE.WebGLRenderer} [renderer] for the pixel scale of a point
   */
  function update(dt, focus, renderer) {
    // Reduced motion: it stays snowing, it just stops moving. Same call the
    // bats and the creatures make.
    if (!prefersReducedMotion()) t += dt
    material.uniforms.uTime.value = t
    if (focus) material.uniforms.uFocus.value.copy(focus)
    group.getWorldScale(worldScale)
    if (renderer) renderer.getDrawingBufferSize(size)
    // Same pixel scale PointsMaterial uses: half the drawing buffer's height.
    material.uniforms.uPixel.value = (size.y || 800) * 0.5 * (worldScale.x || 1)
  }

  return { group, update }
}
