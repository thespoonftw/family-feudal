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

export const useGameStore = defineStore('game', () => {
  const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({
    autoConnect: false,
  })

  const view = ref<GameView | null>(null)
  const lastError = ref('')
  const connected = ref(false)

  socket.on('connect', () => {
    connected.value = true
    // transparently re-attach after a dropped connection
    const session = loadSession()
    if (session && view.value) {
      socket.emit('room:rejoin', session.code, session.playerId, () => {})
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
  const isHost = computed(() => you.value?.isHost ?? false)
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

  function createRoom(playerName: string): Promise<string | null> {
    connect()
    return new Promise((resolve) => {
      socket.emit('room:create', playerName, (ack) => handleAck(ack, resolve))
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

  return {
    view,
    lastError,
    connected,
    you,
    isHost,
    yourFamily,
    createRoom,
    joinRoom,
    rejoin,
    leave,
    startGame,
    assign,
    setReady,
    nextRound,
    hasStoredSession,
  }
})
