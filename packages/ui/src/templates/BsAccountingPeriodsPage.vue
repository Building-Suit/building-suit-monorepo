<script setup lang="ts">
import type { BsAccountingPeriodCopy, BsAccountingPeriodView, BsAccountingPeriodCreateForm, BsAccountingPeriodCloseForm } from '../types/accountingPeriodPresentation'
defineProps<{ copy: BsAccountingPeriodCopy; view: BsAccountingPeriodView }>()
const createOpen = defineModel<boolean>('createOpen', { required: true })
const createForm = defineModel<BsAccountingPeriodCreateForm>('createForm', { required: true })
const closeForm = defineModel<BsAccountingPeriodCloseForm>('closeForm', { required: true })
const emit = defineEmits<{ create: []; closeYear: []; transition: [id: string, action: string]; reason: [id: string, value: string] }>()
function updateCreateForm(key: keyof BsAccountingPeriodCreateForm, value: string | number | boolean | null | undefined) { createForm.value = { ...createForm.value, [key]: String(value ?? '') } }
function updateCloseForm(key: keyof BsAccountingPeriodCloseForm, value: string | number | boolean | null | undefined) { closeForm.value = { ...closeForm.value, [key]: String(value ?? '') } }
</script>
<template>
  <BsStack gap="lg">
    <BsPageHeader
      :title="copy.periods_title"
      :subtitle="copy.periods_subtitle"
      :context="view.context"
      :context-label="view.contextLabel"
    />
    <BsText v-if="!view.canRead" role="status" tone="muted">{{ copy.periods_noAccess }}</BsText>
    <BsText v-else-if="view.loadError" role="alert" tone="danger">{{ copy.periods_loadFailed }}</BsText>
    <BsSectionSkeleton v-else-if="view.pending" variant="table" :rows="5" />
    <template v-else>
      <BsCard aria-labelledby="fiscal-year-heading" as="section" padding="md">
        <BsStack gap="md">
          <BsHeading id="fiscal-year-heading" :level="2" size="h2">{{ copy.periods_fiscalYear }}</BsHeading>
          <BsText>{{ copy.periods_fiscalMonth }}</BsText>
          <BsText size="sm" tone="muted">{{ copy.periods_fiscalHint }}</BsText>
        </BsStack>
      </BsCard>
      <BsButton v-if="view.canManage" type="button" variant="primary" @click="createOpen = true">{{ copy.periods_create }}</BsButton>
      <BsRecordActionDialog
        v-if="createOpen"
        v-model:visible="createOpen"
        :title="copy.periods_create"
        :dirty="view.createDirty"
        :pending="view.createPending"
        :error="view.createError"
        :submit-label="copy.periods_create"
        :cancel-label="copy.common_cancel"
        @submit="emit('create')"
      >
        <BsFloatingField :label="copy.periods_startDate">
          <BsInput id="period-start" :model-value="createForm.start" type="date" required @update:model-value="updateCreateForm('start', $event)" />
        </BsFloatingField>
        <BsFloatingField :label="copy.periods_endDate">
          <BsInput id="period-end" :model-value="createForm.end" type="date" :min="createForm.start" required @update:model-value="updateCreateForm('end', $event)" />
        </BsFloatingField>
      </BsRecordActionDialog>
      <BsEmptyState v-if="!view.periods.length" :title="copy.periods_empty" :description="copy.periods_emptyHint" />
      <BsCard v-for="period in view.periods" :key="period.id" :data-period-status="period.status" :data-period-start="period.start" as="section" padding="md">
        <BsStack gap="md">
          <BsInline gap="md" :wrap="true" align="start" justify="between">
            <BsBox>
              <BsHeading :level="2" size="body">{{ period.title }}</BsHeading>
              <BsText size="sm" tone="muted">{{ period.fiscalRange }}</BsText>
            </BsBox>
            <BsStatusBadge
              :status="period.status"
              :label="period.statusLabel"
              :tone="period.statusTone"
            />
          </BsInline>
          <BsStack v-if="view.canManage" gap="md">
            <BsFloatingField :label="copy.periods_reason">
              <BsInput :id="`reason-${period.id}`" :model-value="period.reason" :placeholder="copy.periods_reasonHint" @update:model-value="value => emit('reason', period.id, String(value ?? ''))" />
            </BsFloatingField>
            <BsInline gap="sm" :wrap="true">
              <BsButton
                v-for="action in period.actions"
                :key="action.id"
                type="button"
                :disabled="action.disabled"
                :variant="action.primary ? 'primary' : 'default'"
                @click="emit('transition', period.id, action.id)"
              >{{ action.label }}</BsButton>
            </BsInline>
          </BsStack>
          <BsBox v-if="period.close" padding="md" surface="muted" radius="control">
            <BsText emphasis="semibold">{{ copy.periods_yearEndComplete }}</BsText>
            <BsText>{{ copy.periods_netResult }}: <BsText as="span" dir="ltr">{{ period.close.net }}</BsText></BsText>
            <BsLink :to="period.close.journalTo">{{ copy.periods_closingJournal }}</BsLink>
          </BsBox>
          <BsDisclosure v-if="period.history.length">
            <template #summary>{{ copy.periods_history }}</template>
            <BsList :ordered="true" marker="none">
              <BsListItem v-for="item in period.history" :key="item.id">
                <BsText>{{ item.transition }}</BsText>
                <BsText tone="muted">{{ item.description }}</BsText>
              </BsListItem>
            </BsList>
          </BsDisclosure>
        </BsStack>
      </BsCard>
      <BsForm v-if="view.canCloseYear" :aria-busy="view.closePending" layout="grid" @submit.prevent="emit('closeYear')">
        <BsFloatingField :label="copy.periods_fiscalYearStart">
          <BsInput id="year-start" :model-value="closeForm.fiscalYearStart" type="date" required @update:model-value="updateCloseForm('fiscalYearStart', $event)" />
        </BsFloatingField>
        <BsFloatingField :label="copy.periods_yearEndReason">
          <BsInput id="year-end-reason" :model-value="closeForm.reason" required @update:model-value="updateCloseForm('reason', $event)" />
        </BsFloatingField>
        <BsButton type="submit" :disabled="view.closeDisabled" variant="primary">{{ view.closeLabel }}</BsButton>
      </BsForm>
    </template>
  </BsStack>
</template>
