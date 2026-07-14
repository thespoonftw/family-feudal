import { readFileSync, writeFileSync } from 'node:fs'
import type {
  GameContent,
  HouseDesign,
  ScenarioDesign,
  ScenarioLocation,
  SkillKey,
  Town,
} from '@family-feudal/shared'
import { SKILLS } from '@family-feudal/shared'
import {
  CAPITAL_NAME,
  CAPITAL_SLOT,
  CITY_SLOTS,
  DEFAULT_HOUSES,
  DEFAULT_SCENARIOS,
} from './data.js'

export const DEFAULT_CONTENT: GameContent = {
  houses: DEFAULT_HOUSES,
  scenarios: DEFAULT_SCENARIOS,
}

export const DIFFICULTY_BOUNDS: [number, number] = [1, 20]

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

function sanitizeScenario(raw: unknown, index: number): ScenarioDesign | string {
  const obj = (raw ?? {}) as Record<string, unknown>
  const label = `Scenario ${index + 1}`
  const emoji = cleanString(obj['emoji'], 8)
  if (!emoji) return `${label}: emoji is required`
  const title = cleanString(obj['title'], 60)
  if (!title) return `${label}: title must be 1–60 characters`
  const description = cleanString(obj['description'], 240)
  if (!description) return `${label}: description must be 1–240 characters`
  const skill = obj['skill']
  if (!SKILLS.includes(skill as SkillKey)) return `${label}: unknown skill`
  const location = obj['location']
  if (!LOCATIONS.includes(location as ScenarioLocation)) return `${label}: unknown location`
  const [min, max] = DIFFICULTY_BOUNDS
  const rawDifficulty = obj['difficulty']
  if (typeof rawDifficulty !== 'number' || !Number.isFinite(rawDifficulty)) {
    return `${label}: difficulty must be a number`
  }
  const difficulty = Math.min(max, Math.max(min, Math.round(rawDifficulty)))
  return {
    emoji,
    title,
    description,
    skill: skill as SkillKey,
    difficulty,
    location: location as ScenarioLocation,
  }
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
  return { houses: cleanHouses, scenarios: cleanScenarios }
}

function loadContent(): GameContent {
  try {
    const parsed = sanitizeContent(JSON.parse(readFileSync(CONTENT_FILE, 'utf8')))
    if (typeof parsed === 'string') throw new Error(parsed)
    return parsed
  } catch {
    // missing or invalid file → defaults
    return structuredClone(DEFAULT_CONTENT)
  }
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
