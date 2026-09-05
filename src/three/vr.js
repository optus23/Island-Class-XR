import * as THREE from 'three'

/**
 * Immersive VR entry — EXPERIMENTAL, lives only on the `webxr-vr-mode` branch.
 *
 * Scope for this phase, deliberately: LOOK AROUND AND NAVIGATE THE MAP. Opening
 * a level ends the immersive session and hands over to the normal 2D portal, so
 * nothing here has to render slides inside a headset.
 *
 * THE DIORAMA, and why the island is not walked through at full size
 * The map is ~200 units across and the desktop camera sits ~90 units out with a
 * near plane of 12 — a number chosen precisely because the depth buffer was
 * being wasted on empty space (see CLAUDE.md). Standing inside that at 1 unit =
 * 1 metre would mean a near plane of 0.1 over a 200 m field, which is exactly
 * the depth-precision hole that produced the road/terrain artefacts.
 *
 * So VR presents the island as a TABLETOP DIORAMA: the whole world group is
 * scaled down and parked in front of the viewer at table height. The depth
 * range becomes a couple of metres, the near plane can safely be 0.1, and the
 * result reads like a physical model of the course — which is a better answer
 * for a map than being a giant standing on it.
 *
 * THE MODEL MUST STAY IN FRONT OF YOU. The first version picked the scale by
 * hand against the island's width and forgot the sea, which is 2.4x that width
 * and 3.4x its depth: the water ended up 8.6 x 5.6 m and reached 1.3 m BEHIND
 * the viewer, surface at chest height. That is one bug wearing two hats — the
 * water "not rendering properly" (you were inside it) and rotation "turning me
 * as well" (an 8-metre plane sweeping through your body). The scale is now
 * DERIVED from the measured bounding box, so it stays right as the map grows.
 *
 * The parallax tilt is switched off while presenting: it is a framing trick for
 * a fixed 2D camera and in a headset it reads as the world lurching when you
 * move your head. Fog is left alone on purpose — see attach().
 *
 * STEREO ONLY. A monoscopic mode existed briefly and was deleted: stereo was
 * reported as working perfectly, and every attempt at forcing both eyes onto
 * one view left the right eye facing the wrong way. Three's own per-eye
 * handling is the thing that works; do not take cameraAutoUpdate away from it.
 *
 * NOTHING HERE RUNS UNLESS A HEADSET ASKS FOR IT. With no `navigator.xr` the
 * module mounts no button and touches no state.
 */

/**
 * How wide the WHOLE model is allowed to be, in metres, and where its centre
 * sits relative to the floor origin.
 *
 * The scale itself is derived from the scene's measured bounding box, not
 * hardcoded: the sea is 2.4x the island's width and 3.4x its depth, so a
 * constant tuned against the island alone put the viewer inside the water.
 * Fit the box, and everything stays in front of you whatever the map grows to.
 */
const DIORAMA_SPAN = 2.4
/** Metres in front of the viewer's head, and how far below eye level. */
const DIORAMA_DISTANCE = 1.8
const DIORAMA_DROP = -0.55

const PAN_SPEED = 1.1 // metres/second at full stick
const TURN_SPEED = 1.4 // radians/second
const ZOOM_SPEED = 0.9 // scale factor per second
const ZOOM_RANGE = [0.4, 3.2] // multiplier on the fitted scale
const DEAD_ZONE = 0.15

