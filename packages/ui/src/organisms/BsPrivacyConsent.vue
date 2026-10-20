<script setup lang="ts">
import type { PrivacyPresentation } from '@building-suit/ux'
const props = defineProps<{ model: PrivacyPresentation }>()
const reopen = ref<HTMLElement | null>(null)
usePrivacyConsentFocus(() => props.model, reopen)
</script>
<template>
  <template v-if="model.ready">
    <section v-if="model.prompt" class="bs-privacy-banner" aria-labelledby="bs-privacy-title" role="region">
      <h2 id="bs-privacy-title" class="text-lg font-bold">{{ model.copy.title }}</h2>
      <p class="text-sm">{{ model.copy.body }}</p>
      <BsLink to="/privacy">{{ model.copy.policy }}</BsLink>
      <div class="flex flex-wrap gap-3">
        <BsButton @click="model.save(true)">{{ model.copy.accept }}</BsButton>
        <BsButton @click="model.save(false)">{{ model.copy.reject }}</BsButton>
        <BsButton @click="model.open">{{ model.copy.settings }}</BsButton>
      </div>
    </section>
    <div v-if="model.showReopen !== false" ref="reopen" class="bs-privacy-reopen"><BsButton @click="model.open">{{ model.copy.settings }}</BsButton></div>
    <BsDialog :visible="model.settings" :title="model.copy.title" size="sm" @update:visible="model.close">
      <div class="grid gap-4">
        <p>{{ model.copy.necessary }}</p>
        <BsSwitch :model-value="model.analytics" :label="model.copy.analytics" @update:model-value="model.change" />
        <BsLink to="/privacy">{{ model.copy.policy }}</BsLink>
        <div class="flex flex-wrap gap-3">
          <BsButton @click="model.save(true)">{{ model.copy.accept }}</BsButton>
          <BsButton @click="model.save(false)">{{ model.copy.reject }}</BsButton>
          <BsButton @click="model.save(model.analytics)">{{ model.copy.save }}</BsButton>
        </div>
      </div>
    </BsDialog>
  </template>
</template>
<style>
.bs-privacy-banner { position: fixed; inset-inline: 1rem; bottom: 4.5rem; z-index: 100; max-width: 42rem; display: grid; gap: var(--bs-space-3); padding: var(--bs-space-5); background: var(--bs-surface); color: var(--bs-text); border: 1px solid var(--bs-border); border-radius: var(--bs-radius-card); box-shadow: var(--bs-shadow-3); max-height: 70dvh; overflow: auto; }
.bs-privacy-reopen { position: fixed; inset-inline-end: 1rem; bottom: 1rem; z-index: 90; }
</style>
