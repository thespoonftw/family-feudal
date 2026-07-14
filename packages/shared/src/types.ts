// ---------- Core game types ----------

export const SKILLS = ['combat', 'beauty', 'intellect', 'diplomacy'] as const
export type SkillKey = (typeof SKILLS)[number]

export const SKILL_LABELS: Record<SkillKey, string> = {
  combat: 'Combat',
  beauty: 'Beauty',
  intellect: 'Intellect',
  diplomacy: 'Diplomacy',
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

export interface Scenario {
  id: string
  /** flavour emoji shown on the map — deliberately does not hint at the skill */
  emoji: string
  title: string
  description: string
  townId: string
  skill: SkillKey
  difficulty: number
  /** set when this is a home scenario belonging to one family */
  homeFamilyId?: string
}

export interface Player {
  id: string
  name: string
  /** the VIP — first player to join; starts the game and advances rounds */
  isHost: boolean
  connected: boolean
  ready: boolean
}

/** memberId -> scenarioId (members absent from the map stay idle at home) */
export type Assignments = Record<string, string>

export interface ScenarioOutcome {
  scenarioId: string
  familyId: string
  memberIds: string[]
  skillTotal: number
  roll: number
  total: number
  difficulty: number
  success: boolean
  influenceGained: number
}

export interface RoundResult {
  round: number
  outcomes: ScenarioOutcome[]
}

export type GamePhase = 'lobby' | 'planning' | 'resolution' | 'finished'

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
  /** member skills roll uniformly in [skillMin, skillMax] */
  skillMin: number
  skillMax: number
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

/** a scenario template; every scenario rewards 1 Influence on success */
export interface ScenarioDesign {
  /** flavour emoji shown on the map — should hint at the story, not the skill */
  emoji: string
  title: string
  /** {town} is replaced with the town name */
  description: string
  skill: SkillKey
  /** difficulty rolls uniformly in [minDifficulty, maxDifficulty] */
  minDifficulty: number
  maxDifficulty: number
  location: ScenarioLocation
}

/** Designable content: applies to rooms/rounds created after saving. */
export interface GameContent {
  houses: HouseDesign[]
  scenarios: ScenarioDesign[]
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
