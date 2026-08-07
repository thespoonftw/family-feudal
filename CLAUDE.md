# Family Feudal — Claude Context

## Project

Jackbox-style multiplayer party game hosted at https://family-feudal.brunch-projects.co.uk.
A shared "host board" tab creates the room and shows the code, realm map, round number and
leaderboard — it is a spectator, not a player, but it starts the game from its lobby.
Players join from their own devices with the 4-letter code; the first joiner is the VIP
(`Player.isHost`, display only). Each player is assigned a noble family (name, colour,
home town, 4 members each carrying up to 3 designable traits that add numeric bonuses to
skills in the designable skill catalog — Might/Charm/Wit/Cunning by default; players see a
member's trait names, never the numeric skills they grant). Five rounds of: planning
(assign members to scenarios on the realm map, one member per scenario) → approach (each
scenario offers 2–3 approaches; pick one per deployed member; skipped if nobody deployed)
→ resolution (member's skill for the chosen approach + d6 vs the check DC; highest passing
total at a scenario takes the Influence, ties share); each phase advances when every
connected player has confirmed. Most Influence after 5 rounds wins.

## Stack

- **Backend**: Node.js + Fastify 5 + Socket.io 4 + TypeScript (ESM). No database — game
  state is in-memory (rooms swept after 24h).
- **Frontend**: Vue 3 + Vite + Pinia + TypeScript
- **Monorepo**: pnpm workspaces

## Structure

```
packages/
  shared/    — game types (types.ts) + socket event maps (events.ts). No runtime deps.
  server/    — Fastify + Socket.io. game/ holds the engine:
               data.ts (fixed map geometry, default house/scenario designs, member names)
               content.ts (editable skill/trait/house/scenario designs, persisted, dev-panel backed)
               config.ts (numeric runtime config, persisted, dev-panel backed)
               engine.ts (room lifecycle, round generation, resolution)
               store.ts (in-memory room map)
               routes/dev.ts — REST API backing the /dev panel
  client/    — Vue 3 SPA. views/ Landing, Game (player phone UI), Host (spectator board),
               Dev. stores/game.ts owns the socket + GameView (playerId null = board).
```

## Running Locally

```bash
pnpm install
pnpm --filter @family-feudal/shared build   # REQUIRED before server/client after editing shared
pnpm dev:server                             # API + sockets, port 3002
pnpm dev:client                             # SPA, port 5174
```

`pnpm build` runs full typecheck + build for all packages — use it to verify changes.

## Deploy

`./deploy.ps1` (PowerShell, from repo root): requires a clean tree, then **push → pull on
server → build shared+server+client → restart the systemd user service** (`family-feudal`
on the LAN host, port 3002, behind nginx at family-feudal.brunch-projects.co.uk).
Pass `-Full` to also `pnpm install` on the server.

- Standing workflow: commit all changes and run `deploy.ps1` after each task.
- Commit messages via PowerShell use a single-quoted here-string (`@' … '@`). Avoid `<`,
  `>`, and `"` in the message. Keep messages plain ASCII.

## Key Conventions

- All cross-package types live in `packages/shared/src/` — never duplicate. Rebuild shared
  after editing it.
- Socket.io event maps (`ClientToServerEvents`, `ServerToClientEvents`) are fully typed via
  shared. Client→server mutations use ack callbacks returning `{ ok, error? }`.
- Server is ESM — relative imports need `.js` extension even for `.ts` files.
- TS strict mode (+ `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`) — no `any`.
- The server sends each client a personalised `GameView` (own assignments only during
  planning; everything revealed at resolution). `broadcastRoom` in `socket/index.ts`
  re-emits views to every socket in the room — call it after any state mutation, including
  from dev REST routes (via `broadcastRoomByCode`).
- Players rejoin via localStorage session (`room:rejoin`). Disconnects keep the seat
  marked disconnected (refresh-safe); lobby seats are dropped after a 60s grace period,
  mid-game seats are kept until the room is swept. Explicit `room:leave` drops immediately.
- The host board attaches via `room:create` (new room) or `room:watch` (refresh; code kept
  in localStorage `family-feudal-host`) and gets a spectator view (`buildView(room, null)`).
  Playerless rooms are swept after 1h; board disconnects never delete a room.

## Game Tuning

Three layers:

- **Runtime config** (`server/src/game/config.ts`): `GameConfig` (rounds, scenarios per
  round, check DC, max players, buyout bonus, starting gold, gold tier ranges, phase
  timers), editable from the dev panel, clamped to `CONFIG_BOUNDS`, persisted to
  `game-config.json` (gitignored, in the server process cwd — `packages/server` in prod;
  override via `CONFIG_FILE`). Read at `startGame` — applies to games started after a
  change; in-progress games keep their values.
- **Designable content** (`server/src/game/content.ts`): five independently persisted
  sections — one file, one loader, one dev-panel tab each, so saving one can never
  clobber another — composed into a `GameContent` only as a read convenience
  (`getContent()`) for `engine.ts`:
  - **Skills** — a `SkillDesign[]` catalog (`{ key, description }`, 1–20 entries; the key
    is lowercase and *is* the display name — no separate label/icon), the set of skills
    members are rated on and approaches secretly test — `SkillKey` is just `string`,
    validated dynamically against this catalog rather than a fixed union. `description`
    is dev-panel only (never sent to players, absent from `GameView.skills` which stays a
    plain `SkillKey[]`) — free text noting what the skill covers, meant to help a designer
    (human or AI) pick the right skill when writing traits and scenario approaches.
    `getSkills`/`updateSkills`, validated by `sanitizeSkillsList` (unique lowercase keys),
    persisted to `game-skills.json` (gitignored; override via `SKILLS_FILE`). Loaded
    **before** traits/houses/scenarios at module init since their sanitizers validate
    skill keys against the live catalog. `GameView.skills` (just the keys) is read live
    (same as face outcomes, not snapshotted per-room) — renaming a key applies instantly,
    even mid-game; removing a key doesn't retroactively fix traits/houses/scenarios still
    referencing it.
  - **Traits** — the `TraitDesign[]` catalog (name + a list of `{skill, amount}`
    bonuses, `amount` clamped to `TRAIT_BONUS_BOUNDS`), the traits a character can be
    assigned (up to `MAX_TRAITS_PER_MEMBER` each) instead of hand-set skill points —
    see below. Shown to players in place of the numeric skills they grant.
    `getTraits`/`updateTraits`, validated by `sanitizeTraitsList` (unique
    names, ≥1 bonus each, no duplicate skill within one trait), persisted to
    `game-traits.json` (gitignored; override via `TRAITS_FILE`). Loaded **before**
    houses since the house sanitizer validates each member's assigned trait names
    against the live catalog.
  - **Houses** — the 8 `HouseDesign`s (name, colour, home city name, fixed 3-member
    roster — name, appearance, and up to `MAX_TRAITS_PER_MEMBER` assigned trait
    names; skills are no longer hand-set, they're derived from those traits, see
    below). `getHouses`/`updateHouses`, validated by `sanitizeHousesList` (exactly one
    house per city slot), persisted to `game-houses.json` (gitignored; override via
    `HOUSES_FILE`).
  - **Scenarios** — the `ScenarioDesign` list (flavour emoji, title, description with
    `{town}`, 2–4 approaches — each a public label, a hidden skill (or a standalone gold
    buyout), success/failure flavour text with `{actor}`, success/failure Influence+gold
    reward tiers, and a failure-injury flag — and location: general/capital/home).
    `getScenarios`/`updateScenarios`, validated by `sanitizeScenariosList` (needs ≥1
    capital + ≥1 home scenario), persisted to `game-scenarios.json` (gitignored;
    override via `SCENARIOS_FILE`).
  - **Face outcomes** — `FaceOutcomeMap`, which portrait face a character swaps to on
    success/failure. `getFaceOutcomes`/`updateFaceOutcomes`, validated by
    `sanitizeFaceOutcomes`, persisted to `game-faces.json` (gitignored; override via
    `FACES_FILE`).

  Each is edited from its own dev panel tab (full-replace PUT — the saved designs ARE
  the settings; there is no reset). On load, a file written by an older build is
  upgraded by that section's migrator (`migrateSkills`/`migrateTraits`/`migrateHouses`/
  `migrateScenarios`/`migrateFaceOutcomes`) so design edits survive schema changes —
  **extend the matching migrator whenever that section's schema changes**; a file that is
  still invalid after migration is backed up to `<file>.invalid-<timestamp>` before
  falling back to defaults, never silently discarded. A server that predates the split
  persisted everything to one combined `game-content.json` (`CONTENT_FILE`); the first
  time a section's own file is missing, it's seeded from that combined file's matching
  key (if present) rather than defaults, and immediately written out to its own file —
  the legacy file itself is read-only and never touched again (traits never existed in
  that combined file, so its section always seeds from `DEFAULT_TRAITS` instead). Rooms
  snapshot towns + house presets at `room:create`; scenario designs are re-read every
  planning phase.
