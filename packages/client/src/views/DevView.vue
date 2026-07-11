<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import type { DevRoomDetail, DevRoomSummary, GameConfig, SkillKey } from '@family-feudal/shared'
import { SKILL_LABELS, SKILLS } from '@family-feudal/shared'

interface ConfigResponse {
  config: GameConfig
  defaults: GameConfig
  bounds: Record<keyof GameConfig, [number, number]>
}

const CONFIG_FIELDS: { key: keyof GameConfig; label: string; hint: string }[] = [
  { key: 'totalRounds', label: 'Rounds per game', hint: 'Influence is tallied after this many rounds' },
  { key: 'membersPerFamily', label: 'Starting family members', hint: 'Members each family begins with' },
  { key: 'scenariosPerRound', label: 'Scenarios per round', hint: 'Public scenarios on the map (1 is always at the capital); each family also gets a home scenario' },
  { key: 'townCount', label: 'Towns on the map', hint: 'Non-capital towns; playing families’ home towns are always included' },
  { key: 'skillMin', label: 'Skill minimum', hint: 'Lower bound for randomly rolled member skills' },
  { key: 'skillMax', label: 'Skill maximum', hint: 'Upper bound for randomly rolled member skills' },
  { key: 'maxPlayers', label: 'Max players per room', hint: 'Limited by the number of family presets' },
]

const configData = ref<ConfigResponse | null>(null)
const rooms = ref<DevRoomSummary[]>([])
const detail = ref<DevRoomDetail | null>(null)
const error = ref('')
const status = ref('')

let pollTimer: ReturnType<typeof setInterval> | null = null

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  // only claim a JSON body when there is one — Fastify rejects an empty JSON body
  const res = await fetch(`/api${path}`, {
    ...(init?.body ? { headers: { 'Content-Type': 'application/json' } } : {}),
    ...init,
  })
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
  return (await res.json()) as T
}

async function loadConfig() {
  try {
    configData.value = await api<ConfigResponse>('/dev/config')
    error.value = ''
  } catch (e) {
    error.value = String(e)
  }
}

async function saveConfig() {
  if (!configData.value) return
  try {
    configData.value = await api<ConfigResponse>('/dev/config', {
      method: 'PATCH',
      body: JSON.stringify(configData.value.config),
    })
    status.value = `Settings saved ✓ (${new Date().toLocaleTimeString()}) — applies to games started from now on`
    error.value = ''
  } catch (e) {
    error.value = String(e)
  }
}

async function resetSettings() {
  try {
    configData.value = await api<ConfigResponse>('/dev/config/reset', { method: 'POST' })
    status.value = 'Settings reset to defaults ✓'
    error.value = ''
  } catch (e) {
    error.value = String(e)
  }
}

async function loadRooms() {
  try {
    rooms.value = await api<DevRoomSummary[]>('/dev/rooms')
    error.value = ''
  } catch (e) {
    error.value = String(e)
  }
}

async function openRoom(code: string) {
  try {
    detail.value = await api<DevRoomDetail>(`/dev/rooms/${code}`)
    status.value = ''
  } catch (e) {
    error.value = String(e)
  }
}

