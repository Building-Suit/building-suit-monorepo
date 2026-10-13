<script setup lang="ts">
import Dialog from 'primevue/dialog'
import { interactionPolicy } from '@building-suit/ux'
defineOptions({ inheritAttrs: false })
const visible = defineModel<boolean>('visible', { default: false })
const props = withDefaults(defineProps<{ title: string; dirty?: boolean; pending?: boolean; size?: 'sm' | 'md' | 'lg' }>(), { dirty: false, pending: false, size: 'md' })
const ui = useUiCopy()
const slots = useSlots()
const { confirmDiscard, discardPrompt, requestClose, discard, handleKeydown } = useDialogInteraction(props, visible)
</script>
<template>
  <Dialog v-bind="$attrs" :visible="visible" :header="title" modal :draggable="false" :closable="!pending" :close-on-escape="interactionPolicy.closeOnEscape && !pending" :dismissable-mask="interactionPolicy.dismissableMask" :aria-busy="pending" :style="{ width: size === 'lg' ? '64rem' : size === 'sm' ? '28rem' : '42rem', maxWidth: 'calc(100vw - 2rem)' }" :pt="{ root: { class: 'ls-card flex max-h-[90dvh] flex-col shadow-overlay' }, mask: { class: 'ls-scrim' }, header: { class: 'flex items-center justify-between gap-4 border-b border-line p-5' }, title: { class: 'text-lg font-bold' }, content: { class: 'overflow-y-auto p-5' }, footer: { class: 'flex justify-end gap-3 border-t border-line p-5' }, pcCloseButton: { root: { class: 'ls-btn ls-btn-sm' } } }" :close-button-props="{ 'aria-label': ui('close') }" @keydown.capture="handleKeydown" @update:visible="requestClose">
    <div v-if="confirmDiscard" ref="discardPrompt" role="alert" aria-live="assertive" class="bs-dialog__discard">
      <BsText>{{ ui('discard') }}</BsText>
      <BsFormActions align="start" :stack-on-mobile="false">
        <BsButton type="button" autofocus @click="confirmDiscard = false">{{ ui('cancel') }}</BsButton>
        <BsButton type="button" variant="primary" @click="discard">{{ ui('confirm') }}</BsButton>
      </BsFormActions>
    </div>
    <slot :close="() => requestClose(false)" />
    <template v-if="slots.footer" #footer><slot name="footer" :close="() => requestClose(false)" /></template>
  </Dialog>
</template>

<style>
.bs-dialog__discard { display: grid; margin-bottom: var(--bs-space-4); padding: var(--bs-space-4); gap: var(--bs-space-3); border: 1px solid var(--bs-status-warning); border-radius: var(--bs-radius-button); }
</style>
