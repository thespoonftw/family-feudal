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
import { revealTotalMs, SKILLS } from '@family-feudal/shared'
import { useGameStore } from '../stores/game'
import ScoreBoard from '../components/ScoreBoard.vue'
import MemberAvatar from '../components/MemberAvatar.vue'

const router = useRouter()
const game = useGameStore()

const actionError = ref('')
const menuOpen = ref(false)

const SKILL_ICONS: Record<SkillKey, string> = {
  might: '⚔️',
  charm: '🌹',
  wit: '📜',
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

const view = computed(() => game.view)

/** scenarios you may send members to: all public ones + your own home scenario */
const yourScenarios = computed<Scenario[]>(() => {
  if (!view.value) return []
  const familyId = game.yourFamily?.id
  return view.value.scenarios.filter((s) => !s.homeFamilyId || s.homeFamilyId === familyId)
})

function townName(townId: string): string {
  return view.value?.towns.find((t) => t.id === townId)?.name ?? '?'
}

/** the colour of the house whose home city this is — undefined for the capital */
function townColor(townId: string): string | undefined {
  return view.value?.towns.find((t) => t.id === townId)?.color
}

/** splits a description around its town name so the name can be bolded/coloured inline */
function descriptionParts(description: string, townId: string): { text: string; town: boolean }[] {
  const name = townName(townId)
  if (!name || name === '?') return [{ text: description, town: false }]
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return description
    .split(new RegExp(`(${escaped})`))
    .filter((part) => part.length > 0)
    .map((text) => ({ text, town: text === name }))
}

function memberAssignment(memberId: string): string {
  return view.value?.yourAssignments[memberId] ?? ''
}

/** the member currently occupying a scenario slot (at most one, enforced server-side) */
function assignedMember(scenarioId: string): FamilyMember | undefined {
  const memberId = Object.entries(view.value?.yourAssignments ?? {}).find(
    ([, sid]) => sid === scenarioId,
  )?.[0]
  return game.yourFamily?.members.find((m) => m.id === memberId)
}

// ---------- drag-to-assign (pointer events so it works with touch and mouse alike) ----------

/** every portrait on this screen — agent bar, scenario slots, drag ghost — is this size */
const AVATAR_SIZE = 76

// ---------- planning: zoom the whole screen so ~5 scenario cards fit the visible area
// on any device (small phone vs. large tablet), header and agent bar included ----------

const gameEl = ref<HTMLElement | null>(null)
const headerEl = ref<HTMLElement | null>(null)
const planningEl = ref<HTMLElement | null>(null)
const scenarioListEl = ref<HTMLElement | null>(null)
const agentsBarEl = ref<HTMLElement | null>(null)
const planBarEl = ref<HTMLElement | null>(null)

/** applied as `zoom` to the header + planning screen; 1 = authored size */
const uiScale = ref(1)
const headerZoom = computed(() => (view.value?.phase === 'planning' ? uiScale.value : 1))

const TARGET_VISIBLE_CARDS = 5
const UI_SCALE_MIN = 0.6
const UI_SCALE_MAX = 1.5

/** an element's height with the currently-applied zoom divided back out, i.e. its
 *  size as if zoom were 1 — lets each pass converge without a separate zoom-1 measurement.
 *  (offsetHeight reliably reports the zoomed size; getComputedStyle of a zoomed element's
 *  own declared lengths does not, consistently, across browsers — so gaps/padding below
 *  are converted from their authored rem values via the (never-zoomed) root font size
 *  instead of read back off the zoomed elements) */
function naturalHeight(el: HTMLElement | null): number {
  return el ? el.offsetHeight / uiScale.value : 0
}

/** must track `.planning`'s authored gap/padding and `.scenario-list`'s authored gap below */
const MAIN_GAP_REM = 0.5
const MAIN_PADDING_REM = 0.5 * 2
const LIST_GAP_REM = 0.35

/** must track `.agent`'s and `.agents-bar`'s authored horizontal padding/gap below */
const AGENT_PADDING_X_REM = 0.2 * 2
const AGENTS_BAR_GAP_REM = 0.5
const AGENTS_BAR_PADDING_X_REM = 0.4 * 2
/** the narrowest a scenario card's text column can get before it's unreadable */
const MIN_TEXT_COLUMN_PX = 80

/** on a tall, narrow phone the height budget alone would zoom in far enough to overflow
 *  the (comparatively tight) width — cap zoom so the fixed-width avatar row (which can't
 *  shrink, unlike scenario text) and a legible card text column both still fit horizontally.
 *  agents-bar stretches to the same true (un-zoomed) width as the rest of the screen, so its
 *  offsetWidth doubles as that width budget regardless of the currently-applied zoom */
function widthCeiling(rootPx: number): number {
  const bar = agentsBarEl.value
  const trueWidth = bar?.offsetWidth ?? 0
  if (!bar || !(trueWidth > 0)) return Infinity
  const memberCount = bar.children.length || 1

  const agentsRowNatural =
    memberCount * (AVATAR_SIZE + AGENT_PADDING_X_REM * rootPx) +
    (memberCount - 1) * AGENTS_BAR_GAP_REM * rootPx +
    AGENTS_BAR_PADDING_X_REM * rootPx
  const slotRowNatural = AVATAR_SIZE + MIN_TEXT_COLUMN_PX

  return Math.min(trueWidth / agentsRowNatural, trueWidth / slotRowNatural)
}

/** re-measures for a few frames after applying a new scale, since text reflow at the new
 *  size (more/fewer wrapped lines) can shift the natural card height the first pass assumed */
const MAX_RECALC_PASSES = 4

function recalcUiScale(pass = 0) {
  const game = gameEl.value
  const header = headerEl.value
  const list = scenarioListEl.value
  const agentsBar = agentsBarEl.value
  const planBar = planBarEl.value
  const card = list?.querySelector<HTMLElement>('.scenario-card')
  if (!game || !header || !list || !agentsBar || !planBar || !card) return

  const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16

  const naturalTotal =
    naturalHeight(header) +
    naturalHeight(agentsBar) +
    naturalHeight(planBar) +
    (2 * MAIN_GAP_REM + MAIN_PADDING_REM) * rootPx +
    TARGET_VISIBLE_CARDS * naturalHeight(card) +
    (TARGET_VISIBLE_CARDS - 1) * LIST_GAP_REM * rootPx

  if (!(naturalTotal > 0) || !(game.clientHeight > 0)) return
  const heightTarget = game.clientHeight / naturalTotal
  const next = Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, Math.min(heightTarget, widthCeiling(rootPx))))

  const changed = Math.abs(next - uiScale.value) > 0.01
  uiScale.value = next
  if (changed && pass < MAX_RECALC_PASSES) requestAnimationFrame(() => recalcUiScale(pass + 1))
}

