import type {
  Family,
  NarrationKind,
  NarrationTemplates,
  Scenario,
  ScenarioOutcome,
  Town,
} from '@family-feudal/shared'

// Turns a scenario's outcomes into one herald line for the results screen. The line is
// generated once at resolution and shipped in the RoundResult, so every screen tells
// the same tale. Templates are designable (dev panel) — see NARRATION_KIND_INFO in
// shared for the shapes and NARRATION_PLACEHOLDERS for the vocabulary.

/**
 * Join house/member names without letting the list grow with the player count:
 * up to three names are listed in full, more become "A, B and N other houses".
 */
function nameList(names: string[]): string {
  const [first, second] = names
  if (!first) return 'no one'
  if (names.length === 1) return first
  if (names.length <= 3) return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  return `${first}, ${second} and ${names.length - 2} other houses`
}

function classify(outcomes: ScenarioOutcome[], winners: ScenarioOutcome[]): NarrationKind {
  if (outcomes.length === 1) return winners.length > 0 ? 'soloTriumph' : 'soloDefeat'
  if (winners.length === 0) return 'allFall'
  if (winners.length === 1) return 'contestedWin'
  return 'sharedSpoils'
}

/** Compose the herald line for one attended scenario. */
export function narrateScenario(
  scenario: Scenario,
  outcomes: ScenarioOutcome[],
  families: Family[],
  towns: Town[],
  templates: NarrationTemplates,
): string {
  const winners = outcomes.filter((o) => o.influenceGained > 0)
  const kind = classify(outcomes, winners)
  // the featured house(s): the winner(s), or everyone who attended when all failed
  const featured = winners.length > 0 ? winners : outcomes
  const featuredIds = new Set(featured.map((o) => o.familyId))
  const rivals = outcomes.filter((o) => !featuredIds.has(o.familyId))

  const familyName = (o: ScenarioOutcome) =>
    families.find((f) => f.id === o.familyId)?.name ?? 'an unknown house'
  const memberNames = (o: ScenarioOutcome) => {
    const family = families.find((f) => f.id === o.familyId)
    return (family?.members ?? [])
      .filter((m) => o.memberIds.includes(m.id))
      .map((m) => m.name)
  }

  const lead = featured[0] as ScenarioOutcome
  const values: Record<string, string> = {
    family: nameList(featured.map(familyName)),
    member: nameList(featured.flatMap(memberNames)),
    approach: scenario.approaches[lead.approachIndex]?.label ?? '',
    rivals: nameList(rivals.map(familyName)),
    count: String(rivals.length),
    town: towns.find((t) => t.id === scenario.townId)?.name ?? 'the realm',
    scenario: scenario.title,
  }

  const options = templates[kind]
  const template = options[Math.floor(Math.random() * options.length)] ?? ''
  // split/join rather than replaceAll: names may contain characters that are
  // special in a string replacement pattern ($&, $', …)
  return Object.entries(values).reduce(
    (line, [key, value]) => line.split(`{${key}}`).join(value),
    template,
  )
}
