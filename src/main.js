import './style.css'
import * as THREE from 'three'
import { createScene } from './three/scene.js'
import { createIsland } from './three/island.js'
import { createMapObjects } from './three/nodes.js'
import { createPlayer } from './three/player.js'
import { loadProgress } from './lib/progress.js'
import { levelById, mainSequence, allLevels, levelsForWorld } from './lib/levels.js'
import { openPortal, closePortal } from './ui/portal.js'
import { mountNav } from './ui/nav.js'
import { createTooltip, createCurtain } from './ui/hud.js'
import { showLevelCard, hideLevelCard } from './ui/levelCard.js'
import {
  showNodeLabel,
  hideNodeLabel,
  positionNodeLabel,
  onNodeLabelEnter,
} from './ui/nodeLabel.js'
import { mountLegend } from './ui/legend.js'
import { writeProgress } from './lib/githubProgress.js'
import { nextMarker, START_MARKER } from './lib/levels.js'
import { irisClose, screenPositionOf } from './ui/transition.js'
import { buildGrandPath, nearestIndexOn } from './three/paths.js'
import { createEnemies } from './three/enemies.js'
import { readLevelFromUrl, setLevelInUrl, onRouteChange } from './lib/router.js'
import { createVR } from './three/vr.js'

const container = document.getElementById('app')
const curtain = createCurtain()
/**
 * WebXR is opt-in per URL: only `?vr=1` builds the XR renderer, touches
 * navigator.xr or mounts the button. The plain map must behave identically
 * whether or not a headset is plugged in — it did not, and that is what hung
 * the page the moment Quest Link started.
 */
const XR_REQUESTED = new URLSearchParams(location.search).has('vr')
const app = createScene(container, { xr: XR_REQUESTED })
const tooltip = createTooltip()

const island = createIsland()
const map = createMapObjects()
const player = createPlayer()

app.worldGroup.add(island.group)
app.worldGroup.add(map.group)
app.worldGroup.add(player.group)

// Backdrop parallax: the hills slide WITH the camera at a fraction of its
// speed, so they read as far away instead of pinned to the island.
const BACKDROP_PARALLAX = 0.28
app.onUpdate((dt) => {
  island.update(dt)
  enemies.update(dt)
  island.backdrop.position.x = app.rig.focusX * BACKDROP_PARALLAX
  map.update(dt)
  player.update(dt)
  // The camera simply follows the avatar. Crossing between worlds blends the
  // viewing angle inside the rig, so there is nothing to switch here.
  app.rig.follow(player.group.position)
  const at = screenPositionOf(player.group, app.rig.camera, container)
  positionNodeLabel(at.x, at.y)
})

// --- routing ---------------------------------------------------------------

// The road as one walkable polyline, plus where each node sits along it.
const grandPath = buildGrandPath()

const nodeIndexOnPath = new Map()
for (const p of map.placed) {
  if (p.onPath) nodeIndexOnPath.set(p.level.id, nearestIndexOn(grandPath, p.position))
}

// Decorative creatures patrolling the road. Deliberately few — eight of them
// along one road read as a crowd rather than as the odd wandering Goomba — and
// they are given the node positions so they stay off the level discs.
const enemies = createEnemies(grandPath, 4, [...nodeIndexOnPath.values()])
app.worldGroup.add(enemies.group)

function anchorOf(levelId) {
  return map.placed.find((p) => p.level.id === levelId)?.anchorId ?? null
}

/**
 * Walk the ROAD from a point on the grand polyline to an on-path node.
 * Returns the slice of the polyline, so the avatar follows every corner
 * instead of cutting across the terrain.
 */
function walkFromIndex(fromIndex, toId) {
  const b = nodeIndexOnPath.get(toId)
  if (fromIndex == null || b == null || fromIndex === b) return []
  const step = b > fromIndex ? 1 : -1
  const out = []
  for (let i = fromIndex + step; i !== b + step; i += step) out.push(grandPath[i].clone())
  return out
}

function walkAlongRoad(fromId, toId) {
  return walkFromIndex(nodeIndexOnPath.get(fromId), toId)
}

/**
 * Waypoints from wherever the avatar stands to the clicked level.
 * Optional nodes hang off the road, so they are reached by walking the road to
 * their anchor and then stepping off it — never by cutting across open ground.
 */
