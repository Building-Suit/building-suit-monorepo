<script setup lang="ts">
import { nextTick, onMounted, ref, useId, watch } from 'vue'
import BsAssistantChat from './BsAssistantChat.vue'
import type { BsShellAssistantChat } from '../types/assistantChatPresentation'

const props = defineProps<{ assistant: BsShellAssistantChat }>()
const draft = defineModel<string>('draft', { required: true })
const emit = defineEmits<{
  open: []
  close: []
  send: []
  confirm: []
  discard: []
  authorize: [enabled: boolean]
  loadEarlier: []
}>()

const panelId = useId()
const titleId = useId()
const heading = ref<HTMLElement | null>(null)
const launcher = ref<HTMLElement | null>(null)
const renderChat = ref(false)
const { open, trigger, close, onKeydown } = useNavigationDisclosure()

function focusPanel() {
  heading.value?.focus({ preventScroll: true })
}

async function openPanel() {
  if (open.value) {
    focusPanel()
    return
  }

  renderChat.value = true
  open.value = true
  await nextTick()
  if (open.value) focusPanel()
}

function finishClosing() {
  if (!open.value) renderChat.value = false
}

function handleEscape(event: KeyboardEvent) {
  if (event.defaultPrevented || event.isComposing || event.key !== 'Escape') return
  event.stopPropagation()
  onKeydown(event)
}

watch(launcher, element => { trigger.value = element?.querySelector('button') ?? null }, { flush: 'post' })
watch(open, shown => { if (shown) emit('open'); else emit('close') })
watch(() => props.assistant.openRequest, request => { if (request) void openPanel() })
onMounted(() => { if (props.assistant.openRequest) void openPanel() })
</script>

<template>
  <div class="bs-floating-assistant">
    <div v-show="!open" ref="launcher">
      <BsButton
        class="bs-floating-assistant__launcher"
        variant="primary"
        :aria-label="assistant.launcherLabel"
        :title="assistant.launcherLabel"
        :aria-controls="panelId"
        :aria-expanded="open"
        @click="openPanel"
      >
        <BsIcon name="chat" :size="23" />
      </BsButton>
    </div>
    <Transition name="bs-floating-assistant-panel" @after-leave="finishClosing">
      <section
        v-show="open"
        :id="panelId"
        class="bs-floating-assistant__panel"
        :aria-labelledby="titleId"
        :inert="!open"
        @keydown="handleEscape"
      >
        <header class="bs-floating-assistant__header">
          <div class="bs-floating-assistant__title">
            <h2 :id="titleId" ref="heading" tabindex="-1">{{ assistant.copy.title }}</h2>
            <p v-if="assistant.view.context.length">
              <template v-for="(item, index) in assistant.view.context" :key="item.label">
                <span v-if="index" aria-hidden="true"> · </span><bdi>{{ item.value }}</bdi>
              </template>
            </p>
          </div>
          <BsButton
            variant="icon"
            :aria-label="assistant.closeLabel"
            :title="assistant.closeLabel"
            @click="close(true)"
          >
            <BsIcon name="close" :size="20" />
          </BsButton>
          <BsButton
            v-if="assistant.view.state === 'ready' && assistant.view.delegation?.enabled"
            data-assistant-revoke
            class="bs-floating-assistant__revoke"
            variant="text"
            size="sm"
            :pending="assistant.view.pending === 'access'"
            @click="emit('authorize', false)"
          >
            {{ assistant.view.delegation.disable }}
          </BsButton>
        </header>
        <div class="bs-floating-assistant__content">
          <BsAssistantChat
            v-if="renderChat"
            v-model:draft="draft"
            :copy="assistant.copy"
            :view="assistant.view"
            :maximum-length="assistant.maximumLength"
            compact
            @send="emit('send')"
            @confirm="emit('confirm')"
            @discard="emit('discard')"
            @authorize="emit('authorize', $event)"
            @load-earlier="emit('loadEarlier')"
          />
        </div>
      </section>
    </Transition>
  </div>
</template>

<style scoped>
.bs-floating-assistant {
  position: fixed;
  display: grid;
  align-items: end;
  justify-items: end;
  inset-inline-end: var(--bs-space-4);
  inset-block-end: calc(5rem + env(safe-area-inset-bottom));
  z-index: 40;
  width: max-content;
  max-width: calc(100% - 2 * var(--bs-space-4));
}

.bs-floating-assistant > * { grid-area: 1 / 1; }

.bs-floating-assistant__launcher {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  inline-size: calc(var(--bs-tap-target-min) + var(--bs-space-2));
  block-size: calc(var(--bs-tap-target-min) + var(--bs-space-2));
  padding: 0;
  border-radius: var(--bs-radius-full);
  box-shadow: var(--bs-elevation-2);
}

.bs-floating-assistant__panel {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  width: min(26rem, calc(100vw - 2 * var(--bs-space-4)));
  max-height: min(42rem, calc(100dvh - 6rem - env(safe-area-inset-bottom)));
  background: var(--bs-surface);
  border: 1px solid var(--bs-border);
  border-radius: var(--bs-radius-card);
  box-shadow: var(--bs-elevation-3);
  overflow: hidden;
}

@media (prefers-reduced-motion: no-preference) {
  .bs-floating-assistant-panel-enter-active,
  .bs-floating-assistant-panel-leave-active {
    transition: opacity var(--bs-motion-default), transform var(--bs-motion-default);
  }

  .bs-floating-assistant-panel-leave-active { pointer-events: none; }

  .bs-floating-assistant-panel-enter-from,
  .bs-floating-assistant-panel-leave-to {
    opacity: 0;
    transform: translateY(var(--bs-space-2));
  }
}

.bs-floating-assistant__header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: var(--bs-space-1) var(--bs-space-2);
  padding: var(--bs-space-3);
  border-block-end: 1px solid var(--bs-border);
}

.bs-floating-assistant__title {
  min-width: 0;
  align-self: center;
  overflow-wrap: anywhere;
}

.bs-floating-assistant__title h2 {
  width: fit-content;
  font-size: 1rem;
  font-weight: var(--bs-weight-semibold);
  margin: 0;
}

.bs-floating-assistant__title h2:focus-visible {
  outline: var(--bs-focus-ring-style);
  outline-offset: var(--bs-focus-ring-offset);
}

.bs-floating-assistant__title p {
  color: var(--bs-text-muted);
  font-size: .8125rem;
  margin: 0;
}

.bs-floating-assistant__revoke { justify-self: start; }

.bs-floating-assistant__content {
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
}
</style>
