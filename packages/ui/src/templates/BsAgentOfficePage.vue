<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import BsLivingOfficeScene from '../organisms/BsLivingOfficeScene.vue'
import type { LivingOfficeEmployee, LivingOfficeBrainActivity, LivingOfficeSceneCopy } from '../types/livingOffice'
import type { AgentOfficeActivity, AgentOfficeContent, AgentOfficeMessage, AgentOfficeNote, AgentOfficeRoom, AgentOfficeTask, AgentOfficeTaskDraft, AgentOfficeView, LivingOfficePageCopy, AgentOfficeWorkCopy, AgentOfficeWorkflowDraft } from '../types/agentOfficePresentation'

const props = withDefaults(defineProps<{
  sceneCopy?: LivingOfficeSceneCopy
  employees?: LivingOfficeEmployee[]
  brainActivity?: LivingOfficeBrainActivity[]
  brainSnapshotReady?: boolean
  runtimeNotice?: string
  livingCopy?: LivingOfficePageCopy
  workCopy?: AgentOfficeWorkCopy
  workflowFields?: { key: string; label: string }[]
  sourceMessageText?: string
  content: AgentOfficeContent
  rooms: AgentOfficeRoom[]
  messages: AgentOfficeMessage[]
  tasks: AgentOfficeTask[]
  brainNotes: AgentOfficeNote[]
  activity?: AgentOfficeActivity[]
  accountLabel: string
  languageLabel: string
  themeLabel: string
  connectionLabel: string
  connectionAvailable?: boolean
  loading?: boolean
  readOnly?: boolean
  pending?: boolean
  error?: string | null
  messageError?: string | null
  taskError?: string | null
}>(), { sceneCopy: undefined, livingCopy: undefined, workCopy: undefined, workflowFields: () => [], sourceMessageText: '', employees: () => [], brainActivity: () => [], brainSnapshotReady: true, runtimeNotice: '', activity: () => [], connectionAvailable: false, loading: false, readOnly: false, pending: false, error: null, messageError: null, taskError: null })