let uiScaleObserver: ResizeObserver | null = null

watch(gameEl, (el, oldEl) => {
  if (oldEl && uiScaleObserver) uiScaleObserver.unobserve(oldEl)
  if (!el) return
  if (!uiScaleObserver) uiScaleObserver = new ResizeObserver(() => recalcUiScale())
  uiScaleObserver.observe(el)
})

watch(planningEl, (el) => {
  if (el) requestAnimationFrame(recalcUiScale)
})

const draggingMemberId = ref<string | null>(null)
/** the scenario slot a drag was picked up from, or null when dragging from the agent bar */
const dragSourceScenarioId = ref<string | null>(null)
const dragOverScenarioId = ref<string | null>(null)
const dragPos = ref({ x: 0, y: 0 })
const dragStartPos = ref({ x: 0, y: 0 })
/** stays false for a plain tap (no pointer movement past the threshold) */
const dragMoved = ref(false)

function draggingMember(): FamilyMember | undefined {
  return game.yourFamily?.members.find((m) => m.id === draggingMemberId.value)
}

/** begin a potential drag; sourceScenarioId is set when picking a member up off a slot
 *  (so we can tell a re-drag from a fresh deploy, and a plain tap from an actual drag) */
function startDrag(e: PointerEvent, memberId: string, sourceScenarioId: string | null) {
  if (e.button !== undefined && e.button !== 0) return
  // avatars are <img>s, which browsers make natively draggable — that native drag would
  // hijack the gesture (no more pointermove/up) before our own drag logic sees it
  e.preventDefault()
  draggingMemberId.value = memberId
  dragSourceScenarioId.value = sourceScenarioId
  dragStartPos.value = { x: e.clientX, y: e.clientY }
  dragPos.value = { x: e.clientX, y: e.clientY }
  dragMoved.value = false
  window.addEventListener('pointermove', onDragMove)
  window.addEventListener('pointerup', onDragEnd)
  window.addEventListener('pointercancel', onDragEnd)
}

