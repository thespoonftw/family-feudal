import type { SkillKey, Town } from '@family-feudal/shared'

export const TOTAL_ROUNDS = 5
export const MEMBERS_PER_FAMILY = 4
export const SCENARIOS_PER_ROUND = 5 // plus one home scenario per family
export const MAX_PLAYERS = 8
export const MIN_PLAYERS = 2

export const CAPITAL_ID = 'kingsreach'

export const TOWNS: Town[] = [
  { id: 'kingsreach', name: 'Kingsreach', x: 50, y: 42, isCapital: true },
  { id: 'ashford', name: 'Ashford', x: 18, y: 22, isCapital: false },
  { id: 'belmont', name: 'Belmont', x: 78, y: 18, isCapital: false },
  { id: 'caldwell', name: 'Caldwell', x: 12, y: 58, isCapital: false },
  { id: 'draymoor', name: 'Draymoor', x: 85, y: 55, isCapital: false },
  { id: 'everly', name: 'Everly', x: 30, y: 80, isCapital: false },
  { id: 'fenwick', name: 'Fenwick', x: 68, y: 82, isCapital: false },
  { id: 'grimsby', name: 'Grimsby', x: 40, y: 12, isCapital: false },
  { id: 'harrowgate', name: 'Harrowgate', x: 92, y: 35, isCapital: false },
  { id: 'ivywell', name: 'Ivywell', x: 8, y: 38, isCapital: false },
  { id: 'lowmarsh', name: 'Lowmarsh', x: 55, y: 68, isCapital: false },
  { id: 'norcliffe', name: 'Norcliffe', x: 25, y: 45, isCapital: false },
  { id: 'thornbury', name: 'Thornbury', x: 65, y: 30, isCapital: false },
]

export interface FamilyPreset {
  name: string
  color: string
  homeTownId: string
}

export const FAMILY_PRESETS: FamilyPreset[] = [
  { name: 'House Ashford', color: '#b03a3a', homeTownId: 'ashford' },
  { name: 'House Belmont', color: '#3a6fb0', homeTownId: 'belmont' },
  { name: 'House Caldwell', color: '#2e8b57', homeTownId: 'caldwell' },
  { name: 'House Draymoor', color: '#7d4fb0', homeTownId: 'draymoor' },
  { name: 'House Everly', color: '#c98a2d', homeTownId: 'everly' },
  { name: 'House Fenwick', color: '#2d9d9d', homeTownId: 'fenwick' },
  { name: 'House Grimsby', color: '#c2439c', homeTownId: 'grimsby' },
  { name: 'House Harrowgate', color: '#607086', homeTownId: 'harrowgate' },
]

export const MEMBER_NAMES: string[] = [
  'Aldric', 'Beatrice', 'Cedric', 'Daphne', 'Edmund', 'Freya', 'Godwin', 'Helena',
  'Isolde', 'Jasper', 'Katherine', 'Leopold', 'Margaery', 'Nathaniel', 'Odette',
  'Percival', 'Quinn', 'Rosalind', 'Silas', 'Tamsin', 'Ulric', 'Vivienne',
  'Wilfred', 'Yvette', 'Ambrose', 'Blythe', 'Clemence', 'Dunstan', 'Elowen',
  'Fenella', 'Gareth', 'Honoria', 'Ines', 'Joscelin', 'Lysandra', 'Mortimer',
  'Nerissa', 'Osric', 'Petra', 'Roderick',
]

export interface ScenarioTemplate {
  id: string
  title: string
  /** {town} is replaced with the town name */
  description: string
  skill: SkillKey
  minDifficulty: number
  maxDifficulty: number
  capitalOnly?: boolean
}