export function createVR({
  renderer,
  scene,
  camera,
  worldGroup,
  backdrop = null,
  pickTargets = () => [],
  levelFromHit = () => null,
  onSelect = () => {},
  onEnter = () => {},
  playerLevelId = () => null,
}) {
  if (!navigator.xr) {
    return {
      supported: false,
      mount: async () => false,
      update() {},
      endSession() {},
      get presenting() {
        return false
      },
    }
  }

  renderer.xr.enabled = true

  // The camera must hang off a group: in XR three overwrites the camera's own
  // pose from the headset every frame, so the only way to move the viewer is to
  // move its parent.
  const dolly = new THREE.Group()
  dolly.name = 'xr-dolly'
  scene.add(dolly)

  // The diorama hangs off this while presenting. Panning and zooming act on the
  // PIVOT; rotation swings the pivot around the VIEWER's vertical axis, which
  // is what "turn me" means when the model is a thing on a table in front of
  // you rather than something you are inside.
  const pivot = new THREE.Group()
  pivot.name = 'xr-diorama'
  scene.add(pivot)

  let attached = false
  const saved = {
    parent: null,
    worldParent: null,
    scale: new THREE.Vector3(),
    position: new THREE.Vector3(),
    rotation: new THREE.Euler(),
    near: camera.near,
    backdropVisible: null,
  }

  let zoom = 1
  /** Set on entry and by the grip button — see recentre(). */
  let needsRecentre = false
  let session = null
  /** True while requestSession is in flight — see startSession(). */
  let starting = false
  let button = null
  let note = null

  // --- controllers ---------------------------------------------------------

  const raycaster = new THREE.Raycaster()
  const tmpMatrix = new THREE.Matrix4()
  const controllers = []

  const headPos = new THREE.Vector3()
  const headFwd = new THREE.Vector3()
  const headRight = new THREE.Vector3()
  const UP = new THREE.Vector3(0, 1, 0)

  /**
   * Where the head actually is, in world space, and which way it faces.
   *
   * Read from renderer.xr.getCamera() rather than from the camera object we
   * hand to render(): the XR camera is the one three fills in from the headset
   * pose, and it is unambiguously in world space. Deriving a yaw angle from the
   * other one via Euler decomposition was both indirect and gimbal-prone when
   * looking steeply up or down.
   *
   * @returns {boolean} false before the first pose has arrived.
   */
  function readHead() {
    const xrCam = renderer.xr.getCamera()
    if (!xrCam) return false
    xrCam.getWorldPosition(headPos)
    xrCam.getWorldDirection(headFwd)
    headFwd.y = 0
    if (headFwd.lengthSq() < 1e-6) return false // looking straight up or down
    headFwd.normalize()
    // For a camera looking along `fwd` with +Y up, right is fwd x up.
    headRight.crossVectors(headFwd, UP).normalize()
    return true
  }

  function makeRay() {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -1),
    ])
    const line = new THREE.Line(
      geo,
      new THREE.LineBasicMaterial({ color: 0xf2c14e, transparent: true, opacity: 0.8 })
    )
    line.name = 'ray'
    line.scale.z = 3
    return line
  }

  for (let i = 0; i < 2; i++) {
    const c = renderer.xr.getController(i)
    c.add(makeRay())
    c.userData.hit = null
    c.addEventListener('selectstart', () => onTrigger(c))
    // Grip re-centres the model in front of you, wherever you have wandered to.
    c.addEventListener('squeezestart', () => {
      needsRecentre = true
    })
    c.addEventListener('connected', (e) => {
      c.userData.handedness = e.data?.handedness ?? (i === 0 ? 'left' : 'right')
      c.userData.gamepad = e.data?.gamepad ?? null
    })
    c.addEventListener('disconnected', () => {
      c.userData.gamepad = null
    })
    dolly.add(c)
    controllers.push(c)
  }

  /**
   * Point and pull: first trigger on a node selects it and the avatar walks
   * there; a second trigger on the node it is already standing on enters, which
   * ENDS the session — the level portal is a 2D surface in this phase.
   */
  function onTrigger(controller) {
    const level = controller.userData.hit
    if (!level) return
    if (level.id === playerLevelId()) {
      endSession() // exit first, so the portal opens on a flat screen
      onEnter(level)
      return
    }
    onSelect(level)
  }

  function updateRays() {
    const targets = pickTargets()
    for (const c of controllers) {
      tmpMatrix.identity().extractRotation(c.matrixWorld)
      raycaster.ray.origin.setFromMatrixPosition(c.matrixWorld)
      raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tmpMatrix)

      const hit = targets.length ? raycaster.intersectObjects(targets, false)[0] : null
      const level = hit ? levelFromHit(hit) : null
      c.userData.hit = level

      const ray = c.getObjectByName('ray')
      if (ray) {
        ray.scale.z = hit ? hit.distance : 3
        ray.material.color.setHex(level ? 0x38b000 : 0xf2c14e)
      }
    }
  }

  // --- locomotion ----------------------------------------------------------

  const axis = (gamepad, i) => {
    const v = gamepad?.axes?.[i] ?? 0
    return Math.abs(v) < DEAD_ZONE ? 0 : v
  }

  /**
   * Left stick pans the model, right stick turns and zooms it.
   *
   * The MODEL moves, not the viewer. Pushing a standing person around by
   * thumbstick is the classic way to make them sick, and for a tabletop map
   * reaching over and spinning it is what you would actually do.
   */
  function locomotion(dt) {
    const oriented = readHead()
    for (const c of controllers) {
      const gp = c.userData.gamepad
      if (!gp) continue
      const hand = c.userData.handedness

      // Quest maps the thumbstick to axes 2/3; 0/1 is the trackpad slot.
      const x = axis(gp, 2) || axis(gp, 0)
      const y = axis(gp, 3) || axis(gp, 1)
      if (!x && !y) continue

      if (hand === 'left') {
        // Move in the direction you are LOOKING, not along the world axes.
        //
        // The old version built a yaw angle and rotated the stick vector by it
        // with the sine terms the wrong way round, so the frame turned opposite
        // to the head and the whole thing behaved as if it were world-locked.
        // Composing the head's own right/forward vectors removes the trig, and
        // the sign question, entirely.
        //
        // Stick forward is NEGATIVE y on a Quest, and the model moves opposite
        // to the viewer's intent — push forward and the map slides toward you.
        if (!oriented) continue
        pivot.position.addScaledVector(headRight, -x * PAN_SPEED * dt)
        pivot.position.addScaledVector(headFwd, y * PAN_SPEED * dt)
      } else {
        // ROTATE ABOUT THE VIEWER, not about the model.
        //
        // Turning the model on its own centre was tried first and was reported
        // as uncomfortable every time: a two-metre model spinning in front of
        // you fills the view with optical flow that reads as self-motion. What
        // a person actually wants from a right stick is "turn me" — so the
        // whole diorama is swung around the HEAD's vertical axis instead, which
        // is geometrically identical to the viewer turning on the spot.
        if (!oriented) continue
        const turn = x * TURN_SPEED * dt
        pivot.position.sub(headPos).applyAxisAngle(UP, turn).add(headPos)
        pivot.rotation.y += turn

        zoom = THREE.MathUtils.clamp(zoom * (1 - y * ZOOM_SPEED * dt), ...ZOOM_RANGE)
        pivot.scale.setScalar(zoom)
      }
    }
  }

  /**
   * Put the model in front of the VIEWER, not in front of the origin.
   *
   * This is the real reason rotation felt like it swung around some other
   * point. The diorama was parked at a fixed spot in the reference space, and
   * with Link that origin is wherever the play space happened to be set up —
   * so if you are standing a metre to one side of it, the model sits a metre
   * to your side too. Turning it then sweeps it across your view instead of
   * spinning it on the spot, which reads exactly as "I am the one moving".
   *
   * Anchoring to the head pose means the model is always centred on your line
   * of sight when you enter, and the grip button brings it back.
   */
  function recentre() {
    if (!readHead()) return false
    pivot.position
      .copy(headPos)
      .addScaledVector(headFwd, DIORAMA_DISTANCE)
    pivot.position.y = headPos.y + DIORAMA_DROP
    // Face the model's "north" at the viewer, so entering always looks the same
    // however the play space happens to be oriented.
    pivot.rotation.set(0, Math.atan2(headFwd.x, headFwd.z) + Math.PI, 0)
    return true
  }

  // --- session -------------------------------------------------------------

  function attach() {
    if (attached) return
    attached = true

    saved.parent = camera.parent
    saved.worldParent = worldGroup.parent
    saved.scale.copy(worldGroup.scale)
    saved.position.copy(worldGroup.position)
    saved.rotation.copy(worldGroup.rotation)
    saved.near = camera.near
    saved.backdropVisible = backdrop ? backdrop.visible : null

    dolly.add(camera)

    // The backdrop is a fixed-camera trick: distant hills with their markings
    // projected onto an ellipsoid for one particular viewing angle. In a
    // headset you can walk round the model and see it edge-on, where it reads
    // as a painted flat. It is also the widest thing in the scene, so leaving
    // it in would shrink everything else to fit it.
    if (backdrop) backdrop.visible = false

    // MEASURE, don't assume. The first version scaled by a guessed constant and
    // the sea — which is 2.4x the island's width and 3.4x its depth — ended up
    // 8.6 x 5.6 m, stretching 1.3 m BEHIND the viewer. You stood inside the sea
    // with the surface at chest height, which is why the water looked wrong and
    // why rotating swept the whole plane through you.
    worldGroup.position.set(0, 0, 0)
    worldGroup.rotation.set(0, 0, 0)
    worldGroup.scale.setScalar(1)
    worldGroup.updateMatrixWorld(true)

    const box = new THREE.Box3().setFromObject(worldGroup)
    const size = box.getSize(new THREE.Vector3())
    const centre = box.getCenter(new THREE.Vector3())
    const span = Math.max(size.x, size.z) || 1
    const s = DIORAMA_SPAN / span

    // Centre the model ON the pivot's origin, so the pivot's rotation is the
    // model turning on the spot rather than orbiting some arbitrary point.
    worldGroup.scale.setScalar(s)
    worldGroup.position.copy(centre).multiplyScalar(-s)
    pivot.add(worldGroup)

    zoom = 1
    pivot.scale.setScalar(1)
    // Placed for real on the first frame that has a head pose; there is none
    // yet at this point in the handshake.
    pivot.position.set(0, 1.0, -DIORAMA_DISTANCE)
    pivot.rotation.set(0, 0, 0)
    needsRecentre = true

    // Safe now: the whole model is a couple of metres deep, so the depth buffer
    // is no longer being asked to cover 180 units.
    camera.near = 0.1
    camera.updateProjectionMatrix()

    // Fog is deliberately LEFT ALONE. fogNear is 260 world units and nothing in
    // the diorama is further than about three metres from the eye, so it
    // contributes nothing anyway — while setting `scene.fog = null` changes the
    // program cache key and forces every material in the scene to recompile,
    // once on entry and again on exit. That stall is not worth a no-op.
  }

  function detach() {
    if (!attached) return
    attached = false

    if (saved.parent) saved.parent.add(camera)
    else scene.add(camera)

    if (saved.worldParent) saved.worldParent.add(worldGroup)
    else scene.add(worldGroup)

    worldGroup.scale.copy(saved.scale)
    worldGroup.position.copy(saved.position)
    worldGroup.rotation.copy(saved.rotation)
    if (backdrop && saved.backdropVisible !== null) backdrop.visible = saved.backdropVisible
    camera.near = saved.near
    camera.updateProjectionMatrix()
  }

  async function startSession() {
    // `session` is only assigned once setSession() has succeeded, so it does
    // not guard the window while requestSession is still in flight. Without a
    // second flag a double click fires two requests, the first one wins, and
    // the second is refused with "There is already an active, immersive
    // XRSession" — leaving one session alive that nothing owns.
    if (session || starting) return
    starting = true

    // ONE try around both halves. setSession() used to be awaited outside it,
    // so when it threw — which is what InvalidStateError does here — the
    // rejection was unhandled, the button kept saying "Entrar en VR" and the
    // only trace was a console line. An error the user cannot see is a bug.
    let pending = null
    try {
      // A previous attempt that failed after requestSession succeeded can leave
      // an immersive session alive at the browser level. Three still holds it
      // even when this module's own reference is gone — which is exactly what
      // survives a hot reload, since the document is never torn down.
      const stale = renderer.xr.getSession?.()
      if (stale) {
        console.warn('[xr] ending a stale session before starting a new one')
        await stale.end().catch(() => {})
      }

      pending = await navigator.xr.requestSession('immersive-vr', {
        // No 'layers'. Three picks the projection-layer path from feature
        // detection, not from this list, so asking for it buys nothing and is
        // one more thing that can be refused.
        optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'],
      })

      pending.addEventListener('end', () => {
        session = null
        detach()
        setLabel('Entrar en VR')
      })

      attach()
      await renderer.xr.setSession(pending)
      session = pending
      setLabel('Salir de VR')
    } catch (e) {
      // Leave nothing half-attached: a failed entry must return the map to
      // exactly the 2D state it was in.
      detach()
      session = null
      pending?.end().catch(() => {})
      setLabel('Entrar en VR')
      console.error('[xr] could not start the session:', e)
      // On screen, not only in the console: whoever hits this is wearing a
      // headset or standing at a laptop with no devtools open. And when the
      // message is one we recognise, say what to DO about it rather than
      // repeating the browser's wording back at them.
      const orphan = e.name === 'InvalidStateError' && /already/i.test(e.message ?? '')
      setNote(
        orphan
          ? 'Quedó una sesión de VR abierta de un intento anterior. Cierra esta ' +
              'pestaña del todo (recargar no basta) y vuelve a abrirla.'
          : `${e.name}: ${e.message}`
      )
    } finally {
      starting = false
    }
  }

  function endSession() {
    session?.end().catch(() => {})
  }

  function setLabel(text) {
    if (button) button.textContent = text
  }

  function setNote(text) {
    if (!note) return
    note.textContent = text ?? ''
    note.hidden = !text
  }

  // --- the button ----------------------------------------------------------

  async function mount(host) {
    let ok = false
    try {
      ok = await navigator.xr.isSessionSupported('immersive-vr')
    } catch {
      ok = false
    }
    if (!ok) return false // no headset: no button, nothing changed

    // One bar holding both, so "beside Entrar en VR" is literally where it is.
    // The first version positioned each button `fixed` on its own and the
    // stereo one landed in the opposite corner from where it was described.
    const bar = document.createElement('div')
    bar.className = 'vr-bar'

    button = document.createElement('button')
    button.className = 'btn btn-sm vr-button'
    button.textContent = 'Entrar en VR'
    button.addEventListener('click', () => {
      setNote(null)
      session ? endSession() : startSession()
    })
    bar.appendChild(button)

    note = document.createElement('p')
    note.className = 'vr-note'
    note.hidden = true
    bar.appendChild(note)

    host.appendChild(bar)
    return true
  }

  return {
    supported: true,
    mount,
    endSession,
    get presenting() {
      return Boolean(session)
    },
    update(dt) {
      if (!session) return
      if (needsRecentre && recentre()) needsRecentre = false
      updateRays()
      locomotion(dt)
    },
  }
}
