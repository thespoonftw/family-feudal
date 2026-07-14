<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { Family, ScenarioOutcome } from '@family-feudal/shared'
import { useGameStore } from '../stores/game'
import RealmMap from '../components/RealmMap.vue'
import ScoreBoard from '../components/ScoreBoard.vue'

const router = useRouter()
const game = useGameStore()

onMounted(async () => {
  if (!game.view) {
    const err = await game.rewatch()
    if (err) void router.replace('/')
  }
})

// if the room vanishes after a reconnect, return to the landing page
watch(
  () => game.view,
  (v, old) => {
    if (old && !v) void router.replace('/')
  },
)

// the board is usually a landscape screen; keep the map orientation-aware anyway
const landscapeQuery = window.matchMedia('(orientation: landscape)')
const isLandscape = ref(landscapeQuery.matches)
function onOrientationChange(e: MediaQueryListEvent) {
  isLandscape.value = e.matches
}
onMounted(() => landscapeQuery.addEventListener('change', onOrientationChange))
onUnmounted(() => landscapeQuery.removeEventListener('change', onOrientationChange))

const view = computed(() => game.view)

function townName(townId: string): string {
  return view.value?.towns.find((t) => t.id === townId)?.name ?? '?'
}

function familyOf(playerId: string): Family | undefined {
  return view.value?.families.find((f) => f.playerId === playerId)
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

function outcomesFor(scenarioId: string): ScenarioOutcome[] {
  return view.value?.lastResult?.outcomes.filter((o) => o.scenarioId === scenarioId) ?? []
}

const readyCount = computed(() => view.value?.players.filter((p) => p.ready).length ?? 0)

const winnerNames = computed(() => {
  if (!view.value?.winnerFamilyIds) return ''
  return view.value.winnerFamilyIds
    .map((id) => familyById(id)?.name ?? '?')
    .join(' & ')
})

const actionError = ref('')

async function onStart() {
  actionError.value = (await game.startGame()) ?? ''
}

function closeBoard() {
  game.leave()
  void router.replace('/')
}
</script>

<template>
  <div v-if="view" class="board">
    <header>
      <span class="brand">Family Feudal</span>
      <span v-if="view.phase !== 'lobby'" class="round">
        Round {{ view.round }} / {{ view.totalRounds }}
      </span>
      <span class="spacer" />
      <span v-if="!game.connected" class="offline">reconnecting…</span>
      <span class="code-chip">
        Room <strong>{{ view.code }}</strong>
      </span>
      <button class="secondary small" @click="closeBoard">Close</button>
    </header>

    <!-- ================= LOBBY ================= -->
    <main v-if="view.phase === 'lobby'" class="lobby">
      <div class="lobby-join">
        <p class="hint">Join on your phone with room code</p>
        <div class="giant-code">{{ view.code }}</div>
      </div>
      <div class="card lobby-card">
        <h2>Houses at the gates</h2>
        <p v-if="view.players.length === 0" class="hint">Waiting for players to join…</p>
        <ul class="player-list">
          <li v-for="p in view.players" :key="p.id" class="player-row">
            <span>{{ p.name }}</span>
            <span v-if="familyOf(p.id)" class="house-tag">
              <span class="dot" :style="{ background: familyOf(p.id)!.color }" />
              of {{ townName(familyOf(p.id)!.homeTownId) }}
            </span>
          </li>
        </ul>
        <button :disabled="view.players.length === 0" @click="onStart">Begin the Feud</button>
        <p v-if="actionError" class="error">{{ actionError }}</p>
      </div>
    </main>

    <!-- ================= PLANNING ================= -->
    <main v-else-if="view.phase === 'planning'" class="stage">
      <section class="map-pane">
        <RealmMap
          :towns="view.towns"
          :scenarios="view.scenarios"
          :families="view.families"
          :assigned-counts="{}"
          :selected-scenario-id="null"
          :landscape="isLandscape"
        />
      </section>
      <aside class="side-pane">
        <ScoreBoard :families="view.families" :players="view.players" />
        <div class="card ready-card">
          <h3>Planning</h3>
          <p class="hint">{{ readyCount }}/{{ view.players.length }} houses ready</p>
          <ul class="ready-list">
            <li v-for="p in view.players" :key="p.id">
              <span class="dot" :style="{ background: familyOf(p.id)?.color ?? '#666' }" />
              {{ p.name }}
              <span class="spacer" />
              <span v-if="!p.connected" class="offline">away</span>
              <span v-else-if="p.ready" class="ready">✓ ready</span>
              <span v-else class="hint">scheming…</span>
            </li>
          </ul>
        </div>
      </aside>
    </main>

    <!-- ================= RESOLUTION ================= -->
    <main v-else-if="view.phase === 'resolution'" class="stage">
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
        <p class="hint">
          {{ view.players.find((p) => p.isHost)?.name ?? 'The first player' }} continues from
          their phone.
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
        <button @click="closeBoard">Return to the Great Hall</button>
      </div>
    </main>
  </div>

  <div v-else class="loading">Summoning the realm…</div>
</template>

<style scoped>
.board {
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
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
}

.brand {
  color: var(--gold-soft);
  font-weight: bold;
}

.round {
  color: var(--text-dim);
  font-size: 1rem;
}

.spacer {
  flex: 1;
}

.offline {
  color: var(--failure);
  font-size: 0.85rem;
}

.code-chip {
  color: var(--text-dim);
  font-size: 0.95rem;
}

.code-chip strong {
  color: var(--gold-soft);
  letter-spacing: 0.25em;
  margin-left: 0.3em;
}

button.small {
  padding: 0.3em 0.9em;
  font-size: 0.85rem;
}

.hint {
  color: var(--text-dim);
  font-size: 0.9rem;
}

/* lobby */
.lobby {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3rem;
  padding: 2rem;
  flex-wrap: wrap;
}

.lobby-join {
  text-align: center;
}

.giant-code {
  font-size: clamp(4rem, 12vw, 7rem);
  letter-spacing: 0.4em;
  padding-left: 0.4em;
  color: var(--gold-soft);
  font-weight: bold;
  text-shadow: 0 2px 16px rgba(0, 0, 0, 0.6);
}

.lobby-card {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  width: min(420px, 92vw);
  padding: 2rem;
}

.player-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.player-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.8rem;
  font-size: 1.05rem;
}

