<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useId, watch } from 'vue'
import type { BsAssistantChatCopy, BsAssistantChatView } from '../types/assistantChatPresentation'

const props = defineProps<{ copy: BsAssistantChatCopy; view: BsAssistantChatView; maximumLength: number; preview?: boolean; compact?: boolean }>()
const draft = defineModel<string>('draft', { required: true })
const emit = defineEmits<{ send: []; confirm: []; discard: []; authorize: [enabled: boolean]; loadEarlier: [] }>()
const transcript = ref<HTMLElement | null>(null)
const form = ref<HTMLFormElement | null>(null)
const proposal = ref<HTMLElement | null>(null)
const authorizationTitle = ref<HTMLElement | null>(null)
const hintId = useId()
const proposalTitleId = useId()
const authorizationTitleId = useId()
const composerBlocked = computed(() => Boolean(props.view.pending || props.view.proposal || props.view.canSend === false))
const sendable = computed(() => !composerBlocked.value && Boolean(draft.value.trim()) && draft.value.length <= props.maximumLength)

function submit() {
  if (sendable.value) emit('send')
}

function focusComposer() {
  form.value?.querySelector('textarea')?.focus()
}

defineExpose({ focusComposer })

function handleComposerKey(event: KeyboardEvent) {
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing || event.keyCode === 229) return
  event.preventDefault()
  submit()
}

