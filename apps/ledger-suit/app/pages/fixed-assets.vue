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
const ledgerPresentation = useLedgerPresentation()
</script>

<template>
  <BsStack gap="lg">
    <BsPageHeader
      :title="t('assets.title')"
      :subtitle="t('assets.policy')"
      :context="ledgerPresentation.context(undefined, undefined, asOfDate)"
      :context-label="ledgerPresentation.t('pageContext.label')"
    >
      <template #actions>
        <BsButton
          v-if="can('assets.register')"
          type="submit"
          :disabled="readOnly || !data?.acquisition_journals.length"
          variant="primary"
          @click="begin('register')"
        >{{ t('assets.register') }}</BsButton>
      </template>
    </BsPageHeader>
    <BsText v-if="!can('assets.read')" role="status">{{ t('assets.denied') }}</BsText>
    <template v-else>
      <BsCard as="div" padding="md">
        <BsFloatingField :label="t('assets.asOf')">
          <BsInput id="assets-as-of" v-model="asOfDate" type="date" />
        </BsFloatingField>
      </BsCard>
      <BsText v-if="error" role="alert" tone="danger">{{ t('assets.errors.load') }} <BsButton type="submit" @click="load">{{ t('assets.retry') }}</BsButton></BsText>
      <BsSectionSkeleton v-else-if="pending" variant="table" :rows="5" />
      <BsEmptyState v-else-if="!data?.assets.length" :title="t('assets.empty')" :description="t('assets.emptyHint')" />
      <template v-else-if="data">
        <BsDescriptionList :columns="3">
          <BsCard as="div" padding="md">
            <BsDescriptionTerm>{{ t('assets.cost') }}</BsDescriptionTerm>
            <BsDescriptionValue>
              <BsMoneyText :amount="totals.cost.toString()" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" />
            </BsDescriptionValue>
          </BsCard>
          <BsCard as="div" padding="md">
            <BsDescriptionTerm>{{ t('assets.accumulated') }}</BsDescriptionTerm>
            <BsDescriptionValue>
              <BsMoneyText :amount="totals.accumulated.toString()" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" />
            </BsDescriptionValue>
          </BsCard>
          <BsCard as="div" padding="md">
            <BsDescriptionTerm>{{ t('assets.nbv') }}</BsDescriptionTerm>
            <BsDescriptionValue data-assets-nbv>
              <BsMoneyText :amount="totals.nbv.toString()" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" />
            </BsDescriptionValue>
          </BsCard>
        </BsDescriptionList>
        <BsCard as="section" padding="none" overflow="hidden">
          <BsHeading :level="2" size="h2">{{ t('assets.registerTitle') }}</BsHeading>
          <BsDataTable
            :value="data.assets"
            row-key="id"
            :label="t('assets.registerTitle')"
            :columns="[{ key: 'code', field: 'code', header: t('assets.code') }, { key: 'name', field: 'name', header: t('assets.name') }, { key: 'column3', header: t('assets.statusLabel') }, { key: 'column4', header: t('assets.cost') }, { key: 'column5', header: t('assets.accumulated') }, { key: 'column6', header: t('assets.nbv') }, { key: 'column7', header: t('assets.actions') }]"
          >
            <template #cell-column3="{ row }">{{ t(`assets.status.${row.status}`) }}</template>
            <template #cell-column4="{ row }">
              <BsMoneyText :amount="row.cost_minor" :currency="ledgerPresentation.currency(row.currency)" :locale="ledgerPresentation.locale" />
            </template>
            <template #cell-column5="{ row }">
              <BsMoneyText :amount="row.accumulated_minor" :currency="ledgerPresentation.currency(row.currency)" :locale="ledgerPresentation.locale" />
            </template>
            <template #cell-column6="{ row }">
              <BsMoneyText :amount="row.nbv_minor" :currency="ledgerPresentation.currency(row.currency)" :locale="ledgerPresentation.locale" />
            </template>
            <template #cell-column7="{ row }">
              <BsButton type="submit" @click="selectedId=row.id">{{ t('assets.review') }}</BsButton>
            </template>
          </BsDataTable>
        </BsCard>
        <BsCard v-if="selected" as="section" padding="md">
          <BsInline gap="md" :wrap="true" align="start" justify="between">
            <BsBox>
              <BsHeading :level="2" size="h2">{{ selected.code }} · {{ selected.name }}</BsHeading>
              <BsText>{{ t(`assets.methods.${selected.method}`) }} · {{ t('assets.lifeValue', { months: selected.life_months }) }} · {{ selected.in_service_date }}</BsText>
              <BsLink :to="{ path: '/transactions', query: { q: selected.acquisition_transaction_id } }">{{ t('assets.acquisitionJournal') }}</BsLink>
            </BsBox>
            <BsInline gap="sm" :wrap="true">
              <template v-if="selected.status === 'active'">
                <BsButton v-if="can('assets.adjust')" type="submit" :disabled="readOnly" @click="begin('policy', selected)">{{ t('assets.changePolicy') }}</BsButton>
                <BsButton v-if="can('assets.adjust')" type="submit" :disabled="readOnly" @click="begin('impair', selected)">{{ t('assets.impair') }}</BsButton>
                <BsButton v-if="can('assets.dispose')" type="submit" :disabled="readOnly" @click="begin('dispose', selected)">{{ t('assets.dispose') }}</BsButton>
              </template>
              <BsButton
                v-else-if="selected.status === 'corrected' && can('assets.register')"
                type="submit"
                :disabled="readOnly || !data.acquisition_journals.length"
                variant="primary"
                @click="begin('register', selected)"
              >{{ t('assets.registerReplacement') }}</BsButton>
            </BsInline>
          </BsInline>
        </BsCard>
        <BsCard v-if="selected" as="section" padding="none" overflow="hidden">
          <BsHeading :level="2" size="h2">{{ t('assets.schedule') }}</BsHeading>
          <BsDataTable
            :value="schedule"
            row-key="id"
            :label="t('assets.schedule')"
            :columns="[{ key: 'period_start', field: 'period_start', header: t('assets.periodStart') }, { key: 'period_end', field: 'period_end', header: t('assets.periodEnd') }, { key: 'column3', header: t('assets.depreciation') }, { key: 'column4', header: t('assets.closingNbv') }, { key: 'column5', header: t('assets.statusLabel') }, { key: 'column6', header: t('assets.actions') }]"
          >
            <template #empty>{{ t('assets.noSchedule') }}</template>
            <template #cell-column3="{ row }">
              <BsMoneyText :amount="row.amount_minor" :currency="ledgerPresentation.currency(selected.currency)" :locale="ledgerPresentation.locale" />
            </template>
            <template #cell-column4="{ row }">
              <BsMoneyText :amount="row.closing_nbv_minor" :currency="ledgerPresentation.currency(selected.currency)" :locale="ledgerPresentation.locale" />
            </template>
            <template #cell-column5="{ row }">{{ t(`assets.scheduleStatus.${row.status}`) }}</template>
            <template #cell-column6="{ row }">
              <BsButton v-if="row.status === 'scheduled' && can('assets.depreciate')" type="submit" :disabled="readOnly" @click="post(row)">{{ t('assets.post') }}</BsButton>
            </template>
          </BsDataTable>
        </BsCard>
        <BsCard as="section" padding="none" overflow="hidden">
          <BsInline gap="none" :wrap="false" justify="between" padding="lg">
            <BsHeading :level="2" size="h2">{{ t('assets.reconciliation') }}</BsHeading>
            <BsText :data-assets-reconciled="balanced" as="span">{{ balanced ? t('assets.reconciled') : t('assets.variance') }}</BsText>
          </BsInline>
          <BsDataTable
            :value="data.reconciliation"
            row-key="account_id"
            :label="t('assets.reconciliation')"
            :columns="[{ key: 'column1', header: t('assets.account') }, { key: 'column2', header: t('assets.registerBalance') }, { key: 'column3', header: t('assets.glBalance') }, { key: 'column4', header: t('assets.variance') }]"
          >
            <template #cell-column1="{ row }">{{ data.accounts.find(account => account.id === row.account_id)?.name }}</template>
            <template #cell-column2="{ row }">
              <BsMoneyText :amount="row.register_minor" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" />
            </template>
            <template #cell-column3="{ row }">
              <BsMoneyText :amount="row.gl_minor" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" />
            </template>
            <template #cell-column4="{ row }">
              <BsMoneyText :amount="row.variance_minor" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" />
            </template>
          </BsDataTable>
        </BsCard>
        <BsDisclosure v-if="selected">
          <template #summary>{{ t('assets.history') }}</template>
          <BsList :ordered="true" marker="none">
            <BsListItem v-for="event in events" :key="event.id"><BsText as="time">{{ event.date }}</BsText> · {{ t(`assets.events.${event.kind}`) }} · {{ event.reason }} <BsLink v-if="event.transaction_id" :to="{ path: '/transactions', query: { q: event.transaction_id } }">{{ t('assets.journal') }}</BsLink> <BsButton v-if="event.kind !== 'reversal' && !reversedEventIds.has(event.id) && can('assets.reverse')" type="submit" @click="begin('reverse', event)">{{ t('assets.reverse') }}</BsButton></BsListItem>
          </BsList>
        </BsDisclosure>
      </template>
    </template>
    <BsRecordActionDialog
      v-model:visible="visible"
      :title="t(`assets.dialogs.${form.mode}`)"
      :pending="saving"
      :dirty="dirty"
      :error="formError"
      size="lg"
      :submit-label="t('common.save')"
      :cancel-label="t('common.cancel')"
      :submit-disabled="readOnly"
      @submit="save"
    >
      <template v-if="form.mode === 'register'">
        <BsGrid :columns="2" gap="md">
          <BsFloatingField :label="t('assets.code')">
            <BsInput id="asset-code" v-model="form.code" required />
          </BsFloatingField>
          <BsFloatingField :label="t('assets.name')">
            <BsInput id="asset-name" v-model="form.name" required />
          </BsFloatingField>
        </BsGrid>
        <BsFloatingField :label="t('assets.acquisitionJournal')">
          <BsSelect id="asset-journal" v-model="form.journal" required native>
            <BsSelectOption value="" />
            <BsSelectOption v-for="journal in data?.acquisition_journals" :key="journal.id" :value="journal.id">{{ journal.date }} · {{ journal.reference || journal.description }}</BsSelectOption>
          </BsSelect>
        </BsFloatingField>
        <BsGrid :columns="2" gap="md">
          <BsFloatingField :label="t('assets.acquisitionDate')">
            <BsInput id="asset-acquisition-date" v-model="form.acquisitionDate" type="date" required readonly />
          </BsFloatingField>
          <BsFloatingField :label="t('assets.serviceDate')">
            <BsInput id="asset-service-date" v-model="form.serviceDate" type="date" :min="form.acquisitionDate" required />
          </BsFloatingField>
          <BsFloatingField :label="t('assets.cost')">
            <BsInput id="asset-cost" v-model="form.cost" inputmode="decimal" required />
          </BsFloatingField>
          <BsFloatingField :label="t('assets.residual')">
            <BsInput id="asset-residual" v-model="form.residual" inputmode="decimal" required />
          </BsFloatingField>
        </BsGrid>
        <BsFloatingField :label="t('assets.costAccount')">
          <BsSelect id="asset-cost-account" v-model="form.costAccount" required native>
            <BsSelectOption value="" />
            <BsSelectOption v-for="account in costAccounts" :key="account.id" :value="account.id">{{ account.name }}</BsSelectOption>
          </BsSelect>
        </BsFloatingField>
        <BsFloatingField :label="t('assets.accumulatedAccount')">
          <BsSelect id="asset-accumulated-account" v-model="form.accumulatedAccount" required native>
            <BsSelectOption value="" />
            <BsSelectOption v-for="account in accumulatedAccounts" :key="account.id" :value="account.id">{{ account.name }}</BsSelectOption>
          </BsSelect>
        </BsFloatingField>
        <BsFloatingField :label="t('assets.expenseAccount')">
          <BsSelect id="asset-expense-account" v-model="form.expenseAccount" required native>
            <BsSelectOption value="" />
            <BsSelectOption v-for="account in expenseAccounts" :key="account.id" :value="account.id">{{ account.name }}</BsSelectOption>
          </BsSelect>
        </BsFloatingField>
        <BsFloatingField :label="t('assets.impairmentAccount')">
          <BsSelect id="asset-impairment-account" v-model="form.impairmentAccount" required native>
            <BsSelectOption value="" />
            <BsSelectOption v-for="account in expenseAccounts" :key="account.id" :value="account.id">{{ account.name }}</BsSelectOption>
          </BsSelect>
        </BsFloatingField>
        <BsFloatingField :label="t('assets.gainLossAccount')">
          <BsSelect id="asset-gain-loss-account" v-model="form.gainLossAccount" required native>
            <BsSelectOption value="" />
            <BsSelectOption v-for="account in gainLossAccounts" :key="account.id" :value="account.id">{{ account.name }}</BsSelectOption>
          </BsSelect>
        </BsFloatingField>
      </template>
      <template v-if="form.mode === 'register' || form.mode === 'policy'">
        <BsGrid :columns="2" gap="md">
          <BsFloatingField :label="t('assets.life')">
            <BsInput id="asset-life" v-model="form.life" type="number" min="1" max="1200" required />
          </BsFloatingField>
          <BsFloatingField :label="t('assets.method')">
            <BsSelect id="asset-method" v-model="form.method" native>
              <BsSelectOption value="straight_line">{{ t('assets.methods.straight_line') }}</BsSelectOption>
              <BsSelectOption value="declining_balance">{{ t('assets.methods.declining_balance') }}</BsSelectOption>
            </BsSelect>
          </BsFloatingField>
          <BsFloatingField v-if="form.method === 'declining_balance'" :label="t('assets.rate')">
            <BsInput id="asset-rate" v-model="form.rate" type="number" min="0.01" max="100" step="0.01" required />
          </BsFloatingField>
          <BsFloatingField v-if="form.mode === 'policy'" :label="t('assets.residual')">
            <BsInput id="asset-policy-residual" v-model="form.residual" required />
          </BsFloatingField>
        </BsGrid>
      </template>
      <template v-if="form.mode === 'dispose'">
        <BsFloatingField :label="t('assets.proceeds')">
          <BsInput id="asset-proceeds" v-model="form.proceeds" required />
        </BsFloatingField>
        <BsFloatingField :label="t('assets.proceedsAccount')">
          <BsSelect id="asset-proceeds-account" v-model="form.proceedsAccount" native>
            <BsSelectOption value="" />
            <BsSelectOption v-for="account in proceedsAccounts" :key="account.id" :value="account.id">{{ account.name }}</BsSelectOption>
          </BsSelect>
        </BsFloatingField>
      </template>
      <BsFloatingField v-if="form.mode === 'impair'" :label="t('assets.impairmentAmount')">
        <BsInput id="asset-impairment" v-model="form.cost" required />
      </BsFloatingField>
      <template v-if="form.mode !== 'register'">
        <BsFloatingField :label="form.mode === 'policy' ? t('assets.effectiveDate') : t('assets.date')">
          <BsInput id="asset-action-date" v-model="form.date" type="date" required />
        </BsFloatingField>
        <BsFloatingField :label="t('assets.reason')">
          <BsInput id="asset-reason" v-model="form.reason" required />
        </BsFloatingField>
      </template>
    </BsRecordActionDialog>
  </BsStack>
</template>
