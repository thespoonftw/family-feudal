import type { RoundResult, Scenario } from './types.js'

// The host board reveals the round's outcomes one scenario at a time; player phones
// unlock their "next round" button when the sequence ends. Both sides compute the same
// schedule from the same GameView data, so they stay in sync without server timers.

/** how long the board holds on a scenario someone attended */
export const REVEAL_ATTENDED_MS = 10000
/** how long the board holds on the single card listing every untouched scenario */
export const REVEAL_QUIET_MS = 4000
/** phone-side slack so the board always finishes its reveal first */
export const REVEAL_PHONE_BUFFER_MS = 600

export interface RevealStep {
  /** one attended scenario — or every untouched one, shown together at the end */
  scenarioIds: string[]
  attended: boolean
  holdMs: number
}

/** Reveal order: attended scenarios one by one (map order), then all untouched ones at once. */
export function revealSteps(scenarios: Scenario[], result: RoundResult | null): RevealStep[] {
  const attended = new Set((result?.outcomes ?? []).map((o) => o.scenarioId))
  const steps: RevealStep[] = scenarios
    .filter((s) => attended.has(s.id))
    .map((s) => ({ scenarioIds: [s.id], attended: true, holdMs: REVEAL_ATTENDED_MS }))
  const quiet = scenarios.filter((s) => !attended.has(s.id)).map((s) => s.id)
  if (quiet.length > 0) {
    steps.push({ scenarioIds: quiet, attended: false, holdMs: REVEAL_QUIET_MS })
  }
  return steps
}

/** Total length of the board's reveal sequence. */
export function revealTotalMs(scenarios: Scenario[], result: RoundResult | null): number {
  return revealSteps(scenarios, result).reduce((total, step) => total + step.holdMs, 0)
}
