<script setup lang="ts">
import { computed } from 'vue'
import type { Family, Player } from '@family-feudal/shared'

const props = defineProps<{
  families: Family[]
  players: Player[]
  winnerFamilyIds?: string[] | null
}>()

const sorted = computed(() => [...props.families].sort((a, b) => b.influence - a.influence))

function playerName(family: Family): string {
  return props.players.find((p) => p.id === family.playerId)?.name ?? '—'
}
</script>

<template>
  <div class="scoreboard card">
    <h3>Influence</h3>
    <ol>
      <li
        v-for="family in sorted"
        :key="family.id"
        :class="{ winner: winnerFamilyIds?.includes(family.id) }"
      >
        <span class="chip" :style="{ background: family.color }" />
        <span class="fam">
          {{ family.name }}
          <small>{{ playerName(family) }}</small>
        </span>
        <span class="pts">{{ family.influence }}</span>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.scoreboard h3 {
  color: var(--gold-soft);
  margin-bottom: 0.6rem;
}

ol {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

li {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.3rem 0.4rem;
  border-radius: 6px;
}

li.winner {
  background: #3b2f1e;
  outline: 1px solid var(--gold);
}

.chip {
  width: 14px;
  height: 14px;
  border-radius: 4px;
  flex-shrink: 0;
}

.fam {
  flex: 1;
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}

.fam small {
  color: var(--text-dim);
  font-size: 0.75rem;
}

.pts {
  font-weight: bold;
  color: var(--gold-soft);
  font-size: 1.1rem;
}
</style>
