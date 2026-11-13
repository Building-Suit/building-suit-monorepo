<script setup lang="ts">
import { computed } from 'vue'
import type { BsPracticeMoneyLabel, BsPracticeMoneyForm, BsPracticeMoneyView, BsPracticeMoneyRow } from '../utils/practiceMoneyPresentation'
const props = defineProps<{ copy: Record<BsPracticeMoneyLabel, string>; view: BsPracticeMoneyView }>()
const form = defineModel<BsPracticeMoneyForm>('form', { required: true })
const emit = defineEmits<{ refresh: []; retry: []; collect: []; refund: [entryId: string]; advance: [id: string, revision: number, action: 'dispatch' | 'reconcile' | 'cancel', outcome: 'accepted' | 'rejected' | null]; save: []; visible: [value: boolean]; page: [value: number] }>()
const columns = computed(() => [{ key: 'kind', field: 'kind', header: props.copy.kind }, { key: 'state', field: 'state', header: props.copy.status }, { key: 'amount', field: 'amount', header: props.copy.amount }, { key: 'receipt', field: 'receipt', header: props.copy.receipt }, { key: 'original', field: 'original', header: props.copy.original }, { key: 'reason', field: 'reason', header: props.copy.reason }, { key: 'recorded', field: 'recorded', header: props.copy.recorded }, { key: 'actions', header: props.copy.history }])
function advance(row: BsPracticeMoneyRow, action: 'dispatch' | 'reconcile' | 'cancel', outcome: 'accepted' | 'rejected' | null) { emit('advance', row.id, row.revision, action, outcome) }
</script>
<template>
 <BsStack gap="lg">
  <BsPageHeader :title="copy.title" :subtitle="view.source"><template #actions><BsButton :disabled="view.pending || view.loading" @click="emit('refresh')">{{ copy.refresh }}</BsButton></template></BsPageHeader>
  <BsText>{{ view.clinic }}</BsText>
  <BsAlert tone="info" :description="copy.notice" />
  <BsAlert v-if="view.uncertain" tone="warning" :description="copy.unknown" /><BsButton v-if="view.uncertain" :disabled="view.pending || view.loading" @click="emit('retry')">{{ copy.retry }}</BsButton>
  <BsAlert v-if="view.error" tone="error" :description="view.error" />
  <BsStateSurface v-if="view.denied" state="permission" :title="copy.denied" />
  <BsStateSurface v-else-if="view.loading" state="loading" :title="copy.loading" />
  <template v-else-if="view.ready">
   <BsAlert v-if="view.readonly" tone="info" :description="copy.readonly" />
   <BsDescriptionList :columns="2"><BsDescriptionItem v-for="item in [{ label: copy.charge, value: view.charge }, { label: copy.collected, value: view.collected }, { label: copy.refunded, value: view.refunded }, { label: copy.net, value: view.net }, { label: copy.reserved, value: view.reserved }, { label: copy.refundReserved, value: view.refundReserved }, { label: copy.available, value: view.available }]" :key="item.label" :term="item.label"><BsText as="bdi" dir="ltr">{{ item.value }}</BsText></BsDescriptionItem></BsDescriptionList>
   <BsText>{{ copy.balanceHelp }}</BsText>
   <BsButton v-if="view.canCollect" :disabled="view.blocked" @click="emit('collect')">{{ copy.prepareCollection }}</BsButton>
   <BsDataTable :value="view.rows" :columns="columns" row-key="id" :label="copy.history">
    <template #cell-amount="{ row }"><BsText as="bdi" dir="ltr">{{ row.amount }}</BsText></template>
    <template #cell-actions="{ row }"><BsInline wrap>
     <BsButton v-if="row.dispatch" :disabled="view.blocked" @click="advance(row, 'dispatch', 'accepted')">{{ copy.accept }}</BsButton>
     <BsButton v-if="row.dispatch" :disabled="view.blocked" @click="advance(row, 'dispatch', 'rejected')">{{ copy.reject }}</BsButton>
     <BsButton v-if="row.reconcile" :disabled="view.blocked" @click="advance(row, 'reconcile', null)">{{ copy.reconcile }}</BsButton>
     <BsButton v-if="row.cancel" :disabled="view.blocked" @click="advance(row, 'cancel', null)">{{ copy.cancelPending }}</BsButton>
     <BsButton v-if="row.refundable && row.originalEntryId" :disabled="view.blocked" @click="emit('refund', row.originalEntryId)">{{ copy.refund }}</BsButton>
    </BsInline></template>
    <template #empty><BsEmptyState :title="copy.empty" /></template>
   </BsDataTable>
   <BsInline wrap><BsButton :disabled="!view.previous || view.loading || view.pending" @click="emit('page', view.page - 1)">{{ copy.previous }}</BsButton><BsText>{{ view.page }}</BsText><BsButton :disabled="!view.next || view.loading || view.pending" @click="emit('page', view.page + 1)">{{ copy.next }}</BsButton></BsInline>
  </template>
  <BsRecordActionDialog :visible="view.editor.visible" :title="view.editor.title" :dirty="view.editor.dirty" :pending="view.pending" :error="view.editor.review ? copy.review : view.error" :submit-disabled="view.editor.disabled" :submit-label="copy.save" :cancel-label="copy.cancel" @update:visible="emit('visible', $event)" @submit="emit('save')">
   <BsText v-if="view.editor.original">{{ copy.original }} · {{ view.editor.original }}</BsText>
   <BsField v-slot="field" :label="copy.amount" required><BsInput :id="field.id" v-model="form.amount" :disabled="view.uncertain" required inputmode="decimal" /></BsField>
   <BsField v-slot="field" :label="copy.reason" required><BsTextarea :id="field.id" v-model="form.reason" :disabled="view.uncertain" required minlength="2" maxlength="500" /></BsField>
   <BsAlert v-if="view.uncertain" tone="warning" :description="copy.unknown" /><BsButton v-if="view.uncertain" :disabled="view.pending" @click="emit('retry')">{{ copy.retry }}</BsButton>
  </BsRecordActionDialog>
  <BsInline wrap><BsLink to="/practice-billing">{{ copy.billing }}</BsLink><BsLink to="/account">{{ copy.account }}</BsLink></BsInline>
 </BsStack>
</template>
