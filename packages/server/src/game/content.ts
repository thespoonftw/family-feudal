import { copyFileSync, readFileSync, writeFileSync } from 'node:fs'
import type {
  ApproachDesign,
  AppearanceAccessories,
  AppearanceFace,
  AppearanceFacialHair,
  AppearanceHairColor,
  AppearanceHeadStyle,
  AppearanceSkinTone,
  FaceOutcomeDesign,
  FaceOutcomeMap,
  OccupationDesign,
  TraitBonus,
  TraitDesign,
  GameContent,
  GoldTier,
  HouseDesign,
  LocationPreposition,
  MemberAppearance,
  MemberDesign,
  RewardTier,
  ScenarioDesign,
  ScenarioLocation,
  SkillDesign,
  SkillKey,
  Town,
} from '@family-feudal/shared'
import {
  APPEARANCE_ACCESSORIES,
  APPEARANCE_FACES,
  APPEARANCE_FACIAL_HAIR,
  APPEARANCE_HAIR_COLORS,
  APPEARANCE_HEAD_STYLES,
  APPEARANCE_SKIN_TONES,
  APPROACH_DIFFICULTY_BOUNDS,
  TRAIT_BONUS_BOUNDS,
  MAX_TRAITS_PER_MEMBER,
  MEMBERS_PER_HOUSE,
  REWARD_TIERS,
} from '@family-feudal/shared'
import {
  appearanceFor,
  CAPITAL_COLOR,
  CAPITAL_NAME,
  CAPITAL_SLOT,
  CITY_SLOTS,
  DEFAULT_TRAITS,
  DEFAULT_OCCUPATIONS,
  DEFAULT_HOUSES,
  DEFAULT_SCENARIOS,
  DEFAULT_SKILLS,
  WILD_SLOTS,
} from './data.js'

// every face defaults to a downcast "concerned" look on a failed check, matching the
// game's original hardcoded behaviour; success keeps whichever face the character already has
const DEFAULT_FACE_OUTCOMES: FaceOutcomeMap = Object.fromEntries(
  APPEARANCE_FACES.map((face) => [face, { failureFace: 'concerned' }]),
) as FaceOutcomeMap

export const DEFAULT_CONTENT: GameContent = {
  skills: DEFAULT_SKILLS,
  traits: DEFAULT_TRAITS,
  occupations: DEFAULT_OCCUPATIONS,
  houses: DEFAULT_HOUSES,
  scenarios: DEFAULT_SCENARIOS,
  faceOutcomes: DEFAULT_FACE_OUTCOMES,
}

// Skills, traits, occupations, houses, scenarios, and face outcomes are persisted as six
// independent files — a save from one dev-panel tab (or a broken/stale file) can never
// clobber another's. Resolved against the server process cwd (packages/server under the
// systemd unit); each overridable via its own env var.
const SKILLS_FILE = process.env['SKILLS_FILE'] ?? 'game-skills.json'
const TRAITS_FILE = process.env['TRAITS_FILE'] ?? 'game-traits.json'
const OCCUPATIONS_FILE = process.env['OCCUPATIONS_FILE'] ?? 'game-occupations.json'
const HOUSES_FILE = process.env['HOUSES_FILE'] ?? 'game-houses.json'
const SCENARIOS_FILE = process.env['SCENARIOS_FILE'] ?? 'game-scenarios.json'
const FACES_FILE = process.env['FACES_FILE'] ?? 'game-faces.json'

// Pre-split installs kept everything in one file. If a section's own file doesn't exist yet,
// that section is seeded from here once, then written out to its own file from then on —
// this file itself is otherwise never touched again.
const LEGACY_CONTENT_FILE = process.env['CONTENT_FILE'] ?? 'game-content.json'
let legacyContentCache: Record<string, unknown> | null | undefined
function legacyContent(): Record<string, unknown> | null {
  if (legacyContentCache === undefined) {
    try {
      legacyContentCache = JSON.parse(readFileSync(LEGACY_CONTENT_FILE, 'utf8')) as Record<string, unknown>
    } catch {
      legacyContentCache = null
    }
  }
  return legacyContentCache
}

const LOCATIONS: ScenarioLocation[] = ['general', 'capital', 'home', 'wild']
const PREPOSITIONS: LocationPreposition[] = ['in', 'near']

function cleanString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > maxLength) return null
  return trimmed
}

/** like cleanString but optional — an empty/missing value is valid and normalises to '' */
function cleanOptionalString(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, maxLength)
}

/** a member's assigned slots may name either a Trait or an Occupation — both catalogs
 *  share the same shape and are offered together in the dev panel's assignment dropdown */
function isAssignableName(entry: string): boolean {
  return traits.some((f) => f.name === entry) || occupations.some((f) => f.name === entry)
}

