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
  /**
   * The context is created BY HAND, purely to pass `xrCompatible: true`.
   *
   * This is not a style choice. `WebGLRenderer` builds its context attributes
   * from a fixed list — alpha, depth, stencil, antialias, premultipliedAlpha,
   * preserveDrawingBuffer, powerPreference, failIfMajorPerformanceCaveat — and
   * `xrCompatible` is not in it, so passing it to the constructor does nothing.
   *
   * Without it, three's `setSession()` hits this:
   *
   *     if (attributes.xrCompatible !== true) await gl.makeXRCompatible()
   *
   * and on a machine whose headset lives on a different GPU than the one Chrome
   * picked — every Quest Link setup with two adapters — `makeXRCompatible()`
   * migrates the context to the other adapter and the WebGL context is LOST.
   * Three then immediately calls `new XRWebGLBinding(session, gl)` on that dead
   * context, which throws **InvalidStateError**, and Chrome restores the context
   * a few seconds later with no session attached. That is exactly the reported
   * failure: an InvalidStateError, a pause, the page coming back, and no VR.
   *
   * Creating the context XR-compatible up front means the adapter is right from
   * the first frame and `makeXRCompatible()` is never called.
   */
  const canvas = document.createElement('canvas')
  const gl = canvas.getContext('webgl2', {
    alpha: true,
    antialias: true,
    depth: true,
    stencil: false,
    powerPreference: 'high-performance',
    xrCompatible: true,
  })

  const renderer = new THREE.WebGLRenderer({
    canvas,
    context: gl ?? undefined,
    antialias: true,
    powerPreference: 'high-performance',
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  // Immersive VR is opt-in per session; enabling the flag alone costs nothing
  // and changes nothing until something calls renderer.xr.setSession().
  renderer.xr.enabled = true

  // A lost context is otherwise silent, and it is the failure mode most likely
  // to come back here. Say so loudly rather than leaving a black canvas.
  canvas.addEventListener('webglcontextlost', (e) => {
    console.error('[xr] WebGL context lost', e)
  })
  canvas.addEventListener('webglcontextrestored', () => {
    console.warn('[xr] WebGL context restored')
  })
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

  /**
   * Stereo depth, 0..1. 0 is genuinely MONOSCOPIC: both eyes are given the
   * same view, so there is no binocular parallax at all.
   *
   * Why this exists: a diorama sitting a metre and a half away is exactly the
   * range where a wrong IPD or a mismatched scale hits hardest, and the tester
   * reported real nausea. Rather than guess at the cause, make the depth a dial
   * that can be turned to zero.
   *
   * It is applied by moving each eye toward the midpoint between them, which is
   * what "reduce the IPD" means geometrically.
   */
  let stereoDepth = 1
  const eyeMid = new THREE.Vector3()

  /**
   * Desktop mirror while presenting.
   *
   * With the headset driving the frame, three renders into the XR framebuffer
   * and the canvas keeps whatever was last in it — which is the clear colour,
   * so the monitor just shows flat sky. Nobody outside the headset can see what
   * the wearer is doing, which makes it impossible to help them.
   *
   * So after the XR pass, render the scene once more to the canvas from the
   * head's own pose. It costs a full extra pass, so it runs on alternate frames
   * and can be switched off.
   */
  let mirror = true
  let mirrorTick = 0
  const mirrorCamera = new THREE.PerspectiveCamera(70, 1, 0.05, 500)

  function renderMirror() {
    if (!mirror) return
    if (++mirrorTick % 2) return // every other frame; the spectator will not mind

    const xrCam = renderer.xr.getCamera()
    const eye = xrCam?.cameras?.[0]
    if (!eye) return

    // Borrow the left eye's pose, but use an ordinary symmetric frustum: the
    // per-eye projection is off-centre and looks visibly skewed on a monitor.
    eye.getWorldPosition(mirrorCamera.position)
    eye.getWorldQuaternion(mirrorCamera.quaternion)

    const w = container.clientWidth || window.innerWidth
    const h = container.clientHeight || window.innerHeight
    mirrorCamera.aspect = w / h
    mirrorCamera.updateProjectionMatrix()

    // xr.enabled off for the duration, or three renders into the XR layer again.
    renderer.xr.enabled = false
    renderer.setRenderTarget(null)
    renderer.setViewport(0, 0, w, h)
    renderer.setScissorTest(false)
    renderer.render(scene, mirrorCamera)
    renderer.xr.enabled = true
  }

  // Three normally refreshes the XR cameras INSIDE render(), after any frame
  // callback has run — so adjusting them from vrUpdate would be overwritten.
  // Taking the update over is the supported way to get in between.
  renderer.xr.cameraAutoUpdate = false

  function applyStereoDepth() {
    const xrCam = renderer.xr.getCamera()
    const eyes = xrCam?.cameras
    if (!eyes || eyes.length < 2) return
    if (stereoDepth >= 1) return

    eyeMid.set(0, 0, 0)
    for (const e of eyes) eyeMid.add(e.position)
    eyeMid.divideScalar(eyes.length)

    for (const e of eyes) {
      e.position.lerp(eyeMid, 1 - stereoDepth)
      e.updateMatrixWorld(true)
      // projectionMatrix carries the per-eye frustum offset, which is the other
      // half of the parallax. At zero depth both eyes must also share it.
      if (stereoDepth === 0) e.projectionMatrix.copy(eyes[0].projectionMatrix)
    }
  }

  function frame(now) {
    if (!running) return
    // Clamp dt so a backgrounded tab or a stall can never teleport animations.
    const dt = Math.min((now - lastTime) / 1000, 0.05)
    lastTime = now
    for (const fn of updaters) fn(dt)

    if (renderer.xr.isPresenting) {
      // The headset owns the camera pose, so the follow rig must not write to
      // it. The parallax tilt is off too — see three/vr.js.
      renderer.xr.updateCamera(rig.camera)
      applyStereoDepth()
      vrUpdate?.(dt)
    } else {
      rig.update(dt, parallaxPointer)
      syncFraming() // worlds differ in camera distance, so framing can change without a resize
      worldGroup.rotation.x = rig.tilt.x
      worldGroup.rotation.y = rig.tilt.y
    }
    renderer.render(scene, rig.camera)
    if (renderer.xr.isPresenting) renderMirror()
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
    /** Desktop spectator view while presenting. Costs an extra pass. */
    setMirror: (on) => {
      mirror = Boolean(on)
      return mirror
    },
    /** 0 = monoscopic, 1 = the headset's true IPD. */
    setStereoDepth: (v) => {
      stereoDepth = Math.max(0, Math.min(1, v))
      return stereoDepth
    },
    get stereoDepth() {
      return stereoDepth
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
