import type { FastifyInstance } from 'fastify'
import type { DevRoomDetail, DevRoomSummary, GameConfig, SkillKey } from '@family-feudal/shared'
import { SKILLS } from '@family-feudal/shared'
import { getRoom, listRooms } from '../game/store.js'
import { broadcastRoomByCode } from '../socket/index.js'
import type { Room } from '../game/engine.js'
import { CONFIG_BOUNDS, DEFAULT_CONFIG, getConfig, resetConfig, updateConfig } from '../game/config.js'

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

  // ----- live room inspection -----

  app.get('/dev/rooms', async () => {
    return listRooms().map(summary)
  })

  app.get<{ Params: CodeParams }>('/dev/rooms/:code', async (request, reply) => {
    const room = getRoom(request.params.code)
    if (!room) return reply.status(404).send({ error: 'Room not found' })
    return detail(room)
  })

  app.patch<{
    Params: CodeParams & { familyId: string }
    Body: { name?: string; color?: string; influence?: number }
  }>('/dev/rooms/:code/families/:familyId', async (request, reply) => {
    const room = getRoom(request.params.code)
    if (!room) return reply.status(404).send({ error: 'Room not found' })
    const family = room.families.find((f) => f.id === request.params.familyId)
    if (!family) return reply.status(404).send({ error: 'Family not found' })
    const { name, color, influence } = request.body ?? {}
    if (typeof name === 'string' && name.trim()) family.name = name.trim().slice(0, 40)
    if (typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color)) family.color = color
    if (typeof influence === 'number' && Number.isFinite(influence)) {
      family.influence = Math.max(0, Math.round(influence))
    }
    broadcastRoomByCode(room.code)
    return detail(room)
  })

  app.patch<{
    Params: CodeParams & { memberId: string }
    Body: { name?: string; skills?: Partial<Record<SkillKey, number>> }
  }>('/dev/rooms/:code/members/:memberId', async (request, reply) => {
    const room = getRoom(request.params.code)
    if (!room) return reply.status(404).send({ error: 'Room not found' })
    const member = room.families
      .flatMap((f) => f.members)
      .find((m) => m.id === request.params.memberId)
    if (!member) return reply.status(404).send({ error: 'Member not found' })
    const { name, skills } = request.body ?? {}
    if (typeof name === 'string' && name.trim()) member.name = name.trim().slice(0, 40)
    if (skills && typeof skills === 'object') {
      for (const skill of SKILLS) {
        const value = skills[skill]
        if (typeof value === 'number' && Number.isFinite(value)) {
          member.skills[skill] = Math.min(5, Math.max(1, Math.round(value)))
        }
      }
    }
    broadcastRoomByCode(room.code)
    return detail(room)
  })

  app.patch<{
    Params: CodeParams & { scenarioId: string }
    Body: { title?: string; difficulty?: number; reward?: number }
  }>('/dev/rooms/:code/scenarios/:scenarioId', async (request, reply) => {
    const room = getRoom(request.params.code)
    if (!room) return reply.status(404).send({ error: 'Room not found' })
    const scenario = room.scenarios.find((s) => s.id === request.params.scenarioId)
    if (!scenario) return reply.status(404).send({ error: 'Scenario not found' })
    const { title, difficulty, reward } = request.body ?? {}
    if (typeof title === 'string' && title.trim()) scenario.title = title.trim().slice(0, 60)
    if (typeof difficulty === 'number' && Number.isFinite(difficulty)) {
      scenario.difficulty = Math.min(30, Math.max(1, Math.round(difficulty)))
    }
    if (typeof reward === 'number' && Number.isFinite(reward)) {
      scenario.reward = Math.min(20, Math.max(0, Math.round(reward)))
    }
    broadcastRoomByCode(room.code)
    return detail(room)
  })
}
