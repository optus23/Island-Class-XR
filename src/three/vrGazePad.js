import * as THREE from 'three'

/**
 * The locomotion controls for a headset that has no controllers — which in
 * practice means a phone in a Cardboard-style holder, and those are the
 * headsets the STUDENTS have.
 *
 * WHY THIS EXISTS AT ALL
 * On a Quest the thumbsticks turn and zoom the diorama. A phone in a holder
 * reports `immersive-vr` and offers neither sticks nor DOM — an immersive
 * session paints only the WebGL layer, so the on-screen camera pad is invisible
 * in there and the screen itself is against the wearer's face. Until this, such
 * a viewer could look around and dwell-select a node and nothing else: the map
 * could not be turned, moved or zoomed by any means at all.
 *
 * Volume buttons were the obvious idea and are not available to a web page:
 * Android hands the volume keys to the system, not to the document, and the old
 * Cardboard trick of watching `volumechange` on a muted <audio> stopped working
 * when those keys moved the stream volume rather than the element's. So the
 * only input a phone in a holder reliably has is WHERE IT IS LOOKING.
 *
 * GAZE-AND-HOLD, NOT DWELL. Selecting a node waits 1.4 s on purpose, because
 * entering a level is a commitment. Turning the map is not: a dwell per nudge
 * would make a quarter-turn take half a minute. Resting the reticle on a button
 * acts for as long as it rests there — the look IS the hold.
 *
 * ONE MESH, ONE TEXTURE, HIT-TESTED BY UV. Five separate planes would be five
 * draw calls and five raycast targets for a strip of buttons that never move
 * relative to each other. The intersection's `uv.x` says which cell was hit,
 * and the canvas is only repainted when the highlighted cell changes.
 */

/**
 * Bigger than the first cut (0.9 x 0.18), because gaze is a coarse pointer: the
 * head does not hold still, so a cell has to be a comfortable target rather
 * than a minimum one. At AHEAD these five cells are ~9 degrees wide each.
 */
const PANEL_W = 1.25 // metres
const PANEL_H = 0.26
const CANVAS_W = 1000
const CANVAS_H = Math.round((CANVAS_W * PANEL_H) / PANEL_W)

/**
 * WHERE THE STRIP LIVES. Four designs; the first three are all wrong and the
 * reasons are worth keeping, because each looks obviously right until you use it.
 *
 * 1. WORLD-LOCKED, placed once in front of wherever you faced on entry. Aimable,
 *    and useless for getting anywhere: the map moved somewhere you could not see
 *    while your head stayed pointed at one fixed corner of the room — "no hay
 *    forma de mirar hacia delante".
 *
 * 2. YAW-FOLLOWING, swinging round to stay ahead of you. Worse. The cells are
 *    laid out HORIZONTALLY, so choosing one means turning your head sideways,
 *    and a strip that follows yaw turns with you: the target walks away from the
 *    reticle at exactly the speed you chase it. Only the middle cell was ever
 *    reachable. "Esquiva el target del gaze al seguir el punto central."
 *
 * 3. FOLLOWING WITH AN ANGULAR DEADZONE. Fixes the dodge and introduces a lag
 *    that never resolves: with hysteresis wide enough to cover the +/-21 degrees
 *    of aiming, a settled strip sits up to 12 degrees off, and the NEXT turn of
 *    under 55 degrees does not re-trigger. Measured it stranded at 46 degrees to
 *    one side permanently.
 *
 * 4. FREEZE WHILE IT IS BEING AIMED AT, which is what this is, and the only one
 *    that needs no threshold at all. The module already knows the answer —
 *    `aim()` computes it every frame — so the strip follows your facing
 *    continuously while you are NOT looking at it, and stops dead the instant
 *    the reticle lands on a cell. It is below your eyeline, so looking forward
 *    never engages it: you turn to face where you want to go with the strip
 *    trailing along, nod down onto it, and from that moment it is as still as a
 *    table for as long as you are using it.
 */
const AHEAD = 1.3
const DROP = -0.62
/** How fast it trails your facing while nobody is aiming at it. Per second. */
const FOLLOW = 3.5
/**
 * How long it stays frozen after the gaze slips off. Without this, drifting a
 * degree past the edge of a cell makes it lurch, which reads as the dodge again.
 *
 * Counted down with `dt`, not against `performance.now()`. Everything else in
 * this module is frame-driven, and a wall clock mixed in behaves differently
 * whenever the frame rate does — which is exactly the sort of thing that only
 * shows up on the slowest device in the room.
 */
