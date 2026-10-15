<script setup lang="ts">
import type { BsReturnForm, BsRefundRecordForm, BsDocumentReturnsCopy, BsDocumentReturnsView } from '../types/documentReturns'
defineProps<{ copy: BsDocumentReturnsCopy; view: BsDocumentReturnsView }>()
const form = defineModel<BsReturnForm>('form', { required: true })
const recordForm = defineModel<BsRefundRecordForm>('recordForm', { required: true })
const open = defineModel<boolean>('open', { required: true })
const recordOpen = defineModel<boolean>('recordOpen', { required: true })
const emit = defineEmits<{ start: []; retry: []; preview: []; confirm: []; record: [id: string]; complete: []; fail: []; previous: []; next: [] }>()
function quantity(id: string, value: unknown) { form.value = { ...form.value, quantities: { ...form.value.quantities, [id]: Number(value) } } }
function disposition(id: string, value: unknown) { form.value = { ...form.value, dispositions: { ...form.value.dispositions, [id]: String(value) } } }
</script>
<template>
  <BsPanel padding="md">
    <BsInline justify="between"><BsHeading :level="2">{{ copy.title }}</BsHeading><BsButton v-if="view.canReturn" :disabled="!view.online || view.loading || view.pending" @click="emit('start')">{{ copy.action }}</BsButton></BsInline>
    <BsText v-if="view.loading" as="p" role="status">{{ copy.loading }}</BsText>
    <BsBox v-else-if="view.error" role="alert"><BsText as="p">{{ copy.loadError }}</BsText><BsButton @click="emit('retry')">{{ copy.retry }}</BsButton></BsBox>
    <template v-else>
      <BsText v-if="!view.supported" as="p" tone="warning">{{ copy.unsupported }}</BsText>
      <BsText v-if="!view.online" as="p" role="status">{{ copy.offline }}</BsText>
      <BsText as="p" size="sm" tone="muted">{{ copy.policy }}</BsText>
      <BsHeading :level="3">{{ copy.history }}</BsHeading>
      <BsText v-if="!view.history.length" as="p" tone="muted">{{ copy.empty }}</BsText>
      <BsStack v-for="entry in view.history" :key="entry.id" gap="sm">
        <BsText as="p" emphasis="semibold">{{ entry.title }}</BsText><BsText as="p" size="sm">{{ entry.detail }}</BsText><BsText as="p" size="sm">{{ entry.reason }}</BsText><BsText as="p" size="xs" tone="muted">{{ entry.actor }}</BsText>
        <BsText v-for="line in entry.lines" :key="line.id" as="p" size="sm">{{ line.label }}</BsText>
        <BsBox v-for="refund in entry.refunds" :key="refund.id">
          <BsInline justify="between"><BsText as="p">{{ refund.label }}</BsText><BsButton v-if="refund.canRecord" :disabled="!view.online" @click="emit('record', refund.id)">{{ refund.cash ? copy.cash : copy.external }}</BsButton></BsInline>
          <BsText v-for="event in refund.events" :key="event.id" as="p" size="xs" tone="muted">{{ event.label }}</BsText>
        </BsBox>
        <BsDivider />
      </BsStack>
      <BsInline v-if="view.hasPrevious || view.hasNext"><BsButton :disabled="!view.hasPrevious || view.loading" @click="emit('previous')">{{ copy.previous }}</BsButton><BsButton :disabled="!view.hasNext || view.loading" @click="emit('next')">{{ copy.next }}</BsButton></BsInline>
    </template>
  </BsPanel>
  <BsRecordActionDialog v-model:visible="open" :title="copy.action" :dirty="view.dirty" :pending="view.pending" :error="view.actionError" :submit-label="view.preview ? copy.confirm : copy.preview" :cancel-label="copy.cancel" :submit-disabled="!view.online" size="lg" @submit="view.preview ? emit('confirm') : emit('preview')">
    <BsText as="p" size="sm">{{ copy.policy }}</BsText>
    <BsText v-if="view.locked" as="p" role="status">{{ copy.uncertain }}</BsText>
    <BsStack v-for="line in view.lines" :key="line.id" gap="sm">
      <BsText as="p" emphasis="semibold">{{ line.name }} · {{ copy.remaining }}: {{ line.remaining }}</BsText>
      <BsField v-slot="field" :label="copy.quantity"><BsInput :id="field.id" :model-value="form.quantities[line.id] ?? 0" :disabled="view.locked" type="number" min="0" :max="line.remaining" step="0.01" @update:model-value="quantity(line.id, $event)" /></BsField>
      <BsField v-if="!line.service" v-slot="field" :label="copy.disposition"><BsSelect :input-id="field.id" :label="copy.disposition" :disabled="view.locked" :model-value="form.dispositions[line.id] ?? 'resellable'" :options="[{ value: 'resellable', label: copy.resellable }, { value: 'damaged', label: copy.damaged }]" option-label="label" option-value="value" @update:model-value="disposition(line.id, $event)" /></BsField>
      <BsText v-else as="p" size="sm" tone="muted">{{ copy.service }}</BsText>
    </BsStack>
    <BsField v-slot="field" :label="copy.reason"><BsTextarea :id="field.id" :model-value="form.reason" :disabled="view.locked" minlength="2" maxlength="1000" required @update:model-value="form = { ...form, reason: String($event ?? '') }" /></BsField>
    <BsDescriptionList v-if="view.preview"><BsDescriptionItem :term="copy.total">{{ view.preview.total }}</BsDescriptionItem><BsDescriptionItem :term="copy.debt">{{ view.preview.debt }}</BsDescriptionItem><BsDescriptionItem :term="copy.refund">{{ view.preview.refund }}</BsDescriptionItem><BsDescriptionItem :term="copy.due">{{ view.preview.due }}</BsDescriptionItem></BsDescriptionList>
    <BsBox v-if="view.preview?.allocations.length"><BsHeading :level="3">{{ copy.allocations }}</BsHeading><BsText v-for="allocation in view.preview.allocations" :key="allocation.id" as="p">{{ allocation.label }} · {{ allocation.amount }}</BsText></BsBox>
  </BsRecordActionDialog>
  <BsRecordActionDialog v-model:visible="recordOpen" :title="view.record.title" :dirty="view.record.dirty" :pending="view.record.pending" :error="view.record.error" :submit-label="copy.record" :cancel-label="copy.cancel" :submit-disabled="!view.online" @submit="emit('complete')">
    <BsText as="p" size="sm">{{ copy.recordNotice }}</BsText>
    <BsField v-slot="field" :label="copy.reference"><BsInput :id="field.id" v-model="recordForm.reference" :disabled="view.record.locked" :required="!view.record.cash" :minlength="view.record.cash ? 0 : 2" maxlength="200" /></BsField>
    <BsField v-slot="field" :label="copy.reason"><BsTextarea :id="field.id" v-model="recordForm.reason" :disabled="view.record.locked" minlength="2" maxlength="1000" required /></BsField>
    <BsButton :disabled="!view.online || view.record.pending || view.record.locked" severity="secondary" @click="emit('fail')">{{ copy.failed }}</BsButton>
  </BsRecordActionDialog>
</template>