export const SCENARIO_TEMPLATES: ScenarioTemplate[] = [
  // Combat
  { id: 'bandit-raid', title: 'Bandit Raid', description: 'Bandits are terrorising the roads around {town}. Drive them off.', skill: 'combat', minDifficulty: 7, maxDifficulty: 11 },
  { id: 'jousting-tournament', title: 'Jousting Tournament', description: 'A grand tourney is held at {town}. Glory awaits the victors.', skill: 'combat', minDifficulty: 8, maxDifficulty: 12 },
  { id: 'border-skirmish', title: 'Border Skirmish', description: 'Raiders from beyond the realm probe the defences of {town}.', skill: 'combat', minDifficulty: 9, maxDifficulty: 12 },
  { id: 'beast-hunt', title: 'Beast Hunt', description: 'A monstrous beast stalks the woods near {town}. Hunters are called for.', skill: 'combat', minDifficulty: 7, maxDifficulty: 10 },
  // Beauty
  { id: 'masquerade-ball', title: 'Masquerade Ball', description: 'The nobility of {town} hosts a dazzling masquerade. Impressions matter.', skill: 'beauty', minDifficulty: 7, maxDifficulty: 11 },
  { id: 'portrait-unveiling', title: 'Portrait Unveiling', description: 'A famed painter seeks muses in {town} for a royal commission.', skill: 'beauty', minDifficulty: 7, maxDifficulty: 10 },
  { id: 'royal-wedding', title: 'Noble Wedding', description: 'Two great houses wed at {town}. All eyes are on the guests.', skill: 'beauty', minDifficulty: 8, maxDifficulty: 12 },
  // Intellect
  { id: 'scholars-symposium', title: "Scholars' Symposium", description: 'Learned minds gather in {town} to debate the great questions.', skill: 'intellect', minDifficulty: 7, maxDifficulty: 11 },
  { id: 'plague-outbreak', title: 'Plague Outbreak', description: 'Sickness spreads through {town}. Physicians and scholars are needed.', skill: 'intellect', minDifficulty: 9, maxDifficulty: 12 },
  { id: 'missing-heirloom', title: 'Missing Heirloom', description: 'A precious relic has vanished in {town}. Someone must solve the mystery.', skill: 'intellect', minDifficulty: 7, maxDifficulty: 10 },
  // Diplomacy
  { id: 'trade-dispute', title: 'Trade Dispute', description: 'Merchants of {town} are at each other’s throats. Broker a settlement.', skill: 'diplomacy', minDifficulty: 7, maxDifficulty: 11 },
  { id: 'peace-talks', title: 'Peace Talks', description: 'Feuding lords meet at {town} under a banner of truce.', skill: 'diplomacy', minDifficulty: 9, maxDifficulty: 12 },
  { id: 'harvest-festival', title: 'Harvest Festival', description: 'The people of {town} celebrate the harvest. Win their goodwill.', skill: 'diplomacy', minDifficulty: 7, maxDifficulty: 10 },
  // Capital only
  { id: 'coronation', title: 'Coronation', description: 'A new monarch is crowned at {town}. The whole realm watches.', skill: 'diplomacy', minDifficulty: 10, maxDifficulty: 12, capitalOnly: true },
  { id: 'royal-audience', title: 'Royal Audience', description: 'The crown grants audiences at {town}. Favour hangs in the balance.', skill: 'diplomacy', minDifficulty: 8, maxDifficulty: 11, capitalOnly: true },
  { id: 'queens-gala', title: "Queen's Gala", description: 'The Queen hosts a resplendent gala at {town}.', skill: 'beauty', minDifficulty: 9, maxDifficulty: 12, capitalOnly: true },
]

export const HOME_TEMPLATES: ScenarioTemplate[] = [
  { id: 'home-poachers', title: 'Poachers on the Estate', description: 'Poachers have been spotted on your lands near {town}.', skill: 'combat', minDifficulty: 5, maxDifficulty: 7 },
  { id: 'home-feast', title: 'Feast for the Household', description: 'Your household at {town} expects a memorable feast.', skill: 'beauty', minDifficulty: 5, maxDifficulty: 7 },
  { id: 'home-ledgers', title: 'Ledgers & Accounts', description: 'The estate books at {town} are in disarray.', skill: 'intellect', minDifficulty: 5, maxDifficulty: 7 },
  { id: 'home-tenants', title: 'Tenant Dispute', description: 'Two tenant farmers at {town} quarrel over a boundary stone.', skill: 'diplomacy', minDifficulty: 5, maxDifficulty: 7 },
]

/** influence gained for succeeding at a scenario of the given difficulty */
export function rewardFor(difficulty: number): number {
  return Math.max(1, 1 + Math.floor((difficulty - 6) / 2))
}
