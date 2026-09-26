<script setup lang="ts">
import { assetTotals } from '~/utils/fixedAssets'
import type { AssetEventRow, AssetScheduleRow, FixedAssetRow } from '~/utils/fixedAssets'
import { minorUnitFor } from '~/utils/money'

definePageMeta({ layout: 'default' })
const { t } = useI18n()
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
</script>

<template>
  <div class="space-y-6">
    <header class="flex flex-wrap items-start justify-between gap-3"><div><h1 class="text-h1 font-bold">{{ t('assets.title') }}</h1><p class="mt-2 text-fg-muted">{{ t('assets.policy') }}</p></div><button v-if="can('assets.register')" class="ls-btn ls-btn-primary" :disabled="readOnly || !data?.acquisition_journals.length" @click="begin('register')">{{ t('assets.register') }}</button></header>
    <p v-if="!can('assets.read')" class="ls-card p-5" role="status">{{ t('assets.denied') }}</p>
    <template v-else>
      <div class="ls-card p-4"><FloatingField :label="t('assets.asOf')"><input id="assets-as-of" v-model="asOfDate" type="date" class="ls-input"></FloatingField></div>
      <p v-if="error" class="ls-error" role="alert">{{ t('assets.errors.load') }} <button class="ls-btn" @click="load">{{ t('assets.retry') }}</button></p>
      <SectionSkeleton v-else-if="pending" variant="table" :rows="5" />
      <EmptyState v-else-if="!data?.assets.length" :title="t('assets.empty')" :description="t('assets.emptyHint')" />
      <template v-else-if="data">
        <dl class="grid gap-4 sm:grid-cols-3"><div class="ls-card p-4"><dt>{{ t('assets.cost') }}</dt><dd class="text-h2 font-bold"><MoneyText :amount-minor="totals.cost.toString()" /></dd></div><div class="ls-card p-4"><dt>{{ t('assets.accumulated') }}</dt><dd class="text-h2 font-bold"><MoneyText :amount-minor="totals.accumulated.toString()" /></dd></div><div class="ls-card p-4"><dt>{{ t('assets.nbv') }}</dt><dd class="text-h2 font-bold" data-assets-nbv><MoneyText :amount-minor="totals.nbv.toString()" /></dd></div></dl>
        <section class="ls-card overflow-hidden"><h2 class="p-4 text-h2 font-bold">{{ t('assets.registerTitle') }}</h2><BsDataTable :value="data.assets" data-key="id" :table-props="{ 'aria-label': t('assets.registerTitle') }"><Column field="code" :header="t('assets.code')" /><Column field="name" :header="t('assets.name')" /><Column :header="t('assets.statusLabel')"><template #body="{ data: row }">{{ t(`assets.status.${row.status}`) }}</template></Column><Column :header="t('assets.cost')"><template #body="{ data: row }"><MoneyText :amount-minor="row.cost_minor" :currency="row.currency" /></template></Column><Column :header="t('assets.accumulated')"><template #body="{ data: row }"><MoneyText :amount-minor="row.accumulated_minor" :currency="row.currency" /></template></Column><Column :header="t('assets.nbv')"><template #body="{ data: row }"><MoneyText :amount-minor="row.nbv_minor" :currency="row.currency" /></template></Column><Column :header="t('assets.actions')"><template #body="{ data: row }"><button class="ls-btn" @click="selectedId=row.id">{{ t('assets.review') }}</button></template></Column></BsDataTable></section>
        <section v-if="selected" class="ls-card p-5"><div class="flex flex-wrap items-start justify-between gap-3"><div><h2 class="text-h2 font-bold">{{ selected.code }} · {{ selected.name }}</h2><p>{{ t(`assets.methods.${selected.method}`) }} · {{ t('assets.lifeValue', { months: selected.life_months }) }} · {{ selected.in_service_date }}</p><NuxtLink class="text-link underline" :to="{ path: '/transactions', query: { q: selected.acquisition_transaction_id } }">{{ t('assets.acquisitionJournal') }}</NuxtLink></div><div class="flex flex-wrap gap-2"><template v-if="selected.status === 'active'"><button v-if="can('assets.adjust')" class="ls-btn" :disabled="readOnly" @click="begin('policy', selected)">{{ t('assets.changePolicy') }}</button><button v-if="can('assets.adjust')" class="ls-btn" :disabled="readOnly" @click="begin('impair', selected)">{{ t('assets.impair') }}</button><button v-if="can('assets.dispose')" class="ls-btn" :disabled="readOnly" @click="begin('dispose', selected)">{{ t('assets.dispose') }}</button></template><button v-else-if="selected.status === 'corrected' && can('assets.register')" class="ls-btn ls-btn-primary" :disabled="readOnly || !data.acquisition_journals.length" @click="begin('register', selected)">{{ t('assets.registerReplacement') }}</button></div></div></section>
        <section v-if="selected" class="ls-card overflow-hidden"><h2 class="p-4 text-h2 font-bold">{{ t('assets.schedule') }}</h2><BsDataTable :value="schedule" data-key="id" :table-props="{ 'aria-label': t('assets.schedule') }"><template #empty>{{ t('assets.noSchedule') }}</template><Column field="period_start" :header="t('assets.periodStart')" /><Column field="period_end" :header="t('assets.periodEnd')" /><Column :header="t('assets.depreciation')"><template #body="{ data: row }"><MoneyText :amount-minor="row.amount_minor" :currency="selected.currency" /></template></Column><Column :header="t('assets.closingNbv')"><template #body="{ data: row }"><MoneyText :amount-minor="row.closing_nbv_minor" :currency="selected.currency" /></template></Column><Column :header="t('assets.statusLabel')"><template #body="{ data: row }">{{ t(`assets.scheduleStatus.${row.status}`) }}</template></Column><Column :header="t('assets.actions')"><template #body="{ data: row }"><button v-if="row.status === 'scheduled' && can('assets.depreciate')" class="ls-btn" :disabled="readOnly" @click="post(row)">{{ t('assets.post') }}</button></template></Column></BsDataTable></section>
        <section class="ls-card overflow-hidden"><div class="flex items-center justify-between p-4"><h2 class="text-h2 font-bold">{{ t('assets.reconciliation') }}</h2><span :data-assets-reconciled="balanced">{{ balanced ? t('assets.reconciled') : t('assets.variance') }}</span></div><BsDataTable :value="data.reconciliation" data-key="account_id" :table-props="{ 'aria-label': t('assets.reconciliation') }"><Column :header="t('assets.account')"><template #body="{ data: row }">{{ data.accounts.find(account => account.id === row.account_id)?.name }}</template></Column><Column :header="t('assets.registerBalance')"><template #body="{ data: row }"><MoneyText :amount-minor="row.register_minor" /></template></Column><Column :header="t('assets.glBalance')"><template #body="{ data: row }"><MoneyText :amount-minor="row.gl_minor" /></template></Column><Column :header="t('assets.variance')"><template #body="{ data: row }"><MoneyText :amount-minor="row.variance_minor" /></template></Column></BsDataTable></section>
        <details v-if="selected" class="ls-card p-4"><summary class="cursor-pointer font-bold">{{ t('assets.history') }}</summary><ol class="mt-3 space-y-2"><li v-for="event in events" :key="event.id"><time>{{ event.date }}</time> · {{ t(`assets.events.${event.kind}`) }} · {{ event.reason }} <NuxtLink v-if="event.transaction_id" class="text-link underline" :to="{ path: '/transactions', query: { q: event.transaction_id } }">{{ t('assets.journal') }}</NuxtLink> <button v-if="event.kind !== 'reversal' && !reversedEventIds.has(event.id) && can('assets.reverse')" class="ls-btn ms-2" @click="begin('reverse', event)">{{ t('assets.reverse') }}</button></li></ol></details>
      </template>
    </template>

    <BsDialog v-model:visible="visible" :title="t(`assets.dialogs.${form.mode}`)" :pending="saving" :dirty="dirty" size="lg"><template #default="{ close }"><form class="space-y-4 p-5" @submit.prevent="save"><p v-if="formError" class="ls-error" role="alert">{{ formError }}</p>
      <template v-if="form.mode === 'register'"><div class="grid gap-3 sm:grid-cols-2"><FloatingField :label="t('assets.code')"><input id="asset-code" v-model="form.code" class="ls-input" required></FloatingField><FloatingField :label="t('assets.name')"><input id="asset-name" v-model="form.name" class="ls-input" required></FloatingField></div><FloatingField :label="t('assets.acquisitionJournal')"><select id="asset-journal" v-model="form.journal" class="ls-input" required><option value="" /><option v-for="journal in data?.acquisition_journals" :key="journal.id" :value="journal.id">{{ journal.date }} · {{ journal.reference || journal.description }}</option></select></FloatingField><div class="grid gap-3 sm:grid-cols-2"><FloatingField :label="t('assets.acquisitionDate')"><input id="asset-acquisition-date" v-model="form.acquisitionDate" type="date" class="ls-input" required readonly></FloatingField><FloatingField :label="t('assets.serviceDate')"><input id="asset-service-date" v-model="form.serviceDate" type="date" class="ls-input" :min="form.acquisitionDate" required></FloatingField><FloatingField :label="t('assets.cost')"><input id="asset-cost" v-model="form.cost" inputmode="decimal" class="ls-input" required></FloatingField><FloatingField :label="t('assets.residual')"><input id="asset-residual" v-model="form.residual" inputmode="decimal" class="ls-input" required></FloatingField></div><FloatingField :label="t('assets.costAccount')"><select id="asset-cost-account" v-model="form.costAccount" class="ls-input" required><option value="" /><option v-for="account in costAccounts" :key="account.id" :value="account.id">{{ account.name }}</option></select></FloatingField><FloatingField :label="t('assets.accumulatedAccount')"><select id="asset-accumulated-account" v-model="form.accumulatedAccount" class="ls-input" required><option value="" /><option v-for="account in accumulatedAccounts" :key="account.id" :value="account.id">{{ account.name }}</option></select></FloatingField><FloatingField :label="t('assets.expenseAccount')"><select id="asset-expense-account" v-model="form.expenseAccount" class="ls-input" required><option value="" /><option v-for="account in expenseAccounts" :key="account.id" :value="account.id">{{ account.name }}</option></select></FloatingField><FloatingField :label="t('assets.impairmentAccount')"><select id="asset-impairment-account" v-model="form.impairmentAccount" class="ls-input" required><option value="" /><option v-for="account in expenseAccounts" :key="account.id" :value="account.id">{{ account.name }}</option></select></FloatingField><FloatingField :label="t('assets.gainLossAccount')"><select id="asset-gain-loss-account" v-model="form.gainLossAccount" class="ls-input" required><option value="" /><option v-for="account in gainLossAccounts" :key="account.id" :value="account.id">{{ account.name }}</option></select></FloatingField></template>
      <template v-if="form.mode === 'register' || form.mode === 'policy'"><div class="grid gap-3 sm:grid-cols-2"><FloatingField :label="t('assets.life')"><input id="asset-life" v-model="form.life" type="number" min="1" max="1200" class="ls-input" required></FloatingField><FloatingField :label="t('assets.method')"><select id="asset-method" v-model="form.method" class="ls-input"><option value="straight_line">{{ t('assets.methods.straight_line') }}</option><option value="declining_balance">{{ t('assets.methods.declining_balance') }}</option></select></FloatingField><FloatingField v-if="form.method === 'declining_balance'" :label="t('assets.rate')"><input id="asset-rate" v-model="form.rate" type="number" min="0.01" max="100" step="0.01" class="ls-input" required></FloatingField><FloatingField v-if="form.mode === 'policy'" :label="t('assets.residual')"><input id="asset-policy-residual" v-model="form.residual" class="ls-input" required></FloatingField></div></template>
      <template v-if="form.mode === 'dispose'"><FloatingField :label="t('assets.proceeds')"><input id="asset-proceeds" v-model="form.proceeds" class="ls-input" required></FloatingField><FloatingField :label="t('assets.proceedsAccount')"><select id="asset-proceeds-account" v-model="form.proceedsAccount" class="ls-input"><option value="" /><option v-for="account in proceedsAccounts" :key="account.id" :value="account.id">{{ account.name }}</option></select></FloatingField></template>
      <FloatingField v-if="form.mode === 'impair'" :label="t('assets.impairmentAmount')"><input id="asset-impairment" v-model="form.cost" class="ls-input" required></FloatingField>
      <template v-if="form.mode !== 'register'"><FloatingField :label="form.mode === 'policy' ? t('assets.effectiveDate') : t('assets.date')"><input id="asset-action-date" v-model="form.date" type="date" class="ls-input" required></FloatingField><FloatingField :label="t('assets.reason')"><input id="asset-reason" v-model="form.reason" class="ls-input" required></FloatingField></template>
      <div class="flex justify-end gap-2"><button type="button" class="ls-btn" @click="close">{{ t('common.cancel') }}</button><button type="submit" class="ls-btn ls-btn-primary" :disabled="saving || readOnly">{{ t('common.save') }}</button></div></form></template></BsDialog>
  </div>
</template>
