// ---------- Core game types ----------

/** a skill's catalog key. Validated dynamically against the designable skill catalog
 *  (content.ts), not a fixed literal union. */
export type SkillKey = string

/** a catalog skill: its stable key plus a free-text description of what it covers —
 *  shown only in the dev panel, to help a designer (human or AI) write traits/scenario
 *  approaches that test the right skill. Never shown to players. */
export interface SkillDesign {
  key: SkillKey
  description: string
}

export interface FamilyMember {
  id: string
  name: string
  skills: Record<SkillKey, number>
  /** names of assigned TraitDesigns — shown to players instead of the numeric skills they grant */
  traits: string[]
  appearance: MemberAppearance
}

export interface Family {
  id: string
  /** id of the player controlling this family */
  playerId: string
  name: string
  /** hex colour, e.g. "#b03a2e" */
  color: string
  homeTownId: string
  members: FamilyMember[]
  /** sum of `reputation` across every location — the win condition */
  influence: number
  /** standing with each location (townId, including the capital), 0-100. Raised by
   *  winning a scenario there, lowered by ignoring an active scenario there */
  reputation: Record<string, number>
  /** spendable gold, earned from gold-reward scenarios and spent buying out approach rolls */
  gold: number
}

// ---------- Gold ----------

/** gold amounts are always multiples of this */
export const GOLD_STEP = 10

// ---------- Reward/consequence tiers ----------

/** a coarse tier picked per approach for its success reward or failure consequence */
export const REWARD_TIERS = ['none', 'small', 'medium', 'large'] as const
export type RewardTier = (typeof REWARD_TIERS)[number]

/** a gold-bearing tier — same as RewardTier but excludes 'none', used for buyout costs */
export type GoldTier = Exclude<RewardTier, 'none'>
export const GOLD_TIERS: readonly GoldTier[] = ['small', 'medium', 'large']

export const REWARD_TIER_LABELS: Record<RewardTier, string> = {
  none: 'None',
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
}

/** reputation granted, with the scenario's location, for winning at that tier */
export const INFLUENCE_TIER_VALUES: Record<RewardTier, number> = {
  none: 0,
  small: 10,
  medium: 15,
  large: 20,
}

// ---------- Reputation ----------

/** each family's standing with a location is clamped to this range */
export const REPUTATION_BOUNDS: [number, number] = [0, 100]

/** a non-capital location's starting reputation is rolled once per room from this set,
 *  shared by every family so nobody starts favoured or disfavoured there */
export const STARTING_REPUTATION_VALUES = [40, 45, 50, 55, 60] as const

/** the capital's starting reputation is fixed, not rolled */
export const CAPITAL_STARTING_REPUTATION = 50

/** the 0-100 reputation range split into 7 equal-width named stages, low to high —
 *  shown to players instead of the raw number */
export const REPUTATION_STAGES = [
  'Hatred',
  'Loathing',
  'Dislike',
  'Neutral',
  'Friendly',
  'Fondness',
  'Reverence',
] as const

/** maps a 0-100 reputation value to its named stage */
export function reputationStage(value: number): (typeof REPUTATION_STAGES)[number] {
  const [min, max] = REPUTATION_BOUNDS
  const width = (max - min) / REPUTATION_STAGES.length
  const index = Math.min(REPUTATION_STAGES.length - 1, Math.floor((value - min) / width))
  return REPUTATION_STAGES[Math.max(0, index)] as (typeof REPUTATION_STAGES)[number]
}

/** derives each gold tier's inclusive roll bounds from the dev-configurable ranges */
export function goldTierBounds(config: GameConfig): Record<GoldTier, [number, number]> {
  return {
    small: [config.goldSmallMin, config.goldSmallMax],
    medium: [config.goldMediumMin, config.goldMediumMax],
    large: [config.goldLargeMin, config.goldLargeMax],
  }
}

export interface Town {
  id: string
  name: string
  /** map coordinates, 0–100 in both axes */
  x: number
  y: number
  isCapital: boolean
  /** hex colour of the house whose home city this is — absent for the capital */
  color?: string
}

