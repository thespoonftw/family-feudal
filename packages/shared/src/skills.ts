import { MEMBER_SKILL_BOUNDS, type TraitDesign, type SkillKey } from './types.js'

/**
 * Derives a member's resultant skills from their assigned traits. Every catalog skill
 * starts at the base value (MEMBER_SKILL_BOUNDS[0]); each assigned trait that still
 * exists in `traitCatalog` adds its bonuses on top, clamped to MEMBER_SKILL_BOUNDS.
 * `traitCatalog` may be a combined traits+occupations list — both share the same shape.
 * A trait name with no match (removed since assignment) or a bonus targeting a skill no
 * longer in `skillCatalog` is silently skipped — same tolerance as other stale catalog
 * references elsewhere in the design content.
 */
export function computeMemberSkills(
  traitNames: readonly string[],
  traitCatalog: readonly TraitDesign[],
  skillCatalog: readonly SkillKey[],
): Record<SkillKey, number> {
  const [min, max] = MEMBER_SKILL_BOUNDS
  const result: Record<SkillKey, number> = {}
  for (const skill of skillCatalog) result[skill] = min
  for (const traitName of traitNames) {
    const trait = traitCatalog.find((t) => t.name === traitName)
    if (!trait) continue
    for (const bonus of trait.bonuses) {
      if (!(bonus.skill in result)) continue
      result[bonus.skill] = Math.max(min, Math.min(max, (result[bonus.skill] ?? min) + bonus.amount))
    }
  }
  return result
}
