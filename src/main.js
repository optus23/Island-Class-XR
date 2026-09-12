import './style.css'
import * as THREE from 'three'
import { createScene } from './three/scene.js'
import { createIsland } from './three/island.js'
import { createMapObjects } from './three/nodes.js'
import { createPlayer } from './three/player.js'
import { loadProgress } from './lib/progress.js'
import {
  levelById,
  mainSequence,
  allLevels,
  levelsForWorld,
  sessionNumber,
  isLocked,
  setLockAhead,
  setSeeAll,
  lockAheadSetting,
  seeAllSetting,
} from './lib/levels.js'
import { openPortal, closePortal } from './ui/portal.js'
import { mountNav } from './ui/nav.js'
import { createTooltip, createCurtain } from './ui/hud.js'
import { showLevelCard, hideLevelCard } from './ui/levelCard.js'
import {
  showNodeLabel,
  hideNodeLabel,
  positionNodeLabel,
  nodeLabelFor,
  onNodeLabelEnter,
} from './ui/nodeLabel.js'
import { hasAdminToken, mountLegend } from './ui/legend.js'
import { mountCamPad, wantsCamPad } from './ui/camPad.js'
import { writeLockAhead, writeProgress } from './lib/githubData.js'
import { nextMarker, START_MARKER } from './lib/levels.js'
import { irisClose, screenPositionOf } from './ui/transition.js'
import { buildGrandPath, nearestIndexOn, nodeClearings } from './three/paths.js'
import { clearGroundAround } from './three/terrain.js'
import { createEnemies } from './three/enemies.js'
import { createVillagers } from './three/villagers.js'
import { loadRoster } from './lib/roster.js'
import { readLevelFromUrl, setLevelInUrl, onRouteChange } from './lib/router.js'
import { readSeeAllFromUrl, rememberSeeAll, seeAllChoice } from './lib/teacherView.js'
import { createVR } from './three/vr.js'
import { createIntro, introWanted } from './three/intro.js'

const container = document.getElementById('app')
const curtain = createCurtain()
/**
 * ONE URL FOR EVERYTHING, AND THE BUTTON IS THE BRIDGE.
 *
 * `?vr=1` and the `/vr/` entry no longer decide whether VR is *reachable* —
 * every page offers it. What they still decide is whether the WebGL context is
 * born XR-compatible, and that distinction is the whole safety property:
 *
 *   - Off (the plain map): the context is created exactly as it was before any
 *     WebXR work existed. All that happens extra is one
 *     `navigator.xr.isSessionSupported()` call — a capability query that
 *     creates nothing and migrates nothing — and a button if it says yes.
 *     Pressing the button is what migrates the context, at a moment the user
 *     asked for and can be told about.
 *   - On: the context is XR-compatible from the first frame, so entry can never
 *     hit a GPU migration. This is the guaranteed path, and where a failed
 *     lazy arming reloads to.
 *
 * That keeps the thing that actually mattered: a student opening the map with
 * a headset plugged in still runs the renderer that shipped before any of this.
 * What it drops is the pretence that they should have to know a URL to get in.
 *
 * The `/vr/` door is read off the document, not off `location.pathname`: the
 * deploy base comes from GITHUB_REPOSITORY and can be overridden with
 * BASE_PATH, so any path-sniffing gate would silently stop arming XR after a
 * repo rename.
 */
const XR_EAGER =
  new URLSearchParams(location.search).has('vr') ||
  document.documentElement.dataset.xr === '1'
const app = createScene(container, { xr: XR_EAGER })
const tooltip = createTooltip()

// Hold the ground down around every session disc BEFORE the island mesh is
// built — the mesh is sampled from groundHeightAt, so a pad registered later
// would flatten the placement logic and leave the geometry untouched.
clearGroundAround(nodeClearings(allLevels))

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
  // Before rig.update reads them: the pad feeds rig.orbit/rig.zoom the same
  // deltas a drag and a wheel would, and the updaters all run ahead of the
  // camera in the frame (see scene.js).
  camPad?.update(dt)
  island.update(dt)
  enemies.update(dt)
  villagers?.update(dt, app.rig.camera)
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

