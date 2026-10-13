<script setup lang="ts">
import { formatPresentationMoney } from '@building-suit/ui/utils/presentation'
import type { BsAssetRegisterCopy, BsAssetRegisterView, BsAssetRegisterForm, BsAssetRegisterChoices } from '@building-suit/ui/types/assetRegisterPresentation'
import { assetTotals } from '~/utils/fixedAssets'
import type { AssetEventRow, AssetScheduleRow, FixedAssetRow } from '~/utils/fixedAssets'
import { minorUnitFor } from '~/utils/money'

definePageMeta({ layout: 'default' })
const { t, locale } = useI18n()
const { can, currentId } = useTenant()
const user = useSupabaseUser()
const { readOnly } = useBilling()
const toasts = useToasts()
const { asOfDate, data, pending, error, load, command } = useFixedAssets()
useHead({ title: () => `${t('assets.title')} · ${t('app.name')}` })

const selectedId = ref('')
const selected = computed(() => data.value?.assets.find(asset => asset.id === selectedId.value) ?? data.value?.assets[0] ?? null)
const schedule = computed(() => data.value?.schedule.filter(row => row.asset_id === selected.value?.id) ?? [])
const events = computed(() => data.value?.events.filter(row => row.asset_id === selected.value?.id) ?? [])
const reversedEventIds = computed(() => new Set(data.value?.events.map(event => event.reverses_event_id).filter(Boolean)))
const totals = computed(() => assetTotals(data.value?.assets ?? []))
const balanced = computed(() => data.value?.reconciliation.every(row => BigInt(row.variance_minor) === 0n) ?? true)
watch(() => data.value?.assets, (assets) => { if (!assets?.some(asset => asset.id === selectedId.value)) selectedId.value = assets?.[0]?.id ?? '' })
watch([currentId, () => user.value?.id], () => { selectedId.value = ''; visible.value = false }, { flush: 'sync' })

type Mode = 'register' | 'dispose' | 'impair' | 'policy' | 'reverse'
const form = reactive({ mode: 'register' as Mode, target: '', code: '', name: '', description: '', journal: '', acquisitionDate: '', serviceDate: '', cost: '', residual: '0', life: '60', method: 'straight_line' as 'straight_line' | 'declining_balance', rate: '', costAccount: '', accumulatedAccount: '', expenseAccount: '', impairmentAccount: '', gainLossAccount: '', date: '', proceeds: '0', proceedsAccount: '', reason: '' })
const { visible, pending: saving, dirty, open, complete } = useRecordAction(() => form)
const formError = ref('')
const selectedJournal = computed(() => data.value?.acquisition_journals.find(item => item.id === form.journal) ?? null)
const currency = computed(() => selectedJournal.value?.currency ?? selected.value?.currency ?? 'EGP')
const postingAccounts = computed(() => data.value?.accounts.filter(account => account.role === 'posting') ?? [])
const costAccounts = computed(() => postingAccounts.value.filter(account => account.type === 'asset'))
const accumulatedAccounts = computed(() => postingAccounts.value.filter(account => account.type === 'asset' && account.normal_balance === 'credit' && (!form.costAccount || account.contra_account_id === form.costAccount)))
const expenseAccounts = computed(() => postingAccounts.value.filter(account => account.type === 'expense'))
const gainLossAccounts = computed(() => postingAccounts.value.filter(account => account.type === 'expense' || account.type === 'revenue'))
const proceedsAccounts = computed(() => postingAccounts.value.filter(account => account.type === 'asset' || account.type === 'liability'))
watch(selectedJournal, (journal) => { if (journal) form.acquisitionDate = journal.date })