function sanitizeMemberTraits(raw: unknown, where: string): string[] | string {
  if (!Array.isArray(raw) || raw.length > MAX_TRAITS_PER_MEMBER) {
    return `${where}: may have at most ${MAX_TRAITS_PER_MEMBER} traits`
  }
  const clean: string[] = []
  for (const entry of raw) {
    if (typeof entry !== 'string' || !isAssignableName(entry)) {
      return `${where}: unknown trait/occupation "${String(entry)}"`
    }
    if (clean.includes(entry)) return `${where}: "${entry}" is assigned twice`
    clean.push(entry)
  }
  return clean
}

/** migration helper: keep a legacy value if it's still one of the valid options, else fall back */
function pickOption<T extends string>(options: readonly T[], value: unknown, fallback: T): T {
  return typeof value === 'string' && (options as readonly string[]).includes(value) ? (value as T) : fallback
}

/**
 * migration helper: map a scenario approach's `skill` onto the current skill catalog.
 * Already-valid values pass through; the once-current might/charm/wit/cunning set (and the
 * retired 5-skill set before it — combat/intellect/diplomacy, plus the older `beauty`) maps
 * onto its nearest fit if that key still exists, else falls back to the catalog's first skill.
 */
function remapSkill(value: unknown): SkillKey {
  const keys = skillKeys()
  if (typeof value === 'string' && keys.includes(value)) return value
  const legacy: Record<string, SkillKey> = {
    combat: 'might',
    intellect: 'wit',
    diplomacy: 'charm',
    beauty: 'charm',
  }
  const mapped = typeof value === 'string' ? legacy[value] : undefined
  if (mapped && keys.includes(mapped)) return mapped
  return keys[0] ?? 'might'
}

function sanitizeAppearance(raw: unknown, where: string): MemberAppearance | string {
  const obj = (raw ?? {}) as Record<string, unknown>
  const skinColor = obj['skinColor']
  if (!APPEARANCE_SKIN_TONES.includes(skinColor as AppearanceSkinTone)) {
    return `${where}: unknown skin tone`
  }
  const hairColor = obj['hairColor']
  if (!APPEARANCE_HAIR_COLORS.includes(hairColor as AppearanceHairColor)) return `${where}: unknown hair colour`
  const head = obj['head']
  if (!APPEARANCE_HEAD_STYLES.includes(head as AppearanceHeadStyle)) return `${where}: unknown head style`
  const face = obj['face']
  if (!APPEARANCE_FACES.includes(face as AppearanceFace)) return `${where}: unknown face`
  const facialHair = obj['facialHair']
  if (!APPEARANCE_FACIAL_HAIR.includes(facialHair as AppearanceFacialHair)) return `${where}: unknown facial hair`
  const accessories = obj['accessories']
  if (!APPEARANCE_ACCESSORIES.includes(accessories as AppearanceAccessories)) return `${where}: unknown accessories`
  return {
    skinColor: skinColor as AppearanceSkinTone,
    hairColor: hairColor as AppearanceHairColor,
    head: head as AppearanceHeadStyle,
    face: face as AppearanceFace,
    facialHair: facialHair as AppearanceFacialHair,
    accessories: accessories as AppearanceAccessories,
  }
}

const SKILL_KEY_PATTERN = /^[a-z][a-z0-9_]{0,19}$/
const SKILL_DESCRIPTION_MAX_LENGTH = 300

function sanitizeSkillsList(raw: unknown): SkillDesign[] | string {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 20) {
    return 'There must be between 1 and 20 skills'
  }
  const clean: SkillDesign[] = []
  for (const [i, entry] of raw.entries()) {
    const where = `Skill ${i + 1}`
    const obj = (entry ?? {}) as Record<string, unknown>
    const key = cleanString(obj['key'], 20)
    if (!key || !SKILL_KEY_PATTERN.test(key)) {
      return `${where}: must be 1–20 lowercase letters/digits/underscores, starting with a letter`
    }
    if (clean.some((s) => s.key === key)) return `${where}: "${key}" is already used by another skill`
    clean.push({ key, description: cleanOptionalString(obj['description'], SKILL_DESCRIPTION_MAX_LENGTH) })
  }
  return clean
}

// older builds stored skills as plain key strings, or as { key, label, icon } objects
// (label/icon are dropped — the key doubled as the display name even then)
function migrateSkills(raw: unknown): unknown {
  if (!Array.isArray(raw)) return raw ?? DEFAULT_SKILLS
  return raw.map((s) => {
    if (typeof s === 'string') return { key: s, description: '' }
    if (s && typeof s === 'object' && 'key' in s) {
      const obj = s as Record<string, unknown>
      return { key: obj['key'], description: typeof obj['description'] === 'string' ? obj['description'] : '' }
    }
    return s
  })
}

/** the catalog's keys only — used everywhere a skill is validated/referenced by string */
function skillKeys(): SkillKey[] {
  return skills.map((s) => s.key)
}

