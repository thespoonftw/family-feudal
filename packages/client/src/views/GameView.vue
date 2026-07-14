<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { Family, Scenario, ScenarioOutcome, SkillKey } from '@family-feudal/shared'
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
  beauty: '🌹',
  intellect: '📜',
  diplomacy: '🕊️',
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

/** tap to send a member to the selected scenario, tap again to recall */
async function toggleAssign(memberId: string) {
  if (!view.value || !selectedScenario.value) return
  const next = { ...view.value.yourAssignments }
  if (next[memberId] === selectedScenario.value.id) delete next[memberId]
  else next[memberId] = selectedScenario.value.id
  const err = await game.assign(next)
  actionError.value = err ?? ''
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
            :class="o.success ? 'ok' : 'fail'"
          >
            <span class="chip" :style="{ background: familyById(o.familyId)?.color }" />
            <span class="who">
              <strong>{{ familyById(o.familyId)?.name }}</strong>
              <small>{{ memberNames(o.familyId, o.memberIds) }}</small>
            </span>
            <span class="math">
              {{ o.skillTotal }} + 🎲{{ o.roll }} = {{ o.total }}
            </span>
            <span class="verdict">
              {{ o.success ? `Success! +${o.influenceGained}` : 'Failure' }}
            </span>
          </div>
        </div>
        <button v-if="game.isVip" class="next-btn" @click="onNextRound">
          {{ view.round >= view.totalRounds ? 'See Final Results' : 'Next Round' }}
        </button>
        <p v-else class="hint">Waiting for the first player to continue…</p>
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
