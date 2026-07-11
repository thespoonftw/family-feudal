import type { GameConfig } from '@family-feudal/shared'
import { FAMILY_PRESETS, MEMBER_NAMES, TOWNS } from './data.js'

const NON_CAPITAL_TOWNS = TOWNS.filter((t) => !t.isCapital).length

export const DEFAULT_CONFIG: GameConfig = {
  totalRounds: 5,
  membersPerFamily: 4,
  scenariosPerRound: 5,
  townCount: NON_CAPITAL_TOWNS,
  skillMin: 1,
  skillMax: 5,
  maxPlayers: FAMILY_PRESETS.length,
}

/** inclusive [min, max] bounds per field, used for clamping dev edits */
export const CONFIG_BOUNDS: Record<keyof GameConfig, [number, number]> = {
  totalRounds: [1, 20],
  membersPerFamily: [1, Math.min(10, MEMBER_NAMES.length)],
  scenariosPerRound: [1, 10],
  townCount: [3, NON_CAPITAL_TOWNS],
  skillMin: [0, 10],
  skillMax: [0, 10],
  maxPlayers: [2, FAMILY_PRESETS.length],
}

let config: GameConfig = { ...DEFAULT_CONFIG }

export function getConfig(): GameConfig {
  return config
}

/** Apply a partial update, clamping every field to its bounds. Returns the new config. */
export function updateConfig(patch: Partial<Record<keyof GameConfig, unknown>>): GameConfig {
  const next = { ...config }
  for (const key of Object.keys(CONFIG_BOUNDS) as (keyof GameConfig)[]) {
    const value = patch[key]
    if (typeof value === 'number' && Number.isFinite(value)) {
      const [min, max] = CONFIG_BOUNDS[key]
      next[key] = Math.min(max, Math.max(min, Math.round(value)))
    }
  }
  if (next.skillMin > next.skillMax) next.skillMin = next.skillMax
  config = next
  return config
}

export function resetConfig(): GameConfig {
  config = { ...DEFAULT_CONFIG }
  return config
}
