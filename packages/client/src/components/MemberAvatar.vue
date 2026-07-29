<script setup lang="ts">
import { computed } from 'vue'
import { createAvatar } from '@dicebear/core'
import { micah } from '@dicebear/collection'
import type { MemberAppearance } from '@family-feudal/shared'

const props = withDefaults(
  defineProps<{
    appearance: MemberAppearance
    /** stable per-character seed (e.g. member name) for the traits we don't expose */
    seed: string
    size?: number
  }>(),
  { size: 48 },
)

const dataUri = computed(() =>
  createAvatar(micah, {
    seed: props.seed,
    size: props.size,
    baseColor: [props.appearance.skinColor],
    hair: [props.appearance.hair],
    hairColor: [props.appearance.hairColor],
    eyesColor: [props.appearance.eyesColor],
    shirtColor: [props.appearance.shirtColor],
    facialHairProbability: props.appearance.facialHair === 'none' ? 0 : 100,
    facialHair: props.appearance.facialHair === 'none' ? ['beard'] : [props.appearance.facialHair],
    glassesProbability: props.appearance.glasses === 'none' ? 0 : 100,
    glasses: props.appearance.glasses === 'none' ? ['round'] : [props.appearance.glasses],
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
