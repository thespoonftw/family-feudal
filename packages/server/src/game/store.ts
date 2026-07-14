import type { Room } from './engine.js'

const rooms = new Map<string, Room>()

const ROOM_TTL_MS = 24 * 60 * 60 * 1000

export function saveRoom(room: Room): void {
  rooms.set(room.code, room)
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(code.toUpperCase())
}

export function deleteRoom(code: string): void {
  rooms.delete(code.toUpperCase())
}

export function listRooms(): Room[] {
  return [...rooms.values()]
}

export function roomCodeExists(code: string): boolean {
  return rooms.has(code)
}

const EMPTY_ROOM_TTL_MS = 60 * 60 * 1000

/** Drop rooms older than the TTL, or playerless rooms (board-only lobbies) after an hour. */
export function sweepRooms(): void {
  const now = Date.now()
  for (const [code, room] of rooms) {
    const age = now - room.createdAt.getTime()
    const expired = age > ROOM_TTL_MS
    const abandoned = room.players.length === 0 && age > EMPTY_ROOM_TTL_MS
    if (expired || abandoned) rooms.delete(code)
  }
}

setInterval(sweepRooms, 60 * 60 * 1000).unref()
