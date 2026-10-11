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
async function copy(value: string) { await navigator.clipboard.writeText(value) }
</script>

<template>
  <BsPage padding="none" width="full">
    <BsAlert v-if="error" tone="error" :description="error.message" />
    <template v-if="packet">
      <BsInline justify="between" align="start">
        <BsStack gap="sm">
          <BsText size="xs" tone="muted" emphasis="semibold">
            {{ packet.project?.slug }} / {{ packet.workstream?.slug }}
          </BsText>
          <BsHeading :level="1">
            {{ packet.task.task_id }} · {{ packet.task.title }}
          </BsHeading>
          <BsText size="sm" tone="muted">
            {{ packet.task.description }}
          </BsText>
        </BsStack>
        <BsInline>
          <BsStatusBadge :status="packet.task.status" :label="(packet.task.status) || 'unknown'" :tone="automationStatusTone(packet.task.status)" />
          <BsButton @click="refresh()">
            Refresh
          </BsButton>
        </BsInline>
      </BsInline>
      <BsGrid :columns="2" as="section">
        <BsKpiCard title="Attempt" :hint="packet.retry_policy?.policy_id">
          <BsText as="span" size="lg" emphasis="bold">
            {{ `${latest?.attempt ?? 0}/${packet.retry_policy?.max_attempts ?? '?'}` }}
          </BsText>
        </BsKpiCard>
        <BsKpiCard title="Profile" :hint="`${latest?.model_name || 'model unresolved'} · ${latest?.reasoning_effort || 'reasoning unresolved'}`">
          <BsText as="span" size="lg" emphasis="bold">
            {{ latest?.model_profile || packet.retry_policy?.attempt_profiles?.[0] || 'unresolved' }}
          </BsText>
        </BsKpiCard>
        <BsKpiCard title="Engine stage">
          <BsText as="span" size="lg" emphasis="bold">
            {{ latest?.engine_stage || 'pending' }}
          </BsText>
        </BsKpiCard>
        <BsKpiCard title="Usage" hint="No token estimate is invented.">
          <BsText as="span" size="lg" emphasis="bold">
            unavailable
          </BsText>
        </BsKpiCard>
      </BsGrid>
      <BsCard as="section" title="Manual actions">
        <BsStack gap="sm">
          <BsText size="xs" tone="muted">
            Only actions legal for the current recorded state are shown. Execute with the generic CLI.
          </BsText>
          <BsInline>
            <BsButton v-for="availableAction in legalActions" :key="availableAction" size="sm" @click="copy(`pnpm automation task ${availableAction} ${packet.task.task_id}`)">
              Copy {{ availableAction }} command
            </BsButton>
            <BsButton size="sm" @click="copy(chatGptPrompt())">
              Copy for ChatGPT
            </BsButton>
            <BsButton size="sm" @click="copy(codexPrompt())">
              Generate Codex Repair Prompt
            </BsButton>
          </BsInline>
        </BsStack>
      </BsCard>
      <BsCard as="section" title="Live verification">
        <BsStack gap="sm">
          <BsStack gap="sm">
            <BsInline v-for="check in currentChecks" :key="check.verification_id" justify="between">
              <BsStack gap="sm">
                <BsText as="strong" emphasis="semibold">
                  {{ check.check_name }}
                </BsText>
                <BsText size="xs" tone="muted">
                  {{ check.summary || check.command }}
                </BsText>
              </BsStack>
              <BsStack gap="sm">
                <BsStatusBadge :status="check.status" :label="(check.status) || 'unknown'" :tone="automationStatusTone(check.status)" />
                <BsText size="xs" tone="muted">
                  {{ check.elapsed_ms == null ? 'waiting' : `${Math.round(check.elapsed_ms/1000)}s` }}
                </BsText>
              </BsStack>
            </BsInline>
          </BsStack>
        </BsStack>
      </BsCard>
      <BsGrid :columns="2" as="section">
        <BsCard title="Git and process">
          <BsStack gap="sm">
            <BsDescriptionList density="compact">
              <BsDescriptionItem term="Worktree">
                {{ latest?.worktree_path || '—' }}
              </BsDescriptionItem>
              <BsDescriptionItem term="Branch">
                {{ latest?.branch_name || '—' }}
              </BsDescriptionItem>
              <BsDescriptionItem term="Parent">
                {{ latest?.parent_branch || '—' }}@{{ latest?.parent_sha || '—' }}
              </BsDescriptionItem>
              <BsDescriptionItem term="Prompt">
                {{ latest?.prompt_path || '—' }}
              </BsDescriptionItem>
              <BsDescriptionItem term="Log">
                {{ latest?.run_log_path || '—' }}
              </BsDescriptionItem>
            </BsDescriptionList>
          </BsStack>
        </BsCard>
        <BsCard title="Task packet">
          <BsStack gap="sm">
            <BsCodeBlock>
              {{ JSON.stringify(packet.task, null, 2) }}
            </BsCodeBlock>
          </BsStack>
        </BsCard>
      </BsGrid>
      <BsCard as="section" title="Timeline">
        <BsStack gap="sm">
          <BsStack gap="sm">
            <BsDisclosure v-for="event in data?.events || []" :key="event.event_id" :summary="`${event.event_type} · ${event.source} · ${event.created_at}`">
              <BsCodeBlock>
                {{ JSON.stringify(event.payload, null, 2) }}
              </BsCodeBlock>
            </BsDisclosure>
          </BsStack>
        </BsStack>
      </BsCard>
    </template>
  </BsPage>
</template>
