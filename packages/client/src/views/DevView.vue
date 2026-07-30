<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import type {
  AppearanceAccessories,
  AppearanceFace,
  AppearanceHairColor,
  AppearanceHeadStyle,
  AppearanceSkinTone,
  DevRoomDetail,
  DevRoomSummary,
  FaceOutcomeDesign,
  GameConfig,
  GameContent,
  HouseDesign,
  MemberAppearance,
  MemberDesign,
  Scenario,
  ScenarioDesign,
  ScenarioLocation,
  SkillKey,
} from '@family-feudal/shared'
import {
  APPEARANCE_ACCESSORIES,
  APPEARANCE_FACES,
  APPEARANCE_FACIAL_HAIR,
  APPEARANCE_HAIR_COLORS,
  APPEARANCE_HEAD_STYLES,
  APPEARANCE_SKIN_TONES,
  MEMBER_SKILL_BOUNDS,
  SCENARIO_LOCATION_LABELS,
  SKILL_LABELS,
  SKILLS,
} from '@family-feudal/shared'
import MemberAvatar from '../components/MemberAvatar.vue'

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
  { key: 'scenariosPerRound', label: 'Scenarios per round', hint: 'Public scenarios on the map (1 is always at the capital); each family also gets a home scenario' },
  { key: 'checkDC', label: 'Check DC', hint: 'Every check is skill + d6 vs this; the highest passing total at a scenario takes the Influence, ties share' },
  { key: 'maxPlayers', label: 'Max players per room', hint: 'Limited by the number of family presets' },
]

const configData = ref<ConfigResponse | null>(null)
const contentData = ref<ContentResponse | null>(null)
const rooms = ref<DevRoomSummary[]>([])
const detail = ref<DevRoomDetail | null>(null)
const error = ref('')
const status = ref('')
const editingMember = ref<{ member: MemberDesign; house: HouseDesign } | null>(null)

const TABS = ['Settings', 'Houses', 'Scenarios', 'Faces', 'Rooms'] as const
type Tab = (typeof TABS)[number]
const activeTab = ref<Tab>('Settings')

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
      { label: 'Meet it head-on', skill: 'might', successMessage: 'Success!', failureMessage: 'It comes to nothing.' },
      { label: 'Find another way', skill: 'cunning', successMessage: 'Success!', failureMessage: 'It comes to nothing.' },
    ],
    location: 'general',
  })
}

function removeScenario(index: number) {
  contentData.value?.content.scenarios.splice(index, 1)
}

function addApproach(s: ScenarioDesign) {
  if (s.approaches.length < 3) {
    s.approaches.push({
      label: 'New approach',
      skill: 'might',
      successMessage: 'Success!',
      failureMessage: 'It comes to nothing.',
    })
  }
}

function removeApproach(s: ScenarioDesign, index: number) {
  if (s.approaches.length > 2) s.approaches.splice(index, 1)
}

