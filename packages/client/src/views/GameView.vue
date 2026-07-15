<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import type {
  Family,
  FamilyMember,
  Scenario,
  ScenarioOutcome,
  SkillKey,
} from '@family-feudal/shared'
import { SKILLS } from '@family-feudal/shared'
import { useGameStore } from '../stores/game'
import RealmMap from '../components/RealmMap.vue'
import ScoreBoard from '../components/ScoreBoard.vue'

const router = useRouter()
const game = useGameStore()

const actionError = ref('')
const selectedScenarioId = ref<string | null>(null)
const menuOpen = ref(false)

const SKILL_ICONS: Record<SkillKey, string> = {
  combat: '⚔️',
  charm: '🌹',
  intellect: '📜',
  diplomacy: '🕊️',
  cunning: '🦊',
}

onMounted(async () => {
  if (!game.view) {
    const err = await game.rejoin()
    if (err) void router.replace('/')
  }
})

// if the game vanishes (room closed, seat lost after reconnecting), return to the landing page
watch(
  () => game.view,
  (v, old) => {
    if (old && !v) void router.replace('/')
  },
)

// portrait map by default; landscape screens (desktop, phone held sideways) rotate it 90°
const landscapeQuery = window.matchMedia('(orientation: landscape)')
const isLandscape = ref(landscapeQuery.matches)
function onOrientationChange(e: MediaQueryListEvent) {
  isLandscape.value = e.matches
}
onMounted(() => landscapeQuery.addEventListener('change', onOrientationChange))
onUnmounted(() => landscapeQuery.removeEventListener('change', onOrientationChange))

const view = computed(() => game.view)

/** scenarios you may send members to: all public ones + your own home scenario */
const yourScenarios = computed<Scenario[]>(() => {
  if (!view.value) return []
  const familyId = game.yourFamily?.id
  return view.value.scenarios.filter((s) => !s.homeFamilyId || s.homeFamilyId === familyId)
})

const selectedScenario = computed<Scenario | null>(
  () => yourScenarios.value.find((s) => s.id === selectedScenarioId.value) ?? null,
)

const assignedCounts = computed<Record<string, number>>(() => {
  const counts: Record<string, number> = {}
  for (const scenarioId of Object.values(view.value?.yourAssignments ?? {})) {
    counts[scenarioId] = (counts[scenarioId] ?? 0) + 1
  }
  return counts
})

function townName(townId: string): string {
  return view.value?.towns.find((t) => t.id === townId)?.name ?? '?'
}

function memberAssignment(memberId: string): string {
  return view.value?.yourAssignments[memberId] ?? ''
}

/**
 * Button state for a member in the sheet. One member per scenario; a member already
 * committed elsewhere shows a disabled "Used" so they can't be reallocated by accident
 * (recall them from their own scenario first).
 */
function memberButton(memberId: string): { label: string; disabled: boolean } {
  const scenario = selectedScenario.value
  if (!scenario) return { label: 'Send', disabled: true }
  const assigned = memberAssignment(memberId)
  if (assigned === scenario.id) return { label: 'Recall', disabled: false }
  if (assigned) return { label: 'Used', disabled: true }
  if ((assignedCounts.value[scenario.id] ?? 0) > 0) return { label: 'Send', disabled: true }
  return { label: 'Send', disabled: false }
}

/** tap to send a member to the selected scenario (closes the sheet), tap again to recall */
async function toggleAssign(memberId: string) {
  if (!view.value || !selectedScenario.value) return
  const next = { ...view.value.yourAssignments }
  const sending = next[memberId] !== selectedScenario.value.id
  if (sending) next[memberId] = selectedScenario.value.id
  else delete next[memberId]
  const err = await game.assign(next)
  actionError.value = err ?? ''
  if (!err && sending) selectedScenarioId.value = null
}