function sanitizeTraitBonus(raw: unknown, where: string): TraitBonus | string {
  const obj = (raw ?? {}) as Record<string, unknown>
  const [min, max] = TRAIT_BONUS_BOUNDS
  const skill = obj['skill']
  if (!skillKeys().includes(skill as SkillKey)) return `${where}: unknown skill`
  const amount = obj['amount']
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return `${where}: amount must be a number`
  const rounded = Math.round(amount)
  if (rounded < min || rounded > max) return `${where}: amount must be ${min}–${max}`
  return { skill: skill as SkillKey, amount: rounded }
}

// shared by traits and occupations — both are just a name plus skill bonuses (see
// {@link OccupationDesign})
function sanitizeNamedBonuses(
  raw: unknown,
  kind: string,
  index: number,
  seenNames: Set<string>,
): TraitDesign | string {
  const obj = (raw ?? {}) as Record<string, unknown>
  const where = `${kind} ${index + 1}`
  const name = cleanString(obj['name'], 40)
  if (!name) return `${where}: name must be 1–40 characters`
  if (seenNames.has(name.toLowerCase())) return `${where}: "${name}" is already used by another ${kind.toLowerCase()}`
  seenNames.add(name.toLowerCase())
  const bonusesRaw = obj['bonuses']
  if (!Array.isArray(bonusesRaw) || bonusesRaw.length === 0) {
    return `${where}: needs at least one skill bonus`
  }
  const bonuses: TraitBonus[] = []
  const usedSkills = new Set<string>()
  for (const [i, bonus] of bonusesRaw.entries()) {
    const result = sanitizeTraitBonus(bonus, `${where}, bonus ${i + 1}`)
    if (typeof result === 'string') return result
    if (usedSkills.has(result.skill)) {
      return `${where}, bonus ${i + 1}: "${result.skill}" is already bonused by this ${kind.toLowerCase()}`
    }
    usedSkills.add(result.skill)
    bonuses.push(result)
  }
  return { name, bonuses }
}

function sanitizeNamedBonusList(raw: unknown, kind: string): TraitDesign[] | string {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 100) {
    return `There must be between 1 and 100 ${kind.toLowerCase()}s`
  }
  const clean: TraitDesign[] = []
  const seenNames = new Set<string>()
  for (const [i, entry] of raw.entries()) {
    const result = sanitizeNamedBonuses(entry, kind, i, seenNames)
    if (typeof result === 'string') return result
    clean.push(result)
  }
  return clean
}

function sanitizeTraitsList(raw: unknown): TraitDesign[] | string {
  return sanitizeNamedBonusList(raw, 'Trait')
}

function sanitizeOccupationsList(raw: unknown): OccupationDesign[] | string {
  return sanitizeNamedBonusList(raw, 'Occupation')
}

// no prior build ever persisted traits — nothing to upgrade, just seed defaults
function migrateTraits(raw: unknown): unknown {
  return raw ?? DEFAULT_TRAITS
}

// occupations are new — nothing to upgrade, just seed defaults
function migrateOccupations(raw: unknown): unknown {
  return raw ?? DEFAULT_OCCUPATIONS
}

function sanitizeMember(raw: unknown, houseLabel: string, index: number): MemberDesign | string {
  const obj = (raw ?? {}) as Record<string, unknown>
  const where = `${houseLabel}, character ${index + 1}`
  const name = cleanString(obj['name'], 30)
  if (!name) return `${where}: name must be 1–30 characters`
  const memberTraits = sanitizeMemberTraits(obj['traits'], where)
  if (typeof memberTraits === 'string') return memberTraits
  const appearance = sanitizeAppearance(obj['appearance'], where)
  if (typeof appearance === 'string') return appearance
  return { name, traits: memberTraits, appearance }
}

function sanitizeHouse(raw: unknown, index: number): HouseDesign | string {
  const obj = (raw ?? {}) as Record<string, unknown>
  const houseLabel = `House ${index + 1}`
  const name = cleanString(obj['name'], 40)
  if (!name) return `${houseLabel}: name must be 1–40 characters`
  const color = cleanString(obj['color'], 7)
  if (!color || !/^#[0-9a-fA-F]{6}$/.test(color)) {
    return `${houseLabel}: colour must be a hex value like #b03a3a`
  }
  const cityName = cleanString(obj['cityName'], 24)
  if (!cityName) return `${houseLabel}: city name must be 1–24 characters`
  const membersRaw = obj['members']
  if (!Array.isArray(membersRaw) || membersRaw.length !== MEMBERS_PER_HOUSE) {
    return `${houseLabel}: needs exactly ${MEMBERS_PER_HOUSE} characters`
  }
  const members: MemberDesign[] = []
  for (const [i, member] of membersRaw.entries()) {
    const result = sanitizeMember(member, houseLabel, i)
    if (typeof result === 'string') return result
    members.push(result)
  }
  return { name, color: color.toLowerCase(), cityName, members }
}

