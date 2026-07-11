<script setup lang="ts">
import { computed } from 'vue'
import type { Family, Scenario, SkillKey, Town } from '@family-feudal/shared'

const props = defineProps<{
  towns: Town[]
  scenarios: Scenario[]
  families: Family[]
  /** scenarioId -> number of your members assigned there */
  assignedCounts: Record<string, number>
  selectedScenarioId: string | null
}>()

const emit = defineEmits<{
  select: [scenarioId: string]
}>()

const SKILL_ICONS: Record<SkillKey, string> = {
  combat: '⚔️',
  beauty: '🌹',
  intellect: '📜',
  diplomacy: '🕊️',
}

function town(id: string): Town | undefined {
  return props.towns.find((t) => t.id === id)
}

const homesByTown = computed(() => {
  const map: Record<string, Family[]> = {}
  for (const family of props.families) {
    ;(map[family.homeTownId] ??= []).push(family)
  }
  return map
})
</script>

<template>
  <svg class="realm" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
    <!-- realm border -->
    <rect x="1.5" y="1.5" width="97" height="97" rx="4" class="realm-border" />

    <!-- roads from capital to towns -->
    <g class="roads">
      <line
        v-for="t in towns.filter((t) => !t.isCapital)"
        :key="'road-' + t.id"
        :x1="towns.find((c) => c.isCapital)?.x"
        :y1="towns.find((c) => c.isCapital)?.y"
        :x2="t.x"
        :y2="t.y"
      />
    </g>

    <!-- towns -->
    <g v-for="t in towns" :key="t.id" class="town">
      <circle :cx="t.x" :cy="t.y" :r="t.isCapital ? 2.6 : 1.6" :class="{ capital: t.isCapital }" />
      <text :x="t.x" :y="t.y + (t.isCapital ? 5.4 : 4.2)" class="town-name">
        {{ t.name }}{{ t.isCapital ? ' ♔' : '' }}
      </text>
      <!-- family home shields -->
      <g v-for="(family, i) in homesByTown[t.id] ?? []" :key="family.id">
        <path
          :d="`M ${t.x - 3.4 - i * 2.6} ${t.y - 3.6} h 2 v 2 l -1 1 l -1 -1 Z`"
          :fill="family.color"
          stroke="#00000088"
          stroke-width="0.2"
        />
      </g>
    </g>

    <!-- scenario markers -->
    <g
      v-for="s in scenarios"
      :key="s.id"
      class="scenario"
      :class="{ selected: s.id === selectedScenarioId }"
      @click="emit('select', s.id)"
    >
      <template v-if="town(s.townId)">
        <circle
          :cx="town(s.townId)!.x + 2.6"
          :cy="town(s.townId)!.y - 2.6"
          r="2.6"
          class="scenario-bg"
          :class="{ home: !!s.homeFamilyId }"
        />
        <text
          :x="town(s.townId)!.x + 2.6"
          :y="town(s.townId)!.y - 1.7"
          class="scenario-icon"
          text-anchor="middle"
        >
          {{ SKILL_ICONS[s.skill] }}
        </text>
        <g v-if="(assignedCounts[s.id] ?? 0) > 0">
          <circle
            :cx="town(s.townId)!.x + 4.9"
            :cy="town(s.townId)!.y - 4.9"
            r="1.4"
            class="count-bg"
          />
          <text
            :x="town(s.townId)!.x + 4.9"
            :y="town(s.townId)!.y - 4.2"
            class="count"
            text-anchor="middle"
          >
            {{ assignedCounts[s.id] }}
          </text>
        </g>
      </template>
    </g>
  </svg>
</template>

<style scoped>
.realm {
  width: 100%;
  height: 100%;
  background: radial-gradient(ellipse at 50% 40%, #2e2517 0%, #221b11 75%);
  border-radius: 10px;
}

.realm-border {
  fill: none;
  stroke: var(--border);
  stroke-width: 0.4;
}

.roads line {
  stroke: #4a3c2a;
  stroke-width: 0.18;
  stroke-dasharray: 0.8 0.8;
}

.town circle {
  fill: #8a7856;
  stroke: #d8c79b;
  stroke-width: 0.25;
}

.town circle.capital {
  fill: #c9a227;
  stroke: #f0e3ad;
}

.town-name {
  font-size: 2.1px;
  fill: var(--text-dim);
  text-anchor: middle;
}

.scenario {
  cursor: pointer;
}

.scenario-bg {
  fill: #3b2f1e;
  stroke: var(--gold);
  stroke-width: 0.3;
}

.scenario-bg.home {
  stroke: #8a7856;
}

.scenario.selected .scenario-bg {
  fill: #5a4a24;
  stroke: var(--gold-soft);
  stroke-width: 0.5;
}

.scenario-icon {
  font-size: 2.4px;
  user-select: none;
}

.count-bg {
  fill: var(--gold);
}

.count {
  font-size: 1.8px;
  fill: #241c0d;
  font-weight: bold;
  user-select: none;
}
</style>