const emit = defineEmits<{
  'create-department': [draft: { name: string; description: string }]
  'add-milestone': [draft: { id: string; title: string; acceptance: string }]
  'send-message': [text: string]
  'plan-message': [id: string]
  'prepare-workflow': [id: string]
  'authorize-workflow': [draft: AgentOfficeWorkflowDraft]
  'create-task': [draft: AgentOfficeTaskDraft]
  'approve-task': [id: string]
  'cancel-task': [id: string]
  'open-room': [id: string]
  retry: []
  account: []
  language: []
}>()
const { toggle: toggleTheme } = useTheme()
const messageDraft = defineModel<string>('messageDraft', { default: '' })
const taskDraft = defineModel<AgentOfficeTaskDraft>('taskDraft', { default: () => ({ title: '', brief: '', acceptance: '', allowedActions: '' }) })
const conversationOpen = defineModel<boolean>('conversationOpen', { default: false })
const taskOpen = defineModel<boolean>('taskOpen', { default: false })
const workflowOpen = defineModel<boolean>('workflowOpen', { default: false })
const workflowDraft = defineModel<AgentOfficeWorkflowDraft>('workflowDraft', { default: () => ({ id: '', brainFiles: {} }) })
const view = ref<AgentOfficeView>('office')
const profileOpen = ref(false), detailOpen = ref(false)
const selectedRoomId = ref(''), selectedTaskId = ref('')
const selectedEmployeeId = ref(''), employeeOpen = ref(false)
const selectedEmployee = computed(() => props.employees.find(e => e.id === selectedEmployeeId.value))
const departmentDraft = defineModel<{ name: string; description: string }>('departmentDraft', { default: () => ({ name: '', description: '' }) })
const departmentOpen = defineModel<boolean>('departmentOpen', { default: false })
const milestoneDraft = defineModel<{ title: string; acceptance: string }>('milestoneDraft', { default: () => ({ title: '', acceptance: '' }) })
const live = computed(() => props.livingCopy || { title: 'Living office', intro: 'Interactive organization view. Motion illustrates recorded state.', createDepartment: 'Create department', departmentName: 'Department name', purpose: 'Purpose', createOffice: 'Create office', milestoneTitle: 'Milestone title', milestoneAcceptance: 'Milestone acceptance', addMilestone: 'Add milestone', milestones: 'Milestones', planned: 'Planned', milestoneHint: 'Milestones require evidence before completion.', configured: 'Configured team', execution: 'Live execution unavailable', noWrites: 'No live Brain writes enabled.', departmentCreated: 'Department office created' })
const copy = computed(() => props.content.copy)
const work = computed<AgentOfficeWorkCopy>(() => props.workCopy || {
  planFromMessage: 'Plan work from this message', linkedTask: 'Linked task', originalMessage: 'Original founder message',
  privateContextNotice: 'The original message stays private to the founder and CEO. Only the reviewed brief is shared with Noah, Iris and Maya. Creating a proposal does not approve execution.',
  authorizeBrainWork: 'Authorize Brain work', workflowTitle: 'Authorize read-only Brain scope',
  workflowIntro: 'Choose the exact current Brain files for this approved task.',
  workflowScope: 'Read-only Brain files only. No external tools, Brain writes or daily schedule are authorized.',
  workflowUnavailable: 'Saving this scope does not start execution. Verified model access, a zero-cost allowance and hosting are still required.',
  fileReferenceHint: 'Paste an approved Drive file URL or file ID.', authorizeWorkflow: 'Save approved Brain scope', workflowAuthorized: 'Read-only Brain scope authorized',
})
const selectedRoom = computed(() => props.rooms.find(room => room.id === selectedRoomId.value))
const selectedTask = computed(() => props.tasks.find(task => task.id === selectedTaskId.value))
const taskFields = computed(() => [taskDraft.value.title, taskDraft.value.brief, taskDraft.value.acceptance, taskDraft.value.allowedActions])
const taskDirty = computed(() => taskFields.value.some(value => value.trim()) || !!taskDraft.value.sourceMessageId)
const taskComplete = computed(() => taskFields.value.every(value => value.trim()))
const workflowTask = computed(() => props.tasks.find(task => task.id === workflowDraft.value.id))
const workflowDirty = computed(() => Object.values(workflowDraft.value.brainFiles).some(value => value.trim()))
const workflowComplete = computed(() => /^[A-Za-z0-9_-]{1,120}$/.test(workflowDraft.value.id)
  && !!workflowTask.value?.canAuthorizeWorkflow && props.workflowFields.length === 16
  && new Set(props.workflowFields.map(field => field.key)).size === 16
  && props.workflowFields.every(field => { const value = workflowDraft.value.brainFiles[field.key]; return typeof value === 'string' && value.trim().length > 0 && value.length <= 500 }))
const ids = useId()
const tabs = computed(() => [
  { id: 'office' as const, label: copy.value.office },
  { id: 'tasks' as const, label: copy.value.tasks },
  { id: 'brain' as const, label: copy.value.brain },
])

function selectRoom(room: AgentOfficeRoom) {
  selectedRoomId.value = room.id
  emit('open-room', room.id)
  if (room.kind === 'executive' && room.active) conversationOpen.value = true
  else profileOpen.value = true
}
function showTask(task: AgentOfficeTask) { selectedTaskId.value = task.id; milestoneDraft.value = { title: '', acceptance: '' }; detailOpen.value = true }
function selectEmployee(id: string) { selectedEmployeeId.value = id; employeeOpen.value = true }
function createDepartment() { if (!props.readOnly && !props.pending && departmentDraft.value.name.trim() && departmentDraft.value.description.trim()) emit('create-department', { ...departmentDraft.value }) }
function addMilestone() { if (!props.readOnly && !props.pending && selectedTask.value?.status === 'proposed' && milestoneDraft.value.title.trim() && milestoneDraft.value.acceptance.trim()) emit('add-milestone', { id: selectedTask.value.id, ...milestoneDraft.value }) }
function sendMessage() {
  if (!props.readOnly && !props.pending && messageDraft.value.trim()) emit('send-message', messageDraft.value.trim())
}
function createTask() {
  if (!props.readOnly && !props.pending && taskComplete.value) emit('create-task', { ...taskDraft.value })
}
function planMessage(message: AgentOfficeMessage) {
  if (!props.readOnly && !props.pending && message.role === 'founder' && message.canPlanWork && !message.taskId) emit('plan-message', message.id)
}
function linkedTask(message: AgentOfficeMessage) { return props.tasks.find(task => task.id === message.taskId) }
function showLinkedTask(message: AgentOfficeMessage) { const task = linkedTask(message); if (task) showTask(task) }
function prepareWorkflow() {
  if (!props.readOnly && !props.pending && selectedTask.value?.canAuthorizeWorkflow) emit('prepare-workflow', selectedTask.value.id)
}
function authorizeWorkflow() {
  if (!props.readOnly && !props.pending && workflowComplete.value) emit('authorize-workflow', {
    id: workflowDraft.value.id,
    brainFiles: Object.fromEntries(props.workflowFields.map(field => [field.key, workflowDraft.value.brainFiles[field.key]!.trim()])),
  })
}
function messageKey(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && (event.ctrlKey || event.metaKey)) {
    event.preventDefault()
    sendMessage()
  }
}
function approveTask() {
  if (!props.readOnly && !props.pending && selectedTask.value?.canApprove) emit('approve-task', selectedTask.value.id)
}
function cancelTask() {
  if (!props.readOnly && !props.pending && selectedTask.value?.canCancel) emit('cancel-task', selectedTask.value.id)
}
watch(selectedTask, value => { if (!value) detailOpen.value = false })
watch(() => props.pending, (pending, previous) => {
  if (!pending && previous && !taskDirty.value && !props.taskError) taskOpen.value = false
})
</script>

