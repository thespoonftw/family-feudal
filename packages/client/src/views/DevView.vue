<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import type {
  DevRoomDetail,
  DevRoomSummary,
  GameConfig,
  GameContent,
  Scenario,
  ScenarioDesign,
  ScenarioLocation,
  SkillKey,
} from '@family-feudal/shared'
import { SCENARIO_LOCATION_LABELS, SKILL_LABELS, SKILLS } from '@family-feudal/shared'

interface ConfigResponse {
  config: GameConfig
  defaults: GameConfig
  bounds: Record<keyof GameConfig, [number, number]>
}

interface ContentResponse {
  content: GameContent
}

const CONFIG_FIELDS: { key: keyof GameConfig; label: string; hint: string }[] = [
  { key: 'totalRounds', label: 'Rounds per game', hint: 'Influence is tallied after this many rounds' },
  { key: 'membersPerFamily', label: 'Starting family members', hint: 'Members each family begins with' },
  { key: 'scenariosPerRound', label: 'Scenarios per round', hint: 'Public scenarios on the map (1 is always at the capital); each family also gets a home scenario' },
  { key: 'skillMin', label: 'Skill minimum', hint: 'Lower bound for randomly rolled member skills' },
  { key: 'skillMax', label: 'Skill maximum', hint: 'Upper bound for randomly rolled member skills' },
  { key: 'maxPlayers', label: 'Max players per room', hint: 'Limited by the number of family presets' },
]

const configData = ref<ConfigResponse | null>(null)
const contentData = ref<ContentResponse | null>(null)
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

async function loadContent() {
  try {
    contentData.value = await api<ContentResponse>('/dev/content')
    error.value = ''
  } catch (e) {
    error.value = String(e)
  }
}

async function saveContent() {
  if (!contentData.value) return
  try {
    contentData.value = await api<ContentResponse>('/dev/content', {
      method: 'PUT',
      body: JSON.stringify(contentData.value.content),
    })
    status.value = `Designs saved ✓ (${new Date().toLocaleTimeString()}) — applies to rooms created from now on`
    error.value = ''
  } catch (e) {
    error.value = String(e)
  }
}

function addScenario() {
  contentData.value?.content.scenarios.push({
    emoji: '❔',
    title: 'New Scenario',
    description: 'Something is afoot at {town}.',
    approaches: [
      { label: 'Meet it head-on', skill: 'combat', difficulty: 8 },
      { label: 'Find another way', skill: 'cunning', difficulty: 8 },
    ],
    location: 'general',
  })
}

function removeScenario(index: number) {
  contentData.value?.content.scenarios.splice(index, 1)
}

function addApproach(s: ScenarioDesign) {
  if (s.approaches.length < 3) {
    s.approaches.push({ label: 'New approach', skill: 'combat', difficulty: 8 })
  }
}

function removeApproach(s: ScenarioDesign, index: number) {
  if (s.approaches.length > 2) s.approaches.splice(index, 1)
}

/** compact "label (Skill diff)" list for the room inspector */
function approachSummary(s: Scenario): string {
  return s.approaches
    .map((a) => `${a.label} (${SKILL_LABELS[a.skill]} ${a.difficulty})`)
    .join(' / ')
}

