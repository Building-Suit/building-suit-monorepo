<script setup lang="ts">
import type { BsDimensionValueForm, BsDimensionPolicyForm, BsDimensionReportFilter, BsDimensionsCopy } from '@building-suit/ui/dimension-presentation'
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
const pageCopy = computed<BsDimensionsCopy>(() => ({ title: t('dimensions.title'), denied: t('dimensions.denied'), values: t('dimensions.values'), policies: t('dimensions.policies'), policiesHint: t('dimensions.policiesHint'), add: t('dimensions.add'), edit: t('dimensions.edit'), archive: t('dimensions.archive'), kind: t('dimensions.kind'), code: t('dimensions.code'), name: t('dimensions.name'), description: t('dimensions.description'), empty: t('dimensions.empty'), account: t('dimensions.account'), requirement: t('dimensions.requirement'), reportType: t('dimensions.reportType'), from: t('dimensions.from'), to: t('dimensions.to'), filter: t('dimensions.filter'), run: t('dimensions.run'), reconciled: t('dimensions.reconciled'), notReconciled: t('dimensions.notReconciled'), grouped: t('dimensions.grouped'), openingDebit: t('dimensions.openingDebit'), openingCredit: t('dimensions.openingCredit'), periodDebit: t('dimensions.periodDebit'), periodCredit: t('dimensions.periodCredit'), subtitle: t('dimensions.policy'), loadError: t('dimensions.errors.load'), status: t('dimensions.statusLabel'), retry: t('common.retry'), save: t('common.save'), cancel: t('common.cancel') }))
const valuePresentationForm = computed<BsDimensionValueForm>({ get: () => ({ ...valueForm }), set: value => { Object.assign(valueForm, { ...value, kind: value.kind as DimensionKind }) } })
const policyPresentationForm = computed<BsDimensionPolicyForm>({ get: () => ({ ...policy }), set: value => { Object.assign(policy, { ...value, kind: value.kind as DimensionKind, requirement: value.requirement as 'optional' | 'required' }) } })
const reportPresentationFilter = computed<BsDimensionReportFilter>({ get: () => ({ ...reportFilter }), set: value => { Object.assign(reportFilter, { ...value, kind: value.kind as DimensionKind, report: value.report as typeof reportFilter.report }) } })
const dimensionViews = computed(() => (workspace.value?.values ?? []).map(value => ({ id: value.id, kindLabel: t(`dimensions.kinds.${value.kind}`), code: value.code, name: value.name, statusLabel: t(`dimensions.status.${value.status}`), editable: value.status === 'active' })))
const policyViews = computed(() => (workspace.value?.policies ?? []).map(value => ({ id: `${value.account_id}:${value.kind}`, accountName: workspace.value?.accounts.find(account => account.id === value.account_id)?.name || '', kindLabel: t(`dimensions.kinds.${value.kind}`), requirementLabel: t(`dimensions.requirements.${value.requirement}`) })))
const reportViews = computed(() => report.value ? report.value.groups.map((value, index) => ({ id: `${value.dimension_value_id ?? 'unassigned'}:${value.code}:${index}`, code: value.code, name: value.dimension_value_id ? value.name : t('dimensions.unassigned'), openingDebit: value.opening_debit_minor, openingCredit: value.opening_credit_minor, periodDebit: value.period_debit_minor, periodCredit: value.period_credit_minor })) : null)
const kindOptions = computed(() => ['cost_center', 'project'].map(value => ({ value, label: t(`dimensions.kinds.${value}`) })))
const reportOptions = computed(() => ['general_ledger', 'trial_balance', 'profit_loss', 'balance_sheet', 'cash_flow'].map(value => ({ value, label: t(`dimensions.reports.${value}`) })))
const requirementOptions = computed(() => ['optional', 'required'].map(value => ({ value, label: t(`dimensions.requirements.${value}`) })))
const valueOptions = computed(() => [{ value: '', label: t('common.any') }, ...(workspace.value?.values ?? []).filter(value => value.kind === reportFilter.kind).map(value => ({ value: value.id, label: `${value.code} · ${value.name}${value.status === 'inactive' ? ` (${t('dimensions.status.inactive')})` : ''}` }))])
const accountOptions = computed(() => (workspace.value?.accounts ?? []).filter(value => !value.archived).map(value => ({ value: value.id, label: `${value.code} · ${value.name}` })))
const pageTabs = computed(() => ['values', 'policies', ...(can('reports.read') ? ['reports'] : [])].map(value => ({ value, label: t(`dimensions.tabs.${value}`) })))
function editValueById(id: string) { const value = workspace.value?.values.find(value => value.id === id); if (value) editValue(value) }
function archiveValueById(id: string) { const value = workspace.value?.values.find(value => value.id === id); if (value) void archive(value) }
function editPolicyById(id: string) { const value = workspace.value?.policies.find(value => `${value.account_id}:${value.kind}` === id); if (value) editPolicy(value) }
</script>

<template>
  <BsAccountingDimensionsPage
    v-model:value-form="valuePresentationForm" v-model:policy="policyPresentationForm" v-model:report-filter="reportPresentationFilter" v-model:visible="visible" v-model:policy-open="policyOpen"
    :tab="tab" :copy="pageCopy" :context="ledgerPresentation.context(tab === 'reports' ? reportFilter.from : undefined, tab === 'reports' ? reportFilter.to : undefined, undefined)" :context-label="ledgerPresentation.t('pageContext.label')"
    :tabs="pageTabs" :can-read="can('dimensions.read')" :can-manage="can('dimensions.manage') && !readOnly" :can-configure="can('dimensions.configure') && !readOnly" :read-only="readOnly"
    :available="Boolean(workspace)" :pending="pending" :error="Boolean(error)" :legacy-warning="workspace?.legacy_uncontrolled_count ? t('dimensions.legacyWarning', { count: workspace.legacy_uncontrolled_count }) : undefined"
    :values="dimensionViews" :policies="policyViews" :groups="reportViews" :reconciled="reconciled" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale"
    :kind-options="kindOptions" :report-options="reportOptions" :value-options="valueOptions" :account-options="accountOptions" :requirement-options="requirementOptions"
    :saving="saving" :dirty="dirty" :form-error="formError" :policy-saving="policySaving" :policy-dirty="policyDirty" :policy-error="policyError"
    @update:tab="tab = $event as 'values' | 'policies' | 'reports'" @retry="load" @create-value="editValue()" @edit-value="editValueById" @archive-value="archiveValueById" @create-policy="editPolicy()" @edit-policy="editPolicyById" @save-value="saveValue" @save-policy="savePolicy" @run-report="runReport"
  />
</template>
