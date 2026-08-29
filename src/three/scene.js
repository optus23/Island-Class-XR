import * as THREE from 'three'
import { world as themeWorld } from '../config/theme.js'
import { createCameraRig } from './cameraRig.js'

/**
 * Renderer + scene + lights + the render loop. Deliberately thin: everything
 * visual is added to `worldGroup` by the map builder, so parallax tilt applies
 * to the whole island at once.
 *
 * Performance notes (priority #1 for this project):
 *   - pixel ratio capped at 2; a voxel look gains nothing above that
 *   - one directional light, one hemisphere-ish ambient, shadows off by default
 *   - browsers already pause requestAnimationFrame on hidden tabs, so there is
 *     no visibilitychange handler here — one only breaks embedded/offscreen
 *     contexts that still drive frames while reporting document.hidden
 */
export function createScene(container) {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setClearColor(themeWorld.sky)
  renderer.shadowMap.enabled = false
  container.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(themeWorld.sky)
  scene.fog = new THREE.Fog(themeWorld.fog, themeWorld.fogNear, themeWorld.fogFar)

  const worldGroup = new THREE.Group()
  scene.add(worldGroup)

  const ambient = new THREE.AmbientLight(themeWorld.ambient, themeWorld.ambientIntensity)
  scene.add(ambient)

  const sun = new THREE.DirectionalLight(themeWorld.sun, themeWorld.sunIntensity)
  sun.position.set(...themeWorld.sunPosition)
  scene.add(sun)

  const rig = createCameraRig(1)

  // --- pointer (for parallax + raycasting) --------------------------------
  const pointer = new THREE.Vector2(0, 0) // -1..1, NDC
  const parallaxPointer = { x: 0, y: 0 }
  let pointerInside = false

  container.addEventListener('pointermove', (e) => {
    const r = container.getBoundingClientRect()
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1
    pointer.y = -(((e.clientY - r.top) / r.height) * 2 - 1)
    parallaxPointer.x = pointer.x
    parallaxPointer.y = pointer.y
    pointerInside = true
  })
  container.addEventListener('pointerleave', () => {
    pointerInside = false
    parallaxPointer.x = 0
    parallaxPointer.y = 0
  })

  // --- resize --------------------------------------------------------------
  function resize() {
    const w = container.clientWidth || window.innerWidth
    const h = container.clientHeight || window.innerHeight
    renderer.setSize(w, h, false)
    rig.camera.aspect = w / h
    rig.camera.updateProjectionMatrix()
  }
  resize()
  const ro = new ResizeObserver(resize)
  ro.observe(container)

  // --- loop ----------------------------------------------------------------
  /** @type {Array<(dt:number)=>void>} */
  const updaters = []
  let running = false
  let lastTime = 0

  function frame(now) {
    if (!running) return
    // Clamp dt so a backgrounded tab or a stall can never teleport animations.
    const dt = Math.min((now - lastTime) / 1000, 0.05)
    lastTime = now
    for (const fn of updaters) fn(dt)
    rig.update(dt, parallaxPointer)
    worldGroup.rotation.x = rig.tilt.x
    worldGroup.rotation.y = rig.tilt.y
    renderer.render(scene, rig.camera)
    requestAnimationFrame(frame)
  }

  function start() {
    if (running) return
    running = true
    // Reset the clock so the gap while paused never lands as one huge dt.
    lastTime = performance.now()
    requestAnimationFrame(frame)
  }
  function stop() {
    running = false
  }

  return {
    renderer,
    scene,
    worldGroup,
    rig,
    pointer,
    get pointerInside() {
      return pointerInside
    },
    onUpdate: (fn) => updaters.push(fn),
    updaters,
    start,
    stop,
    dispose() {
      stop()
      ro.disconnect()
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}