- **Fixed data** (`server/src/game/data.ts`): map slot geometry (capital + 8 city slots —
  city *names* come from the house designs), default designs, member name pool,
  `MIN_PLAYERS` (1 — solo games allowed).

Each joining player is dealt a *random* free house (house + home city) in the lobby
(`claimFamily` in `engine.ts`; freed on lobby departure via `releaseFamily`); at
`startGame`, each member's assigned trait names are resolved into concrete skill values
(`computeMemberSkills` in `packages/shared/src/skills.ts`: every catalog skill starts at
`MEMBER_SKILL_BOUNDS[0]`, each assigned trait adds its bonuses on top, clamped to
`MEMBER_SKILL_BOUNDS[1]`) against the trait/skill catalogs in effect at that moment —
baked into concrete numbers once, like config, rather than read live for the rest of the
game. The trait names themselves are kept on the runtime `FamilyMember` alongside the
derived skills — players see those trait names, never the numeric skills they grant.

Resolution (see `resolveRound` in `engine.ts`): every attending family rolls the member's
skill for its chosen approach + 1d6 against the configured check DC (`checkDC`, default
6; unchosen assignments default to the first approach). Scenarios are contested: among
the families that meet the DC, the highest total takes the 1 Influence — ties all score;
passing but being beaten shows as "Outdone" in the results. Only one member per family
may attend each scenario (enforced in `setAssignments` and greyed out as "Used" in the
UI). Approach choices are validated in `setChoices` (approach phase only, only for
scenarios you deployed to). Players see approach *labels* but never the skill behind
them — labels/emoji/description are the only clues; players see each member's assigned
trait names, never the numeric skills those traits grant.

## Dev Panel

`/dev` route — game settings (GET/PATCH `/api/dev/config`, POST
`/api/dev/config/reset`), skill catalog designer (GET/PUT `/api/dev/skills`), trait
designer (GET/PUT `/api/dev/traits`) — both under the "Skills and Traits" tab — house
designer (GET/PUT `/api/dev/houses`), scenario designer (GET/PUT `/api/dev/scenarios`),
face-outcome designer (GET/PUT `/api/dev/faces`) — each
tab loads and saves independently, so one tab's save can't overwrite another's; invalid
saves 400 with a message, no reset — saves are the settings. Below them: read-only live
room inspection (players, families, members, scenarios) via GET `/api/dev/rooms[/:code]`
— in-progress games cannot be edited.
