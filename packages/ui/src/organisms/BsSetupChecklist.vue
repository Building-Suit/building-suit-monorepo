<script setup lang="ts">
import type { BsSetupStepData } from '@building-suit/contracts'
defineProps<{ title: string; progressLabel: string; description?: string; steps: BsSetupStepData[]; loading?: boolean; error?: string | null; emptyLabel: string; retryLabel: string }>()
const emit = defineEmits<{ action: [id: string]; retry: [] }>()
</script>

<template>
  <BsDisclosure :summary="title" variant="surface">
    <BsStack gap="md">
      <BsText tone="muted">{{ progressLabel }}</BsText>
      <BsText v-if="description">{{ description }}</BsText>
      <BsSectionSkeleton v-if="loading" variant="table" :rows="3" />
      <BsStateSurface v-else-if="error" state="error" :title="error" :action-label="retryLabel" @action="emit('retry')" />
      <BsStateSurface v-else-if="!steps.length" state="empty" :title="emptyLabel" />
      <ol v-else class="bs-setup-checklist">
        <BsSetupStep v-for="step in steps" :key="step.id" :step="step" @action="emit('action', $event)" />
      </ol>
    </BsStack>
  </BsDisclosure>
</template>