/** town name of the scenario a member is currently assigned to (for the sheet) */
function assignedTownLabel(memberId: string): string {
  const scenarioId = view.value?.yourAssignments[memberId]
  const scenario = view.value?.scenarios.find((s) => s.id === scenarioId)
  return scenario ? townName(scenario.townId) : ''
}

function familyOf(playerId: string): Family | undefined {
  return view.value?.families.find((f) => f.playerId === playerId)
}

// ---------- approach phase helpers ----------

/** the member+scenario pairs you deployed this round, in map order */
const yourDeployments = computed<{ scenario: Scenario; member: FamilyMember }[]>(() => {
  if (!view.value) return []
  const out: { scenario: Scenario; member: FamilyMember }[] = []
  for (const [memberId, scenarioId] of Object.entries(view.value.yourAssignments)) {
    const scenario = view.value.scenarios.find((s) => s.id === scenarioId)
    const member = game.yourFamily?.members.find((m) => m.id === memberId)
    if (scenario && member) out.push({ scenario, member })
  }
  return out
})

function chosenIndex(scenarioId: string): number | null {
  return view.value?.yourChoices[scenarioId] ?? null
}

const allChosen = computed(() =>
  yourDeployments.value.every((d) => chosenIndex(d.scenario.id) !== null),
)

/** decisions are made one card at a time; past the last card is the summary */
const choiceIndex = ref(0)

const currentDeployment = computed(
  () => yourDeployments.value[choiceIndex.value] ?? null,
)

// entering the approach phase (or rejoining mid-phase): resume at the first unchosen scenario
watch(
  () => [view.value?.phase, view.value?.round],
  () => {
    if (view.value?.phase !== 'approach') return
    const idx = yourDeployments.value.findIndex((d) => chosenIndex(d.scenario.id) === null)
    choiceIndex.value = idx === -1 ? yourDeployments.value.length : idx
  },
  { immediate: true },
)

async function pickApproach(scenarioId: string, index: number) {
  if (!view.value) return
  const next = { ...view.value.yourChoices, [scenarioId]: index }
  const err = await game.choose(next)
  actionError.value = err ?? ''
  if (err) return
  // fade on to the next undecided scenario, or the summary once all are decided
  const idx = yourDeployments.value.findIndex((d) => next[d.scenario.id] === undefined)
  choiceIndex.value = idx === -1 ? yourDeployments.value.length : idx
}

function revisitChoice(index: number) {
  choiceIndex.value = index
}

function chosenLabel(scenarioId: string): string {
  const index = chosenIndex(scenarioId)
  if (index === null) return '—'
  const scenario = view.value?.scenarios.find((s) => s.id === scenarioId)
  return scenario?.approaches[index]?.label ?? '—'
}

async function onNextRound() {
  actionError.value = (await game.nextRound()) ?? ''
}

function onLeave() {
  game.leave()
  void router.replace('/')
}

// clear stale selection when the round changes
watch(
  () => view.value?.round,
  () => {
    selectedScenarioId.value = null
  },
)

// ---------- resolution helpers ----------

function outcomesFor(scenarioId: string): ScenarioOutcome[] {
  return view.value?.lastResult?.outcomes.filter((o) => o.scenarioId === scenarioId) ?? []
}

function approachLabel(o: ScenarioOutcome): string {
  const scenario = view.value?.scenarios.find((s) => s.id === o.scenarioId)
  return scenario?.approaches[o.approachIndex]?.label ?? ''
}

/** won the scenario / passed but beaten by a rival / failed the check outright */
function verdictClass(o: ScenarioOutcome): string {
  return o.influenceGained > 0 ? 'ok' : o.success ? 'beat' : 'fail'
}

function verdictText(o: ScenarioOutcome): string {
  if (o.influenceGained > 0) return `Success! +${o.influenceGained}`
  if (o.success) return 'Outdone!'
  return 'Failure'
}

function familyById(familyId: string): Family | undefined {
  return view.value?.families.find((f) => f.id === familyId)
}