/**
 * The honoured students, built in boot() once `npcs.json` has arrived — so this
 * is null for the first few frames and the update loop asks with `?.`.
 */
let villagers = null

/**
 * Sessions a villager may pace around: on the path, and not a castle.
 *
 * ON THE PATH, because the circuit relies on the flat pad `clearGroundAround`
 * holds down within four units of every on-path node. An off-path bonus node has
 * no pad by design — a flat disc out in open country reads as a scar — so a loop
 * there would climb terraces and walk through the scattered props.
 *
 * NOT A CASTLE, because the castle IS the node: it fills the pad, and villagers
 * placed at one were simply swallowed by the building with only the edge of a
 * name plate showing past the wall. The two exams are also the two sessions
 * nobody earns participation points in.
 */
const VILLAGER_SESSIONS = new Set(
  map.placed.filter((p) => p.onPath && p.level.category !== 'boss').map((p) => p.level.id)
)

/**
 * Turn roster entries into places to pace around.
 *
 * /admin only offers the sessions above; this is the guard for a hand-edited
 * file that says otherwise. `slot` counts how many are already at that session,
 * which is what spreads them around the disc rather than stacking them in one
 * spot.
 */
function villagerSpots(roster) {
  const taken = new Map()
  const out = []
  for (const entry of roster) {
    const centre = map.positionById.get(entry.levelId)
    if (!centre || !VILLAGER_SESSIONS.has(entry.levelId)) {
      console.warn(
        `[npcs] "${entry.name}" apunta a "${entry.levelId}", donde no cabe un alumno paseando`
      )
      continue
    }
    const slot = taken.get(entry.levelId) ?? 0
    taken.set(entry.levelId, slot + 1)
    out.push({ id: entry.id, name: entry.name, centre, slot })
  }
  return out
}

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
/** Where to put the "this one is still locked" note. */
let lastPointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
let lockedNoteTimer = null

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

  // Hovering the node the avatar is STANDING on brings its plate back. The
  // plate dismisses itself the moment you touch anything else, which is what it
  // has to do on a phone; on a desktop that would otherwise mean a dismissed
  // plate could only be recovered by entering the level. It is deliberately
  // only this node: the plate hangs over the avatar and offers "entrar", so
  // raising it while the pointer is somewhere else on the map would point at
  // the wrong thing.
  //
  // Not while a pointer is down: dragging the camera from over the node would
  // otherwise put the plate straight back after the drag had dismissed it.
  const standingHere = Boolean(level) && level.id === player.levelId && !player.isMoving
  if (standingHere && !pointers.size) showNodeLabel(level, { markerId })

  // One node, one label. The plate already carries the title and the way in,
  // and the tooltip would land on top of it — the pointer is over the avatar's
  // own node, which is exactly where the plate is.
  if (level && !(standingHere && nodeLabelFor() === level.id)) {
    tooltip.show(level, e.clientX, e.clientY, markerId)
  } else {
    tooltip.hide()
  }
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
  lastPointer = { x: e.clientX, y: e.clientY }
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
let camPad = null
let markerId = null
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

/**
 * Everything that can reach a level goes through selectLevel, so this is the
 * one gate a locked session has to fail: a tap on the disc, a row in the course
 * list, an arrow key, a controller ray in VR, a shared link. There is no second
 * door.
 */
function selectLevel(levelOrId, { open = false, instant = false } = {}) {
  const level = typeof levelOrId === 'string' ? levelById(levelOrId) : levelOrId
  if (!level) return

  if (isLocked(level, markerId)) {
    // Silence would read as a broken button. The tooltip already knows how to
    // say it, and it is placed where the pointer last was.
    const at = lastPointer
    tooltip.show(level, at.x, at.y, markerId)
    clearTimeout(lockedNoteTimer)
    lockedNoteTimer = setTimeout(() => tooltip.hide(), 2600)
    return
  }

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
  // End goes to the furthest level a student may actually reach. Sending the
  // keyboard to a locked one would bounce off the guard and look broken.
  else if (e.key === 'End') target = [...order].reverse().find((l) => !isLocked(l, markerId))
  else return
  if (target && isLocked(target, markerId)) target = null

  e.preventDefault()
  // Arrows walk the map; they do not open the level. Enter does that, so a
  // keyboard user can look around without a modal opening on every keypress.
  if (target) selectLevel(target, { open: false })
})

