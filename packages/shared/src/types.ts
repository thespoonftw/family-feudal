// ---------- Core game types ----------

export const SKILLS = ['might', 'charm', 'wit', 'cunning'] as const
export type SkillKey = (typeof SKILLS)[number]

export const SKILL_LABELS: Record<SkillKey, string> = {
  might: 'Might',
  charm: 'Charm',
  wit: 'Wit',
  cunning: 'Cunning',
}

export interface FamilyMember {
  id: string
  name: string
  skills: Record<SkillKey, number>
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
  influence: number
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

/** one way of tackling a scenario — the label is public, the skill behind it is not */
export interface ScenarioApproach {
  /** short verb phrase shown to players when choosing, e.g. "Storm the gates" */
  label: string
  skill: SkillKey
  /** flavour text shown on the results screen when this approach succeeds */
  successMessage: string
  /** flavour text shown on the results screen when this approach fails the check */
  failureMessage: string
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

/** scenarioId -> index into that scenario's approaches (unchosen assignments default to 0) */
export type ApproachChoices = Record<string, number>

export interface ScenarioOutcome {
  scenarioId: string
  familyId: string
  memberIds: string[]
  /** which of the scenario's approaches the family took */
  approachIndex: number
  skillTotal: number
  roll: number
  total: number
  /** met the DC — but a rival with a higher total can still take the prize */
  success: boolean
  /** 1 for the highest successful total(s) at the scenario, else 0 */
  influenceGained: number
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
}

// ---------- Global game configuration (dev panel) ----------

/** Tunable parameters applied to games created after the change. */
export interface GameConfig {
  /** rounds per game */
  totalRounds: number
  /** public scenarios per round (one is always at the capital; every family also gets a home scenario) */
  scenariosPerRound: number
  /** every check is skill + d6 vs this DC; highest passing total at a scenario wins */
  checkDC: number
  /** maximum players per room */
  maxPlayers: number
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

/** one fixed character belonging to a house, with hand-set (not rolled) skills */
export interface MemberDesign {
  name: string
  skills: Record<SkillKey, number>
  appearance: MemberAppearance
}

/** inclusive bounds for a designed character's skill values */
export const MEMBER_SKILL_BOUNDS: [number, number] = [1, 10]

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

/** one designed way of tackling a scenario */
export interface ApproachDesign {
  /** short verb phrase shown to players when choosing, e.g. "Storm the gates" */
  label: string
  /** hidden skill this approach tests */
  skill: SkillKey
  /** flavour text shown on the results screen when this approach succeeds */
  successMessage: string
  /** flavour text shown on the results screen when this approach fails the check */
  failureMessage: string
}

/** a scenario template; every scenario rewards 1 Influence on success */
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