const HOLD = 0.5 // seconds

/**
 * It also gets out of the way. A strip pinned at full strength in the bottom of
 * every frame is what "la UI World está completamente estática" describes; this
 * fades back when you look up and comes forward as you look down toward it.
 * Never to zero — a control nobody can see is a control nobody knows exists.
 */
const DIM = 0.22

const FONT = 'Fredoka, ui-rounded, "Segoe UI", system-ui, sans-serif'

/** Left to right. `id` is what `aim()` reports back to the caller. */
const CELLS = [
  { id: 'left', glyph: '◀' },
  { id: 'right', glyph: '▶' },
  { id: 'out', glyph: '−' },
  { id: 'in', glyph: '+' },
  { id: 'recentre', glyph: '⌖' },
]

const HINT_W = 1.25
const HINT_H = 0.24

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export function createGazePad() {
  const group = new THREE.Group()
  group.name = 'xr-gaze-pad'
  group.visible = false

  // --- the button strip -----------------------------------------------------
  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_W
  canvas.height = CANVAS_H
  const ctx = canvas.getContext('2d')

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.generateMipmaps = false
  texture.minFilter = THREE.LinearFilter
  texture.anisotropy = 4

  let hot = -1
  /** 0..1 while the gaze is arming the hot cell — see `setCharge`. */
  let charge = 0

  function paint() {
    const cw = CANVAS_W / CELLS.length
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)

    // The island's own chrome, so this belongs to the same world as the panels.
    ctx.fillStyle = '#171f2b'
    roundRect(ctx, 4, 4, CANVAS_W - 8, CANVAS_H - 8, 26)
    ctx.fill()
    ctx.lineWidth = 6
    ctx.strokeStyle = '#0b0f16'
    ctx.stroke()

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    CELLS.forEach((cell, i) => {
      const x = i * cw
      const on = i === hot
      ctx.fillStyle = on ? '#f2c14e' : '#1f2937'
      roundRect(ctx, x + 12, 16, cw - 24, CANVAS_H - 32, 18)
      ctx.fill()
      ctx.lineWidth = 4
      ctx.strokeStyle = '#0b0f16'
      ctx.stroke()

      // The arming bar. The button does nothing for the length of the dwell, so
      // it has to SAY it is counting or the wearer concludes it is broken and
      // looks away before it fires — which was the complaint about the first
      // version from the other side: no middle ground between nothing and
      // everything.
      if (on && charge > 0 && charge < 1) {
        ctx.save()
        roundRect(ctx, x + 12, 16, cw - 24, CANVAS_H - 32, 18)
        ctx.clip()
        ctx.fillStyle = '#38b000'
        ctx.fillRect(x + 12, CANVAS_H - 34, (cw - 24) * charge, 14)
        ctx.restore()
      }

      ctx.fillStyle = on ? '#12161d' : '#f2f6fb'
      ctx.font = `600 ${Math.round(CANVAS_H * 0.42)}px ${FONT}`
      ctx.fillText(cell.glyph, x + cw / 2, CANVAS_H / 2 + 2)
    })
    texture.needsUpdate = true
  }
  paint()

  const strip = new THREE.Mesh(
    new THREE.PlaneGeometry(PANEL_W, PANEL_H),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthTest: false })
  )
  strip.name = 'xr-gaze-pad-strip'
  strip.renderOrder = 12
  group.add(strip)

  // --- the hint -------------------------------------------------------------
  //
  // Nobody arrives knowing that looking at a button is what presses it, and
  // there is no manual to hand a student wearing a phone. It sits above the
  // strip and goes the first time the pad is actually used.
  const hintCanvas = document.createElement('canvas')
  hintCanvas.width = 1000
  hintCanvas.height = Math.round((1000 * HINT_H) / HINT_W)
  const hctx = hintCanvas.getContext('2d')
  hctx.fillStyle = 'rgba(11,15,22,0.82)'
  roundRect(hctx, 4, 4, hintCanvas.width - 8, hintCanvas.height - 8, 22)
  hctx.fill()
  hctx.lineWidth = 5
  hctx.strokeStyle = '#0b0f16'
  hctx.stroke()
  hctx.textAlign = 'center'
  hctx.textBaseline = 'middle'
  hctx.fillStyle = '#f2c14e'
  hctx.font = `600 52px ${FONT}`
  hctx.fillText('Mira un botón para mover el mapa', hintCanvas.width / 2, hintCanvas.height * 0.36)
  hctx.fillStyle = '#eaf4ff'
  hctx.font = `500 42px ${FONT}`
  hctx.fillText('Mantén la mirada encima', hintCanvas.width / 2, hintCanvas.height * 0.72)

  const hintTexture = new THREE.CanvasTexture(hintCanvas)
  hintTexture.colorSpace = THREE.SRGBColorSpace
  hintTexture.generateMipmaps = false
  hintTexture.minFilter = THREE.LinearFilter

  const hint = new THREE.Mesh(
    new THREE.PlaneGeometry(HINT_W, HINT_H),
    new THREE.MeshBasicMaterial({ map: hintTexture, transparent: true, depthTest: false })
  )
  hint.name = 'xr-gaze-pad-hint'
  hint.renderOrder = 12
  hint.position.y = PANEL_H * 0.5 + HINT_H * 0.5 + 0.04
  group.add(hint)

  const target = new THREE.Vector3()
  const flat = new THREE.Vector3()
  /** Seconds of freeze still owed to the gaze — see HOLD. */
  let holdLeft = 0

  return {
    group,

    /**
     * Trail the viewer's facing — but ONLY while nobody is aiming at the strip.
     * See the numbered history above for the three designs this replaces.
     *
     * The height tracks the head every frame regardless: moving a horizontal row
     * of cells vertically cannot make it dodge, and without it the strip sits at
     * the wrong height for anyone who stands up.
     *
     * @param lookDown 0..1, how far down the viewer is looking. Drives the fade.
     */
    follow(headPos, headFwd, dt, lookDown = 1) {
      const first = !group.visible
      group.visible = true

      const wantY = headPos.y + DROP
      group.position.y += (wantY - group.position.y) * Math.min(1, dt * FOLLOW)

      // `aim()` ran earlier this frame and topped `holdLeft` up if the reticle
      // was on a cell.
      const busy = !first && holdLeft > 0
      holdLeft = Math.max(0, holdLeft - dt)
      if (!busy) {
        target.copy(headPos).addScaledVector(headFwd, AHEAD).setY(wantY)
        const k = first ? 1 : Math.min(1, dt * FOLLOW)
        group.position.lerp(target, k)

        const wantYaw = Math.atan2(headFwd.x, headFwd.z) + Math.PI
        let d = wantYaw - group.rotation.y
        while (d > Math.PI) d -= Math.PI * 2
        while (d < -Math.PI) d += Math.PI * 2
        group.rotation.y += d * k
      }

      const a = DIM + (1 - DIM) * Math.min(1, Math.max(0, lookDown))
      strip.material.opacity = a
      hint.material.opacity = a
    },

    hide() {
      group.visible = false
      holdLeft = 0
    },

    /**
     * Which button the gaze is resting on, or null.
     *
     * `uv.x` across the single plane says which cell without five colliders.
     * Repaints only when the highlight actually moves.
     */
    aim(raycaster) {
      if (!group.visible) return null
      const hit = raycaster.intersectObject(strip, false)[0]
      let index = -1
      if (hit?.uv) {
        index = Math.min(CELLS.length - 1, Math.floor(hit.uv.x * CELLS.length))
      }
      if (index !== hot) {
        hot = index
        charge = 0
        paint()
      }
      // Freezes the strip in place while it is being used — see follow().
      if (index >= 0) holdLeft = HOLD
      return index >= 0 ? CELLS[index].id : null
    },

    /**
     * How far along the arming dwell the hot cell is, 0..1.
     *
     * QUANTISED TO TWELFTHS. The canvas is only uploaded when the drawn result
     * would actually differ, so a two-second dwell costs a dozen repaints
     * instead of one hundred and twenty.
     */
    setCharge(t) {
      const step = Math.round(THREE.MathUtils.clamp(t, 0, 1) * 12) / 12
      if (step === charge) return
      charge = step
      paint()
    },

    /** The hint has done its job the moment the viewer uses a button. */
    dismissHint() {
      hint.visible = false
    },

    dispose() {
      strip.geometry.dispose()
      strip.material.dispose()
      texture.dispose()
      hint.geometry.dispose()
      hint.material.dispose()
      hintTexture.dispose()
    },
  }
}
