<script setup lang="ts">
import type { BsExecutionActivityItem } from '@building-suit/ui/activity-presentation'
import { automationStatusTone } from '../utils/automationStatusTone'
interface FailureRow { failure_id: number; task_id: string; stage: string; summary: string; raw_error: string | null; attempt: number | null; created_at: string; legal_actions: string[] }
const { data, error } = await useFetch<{ failures: FailureRow[] }>('/api/errors')
const { copyText } = useClipboard()
async function copy(value: unknown) { await copyText(typeof value === 'string' ? value : JSON.stringify(value, null, 2)) }
const activities = computed<BsExecutionActivityItem[]>(() => (data.value?.failures ?? []).map(failure => ({ id: String(failure.failure_id), title: `${failure.task_id} · ${failure.stage}`, status: 'failed', statusLabel: 'failed', statusTone: automationStatusTone('failed'), description: failure.summary, attempt: `Attempt ${failure.attempt ?? '—'}`, date: failure.created_at, guidance: `Legal actions: ${(failure.legal_actions || []).join(', ') || 'inspect'}`, taskLink: { to: `/tasks/${failure.task_id}`, label: 'Open task' }, actions: [{ key: 'copy-error', label: 'Copy Error' }, { key: 'copy-diagnostic', label: 'Copy Diagnostic Bundle' }] })))
function activityAction(key: 'copy-error' | 'copy-diagnostic', id: string) {
  const failure = data.value?.failures.find(row => String(row.failure_id) === id)
  if (failure) void copy(key === 'copy-error' ? failure.raw_error || failure.summary : failure)
}
</script>
<template>
  <BsExecutionActivityPage eyebrow="Recovery" title="Error center" :items="activities" :error="error?.message" empty-label="No unresolved structured failures." @action="activityAction" />
</template>
