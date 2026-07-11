import type { Assignments, GameView } from './types.js'

export interface JoinAck {
  ok: boolean
  error?: string
  code?: string
  playerId?: string
}

export interface Ack {
  ok: boolean
  error?: string
}

export interface ClientToServerEvents {
  'room:create': (playerName: string, cb: (ack: JoinAck) => void) => void
  'room:join': (code: string, playerName: string, cb: (ack: JoinAck) => void) => void
  'room:rejoin': (code: string, playerId: string, cb: (ack: JoinAck) => void) => void
  'room:leave': () => void
  'game:start': (cb: (ack: Ack) => void) => void
  /** replace your full assignment map for this round */
  'plan:assign': (assignments: Assignments, cb: (ack: Ack) => void) => void
  'plan:ready': (ready: boolean) => void
  /** host advances from resolution to next planning round (or to finished) */
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
