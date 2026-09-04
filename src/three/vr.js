import * as THREE from 'three'

/**
 * Immersive VR entry — EXPERIMENTAL, lives only on the `webxr-vr-mode` branch.
 *
 * Scope for this phase, deliberately: LOOK AROUND AND NAVIGATE THE MAP. Opening
 * a level ends the immersive session and hands over to the normal 2D portal, so
 * nothing here has to render slides inside a headset.
 *
 * THE DIORAMA, and why the island is not walked through at full size
 * The map is ~180 units across and the desktop camera sits ~90 units out with a
 * near plane of 12 — a number chosen precisely because the depth buffer was
 * being wasted on empty space (see CLAUDE.md). Standing inside that at 1 unit =
 * 1 metre would mean a near plane of 0.1 over a 180 m field, which is exactly
 * the depth-precision hole that produced the road/terrain artefacts.
 *
 * So VR presents the island as a TABLETOP DIORAMA: the whole world group is
 * scaled down and parked in front of the viewer at table height. The depth
 * range becomes a couple of metres, the near plane can safely be 0.1, and the
 * result reads like a physical model of the course — which is a better answer
 * for a map than being a giant standing on it.
 *
 * Fog and the parallax tilt are switched off while presenting: both are framing
 * tricks for a fixed 2D camera, and in a headset the first reads as haze at
 * arm's length and the second as the world lurching when you move your head.
 *
 * NOTHING HERE RUNS UNLESS A HEADSET ASKS FOR IT. With no `navigator.xr` the
 * module mounts no button and touches no state.
 */

/** Island units per metre. ~180 units across becomes a ~3.2 m model. */
const DIORAMA_SCALE = 0.018
/** Where the model sits: metres in front of, and above, the floor origin. */
const DIORAMA_AT = [0, 1.05, -1.5]

const PAN_SPEED = 1.1 // metres/second at full stick
const TURN_SPEED = 1.4 // radians/second
const ZOOM_SPEED = 0.9 // scale factor per second
const ZOOM_RANGE = [0.4, 3.2] // multiplier on DIORAMA_SCALE
const DEAD_ZONE = 0.15

export function createVR({
  renderer,
  scene,
  camera,
  worldGroup,
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

  let attached = false
  const saved = {
    parent: null,
    scale: new THREE.Vector3(),
    position: new THREE.Vector3(),
    rotation: new THREE.Euler(),
    near: camera.near,
    fog: null,
  }

  let zoom = 1
  let session = null
  /** True while requestSession is in flight — see startSession(). */
  let starting = false
  let button = null
  let note = null

  // --- controllers ---------------------------------------------------------

  const raycaster = new THREE.Raycaster()
  const tmpMatrix = new THREE.Matrix4()
  const controllers = []

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
    for (const c of controllers) {
      const gp = c.userData.gamepad
      if (!gp) continue
      const hand = c.userData.handedness

      // Quest maps the thumbstick to axes 2/3; 0/1 is the trackpad slot.
      const x = axis(gp, 2) || axis(gp, 0)
      const y = axis(gp, 3) || axis(gp, 1)
      if (!x && !y) continue

      if (hand === 'left') {
        // Pan in the viewer's own horizontal frame, so "left" is screen-left.
        const yaw = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ').y
        worldGroup.position.x -= (x * Math.cos(yaw) - y * Math.sin(yaw)) * PAN_SPEED * dt
        worldGroup.position.z -= (x * Math.sin(yaw) + y * Math.cos(yaw)) * PAN_SPEED * dt
      } else {
        worldGroup.rotation.y += x * TURN_SPEED * dt
        zoom = THREE.MathUtils.clamp(zoom * (1 - y * ZOOM_SPEED * dt), ...ZOOM_RANGE)
        worldGroup.scale.setScalar(DIORAMA_SCALE * zoom)
      }
    }
  }

  // --- session -------------------------------------------------------------

  function attach() {
    if (attached) return
    attached = true

    saved.parent = camera.parent
    saved.scale.copy(worldGroup.scale)
    saved.position.copy(worldGroup.position)
    saved.rotation.copy(worldGroup.rotation)
    saved.near = camera.near
    saved.fog = scene.fog

    dolly.add(camera)

    zoom = 1
    worldGroup.scale.setScalar(DIORAMA_SCALE)
    worldGroup.position.set(...DIORAMA_AT)
    worldGroup.rotation.set(0, 0, 0)

    // Safe at diorama scale: the whole model is ~3 m deep, so the depth buffer
    // is not being asked to cover 180 units any more.
    camera.near = 0.1
    camera.updateProjectionMatrix()
    scene.fog = null
  }

  function detach() {
    if (!attached) return
    attached = false

    if (saved.parent) saved.parent.add(camera)
    else scene.add(camera)

    worldGroup.scale.copy(saved.scale)
    worldGroup.position.copy(saved.position)
    worldGroup.rotation.copy(saved.rotation)
    camera.near = saved.near
    camera.updateProjectionMatrix()
    scene.fog = saved.fog
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

    button = document.createElement('button')
    button.className = 'btn btn-sm vr-button'
    button.textContent = 'Entrar en VR'
    button.addEventListener('click', () => {
      setNote(null)
      session ? endSession() : startSession()
    })
    host.appendChild(button)

    note = document.createElement('p')
    note.className = 'vr-note'
    note.hidden = true
    host.appendChild(note)
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
      updateRays()
      locomotion(dt)
    },
  }
}
