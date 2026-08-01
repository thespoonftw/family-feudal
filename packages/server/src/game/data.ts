import type {
  AppearanceAccessories,
  AppearanceFace,
  AppearanceFacialHair,
  HouseDesign,
  MemberAppearance,
  MemberDesign,
  ScenarioDesign,
} from '@family-feudal/shared'
import {
  APPEARANCE_FACES,
  APPEARANCE_HAIR_COLORS,
  APPEARANCE_HEAD_STYLES,
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
  { name: 'Aldric', skills: { might: 2, charm: 3, wit: 3, cunning: 4 } },
  { name: 'Beatrice', skills: { might: 1, charm: 1, wit: 2, cunning: 3 } },
  { name: 'Cedric', skills: { might: 3, charm: 2, wit: 2, cunning: 4 } },
]

const BELMONT_MEMBERS: MemberSeed[] = [
  { name: 'Daphne', skills: { might: 3, charm: 4, wit: 2, cunning: 4 } },
  { name: 'Edmund', skills: { might: 4, charm: 4, wit: 1, cunning: 3 } },
  { name: 'Freya', skills: { might: 1, charm: 2, wit: 3, cunning: 2 } },
]

const CALDWELL_MEMBERS: MemberSeed[] = [
  { name: 'Godwin', skills: { might: 3, charm: 1, wit: 3, cunning: 3 } },
  { name: 'Helena', skills: { might: 3, charm: 3, wit: 4, cunning: 3 } },
  { name: 'Isolde', skills: { might: 2, charm: 4, wit: 2, cunning: 2 } },
]

const DRAYMOOR_MEMBERS: MemberSeed[] = [
  { name: 'Jasper', skills: { might: 1, charm: 4, wit: 1, cunning: 3 } },
  { name: 'Katherine', skills: { might: 2, charm: 2, wit: 4, cunning: 3 } },
  { name: 'Leopold', skills: { might: 1, charm: 4, wit: 4, cunning: 4 } },
]

const EVERLY_MEMBERS: MemberSeed[] = [
  { name: 'Margaery', skills: { might: 1, charm: 4, wit: 3, cunning: 2 } },
  { name: 'Nathaniel', skills: { might: 2, charm: 3, wit: 2, cunning: 4 } },
  { name: 'Odette', skills: { might: 2, charm: 4, wit: 1, cunning: 3 } },
]

const FENWICK_MEMBERS: MemberSeed[] = [
  { name: 'Percival', skills: { might: 4, charm: 3, wit: 2, cunning: 1 } },
  { name: 'Quinn', skills: { might: 1, charm: 2, wit: 3, cunning: 4 } },
  { name: 'Rosalind', skills: { might: 4, charm: 3, wit: 1, cunning: 3 } },
]

const GRIMSBY_MEMBERS: MemberSeed[] = [
  { name: 'Silas', skills: { might: 1, charm: 1, wit: 4, cunning: 2 } },
  { name: 'Tamsin', skills: { might: 4, charm: 3, wit: 4, cunning: 1 } },
  { name: 'Ulric', skills: { might: 2, charm: 1, wit: 4, cunning: 3 } },
]

const HARROWGATE_MEMBERS: MemberSeed[] = [
  { name: 'Vivienne', skills: { might: 3, charm: 1, wit: 1, cunning: 3 } },
  { name: 'Wilfred', skills: { might: 1, charm: 4, wit: 4, cunning: 3 } },
  { name: 'Yvette', skills: { might: 2, charm: 4, wit: 1, cunning: 2 } },
]

// Default portrait swatches, cycled by a global member index so the 24 stock characters
// come out visually varied. Purely a starting point — every field is dev-panel editable.
// Clothing colour is not rolled here — it always follows the house's banner colour.

