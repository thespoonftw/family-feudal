import { readFileSync, writeFileSync } from 'node:fs'
import type { GameConfig } from '@family-feudal/shared'
import { CITY_SLOTS } from './data.js'

export const DEFAULT_CONFIG: GameConfig = {
  totalRounds: 5,
  scenariosPerRound: 3,
  maxPlayers: CITY_SLOTS.length,
  buyoutBonus: 4,
  startingGold: 50,
  goldSmallMin: 10,
  goldSmallMax: 30,
  goldMediumMin: 30,
  goldMediumMax: 60,
  goldLargeMin: 70,
  goldLargeMax: 100,
  planningSeconds: 90,
  approachSeconds: 60,
  resultsSeconds: 20,
}

/** inclusive [min, max] bounds per field, used for clamping dev edits */
export const CONFIG_BOUNDS: Record<keyof GameConfig, [number, number]> = {
  totalRounds: [1, 20],
  scenariosPerRound: [1, 10],
  maxPlayers: [1, CITY_SLOTS.length],
  buyoutBonus: [0, 10],
  startingGold: [0, 200],
  goldSmallMin: [0, 300],
  goldSmallMax: [0, 300],
  goldMediumMin: [0, 300],
  goldMediumMax: [0, 300],
  goldLargeMin: [0, 300],
  goldLargeMax: [0, 300],
  planningSeconds: [10, 600],
  approachSeconds: [10, 600],
  resultsSeconds: [5, 300],
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