/** Apply a new marker everywhere at once, so map and menu never disagree. */
/**
 * Move the progress marker.
 *
 * `walk` is not decoration. The avatar IS "where the class is", so a marker
 * that moves while the avatar stays put reads as the button having done
 * nothing — which is exactly how it was reported: the node recoloured, and
 * neither the character nor the camera went anywhere.
 *
 * `instant` teleports instead of walking, for jumps long enough that watching
 * the walk would be a punishment (resetting the course from session 27).
 */
function applyMarker(id, { walk = false, instant = false } = {}) {
  markerId = id
  map.refresh(id)
  nav?.setMarker(id)
  legend?.setMarker(markerReadout(id))
  // The VR card shows "aquí estamos" for the marker level, so it restyles too.
  vr?.refreshPanel?.()
  if (walk) selectLevel(id, { open: false, instant })
}

/**
 * The lock rule changed. Every surface that decides anything from it has to be
 * asked again — the map's colours, the course list's titles, and the plate over
 * the avatar, which may be standing on a session that just became locked.
 */
function applyLocks() {
  map.refresh(markerId)
  nav?.refreshLocks()
  tooltip.hide()
  if (player.levelId && isLocked(levelById(player.levelId), markerId)) hideNodeLabel()
}

/** "La clase está en" — the readout that used to live on the /admin page. */
function markerReadout(id) {
  const level = levelById(id)
  if (!level) return null
  const n = sessionNumber(level)
  return {
    title: level.title,
    label: n ? `Mundo ${n.world}-${n.index} · sesión ${n.global} de ${n.total}` : 'Nivel opcional',
  }
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
  // Both public data files, in parallel: neither depends on the other and both
  // are a network round trip against a Pages host that is deliberately not
  // cached.
  const [progress, roster] = await Promise.all([
    loadProgress(),
    loadRoster({ validLevelIds: new Set(mainSequence.map((l) => l.id)) }),
  ])
  markerId = progress.currentLevelId
  // The course setting first, then this browser's exemption: whoever holds an
  // admin token sees the whole course, which is the "mecanismo para poder
  // visualizar todas" without having to turn the rule off for the class.
  setLockAhead(progress.lockAhead)
  // `?ver=todo` first (an explicit instruction on this load), then a choice this
  // browser has already made, and only then the token. That order is what lets
  // someone be shown the whole island without one — and lets a teacher who has
  // one stay in "ver como alumno" across a reload, which used to snap back.
  setSeeAll(readSeeAllFromUrl() ?? seeAllChoice() ?? hasAdminToken())
  map.refresh(markerId)

  // The honoured students. Nothing to draw is the normal state on a fresh term.
  villagers = createVillagers(villagerSpots(roster), grandPath)
  if (villagers.count) {
    app.worldGroup.add(villagers.group)
    console.info(`[npcs] ${villagers.count} alumno(s) paseando por la isla`)
  }

  // A shared ?level=... link wins over the progress marker: whoever followed
  // the link came for that level, so place the avatar there directly rather
  // than hopping across three worlds to reach it.
  // A link to a session the class has not reached yet is not a way in. It falls
  // back to the marker rather than erroring, so a link shared early simply
  // opens the map at today's session and works again once the class arrives.
  let deepLinked = readLevelFromUrl()
  if (deepLinked && isLocked(deepLinked, markerId)) {
    console.info(`[lock] "${deepLinked.id}" todavía no está abierta; abriendo el mapa`)
    deepLinked = null
    setLevelInUrl(null, { replace: true })
  }
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
      applyMarker(next, { walk: true })
      return 'Marcador avanzado. El sitio se reconstruye en 1–2 min.'
    },
    onBack: async () => {
      const i = mainSequence.findIndex((l) => l.id === markerId)
      const prev = mainSequence[Math.max(0, i - 1)]?.id ?? START_MARKER
      await writeProgress(prev, 'Retroceso')
      applyMarker(prev, { walk: true })
      return 'Marcador retrocedido.'
    },
    onReset: async () => {
      await writeProgress(START_MARKER, 'Reinicio')
      // Teleport: from session 27 the walk home crosses the whole island.
      applyMarker(START_MARKER, { walk: true, instant: true })
      return 'Curso reiniciado.'
    },
    /** The course-wide rule. Written to progress.json; every student gets it. */
    onToggleLock: async (on) => {
      await writeLockAhead(on)
      setLockAhead(on)
      applyLocks()
      return on
        ? 'Las sesiones futuras quedan ocultas para los alumnos.'
        : 'Todas las sesiones son visibles.'
    },
    /** Local to this browser: look at the map the way the class sees it. */
    onToggleSeeAll: (seeAll) => {
      setSeeAll(seeAll)
      rememberSeeAll(seeAll)
      applyLocks()
    },
    lockAhead: () => lockAheadSetting(),
    seeAll: () => seeAllSetting(),
  })
  legend.setMarker(markerReadout(markerId))

  // Orbit and zoom as buttons, on touch devices only: with a mouse the drag and
  // the wheel already do this better, and the pad would just cover the island.
  // Same rig methods either way, so it adds a door rather than a second way for
  // the camera to be moved.
  if (wantsCamPad()) {
    camPad = mountCamPad({ rig: app.rig, host: document.getElementById('ui') })
  }
  nav.setPlayerLevel(startId)

  // The opening flight. Set up BEFORE app.start(), because the hook has to run
  // on the very first frame — one frame of the ordinary map before the sky
  // appears is a visible flash of the ending.
  //
  // `#ui` ships hidden (`is-intro` in index.html), so the HUD is never painted
  // at full opacity and then faded out before the clouds. When there is no
  // flight, drop the class now and the HUD is simply present; the flight itself
  // drops it through `is-revealing` once the camera has landed.
  if (introWanted({ deepLinked: Boolean(deepLinked), xrEager: XR_EAGER })) {
    const intro = createIntro({
      camera: app.rig.camera,
      scene: app.scene,
      avatar: player.group.position.clone(),
    })
    app.setAfterCamera((dt) => intro.update(dt))
  } else {
    document.getElementById('ui').classList.remove('is-intro')
  }

  app.start()

  // --- immersive VR --------------------------------------------------------
  // Offered on every page. The cost on the plain map is one capability query;
  // the context is only migrated if someone presses the button. See XR_EAGER.
  console.info(
    XR_EAGER
      ? '[xr] contexto XR-compatible desde el primer frame'
      : '[xr] mapa 2D; el contexto se prepara al pulsar «Entrar en VR»'
  )
  vr = createVR({
    armXR: () => app.armXR(),
    renderer: app.renderer,
    scene: app.scene,
    camera: app.rig.camera,
    worldGroup: app.worldGroup,
    backdrop: island.backdrop,
    pickTargets: () => map.pickTargets,
    levelFromHit: (hit) => map.levelFromHit(hit),
    playerLevelId: () => player.levelId,
    levelById: (id) => levelById(id),
    markerId: () => markerId,
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
    // Back and Forward can restore a `?level=` from earlier in this history —
    // including one the class has not reached. The load-time guard cannot see
    // those, so the gate has to be here as well.
    if (isLocked(level, markerId)) {
      closePortal()
      setLevelInUrl(null, { replace: true })
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
    window.__villagers = villagers
    window.__selectLevel = selectLevel
    window.__setOverview = setOverview
    // Drives frames by hand — the only way to exercise animation in embedded
    // browsers where rAF never fires because document.hidden stays true.
    window.__step = (frames = 60, dt = 1 / 60) => {
      for (let i = 0; i < frames; i++) {
        for (const fn of app.updaters) fn(dt)
        app.rig.update(dt, { x: 0, y: 0 })
        app.tickAfterCamera(dt)
      }
      app.renderer.render(app.scene, app.rig.camera)
    }
  }
}

boot()