/** one way of tackling a scenario — the label is public, the skill behind it is not.
 *  Either `skill` is set (a normal roll) or `buyoutCost` is set (a standalone approach
 *  that pays gold for a flat bonus instead of a skill roll) — never both. `buyoutCost`
 *  here is the actual gold amount, rolled once from the design's buyout tier when the
 *  scenario is instantiated for a round. */
export interface ScenarioApproach {
  /** short verb phrase shown to players when choosing, e.g. "Storm the gates" */
  label: string
  skill?: SkillKey
  /** how hard this approach's check is; P(success) = 1 / (1 + 2^(difficulty - skill)),
   *  so a skill total equal to difficulty is even odds. Defaults to 0 when unset. */
  difficulty?: number
  /** flavour text shown on the results screen when this approach succeeds. {actor} is replaced with the attending member's name */
  successMessage: string
  /** flavour text shown on the results screen when this approach fails the check. {actor} is replaced with the attending member's name */
  failureMessage: string
  /** if set, this approach pays gold for a flat bonus instead of rolling a skill */
  buyoutCost?: number
  /** Influence tier granted to the winner(s) of this approach on success */
  successInfluence: RewardTier
  /** gold tier granted to the winner(s) of this approach on success (rolled within the tier's band) */
  successGold: RewardTier
  /** Influence tier lost by a family whose check on this approach fails */
  failureInfluence: RewardTier
  /** gold tier lost by a family whose check on this approach fails (rolled within the tier's band) */
  failureGold: RewardTier
  /** whether failing this approach's check also injures the attending member — stored only, no effect yet */
  failureInjury: boolean
}

export interface Scenario {
  id: string
  /** flavour emoji shown on the map — deliberately does not hint at the skills */
  emoji: string
  title: string
  description: string
  townId: string
  /** 2–3 ways to tackle it; players pick one in the approach phase */
  approaches: ScenarioApproach[]
  /** set when this is a home scenario belonging to one family */
  homeFamilyId?: string
}

export interface Player {
  id: string
  name: string
  /** the VIP — first player to join (display only; rounds advance when everyone confirms) */
  isHost: boolean
  connected: boolean
  ready: boolean
}

/** memberId -> scenarioId (members absent from the map stay idle at home) */
export type Assignments = Record<string, string>

/** scenarioId -> chosen approach index (unchosen assignments default to approach 0) */
export type ApproachChoices = Record<string, number>

export interface ScenarioOutcome {
  scenarioId: string
  familyId: string
  memberIds: string[]
  /** which of the scenario's approaches the family took */
  approachIndex: number
  /** true if gold was paid to skip the skill roll (skillTotal is the buyout bonus, not a skill sum) */
  boughtOut: boolean
  skillTotal: number
  /** P(success) for this check — 1 / (1 + 2^(difficulty - skillTotal)) — shown on the results screen */
  chance: number
  /** whether the check passed — but a rival with a higher skillTotal can still take the prize */
  success: boolean
  /** reputation gained with the scenario's location — positive for the highest successful
   *  total(s) at the scenario (the approach's success tier); 0 otherwise, whether the
   *  check failed outright or merely passed while being outdone by a rival */
  influenceGained: number
  /** gold gained/lost alongside influenceGained, same sign convention */
  goldGained: number
  /** true if the check failed outright and the chosen approach's failure tier flags an injury */
  injured: boolean
}

export interface RoundResult {
  round: number
  outcomes: ScenarioOutcome[]
}

export type GamePhase = 'lobby' | 'planning' | 'approach' | 'resolution' | 'finished'

