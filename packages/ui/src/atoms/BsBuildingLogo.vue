<script setup lang="ts">
import { brands } from '@building-suit/brand'
withDefaults(defineProps<{ kind?: 'wordmark' | 'mark' }>(), { kind: 'wordmark' })
</script>
<template><span class="inline-flex items-center gap-3" role="img" aria-label="Building Suit" dir="ltr"><span class="ls-logo ls-logo-auto inline-grid h-12 w-9"><img :src="brands.building.logoLight" class="ls-logo-image ls-logo-image-light" alt=""><img :src="brands.building.logoDark" class="ls-logo-image ls-logo-image-dark" alt=""></span><strong v-if="kind !== 'mark'" class="text-lg font-extrabold">Building Suit</strong></span></template>
