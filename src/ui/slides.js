import { renderDeck } from './deck.js'

/**
 * Slide viewer, in priority order:
 *
 *   1. a deck GENERATED from the level's Marp markdown, if one was built
 *   2. a Canva embed, for decks that need animation or video
 *   3. a PDF committed to this repo, so it also works offline in class
 *
 * The generated deck wins because it is opt-in at the source: a deck only
 * exists when Marc put `marp: true` in that level's exercise markdown, so its
 * presence IS the instruction to prefer it. Everything else is unchanged — the
 * Canva URL must still be the public Share → Embed link, and validate.mjs
 * still rejects edit links so a private deck cannot reach the published site.
 */

function frame(src, title) {
  return `
    <iframe
      class="w-full h-full rounded-lg border border-base-content/15 bg-base-200"
      src="${src}"
      title="${title}"
      loading="lazy"
      allow="fullscreen"
      allowfullscreen
      referrerpolicy="no-referrer"
    ></iframe>`
}

/**
 * What the day covers, straight from the calendar's Content column. Rendered
 * above whatever the slides surface is, so a session that has no deck yet still
 * says something rather than showing an empty box.
 */
function contentsList(level) {
  if (!level.contents?.length) return ''
  const items = level.contents
    .map((c) => `<li>${escapeHtml(c)}</li>`)
    .join('')
  return `
    <div class="mb-5">
      <h3 class="font-semibold mb-2">Contenido de la sesión</h3>
      <ul class="list-disc ps-5 space-y-1 text-sm opacity-90 max-w-prose">${items}</ul>
    </div>`
}

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ))

export async function renderSlides(el, level) {
  // 1. Generated deck. Returns false when this level has none.
  //
  //    A practical day can legitimately have BOTH: the calendar's Classes
  //    column carries the lecture deck (Canva) *and* "+ TODO's (Marp)", which
  //    are different documents. The deck still owns the panel — it is the one
  //    you work through in class — but the Canva goes above it as a link
  //    rather than being silently dropped, which is what happened when the
  //    first calendar links landed.
  const external = level.slides?.source ?? level.slidesLink?.url
  if (external) {
    const bar = document.createElement('div')
    bar.className = 'mb-2 shrink-0'
    bar.innerHTML = `
      <a class="btn btn-sm btn-outline" href="${external.replace(/[?&]embed/, '')}"
         target="_blank" rel="noopener noreferrer">
        ${escapeHtml(level.slidesLink?.label ?? 'Diapositivas de la sesión')} ↗
      </a>`
    const slot = document.createElement('div')
    slot.className = 'flex-1 min-h-0'
    const wrap = document.createElement('div')
    wrap.className = 'flex flex-col h-full'
    wrap.append(bar, slot)
    el.replaceChildren(wrap)
    if (await renderDeck(slot, level)) return
    el.replaceChildren() // no deck after all — fall through to the normal paths
  } else if (await renderDeck(el, level)) {
    return
  }

  const slides = level.slides

  // 2. A link off the calendar's Classes column. These are canva.link
  //    shortlinks, which Canva refuses to render inside an iframe when the
  //    design is private — so this is a LINK and a contents list, never a dead
  //    embed showing "Este diseño es privado". A level gets a real `slides`
  //    block, and loses this one, once a public Share → Embed URL exists.
  if (!slides?.source && level.slidesLink?.url) {
    el.innerHTML = `
      <div class="h-full overflow-y-auto p-1">
        ${contentsList(level)}
        <a class="btn btn-primary" href="${level.slidesLink.url}"
           target="_blank" rel="noopener noreferrer">
          ${level.slidesLink.label} ↗
        </a>
        <p class="text-xs opacity-60 mt-3 max-w-prose">
          Se abre en Canva, en una pestaña nueva. Si pide permisos, el diseño
          todavía no es público.
        </p>
      </div>`
    return
  }

  if (!slides?.source) {
    el.innerHTML = `
      <div class="h-full overflow-y-auto p-1">
        ${contentsList(level)}
        <p class="opacity-70 text-sm">
          Esta sesión todavía no tiene diapositivas enlazadas.
        </p>
      </div>`
    return
  }

  const title = `Diapositivas — ${level.title}`

  if (slides.type === 'canva') {
    el.innerHTML = `
      <div class="flex flex-col h-full gap-2">
        <div class="flex-1 min-h-0">${frame(slides.source, title)}</div>
        <a class="btn btn-sm btn-ghost self-start" href="${slides.source}"
           target="_blank" rel="noopener noreferrer">Abrir en Canva ↗</a>
      </div>`
    return
  }

  // PDF: served straight from the repo, so it works offline in class too.
  const url = `${import.meta.env.BASE_URL}${slides.source.replace(/^\//, '')}`
  el.innerHTML = `
    <div class="flex flex-col h-full gap-2">
      <div class="flex-1 min-h-0">
        <object data="${url}" type="application/pdf" class="w-full h-full rounded-lg">
          <div class="h-full grid place-items-center text-center p-6">
            <div>
              <p class="font-semibold mb-2">Tu navegador no puede incrustar PDF.</p>
              <a class="btn btn-primary btn-sm" href="${url}" target="_blank"
                 rel="noopener noreferrer">Abrir el PDF ↗</a>
            </div>
          </div>
        </object>
      </div>
      <a class="btn btn-sm btn-ghost self-start" href="${url}" target="_blank"
         rel="noopener noreferrer">Abrir en una pestaña ↗</a>
    </div>`
}
