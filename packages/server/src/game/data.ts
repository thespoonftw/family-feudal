import type {
  AppearanceAccessories,
  AppearanceFace,
  AppearanceFacialHair,
  HouseDesign,
  MemberAppearance,
  MemberDesign,
  OccupationDesign,
  ScenarioDesign,
  SkillDesign,
  TraitDesign,
} from '@family-feudal/shared'
import {
  APPEARANCE_FACES,
  APPEARANCE_HAIR_COLORS,
  APPEARANCE_HEAD_STYLES,
  APPEARANCE_SKIN_TONES,
} from '@family-feudal/shared'

// rounds/scenarios/max-players are runtime-tunable — see config.ts
// the skill catalog, trait catalog, houses (incl. their fixed 3-character rosters), and
// scenarios are designable — see content.ts
export const MIN_PLAYERS = 1

// the default skill catalog — each carries a description (dev-panel only, never shown to
// players) to help a designer, human or AI, write traits/scenario approaches that test
// the right skill
export const DEFAULT_SKILLS: SkillDesign[] = [
  { key: 'physique', description: 'Intimidation, feats of strength, and athleticism.' },
  { key: 'battle', description: 'Skill at arms — swordplay, brawling, and combat prowess.' },
  { key: 'nimble', description: 'Dodging, evasion, stealth, and pickpocketing.' },
  { key: 'wilderness', description: 'Flora, fauna, survival, tents, tracking, and first aid.' },
  { key: 'academic', description: 'Literacy, reading, history, logistics, and medicine.' },
  { key: 'ingenuity', description: 'Creative solutions and clever improvisation.' },
  { key: 'investigation', description: 'Searching a location, solving a mystery, seeing through lies.' },
  { key: 'intrigue', description: 'Blackmail, deception, lying, social manipulation, and bribery.' },
  { key: 'negotiation', description: 'Haggling, striking a deal, social navigation, and diplomacy.' },
  { key: 'charm', description: 'Likeability, beauty, performance, public image, and calling in favors.' },
  { key: 'leadership', description: 'Rallying troops, using clout, giving speeches, and gathering forces.' },
]

// the default trait catalog — one flat +3 bonus per original skill, so the stock roster
// (each member assigned 3 of these) reproduces the game's original might/charm/wit/cunning
// spread of "3 skills built up, 1 left at the base value"
export const DEFAULT_TRAITS: TraitDesign[] = [
  { name: 'Battle-hardened', bonuses: [{ skill: 'might', amount: 3 }] },
  { name: 'Silver Tongue', bonuses: [{ skill: 'charm', amount: 3 }] },
  { name: 'Sharp Mind', bonuses: [{ skill: 'wit', amount: 3 }] },
  { name: 'Scheming', bonuses: [{ skill: 'cunning', amount: 3 }] },
]

// the default occupation catalog — a single placeholder entry; occupations behave the
// same as traits for now (not yet assigned to members anywhere)
export const DEFAULT_OCCUPATIONS: OccupationDesign[] = [
  { name: 'Farmhand', bonuses: [{ skill: 'physique', amount: 1 }] },
]

export const CAPITAL_ID = 'capital'
export const CAPITAL_NAME = 'Kingsreach'
/** the crown's own colour — matches the capital's marker on the realm map */
export const CAPITAL_COLOR = '#c9a227'

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
  { id: 'city-1', x: 50, y: 12 },
  { id: 'city-2', x: 83, y: 31 },
  { id: 'city-3', x: 83, y: 69 },
  { id: 'city-4', x: 50, y: 88 },
  { id: 'city-5', x: 17, y: 69 },
  { id: 'city-6', x: 17, y: 31 },
]

// The four unowned wild locations at the map's corners — no family holds reputation
// there, and their scenarios never affect Influence (gold rewards only). Unlike city
// slots, wild slots carry their own fixed name (no house is ever assigned to one).
export interface WildSlot extends MapSlot {
  name: string
}

export const WILD_SLOTS: WildSlot[] = [
  { id: 'wild-peaks', name: 'Blue Peaks', x: 6, y: 6 },
  { id: 'wild-sea', name: 'The Great Sea', x: 94, y: 6 },
  { id: 'wild-forest', name: 'Darkwood', x: 6, y: 94 },
  { id: 'wild-wastes', name: 'The Wastes', x: 94, y: 94 },
]

// Each house's fixed roster of MEMBERS_PER_HOUSE characters — name + up to
// MAX_TRAITS_PER_MEMBER assigned traits (skills are derived from these, see
// computeMemberSkills). No longer rolled at game start; edited from the dev panel like
// everything else here.
/** a house roster before its portrait defaults are attached — see {@link withAppearance} */
type MemberSeed = Omit<MemberDesign, 'appearance'>

