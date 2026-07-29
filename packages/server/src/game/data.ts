import type {
  AppearanceEarrings,
  AppearanceEyebrows,
  AppearanceFacialHair,
  AppearanceGlasses,
  AppearanceMouth,
  AppearanceShirtStyle,
  HouseDesign,
  MemberAppearance,
  MemberDesign,
  NarrationTemplates,
  ScenarioDesign,
} from '@family-feudal/shared'
import {
  APPEARANCE_EYE_COLORS,
  APPEARANCE_EYE_STYLES,
  APPEARANCE_HAIR_STYLES,
  APPEARANCE_SKIN_TONES,
} from '@family-feudal/shared'

// rounds/scenarios/max-players are runtime-tunable — see config.ts
// houses (incl. their fixed 3-character rosters) and scenarios are designable — see content.ts
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

// Each house's fixed roster of MEMBERS_PER_HOUSE characters — name + hand-set skills.
// No longer rolled at game start; edited from the dev panel like everything else here.
/** a house roster before its portrait defaults are attached — see {@link withAppearance} */
type MemberSeed = Omit<MemberDesign, 'appearance'>

const ASHFORD_MEMBERS: MemberSeed[] = [
  { name: 'Aldric', skills: { combat: 2, charm: 3, intellect: 3, diplomacy: 2, cunning: 4 } },
  { name: 'Beatrice', skills: { combat: 1, charm: 1, intellect: 2, diplomacy: 4, cunning: 3 } },
  { name: 'Cedric', skills: { combat: 3, charm: 2, intellect: 2, diplomacy: 1, cunning: 4 } },
]

const BELMONT_MEMBERS: MemberSeed[] = [
  { name: 'Daphne', skills: { combat: 3, charm: 4, intellect: 2, diplomacy: 1, cunning: 4 } },
  { name: 'Edmund', skills: { combat: 4, charm: 4, intellect: 1, diplomacy: 2, cunning: 3 } },
  { name: 'Freya', skills: { combat: 1, charm: 2, intellect: 3, diplomacy: 4, cunning: 2 } },
]

const CALDWELL_MEMBERS: MemberSeed[] = [
  { name: 'Godwin', skills: { combat: 3, charm: 1, intellect: 3, diplomacy: 3, cunning: 3 } },
  { name: 'Helena', skills: { combat: 3, charm: 3, intellect: 4, diplomacy: 1, cunning: 3 } },
  { name: 'Isolde', skills: { combat: 2, charm: 4, intellect: 2, diplomacy: 1, cunning: 2 } },
]

const DRAYMOOR_MEMBERS: MemberSeed[] = [
  { name: 'Jasper', skills: { combat: 1, charm: 4, intellect: 1, diplomacy: 2, cunning: 3 } },
  { name: 'Katherine', skills: { combat: 2, charm: 2, intellect: 4, diplomacy: 3, cunning: 3 } },
  { name: 'Leopold', skills: { combat: 1, charm: 4, intellect: 4, diplomacy: 1, cunning: 4 } },
]

const EVERLY_MEMBERS: MemberSeed[] = [
  { name: 'Margaery', skills: { combat: 1, charm: 4, intellect: 3, diplomacy: 1, cunning: 2 } },
  { name: 'Nathaniel', skills: { combat: 2, charm: 3, intellect: 2, diplomacy: 1, cunning: 4 } },
  { name: 'Odette', skills: { combat: 2, charm: 4, intellect: 1, diplomacy: 3, cunning: 3 } },
]

const FENWICK_MEMBERS: MemberSeed[] = [
  { name: 'Percival', skills: { combat: 4, charm: 3, intellect: 2, diplomacy: 2, cunning: 1 } },
  { name: 'Quinn', skills: { combat: 1, charm: 2, intellect: 3, diplomacy: 2, cunning: 4 } },
  { name: 'Rosalind', skills: { combat: 4, charm: 3, intellect: 1, diplomacy: 3, cunning: 3 } },
]

const GRIMSBY_MEMBERS: MemberSeed[] = [
  { name: 'Silas', skills: { combat: 1, charm: 1, intellect: 4, diplomacy: 3, cunning: 2 } },
  { name: 'Tamsin', skills: { combat: 4, charm: 3, intellect: 4, diplomacy: 2, cunning: 1 } },
  { name: 'Ulric', skills: { combat: 2, charm: 1, intellect: 4, diplomacy: 2, cunning: 3 } },
]

const HARROWGATE_MEMBERS: MemberSeed[] = [
  { name: 'Vivienne', skills: { combat: 3, charm: 1, intellect: 1, diplomacy: 3, cunning: 3 } },
  { name: 'Wilfred', skills: { combat: 1, charm: 4, intellect: 4, diplomacy: 2, cunning: 3 } },
  { name: 'Yvette', skills: { combat: 2, charm: 4, intellect: 1, diplomacy: 2, cunning: 2 } },
]