function scrollToLatest(animate = false) {
  const region = transcript.value
  if (!region) return
  const smooth = animate && props.compact && window.matchMedia('(prefers-reduced-motion: no-preference)').matches
  region.scrollTo({ top: region.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
}

onMounted(() => scrollToLatest())
watch(
  [
    () => props.view.messages[0]?.id,
    () => props.view.messages.at(-1)?.id,
    () => props.view.messages.at(-1)?.outcome,
    () => props.view.typing,
  ],
  async ([first, last, , typing], [previousFirst, previousLast, , previousTyping]) => {
    const region = transcript.value
    if (!region) return
    const { scrollTop, scrollHeight, clientHeight } = region
    const prepended = first !== previousFirst && last === previousLast
    const nearEnd = scrollHeight - scrollTop - clientHeight < 72
    const startedSending = typing && !previousTyping && props.view.pending === 'send'
    await nextTick()
    if (prepended) region.scrollTop = scrollTop + region.scrollHeight - scrollHeight
    else if (nearEnd || startedSending) scrollToLatest(!typing)
  },
)

watch(() => Boolean(props.view.proposal), async present => {
  const focused = document.activeElement
  if (focused !== document.body && !(present ? form.value : proposal.value)?.contains(focused)) return
  await nextTick()
  if (present) proposal.value?.querySelector('h2')?.focus()
  else form.value?.querySelector('textarea')?.focus()
})

watch(() => props.view.delegation?.enabled, async (enabled, previous) => {
  if (props.preview || enabled === undefined || previous === undefined) return
  const focused = document.activeElement
  if (focused !== document.body && !authorizationTitle.value?.parentElement?.contains(focused)
    && !(focused instanceof HTMLElement && focused.dataset.assistantRevoke !== undefined)) return
  await nextTick()
  if (enabled) form.value?.querySelector('textarea')?.focus()
  else authorizationTitle.value?.focus()
})
</script>

<template>
  <BsStateSurface
    v-if="view.state !== 'ready'"
    :state="view.state === 'loading' || view.state === 'denied' ? view.state : 'info'"
    :title="copy.status[view.state]"
  />
  <section v-else-if="!compact && view.delegation && !view.delegation.enabled" class="bs-assistant-chat bs-assistant-chat__authorization" :aria-labelledby="authorizationTitleId">
    <h2 :id="authorizationTitleId" ref="authorizationTitle" tabindex="-1">{{ view.delegation.title }}</h2>
    <p>{{ view.delegation.explanation }}</p>
    <div class="bs-assistant-chat__proposal-actions">
      <BsLink v-for="policy in view.delegation.policies" :key="policy.to" :to="policy.to">{{ policy.label }}</BsLink>
    </div>
    <BsAlert v-if="view.error" tone="error" :description="view.error" />
    <div>
      <BsButton variant="primary" :disabled="preview" :pending="view.pending === 'access'" @click="emit('authorize', true)">
        {{ view.delegation.enable }}
      </BsButton>
    </div>
  </section>
  <section v-else class="bs-assistant-chat" :data-compact="compact || undefined" :data-review="Boolean(view.proposal) || undefined" :aria-label="copy.title">
    <p class="bs-assistant-chat__privacy">{{ copy.privacy }}</p>
    <div ref="transcript" class="bs-assistant-chat__transcript" role="log" :aria-label="copy.transcript" aria-live="polite" tabindex="0">
      <p v-if="view.historyLoading" class="bs-assistant-chat__progress" role="status">{{ copy.status.loading }}</p>
      <div v-else-if="!view.messages.length && !view.typing" class="bs-assistant-chat__empty">
        <BsIcon name="chat" :size="26" />
        <h2>{{ copy.emptyTitle }}</h2>
        <p>{{ copy.emptyDescription }}</p>
      </div>
      <div v-if="view.hasMore && copy.loadEarlier" class="bs-assistant-chat__history-action">
        <BsButton variant="text" size="sm" :pending="view.loadingEarlier" @click="emit('loadEarlier')">
          {{ view.loadingEarlier ? copy.loadingEarlier || copy.loadEarlier : copy.loadEarlier }}
        </BsButton>
      </div>
      <TransitionGroup
        tag="ol"
        name="bs-assistant-message"
        :css="Boolean(compact)"
        class="bs-assistant-chat__messages"
      >
        <li v-for="message in view.messages" :key="message.id" class="bs-assistant-chat__message" :data-role="message.role">
          <strong>{{ copy[message.role] }}</strong>
          <p dir="auto">{{ message.text }}</p>
          <p v-if="message.outcome" dir="auto">{{ message.outcome }}</p>
          <BsLink v-if="message.link" :to="message.link.to" variant="standalone">
            {{ message.link.label }}
            <BsIcon name="arrowRight" :size="16" directional />
          </BsLink>
        </li>
        <li v-if="view.typing" key="typing" class="bs-assistant-chat__message bs-assistant-chat__typing" aria-hidden="true">
          <span /><span /><span />
        </li>
      </TransitionGroup>
    </div>
    <p v-if="copy.typing" class="sr-only" role="status">{{ view.typing ? copy.typing : '' }}</p>

    <div v-if="!preview" class="bs-assistant-chat__controls">
      <p v-if="view.pending === 'send' && !copy.typing" class="bs-assistant-chat__progress" role="status">{{ copy.sending }}</p>
      <ul v-if="view.pendingJobs?.length" class="bs-assistant-chat__jobs" role="status">
        <li v-for="job in view.pendingJobs" :key="job.id" dir="auto">{{ job.label }}</li>
      </ul>
      <p v-if="view.notice" class="bs-assistant-chat__progress" role="status">{{ view.notice }}</p>
      <section v-if="compact && view.delegation && !view.delegation.enabled" class="bs-assistant-chat__delegation" :aria-labelledby="authorizationTitleId">
        <h2 :id="authorizationTitleId" ref="authorizationTitle" tabindex="-1">{{ view.delegation.title }}</h2>
        <p>{{ view.delegation.explanation }}</p>
        <div class="bs-assistant-chat__proposal-actions">
          <BsLink v-for="policy in view.delegation.policies" :key="policy.to" :to="policy.to">{{ policy.label }}</BsLink>
        </div>
        <div>
          <BsButton variant="primary" size="sm" :pending="view.pending === 'access'" @click="emit('authorize', true)">
            {{ view.delegation.enable }}
          </BsButton>
        </div>
      </section>
      <BsAlert v-if="view.error" tone="error" :description="view.error" />
      <section v-if="view.proposal" ref="proposal" class="bs-assistant-chat__proposal" :aria-labelledby="proposalTitleId">
        <h2 :id="proposalTitleId" tabindex="-1">{{ copy.proposalTitle }}</h2>
        <p dir="auto">{{ view.proposal.title }}</p>
        <dl>
          <div v-for="field in view.proposal.fields" :key="field.label">
            <dt>{{ field.label }}</dt>
            <dd dir="auto">{{ field.value }}</dd>
          </div>
        </dl>
        <p class="bs-assistant-chat__help">{{ copy.proposalHelp }}</p>
        <div class="bs-assistant-chat__proposal-actions">
          <BsButton variant="primary" :pending="view.pending === 'confirm'" @click="emit('confirm')">
            {{ view.pending === 'confirm' ? copy.confirming : copy.confirm }}
          </BsButton>
          <BsButton variant="secondary" :disabled="Boolean(view.pending)" @click="emit('discard')">{{ copy.discard }}</BsButton>
        </div>
      </section>
      <form v-if="!compact || (view.showComposer !== false && view.delegation?.enabled !== false)" v-show="!view.proposal" ref="form" class="bs-assistant-chat__composer" @submit.prevent="submit">
        <BsTextarea
          v-model="draft"
          dir="auto"
          :rows="2"
          :maxlength="maximumLength"
          :aria-label="copy.composer"
          :aria-describedby="hintId"
          :placeholder="copy.placeholder"
          :readonly="composerBlocked"
          required
          @keydown="handleComposerKey"
        />
        <BsButton
          variant="primary"
          type="submit"
          :aria-label="copy.send"
          :title="copy.send"
          :pending="view.pending === 'send' && !copy.typing"
          :disabled="!sendable"
        >
          <BsIcon name="send" :size="20" directional />
        </BsButton>
        <p :id="hintId" class="bs-assistant-chat__help">{{ copy.keyboardHint }}</p>
      </form>
    </div>
  </section>
</template>

<style scoped>
.bs-assistant-chat {
  display: grid;
  min-width: 0;
  background: var(--bs-surface);
  border: 1px solid var(--bs-border);
  border-radius: var(--bs-radius-card);
}

.bs-assistant-chat__authorization {
  gap: var(--bs-space-3);
  padding: var(--bs-space-4);
}

.bs-assistant-chat__privacy {
  padding: var(--bs-space-2) var(--bs-space-4);
  border-block-end: 1px solid var(--bs-border);
  color: var(--bs-text-muted);
  font-size: .8125rem;
}

.bs-assistant-chat__transcript {
  min-height: clamp(12rem, 35dvh, 27rem);
  max-height: 52dvh;
  overflow: auto;
  overscroll-behavior: contain;
  padding: var(--bs-space-4);
}

.bs-assistant-chat__transcript:focus-visible {
  outline: var(--bs-focus-ring-style);
  outline-offset: -2px;
  border-radius: var(--bs-radius-card);
}

.bs-assistant-chat__empty {
  display: grid;
  justify-items: start;
  gap: var(--bs-space-2);
  max-width: 35rem;
  padding-block: var(--bs-space-4);
}

.bs-assistant-chat__empty svg { color: var(--bs-text-muted); }

.bs-assistant-chat h2 {
  margin: 0;
  font-size: 1rem;
  font-weight: var(--bs-weight-semibold);
}

.bs-assistant-chat p { margin: 0; }
.bs-assistant-chat__empty p { color: var(--bs-text-muted); }

.bs-assistant-chat__messages {
  display: grid;
  gap: var(--bs-space-4);
  list-style: none;
  margin: 0;
  padding: 0;
}

.bs-assistant-chat__message {
  display: grid;
  justify-self: start;
  gap: var(--bs-space-1);
  min-width: 0;
  max-width: min(88%, 44rem);
  padding: var(--bs-space-3) var(--bs-space-4);
  border: 1px solid var(--bs-border);
  border-radius: var(--bs-radius-card);
}

.bs-assistant-chat__message[data-role='user'] {
  justify-self: end;
  background: var(--bs-surface-muted);
}

.bs-assistant-chat__message strong {
  color: var(--bs-text-muted);
  font-size: .8125rem;
  font-weight: var(--bs-weight-semibold);
}

.bs-assistant-chat__message p {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.65;
}

.bs-assistant-chat__message a {
  display: inline-flex;
  justify-self: start;
  align-items: center;
  gap: var(--bs-space-1);
  margin-block-start: var(--bs-space-1);
}

.bs-assistant-chat__typing {
  display: flex;
  align-items: center;
  gap: var(--bs-space-1);
  min-height: 2.5rem;
}

.bs-assistant-chat__typing span {
  width: .375rem;
  height: .375rem;
  background: var(--bs-text-muted);
  border-radius: var(--bs-radius-full);
}

@media (prefers-reduced-motion: no-preference) {
  .bs-assistant-message-enter-active {
    transition: opacity var(--bs-motion-default), transform var(--bs-motion-default);
  }

  .bs-assistant-message-enter-from {
    opacity: 0;
    transform: translateY(var(--bs-space-1));
  }

  .bs-assistant-chat__typing span { animation: bs-assistant-typing 950ms ease-in-out infinite; }
  .bs-assistant-chat__typing span:nth-child(2) { animation-delay: 110ms; }
  .bs-assistant-chat__typing span:nth-child(3) { animation-delay: 220ms; }
}

@keyframes bs-assistant-typing {
  0%, 65%, 100% { opacity: .55; transform: none; }
  32% { opacity: 1; transform: translateY(calc(-1 * var(--bs-space-1))); }
}

.bs-assistant-chat__controls {
  display: grid;
  gap: var(--bs-space-3);
  min-width: 0;
  padding: var(--bs-space-4);
  border-block-start: 1px solid var(--bs-border);
}

.bs-assistant-chat__composer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: var(--bs-space-2);
}

.bs-assistant-chat__composer :deep(textarea) {
  width: 100%;
  min-height: 3.25rem;
  resize: vertical;
}

.bs-assistant-chat__composer :deep(button) {
  min-width: 2.75rem;
  min-height: 2.75rem;
}

.bs-assistant-chat__help,
.bs-assistant-chat__progress {
  color: var(--bs-text-muted);
  font-size: .8125rem;
}

.bs-assistant-chat__help { grid-column: 1 / -1; }

.bs-assistant-chat__proposal {
  display: grid;
  gap: var(--bs-space-2);
  min-width: 0;
  overflow-wrap: anywhere;
}

.bs-assistant-chat__proposal dl {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 8rem), 1fr));
  gap: var(--bs-space-2) var(--bs-space-4);
  margin: 0;
  padding-block: var(--bs-space-2);
}

