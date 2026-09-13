import { t } from './i18n/index.js'

/**
 * The human-readable names for the level model's enum-ish fields.
 *
 * Extracted from `ui/portal.js` when the VR panel needed the same words. Two
 * copies of "meta-pre-exam" means the day someone renames a stage, one surface
 * says the new name and the other quietly keeps the old one — the same reason
 * every colour lives in `config/theme.js`.
 *
 * The words themselves moved again, into `lib/i18n/`, once the site had three
 * languages: what is left here is the MAPPING from the data model's enum to a
 * translation key, which is the part that belongs next to the model. Look up
 * `stage.intro-theory` in `i18n/en.js` to read the English.
 *
 * Plain strings only, no markup: the 2D portal writes them into HTML and the
 * VR panel paints them onto a canvas, and a `<span>` would end up drawn
 * literally on the second one.
 */

/** `en.js` holds `stage.<id>`, `category.<id>`, and so on for each of these. */
export const stageLabel = (level) =>
  level?.stage ? t(`stage.${level.stage}`) : ''
export const categoryLabel = (level) =>
  level?.category ? t(`category.${level.category}`) : ''
export const bossTierLabel = (tier) => (tier ? t(`bossTier.${tier}`) : '')

/**
 * `null` means the brief has not decided yet and says so out loud — an empty
 * slot is a question still open, not an oversight, so it must never render as
 * blank.
 */
export const submissionLabel = (method) =>
  method ? t(`submission.${method}`) : t('common.undecided')

/**
 * Every graded block is group work, and the groups are not fixed for the term:
 * a block may be started with a different line-up from the last one. That is
 * the part a student has to be told, so it is in the label rather than in a
 * footnote nobody reads — see `group.per-group-per-block`.
 */
export const groupLabel = (mode) => (mode ? t(`group.${mode}`) : t('common.undecided'))

/** What an undecided field reads as, in plain text. */
export const undecidedText = () => t('common.undecided')

/**
 * The assessment rows for a graded block exercise, as `[label, value]` pairs of
 * plain text. Returns an empty array for every other level.
 *
 * Shared so the VR panel and the portal's strip cannot drift: the portal wraps
 * the same values in markup, this returns them bare.
 */
export function assessmentRows(level) {
  if (!level?.block) return []
  const b = level.block

  return [
    [
      t('assess.block'),
      t('assess.blockValue', { number: b.number, name: b.name, exercise: b.exercise, of: b.of }),
    ],
    [t('assess.delivery'), submissionLabel(level.submissionMethod)],
    [t('assess.work'), groupLabel(level.groupMode)],
  ]
}