function memberNames(familyId: string, memberIds: string[]): string {
  const family = familyById(familyId)
  if (!family) return ''
  return family.members
    .filter((m) => memberIds.includes(m.id))
    .map((m) => m.name)
    .join(', ')
}

const confirmedCount = computed(
  () => view.value?.players.filter((p) => p.connected && p.ready).length ?? 0,
)
const activePlayerCount = computed(
  () => view.value?.players.filter((p) => p.connected).length ?? 0,
)

const winnerNames = computed(() => {
  if (!view.value?.winnerFamilyIds) return ''
  return view.value.winnerFamilyIds
    .map((id) => familyById(id)?.name ?? '?')
    .join(' & ')
})
</script>

<template>
  <div v-if="view" class="game" :class="{ 'lock-viewport': view.phase === 'planning' }">
    <header>
      <span
        v-if="game.yourFamily"
        class="family-chip"
        :style="{ borderColor: game.yourFamily.color }"
      >
        <span class="dot" :style="{ background: game.yourFamily.color }" />
        {{ game.yourFamily.name }}
      </span>
      <span class="spacer" />
      <span v-if="!game.connected" class="offline">reconnecting…</span>
      <div class="menu-wrap">
        <button class="secondary small menu-btn" aria-label="Menu" @click="menuOpen = !menuOpen">
          <span class="menu-lines"><span /><span /><span /></span>
        </button>
        <div v-if="menuOpen" class="menu-backdrop" @click="menuOpen = false" />
        <div v-if="menuOpen" class="card menu-panel">
          <button class="secondary small menu-close" aria-label="Close menu" @click="menuOpen = false">
            ✕
          </button>
          <div class="menu-title">Family Feudal</div>
          <button class="secondary small" @click="onLeave">Leave game</button>
        </div>
      </div>
    </header>

    <p v-if="actionError" class="error bar">{{ actionError }}</p>

    <!-- ================= LOBBY ================= -->
    <main v-if="view.phase === 'lobby'" class="lobby">
      <div class="card lobby-card">
        <h2>Gather your houses</h2>
        <p class="hint">Share this code with the other players:</p>
        <div class="big-code">{{ view.code }}</div>
        <ul class="player-list">
          <li v-for="p in view.players" :key="p.id" class="player-row">
            <span>
              {{ p.name }}
              <em v-if="p.id === view.playerId">(you)</em>
            </span>
            <span v-if="familyOf(p.id)" class="house-tag">
              <span class="dot" :style="{ background: familyOf(p.id)!.color }" />
              of {{ townName(familyOf(p.id)!.homeTownId) }}
            </span>
          </li>
        </ul>
        <p class="hint">The host screen begins the feud…</p>
      </div>
    </main>

    <!-- ================= PLANNING ================= -->
    <main v-else-if="view.phase === 'planning'" class="planning">
      <section class="map-pane">
        <RealmMap
          :towns="view.towns"
          :scenarios="yourScenarios"
          :families="view.families"
          :assigned-counts="assignedCounts"
          :selected-scenario-id="selectedScenarioId"
          :landscape="isLandscape"
          @select="(id) => (selectedScenarioId = id)"
        />

        <!-- assignment sheet over the map -->
        <div
          v-if="selectedScenario"
          class="sheet-backdrop"
          @click.self="selectedScenarioId = null"
        >
          <div class="card sheet">
            <div class="sheet-head">
              <h3>
                {{ selectedScenario.emoji }} {{ selectedScenario.title }}
                <small>at {{ townName(selectedScenario.townId) }}</small>
              </h3>
              <button class="secondary small" @click="selectedScenarioId = null">✕</button>
            </div>
            <p class="hint">{{ selectedScenario.description }}</p>
            <div class="sheet-members">
              <div v-for="m in game.yourFamily?.members ?? []" :key="m.id" class="sheet-member">
                <span class="sheet-member-info">
                  <strong>{{ m.name }}</strong>
                  <small>
                    <template v-for="(skill, i) in SKILLS" :key="skill">
                      <template v-if="i > 0"> · </template>
                      {{ SKILL_ICONS[skill] }}{{ m.skills[skill] }}
                    </template>
                    <template
                      v-if="
                        memberAssignment(m.id) && memberAssignment(m.id) !== selectedScenario.id
                      "
                    >
                      · at {{ assignedTownLabel(m.id) }}
                    </template>
                  </small>
                </span>
                <button
                  class="small"
                  :class="{ secondary: memberButton(m.id).label !== 'Recall' }"
                  :disabled="memberButton(m.id).disabled"
                  @click="toggleAssign(m.id)"
                >
                  {{ memberButton(m.id).label }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ready bar pinned under the map -->
      <div class="plan-bar">
        <button class="ready-btn" @click="game.setReady(!game.you?.ready)">
          {{ game.you?.ready ? 'Not ready after all…' : 'Ready — seal the plans' }}
        </button>
      </div>
    </main>

    <!-- ================= APPROACH ================= -->
    <main v-else-if="view.phase === 'approach'" class="approach">
      <section class="choices-pane">
        <Transition name="card-rise" mode="out-in">
          <!-- one decision at a time -->
          <div
            v-if="currentDeployment"
            :key="currentDeployment.scenario.id"
            class="card choice-card"
          >
            <p class="progress hint">
              Round {{ view.round }} · decision {{ choiceIndex + 1 }} of
              {{ yourDeployments.length }}
            </p>
            <h3>
              {{ currentDeployment.scenario.emoji }} {{ currentDeployment.scenario.title }}
              <small>at {{ townName(currentDeployment.scenario.townId) }}</small>
            </h3>
            <p class="hint">{{ currentDeployment.scenario.description }}</p>
            <p class="attendee">
              <strong>{{ currentDeployment.member.name }}</strong> attends —
              <small>
                <template v-for="(skill, i) in SKILLS" :key="skill">
                  <template v-if="i > 0"> · </template>
                  {{ SKILL_ICONS[skill] }}{{ currentDeployment.member.skills[skill] }}
                </template>
              </small>
            </p>
            <div class="approach-options">
              <button
                v-for="(a, i) in currentDeployment.scenario.approaches"
                :key="i"
                class="approach-btn"
                :class="{ secondary: chosenIndex(currentDeployment.scenario.id) !== i }"
                @click="pickApproach(currentDeployment.scenario.id, i)"
              >
                {{ a.label }}
              </button>
            </div>
          </div>

          <!-- all decided (or nothing deployed): summary -->
          <div v-else key="summary" class="card choice-card">
            <h3>{{ yourDeployments.length > 0 ? 'The plans are laid' : 'A quiet round' }}</h3>
            <p v-if="yourDeployments.length === 0" class="hint">
              You sent no one out this round. Confirm below while the other houses decide…
            </p>
            <div
              v-for="(d, i) in yourDeployments"
              :key="d.scenario.id"
              class="summary-row"
            >
              <span class="summary-info">
                <strong>{{ d.scenario.emoji }} {{ d.scenario.title }}</strong>
                <small>{{ d.member.name }} — “{{ chosenLabel(d.scenario.id) }}”</small>
              </span>
              <button class="small secondary" :disabled="game.you?.ready" @click="revisitChoice(i)">
                Change
              </button>
            </div>
          </div>
        </Transition>
      </section>
      <div class="plan-bar">
        <button
          class="ready-btn"
          :disabled="!allChosen && !game.you?.ready"
          @click="game.setReady(!game.you?.ready)"
        >
          {{
            game.you?.ready
              ? 'Not ready after all…'
              : allChosen
                ? 'Commit — the die is cast'
                : 'Choose an approach for each scenario…'
          }}
        </button>
      </div>
    </main>

    <!-- ================= RESOLUTION ================= -->
    <main v-else-if="view.phase === 'resolution'" class="resolution">
      <section class="results-pane">
        <h2>Round {{ view.round }} — the tales are told</h2>
        <div v-for="s in view.scenarios" :key="s.id" class="card result-card">
          <h3>
            {{ s.emoji }} {{ s.title }}
            <small>at {{ townName(s.townId) }}</small>
          </h3>
          <p v-if="outcomesFor(s.id).length === 0" class="hint">No house attended.</p>
          <div
            v-for="o in outcomesFor(s.id)"
            :key="o.familyId"
            class="outcome"
            :class="verdictClass(o)"
          >
            <span class="chip" :style="{ background: familyById(o.familyId)?.color }" />
            <span class="who">
              <strong>{{ familyById(o.familyId)?.name }}</strong>
              <small>{{ memberNames(o.familyId, o.memberIds) }} — “{{ approachLabel(o) }}”</small>
            </span>
            <span class="math">
              {{ o.skillTotal }} + 🎲{{ o.roll }} = {{ o.total }}
            </span>
            <span class="verdict">{{ verdictText(o) }}</span>
          </div>
        </div>
        <button v-if="!game.you?.ready" class="next-btn" @click="onNextRound">
          {{ view.round >= view.totalRounds ? 'See Final Results' : 'Next Round' }}
        </button>
        <p v-else class="hint">
          Waiting for the other houses… ({{ confirmedCount }} / {{ activePlayerCount }} confirmed)
        </p>
      </section>
      <aside class="side-pane">
        <ScoreBoard :families="view.families" :players="view.players" />
      </aside>
    </main>

    <!-- ================= FINISHED ================= -->
    <main v-else class="finished">
      <div class="card finish-card">
        <h2>🏆 {{ winnerNames }}</h2>
        <p class="hint">
          After {{ view.totalRounds }} rounds of scheming, the realm bows to its new power.
        </p>
        <ScoreBoard
          :families="view.families"
          :players="view.players"
          :winner-family-ids="view.winnerFamilyIds"
        />
        <button @click="onLeave">Return to the Great Hall</button>
      </div>
    </main>
  </div>

  <div v-else class="loading">Summoning the realm…</div>
</template>

<style scoped>
.game {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.6rem 1rem;
  border-bottom: 1px solid var(--border);
  background: var(--bg-raised);
  flex-wrap: wrap;
}

/* hamburger menu (title + leave) */
.menu-wrap {
  position: relative;
}

.menu-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.45em 0.6em;
}

