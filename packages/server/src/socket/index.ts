import type { Server, Socket } from 'socket.io'
import type {
  ClientToServerEvents,
  InterServerEvents,
  Player,
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
import { getRoom, roomCodeExists, saveRoom } from '../game/store.js'
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

/** How long a lobby player may be disconnected (e.g. a page refresh) before losing their seat. */
const LOBBY_DROP_GRACE_MS = 60_000

/** `${roomCode}:${playerId}` -> pending lobby-drop timer */
const pendingDrops = new Map<string, NodeJS.Timeout>()

function cancelPendingDrop(roomCode: string, playerId: string): void {
  const key = `${roomCode}:${playerId}`
  const timer = pendingDrops.get(key)
  if (timer) {
    clearTimeout(timer)
    pendingDrops.delete(key)
  }
}

/** Re-send a personalised view to every connected socket in the room (boards get a spectator view). */
export async function broadcastRoom(room: Room): Promise<void> {
  if (!ioRef) return
  const sockets = await ioRef.in(room.code).fetchSockets()
  for (const socket of sockets) {
    socket.emit('game:state', buildView(room, socket.data.playerId ?? null))
  }
}

export function broadcastRoomByCode(code: string): void {
  const room = getRoom(code)
  if (room) void broadcastRoom(room)
}

export function registerSocketHandlers(io: IoServer): void {
  ioRef = io

  io.on('connection', (socket: IoSocket) => {
    socket.on('room:create', (cb) => {
      const room = createRoom(roomCodeExists)
      saveRoom(room)
      bindBoard(socket, room)
      cb({ ok: true, code: room.code })
      socket.emit('game:state', buildView(room, null))
    })

    socket.on('room:watch', (code, cb) => {
      const room = getRoom(code)
      if (!room) return cb({ ok: false, error: 'Room not found' })
      bindBoard(socket, room)
      cb({ ok: true, code: room.code })
      socket.emit('game:state', buildView(room, null))
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
      cancelPendingDrop(room.code, player.id)
      player.connected = true
      bind(socket, room, player.id)
      cb({ ok: true, code: room.code, playerId: player.id })
      void broadcastRoom(room)
    })

    socket.on('room:leave', () => {
      handleDeparture(socket, true)
    })

    socket.on('game:start', (cb) => {
      // only the host board screen (a room socket with no player seat) may start
      const { roomCode, playerId } = socket.data
      const room = roomCode ? getRoom(roomCode) : undefined
      if (!room) return cb({ ok: false, error: 'Not in a room' })
      if (playerId) return cb({ ok: false, error: 'Only the host screen can start' })
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

/** Attach a host board screen: in the room channel, but with no player seat. */
function bindBoard(socket: IoSocket, room: Room): void {
  socket.data.roomCode = room.code
  delete socket.data.playerId
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
  const { roomCode, playerId } = socket.data
  delete socket.data.roomCode
  delete socket.data.playerId
  if (!roomCode) return
  const room = getRoom(roomCode)
  if (!room) return
  void socket.leave(room.code)

  // a board screen detaching leaves the room untouched (it can re-watch; sweep reaps abandoned rooms)
  if (!playerId) return
  const player = room.players.find((p) => p.id === playerId)
  if (!player) return

  if (explicit) {
    cancelPendingDrop(room.code, player.id)
    dropPlayer(room, player)
  } else {
    // keep the seat so a refresh/reconnect can reclaim it; lobby seats expire after a grace period
    player.connected = false
    player.ready = false
    if (room.phase === 'lobby') schedulePendingDrop(room.code, player.id)
  }

  // a departure may unblock the round
  if (room.phase === 'planning' && room.players.length > 0 && allReady(room)) {
    resolveRound(room)
  }
  void broadcastRoom(room)
}

/** Remove a player's seat; in the lobby also free their house for the next joiner. */
function dropPlayer(room: Room, player: Player): void {
  room.players = room.players.filter((p) => p.id !== player.id)
  if (room.phase === 'lobby') releaseFamily(room, player.id)
  if (player.isHost && room.players.length > 0) {
    const next = room.players[0]
    if (next) next.isHost = true
  }
}

function schedulePendingDrop(roomCode: string, playerId: string): void {
  cancelPendingDrop(roomCode, playerId)
  const key = `${roomCode}:${playerId}`
  const timer = setTimeout(() => {
    pendingDrops.delete(key)
    const room = getRoom(roomCode)
    if (!room || room.phase !== 'lobby') return
    const player = room.players.find((p) => p.id === playerId)
    if (!player || player.connected) return
    dropPlayer(room, player)
    void broadcastRoom(room)
  }, LOBBY_DROP_GRACE_MS)
  timer.unref()
  pendingDrops.set(key, timer)
}