/** Personalised snapshot sent to each client. */
export interface GameView {
  code: string
  phase: GamePhase
  round: number
  totalRounds: number
  players: Player[]
  families: Family[]
  towns: Town[]
  scenarios: Scenario[]
  /** your own player id (null on the host board screen, which is not a player) */
  playerId: string | null
  /** your own assignments during planning (others' are hidden until resolution) */
  yourAssignments: Assignments
  /** your own approach choices during the approach phase */
  yourChoices: ApproachChoices
  /** all assignments — only populated during resolution/finished */
  revealedAssignments: Record<string, Assignments> | null
  /** results of the round just resolved (resolution phase) */
  lastResult: RoundResult | null
  /** full history, populated when finished */
  resultHistory: RoundResult[]
  winnerFamilyIds: string[] | null
  /** per-face success/failure portrait overrides, for the resolution screen */
  faceOutcomes: FaceOutcomeMap
  /** the current skill catalog (keys members are scored on), read live same as faceOutcomes */
  skills: SkillKey[]
  /** flat total used instead of a skill roll when a family buys out an approach */
  buyoutBonus: number
  /** deadline for the current timed phase (planning/approach/resolution), epoch ms; null otherwise */
  phaseEndsAt: number | null
  /** start of the current timed phase, epoch ms; null otherwise — lets a refresh resume the countdown bar mid-way instead of restarting it */
  phaseStartedAt: number | null
}

// ---------- Global game configuration (dev panel) ----------

/** Tunable parameters applied to games created after the change. */
export interface GameConfig {
  /** rounds per game */
  totalRounds: number
  /** public scenarios per round (one is always at the capital; every family also gets a home scenario) */
  scenariosPerRound: number
  /** maximum players per room */
  maxPlayers: number
  /** flat total used instead of a skill roll when a family pays to buy out an approach */
  buyoutBonus: number
  /** gold every family starts the game with */
  startingGold: number
  /** inclusive gold range rolled for a Small tier (rewards, consequences, and buyouts) */
  goldSmallMin: number
  goldSmallMax: number
  /** inclusive gold range rolled for a Medium tier */
  goldMediumMin: number
  goldMediumMax: number
  /** inclusive gold range rolled for a Large tier */
  goldLargeMin: number
  goldLargeMax: number
  /** seconds allowed for the planning (dispatch) phase before it auto-advances */
  planningSeconds: number
  /** seconds allowed for the approach (decision) phase before it auto-advances */
  approachSeconds: number
  /** seconds the results screen holds after the reveal finishes, before it auto-advances */
  resultsSeconds: number
  /** reputation lost at a location a family had access to this round but sent nobody to */
  locationNoShowPenalty: number
}

// ---------- Editable game content (dev panel) ----------

/** where a scenario design may appear on the map */
export type ScenarioLocation = 'general' | 'capital' | 'home'

export const SCENARIO_LOCATION_LABELS: Record<ScenarioLocation, string> = {
  general: 'Any city',
  capital: 'Capital only',
  home: 'Home estate',
}

/** number of fixed characters every house has */
export const MEMBERS_PER_HOUSE = 3

// ---------- Portrait appearance (DiceBear "open-peeps" style traits) ----------

/** curated preset skin tones (hex without '#') — not the full DiceBear colour space */
export const APPEARANCE_SKIN_TONES = ['f2d3b1', 'e8b98c', 'c68642', '965a2f', '5c3a21'] as const
export type AppearanceSkinTone = (typeof APPEARANCE_SKIN_TONES)[number]

/** curated preset hair colours (hex without '#') — also tints hats/headwear and facial hair */
export const APPEARANCE_HAIR_COLORS = [
  '2c1b18',
  '4a2c14',
  '6b4423',
  'ad8a56',
  'e8c179',
  '1c1c1c',
  '9c9c9c',
  '701c1c',
] as const
export type AppearanceHairColor = (typeof APPEARANCE_HAIR_COLORS)[number]

/** open-peeps "head" trait — hairstyles and headwear (hats/hijab/turban) in one enum */
export const APPEARANCE_HEAD_STYLES = [
  'afro',
  'bangs',
  'bangs2',
  'bantuKnots',
  'bear',
  'bun',
  'bun2',
  'buns',
  'cornrows',
  'cornrows2',
  'dreads1',
  'dreads2',
  'flatTop',
  'flatTopLong',
  'grayBun',
  'grayMedium',
  'grayShort',
  'hatBeanie',
  'hatHip',
  'hijab',
  'long',
  'longAfro',
  'longBangs',
  'longCurly',
  'medium1',
  'medium2',
  'medium3',
  'mediumBangs',
  'mediumBangs2',
  'mediumBangs3',
  'mediumStraight',
  'mohawk',
  'mohawk2',
  'noHair1',
  'noHair2',
  'noHair3',
  'pomp',
  'shaved1',
  'shaved2',
  'shaved3',
  'short1',
  'short2',
  'short3',
  'short4',
  'short5',
  'turban',
  'twists',
  'twists2',
] as const
export type AppearanceHeadStyle = (typeof APPEARANCE_HEAD_STYLES)[number]

