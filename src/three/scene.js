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
  // Immersive VR is opt-in per session; enabling the flag alone costs nothing
  // and changes nothing until something calls renderer.xr.setSession().
  renderer.xr.enabled = true
  renderer.setClearColor(themeWorld.sky)
  renderer.shadowMap.enabled = false
  container.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(themeWorld.sky)
  scene.fog = new THREE.Fog(themeWorld.fog, themeWorld.fogNear, themeWorld.fogFar)

  const worldGroup = new THREE.Group()
  scene.add(worldGroup)

  // Hemisphere rather than flat ambient: sky-tinted tops and ground-tinted
  // undersides give voxel cubes readable shape without a second shadow pass.
  const ambient = new THREE.HemisphereLight(
    themeWorld.ambient,
    themeWorld.terrainEdge,
    themeWorld.ambientIntensity
  )
  scene.add(ambient)

  const sun = new THREE.DirectionalLight(themeWorld.sun, themeWorld.sunIntensity)
  sun.position.set(...themeWorld.sunPosition)
  scene.add(sun)

  const rig = createCameraRig()

  /**
   * Fog is measured from the camera, so it must follow the rig's framing. Without
   * this, pushing the camera back on a narrow phone viewport drops the whole
   * island past fogFar and the map fades out to flat sky.
   *
   * Memoised on the scale, because it touches updateProjectionMatrix and the
   * framing only changes on resize or when moving between worlds.
   */
  let lastFitScale = 0
  function syncFraming() {
    const scale = rig.fitScale
    if (Math.abs(scale - lastFitScale) < 1e-3) return
    lastFitScale = scale
    scene.fog.near = themeWorld.fogNear * scale
    scene.fog.far = themeWorld.fogFar * scale
    rig.camera.far = Math.max(400, themeWorld.fogFar * scale * 1.35)
    rig.camera.updateProjectionMatrix()
  }

  // --- pointer (for parallax + raycasting) --------------------------------
  const pointer = new THREE.Vector2(0, 0) // -1..1, NDC
  const parallaxPointer = { x: 0, y: 0 }
  let pointerInside = false

  /**
   * Put the raycast pointer at a client position.
   *
   * Exposed because a TAP may never produce a pointermove: on touch the first
   * event a finger generates is pointerdown, and picking from a stale NDC made
   * taps select whatever the previous gesture had been over.
   *
   * `drift` is the parallax contribution and is mouse-only — a finger dragging
   * the camera must not also slide the whole world sideways.
   */
  function setPointerAt(clientX, clientY, { drift = true } = {}) {
    const r = container.getBoundingClientRect()
    pointer.x = ((clientX - r.left) / r.width) * 2 - 1
    pointer.y = -(((clientY - r.top) / r.height) * 2 - 1)
    if (drift) {
      parallaxPointer.x = pointer.x
      parallaxPointer.y = pointer.y
    }
    pointerInside = true
  }

  container.addEventListener('pointermove', (e) => {
    setPointerAt(e.clientX, e.clientY, { drift: e.pointerType === 'mouse' })
  })
  container.addEventListener('pointerleave', () => {
    pointerInside = false
    parallaxPointer.x = 0
    parallaxPointer.y = 0
  })

  // --- resize --------------------------------------------------------------
  function resize() {
    // While presenting, the headset owns the framebuffer size and the
    // projection. Touching either from here fights it.
    if (renderer.xr.isPresenting) return
    const w = container.clientWidth || window.innerWidth
    const h = container.clientHeight || window.innerHeight
    renderer.setSize(w, h, false)
    const aspect = w / h
    rig.camera.aspect = aspect
    rig.camera.updateProjectionMatrix()
    // Let the rig re-frame: a narrow portrait viewport needs the camera pushed
    // back or only a corner of the world is visible.
    rig.setAspect(aspect)
    syncFraming()
  }
  resize()
  const ro = new ResizeObserver(resize)
  ro.observe(container)

  // --- loop ----------------------------------------------------------------
  /** @type {Array<(dt:number)=>void>} */
  const updaters = []
  let running = false
  let lastTime = 0

  /** Per-frame hook used only while an immersive session is presenting. */
  let vrUpdate = null

  function frame(now) {
    if (!running) return
    // Clamp dt so a backgrounded tab or a stall can never teleport animations.
    const dt = Math.min((now - lastTime) / 1000, 0.05)
    lastTime = now
    for (const fn of updaters) fn(dt)

    if (renderer.xr.isPresenting) {
      // The headset owns the camera pose, so the follow rig must not write to
      // it. Fog and the parallax tilt are off too — see three/vr.js.
      vrUpdate?.(dt)
    } else {
      rig.update(dt, parallaxPointer)
      syncFraming() // worlds differ in camera distance, so framing can change without a resize
      worldGroup.rotation.x = rig.tilt.x
      worldGroup.rotation.y = rig.tilt.y
    }
    renderer.render(scene, rig.camera)
  }

  // setAnimationLoop, not requestAnimationFrame: WebXR drives frames from the
  // headset's own clock, and rAF is simply never called while presenting.
  // Outside a session three falls back to rAF, so 2D behaviour is unchanged.
  function start() {
    if (running) return
    running = true
    // Reset the clock so the gap while paused never lands as one huge dt.
    lastTime = performance.now()
    renderer.setAnimationLoop(frame)
  }
  function stop() {
    running = false
    renderer.setAnimationLoop(null)
  }

  return {
    renderer,
    scene,
    worldGroup,
    rig,
    pointer,
    setPointerAt,
    get pointerInside() {
      return pointerInside
    },
    onUpdate: (fn) => updaters.push(fn),
    setVRUpdate: (fn) => {
      vrUpdate = fn
    },
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
