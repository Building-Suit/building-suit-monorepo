<script setup lang="ts">
import type { BsDimensionValueView, BsDimensionPolicyView, BsDimensionReportGroupView, BsDimensionValueForm, BsDimensionPolicyForm, BsDimensionReportFilter, BsDimensionsCopy } from '../types/dimensionPresentation'
const tab = defineModel<string>('tab', { required: true })
const valueForm = defineModel<BsDimensionValueForm>('valueForm', { required: true })
const policy = defineModel<BsDimensionPolicyForm>('policy', { required: true })
const reportFilter = defineModel<BsDimensionReportFilter>('reportFilter', { required: true })
const visible = defineModel<boolean>('visible', { required: true })
const policyOpen = defineModel<boolean>('policyOpen', { required: true })
defineProps<{
  copy: BsDimensionsCopy; context: { label: string; value: string }[]; contextLabel: string
  tabs: { value: string; label: string }[]; canRead: boolean; canManage: boolean; canConfigure: boolean; readOnly: boolean
  available: boolean; pending: boolean; error: boolean; legacyWarning?: string
  values: BsDimensionValueView[]; policies: BsDimensionPolicyView[]; groups: BsDimensionReportGroupView[] | null; reconciled: boolean; currency: string; locale: string
  kindOptions: { value: string; label: string }[]; reportOptions: { value: string; label: string }[]; valueOptions: { value: string; label: string }[]; accountOptions: { value: string; label: string }[]; requirementOptions: { value: string; label: string }[]
  saving: boolean; dirty: boolean; formError: string; policySaving: boolean; policyDirty: boolean; policyError: string
}>()
const emit = defineEmits<{ retry: []; createValue: []; editValue: [id: string]; archiveValue: [id: string]; createPolicy: []; editPolicy: [id: string]; saveValue: []; savePolicy: []; runReport: [] }>()
</script>

