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

// Emoji are flavour, not skill markers. Each scenario offers 2–4 approaches; the labels
// are shown to players in the approach phase, but the skill behind each stays hidden —
// the wording of each label is the only clue. A buyout approach (no `skill`, only a
// `buyoutCost`) stands as its own independent choice alongside the skill approaches — not
// a modifier on one of them — and pays gold for a flat bonus instead of a skill roll, so
// it needs its own success/failure flavour text like any other approach. Descriptions are
// pure story: they must NOT telegraph the approaches (those are revealed after deployment,
// so the description is what players deploy on). Checks roll skill + d6 (or the buyout
// bonus + d6) against the configured DC; rival houses at the same scenario contest the
// prize (highest passing total wins) — which may pay Influence, gold, or both, per
// `rewards` (absent means a single Influence-only reward; an approach can name a
// different entry via `rewardIndex`, default 0). successMessage/failureMessage are shown
// on the results screen next to that approach's outcome — one told per family per
// attended scenario, based on whether their check passed; {actor} is replaced with the
// name of the family member who attended.
export const DEFAULT_SCENARIOS: ScenarioDesign[] = [
  // General
  {
    emoji: '🐎', title: 'Bandit Raid', description: 'Bandits are terrorising the roads around {town}, and the merchants have put a bounty on their stolen loot.', location: 'general', rewards: [{ influence: false, gold: 20 }], approaches: [
      { label: 'Ride them down', skill: 'might', successMessage: '{actor} rides them down, steel flashing until the bandits break and leave their plunder in the mud.', failureMessage: '{actor} loses the bandits before the line can hold, and the loot goes with them.' },
      { label: 'Infiltrate their camp', skill: 'cunning', successMessage: '{actor} lays a false trail, leading the bandits away from their own hoard.', failureMessage: "{actor}'s disguise slips at the worst moment, and the camp turns hostile." },
    ],
  },
  {
    emoji: '🏇', title: 'Jousting Tournament', description: 'A grand tourney is held at {town}, and every eye in the realm turns to watch.', location: 'general', approaches: [
      { label: 'Enter the lists', skill: 'might', successMessage: "{actor}'s lance meets shield with a crack the crowd will talk about for years.", failureMessage: '{actor} stumbles at the tilt, sending both horse and rider sprawling in the mud.' },
      { label: 'Dazzle the royal box', skill: 'charm', successMessage: 'Every bow and wave from {actor} lands just right, and the royal box cannot look away.', failureMessage: '{actor} performs valiantly, but the royal box yawns through it, unmoved.' },
    ],
  },
  {
    emoji: '🏴', title: 'Border Skirmish', description: 'Raiders from beyond the realm probe the defences of {town}.', location: 'general', approaches: [
      { label: 'Hold the wall', skill: 'might', successMessage: "{actor} holds the line through every charge, and the raiders break off at dusk.", failureMessage: "{actor}'s line gives ground, and the raiders press deeper before turning back." },
      { label: 'Sabotage their supplies', skill: 'cunning', successMessage: '{actor} sets wagons of raider provisions ablaze, and the raid loses its teeth.', failureMessage: '{actor} is spotted before the powder catches, and the raid presses on.' },
    ],
  },
  {
    emoji: '🐗', title: 'Beast Hunt', description: 'A monstrous beast stalks the woods near {town}. None dare go out after dark.', location: 'general', approaches: [
      { label: 'Face it head-on', skill: 'might', successMessage: "{actor}'s blow lands true, and the woods breathe easy again.", failureMessage: '{actor} finds the beast is too much, and limps home empty-handed.' },
      { label: 'Study its habits and lay a trap', skill: 'wit', successMessage: "{actor}'s trap springs true, and the beast is taken without a single blow struck.", failureMessage: "{actor}'s trap goes unsprung — the beast is wilier than expected." },
    ],
  },
  {
    emoji: '🎭', title: 'Masquerade Ball', description: 'The nobility of {town} hosts a dazzling masquerade.', location: 'general', approaches: [
      { label: 'Be the talk of the ball', skill: 'charm', successMessage: 'Every mask turns to watch {actor}, and the night belongs to them.', failureMessage: "{actor}'s performance falls flat behind the mask, and the room moves on." },
      { label: 'Trade whispers behind masks', skill: 'cunning', successMessage: '{actor} trades a dozen secrets before the unmasking, all of them useful.', failureMessage: "{actor}'s whispers lead nowhere, and no secret worth keeping is found." },
    ],
  },
  {
    emoji: '💍', title: 'Noble Wedding', description: 'Two great houses wed at {town}. All eyes are on the guests.', location: 'general', approaches: [
      { label: 'Outshine the bridal party', skill: 'charm', successMessage: "Even the bride's own kin admit {actor} stole the day, graciously.", failureMessage: "The bridal party outshines every attempt {actor} makes to steal their spotlight." },
      { label: 'Toast both houses', skill: 'wit', successMessage: '{actor} raises a toast so well-turned that both houses claim it as their own.', failureMessage: "{actor}'s toast lands awkwardly, and both houses politely say nothing." },
    ],
  },
  {
    emoji: '📚', title: "Scholars' Symposium", description: 'Learned minds gather in {town} to debate the great questions.', location: 'general', approaches: [
      { label: 'Win the great debate', skill: 'wit', successMessage: 'The hall falls silent, then erupts — {actor} has won the debate outright.', failureMessage: "{actor}'s argument crumbles under questioning, and the hall is unconvinced." },
      { label: 'Keep the rival schools civil', skill: 'charm', successMessage: '{actor} soothes tempers before ink meets parchment, and the symposium survives.', failureMessage: "{actor}'s efforts fail — the rival schools come to blows anyway." },
    ],
  },
  {
    emoji: '🐀', title: 'Plague Outbreak', description: 'Sickness spreads through {town}. The gates may soon be barred.', location: 'general', approaches: [
      { label: 'Find the source', skill: 'wit', successMessage: '{actor} finds the tainted well and seals it before the sickness can spread further.', failureMessage: 'The source stays hidden from {actor}, and the sickness spreads through another street.' },
      { label: 'Calm the terrified town', skill: 'charm', successMessage: 'Word spreads from {actor} that all is in hand, and the panic in the streets subsides.', failureMessage: "{actor}'s reassurances ring hollow, and the terrified town does not calm." },
    ],
  },
  {
    emoji: '💎', title: 'Missing Heirloom', description: 'A precious relic has vanished in {town}. The reward for its return is generous.', location: 'general', rewards: [{ influence: true, gold: 30 }], approaches: [
      { label: 'Follow the clues', skill: 'wit', successMessage: '{actor} follows the trail straight to the relic, tucked away exactly where reason said it would be.', failureMessage: "{actor}'s clues lead in circles, and the relic remains lost." },
      { label: 'Shake down the fences', skill: 'cunning', successMessage: '{actor} shakes down a frightened fence, who gives up the relic without much persuading at all.', failureMessage: 'The fences close ranks against {actor}, and not one of them talks.' },
      { label: 'Pay a ransom for its return', buyoutCost: 30, successMessage: '{actor} pays a fat purse to loosen tongues, and the relic changes hands quietly before sundown.', failureMessage: "Word of {actor}'s offer spreads faster than the relic does, and someone else buys it first." },
    ],
  },
  {
    emoji: '⚖️', title: 'Trade Dispute', description: 'Merchants of {town} are at each other’s throats over a fortune in cargo.', location: 'general', rewards: [{ influence: false, gold: 20 }], approaches: [
      { label: 'Broker a settlement', skill: 'charm', successMessage: '{actor} brings both sides to a handshake, more or less satisfied, and the cargo finally moves.', failureMessage: 'Neither merchant will budge for {actor}, and the settlement talks collapse.' },
      { label: 'Quietly rig the ledgers', skill: 'cunning', successMessage: '{actor} quietly adjusts the numbers, and the dispute resolves itself overnight.', failureMessage: "{actor}'s tampering is noticed almost immediately, and the dispute only worsens." },
      { label: "Buy out both merchants' claims outright", buyoutCost: 20, successMessage: "{actor}'s coin settles what argument could not, and the cargo is theirs to sell on.", failureMessage: 'A third merchant swoops in with a better offer before {actor} can sign the deal.' },
    ],
  },
  {
    emoji: '🕊️', title: 'Peace Talks', description: 'Feuding lords meet at {town} under a banner of truce.', location: 'general', approaches: [
      { label: 'Draft the truce', skill: 'wit', successMessage: "{actor}'s wording holds up to every objection, and both lords sign without complaint.", failureMessage: "A single clause in {actor}'s truce unravels the whole thing, and the lords storm off." },
      { label: 'Soften hearts at the feast', skill: 'charm', successMessage: 'By the last course, {actor} has old grudges feeling a little less worth dying over.', failureMessage: 'The feast turns tense under {actor}, and old grudges resurface before dessert.' },
      { label: 'Blackmail both sides into peace', skill: 'cunning', successMessage: 'Neither lord dares risk what {actor} has learned about them, and peace holds — for now.', failureMessage: "{actor}'s leverage is discovered, and both lords turn their anger on the meddler instead." },
      { label: "Grease both lords' palms", buyoutCost: 30, successMessage: '{actor} passes gold under the table, and both lords discover peace suits them after all.', failureMessage: "One lord pockets {actor}'s gold and walks anyway, insulted the other was paid more." },
    ],
  },
  {
    emoji: '🌾', title: 'Harvest Festival', description: 'The people of {town} celebrate the harvest. Win their goodwill.', location: 'general', approaches: [
      { label: 'Crown the festival in style', skill: 'charm', successMessage: "{actor}'s crowning is the talk of the festival, and the town's goodwill is won.", failureMessage: "{actor}'s crowning falls flat, and the crowd's goodwill goes elsewhere." },
      { label: 'Judge the contests fairly', skill: 'wit', successMessage: "Every ruling from {actor} is sound, and the town trusts the judgment completely.", failureMessage: 'A disputed ruling from {actor} sours the contests, and the town grumbles for days.' },
    ],
  },
  {
    emoji: '🕯️', title: 'Whispers of Treason', description: 'A plot brews in the back rooms of {town}.', location: 'general', approaches: [
      { label: 'Turn their spy', skill: 'cunning', successMessage: '{actor} turns the spy quietly, and the plot is laid bare from within.', failureMessage: 'The spy plays along just long enough to vanish with the plot intact, outwitting {actor}.' },
      { label: 'Kick down the door', skill: 'might', successMessage: '{actor} kicks down the door and catches the plotters mid-scheme, with nowhere left to run.', failureMessage: 'The room is empty by the time {actor} breaks the door — someone was warned.' },
      { label: 'Pay the plotters to turn on each other', buyoutCost: 20, successMessage: "{actor}'s gold proves a better argument than loyalty, and the plotters betray one another by morning.", failureMessage: "The plotters take {actor}'s coin, promise everything, and deliver nothing." },
    ],
  },
  {
    emoji: '💰', title: "Smugglers' Cache", description: 'Rumour says a smugglers’ cache lies hidden somewhere near {town}, still unclaimed.', location: 'general', rewards: [{ influence: false, gold: 30 }], approaches: [
      { label: "Track the smugglers' route", skill: 'wit', successMessage: '{actor} follows the trail of hoofprints and broken twigs straight to the cache.', failureMessage: 'The trail goes cold at a stream crossing, and {actor} loses the cache.' },
      { label: 'Muscle the truth out of a lookout', skill: 'might', successMessage: "{actor}'s firm hand and firmer glare loosen the lookout's tongue soon enough.", failureMessage: 'The lookout would rather take a beating from {actor} than talk, and says nothing.' },
      { label: 'Buy the map off a turncoat smuggler', buyoutCost: 20, successMessage: 'The map {actor} bought is genuine, and the cache is exactly where it promises.', failureMessage: 'The "map" {actor} bought turns out to be an old bar tab sketched on the back — a costly joke.' },
    ],
  },
  // Capital only
  {
    emoji: '👑', title: 'Coronation', description: 'A new monarch is crowned at {town}. The whole realm watches.', location: 'capital', approaches: [
      { label: 'Swear fealty with grace', skill: 'wit', successMessage: "{actor}'s oath is spoken so well that the new monarch remembers the name.", failureMessage: "{actor}'s words come out stiff and forgettable amid a hundred other oaths." },
      { label: 'Steal the spotlight', skill: 'charm', successMessage: 'For one dazzling moment, the coronation belongs to {actor} as much as the monarch.', failureMessage: '{actor} cannot steal the spotlight, and the moment passes unnoticed.' },
      { label: 'Work the shadowed halls', skill: 'cunning', successMessage: 'While the crowd watches the crown, {actor} wins real favour in the corridors.', failureMessage: '{actor} finds the corridors offer nothing but empty rooms and wasted time.' },
    ],
  },
  {
    emoji: '🏰', title: 'Royal Audience', description: 'The crown grants audiences at {town}. Favour hangs in the balance.', location: 'capital', rewards: [{ influence: true, gold: 20 }], approaches: [
      { label: 'Petition the crown', skill: 'wit', successMessage: "{actor}'s petition is heard in full, and the crown's favour is granted.", failureMessage: "{actor}'s petition is dismissed before it's even finished being read." },
      { label: 'Call in a favour from an old ally at court', skill: 'cunning', successMessage: "A quiet word from {actor}'s well-placed friend, and the audience is granted at once.", failureMessage: "{actor}'s old ally has fallen out of favour too, and can do nothing after all." },
      { label: 'Bribe the chamberlain outright', buyoutCost: 20, successMessage: "{actor}'s quiet exchange in the antechamber goes exactly as planned, and coin flows back their way besides.", failureMessage: "The chamberlain pockets {actor}'s bribe and does nothing whatsoever in return." },
    ],
  },
  {
    emoji: '🥂', title: "Queen's Gala", description: 'The Queen hosts a resplendent gala at {town}.', location: 'capital', approaches: [
      { label: 'Charm the court', skill: 'charm', successMessage: '{actor} thoroughly charms the court, and word of it reaches the Queen herself.', failureMessage: 'The court remains politely, resolutely unimpressed with {actor}.' },
      { label: 'Compose a verse for the Queen', skill: 'wit', successMessage: "The Queen requests {actor}'s verse be read a second time — high praise indeed.", failureMessage: "{actor}'s verse falls flat, and the Queen's attention drifts elsewhere." },
    ],
  },
  // Home estates
  {
    emoji: '🏹', title: 'Poachers on the Estate', description: 'Poachers have been spotted on your lands near {town}.', location: 'home', approaches: [
      { label: 'Run them off', skill: 'might', successMessage: "The poachers flee at {actor}'s first show of force and do not return.", failureMessage: 'The poachers slip past {actor} into the trees, and the game keeps vanishing.' },
      { label: 'Set snares of your own', skill: 'cunning', successMessage: '{actor} catches the poachers in their own game, red-handed.', failureMessage: "{actor}'s snares catch nothing, and the poachers keep to their usual trails." },
    ],
  },
  {
    emoji: '🍗', title: 'Feast for the Household', description: 'Your household at {town} expects a memorable feast.', location: 'home', approaches: [
      { label: 'Host with flair', skill: 'charm', successMessage: "The household still talks about {actor}'s feast weeks later.", failureMessage: "{actor}'s feast is passable at best, and the household says little about it." },
      { label: 'Seat the rivals apart', skill: 'wit', successMessage: "{actor}'s careful seating keeps the peace, and the evening passes without incident.", failureMessage: "{actor}'s seating plan fails, and old rivals end up trading words across the table." },
    ],
  },
  {
    emoji: '📜', title: 'Ledgers & Accounts', description: 'The estate books at {town} are in disarray — and the tax collector is due.', location: 'home', rewards: [{ influence: false, gold: 20 }], approaches: [
      { label: 'Balance the books', skill: 'wit', successMessage: 'Every column {actor} adds up, and the tax collector finds nothing to complain about.', failureMessage: 'The numbers refuse to balance no matter how many times {actor} checks them.' },
      { label: 'Cook the books', skill: 'cunning', successMessage: '{actor} quietly rewrites the figures, and the collector is none the wiser.', failureMessage: "{actor}'s forgery is clumsy, and the collector's eyebrow stays raised the whole visit." },
      { label: 'Cover the shortfall out of pocket', buyoutCost: 20, successMessage: "The collector counts {actor}'s coin, nods once, and troubles the estate no further.", failureMessage: "The collector counts {actor}'s coin twice, finds it short anyway, and levies a fine besides." },
    ],
  },
  {
    emoji: '🪨', title: 'Tenant Dispute', description: 'Two tenant farmers at {town} quarrel over a boundary stone.', location: 'home', approaches: [
      { label: 'Hear both farmers out', skill: 'charm', successMessage: "Both farmers leave satisfied with {actor}'s judgment, and the boundary stone is forgotten.", failureMessage: 'Neither farmer feels heard by {actor}, and the quarrel continues as loud as ever.' },
      { label: 'Survey the old maps', skill: 'wit', successMessage: '{actor} settles the matter beyond any argument with the old maps.', failureMessage: 'The old maps {actor} finds are unreadable or contradictory, and the dispute drags on.' },
    ],
  },
  {
    emoji: '🗝️', title: 'Buried Family Fortune', description: "Family legend swears a strongbox lies buried somewhere on the {town} estate.", location: 'home', rewards: [{ influence: true, gold: 30 }], approaches: [
      { label: "Puzzle out grandfather's old riddle", skill: 'wit', successMessage: 'The riddle finally clicks for {actor}, and the spade strikes wood on the very first try.', failureMessage: '{actor} discovers too late that the riddle describes a landmark torn down decades ago.' },
      { label: 'Dig up every likely spot yourself', skill: 'might', successMessage: 'After a long, filthy afternoon of digging, {actor} finally turns up the strongbox.', failureMessage: '{actor} leaves the estate pockmarked with holes, and not one of them holds anything.' },
      { label: 'Hire a diviner to point the way', buyoutCost: 20, successMessage: "The diviner's rod {actor} hired dips sharply, and the strongbox is exactly where it points.", failureMessage: '{actor} hired a diviner who is confident, theatrical, and completely wrong.' },
    ],
  },
]