function begin(mode: Mode, target?: FixedAssetRow | AssetEventRow) {
  const asset = target && 'cost_minor' in target ? target : mode === 'register' ? null : selected.value
  Object.assign(form, { mode, target: target?.id ?? asset?.id ?? '', code: '', name: '', description: '', journal: '', acquisitionDate: '', serviceDate: '', cost: '', residual: asset ? minorToInput(asset.residual_minor, asset.currency) : '0', life: String(asset?.life_months ?? 60), method: asset?.method ?? 'straight_line', rate: asset?.rate_basis_points ? String(asset.rate_basis_points / 100) : '', costAccount: '', accumulatedAccount: '', expenseAccount: '', impairmentAccount: '', gainLossAccount: '', date: asOfDate.value, proceeds: '0', proceedsAccount: '', reason: '' })
  formError.value = ''; open()
}
function minorToInput(value: string, code: string) {
  const minor = BigInt(value); const exponent = minorUnitFor(code)
  if (!exponent) return minor.toString()
  const negative = minor < 0n ? '-' : ''; const digits = (minor < 0n ? -minor : minor).toString().padStart(exponent + 1, '0')
  return `${negative}${digits.slice(0, -exponent)}.${digits.slice(-exponent)}`
}
function errorMessage(failure: unknown) {
  const message = typeof failure === 'object' && failure && 'message' in failure ? String(failure.message) : ''
  if (message.includes('ACQUISITION')) return t('assets.errors.acquisition')
  if (message.includes('ACCOUNT_MAPPING')) return t('assets.errors.accounts')
  if (message.includes('PRIOR_DEPRECIATION') || message.includes('DEPRECIATION_DUE')) return t('assets.errors.depreciationDue')
  if (message.includes('PERIOD') || message.includes('BOOKS_LOCKED')) return t('assets.errors.period')
  if (message.includes('NEXT_OPEN')) return t('assets.errors.nextOpen')
  if (message.includes('IDEMPOTENCY')) return t('assets.errors.retry')
  return t('assets.errors.save')
}
async function save() {
  if (saving.value) return
  const organization = currentId.value; const actor = user.value?.id
  formError.value = ''; saving.value = true
  try {
    const key = crypto.randomUUID()
    if (form.mode === 'register') await command('register_fixed_asset', {
      p_asset_code: form.code, p_name: form.name, p_description: form.description || null, p_acquisition_transaction_id: form.journal,
      p_cost_account_id: form.costAccount, p_accumulated_depreciation_account_id: form.accumulatedAccount, p_depreciation_expense_account_id: form.expenseAccount,
      p_impairment_expense_account_id: form.impairmentAccount, p_gain_loss_account_id: form.gainLossAccount,
      p_acquisition_cost_minor: parseMoneyToMinor(form.cost, currency.value).toString(), p_acquisition_date: form.acquisitionDate, p_in_service_date: form.serviceDate,
      p_useful_life_months: Number(form.life), p_residual_value_minor: parseMoneyToMinor(form.residual, currency.value).toString(), p_method: form.method,
      p_declining_rate_basis_points: form.method === 'declining_balance' ? Math.round(Number(form.rate) * 100) : null, p_replaces_asset_id: form.target || null, p_idempotency_key: key,
    })
    else if (form.mode === 'dispose') await command('dispose_fixed_asset', { p_asset_id: form.target, p_disposal_date: form.date, p_proceeds_minor: parseMoneyToMinor(form.proceeds, currency.value).toString(), p_proceeds_account_id: form.proceedsAccount || null, p_reason: form.reason, p_idempotency_key: key })
    else if (form.mode === 'impair') await command('record_asset_impairment', { p_asset_id: form.target, p_date: form.date, p_amount_minor: parseMoneyToMinor(form.cost, currency.value).toString(), p_reason: form.reason, p_idempotency_key: key })
    else if (form.mode === 'policy') await command('change_asset_depreciation_policy', { p_asset_id: form.target, p_effective_from: form.date, p_residual_value_minor: parseMoneyToMinor(form.residual, currency.value).toString(), p_useful_life_months: Number(form.life), p_method: form.method, p_declining_rate_basis_points: form.method === 'declining_balance' ? Math.round(Number(form.rate) * 100) : null, p_reason: form.reason, p_idempotency_key: key })
    else await command('reverse_fixed_asset_event', { p_event_id: form.target, p_reversal_date: form.date, p_reason: form.reason, p_idempotency_key: key })
    if (organization !== currentId.value || actor !== user.value?.id) return
    complete(); toasts.success(t('assets.saved'))
  }
  catch (failure) { if (organization === currentId.value && actor === user.value?.id) formError.value = errorMessage(failure) }
  finally { saving.value = false }
}
async function post(row: AssetScheduleRow) {
  try { await command('post_asset_depreciation', { p_schedule_id: row.id, p_idempotency_key: crypto.randomUUID() }); toasts.success(t('assets.depreciationPosted')) }
  catch (failure) { toasts.error(t('assets.errors.title'), errorMessage(failure)) }
}
const ledgerPresentation = useLedgerPresentation()

