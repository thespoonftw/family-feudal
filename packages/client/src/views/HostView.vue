<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { Family, FamilyMember, Scenario, ScenarioOutcome } from '@family-feudal/shared'
import { revealSteps, revealTotalMs } from '@family-feudal/shared'
import { useGameStore } from '../stores/game'
import RealmMap from '../components/RealmMap.vue'
import ScoreBoard from '../components/ScoreBoard.vue'
import MemberAvatar from '../components/MemberAvatar.vue'

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

function outcomeScenario(o: ScenarioOutcome): Scenario | undefined {
  return view.value?.scenarios.find((s) => s.id === o.scenarioId)
}

function approachLabel(o: ScenarioOutcome): string {
  return outcomeScenario(o)?.approaches[o.approachIndex]?.label ?? ''
}

/** the attending member — used for the outcome's portrait */
function outcomeMember(o: ScenarioOutcome): FamilyMember | undefined {
  return familyById(o.familyId)?.members.find((m) => o.memberIds.includes(m.id))
}

/** the flavour line for the approach taken, chosen by whether the check succeeded, split
 *  around {actor} so the attending member's name can be rendered in bold */
function outcomeMessageParts(o: ScenarioOutcome): { text: string; actor: boolean }[] {
  const approach = outcomeScenario(o)?.approaches[o.approachIndex]
  if (!approach) return []
  const raw = o.success ? approach.successMessage : approach.failureMessage
  const name = outcomeMember(o)?.name ?? 'they'
  return raw
    .split(/(\{actor\})/)
    .filter((part) => part.length > 0)
    .map((part) => (part === '{actor}' ? { text: name, actor: true } : { text: part, actor: false }))
}

/** the outcome's portrait, with the designed success/failure face swapped in (dev panel) */
function outcomeAppearance(o: ScenarioOutcome): FamilyMember['appearance'] | undefined {
  const member = outcomeMember(o)
  if (!member) return undefined
  const override = view.value?.faceOutcomes[member.appearance.face]
  const face = o.success ? override?.successFace : override?.failureFace
  return face ? { ...member.appearance, face } : member.appearance
}

/** the check's odds of success, as a whole percentage for display */
function chancePercent(o: ScenarioOutcome): number {
  return Math.round(o.chance * 100)
}

/** won the scenario / passed but beaten by a rival / failed the check outright */
function verdictClass(o: ScenarioOutcome): string {
  return o.influenceGained > 0 || o.goldGained > 0 ? 'ok' : o.success ? 'beat' : 'fail'
}

function verdictText(o: ScenarioOutcome): string {
  if (o.influenceGained > 0 || o.goldGained > 0) {
    const parts: string[] = []
    if (o.influenceGained > 0) parts.push(`+${o.influenceGained}`)
    if (o.goldGained > 0) parts.push(`+${o.goldGained}g`)
    return `Success! ${parts.join(' ')}`
  }
  if (o.success) return 'Outdone!'
  if (o.influenceGained < 0 || o.goldGained < 0) {
    const parts: string[] = []
    if (o.influenceGained < 0) parts.push(`${o.influenceGained}`)
    if (o.goldGained < 0) parts.push(`${o.goldGained}g`)
    if (o.injured) parts.push('Injured!')
    return `Failure ${parts.join(' ')}`
  }
  return 'Failure'
}

// ---------- planning/approach: countdown to auto-advance ----------

/** duration/delay for the countdown bar's CSS animation. A negative delay is how a resumed
 * (e.g. refreshed mid-phase) bar starts already part-filled instead of restarting at 0%. */
const phaseTimerAnim = ref<{ duration: number; delay: number } | null>(null)

function computeTimerAnim(
  startedAt: number | null | undefined,
  endsAt: number | null | undefined,
): { duration: number; delay: number } | null {
  if (!startedAt || !endsAt) return null
  const duration = Math.max(0, endsAt - startedAt)
  const elapsed = Math.min(Math.max(Date.now() - startedAt, 0), duration)
  return { duration, delay: -elapsed }
}

watch(
  () => view.value?.phaseEndsAt,
  (endsAt) => {
    phaseTimerAnim.value = computeTimerAnim(view.value?.phaseStartedAt, endsAt)
  },
  { immediate: true },
)

/** during resolution, the bar only makes sense once the standings (confirm) card is showing */
const phaseTimerVisible = computed(
  () => phaseTimerAnim.value !== null && (view.value?.phase !== 'resolution' || currentStep.value === null),
)

// ---------- results reveal: one scenario at a time, scores last ----------

const revealIndex = ref(0)
let revealTimer: ReturnType<typeof setTimeout> | null = null

const steps = computed(() =>
  view.value ? revealSteps(view.value.scenarios, view.value.lastResult) : [],
)

const currentStep = computed(() => steps.value[revealIndex.value] ?? null)

/** the attended scenario currently on stage */
const currentReveal = computed<Scenario | null>(() => {
  const step = currentStep.value
  if (step?.kind !== 'scenario') return null
  return view.value?.scenarios.find((s) => s.id === step.scenarioIds[0]) ?? null
})

