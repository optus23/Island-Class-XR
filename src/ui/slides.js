import { t } from '../lib/i18n/index.js'
import { levelTitle, levelContents } from '../lib/levels.js'

/**
 * Slide viewer, in priority order:
 *
 *   1. a Canva embed, for decks that need animation or video
 *   2. a PDF committed to this repo, so it also works offline in class
 *   3. an external link, for anything that refuses to be framed
 *
 * THIS TAB IS THE LECTURE, AND ONLY THE LECTURE. The generated Marp deck used
 * to win here, which put the exercise walkthrough under "Diapositivas" and
 * demoted the session's own Canva to a small link button above it — reported
 * as the Canva simply not being there at all. The deck now renders in the
 * Instructions tab, above the checklist it walks through; see `ui/todos.js`.
 *
 * The Canva URL must be the public Share → Embed link, and validate.mjs
 * rejects edit links so a private deck cannot reach the published site.
 */

/**
 * The embed box.
 *
 * `aspect-video` and NOT `h-full`. The panel used to be a fixed-height box, so
 * 100% resolved against it; now the whole portal scrolls and its height is
 * auto, which collapsed the iframe to a strip. Sizing from the width — the one
 * dimension that is always known — is the same rule the Marp viewer follows,
 * and `max-w` caps it by height so a slide never grows taller than the screen.
 */
function frame(src, title) {
  return `
    <iframe
      class="w-full aspect-video rounded-lg border border-base-content/15 bg-base-200"
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
  const contents = levelContents(level)
  if (!contents.length) return ''
  const items = contents
    .map((c) => `<li>${escapeHtml(c)}</li>`)
    .join('')
  return `
    <div class="mb-5">
      <h3 class="font-semibold mb-2">${t('slides.sessionContent')}</h3>
      <ul class="list-disc ps-5 space-y-1 text-sm opacity-90 max-w-prose">${items}</ul>
    </div>`
}

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ))

export async function renderSlides(el, level) {
  const slides = level.slides

  // 1. A link off the calendar's Classes column. These are canva.link
  //    shortlinks, which Canva refuses to render inside an iframe when the
  //    design is private — so this is a LINK and a contents list, never a dead
  //    embed showing "Este diseño es privado". A level gets a real `slides`
  //    block, and loses this one, once a public Share → Embed URL exists.
  if (!slides?.source && level.slidesLink?.url) {
    el.innerHTML = `
      <div class="p-1">
        ${contentsList(level)}
        <a class="btn btn-primary" href="${level.slidesLink.url}"
           target="_blank" rel="noopener noreferrer">
          ${level.slidesLink.label} ↗
        </a>
        <p class="text-xs opacity-60 mt-3 max-w-prose">${t('slides.canvaPrivateNote')}</p>
      </div>`
    return
  }

  // 2. No deck. Two different nothings, and they must not read the same:
  //    a session whose deck is not written yet is waiting on something, while a
  //    project day has no deck by design and never will. Saying "todavía" to the
  //    second one promises slides that are never coming.
  if (!slides?.source) {
    el.innerHTML = `
      <div class="p-1">
        ${contentsList(level)}
        ${
          level.slidesPending
            ? `<p class="opacity-70 text-sm">${t('slides.pending')}</p>`
            : `<p class="opacity-70 text-sm">${t('slides.none')}</p>`
        }
      </div>`
    return
  }

  const title = t('slides.title', { title: levelTitle(level) })

  if (slides.type === 'canva') {
    el.innerHTML = `
      <div class="flex flex-col gap-2">
        <div class="w-full max-w-[121vh] mx-auto">${frame(slides.source, title)}</div>
        <a class="btn btn-sm btn-ghost self-start" href="${slides.source}"
           target="_blank" rel="noopener noreferrer">${t('slides.openCanva')}</a>
      </div>`
    return
  }

  // PDF: served straight from the repo, so it works offline in class too.
  const url = `${import.meta.env.BASE_URL}${slides.source.replace(/^\//, '')}`
  el.innerHTML = `
    <div class="flex flex-col gap-2">
      <!-- A PDF page is portrait, so height comes from the viewport rather
           than from a 16/9 ratio. Explicit either way: h-full has nothing to
           resolve against now that the portal scrolls. -->
      <div class="w-full h-[78vh] min-h-[24rem]">
        <object data="${url}" type="application/pdf" class="w-full h-full rounded-lg">
          <div class="h-full grid place-items-center text-center p-6">
            <div>
              <p class="font-semibold mb-2">${t('slides.pdfNoEmbed')}</p>
              <a class="btn btn-primary btn-sm" href="${url}" target="_blank"
                 rel="noopener noreferrer">${t('slides.openPdf')}</a>
            </div>
          </div>
        </object>
      </div>
      <a class="btn btn-sm btn-ghost self-start" href="${url}" target="_blank"
         rel="noopener noreferrer">${t('slides.openTab')}</a>
    </div>`
}