<template>
  <div class="bs-office" :aria-busy="loading || undefined">
    <a class="bs-office__skip" :href="'#' + ids + '-workspace'">{{ copy.workspace }}</a>
    <header class="bs-office__header">
      <div class="bs-office__brand">
        <img :src="content.logoSrc" alt="" width="44" height="60" class="bs-office__logo">
        <div><strong>{{ content.brandName }}</strong><span>{{ content.brandSubtitle }}</span></div>
      </div>
      <nav class="bs-office__tabs" :aria-label="copy.workspace">
        <BsButton v-for="tab in tabs" :key="tab.id" variant="tab" :aria-current="view === tab.id ? 'page' : undefined" :class="{ 'bs-office__tab--active': view === tab.id }" @click="view = tab.id">{{ tab.label }}</BsButton>
      </nav>
      <div class="bs-office__header-actions">
        <BsButton variant="text" @click="emit('language')">{{ languageLabel }}</BsButton>
        <BsButton variant="icon" :aria-label="themeLabel" @click="toggleTheme"><BsOfficeIcon name="settings" :size="18" /></BsButton>
        <BsButton variant="text" @click="emit('account')">{{ accountLabel }}</BsButton>
        <span class="bs-office__connection" :data-available="connectionAvailable"><span aria-hidden="true" />{{ connectionLabel }}</span>
        <BsButton variant="primary" class="bs-office__ceo-action" @click="conversationOpen = true"><BsOfficeIcon name="mail" :size="17" />{{ copy.talkToCeo }}</BsButton>
      </div>
    </header>
    <main :id="ids + '-workspace'" class="bs-office__main" tabindex="-1">
      <div v-if="error || loading" class="bs-office__notice" :role="error ? 'alert' : 'status'">
        <BsOfficeIcon :name="error ? 'notification' : 'repeat'" :size="18" />
        <span>{{ error || copy.loading }}</span>
        <BsButton v-if="error" variant="text" :disabled="loading" @click="emit('retry')">{{ copy.retry }}</BsButton>
      </div>
      <section v-show="view === 'office'" class="bs-office__world" :aria-label="copy.office">
        <div class="bs-office__living-heading"><div><span class="bs-office__eyebrow">{{ live.configured }} · {{ employees.length }}</span><h1>{{ live.title }}</h1><p>{{ live.intro }}</p></div><BsButton variant="primary" :disabled="readOnly || pending" @click="departmentOpen = true">{{ live.createDepartment }}</BsButton></div>
        <BsLivingOfficeScene :copy="sceneCopy" :rooms="rooms" :employees="employees" :brain-activity="brainActivity" :evidence-ready="brainSnapshotReady" @select-room="id => { const room = rooms.find(r => r.id === id); if (room) selectRoom(room) }" @select-employee="selectEmployee" @select-brain="view = 'brain'" />
        <aside class="bs-office__runtime" role="status"><strong>{{ live.execution }}</strong><p>{{ runtimeNotice || copy.conversationHint }}</p></aside>
      </section>
      <section v-if="view === 'tasks'" class="bs-office__panel" :aria-label="copy.tasksTitle">
        <div class="bs-office__panel-heading"><div><h1>{{ copy.tasksTitle }}</h1><p>{{ copy.tasksIntro }}</p></div><BsButton variant="primary" :disabled="readOnly || loading" @click="taskOpen = true">{{ copy.newTask }}</BsButton></div>
        <p v-if="!tasks.length">{{ copy.noTasks }}</p>
        <div class="bs-office__task-list"><button v-for="task in tasks" :key="task.id" type="button" class="bs-office__task" @click="showTask(task)"><span><strong>{{ task.title }}</strong><small>{{ task.ownerLabel }} · {{ task.updatedLabel }}</small></span><BsStatusBadge :status="task.status" :label="task.statusLabel" :tone="task.tone" /><span>{{ task.canApprove ? copy.reviewPlan : copy.viewTask }} →</span></button></div>
      </section>
      <section v-if="view === 'brain'" class="bs-office__panel" :aria-label="copy.brainTitle">
        <h1>{{ copy.brainTitle }}</h1><p>{{ live.noWrites }}</p><ul><li v-for="event in brainActivity" :key="event.id">{{ event.label }}</li></ul><p>{{ copy.brainIntro }}</p><p v-if="!brainNotes.length">{{ copy.noBrainNotes }}</p>
        <div class="bs-office__notes"><article v-for="note in brainNotes" :key="note.id"><h2>{{ note.title }}</h2><p>{{ note.text }}</p></article></div>
        <h2>{{ copy.activityTitle }}</h2><p v-if="!activity.length">{{ copy.noActivity }}</p><ol class="bs-office__activity"><li v-for="event in activity" :key="event.id"><strong>{{ event.title }}</strong><p>{{ event.detail }}</p><small>{{ event.createdLabel }}</small></li></ol>
      </section>
    </main>
    <BsDialog v-model:visible="conversationOpen" :title="copy.conversationTitle" :dirty="!!messageDraft.trim()" :pending="pending" size="lg">
      <p>{{ copy.conversationHint }}</p><p class="bs-office__runtime">{{ runtimeNotice }}</p><p v-if="readOnly" role="status">{{ copy.readOnly }}</p>
      <div class="bs-office__messages" role="log" aria-live="polite" :aria-label="copy.conversationTitle">
        <p v-if="!messages.length">{{ copy.noMessages }}</p>
        <article v-for="message in messages" :key="message.id" :data-author="message.role" :data-message-id="message.id">
          <strong>{{ message.authorLabel }}</strong><p dir="auto">{{ message.text }}</p><small>{{ message.createdLabel }} · {{ message.statusLabel }}</small>
          <p v-if="message.replyTo" class="bs-office__message-reference">{{ work.originalMessage }} · {{ message.replyTo }}</p>
          <div v-if="message.taskId" class="bs-office__message-work" :data-linked-task-id="message.taskId">
            <span>{{ work.linkedTask }}</span>
            <BsButton v-if="linkedTask(message)" variant="text" @click="showLinkedTask(message)">{{ linkedTask(message)?.title }} · {{ linkedTask(message)?.statusLabel }}</BsButton>
            <small>{{ message.taskId }}</small>
          </div>
          <BsButton v-else-if="message.role === 'founder' && message.canPlanWork" variant="text" :disabled="readOnly || pending" @click="planMessage(message)">{{ work.planFromMessage }}</BsButton>
        </article>
      </div>
      <BsForm :pending="pending" :disabled="readOnly" :error="messageError" @submit="sendMessage"><BsField :for="ids + '-message'" :label="copy.messageLabel" required><BsTextarea :id="ids + '-message'" v-model="messageDraft" :placeholder="copy.messagePlaceholder" :maxlength="6000" required :rows="3" @keydown="messageKey" /></BsField><BsButton type="submit" variant="primary" :disabled="!messageDraft.trim() || readOnly" :pending="pending">{{ copy.sendMessage }}</BsButton></BsForm>
    </BsDialog>
    <BsDialog v-model:visible="taskOpen" :title="copy.taskFormTitle" :dirty="taskDirty" :pending="pending">
      <section v-if="taskDraft.sourceMessageId" class="bs-office__source-context" :data-source-message-id="taskDraft.sourceMessageId">
        <h2>{{ work.originalMessage }}</h2><blockquote v-if="sourceMessageText" dir="auto">{{ sourceMessageText }}</blockquote><small v-else>{{ taskDraft.sourceMessageId }}</small>
        <p>{{ work.privateContextNotice }}</p>
      </section>
      <BsForm :pending="pending" :disabled="readOnly" :error="taskError" @submit="createTask">
        <BsField :for="ids + '-title'" :label="copy.taskTitle" required><BsInput :id="ids + '-title'" v-model="taskDraft.title" :maxlength="180" required /></BsField>
        <BsField :for="ids + '-brief'" :label="copy.taskBrief" required><BsTextarea :id="ids + '-brief'" v-model="taskDraft.brief" :maxlength="5000" required /></BsField>
        <BsField :for="ids + '-acceptance'" :label="copy.taskAcceptance" required><BsTextarea :id="ids + '-acceptance'" v-model="taskDraft.acceptance" :maxlength="3000" required /></BsField>
        <BsField :for="ids + '-scope'" :label="copy.taskScope" required><BsTextarea :id="ids + '-scope'" v-model="taskDraft.allowedActions" :maxlength="3000" required /></BsField>
        <p>{{ copy.taskOwner }}: {{ copy.taskOwnerValue }} · {{ copy.taskBudget }}: {{ copy.taskBudgetValue }}</p><p>{{ copy.approvedScopeNotice }}</p>
        <BsButton type="submit" variant="primary" :disabled="!taskComplete || readOnly" :pending="pending">{{ copy.createProposal }}</BsButton>
      </BsForm>
    </BsDialog>
    <BsDialog v-model:visible="detailOpen" :title="selectedTask?.title || copy.viewTask" :dirty="!!(milestoneDraft.title || milestoneDraft.acceptance)" :pending="pending">
      <template v-if="selectedTask"><BsStatusBadge :status="selectedTask.status" :label="selectedTask.statusLabel" :tone="selectedTask.tone" /><dl class="bs-office__details"><dt>{{ copy.taskOwner }}</dt><dd>{{ selectedTask.ownerLabel }}</dd><dt>{{ copy.brief }}</dt><dd>{{ selectedTask.brief }}</dd><dt>{{ copy.acceptance }}</dt><dd>{{ selectedTask.acceptance }}</dd><dt>{{ copy.allowedActions }}</dt><dd>{{ selectedTask.allowedActions }}</dd><dt>{{ copy.budget }}</dt><dd>{{ selectedTask.budgetLabel }}</dd><template v-if="selectedTask.deliverable"><dt>{{ copy.deliverable }}</dt><dd>{{ selectedTask.deliverable }}</dd></template><template v-if="selectedTask.reviewEvidence"><dt>{{ copy.reviewEvidence }}</dt><dd>{{ selectedTask.reviewEvidence }}</dd></template></dl><section class="bs-office__milestones"><h2>{{ live.milestones }}</h2><p>{{ live.milestoneHint }}</p><ol><li v-for="milestone in selectedTask.milestones || []" :key="milestone.id"><strong>{{ milestone.title }}</strong> · {{ live.planned }}<p>{{ milestone.acceptance }}</p></li></ol><BsForm v-if="selectedTask.status === 'proposed'" :pending="pending" :disabled="readOnly" @submit="addMilestone"><BsField :for="ids + '-milestone-title'" :label="live.milestoneTitle" required><BsInput :id="ids + '-milestone-title'" v-model="milestoneDraft.title" :maxlength="180" required /></BsField><BsField :for="ids + '-milestone-acceptance'" :label="live.milestoneAcceptance" required><BsTextarea :id="ids + '-milestone-acceptance'" v-model="milestoneDraft.acceptance" :maxlength="1500" required /></BsField><BsButton type="submit" :disabled="readOnly || !milestoneDraft.title.trim() || !milestoneDraft.acceptance.trim()" :pending="pending">{{ live.addMilestone }}</BsButton></BsForm></section><p>{{ copy.approvedScopeNotice }}</p><p v-if="taskError" role="alert">{{ taskError }}</p><p v-if="selectedTask.workflowAuthorized" class="bs-office__workflow-status" role="status">{{ work.workflowAuthorized }}</p><div class="bs-office__actions"><BsButton v-if="selectedTask.canAuthorizeWorkflow" variant="primary" :disabled="readOnly" :pending="pending" @click="prepareWorkflow">{{ work.authorizeBrainWork }}</BsButton><BsButton v-if="selectedTask.canApprove" variant="primary" :disabled="readOnly" :pending="pending" @click="approveTask">{{ copy.approvePlan }}</BsButton><BsButton v-if="selectedTask.canCancel" variant="danger" :disabled="readOnly" :pending="pending" @click="cancelTask">{{ copy.cancelTask }}</BsButton></div></template>
    </BsDialog>
    <BsDialog v-model:visible="workflowOpen" :title="work.workflowTitle" :dirty="workflowDirty" :pending="pending" size="lg">
      <div :data-workflow-task-id="workflowDraft.id">
        <p>{{ work.workflowIntro }}</p><p v-if="workflowTask"><strong>{{ workflowTask.title }}</strong></p>
        <p>{{ work.workflowScope }}</p><p class="bs-office__runtime" role="status">{{ work.workflowUnavailable }}</p><p v-if="readOnly">{{ copy.readOnly }}</p>
        <BsForm :pending="pending" :disabled="readOnly" :error="taskError" @submit="authorizeWorkflow">
          <p>{{ work.fileReferenceHint }}</p>
          <div class="bs-office__workflow-fields">
            <BsField v-for="field in workflowFields" :key="field.key" :for="ids + '-workflow-' + field.key" :label="field.label" required>
              <BsInput :id="ids + '-workflow-' + field.key" v-model="workflowDraft.brainFiles[field.key]" :name="field.key" :maxlength="500" autocomplete="off" :spellcheck="false" required />
            </BsField>
          </div>
          <BsButton type="submit" variant="primary" :disabled="readOnly || pending || !workflowComplete" :pending="pending">{{ work.authorizeWorkflow }}</BsButton>
        </BsForm>
      </div>
    </BsDialog>
    <BsDialog v-model:visible="departmentOpen" :title="live.createDepartment" :dirty="!!(departmentDraft.name || departmentDraft.description)" :pending="pending"><BsForm :disabled="readOnly" :pending="pending" :error="taskError" @submit="createDepartment"><BsField :for="ids + '-department-name'" :label="live.departmentName" required><BsInput :id="ids + '-department-name'" v-model="departmentDraft.name" :maxlength="80" required /></BsField><BsField :for="ids + '-department-purpose'" :label="live.purpose" required><BsTextarea :id="ids + '-department-purpose'" v-model="departmentDraft.description" :maxlength="1000" required /></BsField><BsButton type="submit" variant="primary" :disabled="readOnly || !departmentDraft.name.trim() || !departmentDraft.description.trim()" :pending="pending">{{ live.createOffice }}</BsButton></BsForm></BsDialog>
    <BsDialog v-model:visible="employeeOpen" :title="selectedEmployee?.name || copy.profile"><template v-if="selectedEmployee"><p>{{ selectedEmployee.role }} · {{ selectedEmployee.id }}</p><p>{{ selectedEmployee.statusLabel }}</p><p>{{ copy.reporting }}: {{ selectedEmployee.reportsTo }}</p><p>{{ runtimeNotice }}</p><BsButton v-if="selectedEmployee.id === 'AG-CEO-001'" variant="primary" @click="employeeOpen = false; conversationOpen = true">{{ copy.talkToCeo }}</BsButton></template></BsDialog>
    <BsDialog v-model:visible="profileOpen" :title="selectedRoom?.label || copy.profile"><template v-if="selectedRoom"><p>{{ selectedRoom.description }}</p><p>{{ selectedRoom.statusLabel }}</p><p v-if="selectedRoom.reportingLabel">{{ copy.reporting }}: {{ selectedRoom.reportingLabel }}</p><h2 v-if="selectedRoom.skills.length">{{ copy.skills }}</h2><ul><li v-for="skill in selectedRoom.skills" :key="skill">{{ skill }}</li></ul></template></BsDialog>
  </div>