function buildRoute(fromId, toId, fromPosition = null) {
  const target = levelById(toId)
  if (!target) return []

  const out = []
  let startId = fromId
  // Where on the road the walk begins. Mid-journey this is wherever the avatar
  // actually stands, NOT the node it last left: routing from the node made a
  // change of mind visibly backtrack to it before setting off again.
  let startIndex = null

  const fromLevel = levelById(fromId)
  if (fromLevel?.optional) {
    // Step back onto the road first.
    startId = anchorOf(fromId) ?? mainSequence[0].id
    const back = map.positionById.get(startId)
    if (back) out.push(back.clone())
    startIndex = nodeIndexOnPath.get(startId) ?? null
  } else {
    startIndex = fromPosition
      ? nearestIndexOn(grandPath, fromPosition)
      : (nodeIndexOnPath.get(startId) ?? null)
  }

  if (target.optional) {
    const anchorId = anchorOf(toId)
    if (anchorId) out.push(...walkFromIndex(startIndex, anchorId))
    const dest = map.positionById.get(toId)
    if (dest) out.push(dest.clone())
    return out
  }

  out.push(...walkFromIndex(startIndex, toId))
  // Land exactly on the node, not merely on the nearest polyline sample.
  const exact = map.positionById.get(toId)
  if (exact) out.push(exact.clone())
  return out
}

// --- interaction -----------------------------------------------------------

const raycaster = new THREE.Raycaster()
let hoveredLevel = null

function pick() {
  if (!app.pointerInside) return null
  raycaster.setFromCamera(app.pointer, app.rig.camera)
  const hits = raycaster.intersectObjects(map.pickTargets, false)
  return map.levelFromHit(hits[0])
}

container.addEventListener('pointermove', (e) => {
  // Hover is a mouse idea. On touch every drag would raise a tooltip under the
  // finger and leave it stuck there once the finger lifted.
  if (e.pointerType !== 'mouse') return
  const level = pick()
  hoveredLevel = level
  map.setHovered(level?.id ?? null)
  container.classList.toggle('is-hovering-node', Boolean(level))
  if (level) tooltip.show(level, e.clientX, e.clientY, markerId)
  else tooltip.hide()
})

container.addEventListener('pointerleave', () => {
  hoveredLevel = null
  map.setHovered(null)
  container.classList.remove('is-hovering-node')
  tooltip.hide()
})

/**
 * Camera gestures, mouse and touch through the same pointer events.
 *
 *   one pointer  drag  -> look around (clamped orbit)
 *   two pointers       -> pinch to zoom, and the midpoint still orbits
 *   tap / click        -> select, or enter if already standing there
 *
 * Every live pointer is tracked in a Map rather than a single `dragging`
 * object. With one variable the second finger simply overwrote the first, so a
 * pinch registered as a huge jump from finger A's position to finger B's — the
 * camera appeared to teleport and swing flat. The map also makes the
 * one-to-two-finger handover seamless: lifting a finger re-seeds the gesture
 * from the one still down instead of jerking.
 *
 * Combined with `touch-action: none` on the canvas (see style.css), which is
 * what stops the browser eating these gestures as page scroll and page zoom.
 */
const TAP_SLOP = 8 // px of travel still counted as a tap, not a drag
/** @type {Map<number, {x:number, y:number}>} */
const pointers = new Map()
let gesture = null // { mid: {x,y}, spread: number }
let tap = null // { id, x, y } — only ever set while exactly one pointer is down

/** Midpoint and finger spread of every pointer currently down. */
function gestureState() {
  let sx = 0
  let sy = 0
  for (const p of pointers.values()) {
    sx += p.x
    sy += p.y
  }
  const n = pointers.size
  const mid = { x: sx / n, y: sy / n }
  let spread = 0
  if (n > 1) {
    const [a, b] = [...pointers.values()]
    spread = Math.hypot(a.x - b.x, a.y - b.y)
  }
  return { mid, spread }
}

container.addEventListener('pointerdown', (e) => {
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
  // Capture LAST, and never let it take the gesture down with it.
  // setPointerCapture throws NotFoundError for a pointer the browser does not
  // consider active; called first, that exception skipped the rest of the
  // handler and the gesture was silently dropped before it began.
  try {
    container.setPointerCapture?.(e.pointerId)
  } catch {
    /* capture is an optimisation, not a requirement */
  }
  // Re-seed on every change of finger count, so adding or lifting one never
  // registers as a sudden jump of the midpoint.
  gesture = gestureState()
  tap = pointers.size === 1 ? { id: e.pointerId, x: e.clientX, y: e.clientY } : null
  // A tap may produce no pointermove at all, so pick from where it landed.
  app.setPointerAt(e.clientX, e.clientY, { drift: e.pointerType === 'mouse' })
})

