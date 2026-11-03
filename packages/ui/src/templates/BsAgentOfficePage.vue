<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { useOfficeViewport } from '@building-suit/ux'
import type { AgentOfficeActivity, AgentOfficeContent, AgentOfficeMessage, AgentOfficeNote, AgentOfficeRoom, AgentOfficeTask, AgentOfficeTaskDraft, AgentOfficeView } from '../types/agentOfficePresentation'

const props = withDefaults(defineProps<{
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
}>(), { activity: () => [], connectionAvailable: false, loading: false, readOnly: false, pending: false, error: null, messageError: null, taskError: null })

const emit = defineEmits<{
  'send-message': [text: string]
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
const view = ref<AgentOfficeView>('office')
const profileOpen = ref(false), detailOpen = ref(false)
const selectedRoomId = ref(''), selectedTaskId = ref('')
const sceneFailed = ref(false)
const copy = computed(() => props.content.copy)
const selectedRoom = computed(() => props.rooms.find(room => room.id === selectedRoomId.value))
const selectedTask = computed(() => props.tasks.find(task => task.id === selectedTaskId.value))
const taskDirty = computed(() => Object.values(taskDraft.value).some(value => value.trim()))
const taskComplete = computed(() => Object.values(taskDraft.value).every(value => value.trim()))
const ids = useId()
const { element: viewportElement, scale, dragging, transform, zoom, reset, onKeydown, onPointerDown, onPointerMove, onPointerEnd, onMiniMapClick } = useOfficeViewport()
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
function showTask(task: AgentOfficeTask) { selectedTaskId.value = task.id; detailOpen.value = true }
function sendMessage() {
  if (!props.readOnly && !props.pending && messageDraft.value.trim()) emit('send-message', messageDraft.value.trim())
}
function createTask() {
  if (!props.readOnly && !props.pending && taskComplete.value) emit('create-task', { ...taskDraft.value })
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
watch(() => props.content.sceneSrc, () => { sceneFailed.value = false })
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
        <div ref="viewportElement" class="bs-office__viewport" :class="{ 'bs-office__viewport--dragging': dragging, 'bs-office__viewport--zoomed': scale > 1 }" tabindex="0" role="group" :aria-label="copy.workspace" :aria-describedby="ids + '-scene-hint'" @keydown="onKeydown" @pointerdown="onPointerDown" @pointermove="onPointerMove" @pointerup="onPointerEnd" @pointercancel="onPointerEnd" @lostpointercapture="onPointerEnd">
          <div class="bs-office__canvas" :style="transform">
            <img v-if="!sceneFailed" class="bs-office__art" :src="content.sceneSrc" :alt="content.sceneAlt" width="1672" height="941" draggable="false" fetchpriority="high" @error="sceneFailed = true">
            <div v-else class="bs-office__art-fallback" role="img" :aria-label="content.sceneAlt"><BsOfficeIcon name="image" :size="48" /><p>{{ content.sceneAlt }}</p></div>
            <BsButton v-for="room in rooms" :key="room.id" variant="tile" class="bs-office__room" :class="'bs-office__room--' + room.kind" :style="{ left: room.x + '%', top: room.y + '%' }" :aria-label="room.label + (room.statusLabel ? ' · ' + room.statusLabel : '')" @click="selectRoom(room)">
              <span class="bs-office__room-icon"><BsOfficeIcon :name="room.kind === 'executive' ? 'user' : room.kind === 'department' ? 'team' : 'dashboard'" :size="18" /></span>
              <span class="bs-office__room-copy" dir="auto"><strong>{{ room.label }}</strong><small v-if="room.statusLabel">{{ room.statusLabel }}</small></span>
            </BsButton>
            <BsButton variant="tile" class="bs-office__brain-label" @click="view = 'brain'"><strong>{{ copy.brainLabel }}</strong><small>{{ copy.brainSubtitle }}</small></BsButton>
          </div>
          <div class="bs-office__map-footer">
            <span class="bs-office__workspace-pill"><BsOfficeIcon name="dashboard" :size="16" />{{ copy.workspace }}</span>
            <div class="bs-office__map-controls">
              <button v-if="!sceneFailed" class="bs-office__minimap" type="button" :aria-label="copy.miniMap" @click="onMiniMapClick">
                <img :src="content.sceneSrc" alt="" draggable="false" width="1672" height="941">
                <span aria-hidden="true" class="bs-office__minimap-focus" :style="{ width: (100 / scale) + '%', height: (100 / scale) + '%' }" />
              </button>
              <div class="bs-office__zoom" role="group" :aria-label="copy.workspace">
                <BsButton variant="icon" :aria-label="copy.zoomOut" :disabled="scale <= 1" @click="zoom(-.2)"><span aria-hidden="true">−</span></BsButton>
                <BsButton variant="text" :aria-label="copy.resetView" @click="reset">{{ Math.round(scale * 100) }}%</BsButton>
                <BsButton variant="icon" :aria-label="copy.zoomIn" :disabled="scale >= 2.4" @click="zoom(.2)"><span aria-hidden="true">+</span></BsButton>
              </div>
            </div>
          </div>
        </div>
        <p :id="ids + '-scene-hint'" class="bs-office__hint">{{ copy.sceneHint }}</p>
        <div class="bs-office__directory" role="group" :aria-label="copy.roomList">
          <BsButton v-for="room in rooms" :key="room.id" variant="tile" @click="selectRoom(room)"><BsOfficeIcon :name="room.active ? 'user' : 'dashboard'" :size="17" /><span><strong>{{ room.label }}</strong><small>{{ room.statusLabel }}</small></span></BsButton>
        </div>
      </section>
      <section v-if="view === 'tasks'" class="bs-office__panel" :aria-label="copy.tasksTitle">
        <div class="bs-office__panel-heading"><div><h1>{{ copy.tasksTitle }}</h1><p>{{ copy.tasksIntro }}</p></div><BsButton variant="primary" :disabled="readOnly || loading" @click="taskOpen = true">{{ copy.newTask }}</BsButton></div>
        <p v-if="!tasks.length">{{ copy.noTasks }}</p>
        <div class="bs-office__task-list"><button v-for="task in tasks" :key="task.id" type="button" class="bs-office__task" @click="showTask(task)"><span><strong>{{ task.title }}</strong><small>{{ task.ownerLabel }} · {{ task.updatedLabel }}</small></span><BsStatusBadge :status="task.status" :label="task.statusLabel" :tone="task.tone" /><span>{{ task.canApprove ? copy.reviewPlan : copy.viewTask }} →</span></button></div>
      </section>
      <section v-if="view === 'brain'" class="bs-office__panel" :aria-label="copy.brainTitle">
        <h1>{{ copy.brainTitle }}</h1><p>{{ copy.brainIntro }}</p><p v-if="!brainNotes.length">{{ copy.noBrainNotes }}</p>
        <div class="bs-office__notes"><article v-for="note in brainNotes" :key="note.id"><h2>{{ note.title }}</h2><p>{{ note.text }}</p></article></div>
        <h2>{{ copy.activityTitle }}</h2><p v-if="!activity.length">{{ copy.noActivity }}</p><ol class="bs-office__activity"><li v-for="event in activity" :key="event.id"><strong>{{ event.title }}</strong><p>{{ event.detail }}</p><small>{{ event.createdLabel }}</small></li></ol>
      </section>
    </main>
    <BsDialog v-model:visible="conversationOpen" :title="copy.conversationTitle" :dirty="!!messageDraft.trim()" :pending="pending" size="lg">
      <p>{{ copy.conversationHint }}</p><p v-if="readOnly" role="status">{{ copy.readOnly }}</p>
      <div class="bs-office__messages" role="log" aria-live="polite" :aria-label="copy.conversationTitle"><p v-if="!messages.length">{{ copy.noMessages }}</p><article v-for="message in messages" :key="message.id" :data-author="message.role"><strong>{{ message.authorLabel }}</strong><p dir="auto">{{ message.text }}</p><small>{{ message.createdLabel }} · {{ message.statusLabel }}</small></article></div>
      <BsForm :pending="pending" :disabled="readOnly" :error="messageError" @submit="sendMessage"><BsField :for="ids + '-message'" :label="copy.messageLabel" required><BsTextarea :id="ids + '-message'" v-model="messageDraft" :placeholder="copy.messagePlaceholder" :maxlength="6000" required :rows="3" @keydown="messageKey" /></BsField><BsButton type="submit" variant="primary" :disabled="!messageDraft.trim() || readOnly" :pending="pending">{{ copy.sendMessage }}</BsButton></BsForm>
    </BsDialog>
    <BsDialog v-model:visible="taskOpen" :title="copy.taskFormTitle" :dirty="taskDirty" :pending="pending">
      <BsForm :pending="pending" :disabled="readOnly" :error="taskError" @submit="createTask">
        <BsField :for="ids + '-title'" :label="copy.taskTitle" required><BsInput :id="ids + '-title'" v-model="taskDraft.title" :maxlength="180" required /></BsField>
        <BsField :for="ids + '-brief'" :label="copy.taskBrief" required><BsTextarea :id="ids + '-brief'" v-model="taskDraft.brief" :maxlength="5000" required /></BsField>
        <BsField :for="ids + '-acceptance'" :label="copy.taskAcceptance" required><BsTextarea :id="ids + '-acceptance'" v-model="taskDraft.acceptance" :maxlength="3000" required /></BsField>
        <BsField :for="ids + '-scope'" :label="copy.taskScope" required><BsTextarea :id="ids + '-scope'" v-model="taskDraft.allowedActions" :maxlength="3000" required /></BsField>
        <p>{{ copy.taskOwner }}: {{ copy.taskOwnerValue }} · {{ copy.taskBudget }}: {{ copy.taskBudgetValue }}</p><p>{{ copy.approvedScopeNotice }}</p>
        <BsButton type="submit" variant="primary" :disabled="!taskComplete || readOnly" :pending="pending">{{ copy.createProposal }}</BsButton>
      </BsForm>
    </BsDialog>
    <BsDialog v-model:visible="detailOpen" :title="selectedTask?.title || copy.viewTask" :pending="pending">
      <template v-if="selectedTask"><BsStatusBadge :status="selectedTask.status" :label="selectedTask.statusLabel" :tone="selectedTask.tone" /><dl class="bs-office__details"><dt>{{ copy.taskOwner }}</dt><dd>{{ selectedTask.ownerLabel }}</dd><dt>{{ copy.brief }}</dt><dd>{{ selectedTask.brief }}</dd><dt>{{ copy.acceptance }}</dt><dd>{{ selectedTask.acceptance }}</dd><dt>{{ copy.allowedActions }}</dt><dd>{{ selectedTask.allowedActions }}</dd><dt>{{ copy.budget }}</dt><dd>{{ selectedTask.budgetLabel }}</dd><template v-if="selectedTask.deliverable"><dt>{{ copy.deliverable }}</dt><dd>{{ selectedTask.deliverable }}</dd></template><template v-if="selectedTask.reviewEvidence"><dt>{{ copy.reviewEvidence }}</dt><dd>{{ selectedTask.reviewEvidence }}</dd></template></dl><p>{{ copy.approvedScopeNotice }}</p><p v-if="taskError" role="alert">{{ taskError }}</p><div class="bs-office__actions"><BsButton v-if="selectedTask.canApprove" variant="primary" :disabled="readOnly" :pending="pending" @click="approveTask">{{ copy.approvePlan }}</BsButton><BsButton v-if="selectedTask.canCancel" variant="danger" :disabled="readOnly" :pending="pending" @click="cancelTask">{{ copy.cancelTask }}</BsButton></div></template>
    </BsDialog>
    <BsDialog v-model:visible="profileOpen" :title="selectedRoom?.label || copy.profile"><template v-if="selectedRoom"><p>{{ selectedRoom.description }}</p><p>{{ selectedRoom.statusLabel }}</p><p v-if="selectedRoom.reportingLabel">{{ copy.reporting }}: {{ selectedRoom.reportingLabel }}</p><h2 v-if="selectedRoom.skills.length">{{ copy.skills }}</h2><ul><li v-for="skill in selectedRoom.skills" :key="skill">{{ skill }}</li></ul><p v-if="!selectedRoom.active">{{ copy.unassignedDescription }}</p></template></BsDialog>
  </div>
</template>

<style scoped>
/* Office composition preserves the approved capture without changing other pages. */
.bs-office { font-size: 16px; line-height: normal; font-weight: 400; -webkit-font-smoothing: auto; text-rendering: auto; }
.bs-office p { line-height: 1.6; }
.bs-office :where(h1, h2, p) { margin-block-start: 0; }
.bs-office :deep(button) { font: inherit; color: inherit; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: var(--bs-space-2); min-block-size: var(--bs-tap-target-min); padding: var(--bs-space-2) var(--bs-space-4); border: 1px solid var(--bs-border); border-radius: var(--bs-radius-button); background: var(--bs-surface); letter-spacing: normal; line-height: normal; text-align: center; box-shadow: none; }
.bs-office :deep(button:disabled) { cursor: not-allowed; opacity: .55; }
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
.bs-office__viewport { position: relative; overflow: hidden; border-radius: var(--bs-radius-card); border: 1px solid var(--bs-border); direction: ltr; }
.bs-office__viewport:focus-visible, .bs-office button:focus-visible { outline: var(--bs-focus-ring-style); outline-offset: calc(-1 * var(--bs-focus-ring-offset)); }
.bs-office__viewport--zoomed { cursor: grab; touch-action: none; }
.bs-office__viewport--dragging { cursor: grabbing; }
.bs-office__canvas { position: relative; transform-origin: center; }
.bs-office__art, .bs-office__art-fallback { display: block; inline-size: 100%; block-size: auto; aspect-ratio: 1672/941; user-select: none; }
.bs-office__art-fallback { display: grid; align-content: center; justify-items: center; background: var(--bs-surface-muted); }
.bs-office .bs-office__room, .bs-office .bs-office__brain-label { inline-size: auto; position: absolute; transform: translate(-50%, -100%); display: flex; align-items: center; gap: var(--bs-space-2); padding: var(--bs-space-2) var(--bs-space-3); background: var(--bs-surface); color: var(--bs-text); border: 1px solid var(--bs-border-strong); border-radius: var(--bs-radius-card); box-shadow: var(--bs-elevation-3); white-space: nowrap; }
.bs-office__room-icon { display: grid; place-items: center; padding: var(--bs-space-2); background: var(--bs-surface-muted); border-radius: var(--bs-radius-button); }
.bs-office__room--unassigned .bs-office__room-icon { padding: 0; }
.bs-office__room--unassigned small { display: none; }
.bs-office__room strong { font-size: clamp(.65rem, 1vw, 1rem); }
.bs-office .bs-office__brain-label { inset-inline-start: 50%; inset-block-start: 39%; display: grid; text-align: center; gap: 0; }
.bs-office__brain-label small { font-size: 83.333333%; color: var(--bs-text-muted); }
.bs-office__map-footer { position: absolute; inset-inline: var(--bs-space-3); inset-block-end: var(--bs-space-3); display: flex; justify-content: space-between; align-items: flex-end; pointer-events: none; }
.bs-office__map-footer > * { pointer-events: auto; }
.bs-office__workspace-pill, .bs-office__map-controls, .bs-office__zoom { display: flex; align-items: center; gap: var(--bs-space-2); background: var(--bs-surface); border: 1px solid var(--bs-border); padding: var(--bs-space-2); border-radius: var(--bs-radius-card); }
.bs-office__map-controls { flex-direction: column; }
.bs-office .bs-office__minimap { display: block; min-block-size: 0; position: relative; inline-size: 9rem; padding: 0; border: 1px solid var(--bs-border); border-radius: var(--bs-radius-button); overflow: hidden; background: ButtonFace; }
.bs-office__minimap img { display: inline; vertical-align: baseline; inline-size: 100%; block-size: auto; }
.bs-office__minimap-focus { position: absolute; inset: 50% auto auto 50%; transform: translate(-50%, -50%); border: 1px solid var(--bs-accent); pointer-events: none; }
.bs-office__hint { color: var(--bs-text-muted); font-size: var(--bs-type-body-m-size); text-align: center; margin: var(--bs-space-2); }
.bs-office__directory { display: none; }
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
  .bs-office .bs-office__room { display: none; }
  .bs-office__room-icon, .bs-office__room small, .bs-office__brain-label small, .bs-office__room--unassigned { display: none; }
  .bs-office__room strong, .bs-office__brain-label strong { font-size: .65rem; }
  .bs-office .bs-office__brain-label { padding: var(--bs-space-1); }
  .bs-office__minimap, .bs-office__workspace-pill { display: none; }
  .bs-office__map-footer { inset: auto var(--bs-space-1) var(--bs-space-1); }
  .bs-office__map-controls { margin-inline-start: auto; padding: 0; }
  .bs-office__zoom { padding: 0; gap: 0; }
  .bs-office__zoom :deep(button) { min-block-size: 2rem; }
  .bs-office__directory { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--bs-space-2); padding: var(--bs-space-2); }
  .bs-office__directory :deep(button) { display: flex; align-items: center; gap: var(--bs-space-2); min-block-size: var(--bs-tap-target-min); text-align: start; padding: var(--bs-space-2); border: 1px solid var(--bs-border); border-radius: var(--bs-radius-button); }
  .bs-office__panel { padding: var(--bs-space-3); }
  .bs-office__panel-heading { align-items: flex-start; flex-direction: column; }
}
</style>