/** open-peeps "face" trait — a combined expression (eyes + brows + mouth in one illustration) */
export const APPEARANCE_FACES = [
  'angryWithFang',
  'awe',
  'blank',
  'calm',
  'cheeky',
  'concerned',
  'concernedFear',
  'contempt',
  'cute',
  'cyclops',
  'driven',
  'eatingHappy',
  'explaining',
  'eyesClosed',
  'fear',
  'hectic',
  'lovingGrin1',
  'lovingGrin2',
  'monster',
  'old',
  'rage',
  'serious',
  'smile',
  'smileBig',
  'smileLOL',
  'smileTeethGap',
  'solemn',
  'suspicious',
  'tired',
  'veryAngry',
] as const
export type AppearanceFace = (typeof APPEARANCE_FACES)[number]

export const APPEARANCE_FACIAL_HAIR = [
  'none',
  'chin',
  'full',
  'full2',
  'full3',
  'full4',
  'goatee1',
  'goatee2',
  'moustache1',
  'moustache2',
  'moustache3',
  'moustache4',
  'moustache5',
  'moustache6',
  'moustache7',
  'moustache8',
  'moustache9',
] as const
export type AppearanceFacialHair = (typeof APPEARANCE_FACIAL_HAIR)[number]

export const APPEARANCE_ACCESSORIES = [
  'none',
  'eyepatch',
  'glasses',
  'glasses2',
  'glasses3',
  'glasses4',
  'glasses5',
  'sunglasses',
  'sunglasses2',
] as const
export type AppearanceAccessories = (typeof APPEARANCE_ACCESSORIES)[number]

/**
 * a fixed character's portrait, rendered client-side as a DiceBear "open-peeps" avatar.
 * Clothing colour is not stored here — it always matches the character's house/family
 * banner colour, applied at render time. hairColor tints hair, hats/headwear, and facial
 * hair alike (open-peeps uses a single accent colour for all three).
 */
export interface MemberAppearance {
  skinColor: AppearanceSkinTone
  hairColor: AppearanceHairColor
  head: AppearanceHeadStyle
  face: AppearanceFace
  facialHair: AppearanceFacialHair
  accessories: AppearanceAccessories
}

/** one fixed character belonging to a house. Skills are no longer hand-set directly —
 *  they're derived from up to MAX_TRAITS_PER_MEMBER assigned traits (see
 *  {@link TraitDesign}, {@link computeMemberSkills}). */
export interface MemberDesign {
  name: string
  /** names of assigned TraitDesigns (0–MAX_TRAITS_PER_MEMBER, each unique) */
  traits: string[]
  appearance: MemberAppearance
}

/** inclusive bounds for a member's resultant skill values — a skill with no assigned
 *  trait/occupation bonuses is 0, there is no base value */
export const MEMBER_SKILL_BOUNDS: [number, number] = [0, 10]

/** a character may be assigned at most this many traits */
export const MAX_TRAITS_PER_MEMBER = 3

/** inclusive bounds for one trait's bonus amount to a single skill (may be negative) */
export const TRAIT_BONUS_BOUNDS: [number, number] = [-9, 9]

/** inclusive bounds for an approach's difficulty (may be negative, for an easier-than-baseline check) */
export const APPROACH_DIFFICULTY_BOUNDS: [number, number] = [-10, 20]

/** a numeric bonus a trait grants to one skill */
export interface TraitBonus {
  skill: SkillKey
  amount: number
}

/** a designable trait characters can be assigned (up to MAX_TRAITS_PER_MEMBER each),
 *  granting a numeric bonus to one or more skills. Shown to players in place of the
 *  numeric skills it grants. */
export interface TraitDesign {
  name: string
  bonuses: TraitBonus[]
}

