<script setup lang="ts">
import { onScopeDispose, ref, watch } from 'vue'
import type { HqStaffingCopy, HqStaffingDecision, HqStaffingPresentation } from '../types/hqLayoutPresentation'

const props = defineProps<{ presentation: HqStaffingPresentation; copy: HqStaffingCopy; founder: boolean; separateDetails?: boolean; selectedWorkflowId?: string }>()
const emit = defineEmits<{ decision: [decision: HqStaffingDecision]; refresh: []; openWorkflow: [id: string]; cancel: [sourceTaskId: string] }>()
const confirmation = useConfirmation()
const confirming = ref(false)
const resume = ref<Record<string, boolean>>({})
const conflict = ref(false)
let disposed = false
onScopeDispose(() => { disposed = true; resume.value = {} })
watch(() => props.founder, founder => { if (!founder) { resume.value = {}; conflict.value = false } })
async function decide(id: string, decision: 'approved' | 'rejected') {
  if (!props.founder || props.presentation.pending || confirming.value) return
  const row = props.presentation.workflows.find(entry => entry.id === id)
  if (!row?.plan || !row.planId || !row.digest || decision === 'approved' && row.blocker !== 'staffing-founder-approval-required' || row.status !== 'approval-required') return
  const command: HqStaffingDecision = { planId: row.planId, digest: row.digest, decision,
    resumeOriginal: decision === 'approved' && row.plan.resumeOriginal && resume.value[id] === true }
  confirming.value = true; conflict.value = false
  try {
    const accepted = await confirmation.ask({ title: `${row.plan.name} · ${row.plan.agentId}`, message: props.copy.confirmation,
      confirmLabel: decision === 'approved' ? props.copy.approve : props.copy.reject, cancelLabel: props.copy.cancel,
      tone: decision === 'rejected' ? 'danger' : 'default' })
    if (!accepted || disposed) return
    const current = props.presentation.workflows.find(entry => entry.id === id)
    if (!props.founder || props.presentation.pending || current?.status !== 'approval-required'
      || decision === 'approved' && current.blocker !== 'staffing-founder-approval-required' || current.planId !== command.planId || current.digest !== command.digest) { conflict.value = true; return }
    emit('decision', command)
  }
  catch { if (!disposed) conflict.value = true }
  finally { if (!disposed) confirming.value = false }
}
async function stop(id: string) {
  if (!props.founder || props.presentation.pending || confirming.value) return
  const row = props.presentation.workflows.find(entry => entry.id === id)
  if (!row || ['canceled','rejected'].includes(row.status)) return
  confirming.value = true
  try {
    const accepted = await confirmation.ask({ title: props.copy.stop, message: props.copy.stopConfirmation,
      confirmLabel: props.copy.stop, cancelLabel: props.copy.cancel, tone: 'danger' })
    const current = props.presentation.workflows.find(entry => entry.id === id)
    if (accepted && !disposed && props.founder && !props.presentation.pending && current?.sourceTaskId === row.sourceTaskId
      && !['canceled','rejected'].includes(current.status)) emit('cancel', row.sourceTaskId)
  }
  catch { if (!disposed) conflict.value = true }
  finally { if (!disposed) confirming.value = false }
}
</script>

