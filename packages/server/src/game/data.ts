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

// Emoji are flavour, not skill markers. Each scenario offers 2–3 approaches; the labels
// are shown to players in the approach phase, but the skill behind each stays hidden —
// the wording of each label is the only clue. Descriptions are pure story: they must NOT
// telegraph the approaches (those are revealed after deployment, so the description is
// what players deploy on). Checks roll skill + d6 against the configured DC; rival
// houses at the same scenario contest the prize (highest passing total wins).
export const DEFAULT_SCENARIOS: ScenarioDesign[] = [
  // General
  { emoji: '🐎', title: 'Bandit Raid', description: 'Bandits are terrorising the roads around {town}. The merchants beg for aid.', location: 'general', approaches: [
    { label: 'Ride them down', skill: 'combat' },
    { label: 'Infiltrate their camp', skill: 'cunning' },
  ] },
  { emoji: '🏇', title: 'Jousting Tournament', description: 'A grand tourney is held at {town}, and every eye in the realm turns to watch.', location: 'general', approaches: [
    { label: 'Enter the lists', skill: 'combat' },
    { label: 'Dazzle the royal box', skill: 'charm' },
  ] },
  { emoji: '🏴', title: 'Border Skirmish', description: 'Raiders from beyond the realm probe the defences of {town}.', location: 'general', approaches: [
    { label: 'Hold the wall', skill: 'combat' },
    { label: 'Sabotage their supplies', skill: 'cunning' },
  ] },
  { emoji: '🐗', title: 'Beast Hunt', description: 'A monstrous beast stalks the woods near {town}. None dare go out after dark.', location: 'general', approaches: [
    { label: 'Face it head-on', skill: 'combat' },
    { label: 'Study its habits and lay a trap', skill: 'intellect' },
  ] },
  { emoji: '🎭', title: 'Masquerade Ball', description: 'The nobility of {town} hosts a dazzling masquerade.', location: 'general', approaches: [
    { label: 'Be the talk of the ball', skill: 'charm' },
    { label: 'Trade whispers behind masks', skill: 'cunning' },
  ] },
  { emoji: '💍', title: 'Noble Wedding', description: 'Two great houses wed at {town}. All eyes are on the guests.', location: 'general', approaches: [
    { label: 'Outshine the bridal party', skill: 'charm' },
    { label: 'Toast both houses', skill: 'diplomacy' },
  ] },
  { emoji: '📚', title: "Scholars' Symposium", description: 'Learned minds gather in {town} to debate the great questions.', location: 'general', approaches: [
    { label: 'Win the great debate', skill: 'intellect' },
    { label: 'Keep the rival schools civil', skill: 'diplomacy' },
  ] },
  { emoji: '🐀', title: 'Plague Outbreak', description: 'Sickness spreads through {town}. The gates may soon be barred.', location: 'general', approaches: [
    { label: 'Find the source', skill: 'intellect' },
    { label: 'Calm the terrified town', skill: 'diplomacy' },
  ] },
  { emoji: '💎', title: 'Missing Heirloom', description: 'A precious relic has vanished in {town}. The reward for its return is generous.', location: 'general', approaches: [
    { label: 'Follow the clues', skill: 'intellect' },
    { label: 'Shake down the fences', skill: 'cunning' },
  ] },
  { emoji: '⚖️', title: 'Trade Dispute', description: 'Merchants of {town} are at each other’s throats over a fortune in cargo.', location: 'general', approaches: [
    { label: 'Broker a settlement', skill: 'diplomacy' },
    { label: 'Quietly rig the ledgers', skill: 'cunning' },
  ] },
  { emoji: '🕊️', title: 'Peace Talks', description: 'Feuding lords meet at {town} under a banner of truce.', location: 'general', approaches: [
    { label: 'Draft the truce', skill: 'diplomacy' },
    { label: 'Soften hearts at the feast', skill: 'charm' },
    { label: 'Blackmail both sides into peace', skill: 'cunning' },
  ] },
  { emoji: '🌾', title: 'Harvest Festival', description: 'The people of {town} celebrate the harvest. Win their goodwill.', location: 'general', approaches: [
    { label: 'Crown the festival in style', skill: 'charm' },
    { label: 'Judge the contests fairly', skill: 'diplomacy' },
  ] },
  { emoji: '🕯️', title: 'Whispers of Treason', description: 'A plot brews in the back rooms of {town}.', location: 'general', approaches: [
    { label: 'Turn their spy', skill: 'cunning' },
    { label: 'Kick down the door', skill: 'combat' },
  ] },
  // Capital only
  { emoji: '👑', title: 'Coronation', description: 'A new monarch is crowned at {town}. The whole realm watches.', location: 'capital', approaches: [
    { label: 'Swear fealty with grace', skill: 'diplomacy' },
    { label: 'Steal the spotlight', skill: 'charm' },
    { label: 'Work the shadowed halls', skill: 'cunning' },
  ] },
  { emoji: '🏰', title: 'Royal Audience', description: 'The crown grants audiences at {town}. Favour hangs in the balance.', location: 'capital', approaches: [
    { label: 'Petition the crown', skill: 'diplomacy' },
    { label: 'Bribe the chamberlain', skill: 'cunning' },
  ] },
  { emoji: '🥂', title: "Queen's Gala", description: 'The Queen hosts a resplendent gala at {town}.', location: 'capital', approaches: [
    { label: 'Charm the court', skill: 'charm' },
    { label: 'Compose a verse for the Queen', skill: 'intellect' },
  ] },
  // Home estates
  { emoji: '🏹', title: 'Poachers on the Estate', description: 'Poachers have been spotted on your lands near {town}.', location: 'home', approaches: [
    { label: 'Run them off', skill: 'combat' },
    { label: 'Set snares of your own', skill: 'cunning' },
  ] },
  { emoji: '🍗', title: 'Feast for the Household', description: 'Your household at {town} expects a memorable feast.', location: 'home', approaches: [
    { label: 'Host with flair', skill: 'charm' },
    { label: 'Seat the rivals apart', skill: 'diplomacy' },
  ] },
  { emoji: '📜', title: 'Ledgers & Accounts', description: 'The estate books at {town} are in disarray — and the tax collector is due.', location: 'home', approaches: [
    { label: 'Balance the books', skill: 'intellect' },
    { label: 'Cook the books', skill: 'cunning' },
  ] },
  { emoji: '🪨', title: 'Tenant Dispute', description: 'Two tenant farmers at {town} quarrel over a boundary stone.', location: 'home', approaches: [
    { label: 'Hear both farmers out', skill: 'diplomacy' },
    { label: 'Survey the old maps', skill: 'intellect' },
  ] },
]
