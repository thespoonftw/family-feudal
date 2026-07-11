<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { Family, Scenario, ScenarioOutcome, SkillKey } from '@family-feudal/shared'
import { SKILL_LABELS, SKILLS } from '@family-feudal/shared'
import { useGameStore } from '../stores/game'
import RealmMap from '../components/RealmMap.vue'
import ScoreBoard from '../components/ScoreBoard.vue'

const router = useRouter()
const game = useGameStore()

const actionError = ref('')
const selectedScenarioId = ref<string | null>(null)

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

async function onAssign(memberId: string, event: Event) {
  if (!view.value) return
  const scenarioId = (event.target as HTMLSelectElement).value
  const next = { ...view.value.yourAssignments }
  if (scenarioId) next[memberId] = scenarioId
  else delete next[memberId]
  const err = await game.assign(next)
  actionError.value = err ?? ''
}

async function onStart() {
  actionError.value = (await game.startGame()) ?? ''
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
  <div v-if="view" class="game">
    <header>
      <span class="brand">Family Feudal</span>
      <span class="room-code">Room {{ view.code }}</span>
      <span v-if="view.phase !== 'lobby'" class="round">
        Round {{ view.round }} / {{ view.totalRounds }}
      </span>
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
      <button class="secondary small" @click="onLeave">Leave</button>
    </header>

    <p v-if="actionError" class="error bar">{{ actionError }}</p>

    <!-- ================= LOBBY ================= -->
    <main v-if="view.phase === 'lobby'" class="lobby">
      <div class="card lobby-card">
        <h2>Gather your houses</h2>
        <p class="hint">Share this code with the other players:</p>
        <div class="big-code">{{ view.code }}</div>
        <ul class="player-list">
          <li v-for="p in view.players" :key="p.id">
            {{ p.isHost ? '👑' : '🛡️' }} {{ p.name }}
            <em v-if="p.id === view.playerId">(you)</em>
          </li>
        </ul>
        <button v-if="game.isHost" :disabled="view.players.length < 2" @click="onStart">
          Begin the Feud
        </button>
        <p v-else class="hint">Waiting for the host to begin…</p>
        <p v-if="game.isHost && view.players.length < 2" class="hint">
          At least 2 players are needed.
        </p>
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
          @select="(id) => (selectedScenarioId = id)"
        />
        <div v-if="selectedScenario" class="card scenario-detail">
          <h3>
            {{ SKILL_ICONS[selectedScenario.skill] }} {{ selectedScenario.title }}
            <small>at {{ townName(selectedScenario.townId) }}</small>
          </h3>
          <p>{{ selectedScenario.description }}</p>
          <p class="stats">
            Skill: <strong>{{ SKILL_LABELS[selectedScenario.skill] }}</strong> ·
            Difficulty: <strong>{{ selectedScenario.difficulty }}</strong> ·
            Reward: <strong>{{ selectedScenario.reward }} Influence</strong>
          </p>
          <p class="hint">
            Assigned members roll their combined {{ SKILL_LABELS[selectedScenario.skill] }} + a
            die. Beat the difficulty to win the reward.
          </p>
        </div>
      </section>

      <aside class="side-pane">
        <div class="card">
          <h3>Your household</h3>
          <div v-for="m in game.yourFamily?.members ?? []" :key="m.id" class="member">
            <div class="member-head">
              <strong>{{ m.name }}</strong>
              <span class="skills">
                <span v-for="skill in SKILLS" :key="skill" :title="SKILL_LABELS[skill]">
                  {{ SKILL_ICONS[skill] }}{{ m.skills[skill] }}
                </span>
              </span>
            </div>
            <select :value="memberAssignment(m.id)" @change="onAssign(m.id, $event)">
              <option value="">— stay idle —</option>
              <option v-for="s in yourScenarios" :key="s.id" :value="s.id">
                {{ s.homeFamilyId ? '🏠 ' : '' }}{{ s.title }} ({{ townName(s.townId) }},
                {{ SKILL_ICONS[s.skill] }} {{ s.difficulty }})
              </option>
            </select>
          </div>
        </div>

        <div class="card">
          <button class="ready-btn" @click="game.setReady(!game.you?.ready)">
            {{ game.you?.ready ? 'Not ready after all…' : 'Ready — seal the plans' }}
          </button>
          <ul class="ready-list">
            <li v-for="p in view.players" :key="p.id">
              {{ p.ready ? '✅' : '⏳' }} {{ p.name }}
              <em v-if="!p.connected">(away)</em>
            </li>
          </ul>
        </div>

        <ScoreBoard :families="view.families" :players="view.players" />
      </aside>
    </main>

    <!-- ================= RESOLUTION ================= -->
    <main v-else-if="view.phase === 'resolution'" class="resolution">
      <section class="results-pane">
        <h2>Round {{ view.round }} — the tales are told</h2>
        <div v-for="s in view.scenarios" :key="s.id" class="card result-card">
          <h3>
            {{ SKILL_ICONS[s.skill] }} {{ s.title }}
            <small>at {{ townName(s.townId) }} · difficulty {{ s.difficulty }}</small>
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
              {{ o.skillTotal }} + 🎲{{ o.roll }} = {{ o.total }} vs {{ o.difficulty }}
            </span>
            <span class="verdict">
              {{ o.success ? `Success! +${o.influenceGained}` : 'Failure' }}
            </span>
          </div>
        </div>
        <button v-if="game.isHost" class="next-btn" @click="onNextRound">
          {{ view.round >= view.totalRounds ? 'See Final Results' : 'Next Round' }}
        </button>
        <p v-else class="hint">Waiting for the host to continue…</p>
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

.brand {
  color: var(--gold-soft);
  font-weight: bold;
}

.room-code,
.round {
  color: var(--text-dim);
  font-size: 0.9rem;
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

.hint {
  color: var(--text-dim);
  font-size: 0.9rem;
}

/* planning */
.planning {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 360px;
  gap: 1rem;
  padding: 1rem;
  align-items: start;
}

.map-pane {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  position: sticky;
  top: 1rem;
}

.scenario-detail h3 small,
.result-card h3 small {
  color: var(--text-dim);
  font-weight: normal;
  font-size: 0.8em;
  margin-left: 0.4em;
}

.scenario-detail .stats {
  margin: 0.4rem 0;
}

.side-pane {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.member {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.6rem 0;
  border-top: 1px solid var(--border);
}

.member:first-of-type {
  border-top: none;
}

.member-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.6rem;
}

.skills {
  display: flex;
  gap: 0.5rem;
  font-size: 0.85rem;
  color: var(--text-dim);
}

.ready-btn {
  width: 100%;
}

.ready-list {
  list-style: none;
  margin-top: 0.7rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.9rem;
}

/* resolution */
.resolution {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 1rem;
  padding: 1rem;
  align-items: start;
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

@media (max-width: 900px) {
  .planning,
  .resolution {
    grid-template-columns: 1fr;
  }

  .map-pane {
    position: static;
  }
}
</style>
