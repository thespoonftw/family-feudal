// ---------- Core game types ----------

export const SKILLS = ['combat', 'charm', 'intellect', 'diplomacy', 'cunning'] as const
export type SkillKey = (typeof SKILLS)[number]

export const SKILL_LABELS: Record<SkillKey, string> = {
  combat: 'Combat',
  charm: 'Charm',
  intellect: 'Intellect',
  diplomacy: 'Diplomacy',
  cunning: 'Cunning',
}

export interface FamilyMember {
  id: string
  name: string
  skills: Record<SkillKey, number>
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
}

/** one way of tackling a scenario — the label is public, the skill behind it is not */
export interface ScenarioApproach {
  /** short verb phrase shown to players when choosing, e.g. "Storm the gates" */
  label: string
  skill: SkillKey
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
  /** scenarioId -> herald line describing how the scenario went (attended scenarios only) */
  narration: Record<string, string>
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
}

// ---------- Global game configuration (dev panel) ----------

/** Tunable parameters applied to games created after the change. */
export interface GameConfig {
  /** rounds per game */
  totalRounds: number
  /** family members each player starts with */
  membersPerFamily: number
  /** public scenarios per round (one is always at the capital; every family also gets a home scenario) */
  scenariosPerRound: number
  /** member skills roll uniformly in [skillMin, skillMax]… */
  skillMin: number
  skillMax: number
  /** …then get nudged until the sum of all five lands in [skillSumMin, skillSumMax] */
  skillSumMin: number
  skillSumMax: number
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

/** one of the eight houses a joining player can be dealt */
export interface HouseDesign {
  name: string
  /** hex colour, e.g. "#b03a2e" */
  color: string
  /** name of the house's home city on the map (coordinates are fixed per slot) */
  cityName: string
}

/** one designed way of tackling a scenario */
export interface ApproachDesign {
  /** short verb phrase shown to players when choosing, e.g. "Storm the gates" */
  label: string
  /** hidden skill this approach tests */
  skill: SkillKey
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

// ---------- Herald narration (results screen flavour text) ----------

/**
 * The shape a scenario's outcomes took, used to pick which herald line to tell.
 * Rivals beyond the first couple are compressed to a count, so lines stay short
 * however many houses attended.
 */
export const NARRATION_KINDS = [
  'soloTriumph',
  'soloDefeat',
  'contestedWin',
  'sharedSpoils',
  'allFall',
] as const
export type NarrationKind = (typeof NARRATION_KINDS)[number]

export const NARRATION_KIND_INFO: Record<NarrationKind, { label: string; hint: string }> = {
  soloTriumph: {
    label: 'Solo triumph',
    hint: 'One house attended and passed the check, unopposed.',
  },
  soloDefeat: {
    label: 'Solo defeat',
    hint: 'One house attended, unopposed — and still failed the check.',
  },
  contestedWin: {
    label: 'Contested win',
    hint: 'Several houses attended; exactly one took the Influence. {rivals} are the beaten houses.',
  },
  sharedSpoils: {
    label: 'Shared spoils',
    hint: 'Several houses tied for the highest passing total and share the Influence.',
  },
  allFall: {
    label: 'All fall short',
    hint: 'Several houses attended and every one of them failed the check.',
  },
}

/**
 * Placeholders available in every template: {family} (the featured house or houses —
 * the winner(s), or everyone who attended when all failed), {member} (their attending
 * kin), {approach} (the featured house's approach label), {rivals} (the other attending
 * houses, compressed), {count} (how many other houses attended), {town}, {scenario}.
 */
export const NARRATION_PLACEHOLDERS = [
  'family',
  'member',
  'approach',
  'rivals',
  'count',
  'town',
  'scenario',
] as const

/** Herald line templates per outcome shape; one is picked at random each time. */
export type NarrationTemplates = Record<NarrationKind, string[]>

/** Designable content: applies to rooms/rounds created after saving. */
export interface GameContent {
  houses: HouseDesign[]
  scenarios: ScenarioDesign[]
  /** herald lines spoken on the results screen */
  narration: NarrationTemplates
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