container.addEventListener('pointermove', (e) => {
  if (!pointers.has(e.pointerId)) return
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
  const now = gestureState()
  if (!gesture) {
    gesture = now
    return
  }

  app.rig.orbit(now.mid.x - gesture.mid.x, now.mid.y - gesture.mid.y)
  if (pointers.size > 1 && gesture.spread > 0 && now.spread > 0) {
    // Pinch: the ratio of finger spread maps straight onto the zoom
    // multiplier, so spreading to twice the distance zooms in by the same
    // factor regardless of how fast it happened.
    app.rig.zoomBy(now.spread / gesture.spread)
  }
  gesture = now

  if (tap && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > TAP_SLOP) tap = null
})

container.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault()
    app.rig.zoom(e.deltaY)
  },
  { passive: false }
)

function endPointer(e) {
  const had = pointers.delete(e.pointerId)
  gesture = pointers.size ? gestureState() : null
  if (!had) return
  const wasTap = tap && tap.id === e.pointerId && pointers.size === 0
  tap = null
  if (!wasTap) return

  app.setPointerAt(e.clientX, e.clientY, { drift: e.pointerType === 'mouse' })
  const level = pick()
  if (!level) return
  // Select-vs-enter: the first tap walks there, a second tap on the SAME node
  // enters. Moving never enters a level as a side effect.
  if (level.id === player.levelId) selectLevel(level, { open: true })
  else selectLevel(level, { open: false })
}

container.addEventListener('pointerup', endPointer)
container.addEventListener('pointercancel', (e) => {
  pointers.delete(e.pointerId)
  gesture = pointers.size ? gestureState() : null
  tap = null
})
// A long-press on touch otherwise raises the OS callout over the map.
container.addEventListener('contextmenu', (e) => e.preventDefault())

let nav = null
let legend = null
let markerId = null
// Global, public, read once per load — see lib/progress.js. Never per-visitor.
let answersUnlocked = false
// Assigned in boot(). Null until then, and on any device without WebXR.
let vr = null

/** Every node is clickable — bosses included. Accepts a level or a level id. */
/** Nearest node to where the avatar physically stands. */
function nodeUnderPlayer() {
  let best = null
  let bestD = Infinity
  for (const p of map.placed) {
    const d = p.position.distanceToSquared(player.group.position)
    if (d < bestD) {
      bestD = d
      best = p.level.id
    }
  }
  return best
}

function selectLevel(levelOrId, { open = false, instant = false } = {}) {
  const level = typeof levelOrId === 'string' ? levelById(levelOrId) : levelOrId
  if (!level) return

  // A new selection always wins, and it takes effect from wherever the avatar
  // has got to. Ignoring input while it walked meant a change of mind had to
  // wait out the whole journey; resuming from the last node instead made it
  // turn round and walk back to that node first.
  let resumeFrom = null
  if (player.isMoving) {
    resumeFrom = player.group.position.clone()
    player.cancel()
    player.snapTo(resumeFrom, nodeUnderPlayer())
  }
  hideNodeLabel()

  const arrive = async () => {
    tooltip.hide()
    nav?.setPlayerLevel(level.id)
    announce(level)
    // The Mario level card plays as the avatar settles on the session, and the
    // portal waits for it so the two never overlap.
    // Selecting shows only a small label above the avatar; the full-screen card
    // belongs to entering a level, not to walking onto it.
    if (!open) {
      showNodeLabel(level, { markerId })
      return
    }
    // enterLevel owns the whole entrance now, card included.
    await enterLevel(level)
  }

  // Standing on it already — but only if we did not just interrupt a walk,
  // where levelId is merely the nearest node and the avatar is between two.
  if (player.levelId === level.id && !resumeFrom) {
    arrive()
    return
  }

  // Jumping from the index can span the whole island; walking 27 sessions of
  // road would take the better part of a minute. Teleport instead, and let the
  // camera catch up.
  if (instant) {
    const at = map.positionById.get(level.id)
    if (at) {
      player.snapTo(at, level.id)
      app.rig.follow(at, { instant: true })
    }
    arrive()
    return
  }

  player.travel(buildRoute(player.levelId, level.id, resumeFrom), level.id, arrive)
}

// The plate over the avatar says "entrar", so tapping it has to enter — the
// same as clicking the disc underneath. The avatar is already standing there,
// so this takes selectLevel's "already on it" path straight into the wipe.
onNodeLabelEnter((levelId) => {
  if (levelId) selectLevel(levelId, { open: true })
})

