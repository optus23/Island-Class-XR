/**
 * On-screen camera controls for the flat map.
 *
 * The camera could already be orbited by dragging the island and zoomed with
 * the wheel or a pinch, and neither of those announces itself: nothing on
 * screen said the view could move at all. This is the same two verbs as
 * buttons — look around, and closer/further — plus the reset that the `R` key
 * already had.
 *
 * IT DRIVES THE SAME RIG METHODS AS THE GESTURES, and adds no camera state of
 * its own. `rig.orbit` takes POINTER-PIXEL deltas, so a held button feeds it
 * pixels-per-second times dt: one code path, one set of clamps, and a button
 * can never reach somewhere a drag cannot.
 *
 * WHY IT REPEATS FROM THE RENDER LOOP rather than from a timer: holding a
 * direction has to move the camera at the same rate on every machine, and the
 * rig is already being updated per frame with a dt. A `setInterval` would
 * drift against it and would keep firing in a background tab.
 *
 * TOUCH DEVICES ONLY. On a desktop the same two verbs are already a drag and a
 * wheel, with a mouse to do them precisely, and a pad in the corner is chrome
 * over the map for nothing. On a phone dragging the island is fiddly and the
 * wheel does not exist, which is where buttons earn their space.
 *
 * This is a 2D-map control either way. An immersive session paints no DOM, so
 * nothing here is reachable from inside a headset: on a Quest that is the
 * thumbsticks, and on a phone in a holder it is the gaze controls in
 * `three/vr.js`.
 */

/**
 * Is the primary pointer a finger?
 *
 * `(pointer: coarse)` asks about the PRIMARY input, so a laptop with a
 * touchscreen still answers false — which is right, because it has a mouse and
 * the gestures are the better tool there. `any-pointer` would answer true for
 * that laptop and put the pad on every convertible.
 */
export const wantsCamPad = () =>
  typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches

const STORE = 'xrisland:campad-open'

/** Pointer-pixels per second at full hold, fed straight to `rig.orbit`. */
const YAW_RATE = 150
const PITCH_RATE = 110
/** Wheel-delta per second, fed to `rig.zoom`. Positive pulls the camera back. */
const ZOOM_RATE = 480

/**
 * `-1 | 0 | 1` per axis, by button.
 *
 * THE SIGNS ARE THE OPPOSITE OF THE DRAG'S, AND THAT IS DELIBERATE.
 * `rig.orbit` speaks in pointer pixels and a drag is a GRAB: pull right and the
 * island comes with your hand, so the camera swings left. An arrow button is
 * not a grab — press ▶ and the camera has to go right, press ▲ and it has to
 * rise and look down from above. Feeding the pad's directions straight into
 * `orbit` gave both axes backwards.
 *
 * Measured in the running scene rather than reasoned about, the way the drag's
 * own signs had to be: hold a button for 45 frames, then dot the camera's
 * travel with its own right vector out of `matrixWorld.extractBasis`. ▶ read
 * −27 along that vector and ▲ read −20.75 in Y; both now read positive. If
 * either goes negative again, that axis is inverted — re-measure, do not
 * re-derive.
 */
const DIRS = {
  up: { label: 'Mirar desde arriba', glyph: '▲', dx: 0, dy: 1 },
  down: { label: 'Mirar desde abajo', glyph: '▼', dx: 0, dy: -1 },
  left: { label: 'Girar a la izquierda', glyph: '◀', dx: 1, dy: 0 },
  right: { label: 'Girar a la derecha', glyph: '▶', dx: -1, dy: 0 },
}

const readOpen = () => {
  try {
    return localStorage.getItem(STORE) !== '0'
  } catch {
    return true
  }
}
const writeOpen = (open) => {
  try {
    localStorage.setItem(STORE, open ? '1' : '0')
  } catch {
    /* private mode — the pad simply opens again next time */
  }
}

/**
 * @param {{rig: object, host: HTMLElement}} deps `rig` is the camera rig; only
 *   `orbit`, `zoom` and `resetView` are used.
 * @returns {{update: (dt: number) => void, el: HTMLElement}}
 */