function locationKeys(): ScenarioLocation[] {
  return ['general', 'capital', 'home']
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

function townName(townId: string): string {
  return detail.value?.towns.find((t) => t.id === townId)?.name ?? '?'
}

function skillKeys(): SkillKey[] {
  return [...SKILLS]
}

onMounted(() => {
  void loadConfig()
  void loadContent()
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

    <section v-if="contentData" class="card">
      <h2>Houses</h2>
      <p class="dim">
        The eight houses a joining player can be dealt — name, banner colour and home city.
        Applies to rooms <strong>created after saving</strong>; live games keep their houses.
      </p>
      <table class="houses">
        <thead>
          <tr><th>Colour</th><th>House name</th><th>Home city</th></tr>
        </thead>
        <tbody>
          <tr v-for="(h, i) in contentData.content.houses" :key="i">
            <td><input v-model="h.color" type="color" class="swatch" /></td>
            <td><input v-model="h.name" type="text" maxlength="40" /></td>
            <td><input v-model="h.cityName" type="text" maxlength="24" /></td>
          </tr>
        </tbody>
      </table>
      <div class="settings-actions">
        <button class="small" @click="saveContent">Save designs</button>
      </div>
    </section>

    <section v-if="contentData" class="card">
      <h2>Scenarios</h2>
      <p class="dim">
        Every scenario rewards 1 Influence and offers 2–3 approaches. Players see the
        approach labels but never the skill or difficulty behind them — the wording is the
        only clue, so write labels that hint at the skill. Use <code>{town}</code> for the
        town name. Applies to rounds planned after saving.
      </p>
      <div
        v-for="(s, i) in contentData.content.scenarios"
        :key="i"
        class="scenario-row"
      >
        <input v-model="s.emoji" type="text" maxlength="8" class="emoji" title="Flavour emoji" />
        <input v-model="s.title" type="text" maxlength="60" class="title" placeholder="Title" />
        <select v-model="s.location" title="Where this scenario can appear">
          <option v-for="loc in locationKeys()" :key="loc" :value="loc">
            {{ SCENARIO_LOCATION_LABELS[loc] }}
          </option>
        </select>
        <button class="small secondary" title="Remove scenario" @click="removeScenario(i)">✕</button>
        <input
          v-model="s.description"
          type="text"
          maxlength="240"
          class="description"
          placeholder="Description — {town} becomes the town name"
        />
        <div class="approaches">
          <div v-for="(a, j) in s.approaches" :key="j" class="approach-edit">
            <input
              v-model="a.label"
              type="text"
              maxlength="60"
              placeholder="Approach label (shown to players)"
            />
            <select v-model="a.skill" title="Hidden skill tested">
              <option v-for="skill in skillKeys()" :key="skill" :value="skill">
                {{ SKILL_LABELS[skill] }}
              </option>
            </select>
            <input
              v-model.number="a.difficulty"
              type="number"
              min="1"
              max="20"
              class="num"
              title="Hidden difficulty (the member's skill + d6 must reach it)"
            />
            <button
              class="small secondary"
              title="Remove approach"
              :disabled="s.approaches.length <= 2"
              @click="removeApproach(s, j)"
            >
              ✕
            </button>
          </div>
          <button
            v-if="s.approaches.length < 3"
            class="small secondary"
            @click="addApproach(s)"
          >
            + approach
          </button>
        </div>
      </div>
      <div class="settings-actions">
        <button class="small" @click="addScenario">+ Add scenario</button>
        <button class="small" @click="saveContent">Save designs</button>
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
            <tr><th>Name</th><th>Home</th><th>Influence</th></tr>
          </thead>
          <tbody>
            <tr v-for="f in detail.families" :key="f.id">
              <td><span class="chip" :style="{ background: f.color }" /> {{ f.name }}</td>
              <td>{{ townName(f.homeTownId) }}</td>
              <td>{{ f.influence }}</td>
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
            </tr>
          </thead>
          <tbody>
            <template v-for="f in detail.families" :key="f.id">
              <tr v-for="m in f.members" :key="m.id">
                <td>
                  <span class="chip" :style="{ background: f.color }" /> {{ f.name }}
                </td>
                <td>{{ m.name }}</td>
                <td v-for="skill in skillKeys()" :key="skill">{{ m.skills[skill] }}</td>
              </tr>
            </template>
          </tbody>
        </table>
      </section>

      <section class="card">
        <h2>Scenarios (current round)</h2>
        <table>
          <thead>
            <tr><th>Title</th><th>Town</th><th>Approaches</th></tr>
          </thead>
          <tbody>
            <tr v-for="s in detail.scenarios" :key="s.id">
              <td>{{ s.emoji }} {{ s.title }}</td>
              <td>{{ townName(s.townId) }}{{ s.homeFamilyId ? ' 🏠' : '' }}</td>
              <td>{{ approachSummary(s) }}</td>
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
  flex-wrap: wrap;
  margin-top: 0.8rem;
}

/* houses editor */
.houses input[type='text'] {
  width: 100%;
}

input.swatch {
  width: 3.2em;
  height: 2em;
  padding: 0.1em;
  cursor: pointer;
}

/* scenario editor */
.scenario-row {
  display: grid;
  grid-template-columns: 3.2em 1fr auto auto;
  gap: 0.35rem 0.5rem;
  align-items: center;
  padding: 0.55rem 0;
  border-bottom: 1px solid var(--border);
}

.scenario-row input.emoji {
  text-align: center;
}

.scenario-row input.description {
  grid-column: 1 / -1;
}

.scenario-row select {
  padding: 0.25em 0.3em;
  font-size: 0.85rem;
}

.scenario-row .approaches {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  padding-left: 1.2rem;
}

.approach-edit {
  display: grid;
  grid-template-columns: 1fr auto auto auto;
  gap: 0.35rem 0.5rem;
  align-items: center;
}

.scenario-row .approaches > button {
  align-self: flex-start;
}

@media (max-width: 800px) {
  .scenario-row {
    grid-template-columns: 3.2em 1fr auto;
  }
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