.bs-assistant-chat__proposal dt {
  color: var(--bs-text-muted);
  font-size: .8125rem;
}

.bs-assistant-chat__proposal dd { margin: 0; }

.bs-assistant-chat__proposal-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--bs-space-2);
}

.bs-assistant-chat__history-action {
  display: flex;
  justify-content: center;
  margin-block-end: var(--bs-space-3);
}

.bs-assistant-chat__jobs {
  display: grid;
  gap: var(--bs-space-1);
  margin: 0;
  padding: 0;
  list-style: none;
  color: var(--bs-text-muted);
  font-size: .8125rem;
}

.bs-assistant-chat__delegation {
  display: grid;
  gap: var(--bs-space-2);
}

.bs-assistant-chat[data-compact] {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  border: 0;
  border-radius: 0;
}

.bs-assistant-chat[data-compact] .bs-assistant-chat__transcript {
  flex: 1 1 auto;
  min-height: 9rem;
  max-height: min(38dvh, 24rem);
  padding: var(--bs-space-3);
}

.bs-assistant-chat[data-compact] .bs-assistant-chat__controls { padding: var(--bs-space-3); }
.bs-assistant-chat[data-compact] .bs-assistant-chat__messages { gap: var(--bs-space-2); }
.bs-assistant-chat[data-compact] .bs-assistant-chat__message { max-width: 96%; }
.bs-assistant-chat[data-compact] .bs-assistant-chat__empty { padding-block: var(--bs-space-2); }
.bs-assistant-chat[data-compact] .bs-assistant-chat__empty svg { display: none; }

@media (max-width: 32rem) {
  .bs-assistant-chat__transcript,
  .bs-assistant-chat__controls { padding: var(--bs-space-3); }
  .bs-assistant-chat[data-review] .bs-assistant-chat__transcript { min-height: 0; max-height: 38dvh; }
  .bs-assistant-chat__message { max-width: 96%; }
}
</style>