/** every untouched scenario, shown together on one card */
const quietScenarios = computed<Scenario[]>(() => {
  const step = currentStep.value
  if (step?.kind !== 'quiet') return []
  return step.scenarioIds
    .map((id) => view.value?.scenarios.find((s) => s.id === id))
    .filter((s): s is Scenario => s !== undefined)
})

function scheduleReveal() {
  const step = steps.value[revealIndex.value]
  if (!step) {
    // reveal sequence finished — the timer bar only appears now, so it should
    // animate just the remaining confirm window, not the reveal too
    const v = view.value
    const confirmStart = v?.phaseStartedAt
      ? v.phaseStartedAt + revealTotalMs(v.scenarios, v.lastResult)
      : null
    phaseTimerAnim.value = computeTimerAnim(confirmStart, v?.phaseEndsAt)
    return
  }
  revealTimer = setTimeout(() => {
    revealIndex.value += 1
    scheduleReveal()
  }, step.holdMs)
}

// multi-source form matters: a getter returning an array would "change" on every
// broadcast (any player confirming) and restart the reveal from the first card
watch(
  [() => view.value?.phase, () => view.value?.round],
  () => {
    if (revealTimer) clearTimeout(revealTimer)
    if (view.value?.phase !== 'resolution') return
    revealIndex.value = 0
    scheduleReveal()
  },
  { immediate: true },
)

onUnmounted(() => {
  if (revealTimer) clearTimeout(revealTimer)
})

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

    <div v-if="phaseTimerVisible" class="phase-timer">
      <div
        :key="`${view.phaseEndsAt ?? 0}-${!currentStep}`"
        class="phase-timer-bar"
        :style="{
          animationDuration: phaseTimerAnim!.duration + 'ms',
          animationDelay: phaseTimerAnim!.delay + 'ms',
        }"
      />
    </div>

    <Transition name="phase-fade" mode="out-in">

    <!-- ================= LOBBY ================= -->
    <main v-if="view.phase === 'lobby'" key="lobby" class="lobby">
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

    <!-- ================= PLANNING / APPROACH ================= -->
    <main
      v-else-if="view.phase === 'planning' || view.phase === 'approach'"
      :key="view.phase"
      class="stage"
    >
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
        <div class="card ready-card">
          <h3>{{ view.phase === 'planning' ? 'Planning' : 'Choosing approaches' }}</h3>
          <p class="hint">{{ readyCount }}/{{ view.players.length }} houses ready</p>
          <ul class="ready-list">
            <li v-for="p in view.players" :key="p.id">
              <span class="dot" :style="{ background: familyOf(p.id)?.color ?? '#666' }" />
              {{ p.name }}
              <span class="spacer" />
              <span v-if="!p.connected" class="offline">away</span>
              <span v-else-if="p.ready" class="ready">✓ ready</span>
              <span v-else class="hint">{{ view.phase === 'planning' ? 'scheming…' : 'deciding…' }}</span>
            </li>
          </ul>
        </div>
      </aside>
    </main>

    <!-- ================= RESOLUTION: one tale at a time ================= -->
    <main v-else-if="view.phase === 'resolution'" key="resolution" class="reveal-stage">
      <div
        v-if="currentStep"
        :key="revealIndex"
        class="reveal-progress"
      >
        <div
          class="reveal-progress-bar"
          :style="{ animationDuration: currentStep.holdMs + 'ms' }"
        />
      </div>
      <Transition name="card-rise" mode="out-in" appear>
        <!-- opening beat: give everyone a moment to look up -->
        <div v-if="currentStep?.kind === 'intro'" key="intro" class="card reveal-card intro-card">
          <h3>📜 The tales are told</h3>
          <p class="reveal-desc hint">
            How fared the houses of the realm in round {{ view.round }}…
          </p>
        </div>

        <!-- current scenario on stage -->
        <div v-else-if="currentReveal" :key="currentReveal.id" class="card reveal-card">
          <p class="progress hint">Round {{ view.round }} — the tales are told</p>
          <h3>{{ currentReveal.emoji }} {{ currentReveal.title }}</h3>
          <div
            v-for="o in outcomesFor(currentReveal.id)"
            :key="o.familyId"
            class="outcome"
            :class="verdictClass(o)"
          >
            <div class="portrait-col">
              <MemberAvatar
                v-if="outcomeMember(o)"
                :appearance="outcomeAppearance(o)!"
                :seed="outcomeMember(o)!.name"
                :shirt-color="familyById(o.familyId)?.color ?? '#888888'"
                :size="96"
              />
            </div>
            <div class="outcome-body">
              <div class="outcome-head">
                <span class="who">
                  <strong>{{ familyById(o.familyId)?.name }}</strong>
                  <small>{{ memberNames(o.familyId, o.memberIds) }} — “{{ approachLabel(o) }}”</small>
                </span>
                <span class="result-col">
                  <span class="math">{{ chancePercent(o) }}% chance</span>
                  <span class="verdict">{{ verdictText(o) }}</span>
                </span>
              </div>
              <p v-if="outcomeMessageParts(o).length" class="outcome-message">
                <template v-for="(part, i) in outcomeMessageParts(o)" :key="i">
                  <strong v-if="part.actor">{{ part.text }}</strong>
                  <template v-else>{{ part.text }}</template>
                </template>
              </p>
            </div>
          </div>
        </div>

        <!-- everywhere nobody went, all at once -->
        <div v-else-if="quietScenarios.length > 0" key="quiet" class="card reveal-card">
          <p class="progress hint">Round {{ view.round }} — the tales are told</p>
          <h3>🌙 All quiet elsewhere</h3>
          <p class="reveal-desc hint">No house showed its face at…</p>
          <div v-for="s in quietScenarios" :key="s.id" class="quiet-row">
            <span class="quiet-title">{{ s.emoji }} {{ s.title }}</span>
            <span class="quiet-town">at {{ townName(s.townId) }}</span>
          </div>
        </div>

        <!-- finale: waiting on the houses before the next round -->
        <div v-else key="waiting" class="card reveal-card">
          <h3 class="score-title">🕯️ The court awaits</h3>
          <p class="hint">Every house must confirm before the tale continues…</p>
          <ul class="ready-list">
            <li v-for="p in view.players" :key="p.id">
              <span class="dot" :style="{ background: familyOf(p.id)?.color ?? '#666' }" />
              {{ p.name }}
              <span class="spacer" />
              <span v-if="!p.connected" class="offline">away</span>
              <span v-else-if="p.ready" class="ready">✓ ready</span>
              <span v-else class="hint">weighing the omens…</span>
            </li>
          </ul>
        </div>
      </Transition>
    </main>

    <!-- ================= FINISHED ================= -->
    <main v-else key="finished" class="finished">
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

    </Transition>
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

