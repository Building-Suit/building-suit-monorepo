<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import BsButton from '../atoms/BsButton.vue'
import BsIcon from '../atoms/BsIcon.vue'
import BsTextarea from '../atoms/BsTextarea.vue'
import BsHqWorkActivity from '../molecules/BsHqWorkActivity.vue'
import { useSpeechDictation } from '@building-suit/ux'
import type { HqAgentsContent, HqAgentsPresentation, HqChatMessage } from '../types/hqAgentsPresentation'

const props = defineProps<{ presentation: HqAgentsPresentation; content: HqAgentsContent }>()
const emit = defineEmits<{ send: [message: string]; refresh: []; openTask: [id: string]; openLearning: [id: string] }>()
const composerId = useId(), composerHintId = useId(), dictationStatusId = useId()
const composer = ref<HTMLFormElement | null>(null)
const transcript = ref<HTMLElement | null>(null)
const draft = defineModel<string>('draft', { default: '' })
const dispatching = ref(false)
const maximumLength = 6000
let pendingMessage: { text: string; existingIds: Set<string> } | null = null
let disposed = false

const blocked = computed(() => props.presentation.status !== 'connected' || props.presentation.sending || dispatching.value)
const { supported: dictationSupported, active: dictationActive, phase: dictationPhase, error: dictationError, start: startDictation, stop: stopDictation } = useSpeechDictation({
  getDraft: () => draft.value, setDraft: value => { draft.value = value },
  language: () => props.content.locale ?? 'en', disabled: () => blocked.value, maximumLength,
})
const dictationStatus = computed(() => dictationError.value ? props.content.dictation[dictationError.value]
  : !dictationSupported.value ? props.content.dictation.unsupported
  : dictationPhase.value !== 'idle' ? props.content.dictation[dictationPhase.value] : '')
const sendable = computed(() => !blocked.value && !dictationActive.value && Boolean(draft.value.trim()) && draft.value.length <= maximumLength)
function toggleDictation() { if (dictationActive.value) stopDictation(); else startDictation() }
watch(dictationActive, async (active, previous) => {
  if (active || !previous) return
  await nextTick()
  if (!disposed && composer.value?.contains(document.activeElement)) composer.value.querySelector('textarea')?.focus()
})
const notice = computed(() => props.presentation.error || (props.presentation.status === 'error' ? props.content.errorLabel : ''))
const requestProgressLabel = computed(() => {
  const progress = props.presentation.requestProgress, labels = props.content.requestProgressLabels
  if (!progress || !labels) return ''
  if (progress.state === 'recovery-needed') return labels.recoveryNeeded
  if (progress.recovering) return progress.state === 'working' ? labels.recoveryWorking : labels.recoveryQueued
  return labels[progress.state]
})

function sender(message: HqChatMessage): string {
  if (message.role === 'founder') return props.content.founderLabel
  const name = message.agentName || (message.agentId && props.presentation.agents.find(agent => agent.id === message.agentId)?.name)
  if (name) return name
  if (message.role === 'ceo') return props.content.ceoLabel
  if (message.role === 'hr') return props.content.hrLabel
  return props.content.systemLabel
}

function agentRole(message: HqChatMessage): string {
  if (message.role === 'founder') return 'founder'
  const role = message.agentId && props.presentation.agents.find(agent => agent.id === message.agentId)?.role
  if (message.role === 'ceo' || role === 'ceo' || message.agentId === 'AG-CEO-001') return 'ceo'
  return role || message.agentRole?.toLowerCase() || message.role
}

interface MessageRun { text: string; mention: boolean; bold: boolean; code: boolean }