/** compact "label (Skill)" list for the room inspector */
function approachSummary(s: Scenario): string {
  return s.approaches.map((a) => `${a.label} (${SKILL_LABELS[a.skill]})`).join(' / ')
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

function memberTotal(m: MemberDesign): number {
  return SKILLS.reduce((sum, skill) => sum + m.skills[skill], 0)
}

function headStyles(): string[] {
  return [...APPEARANCE_HEAD_STYLES]
}

function faceOptions(): AppearanceFace[] {
  return [...APPEARANCE_FACES]
}

function facialHairOptions(): string[] {
  return [...APPEARANCE_FACIAL_HAIR]
}

function accessoriesOptions(): string[] {
  return [...APPEARANCE_ACCESSORIES]
}

function skinTones(): readonly AppearanceSkinTone[] {
  return APPEARANCE_SKIN_TONES
}

function hairColors(): readonly AppearanceHairColor[] {
  return APPEARANCE_HAIR_COLORS
}

function setSkinTone(m: MemberDesign, value: AppearanceSkinTone) {
  m.appearance.skinColor = value
}

function setHairColor(m: MemberDesign, value: AppearanceHairColor) {
  m.appearance.hairColor = value
}

/** '#rrggbb' for swatch styling; appearance colour fields store the hex without '#' */
function asHex(value: string): string {
  return `#${value}`
}

/** the face's outcome overrides, creating an empty entry the first time it's touched */
function faceEntry(face: AppearanceFace): FaceOutcomeDesign {
  const map = contentData.value?.content.faceOutcomes
  if (!map) return {}
  if (!map[face]) map[face] = {}
  return map[face]!
}

function onSuccessFaceChange(face: AppearanceFace, e: Event) {
  const value = (e.target as HTMLSelectElement).value
  if (value) faceEntry(face).successFace = value as AppearanceFace
  else delete faceEntry(face).successFace
}

function onFailureFaceChange(face: AppearanceFace, e: Event) {
  const value = (e.target as HTMLSelectElement).value
  if (value) faceEntry(face).failureFace = value as AppearanceFace
  else delete faceEntry(face).failureFace
}

/** flat neutral appearance used to preview a face on its own in the faces table */
function facePreviewAppearance(face: AppearanceFace): MemberAppearance {
  return {
    skinColor: APPEARANCE_SKIN_TONES[0],
    hairColor: APPEARANCE_HAIR_COLORS[0],
    head: 'short1',
    face,
    facialHair: 'none',
    accessories: 'none',
  }
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

    <nav class="tabs">
      <button
        v-for="tab in TABS"
        :key="tab"
        type="button"
        class="tab-btn"
        :class="{ active: activeTab === tab }"
        @click="activeTab = tab"
      >
        {{ tab }}
      </button>
    </nav>

    <section v-if="configData && activeTab === 'Settings'" class="card">
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

    <section v-if="contentData && activeTab === 'Houses'" class="card">
      <h2>Houses</h2>
      <p class="dim">
        The eight houses a joining player can be dealt — name, banner colour, home city, and
        a fixed roster of three characters. Character skills are hand-set here, not rolled;
        every game a house plays uses exactly these three. Applies to rooms
        <strong>created after saving</strong>; live games keep their houses.
      </p>
      <div v-for="(h, i) in contentData.content.houses" :key="i" class="house-card">
        <div class="house-header">
          <input v-model="h.color" type="color" class="swatch" title="Banner colour" />
          <input v-model="h.name" type="text" maxlength="40" placeholder="House name" />
          <input v-model="h.cityName" type="text" maxlength="24" placeholder="Home city" />
        </div>
        <table class="members">
          <colgroup>
            <col class="col-avatar" />
            <col class="col-name" />
            <col v-for="skill in skillKeys()" :key="skill" class="col-skill" />
            <col class="col-total" />
          </colgroup>
          <thead>
            <tr>
              <th></th>
              <th>Character</th>
              <th v-for="skill in skillKeys()" :key="skill">{{ SKILL_LABELS[skill] }}</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(m, j) in h.members" :key="j">
              <td>
                <button
                  class="avatar-btn"
                  title="Edit appearance"
                  @click="editingMember = { member: m, house: h }"
                >
                  <MemberAvatar :appearance="m.appearance" :seed="m.name" :shirt-color="h.color" :size="80" />
                </button>
              </td>
              <td><input v-model="m.name" type="text" maxlength="30" /></td>
              <td v-for="skill in skillKeys()" :key="skill">
                <input
                  v-model.number="m.skills[skill]"
                  type="number"
                  :min="MEMBER_SKILL_BOUNDS[0]"
                  :max="MEMBER_SKILL_BOUNDS[1]"
                  class="num"
                />
              </td>
              <td class="total">{{ memberTotal(m) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="settings-actions">
        <button class="small" @click="saveContent">Save designs</button>
      </div>
    </section>

    <section v-if="contentData && activeTab === 'Scenarios'" class="card">
      <h2>Scenarios</h2>
      <p class="dim">
        Every scenario offers 2–3 approaches; checks roll skill + d6 against the Check DC,
        and when several houses attend, the highest passing total takes the 1 Influence
        (ties share). Players see the approach labels but never the skill behind them —
        the wording is the only clue, so write labels that hint at the skill. Use
        <code>{town}</code> for the town name. Each approach also has its own success and
        failure message, shown on the results screen next to that family's outcome.
        Applies to rounds planned after saving.
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
            <button
              class="small secondary"
              title="Remove approach"
              :disabled="s.approaches.length <= 2"
              @click="removeApproach(s, j)"
            >
              ✕
            </button>
            <input
              v-model="a.successMessage"
              type="text"
              maxlength="200"
              class="approach-message success"
              placeholder="Success message (shown on the results screen)"
            />
            <input
              v-model="a.failureMessage"
              type="text"
              maxlength="200"
              class="approach-message failure"
              placeholder="Failure message (shown on the results screen)"
            />
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

    <section v-if="contentData && activeTab === 'Faces'" class="card">
      <h2>Faces</h2>
      <p class="dim">
        Every possible portrait face, and what it swaps to on the resolution screen when a
        character wearing it succeeds or fails a check. Leave a column on
        <code>(same face)</code> to keep the character's own face for that outcome. Applies
        to results resolved after saving.
      </p>
      <table class="faces">
        <thead>
          <tr><th></th><th>Face</th><th>Success face</th><th>Failure face</th></tr>
        </thead>
        <tbody>
          <tr v-for="face in faceOptions()" :key="face">
            <td>
              <MemberAvatar
                :appearance="facePreviewAppearance(face)"
                :seed="face"
                shirt-color="#8a8a8a"
                :size="64"
              />
            </td>
            <td>{{ face }}</td>
            <td>
              <span class="face-cell">
                <select
                  :value="faceEntry(face).successFace ?? ''"
                  @change="onSuccessFaceChange(face, $event)"
                >
                  <option value="">(same face)</option>
                  <option v-for="f2 in faceOptions()" :key="f2" :value="f2">{{ f2 }}</option>
                </select>
                <MemberAvatar
                  :appearance="facePreviewAppearance(faceEntry(face).successFace ?? face)"
                  :seed="face + '-success'"
                  shirt-color="#8a8a8a"
                  :size="64"
                />
              </span>
            </td>
            <td>
              <span class="face-cell">
                <select
                  :value="faceEntry(face).failureFace ?? ''"
                  @change="onFailureFaceChange(face, $event)"
                >
                  <option value="">(same face)</option>
                  <option v-for="f2 in faceOptions()" :key="f2" :value="f2">{{ f2 }}</option>
                </select>
                <MemberAvatar
                  :appearance="facePreviewAppearance(faceEntry(face).failureFace ?? face)"
                  :seed="face + '-failure'"
                  shirt-color="#8a8a8a"
                  :size="64"
                />
              </span>
            </td>
          </tr>
        </tbody>
      </table>
      <div class="settings-actions">
        <button class="small" @click="saveContent">Save designs</button>
      </div>
    </section>

    <section v-if="activeTab === 'Rooms'" class="card">
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

    <template v-if="activeTab === 'Rooms' && detail">
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
              <th></th>
              <th>Family</th>
              <th>Name</th>
              <th v-for="skill in skillKeys()" :key="skill">{{ SKILL_LABELS[skill] }}</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="f in detail.families" :key="f.id">
              <tr v-for="m in f.members" :key="m.id">
                <td><MemberAvatar :appearance="m.appearance" :seed="m.name" :shirt-color="f.color" :size="64" /></td>
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

    <div v-if="editingMember" class="modal-backdrop" @click.self="editingMember = null">
      <div class="modal-card">
        <div class="modal-header">
          <h2>{{ editingMember.member.name }}</h2>
          <button class="small secondary" @click="editingMember = null">✕ Close</button>
        </div>
        <div class="modal-body">
          <MemberAvatar
            :appearance="editingMember.member.appearance"
            :seed="editingMember.member.name"
            :shirt-color="editingMember.house.color"
            :size="140"
          />
          <p class="dim shirt-note">
            Shirt colour follows the house's banner colour
            <span class="chip" :style="{ background: editingMember.house.color }" />
          </p>
          <div class="appearance-fields">
            <label>
              Skin tone
              <span class="swatch-row">
                <button
                  v-for="c in skinTones()"
                  :key="c"
                  type="button"
                  class="swatch-dot"
                  :class="{ active: editingMember.member.appearance.skinColor === c }"
                  :style="{ background: asHex(c) }"
                  :title="asHex(c)"
                  @click="setSkinTone(editingMember.member, c)"
                />
              </span>
            </label>
            <label>
              Hair/hat colour
              <span class="swatch-row">
                <button
                  v-for="c in hairColors()"
                  :key="c"
                  type="button"
                  class="swatch-dot"
                  :class="{ active: editingMember.member.appearance.hairColor === c }"
                  :style="{ background: asHex(c) }"
                  :title="asHex(c)"
                  @click="setHairColor(editingMember.member, c)"
                />
              </span>
              <span v-if="editingMember.member.appearance.facialHair !== 'none'" class="dim hair-note">
                Facial hair matches this colour
              </span>
            </label>
            <label>
              Head
              <select v-model="editingMember.member.appearance.head">
                <option v-for="h2 in headStyles()" :key="h2" :value="h2">{{ h2 }}</option>
              </select>
            </label>
            <label>
              Face
              <select v-model="editingMember.member.appearance.face">
                <option v-for="f2 in faceOptions()" :key="f2" :value="f2">{{ f2 }}</option>
              </select>
            </label>
            <label>
              Facial hair
              <select v-model="editingMember.member.appearance.facialHair">
                <option v-for="f in facialHairOptions()" :key="f" :value="f">{{ f }}</option>
              </select>
            </label>
            <label>
              Accessories
              <select v-model="editingMember.member.appearance.accessories">
                <option v-for="a in accessoriesOptions()" :key="a" :value="a">{{ a }}</option>
              </select>
            </label>
          </div>
        </div>
        <p class="dim modal-hint">Changes apply when you click "Save designs" below.</p>
      </div>
    </div>
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

.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  border-bottom: 1px solid var(--border);
  padding-bottom: 0.6rem;
}

.tab-btn {
  padding: 0.4em 0.9em;
  font-size: 0.85rem;
  background: none;
  border: 1px solid var(--border);
  color: var(--text-dim);
}

.tab-btn.active {
  border-color: var(--gold-soft);
  color: var(--gold-soft);
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
.house-card {
  padding: 0.7rem 0;
  border-bottom: 1px solid var(--border);
}

.house-header {
  display: grid;
  grid-template-columns: 3.2em 1fr 1fr;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

table.members {
  table-layout: fixed;
}

table.members .col-avatar {
  width: 6.5em;
}

table.members .col-name {
  width: 10em;
}

table.members .col-skill,
table.members .col-total {
  width: 7.2em;
}

table.members input[type='text'] {
  width: 100%;
}

table.members input.num {
  width: 100%;
}

table.members td.total {
  font-weight: 600;
  text-align: center;
}

.avatar-btn {
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
  line-height: 0;
  border-radius: 50%;
  transition: box-shadow 0.15s;
}

.avatar-btn:hover,
.avatar-btn:focus-visible {
  box-shadow: 0 0 0 3px var(--gold-soft);
}

.appearance-fields {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem 1.1rem;
  align-items: center;
}

.appearance-fields label {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  font-size: 0.75rem;
  color: var(--text-dim);
}

.appearance-fields select {
  padding: 0.2em 0.3em;
  font-size: 0.85rem;
}

.appearance-fields input.swatch {
  width: 2.6em;
  height: 1.8em;
  padding: 0.1em;
  cursor: pointer;
}

input.swatch {
  width: 3.2em;
  height: 2em;
  padding: 0.1em;
  cursor: pointer;
}

/* faces table */
table.faces td {
  vertical-align: middle;
}

table.faces select {
  padding: 0.25em 0.4em;
  font-size: 0.85rem;
}

.face-cell {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* appearance edit popup */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  padding: 1rem;
}

.modal-card {
  background: var(--bg-panel, #1c1c24);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 1.2rem;
  max-width: 560px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
}

.shirt-note {
  display: flex;
  align-items: center;
  gap: 0.4em;
  font-size: 0.8rem;
  margin: -0.4rem 0 0;
}

.swatch-row {
  display: flex;
  gap: 0.35rem;
}

.hair-note {
  display: block;
  font-size: 0.75rem;
  margin-top: 0.3rem;
}

.swatch-dot {
  width: 1.6em;
  height: 1.6em;
  border-radius: 50%;
  border: 2px solid transparent;
  padding: 0;
  cursor: pointer;
}

.swatch-dot.active {
  border-color: var(--gold-soft);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.8rem;
}

.modal-header h2 {
  margin: 0;
}

.modal-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.modal-hint {
  margin-top: 0.8rem;
  font-size: 0.8rem;
  text-align: center;
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
  grid-template-columns: 1fr auto auto;
  gap: 0.35rem 0.5rem;
  align-items: center;
  padding-bottom: 0.4rem;
  border-bottom: 1px dashed var(--border);
}

.approach-edit .approach-message {
  grid-column: 1 / -1;
}

.approach-edit .approach-message.success {
  color: var(--success);
}

.approach-edit .approach-message.failure {
  color: var(--failure);
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

  .house-header {
    grid-template-columns: 3.2em 1fr;
  }

  .house-header input[type='text']:last-child {
    grid-column: 1 / -1;
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