.phase-timer {
  height: 4px;
  display: flex;
  justify-content: flex-start;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
}

.phase-timer-bar {
  height: 100%;
  width: 0%;
  background: var(--gold-soft);
  animation-name: phase-timer-grow;
  animation-timing-function: linear;
  animation-fill-mode: forwards;
}

@keyframes phase-timer-grow {
  from {
    width: 0%;
  }
  to {
    width: 100%;
  }
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

/* resolution reveal: one scenario at a time, centre stage */
.reveal-stage {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  overflow-y: auto;
}

.reveal-progress {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
  z-index: 1;
}

.reveal-progress-bar {
  height: 100%;
  width: 0%;
  background: var(--gold-soft);
  animation-name: reveal-progress-fill;
  animation-timing-function: linear;
  animation-fill-mode: forwards;
}

@keyframes reveal-progress-fill {
  from {
    width: 0%;
  }
  to {
    width: 100%;
  }
}

.reveal-card {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  width: min(680px, 92vw);
  max-height: 100%;
  overflow-y: auto;
  padding: 1.8rem 2rem;
  font-size: 1.05rem;
}

.reveal-card .progress {
  font-size: 0.85rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.reveal-card h3 {
  color: var(--gold-soft);
  font-size: 1.5rem;
}

.reveal-card h3 small {
  color: var(--text-dim);
  font-weight: normal;
  font-size: 0.65em;
  margin-left: 0.4em;
}

.reveal-desc {
  font-size: 1rem;
}

.score-title {
  text-align: center;
}

.intro-card {
  text-align: center;
  padding: 2.6rem 2rem;
}

.intro-card h3 {
  font-size: 1.9rem;
}


.quiet-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.8rem;
  padding: 0.4rem 0.5rem;
  border-radius: 6px;
  background: var(--bg-inset);
}

.quiet-town {
  color: var(--text-dim);
  font-size: 0.9em;
}

/* card + phase animations (matching the player phones) */
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

.phase-fade-enter-active {
  transition: opacity 0.4s ease, transform 0.4s ease;
}

.phase-fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.phase-fade-enter-from {
  opacity: 0;
  transform: scale(0.98);
}

.phase-fade-leave-to {
  opacity: 0;
  transform: scale(1.02);
}

.outcome {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  padding: 0.6rem 0.7rem;
  border-radius: 6px;
  margin-top: 0.45rem;
  background: var(--bg-inset);
}

.outcome .portrait-col {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.outcome .outcome-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.outcome .outcome-head {
  display: flex;
  align-items: center;
  gap: 0.6rem;
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

.outcome .result-col {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.1rem;
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

.outcome .outcome-message {
  color: var(--gold-soft);
  font-size: 0.95rem;
  line-height: 1.35;
  font-style: italic;
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
  min-height: 100dvh;
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

/* the reveal card is written for a wide board — reflow it for a narrow phone screen */
@media (max-width: 480px) {
  .reveal-stage {
    padding: 0.75rem;
  }

  .reveal-card {
    width: min(680px, 96vw);
    padding: 1.2rem 1rem;
    font-size: 0.95rem;
  }

  .reveal-card h3 {
    font-size: 1.2rem;
  }

  .outcome {
    flex-direction: column;
    text-align: center;
  }

  .outcome .outcome-head {
    flex-direction: column;
  }

  .outcome .who,
  .outcome .result-col {
    align-items: center;
    text-align: center;
  }

  .outcome .verdict {
    min-width: 0;
    text-align: center;
  }
}
</style>
