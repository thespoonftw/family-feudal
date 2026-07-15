import type { RoundResult, Scenario } from './types.js'

// The host board reveals the round's outcomes one scenario at a time; player phones
// unlock their "next round" button when the sequence ends. Both sides compute the same
// schedule from the same GameView data, so they stay in sync without server timers.

/** opening beat that gives players a moment to look up at the board */
export const REVEAL_INTRO_MS = 3500
/** how long the board holds on a scenario someone attended */
export const REVEAL_ATTENDED_MS = 10000
/** how long the board holds on the single card listing every untouched scenario */
export const REVEAL_QUIET_MS = 4000

export interface RevealStep {
  kind: 'intro' | 'scenario' | 'quiet'
  /** the attended scenario (kind 'scenario') or every untouched one (kind 'quiet') */
  scenarioIds: string[]
  holdMs: number
}

/** Reveal order: intro beat, attended scenarios one by one (map order), untouched ones all at once. */
export function revealSteps(scenarios: Scenario[], result: RoundResult | null): RevealStep[] {
  const attended = new Set((result?.outcomes ?? []).map((o) => o.scenarioId))
  const steps: RevealStep[] = [{ kind: 'intro', scenarioIds: [], holdMs: REVEAL_INTRO_MS }]
  for (const s of scenarios) {
    if (attended.has(s.id)) {
      steps.push({ kind: 'scenario', scenarioIds: [s.id], holdMs: REVEAL_ATTENDED_MS })
    }
  }
  const quiet = scenarios.filter((s) => !attended.has(s.id)).map((s) => s.id)
  if (quiet.length > 0) {
    steps.push({ kind: 'quiet', scenarioIds: quiet, holdMs: REVEAL_QUIET_MS })
  }
  return steps
}

/** When the standings card lands — phones unlock "next round" at this same moment. */
export function revealTotalMs(scenarios: Scenario[], result: RoundResult | null): number {
  return revealSteps(scenarios, result).reduce((total, step) => total + step.holdMs, 0)
}