.menu-lines {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.menu-lines span {
  display: block;
  width: 16px;
  height: 2px;
  border-radius: 2px;
  background: currentColor;
}

.menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: 20;
  background: rgba(10, 7, 3, 0.55);
}

.menu-panel {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 30;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  width: min(18rem, 90vw);
  padding: 1.4rem;
  text-align: center;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.45);
}

.menu-close {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
}

.menu-title {
  color: var(--gold-soft);
  font-size: 1.2rem;
  font-weight: bold;
}

.family-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  border: 1px solid;
  border-radius: 999px;
  padding: 0.15rem 0.7rem;
  font-size: 0.9rem;
}

.family-chip .dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.spacer {
  flex: 1;
}

.offline {
  color: var(--failure);
  font-size: 0.85rem;
}

button.small {
  padding: 0.3em 0.9em;
  font-size: 0.85rem;
}

.bar {
  padding: 0.4rem 1rem;
}

/* lobby */
.lobby {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.lobby-card {
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  width: min(420px, 92vw);
  padding: 2rem;
}

.big-code {
  font-size: 3rem;
  letter-spacing: 0.5em;
  padding-left: 0.5em;
  color: var(--gold-soft);
  font-weight: bold;
}

.player-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.player-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.8rem;
}

.house-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--text-dim);
  font-size: 0.85rem;
  text-align: right;
}