</template>

<style scoped>
/* Shared living-office composition; product policy and state remain projected props. */
.bs-office { font-size: 16px; line-height: normal; font-weight: 400; -webkit-font-smoothing: auto; text-rendering: auto; }
.bs-office p { line-height: 1.6; }
.bs-office :where(h1, h2, p) { margin-block-start: 0; }
.bs-office :deep(button:is(.ls-btn, .ls-action-text, .ls-action-icon, .ls-action-tab, .ls-action-tile)) { font: inherit; color: inherit; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: var(--bs-space-2); min-block-size: var(--bs-tap-target-min); padding: var(--bs-space-2) var(--bs-space-4); border: 1px solid var(--bs-border); border-radius: var(--bs-radius-button); background: var(--bs-surface); letter-spacing: normal; line-height: normal; text-align: center; box-shadow: none; }
.bs-office :deep(button:is(.ls-btn, .ls-action-text, .ls-action-icon, .ls-action-tab, .ls-action-tile):disabled) { cursor: not-allowed; opacity: .55; }
.bs-office :deep(.ls-btn-primary) { background: var(--bs-primary); color: var(--bs-text-on-primary); border-color: var(--bs-primary); font-weight: 700; }
.bs-office :deep(.ls-action-text), .bs-office :deep(.ls-action-icon), .bs-office :deep(.ls-action-tab), .bs-office :deep(.ls-action-tile) { border: 0; background: transparent; }
.bs-office :deep(.ls-action-icon) { padding: var(--bs-space-2); min-inline-size: var(--bs-tap-target-min); }

