/**
 * Hybrid slide viewer: a PDF committed to this repo, or a Canva embed for the
 * decks that need animation/video that a PDF cannot carry.
 *
 * Each level declares which one it uses; nothing here guesses. The Canva URL
 * must be the public Share → Embed link — validate.mjs rejects edit links so a
 * private deck can never reach the published site.
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

export function renderSlides(el, level) {
  const slides = level.slides
  if (!slides?.source) {
    el.innerHTML = `
      <div class="h-full grid place-items-center text-center opacity-70">
        <div>
          <p class="font-semibold">Este nivel no tiene diapositivas.</p>
          <p class="text-sm">Añade "slides" en levels.json para mostrarlas aquí.</p>
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