<template>
  <section v-if="founder" class="bs-hq-staffing" :aria-label="copy.title" :aria-busy="presentation.pending || confirming">
    <h2 v-if="!selectedWorkflowId">{{ copy.title }}</h2>
    <p>{{ copy.writerBoundary }}</p>
    <p v-if="(presentation.totalCount ?? 0) > presentation.workflows.length">{{ copy.limited }} {{ presentation.workflows.length }}/{{ presentation.totalCount }}</p>
    <BsButton type="button" :disabled="presentation.pending || confirming" @click="emit('refresh')" variant="icon" :aria-label="copy.refresh" :title="copy.refresh"><BsIcon name="refresh" :size="18" /></BsButton>
    <p v-if="presentation.message || conflict" role="status">{{ conflict ? copy.conflict : presentation.message }}</p>
    <p v-if="presentation.status === 'unavailable'">{{ copy.unavailable }}</p>
    <p v-else-if="presentation.status === 'ready' && !presentation.workflows.length">{{ copy.empty }}</p>
    <article v-for="row in (selectedWorkflowId ? presentation.workflows.filter(item => item.id === selectedWorkflowId) : presentation.workflows)" :key="row.id">
      <BsButton v-if="separateDetails && !selectedWorkflowId" variant="tile" align="start" @click="emit('openWorkflow', row.id)">{{ row.plan ? `${row.plan.name} · ${row.plan.agentId}` : row.statusLabel }}</BsButton><h3 v-else>{{ row.plan ? `${row.plan.name} · ${row.plan.agentId}` : row.statusLabel }}</h3>
      <p role="status">{{ row.statusLabel }} · {{ row.blockerLabel }}</p>
      <p>{{ copy.source }}: <bdi>{{ row.sourceTaskId }}</bdi></p>
      <template v-if="row.plan && (!separateDetails || selectedWorkflowId)">
        <details><summary>{{ copy.source }}: {{ row.plan.originalTask.title }}</summary>
          <p dir="auto">{{ row.plan.originalTask.brief }}</p><p dir="auto">{{ row.plan.originalTask.acceptance }}</p>
        </details>
        <dl>
          <div><dt>{{ copy.manager }}</dt><dd>{{ row.plan.managerId }} · {{ row.plan.departmentKey }}</dd></div>
          <div><dt>{{ copy.reviewer }}</dt><dd>{{ row.plan.reviewerId }}</dd></div>
          <div><dt>{{ copy.model }}</dt><dd>{{ row.plan.modelPolicy.model }} · {{ row.plan.modelPolicy.effort }} · {{ row.plan.modelPolicy.sourceVersion }}</dd></div>
        </dl>
        <h4>{{ copy.skills }}</h4>
        <ul><li v-for="skill in row.plan.skills" :key="skill.fileId"><bdi>{{ skill.fileId }}</bdi> · {{ skill.sourceVersion }}</li></ul>
        <h4>{{ copy.trial }}</h4><p dir="auto">{{ row.plan.trialCriteria }}</p>
        <details><summary>{{ copy.profile }}</summary><pre dir="auto">{{ row.plan.profileDraft }}</pre></details>
        <template v-if="row.status === 'approval-required'">
          <BsCheckbox v-if="row.plan.resumeOriginal" :model-value="resume[row.id] === true" :label="copy.resume" :disabled="presentation.pending || confirming" @update:model-value="resume[row.id] = $event === true" />
          <div><BsButton type="button" :disabled="presentation.pending || confirming || row.blocker !== 'staffing-founder-approval-required'" @click="decide(row.id, 'approved')">{{ copy.approve }}</BsButton>
            <BsButton type="button" variant="secondary" :disabled="presentation.pending || confirming" @click="decide(row.id, 'rejected')">{{ copy.reject }}</BsButton></div>
        </template>
      </template>
      <BsButton v-if="(!separateDetails || selectedWorkflowId) && !['canceled','rejected'].includes(row.status)" type="button" variant="secondary" :disabled="presentation.pending || confirming" @click="stop(row.id)">{{ copy.stop }}</BsButton>
    </article>
  </section>
</template>

<style scoped>
.bs-hq-staffing { display: grid; gap: var(--bs-space-4); padding-block: var(--bs-space-5); }
.bs-hq-staffing article { display: grid; gap: var(--bs-space-3); border-block-start: 1px solid var(--bs-border); padding-block: var(--bs-space-4); }
.bs-hq-staffing pre { white-space: pre-wrap; overflow-wrap: anywhere; max-block-size: 24rem; overflow: auto; }
.bs-hq-staffing dd { margin-inline-start: 0; overflow-wrap: anywhere; }
.bs-hq-staffing label { display: flex; gap: var(--bs-space-2); align-items: start; }
</style>