function sanitizeHousesList(raw: unknown): HouseDesign[] | string {
  if (!Array.isArray(raw) || raw.length !== CITY_SLOTS.length) {
    return `There must be exactly ${CITY_SLOTS.length} houses — one per city slot`
  }
  const clean: HouseDesign[] = []
  for (const [i, house] of raw.entries()) {
    const result = sanitizeHouse(house, i)
    if (typeof result === 'string') return result
    clean.push(result)
  }
  return clean
}

/** parses a reward/consequence tier value, or null if not one of the known tiers */
function parseTier(raw: unknown): RewardTier | null {
  return typeof raw === 'string' && (REWARD_TIERS as readonly string[]).includes(raw) ? (raw as RewardTier) : null
}

/** parses a buyout tier value (small/medium/large only — 'none' isn't a valid buyout), or null */
function parseGoldTier(raw: unknown): GoldTier | null {
  const tier = parseTier(raw)
  return tier && tier !== 'none' ? tier : null
}

/** an approach's difficulty, clamped to bounds; missing/invalid (e.g. a pre-difficulty
 *  save) defaults to 0 rather than erroring */
function sanitizeDifficulty(raw: unknown): number {
  const [min, max] = APPROACH_DIFFICULTY_BOUNDS
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 0
  return Math.min(max, Math.max(min, Math.round(raw)))
}

function sanitizeApproach(raw: unknown, scenarioLabel: string, index: number): ApproachDesign | string {
  const obj = (raw ?? {}) as Record<string, unknown>
  const where = `${scenarioLabel}, approach ${index + 1}`
  const label = cleanString(obj['label'], 60)
  if (!label) return `${where}: label must be 1–60 characters`
  const successMessage = cleanString(obj['successMessage'], 200)
  if (!successMessage) return `${where}: success message must be 1–200 characters`
  const failureMessage = cleanString(obj['failureMessage'], 200)
  if (!failureMessage) return `${where}: failure message must be 1–200 characters`
  const successInfluence = parseTier(obj['successInfluence'])
  if (!successInfluence) return `${where}: unknown success influence tier`
  const successGold = parseTier(obj['successGold'])
  if (!successGold) return `${where}: unknown success gold tier`
  const failureInfluence = parseTier(obj['failureInfluence'])
  if (!failureInfluence) return `${where}: unknown failure influence tier`
  const failureGold = parseTier(obj['failureGold'])
  if (!failureGold) return `${where}: unknown failure gold tier`
  const failureInjury = obj['failureInjury'] === true
  const difficulty = sanitizeDifficulty(obj['difficulty'])
  const tiers = { successInfluence, successGold, failureInfluence, failureGold, failureInjury }
  // a buyout approach stands alone — no skill behind it, just the flat buyout bonus
  if (obj['buyoutTier'] !== undefined) {
    const buyoutTier = parseGoldTier(obj['buyoutTier'])
    if (!buyoutTier) return `${where}: unknown buyout tier`
    return { label, successMessage, failureMessage, buyoutTier, difficulty, ...tiers }
  }
  const skill = obj['skill']
  if (!skillKeys().includes(skill as SkillKey)) return `${where}: unknown skill`
  return { label, skill: skill as SkillKey, successMessage, failureMessage, difficulty, ...tiers }
}

function sanitizeScenario(raw: unknown, index: number): ScenarioDesign | string {
  const obj = (raw ?? {}) as Record<string, unknown>
  const label = `Scenario ${index + 1}`
  const emoji = cleanString(obj['emoji'], 8)
  if (!emoji) return `${label}: emoji is required`
  const title = cleanString(obj['title'], 60)
  if (!title) return `${label}: title must be 1–60 characters`
  const description = cleanString(obj['description'], 240)
  if (!description) return `${label}: description must be 1–240 characters`
  const location = obj['location']
  if (!LOCATIONS.includes(location as ScenarioLocation)) return `${label}: unknown location`
  const preposition = PREPOSITIONS.includes(obj['preposition'] as LocationPreposition)
    ? (obj['preposition'] as LocationPreposition)
    : 'in'
  const approaches = obj['approaches']
  if (!Array.isArray(approaches) || approaches.length < 2 || approaches.length > 4) {
    return `${label}: needs 2–4 approaches`
  }
  const cleanApproaches: ApproachDesign[] = []
  for (const [i, approach] of approaches.entries()) {
    const result = sanitizeApproach(approach, label, i)
    if (typeof result === 'string') return result
    cleanApproaches.push(result)
  }
  return { emoji, title, description, preposition, approaches: cleanApproaches, location: location as ScenarioLocation }
}

