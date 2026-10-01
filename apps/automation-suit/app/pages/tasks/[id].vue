<script setup lang="ts">
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
async function copy(value: string) { await navigator.clipboard.writeText(value) }
</script>

<template><main class="space-y-5"><BsCard v-if="error" padding="sm" class="border-danger/40 text-danger">{{ error.message }}</BsCard><template v-if="packet"><div class="flex flex-wrap items-start justify-between gap-3"><div><p class="font-mono text-xs font-bold text-fg-muted">{{ packet.project?.slug }} / {{ packet.workstream?.slug }}</p><h1 class="mt-2 text-3xl font-black">{{ packet.task.task_id }} · {{ packet.task.title }}</h1><p class="mt-2 max-w-4xl text-sm text-fg-muted">{{ packet.task.description }}</p></div><div class="flex items-center gap-2"><DashboardStatusPill :value="packet.task.status" /><BsButton @click="refresh()">Refresh</BsButton></div></div>
<section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><DashboardMetricCard label="Attempt" :value="`${latest?.attempt ?? 0}/${packet.retry_policy?.max_attempts ?? '?'}`" :hint="packet.retry_policy?.policy_id" /><DashboardMetricCard label="Profile" :value="latest?.model_profile || packet.retry_policy?.attempt_profiles?.[0] || 'unresolved'" :hint="`${latest?.model_name || 'model unresolved'} · ${latest?.reasoning_effort || 'reasoning unresolved'}`" /><DashboardMetricCard label="Engine stage" :value="latest?.engine_stage || 'pending'" /><DashboardMetricCard label="Usage" value="unavailable" hint="No token estimate is invented." /></section>
<BsCard as="section" title="Manual actions"><p class="text-xs text-fg-muted">Only actions legal for the current recorded state are shown. Execute with the generic CLI.</p><div class="mt-3 flex flex-wrap gap-2"><BsButton v-for="availableAction in legalActions" :key="availableAction" size="sm" @click="copy(`pnpm automation task ${availableAction} ${packet.task.task_id}`)">Copy {{ availableAction }} command</BsButton><BsButton size="sm" @click="copy(chatGptPrompt())">Copy for ChatGPT</BsButton><BsButton size="sm" @click="copy(codexPrompt())">Generate Codex Repair Prompt</BsButton></div></BsCard>
<BsCard as="section" title="Live verification"><div class="space-y-2"><div v-for="check in currentChecks" :key="check.verification_id" class="flex flex-wrap items-center justify-between gap-3 rounded-control border border-[var(--bs-border)] p-3"><div><strong>{{ check.check_name }}</strong><p class="mt-1 max-w-3xl text-xs text-fg-muted">{{ check.summary || check.command }}</p></div><div class="text-end"><DashboardStatusPill :value="check.status" /><p class="mt-1 text-xs text-fg-muted">{{ check.elapsed_ms == null ? 'waiting' : `${Math.round(check.elapsed_ms/1000)}s` }}</p></div></div></div></BsCard>
<section class="grid gap-4 xl:grid-cols-2"><BsCard title="Git and process"><dl class="space-y-2 text-sm"><div><dt class="text-fg-muted">Worktree</dt><dd class="break-all font-mono text-xs">{{ latest?.worktree_path || '—' }}</dd></div><div><dt class="text-fg-muted">Branch</dt><dd class="font-mono text-xs">{{ latest?.branch_name || '—' }}</dd></div><div><dt class="text-fg-muted">Parent</dt><dd class="font-mono text-xs">{{ latest?.parent_branch || '—' }}@{{ latest?.parent_sha || '—' }}</dd></div><div><dt class="text-fg-muted">Prompt</dt><dd class="break-all font-mono text-xs">{{ latest?.prompt_path || '—' }}</dd></div><div><dt class="text-fg-muted">Log</dt><dd class="break-all font-mono text-xs">{{ latest?.run_log_path || '—' }}</dd></div></dl></BsCard><BsCard title="Task packet"><pre class="max-h-96 overflow-auto rounded-control bg-background p-3 text-[11px]">{{ JSON.stringify(packet.task, null, 2) }}</pre></BsCard></section>
<BsCard as="section" title="Timeline"><div class="divide-y divide-[var(--bs-border)]"><details v-for="event in data?.events || []" :key="event.event_id" class="py-3"><summary class="cursor-pointer text-sm"><strong>{{ event.event_type }}</strong><span class="ms-2 text-xs text-fg-muted">{{ event.source }} · {{ event.created_at }}</span></summary><pre class="mt-2 overflow-auto rounded-control bg-background p-3 text-[11px]">{{ JSON.stringify(event.payload, null, 2) }}</pre></details></div></BsCard></template></main></template>