.house-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--text-dim);
  font-size: 0.85rem;
  text-align: right;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* planning / resolution shared stage: content + sidebar */
.stage {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 1rem;
  padding: 1rem;
}

.map-pane {
  flex: 1;
  min-height: 0;
  display: flex;
}

.map-pane .realm {
  flex: 1;
  min-height: 0;
  width: 100%;
}

.side-pane {
  width: min(320px, 34vw);
  display: flex;
  flex-direction: column;
  gap: 1rem;
  overflow-y: auto;
}

.ready-card h3 {
  color: var(--gold-soft);
  margin-bottom: 0.4rem;
}

.ready-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-top: 0.6rem;
}

.ready-list li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.ready {
  color: var(--success);
  font-weight: bold;
}

/* resolution */
.results-pane {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.results-pane h2 {
  color: var(--gold-soft);
}

.result-card h3 small {
  color: var(--text-dim);
  font-weight: normal;
  font-size: 0.8em;
  margin-left: 0.4em;
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

/* finished */
.finished {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.finish-card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: min(520px, 92vw);
  padding: 2rem;
  text-align: center;
}

.finish-card h2 {
  color: var(--gold-soft);
  font-size: 2rem;
}

.loading {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-dim);
}

/* stacked layout when the board is somehow portrait */
@media (orientation: portrait) {
  .stage {
    flex-direction: column;
  }

  .side-pane {
    width: 100%;
    flex: 0 1 auto;
    max-height: 40%;
  }
}
</style>