async function patch(path: string, body: unknown) {
  if (!detail.value) return
  try {
    detail.value = await api<DevRoomDetail>(`/dev/rooms/${detail.value.code}${path}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    })
    status.value = `Saved ✓ (${new Date().toLocaleTimeString()})`
    error.value = ''
  } catch (e) {
    error.value = String(e)
  }
}

function saveFamily(familyId: string) {
  const family = detail.value?.families.find((f) => f.id === familyId)
  if (!family) return
  void patch(`/families/${familyId}`, {
    name: family.name,
    color: family.color,
    influence: family.influence,
  })
}

function saveMember(memberId: string) {
  const member = detail.value?.families.flatMap((f) => f.members).find((m) => m.id === memberId)
  if (!member) return
  void patch(`/members/${memberId}`, { name: member.name, skills: member.skills })
}

function saveScenario(scenarioId: string) {
  const scenario = detail.value?.scenarios.find((s) => s.id === scenarioId)
  if (!scenario) return
  void patch(`/scenarios/${scenarioId}`, {
    title: scenario.title,
    difficulty: scenario.difficulty,
    reward: scenario.reward,
  })
}

function townName(townId: string): string {
  return detail.value?.towns.find((t) => t.id === townId)?.name ?? '?'
}

function skillKeys(): SkillKey[] {
  return [...SKILLS]
}

onMounted(() => {
  void loadConfig()
  void loadRooms()
  pollTimer = setInterval(() => void loadRooms(), 5000)
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
})
</script>

<template>
  <div class="dev">
    <header>
      <h1>🛠️ Family Feudal — Developer Panel</h1>
      <router-link to="/">← back to game</router-link>
    </header>

    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="status" class="status">{{ status }}</p>

    <section v-if="configData" class="card">
      <h2>Game settings</h2>
      <p class="dim">
        These parameters apply to games <strong>started after saving</strong> — games already in
        progress keep their values.
      </p>
      <div class="settings">
        <label v-for="f in CONFIG_FIELDS" :key="f.key" class="setting">
          <span class="setting-label">
            {{ f.label }}
            <small class="dim">
              ({{ configData.bounds[f.key][0] }}–{{ configData.bounds[f.key][1] }}, default
              {{ configData.defaults[f.key] }})
            </small>
          </span>
          <input
            v-model.number="configData.config[f.key]"
            type="number"
            :min="configData.bounds[f.key][0]"
            :max="configData.bounds[f.key][1]"
            class="num"
            :title="f.hint"
          />
          <span class="setting-hint dim">{{ f.hint }}</span>
        </label>
      </div>
      <div class="settings-actions">
        <button class="small" @click="saveConfig">Save settings</button>
        <button class="small secondary" @click="resetSettings">Reset to defaults</button>
      </div>
    </section>

    <section class="card">
      <h2>Active rooms</h2>
      <p v-if="rooms.length === 0" class="dim">No active rooms. Start a game first.</p>
      <table v-else>
        <thead>
          <tr><th>Code</th><th>Phase</th><th>Round</th><th>Players</th><th>Created</th><th /></tr>
        </thead>
        <tbody>
          <tr v-for="r in rooms" :key="r.code">
            <td class="mono">{{ r.code }}</td>
            <td>{{ r.phase }}</td>
            <td>{{ r.round }}</td>
            <td>{{ r.playerCount }}</td>
            <td>{{ new Date(r.createdAt).toLocaleTimeString() }}</td>
            <td><button class="small" @click="openRoom(r.code)">Inspect</button></td>
          </tr>
        </tbody>
      </table>
    </section>

    <template v-if="detail">
      <section class="card">
        <h2>
          Room {{ detail.code }} — {{ detail.phase }}, round {{ detail.round }}/{{
            detail.totalRounds
          }}
          <button class="small secondary" @click="openRoom(detail.code)">Refresh</button>
        </h2>
        <p class="dim">
          Players:
          <span v-for="p in detail.players" :key="p.id">
            {{ p.name }}{{ p.isHost ? ' 👑' : '' }}{{ p.connected ? '' : ' (away)' }} ·
          </span>
        </p>
      </section>

      <section class="card">
        <h2>Families</h2>
        <table>
          <thead>
            <tr><th>Name</th><th>Colour</th><th>Home</th><th>Influence</th><th /></tr>
          </thead>
          <tbody>
            <tr v-for="f in detail.families" :key="f.id">
              <td><input v-model="f.name" /></td>
              <td><input v-model="f.color" type="color" class="color" /></td>
              <td>{{ townName(f.homeTownId) }}</td>
              <td><input v-model.number="f.influence" type="number" min="0" class="num" /></td>
              <td><button class="small" @click="saveFamily(f.id)">Save</button></td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="card">
        <h2>Family members</h2>
        <table>
          <thead>
            <tr>
              <th>Family</th>
              <th>Name</th>
              <th v-for="skill in skillKeys()" :key="skill">{{ SKILL_LABELS[skill] }}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <template v-for="f in detail.families" :key="f.id">
              <tr v-for="m in f.members" :key="m.id">
                <td>
                  <span class="chip" :style="{ background: f.color }" /> {{ f.name }}
                </td>
                <td><input v-model="m.name" /></td>
                <td v-for="skill in skillKeys()" :key="skill">
                  <input v-model.number="m.skills[skill]" type="number" min="1" max="5" class="num" />
                </td>
                <td><button class="small" @click="saveMember(m.id)">Save</button></td>
              </tr>
            </template>
          </tbody>
        </table>
      </section>

      <section class="card">
        <h2>Scenarios (current round)</h2>
        <table>
          <thead>
            <tr><th>Title</th><th>Town</th><th>Skill</th><th>Difficulty</th><th>Reward</th><th /></tr>
          </thead>
          <tbody>
            <tr v-for="s in detail.scenarios" :key="s.id">
              <td><input v-model="s.title" /></td>
              <td>{{ townName(s.townId) }}{{ s.homeFamilyId ? ' 🏠' : '' }}</td>
              <td>{{ SKILL_LABELS[s.skill] }}</td>
              <td><input v-model.number="s.difficulty" type="number" min="1" max="30" class="num" /></td>
              <td><input v-model.number="s.reward" type="number" min="0" max="20" class="num" /></td>
              <td><button class="small" @click="saveScenario(s.id)">Save</button></td>
            </tr>
          </tbody>
        </table>
      </section>
    </template>
  </div>
</template>

<style scoped>
.dev {
  max-width: 1100px;
  margin: 0 auto;
  padding: 1.5rem 1rem 4rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  font-family: system-ui, sans-serif;
}

header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.5rem;
}

header h1 {
  font-size: 1.4rem;
  color: var(--gold-soft);
}

header a {
  color: var(--text-dim);
}

h2 {
  font-size: 1.05rem;
  margin-bottom: 0.6rem;
  color: var(--gold-soft);
  display: flex;
  align-items: center;
  gap: 0.8rem;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

th,
td {
  text-align: left;
  padding: 0.35rem 0.5rem;
  border-bottom: 1px solid var(--border);
}

th {
  color: var(--text-dim);
  font-weight: 600;
}

input {
  width: 100%;
  padding: 0.25em 0.45em;
  font-size: 0.9rem;
}

input.num {
  width: 4.5em;
}

input.color {
  width: 3em;
  height: 2em;
  padding: 0.1em;
}

button.small {
  padding: 0.25em 0.8em;
  font-size: 0.8rem;
}

.settings {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.7rem 2rem;
  margin: 0.8rem 0;
}

.setting {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 0.15rem 0.8rem;
}

.setting-label {
  font-size: 0.9rem;
}

.setting-hint {
  grid-column: 1 / -1;
  font-size: 0.75rem;
}

.settings-actions {
  display: flex;
  gap: 0.6rem;
}

@media (max-width: 700px) {
  .settings {
    grid-template-columns: 1fr;
  }
}

.mono {
  font-family: monospace;
  font-size: 1rem;
  letter-spacing: 0.15em;
}

.dim {
  color: var(--text-dim);
}

.status {
  color: var(--success);
}

.chip {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 3px;
  margin-right: 0.3em;
}
</style>
