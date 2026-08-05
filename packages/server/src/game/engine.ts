import { randomUUID } from 'crypto'
import type {
  ApproachChoices,
  Assignments,
  Family,
  FamilyMember,
  GamePhase,
  GameView,
  GoldTier,
  Player,
  RewardTier,
  RoundResult,
  Scenario,
  ScenarioApproach,
  ScenarioDesign,
  ScenarioOutcome,
  SkillKey,
  Town,
} from '@family-feudal/shared'
import { GOLD_STEP, goldTierBounds, INFLUENCE_TIER_VALUES } from '@family-feudal/shared'
import { CAPITAL_ID } from './data.js'
import { buildPresets, buildTowns, getContent, type FamilyPreset } from './content.js'
import { getConfig } from './config.js'

export interface Room {
  code: string
  createdAt: Date
  phase: GamePhase
  /** deadline for the current timed phase (planning/approach), epoch ms; null otherwise */
  phaseEndsAt: number | null
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

/** Roll a random gold amount within a reward tier's band, rounded to the nearest GOLD_STEP. */
function rollGoldTier(tier: RewardTier, bounds: Record<GoldTier, [number, number]>): number {
  if (tier === 'none') return 0
  const [min, max] = bounds[tier]
  const amount = randomInt(Math.min(min, max), Math.max(min, max))
  return Math.round(amount / GOLD_STEP) * GOLD_STEP
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
    phaseEndsAt: null,
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
    gold: 0,
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

/** Instantiate a family's members from its house preset's fixed roster (new id per game). */
function generateMembers(preset: FamilyPreset | undefined): FamilyMember[] {
  if (!preset) return []
  return preset.members.map((m) => ({
    id: randomUUID(),
    name: m.name,
    skills: { ...m.skills },
    appearance: { ...m.appearance },
  }))
}

export function startGame(room: Room): void {
  const config = getConfig()
  room.totalRounds = config.totalRounds
  // houses and home cities were claimed as players joined; instantiate the fixed roster now
  for (const family of room.families) {
    const preset = room.presets.find((p) => p.homeTownId === family.homeTownId)
    family.members = generateMembers(preset)
    family.gold = config.startingGold
  }
  room.phase = 'planning'
  room.round = 1
  beginPlanning(room)
}

function pickScenarios(room: Room): Scenario[] {
  const scenarios: Scenario[] = []
  // designs are read afresh each round, so scenario edits reach the next planning phase
  const designs = getContent().scenarios
  const bounds = goldTierBounds(getConfig())

  // one capital scenario per round (content validation guarantees at least one)
  const capital = shuffle(designs.filter((d) => d.location === 'capital'))[0] as ScenarioDesign
  scenarios.push(instantiate(capital, CAPITAL_ID, room.towns, bounds))

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
    scenarios.push(instantiate(design, town.id, room.towns, bounds))
  }

  // one home scenario per family, at its home town
  const homeDesigns = designs.filter((d) => d.location === 'home')
  for (const family of room.families) {
    const design = shuffle(homeDesigns)[0] as ScenarioDesign
    const scenario = instantiate(design, family.homeTownId, room.towns, bounds)
    scenario.homeFamilyId = family.id
    scenarios.push(scenario)
  }

  return scenarios
}

function instantiate(
  design: ScenarioDesign,
  townId: string,
  towns: Town[],
  goldBounds: Record<GoldTier, [number, number]>,
): Scenario {
  const town = towns.find((t) => t.id === townId)
  return {
    id: randomUUID(),
    emoji: design.emoji,
    title: design.title,
    description: design.description.replace('{town}', town?.name ?? 'the realm'),
    townId,
    // a buyout approach's design-time tier is rolled into an actual, fixed gold cost once
    // per instantiation — it must stay deterministic for the rest of the round, unlike
    // reward/consequence gold which is rolled fresh at resolution
    approaches: design.approaches.map((a) => {
      const { buyoutTier, ...rest } = a
      return buyoutTier ? { ...rest, buyoutCost: rollGoldTier(buyoutTier, goldBounds) } : { ...rest }
    }),
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
  room.phaseEndsAt = Date.now() + getConfig().planningSeconds * 1000
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
  room.phaseEndsAt = Date.now() + getConfig().approachSeconds * 1000
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
  let goldCommitted = 0
  for (const [scenarioId, approachIndex] of Object.entries(choices)) {
    if (!assigned.has(scenarioId)) return 'You have no one at that scenario'
    const scenario = room.scenarios.find((s) => s.id === scenarioId)
    if (!scenario) return 'Unknown scenario'
    if (!Number.isInteger(approachIndex) || approachIndex < 0 || approachIndex >= scenario.approaches.length) {
      return 'Unknown approach'
    }
    const approach = scenario.approaches[approachIndex] as ScenarioApproach
    if (approach.buyoutCost) goldCommitted += approach.buyoutCost
    clean[scenarioId] = approachIndex
  }
  if (goldCommitted > family.gold) return 'Not enough gold'
  room.choices[family.id] = clean
  return null
}

export function resolveRound(room: Room): void {
  const config = getConfig()
  const dc = config.checkDC
  const bounds = goldTierBounds(config)
  const outcomes: ScenarioOutcome[] = []
  for (const scenario of room.scenarios) {
    // every attending family rolls skill + d6 against the DC (or pays gold to buy out
    // the roll with a flat bonus instead) …
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
      const boughtOut = approach.buyoutCost !== undefined
      if (boughtOut) family.gold -= approach.buyoutCost as number
      const skillTotal = boughtOut
        ? config.buyoutBonus
        : members.reduce((sum, m) => sum + m.skills[approach.skill as SkillKey], 0)
      const roll = randomInt(1, 6)
      const total = skillTotal + roll
      contenders.push({
        scenarioId: scenario.id,
        familyId: family.id,
        memberIds,
        approachIndex,
        boughtOut,
        skillTotal,
        roll,
        total,
        success: total >= dc,
        influenceGained: 0,
        goldGained: 0,
        injured: false,
      })
    }
    // …and the highest passing total takes the prize (Influence and/or gold, per that
    // approach's success tiers); ties all score. Anyone who fails outright instead pays
    // that approach's failure consequence tiers (which may take them below 0).
    const best = Math.max(...contenders.filter((c) => c.success).map((c) => c.total))
    for (const contender of contenders) {
      const family = room.families.find((f) => f.id === contender.familyId)
      const chosenApproach = scenario.approaches[contender.approachIndex] as ScenarioApproach
      if (contender.success && contender.total === best) {
        const influenceGained = INFLUENCE_TIER_VALUES[chosenApproach.successInfluence]
        const goldGained = rollGoldTier(chosenApproach.successGold, bounds)
        contender.influenceGained = influenceGained
        contender.goldGained = goldGained
        if (family) {
          family.influence += influenceGained
          family.gold += goldGained
        }
      } else if (!contender.success) {
        const influenceLost = INFLUENCE_TIER_VALUES[chosenApproach.failureInfluence]
        const goldLost = rollGoldTier(chosenApproach.failureGold, bounds)
        contender.influenceGained = -influenceLost
        contender.goldGained = -goldLost
        contender.injured = chosenApproach.failureInjury
        if (family) {
          family.influence -= influenceLost
          family.gold -= goldLost
        }
      }
      outcomes.push(contender)
    }
  }
  const result: RoundResult = { round: room.round, outcomes }
  room.lastResult = result
  room.resultHistory.push(result)
  room.phase = 'resolution'
  room.phaseEndsAt = null
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
    phaseEndsAt: room.phaseEndsAt,
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
    faceOutcomes: getContent().faceOutcomes,
    buyoutBonus: getConfig().buyoutBonus,
  }
}
