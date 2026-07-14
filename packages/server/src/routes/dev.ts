import type { FastifyInstance } from 'fastify'
import type { DevRoomDetail, DevRoomSummary, GameConfig } from '@family-feudal/shared'
import { getRoom, listRooms } from '../game/store.js'
import type { Room } from '../game/engine.js'
import { CONFIG_BOUNDS, DEFAULT_CONFIG, getConfig, resetConfig, updateConfig } from '../game/config.js'
import { DEFAULT_CONTENT, getContent, resetContent, updateContent } from '../game/content.js'

function summary(room: Room): DevRoomSummary {
  return {
    code: room.code,
    phase: room.phase,
    round: room.round,
    playerCount: room.players.length,
    createdAt: room.createdAt.toISOString(),
  }
}

function detail(room: Room): DevRoomDetail {
  return {
    code: room.code,
    phase: room.phase,
    round: room.round,
    totalRounds: room.totalRounds,
    players: room.players,
    families: room.families,
    towns: room.towns,
    scenarios: room.scenarios,
    assignments: room.assignments,
    resultHistory: room.resultHistory,
  }
}

interface CodeParams {
  code: string
}

export function registerDevRoutes(app: FastifyInstance): void {
  // ----- global game configuration (applies to games started after the change) -----

  app.get('/dev/config', async () => {
    return { config: getConfig(), defaults: DEFAULT_CONFIG, bounds: CONFIG_BOUNDS }
  })

  app.patch<{ Body: Partial<Record<keyof GameConfig, unknown>> }>(
    '/dev/config',
    async (request) => {
      const config = updateConfig(request.body ?? {})
      return { config, defaults: DEFAULT_CONFIG, bounds: CONFIG_BOUNDS }
    },
  )

  app.post('/dev/config/reset', async () => {
    const config = resetConfig()
    return { config, defaults: DEFAULT_CONFIG, bounds: CONFIG_BOUNDS }
  })

  // ----- designable content: houses + scenarios (applies to rooms created after saving) -----

  app.get('/dev/content', async () => {
    return { content: getContent(), defaults: DEFAULT_CONTENT }
  })

  app.put<{ Body: unknown }>('/dev/content', async (request, reply) => {
    const result = updateContent(request.body)
    if (typeof result === 'string') return reply.status(400).send({ error: result })
    return { content: result, defaults: DEFAULT_CONTENT }
  })

  app.post('/dev/content/reset', async () => {
    return { content: resetContent(), defaults: DEFAULT_CONTENT }
  })

  // ----- live room inspection (read-only) -----

  app.get('/dev/rooms', async () => {
    return listRooms().map(summary)
  })

  app.get<{ Params: CodeParams }>('/dev/rooms/:code', async (request, reply) => {
    const room = getRoom(request.params.code)
    if (!room) return reply.status(404).send({ error: 'Room not found' })
    return detail(room)
  })
}
