import { randomUUID } from 'crypto'
import type {
  Assignments,
  Family,
  FamilyMember,
  GamePhase,
  GameView,
  Player,
  RoundResult,
  Scenario,
  ScenarioOutcome,
  SkillKey,
  Town,
} from '@family-feudal/shared'
import { SKILLS } from '@family-feudal/shared'
import {
  CAPITAL_ID,
  FAMILY_PRESETS,
  HOME_TEMPLATES,
  MEMBER_NAMES,
  SCENARIO_TEMPLATES,
  TOWNS,
  rewardFor,
  type ScenarioTemplate,
} from './data.js'
import { getConfig } from './config.js'

export interface Room {
  code: string
  createdAt: Date
  phase: GamePhase
  round: number
  totalRounds: number
  players: Player[]
  families: Family[]
  towns: Town[]
  scenarios: Scenario[]
  /** familyId -> (memberId -> scenarioId) */
  assignments: Record<string, Assignments>
  lastResult: RoundResult | null
  resultHistory: RoundResult[]
  winnerFamilyIds: string[] | null
}

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1))
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const a = out[i] as T
    out[i] = out[j] as T
    out[j] = a
  }
  return out
}

export function createRoom(
  hostName: string,
  isCodeTaken: (code: string) => boolean,
): { room: Room; player: Player } {
  const player: Player = {
    id: randomUUID(),
    name: hostName,
    isHost: true,
    connected: true,
    ready: false,
  }
  let code = generateCode()
  while (isCodeTaken(code)) code = generateCode()
  const room: Room = {
    code,
    createdAt: new Date(),
    phase: 'lobby',
    round: 0,
    totalRounds: getConfig().totalRounds,
    players: [player],
    families: [],
    towns: TOWNS,
    scenarios: [],
    assignments: {},
    lastResult: null,
    resultHistory: [],
    winnerFamilyIds: null,
  }
  return { room, player }
}

function generateCode(): string {
  // avoid ambiguous characters (0/O, 1/I)
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 4; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return code
}

export function addPlayer(room: Room, name: string): Player {
  const player: Player = {
    id: randomUUID(),
    name,
    isHost: room.players.length === 0,
    connected: true,
    ready: false,
  }
  room.players.push(player)
  return player
}

function generateMembers(): FamilyMember[] {
  const config = getConfig()
  const names = shuffle(MEMBER_NAMES).slice(0, config.membersPerFamily)
  return names.map((name) => {
    const skills = {} as Record<SkillKey, number>
    for (const skill of SKILLS) skills[skill] = randomInt(config.skillMin, config.skillMax)
    return { id: randomUUID(), name, skills }
  })
}

export function startGame(room: Room): void {
  const config = getConfig()
  room.totalRounds = config.totalRounds
  const presets = shuffle(FAMILY_PRESETS)
  room.families = room.players.map((player, i) => {
    const preset = presets[i % presets.length] as (typeof presets)[number]
    return {
      id: randomUUID(),
      playerId: player.id,
      name: preset.name,
      color: preset.color,
      homeTownId: preset.homeTownId,
      members: generateMembers(),
      influence: 0,
    }
  })
  // build this game's map: the capital + every playing family's home town + random fill
  // up to the configured town count
  const homeIds = new Set(room.families.map((f) => f.homeTownId))
  const fillCount = Math.max(0, config.townCount - homeIds.size)
  const fillIds = new Set(
    shuffle(TOWNS.filter((t) => !t.isCapital && !homeIds.has(t.id)))
      .slice(0, fillCount)
      .map((t) => t.id),
  )
  room.towns = TOWNS.filter((t) => t.isCapital || homeIds.has(t.id) || fillIds.has(t.id))
  room.phase = 'planning'
  room.round = 1
  beginPlanning(room)
}

function pickScenarios(room: Room): Scenario[] {
  const scenarios: Scenario[] = []

  // one capital scenario per round
  const capitalTemplates = SCENARIO_TEMPLATES.filter((t) => t.capitalOnly)
  const capital = shuffle(capitalTemplates)[0] as ScenarioTemplate
  scenarios.push(instantiate(capital, CAPITAL_ID))

  // remaining scenarios at distinct non-capital, non-home towns on this game's map
  const homeTowns = new Set(room.families.map((f) => f.homeTownId))
  const eligibleTowns = shuffle(
    room.towns.filter((t) => !t.isCapital && !homeTowns.has(t.id)),
  )
  const general = shuffle(SCENARIO_TEMPLATES.filter((t) => !t.capitalOnly))
  const count = Math.min(getConfig().scenariosPerRound - 1, eligibleTowns.length, general.length)
  for (let i = 0; i < count; i++) {
    const template = general[i] as ScenarioTemplate
    const town = eligibleTowns[i] as Town
    scenarios.push(instantiate(template, town.id))
  }

  // one home scenario per family, at its home town
  for (const family of room.families) {
    const template = shuffle(HOME_TEMPLATES)[0] as ScenarioTemplate
    const scenario = instantiate(template, family.homeTownId)
    scenario.homeFamilyId = family.id
    scenarios.push(scenario)
  }

  return scenarios
}

