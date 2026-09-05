import * as THREE from 'three'
import { sessionNumber, statusFor } from '../lib/levels.js'
import { cssPalette } from '../config/theme.js'
import { stageLabel, categoryLabel, assessmentRows } from '../lib/labels.js'

/**
 * The level card, inside the headset.
 *
 * WHY A CANVAS AND NOT THE DOM
 * There is no DOM in an immersive session — the page's HTML is simply not
 * composited into the headset. Anything the wearer reads has to be geometry, so
 * the card is painted with the 2D canvas API and shown as a texture on a plane.
 * That is also why it repeats the portal's layout by hand instead of sharing a
 * template: the two surfaces cannot share markup, only the WORDS, which is what
 * `lib/labels.js` is for.
 *
 * ONE PLANE, REDRAWN ON CHANGE
 * A texture upload is not free, so the canvas is only repainted when the level
 * actually changes — pointing along a road of 28 nodes would otherwise upload a
 * megabyte a frame. Everything else (facing the viewer, fading in) is transform
 * work on a single mesh: one extra draw call for the whole feature.
 *
 * IT LIVES IN WORLD SPACE, NOT ON THE DIORAMA
 * The map is scaled to about 0.005 in VR, so a panel parented to it would come
 * out two millimetres tall. It is placed near the model each frame instead, at
 * a size chosen for reading at arm's length.
 */

const PANEL_W = 0.62 // metres
const PANEL_H = 0.40
const CANVAS_W = 1024
const CANVAS_H = Math.round((CANVAS_W * PANEL_H) / PANEL_W)

const FONT = 'Fredoka, ui-rounded, "Segoe UI", system-ui, sans-serif'
const INK = '#e8eef7'
const DIM = 'rgba(232,238,247,0.55)'
const PLATE = '#161d29'

/** Wraps `text` to `maxWidth`, returning at most `maxLines` lines. */
function wrap(ctx, text, maxWidth, maxLines) {
  const words = String(text ?? '').split(/\s+/).filter(Boolean)
  const lines = []
  let line = ''
  for (const w of words) {
    const next = line ? `${line} ${w}` : w
    if (ctx.measureText(next).width <= maxWidth) {
      line = next
      continue
    }
    if (line) lines.push(line)
    line = w
    if (lines.length === maxLines) break
  }
  if (line && lines.length < maxLines) lines.push(line)
  if (lines.length === maxLines && words.length) {
    // Ellipsise rather than cut a word in half.
    let last = lines[maxLines - 1]
    while (last && ctx.measureText(`${last}…`).width > maxWidth) {
      last = last.replace(/\s*\S+$/, '')
    }
    if (last !== lines[maxLines - 1]) lines[maxLines - 1] = `${last}…`
  }
  return lines
}

const hex = (n) => `#${n.toString(16).padStart(6, '0')}`

