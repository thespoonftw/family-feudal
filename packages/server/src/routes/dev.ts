import type { FastifyInstance } from 'fastify'
import type { DevRoomDetail, DevRoomSummary, GameConfig } from '@family-feudal/shared'
import { getRoom, listRooms } from '../game/store.js'
import type { Room } from '../game/engine.js'
import { CONFIG_BOUNDS, DEFAULT_CONFIG, getConfig, resetConfig, updateConfig } from '../game/config.js'
import {
  getFaceOutcomes,
  getTraits,
  getHouses,
  getScenarios,
  getSkills,
  updateFaceOutcomes,
  updateTraits,
  updateHouses,
  updateScenarios,
  updateSkills,
} from '../game/content.js'

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

  // ----- designable content: skills, traits, houses, scenarios, face outcomes — each
  // persisted and saved independently so editing one tab can never clobber another
  // (applies to rooms created after saving) -----

  app.get('/dev/skills', async () => {
    return { skills: getSkills() }
  })

  app.put<{ Body: unknown }>('/dev/skills', async (request, reply) => {
    const result = updateSkills(request.body)
    if (typeof result === 'string') return reply.status(400).send({ error: result })
    return { skills: result }
  })

  app.get('/dev/traits', async () => {
    return { traits: getTraits() }
  })

  app.put<{ Body: unknown }>('/dev/traits', async (request, reply) => {
    const result = updateTraits(request.body)
    if (typeof result === 'string') return reply.status(400).send({ error: result })
    return { traits: result }
  })

  app.get('/dev/houses', async () => {
    return { houses: getHouses() }
  })

  app.put<{ Body: unknown }>('/dev/houses', async (request, reply) => {
    const result = updateHouses(request.body)
    if (typeof result === 'string') return reply.status(400).send({ error: result })
    return { houses: result }
  })

  app.get('/dev/scenarios', async () => {
    return { scenarios: getScenarios() }
  })

  app.put<{ Body: unknown }>('/dev/scenarios', async (request, reply) => {
    const result = updateScenarios(request.body)
    if (typeof result === 'string') return reply.status(400).send({ error: result })
    return { scenarios: result }
  })

  app.get('/dev/faces', async () => {
    return { faceOutcomes: getFaceOutcomes() }
  })

  app.put<{ Body: unknown }>('/dev/faces', async (request, reply) => {
    const result = updateFaceOutcomes(request.body)
    if (typeof result === 'string') return reply.status(400).send({ error: result })
    return { faceOutcomes: result }
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
