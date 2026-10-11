<script setup lang="ts">
import type { BsImportStep } from '@building-suit/contracts'
const props = defineProps<{ title: string; steps: BsImportStep[]; step: string; pending?: boolean; error?: string | null; nextLabel: string; backLabel: string; canAdvance?: boolean }>()
const emit = defineEmits<{ next: []; back: [] }>()
const index = computed(() => props.steps.findIndex(step => step.id === props.step))
</script>

<template>
  <section class="bs-import-wizard" :aria-label="title" :aria-busy="pending || undefined">
    <h2>{{ title }}</h2>
    <ol class="bs-workflow-steps">
      <li v-for="(item, position) in steps" :key="item.id" :aria-current="item.id === step ? 'step' : undefined" :data-complete="position < index || undefined">{{ item.label }}</li>
    </ol>
    <BsAlert v-if="error" tone="error">{{ error }}</BsAlert>
    <fieldset :disabled="pending" class="bs-workflow-fields">
      <slot :step="step" :pending="pending" />
    </fieldset>
    <BsFormActions>
      <BsButton v-if="index > 0" :disabled="pending" @click="emit('back')">{{ backLabel }}</BsButton>
      <BsButton v-if="index >= 0 && index < steps.length - 1" variant="primary" :pending="pending" :disabled="!canAdvance" @click="emit('next')">{{ nextLabel }}</BsButton>
    </BsFormActions>
  </section>
</template>