/** Only known employee names become mentions; all text stays Vue-escaped. */
function messageRuns(message: HqChatMessage): MessageRun[] {
  const names = [...new Set([
    ...props.presentation.agents.map(agent => agent.name),
    ...(message.mentions ?? []).map(mention => mention.name),
  ].map(name => name.trim()).filter(Boolean))].sort((first, second) => second.length - first.length)
  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const mentions = names.length ? new RegExp(`(^|[^\\p{L}\\p{N}_@])(@(?:${names.map(escape).join('|')}))(?=$|[^\\p{L}\\p{N}_])`, 'giu') : null
  const runs: MessageRun[] = []
  function append(text: string, bold = false, code = false): void {
    if (!text) return
    if (!mentions || code) { runs.push({ text, mention: false, bold, code }); return }
    let offset = 0
    for (const match of text.matchAll(mentions)) {
      const start = match.index! + match[1]!.length
      if (start > offset) runs.push({ text: text.slice(offset, start), mention: false, bold, code })
      runs.push({ text: match[2]!, mention: true, bold, code })
      offset = start + match[2]!.length
    }
    if (offset < text.length) runs.push({ text: text.slice(offset), mention: false, bold, code })
  }
  // The small inline vocabulary removes raw emphasis markers without admitting
  // HTML, remote media, executable links or a second markdown rendering engine.
  let offset = 0
  for (const match of message.text.matchAll(/\*\*([^*\n]+)\*\*|`([^`\n]+)`/g)) {
    append(message.text.slice(offset, match.index))
    append(match[1] ?? match[2]!, Boolean(match[1]), Boolean(match[2]))
    offset = match.index! + match[0].length
  }
  append(message.text.slice(offset))
  return runs
}

const messages = computed(() => props.presentation.messages.map(message => ({
  ...message,
  sender: sender(message),
  identity: agentRole(message),
  initial: sender(message).trim().slice(0, 1),
  runs: messageRuns(message),
  task: message.taskId ? props.presentation.tasks?.find(task => task.id === message.taskId) : undefined,
  lessons: (props.presentation.lessons ?? []).filter(lesson => lesson.status === 'published' && lesson.publishedAt
    && (lesson.publicationReference || lesson.sourceUrl)
    && message.learningIds?.includes(lesson.id)),
})))

function chatKeydown(event: KeyboardEvent): void {
  // First Escape stops dictation; the next retains sidebar focus/close policy.
  if (event.key === 'Escape' && dictationActive.value) { event.preventDefault(); event.stopPropagation(); stopDictation(); return }
  if (event.key !== 'Escape') event.stopPropagation()
}

function timeLabel(value: string): string {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return value
  return new Intl.DateTimeFormat(props.content.locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

async function submit(): Promise<void> {
  if (!sendable.value) return
  const text = draft.value.trim()
  pendingMessage = { text, existingIds: new Set(props.presentation.messages.map(message => message.id)) }
  // This local latch also covers repeated Enter/click events before the
  // parent's asynchronous sending state has reached the component.
  dispatching.value = true
  emit('send', text)
  await nextTick()
  if (!disposed) dispatching.value = false
}

function composerKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing || event.keyCode === 229) return
  event.preventDefault()
  void submit()
}

function acknowledgeDraft(): void {
  if (!pendingMessage) return
  const saved = props.presentation.messages.some(message => message.role === 'founder'
    && message.text === pendingMessage!.text && !pendingMessage!.existingIds.has(message.id))
  if (saved) {
    if (draft.value.trim() === pendingMessage.text) draft.value = ''
    pendingMessage = null
  }
  else if (!props.presentation.sending && props.presentation.error) pendingMessage = null
}

watch(() => [props.presentation.messages, props.presentation.messages.length,
  props.presentation.messages[props.presentation.messages.length - 1]?.id,
  props.presentation.messages[props.presentation.messages.length - 1]?.text] as const, async () => {
  acknowledgeDraft()
  const element = transcript.value
  const nearEnd = !element || element.scrollHeight - element.scrollTop - element.clientHeight < 90
  await nextTick()
  if (!disposed && nearEnd && transcript.value) transcript.value.scrollTop = transcript.value.scrollHeight
}, { deep: false, immediate: true })
watch(() => [props.presentation.sending, props.presentation.error], acknowledgeDraft)
onBeforeUnmount(() => { disposed = true; pendingMessage = null })
</script>

<template>
  <section class="bs-hq-chat" :aria-label="content.title" :aria-busy="presentation.pending" @keydown="chatKeydown">
    <header class="bs-hq-chat__header">
      <p class="bs-hq-chat__description">{{ content.description }}</p>
      <div class="bs-hq-chat__runtime" role="status" aria-live="polite">
        <span class="bs-hq-chat__connection" :data-online="presentation.runtimeOnline || undefined">
          <span class="bs-hq-chat__dot" aria-hidden="true" />
          {{ presentation.runtimeOnline ? content.runtimeOnlineLabel : content.runtimeOfflineLabel }}
        </span>
        <span v-if="presentation.queuedCount">{{ content.queuedLabel }}: <bdi>{{ presentation.queuedCount }}</bdi></span>
      </div>
      <p v-if="presentation.lastRuntimeSeenAt && !presentation.runtimeOnline" class="bs-hq-chat__meta">
        {{ content.lastSeenLabel }}:
        <time :datetime="presentation.lastRuntimeSeenAt">{{ timeLabel(presentation.lastRuntimeSeenAt) }}</time>
      </p>
      <BsHqWorkActivity v-if="content.workforce?.activity && presentation.workActivity" :items="presentation.workActivity" :copy="content.workforce.activity" :locale="content.locale" compact @open-task="emit('openTask', $event)" />
    </header>

    <p v-if="notice" class="bs-hq-chat__notice" role="alert">{{ notice }}</p>
    <p v-if="presentation.status === 'loading'" class="bs-hq-chat__notice" role="status">{{ content.loadingLabel }}</p>
    <p v-else-if="presentation.status === 'unavailable'" class="bs-hq-chat__notice" role="status">{{ content.unavailableLabel }}</p>
    <BsButton v-if="content.workforce && (presentation.status === 'unavailable' || presentation.status === 'error')" :disabled="presentation.pending" @click="emit('refresh')" variant="icon" :aria-label="content.workforce.refreshLabel" :title="content.workforce.refreshLabel"><BsIcon name="refresh" :size="18" /></BsButton>

    <div ref="transcript" class="bs-hq-chat__transcript" role="log" :aria-label="content.transcriptLabel" aria-live="polite" aria-relevant="additions text" tabindex="0">
      <p v-if="!presentation.messages.length && presentation.status === 'connected'" class="bs-hq-chat__empty">{{ content.emptyLabel }}</p>
      <ol v-else class="bs-hq-chat__messages">
        <li v-for="message in messages" :key="message.id" class="bs-hq-chat__entry">
          <article class="bs-hq-chat__message" :data-role="message.role" :data-agent-role="message.identity" :data-kind="message.kind">
            <span v-if="message.role !== 'founder'" class="bs-hq-chat__avatar" :class="{ 'bs-hq-chat__avatar--ceo': message.identity === 'ceo' }" aria-hidden="true">
              <BsIcon v-if="message.identity === 'ceo'" name="user" :size="19" />
              <BsIcon v-else-if="message.role === 'system' && !message.agentId" name="automation" :size="18" />
              <span v-else>{{ message.initial }}</span>
            </span>
            <div class="bs-hq-chat__message-body">
              <div class="bs-hq-chat__bubble" dir="auto">
                <strong class="bs-hq-chat__sender" dir="auto">{{ message.sender }}</strong>
                <p class="bs-hq-chat__text" dir="auto"><span v-for="(run, index) in message.runs" :key="index" :class="{ 'bs-hq-chat__mention': run.mention, 'bs-hq-chat__emphasis': run.bold, 'bs-hq-chat__code': run.code }">{{ run.text }}</span></p>
                <BsButton v-if="message.taskId" variant="secondary" size="sm" class="bs-hq-chat__task-link" @click="emit('openTask', message.taskId)">
                  <BsIcon name="reports" :size="16" />
                  <span dir="auto">{{ content.openTaskLabel || content.workforce?.tasksLabel }}<template v-if="message.task"> · {{ message.task.title }}</template></span>
                  <BsIcon name="arrowRight" :size="14" directional />
                </BsButton>
              </div>
              <time class="bs-hq-chat__timestamp" :datetime="message.createdAt" :title="timeLabel(message.createdAt)">{{ timeLabel(message.createdAt) }}</time>
            </div>
          </article>
          <div v-if="presentation.requestProgress?.messageId === message.id && requestProgressLabel" class="bs-hq-chat__request-progress" :data-request-state="presentation.requestProgress.state" :data-recovering="presentation.requestProgress.recovering || undefined" role="status" aria-live="polite">
            <BsIcon :name="presentation.requestProgress.state === 'recovery-needed' ? 'automation' : 'chat'" :size="16" />
            <div><strong dir="auto">{{ presentation.requestProgress.agentName }}</strong><p>{{ requestProgressLabel }}</p></div>
          </div>
          <div v-if="message.lessons.length" class="bs-hq-chat__learning">
            <BsButton v-for="lesson in message.lessons" :key="lesson.id" variant="secondary" size="sm" @click="emit('openLearning', lesson.id)">
              <BsIcon name="orb" :size="16" />
              <span>{{ content.learningUpdatedLabel || content.workforce?.learningLabel }} · <bdi>{{ lesson.title }}</bdi></span>
              <BsIcon name="arrowRight" :size="14" directional />
            </BsButton>
          </div>
        </li>
      </ol>
    </div>

    <form ref="composer" class="bs-hq-chat__composer" @submit.prevent="submit">
      <div class="bs-hq-chat__composer-row">
        <BsTextarea :id="composerId" v-model="draft" :rows="1" :maxlength="maximumLength" :placeholder="content.composerPlaceholder" :aria-label="content.composerLabel" :aria-describedby="`${composerHintId} ${dictationStatusId}`" :readonly="presentation.sending || dispatching || dictationActive" autocomplete="off" dir="auto" required @keydown="composerKeydown" />
        <BsButton type="button" variant="icon" class="bs-hq-chat__mic" :data-listening="dictationActive || undefined" :aria-pressed="dictationActive" :aria-label="dictationActive ? content.dictation.stop : content.dictation.start" :title="!dictationSupported ? content.dictation.unsupported : dictationActive ? content.dictation.stop : content.dictation.start" :aria-describedby="dictationStatusId" :disabled="!dictationSupported || blocked || dictationPhase === 'stopping'" @click="toggleDictation"><BsIcon :name="dictationActive ? 'stop' : 'microphone'" :size="20" /></BsButton>
        <BsButton type="submit" variant="primary" class="bs-hq-chat__send" :aria-label="presentation.sending || dispatching ? content.sendingLabel : content.sendLabel" :title="content.sendLabel" :pending="presentation.sending || dispatching" :disabled="!sendable"><BsIcon v-if="!presentation.sending && !dispatching" name="send" :size="20" directional /></BsButton>
      </div>
      <div class="bs-hq-chat__composer-meta"><span :id="composerHintId">{{ content.keyboardHint }}</span><span aria-hidden="true"><bdi>{{ draft.length }} / {{ maximumLength }}</bdi></span></div>
      <p :id="dictationStatusId" class="bs-hq-chat__dictation-status" :data-error="dictationError || undefined" role="status" aria-live="polite">{{ dictationStatus }}<span v-if="dictationActive"> {{ content.dictation.notice }}</span></p>
    </form>
  </section>
</template>

<style scoped>
.bs-hq-chat { display: flex; flex-direction: column; flex: 1; gap: var(--bs-space-3); min-width: 0; min-height: 0; height: 100%; color: var(--bs-text); }
.bs-hq-chat h3, .bs-hq-chat p { margin: 0; }
.bs-hq-chat__header { display: grid; flex: none; gap: var(--bs-space-2); }
.bs-hq-chat__description, .bs-hq-chat__notice, .bs-hq-chat__empty { color: var(--bs-text-muted); font-size: .78rem; line-height: 1.7; overflow-wrap: anywhere; }
.bs-hq-chat__runtime { display: flex; flex-wrap: wrap; gap: var(--bs-space-1) var(--bs-space-3); color: var(--bs-text-muted); font-size: .69rem; line-height: 1.7; }
.bs-hq-chat__connection { display: inline-flex; align-items: center; gap: var(--bs-space-2); }
.bs-hq-chat__dot { width: .4rem; height: .4rem; flex-shrink: 0; border-radius: 50%; background: var(--bs-text-muted); }
.bs-hq-chat__connection[data-online] .bs-hq-chat__dot { background: var(--bs-color-semantic-success-dark); }
.bs-hq-chat__meta, .bs-hq-chat__count { color: var(--bs-text-muted); font-size: .65rem; line-height: 1.6; }
.bs-hq-chat__notice { flex: none; padding: var(--bs-space-3); border-inline-start: 2px solid var(--bs-accent); background: var(--bs-surface-muted); }
.bs-hq-chat__transcript { flex: 1 1 auto; min-height: 0; overflow: auto; overscroll-behavior: contain; scrollbar-gutter: stable; padding-block: var(--bs-space-4); padding-inline: var(--bs-space-1); border-block: 1px solid var(--bs-border); }
.bs-hq-chat__transcript:focus-visible { outline: 2px solid var(--bs-accent); outline-offset: 2px; }
.bs-hq-chat__empty { padding-block: var(--bs-space-4); text-align: center; }
.bs-hq-chat__messages { display: grid; gap: var(--bs-space-4); margin: 0; padding: 0; list-style: none; }
.bs-hq-chat__entry { min-width: 0; }
/* Physical sides intentionally stay consistent when message text is Arabic. */
.bs-hq-chat__message[data-role] { display: flex; align-items: flex-start; gap: var(--bs-space-2); min-width: 0; direction: ltr; background-color: transparent; }
.bs-hq-chat__message[data-role='founder'] { flex-direction: row-reverse; }
.bs-hq-chat__avatar { display: grid; flex: none; place-items: center; width: 30px; height: 30px; overflow: hidden; border: 1px solid var(--bs-border); border-radius: var(--bs-radius-full); background: var(--bs-surface-muted); color: var(--bs-text-muted); font-size: .75rem; font-weight: var(--bs-weight-semibold); }
.bs-hq-chat__avatar--ceo { background: var(--bs-color-brand-building-navy); color: var(--bs-color-brand-highlight-gold); border-color: var(--bs-color-brand-steel-border); }
.bs-hq-chat__message-body { display: grid; gap: var(--bs-space-1); max-width: min(87%, 34rem); min-width: 0; }
.bs-hq-chat__bubble { display: grid; gap: var(--bs-space-1); padding: var(--bs-space-2) var(--bs-space-3); border: 1px solid var(--bs-border); border-radius: var(--bs-radius-card); border-top-left-radius: var(--bs-radius-chip); background: var(--bs-component-hq-glass-card); text-align: start; }
.bs-hq-chat__message[data-role='founder'] .bs-hq-chat__bubble { border-radius: var(--bs-radius-card); border-top-right-radius: var(--bs-radius-chip); border-color: var(--bs-color-brand-steel-border); background: var(--bs-color-brand-building-navy); color: var(--bs-color-brand-pearl-white); }
.bs-hq-chat__message[data-role='founder'] .bs-hq-chat__sender { color: var(--bs-color-brand-soft-silver); }
.bs-hq-chat__sender { color: var(--bs-text-muted); font-size: .7rem; line-height: 1.6; font-weight: var(--bs-weight-semibold); overflow-wrap: anywhere; }
.bs-hq-chat__message[data-agent-role='ceo'] .bs-hq-chat__sender { color: var(--bs-color-brand-highlight-gold); }
.bs-hq-chat__text { white-space: pre-wrap; overflow-wrap: anywhere; font-size: .83rem; line-height: 1.85; }
.bs-hq-chat__emphasis { font-weight: var(--bs-weight-semibold); }
.bs-hq-chat__mention { color: var(--bs-color-semantic-info-dark); background: color-mix(in srgb, var(--bs-color-semantic-info-dark) 12%, transparent); border-radius: var(--bs-radius-chip); padding-inline: 2px; font-weight: var(--bs-weight-semibold); }
.bs-hq-chat__code { font-family: ui-monospace, monospace; font-size: .95em; padding-inline: 3px; background: var(--bs-surface-muted); border-radius: var(--bs-radius-chip); }
.bs-hq-chat__timestamp { color: var(--bs-text-muted); font-size: .61rem; line-height: 1.7; direction: initial; padding-inline: var(--bs-space-1); }
.bs-hq-chat__message[data-role='founder'] .bs-hq-chat__timestamp { text-align: right; }
.bs-hq-chat__task-link { display: flex; align-items: center; gap: var(--bs-space-2); justify-self: start; margin-block-start: var(--bs-space-2); text-align: start; color: var(--bs-color-secondary-pale-sky); }
.bs-hq-chat__task-link span { overflow-wrap: anywhere; font-size: .73rem; line-height: 1.6; }
.bs-hq-chat__task-link :deep(svg) { flex: none; }
.bs-hq-chat__request-progress { display: flex; align-items: flex-start; gap: var(--bs-space-2); margin-block-start: var(--bs-space-3); padding: var(--bs-space-2) var(--bs-space-3); border-inline-start: 2px solid var(--bs-border); color: var(--bs-text-muted); font-size: .72rem; line-height: 1.7; }
.bs-hq-chat__request-progress > :first-child { flex: none; margin-block-start: 2px; }
.bs-hq-chat__request-progress strong { font-weight: var(--bs-weight-semibold); }
.bs-hq-chat__request-progress[data-request-state='recovery-needed'] { border-inline-start-color: var(--bs-color-semantic-warning-dark); }
.bs-hq-chat__learning { margin-block-start: var(--bs-space-3); padding-block: var(--bs-space-2); border-block: 1px solid var(--bs-border); }
.bs-hq-chat__learning :deep(button) { display: flex; align-items: center; justify-content: center; gap: var(--bs-space-2); width: 100%; color: var(--bs-text-muted); font-size: .7rem; line-height: 1.6; text-align: center; }
.bs-hq-chat__learning :deep(svg) { flex: none; color: var(--bs-accent); }
.bs-hq-chat__composer { display: grid; flex: none; gap: var(--bs-space-2); }
.bs-hq-chat__composer-row { display: grid; grid-template-columns: minmax(0,1fr) 44px 44px; align-items: end; gap: var(--bs-space-2); }
.bs-hq-chat__composer :deep(textarea) { width: 100%; resize: vertical; min-width: 0; min-height: 44px; max-height: 8rem; color: var(--bs-text); border-color: var(--bs-border); background: var(--bs-component-hq-glass-control); }
.bs-hq-chat__composer :deep(textarea:focus-visible) { outline: 2px solid var(--bs-accent); outline-offset: 2px; }
.bs-hq-chat__composer-row :deep(button) { width: 44px; height: 44px; min-height: 44px; display: inline-flex; align-items: center; justify-content: center; padding: 0; border-radius: var(--bs-radius-button); }
.bs-hq-chat__mic { border: 1px solid var(--bs-border); background: var(--bs-component-hq-glass-control); color: var(--bs-text); }
.bs-hq-chat__mic[data-listening] { border-color: var(--bs-accent); color: var(--bs-accent); }
.bs-hq-chat__composer-meta { display: flex; align-items: start; justify-content: space-between; gap: var(--bs-space-2); color: var(--bs-text-muted); font-size: .65rem; line-height: 1.6; }
.bs-hq-chat__composer-meta > :last-child { flex: none; }
.bs-hq-chat__dictation-status { color: var(--bs-text-muted); font-size: .7rem; line-height: 1.6; }
.bs-hq-chat__dictation-status:empty { display: none; }
.bs-hq-chat__dictation-status[data-error] { color: var(--bs-color-semantic-warning-dark); }
@media (max-width: 32rem) {
  .bs-hq-chat__message-body { max-width: min(82%, calc(100% - 48px)); }
  .bs-hq-chat__description { font-size: .73rem; }
}
@media (max-height: 44rem) {
  .bs-hq-chat__description { display: none; }
  .bs-hq-chat__header { gap: var(--bs-space-1); }
  .bs-hq-chat__composer :deep(textarea) { min-height: 44px; max-height: 6rem; }
}
</style>
