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

/** Drop rooms older than the TTL or with no players left. */
export function sweepRooms(): void {
  const now = Date.now()
  for (const [code, room] of rooms) {
    const expired = now - room.createdAt.getTime() > ROOM_TTL_MS
    if (expired || room.players.length === 0) rooms.delete(code)
  }
}

setInterval(sweepRooms, 60 * 60 * 1000).unref()