<template>
  <BsStack gap="lg">
    <BsPageHeader
      :title="copy.title"
      :subtitle="copy.subtitle"
      :context="context"
      :context-label="contextLabel"
    />
    <BsText v-if="!canRead" role="status">{{ copy.denied }}</BsText>
    <template v-else>
      <BsInline :aria-label="copy.title" as="nav" gap="sm" :wrap="true">
        <BsButton v-for="item in tabs" :key="item.value" :variant="tab === item.value ? 'primary' : 'default'" @click="tab = item.value">{{ item.label }}</BsButton>
      </BsInline>
      <BsText v-if="error" role="alert" tone="danger">{{ copy.loadError }} <BsButton type="submit" @click="emit('retry')">{{ copy.retry }}</BsButton></BsText>
      <BsSectionSkeleton v-else-if="pending" variant="table" :rows="5" />
      <template v-else-if="available">
        <BsBox v-if="legacyWarning" role="status" as="aside" padding="lg" border radius="control">{{ legacyWarning }}</BsBox>
        <BsCard v-if="tab==='values'" as="section" padding="none" overflow="hidden">
          <BsHeading :level="2" size="h2">{{ copy.values }}</BsHeading>
          <BsDataTable
            :value="values"
            row-key="id"
            :label="copy.values"
            :capabilities="{ insert: canManage, edit: canManage, archive: canManage }"
            :action-labels="{ insert: copy.add, edit: copy.edit, archive: copy.archive }"
            :can-row-action="(_action, row) => row.editable"
            :columns="[{ key: 'kindLabel', field: 'kindLabel', header: copy.kind }, { key: 'code', field: 'code', header: copy.code }, { key: 'name', field: 'name', header: copy.name }, { key: 'statusLabel', field: 'statusLabel', header: copy.status }]"
            @create="emit('createValue')"
            @edit="row => emit('editValue', row.id)"
            @archive="row => emit('archiveValue', row.id)"
          >
            <template #empty>{{ copy.empty }}</template>
          </BsDataTable>
        </BsCard>
        <BsCard v-else-if="tab==='policies'" as="section" padding="md">
          <BsStack gap="md">
            <BsHeading :level="2" size="h2">{{ copy.policies }}</BsHeading>
            <BsText tone="muted">{{ copy.policiesHint }}</BsText>
            <BsDataTable
              :value="policies"
              row-key="id"
              :label="copy.policies"
              :capabilities="{ insert: canConfigure, edit: canConfigure }"
              :action-labels="{ insert: copy.add, edit: copy.edit }"
              :columns="[{ key: 'column1', header: copy.account }, { key: 'column2', header: copy.kind }, { key: 'column3', header: copy.requirement }]"
              @create="emit('createPolicy')"
              @edit="row => emit('editPolicy', row.id)"
            >
              <template #cell-column1="{ row }">{{ row.accountName }}</template>
              <template #cell-column2="{ row }">{{ row.kindLabel }}</template>
              <template #cell-column3="{ row }">{{ row.requirementLabel }}</template>
            </BsDataTable>
          </BsStack>
        </BsCard>
        <BsStack v-else as="section" gap="md">
          <BsForm layout="grid" :columns="4" @submit.prevent="emit('runReport')">
            <BsFloatingField :label="copy.reportType">
              <BsSelect :model-value="reportFilter.report" native @update:model-value="reportFilter = { ...reportFilter, report: String($event ?? '') }">
                <BsSelectOption v-for="option in reportOptions" :key="option.value" :value="option.value">{{ option.label }}</BsSelectOption>
              </BsSelect>
            </BsFloatingField>
            <BsFloatingField :label="copy.kind">
              <BsSelect :model-value="reportFilter.kind" native @update:model-value="reportFilter = { ...reportFilter, kind: String($event ?? '') }">
                <BsSelectOption v-for="option in kindOptions" :key="option.value" :value="option.value">{{ option.label }}</BsSelectOption>
              </BsSelect>
            </BsFloatingField>
            <BsFloatingField :label="copy.from">
              <BsInput :model-value="reportFilter.from" type="date" required @update:model-value="reportFilter = { ...reportFilter, from: String($event ?? '') }" />
            </BsFloatingField>
            <BsFloatingField :label="copy.to">
              <BsInput :model-value="reportFilter.to" type="date" required @update:model-value="reportFilter = { ...reportFilter, to: String($event ?? '') }" />
            </BsFloatingField>
            <BsFloatingField :label="copy.filter">
              <BsSelect :model-value="reportFilter.valueId" native @update:model-value="reportFilter = { ...reportFilter, valueId: String($event ?? '') }">
                <BsSelectOption v-for="option in valueOptions" :key="option.value" :value="option.value">{{ option.label }}</BsSelectOption>
              </BsSelect>
            </BsFloatingField>
            <BsButton type="submit" variant="primary">{{ copy.run }}</BsButton>
          </BsForm>
          <template v-if="groups">
            <BsText :data-dimension-reconciled="reconciled" :tone="reconciled ? 'success' : 'danger'">{{ reconciled ? copy.reconciled : copy.notReconciled }}</BsText>
            <BsCard as="section" padding="none" overflow="hidden">
              <BsHeading :level="2" size="h2">{{ copy.grouped }}</BsHeading>
              <BsDataTable
                :value="groups"
                row-key="id"
                :label="copy.grouped"
                :columns="[{ key: 'code', field: 'code', header: copy.code }, { key: 'name', field: 'name', header: copy.name }, { key: 'column3', header: copy.openingDebit }, { key: 'column4', header: copy.openingCredit }, { key: 'column5', header: copy.periodDebit }, { key: 'column6', header: copy.periodCredit }]"
              >
                <template #cell-name="{ row }">{{ row.name }}</template>
                <template #cell-column3="{ row }">
                  <BsMoneyText :amount="row.openingDebit" :currency="currency" :locale="locale" />
                </template>
                <template #cell-column4="{ row }">
                  <BsMoneyText :amount="row.openingCredit" :currency="currency" :locale="locale" />
                </template>
                <template #cell-column5="{ row }">
                  <BsMoneyText :amount="row.periodDebit" :currency="currency" :locale="locale" />
                </template>
                <template #cell-column6="{ row }">
                  <BsMoneyText :amount="row.periodCredit" :currency="currency" :locale="locale" />
                </template>
              </BsDataTable>
            </BsCard>
          </template>
        </BsStack>
      </template>
    </template>
    <BsRecordActionDialog
      v-model:visible="visible"
      :title="valueForm.id ? copy.edit : copy.add"
      :pending="saving"
      :dirty="dirty"
      :error="formError"
      :submit-label="copy.save"
      :cancel-label="copy.cancel"
      :submit-disabled="readOnly"
      @submit="emit('saveValue')"
    >
      <BsFloatingField :label="copy.kind">
        <BsSelect :model-value="valueForm.kind" :disabled="Boolean(valueForm.id)" native @update:model-value="valueForm = { ...valueForm, kind: String($event ?? '') }">
          <BsSelectOption v-for="option in kindOptions" :key="option.value" :value="option.value">{{ option.label }}</BsSelectOption>
        </BsSelect>
      </BsFloatingField>
      <BsFloatingField :label="copy.code">
        <BsInput :model-value="valueForm.code" required maxlength="50" @update:model-value="valueForm = { ...valueForm, code: String($event ?? '') }" />
      </BsFloatingField>
      <BsFloatingField :label="copy.name">
        <BsInput :model-value="valueForm.name" required maxlength="160" @update:model-value="valueForm = { ...valueForm, name: String($event ?? '') }" />
      </BsFloatingField>
      <BsFloatingField :label="copy.description">
        <BsTextarea :model-value="valueForm.description" maxlength="500" @update:model-value="valueForm = { ...valueForm, description: String($event ?? '') }" />
      </BsFloatingField>
    </BsRecordActionDialog>
    <BsRecordActionDialog
      v-model:visible="policyOpen"
      :title="copy.policies"
      :pending="policySaving"
      :dirty="policyDirty"
      :error="policyError"
      :submit-label="copy.save"
      :cancel-label="copy.cancel"
      :submit-disabled="readOnly"
      @submit="emit('savePolicy')"
    >
      <BsFloatingField :label="copy.account">
        <BsSelect :model-value="policy.accountId" required native @update:model-value="policy = { ...policy, accountId: String($event ?? '') }">
          <BsSelectOption value="" />
          <BsSelectOption v-for="option in accountOptions" :key="option.value" :value="option.value">{{ option.label }}</BsSelectOption>
        </BsSelect>
      </BsFloatingField>
      <BsFloatingField :label="copy.kind">
        <BsSelect :model-value="policy.kind" native @update:model-value="policy = { ...policy, kind: String($event ?? '') }">
          <BsSelectOption v-for="option in kindOptions" :key="option.value" :value="option.value">{{ option.label }}</BsSelectOption>
        </BsSelect>
      </BsFloatingField>
      <BsFloatingField :label="copy.requirement">
        <BsSelect :model-value="policy.requirement" native @update:model-value="policy = { ...policy, requirement: String($event ?? '') }">
          <BsSelectOption v-for="option in requirementOptions" :key="option.value" :value="option.value">{{ option.label }}</BsSelectOption>
        </BsSelect>
      </BsFloatingField>
    </BsRecordActionDialog>
  </BsStack>
</template>
