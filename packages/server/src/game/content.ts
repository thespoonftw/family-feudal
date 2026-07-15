import { copyFileSync, readFileSync, writeFileSync } from 'node:fs'
import type {
  ApproachDesign,
  GameContent,
  HouseDesign,
  NarrationTemplates,
  ScenarioDesign,
  ScenarioLocation,
  SkillKey,
  Town,
} from '@family-feudal/shared'
import { NARRATION_KIND_INFO, NARRATION_KINDS, SKILLS } from '@family-feudal/shared'
import {
  CAPITAL_NAME,
  CAPITAL_SLOT,
  CITY_SLOTS,
  DEFAULT_HOUSES,
  DEFAULT_NARRATION,
  DEFAULT_SCENARIOS,
} from './data.js'

export const DEFAULT_CONTENT: GameContent = {
  houses: DEFAULT_HOUSES,
  scenarios: DEFAULT_SCENARIOS,
  narration: DEFAULT_NARRATION,
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

function sanitizeHouse(raw: unknown, index: number): HouseDesign | string {
  const obj = (raw ?? {}) as Record<string, unknown>
  const name = cleanString(obj['name'], 40)
  if (!name) return `House ${index + 1}: name must be 1–40 characters`
  const color = cleanString(obj['color'], 7)
  if (!color || !/^#[0-9a-fA-F]{6}$/.test(color)) {
    return `House ${index + 1}: colour must be a hex value like #b03a3a`
  }
  const cityName = cleanString(obj['cityName'], 24)
  if (!cityName) return `House ${index + 1}: city name must be 1–24 characters`
  return { name, color: color.toLowerCase(), cityName }
}

function sanitizeApproach(raw: unknown, scenarioLabel: string, index: number): ApproachDesign | string {
  const obj = (raw ?? {}) as Record<string, unknown>
  const where = `${scenarioLabel}, approach ${index + 1}`
  const label = cleanString(obj['label'], 60)
  if (!label) return `${where}: label must be 1–60 characters`
  const skill = obj['skill']
  if (!SKILLS.includes(skill as SkillKey)) return `${where}: unknown skill`
  // a legacy per-approach `difficulty` is simply ignored (checks now roll against the DC)
  return { label, skill: skill as SkillKey }
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
  if (!Array.isArray(approaches) || approaches.length < 2 || approaches.length > 3) {
    return `${label}: needs 2–3 approaches`
  }
  const cleanApproaches: ApproachDesign[] = []
  for (const [i, approach] of approaches.entries()) {
    const result = sanitizeApproach(approach, label, i)
    if (typeof result === 'string') return result
    cleanApproaches.push(result)
  }
  return {
    emoji,
    title,
    description,
    approaches: cleanApproaches,
    location: location as ScenarioLocation,
  }
}

function sanitizeNarration(raw: unknown): NarrationTemplates | string {
  const obj = (raw ?? {}) as Record<string, unknown>
  const clean = {} as NarrationTemplates
  for (const kind of NARRATION_KINDS) {
    const label = `Herald lines (${NARRATION_KIND_INFO[kind].label})`
    const lines = obj[kind]
    if (!Array.isArray(lines) || lines.length === 0 || lines.length > 12) {
      return `${label}: needs 1–12 templates`
    }
    const cleanLines: string[] = []
    for (const line of lines) {
      const text = cleanString(line, 200)
      if (!text) return `${label}: each template must be 1–200 characters`
      cleanLines.push(text)
    }
    clean[kind] = cleanLines
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
  const narration = sanitizeNarration(obj['narration'])
  if (typeof narration === 'string') return narration
  return { houses: cleanHouses, scenarios: cleanScenarios, narration }
}

/**
 * Upgrade a persisted content file written by an older build so design edits (titles,
 * descriptions, …) survive schema changes. Currently handles the pre-approach format
 * (scenarios with a single `skill` — and the old `beauty` skill — become two
 * generically-labelled approaches that keep the original text) and the pre-narration
 * format (missing herald-line kinds are filled from the defaults).
 */
function migrateContent(raw: unknown): unknown {
  const obj = raw as Record<string, unknown> | null
  if (!obj || !Array.isArray(obj['scenarios'])) return raw
  // files from before the herald lines (or before a newly added kind) get the defaults
  const oldNarration = (obj['narration'] ?? {}) as Record<string, unknown>
  const narration: Record<string, unknown> = {}
  for (const kind of NARRATION_KINDS) {
    narration[kind] = oldNarration[kind] ?? DEFAULT_NARRATION[kind]
  }
  const scenarios = obj['scenarios'].map((s) => {
    const sc = (s ?? {}) as Record<string, unknown>
    if (Array.isArray(sc['approaches']) || sc['skill'] === undefined) return sc
    const skill = sc['skill'] === 'beauty' ? 'charm' : sc['skill']
    return {
      emoji: sc['emoji'],
      title: sc['title'],
      description: sc['description'],
      location: sc['location'],
      approaches: [
        { label: 'See it done', skill },
        { label: 'Find another way', skill: skill === 'cunning' ? 'charm' : 'cunning' },
      ],
    }
  })
  return { ...obj, scenarios, narration }
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
    })),
  ]
}

/** The claimable houses for a new room, in join order (house i lives in city slot i). */
export function buildPresets(from: GameContent): FamilyPreset[] {
  return from.houses.map((house, i) => ({
    name: house.name,
    color: house.color,
    homeTownId: CITY_SLOTS[i]?.id ?? `city-${i + 1}`,
  }))
}