function sanitizeScenariosList(raw: unknown): ScenarioDesign[] | string {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 100) {
    return 'There must be between 1 and 100 scenarios'
  }
  const clean: ScenarioDesign[] = []
  for (const [i, scenario] of raw.entries()) {
    const result = sanitizeScenario(scenario, i)
    if (typeof result === 'string') return result
    clean.push(result)
  }
  // the round generator always needs a capital scenario and a home scenario to draw
  if (!clean.some((s) => s.location === 'capital')) return 'At least one scenario must be capital-only'
  if (!clean.some((s) => s.location === 'home')) return 'At least one scenario must be a home-estate scenario'
  return clean
}

function sanitizeFaceOutcomes(raw: unknown): FaceOutcomeMap | string {
  const obj = (raw ?? {}) as Record<string, unknown>
  const clean: FaceOutcomeMap = {}
  for (const [key, value] of Object.entries(obj)) {
    if (!APPEARANCE_FACES.includes(key as AppearanceFace)) return `Face outcomes: unknown face "${key}"`
    const v = (value ?? {}) as Record<string, unknown>
    const entry: FaceOutcomeDesign = {}
    if (v['successFace'] !== undefined) {
      if (!APPEARANCE_FACES.includes(v['successFace'] as AppearanceFace)) {
        return `Face outcomes (${key}): unknown success face`
      }
      entry.successFace = v['successFace'] as AppearanceFace
    }
    if (v['failureFace'] !== undefined) {
      if (!APPEARANCE_FACES.includes(v['failureFace'] as AppearanceFace)) {
        return `Face outcomes (${key}): unknown failure face`
      }
      entry.failureFace = v['failureFace'] as AppearanceFace
    }
    clean[key as AppearanceFace] = entry
  }
  return clean
}

// generic fallback flavour text for approaches persisted before successMessage/failureMessage existed
const FALLBACK_SUCCESS_MESSAGE = 'The gambit pays off.'
const FALLBACK_FAILURE_MESSAGE = 'It comes to nothing.'

/** migration helper: keep a legacy message if it's still a valid string, else fall back */
function pickMessage(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 200
    ? value.trim()
    : fallback
}

/**
 * migration helper: upgrade a scenario's reward from the old mutually-exclusive
 * `{type: 'influence'}` / `{type: 'gold', amount}` shape to the once-current
 * `{influence, gold?}` shape, ahead of {@link tiersFromLegacyReward}. A gold-only legacy
 * reward must NOT gain a free influence grant it never had. Already-upgraded (or absent)
 * rewards pass through untouched.
 */
function migrateReward(raw: unknown): unknown {
  if (raw === undefined || raw === null) return raw
  const obj = raw as Record<string, unknown>
  if (obj['type'] === 'gold') return { influence: false, gold: obj['amount'] }
  if (obj['type'] === 'influence') return { influence: true }
  return raw
}

/**
 * migration helper: upgrade a scenario's single `reward` field to the once-current
 * `rewards` list (each approach used to name one by index via a `rewardIndex`), ahead of
 * {@link tiersFromLegacyReward}. A scenario already carrying a `rewards` array passes
 * through untouched.
 */
function migrateRewards(sc: Record<string, unknown>): unknown[] {
  const list = Array.isArray(sc['rewards'])
    ? sc['rewards']
    : sc['reward'] !== undefined
      ? [migrateReward(sc['reward'])]
      : []
  return list.length > 0 ? list : [{ influence: true }]
}

/** migration helper: bucket a legacy flat gold amount into the nearest new tier */
function tierFromGoldAmount(amount: unknown): RewardTier {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) return 'none'
  if (amount <= 30) return 'small'
  if (amount <= 65) return 'medium'
  return 'large'
}

/** migration helper: upgrade an approach's flat numeric `buyoutCost` to a `buyoutTier`,
 *  bucketed the same way as legacy reward gold. Already-tiered (or non-buyout) approaches
 *  pass through untouched. */
function migrateApproachBuyout(approach: Record<string, unknown>): Record<string, unknown> {
  if (typeof approach['buyoutTier'] === 'string') return approach
  if (typeof approach['buyoutCost'] !== 'number') return approach
  const { buyoutCost, ...rest } = approach
  const tier = tierFromGoldAmount(buyoutCost)
  return { ...rest, buyoutTier: tier === 'none' ? 'small' : tier }
}

/**
 * migration helper: derive an approach's success tiers from the scenario's old
 * `rewards`/`reward` (whichever this approach's legacy `rewardIndex` pointed at, default
 * 0). The old system granted a flat 1 Influence, so an `influence` grant maps to the
 * 'small' tier; it never had failure consequences, so those default to 'none'/no injury.
 */
