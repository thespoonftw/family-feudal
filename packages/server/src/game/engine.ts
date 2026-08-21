import { randomUUID } from 'crypto'
import type {
  ApproachChoices,
  Assignments,
  Family,
  FamilyMember,
  TraitDesign,
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
import {
  CAPITAL_STARTING_REPUTATION,
  computeMemberSkills,
  GOLD_STEP,
  goldTierBounds,
  INFLUENCE_TIER_VALUES,
  REPUTATION_BOUNDS,
  revealTotalMs,
  STARTING_REPUTATION_VALUES,
  successChance,
} from '@family-feudal/shared'
import { buildPresets, buildTowns, getContent, type FamilyPreset } from './content.js'
import { getConfig } from './config.js'

export interface Room {
  code: string
  createdAt: Date
  phase: GamePhase
  /** deadline for the current timed phase (planning/approach), epoch ms; null otherwise */
  phaseEndsAt: number | null
  /** start of the current timed phase, epoch ms; null otherwise */
  phaseStartedAt: number | null
  round: number
  totalRounds: number
  players: Player[]
  families: Family[]
  towns: Town[]
  /** houses claimable in this room — snapshotted at creation so design edits never hit a live room */
  presets: FamilyPreset[]
  /** every family's starting reputation per location (townId), rolled once so everyone
   *  starts equally regarded at a given location */
  baseReputation: Record<string, number>
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

function clampReputation(n: number): number {
  const [min, max] = REPUTATION_BOUNDS
  return Math.min(max, Math.max(min, n))
}

/** Roll every location's shared starting reputation once per room — the capital is
 *  always neutral, every other town gets a random pick from the same fixed set so no
 *  family starts favoured or disfavoured relative to the others. Wild locations are
 *  unowned — no family holds reputation there, so they get no entry at all. */
function rollBaseReputation(towns: Town[]): Record<string, number> {
  const base: Record<string, number> = {}
  for (const town of towns) {
    if (town.kind === 'wild') continue
    base[town.id] = town.kind === 'capital'
      ? CAPITAL_STARTING_REPUTATION
      : (STARTING_REPUTATION_VALUES[Math.floor(Math.random() * STARTING_REPUTATION_VALUES.length)] as number)
  }
  return base
}

/** Open a room for a host board screen. The board is not a player — players all join. */
export function createRoom(isCodeTaken: (code: string) => boolean): Room {
  let code = generateCode()
  while (isCodeTaken(code)) code = generateCode()
  const content = getContent()
  const towns = buildTowns(content)
  return {
    code,
    createdAt: new Date(),
    phase: 'lobby',
    phaseEndsAt: null,
    phaseStartedAt: null,
    round: 0,
    totalRounds: getConfig().totalRounds,
    players: [],
    families: [],
    towns,
    presets: buildPresets(content),
    baseReputation: rollBaseReputation(towns),
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
  const reputation = { ...room.baseReputation }
  room.families.push({
    id: randomUUID(),
    playerId,
    name: preset.name,
    color: preset.color,
    homeTownId: preset.homeTownId,
    members: [],
    influence: Object.values(reputation).reduce((sum, v) => sum + v, 0),
    reputation,
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

/** Instantiate a family's members from its house preset's fixed roster (new id per game).
 *  Skills are derived from each member's assigned traits/occupations against the
 *  trait+occupation/skill catalogs in effect right now — baked into concrete numbers
 *  once, like config, rather than read live for the rest of the game. Names are kept
 *  alongside the derived skills — players see those instead of the numeric skills they
 *  grant. `traits` here is the combined traits+occupations catalog — both share the
 *  same shape, and a member's assigned slots may name either. */
function generateMembers(
  preset: FamilyPreset | undefined,
  traits: TraitDesign[],
  skillCatalog: SkillKey[],
): FamilyMember[] {
  if (!preset) return []
  return preset.members.map((m) => ({
    id: randomUUID(),
    name: m.name,
    skills: computeMemberSkills(m.traits, traits, skillCatalog),
    traits: [...m.traits],
    appearance: { ...m.appearance },
  }))
}

export function startGame(room: Room): void {
  const config = getConfig()
  const content = getContent()
  room.totalRounds = config.totalRounds
  // houses and home cities were claimed as players joined; instantiate the fixed roster now
  for (const family of room.families) {
    const preset = room.presets.find((p) => p.homeTownId === family.homeTownId)
    family.members = generateMembers(
      preset,
      [...content.traits, ...content.occupations],
      content.skills.map((s) => s.key),
    )
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

  // one home scenario per family, at its home town — always included, on top of scenariosPerRound
  const homeDesigns = designs.filter((d) => d.location === 'home')
  for (const family of room.families) {
    const design = shuffle(homeDesigns)[0] as ScenarioDesign
    const scenario = instantiate(design, family.homeTownId, room.towns, bounds)
    scenario.homeFamilyId = family.id
    scenarios.push(scenario)
  }

  // everywhere else — capital, general cities, and wild locations — is one shared pool:
  // every eligible town is equally likely to be picked, up to scenariosPerRound of them
  const homeTowns = new Set(room.families.map((f) => f.homeTownId))
  const capitalDesigns = designs.filter((d) => d.location === 'capital')
  const generalDesigns = designs.filter((d) => d.location === 'general')
  const wildDesigns = designs.filter((d) => d.location === 'wild')
  const candidates = shuffle([
    ...(capitalDesigns.length > 0
      ? room.towns.filter((t) => t.kind === 'capital').map((town) => ({ town, pool: capitalDesigns }))
      : []),
    ...(generalDesigns.length > 0
      ? room.towns
          .filter((t) => t.kind === 'city' && !homeTowns.has(t.id))
          .map((town) => ({ town, pool: generalDesigns }))
      : []),
    ...room.towns
      .filter((t) => t.kind === 'wild')
      // a wild design's flavour text is written for a specific corner (wildSlotId) —
      // only pair a wild town with designs written for it, or left generic (untagged)
      .map((town) => ({
        town,
        pool: wildDesigns.filter((d) => !d.wildSlotId || d.wildSlotId === town.id),
      }))
      .filter((c) => c.pool.length > 0),
  ])
  const count = Math.min(getConfig().scenariosPerRound, candidates.length)
  for (let i = 0; i < count; i++) {
    const { town, pool } = candidates[i] as { town: Town; pool: ScenarioDesign[] }
    const design = shuffle(pool)[0] as ScenarioDesign
    scenarios.push(instantiate(design, town.id, room.towns, bounds))
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
    preposition: design.preposition,
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
  room.phaseStartedAt = Date.now()
  room.phaseEndsAt = room.phaseStartedAt + getConfig().planningSeconds * 1000
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
  room.phaseStartedAt = Date.now()
  room.phaseEndsAt = room.phaseStartedAt + getConfig().approachSeconds * 1000
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
  const bounds = goldTierBounds(config)
  const outcomes: ScenarioOutcome[] = []
  for (const scenario of room.scenarios) {
    // every attending family checks its skill total against the approach's difficulty
    // (or pays gold to buy out the check with a flat bonus instead) …
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
        : members.reduce((sum, m) => sum + (m.skills[approach.skill as SkillKey] ?? 0), 0)
      const chance = successChance(skillTotal, approach.difficulty ?? 0)
      contenders.push({
        scenarioId: scenario.id,
        familyId: family.id,
        memberIds,
        approachIndex,
        boughtOut,
        skillTotal,
        chance,
        success: Math.random() < chance,
        influenceGained: 0,
        goldGained: 0,
        injured: false,
      })
    }
    // wild locations are unowned — nobody holds reputation there, so no-show penalties
    // and Influence rewards never apply, win or lose (gold still does)
    const town = room.towns.find((t) => t.id === scenario.townId)
    const affectsReputation = town?.kind !== 'wild'
    // a family with access to this scenario's location but nobody deployed there loses
    // a flat pinch of reputation with it; other families' private home scenarios never
    // count against families who aren't their owner
    const attending = new Set(contenders.map((c) => c.familyId))
    const eligible = scenario.homeFamilyId
      ? room.families.filter((f) => f.id === scenario.homeFamilyId)
      : room.families
    if (affectsReputation) {
      for (const family of eligible) {
        if (attending.has(family.id)) continue
        const current = family.reputation[scenario.townId] ?? 0
        family.reputation[scenario.townId] = clampReputation(current - config.locationNoShowPenalty)
      }
    }
    // …and the highest passing skill total takes the prize (reputation with this
    // location, and/or gold, per that approach's success tiers); ties all score.
    // Anyone who fails outright instead loses only the gold consequence tier —
    // reputation is unaffected, same as passing but being outdone.
    const best = Math.max(...contenders.filter((c) => c.success).map((c) => c.skillTotal))
    for (const contender of contenders) {
      const family = room.families.find((f) => f.id === contender.familyId)
      const chosenApproach = scenario.approaches[contender.approachIndex] as ScenarioApproach
      if (contender.success && contender.skillTotal === best) {
        const influenceGained = affectsReputation ? INFLUENCE_TIER_VALUES[chosenApproach.successInfluence] : 0
        const goldGained = rollGoldTier(chosenApproach.successGold, bounds)
        contender.influenceGained = influenceGained
        contender.goldGained = goldGained
        if (family) {
          if (affectsReputation) {
            const current = family.reputation[scenario.townId] ?? 0
            family.reputation[scenario.townId] = clampReputation(current + influenceGained)
          }
          family.gold += goldGained
        }
      } else if (!contender.success) {
        const goldLost = rollGoldTier(chosenApproach.failureGold, bounds)
        contender.goldGained = -goldLost
        contender.injured = chosenApproach.failureInjury
        if (family) {
          family.gold -= goldLost
        }
      }
      outcomes.push(contender)
    }
  }
  // a family's total Influence is always the sum of its standing across every location
  for (const family of room.families) {
    family.influence = Object.values(family.reputation).reduce((sum, v) => sum + v, 0)
  }
  const result: RoundResult = { round: room.round, outcomes }
  room.lastResult = result
  room.resultHistory.push(result)
  room.phase = 'resolution'
  // the results screen holds through the reveal sequence plus a fixed viewing window
  room.phaseStartedAt = Date.now()
  room.phaseEndsAt =
    room.phaseStartedAt + revealTotalMs(room.scenarios, result) + config.resultsSeconds * 1000
  for (const player of room.players) player.ready = false
}

export function nextRound(room: Room): void {
  if (room.round >= room.totalRounds) {
    room.phase = 'finished'
    room.phaseEndsAt = null
    room.phaseStartedAt = null
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
    phaseStartedAt: room.phaseStartedAt,
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
    skills: getContent().skills.map((s) => s.key),
    buyoutBonus: getConfig().buyoutBonus,
  }
}
