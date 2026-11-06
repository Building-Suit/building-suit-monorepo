<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { HqMeetingCommand, HqMeetingLabel, HqMeetingPresentation } from '../types/hqMeetingPresentation'

const props = defineProps<{ meeting: HqMeetingPresentation }>()
const visible = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ command: [command: HqMeetingCommand] }>()
const confirmation = useConfirmation()
const title = ref(props.meeting.title)
const participantIds = ref<string[]>([])
const disclosureAccepted = ref(false)
const downloadAccepted = ref(false)
const text = ref('')
const chat = ref('')
const addressedTo = ref('')
const researchAgentId = ref('')
const question = ref('')
const planTitle = ref('')
const objective = ref('')
const deliverable = ref('')
const planOwnerId = ref('')
const confirming = ref(false)
let disposed = false
let submittedText = ''
let submittedChat = ''
const copy = computed(() => props.meeting.copy)
const label = (key: HqMeetingLabel) => copy.value.labels[key]
const active = computed(() => props.meeting.phase === 'active')
const disabled = computed(() => props.meeting.pending || confirming.value || props.meeting.connection !== 'connected')
const participants = computed(() => props.meeting.participants)
const eligible = computed(() => participants.value.filter(participant => participant.eligible))
const workEligible = computed(() => eligible.value.filter(participant => participant.workEligible !== false))
const voiceOptions = computed(() => props.meeting.voices?.map(voice => ({ ...voice })) ?? [])
const addressOptions = computed(() => [{ id: '', name: label('coordinator') }, ...participants.value.map(({ id, name }) => ({ id, name }))])
const captureStarting = computed(() => props.meeting.microphone.phase === 'requesting')
const captureFinishing = computed(() => props.meeting.microphone.phase === 'finishing')
const modelReady = computed(() => props.meeting.microphone.model?.prepared ?? false)
const modelPreparing = computed(() => ['loading', 'downloading'].includes(props.meeting.microphone.model?.phase ?? ''))
const textTooLong = computed(() => Array.from(text.value).length > 4000)
const floorName = computed(() => props.meeting.floor === props.meeting.founder.id ? props.meeting.founder.name : participants.value.find(participant => participant.id === props.meeting.floor)?.name ?? label('unassigned'))
const modeLabel = computed(() => label(props.meeting.mode === 'live' ? 'live' : props.meeting.mode === 'demonstration' ? 'demonstration' : 'unavailable'))
const planDecidable = computed(() => active.value && !disabled.value && props.meeting.plan && (props.meeting.mode === 'live' ? props.meeting.plan.state === 'awaiting-approval' : ['draft', 'awaiting-approval', 'revised'].includes(props.meeting.plan.state)))
const planRevisable = computed(() => active.value && !disabled.value && props.meeting.plan && !['dispatched', 'discarded'].includes(props.meeting.plan.state))