function tiersFromLegacyReward(rewards: unknown[], rewardIndexRaw: unknown) {
  const idx = typeof rewardIndexRaw === 'number' ? rewardIndexRaw : 0
  const reward = ((rewards[idx] ?? rewards[0] ?? { influence: true }) ?? {}) as Record<string, unknown>
  return {
    successInfluence: (reward['influence'] !== false ? 'small' : 'none') as RewardTier,
    successGold: tierFromGoldAmount(reward['gold']),
    failureInfluence: 'none' as RewardTier,
    failureGold: 'none' as RewardTier,
    failureInjury: false,
  }
}

/**
 * Upgrade a persisted houses file written by an older build so design edits survive schema
 * changes: houses without a `members` array get that house's defaults, matched by slot
 * index (the randomly-rolled members they used to have are gone either way), and members
 * without an `appearance` — or one predating a later appearance field, or a skin/hair
 * colour that predates the curated preset lists — get that field backfilled from the same
 * generated defaults the stock roster uses, keyed off their house+member slot; fields
 * already valid are left alone. A member whose `traits` are missing, invalid, or don't
 * match the current trait/occupation catalogs (including a pre-traits file whose members
 * only ever had hand-set `skills`, which can't be sensibly mapped onto traits) resets to
 * that slot's fresh default rather than losing the appearance too.
 */
function migrateHouses(raw: unknown): unknown {
  if (!Array.isArray(raw)) return raw
  return raw.map((h, hi) => {
    const house = (h ?? {}) as Record<string, unknown>
    if (!Array.isArray(house['members'])) {
      return { ...house, members: DEFAULT_HOUSES[hi]?.members ?? DEFAULT_HOUSES[0]?.members }
    }
    const members = house['members'].map((m, mi) => {
      const member = (m ?? {}) as Record<string, unknown>
      const fallback = appearanceFor(hi * MEMBERS_PER_HOUSE + mi)
      const rawAppearance = (member['appearance'] ?? {}) as Record<string, unknown>
      const appearance: MemberAppearance = {
        skinColor: pickOption(APPEARANCE_SKIN_TONES, rawAppearance['skinColor'], fallback.skinColor),
        hairColor: pickOption(APPEARANCE_HAIR_COLORS, rawAppearance['hairColor'], fallback.hairColor),
        head: pickOption(APPEARANCE_HEAD_STYLES, rawAppearance['head'], fallback.head),
        face: pickOption(APPEARANCE_FACES, rawAppearance['face'], fallback.face),
        facialHair: pickOption(APPEARANCE_FACIAL_HAIR, rawAppearance['facialHair'], fallback.facialHair),
        accessories: pickOption(APPEARANCE_ACCESSORIES, rawAppearance['accessories'], fallback.accessories),
      }
      const rawTraits = member['traits']
      const hasValidTraits =
        Array.isArray(rawTraits) &&
        rawTraits.length <= MAX_TRAITS_PER_MEMBER &&
        rawTraits.every((f) => typeof f === 'string' && isAssignableName(f))
      const defaultTraits =
        DEFAULT_HOUSES[hi]?.members[mi]?.traits ?? DEFAULT_HOUSES[0]?.members[0]?.traits ?? []
      const memberTraits = hasValidTraits ? (rawTraits as string[]) : defaultTraits
      return { ...member, traits: memberTraits, appearance }
    })
    return { ...house, members }
  })
}

/**
 * Upgrade a persisted scenarios file written by an older build so design edits (titles,
 * descriptions, …) survive schema changes. Currently handles the pre-approach format
 * (scenarios with a single `skill` — and the old `beauty` skill — become two
 * generically-labelled approaches that keep the original text), the pre-approach-message
 * format (approaches without a `successMessage`/`failureMessage` get generic fallback
 * text), the pre-reward-tier format (a scenario-level `rewards`/`reward` list, named per
 * approach by `rewardIndex`, becomes per-approach success/failure Influence+gold tiers plus
 * an injury flag — see {@link tiersFromLegacyReward}; approaches already carrying valid
 * tiers pass through untouched), and the pre-buyout-tier format (an approach's flat numeric
 * `buyoutCost` becomes a `buyoutTier`, bucketed via {@link migrateApproachBuyout}).
 */
