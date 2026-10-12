<script setup lang="ts">
import type { BsSuitRailItem, BsContextNavigationGroup, BsAdministrationShellLabels } from '@building-suit/ux'
defineProps<{ suits: BsSuitRailItem[]; groups: BsContextNavigationGroup[]; selectedSuit?: string; selectedContext?: string; contextTitle: string; labels: BsAdministrationShellLabels; loading: boolean; productName: string }>()
const emit = defineEmits<{ selectSuit: [id: string] }>()
</script>
<template>
  <BsAdministrationShell :suits="suits" :groups="groups" :selected-suit="selectedSuit" :selected-context="selectedContext" :context-title="contextTitle" :labels="labels" :loading="loading" @select-suit="emit('selectSuit', $event.id)">
    <template #header><BsInline justify="between"><BsProductLogo :name="productName" /><BsSettingsMenu /></BsInline></template>
    <slot />
  </BsAdministrationShell>
</template>
