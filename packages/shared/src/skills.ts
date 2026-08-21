import { MEMBER_SKILL_BOUNDS, type FamilyMember, type TraitDesign, type SkillKey } from './types.js'

/**
 * Derives a member's resultant skills from their assigned traits. Every catalog skill
 * starts at 0 — there is no base value, a skill is purely the sum of assigned bonuses —
 * and each assigned trait that still exists in `traitCatalog` adds its bonuses on top,
 * clamped to MEMBER_SKILL_BOUNDS. `traitCatalog` may be a combined traits+occupations
 * list — both share the same shape. A trait name with no match (removed since
 * assignment) or a bonus targeting a skill no longer in `skillCatalog` is silently
 * skipped — same tolerance as other stale catalog references elsewhere in the design
 * content.
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

/**
 * A member's skill for the round about to resolve — the -1 injury penalty applies for
 * one round only (see FamilyMember.injured), clamped to MEMBER_SKILL_BOUNDS.
 */
export function effectiveMemberSkill(member: FamilyMember, skill: SkillKey): number {
  const base = member.skills[skill] ?? 0
  if (!member.injured) return base
  return Math.max(MEMBER_SKILL_BOUNDS[0], base - 1)
}

/**
 * Probability that a check with the given skill total succeeds against a difficulty:
 * P(success) = 1 / (1 + 2^(difficulty - skill)) — even odds when skill equals difficulty,
 * rising toward 1 as skill exceeds it and toward 0 as it falls short.
 */
export function successChance(skill: number, difficulty: number): number {
  return 1 / (1 + Math.pow(2, difficulty - skill))
}