.bs-office { min-block-size: 100dvh; background: var(--bs-bg); color: var(--bs-text); }
.bs-office__skip { position: absolute; inset-block-start: -5rem; z-index: 100; background: var(--bs-surface); padding: var(--bs-space-3); }
.bs-office__skip:focus { inset-block-start: 0; }
.bs-office__header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--bs-space-4); padding: var(--bs-space-3) var(--bs-space-6); border-block-end: 1px solid var(--bs-border); }
.bs-office__brand, .bs-office__header-actions, .bs-office__tabs, .bs-office__connection, .bs-office__ceo-action, .bs-office__actions { display: flex; align-items: center; gap: var(--bs-space-3); }
.bs-office .bs-office__ceo-action { gap: var(--bs-space-3); }
.bs-office__brand strong { font-size: var(--bs-type-h2-size); }
.bs-office__brand span, .bs-office__room small, .bs-office__task small, .bs-office__directory small { display: block; color: var(--bs-text-muted); font-size: var(--bs-type-body-m-size); }
.bs-office__logo { object-fit: contain; block-size: 3.4rem; inline-size: 2.5rem; }
.bs-office__tabs { border-radius: var(--bs-radius-card); padding: var(--bs-space-1); background: var(--bs-surface-muted); }
.bs-office__tabs :deep(button) { padding: var(--bs-space-2) var(--bs-space-4); }
.bs-office .bs-office__tab--active { background: var(--bs-surface-raised); box-shadow: var(--bs-elevation-1); border-radius: var(--bs-radius-button); }
.bs-office__connection { font-size: var(--bs-type-body-m-size); color: var(--bs-text-muted); }
.bs-office__connection > span { inline-size: .5rem; block-size: .5rem; border-radius: 50%; background: var(--bs-text-muted); }
.bs-office__connection[data-available='true'] > span { background: var(--bs-status-success); }
.bs-office__main { padding: var(--bs-space-2); }
.bs-office__notice { display: flex; align-items: center; flex-wrap: wrap; gap: var(--bs-space-3); padding: var(--bs-space-3); background: var(--bs-surface-muted); border: 1px solid var(--bs-border); border-radius: var(--bs-radius-button); margin-block-end: var(--bs-space-2); }
 .bs-office__living-heading { display:flex; align-items:center; justify-content:space-between; gap:var(--bs-space-5); padding:var(--bs-space-6); }
