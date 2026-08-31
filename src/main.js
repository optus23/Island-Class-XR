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
import { showNodeLabel, hideNodeLabel, positionNodeLabel } from './ui/nodeLabel.js'
import { mountLegend } from './ui/legend.js'
import { writeProgress } from './lib/githubProgress.js'
import { nextMarker, START_MARKER } from './lib/levels.js'
import { irisClose, screenPositionOf } from './ui/transition.js'
import { buildGrandPath, nearestIndexOn } from './three/paths.js'
import { createEnemies } from './three/enemies.js'
import { readLevelFromUrl, setLevelInUrl, onRouteChange } from './lib/router.js'

const container = document.getElementById('app')
const curtain = createCurtain()
const app = createScene(container)
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

// Decorative creatures patrolling the road.
const enemies = createEnemies(grandPath, 8)
app.worldGroup.add(enemies.group)
const nodeIndexOnPath = new Map()
for (const p of map.placed) {
  if (p.onPath) nodeIndexOnPath.set(p.level.id, nearestIndexOn(grandPath, p.position))
}

function anchorOf(levelId) {
  return map.placed.find((p) => p.level.id === levelId)?.anchorId ?? null
}

/**
 * Walk the ROAD between two on-path nodes, in either direction.
 * Returns the slice of the grand polyline, so the avatar follows every corner
 * instead of cutting across the terrain.
 */
function walkAlongRoad(fromId, toId) {
  const a = nodeIndexOnPath.get(fromId)
  const b = nodeIndexOnPath.get(toId)
  if (a == null || b == null || a === b) return []
  const step = b > a ? 1 : -1
  const out = []
  for (let i = a + step; i !== b + step; i += step) out.push(grandPath[i].clone())
  return out
}

/**
 * Waypoints from wherever the avatar stands to the clicked level.
 * Optional nodes hang off the road, so they are reached by walking the road to
 * their anchor and then stepping off it — never by cutting across open ground.
 */
function buildRoute(fromId, toId) {
  const target = levelById(toId)
  if (!target) return []

  let startId = fromId
  const out = []

  const fromLevel = levelById(fromId)
  if (fromLevel?.optional) {
    // Step back onto the road first.
    startId = anchorOf(fromId) ?? mainSequence[0].id
    const back = map.positionById.get(startId)
    if (back) out.push(back.clone())
  }

  if (target.optional) {
    const anchorId = anchorOf(toId)
    if (anchorId && anchorId !== startId) out.push(...walkAlongRoad(startId, anchorId))
    const dest = map.positionById.get(toId)
    if (dest) out.push(dest.clone())
    return out
  }

  out.push(...walkAlongRoad(startId, toId))
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

// Distinguish a click from a drag. A drag orbits the camera; a click selects.
let downAt = null
let dragging = null
container.addEventListener('pointerdown', (e) => {
  downAt = { x: e.clientX, y: e.clientY }
  dragging = { x: e.clientX, y: e.clientY }
  container.setPointerCapture?.(e.pointerId)
})

container.addEventListener('pointermove', (e) => {
  if (!dragging) return
  app.rig.orbit(e.clientX - dragging.x, e.clientY - dragging.y)
  dragging = { x: e.clientX, y: e.clientY }
})

container.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault()
    app.rig.zoom(e.deltaY)
  },
  { passive: false }
)
container.addEventListener('pointerup', (e) => {
  dragging = null
  if (!downAt) return
  const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y)
  downAt = null
  if (moved > 6) return
  const level = pick()
  if (!level) return
  // Select-vs-enter: the first click walks there, a second click on the SAME
  // node enters. Moving never enters a level as a side effect.
  if (level.id === player.levelId) selectLevel(level, { open: true })
  else selectLevel(level, { open: false })
})

let nav = null
let legend = null
let markerId = null

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

  // A new selection always wins. Ignoring input while the avatar walked meant
  // the index did nothing mid-journey, which felt broken — and the index in
  // particular must never be blocked by an animation it did not start.
  if (player.isMoving) {
    player.cancel()
    player.snapTo(player.group.position.clone(), nodeUnderPlayer())
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
    await showLevelCard(level, { markerId })
    await enterLevel(level)
  }

  if (player.levelId === level.id) {
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

  player.travel(buildRoute(player.levelId, level.id), level.id, arrive)
}

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
  const at = screenPositionOf(player.group, app.rig.camera, container)
  const iris = await irisClose(at)

  setLevelInUrl(level.id)
  openPortal(level, {
    markerId,
    // Close order matters: the iris must be fully black BEFORE the portal is
    // torn down. Previously the panel vanished first, flashing the 3D map, and
    // only then did the wipe play — so it read as a glitch rather than the
    // reverse of the entry.
    onBeforeClose: async () => {
      const back = await irisClose()
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

  if (deepLinked) {
    setLevelInUrl(deepLinked.id, { replace: true }) // no phantom history entry
    showLevelCard(deepLinked, { markerId }).then(() => enterLevel(deepLinked))
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
