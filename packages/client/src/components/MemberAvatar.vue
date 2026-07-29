<script setup lang="ts">
import { computed } from 'vue'
import { createAvatar } from '@dicebear/core'
import { openPeeps } from '@dicebear/collection'
import type { MemberAppearance } from '@family-feudal/shared'

const props = withDefaults(
  defineProps<{
    appearance: MemberAppearance
    /** stable per-character seed (e.g. member name) for the traits we don't expose */
    seed: string
    /** the house/family banner colour — clothing always matches it, hex with or without '#' */
    shirtColor: string
    size?: number
  }>(),
  { size: 96 },
)

const dataUri = computed(() =>
  createAvatar(openPeeps, {
    seed: props.seed,
    size: props.size,
    skinColor: [props.appearance.skinColor],
    headContrastColor: [props.appearance.hairColor],
    head: [props.appearance.head],
    face: [props.appearance.face],
    clothingColor: [props.shirtColor.replace('#', '')],
    facialHairProbability: props.appearance.facialHair === 'none' ? 0 : 100,
    facialHair: props.appearance.facialHair === 'none' ? ['full'] : [props.appearance.facialHair],
    accessoriesProbability: props.appearance.accessories === 'none' ? 0 : 100,
    accessories: props.appearance.accessories === 'none' ? ['glasses'] : [props.appearance.accessories],
    maskProbability: 0,
  }).toDataUri(),
)
</script>

<template>
  <img :src="dataUri" :width="size" :height="size" class="member-avatar" alt="" />
</template>

<style scoped>
.member-avatar {
  border-radius: 50%;
  background: var(--bg-inset);
  flex-shrink: 0;
}
</style>
