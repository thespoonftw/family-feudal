import { randomUUID } from 'crypto'
import type {
  ApproachChoices,
  Assignments,
  Family,
  FamilyMember,
  GamePhase,
  GameView,
  Player,
  RoundResult,
  Scenario,
  ScenarioApproach,
  ScenarioDesign,
  ScenarioOutcome,
  SkillKey,
  Town,
} from '@family-feudal/shared'
import { SKILLS } from '@family-feudal/shared'
import { CAPITAL_ID, MEMBER_NAMES } from './data.js'
import { buildPresets, buildTowns, getContent, type FamilyPreset } from './content.js'
import { getConfig } from './config.js'
import { narrateScenario } from './narration.js'

export interface Room {
  code: string
  createdAt: Date
  phase: GamePhase
  round: number
  totalRounds: number
  players: Player[]
  families: Family[]
  towns: Town[]
  /** houses claimable in this room — snapshotted at creation so design edits never hit a live room */
  presets: FamilyPreset[]
  scenarios: Scenario[]
  /** familyId -> (memberId -> scenarioId) */
  assignments: Record<string, Assignments>
  /** familyId -> (scenarioId -> approach index), set during the approach phase */
  choices: Record<string, ApproachChoices>
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

/** Open a room for a host board screen. The board is not a player — players all join. */
export function createRoom(isCodeTaken: (code: string) => boolean): Room {
  let code = generateCode()
  while (isCodeTaken(code)) code = generateCode()
  const content = getContent()
  return {
    code,
    createdAt: new Date(),
    phase: 'lobby',
    round: 0,
    totalRounds: getConfig().totalRounds,
    players: [],
    families: [],
    towns: buildTowns(content),
    presets: buildPresets(content),
    scenarios: [],
    assignments: {},
    choices: {},
    lastResult: null,
    resultHistory: [],
    winnerFamilyIds: null,
  }
}

/** Each joining player is dealt a random free house (house + city); members roll at start. */
function claimFamily(room: Room, playerId: string): void {
  const taken = new Set(room.families.map((f) => f.homeTownId))
  const free = room.presets.filter((p) => !taken.has(p.homeTownId))
  const preset = free[Math.floor(Math.random() * free.length)]
  if (!preset) return
  room.families.push({
    id: randomUUID(),
    playerId,
    name: preset.name,
    color: preset.color,
    homeTownId: preset.homeTownId,
    members: [],
    influence: 0,
  })
}

/** Free a departing lobby player's house and city for the next joiner. */
export function releaseFamily(room: Room, playerId: string): void {
  room.families = room.families.filter((f) => f.playerId !== playerId)
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
  claimFamily(room, player.id)
  return player
}

/**
 * Roll a member's skills uniformly, then nudge random skills up/down until the total
 * lands inside the configured band — keeps members comparable in overall power while
 * their spread stays random. `updateConfig` guarantees the band is reachable.
 */
function rollSkills(config: ReturnType<typeof getConfig>): Record<SkillKey, number> {
  const skills = {} as Record<SkillKey, number>
  for (const skill of SKILLS) skills[skill] = randomInt(config.skillMin, config.skillMax)
  const sum = () => SKILLS.reduce((total, key) => total + skills[key], 0)
  while (sum() > config.skillSumMax) {
    const above = SKILLS.filter((key) => skills[key] > config.skillMin)
    const key = above[Math.floor(Math.random() * above.length)]
    if (!key) break
    skills[key] -= 1
  }
  while (sum() < config.skillSumMin) {
    const below = SKILLS.filter((key) => skills[key] < config.skillMax)
    const key = below[Math.floor(Math.random() * below.length)]
    if (!key) break
    skills[key] += 1
  }
  return skills
}

function generateMembers(): FamilyMember[] {
  const config = getConfig()
  const names = shuffle(MEMBER_NAMES).slice(0, config.membersPerFamily)
  return names.map((name) => ({ id: randomUUID(), name, skills: rollSkills(config) }))
}

export function startGame(room: Room): void {
  const config = getConfig()
  room.totalRounds = config.totalRounds
  // houses and home cities were claimed as players joined; roll the members now
  for (const family of room.families) family.members = generateMembers()
  room.phase = 'planning'
  room.round = 1
  beginPlanning(room)
}

function pickScenarios(room: Room): Scenario[] {
  const scenarios: Scenario[] = []
  // designs are read afresh each round, so scenario edits reach the next planning phase
  const designs = getContent().scenarios

  // one capital scenario per round (content validation guarantees at least one)
  const capital = shuffle(designs.filter((d) => d.location === 'capital'))[0] as ScenarioDesign
  scenarios.push(instantiate(capital, CAPITAL_ID, room.towns))

  // remaining scenarios at distinct non-capital, non-home towns on this game's map
  const homeTowns = new Set(room.families.map((f) => f.homeTownId))
  const eligibleTowns = shuffle(
    room.towns.filter((t) => !t.isCapital && !homeTowns.has(t.id)),
  )
  const general = shuffle(designs.filter((d) => d.location === 'general'))
  const count = Math.min(getConfig().scenariosPerRound - 1, eligibleTowns.length, general.length)
  for (let i = 0; i < count; i++) {
    const design = general[i] as ScenarioDesign
    const town = eligibleTowns[i] as Town
    scenarios.push(instantiate(design, town.id, room.towns))
  }

  // one home scenario per family, at its home town
  const homeDesigns = designs.filter((d) => d.location === 'home')
  for (const family of room.families) {
    const design = shuffle(homeDesigns)[0] as ScenarioDesign
    const scenario = instantiate(design, family.homeTownId, room.towns)
    scenario.homeFamilyId = family.id
    scenarios.push(scenario)
  }

  return scenarios
}

function instantiate(design: ScenarioDesign, townId: string, towns: Town[]): Scenario {
  const town = towns.find((t) => t.id === townId)
  return {
    id: randomUUID(),
    emoji: design.emoji,
    title: design.title,
    description: design.description.replace('{town}', town?.name ?? 'the realm'),
    townId,
    approaches: design.approaches.map((a) => ({ ...a })),
  }
}

function beginPlanning(room: Room): void {
  room.scenarios = pickScenarios(room)
  room.assignments = {}
  room.choices = {}
  for (const family of room.families) {
    room.assignments[family.id] = {}
    room.choices[family.id] = {}
  }
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
  const usedScenarios = new Set<string>()
  for (const [memberId, scenarioId] of Object.entries(assignments)) {
    if (!memberIds.has(memberId)) return 'Unknown family member'
    const scenario = room.scenarios.find((s) => s.id === scenarioId)
    if (!scenario) return 'Unknown scenario'
    if (scenario.homeFamilyId && scenario.homeFamilyId !== family.id) {
      return 'That scenario belongs to another family'
    }
    if (usedScenarios.has(scenarioId)) return 'Only one family member can attend each scenario'
    usedScenarios.add(scenarioId)
    clean[memberId] = scenarioId
  }
  room.assignments[family.id] = clean
  return null
}

export function allReady(room: Room): boolean {
  const active = room.players.filter((p) => p.connected)
  return active.length > 0 && active.every((p) => p.ready)
}

/**
 * End the planning phase. Normally moves to the approach phase; if no house deployed
 * anyone there is nothing to choose, so the round resolves immediately.
 */
export function finishPlanning(room: Room): void {
  const anyDeployed = Object.values(room.assignments).some(
    (a) => Object.keys(a).length > 0,
  )
  if (!anyDeployed) {
    resolveRound(room)
    return
  }
  room.phase = 'approach'
  for (const player of room.players) player.ready = false
}

/** Validate and store a player's full approach-choice map. Returns an error message or null. */
export function setChoices(
  room: Room,
  playerId: string,
  choices: ApproachChoices,
): string | null {
  if (room.phase !== 'approach') return 'Not in the approach phase'
  const family = room.families.find((f) => f.playerId === playerId)
  if (!family) return 'You have no family in this game'
  const assigned = new Set(Object.values(room.assignments[family.id] ?? {}))
  const clean: ApproachChoices = {}
  for (const [scenarioId, index] of Object.entries(choices)) {
    if (!assigned.has(scenarioId)) return 'You have no one at that scenario'
    const scenario = room.scenarios.find((s) => s.id === scenarioId)
    if (!scenario) return 'Unknown scenario'
    if (!Number.isInteger(index) || index < 0 || index >= scenario.approaches.length) {
      return 'Unknown approach'
    }
    clean[scenarioId] = index
  }
  room.choices[family.id] = clean
  return null
}

export function resolveRound(room: Room): void {
  const dc = getConfig().checkDC
  // herald templates are read afresh, like scenario designs — edits reach the next reveal
  const templates = getContent().narration
  const outcomes: ScenarioOutcome[] = []
  const narration: Record<string, string> = {}
  for (const scenario of room.scenarios) {
    // every attending family rolls skill + d6 against the DC…
    const contenders: ScenarioOutcome[] = []
    for (const family of room.families) {
      const familyAssignments = room.assignments[family.id] ?? {}
      const memberIds = Object.entries(familyAssignments)
        .filter(([, sid]) => sid === scenario.id)
        .map(([mid]) => mid)
      if (memberIds.length === 0) continue
      const members = family.members.filter((m) => memberIds.includes(m.id))
      // families that never picked take the first approach
      const approachIndex = room.choices[family.id]?.[scenario.id] ?? 0
      const approach = scenario.approaches[approachIndex] as ScenarioApproach
      const skillTotal = members.reduce((sum, m) => sum + m.skills[approach.skill], 0)
      const roll = randomInt(1, 6)
      const total = skillTotal + roll
      contenders.push({
        scenarioId: scenario.id,
        familyId: family.id,
        memberIds,
        approachIndex,
        skillTotal,
        roll,
        total,
        success: total >= dc,
        influenceGained: 0,
      })
    }
    // …and the highest passing total takes the Influence; ties all score
    const best = Math.max(...contenders.filter((c) => c.success).map((c) => c.total))
    for (const contender of contenders) {
      if (contender.success && contender.total === best) {
        contender.influenceGained = 1
        const family = room.families.find((f) => f.id === contender.familyId)
        if (family) family.influence += 1
      }
      outcomes.push(contender)
    }
    if (contenders.length > 0) {
      narration[scenario.id] = narrateScenario(
        scenario,
        contenders,
        room.families,
        room.towns,
        templates,
      )
    }
  }
  const result: RoundResult = { round: room.round, outcomes, narration }
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

/** Build a snapshot for one client; pass null for the host board screen (spectator). */
export function buildView(room: Room, playerId: string | null): GameView {
  const family = playerId ? room.families.find((f) => f.playerId === playerId) : undefined
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
    yourChoices: family ? (room.choices[family.id] ?? {}) : {},
    revealedAssignments: revealed ? room.assignments : null,
    lastResult: room.phase === 'resolution' || room.phase === 'finished' ? room.lastResult : null,
    resultHistory: room.phase === 'finished' ? room.resultHistory : [],
    winnerFamilyIds: room.winnerFamilyIds,
  }
}