export function appearanceFor(index: number): MemberAppearance {
  const facialHairOptions: AppearanceFacialHair[] = [
    'none',
    'none',
    'none',
    'full',
    'none',
    'moustache3',
    'none',
    'goatee1',
  ]
  const accessoriesOptions: AppearanceAccessories[] = [
    'none',
    'none',
    'none',
    'glasses',
    'none',
    'none',
    'sunglasses',
    'none',
  ]
  return {
    skinColor: APPEARANCE_SKIN_TONES[index % APPEARANCE_SKIN_TONES.length]!,
    hairColor: APPEARANCE_HAIR_COLORS[(index * 3) % APPEARANCE_HAIR_COLORS.length]!,
    head: APPEARANCE_HEAD_STYLES[index % APPEARANCE_HEAD_STYLES.length]!,
    face: APPEARANCE_FACES[(index * 3) % APPEARANCE_FACES.length]!,
    facialHair: facialHairOptions[index % facialHairOptions.length]!,
    accessories: accessoriesOptions[index % accessoriesOptions.length]!,
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

// Emoji are flavour, not skill markers. Each scenario offers 2–3 approaches; the labels
// are shown to players in the approach phase, but the skill behind each stays hidden —
// the wording of each label is the only clue. Descriptions are pure story: they must NOT
// telegraph the approaches (those are revealed after deployment, so the description is
// what players deploy on). Checks roll skill + d6 against the configured DC; rival
// houses at the same scenario contest the prize (highest passing total wins).
// successMessage/failureMessage are shown on the results screen next to that approach's
// outcome — one told per family per attended scenario, based on whether their check passed.
export const DEFAULT_SCENARIOS: ScenarioDesign[] = [
  // General
  { emoji: '🐎', title: 'Bandit Raid', description: 'Bandits are terrorising the roads around {town}. The merchants beg for aid.', location: 'general', approaches: [
    { label: 'Ride them down', skill: 'might', successMessage: 'Steel flashes and the bandits break, fleeing into the hills.', failureMessage: 'The bandits circle back before the line can hold, and the road stays unsafe.' },
    { label: 'Infiltrate their camp', skill: 'cunning', successMessage: 'A false trail is laid, and the bandits are led straight into a trap.', failureMessage: 'The disguise slips at the worst moment, and the camp turns hostile.' },
  ] },
  { emoji: '🏇', title: 'Jousting Tournament', description: 'A grand tourney is held at {town}, and every eye in the realm turns to watch.', location: 'general', approaches: [
    { label: 'Enter the lists', skill: 'might', successMessage: 'Lance meets shield with a crack the crowd will talk about for years.', failureMessage: 'A stumble at the tilt sends both horse and rider sprawling in the mud.' },
    { label: 'Dazzle the royal box', skill: 'charm', successMessage: 'Every bow and wave lands just right, and the royal box cannot look away.', failureMessage: 'The royal box yawns through the performance, unmoved.' },
  ] },
  { emoji: '🏴', title: 'Border Skirmish', description: 'Raiders from beyond the realm probe the defences of {town}.', location: 'general', approaches: [
    { label: 'Hold the wall', skill: 'might', successMessage: 'The line holds through every charge, and the raiders break off at dusk.', failureMessage: 'The wall gives ground, and the raiders press deeper before turning back.' },
    { label: 'Sabotage their supplies', skill: 'cunning', successMessage: 'Wagons of raider provisions go up in flame, and the raid loses its teeth.', failureMessage: 'The saboteurs are spotted before the powder catches, and the raid presses on.' },
  ] },
  { emoji: '🐗', title: 'Beast Hunt', description: 'A monstrous beast stalks the woods near {town}. None dare go out after dark.', location: 'general', approaches: [
    { label: 'Face it head-on', skill: 'might', successMessage: 'The beast falls to a well-placed blow, and the woods breathe easy again.', failureMessage: 'The beast proves too much, and the hunters limp home empty-handed.' },
    { label: 'Study its habits and lay a trap', skill: 'wit', successMessage: 'The trap springs true, and the beast is taken without a single blow struck.', failureMessage: 'The beast avoids every trap laid for it, wilier than expected.' },
  ] },
  { emoji: '🎭', title: 'Masquerade Ball', description: 'The nobility of {town} hosts a dazzling masquerade.', location: 'general', approaches: [
    { label: 'Be the talk of the ball', skill: 'charm', successMessage: 'Every mask turns to watch, and the night belongs to them.', failureMessage: 'The performance falls flat behind the mask, and the room moves on.' },
    { label: 'Trade whispers behind masks', skill: 'cunning', successMessage: 'A dozen secrets change hands before the unmasking, all of them useful.', failureMessage: 'The whispers lead nowhere, and no secret worth keeping is found.' },
  ] },
  { emoji: '💍', title: 'Noble Wedding', description: 'Two great houses wed at {town}. All eyes are on the guests.', location: 'general', approaches: [
    { label: 'Outshine the bridal party', skill: 'charm', successMessage: "Even the bride's own kin admit the day was stolen, graciously.", failureMessage: 'The bridal party outshines every attempt to steal their spotlight.' },
    { label: 'Toast both houses', skill: 'wit', successMessage: 'A toast so well-turned that both houses claim it as their own.', failureMessage: 'The toast lands awkwardly, and both houses politely say nothing.' },
  ] },
  { emoji: '📚', title: "Scholars' Symposium", description: 'Learned minds gather in {town} to debate the great questions.', location: 'general', approaches: [
    { label: 'Win the great debate', skill: 'wit', successMessage: 'The hall falls silent, then erupts — the debate is won outright.', failureMessage: 'The argument crumbles under questioning, and the hall is unconvinced.' },
    { label: 'Keep the rival schools civil', skill: 'charm', successMessage: 'Tempers are soothed before ink meets parchment, and the symposium survives.', failureMessage: 'The rival schools come to blows anyway, despite every effort to calm them.' },
  ] },
  { emoji: '🐀', title: 'Plague Outbreak', description: 'Sickness spreads through {town}. The gates may soon be barred.', location: 'general', approaches: [
    { label: 'Find the source', skill: 'wit', successMessage: 'The tainted well is found and sealed before the sickness can spread further.', failureMessage: 'The source stays hidden, and the sickness spreads through another street.' },
    { label: 'Calm the terrified town', skill: 'charm', successMessage: 'Word spreads that all is in hand, and the panic in the streets subsides.', failureMessage: 'The reassurances ring hollow, and the terrified town does not calm.' },
  ] },
  { emoji: '💎', title: 'Missing Heirloom', description: 'A precious relic has vanished in {town}. The reward for its return is generous.', location: 'general', reward: { type: 'gold', amount: 30 }, approaches: [
    { label: 'Follow the clues', skill: 'wit', successMessage: 'The trail leads straight to the relic, tucked away exactly where reason said it would be.', failureMessage: 'The clues lead in circles, and the relic remains lost.' },
    { label: 'Shake down the fences', skill: 'cunning', successMessage: 'A frightened fence gives up the relic without much persuading at all.', failureMessage: 'The fences close ranks, and not one of them talks.', buyoutCost: 30 },
  ] },
  { emoji: '⚖️', title: 'Trade Dispute', description: 'Merchants of {town} are at each other’s throats over a fortune in cargo.', location: 'general', reward: { type: 'gold', amount: 20 }, approaches: [
    { label: 'Broker a settlement', skill: 'charm', successMessage: 'Both sides shake hands, more or less satisfied, and the cargo finally moves.', failureMessage: 'Neither merchant will budge, and the settlement talks collapse.' },
    { label: 'Quietly rig the ledgers', skill: 'cunning', successMessage: 'The numbers are quietly adjusted, and the dispute resolves itself overnight.', failureMessage: 'The tampering is noticed almost immediately, and the dispute only worsens.' },
  ] },
  { emoji: '🕊️', title: 'Peace Talks', description: 'Feuding lords meet at {town} under a banner of truce.', location: 'general', approaches: [
    { label: 'Draft the truce', skill: 'wit', successMessage: 'The wording holds up to every objection, and both lords sign without complaint.', failureMessage: 'A single clause unravels the whole truce, and the lords storm off.' },
    { label: 'Soften hearts at the feast', skill: 'charm', successMessage: "By the last course, old grudges feel a little less worth dying over.", failureMessage: 'The feast turns tense, and old grudges resurface before dessert.' },
    { label: 'Blackmail both sides into peace', skill: 'cunning', successMessage: 'Neither lord dares risk what has been learned about them, and peace holds — for now.', failureMessage: 'The leverage is discovered, and both lords turn their anger on the meddler instead.' },
  ] },
  { emoji: '🌾', title: 'Harvest Festival', description: 'The people of {town} celebrate the harvest. Win their goodwill.', location: 'general', approaches: [
    { label: 'Crown the festival in style', skill: 'charm', successMessage: "The crowning is the talk of the festival, and the town's goodwill is won.", failureMessage: "The crowning falls flat, and the crowd's goodwill goes elsewhere." },
    { label: 'Judge the contests fairly', skill: 'wit', successMessage: 'Every ruling is sound, and the town trusts the judgment completely.', failureMessage: 'A disputed ruling sours the contests, and the town grumbles for days.' },
  ] },
  { emoji: '🕯️', title: 'Whispers of Treason', description: 'A plot brews in the back rooms of {town}.', location: 'general', approaches: [
    { label: 'Turn their spy', skill: 'cunning', successMessage: 'The spy switches sides quietly, and the plot is laid bare from within.', failureMessage: 'The spy plays along just long enough to vanish with the plot intact.', buyoutCost: 20 },
    { label: 'Kick down the door', skill: 'might', successMessage: 'The plotters are caught mid-scheme, with nowhere left to run.', failureMessage: 'The room is empty by the time the door gives way — someone was warned.' },
  ] },
  // Capital only
  { emoji: '👑', title: 'Coronation', description: 'A new monarch is crowned at {town}. The whole realm watches.', location: 'capital', approaches: [
    { label: 'Swear fealty with grace', skill: 'wit', successMessage: 'The oath is spoken so well that the new monarch remembers the name.', failureMessage: 'The words come out stiff and forgettable amid a hundred other oaths.' },
    { label: 'Steal the spotlight', skill: 'charm', successMessage: "For one dazzling moment, the coronation is theirs as much as the monarch's.", failureMessage: 'The spotlight refuses to be stolen, and the moment passes unnoticed.' },
    { label: 'Work the shadowed halls', skill: 'cunning', successMessage: 'While the crowd watches the crown, real favour is won in the corridors.', failureMessage: 'The corridors offer nothing but empty rooms and wasted time.' },
  ] },
  { emoji: '🏰', title: 'Royal Audience', description: 'The crown grants audiences at {town}. Favour hangs in the balance.', location: 'capital', approaches: [
    { label: 'Petition the crown', skill: 'wit', successMessage: "The petition is heard in full, and the crown's favour is granted.", failureMessage: "The petition is dismissed before it's even finished being read." },
    { label: 'Bribe the chamberlain', skill: 'cunning', successMessage: 'A quiet exchange in the antechamber, and the audience goes exactly as planned.', failureMessage: 'The chamberlain pockets the bribe and does nothing whatsoever in return.', buyoutCost: 20 },
  ] },
  { emoji: '🥂', title: "Queen's Gala", description: 'The Queen hosts a resplendent gala at {town}.', location: 'capital', approaches: [
    { label: 'Charm the court', skill: 'charm', successMessage: 'The court is thoroughly charmed, and word of it reaches the Queen herself.', failureMessage: 'The court remains politely, resolutely unimpressed.' },
    { label: 'Compose a verse for the Queen', skill: 'wit', successMessage: 'The Queen requests the verse be read a second time — high praise indeed.', failureMessage: "The verse falls flat, and the Queen's attention drifts elsewhere." },
  ] },
  // Home estates
  { emoji: '🏹', title: 'Poachers on the Estate', description: 'Poachers have been spotted on your lands near {town}.', location: 'home', approaches: [
    { label: 'Run them off', skill: 'might', successMessage: 'The poachers flee at the first show of force and do not return.', failureMessage: 'The poachers slip away into the trees, and the game keeps vanishing.' },
    { label: 'Set snares of your own', skill: 'cunning', successMessage: 'The poachers are caught in their own game, red-handed.', failureMessage: 'The snares catch nothing, and the poachers keep to their usual trails.' },
  ] },
  { emoji: '🍗', title: 'Feast for the Household', description: 'Your household at {town} expects a memorable feast.', location: 'home', approaches: [
    { label: 'Host with flair', skill: 'charm', successMessage: 'The household still talks about the feast weeks later.', failureMessage: 'The feast is passable at best, and the household says little about it.' },
    { label: 'Seat the rivals apart', skill: 'wit', successMessage: 'Careful seating keeps the peace, and the evening passes without incident.', failureMessage: 'The seating plan fails, and old rivals end up trading words across the table.' },
  ] },
  { emoji: '📜', title: 'Ledgers & Accounts', description: 'The estate books at {town} are in disarray — and the tax collector is due.', location: 'home', reward: { type: 'gold', amount: 20 }, approaches: [
    { label: 'Balance the books', skill: 'wit', successMessage: 'Every column adds up, and the tax collector finds nothing to complain about.', failureMessage: 'The numbers refuse to balance, no matter how many times they are checked.' },
    { label: 'Cook the books', skill: 'cunning', successMessage: 'The figures are quietly rewritten, and the collector is none the wiser.', failureMessage: "The forgery is clumsy, and the collector's eyebrow stays raised the whole visit.", buyoutCost: 20 },
  ] },
  { emoji: '🪨', title: 'Tenant Dispute', description: 'Two tenant farmers at {town} quarrel over a boundary stone.', location: 'home', approaches: [
    { label: 'Hear both farmers out', skill: 'charm', successMessage: 'Both farmers leave satisfied, and the boundary stone is forgotten.', failureMessage: 'Neither farmer feels heard, and the quarrel continues as loud as ever.' },
    { label: 'Survey the old maps', skill: 'wit', successMessage: 'The old maps settle the matter beyond any argument.', failureMessage: 'The old maps are unreadable or contradictory, and the dispute drags on.' },
  ] },
]
