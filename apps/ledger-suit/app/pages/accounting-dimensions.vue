<script setup lang="ts">
import type { DimensionKind, DimensionValueRow } from '~/utils/accountingDimensions'
import { dimensionReportReconciles } from '~/utils/accountingDimensions'

definePageMeta({ layout: 'default' })
const { t } = useI18n()
const { can, currentId } = useTenant()
const user = useSupabaseUser()
const { readOnly } = useBilling()
const confirmation = useConfirmation()
const toasts = useToasts()
const { workspace, report, pending, error, load, loadReport, command } = useAccountingDimensions()
useHead({ title: () => `${t('dimensions.title')} · ${t('app.name')}` })

const tab = ref<'values' | 'policies' | 'reports'>('values')
const valueForm = reactive({ id: '', kind: 'cost_center' as DimensionKind, code: '', name: '', description: '' })
const { visible, pending: saving, dirty, open, complete } = useRecordAction(() => valueForm)
const formError = ref('')
const policy = reactive({ accountId: '', kind: 'cost_center' as DimensionKind, requirement: 'optional' as 'optional' | 'required' })
const policyError = ref('')
const { visible: policyOpen, pending: policySaving, dirty: policyDirty, complete: completePolicy } = useRecordAction(() => policy)
const reportFilter = reactive({ kind: 'cost_center' as DimensionKind, report: 'trial_balance' as 'general_ledger' | 'trial_balance' | 'profit_loss' | 'balance_sheet' | 'cash_flow', from: `${new Date().getUTCFullYear()}-01-01`, to: new Date().toISOString().slice(0, 10), valueId: '' })
const reconciled = computed(() => dimensionReportReconciles(report.value))
watch(() => reportFilter.kind, () => { reportFilter.valueId = ''; report.value = null })

function editValue(value?: DimensionValueRow) {
  Object.assign(valueForm, value ? { id: value.id, kind: value.kind, code: value.code, name: value.name, description: value.description ?? '' } : { id: '', kind: 'cost_center', code: '', name: '', description: '' })
  formError.value = ''; open()
}
async function saveValue() {
  formError.value = ''; saving.value = true
  try {
    await command('save_dimension_value', { p_kind: valueForm.kind, p_code: valueForm.code, p_name: valueForm.name, p_description: valueForm.description || null, p_request_id: crypto.randomUUID(), p_dimension_value_id: valueForm.id || null })
    complete(); toasts.success(t('dimensions.saved'))
  }
  catch { formError.value = t('dimensions.errors.save') }
  finally { saving.value = false }
}
async function archive(value: DimensionValueRow) {
  if (!await confirmation.ask(t('dimensions.archiveConfirm', { name: value.name }))) return
  try { await command('archive_dimension_value', { p_dimension_value_id: value.id, p_request_id: crypto.randomUUID() }); toasts.success(t('dimensions.archived')) }
  catch { toasts.error(t('dimensions.errors.title'), t('dimensions.errors.archive')) }
}
async function savePolicy() {
  policyError.value = ''; policySaving.value = true
  try { await command('set_account_dimension_policy', { p_account_id: policy.accountId, p_kind: policy.kind, p_requirement: policy.requirement }); completePolicy(); toasts.success(t('dimensions.policySaved')) }
  catch { policyError.value = t('dimensions.errors.policy') }
  finally { policySaving.value = false }
}
function editPolicy(row?: { account_id: string; kind: DimensionKind; requirement: 'optional' | 'required' }) {
  Object.assign(policy, row ? { accountId: row.account_id, kind: row.kind, requirement: row.requirement } : { accountId: '', kind: 'cost_center', requirement: 'optional' })
  policyError.value = ''; policyOpen.value = true
}
async function runReport() {
  try { await loadReport({ p_report_kind: reportFilter.report, p_dimension_kind: reportFilter.kind, p_from_date: reportFilter.from, p_to_date: reportFilter.to, p_dimension_value_id: reportFilter.valueId || null }) }
  catch { toasts.error(t('dimensions.errors.title'), t('dimensions.errors.report')) }
}
watch([currentId, () => user.value?.id], () => { visible.value = false; tab.value = 'values' }, { flush: 'sync' })
const ledgerPresentation = useLedgerPresentation()
</script>

