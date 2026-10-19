<script setup lang="ts">
import { useElementPrint } from '@building-suit/ux'
import type { BsReceiptPreview } from '../types/receiptPresentation'
const props = defineProps<{ view: BsReceiptPreview }>()
const visible = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ language: [value: string | number | (string | number)[]]; paper: [value: string]; select: [id: string]; recent: []; retry: []; share: []; download: []; printed: [] }>()
const document = ref<HTMLElement | null>(null)
const printer = useElementPrint(() => document.value)
async function print() { if (props.view.receipt && await printer.print()) emit('printed') }
</script>
<template>
  <BsDialog v-model:visible="visible" :title="view.recent?.active ? view.recent.title : view.documentCopy.title" :pending="printer.pending.value" size="md">
    <BsStack v-if="view.recent?.active">
      <BsText size="sm" tone="muted">{{ view.recent.hint }}</BsText>
      <BsStateSurface v-if="view.recent.loading" state="loading" :title="view.copy.loading" />
      <BsStateSurface v-else-if="view.recent.error" state="error" :title="view.copy.loadError" :action-label="view.copy.retry" @action="emit('retry')" />
      <BsStateSurface v-else-if="!view.recent.items.length" state="empty" :title="view.recent.empty" />
      <ul v-else class="bs-pos-receipt-list"><li v-for="item in view.recent.items" :key="item.id"><BsButton variant="tile" :aria-label="`${view.recent.openLabel}: ${item.number}`" @click="emit('select', item.id)"><BsIcon name="invoice" /><span><strong>{{ item.number }}</strong><small>{{ item.issued }}</small></span><strong>{{ item.total }}</strong><BsIcon name="arrowRight" directional /></BsButton></li></ul>
    </BsStack>
    <BsStack v-else>
      <BsChoiceGroup :model-value="view.language" type="radio" inline :legend="view.copy.language" :options="view.languageOptions" :disabled="printer.pending.value" @update:model-value="emit('language', $event)" />
      <BsField v-slot="field" :label="view.copy.paperSize"><BsSelect :model-value="view.paperSize" :input-id="field.id" :aria-describedby="field.describedby" :label="view.copy.paperSize" :options="view.paperOptions" option-label="label" option-value="value" :disabled="printer.pending.value" @update:model-value="emit('paper', String($event))" /></BsField>
      <BsStateSurface v-if="view.loading" state="loading" :title="view.copy.loading" />
      <BsStateSurface v-else-if="view.error" state="error" :title="view.copy.loadError" :action-label="view.copy.retry" @action="emit('retry')" />
      <BsStateSurface v-else-if="!view.receipt" state="empty" :title="view.copy.unavailable" />
      <div v-else class="bs-pos-receipt-preview"><div ref="document" :style="{ width: view.paperSize === 'a4' ? '210mm' : '80mm' }" :aria-label="view.documentCopy.title" :lang="view.language" :dir="view.receipt.direction || (view.language === 'ar' ? 'rtl' : 'ltr')"><BsSaleReceipt :receipt="view.receipt" :copy="view.documentCopy" :language="view.language" :printed="view.printed" /></div></div>
      <BsAlert v-if="view.shareError" tone="error">{{ view.shareError }}<BsButton :pending="view.sharing" @click="emit('download')">{{ view.copy.download }}</BsButton></BsAlert>
    </BsStack>
    <template #footer="{ close }"><BsFormActions align="end"><BsButton :disabled="printer.pending.value" @click="close">{{ view.copy.back }}</BsButton><BsButton v-if="view.recent && !view.recent.active" @click="emit('recent')">{{ view.recent.backLabel }}</BsButton><BsButton v-if="!view.recent?.active" :disabled="!view.receipt || view.loading || view.error" :pending="view.sharing" @click="emit('share')">{{ view.copy.share }}</BsButton><BsButton v-if="!view.recent?.active" variant="primary" :disabled="!view.receipt || view.loading || view.error" :pending="printer.pending.value" @click="print"><BsIcon name="invoice" :size="18" />{{ view.copy.print }}</BsButton></BsFormActions></template>
  </BsDialog>
</template>
<style scoped>
.bs-pos-receipt-preview { overflow-x: auto; padding: var(--bs-space-4); background: var(--bs-surface-muted); border-radius: var(--bs-radius-card); }
.bs-pos-receipt-preview > div { inline-size: 80mm; max-inline-size: 100%; margin-inline: auto; }
.bs-pos-receipt-list { list-style: none; display: grid; gap: var(--bs-space-2); padding: 0; margin: 0; }
.bs-pos-receipt-list :deep(button) { display: flex; align-items: center; gap: var(--bs-space-3); inline-size: 100%; padding: var(--bs-space-4); text-align: start; border: 1px solid var(--bs-border); border-radius: var(--bs-radius-button); }
.bs-pos-receipt-list span { display: grid; flex: 1; gap: var(--bs-space-1); min-inline-size: 0; overflow-wrap: anywhere; }
.bs-pos-receipt-list small { color: var(--bs-text-muted); }
</style>