// Default portrait swatches, cycled by a global member index so the 24 stock characters
// come out visually varied. Purely a starting point — every field is dev-panel editable.
// Shirt colour is not rolled here — it always follows the house's banner colour.
const HAIR_COLORS = ['2c1b18', '4a2c14', '6b4423', 'ad8a56', 'e8c179', '1c1c1c', '9c9c9c', '701c1c']
const SHIRT_STYLES: AppearanceShirtStyle[] = ['open', 'crew', 'collared']
const EYEBROWS: AppearanceEyebrows[] = ['up', 'down', 'eyelashesUp', 'eyelashesDown']
const MOUTHS: AppearanceMouth[] = [
  'surprised',
  'laughing',
  'nervous',
  'smile',
  'sad',
  'pucker',
  'frown',
  'smirk',
]

export function appearanceFor(index: number): MemberAppearance {
  const facialHairOptions: AppearanceFacialHair[] = ['none', 'none', 'beard', 'none', 'scruff']
  const glassesOptions: AppearanceGlasses[] = ['none', 'none', 'none', 'round', 'none', 'square', 'none']
  const earringsOptions: AppearanceEarrings[] = ['none', 'none', 'stud', 'none', 'hoop', 'none', 'none']
  return {
    skinColor: APPEARANCE_SKIN_TONES[index % APPEARANCE_SKIN_TONES.length]!,
    eyesColor: APPEARANCE_EYE_COLORS[(index * 5) % APPEARANCE_EYE_COLORS.length]!,
    eyes: APPEARANCE_EYE_STYLES[index % APPEARANCE_EYE_STYLES.length]!,
    eyebrows: EYEBROWS[(index * 2) % EYEBROWS.length]!,
    mouth: MOUTHS[(index * 3) % MOUTHS.length]!,
    hair: APPEARANCE_HAIR_STYLES[index % APPEARANCE_HAIR_STYLES.length]!,
    hairColor: HAIR_COLORS[(index * 3) % HAIR_COLORS.length]!,
    facialHair: facialHairOptions[index % facialHairOptions.length]!,
    glasses: glassesOptions[index % glassesOptions.length]!,
    shirt: SHIRT_STYLES[index % SHIRT_STYLES.length]!,
    earrings: earringsOptions[index % earringsOptions.length]!,
  }
}

/** attaches default portraits to a house's roster; startIndex keeps them varied across houses */
function withAppearance(members: MemberSeed[], startIndex: number): MemberDesign[] {
  return members.map((m, i) => ({ ...m, appearance: appearanceFor(startIndex + i) }))
}

// one house per city slot, in slot order
export const DEFAULT_HOUSES: HouseDesign[] = [
  { name: 'House Ashford', color: '#b03a3a', cityName: 'Ashford', members: withAppearance(ASHFORD_MEMBERS, 0) },
  { name: 'House Belmont', color: '#3a6fb0', cityName: 'Belmont', members: withAppearance(BELMONT_MEMBERS, 3) },
  { name: 'House Caldwell', color: '#2e8b57', cityName: 'Caldwell', members: withAppearance(CALDWELL_MEMBERS, 6) },
  { name: 'House Draymoor', color: '#7d4fb0', cityName: 'Draymoor', members: withAppearance(DRAYMOOR_MEMBERS, 9) },
  { name: 'House Everly', color: '#c98a2d', cityName: 'Everly', members: withAppearance(EVERLY_MEMBERS, 12) },
  { name: 'House Fenwick', color: '#2d9d9d', cityName: 'Fenwick', members: withAppearance(FENWICK_MEMBERS, 15) },
  { name: 'House Grimsby', color: '#c2439c', cityName: 'Grimsby', members: withAppearance(GRIMSBY_MEMBERS, 18) },
  { name: 'House Harrowgate', color: '#607086', cityName: 'Harrowgate', members: withAppearance(HARROWGATE_MEMBERS, 21) },
]

// Herald lines read aloud on the results screen — one per attended scenario, picked at
// random from the list matching how the scenario went. Placeholders: {family} {member}
// {approach} {rivals} {count} {town} {scenario}. Rival lists are compressed ("House A,
// House B and 3 other houses") so lines stay short at any player count.
export const DEFAULT_NARRATION: NarrationTemplates = {
  soloTriumph: [
    'With no rival in sight, {member} of {family} chose to “{approach}” — and carried the day.',
    '{family} alone answered the call at {town}, and {member} did not disappoint.',
    '{member} of {family} found no competition at {town}, and made it look easy.',
  ],
  soloDefeat: [
    '{member} of {family} stood alone at {town} — and still found a way to fail.',
    'No rival barred the way, yet {member} of {family} rode home empty-handed.',
    '{family} had {town} all to themselves. Somehow, that was not enough.',
  ],
  contestedWin: [
    '{member} of {family} chose to “{approach}” and bested {rivals} for the prize.',
    'Against {rivals}, it was {member} of {family} who prevailed at {town}.',
    '{rivals} came to {town} with high hopes; {family} sent them home with none.',
  ],
  sharedSpoils: [
    'Neither herald could name a victor — {family} share the spoils at {town}.',
    'Evenly matched to the last, {family} split the glory at {town}.',
  ],
  allFall: [
    '{family} all tried their hand at {town}. The town remains unimpressed.',
    'Many came to {town}; none rose to the moment. A sorry day for {family}.',
    'Failure makes fast friends of {family} — every house fell short at {town}.',
  ],
}

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
