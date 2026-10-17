<script setup lang="ts">
import type { BsReceiptView, BsReceiptDocumentCopy, BsReceiptPageCopy } from '../types/receiptPresentation'
defineProps<{
  receipt: BsReceiptView | null
  copy: BsReceiptPageCopy
  documentCopy: BsReceiptDocumentCopy
  backTo: string
  languageOptions: { value: string; label: string }[]
  paperOptions: { value: string; label: string }[]
  printed: boolean
  sharing: boolean
  shareError: string
  loading: boolean
  error: boolean
}>()
const language = defineModel<string>('language', { required: true })
const paperSize = defineModel<string>('paperSize', { required: true })
const emit = defineEmits<{ print: []; share: []; download: []; retry: [] }>()
</script>
<template>
  <BsPage>
    <BsPageHeader :title="documentCopy.title" :subtitle="receipt?.invoice" />
    <BsPrintActions :back-to="backTo" :back-label="copy.back" :print-label="copy.print" :disabled="!receipt" @print="emit('print')">
      <BsChoiceGroup v-model="language" type="radio" inline :legend="copy.language" :options="languageOptions"/>
      <BsField v-slot="field" :label="copy.paperSize"><BsSelect v-model="paperSize" :input-id="field.id" :aria-describedby="field.describedby" :label="copy.paperSize" :options="paperOptions" option-label="label" option-value="value"/></BsField>
      <BsButton variant="secondary" :pending="sharing" :disabled="!receipt" @click="emit('share')">{{ copy.share }}</BsButton>
    </BsPrintActions>
    <BsAlert v-if="shareError" tone="error">{{ shareError }} <BsButton variant="secondary" :pending="sharing" @click="emit('download')">{{ copy.download }}</BsButton></BsAlert>
    <BsStateSurface v-if="loading" state="loading" :title="copy.loading"/>
    <BsStateSurface v-else-if="error" state="error" :title="copy.loadError" :action-label="copy.retry" @action="emit('retry')"/>
    <BsStateSurface v-else-if="!receipt" state="empty" :title="copy.unavailable"/>
    <BsPrintableDocument v-else class="bs-receipt-preview" :format="paperSize === 'thermal_80' ? 'receipt' : 'a4'" :label="documentCopy.title" :dir="receipt.direction || (language === 'ar' ? 'rtl' : 'ltr')" :lang="language">
      <BsSaleReceipt :receipt="receipt" :copy="documentCopy" :language="language" :printed="printed" />
    </BsPrintableDocument>
  </BsPage>
</template>
