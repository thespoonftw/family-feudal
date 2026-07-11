<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '../stores/game'

const router = useRouter()
const game = useGameStore()

const mode = ref<'menu' | 'create' | 'join'>('menu')
const name = ref('')
const code = ref('')
const error = ref('')
const busy = ref(false)

async function submitCreate() {
  if (busy.value) return
  busy.value = true
  error.value = ''
  const err = await game.createRoom(name.value)
  busy.value = false
  if (err) {
    error.value = err
  } else {
    void router.push('/play')
  }
}

async function submitJoin() {
  if (busy.value) return
  busy.value = true
  error.value = ''
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
      <button @click="mode = 'create'">Start New Game</button>
      <button class="secondary" @click="mode = 'join'">Join Game</button>
      <button v-if="game.hasStoredSession()" class="secondary" :disabled="busy" @click="resume">
        Rejoin Last Game
      </button>
    </div>

    <form v-else-if="mode === 'create'" class="menu card" @submit.prevent="submitCreate">
      <label>
        Your name
        <input v-model="name" maxlength="24" placeholder="e.g. Mike" autofocus />
      </label>
      <button type="submit" :disabled="busy || !name.trim()">Create Room</button>
      <button type="button" class="secondary" @click="mode = 'menu'; error = ''">Back</button>
    </form>

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