function onDragMove(e: PointerEvent) {
  dragPos.value = { x: e.clientX, y: e.clientY }
  if (!dragMoved.value) {
    const dx = e.clientX - dragStartPos.value.x
    const dy = e.clientY - dragStartPos.value.y
    if (Math.hypot(dx, dy) > 6) dragMoved.value = true
  }
  const el = document.elementFromPoint(e.clientX, e.clientY)
  const card = el?.closest<HTMLElement>('[data-scenario-id]')
  dragOverScenarioId.value = card?.dataset['scenarioId'] ?? null
}

async function onDragEnd() {
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', onDragEnd)
  window.removeEventListener('pointercancel', onDragEnd)
  const memberId = draggingMemberId.value
  const scenarioId = dragOverScenarioId.value
  const sourceScenarioId = dragSourceScenarioId.value
  const moved = dragMoved.value
  draggingMemberId.value = null
  dragOverScenarioId.value = null
  dragSourceScenarioId.value = null
  if (!memberId || !view.value) return

  // a plain tap on an occupied slot (picked up, but never actually dragged) recalls them
  if (!moved && sourceScenarioId) {
    const next = { ...view.value.yourAssignments }
    delete next[memberId]
    const err = await game.assign(next)
    actionError.value = err ?? ''
    return
  }

  if (!scenarioId || scenarioId === sourceScenarioId) return
  if (assignedMember(scenarioId) && assignedMember(scenarioId)!.id !== memberId) return
  const next = { ...view.value.yourAssignments, [memberId]: scenarioId }
  const err = await game.assign(next)
  actionError.value = err ?? ''
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
/** thematic splash shown while the map fades away, before the first decision card */
const showIntro = ref(false)
/** phones unlock "next round" once the board's reveal sequence has finished */
const resultsRevealed = ref(false)

let introTimer: ReturnType<typeof setTimeout> | null = null
let revealTimer: ReturnType<typeof setTimeout> | null = null

const currentDeployment = computed(
  () => yourDeployments.value[choiceIndex.value] ?? null,
)

// phase entry (or rejoin mid-phase): stage the approach intro, or arm the reveal unlock.
// Multi-source form matters: a getter returning an array would "change" on every
// broadcast (any player's action) and restart the intro/reveal timers.
watch(
  [() => view.value?.phase, () => view.value?.round],
  () => {
    if (introTimer) clearTimeout(introTimer)
    if (revealTimer) clearTimeout(revealTimer)
    const v = view.value
    if (!v) return
    if (v.phase === 'approach') {
      const idx = yourDeployments.value.findIndex((d) => chosenIndex(d.scenario.id) === null)
      choiceIndex.value = idx === -1 ? yourDeployments.value.length : idx
      showIntro.value = true
      introTimer = setTimeout(() => (showIntro.value = false), 2400)
    } else if (v.phase === 'resolution') {
      resultsRevealed.value = false
      // unlocks at the same moment the board's standings card lands
      revealTimer = setTimeout(
        () => (resultsRevealed.value = true),
        revealTotalMs(v.scenarios, v.lastResult),
      )
    }
  },
  { immediate: true },
)

onUnmounted(() => {
  if (introTimer) clearTimeout(introTimer)
  if (revealTimer) clearTimeout(revealTimer)
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', onDragEnd)
  window.removeEventListener('pointercancel', onDragEnd)
  uiScaleObserver?.disconnect()
})

// choices are live on the server as they're made, so a player is "ready" the moment the
// last one is picked — no commit button; changes stay possible until every house is done
watch(
  [() => view.value?.phase, allChosen],
  () => {
    if (view.value?.phase === 'approach' && allChosen.value && !game.you?.ready) {
      game.setReady(true)
    }
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

// ---------- resolution helpers ----------
// (the full story plays out on the host board; once its reveal ends the phone shows
// the player their own family's outcomes)

function familyById(familyId: string): Family | undefined {
  return view.value?.families.find((f) => f.id === familyId)
}

const yourOutcomes = computed<ScenarioOutcome[]>(() => {
  const familyId = game.yourFamily?.id
  if (!familyId) return []
  return view.value?.lastResult?.outcomes.filter((o) => o.familyId === familyId) ?? []
})

function outcomeScenario(o: ScenarioOutcome): Scenario | undefined {
  return view.value?.scenarios.find((s) => s.id === o.scenarioId)
}

function outcomeMemberNames(o: ScenarioOutcome): string {
  return (game.yourFamily?.members ?? [])
    .filter((m) => o.memberIds.includes(m.id))
    .map((m) => m.name)
    .join(', ')
}

/** the first attending member — used for the outcome's portrait */
function outcomeMember(o: ScenarioOutcome): FamilyMember | undefined {
  return (game.yourFamily?.members ?? []).find((m) => o.memberIds.includes(m.id))
}

/** the outcome's portrait, with the designed success/failure face swapped in (dev panel) */
function outcomeAppearance(o: ScenarioOutcome): FamilyMember['appearance'] | undefined {
  const member = outcomeMember(o)
  if (!member) return undefined
  const override = view.value?.faceOutcomes[member.appearance.face]
  const face = o.success ? override?.successFace : override?.failureFace
  return face ? { ...member.appearance, face } : member.appearance
}

function approachLabel(o: ScenarioOutcome): string {
  return outcomeScenario(o)?.approaches[o.approachIndex]?.label ?? ''
}

/** the flavour line for the approach taken, chosen by whether the check succeeded */
function outcomeMessage(o: ScenarioOutcome): string {
  const approach = outcomeScenario(o)?.approaches[o.approachIndex]
  if (!approach) return ''
  return o.success ? approach.successMessage : approach.failureMessage
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
  <div
    v-if="view"
    ref="gameEl"
    class="game"
    :class="{ 'lock-viewport': view.phase === 'planning' }"
  >
    <header ref="headerEl" :style="{ zoom: headerZoom }">
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

    <Transition name="phase-fade" mode="out-in">

    <!-- ================= LOBBY ================= -->
    <main v-if="view.phase === 'lobby'" key="lobby" class="lobby">
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
    <main
      v-else-if="view.phase === 'planning'"
      key="planning"
      ref="planningEl"
      class="planning"
      :style="{ zoom: uiScale }"
    >
      <section ref="scenarioListEl" class="scenario-list">
        <div
          v-for="s in yourScenarios"
          :key="s.id"
          class="card scenario-card"
          :data-scenario-id="s.id"
          :class="{
            'drop-target': dragOverScenarioId === s.id,
            'drop-blocked': dragOverScenarioId === s.id && !!assignedMember(s.id) && assignedMember(s.id)!.id !== draggingMemberId,
          }"
        >
          <div class="scenario-info">
            <h4>{{ s.emoji }} {{ s.title }}</h4>
            <p class="hint">
              <template v-for="(part, i) in descriptionParts(s.description, s.townId)" :key="i">
                <b v-if="part.town" :style="{ color: townColor(s.townId) }">{{ part.text }}</b>
                <template v-else>{{ part.text }}</template>
              </template>
            </p>
          </div>
          <button class="scenario-slot" type="button">
            <span
              class="slot-circle"
              :class="{ filled: !!assignedMember(s.id) }"
              @pointerdown="
                assignedMember(s.id) && startDrag($event, assignedMember(s.id)!.id, s.id)
              "
            >
              <MemberAvatar
                v-if="assignedMember(s.id)"
                :appearance="assignedMember(s.id)!.appearance"
                :seed="assignedMember(s.id)!.name"
                :shirt-color="game.yourFamily?.color ?? '#888888'"
                :size="AVATAR_SIZE"
              />
            </span>
          </button>
        </div>
      </section>

      <!-- your agents, dragged up onto a scenario slot above -->
      <div ref="agentsBarEl" class="agents-bar">
        <div
          v-for="m in game.yourFamily?.members ?? []"
          :key="m.id"
          class="agent"
          :class="{
            'is-dragging': draggingMemberId === m.id,
            deployed: !!memberAssignment(m.id),
          }"
          @pointerdown="startDrag($event, m.id, null)"
        >
          <MemberAvatar
            :appearance="m.appearance"
            :seed="m.name"
            :shirt-color="game.yourFamily?.color ?? '#888888'"
            :size="AVATAR_SIZE"
          />
          <strong>{{ m.name }}</strong>
          <small class="agent-skills">
            <template v-for="(skill, i) in SKILLS" :key="skill">
              <template v-if="i > 0"> · </template>
              {{ SKILL_ICONS[skill] }}{{ m.skills[skill] }}
            </template>
          </small>
        </div>
      </div>

      <!-- floating drag ghost, follows the pointer -->
      <div
        v-if="draggingMember()"
        class="drag-ghost"
        :style="{ left: dragPos.x + 'px', top: dragPos.y + 'px' }"
      >
        <MemberAvatar
          :appearance="draggingMember()!.appearance"
          :seed="draggingMember()!.name"
          :shirt-color="game.yourFamily?.color ?? '#888888'"
          :size="AVATAR_SIZE"
        />
      </div>

      <!-- ready bar pinned under the agents -->
      <div ref="planBarEl" class="plan-bar">
        <button class="ready-btn" @click="game.setReady(!game.you?.ready)">
          {{ game.you?.ready ? 'Not ready after all…' : 'Ready — seal the plans' }}
        </button>
      </div>
    </main>

    <!-- ================= APPROACH ================= -->
    <main v-else-if="view.phase === 'approach'" key="approach" class="approach">
      <section class="choices-pane">
        <Transition name="card-rise" mode="out-in" appear>
          <!-- thematic beat while the map fades away -->
          <div v-if="showIntro" key="intro" class="card choice-card intro-card">
            <h2>The plans are sealed</h2>
            <p class="hint">Now choose how your kin see them through…</p>
          </div>

          <!-- one decision at a time -->
          <div
            v-else-if="currentDeployment"
            :key="currentDeployment.scenario.id"
            class="card choice-card"
          >
            <p class="progress hint">
              Round {{ view.round }} · decision {{ choiceIndex + 1 }} of
              {{ yourDeployments.length }}
            </p>
            <h3>{{ currentDeployment.scenario.emoji }} {{ currentDeployment.scenario.title }}</h3>
            <p class="hint">
              <template
                v-for="(part, i) in descriptionParts(
                  currentDeployment.scenario.description,
                  currentDeployment.scenario.townId,
                )"
                :key="i"
              >
                <b
                  v-if="part.town"
                  :style="{ color: townColor(currentDeployment.scenario.townId) }"
                >{{ part.text }}</b>
                <template v-else>{{ part.text }}</template>
              </template>
            </p>
            <p class="attendee">
              <MemberAvatar
                :appearance="currentDeployment.member.appearance"
                :seed="currentDeployment.member.name"
                :shirt-color="game.yourFamily?.color ?? '#888888'"
                :size="72"
              />
              <span class="attendee-info">
                <span class="attendee-name"><strong>{{ currentDeployment.member.name }}</strong> attends</span>
                <small>
                  <template v-for="(skill, i) in SKILLS" :key="skill">
                    <template v-if="i > 0"> · </template>
                    {{ SKILL_ICONS[skill] }}{{ currentDeployment.member.skills[skill] }}
                  </template>
                </small>
              </span>
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
              You sent no one out this round. The other houses are still deciding…
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
              <button class="small secondary" @click="revisitChoice(i)">Change</button>
            </div>
            <p class="hint waiting-hint">
              Waiting for the other houses… ({{ confirmedCount }} / {{ activePlayerCount }})
              <template v-if="yourDeployments.length > 0">
                <br />You may change your mind until every house is done.
              </template>
            </p>
          </div>
        </Transition>
      </section>
    </main>

    <!-- ================= RESOLUTION ================= -->
    <main v-else-if="view.phase === 'resolution'" key="resolution" class="resolution">
      <div class="card watch-card">
        <h2>Round {{ view.round }} — the tales are told</h2>
        <template v-if="resultsRevealed">
          <div v-if="yourOutcomes.length > 0" class="your-results">
            <p class="hint results-title">Your kin report back:</p>
            <div
              v-for="o in yourOutcomes"
              :key="o.scenarioId"
              class="mini-outcome"
              :class="verdictClass(o)"
            >
              <div class="portrait-col">
                <MemberAvatar
                  v-if="outcomeMember(o)"
                  :appearance="outcomeAppearance(o)!"
                  :seed="outcomeMember(o)!.name"
                  :shirt-color="game.yourFamily?.color ?? '#888888'"
                  :size="96"
                />
                <span class="verdict">{{ verdictText(o) }}</span>
                <span class="math">{{ o.skillTotal }} + 🎲{{ o.roll }} = {{ o.total }}</span>
              </div>
              <div class="outcome-body">
                <span class="who">
                  <strong>{{ outcomeMemberNames(o) }}</strong>
                  <small>
                    {{ outcomeScenario(o)?.emoji }} {{ outcomeScenario(o)?.title }} —
                    “{{ approachLabel(o) }}”
                  </small>
                </span>
                <p v-if="outcomeMessage(o)" class="outcome-message">{{ outcomeMessage(o) }}</p>
              </div>
            </div>
          </div>
          <p v-else class="hint">You sent no one out this round.</p>
          <button v-if="!game.you?.ready" class="next-btn" @click="onNextRound">
            {{ view.round >= view.totalRounds ? 'See Final Results' : 'Next Round' }}
          </button>
          <p v-else class="hint">
            Waiting for the other houses… ({{ confirmedCount }} / {{ activePlayerCount }} confirmed)
          </p>
        </template>
        <template v-else>
          <p class="hint">All eyes on the great hall screen…</p>
          <p class="hint heralds">The heralds are speaking…</p>
        </template>
      </div>
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
        <button @click="onLeave">Return to the Great Hall</button>
      </div>
    </main>

    </Transition>
  </div>

  <div v-else class="loading">Summoning the realm…</div>
</template>

<style scoped>
.game {
  min-height: 100vh;
  min-height: 100dvh;
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

/* planning: always a portrait phone-shaped column, even on a wide desktop browser */
.planning {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem;
  width: 100%;
  max-width: 460px;
  margin: 0 auto;
}

.scenario-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding-right: 0.1rem;
}

.scenario-card {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.4rem 0.6rem;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.scenario-card.drop-target {
  background: var(--bg-inset);
  border-color: var(--gold-soft);
}

.scenario-card.drop-blocked {
  border-color: var(--failure);
}

.scenario-info {
  flex: 1;
  min-width: 0;
}

.scenario-info h4 {
  margin: 0 0 0.1rem;
  font-size: 0.95rem;
  line-height: 1.2;
}

.scenario-info h4 small {
  color: var(--text-dim);
  font-weight: normal;
  font-size: 0.8em;
  margin-left: 0.3em;
}

.scenario-info .hint {
  margin: 0;
  font-size: 0.78rem;
  line-height: 1.2;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.scenario-slot {
  flex-shrink: 0;
  background: none;
  border: none;
  font-weight: normal;
  display: flex;
  padding: 0.1rem;
  width: 4.75rem;
}

.slot-circle {
  box-sizing: content-box;
  width: 4.75rem;
  height: 4.75rem;
  border-radius: 50%;
  border: 1px dashed var(--border);
  background: var(--bg-inset);
  display: flex;
  align-items: center;
  justify-content: center;
  touch-action: none;
}

.slot-circle.filled {
  border-style: solid;
  border-color: var(--gold-soft);
}

/* your 3 agents, pinned along the bottom — drag one up onto a scenario slot */
.agents-bar {
  flex-shrink: 0;
  display: flex;
  gap: 0.5rem;
  padding: 0.6rem 0.4rem;
  border-top: 1px solid var(--border);
  background: var(--bg-raised);
  border-radius: 10px;
}

.agent {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  padding: 0.4rem 0.2rem;
  border-radius: 8px;
  cursor: grab;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  text-align: center;
}

.agent.deployed {
  opacity: 0.55;
}

.agent.is-dragging {
  opacity: 0.25;
}

.agent strong {
  font-size: 0.85rem;
  line-height: 1.1;
}

.agent-skills {
  color: var(--text-dim);
  font-size: 0.7rem;
  white-space: nowrap;
}

.drag-ghost {
  position: fixed;
  z-index: 40;
  pointer-events: none;
  transform: translate(-50%, -50%);
  opacity: 0.9;
  filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.5));
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

.attendee {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.attendee-info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
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

.intro-card {
  text-align: center;
  padding: 2rem 1.4rem;
}

.intro-card h2 {
  color: var(--gold-soft);
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

/* resolution: the story plays out on the host board */
.resolution {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.watch-card {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  width: min(480px, 92vw);
  padding: 2rem;
  text-align: center;
}

.watch-card h2 {
  color: var(--gold-soft);
}

.watch-card .next-btn {
  align-self: stretch;
}

/* your own agents' results, once the board reveal has finished */
.your-results {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  text-align: left;
}

.results-title {
  text-align: center;
}

.mini-outcome {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.5rem 0.6rem;
  border-radius: 6px;
  background: var(--bg-inset);
}

.mini-outcome .portrait-col {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.15rem;
}

.mini-outcome .outcome-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.mini-outcome .who {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
  min-width: 0;
}

.mini-outcome .outcome-message {
  color: var(--gold-soft);
  font-size: 0.85rem;
  line-height: 1.3;
  font-style: italic;
}

.mini-outcome .who small {
  color: var(--text-dim);
}

.mini-outcome .math {
  color: var(--text-dim);
  font-size: 0.7rem;
  white-space: nowrap;
}

.mini-outcome .verdict {
  font-weight: bold;
  font-size: 0.78rem;
  white-space: nowrap;
}

.mini-outcome.ok .verdict {
  color: var(--success);
}

.mini-outcome.beat .verdict {
  color: var(--gold-soft);
}

.mini-outcome.fail .verdict {
  color: var(--failure);
}

.waiting-hint {
  margin-top: 0.3rem;
  text-align: center;
}

.heralds {
  animation: heralds-pulse 1.8s ease-in-out infinite;
}

@keyframes heralds-pulse {
  0%,
  100% {
    opacity: 0.45;
  }

  50% {
    opacity: 1;
  }
}

/* cross-fade between phases (map fading away into the decision cards, …) */
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
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-dim);
}

/* pinned ready bar under the agents */
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
