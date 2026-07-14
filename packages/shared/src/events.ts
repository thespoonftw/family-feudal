import type { Assignments, GameView } from './types.js'

export interface JoinAck {
  ok: boolean
  error?: string
  code?: string
  playerId?: string
}

export interface HostAck {
  ok: boolean
  error?: string
  code?: string
}

export interface Ack {
  ok: boolean
  error?: string
}

export interface ClientToServerEvents {
  /** open a room as the host board screen (not a player) */
  'room:create': (cb: (ack: HostAck) => void) => void
  /** re-attach a board screen to an existing room */
  'room:watch': (code: string, cb: (ack: HostAck) => void) => void
  'room:join': (code: string, playerName: string, cb: (ack: JoinAck) => void) => void
  'room:rejoin': (code: string, playerId: string, cb: (ack: JoinAck) => void) => void
  'room:leave': () => void
  /** the host board screen starts the game from the lobby */
  'game:start': (cb: (ack: Ack) => void) => void
  /** replace your full assignment map for this round */
  'plan:assign': (assignments: Assignments, cb: (ack: Ack) => void) => void
  'plan:ready': (ready: boolean) => void
  /** confirm the round's results; once every connected player confirms, the game advances */
  'round:next': (cb: (ack: Ack) => void) => void
}

export interface ServerToClientEvents {
  'game:state': (view: GameView) => void
  'game:error': (message: string) => void
  'room:closed': (reason: string) => void
}

export interface InterServerEvents {}

export interface SocketData {
  roomCode?: string
  playerId?: string
}
