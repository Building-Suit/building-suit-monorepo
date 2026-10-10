<script setup lang="ts">
import { automationStatusTone } from '../utils/automationStatusTone'
import type { DashboardResponse } from '../../types/dashboard'
const { data, error } = await useFetch<DashboardResponse>('/api/dashboard')
</script>
<template>
  <BsPage padding="none" width="full">
    <BsStack gap="sm">
      <BsText size="xs" tone="muted" emphasis="semibold">
        Batch execution
      </BsText>
      <BsHeading :level="1">
        Runs
      </BsHeading>
    </BsStack>
    <BsAlert v-if="error" tone="error" :description="error.message" />
    <BsCard v-for="run in data?.workflowRuns || []" :key="run.run_id">
      <BsStack gap="sm">
        <BsInline justify="between">
          <BsStack gap="sm">
            <BsHeading :level="2">
              {{ run.suit_slug }}
            </BsHeading>
            <BsText size="xs" tone="muted">
              {{ run.run_id }}
            </BsText>
          </BsStack>
          <BsStatusBadge :status="run.status" :label="(run.status) || 'unknown'" :tone="automationStatusTone(run.status)" />
        </BsInline>
        <BsText size="sm">
          {{ run.completed_tasks }} / {{ run.max_tasks }} tasks · stop requested: {{ run.stop_requested ? 'yes' : 'no' }}
        </BsText>
      </BsStack>
    </BsCard>
  </BsPage>
</template>
