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
    /** the house/family banner colour — shirts always match it, hex with or without '#' */
    shirtColor: string
    size?: number
  }>(),
  { size: 96 },
)

// a turban is cloth, not hair — it follows the shirt colour instead of the member's own hairColor
const renderedHairColor = computed(() =>
  props.appearance.hair === 'turban' ? props.shirtColor.replace('#', '') : props.appearance.hairColor,
)

const dataUri = computed(() =>
  createAvatar(micah, {
    seed: props.seed,
    size: props.size,
    baseColor: [props.appearance.skinColor],
    eyesColor: [props.appearance.eyesColor],
    eyes: [props.appearance.eyes],
    eyebrows: [props.appearance.eyebrows],
    mouth: [props.appearance.mouth],
    hair: [props.appearance.hair],
    hairColor: [renderedHairColor.value],
    shirt: [props.appearance.shirt],
    shirtColor: [props.shirtColor.replace('#', '')],
    facialHairProbability: props.appearance.facialHair === 'none' ? 0 : 100,
    facialHair: props.appearance.facialHair === 'none' ? ['beard'] : [props.appearance.facialHair],
    ...(props.appearance.facialHair === 'beard' ? { facialHairColor: [props.appearance.hairColor] } : {}),
    glassesProbability: props.appearance.glasses === 'none' ? 0 : 100,
    glasses: props.appearance.glasses === 'none' ? ['round'] : [props.appearance.glasses],
    earringsProbability: props.appearance.earrings === 'none' ? 0 : 100,
    earrings: props.appearance.earrings === 'none' ? ['stud'] : [props.appearance.earrings],
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