.bs-office__living-heading h1 { font-size:clamp(1.5rem,3vw,2.5rem); margin:var(--bs-space-2) 0; }
.bs-office__living-heading p { color:var(--bs-text-muted); max-inline-size:55rem; margin:0; }
.bs-office__eyebrow { font-size:var(--bs-type-body-m-size); color:var(--bs-accent); text-transform:uppercase; letter-spacing:.1em; }
.bs-office__runtime { margin:var(--bs-space-4); padding:var(--bs-space-4); border:1px solid var(--bs-border); border-inline-start:3px solid var(--bs-accent); border-radius:var(--bs-radius-card); background:var(--bs-surface); }
.bs-office__runtime p { margin:var(--bs-space-2) 0 0; color:var(--bs-text-muted); }
.bs-office__milestones { margin-block:var(--bs-space-4); }
.bs-office__source-context { margin-block: var(--bs-space-4); padding: var(--bs-space-4); border: 1px solid var(--bs-border); border-radius: var(--bs-radius-card); background: var(--bs-surface-muted); }
.bs-office__source-context h2 { font-size: var(--bs-type-body-l-size, 1rem); margin-block-end: var(--bs-space-2); }
.bs-office__source-context blockquote { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
.bs-office__source-context p { margin-block: var(--bs-space-3) 0; color: var(--bs-text-muted); }
.bs-office__message-work { display: flex; flex-wrap: wrap; align-items: center; gap: var(--bs-space-2); margin-block-start: var(--bs-space-2); }
.bs-office__message-work small, .bs-office__message-reference { font-size: var(--bs-type-body-s-size, .75rem); color: var(--bs-text-muted); overflow-wrap: anywhere; }
.bs-office__workflow-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr)); gap: var(--bs-space-4); }
.bs-office__workflow-status { padding: var(--bs-space-3); border-inline-start: 3px solid var(--bs-status-info); background: var(--bs-surface-muted); }

