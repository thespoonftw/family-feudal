# Family Feudal — Claude Context

## Project

Jackbox-style multiplayer party game hosted at https://family-feudal.brunch-projects.co.uk.
A shared "host board" tab creates the room and shows the code, realm map, round number and
leaderboard — it is a spectator, not a player, but it starts the game from its lobby.
Players join from their own devices with the 4-letter code; the first joiner is the VIP
(`Player.isHost`), who advances rounds from their phone. Each player is assigned a noble family
(name, colour, home town, 4 members with skills 1–5 in Combat/Beauty/Intellect/Diplomacy).
Five rounds of: planning (assign members to scenarios on the realm map) → resolution
(combined skill + d6 vs difficulty → Influence). Most Influence after 5 rounds wins.

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
               data.ts (towns, family presets, scenario templates, tuning constants)
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

Two layers:

- **Runtime config** (`server/src/game/config.ts`): `GameConfig` (rounds, members per
  family, scenarios per round, skill min/max, max players), editable from the
  dev panel, clamped to `CONFIG_BOUNDS`, persisted to `game-config.json` (gitignored, in
  the server process cwd — `packages/server` in prod; override via `CONFIG_FILE`). Read at
  `startGame` — applies to games started after a change; in-progress games keep their
  values.
- **Static data** (`server/src/game/data.ts`): fixed map (capital + 8 cities, one per
  player slot), family presets, member name pool, scenario templates with difficulty
  ranges, `rewardFor(difficulty)`, `MIN_PLAYERS` (1 — solo games allowed).

Each joining player claims the first free family preset (house + home city) in the lobby
(`claimFamily` in `engine.ts`; freed on lobby departure via `releaseFamily`); members are
rolled at `startGame`.

Resolution: sum of assigned members' relevant skill + 1d6 ≥ difficulty → family gains
`reward` Influence (see `resolveRound` in `engine.ts`).

## Dev Panel

`/dev` route — primary section edits the global `GameConfig` (GET/PATCH
`/api/dev/config`, POST `/api/dev/config/reset`). Below it: read-only live room
inspection (players, families, members, scenarios) via GET `/api/dev/rooms[/:code]` —
in-progress games cannot be edited.
