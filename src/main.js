import './style.css'
import * as THREE from 'three'
import { createScene } from './three/scene.js'
import { worlds } from './config/worlds.js'
import { world as themeWorld } from './config/theme.js'

const container = document.getElementById('app')
const app = createScene(container)

// --- Phase 1 placeholder: one slab per world so the three fixed camera
// positions are visibly correct. Replaced by the real island in phase 4.
const slabGeo = new THREE.BoxGeometry(46, 2, 46)
for (const w of worlds) {
  const mat = new THREE.MeshLambertMaterial({ color: themeWorld.terrain })
  const slab = new THREE.Mesh(slabGeo, mat)
  slab.position.set(w.center[0], -1, w.center[2])
  app.worldGroup.add(slab)
}

// Temporary world switcher until the nav menu lands in phase 5.
window.addEventListener('keydown', (e) => {
  if (e.key >= '1' && e.key <= '3') app.rig.goToWorld(Number(e.key))
})

if (import.meta.env.DEV) {
  // Dev-only handle. `step()` drives frames by hand, which is the only way to
  // exercise animation in embedded/offscreen browsers where requestAnimationFrame
  // never fires because document.hidden stays true.
  window.__app = app
  window.__step = (frames = 60, dt = 1 / 60) => {
    for (let i = 0; i < frames; i++) {
      app.rig.update(dt, { x: 0, y: 0 })
      for (const fn of app.updaters) fn(dt)
    }
    app.renderer.render(app.scene, app.rig.camera)
  }
}

app.start()

// eslint-disable-next-line no-console
console.info('XR Island — press 1/2/3 to pan between worlds.')