function instantiate(template: ScenarioTemplate, townId: string): Scenario {
  const town = TOWNS.find((t) => t.id === townId)
  const difficulty = randomInt(template.minDifficulty, template.maxDifficulty)
  return {
    id: randomUUID(),
    title: template.title,
    description: template.description.replace('{town}', town?.name ?? 'the realm'),
    townId,
    skill: template.skill,
    difficulty,
    reward: rewardFor(difficulty),
  }
}

function beginPlanning(room: Room): void {
  room.scenarios = pickScenarios(room)
  room.assignments = {}
  for (const family of room.families) room.assignments[family.id] = {}
  for (const player of room.players) player.ready = false
  room.phase = 'planning'
}

/** Validate and store a player's full assignment map. Returns an error message or null. */
export function setAssignments(
  room: Room,
  playerId: string,
  assignments: Assignments,
): string | null {
  if (room.phase !== 'planning') return 'Not in the planning phase'
  const family = room.families.find((f) => f.playerId === playerId)
  if (!family) return 'You have no family in this game'
  const memberIds = new Set(family.members.map((m) => m.id))
  const clean: Assignments = {}
  for (const [memberId, scenarioId] of Object.entries(assignments)) {
    if (!memberIds.has(memberId)) return 'Unknown family member'
    const scenario = room.scenarios.find((s) => s.id === scenarioId)
    if (!scenario) return 'Unknown scenario'
    if (scenario.homeFamilyId && scenario.homeFamilyId !== family.id) {
      return 'That scenario belongs to another family'
    }
    clean[memberId] = scenarioId
  }
  room.assignments[family.id] = clean
  return null
}

export function allReady(room: Room): boolean {
  const active = room.players.filter((p) => p.connected)
  return active.length > 0 && active.every((p) => p.ready)
}

export function resolveRound(room: Room): void {
  const outcomes: ScenarioOutcome[] = []
  for (const scenario of room.scenarios) {
    for (const family of room.families) {
      const familyAssignments = room.assignments[family.id] ?? {}
      const memberIds = Object.entries(familyAssignments)
        .filter(([, sid]) => sid === scenario.id)
        .map(([mid]) => mid)
      if (memberIds.length === 0) continue
      const members = family.members.filter((m) => memberIds.includes(m.id))
      const skillTotal = members.reduce((sum, m) => sum + m.skills[scenario.skill], 0)
      const roll = randomInt(1, 6)
      const total = skillTotal + roll
      const success = total >= scenario.difficulty
      const influenceGained = success ? scenario.reward : 0
      family.influence += influenceGained
      outcomes.push({
        scenarioId: scenario.id,
        familyId: family.id,
        memberIds,
        skillTotal,
        roll,
        total,
        difficulty: scenario.difficulty,
        success,
        influenceGained,
      })
    }
  }
  const result: RoundResult = { round: room.round, outcomes }
  room.lastResult = result
  room.resultHistory.push(result)
  room.phase = 'resolution'
  for (const player of room.players) player.ready = false
}

export function nextRound(room: Room): void {
  if (room.round >= room.totalRounds) {
    room.phase = 'finished'
    const max = Math.max(...room.families.map((f) => f.influence))
    room.winnerFamilyIds = room.families.filter((f) => f.influence === max).map((f) => f.id)
    return
  }
  room.round += 1
  beginPlanning(room)
}

export function buildView(room: Room, playerId: string): GameView {
  const family = room.families.find((f) => f.playerId === playerId)
  const revealed = room.phase === 'resolution' || room.phase === 'finished'
  return {
    code: room.code,
    phase: room.phase,
    round: room.round,
    totalRounds: room.totalRounds,
    players: room.players,
    families: room.families,
    towns: room.towns,
    scenarios: room.scenarios,
    playerId,
    yourAssignments: family ? (room.assignments[family.id] ?? {}) : {},
    revealedAssignments: revealed ? room.assignments : null,
    lastResult: room.phase === 'resolution' || room.phase === 'finished' ? room.lastResult : null,
    resultHistory: room.phase === 'finished' ? room.resultHistory : [],
    winnerFamilyIds: room.winnerFamilyIds,
  }
}