/** a designable occupation — same shape as {@link TraitDesign} for now (a name plus
 *  skill bonuses); kept as its own catalog since occupations are expected to diverge
 *  from traits later (e.g. one per member instead of up to MAX_TRAITS_PER_MEMBER). */
export type OccupationDesign = TraitDesign

/** one of the eight houses a joining player can be dealt */
export interface HouseDesign {
  name: string
  /** hex colour, e.g. "#b03a2e" */
  color: string
  /** name of the house's home city on the map (coordinates are fixed per slot) */
  cityName: string
  /** the house's fixed roster — always exactly MEMBERS_PER_HOUSE characters */
  members: MemberDesign[]
}

/** one designed way of tackling a scenario. Either `skill` is set (a normal roll) or
 *  `buyoutTier` is set (a standalone approach that pays gold for a flat bonus instead
 *  of a skill roll) — never both. */
export interface ApproachDesign {
  /** short verb phrase shown to players when choosing, e.g. "Storm the gates" */
  label: string
  /** hidden skill this approach tests */
  skill?: SkillKey
  /** how hard this approach's check is; P(success) = 1 / (1 + 2^(difficulty - skill)),
   *  so a skill total equal to difficulty is even odds. Defaults to 0 when unset. */
  difficulty?: number
  /** flavour text shown on the results screen when this approach succeeds. {actor} is replaced with the attending member's name */
  successMessage: string
  /** flavour text shown on the results screen when this approach fails the check. {actor} is replaced with the attending member's name */
  failureMessage: string
  /** if set, this approach pays gold for a flat bonus instead of rolling a skill — the
   *  actual cost is rolled from this tier's range once per scenario instantiation */
  buyoutTier?: GoldTier
  /** Influence tier granted to the winner(s) of this approach on success */
  successInfluence: RewardTier
  /** gold tier granted to the winner(s) of this approach on success (rolled within the tier's band) */
  successGold: RewardTier
  /** Influence tier lost by a family whose check on this approach fails */
  failureInfluence: RewardTier
  /** gold tier lost by a family whose check on this approach fails (rolled within the tier's band) */
  failureGold: RewardTier
  /** whether failing this approach's check also injures the attending member — stored only, no effect yet */
  failureInjury: boolean
}

/** a scenario template; each approach carries its own success reward and failure consequence tiers */
export interface ScenarioDesign {
  /** flavour emoji shown on the map — should hint at the story, not the skills */
  emoji: string
  title: string
  /** {town} is replaced with the town name */
  description: string
  /** 2–3 approaches players can pick between */
  approaches: ApproachDesign[]
  location: ScenarioLocation
}

// ---------- Face outcome overrides (dev panel) ----------

/**
 * Which face to swap in when a character wearing a given base face succeeds or fails a
 * check on the resolution screen. Either side left unset means "keep the same face".
 */
export interface FaceOutcomeDesign {
  successFace?: AppearanceFace
  failureFace?: AppearanceFace
}

/** base face -> its outcome overrides; a face absent from the map behaves as fully unset */
export type FaceOutcomeMap = Partial<Record<AppearanceFace, FaceOutcomeDesign>>

/** Designable content: applies to rooms/rounds created after saving. */
export interface GameContent {
  /** the skill catalog members are scored on and approaches test */
  skills: SkillDesign[]
  /** the trait catalog characters draw their skills from */
  traits: TraitDesign[]
  /** the occupation catalog — behaves the same as traits for now, not yet assigned to members */
  occupations: OccupationDesign[]
  houses: HouseDesign[]
  scenarios: ScenarioDesign[]
  /** per-face success/failure portrait overrides used on the resolution screen */
  faceOutcomes: FaceOutcomeMap
}

// ---------- Dev panel (REST) types ----------

export interface DevRoomSummary {
  code: string
  phase: GamePhase
  round: number
  playerCount: number
  createdAt: string
}

export interface DevRoomDetail {
  code: string
  phase: GamePhase
  round: number
  totalRounds: number
  players: Player[]
  families: Family[]
  towns: Town[]
  scenarios: Scenario[]
  assignments: Record<string, Assignments>
  resultHistory: RoundResult[]
}
