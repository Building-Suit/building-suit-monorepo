<script setup lang="ts">
import { automationStatusTone } from '../utils/automationStatusTone'
interface FailureRow { failure_id: number; task_id: string; stage: string; summary: string; raw_error: string | null; attempt: number | null; created_at: string; legal_actions: string[] }
const { data, error } = await useFetch<{ failures: FailureRow[] }>('/api/errors')
async function copy(value: unknown) { await navigator.clipboard.writeText(typeof value === 'string' ? value : JSON.stringify(value, null, 2)) }
</script>
<template>
  <BsPage padding="none" width="full">
    <BsStack gap="sm">
      <BsText size="xs" tone="muted" emphasis="semibold">
        Recovery
      </BsText>
      <BsHeading :level="1">
        Error center
      </BsHeading>
    </BsStack>
    <BsAlert v-if="error" tone="error" :description="error.message" />
    <BsCard v-if="!data?.failures.length" padding="lg">
      <BsStack gap="sm">
        <BsText tone="muted">
          No unresolved structured failures.
        </BsText>
      </BsStack>
    </BsCard>
    <BsCard v-for="failure in data?.failures || []" :key="failure.failure_id">
      <BsStack gap="sm">
        <BsInline justify="between">
          <BsStack gap="sm">
            <BsStatusBadge :status="'failed'" :label="'failed'" :tone="automationStatusTone('failed')" />
            <BsHeading :level="2">
              {{ failure.task_id }} · {{ failure.stage }}
            </BsHeading>
            <BsText size="sm" tone="muted">
              {{ failure.summary }}
            </BsText>
          </BsStack>
          <BsStack gap="sm">
            <BsText>
              Attempt {{ failure.attempt ?? '—' }}
            </BsText>
            <BsText>
              {{ failure.created_at }}
            </BsText>
          </BsStack>
        </BsInline>
        <BsInline>
          <BsButton size="sm" @click="copy(failure.raw_error || failure.summary)">
            Copy Error
          </BsButton>
          <BsButton size="sm" @click="copy(failure)">
            Copy Diagnostic Bundle
          </BsButton>
          <BsLink :to="`/tasks/${failure.task_id}`">
            Open task
          </BsLink>
        </BsInline>
        <BsText size="xs" tone="muted">
          Legal actions: {{ (failure.legal_actions || []).join(', ') || 'inspect' }}
        </BsText>
      </BsStack>
    </BsCard>
  </BsPage>
</template>
