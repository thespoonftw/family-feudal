import type { Server, Socket } from 'socket.io'
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from '@family-feudal/shared'
import {
  addPlayer,
  allReady,
  buildView,
  createRoom,
  nextRound,
  releaseFamily,
  resolveRound,
  setAssignments,
  startGame,
  type Room,
} from '../game/engine.js'
import { deleteRoom, getRoom, roomCodeExists, saveRoom } from '../game/store.js'
import { MIN_PLAYERS } from '../game/data.js'
import { getConfig } from '../game/config.js'

export type IoServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>

type IoSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>

let ioRef: IoServer | null = null

/** Re-send a personalised view to every connected socket in the room. */
export async function broadcastRoom(room: Room): Promise<void> {
  if (!ioRef) return
  const sockets = await ioRef.in(room.code).fetchSockets()
  for (const socket of sockets) {
    const playerId = socket.data.playerId
    if (playerId) socket.emit('game:state', buildView(room, playerId))
  }
}

export function broadcastRoomByCode(code: string): void {
  const room = getRoom(code)
  if (room) void broadcastRoom(room)
}

export function registerSocketHandlers(io: IoServer): void {
  ioRef = io

  io.on('connection', (socket: IoSocket) => {
    socket.on('room:create', (playerName, cb) => {
      const name = playerName.trim().slice(0, 24)
      if (!name) return cb({ ok: false, error: 'Enter a name' })
      const { room, player } = createRoom(name, roomCodeExists)
      saveRoom(room)
      bind(socket, room, player.id)
      cb({ ok: true, code: room.code, playerId: player.id })
      void broadcastRoom(room)
    })

    socket.on('room:join', (code, playerName, cb) => {
      const name = playerName.trim().slice(0, 24)
      if (!name) return cb({ ok: false, error: 'Enter a name' })
      const room = getRoom(code)
      if (!room) return cb({ ok: false, error: 'Room not found' })
      if (room.phase !== 'lobby') return cb({ ok: false, error: 'Game already started' })
      if (room.players.length >= getConfig().maxPlayers) {
        return cb({ ok: false, error: 'Room is full' })
      }
      if (room.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
        return cb({ ok: false, error: 'That name is taken' })
      }
      const player = addPlayer(room, name)
      bind(socket, room, player.id)
      cb({ ok: true, code: room.code, playerId: player.id })
      void broadcastRoom(room)
    })

    socket.on('room:rejoin', (code, playerId, cb) => {
      const room = getRoom(code)
      if (!room) return cb({ ok: false, error: 'Room not found' })
      const player = room.players.find((p) => p.id === playerId)
      if (!player) return cb({ ok: false, error: 'Player not found in this room' })
      player.connected = true
      bind(socket, room, player.id)
      cb({ ok: true, code: room.code, playerId: player.id })
      void broadcastRoom(room)
    })

    socket.on('room:leave', () => {
      handleDeparture(socket, true)
    })

    socket.on('game:start', (cb) => {
      const ctx = context(socket)
      if (!ctx) return cb({ ok: false, error: 'Not in a room' })
      const { room, player } = ctx
      if (!player.isHost) return cb({ ok: false, error: 'Only the host can start' })
      if (room.phase !== 'lobby') return cb({ ok: false, error: 'Game already started' })
      if (room.players.length < MIN_PLAYERS) {
        return cb({ ok: false, error: `Need at least ${MIN_PLAYERS} player(s)` })
      }
      startGame(room)
      cb({ ok: true })
      void broadcastRoom(room)
    })

    socket.on('plan:assign', (assignments, cb) => {
      const ctx = context(socket)
      if (!ctx) return cb({ ok: false, error: 'Not in a room' })
      const error = setAssignments(ctx.room, ctx.player.id, assignments)
      if (error) return cb({ ok: false, error })
      cb({ ok: true })
      void broadcastRoom(ctx.room)
    })

    socket.on('plan:ready', (ready) => {
      const ctx = context(socket)
      if (!ctx || ctx.room.phase !== 'planning') return
      ctx.player.ready = ready
      if (allReady(ctx.room)) {
        resolveRound(ctx.room)
      }
      void broadcastRoom(ctx.room)
    })

    socket.on('round:next', (cb) => {
      const ctx = context(socket)
      if (!ctx) return cb({ ok: false, error: 'Not in a room' })
      if (!ctx.player.isHost) return cb({ ok: false, error: 'Only the host can continue' })
      if (ctx.room.phase !== 'resolution') return cb({ ok: false, error: 'Nothing to continue' })
      nextRound(ctx.room)
      cb({ ok: true })
      void broadcastRoom(ctx.room)
    })

    socket.on('disconnect', () => {
      handleDeparture(socket, false)
    })
  })
}

function bind(socket: IoSocket, room: Room, playerId: string): void {
  socket.data.roomCode = room.code
  socket.data.playerId = playerId
  void socket.join(room.code)
}

function context(socket: IoSocket) {
  const { roomCode, playerId } = socket.data
  if (!roomCode || !playerId) return null
  const room = getRoom(roomCode)
  if (!room) return null
  const player = room.players.find((p) => p.id === playerId)
  if (!player) return null
  return { room, player }
}

function handleDeparture(socket: IoSocket, explicit: boolean): void {
  const ctx = context(socket)
  delete socket.data.roomCode
  delete socket.data.playerId
  if (!ctx) return
  const { room, player } = ctx
  void socket.leave(room.code)

  if (room.phase === 'lobby' || explicit) {
    // in the lobby (or on an explicit leave) drop the player entirely
    room.players = room.players.filter((p) => p.id !== player.id)
    if (room.phase === 'lobby') releaseFamily(room, player.id)
    if (player.isHost && room.players.length > 0) {
      const next = room.players[0]
      if (next) next.isHost = true
    }
    if (room.players.length === 0) {
      deleteRoom(room.code)
      return
    }
  } else {
    // mid-game: keep the seat so they can rejoin
    player.connected = false
    player.ready = false
  }

  // a departure may unblock the round
  if (room.phase === 'planning' && allReady(room)) {
    resolveRound(room)
  }
  void broadcastRoom(room)
}
