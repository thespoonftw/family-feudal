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
  GameContent,
  GoldTier,
  HouseDesign,
  MemberAppearance,
  MemberDesign,
  RewardTier,
  ScenarioDesign,
  ScenarioLocation,
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
  MEMBER_SKILL_BOUNDS,
  MEMBERS_PER_HOUSE,
  REWARD_TIERS,
  SKILLS,
} from '@family-feudal/shared'
import {
  appearanceFor,
  CAPITAL_NAME,
  CAPITAL_SLOT,
  CITY_SLOTS,
  DEFAULT_HOUSES,
  DEFAULT_SCENARIOS,
} from './data.js'

// every face defaults to a downcast "concerned" look on a failed check, matching the
// game's original hardcoded behaviour; success keeps whichever face the character already has
const DEFAULT_FACE_OUTCOMES: FaceOutcomeMap = Object.fromEntries(
  APPEARANCE_FACES.map((face) => [face, { failureFace: 'concerned' }]),
) as FaceOutcomeMap

export const DEFAULT_CONTENT: GameContent = {
  houses: DEFAULT_HOUSES,
  scenarios: DEFAULT_SCENARIOS,
  faceOutcomes: DEFAULT_FACE_OUTCOMES,
}

// Persisted so designs survive restarts/deploys. Resolved against the server process
// cwd (packages/server under the systemd unit); override with CONTENT_FILE.
const CONTENT_FILE = process.env['CONTENT_FILE'] ?? 'game-content.json'

const LOCATIONS: ScenarioLocation[] = ['general', 'capital', 'home']

function cleanString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > maxLength) return null
  return trimmed
}

function sanitizeMemberSkills(raw: unknown, where: string): Record<SkillKey, number> | string {
  const obj = (raw ?? {}) as Record<string, unknown>
  const [min, max] = MEMBER_SKILL_BOUNDS
  const skills = {} as Record<SkillKey, number>
  for (const skill of SKILLS) {
    const value = obj[skill]
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return `${where}: ${skill} skill must be a number`
    }
    const rounded = Math.round(value)
    if (rounded < min || rounded > max) return `${where}: ${skill} skill must be ${min}–${max}`
    skills[skill] = rounded
  }
  return skills
}

/** migration helper: keep a legacy value if it's still one of the valid options, else fall back */
function pickOption<T extends string>(options: readonly T[], value: unknown, fallback: T): T {
  return typeof value === 'string' && (options as readonly string[]).includes(value) ? (value as T) : fallback
}

/**
 * migration helper: map a scenario approach's `skill` onto the current 4-skill roster
 * (might/charm/wit/cunning). Already-valid values pass through; the retired 5-skill set
 * (combat/intellect/diplomacy, plus the older `beauty`) maps onto its nearest fit.
 */
