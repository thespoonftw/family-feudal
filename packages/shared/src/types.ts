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
  title: string
  description: string
  townId: string
  skill: SkillKey
  difficulty: number
  reward: number
  /** set when this is a home scenario belonging to one family */
  homeFamilyId?: string
}

export interface Player {
  id: string
  name: string
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
  /** your own player id */
  playerId: string
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