// --- keyboard access -------------------------------------------------------

// The map is a canvas, so without this it is entirely unreachable by keyboard.
container.tabIndex = 0
container.setAttribute('role', 'application')
container.setAttribute(
  'aria-label',
  'Mapa del curso. Flechas para moverte entre niveles, Enter para abrir el nivel actual.'
)

// Screen readers cannot see the avatar move, so say where it landed.
const liveRegion = document.createElement('p')
liveRegion.className = 'sr-only'
liveRegion.setAttribute('aria-live', 'polite')
document.getElementById('ui').appendChild(liveRegion)

function announce(level) {
  if (!level) return
  liveRegion.textContent = `${level.title}. Mundo ${level.world}.`
}

window.addEventListener('keydown', (e) => {
  // The portal traps its own keys while it is open.
  if (document.querySelector('[role="dialog"]')) return
  if (e.metaKey || e.ctrlKey || e.altKey) return
  // Never hijack typing in the nav or any future input.
  const tag = document.activeElement?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return

  const order = allLevels
  const idx = order.findIndex((l) => l.id === player.levelId)
  if (idx === -1) return

  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    selectLevel(order[idx], { open: true }) // the only keyboard way in
    return
  }

  if (e.key.toLowerCase() === 'r') {
    e.preventDefault()
    app.rig.resetView()
    return
  }

  if (e.key.toLowerCase() === 'm' || e.key === 'Tab') {
    e.preventDefault()
    setOverview(!app.rig.isOverview)
    return
  }

  const key = e.key.toLowerCase()
  let target = null
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || key === 'd') target = order[idx + 1]
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || key === 'a') target = order[idx - 1]
  else if (e.key === 'Home') target = order[0]
  else if (e.key === 'End') target = order[order.length - 1]
  else return

  e.preventDefault()
  // Arrows walk the map; they do not open the level. Enter does that, so a
  // keyboard user can look around without a modal opening on every keypress.
  if (target) selectLevel(target, { open: false })
})

/** Apply a new marker everywhere at once, so map and menu never disagree. */
function applyMarker(id) {
  markerId = id
  map.refresh(id)
  nav?.setMarker(id)
}

/**
 * Enter a level: iris closes ON THE AVATAR, the full-screen UI mounts behind
 * the black, then the iris opens onto it. Leaving reverses the same wipe, so
 * neither direction is ever an abrupt cut.
 */
async function enterLevel(level) {
  // Every route into the portal passes through here, so this is the one place
  // that can promise the headset is never left presenting behind a 2D panel.
  if (vr?.presenting) vr.endSession()

  const at = screenPositionOf(player.group, app.rig.camera, container)
  // The two castles get their own entrance: the screen closes through a horned
  // silhouette rather than a plain circle.
  const shape = level.category === 'boss' ? 'boss' : 'circle'
  const iris = await irisClose({ ...at, shape })

  // The card plays HERE, inside the closed iris — never before it. Playing it
  // first meant the screen faded to black, showed "MUNDO 1-6", faded back, and
  // only then did the wipe run: two transitions where the exit only ever had
  // one. Now both directions are the same single gesture.
  await showLevelCard(level, { markerId })

  setLevelInUrl(level.id)
  openPortal(level, {
    markerId,
    answersUnlocked,
    // Close order matters: the iris must be fully black BEFORE the portal is
    // torn down. Previously the panel vanished first, flashing the 3D map, and
    // only then did the wipe play — so it read as a glitch rather than the
    // reverse of the entry.
    onBeforeClose: async () => {
      const back = await irisClose({ shape })
      return () => back.open()
    },
    onClose: () => setLevelInUrl(null),
  })
  await iris.open()
}

/**
 * Overview: frame all three worlds at once. Turning it off re-centres on the
 * character, so you never lose your place.
 */
function setOverview(on) {
  app.rig.resetView() // a nudged view plus an overview jump is disorienting
  app.rig.toggleOverview(on)
  document.getElementById('app').classList.toggle('is-overview', on)
  nav?.setOverview(on)
  legend?.setOverview(on)
  if (!on) app.rig.follow(player.group.position)
}

// --- boot ------------------------------------------------------------------