export function mountCamPad({ rig, host }) {
  const el = document.createElement('div')
  el.className = 'campad-panel'

  const button = (cls, label, glyph, extra = '') =>
    `<button type="button" class="campad-btn ${cls}" aria-label="${label}" title="${label}"${extra}>
       <span aria-hidden="true">${glyph}</span>
     </button>`

  el.innerHTML = `
    <div class="campad-card">
      <button type="button" class="campad-head" aria-expanded="true">
        <span>Cámara</span>
        <span class="campad-caret" aria-hidden="true">▾</span>
      </button>
      <div class="campad-body">
        <div class="campad-grid">
          ${button('campad-up', DIRS.up.label, DIRS.up.glyph, ' data-dir="up"')}
          ${button('campad-left', DIRS.left.label, DIRS.left.glyph, ' data-dir="left"')}
          ${button('campad-reset', 'Vista original', '⌖', ' data-once="reset"')}
          ${button('campad-right', DIRS.right.label, DIRS.right.glyph, ' data-dir="right"')}
          ${button('campad-down', DIRS.down.label, DIRS.down.glyph, ' data-dir="down"')}
        </div>
        <div class="campad-zoom">
          ${button('', 'Acercar', '+', ' data-zoom="in"')}
          ${button('', 'Alejar', '−', ' data-zoom="out"')}
        </div>
      </div>
    </div>`

  host.appendChild(el)

  const head = el.querySelector('.campad-head')
  const body = el.querySelector('.campad-body')

  const setOpen = (open) => {
    body.hidden = !open
    head.setAttribute('aria-expanded', String(open))
    el.classList.toggle('is-closed', !open)
  }
  setOpen(readOpen())
  head.addEventListener('click', () => {
    const open = body.hidden
    setOpen(open)
    writeOpen(open)
  })

  // --- what is being held ---------------------------------------------------
  //
  // A Set of buttons rather than one "current" button: a second finger, or a
  // pointer released outside the element, must not cancel the first. Held state
  // is cleared wholesale by every path that can lose a pointerup.

  /** @type {Set<HTMLElement>} */
  const held = new Set()
  const release = () => held.clear()

  for (const btn of el.querySelectorAll('.campad-btn')) {
    if (btn.dataset.once) {
      btn.addEventListener('click', () => rig.resetView())
      continue
    }

    const hold = (e) => {
      held.add(btn)
      // Last, and guarded: setPointerCapture throws for a pointer the browser
      // no longer considers active, and an exception here would take the whole
      // gesture with it.
      try {
        btn.setPointerCapture(e.pointerId)
      } catch {
        /* the button still works, it just stops tracking outside its box */
      }
    }
    const drop = () => held.delete(btn)

    btn.addEventListener('pointerdown', hold)
    btn.addEventListener('pointerup', drop)
    btn.addEventListener('pointercancel', drop)
    btn.addEventListener('pointerleave', drop)

    // Keyboard hold-to-repeat. preventDefault kills the synthetic click, so a
    // key press cannot also apply a one-shot nudge on top of the hold; and
    // stopPropagation keeps Space and Enter away from the map's own window
    // handler, which would otherwise open the level the avatar is standing on.
    btn.addEventListener('keydown', (e) => {
      if (e.key !== ' ' && e.key !== 'Enter') return
      e.preventDefault()
      e.stopPropagation()
      held.add(btn)
    })
    btn.addEventListener('keyup', (e) => {
      if (e.key !== ' ' && e.key !== 'Enter') return
      e.stopPropagation()
      drop()
    })
    btn.addEventListener('blur', drop)
  }

  // A held button with no pointerup left to come: tab away, switch app, or a
  // long-press context menu stealing the gesture. Without these the camera
  // keeps turning on its own until the next click.
  window.addEventListener('blur', release)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) release()
  })

  return {
    el,
    /** Called once per frame with the same dt the rig gets. */
    update(dt) {
      if (!held.size) return
      let dx = 0
      let dy = 0
      let dz = 0
      for (const btn of held) {
        const dir = DIRS[btn.dataset.dir]
        if (dir) {
          dx += dir.dx
          dy += dir.dy
        } else if (btn.dataset.zoom) {
          // Positive delta pulls the camera BACK, which is what the wheel does
          // when it is scrolled towards the viewer. "+" has to be the opposite.
          dz += btn.dataset.zoom === 'in' ? -1 : 1
        }
      }
      if (dx || dy) rig.orbit(dx * YAW_RATE * dt, dy * PITCH_RATE * dt)
      if (dz) rig.zoom(dz * ZOOM_RATE * dt)
    },
  }
}