.bs-office__panel { max-inline-size: 75rem; margin: auto; padding: var(--bs-space-6); }
.bs-office__panel h1 { font-size: var(--bs-type-h1-size); font-weight: 700; }
.bs-office__panel h2 { font-size: var(--bs-type-h3-size); font-weight: 700; }
.bs-office__panel p { margin-block: var(--bs-space-3); }
.bs-office__panel-heading { display: flex; align-items: center; justify-content: space-between; gap: var(--bs-space-4); margin-block-end: var(--bs-space-5); }
.bs-office__task-list { display: grid; gap: var(--bs-space-3); }
.bs-office__task { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--bs-space-3); text-align: start; padding: var(--bs-space-4); border: 1px solid var(--bs-border); border-radius: var(--bs-radius-card); background: var(--bs-surface); }
.bs-office__notes { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 17rem), 1fr)); gap: var(--bs-space-4); margin-block: var(--bs-space-6); }
.bs-office__notes article { padding: var(--bs-space-4); background: var(--bs-surface); border: 1px solid var(--bs-border); border-radius: var(--bs-radius-card); }
.bs-office__activity { display: grid; gap: var(--bs-space-4); padding: 0; list-style: none; }
.bs-office__messages { display: grid; gap: var(--bs-space-3); margin-block: var(--bs-space-4); max-block-size: 45dvh; overflow: auto; }
.bs-office__messages article { padding: var(--bs-space-3); border: 1px solid var(--bs-border); border-radius: var(--bs-radius-card); background: var(--bs-surface-muted); }
.bs-office__messages article[data-author='founder'] { margin-inline-start: var(--bs-space-6); }
.bs-office__messages p, .bs-office__details dd { white-space: pre-wrap; overflow-wrap: anywhere; }
.bs-office__messages small { color: var(--bs-text-muted); }
.bs-office__messages article > small { display: block; margin-block-end: var(--bs-space-2); }
.bs-office__details { display: grid; gap: var(--bs-space-2); margin-block: var(--bs-space-4); }
.bs-office__details dt { font-weight: 700; }
.bs-office__details dd { margin: 0 0 var(--bs-space-3); }
@media (max-width: 700px) {
  .bs-office__header { padding: var(--bs-space-3); gap: var(--bs-space-3); }
  .bs-office__header-actions { flex-wrap: wrap; }
  .bs-office__connection { display: none; }
  .bs-office .bs-office__ceo-action { gap: var(--bs-space-3); }
.bs-office__brand strong { font-size: 1.1rem; }
  .bs-office__tabs { order: 3; inline-size: 100%; justify-content: center; }
  .bs-office__living-heading { padding:var(--bs-space-3); flex-direction:column; align-items:flex-start; }
  .bs-office__panel { padding: var(--bs-space-3); }
  .bs-office__panel-heading { align-items: flex-start; flex-direction: column; }
}
</style>
