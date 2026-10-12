<script setup lang="ts">
import type { BsExpenseCopy, BsExpenseView, BsExpenseRow, BsExpenseForm, BsExpenseFilters } from '../types/expensePresentation'
defineProps<{ copy: BsExpenseCopy; view: BsExpenseView; rows: BsExpenseRow[]; categoryOptions: { value: string; label: string }[] }>()
const form = defineModel<BsExpenseForm>('form', { required: true })
const filters = defineModel<BsExpenseFilters>('filters', { required: true })
const search = defineModel<string>('search', { required: true })
const page = defineModel<number>('page', { required: true })
const showForm = defineModel<boolean>('editorOpen', { required: true })
const voidOpen = defineModel<boolean>('voidOpen', { required: true })
const voidReason = defineModel<string>('voidReason', { required: true })
const emit = defineEmits<{ create: []; save: []; void: []; retry: []; correct: [id: string]; openVoid: [id: string] }>()
</script>
<template>
  <BsStack gap="lg">
    <BsPageHeader  :title="copy.title" :subtitle="copy.subtitle">
      <template #actions>
        <BsButton v-if="view.available && view.hasLocation && view.canManage" type="button" @click="emit('create')">{{ copy.add }}</BsButton>
      </template>
    </BsPageHeader>
    <BsPanel v-if="!view.available && !view.loadingContext" padding="md">
      <BsText as="p">{{ copy.noShop }}</BsText>
      <BsLink to="/dashboard">{{ copy.dashboard }}</BsLink>
    </BsPanel>
    <template v-else-if="view.available">
      <BsText as="p" size="sm">{{ copy.incomeBoundary }}</BsText>
      <BsText v-if="!view.hasLocation" role="alert" as="p" size="sm" tone="warning">{{ copy.noLocation }}</BsText>
      <BsText v-else-if="!view.loading && !view.error && !view.canManage" as="p" size="sm">{{ copy.readOnly }}</BsText>
      <BsText v-if="view.actionError && !showForm && !voidOpen" role="alert" as="p">{{ view.actionError }}</BsText>
      <BsRecordActionDialog v-model:visible="showForm" :title="view.editing ? copy.correct : copy.add" :dirty="view.dirty" :pending="view.saving" :error="view.actionError" :submit-label="view.editing ? copy.saveCorrection : copy.save" :cancel-label="copy.cancel" @submit="emit('save')">
        <BsText v-if="view.editing" as="p" size="sm">{{ copy.correctionHelp }}</BsText>
        <BsField v-slot="field" :label="copy.name">
          <BsInput :id="field.id" :model-value="form.title" :aria-describedby="field.describedby" type="text" :minlength="2" :maxlength="160" required @update:model-value="form = { ...form, title: String($event) }"/>
        </BsField>
        <BsField v-slot="field" :label="copy.amount">
          <BsInput :id="field.id" :model-value="form.amount" :aria-describedby="field.describedby" type="number" :min="0.01" :max="999999999.99" :step="0.01" required @update:model-value="form = { ...form, amount: Number($event) }"/>
        </BsField>
        <BsField v-slot="field" :label="copy.date">
          <BsInput :id="field.id" :model-value="form.date" :aria-describedby="field.describedby" type="date" required @update:model-value="form = { ...form, date: String($event) }"/>
        </BsField>
        <BsField v-slot="field" :label="(copy.category) + ''">
          <BsInput :id="field.id" :model-value="form.category" :aria-describedby="field.describedby" type="text" list="shop-expense-categories" :minlength="2" :maxlength="80" required :placeholder="copy.categoryHint" @update:model-value="form = { ...form, category: String($event) }"/>
        </BsField>
        <BsField v-slot="field" :label="copy.notes">
          <BsTextarea :id="field.id" :model-value="form.notes" :aria-describedby="field.describedby" :rows="2" :maxlength="1000" @update:model-value="form = { ...form, notes: String($event) }"/>
        </BsField>
        <BsField v-if="view.editing" v-slot="field" :label="copy.correctionReason">
          <BsTextarea :id="field.id" :model-value="form.correctionReason" :aria-describedby="field.describedby" :rows="2" :minlength="2" :maxlength="500" required @update:model-value="form = { ...form, correctionReason: String($event) }"/>
        </BsField>
      </BsRecordActionDialog>
      <BsRecordActionDialog v-model:visible="voidOpen" :title="copy.voidTitle" :dirty="view.voidDirty" :pending="view.voidPending" :error="view.actionError" :submit-label="copy.void" :cancel-label="copy.cancel" submit-tone="danger" size="sm" @submit="emit('void')">
        <BsText as="p" size="sm" tone="muted">{{ copy.voidHelp }}</BsText>
        <BsField v-slot="field" :label="copy.voidReason">
          <BsTextarea :id="field.id" v-model="voidReason" :aria-describedby="field.describedby" :rows="3" :minlength="2" :maxlength="500" required/>
        </BsField>
      </BsRecordActionDialog>
      <BsPanel v-if="view.hasLocation" padding="md">
        <BsGrid columns="auto" min-item-width="sm">
          <BsInput v-model="search" type="search" :placeholder="copy.search" :aria-label="copy.search"/>
          <BsSelect :model-value="filters.status" :label="copy.status" :options="[{ value: 'all', label: (copy.allStatuses), disabled: false }, { value: 'paid', label: (copy.paid), disabled: false }, { value: 'void', label: (copy.voided), disabled: false }]" option-label="label" option-value="value" option-disabled="disabled" @update:model-value="filters = { ...filters, status: String($event ?? '') }"/>
          <BsSelect :model-value="filters.category" :label="copy.category" :options="categoryOptions" option-label="label" option-value="value" option-disabled="disabled" @update:model-value="filters = { ...filters, category: String($event ?? '') }"/>
          <BsField v-slot="field" :label="copy.from">
            <BsInput :id="field.id" :model-value="filters.from" :aria-describedby="field.describedby" type="date" @update:model-value="filters = { ...filters, from: String($event ?? '') }"/>
          </BsField>
          <BsField v-slot="field" :label="copy.to">
            <BsInput :id="field.id" :model-value="filters.to" :aria-describedby="field.describedby" type="date" @update:model-value="filters = { ...filters, to: String($event ?? '') }"/>
          </BsField>
        </BsGrid>
        <BsBox>
          <BsText as="strong">{{ copy.branch }}:</BsText> {{ view.locationName }}</BsBox>
        <BsDataTable :value="rows" :loading="view.loading" :error="view.error || null" :label="copy.title" data-key="id" lazy paginator :rows="view.pageSize" :first="(page - 1) * view.pageSize" :total-records="view.total" :always-show-paginator="false" :columns="[{ key: 'column0', header: (copy.name) }, { key: 'column1', header: (copy.category) }, { key: 'column2', header: (copy.date) }, { key: 'column3', header: (copy.history) }, { key: 'column4', header: (copy.amount), align: 'end' }, { key: 'column5', header: (copy.status), align: 'end' }]" @page="page = $event.page + 1" @retry="emit('retry')">
          <template #cell-column0="{ row: expense }">
            <BsText as="p" emphasis="semibold">{{ expense.title }}</BsText>
            <BsText v-if="expense.notes" as="p" size="xs" tone="muted">{{ expense.notes }}</BsText>
            <BsText v-if="expense.reason" as="p" size="xs" tone="muted">{{ expense.reason }}</BsText>
          </template>
          <template #cell-column1="{ row: expense }">{{ expense.category }}</template>
          <template #cell-column2="{ row: expense }">{{ expense.date }}</template>
          <template #cell-column3="{ row: expense }">
            <BsText as="span">{{ expense.history }}</BsText>
            <BsText as="p" size="xs" tone="muted">{{ expense.actor }}</BsText>
          </template>
          <template #cell-column4="{ row: expense }">{{ expense.amount }}</template>
          <template #cell-column5="{ row: expense }">
            <BsText as="span">{{ expense.status }}</BsText>
            <BsInline v-if="expense.editable">
              <BsButton variant="link" type="button" @click="emit('correct', expense.id)">{{ copy.correct }}</BsButton>
              <BsButton variant="text" type="button" @click="emit('openVoid', expense.id)">{{ copy.void }}</BsButton>
            </BsInline>
          </template>
          <template #empty>
            <BsText as="p" size="sm" tone="muted">{{ copy.empty }}</BsText>
          </template>
        </BsDataTable>
      </BsPanel>
    </template>
  </BsStack>
</template>