const ASHFORD_MEMBERS: MemberSeed[] = [
  { name: 'Aldric', traits: ['Scheming', 'Silver Tongue', 'Sharp Mind'] },
  { name: 'Beatrice', traits: ['Scheming', 'Sharp Mind', 'Battle-hardened'] },
  { name: 'Cedric', traits: ['Scheming', 'Battle-hardened', 'Silver Tongue'] },
]

const BELMONT_MEMBERS: MemberSeed[] = [
  { name: 'Daphne', traits: ['Silver Tongue', 'Scheming', 'Battle-hardened'] },
  { name: 'Edmund', traits: ['Battle-hardened', 'Silver Tongue', 'Scheming'] },
  { name: 'Freya', traits: ['Sharp Mind', 'Silver Tongue', 'Scheming'] },
]

const CALDWELL_MEMBERS: MemberSeed[] = [
  { name: 'Godwin', traits: ['Battle-hardened', 'Sharp Mind', 'Scheming'] },
  { name: 'Helena', traits: ['Sharp Mind', 'Battle-hardened', 'Silver Tongue'] },
  { name: 'Isolde', traits: ['Silver Tongue', 'Battle-hardened', 'Sharp Mind'] },
]

const DRAYMOOR_MEMBERS: MemberSeed[] = [
  { name: 'Jasper', traits: ['Silver Tongue', 'Scheming', 'Battle-hardened'] },
  { name: 'Katherine', traits: ['Sharp Mind', 'Scheming', 'Battle-hardened'] },
  { name: 'Leopold', traits: ['Silver Tongue', 'Sharp Mind', 'Scheming'] },
]

const EVERLY_MEMBERS: MemberSeed[] = [
  { name: 'Margaery', traits: ['Silver Tongue', 'Sharp Mind', 'Scheming'] },
  { name: 'Nathaniel', traits: ['Scheming', 'Silver Tongue', 'Battle-hardened'] },
  { name: 'Odette', traits: ['Silver Tongue', 'Scheming', 'Battle-hardened'] },
]

const FENWICK_MEMBERS: MemberSeed[] = [
  { name: 'Percival', traits: ['Battle-hardened', 'Silver Tongue', 'Sharp Mind'] },
  { name: 'Quinn', traits: ['Scheming', 'Sharp Mind', 'Silver Tongue'] },
  { name: 'Rosalind', traits: ['Battle-hardened', 'Silver Tongue', 'Scheming'] },
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
]

// Emoji are flavour, not skill markers. Each scenario offers 2–4 approaches; the labels
// are shown to players in the approach phase, but the skill behind each stays hidden —
// the wording of each label is the only clue. A buyout approach (no `skill`, only a
// `buyoutTier`) stands as its own independent choice alongside the skill approaches — not
// a modifier on one of them — and pays gold for a flat bonus instead of a skill roll, so
// it needs its own success/failure flavour text like any other approach. Descriptions are
// pure story: they must NOT telegraph the approaches (those are revealed after deployment,
// so the description is what players deploy on). Checks roll skill + d6 (or the buyout
// bonus + d6) against the configured DC; rival houses at the same scenario contest the
// prize (highest passing total wins). Each approach carries its own success reward tier
// (Influence/gold, granted to the winner) and failure consequence tier (Influence/gold,
// lost by anyone who fails the check outright) — see `successInfluence`/`successGold`/
// `failureInfluence`/`failureGold` on {@link ApproachDesign}; 'none' means no effect.
// successMessage/failureMessage are shown on the results screen next to that approach's
// outcome — one told per family per attended scenario, based on whether their check
// passed; {actor} is replaced with the name of the family member who attended.
const NO_CONSEQUENCE = { failureInfluence: 'none', failureGold: 'none', failureInjury: false } as const