async function boot() {
  const progress = await loadProgress()
  markerId = progress.currentLevelId
  answersUnlocked = progress.answersUnlocked
  map.refresh(markerId)

  // A shared ?level=... link wins over the progress marker: whoever followed
  // the link came for that level, so place the avatar there directly rather
  // than hopping across three worlds to reach it.
  const deepLinked = readLevelFromUrl()
  const startId = deepLinked?.id ?? markerId

  const start = map.positionById.get(startId)
  if (start) {
    player.snapTo(start, startId)
    app.rig.follow(start, { instant: true })
  }

  nav = mountNav({
    markerId,
    onSelect: (id) => selectLevel(id, { instant: true }),
    // Jumping to a world moves the avatar to its first level; the camera then
    // follows it there. Keeps one notion of "where you are".
    onSelectWorld: (worldId) => {
      const first = levelsForWorld(worldId).find((l) => !l.optional)
      if (first) selectLevel(first, { open: false, instant: true })
    },
    onToggleOverview: () => setOverview(!app.rig.isOverview),
  })

  // Colour key, plus teacher controls when a token is present in this browser.
  legend = mountLegend({
    onToggleOverview: () => setOverview(!app.rig.isOverview),
    onCompleteHere: async () => {
      const next = nextMarker(markerId)
      await writeProgress(next, 'Completado')
      applyMarker(next)
      return 'Marcador avanzado. El sitio se reconstruye en 1–2 min.'
    },
    onBack: async () => {
      const i = mainSequence.findIndex((l) => l.id === markerId)
      const prev = mainSequence[Math.max(0, i - 1)]?.id ?? START_MARKER
      await writeProgress(prev, 'Retroceso')
      applyMarker(prev)
      return 'Marcador retrocedido.'
    },
    onReset: async () => {
      await writeProgress(START_MARKER, 'Reinicio')
      applyMarker(START_MARKER)
      return 'Curso reiniciado.'
    },
  })
  nav.setPlayerLevel(startId)
  app.start()

  // --- immersive VR (experimental, webxr-vr-mode branch) -------------------
  // Only on ?vr=1. Without it navigator.xr is never even queried.
  if (!XR_REQUESTED) {
    console.info('[xr] modo 2D. Abre con ?vr=1 para el modo inmersivo.')
    return
  }
  console.info('[xr] modo VR solicitado (?vr=1)')
  vr = createVR({
    renderer: app.renderer,
    scene: app.scene,
    camera: app.rig.camera,
    worldGroup: app.worldGroup,
    backdrop: island.backdrop,
    pickTargets: () => map.pickTargets,
    levelFromHit: (hit) => map.levelFromHit(hit),
    playerLevelId: () => player.levelId,
    setMono: (on) => app.setMono(on),
    onSelect: (level) => selectLevel(level),
    // The session has already ended by the time this runs: the level portal is
    // a flat 2D surface in this phase, by design.
    onEnter: (level) => selectLevel(level, { open: true }),
  })
  app.setVRUpdate((dt) => vr.update(dt))
  vr.mount(document.getElementById('ui')).then((mounted) => {
    if (mounted) console.info('[vr] immersive-vr available — "Entrar en VR" mounted')
  })


  if (deepLinked) {
    setLevelInUrl(deepLinked.id, { replace: true }) // no phantom history entry
    enterLevel(deepLinked)
  }

  // Back/Forward moves between the map and an open level.
  onRouteChange((level) => {
    hideLevelCard()
    if (!level) {
      closePortal()
      return
    }
    const at = map.positionById.get(level.id)
    if (at) {
      player.snapTo(at, level.id)
      app.rig.follow(at)
    }
    nav?.setPlayerLevel(level.id)
    openPortal(level, {
      markerId,
      answersUnlocked,
      onBeforeClose: async () => {
        const back = await irisClose()
        return () => back.open()
      },
      onClose: () => setLevelInUrl(null),
    })
  })
  // Draw one frame before lifting the curtain, so the reveal is never a flash
  // of empty sky while the island's first frame is still being rasterised.
  requestAnimationFrame(() => curtain.lift())

  if (import.meta.env.DEV) {
    window.__app = app
    window.__map = map
    window.__player = player
    window.__selectLevel = selectLevel
    window.__setOverview = setOverview
    // Drives frames by hand — the only way to exercise animation in embedded
    // browsers where rAF never fires because document.hidden stays true.
    window.__step = (frames = 60, dt = 1 / 60) => {
      for (let i = 0; i < frames; i++) {
        for (const fn of app.updaters) fn(dt)
        app.rig.update(dt, { x: 0, y: 0 })
      }
      app.renderer.render(app.scene, app.rig.camera)
    }
  }
}

boot()