function migrateScenarios(raw: unknown): unknown {
  if (!Array.isArray(raw)) return raw
  return raw.map((s) => {
    const sc = (s ?? {}) as Record<string, unknown>
    if (!Array.isArray(sc['approaches'])) {
      if (sc['skill'] === undefined) return sc
      const skill = remapSkill(sc['skill'])
      const tiers = tiersFromLegacyReward(migrateRewards(sc), undefined)
      return {
        emoji: sc['emoji'],
        title: sc['title'],
        description: sc['description'],
        location: sc['location'],
        approaches: [
          { label: 'See it done', skill, successMessage: FALLBACK_SUCCESS_MESSAGE, failureMessage: FALLBACK_FAILURE_MESSAGE, ...tiers },
          { label: 'Find another way', skill: skill === 'cunning' ? 'charm' : 'cunning', successMessage: FALLBACK_SUCCESS_MESSAGE, failureMessage: FALLBACK_FAILURE_MESSAGE, ...tiers },
        ],
      }
    }
    // scenarios already in the approach-array shape may still carry retired skill
    // keys (the game moved from 5 skills to 4) — remap each approach in place, backfill
    // any approach persisted before the success/failure message fields existed, and
    // derive reward/consequence tiers for any approach that predates them
    const legacyRewards = migrateRewards(sc)
    return {
      ...sc,
      rewards: undefined,
      approaches: sc['approaches'].map((a) => {
        const approach = migrateApproachBuyout((a ?? {}) as Record<string, unknown>)
        // a buyout approach (persisted with a buyoutTier) has no skill to remap — the
        // old {approachIndex, boughtOut} choice shape used to bolt a buyout onto a
        // skill approach, but a buyout approach now stands alone
        const hasBuyout = typeof approach['buyoutTier'] === 'string'
        const alreadyTiered = (REWARD_TIERS as readonly string[]).includes(approach['successInfluence'] as string)
        return {
          ...approach,
          ...(hasBuyout ? { skill: undefined } : { skill: remapSkill(approach['skill']) }),
          successMessage: pickMessage(approach['successMessage'], FALLBACK_SUCCESS_MESSAGE),
          failureMessage: pickMessage(approach['failureMessage'], FALLBACK_FAILURE_MESSAGE),
          ...(alreadyTiered ? {} : tiersFromLegacyReward(legacyRewards, approach['rewardIndex'])),
        }
      }),
    }
  })
}

function migrateFaceOutcomes(raw: unknown): unknown {
  return raw ?? DEFAULT_FACE_OUTCOMES
}

/**
 * Load one section's persisted file, running it through migration + validation. A missing
 * file falls back to the legacy combined content file's `legacyKey` slice (so upgrading to
 * split files doesn't lose pre-split designs), then to `defaults` if that's absent too. A
 * file (or legacy slice) that's present but invalid even after migration is never silently
 * discarded — it's backed up before falling back to defaults.
 */
function loadSection<T>(
  file: string,
  legacyKey: string,
  migrate: (raw: unknown) => unknown,
  sanitize: (raw: unknown) => T | string,
  defaults: T,
): T {
  let raw: unknown
  let seeded = false
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    const legacy = legacyContent()
    if (!legacy || !(legacyKey in legacy)) return structuredClone(defaults)
    raw = legacy[legacyKey]
    seeded = true
  }
  let failure: string
  try {
    const parsed = sanitize(migrate(raw))
    if (typeof parsed !== 'string') {
      // persist a successful migration (or a first split-out from the legacy file) so the
      // upgraded designs are the file from now on
      if (seeded || JSON.stringify(parsed) !== JSON.stringify(raw)) {
        try {
          writeFileSync(file, JSON.stringify(parsed, null, 2) + '\n')
        } catch (err) {
          console.error(`failed to persist ${file}:`, err)
        }
      }
      return parsed
    }
    failure = parsed
  } catch (err) {
    failure = `not valid JSON: ${String(err)}`
  }
  if (seeded) {
    console.error(`legacy ${LEGACY_CONTENT_FILE} "${legacyKey}" section is invalid (${failure}); using defaults`)
    return structuredClone(defaults)
  }
  const backup = `${file}.invalid-${new Date().toISOString().replace(/[:.]/g, '-')}`
  try {
    copyFileSync(file, backup)
    console.error(`${file} is invalid (${failure}); backed up to ${backup}, using defaults`)
  } catch (err) {
    console.error(`${file} is invalid (${failure}) and could not be backed up:`, err)
  }
  return structuredClone(defaults)
}

// skills load first — sanitizing traits/occupations/houses/scenarios validates their skill
// references against the current catalog, so it must already be in memory. traits and
// occupations load next, in either order relative to each other — houses validates each
// member's assigned slots against both catalogs combined, so both must be loaded first.
let skills: SkillDesign[] = loadSection(SKILLS_FILE, 'skills', migrateSkills, sanitizeSkillsList, DEFAULT_SKILLS)
let traits: TraitDesign[] = loadSection(
  TRAITS_FILE,
  'traits',
  migrateTraits,
  sanitizeTraitsList,
  DEFAULT_TRAITS,
)
let occupations: OccupationDesign[] = loadSection(
  OCCUPATIONS_FILE,
  'occupations',
  migrateOccupations,
  sanitizeOccupationsList,
  DEFAULT_OCCUPATIONS,
)
let houses: HouseDesign[] = loadSection(HOUSES_FILE, 'houses', migrateHouses, sanitizeHousesList, DEFAULT_HOUSES)
let scenarios: ScenarioDesign[] = loadSection(
  SCENARIOS_FILE,
  'scenarios',
  migrateScenarios,
  sanitizeScenariosList,
  DEFAULT_SCENARIOS,
)
let faceOutcomes: FaceOutcomeMap = loadSection(
  FACES_FILE,
  'faceOutcomes',
  migrateFaceOutcomes,
  sanitizeFaceOutcomes,
  DEFAULT_FACE_OUTCOMES,
)

