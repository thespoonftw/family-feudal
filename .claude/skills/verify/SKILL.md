---
name: verify
description: Build, run and drive Family Feudal end-to-end (REST dev API + socket.io game flow) to verify changes against the real server.
---

# Verifying Family Feudal changes

## Build + launch

```bash
pnpm build                                   # shared → server → client (typecheck included)
cd packages/server && node dist/index.js     # serves API + sockets on :3002 (run in background)
```

The server persists `game-config.json` / `game-content.json` into its cwd
(`packages/server`, gitignored). Delete them first for a defaults run; POST
`/api/dev/config/reset` and `/api/dev/content/reset` to clean up after edits.

## Drive the surfaces

- **Dev panel REST**: `curl http://localhost:3002/api/dev/config|content|rooms`.
  Content saves are full-replace `PUT /api/dev/content`; invalid payloads must 400.
- **Game flow (players + host board)**: socket.io on the same port. Use
  `socket.io-client` — resolvable via
  `createRequire('file:///.../packages/client/package.json')`. Event map is in
  `packages/shared/src/events.ts`. Minimal happy path:
  1. board socket: `room:create` → ack has `code`
  2. player socket: `room:join(code, name)` → `game:state` (lobby, family claimed)
  3. board: `game:start` → planning view with scenarios
  4. player: `plan:assign(map)` then `plan:ready(true)` → resolution view with outcomes
  5. VIP: `round:next` to advance

  All mutations use ack callbacks `{ ok, error? }`; state arrives as `game:state` events.
  A working driver pattern: promise-wrap `emit` and `once('game:state')`, filter states
  by phase.

## Gotchas

- Rebuild `packages/shared` before server/client — `pnpm build` handles the order.
- Rooms snapshot towns/house-presets at `room:create`; content edits only reach rooms
  created afterwards (scenario designs are re-read each planning phase).
- No browser automation is set up; the Vue UI is verified by build + exercising the same
  data over sockets. Note UI-only rendering as unverified if it matters for the change.