const assetCopy = computed<BsAssetRegisterCopy>(() => ({
  assets_account: t('assets.account'),
  assets_accumulated: t('assets.accumulated'),
  assets_accumulatedAccount: t('assets.accumulatedAccount'),
  assets_acquisitionDate: t('assets.acquisitionDate'),
  assets_acquisitionJournal: t('assets.acquisitionJournal'),
  assets_actions: t('assets.actions'),
  assets_asOf: t('assets.asOf'),
  assets_changePolicy: t('assets.changePolicy'),
  assets_closingNbv: t('assets.closingNbv'),
  assets_code: t('assets.code'),
  assets_cost: t('assets.cost'),
  assets_costAccount: t('assets.costAccount'),
  assets_date: t('assets.date'),
  assets_denied: t('assets.denied'),
  assets_depreciation: t('assets.depreciation'),
  assets_dispose: t('assets.dispose'),
  assets_effectiveDate: t('assets.effectiveDate'),
  assets_empty: t('assets.empty'),
  assets_emptyHint: t('assets.emptyHint'),
  assets_errors_load: t('assets.errors.load'),
  assets_expenseAccount: t('assets.expenseAccount'),
  assets_gainLossAccount: t('assets.gainLossAccount'),
  assets_glBalance: t('assets.glBalance'),
  assets_history: t('assets.history'),
  assets_impair: t('assets.impair'),
  assets_impairmentAccount: t('assets.impairmentAccount'),
  assets_impairmentAmount: t('assets.impairmentAmount'),
  assets_journal: t('assets.journal'),
  assets_life: t('assets.life'),
  assets_method: t('assets.method'),
  assets_methods_declining_balance: t('assets.methods.declining_balance'),
  assets_methods_straight_line: t('assets.methods.straight_line'),
  assets_name: t('assets.name'),
  assets_nbv: t('assets.nbv'),
  assets_noSchedule: t('assets.noSchedule'),
  assets_periodEnd: t('assets.periodEnd'),
  assets_periodStart: t('assets.periodStart'),
  assets_policy: t('assets.policy'),
  assets_post: t('assets.post'),
  assets_proceeds: t('assets.proceeds'),
  assets_proceedsAccount: t('assets.proceedsAccount'),
  assets_rate: t('assets.rate'),
  assets_reason: t('assets.reason'),
  assets_reconciled: t('assets.reconciled'),
  assets_reconciliation: t('assets.reconciliation'),
  assets_register: t('assets.register'),
  assets_registerBalance: t('assets.registerBalance'),
  assets_registerReplacement: t('assets.registerReplacement'),
  assets_registerTitle: t('assets.registerTitle'),
  assets_residual: t('assets.residual'),
  assets_retry: t('assets.retry'),
  assets_reverse: t('assets.reverse'),
  assets_review: t('assets.review'),
  assets_schedule: t('assets.schedule'),
  assets_serviceDate: t('assets.serviceDate'),
  assets_statusLabel: t('assets.statusLabel'),
  assets_title: t('assets.title'),
  assets_variance: t('assets.variance'),
  common_cancel: t('common.cancel'),
  common_save: t('common.save'),
  pageContext_label: t('pageContext.label'),
}))