.house-tag .dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex-shrink: 0;
}

.hint {
  color: var(--text-dim);
  font-size: 0.9rem;
}

/* planning: the map fills the viewport exactly — no page scrolling anywhere */
.game.lock-viewport {
  height: 100dvh;
  min-height: 0;
  overflow: hidden;
}

.planning {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem;
}

.map-pane {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.map-pane .realm {
  flex: 1;
  min-height: 0;
  width: 100%;
}

.result-card h3 small {
  color: var(--text-dim);
  font-weight: normal;
  font-size: 0.8em;
  margin-left: 0.4em;
}

/* approach phase: one centered decision card at a time */
.approach {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
}

.choices-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.choice-card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: min(520px, 100%);
}

.choice-card .progress {
  font-size: 0.8rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.choice-card h3 small {
  color: var(--text-dim);
  font-weight: normal;
  font-size: 0.8em;
  margin-left: 0.4em;
}

.choice-card .attendee small {
  color: var(--text-dim);
}

.approach-options {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  margin-top: 0.3rem;
}

.approach-btn {
  width: 100%;
  text-align: left;
}

.summary-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  padding: 0.5rem 0;
  border-top: 1px solid var(--border);
}

.summary-info {
  display: flex;
  flex-direction: column;
  line-height: 1.3;
}