export function getSkills(): SkillDesign[] {
  return skills
}

export function updateSkills(raw: unknown): SkillDesign[] | string {
  const next = sanitizeSkillsList(raw)
  if (typeof next === 'string') return next
  skills = next
  try {
    writeFileSync(SKILLS_FILE, JSON.stringify(skills, null, 2) + '\n')
  } catch (err) {
    console.error('failed to persist skills:', err)
  }
  return skills
}

export function getTraits(): TraitDesign[] {
  return traits
}

export function updateTraits(raw: unknown): TraitDesign[] | string {
  const next = sanitizeTraitsList(raw)
  if (typeof next === 'string') return next
  traits = next
  try {
    writeFileSync(TRAITS_FILE, JSON.stringify(traits, null, 2) + '\n')
  } catch (err) {
    console.error('failed to persist traits:', err)
  }
  return traits
}

export function getOccupations(): OccupationDesign[] {
  return occupations
}

export function updateOccupations(raw: unknown): OccupationDesign[] | string {
  const next = sanitizeOccupationsList(raw)
  if (typeof next === 'string') return next
  occupations = next
  try {
    writeFileSync(OCCUPATIONS_FILE, JSON.stringify(occupations, null, 2) + '\n')
  } catch (err) {
    console.error('failed to persist occupations:', err)
  }
  return occupations
}

export function getHouses(): HouseDesign[] {
  return houses
}

export function updateHouses(raw: unknown): HouseDesign[] | string {
  const next = sanitizeHousesList(raw)
  if (typeof next === 'string') return next
  houses = next
  try {
    writeFileSync(HOUSES_FILE, JSON.stringify(houses, null, 2) + '\n')
  } catch (err) {
    console.error('failed to persist houses:', err)
  }
  return houses
}

export function getScenarios(): ScenarioDesign[] {
  return scenarios
}

export function updateScenarios(raw: unknown): ScenarioDesign[] | string {
  const next = sanitizeScenariosList(raw)
  if (typeof next === 'string') return next
  scenarios = next
  try {
    writeFileSync(SCENARIOS_FILE, JSON.stringify(scenarios, null, 2) + '\n')
  } catch (err) {
    console.error('failed to persist scenarios:', err)
  }
  return scenarios
}

export function getFaceOutcomes(): FaceOutcomeMap {
  return faceOutcomes
}

export function updateFaceOutcomes(raw: unknown): FaceOutcomeMap | string {
  const next = sanitizeFaceOutcomes(raw)
  if (typeof next === 'string') return next
  faceOutcomes = next
  try {
    writeFileSync(FACES_FILE, JSON.stringify(faceOutcomes, null, 2) + '\n')
  } catch (err) {
    console.error('failed to persist face outcomes:', err)
  }
  return faceOutcomes
}

/** composes the six independently-persisted sections; used by room/round setup */
export function getContent(): GameContent {
  return {
    skills: getSkills(),
    traits: getTraits(),
    occupations: getOccupations(),
    houses: getHouses(),
    scenarios: getScenarios(),
    faceOutcomes: getFaceOutcomes(),
  }
}

// ----- runtime structures derived from the designs -----

export interface FamilyPreset {
  name: string
  color: string
  homeTownId: string
  /** the house's fixed character roster, snapshotted at room:create */
  members: MemberDesign[]
}

/** The map for a new room: fixed slot geometry + the designed city names. */
export function buildTowns(from: GameContent): Town[] {
  return [
    {
      id: CAPITAL_SLOT.id,
      name: CAPITAL_NAME,
      x: CAPITAL_SLOT.x,
      y: CAPITAL_SLOT.y,
      kind: 'capital',
      color: CAPITAL_COLOR,
    },
    ...CITY_SLOTS.map((slot, i) => ({
      id: slot.id,
      name: from.houses[i]?.cityName ?? `City ${i + 1}`,
      x: slot.x,
      y: slot.y,
      kind: 'city' as const,
      ...(from.houses[i]?.color ? { color: from.houses[i]!.color } : {}),
    })),
    ...WILD_SLOTS.map((slot) => ({
      id: slot.id,
      name: slot.name,
      x: slot.x,
      y: slot.y,
      kind: 'wild' as const,
    })),
  ]
}

/** The claimable houses for a new room, in join order (house i lives in city slot i). */
export function buildPresets(from: GameContent): FamilyPreset[] {
  return from.houses.map((house, i) => ({
    name: house.name,
    color: house.color,
    homeTownId: CITY_SLOTS[i]?.id ?? `city-${i + 1}`,
    members: house.members,
  }))
}