<template>
  <BsStack gap="lg">
    <BsPageHeader
      :title="t('dimensions.title')"
      :subtitle="t('dimensions.policy')"
      :context="ledgerPresentation.context(tab === 'reports' ? reportFilter.from : undefined, tab === 'reports' ? reportFilter.to : undefined, undefined)"
      :context-label="ledgerPresentation.t('pageContext.label')"
    />
    <BsText v-if="!can('dimensions.read')" role="status">{{ t('dimensions.denied') }}</BsText>
    <template v-else>
      <BsInline :aria-label="t('dimensions.title')" as="nav" gap="sm" :wrap="true">
        <template v-for="item in ['values','policies','reports'] as const" :key="item">
          <BsButton v-if="item!=='reports' || can('reports.read')" type="submit" :variant="tab===item ? 'primary' : 'default'" @click="tab=item">{{ t(`dimensions.tabs.${item}`) }}</BsButton>
        </template>
      </BsInline>
      <BsText v-if="error" role="alert" tone="danger">{{ t('dimensions.errors.load') }} <BsButton type="submit" @click="load">{{ t('common.retry') }}</BsButton></BsText>
      <BsSectionSkeleton v-else-if="pending" variant="table" :rows="5" />
      <template v-else-if="workspace">
        <BsBox v-if="workspace.legacy_uncontrolled_count" role="status" as="aside" padding="lg" border radius="control">{{ t('dimensions.legacyWarning', { count: workspace.legacy_uncontrolled_count }) }}</BsBox>
        <BsCard v-if="tab==='values'" as="section" padding="none" overflow="hidden">
          <BsHeading :level="2" size="h2">{{ t('dimensions.values') }}</BsHeading>
          <BsDataTable
            :value="workspace.values"
            row-key="id"
            :label="t('dimensions.values')"
            :capabilities="{ insert: can('dimensions.manage') && !readOnly, edit: can('dimensions.manage') && !readOnly, archive: can('dimensions.manage') && !readOnly }"
            :action-labels="{ insert: t('dimensions.add'), edit: t('dimensions.edit'), archive: t('dimensions.archive') }"
            :can-row-action="(_action, row) => row.status === 'active'"
            :columns="[{ key: 'kind', field: 'kind', header: t('dimensions.kind') }, { key: 'code', field: 'code', header: t('dimensions.code') }, { key: 'name', field: 'name', header: t('dimensions.name') }, { key: 'status', field: 'status', header: t('dimensions.statusLabel') }]"
            @create="editValue()"
            @edit="editValue"
            @archive="archive"
          >
            <template #empty>{{ t('dimensions.empty') }}</template>
            <template #cell-kind="{ row }">{{ t(`dimensions.kinds.${row.kind}`) }}</template>
            <template #cell-status="{ row }">{{ t(`dimensions.status.${row.status}`) }}</template>
          </BsDataTable>
        </BsCard>
        <BsCard v-else-if="tab==='policies'" as="section" padding="md">
          <BsStack gap="md">
            <BsHeading :level="2" size="h2">{{ t('dimensions.policies') }}</BsHeading>
            <BsText tone="muted">{{ t('dimensions.policiesHint') }}</BsText>
            <BsDataTable
              :value="workspace.policies"
              row-key="account_id"
              :label="t('dimensions.policies')"
              :capabilities="{ insert: can('dimensions.configure') && !readOnly, edit: can('dimensions.configure') && !readOnly }"
              :action-labels="{ insert: t('dimensions.add'), edit: t('dimensions.edit') }"
              :columns="[{ key: 'column1', header: t('dimensions.account') }, { key: 'column2', header: t('dimensions.kind') }, { key: 'column3', header: t('dimensions.requirement') }]"
              @create="editPolicy()"
              @edit="editPolicy"
            >
              <template #cell-column1="{ row }">{{ workspace.accounts.find(account=>account.id===row.account_id)?.name }}</template>
              <template #cell-column2="{ row }">{{ t(`dimensions.kinds.${row.kind}`) }}</template>
              <template #cell-column3="{ row }">{{ t(`dimensions.requirements.${row.requirement}`) }}</template>
            </BsDataTable>
          </BsStack>
        </BsCard>
        <BsStack v-else as="section" gap="md">
          <BsForm layout="grid" :columns="4" @submit.prevent="runReport">
            <BsFloatingField :label="t('dimensions.reportType')">
              <BsSelect v-model="reportFilter.report" native>
                <BsSelectOption v-for="kind in ['general_ledger','trial_balance','profit_loss','balance_sheet','cash_flow'] as const" :key="kind" :value="kind">{{ t(`dimensions.reports.${kind}`) }}</BsSelectOption>
              </BsSelect>
            </BsFloatingField>
            <BsFloatingField :label="t('dimensions.kind')">
              <BsSelect v-model="reportFilter.kind" native>
                <BsSelectOption value="cost_center">{{ t('dimensions.kinds.cost_center') }}</BsSelectOption>
                <BsSelectOption value="project">{{ t('dimensions.kinds.project') }}</BsSelectOption>
              </BsSelect>
            </BsFloatingField>
            <BsFloatingField :label="t('dimensions.from')">
              <BsInput v-model="reportFilter.from" type="date" required />
            </BsFloatingField>
            <BsFloatingField :label="t('dimensions.to')">
              <BsInput v-model="reportFilter.to" type="date" required />
            </BsFloatingField>
            <BsFloatingField :label="t('dimensions.filter')">
              <BsSelect v-model="reportFilter.valueId" native>
                <BsSelectOption value="">{{ t('common.any') }}</BsSelectOption>
                <BsSelectOption v-for="value in workspace.values.filter(item=>item.kind===reportFilter.kind)" :key="value.id" :value="value.id">{{ value.code }} · {{ value.name }}{{ value.status==='inactive' ? ` (${t('dimensions.status.inactive')})` : '' }}</BsSelectOption>
              </BsSelect>
            </BsFloatingField>
            <BsButton type="submit" variant="primary">{{ t('dimensions.run') }}</BsButton>
          </BsForm>
          <template v-if="report">
            <BsText :data-dimension-reconciled="reconciled" :tone="reconciled ? 'success' : 'danger'">{{ reconciled ? t('dimensions.reconciled') : t('dimensions.notReconciled') }}</BsText>
            <BsCard as="section" padding="none" overflow="hidden">
              <BsHeading :level="2" size="h2">{{ t('dimensions.grouped') }}</BsHeading>
              <BsDataTable
                :value="report.groups"
                row-key="code"
                :label="t('dimensions.grouped')"
                :columns="[{ key: 'code', field: 'code', header: t('dimensions.code') }, { key: 'name', field: 'name', header: t('dimensions.name') }, { key: 'column3', header: t('dimensions.openingDebit') }, { key: 'column4', header: t('dimensions.openingCredit') }, { key: 'column5', header: t('dimensions.periodDebit') }, { key: 'column6', header: t('dimensions.periodCredit') }]"
              >
                <template #cell-name="{ row }">{{ row.dimension_value_id ? row.name : t('dimensions.unassigned') }}</template>
                <template #cell-column3="{ row }">
                  <BsMoneyText :amount="row.opening_debit_minor" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" />
                </template>
                <template #cell-column4="{ row }">
                  <BsMoneyText :amount="row.opening_credit_minor" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" />
                </template>
                <template #cell-column5="{ row }">
                  <BsMoneyText :amount="row.period_debit_minor" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" />
                </template>
                <template #cell-column6="{ row }">
                  <BsMoneyText :amount="row.period_credit_minor" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" />
                </template>
              </BsDataTable>
            </BsCard>
          </template>
        </BsStack>
      </template>
    </template>
    <BsRecordActionDialog
      v-model:visible="visible"
      :title="valueForm.id ? t('dimensions.edit') : t('dimensions.add')"
      :pending="saving"
      :dirty="dirty"
      :error="formError"
      :submit-label="t('common.save')"
      :cancel-label="t('common.cancel')"
      :submit-disabled="readOnly"
      @submit="saveValue"
    >
      <BsFloatingField :label="t('dimensions.kind')">
        <BsSelect v-model="valueForm.kind" :disabled="Boolean(valueForm.id)" native>
          <BsSelectOption value="cost_center">{{ t('dimensions.kinds.cost_center') }}</BsSelectOption>
          <BsSelectOption value="project">{{ t('dimensions.kinds.project') }}</BsSelectOption>
        </BsSelect>
      </BsFloatingField>
      <BsFloatingField :label="t('dimensions.code')">
        <BsInput v-model="valueForm.code" required maxlength="50" />
      </BsFloatingField>
      <BsFloatingField :label="t('dimensions.name')">
        <BsInput v-model="valueForm.name" required maxlength="160" />
      </BsFloatingField>
      <BsFloatingField :label="t('dimensions.description')">
        <BsTextarea v-model="valueForm.description" maxlength="500" />
      </BsFloatingField>
    </BsRecordActionDialog>
    <BsRecordActionDialog
      v-model:visible="policyOpen"
      :title="t('dimensions.policies')"
      :pending="policySaving"
      :dirty="policyDirty"
      :error="policyError"
      :submit-label="t('common.save')"
      :cancel-label="t('common.cancel')"
      :submit-disabled="readOnly"
      @submit="savePolicy"
    >
      <BsFloatingField :label="t('dimensions.account')">
        <BsSelect v-model="policy.accountId" required native>
          <BsSelectOption value="" />
          <BsSelectOption v-for="account in workspace?.accounts.filter(item=>!item.archived)" :key="account.id" :value="account.id">{{ account.code }} · {{ account.name }}</BsSelectOption>
        </BsSelect>
      </BsFloatingField>
      <BsFloatingField :label="t('dimensions.kind')">
        <BsSelect v-model="policy.kind" native>
          <BsSelectOption value="cost_center">{{ t('dimensions.kinds.cost_center') }}</BsSelectOption>
          <BsSelectOption value="project">{{ t('dimensions.kinds.project') }}</BsSelectOption>
        </BsSelect>
      </BsFloatingField>
      <BsFloatingField :label="t('dimensions.requirement')">
        <BsSelect v-model="policy.requirement" native>
          <BsSelectOption value="optional">{{ t('dimensions.requirements.optional') }}</BsSelectOption>
          <BsSelectOption value="required">{{ t('dimensions.requirements.required') }}</BsSelectOption>
        </BsSelect>
      </BsFloatingField>
    </BsRecordActionDialog>
  </BsStack>
</template>