export function createVRPanel() {
  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_W
  canvas.height = CANVAS_H
  const ctx = canvas.getContext('2d')

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(PANEL_W, PANEL_H),
    // Unlit: the panel is a readout, and shading it would make the text dim as
    // the diorama's sun moves across it.
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false })
  )
  mesh.name = 'xr-level-panel'
  mesh.renderOrder = 10
  mesh.visible = false
  mesh.frustumCulled = false

  let shownId = null
  let opacity = 0
  let wanted = 0

  function paint(level, markerId) {
    const st = statusFor(level, markerId)
    const accent = level.optional
      ? cssPalette.optional
      : st.completed
        ? cssPalette.completed
        : cssPalette[level.category] ?? cssPalette.theory
    const accentHex = hex(accent)

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)

    // Plate: the same solid-with-a-hard-outline chrome as the 2D map, so the
    // headset does not look like a different product.
    ctx.fillStyle = PLATE
    ctx.strokeStyle = '#0b0f16'
    ctx.lineWidth = 10
    const r = 26
    ctx.beginPath()
    ctx.roundRect(6, 6, CANVAS_W - 12, CANVAS_H - 12, r)
    ctx.fill()
    ctx.stroke()

    // Accent rule along the top, the node's own colour.
    ctx.fillStyle = accentHex
    ctx.beginPath()
    ctx.roundRect(6, 6, CANVAS_W - 12, 12, [r, r, 0, 0])
    ctx.fill()

    const L = 46
    let y = 78

    // Session line.
    const n = sessionNumber(level)
    ctx.font = `600 26px ${FONT}`
    ctx.fillStyle = DIM
    ctx.fillText(
      n ? `MUNDO ${n.world}-${n.index}  ·  SESIÓN ${n.global} DE ${n.total}` : 'NIVEL OPCIONAL',
      L,
      y
    )
    y += 22

    // Title, up to two lines.
    ctx.font = `700 48px ${FONT}`
    ctx.fillStyle = '#fff'
    for (const line of wrap(ctx, level.title, CANVAS_W - L * 2, 2)) {
      y += 52
      ctx.fillText(line, L, y)
    }

    // Category + stage.
    y += 40
    ctx.font = `600 24px ${FONT}`
    ctx.fillStyle = accentHex
    const cat = categoryLabel(level)
    ctx.fillText(cat, L, y)
    const catW = ctx.measureText(cat).width
    ctx.fillStyle = DIM
    ctx.fillText(`  ·  ${stageLabel(level)}`, L + catW, y)

    // Summary.
    y += 12
    ctx.font = `400 26px ${FONT}`
    ctx.fillStyle = INK
    for (const line of wrap(ctx, level.summary, CANVAS_W - L * 2, 3)) {
      y += 34
      ctx.fillText(line, L, y)
    }

    // Assessment rows, for the graded block exercises only.
    const rows = assessmentRows(level)
    if (rows.length) {
      y += 26
      ctx.font = `600 21px ${FONT}`
      for (const [label, value] of rows.slice(0, 3)) {
        y += 28
        ctx.fillStyle = DIM
        ctx.fillText(label.toUpperCase(), L, y)
        ctx.fillStyle = INK
        ctx.fillText(value, L + 150, y)
      }
    }

    // Footer hint: what the trigger will do from here.
    ctx.font = `600 22px ${FONT}`
    ctx.fillStyle = DIM
    const hint = st.current ? 'Gatillo para ENTRAR' : 'Gatillo para ir aquí'
    ctx.fillText(hint, L, CANVAS_H - 34)

    if (st.current) {
      ctx.fillStyle = hex(cssPalette.current)
      ctx.beginPath()
      ctx.arc(CANVAS_W - L - 8, CANVAS_H - 42, 9, 0, Math.PI * 2)
      ctx.fill()
    }

    texture.needsUpdate = true
  }

  return {
    mesh,

    /** Null hides the panel. Repaints only when the level actually changes. */
    show(level, markerId) {
      if (!level) {
        wanted = 0
        shownId = null
        return
      }
      if (level.id !== shownId) {
        shownId = level.id
        paint(level, markerId)
      }
      wanted = 1
    },

    /** Repaint whatever is showing — e.g. after the progress marker moves. */
    refresh(level, markerId) {
      if (level && level.id === shownId) paint(level, markerId)
    },

    /**
     * Park it above the model and turn it to face the viewer.
     * Billboarded on Y only: tipping a text panel to follow a nodding head
     * reads as the card wobbling.
     */
    update(dt, anchor, headPos) {
      opacity += (wanted - opacity) * Math.min(1, dt * 8)
      mesh.visible = opacity > 0.01
      if (!mesh.visible) return

      mesh.material.opacity = opacity
      mesh.position.set(anchor.x, anchor.y + 0.42, anchor.z)
      mesh.rotation.set(0, Math.atan2(headPos.x - mesh.position.x, headPos.z - mesh.position.z), 0)
    },

    dispose() {
      mesh.geometry.dispose()
      mesh.material.dispose()
      texture.dispose()
    },
  }
}
