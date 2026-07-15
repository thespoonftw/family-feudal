import type { RoundResult, Scenario } from './types.js'

// The host board reveals the round's outcomes one scenario at a time; player phones
// unlock their "next round" button when the sequence ends. Both sides compute the same
// schedule from the same GameView data, so they stay in sync without server timers.

/** how long the board holds on a scenario someone attended */
export const REVEAL_ATTENDED_MS = 5000
/** how long the board holds on a scenario nobody attended */
export const REVEAL_EMPTY_MS = 2200
/** phone-side slack so the board always finishes its reveal first */
export const REVEAL_PHONE_BUFFER_MS = 600

export interface RevealStep {
  scenarioId: string
  holdMs: number
}

/** Reveal order: attended scenarios first (map order), untouched ones last. */
export function revealSteps(scenarios: Scenario[], result: RoundResult | null): RevealStep[] {
  const attended = new Set((result?.outcomes ?? []).map((o) => o.scenarioId))
  const ordered = [
    ...scenarios.filter((s) => attended.has(s.id)),
    ...scenarios.filter((s) => !attended.has(s.id)),
  ]
  return ordered.map((s) => ({
    scenarioId: s.id,
    holdMs: attended.has(s.id) ? REVEAL_ATTENDED_MS : REVEAL_EMPTY_MS,
  }))
}

/** Total length of the board's reveal sequence. */
export function revealTotalMs(scenarios: Scenario[], result: RoundResult | null): number {
  return revealSteps(scenarios, result).reduce((total, step) => total + step.holdMs, 0)
}
