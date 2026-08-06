import { MEMBER_SKILL_BOUNDS, type FeatureDesign, type SkillKey } from './types.js'

/**
 * Derives a member's resultant skills from their assigned features. Every catalog skill
 * starts at the base value (MEMBER_SKILL_BOUNDS[0]); each assigned feature that still
 * exists in `featureCatalog` adds its bonuses on top, clamped to MEMBER_SKILL_BOUNDS[1].
 * A feature name with no match (removed since assignment) or a bonus targeting a skill no
 * longer in `skillCatalog` is silently skipped — same tolerance as other stale catalog
 * references elsewhere in the design content.
 */
export function computeMemberSkills(
  featureNames: readonly string[],
  featureCatalog: readonly FeatureDesign[],
  skillCatalog: readonly SkillKey[],
): Record<SkillKey, number> {
  const [min, max] = MEMBER_SKILL_BOUNDS
  const result: Record<SkillKey, number> = {}
  for (const skill of skillCatalog) result[skill] = min
  for (const featureName of featureNames) {
    const feature = featureCatalog.find((f) => f.name === featureName)
    if (!feature) continue
    for (const bonus of feature.bonuses) {
      if (!(bonus.skill in result)) continue
      result[bonus.skill] = Math.min(max, (result[bonus.skill] ?? min) + bonus.amount)
    }
  }
  return result
}