watch(() => props.meeting.participants, value => {
  const existing = new Set(value.filter(participant => participant.eligible).map(participant => participant.id))
  const workers = new Set(value.filter(participant => participant.eligible && participant.workEligible !== false).map(participant => participant.id))
  participantIds.value = participantIds.value.filter(id => existing.has(id))
  if (props.meeting.phase === 'setup' && !participantIds.value.length) participantIds.value = value.filter(participant => participant.eligible && participant.selected !== false).map(participant => participant.id)
  if (!existing.has(addressedTo.value)) addressedTo.value = ''
  if (!workers.has(researchAgentId.value)) researchAgentId.value = ''
  if (!workers.has(planOwnerId.value)) planOwnerId.value = ''
}, { immediate: true })
watch(() => props.meeting.language, () => { disclosureAccepted.value = false })
watch(modelReady, (ready, previous) => { if (!ready || !previous) disclosureAccepted.value = false })
watch(() => [props.meeting.phase, props.meeting.mode, props.meeting.founder.id] as const, ([phase, mode, founderId], [previousPhase, previousMode, previousFounder]) => {
  if ((['active', 'ended'].includes(previousPhase) && ['setup', 'unavailable'].includes(phase)) || (previousMode === 'live' && mode !== 'live') || (previousFounder !== founderId && previousPhase === 'active')) {
    title.value = props.meeting.title
    text.value = ''; chat.value = ''; question.value = ''; planTitle.value = ''; objective.value = ''; deliverable.value = ''
    addressedTo.value = ''; researchAgentId.value = ''; planOwnerId.value = ''; disclosureAccepted.value = false; downloadAccepted.value = false
    submittedText = ''; submittedChat = ''
  }
}, { flush: 'sync' })
watch(() => props.meeting.draftText, value => { if (value !== undefined) text.value = value })
watch(() => props.meeting.transcript, value => {
  if (submittedText && value.some(event => event.text === submittedText && event.speakerName === props.meeting.founder.name)) {
    if (text.value.trim() === submittedText) text.value = ''
    submittedText = ''
  }
})
watch(() => props.meeting.chat, value => {
  if (submittedChat && value.some(event => event.text === submittedChat && event.speakerName === props.meeting.founder.name)) {
    if (chat.value.trim() === submittedChat) chat.value = ''
    submittedChat = ''
  }
})
watch(visible, value => {
  if (!value) { disclosureAccepted.value = false; downloadAccepted.value = false; emit('command', { type: 'close' }) }
})
onBeforeUnmount(() => { disposed = true })

function initials(name: string) { return name.trim().split(/\s+/u).slice(0, 2).map(part => Array.from(part)[0]).join('') }
function editDraft(value: string) { text.value = value; emit('command', { type: 'draft', text: value }) }
function selectParticipant(id: string, checked: boolean) {
  participantIds.value = checked ? [...new Set([...participantIds.value, id])] : participantIds.value.filter(value => value !== id)
}
function start() {
  if (disabled.value || !props.meeting.canStart || !title.value.trim() || !participantIds.value.length) return
  emit('command', { type: 'start', title: title.value.trim(), language: 'en', participantIds: participantIds.value.slice() })
}
function sendText() {
  if (!active.value || disabled.value || !text.value.trim() || textTooLong.value || props.meeting.microphone.active || captureStarting.value || captureFinishing.value) return
  submittedText = text.value.trim()
  emit('command', { type: 'text', text: submittedText, ...(addressedTo.value ? { addressedTo: addressedTo.value } : {}) })
}
function sendChat() {
  if (!active.value || disabled.value || !chat.value.trim()) return
  submittedChat = chat.value.trim()
  emit('command', { type: 'chat', text: submittedChat })
}
function microphone() {
  if (props.meeting.microphone.active || captureStarting.value) { emit('command', { type: 'microphone', active: false }); return }
  if (!active.value || disabled.value || !props.meeting.microphone.available || !disclosureAccepted.value || captureFinishing.value) return
  emit('command', { type: 'microphone', active: true, disclosureAccepted: true })
}
function prepareRecognition() {
  if (!props.meeting.microphone.model?.canPrepare || !downloadAccepted.value || modelPreparing.value) return
  disclosureAccepted.value = false
  emit('command', { type: 'prepareMicrophone', downloadConsent: true })
}
function research() {
  if (disabled.value || !active.value || !researchAgentId.value || !question.value.trim()) return
  emit('command', { type: 'research', agentId: researchAgentId.value, question: question.value.trim() })
}
function draftPlan() {
  if (disabled.value || !active.value || !planTitle.value.trim() || !objective.value.trim() || !deliverable.value.trim() || !planOwnerId.value) return
  emit('command', { type: 'draftPlan', title: planTitle.value.trim(), objective: objective.value.trim(), deliverable: deliverable.value.trim(), ownerId: planOwnerId.value })
}
async function decide(decision: Extract<HqMeetingCommand, { type: 'plan' }>['decision']) {
  const plan = props.meeting.plan
  if (!plan || !planRevisable.value || (decision.startsWith('approve') && !planDecidable.value)) return
  const version = plan.version, digest = plan.digest
  if (decision.startsWith('approve') || decision === 'discard') {
    confirming.value = true
    try {
      const accepted = await confirmation.ask({ title: plan.title, message: `${label('approvalConfirmation')}\n${label('version')}: ${version}\n${label('digest')}: ${digest}\n${decision === 'discard' ? label('discard') : label(decision === 'approve-now' ? 'approveNow' : decision === 'approve-on-end' ? 'approveOnEnd' : 'approve')}`, confirmLabel: label('confirm'), cancelLabel: label('cancel'), tone: decision === 'discard' ? 'danger' : 'default' })
      if (!accepted || disposed || props.meeting.plan?.version !== version || props.meeting.plan.digest !== digest) return
    }
    finally { confirming.value = false }
  }
  if (!disposed && planRevisable.value && props.meeting.plan?.version === version && props.meeting.plan.digest === digest) emit('command', { type: 'plan', decision, version, digest })
}
function safeLink(value: string): string | undefined {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : undefined }
  catch { return undefined }
}
</script>

