import { SLOTS, cycle, loadLook, optionFor, saveLook } from '../lib/avatar.js'
import { t } from '../lib/i18n/index.js'

/**
 * "Make it look like me" — the avatar wardrobe.
 *
 * A row per slot with an arrow on each side, which is the shape it was asked
 * for and also the right one: five slots of four or five options each is a
 * space you flick through, not one you pick from a grid of twenty swatches.
 *
 * EVERY CHANGE IS LIVE ON THE MAP BEHIND THE PANEL. There is no preview
 * figure and no Save button — the panel is small and sits over one corner, so
 * the actual avatar is visible while you change it, and that beats any
 * preview of it. It is also why nothing here is staged: the choice is this
 * browser's own `localStorage`, so there is no commit to batch and nothing to
 * lose by writing on every press.
 */
export function mountAvatarPicker({ onChange }) {
  const host = document.getElementById('ui')
  const el = document.createElement('div')
  el.className = 'avatar-picker'
  host.appendChild(el)

  let look = loadLook()
  let open = false

  function apply() {
    saveLook(look)
    onChange?.(look)
  }

  function render() {
    const rows = SLOTS.map((slot) => {
      const choice = optionFor(slot.key, look)
      const swatch = choice.color != null
        ? `<span class="avatar-swatch" style="background:#${choice.color.toString(16).padStart(6, '0')}"></span>`
        : '<span class="avatar-swatch is-none"></span>'
      return `
        <li class="avatar-row">
          <span class="avatar-slot">${t(slot.labelKey)}</span>
          <button class="avatar-arrow" data-slot="${slot.key}" data-step="-1"
                  aria-label="${t('avatar.prev')}">◀</button>
          <span class="avatar-choice">${swatch}<span>${t(choice.labelKey)}</span></span>
          <button class="avatar-arrow" data-slot="${slot.key}" data-step="1"
                  aria-label="${t('avatar.next')}">▶</button>
        </li>`
    }).join('')

    el.innerHTML = `
      <button class="avatar-toggle" data-toggle aria-expanded="${open}"
              title="${t('avatar.title')}" aria-label="${t('avatar.title')}">
        <span aria-hidden="true">🧑‍🚀</span>
      </button>
      ${
        open
          ? `<div class="avatar-card">
               <p class="avatar-head">${t('avatar.title')}</p>
               <ul class="avatar-list">${rows}</ul>
               <p class="avatar-note">${t('avatar.note')}</p>
             </div>`
          : ''
      }`

    el.querySelector('[data-toggle]').addEventListener('click', () => {
      open = !open
      render()
    })
    el.querySelectorAll('[data-slot]').forEach((b) =>
      b.addEventListener('click', () => {
        look = cycle(b.dataset.slot, look, Number(b.dataset.step))
        apply()
        render()
      })
    )
  }

  render()
  // Apply once on mount too: a browser that has chosen before should see its
  // own avatar without opening the panel.
  onChange?.(look)

  return { get look() { return look } }
}
