<script setup lang="ts">
import { nextTick, ref } from 'vue'
import BsAssistantChat from '../organisms/BsAssistantChat.vue'
import type { BsAssistantChatCopy, BsAssistantChatView } from '../types/assistantChatPresentation'

defineProps<{ copy: BsAssistantChatCopy; view: BsAssistantChatView; maximumLength: number; preview?: boolean }>()
const draft = defineModel<string>('draft', { required: true })
const emit = defineEmits<{ send: []; reset: []; confirm: []; discard: []; authorize: [enabled: boolean] }>()
const chat = ref<InstanceType<typeof BsAssistantChat> | null>(null)

async function resetConversation() {
  emit('reset')
  await nextTick()
  chat.value?.focusComposer()
}
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
    <BsAssistantChat
      ref="chat"
      v-model:draft="draft"
      :copy="copy"
      :view="view"
      :maximum-length="maximumLength"
      :preview="preview"
      @send="emit('send')"
      @confirm="emit('confirm')"
      @discard="emit('discard')"
      @authorize="emit('authorize', $event)"
    />
  </BsPage>
</template>