function remapSkill(value: unknown): SkillKey {
  if (typeof value === 'string' && (SKILLS as readonly string[]).includes(value)) return value as SkillKey
  switch (value) {
    case 'combat':
      return 'might'
    case 'intellect':
      return 'wit'
    case 'diplomacy':
      return 'charm'
    case 'beauty':
      return 'charm'
    default:
      return 'cunning'
  }
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

function sanitizeMember(raw: unknown, houseLabel: string, index: number): MemberDesign | string {
  const obj = (raw ?? {}) as Record<string, unknown>
  const where = `${houseLabel}, character ${index + 1}`
  const name = cleanString(obj['name'], 30)
  if (!name) return `${where}: name must be 1–30 characters`
  const skills = sanitizeMemberSkills(obj['skills'], where)
  if (typeof skills === 'string') return skills
  const appearance = sanitizeAppearance(obj['appearance'], where)
  if (typeof appearance === 'string') return appearance
  return { name, skills, appearance }
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

/** parses a reward/consequence tier value, or null if not one of the known tiers */
function parseTier(raw: unknown): RewardTier | null {
  return typeof raw === 'string' && (REWARD_TIERS as readonly string[]).includes(raw) ? (raw as RewardTier) : null
}

/** parses a buyout tier value (small/medium/large only — 'none' isn't a valid buyout), or null */
function parseGoldTier(raw: unknown): GoldTier | null {
  const tier = parseTier(raw)
  return tier && tier !== 'none' ? tier : null
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
  const tiers = { successInfluence, successGold, failureInfluence, failureGold, failureInjury }
  // a buyout approach stands alone — no skill behind it, just the flat buyout bonus
  if (obj['buyoutTier'] !== undefined) {
    const buyoutTier = parseGoldTier(obj['buyoutTier'])
    if (!buyoutTier) return `${where}: unknown buyout tier`
    return { label, successMessage, failureMessage, buyoutTier, ...tiers }
  }
  const skill = obj['skill']
  if (!SKILLS.includes(skill as SkillKey)) return `${where}: unknown skill`
  // a legacy per-approach `difficulty` is simply ignored (checks now roll against the DC)
  return { label, skill: skill as SkillKey, successMessage, failureMessage, ...tiers }
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
  return { emoji, title, description, approaches: cleanApproaches, location: location as ScenarioLocation }
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

/** Validate raw (client or file) content. Returns the cleaned content or an error message. */
function sanitizeContent(raw: unknown): GameContent | string {
  const obj = (raw ?? {}) as Record<string, unknown>
  const houses = obj['houses']
  if (!Array.isArray(houses) || houses.length !== CITY_SLOTS.length) {
    return `There must be exactly ${CITY_SLOTS.length} houses — one per city slot`
  }
  const scenarios = obj['scenarios']
  if (!Array.isArray(scenarios) || scenarios.length === 0 || scenarios.length > 100) {
    return 'There must be between 1 and 100 scenarios'
  }
  const cleanHouses: HouseDesign[] = []
  for (const [i, house] of houses.entries()) {
    const result = sanitizeHouse(house, i)
    if (typeof result === 'string') return result
    cleanHouses.push(result)
  }
  const cleanScenarios: ScenarioDesign[] = []
  for (const [i, scenario] of scenarios.entries()) {
    const result = sanitizeScenario(scenario, i)
    if (typeof result === 'string') return result
    cleanScenarios.push(result)
  }
  // the round generator always needs a capital scenario and a home scenario to draw
  if (!cleanScenarios.some((s) => s.location === 'capital')) {
    return 'At least one scenario must be capital-only'
  }
  if (!cleanScenarios.some((s) => s.location === 'home')) {
    return 'At least one scenario must be a home-estate scenario'
  }
  const faceOutcomes = sanitizeFaceOutcomes(obj['faceOutcomes'])
  if (typeof faceOutcomes === 'string') return faceOutcomes
  return { houses: cleanHouses, scenarios: cleanScenarios, faceOutcomes }
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
 * Upgrade a persisted content file written by an older build so design edits (titles,
 * descriptions, …) survive schema changes. Currently handles the pre-approach format
 * (scenarios with a single `skill` — and the old `beauty` skill — become two
 * generically-labelled approaches that keep the original text), the pre-approach-message
 * format (approaches without a `successMessage`/`failureMessage` get generic fallback
 * text), the pre-fixed-roster format (houses without a `members` array get that house's
 * defaults, matched by slot index — the randomly-rolled members they used to have are
 * gone either way), and the pre-portrait format (members without an `appearance`, or with
 * one predating a later appearance field such as eye/mouth/shirt style — or a skin/eye
 * colour that predates the curated preset lists — get that field backfilled from the same
 * generated defaults the stock roster uses, keyed off their house+member slot; fields
 * already valid are left alone), the pre-face-outcomes format (missing
 * `faceOutcomes` gets the default map), and the pre-reward-tier format (a scenario-level
 * `rewards`/`reward` list, named per approach by `rewardIndex`, becomes per-approach
 * success/failure Influence+gold tiers plus an injury flag — see
 * {@link tiersFromLegacyReward}; approaches already carrying valid tiers pass through
 * untouched), and the pre-buyout-tier format (an approach's flat numeric `buyoutCost`
 * becomes a `buyoutTier`, bucketed via {@link migrateApproachBuyout}).
 */
function migrateContent(raw: unknown): unknown {
  const obj = raw as Record<string, unknown> | null
  if (!obj || !Array.isArray(obj['scenarios'])) return raw
  const scenarios = obj['scenarios'].map((s) => {
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
  const houses = Array.isArray(obj['houses'])
    ? obj['houses'].map((h, hi) => {
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
          // the game moved from 5 skills to 4 (might/charm/wit/cunning) — a persisted
          // member whose skills object doesn't match the new roster can't be sensibly
          // remapped (unlike a scenario approach's single skill), so it resets to that
          // slot's fresh default rather than failing validation and losing the appearance too
          const rawSkills = (member['skills'] ?? {}) as Record<string, unknown>
          const hasValidSkills = SKILLS.every(
            (skill) => typeof rawSkills[skill] === 'number' && Number.isFinite(rawSkills[skill]),
          )
          const defaultSkills =
            DEFAULT_HOUSES[hi]?.members[mi]?.skills ?? DEFAULT_HOUSES[0]?.members[0]?.skills
          const skills = hasValidSkills ? (rawSkills as Record<SkillKey, number>) : defaultSkills
          return { ...member, skills, appearance }
        })
        return { ...house, members }
      })
    : obj['houses']
  const faceOutcomes = obj['faceOutcomes'] ?? DEFAULT_FACE_OUTCOMES
  return { ...obj, houses, scenarios, faceOutcomes }
}

function loadContent(): GameContent {
  let text: string
  try {
    text = readFileSync(CONTENT_FILE, 'utf8')
  } catch {
    // no file yet → defaults
    return structuredClone(DEFAULT_CONTENT)
  }
  let failure: string
  try {
    const raw: unknown = JSON.parse(text)
    const parsed = sanitizeContent(migrateContent(raw))
    if (typeof parsed !== 'string') {
      // persist a successful migration so the upgraded designs are the file from now on
      if (JSON.stringify(parsed) !== JSON.stringify(raw)) {
        try {
          writeFileSync(CONTENT_FILE, JSON.stringify(parsed, null, 2) + '\n')
        } catch (err) {
          console.error('failed to persist migrated game content:', err)
        }
      }
      return parsed
    }
    failure = parsed
  } catch (err) {
    failure = `not valid JSON: ${String(err)}`
  }
  // invalid even after migration: never silently destroy designs — keep a backup
  const backup = `${CONTENT_FILE}.invalid-${new Date().toISOString().replace(/[:.]/g, '-')}`
  try {
    copyFileSync(CONTENT_FILE, backup)
    console.error(`game content file is invalid (${failure}); backed up to ${backup}, using defaults`)
  } catch (err) {
    console.error(`game content file is invalid (${failure}) and could not be backed up:`, err)
  }
  return structuredClone(DEFAULT_CONTENT)
}

function persistContent(): void {
  try {
    writeFileSync(CONTENT_FILE, JSON.stringify(content, null, 2) + '\n')
  } catch (err) {
    console.error('failed to persist game content:', err)
  }
}

let content: GameContent = loadContent()

export function getContent(): GameContent {
  return content
}

/** Replace the designs wholesale. Returns the new content, or an error message. */
export function updateContent(raw: unknown): GameContent | string {
  const next = sanitizeContent(raw)
  if (typeof next === 'string') return next
  content = next
  persistContent()
  return content
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
    { id: CAPITAL_SLOT.id, name: CAPITAL_NAME, x: CAPITAL_SLOT.x, y: CAPITAL_SLOT.y, isCapital: true },
    ...CITY_SLOTS.map((slot, i) => ({
      id: slot.id,
      name: from.houses[i]?.cityName ?? `City ${i + 1}`,
      x: slot.x,
      y: slot.y,
      isCapital: false,
      ...(from.houses[i]?.color ? { color: from.houses[i]!.color } : {}),
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