<template>
  <BsDialog v-model:visible="visible" :title="label('title')" size="lg" :close-blocked="confirming">
    <div class="bs-hq-meeting" dir="ltr" lang="en" :aria-busy="meeting.pending">
      <header class="bs-hq-meeting__header">
        <div><strong class="bs-hq-meeting__mode" :data-mode="meeting.mode">{{ modeLabel }}</strong><p role="status">{{ label('connection') }}: {{ copy.connectionStatus[meeting.connection] }}</p></div>
        <BsButton variant="secondary" :disabled="meeting.pending" @click="emit('command', { type: 'refresh' })">{{ label('refresh') }}</BsButton>
      </header>
      <p v-if="meeting.mode === 'demonstration'" class="bs-hq-meeting__notice" role="status">{{ label('demonstrationNotice') }}</p>
      <template v-if="meeting.mode === 'live'"><p class="bs-hq-meeting__notice" role="status">{{ label('liveSourceNotice') }}</p><p class="bs-hq-meeting__meta">{{ label('liveScopeNotice') }}</p></template>
      <p v-if="meeting.message" class="bs-hq-meeting__notice" role="alert">{{ meeting.message }}</p>
      <p class="bs-hq-meeting__meta">{{ label('retention') }}</p>

      <form v-if="meeting.phase === 'setup' || meeting.phase === 'unavailable'" class="bs-hq-meeting__section" @submit.prevent="start">
        <BsField v-slot="field" :label="label('meetingTitle')" required><BsInput :id="field.id" v-model="title" dir="auto" :aria-describedby="field.describedby" maxlength="160" required :disabled="meeting.pending" /></BsField>
        <fieldset class="bs-hq-meeting__participants"><legend>{{ label('participants') }}</legend><p v-if="!participants.length" role="status">{{ label('unavailable') }}</p>
          <div v-for="participant in participants" :key="participant.id" class="bs-hq-meeting__selection">
            <BsCheckbox :checked="participantIds.includes(participant.id)" :label="`${participant.name} · ${participant.role}`" :description="participant.availability" :disabled="!participant.eligible || meeting.pending" @change="checked => selectParticipant(participant.id, checked)" />
            <BsSelect v-if="voiceOptions.length" :model-value="participant.voiceId" :options="voiceOptions" option-label="name" option-value="id" :label="`${label('voice')}: ${participant.name}`" :placeholder="label('voiceUnavailable')" :disabled="meeting.pending" @update:model-value="value => typeof value === 'string' && emit('command', { type: 'voice', agentId: participant.id, voiceId: value })" />
          </div>
        </fieldset>
        <div class="bs-hq-meeting__notice"><p>{{ label('microphone') }}: {{ meeting.microphone.status || label(meeting.microphone.available ? 'microphoneOff' : 'microphoneUnavailable') }}</p><p v-if="meeting.microphone.device">{{ label('device') }}: {{ meeting.microphone.device }}</p><p>{{ label('voice') }}: {{ label(meeting.voiceAvailable ? 'voiceAvailable' : 'voiceUnavailable') }}</p><p>{{ label('disconnectPolicy') }}: {{ label('holdOnDisconnect') }}</p></div>
        <BsButton type="submit" variant="primary" :pending="meeting.pending" :disabled="!meeting.canStart || disabled || !title.trim() || !participantIds.length">{{ label('start') }}</BsButton>
      </form>

      <template v-else>
        <section class="bs-hq-meeting__section" :aria-label="label('participants')">
          <div class="bs-hq-meeting__toolbar"><h3 dir="auto">{{ meeting.title }}</h3></div>
          <p class="bs-hq-meeting__meta">{{ label('floor') }}: <bdi>{{ floorName }}</bdi></p>
          <div class="bs-hq-meeting__tiles">
            <article class="bs-hq-meeting__tile" :data-speaking="meeting.floor === meeting.founder.id || undefined">
              <span class="bs-hq-meeting__avatar"><img v-if="meeting.founder.avatarUrl" :src="meeting.founder.avatarUrl" alt="" width="48" height="48"><span v-else>{{ initials(meeting.founder.name) }}</span></span>
              <strong><bdi>{{ meeting.founder.name }}</bdi></strong><small>{{ label('founder') }}</small><span>{{ label(meeting.microphone.active ? 'microphoneListening' : 'microphoneStopped') }}</span>
            </article>
            <article v-for="participant in participants" :key="participant.id" class="bs-hq-meeting__tile" :data-speaking="participant.status === 'speaking' || undefined" :data-status="participant.status">
              <span class="bs-hq-meeting__avatar"><img v-if="participant.avatarUrl" :src="participant.avatarUrl" alt="" width="48" height="48"><span v-else>{{ initials(participant.name) }}</span></span>
              <strong><bdi>{{ participant.name }}</bdi></strong><small>{{ participant.role }}</small><span :aria-live="participant.status === 'hand-raised' ? 'polite' : undefined">{{ copy.participantStatus[participant.status] }}</span>
              <BsButton v-if="participant.status === 'hand-raised'" variant="secondary" :disabled="disabled || !active" @click="emit('command', { type: 'invite', agentId: participant.id })">{{ label('invite') }}</BsButton>
            </article>
          </div>
        </section>

        <section v-if="active" class="bs-hq-meeting__audio" :aria-label="label('microphone')">
          <strong>{{ label('automaticRecognition') }}</strong><p class="bs-hq-meeting__meta">{{ label('automaticRecognitionNotice') }}</p>
          <div v-if="!modelReady" class="bs-hq-meeting__section">
            <BsCheckbox v-model="downloadAccepted" :label="label('recognitionDownloadConsent')" :description="label('recognitionDownloadNotice')" :disabled="modelPreparing" />
            <BsButton variant="secondary" :pending="modelPreparing" :disabled="!downloadAccepted || !meeting.microphone.model?.canPrepare || modelPreparing" @click="prepareRecognition">{{ label('prepareRecognition') }}</BsButton>
          </div>
          <p v-if="meeting.microphone.model" class="bs-hq-meeting__meta" role="status">{{ meeting.microphone.model.status }}<span v-if="modelPreparing && meeting.microphone.model.progress !== null"> {{ Math.round(meeting.microphone.model.progress) }}%</span></p>
          <BsCheckbox v-if="modelReady" v-model="disclosureAccepted" :label="label('microphoneConsent')" :description="label('microphoneDisclosure')" :disabled="meeting.microphone.active || captureStarting || captureFinishing" />
          <div class="bs-hq-meeting__toolbar"><BsButton :variant="meeting.microphone.active || captureStarting ? 'danger' : 'secondary'" :aria-pressed="meeting.microphone.active" :disabled="captureFinishing || (!meeting.microphone.active && !captureStarting && (disabled || !meeting.microphone.available || !disclosureAccepted))" @click="microphone">{{ label(captureStarting ? 'cancel' : meeting.microphone.active ? 'microphoneOff' : 'microphoneOn') }}</BsButton><BsButton variant="secondary" :aria-pressed="meeting.microphone.muted" :disabled="disabled" @click="emit('command', { type: 'mute', muted: !meeting.microphone.muted })">{{ label(meeting.microphone.muted ? 'unmute' : 'mute') }}</BsButton><BsButton variant="primary" @click="emit('command', { type: 'interrupt' })">{{ label('interrupt') }}</BsButton><BsButton variant="secondary" :disabled="meeting.microphone.active || captureStarting || captureFinishing || modelPreparing" @click="emit('command', { type: 'recheckMicrophone' })">{{ label('microphoneRecheck') }}</BsButton></div>
          <p class="bs-hq-meeting__meta" role="status">{{ meeting.microphone.status }} · {{ label(meeting.voiceAvailable ? 'voiceAvailable' : 'voiceUnavailable') }}</p>
        </section>

        <div class="bs-hq-meeting__columns">
          <div class="bs-hq-meeting__section">
            <section :aria-label="label('transcript')"><h3>{{ label('transcript') }}</h3><ol class="bs-hq-meeting__log" role="log" aria-live="polite" aria-relevant="additions"><li v-for="event in meeting.transcript" :key="event.id"><strong><bdi>{{ event.speakerName }}</bdi></strong><small v-if="event.uncertain">{{ label('uncertain') }}</small><p dir="auto">{{ event.text }}</p></li></ol><p v-if="!meeting.transcript.length" class="bs-hq-meeting__meta">{{ label('empty') }}</p></section>
            <form v-if="active" class="bs-hq-meeting__section" @submit.prevent="sendText"><BsSelect v-model="addressedTo" :options="addressOptions" option-label="name" option-value="id" :label="label('address')" :disabled="disabled" /><BsField v-slot="field" :label="label('text')"><BsTextarea :id="field.id" :model-value="text" dir="auto" :aria-describedby="field.describedby" maxlength="4000" :rows="3" :disabled="disabled" @update:model-value="editDraft" /></BsField><p v-if="meeting.draftUncertain" role="status">{{ label('uncertain') }}</p><p v-if="textTooLong" role="status">{{ label('contributionTooLong') }}</p><BsButton type="submit" variant="primary" :pending="meeting.pending" :disabled="disabled || !text.trim() || textTooLong || meeting.microphone.active || captureStarting || captureFinishing">{{ label('send') }}</BsButton></form>
            <section :aria-label="label('chat')"><h3>{{ label('chat') }}</h3><ol class="bs-hq-meeting__log" role="log" aria-live="polite" aria-relevant="additions"><li v-for="event in meeting.chat" :key="event.id"><strong><bdi>{{ event.speakerName }}</bdi></strong><p dir="auto">{{ event.text }}</p><template v-for="link in event.links ?? []" :key="link"><a v-if="safeLink(link)" :href="safeLink(link)" target="_blank" rel="noopener noreferrer" dir="ltr">{{ link }}</a></template></li></ol><p v-if="!meeting.chat.length" class="bs-hq-meeting__meta">{{ label('empty') }}</p></section>
            <form v-if="active" class="bs-hq-meeting__section" @submit.prevent="sendChat"><BsField v-slot="field" :label="label('share')"><BsTextarea :id="field.id" v-model="chat" dir="auto" :aria-describedby="field.describedby" maxlength="4000" :rows="2" :disabled="disabled" /></BsField><BsButton type="submit" variant="secondary" :disabled="disabled || !chat.trim()">{{ label('share') }}</BsButton></form>
          </div>

          <div class="bs-hq-meeting__section">
            <section class="bs-hq-meeting__section" :aria-label="label('tasks')"><h3>{{ label('tasks') }}</h3><p v-if="!meeting.tasks.length" class="bs-hq-meeting__meta">{{ label('empty') }}</p><article v-for="task in meeting.tasks" :key="task.id" class="bs-hq-meeting__task"><strong dir="auto">{{ task.title }}</strong><p><bdi>{{ task.ownerName }}</bdi> · {{ copy.taskStatus[task.status] }}</p><p v-if="task.result" dir="auto">{{ task.result }}</p><p v-if="task.error" role="status" dir="auto">{{ task.error }}</p><BsButton v-if="task.status === 'queued' || task.status === 'running'" variant="secondary" :disabled="disabled" :aria-label="`${label('cancelTask')}: ${task.title}`" @click="emit('command', { type: 'cancelTask', taskId: task.id })">{{ label('cancelTask') }}</BsButton></article></section>
            <details v-if="active"><summary>{{ label('research') }}</summary><form class="bs-hq-meeting__section" @submit.prevent="research"><BsSelect v-model="researchAgentId" :options="workEligible" option-label="name" option-value="id" :label="label('owner')" :disabled="disabled" /><BsField v-slot="field" :label="label('question')" required><BsTextarea :id="field.id" v-model="question" dir="auto" :aria-describedby="field.describedby" maxlength="2000" :rows="2" required :disabled="disabled" /></BsField><BsButton type="submit" variant="secondary" :disabled="disabled || !researchAgentId || !question.trim()">{{ label('assignResearch') }}</BsButton></form></details>
            <section class="bs-hq-meeting__section" :aria-label="label('plan')"><h3>{{ label('plan') }}</h3><p v-if="!meeting.plan" class="bs-hq-meeting__meta">{{ label('empty') }}</p><article v-else class="bs-hq-meeting__plan"><strong dir="auto">{{ meeting.plan.title }}</strong><p class="bs-hq-meeting__meta">{{ label('version') }} {{ meeting.plan.version }} · {{ copy.planStatus[meeting.plan.state] }}</p><p dir="auto">{{ meeting.plan.summary }}</p><p v-if="meeting.plan.approvalTiming" dir="auto">{{ meeting.plan.approvalTiming }}</p><details><summary>{{ label('digest') }}</summary><code>{{ meeting.plan.digest }}</code></details><div v-for="task in meeting.plan.tasks" :key="task.id" class="bs-hq-meeting__task"><p dir="auto"><strong>{{ label('objective') }}:</strong> {{ task.objective }}</p><p><strong>{{ label('owner') }}:</strong> <bdi>{{ task.ownerName }}</bdi></p><p v-if="task.supervisorName"><strong>{{ label('supervisor') }}:</strong> <bdi>{{ task.supervisorName }}</bdi></p><p dir="auto"><strong>{{ label('deliverable') }}:</strong> {{ task.deliverable }}</p><p><strong>{{ label('budget') }}:</strong> <bdi>{{ task.budget }}</bdi></p><p v-if="task.blockers?.length" dir="auto"><strong>{{ label('blockers') }}:</strong> {{ task.blockers.join(' · ') }}</p><p v-if="task.inputs?.length" dir="auto"><strong>{{ label('inputs') }}:</strong> {{ task.inputs.join(' · ') }}</p><p v-if="task.dependencies?.length" dir="auto"><strong>{{ label('dependencies') }}:</strong> {{ task.dependencies.join(' · ') }}</p><p v-if="task.priority" dir="auto"><strong>{{ label('priority') }}:</strong> {{ task.priority }}</p><p v-if="task.environment" dir="auto"><strong>{{ label('environment') }}:</strong> {{ task.environment }}</p><p v-if="task.scope?.length" dir="auto"><strong>{{ label('scope') }}:</strong> {{ task.scope.join(' · ') }}</p><p v-if="task.acceptance?.length" dir="auto"><strong>{{ label('acceptance') }}:</strong> {{ task.acceptance.join(' · ') }}</p><p v-if="task.review" dir="auto"><strong>{{ label('review') }}:</strong> {{ task.review }}</p></div><p class="bs-hq-meeting__notice">{{ label('approvalNotice') }}</p><div v-if="active" class="bs-hq-meeting__toolbar"><BsButton variant="primary" :disabled="!planDecidable" @click="decide('approve')">{{ label('approve') }}</BsButton><BsButton variant="secondary" :disabled="!planDecidable" @click="decide('approve-now')">{{ label('approveNow') }}</BsButton><BsButton variant="secondary" :disabled="!planDecidable" @click="decide('approve-on-end')">{{ label('approveOnEnd') }}</BsButton><BsButton variant="text" :disabled="!planRevisable" @click="decide('revise')">{{ label('revise') }}</BsButton><BsButton variant="text" :disabled="!planRevisable" @click="decide('defer')">{{ label('defer') }}</BsButton><BsButton variant="danger" :disabled="!planRevisable" @click="decide('discard')">{{ label('discard') }}</BsButton></div></article></section>
            <details v-if="active"><summary>{{ label('draftPlan') }}</summary><form class="bs-hq-meeting__section" @submit.prevent="draftPlan"><BsField v-slot="field" :label="label('meetingTitle')" required><BsInput :id="field.id" v-model="planTitle" dir="auto" :aria-describedby="field.describedby" maxlength="160" required :disabled="disabled" /></BsField><BsSelect v-model="planOwnerId" :options="workEligible" option-label="name" option-value="id" :label="label('owner')" :disabled="disabled" /><BsField v-slot="field" :label="label('objective')" required><BsTextarea :id="field.id" v-model="objective" dir="auto" :aria-describedby="field.describedby" maxlength="2000" :rows="2" required :disabled="disabled" /></BsField><BsField v-slot="field" :label="label('deliverable')" required><BsTextarea :id="field.id" v-model="deliverable" dir="auto" :aria-describedby="field.describedby" maxlength="2000" :rows="2" required :disabled="disabled" /></BsField><BsButton type="submit" variant="secondary" :disabled="disabled || !planOwnerId || !planTitle.trim() || !objective.trim() || !deliverable.trim()">{{ label('draftPlan') }}</BsButton></form></details>
          </div>
        </div>
        <footer class="bs-hq-meeting__section"><p class="bs-hq-meeting__meta">{{ label('closeNotice') }}</p><p class="bs-hq-meeting__meta">{{ label('disconnectPolicy') }}: {{ label('holdOnDisconnect') }}</p><BsButton v-if="active" variant="danger" :disabled="disabled" @click="emit('command', { type: 'end' })">{{ label('end') }}</BsButton><template v-else><p role="status">{{ label('ended') }}</p><BsButton variant="primary" :disabled="meeting.pending" @click="emit('command', { type: 'newMeeting' })">{{ label('start') }}</BsButton></template></footer>
      </template>
    </div>
  </BsDialog>