const assetForm = computed<BsAssetRegisterForm>({ get: () => ({ code: form.code, name: form.name, description: form.description, journal: form.journal, acquisitionDate: form.acquisitionDate, serviceDate: form.serviceDate, cost: form.cost, residual: form.residual, life: form.life, method: form.method, rate: form.rate, costAccount: form.costAccount, accumulatedAccount: form.accumulatedAccount, expenseAccount: form.expenseAccount, impairmentAccount: form.impairmentAccount, gainLossAccount: form.gainLossAccount, date: form.date, proceeds: form.proceeds, proceedsAccount: form.proceedsAccount, reason: form.reason }), set: value => { const { method, ...fields } = value; Object.assign(form, fields); if (method === 'straight_line' || method === 'declining_balance') form.method = method } })
const assetMoney = (value: string, currency?: string) => formatPresentationMoney(value, { currency: ledgerPresentation.currency(currency), locale: locale.value, unit: 'minor', numberingSystem: 'latn' })
const assetView = computed<BsAssetRegisterView>(() => ({ context: ledgerPresentation.context(undefined, undefined, asOfDate.value), contextLabel: t('pageContext.label'), canRead: can('assets.read'), canRegister: can('assets.register'), registerDisabled: readOnly.value || !data.value?.acquisition_journals.length, pending: pending.value, failed: Boolean(error.value), available: Boolean(data.value), readOnly: readOnly.value, totals: { cost: assetMoney(totals.value.cost.toString()), accumulated: assetMoney(totals.value.accumulated.toString()), nbv: assetMoney(totals.value.nbv.toString()) }, assets: (data.value?.assets ?? []).map(row => ({ id: row.id, code: row.code, name: row.name, statusLabel: t(`assets.status.${row.status}`), cost: assetMoney(row.cost_minor, row.currency), accumulated: assetMoney(row.accumulated_minor, row.currency), nbv: assetMoney(row.nbv_minor, row.currency) })), selected: selected.value ? { id: selected.value.id, code: selected.value.code, name: selected.value.name, description: `${t(`assets.methods.${selected.value.method}`)} · ${t('assets.lifeValue', { months: selected.value.life_months })} · ${selected.value.in_service_date}`, journalTo: `/transactions?q=${encodeURIComponent(selected.value.acquisition_transaction_id)}`, actions: selected.value.status === 'active' ? [...(can('assets.adjust') ? [{ id: 'policy', label: t('assets.changePolicy'), primary: false, disabled: readOnly.value }, { id: 'impair', label: t('assets.impair'), primary: false, disabled: readOnly.value }] : []), ...(can('assets.dispose') ? [{ id: 'dispose', label: t('assets.dispose'), primary: false, disabled: readOnly.value }] : [])] : selected.value.status === 'corrected' && can('assets.register') ? [{ id: 'register', label: t('assets.registerReplacement'), primary: true, disabled: readOnly.value || !data.value?.acquisition_journals.length }] : [] } : null, schedule: schedule.value.map(row => ({ id: row.id, periodStart: row.period_start, periodEnd: row.period_end, amount: assetMoney(row.amount_minor, selected.value?.currency), closing: assetMoney(row.closing_nbv_minor, selected.value?.currency), statusLabel: t(`assets.scheduleStatus.${row.status}`), canPost: row.status === 'scheduled' && can('assets.depreciate') })), reconciliation: (data.value?.reconciliation ?? []).map(row => ({ id: row.account_id, account: data.value?.accounts.find(account => account.id === row.account_id)?.name ?? '', register: assetMoney(row.register_minor), gl: assetMoney(row.gl_minor), variance: assetMoney(row.variance_minor) })), reconciled: balanced.value, reconciliationLabel: t(balanced.value ? 'assets.reconciled' : 'assets.variance'), events: events.value.map(event => ({ id: event.id, date: event.date, kind: t(`assets.events.${event.kind}`), reason: event.reason ?? '', journalTo: event.transaction_id ? `/transactions?q=${encodeURIComponent(event.transaction_id)}` : '', canReverse: event.kind !== 'reversal' && !reversedEventIds.value.has(event.id) && can('assets.reverse') })), formTitle: t(`assets.dialogs.${form.mode}`), saving: saving.value, dirty: dirty.value, formError: formError.value, registerForm: form.mode === 'register', policyForm: form.mode === 'policy', depreciationForm: ['register','policy'].includes(form.mode), disposeForm: form.mode === 'dispose', impairmentForm: form.mode === 'impair', actionForm: form.mode !== 'register', rateField: form.method === 'declining_balance', actionDateLabel: t(form.mode === 'policy' ? 'assets.effectiveDate' : 'assets.date'), constraints: { lifeMin: 1, lifeMax: 1200, rateMin: 0.01, rateMax: 100, rateStep: 0.01 } }))
const assetChoices = computed<BsAssetRegisterChoices>(() => ({ journals: (data.value?.acquisition_journals ?? []).map(journal => ({ value: journal.id, label: `${journal.date} · ${journal.reference || journal.description}` })), cost: costAccounts.value.map(account => ({ value: account.id, label: account.name })), accumulated: accumulatedAccounts.value.map(account => ({ value: account.id, label: account.name })), expense: expenseAccounts.value.map(account => ({ value: account.id, label: account.name })), gainLoss: gainLossAccounts.value.map(account => ({ value: account.id, label: account.name })), proceeds: proceedsAccounts.value.map(account => ({ value: account.id, label: account.name })), methods: ['straight_line','declining_balance'].map(value => ({ value, label: t(`assets.methods.${value}`) })) }))
function beginAsset(mode: string, id: string) { if (!['register','dispose','impair','policy','reverse'].includes(mode)) return; const target = mode === 'reverse' ? events.value.find(row => row.id === id) : data.value?.assets.find(row => row.id === id); begin(mode as Mode, target) }
function selectAsset(id: string) { selectedId.value = id }
async function postAsset(id: string) { const row = schedule.value.find(row => row.id === id); if (row) await post(row) }
</script>
<template>
  <BsAssetRegisterPage v-model:as-of-date="asOfDate" v-model:visible="visible" v-model:form="assetForm" :copy="assetCopy" :view="assetView" :choices="assetChoices" @reload="load" @begin="beginAsset" @select="selectAsset" @post="postAsset" @save="save" />
</template>
