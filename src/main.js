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

app.onUpdate((dt) => {
  island.update(dt)
  map.update(dt)
  player.update(dt)
  // The camera simply follows the avatar. Crossing between worlds blends the
  // viewing angle inside the rig, so there is nothing to switch here.
  app.rig.follow(player.group.position)
})

// --- routing ---------------------------------------------------------------

/** Walk the main sequence from one level to another, inclusive of the target. */
function routeAlongMain(startId, targetId) {
  const i = mainSequence.findIndex((l) => l.id === startId)
  const j = mainSequence.findIndex((l) => l.id === targetId)
  if (i === -1 || j === -1 || i === j) return []
  const step = j > i ? 1 : -1
  const out = []
  for (let k = i + step; ; k += step) {
    out.push(map.positionById.get(mainSequence[k].id))
    if (k === j) break
  }
  return out.filter(Boolean)
}

function anchorOf(levelId) {
  return map.placed.find((p) => p.level.id === levelId)?.anchorId ?? null
}

/**
 * Waypoints from wherever the avatar stands to the clicked level.
 * Optional nodes are reached via their anchor, and left the same way, so the
 * avatar never cuts across open ground.
 */
function buildRoute(fromId, toId) {
  const target = levelById(toId)
  if (!target) return []

  let startId = fromId
  const out = []

  const fromLevel = levelById(fromId)
  if (fromLevel?.optional) {
    startId = anchorOf(fromId) ?? mainSequence[0].id
    const back = map.positionById.get(startId)
    if (back) out.push(back)
  }

  if (target.optional) {
    const anchorId = anchorOf(toId)
    if (anchorId && anchorId !== startId) out.push(...routeAlongMain(startId, anchorId))
    const dest = map.positionById.get(toId)
    if (dest) out.push(dest)
    return out
  }

  out.push(...routeAlongMain(startId, toId))
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

// Distinguish a click from a drag/parallax sweep.
let downAt = null
container.addEventListener('pointerdown', (e) => {
  downAt = { x: e.clientX, y: e.clientY }
})
container.addEventListener('pointerup', (e) => {
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
let markerId = null

/** Every node is clickable — bosses included. Accepts a level or a level id. */
function selectLevel(levelOrId, { open = false } = {}) {
  const level = typeof levelOrId === 'string' ? levelById(levelOrId) : levelOrId
  if (!level || player.isMoving) return

  const arrive = async () => {
    tooltip.hide()
    nav?.setPlayerLevel(level.id)
    announce(level)
    // The Mario level card plays as the avatar settles on the session, and the
    // portal waits for it so the two never overlap.
    await showLevelCard(level, { markerId })
    if (!open) return
    setLevelInUrl(level.id)
    openPortal(level, { markerId, onClose: () => setLevelInUrl(null) })
  }

  if (player.levelId === level.id) {
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

/**
 * Overview: frame all three worlds at once. Turning it off re-centres on the
 * character, so you never lose your place.
 */
function setOverview(on) {
  app.rig.toggleOverview(on)
  document.getElementById('app').classList.toggle('is-overview', on)
  nav?.setOverview(on)
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
    onSelect: selectLevel,
    // Jumping to a world moves the avatar to its first level; the camera then
    // follows it there. Keeps one notion of "where you are".
    onSelectWorld: (worldId) => {
      const first = levelsForWorld(worldId).find((l) => !l.optional)
      if (first) selectLevel(first, { open: false })
    },
    onToggleOverview: () => setOverview(!app.rig.isOverview),
  })
  nav.setPlayerLevel(startId)
  app.start()

  if (deepLinked) {
    setLevelInUrl(deepLinked.id, { replace: true }) // no phantom history entry
    showLevelCard(deepLinked, { markerId }).then(() =>
      openPortal(deepLinked, { markerId, onClose: () => setLevelInUrl(null) })
    )
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
    openPortal(level, { markerId, onClose: () => setLevelInUrl(null) })
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
