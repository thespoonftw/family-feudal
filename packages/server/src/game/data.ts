import type { HouseDesign, ScenarioDesign } from '@family-feudal/shared'

// rounds/members/scenarios/max-players are runtime-tunable — see config.ts
// houses and scenarios are designable — see content.ts
export const MIN_PLAYERS = 1

export const CAPITAL_ID = 'capital'
export const CAPITAL_NAME = 'Kingsreach'

// Fixed map geometry: the capital plus one city slot per player slot. City names come
// from the house designs (slot i belongs to house i); coordinates never change.
// Coordinates are 0–100 in both axes; the client stretches them for portrait screens.
export interface MapSlot {
  id: string
  x: number
  y: number
}

export const CAPITAL_SLOT: MapSlot = { id: CAPITAL_ID, x: 50, y: 50 }

export const CITY_SLOTS: MapSlot[] = [
  { id: 'city-1', x: 21, y: 20 },
  { id: 'city-2', x: 79, y: 20 },
  { id: 'city-3', x: 12, y: 50 },
  { id: 'city-4', x: 78, y: 78 },
  { id: 'city-5', x: 22, y: 78 },
  { id: 'city-6', x: 50, y: 88 },
  { id: 'city-7', x: 50, y: 10 },
  { id: 'city-8', x: 88, y: 50 },
]

// one house per city slot, in slot order
export const DEFAULT_HOUSES: HouseDesign[] = [
  { name: 'House Ashford', color: '#b03a3a', cityName: 'Ashford' },
  { name: 'House Belmont', color: '#3a6fb0', cityName: 'Belmont' },
  { name: 'House Caldwell', color: '#2e8b57', cityName: 'Caldwell' },
  { name: 'House Draymoor', color: '#7d4fb0', cityName: 'Draymoor' },
  { name: 'House Everly', color: '#c98a2d', cityName: 'Everly' },
  { name: 'House Fenwick', color: '#2d9d9d', cityName: 'Fenwick' },
  { name: 'House Grimsby', color: '#c2439c', cityName: 'Grimsby' },
  { name: 'House Harrowgate', color: '#607086', cityName: 'Harrowgate' },
]

export const MEMBER_NAMES: string[] = [
  'Aldric', 'Beatrice', 'Cedric', 'Daphne', 'Edmund', 'Freya', 'Godwin', 'Helena',
  'Isolde', 'Jasper', 'Katherine', 'Leopold', 'Margaery', 'Nathaniel', 'Odette',
  'Percival', 'Quinn', 'Rosalind', 'Silas', 'Tamsin', 'Ulric', 'Vivienne',
  'Wilfred', 'Yvette', 'Ambrose', 'Blythe', 'Clemence', 'Dunstan', 'Elowen',
  'Fenella', 'Gareth', 'Honoria', 'Ines', 'Joscelin', 'Lysandra', 'Mortimer',
  'Nerissa', 'Osric', 'Petra', 'Roderick',
]

// Emoji are flavour, not skill markers — players must read the story to guess the skill.
export const DEFAULT_SCENARIOS: ScenarioDesign[] = [
  // Combat
  { emoji: '🐎', title: 'Bandit Raid', description: 'Bandits are terrorising the roads around {town}. Drive them off.', skill: 'combat', difficulty: 9, location: 'general' },
  { emoji: '🏇', title: 'Jousting Tournament', description: 'A grand tourney is held at {town}. Glory awaits the victors.', skill: 'combat', difficulty: 10, location: 'general' },
  { emoji: '🏴', title: 'Border Skirmish', description: 'Raiders from beyond the realm probe the defences of {town}.', skill: 'combat', difficulty: 11, location: 'general' },
  { emoji: '🐗', title: 'Beast Hunt', description: 'A monstrous beast stalks the woods near {town}. Hunters are called for.', skill: 'combat', difficulty: 9, location: 'general' },
  // Beauty
  { emoji: '🎭', title: 'Masquerade Ball', description: 'The nobility of {town} hosts a dazzling masquerade. Impressions matter.', skill: 'beauty', difficulty: 9, location: 'general' },
  { emoji: '🖼️', title: 'Portrait Unveiling', description: 'A famed painter seeks muses in {town} for a royal commission.', skill: 'beauty', difficulty: 9, location: 'general' },
  { emoji: '💍', title: 'Noble Wedding', description: 'Two great houses wed at {town}. All eyes are on the guests.', skill: 'beauty', difficulty: 10, location: 'general' },
  // Intellect
  { emoji: '📚', title: "Scholars' Symposium", description: 'Learned minds gather in {town} to debate the great questions.', skill: 'intellect', difficulty: 9, location: 'general' },
  { emoji: '🐀', title: 'Plague Outbreak', description: 'Sickness spreads through {town}. Physicians and scholars are needed.', skill: 'intellect', difficulty: 11, location: 'general' },
  { emoji: '💎', title: 'Missing Heirloom', description: 'A precious relic has vanished in {town}. Someone must solve the mystery.', skill: 'intellect', difficulty: 9, location: 'general' },
  // Diplomacy
  { emoji: '⚖️', title: 'Trade Dispute', description: 'Merchants of {town} are at each other’s throats. Broker a settlement.', skill: 'diplomacy', difficulty: 9, location: 'general' },
  { emoji: '🕊️', title: 'Peace Talks', description: 'Feuding lords meet at {town} under a banner of truce.', skill: 'diplomacy', difficulty: 11, location: 'general' },
  { emoji: '🌾', title: 'Harvest Festival', description: 'The people of {town} celebrate the harvest. Win their goodwill.', skill: 'diplomacy', difficulty: 9, location: 'general' },
  // Capital only
  { emoji: '👑', title: 'Coronation', description: 'A new monarch is crowned at {town}. The whole realm watches.', skill: 'diplomacy', difficulty: 11, location: 'capital' },
  { emoji: '🏰', title: 'Royal Audience', description: 'The crown grants audiences at {town}. Favour hangs in the balance.', skill: 'diplomacy', difficulty: 10, location: 'capital' },
  { emoji: '🥂', title: "Queen's Gala", description: 'The Queen hosts a resplendent gala at {town}.', skill: 'beauty', difficulty: 11, location: 'capital' },
  // Home estates
  { emoji: '🏹', title: 'Poachers on the Estate', description: 'Poachers have been spotted on your lands near {town}.', skill: 'combat', difficulty: 6, location: 'home' },
  { emoji: '🍗', title: 'Feast for the Household', description: 'Your household at {town} expects a memorable feast.', skill: 'beauty', difficulty: 6, location: 'home' },
  { emoji: '📜', title: 'Ledgers & Accounts', description: 'The estate books at {town} are in disarray.', skill: 'intellect', difficulty: 6, location: 'home' },
  { emoji: '🪨', title: 'Tenant Dispute', description: 'Two tenant farmers at {town} quarrel over a boundary stone.', skill: 'diplomacy', difficulty: 6, location: 'home' },
]
