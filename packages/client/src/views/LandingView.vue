<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '../stores/game'

const router = useRouter()
const game = useGameStore()

const NAME_KEY = 'family-feudal-name'

const mode = ref<'menu' | 'join'>('menu')
const name = ref(localStorage.getItem(NAME_KEY) ?? '')
const code = ref('')
const error = ref('')
const busy = ref(false)

function rememberName(): void {
  const trimmed = name.value.trim()
  if (trimmed) localStorage.setItem(NAME_KEY, trimmed)
}

/** Open this tab as the shared board screen — it is not a player. */
async function submitHost() {
  if (busy.value) return
  busy.value = true
  error.value = ''
  const err = await game.hostRoom()
  busy.value = false
  if (err) {
    error.value = err
  } else {
    void router.push('/host')
  }
}

async function reopenBoard() {
  if (busy.value) return
  busy.value = true
  error.value = ''
  const err = await game.rewatch()
  busy.value = false
  if (err) error.value = err
  else void router.push('/host')
}

async function submitJoin() {
  if (busy.value) return
  busy.value = true
  error.value = ''
  rememberName()
  const err = await game.joinRoom(code.value, name.value)
  busy.value = false
  if (err) {
    error.value = err
  } else {
    void router.push('/play')
  }
}

async function resume() {
  busy.value = true
  const err = await game.rejoin()
  busy.value = false
  if (!err) void router.push('/play')
  else error.value = err
}
</script>

<template>
  <div class="landing">
    <h1 class="title">Family Feudal</h1>
    <p class="tagline">Scheme, joust and charm your house to glory.</p>

    <div v-if="mode === 'menu'" class="menu">
      <button :disabled="busy" @click="submitHost">Host a Game</button>
      <p class="hint">Open on the shared screen — players join from their phones.</p>
      <button class="secondary" @click="mode = 'join'">Join Game</button>
      <button v-if="game.hasStoredSession()" class="secondary" :disabled="busy" @click="resume">
        Rejoin Last Game
      </button>
      <button
        v-if="game.hasHostSession()"
        class="secondary"
        :disabled="busy"
        @click="reopenBoard"
      >
        Reopen Host Screen
      </button>
    </div>

    <form v-else class="menu card" @submit.prevent="submitJoin">
      <label>
        Room code
        <input v-model="code" maxlength="4" placeholder="ABCD" class="code-input" />
      </label>
      <label>
        Your name
        <input v-model="name" maxlength="24" placeholder="e.g. Mike" />
      </label>
      <button type="submit" :disabled="busy || !name.trim() || code.trim().length !== 4">
        Join Room
      </button>
      <button type="button" class="secondary" @click="mode = 'menu'; error = ''">Back</button>
    </form>

    <p v-if="error" class="error">{{ error }}</p>

    <footer>
      <router-link to="/dev" class="dev-link">Developers</router-link>
    </footer>
  </div>
</template>

<style scoped>
.landing {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.2rem;
  padding: 2rem;
}

.title {
  font-size: clamp(2.6rem, 8vw, 4.5rem);
  color: var(--gold-soft);
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.6);
}

.tagline {
  color: var(--text-dim);
  font-style: italic;
  margin-bottom: 1rem;
}

.menu {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  width: min(320px, 90vw);
}

.menu label {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  color: var(--text-dim);
  font-size: 0.9rem;
}

.hint {
  color: var(--text-dim);
  font-size: 0.85rem;
  text-align: center;
  margin-top: -0.4rem;
}

.code-input {
  text-transform: uppercase;
  letter-spacing: 0.4em;
  text-align: center;
  font-size: 1.4rem;
}

footer {
  position: fixed;
  bottom: 1rem;
}

.dev-link {
  color: var(--text-dim);
  font-size: 0.85rem;
  text-decoration: none;
}

.dev-link:hover {
  color: var(--gold-soft);
}
</style>
