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

export async function renderSlides(el, level, { answersUnlocked = false } = {}) {
  // 1. Generated deck. Returns false when this level has none.
  if (await renderDeck(el, level, { answersUnlocked })) return

  const slides = level.slides
  if (!slides?.source) {
    el.innerHTML = `
      <div class="h-full grid place-items-center text-center opacity-70">
        <div>
          <p class="font-semibold">Este nivel no tiene diapositivas.</p>
          <p class="text-sm">
            Añade <code>marp: true</code> al markdown del ejercicio para generarlas,
            o un bloque <code>slides</code> en levels.json.
          </p>
        </div>
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
