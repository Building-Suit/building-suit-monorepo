<script setup lang="ts">
import { automationStatusTone } from '../../utils/automationStatusTone'
const route = useRoute()
const id = computed(() => String(route.params.id))
interface DetailTask { task_id: string; title: string; description?: string; status: string; engine_stage?: string }
interface DetailPacket { project?: { slug?: string }; workstream?: { slug?: string }; task: DetailTask; retry_policy?: { policy_id?: string; max_attempts?: number; attempt_profiles?: string[] } }
interface DetailExecution { execution_id: number; attempt: number; status: string; model_profile: string; model_name: string | null; reasoning_effort: string | null; engine_stage: string; worktree_path: string | null; branch_name: string | null; parent_branch: string | null; parent_sha: string | null; prompt_path: string | null; run_log_path: string | null }
interface DetailRun { verification_run_id: number }
interface DetailCheck { verification_id: number; verification_run_id: number | null; check_name: string; status: string; summary: string | null; command: string | null; elapsed_ms: number | null }
interface DetailEvent { event_id: number; event_type: string; source: string; created_at: string; payload: Record<string, unknown> }
interface DetailResponse { packet: DetailPacket; executions: DetailExecution[]; verificationRuns: DetailRun[]; verificationChecks: DetailCheck[]; events: DetailEvent[]; failures: unknown[]; pullRequests: unknown[] }
const { data, error, refresh } = await useFetch<DetailResponse>(() => `/api/tasks/${id.value}`)
const packet = computed(() => data.value?.packet)
const latest = computed(() => data.value?.executions?.at(-1))
const currentChecks = computed(() => {
  const run = data.value?.verificationRuns?.at(-1)
  return (data.value?.verificationChecks ?? []).filter(check => !run || check.verification_run_id === run.verification_run_id)
})
const legalActions = computed(() => {
  const status = packet.value?.task?.status
  const actions: string[] = ['inspect']
  if (status === 'in_progress' || status === 'verification' || status === 'failed' || status === 'passed') actions.push('resume')
  if (status === 'failed' && latest.value?.status === 'succeeded') actions.push('reverify')
  if (status === 'failed') actions.push('retry')
  if (status === 'passed') actions.push('publish')
  if (!['complete', 'cancelled'].includes(status ?? '')) actions.push('cancel')
  if (latest.value?.parent_sha) actions.push('reparent')
  return actions
})
function chatGptPrompt() {
  const failed = currentChecks.value.filter(row => ['fail', 'not_run'].includes(row.status))
  return [`Project/workstream/task: ${packet.value?.project?.slug}/${packet.value?.workstream?.slug}/${packet.value?.task?.task_id}`,`Task: ${packet.value?.task?.title}`,`Status: ${packet.value?.task?.status}`,`Attempt: ${latest.value?.attempt ?? 0}/${packet.value?.retry_policy?.max_attempts ?? '?'}`,`Profile/model/reasoning: ${latest.value?.model_profile ?? 'unresolved'} / ${latest.value?.model_name ?? 'unresolved'} / ${latest.value?.reasoning_effort ?? 'unresolved'}`,`Last stage: ${latest.value?.engine_stage ?? packet.value?.task?.engine_stage ?? 'unknown'}`,`Verification failures: ${JSON.stringify(failed)}`,`Branch/worktree/parent: ${latest.value?.branch_name ?? 'none'} / ${latest.value?.worktree_path ?? 'none'} / ${latest.value?.parent_branch ?? 'none'}@${latest.value?.parent_sha ?? 'none'}`,`Retry policy: ${JSON.stringify(packet.value?.retry_policy ?? {})}`,'Explain the failure and recommend the safest next action without restarting completed work.'].join('\n')
}
function codexPrompt() { return `${chatGptPrompt()}\n\nUse the existing worktree. Preserve already-correct work. Fix recorded failures only. Do not expand scope, create a branch/worktree, commit, push, merge, deploy, or modify a hosted database. Run only focused local checks; leave final verification to the control plane.` }
const { copyText: copy } = useClipboard()

const taskView = computed(() => packet.value ? ({
  context: `${packet.value.project?.slug ?? ''} / ${packet.value.workstream?.slug ?? ''}`,
  title: `${packet.value.task.task_id} · ${packet.value.task.title}`, description: packet.value.task.description,
  status: packet.value.task.status, statusLabel: packet.value.task.status || 'unknown', statusTone: automationStatusTone(packet.value.task.status),
  attempt: { label: 'Attempt', value: `${latest.value?.attempt ?? 0}/${packet.value.retry_policy?.max_attempts ?? '?'}`, hint: packet.value.retry_policy?.policy_id },
  profile: { label: 'Profile', value: latest.value?.model_profile || packet.value.retry_policy?.attempt_profiles?.[0] || 'unresolved', hint: `${latest.value?.model_name || 'model unresolved'} · ${latest.value?.reasoning_effort || 'reasoning unresolved'}` },
  stage: { label: 'Engine stage', value: latest.value?.engine_stage || 'pending' }, usage: { label: 'Usage', value: 'unavailable', hint: 'No token estimate is invented.' },
  actions: legalActions.value.map(action => ({ id: action, label: `Copy ${action} command` })),
  checks: currentChecks.value.map(check => ({ id: String(check.verification_id), name: check.check_name, description: check.summary || check.command || '', elapsed: check.elapsed_ms == null ? 'waiting' : `${Math.round(check.elapsed_ms / 1000)}s`, status: check.status, statusLabel: check.status || 'unknown', statusTone: automationStatusTone(check.status) })),
  process: { worktree: latest.value?.worktree_path || '—', branch: latest.value?.branch_name || '—', parent: `${latest.value?.parent_branch || '—'}@${latest.value?.parent_sha || '—'}`, prompt: latest.value?.prompt_path || '—', log: latest.value?.run_log_path || '—' },
  packet: JSON.stringify(packet.value.task, null, 2), events: (data.value?.events ?? []).map(event => ({ id: String(event.event_id), summary: `${event.event_type} · ${event.source} · ${event.created_at}`, payload: JSON.stringify(event.payload, null, 2) })),
}) : null)
const copyLabels = { refresh: 'Refresh', actions: 'Manual actions', actionHint: 'Only actions legal for the current recorded state are shown. Execute with the generic CLI.', chatPrompt: 'Copy for ChatGPT', repairPrompt: 'Generate Codex Repair Prompt', verification: 'Live verification', process: 'Git and process', packet: 'Task packet', timeline: 'Timeline', worktree: 'Worktree', branch: 'Branch', parent: 'Parent', prompt: 'Prompt', log: 'Log' }
function copyAction(action: string) { if (legalActions.value.includes(action)) return copy(`pnpm automation task ${action} ${packet.value?.task.task_id}`) }
</script>
<template>
  <BsTaskDetailPage :task="taskView" :copy="copyLabels" :error="error?.message" @refresh="refresh()" @copy-action="copyAction" @copy-chat-prompt="copy(chatGptPrompt())" @copy-repair-prompt="copy(codexPrompt())" />
</template>
