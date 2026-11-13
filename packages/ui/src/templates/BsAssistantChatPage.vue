<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from 'vue'
import type { BsAssistantChatCopy, BsAssistantChatView } from '../types/assistantChatPresentation'

const props = defineProps<{ copy: BsAssistantChatCopy; view: BsAssistantChatView; maximumLength: number; preview?: boolean }>()
const draft = defineModel<string>('draft', { required: true })
const emit = defineEmits<{ send: []; reset: []; confirm: []; discard: []; authorize: [enabled: boolean] }>()
const transcript = ref<HTMLElement | null>(null)
const form = ref<HTMLFormElement | null>(null)
const proposal = ref<HTMLElement | null>(null)
const authorizationTitle = ref<HTMLElement | null>(null)
const hintId = useId()
const proposalTitleId = useId()
const authorizationTitleId = useId()
const composerBlocked = computed(() => Boolean(props.view.pending || props.view.proposal))
const sendable = computed(() => !composerBlocked.value && Boolean(draft.value.trim()) && draft.value.length <= props.maximumLength)

function submit() {
  if (sendable.value) emit('send')
}

async function resetConversation() {
  emit('reset')
  await nextTick()
  form.value?.querySelector('textarea')?.focus()
}

function handleComposerKey(event: KeyboardEvent) {
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing || event.keyCode === 229) return
  event.preventDefault()
  submit()
}

watch(() => props.view.messages.at(-1)?.id, async () => {
  const region = transcript.value
  if (!region || region.scrollHeight - region.scrollTop - region.clientHeight > 72) return
  await nextTick()
  region.scrollTop = region.scrollHeight
})

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
  <BsPage width="lg" padding="none">
    <BsPageHeader :title="copy.title" :context="[...view.context]">
      <template v-if="!preview && view.state === 'ready' && (view.delegation?.enabled || view.messages.length || draft)" #actions>
        <BsButton v-if="view.delegation?.enabled" data-assistant-revoke variant="secondary" size="sm" :pending="view.pending === 'access'" @click="emit('authorize', false)">
          {{ view.delegation.disable }}
        </BsButton>
        <BsButton v-if="view.messages.length || draft" variant="secondary" size="sm" :disabled="Boolean(view.pending)" @click="resetConversation">
          <BsIcon name="add" :size="17" />
          {{ copy.newChat }}
        </BsButton>
      </template>
    </BsPageHeader>

    <BsStateSurface
      v-if="view.state !== 'ready'"
      :state="view.state === 'loading' || view.state === 'denied' ? view.state : 'info'"
      :title="copy.status[view.state]"
    />
    <section v-else-if="view.delegation && !view.delegation.enabled" class="bs-assistant-chat bs-assistant-chat__authorization" :aria-labelledby="authorizationTitleId">
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
    <section v-else class="bs-assistant-chat" :data-review="Boolean(view.proposal) || undefined" :aria-label="copy.title">
      <p class="bs-assistant-chat__privacy">{{ copy.privacy }}</p>
      <div ref="transcript" class="bs-assistant-chat__transcript" role="log" :aria-label="copy.transcript" aria-live="polite" tabindex="0">
        <div v-if="!view.messages.length" class="bs-assistant-chat__empty">
          <BsIcon name="chat" :size="26" />
          <h2>{{ copy.emptyTitle }}</h2>
          <p>{{ copy.emptyDescription }}</p>
        </div>
        <ol v-else class="bs-assistant-chat__messages">
          <li v-for="message in view.messages" :key="message.id" class="bs-assistant-chat__message" :data-role="message.role">
            <strong>{{ copy[message.role] }}</strong>
            <p dir="auto">{{ message.text }}</p>
            <BsLink v-if="message.link" :to="message.link.to" variant="standalone">
              {{ message.link.label }}
              <BsIcon name="arrowRight" :size="16" directional />
            </BsLink>
          </li>
        </ol>
      </div>

      <div v-if="!preview" class="bs-assistant-chat__controls">
        <p v-if="view.pending === 'send'" class="bs-assistant-chat__progress" role="status">{{ copy.sending }}</p>
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
        <form v-show="!view.proposal" ref="form" class="bs-assistant-chat__composer" @submit.prevent="submit">
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
            :pending="view.pending === 'send'"
            :disabled="!sendable"
          >
            <BsIcon name="send" :size="20" directional />
          </BsButton>
          <p :id="hintId" class="bs-assistant-chat__help">{{ copy.keyboardHint }}</p>
        </form>
      </div>
    </section>
  </BsPage>
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
  outline: 2px solid var(--bs-focus-ring);
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

@media (max-width: 32rem) {
  .bs-assistant-chat__transcript,
  .bs-assistant-chat__controls { padding: var(--bs-space-3); }
  .bs-assistant-chat[data-review] .bs-assistant-chat__transcript { min-height: 0; max-height: 38dvh; }
  .bs-assistant-chat__message { max-width: 96%; }
}
</style>
