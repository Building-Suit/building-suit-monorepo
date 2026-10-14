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
const emit = defineEmits<{ print: []; share: []; retry: [] }>()
</script>
<template>
  <BsPage>
    <BsPageHeader :title="documentCopy.title" :subtitle="receipt?.invoice" />
    <BsPrintActions :back-to="backTo" :back-label="copy.back" :print-label="copy.print" :disabled="!receipt" @print="emit('print')">
      <BsChoiceGroup v-model="language" type="radio" inline :legend="copy.language" :options="languageOptions"/>
      <BsField v-slot="field" :label="copy.paperSize"><BsSelect v-model="paperSize" :input-id="field.id" :aria-describedby="field.describedby" :label="copy.paperSize" :options="paperOptions" option-label="label" option-value="value"/></BsField>
      <BsButton variant="secondary" :pending="sharing" :disabled="!receipt" @click="emit('share')">{{ copy.share }}</BsButton>
    </BsPrintActions>
    <BsAlert v-if="shareError" tone="error">{{ shareError }}</BsAlert>
    <BsStateSurface v-if="loading" state="loading" :title="copy.loading"/>
    <BsStateSurface v-else-if="error" state="error" :title="copy.loadError" :action-label="copy.retry" @action="emit('retry')"/>
    <BsStateSurface v-else-if="!receipt" state="empty" :title="copy.unavailable"/>
    <BsPrintableDocument v-else :format="paperSize === 'thermal_80' ? 'receipt' : 'a4'" :label="documentCopy.title" :dir="language === 'ar' ? 'rtl' : 'ltr'" :lang="language">
      <template #header>
        <BsDocumentHeader :title="documentCopy.title" :issuer="receipt.issuer" :details="receipt.issuerDetails"><BsText v-if="printed" emphasis="bold">{{ documentCopy.reprintLabel }}</BsText></BsDocumentHeader>
      </template>
      <BsDescriptionList density="compact">
        <BsDescriptionItem :term="documentCopy.invoice"><BsText dir="ltr">{{ receipt.invoice }}</BsText></BsDescriptionItem>
        <BsDescriptionItem :term="documentCopy.date">{{ receipt.issued }}</BsDescriptionItem>
        <BsDescriptionItem :term="documentCopy.location">{{ receipt.location.name }}<BsText v-if="receipt.location.code" as="span" dir="ltr"> · {{ receipt.location.code }}</BsText></BsDescriptionItem>
        <BsDescriptionItem v-if="receipt.location.address" :term="documentCopy.address">{{ receipt.location.address }}</BsDescriptionItem>
        <BsDescriptionItem v-if="receipt.location.phone" :term="documentCopy.phone"><BsText dir="ltr">{{ receipt.location.phone }}</BsText></BsDescriptionItem>
        <BsDescriptionItem :term="documentCopy.staff">{{ receipt.staff }}</BsDescriptionItem>
        <BsDescriptionItem :term="documentCopy.customer">{{ receipt.customer }}</BsDescriptionItem>
      </BsDescriptionList>
      <BsDocumentLines :label="documentCopy.items" :item-label="documentCopy.item" :quantity-label="documentCopy.quantity" :price-label="documentCopy.unitPrice" :total-label="documentCopy.lineTotal" :lines="receipt.lines"/>
      <BsDocumentTotals :label="documentCopy.total" :totals="receipt.totals"/>
      <BsContentSection :title="documentCopy.payment">
        <BsInline v-for="payment in receipt.payments" :key="payment.id" justify="between"><BsText>{{ payment.summary }}</BsText><BsText v-if="payment.reference" dir="ltr">{{ payment.reference }}</BsText></BsInline>
      </BsContentSection>
      <template #footer><BsText v-if="receipt.footer" wrap="preserve">{{ receipt.footer }}</BsText><BsText size="xs">{{ documentCopy.compliance }}</BsText></template>
    </BsPrintableDocument>
  </BsPage>
</template>
