import { readFileSync, writeFileSync } from 'node:fs'
import type { GameConfig } from '@family-feudal/shared'
import { SKILLS } from '@family-feudal/shared'
import { CITY_SLOTS, MEMBER_NAMES } from './data.js'

export const DEFAULT_CONFIG: GameConfig = {
  totalRounds: 5,
  membersPerFamily: 4,
  scenariosPerRound: 5,
  skillMin: 1,
  skillMax: 4,
  skillSumMin: 11,
  skillSumMax: 14,
  checkDC: 6,
  maxPlayers: CITY_SLOTS.length,
}

/** inclusive [min, max] bounds per field, used for clamping dev edits */
export const CONFIG_BOUNDS: Record<keyof GameConfig, [number, number]> = {
  totalRounds: [1, 20],
  membersPerFamily: [1, Math.min(10, MEMBER_NAMES.length)],
  scenariosPerRound: [1, 10],
  skillMin: [0, 10],
  skillMax: [0, 10],
  skillSumMin: [0, 10 * SKILLS.length],
  skillSumMax: [0, 10 * SKILLS.length],
  checkDC: [1, 16],
  maxPlayers: [1, CITY_SLOTS.length],
}

// Persisted so settings survive restarts/deploys. Resolved against the server process
// cwd (packages/server under the systemd unit); override with CONFIG_FILE.
const CONFIG_FILE = process.env['CONFIG_FILE'] ?? 'game-config.json'

/** Merge a partial patch onto a base config, clamping every field to its bounds. */
function clampInto(base: GameConfig, patch: Partial<Record<keyof GameConfig, unknown>>): GameConfig {
  const next = { ...base }
  for (const key of Object.keys(CONFIG_BOUNDS) as (keyof GameConfig)[]) {
    const value = patch[key]
    if (typeof value === 'number' && Number.isFinite(value)) {
      const [min, max] = CONFIG_BOUNDS[key]
      next[key] = Math.min(max, Math.max(min, Math.round(value)))
    }
  }
  if (next.skillMin > next.skillMax) next.skillMin = next.skillMax
  // the skill-sum band must be reachable with five skills in [skillMin, skillMax]
  const floor = SKILLS.length * next.skillMin
  const ceiling = SKILLS.length * next.skillMax
  next.skillSumMin = Math.min(ceiling, Math.max(floor, next.skillSumMin))
  next.skillSumMax = Math.min(ceiling, Math.max(floor, next.skillSumMax))
  if (next.skillSumMin > next.skillSumMax) next.skillSumMin = next.skillSumMax
  return next
}

function loadConfig(): GameConfig {
  try {
    const raw = JSON.parse(readFileSync(CONFIG_FILE, 'utf8')) as Record<string, unknown>
    return clampInto(DEFAULT_CONFIG, raw)
  } catch {
    // missing or unreadable file → defaults
    return { ...DEFAULT_CONFIG }
  }
}

function persistConfig(): void {
  try {
    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n')
  } catch (err) {
    console.error('failed to persist game config:', err)
  }
}

let config: GameConfig = loadConfig()

export function getConfig(): GameConfig {
  return config
}

/** Apply a partial update, clamping every field to its bounds. Returns the new config. */
export function updateConfig(patch: Partial<Record<keyof GameConfig, unknown>>): GameConfig {
  config = clampInto(config, patch)
  persistConfig()
  return config
}

export function resetConfig(): GameConfig {
  config = { ...DEFAULT_CONFIG }
  persistConfig()
  return config
}