</template>

<style scoped>
.bs-hq-meeting { display: grid; gap: var(--bs-space-5); min-width: 0; color: var(--bs-text); }
.bs-hq-meeting h3, .bs-hq-meeting p { margin: 0; }
.bs-hq-meeting h3 { font-size: 1rem; font-weight: var(--bs-weight-bold); }
.bs-hq-meeting__header, .bs-hq-meeting__toolbar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--bs-space-3); min-width: 0; }
.bs-hq-meeting__mode { display: inline-block; padding: var(--bs-space-1) var(--bs-space-2); border: 1px solid var(--bs-border); border-radius: var(--bs-radius-control); font-size: .8rem; }
.bs-hq-meeting__mode[data-mode='demonstration'] { border-color: var(--bs-color-brand-premium-gold); }
.bs-hq-meeting__section { display: grid; align-content: start; gap: var(--bs-space-3); min-width: 0; }
.bs-hq-meeting__notice, .bs-hq-meeting__task, .bs-hq-meeting__audio { display: grid; gap: var(--bs-space-2); min-width: 0; padding: var(--bs-space-3); border: 1px solid var(--bs-border); border-radius: var(--bs-radius-control); background: var(--bs-surface-muted); font-size: .85rem; line-height: 1.7; overflow-wrap: anywhere; }
.bs-hq-meeting__meta { color: var(--bs-text-muted); font-size: .8rem; line-height: 1.65; overflow-wrap: anywhere; }
.bs-hq-meeting__participants { display: grid; gap: var(--bs-space-3); min-width: 0; margin: 0; padding: var(--bs-space-3); border: 1px solid var(--bs-border); border-radius: var(--bs-radius-control); }
.bs-hq-meeting__selection { display: grid; gap: var(--bs-space-2); min-width: 0; }
.bs-hq-meeting__tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 150px), 1fr)); gap: var(--bs-space-3); }
.bs-hq-meeting__tile { display: grid; align-content: start; justify-items: center; gap: var(--bs-space-2); padding: var(--bs-space-4); min-width: 0; border: 1px solid var(--bs-border); border-radius: var(--bs-radius-card); background: var(--bs-surface); text-align: center; overflow-wrap: anywhere; }
.bs-hq-meeting__tile[data-speaking='true'] { outline: 2px solid var(--bs-color-brand-premium-gold); outline-offset: 2px; }
.bs-hq-meeting__tile[data-status='hand-raised'] { border-color: var(--bs-color-brand-premium-gold); }
.bs-hq-meeting__tile small, .bs-hq-meeting__tile > span:last-of-type { color: var(--bs-text-muted); font-size: .75rem; }
.bs-hq-meeting__avatar { display: grid; place-items: center; width: 48px; height: 48px; border: 1px solid var(--bs-border); border-radius: 50%; background: var(--bs-surface-muted); overflow: hidden; }
.bs-hq-meeting__avatar img { width: 100%; height: 100%; object-fit: cover; }
.bs-hq-meeting__columns { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: var(--bs-space-5); align-items: start; }
.bs-hq-meeting__log { display: grid; gap: var(--bs-space-3); max-height: 24rem; overflow-y: auto; overflow-wrap: anywhere; margin: var(--bs-space-3) 0 0; padding: 0; list-style: none; }
.bs-hq-meeting__log li { display: grid; gap: var(--bs-space-1); min-width: 0; padding: var(--bs-space-3); border-inline-start: 2px solid var(--bs-border); background: var(--bs-surface-muted); border-radius: var(--bs-radius-control); font-size: .85rem; line-height: 1.75; }
.bs-hq-meeting__log p, .bs-hq-meeting__plan p { white-space: pre-wrap; }
.bs-hq-meeting__log a { color: var(--bs-text); text-decoration: underline; overflow-wrap: anywhere; unicode-bidi: isolate; }
.bs-hq-meeting__plan { display: grid; gap: var(--bs-space-3); min-width: 0; padding: var(--bs-space-4); border: 1px solid var(--bs-border); border-radius: var(--bs-radius-card); }
.bs-hq-meeting details { display: grid; min-width: 0; }
.bs-hq-meeting summary { cursor: pointer; font-size: .85rem; line-height: 1.75; padding-block: var(--bs-space-2); }
.bs-hq-meeting code { display: block; direction: ltr; unicode-bidi: isolate; white-space: pre-wrap; overflow-wrap: anywhere; font-size: .7rem; }
.bs-hq-meeting :deep(.ls-input) { width: 100%; min-width: 0; }
.bs-hq-meeting :deep(button), .bs-hq-meeting summary { min-height: 44px; }
.bs-hq-meeting :deep(button:focus-visible), .bs-hq-meeting summary:focus-visible, .bs-hq-meeting a:focus-visible { outline: 2px solid var(--bs-focus-ring); outline-offset: 2px; }
@media (max-width: 700px) { .bs-hq-meeting__columns { grid-template-columns: minmax(0, 1fr); } .bs-hq-meeting__toolbar { align-items: stretch; } }
@media (prefers-reduced-motion: reduce) { .bs-hq-meeting *, .bs-hq-meeting *::before, .bs-hq-meeting *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; } }
</style>
