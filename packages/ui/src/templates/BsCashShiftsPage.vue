<script setup lang="ts">
import type { BsCashShiftActiveView, BsCashShiftHistoryRow, BsCashShiftAmountForm, BsCashShiftMovementForm, BsCashShiftEditor, BsCashShiftCopy } from '../types/cashShiftPresentation'
defineProps<{
  copy: BsCashShiftCopy; contextAvailable: boolean; shopLoading: boolean; locationName: string | null
  pending: boolean; error: boolean; active: BsCashShiftActiveView | null; canAdjust: boolean; canClose: boolean; canManage: boolean
  historyRows: BsCashShiftHistoryRow[]; cashierOptions: { id: string; name: string }[]; page: number; pageSize: number; total: number
  actionError: string; expectedCash: string; openEditor: BsCashShiftEditor; movementEditor: BsCashShiftEditor; closeEditor: BsCashShiftEditor
  movementOptions: { value: string; label: string }[]
}>()
const cashierId = defineModel<string | null>('cashier', { required: true })
const openForm = defineModel<BsCashShiftAmountForm>('openForm', { required: true })
const movementForm = defineModel<BsCashShiftMovementForm>('movementForm', { required: true })
const closeForm = defineModel<BsCashShiftAmountForm>('closeForm', { required: true })
const showOpen = defineModel<boolean>('openVisible', { required: true })
const showMovement = defineModel<boolean>('movementVisible', { required: true })
const showClose = defineModel<boolean>('closeVisible', { required: true })
const emit = defineEmits<{ retry: []; open: []; movement: []; close: []; saveOpen: []; saveMovement: []; saveClose: []; page: [page: number] }>()
function updateOpen(key: keyof BsCashShiftAmountForm, value: string | number) { openForm.value = { ...openForm.value, [key]: key === 'amount' ? Number(value) : String(value) } }
function updateClose(key: keyof BsCashShiftAmountForm, value: string | number) { closeForm.value = { ...closeForm.value, [key]: key === 'amount' ? Number(value) : String(value) } }
function updateMovement(key: keyof BsCashShiftMovementForm, value: string | number | boolean) { movementForm.value = { ...movementForm.value, [key]: key === 'amount' ? Number(value) : String(value) } }
</script>
<template>
  <BsStack gap="lg">
    <BsPageHeader  :title="copy.title" :subtitle="copy.subtitle">
      <template #actions>
        <BsText v-if="locationName" as="p" size="sm">
          <BsText as="strong">{{ copy.branch }}:</BsText> {{ locationName }}</BsText>
      </template>
    </BsPageHeader>
    <BsText v-if="!contextAvailable && !shopLoading" as="p" size="sm">{{ copy.noShop }}</BsText>
    <BsText v-else-if="!locationName && !shopLoading" as="p" size="sm">{{ copy.noLocation }}</BsText>
    <BsStack v-else-if="contextAvailable">
      <BsBox v-if="error" role="alert" padding="md">
        <BsText as="p">{{ copy.loadError }}</BsText>
        <BsButton severity="secondary" @click="emit('retry')">{{ copy.retry }}</BsButton>
      </BsBox>
      <BsGrid v-else-if="pending" :aria-label="copy.loading" role="status" :columns="4">
        <BsSkeleton v-for="index in 4" :key="index"/>
      </BsGrid>
      <template v-else>
        <BsPanel aria-labelledby="active-shift-heading" padding="md">
          <BsInline justify="between">
            <BsBox>
              <BsHeading id="active-shift-heading" :level="2">{{ copy.active }}</BsHeading>
              <BsText v-if="active" as="p" size="sm" tone="muted">{{ active.cashier }} · {{ active.opened }}</BsText>
            </BsBox>
            <BsInline>
              <BsButton v-if="!active" @click="emit('open')">{{ copy.open }}</BsButton>
              <BsButton v-if="canAdjust" severity="secondary" @click="emit('movement')">{{ copy.movement }}</BsButton>
              <BsButton v-if="canClose" @click="emit('close')">{{ copy.close }}</BsButton>
            </BsInline>
          </BsInline>
          <BsText v-if="!active" as="p" size="sm" tone="muted">{{ copy.noActive }}</BsText>
          <template v-else>
            <BsDescriptionList>
              <BsDescriptionItem v-for="metric in active.metrics" :key="metric.label" :term="metric.label"><BsText as="span" size="lg" emphasis="semibold">{{ metric.value }}</BsText></BsDescriptionItem>
            </BsDescriptionList>
            <BsBox scroll="x">
              <BsHeading :level="3">{{ copy.eventHistory }}</BsHeading>
              <BsDataTable density="compact" :value="active.events" data-key="id" :label="copy.eventHistory" :columns="[{ key: 'column0', header: (copy.date) }, { key: 'column1', header: (copy.event) }, { key: 'column2', header: (copy.actor) }, { key: 'column3', header: (copy.amount), align: 'end' }]">
                <template #cell-column0="{ row: event }">{{ event.date }}</template>
                <template #cell-column1="{ row: event }">
                  <BsText as="p" emphasis="semibold">{{ event.label }}</BsText>
                  <BsText as="p" size="xs" tone="muted">{{ event.detail }}</BsText>
                </template>
                <template #cell-column2="{ row: event }">{{ event.actor }}</template>
                <template #cell-column3="{ row: event }">
                  <BsText as="strong">{{ event.amount }}</BsText>
                </template>
                <template #empty>
                  <BsText as="p" size="sm" tone="muted">{{ copy.empty }}</BsText>
                </template>
              </BsDataTable>
            </BsBox>
          </template>
        </BsPanel>
        <BsPanel padding="md">
          <BsInline justify="between">
            <BsHeading :level="2">{{ copy.history }}</BsHeading>
            <BsSelect v-if="canManage" v-model="cashierId" :label="copy.cashier" :options="[{ id: null, name: copy.allCashiers }, ...cashierOptions]" option-label="name" option-value="id"/>
          </BsInline>
          <BsBox scroll="x">
            <BsDataTable density="compact" :value="historyRows" data-key="id" :label="copy.history" lazy paginator :rows="pageSize" :first="(page - 1) * pageSize" :total-records="total" :always-show-paginator="false" :columns="[{ key: 'cashierName', header: (copy.cashier), field: 'cashierName' }, { key: 'column1', header: (copy.opened) }, { key: 'column2', header: (copy.expected), align: 'end' }, { key: 'column3', header: (copy.counted), align: 'end' }, { key: 'column4', header: (copy.variance), align: 'end' }, { key: 'column5', header: (copy.nonCash), align: 'end' }]" @page="emit('page', $event.page + 1)">
              <template #cell-column1="{ row: shift }">{{ shift.opened }}</template>
              <template #cell-column2="{ row: shift }">{{ shift.expected }}</template>
              <template #cell-column3="{ row: shift }">{{ shift.counted }}</template>
              <template #cell-column4="{ row: shift }">
                <BsText as="strong">{{ shift.variance }}</BsText>
              </template>
              <template #cell-column5="{ row: shift }">{{ shift.nonCash }}</template>
              <template #empty>
                <BsText as="p" size="sm" tone="muted">{{ copy.empty }}</BsText>
              </template>
            </BsDataTable>
          </BsBox>
        </BsPanel>
      </template>
    </BsStack>
    <BsRecordActionDialog v-model:visible="showOpen" :title="copy.open" :dirty="openEditor.dirty" :pending="openEditor.pending" :error="actionError" :submit-label="copy.openAction" :cancel-label="copy.cancel" @submit="emit('saveOpen')">
      <BsField v-slot="field" :label="copy.openingCash">
        <BsInput :id="field.id" :model-value="openForm.amount" :aria-describedby="field.describedby" type="number" :min="0" :step="0.01" required @update:model-value="updateOpen('amount', $event)"/>
      </BsField>
      <BsField v-slot="field" :label="copy.openingNotes">
        <BsTextarea :id="field.id" :model-value="openForm.notes" :aria-describedby="field.describedby" :maxlength="1000" :rows="3" @update:model-value="updateOpen('notes', $event)"/>
      </BsField>
    </BsRecordActionDialog>
    <BsRecordActionDialog v-model:visible="showMovement" :title="copy.movement" :dirty="movementEditor.dirty" :pending="movementEditor.pending" :error="actionError" :submit-label="copy.record" :cancel-label="copy.cancel" @submit="emit('saveMovement')">
      <BsFieldGroup :legend="(copy.event)">
        <BsRadio v-for="option in movementOptions" :key="option.value" :model-value="movementForm.kind" :value="option.value" :label="option.label" @update:model-value="updateMovement('kind', $event)"/>
      </BsFieldGroup>
      <BsField v-slot="field" :label="copy.amount">
        <BsInput :id="field.id" :model-value="movementForm.amount" :aria-describedby="field.describedby" type="number" :min="0.01" :step="0.01" required @update:model-value="updateMovement('amount', $event)"/>
      </BsField>
      <BsField v-slot="field" :label="copy.reason">
        <BsTextarea :id="field.id" :model-value="movementForm.reason" :aria-describedby="field.describedby" :minlength="2" :maxlength="1000" required :rows="3" @update:model-value="updateMovement('reason', $event)"/>
      </BsField>
      <BsField v-slot="field" :label="copy.reference">
        <BsInput :id="field.id" :model-value="movementForm.reference" :aria-describedby="field.describedby" :maxlength="200" required @update:model-value="updateMovement('reference', $event)"/>
      </BsField>
    </BsRecordActionDialog>
    <BsRecordActionDialog v-model:visible="showClose" :title="copy.close" :dirty="closeEditor.dirty" :pending="closeEditor.pending" :error="actionError" :submit-label="copy.closeAction" :cancel-label="copy.cancel" @submit="emit('saveClose')">
      <BsText as="p" size="sm">{{ copy.expected }}: <BsText as="strong">{{ expectedCash }}</BsText>
      </BsText>
      <BsField v-slot="field" :label="copy.counted">
        <BsInput :id="field.id" :model-value="closeForm.amount" :aria-describedby="field.describedby" type="number" :min="0" :step="0.01" required @update:model-value="updateClose('amount', $event)"/>
      </BsField>
      <BsField v-slot="field" :label="copy.closeNotes">
        <BsTextarea :id="field.id" :model-value="closeForm.notes" :aria-describedby="field.describedby" :minlength="2" :maxlength="1000" :rows="3" @update:model-value="updateClose('notes', $event)"/>
      </BsField>
    </BsRecordActionDialog>
  </BsStack>
</template>