export const DEFAULT_SCENARIOS: ScenarioDesign[] = [
  // General
  {
    emoji: '🐎', title: 'Bandit Raid', description: 'Bandits are terrorising the roads, and the merchants have put a bounty on their stolen loot.', preposition: 'near', location: 'general', approaches: [
      { label: 'Ride them down', skill: 'battle', successMessage: '{actor} rides them down, steel flashing until the bandits break and leave their plunder in the mud.', failureMessage: '{actor} presses the charge too hard and takes a blade across the arm before the bandits vanish with the loot.', successInfluence: 'none', successGold: 'medium', failureInfluence: 'none', failureGold: 'none', failureInjury: true },
      { label: 'Infiltrate their camp', skill: 'intrigue', successMessage: '{actor} lays a false trail, leading the bandits away from their own hoard.', failureMessage: "{actor}'s disguise slips at the worst moment, and the camp turns hostile.", successInfluence: 'none', successGold: 'small', ...NO_CONSEQUENCE },
    ],
  },
  {
    emoji: '🏇', title: 'Jousting Tournament', description: 'A grand tourney is held, and every eye in the realm turns to watch.', preposition: 'in', location: 'general', approaches: [
      { label: 'Enter the lists', skill: 'battle', successMessage: "{actor}'s lance meets shield with a crack the crowd will talk about for years.", failureMessage: '{actor} stumbles at the tilt, sending both horse and rider sprawling in the mud — a bruising fall to end the day on.', successInfluence: 'medium', successGold: 'none', failureInfluence: 'none', failureGold: 'none', failureInjury: true },
      { label: 'Dazzle the royal box', skill: 'charm', successMessage: 'Every bow and wave from {actor} lands just right, and the royal box cannot look away.', failureMessage: '{actor} performs valiantly, but the royal box yawns through it, unmoved.', successInfluence: 'small', successGold: 'none', ...NO_CONSEQUENCE },
    ],
  },
  {
    emoji: '🏴', title: 'Border Skirmish', description: 'Raiders from beyond the realm probe the local defences.', preposition: 'near', location: 'general', approaches: [
      { label: 'Hold the wall', skill: 'battle', successMessage: "{actor} holds the line through every charge, and the raiders break off at dusk.", failureMessage: "{actor}'s line gives ground under the charge, and a raider's blade finds its mark before they turn back.", successInfluence: 'medium', successGold: 'none', failureInfluence: 'none', failureGold: 'none', failureInjury: true },
      { label: 'Sabotage their supplies', skill: 'nimble', successMessage: '{actor} sets wagons of raider provisions ablaze, and the raid loses its teeth.', failureMessage: '{actor} is spotted before the powder catches, and the raid presses on.', successInfluence: 'small', successGold: 'none', ...NO_CONSEQUENCE },
    ],
  },
  {
    emoji: '🐗', title: 'Beast Hunt', description: 'A monstrous beast stalks the nearby woods. None dare go out after dark.', preposition: 'near', location: 'general', approaches: [
      { label: 'Face it head-on', skill: 'battle', successMessage: "{actor}'s blow lands true, and the woods breathe easy again.", failureMessage: '{actor} finds the beast is too much, and limps home bloodied and empty-handed.', successInfluence: 'medium', successGold: 'none', failureInfluence: 'none', failureGold: 'none', failureInjury: true },
      { label: 'Study its habits and lay a trap', skill: 'wilderness', successMessage: "{actor}'s trap springs true, and the beast is taken without a single blow struck.", failureMessage: "{actor}'s trap goes unsprung — the beast is wilier than expected.", successInfluence: 'small', successGold: 'none', ...NO_CONSEQUENCE },
    ],
  },
  {
    emoji: '🎭', title: 'Masquerade Ball', description: 'The local nobility hosts a dazzling masquerade.', preposition: 'in', location: 'general', approaches: [
      { label: 'Be the talk of the ball', skill: 'charm', successMessage: 'Every mask turns to watch {actor}, and the night belongs to them.', failureMessage: "{actor}'s performance falls flat behind the mask, and the room moves on.", successInfluence: 'small', successGold: 'none', ...NO_CONSEQUENCE },
      { label: 'Trade whispers behind masks', skill: 'intrigue', successMessage: '{actor} trades a dozen secrets before the unmasking, all of them useful.', failureMessage: '{actor} trades one whisper too many, and by morning it is their own secret being repeated across the ballroom.', successInfluence: 'medium', successGold: 'none', failureInfluence: 'small', failureGold: 'none', failureInjury: false },
    ],
  },
  {
    emoji: '💍', title: 'Noble Wedding', description: 'Two great houses wed here. All eyes are on the guests.', preposition: 'in', location: 'general', approaches: [
      { label: 'Outshine the bridal party', skill: 'charm', successMessage: "Even the bride's own kin admit {actor} stole the day, graciously.", failureMessage: "The bridal party outshines every attempt {actor} makes to steal their spotlight.", successInfluence: 'small', successGold: 'none', ...NO_CONSEQUENCE },
      { label: 'Toast both houses', skill: 'negotiation', successMessage: '{actor} raises a toast so well-turned that both houses claim it as their own.', failureMessage: "{actor}'s toast lands awkwardly, and both houses politely say nothing.", successInfluence: 'small', successGold: 'none', ...NO_CONSEQUENCE },
    ],
  },
  {
    emoji: '📚', title: "Scholars' Symposium", description: 'Learned minds gather to debate the great questions.', preposition: 'in', location: 'general', approaches: [
      { label: 'Win the great debate', skill: 'academic', successMessage: 'The hall falls silent, then erupts — {actor} has won the debate outright.', failureMessage: "{actor}'s argument crumbles under questioning, and the hall's laughter follows them out the door.", successInfluence: 'medium', successGold: 'none', failureInfluence: 'small', failureGold: 'none', failureInjury: false },
      { label: 'Keep the rival schools civil', skill: 'negotiation', successMessage: '{actor} soothes tempers before ink meets parchment, and the symposium survives.', failureMessage: "{actor}'s efforts fail — the rival schools come to blows anyway.", successInfluence: 'small', successGold: 'none', ...NO_CONSEQUENCE },
    ],
  },
  {
    emoji: '🐀', title: 'Plague Outbreak', description: 'Sickness spreads through the streets. The gates may soon be barred.', preposition: 'in', location: 'general', approaches: [
      { label: 'Find the source', skill: 'investigation', successMessage: '{actor} finds the tainted well and seals it before the sickness can spread further.', failureMessage: 'The source stays hidden from {actor}, who comes down with a fever of their own for the trouble.', successInfluence: 'medium', successGold: 'none', failureInfluence: 'none', failureGold: 'none', failureInjury: true },
      { label: 'Calm the terrified town', skill: 'charm', successMessage: 'Word spreads from {actor} that all is in hand, and the panic in the streets subsides.', failureMessage: "{actor}'s reassurances ring hollow, and the terrified town does not calm.", successInfluence: 'small', successGold: 'none', ...NO_CONSEQUENCE },
    ],
  },
  {
    emoji: '💎', title: 'Missing Heirloom', description: 'A precious relic has vanished. The reward for its return is generous.', preposition: 'in', location: 'general', approaches: [
      { label: 'Follow the clues', skill: 'investigation', successMessage: '{actor} follows the trail straight to the relic, tucked away exactly where reason said it would be.', failureMessage: "{actor}'s clues lead in circles, and the relic remains lost.", successInfluence: 'small', successGold: 'small', ...NO_CONSEQUENCE },
      { label: 'Shake down the fences', skill: 'intrigue', successMessage: '{actor} shakes down a frightened fence, who gives up the relic without much persuading at all.', failureMessage: 'The fences close ranks against {actor}, and send them off with a few new bruises for their trouble.', successInfluence: 'small', successGold: 'medium', failureInfluence: 'none', failureGold: 'none', failureInjury: true },
      { label: 'Pay a ransom for its return', buyoutTier: 'small', successMessage: '{actor} pays a fat purse to loosen tongues, and the relic changes hands quietly before sundown.', failureMessage: "Word of {actor}'s offer spreads faster than the relic does, and someone else buys it first.", successInfluence: 'small', successGold: 'none', ...NO_CONSEQUENCE },
    ],
  },
  {
    emoji: '⚖️', title: 'Trade Dispute', description: 'Local merchants are at each other’s throats over a fortune in cargo.', preposition: 'in', location: 'general', approaches: [
      { label: 'Broker a settlement', skill: 'negotiation', successMessage: '{actor} brings both sides to a handshake, more or less satisfied, and the cargo finally moves.', failureMessage: 'Neither merchant will budge for {actor}, and the settlement talks collapse.', successInfluence: 'none', successGold: 'small', ...NO_CONSEQUENCE },
      { label: 'Quietly rig the ledgers', skill: 'intrigue', successMessage: '{actor} quietly adjusts the numbers, and the dispute resolves itself overnight.', failureMessage: "{actor}'s tampering is noticed almost immediately, and the fine for it comes straight from their own purse.", successInfluence: 'none', successGold: 'medium', failureInfluence: 'none', failureGold: 'small', failureInjury: false },
      { label: "Buy out both merchants' claims outright", buyoutTier: 'small', successMessage: "{actor}'s coin settles what argument could not, and the cargo is theirs to sell on.", failureMessage: 'A third merchant swoops in with a better offer before {actor} can sign the deal.', successInfluence: 'small', successGold: 'none', ...NO_CONSEQUENCE },
    ],
  },
  {
    emoji: '🕊️', title: 'Peace Talks', description: 'Feuding lords meet under a banner of truce.', preposition: 'near', location: 'general', approaches: [
      { label: 'Draft the truce', skill: 'academic', successMessage: "{actor}'s wording holds up to every objection, and both lords sign without complaint.", failureMessage: "A single clause in {actor}'s truce unravels the whole thing, and the lords storm off.", successInfluence: 'small', successGold: 'none', ...NO_CONSEQUENCE },
      { label: 'Soften hearts at the feast', skill: 'charm', successMessage: 'By the last course, {actor} has old grudges feeling a little less worth dying over.', failureMessage: 'The feast turns tense under {actor}, and old grudges resurface before dessert.', successInfluence: 'small', successGold: 'none', ...NO_CONSEQUENCE },
      { label: 'Blackmail both sides into peace', skill: 'intrigue', successMessage: 'Neither lord dares risk what {actor} has learned about them, and peace holds — for now.', failureMessage: "{actor}'s leverage is discovered, and both lords turn their anger — and their courts — on the meddler instead.", successInfluence: 'medium', successGold: 'none', failureInfluence: 'small', failureGold: 'none', failureInjury: false },
      { label: "Grease both lords' palms", buyoutTier: 'small', successMessage: '{actor} passes gold under the table, and both lords discover peace suits them after all.', failureMessage: "One lord pockets {actor}'s gold and walks anyway, insulted the other was paid more.", successInfluence: 'small', successGold: 'none', ...NO_CONSEQUENCE },
    ],
  },
  {
    emoji: '🌾', title: 'Harvest Festival', description: 'The people celebrate the harvest. Win their goodwill.', preposition: 'in', location: 'general', approaches: [
      { label: 'Crown the festival in style', skill: 'charm', successMessage: "{actor}'s crowning is the talk of the festival, and the town's goodwill is won.", failureMessage: "{actor}'s crowning falls flat, and the crowd's goodwill goes elsewhere.", successInfluence: 'small', successGold: 'none', ...NO_CONSEQUENCE },
      { label: 'Judge the contests fairly', skill: 'leadership', successMessage: "Every ruling from {actor} is sound, and the town trusts the judgment completely.", failureMessage: 'A disputed ruling from {actor} sours the contests, and the town grumbles for days.', successInfluence: 'small', successGold: 'none', ...NO_CONSEQUENCE },
    ],
  },
  {
    emoji: '🕯️', title: 'Whispers of Treason', description: 'A plot brews in the back rooms of a local tavern.', preposition: 'in', location: 'general', approaches: [
      { label: 'Turn their spy', skill: 'intrigue', successMessage: '{actor} turns the spy quietly, and the plot is laid bare from within.', failureMessage: 'The spy plays along just long enough to vanish with the plot intact, outwitting {actor}.', successInfluence: 'small', successGold: 'none', ...NO_CONSEQUENCE },
      { label: 'Kick down the door', skill: 'battle', successMessage: '{actor} kicks down the door and catches the plotters mid-scheme, with nowhere left to run.', failureMessage: 'The room is empty by the time {actor} breaks the door, and the splintered frame leaves a nasty gash to show for it.', successInfluence: 'medium', successGold: 'none', failureInfluence: 'none', failureGold: 'none', failureInjury: true },
      { label: 'Pay the plotters to turn on each other', buyoutTier: 'small', successMessage: "{actor}'s gold proves a better argument than loyalty, and the plotters betray one another by morning.", failureMessage: "The plotters take {actor}'s coin, promise everything, and deliver nothing.", successInfluence: 'small', successGold: 'none', ...NO_CONSEQUENCE },
    ],
  },
  {
    emoji: '💰', title: "Smugglers' Cache", description: 'Rumour says a smugglers’ cache lies hidden nearby, still unclaimed.', preposition: 'near', location: 'general', approaches: [
      { label: "Track the smugglers' route", skill: 'wilderness', successMessage: '{actor} follows the trail of hoofprints and broken twigs straight to the cache.', failureMessage: 'The trail goes cold at a stream crossing, and {actor} loses the cache.', successInfluence: 'none', successGold: 'small', ...NO_CONSEQUENCE },
      { label: 'Muscle the truth out of a lookout', skill: 'physique', successMessage: "{actor}'s firm hand and firmer glare loosen the lookout's tongue soon enough.", failureMessage: 'The lookout gives as good as they get, and {actor} limps away with a beating of their own and no answers.', successInfluence: 'none', successGold: 'medium', failureInfluence: 'none', failureGold: 'none', failureInjury: true },
      { label: 'Buy the map off a turncoat smuggler', buyoutTier: 'small', successMessage: 'The map {actor} bought is genuine, and the cache is exactly where it promises.', failureMessage: 'The "map" {actor} bought turns out to be an old bar tab sketched on the back — a costly joke.', successInfluence: 'small', successGold: 'none', ...NO_CONSEQUENCE },
    ],
  },
  // Capital only
  {
    emoji: '👑', title: 'Coronation', description: 'A new monarch is crowned. The whole realm watches.', preposition: 'in', location: 'capital', approaches: [
      { label: 'Swear fealty with grace', skill: 'leadership', successMessage: "{actor}'s oath is spoken so well that the new monarch remembers the name.", failureMessage: "{actor}'s words come out stiff and forgettable amid a hundred other oaths.", successInfluence: 'small', successGold: 'none', ...NO_CONSEQUENCE },
      { label: 'Steal the spotlight', skill: 'charm', successMessage: 'For one dazzling moment, the coronation belongs to {actor} as much as the monarch.', failureMessage: '{actor} cannot steal the spotlight, and the moment passes unnoticed.', successInfluence: 'small', successGold: 'none', ...NO_CONSEQUENCE },
      { label: 'Work the shadowed halls', skill: 'intrigue', successMessage: 'While the crowd watches the crown, {actor} wins real favour in the corridors.', failureMessage: '{actor} is caught skulking in the shadowed halls, and word of it reaches the wrong ears.', successInfluence: 'medium', successGold: 'none', failureInfluence: 'small', failureGold: 'none', failureInjury: false },
    ],
  },
  {
    emoji: '🏰', title: 'Royal Audience', description: 'The crown grants audiences. Favour hangs in the balance.', preposition: 'in', location: 'capital', approaches: [
      { label: 'Petition the crown', skill: 'negotiation', successMessage: "{actor}'s petition is heard in full, and the crown's favour is granted.", failureMessage: "{actor}'s petition is dismissed before it's even finished being read.", successInfluence: 'small', successGold: 'small', ...NO_CONSEQUENCE },
      { label: 'Call in a favour from an old ally at court', skill: 'intrigue', successMessage: "A quiet word from {actor}'s well-placed friend, and the audience is granted at once.", failureMessage: "{actor}'s old ally has fallen further from favour than anyone knew, and the association costs {actor} standing of their own.", successInfluence: 'small', successGold: 'medium', failureInfluence: 'small', failureGold: 'none', failureInjury: false },
      { label: 'Bribe the chamberlain outright', buyoutTier: 'small', successMessage: "{actor}'s quiet exchange in the antechamber goes exactly as planned, and the chamberlain remembers the name.", failureMessage: "The chamberlain pockets {actor}'s bribe and does nothing whatsoever in return.", successInfluence: 'small', successGold: 'none', ...NO_CONSEQUENCE },
    ],
  },
  {
    emoji: '🥂', title: "Queen's Gala", description: 'The Queen hosts a resplendent gala.', preposition: 'in', location: 'capital', approaches: [
      { label: 'Charm the court', skill: 'charm', successMessage: '{actor} thoroughly charms the court, and word of it reaches the Queen herself.', failureMessage: 'The court remains politely, resolutely unimpressed with {actor}.', successInfluence: 'small', successGold: 'none', ...NO_CONSEQUENCE },
      { label: 'Compose a verse for the Queen', skill: 'academic', successMessage: "The Queen requests {actor}'s verse be read a second time — high praise indeed.", failureMessage: "{actor}'s verse falls flat, and the Queen's attention drifts elsewhere.", successInfluence: 'small', successGold: 'none', ...NO_CONSEQUENCE },
    ],
  },
  // Home estates
  {
    emoji: '🏹', title: 'Poachers on the Estate', description: 'Poachers have been spotted on your lands.', preposition: 'near', location: 'home', approaches: [
      { label: 'Run them off', skill: 'physique', successMessage: "The poachers flee at {actor}'s first show of force and do not return.", failureMessage: 'The poachers turn on {actor} before slipping into the trees, and the game keeps vanishing along with a torn sleeve and a bruise.', successInfluence: 'medium', successGold: 'none', failureInfluence: 'none', failureGold: 'none', failureInjury: true },
      { label: 'Set snares of your own', skill: 'wilderness', successMessage: '{actor} catches the poachers in their own game, red-handed.', failureMessage: "{actor}'s snares catch nothing, and the poachers keep to their usual trails.", successInfluence: 'small', successGold: 'none', ...NO_CONSEQUENCE },
    ],
  },
  {
    emoji: '🍗', title: 'Feast for the Household', description: 'Your household expects a memorable feast.', preposition: 'in', location: 'home', approaches: [
      { label: 'Host with flair', skill: 'charm', successMessage: "The household still talks about {actor}'s feast weeks later.", failureMessage: "{actor}'s feast is passable at best, and the household says little about it.", successInfluence: 'small', successGold: 'none', ...NO_CONSEQUENCE },
      { label: 'Seat the rivals apart', skill: 'negotiation', successMessage: "{actor}'s careful seating keeps the peace, and the evening passes without incident.", failureMessage: "{actor}'s seating plan fails, and old rivals end up trading words across the table.", successInfluence: 'small', successGold: 'none', ...NO_CONSEQUENCE },
    ],
  },
  {
    emoji: '📜', title: 'Ledgers & Accounts', description: 'The estate books are in disarray — and the tax collector is due.', preposition: 'in', location: 'home', approaches: [
      { label: 'Balance the books', skill: 'academic', successMessage: 'Every column {actor} adds up, and the tax collector finds nothing to complain about.', failureMessage: 'The numbers refuse to balance no matter how many times {actor} checks them.', successInfluence: 'none', successGold: 'small', ...NO_CONSEQUENCE },
      { label: 'Cook the books', skill: 'intrigue', successMessage: '{actor} quietly rewrites the figures, and the collector is none the wiser.', failureMessage: "{actor}'s forgery is clumsy, and the collector levies a fine on the spot for the trouble.", successInfluence: 'none', successGold: 'medium', failureInfluence: 'none', failureGold: 'small', failureInjury: false },
      { label: 'Cover the shortfall out of pocket', buyoutTier: 'small', successMessage: "The collector counts {actor}'s coin, nods once, and troubles the estate no further.", failureMessage: "The collector counts {actor}'s coin twice, finds it short anyway, and levies a fine besides.", successInfluence: 'small', successGold: 'none', ...NO_CONSEQUENCE },
    ],
  },
  {
    emoji: '🪨', title: 'Tenant Dispute', description: 'Two tenant farmers quarrel over a boundary stone.', preposition: 'near', location: 'home', approaches: [
      { label: 'Hear both farmers out', skill: 'negotiation', successMessage: "Both farmers leave satisfied with {actor}'s judgment, and the boundary stone is forgotten.", failureMessage: 'Neither farmer feels heard by {actor}, and the quarrel continues as loud as ever.', successInfluence: 'small', successGold: 'none', ...NO_CONSEQUENCE },
      { label: 'Survey the old maps', skill: 'academic', successMessage: '{actor} settles the matter beyond any argument with the old maps.', failureMessage: 'The old maps {actor} finds are unreadable or contradictory, and the dispute drags on.', successInfluence: 'small', successGold: 'none', ...NO_CONSEQUENCE },
    ],
  },
  {
    emoji: '🗝️', title: 'Buried Family Fortune', description: "Family legend swears a strongbox lies buried somewhere on the estate.", preposition: 'near', location: 'home', approaches: [
      { label: "Puzzle out grandfather's old riddle", skill: 'ingenuity', successMessage: 'The riddle finally clicks for {actor}, and the spade strikes wood on the very first try.', failureMessage: '{actor} discovers too late that the riddle describes a landmark torn down decades ago.', successInfluence: 'small', successGold: 'small', ...NO_CONSEQUENCE },
      { label: 'Dig up every likely spot yourself', skill: 'physique', successMessage: 'After a long, filthy afternoon of digging, {actor} finally turns up the strongbox.', failureMessage: '{actor} leaves the estate pockmarked with holes and nursing a twisted ankle, with not one of them holding anything.', successInfluence: 'small', successGold: 'medium', failureInfluence: 'none', failureGold: 'none', failureInjury: true },
      { label: 'Hire a diviner to point the way', buyoutTier: 'small', successMessage: "The diviner's rod {actor} hired dips sharply, and the strongbox is exactly where it points.", failureMessage: '{actor} hired a diviner who is confident, theatrical, and completely wrong.', successInfluence: 'small', successGold: 'none', ...NO_CONSEQUENCE },
    ],
  },
  // Wildlands — unowned corners of the map; these never grant Influence (gold only)
  {
    emoji: '🏔️', title: 'Frozen Pass', description: 'A caravan is snowbound on the high pass, and the drifts only deepen by the hour.', preposition: 'near', location: 'wild', approaches: [
      { label: 'Dig them out', skill: 'physique', successMessage: '{actor} claws a path through the drifts, and the caravan totters free before nightfall.', failureMessage: 'The snow packs in faster than {actor} can clear it, and the effort leaves them frostbitten for the trouble.', successInfluence: 'none', successGold: 'medium', failureInfluence: 'none', failureGold: 'none', failureInjury: true },
      { label: 'Find a safer route down', skill: 'wilderness', successMessage: '{actor} reads the mountain like an old friend, and leads the caravan down a route the map never showed.', failureMessage: "The route {actor} chooses dead-ends at a sheer drop, and the caravan is back where it started, colder than before.", successInfluence: 'none', successGold: 'small', ...NO_CONSEQUENCE },
    ],
  },
  {
    emoji: '⛏️', title: 'The Lost Vein', description: 'Old miners swear a rich silver vein still runs somewhere beneath these peaks, unclaimed.', preposition: 'in', location: 'wild', approaches: [
      { label: 'Follow the old survey marks', skill: 'investigation', successMessage: '{actor} matches a faded survey mark to a fresh scar of rock, and the vein glitters within the hour.', failureMessage: 'Every mark {actor} follows leads to another dead tunnel, and the vein stays lost.', successInfluence: 'none', successGold: 'small', ...NO_CONSEQUENCE },
      { label: 'Break new tunnel by main strength', skill: 'physique', successMessage: '{actor} hauls rock for hours and finally breaks through into a seam thick with ore.', failureMessage: 'A loose ceiling nearly ends the dig early, and {actor} comes back up with nothing but bruises.', successInfluence: 'none', successGold: 'medium', failureInfluence: 'none', failureGold: 'none', failureInjury: true },
    ],
  },
  {
    emoji: '🚢', title: 'Shipwreck Salvage', description: 'A galleon lies broken on the reef, its hold still unplundered.', preposition: 'near', location: 'wild', approaches: [
      { label: 'Dive the wreck', skill: 'nimble', successMessage: '{actor} slips between the broken timbers and surfaces clutching a chest still sealed tight.', failureMessage: 'The current drags {actor} against the hull, and the dive ends with torn hands and empty pockets.', successInfluence: 'none', successGold: 'medium', failureInfluence: 'none', failureGold: 'none', failureInjury: true },
      { label: 'Read the tides and currents', skill: 'wilderness', successMessage: '{actor} times the tide perfectly, and the sea itself washes the choicest cargo ashore.', failureMessage: 'The tide turns against {actor}, and the cargo it carries washes out to deeper water instead.', successInfluence: 'none', successGold: 'small', ...NO_CONSEQUENCE },
    ],
  },
  {
    emoji: '🏴‍☠️', title: 'Smugglers on the Tideline', description: 'A smuggling ring works the hidden coves here, and their latest haul is still unhidden.', preposition: 'near', location: 'wild', approaches: [
      { label: 'Corner them on the sand', skill: 'battle', successMessage: '{actor} corners the smugglers on the open beach, and they drop their haul rather than fight for it.', failureMessage: 'The smugglers fight harder than expected, and {actor} beats a bloody retreat empty-handed.', successInfluence: 'none', successGold: 'medium', failureInfluence: 'none', failureGold: 'none', failureInjury: true },
      { label: 'Talk your way into the ring', skill: 'intrigue', successMessage: '{actor} passes for one of their own long enough to walk off with a share of the haul.', failureMessage: 'The smugglers see through {actor} at the worst possible moment, and the cove empties before a single coin changes hands.', successInfluence: 'none', successGold: 'small', ...NO_CONSEQUENCE },
    ],
  },
  {
    emoji: '🌲', title: 'The Hedge Witch', description: 'An old woman deep in the wood is said to trade secrets for favours, if you can find her.', preposition: 'in', location: 'wild', approaches: [
      { label: 'Track her hidden path', skill: 'investigation', successMessage: '{actor} spots what looks like deer-sign but is not, and follows it straight to her door.', failureMessage: 'The wood seems to fold back on itself, and {actor} walks in circles until giving up the search.', successInfluence: 'none', successGold: 'small', ...NO_CONSEQUENCE },
      { label: 'Strike a clever bargain', skill: 'ingenuity', successMessage: '{actor} offers a trade too clever for her to refuse, and walks away with coin and a strange charm besides.', failureMessage: 'The witch sees through {actor}\'s offer at once, and sends them off with nothing for the wasted breath.', successInfluence: 'none', successGold: 'medium', ...NO_CONSEQUENCE },
    ],
  },
  {
    emoji: '🐺', title: 'Wolf Pack', description: 'A bold wolf pack has taken to shadowing travellers on the forest paths.', preposition: 'near', location: 'wild', approaches: [
      { label: 'Drive them off by force', skill: 'battle', successMessage: '{actor} stands firm and drives the pack back into the trees for good.', failureMessage: 'The pack circles too well for {actor} to hold alone, and they retreat with a nasty bite for their trouble.', successInfluence: 'none', successGold: 'medium', failureInfluence: 'none', failureGold: 'none', failureInjury: true },
      { label: 'Track them back to their den', skill: 'wilderness', successMessage: '{actor} finds the den and leaves an offering that satisfies the pack for a season.', failureMessage: 'The pack scatters before {actor} can find the den, and the paths stay dangerous.', successInfluence: 'none', successGold: 'small', ...NO_CONSEQUENCE },
    ],
  },
  {
    emoji: '🐫', title: 'The Ash Nomads', description: 'A caravan of nomads crosses the wastes, their packs heavy with goods from places no map names.', preposition: 'near', location: 'wild', approaches: [
      { label: 'Trade honestly', skill: 'negotiation', successMessage: '{actor} strikes a fair deal, and the nomads throw in an extra measure out of respect.', failureMessage: 'The nomads read {actor} as an easy mark and drive too hard a bargain to be worth taking.', successInfluence: 'none', successGold: 'small', ...NO_CONSEQUENCE },
      { label: 'Talk your way to a better price', skill: 'ingenuity', successMessage: "{actor}'s clever haggling walks away with far more than the asking price ever offered.", failureMessage: 'The nomads see the trick coming and close the deal before {actor} can land it.', successInfluence: 'none', successGold: 'medium', ...NO_CONSEQUENCE },
    ],
  },
  {
    emoji: '🏺', title: 'Ruins in the Sand', description: 'The wind has uncovered the top of some buried structure, far older than the realm itself.', preposition: 'in', location: 'wild', approaches: [
      { label: 'Excavate by hand', skill: 'physique', successMessage: '{actor} clears sand for hours and uncovers a chamber still holding its treasures.', failureMessage: 'A wall of sand collapses back into the pit almost as fast as {actor} can dig it out.', successInfluence: 'none', successGold: 'medium', failureInfluence: 'none', failureGold: 'none', failureInjury: true },
      { label: 'Decipher the old markings first', skill: 'academic', successMessage: '{actor} reads enough of the old script to find the one entrance that is not a trap.', failureMessage: 'The script defeats {actor} entirely, and the ruin keeps its secrets buried.', successInfluence: 'none', successGold: 'small', ...NO_CONSEQUENCE },
    ],
  },
]
