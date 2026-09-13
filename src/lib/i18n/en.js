/**
 * English — THE BASE DICTIONARY.
 *
 * Every key the site uses is defined here first, and `es.js` / `ca.js` are
 * checked against this file by `scripts/validate.mjs`: same keys, no more, no
 * fewer. Add a string here and the build fails until the other two have it,
 * which is the whole point — a key added in one language and forgotten in the
 * other two is exactly the drift this is meant to prevent.
 *
 * Flat keys, dot-grouped. Nested objects read nicely and compare badly; a flat
 * map is one `Object.keys()` away from a diff.
 *
 * `{placeholders}` are filled by `t(key, vars)`.
 */
export default {
  // --- the level model's enum-ish fields ---------------------------------
  'stage.intro-theory': 'Introduction and theory',
  'stage.ar-foundation': 'AR Foundation',
  'stage.meta-pre-exam': 'Meta Building Blocks (before the midterm)',
  'stage.mini-boss-midterm': 'Midterm exam',
  'stage.meta-post-exam': 'Meta Building Blocks (after the midterm)',
  'stage.xr-toolkit': 'XR Interaction Toolkit',
  'stage.final-project': 'Final project',
  'stage.final-boss-presentation': 'Final presentation',

  'category.theory': 'Theory',
  'category.practical': 'Practical',
  'category.project': 'Project',
  'category.boss': 'Exam',

  'bossTier.mini': 'Mid boss',
  'bossTier.final': 'Final boss',
  'bossTier.extra': 'Extra',

  'submission.build': 'Build (APK), not a video',
  'submission.video': 'Video',
  'submission.repo': 'Repository',

  'group.individual': 'Individual',
  'group.individual-within-group': 'Individual, within the group',
  'group.per-group': 'Per group',
  'group.per-group-per-block': 'Per group · groups are re-formed each block',

  'common.undecided': 'to be decided',

  'assess.block': 'Block',
  'assess.delivery': 'Hand-in',
  'assess.work': 'Work',
  'assess.blockValue': '{number} · {name} — exercise {exercise} of {of}',

  // --- course index (top left) -------------------------------------------
  'nav.lockedTitle': 'Opens when the class gets here',
  'nav.locked': 'Locked',
  'nav.classIsHere': 'The class is here',
  'nav.extra': 'extra',
  'nav.sessionTitle': 'Session {n} of {total}',
  'nav.sessionShort': 'Session {n} / {total}',
  'nav.backToCharacter': 'Back to the character',
  'nav.wholeIsland': 'See the whole island',

  // --- legend and teacher controls (bottom right) ------------------------
  'legend.title': 'Legend',
  'legend.row.completed': 'Completed',
  'legend.row.theory': 'Theory',
  'legend.row.practical': 'Practical',
  'legend.row.project': 'Team project',
  'legend.row.boss': 'Exam',
  'legend.row.optional': 'Attitude / extra',
  'legend.row.locked': 'Not open yet',
  'legend.fullMap': 'Whole map (top-down)',
  'legend.backToCharacter': 'Back to the character',
  'legend.teacher': 'Teacher',
  'legend.classIsAt': 'The class is at',
  'legend.completeAdvance': 'Complete and advance',
  'legend.back': 'Go back',
  'legend.reset': 'Reset the course',
  'legend.adminLinkFull': 'Teacher panel · students and token →',
  'legend.adminLink': 'Teacher panel →',
  'legend.hideFuture': 'Hide the sessions ahead',
  'legend.seeAsStudent': 'See the map as a student',
  'legend.saving': 'Saving…',
  'legend.done': 'Done.',
  'legend.error': 'Error.',

  // --- language picker ----------------------------------------------------
  'lang.label': 'Language',

  // --- hover tooltip ------------------------------------------------------
  'tooltip.locked': 'opens when the class gets here',
  'tooltip.optional': 'optional',
  'tooltip.completed': 'completed',
  'tooltip.current': 'we are here',
  'tooltip.deliverable': '🚩 Hand-in: {label}',
  'tooltip.deliverableSub': '{weight} of the course · deadline for this activity',

  'curtain.building': 'Building the island…',

  // --- level portal -------------------------------------------------------
  'portal.slides': 'Slides',
  'portal.activities': 'Activities',
  'portal.exercises': 'Exercises',
  'portal.bibliography': 'Bibliography',
  'portal.back': 'Back to the map',
  'portal.backTitle': 'Back to the map (Esc)',
  'portal.worldSession': 'World {world}-{index} · session {global} of {total}',
  'portal.optionalLevel': 'Optional level',
  'portal.world': 'World {n}',
  'portal.optional': 'Optional',
  'portal.completed': 'Completed',
  'portal.current': 'We are here',
  'portal.loading': 'Loading…',
  'portal.noExercises': 'This level has no exercises.',
  'portal.noBibliography': 'This level has no bibliography.',
  'portal.repository': 'Repository',
  'portal.repoLink': 'exercise repository',
  'portal.branch': 'branch {branch}',
  'portal.repoPending': '(not published yet)',

  // --- slides -------------------------------------------------------------
  'slides.sessionContent': 'What this session covers',
  'slides.deckLink': 'Slides for this session',
  'slides.openCanva': 'Open in Canva ↗',
  'slides.canvaPrivateNote':
    'Opens in Canva, in a new tab. If it asks for permission, the design is not public yet.',
  'slides.pending':
    'The slides for this session are being prepared. What is listed above is what will be covered; the link will arrive before the class.',
  'slides.none': 'This session has no slides.',
  'slides.pdfNoEmbed': 'Your browser cannot embed PDFs.',
  'slides.openPdf': 'Open the PDF ↗',
  'slides.openTab': 'Open in a new tab ↗',
  'slides.title': 'Slides — {title}',

  // --- generated Marp deck viewer ----------------------------------------
  'deck.prev': 'Previous slide',
  'deck.next': 'Next slide',
  'deck.generated': 'Generated from Markdown (Marp)',
  'deck.presentation': 'Presentation: {title}',

  // --- activities ---------------------------------------------------------
  'todos.objective': 'Objective',
  'todos.startingPoint': 'Starting point',
  'todos.stepGuide': 'Step-by-step guide',
  'todos.delivery': 'Hand-in',
  'todos.none': 'This level has no interactive activities.',
  'todos.unsupported': 'Activity type not supported yet: "{type}".',

  // --- markdown loader ----------------------------------------------------
  'md.pendingTitle': 'Not written yet',
  'md.pendingBody':
    'The file {path} is missing. Create it in the repository and it will show up here without touching any code.',
  'md.loadError': '{path} could not be loaded ({detail}).',
  'md.fallbackNotice': 'Not translated yet — showing the original.',

  // --- the card on the way into a level -----------------------------------
  'card.world': 'WORLD {world}-{index}',
  'card.sessionOf': 'Session {global} of {total} · {left} left',

  // --- the plate over the avatar ------------------------------------------
  'label.extra': 'EXTRA',
  'label.enter': 'enter',
  'label.enterAria': 'Enter {title}',

  // --- teacher actions, as messages ---------------------------------------
  'msg.advanced': 'Marker advanced. The site rebuilds in 1–2 min.',
  'msg.back': 'Marker moved back.',
  'msg.reset': 'Course reset.',
  'msg.lockOn': 'The sessions ahead are now hidden from students.',
  'msg.lockOff': 'All sessions are visible.',

  // --- accessibility ------------------------------------------------------
  'a11y.map': 'Course map. Arrow keys to move between levels, Enter to open the current one.',

  // --- VR -----------------------------------------------------------------
  'vr.worldSession': 'WORLD {world}-{index}  ·  SESSION {global} OF {total}',
  'vr.optionalLevel': 'OPTIONAL LEVEL',
  'vr.holdGaze': 'Hold your gaze',
  'vr.trigger': 'Trigger',
  // --- avatar wardrobe ----------------------------------------------------
  'avatar.title': "Your avatar",
  'avatar.note': "Only on this device. Nobody else sees it.",
  'avatar.prev': "Previous",
  'avatar.next': "Next",
  'avatar.hat': "Hat",
  'avatar.hat.cap': "Cap",
  'avatar.hat.none': "Bare head",
  'avatar.hat.beanie': "Beanie",
  'avatar.hat.tophat': "Top hat",
  'avatar.hat.crown': "Crown",
  'avatar.visor': "Visor",
  'avatar.visor.cyan': "Cyan",
  'avatar.visor.green': "Green",
  'avatar.visor.magenta': "Magenta",
  'avatar.visor.amber': "Amber",
  'avatar.shirt': "Shirt",
  'avatar.trousers': "Trousers",
  'avatar.shoes': "Shoes",
  'avatar.colour.red': "Red",
  'avatar.colour.blue': "Blue",
  'avatar.colour.green': "Green",
  'avatar.colour.purple': "Purple",
  'avatar.colour.orange': "Orange",
  'avatar.colour.navy': "Navy",
  'avatar.colour.grey': "Grey",
  'avatar.colour.sand': "Sand",
  'avatar.colour.maroon': "Maroon",
  'avatar.colour.black': "Black",
  'avatar.colour.white': "White",
  'avatar.colour.brown': "Brown",
}