.summary-info small {
  color: var(--text-dim);
}

/* fade/rise between decision cards */
.card-rise-enter-active {
  transition: opacity 0.35s ease, transform 0.35s ease;
}

.card-rise-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.card-rise-enter-from {
  opacity: 0;
  transform: translateY(28px) scale(0.95);
}

.card-rise-leave-to {
  opacity: 0;
  transform: translateY(-18px) scale(0.97);
}

.side-pane {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* resolution */
.resolution {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
}

.results-pane {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.results-pane h2 {
  color: var(--gold-soft);
}

.outcome {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.45rem 0.5rem;
  border-radius: 6px;
  margin-top: 0.45rem;
  background: var(--bg-inset);
}

.outcome .chip {
  width: 12px;
  height: 12px;
  border-radius: 4px;
  flex-shrink: 0;
}

.outcome .who {
  flex: 1;
  display: flex;
  flex-direction: column;
  line-height: 1.25;
}

.outcome .who small {
  color: var(--text-dim);
}

.outcome .math {
  color: var(--text-dim);
  font-size: 0.9rem;
}

.outcome .verdict {
  font-weight: bold;
  min-width: 7.5em;
  text-align: right;
}

.outcome.ok .verdict {
  color: var(--success);
}

.outcome.beat .verdict {
  color: var(--gold-soft);
}

.outcome.fail .verdict {
  color: var(--failure);
}

.next-btn {
  align-self: flex-start;
}

/* finished */
.finished {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.finish-card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: min(480px, 92vw);
  padding: 2rem;
  text-align: center;
}

.finish-card h2 {
  color: var(--gold-soft);
  font-size: 1.8rem;
}

.loading {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-dim);
}

/* assignment sheet over the map + pinned ready bar */
.sheet-backdrop {
  position: absolute;
  inset: 0;
  z-index: 10;
  background: rgba(10, 7, 3, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.8rem;
  border-radius: 10px;
}

.sheet {
  width: 100%;
  max-width: 520px;
  max-height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.sheet-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.6rem;
}

.sheet-head h3 small {
  color: var(--text-dim);
  font-weight: normal;
  font-size: 0.8em;
  margin-left: 0.3em;
}

.sheet-members {
  display: flex;
  flex-direction: column;
}

.sheet-member {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  padding: 0.5rem 0;
  border-top: 1px solid var(--border);
}

.sheet-member-info {
  display: flex;
  flex-direction: column;
  line-height: 1.3;
}

.sheet-member-info small {
  color: var(--text-dim);
}

.sheet-member button {
  min-width: 5.5em;
  flex-shrink: 0;
}

.plan-bar {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  width: 100%;
  max-width: 520px;
  margin: 0 auto;
}

.plan-bar .hint {
  white-space: nowrap;
}

.plan-bar .ready-btn {
  flex: 1;
}

/* compact header on small screens */
@media (max-width: 600px) {
  header {
    gap: 0.5rem;
    padding: 0.5rem 0.7rem;
  }
}
</style>
