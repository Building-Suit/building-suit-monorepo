<script setup lang="ts">
import type { BsSetupStepData } from '@building-suit/contracts'
defineProps<{ step: BsSetupStepData }>()
const emit = defineEmits<{ action: [id: string] }>()
</script>

<template>
  <li class="bs-setup-step">
    <div class="bs-pattern-heading">
      <div>
        <h3>{{ step.title }}</h3>
        <p v-if="step.description">{{ step.description }}</p>
      </div>
      <BsStatusBadge v-if="step.status" :status="step.status" :tone="step.tone" />
    </div>
    <BsLink v-if="step.action?.to && !step.action.disabled" :to="step.action.to" @click="emit('action', step.id)">{{ step.action.label }}</BsLink>
    <BsButton v-else-if="step.action" variant="link" :disabled="step.action.disabled" @click="emit('action', step.id)">{{ step.action.label }}</BsButton>
    <slot />
  </li>
</template>
