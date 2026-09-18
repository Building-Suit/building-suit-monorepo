<script setup lang="ts">
import Dialog from 'primevue/dialog'
import { interactionPolicy } from '@building-suit/ux'
defineOptions({ inheritAttrs: false })
const visible = defineModel<boolean>('visible', { default: false })
const props = withDefaults(defineProps<{ title: string; dirty?: boolean; pending?: boolean; size?: 'sm' | 'md' | 'lg' }>(), { dirty: false, pending: false, size: 'md' })
const ui = useUiCopy()
const confirmDiscard = ref(false)
const slots = useSlots()
function requestClose(value: boolean) {
  if (value || props.pending) return
  if (props.dirty && interactionPolicy.protectDirtyForms) confirmDiscard.value = true
  else visible.value = false
}
function discard() { confirmDiscard.value = false; visible.value = false }
watch(visible, value => { if (!value) confirmDiscard.value = false })
</script>
<template>
  <Dialog :visible="visible" :header="title" modal :draggable="false" :closable="!pending" :close-on-escape="interactionPolicy.closeOnEscape && !pending" :dismissable-mask="interactionPolicy.dismissableMask" :style="{ width: size === 'lg' ? '64rem' : size === 'sm' ? '28rem' : '42rem', maxWidth: 'calc(100vw - 2rem)' }" :pt="{ root: { class: 'ls-card flex max-h-[90dvh] flex-col shadow-overlay' }, mask: { class: 'ls-scrim' }, header: { class: 'flex items-center justify-between gap-4 border-b border-line p-5' }, title: { class: 'text-lg font-bold' }, content: { class: 'overflow-y-auto p-5' }, footer: { class: 'flex justify-end gap-3 border-t border-line p-5' }, pcCloseButton: { root: { class: 'ls-btn ls-btn-sm' } } }" :close-button-props="{ 'aria-label': ui('close') }" v-bind="$attrs" @update:visible="requestClose">
    <div v-if="confirmDiscard" role="alert" class="mb-4 rounded-control border border-warning p-4"><p>{{ ui('discard') }}</p><div class="mt-3 flex gap-2"><button type="button" class="ls-btn" @click="confirmDiscard = false">{{ ui('cancel') }}</button><button type="button" class="ls-btn ls-btn-primary" @click="discard">{{ ui('confirm') }}</button></div></div>
    <slot :close="() => requestClose(false)" />
    <template v-if="slots.footer" #footer><slot name="footer" :close="() => requestClose(false)" /></template>
  </Dialog>
</template>
