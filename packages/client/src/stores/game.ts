import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { io, type Socket } from 'socket.io-client'
import type {
  Assignments,
  ClientToServerEvents,
  Family,
  GameView,
  JoinAck,
  ServerToClientEvents,
} from '@family-feudal/shared'

const SESSION_KEY = 'family-feudal-session'
const HOST_KEY = 'family-feudal-host'

interface StoredSession {
  code: string
  playerId: string
}

function loadSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as StoredSession) : null
  } catch {
    return null
  }
}

function loadHostCode(): string | null {
  return localStorage.getItem(HOST_KEY)
}

export const useGameStore = defineStore('game', () => {
  const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({
    autoConnect: false,
  })

  const view = ref<GameView | null>(null)
  const lastError = ref('')
  const connected = ref(false)

  socket.on('connect', () => {
    connected.value = true
    // transparently re-attach after a dropped connection; if the seat is gone, reset so
    // the views can fall back to the landing page instead of showing a dead game
    if (!view.value) return
    if (view.value.playerId === null) {
      const code = loadHostCode()
      if (!code) return
      socket.emit('room:watch', code, (ack) => {
        if (!ack.ok) {
          localStorage.removeItem(HOST_KEY)
          view.value = null
        }
      })
    } else {
      const session = loadSession()
      if (!session) return
      socket.emit('room:rejoin', session.code, session.playerId, (ack) => {
        if (!ack.ok) {
          clearSession()
          view.value = null
        }
      })
    }
  })
  socket.on('disconnect', () => {
    connected.value = false
  })
  socket.on('game:state', (v) => {
    view.value = v
  })
  socket.on('game:error', (message) => {
    lastError.value = message
  })
  socket.on('room:closed', () => {
    clearSession()
    view.value = null
  })

  const you = computed(() => view.value?.players.find((p) => p.id === view.value?.playerId))
  const isVip = computed(() => you.value?.isHost ?? false)
  const isBoard = computed(() => view.value !== null && view.value.playerId === null)
  const yourFamily = computed<Family | undefined>(() =>
    view.value?.families.find((f) => f.playerId === view.value?.playerId),
  )

  function connect(): void {
    if (!socket.connected) socket.connect()
  }

  function storeSession(code: string, playerId: string): void {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ code, playerId }))
  }

  function clearSession(): void {
    localStorage.removeItem(SESSION_KEY)
  }

  function handleAck(ack: JoinAck, resolve: (error: string | null) => void): void {
    if (ack.ok && ack.code && ack.playerId) {
      storeSession(ack.code, ack.playerId)
      resolve(null)
    } else {
      resolve(ack.error ?? 'Something went wrong')
    }
  }

  /** Open a room as the host board screen (not a player). */
  function hostRoom(): Promise<string | null> {
    connect()
    return new Promise((resolve) => {
      socket.emit('room:create', (ack) => {
        if (ack.ok && ack.code) {
          localStorage.setItem(HOST_KEY, ack.code)
          resolve(null)
        } else {
          resolve(ack.error ?? 'Something went wrong')
        }
      })
    })
  }

  /** Re-attach the board screen to its room (page refresh). */
  function rewatch(): Promise<string | null> {
    const code = loadHostCode()
    if (!code) return Promise.resolve('No hosted game')
    connect()
    return new Promise((resolve) => {
      socket.emit('room:watch', code, (ack) => {
        if (ack.ok) {
          resolve(null)
        } else {
          localStorage.removeItem(HOST_KEY)
          resolve(ack.error ?? 'Something went wrong')
        }
      })
    })
  }

  function joinRoom(code: string, playerName: string): Promise<string | null> {
    connect()
    return new Promise((resolve) => {
      socket.emit('room:join', code.trim().toUpperCase(), playerName, (ack) =>
        handleAck(ack, resolve),
      )
    })
  }

  /** Try to resume a stored session. Resolves null on success, error string on failure. */
  function rejoin(): Promise<string | null> {
    const session = loadSession()
    if (!session) return Promise.resolve('No saved game')
    connect()
    return new Promise((resolve) => {
      socket.emit('room:rejoin', session.code, session.playerId, (ack) => {
        if (!ack.ok) clearSession()
        handleAck(ack, resolve)
      })
    })
  }

  function leave(): void {
    socket.emit('room:leave')
    clearSession()
    localStorage.removeItem(HOST_KEY)
    view.value = null
  }

  function startGame(): Promise<string | null> {
    return new Promise((resolve) => {
      socket.emit('game:start', (ack) => resolve(ack.ok ? null : (ack.error ?? 'Failed')))
    })
  }

  function assign(assignments: Assignments): Promise<string | null> {
    return new Promise((resolve) => {
      socket.emit('plan:assign', assignments, (ack) =>
        resolve(ack.ok ? null : (ack.error ?? 'Failed')),
      )
    })
  }

  function setReady(ready: boolean): void {
    socket.emit('plan:ready', ready)
  }

  function nextRound(): Promise<string | null> {
    return new Promise((resolve) => {
      socket.emit('round:next', (ack) => resolve(ack.ok ? null : (ack.error ?? 'Failed')))
    })
  }

  function hasStoredSession(): boolean {
    return loadSession() !== null
  }

  function hasHostSession(): boolean {
    return loadHostCode() !== null
  }

  return {
    view,
    lastError,
    connected,
    you,
    isVip,
    isBoard,
    yourFamily,
    hostRoom,
    rewatch,
    joinRoom,
    rejoin,
    leave,
    startGame,
    assign,
    setReady,
    nextRound,
    hasStoredSession,
    hasHostSession,
  }
})
