<script setup lang="ts">
import { useCustomerSubledger } from '~/composables/useCustomerSubledger'
import type { ArKind, ArMovement } from '~/utils/customerSubledger'
import { summarizeAging } from '~/utils/customerSubledger'

definePageMeta({ layout: 'default' })
const { t } = useI18n()
const { currentId, can, baseCurrency } = useTenant()
const user = useSupabaseUser()
const { readOnly } = useBilling()
const toasts = useToasts()
const { from, asOf, customer, data, pending, error, load, command } = useCustomerSubledger()
const { density: tableDensity, hydrated: tablePreferenceHydrated } = useAccountingTablePreferences('receivables')
useHead({ title: () => `${t('ar.title')} · ${t('app.name')}` })
const kinds: ArKind[] = ['invoice', 'receipt', 'credit', 'adjustment']
const capability: Record<ArKind, string> = { invoice: 'ar.issue', receipt: 'ar.receive', credit: 'ar.credit', adjustment: 'ar.adjust' }
const form = reactive({ kind: 'invoice' as ArKind | 'reversal', customer: '', control: '', offset: '', date: '', due: '', reference: '', amount: '', reason: '', key: '', document: '', allocations: {} as Record<string, string> })
const { visible, pending: saving, dirty, open, complete } = useRecordAction(() => form)
const formError = ref('')
const amountError = ref('')
const controls = computed(() => data.value?.accounts.filter(a => a.role === 'control' && a.subledger === 'customer') ?? [])
const offsets = computed(() => data.value?.accounts.filter(a => a.role === 'posting' && (
  form.kind === 'receipt' ? ['cash', 'bank', 'mobile_wallet'].includes(a.subtype) && a.type === 'asset'
    : a.type === (form.kind === 'adjustment' ? 'expense' : 'revenue')
)) ?? [])
const items = computed(() => data.value?.items ?? [])
const allocationItems = computed(() => items.value.filter(i => i.customer_id === form.customer && i.control_account_id === form.control))
const aging = computed(() => summarizeAging(items.value))
const statementFields = ['opening', 'charges', 'adjustments', 'receipts', 'closing'] as const
const isAllocation = computed(() => ['receipt', 'credit', 'adjustment'].includes(form.kind))
watch([() => form.customer, () => form.control], () => { form.allocations = {} })
watch([currentId, () => user.value?.id], () => {
  visible.value = false
  Object.assign(form, { customer: '', control: '', offset: '', amount: '', reason: '', reference: '', key: '', document: '', allocations: {} })
  formError.value = ''
  amountError.value = ''
}, { flush: 'sync' })
function begin(kind: ArKind | 'reversal', movement?: ArMovement) {
  Object.assign(form, { kind, customer: customer.value, control: controls.value[0]?.id ?? '', offset: '',
    date: asOf.value, due: asOf.value, reference: '', amount: '', reason: '', key: crypto.randomUUID(),
    document: movement?.id ?? '', allocations: {} })
  formError.value = ''
  amountError.value = ''
  open()
}
function moneyError(reason: 'invalid' | 'precision' | 'positive' | 'tooLarge') {
  if (reason === 'precision') return t('ar.errors.amountPrecision', { currency: baseCurrency.value, precision: minorUnitFor(baseCurrency.value) })
  if (reason === 'tooLarge') return t('ar.errors.amountTooLarge')
  return t('ar.errors.amountInvalid')
}
function amountMinor(value = form.amount) {
  const result = validatePositiveMoney(value, baseCurrency.value)
  amountError.value = result.valid ? '' : moneyError(result.reason)
  return result.valid ? result.minor : null
}
function failureMessage(failure: unknown) {
  const message = typeof failure === 'object' && failure !== null && 'message' in failure ? String(failure.message) : ''
  if (message.includes('AR_OVERPAYMENT')) return t('ar.errors.overpayment')
  if (message.includes('IDEMPOTENCY_CONFLICT')) return t('ar.errors.retryConflict')
  if (message.includes('ACCOUNTING_PERIOD') || message.includes('BOOKS_LOCKED')) return t('ar.errors.period')
  if (message.includes('AR_ADJUSTMENT_APPROVAL_REQUIRED')) return t('ar.errors.approval')
  if (message.includes('AR_INVALID_REVERSAL')) return t('ar.errors.reversal')
  if (message.includes('AR_CREDIT_REVENUE_MISMATCH')) return t('ar.errors.creditAccount')
  if (message.includes('AR_ALLOCATION_AMOUNT_INVALID')) return t('ar.errors.allocationAmount')
  return t('ar.errors.save')
}
async function save() {
  if (saving.value || !currentId.value) return
  const organizationId = currentId.value
  const actor = user.value?.id
  formError.value = ''
  amountError.value = ''
  saving.value = true
  try {
    if (form.kind === 'reversal') {
      await command('reverse_ar_document', { p_document_id: form.document, p_date: form.date, p_reason: form.reason, p_idempotency_key: form.key })
    }
    else {
      const amount = amountMinor()
      if (amount === null) return
      const allocations = isAllocation.value ? allocationItems.value.flatMap(item => {
        const value = form.allocations[item.invoice_id]?.trim()
        if (!value) return []
        const result = validatePositiveMoney(value, baseCurrency.value)
        if (!result.valid) throw new Error('AR_ALLOCATION_AMOUNT_INVALID')
        return [{ invoice_id: item.invoice_id, amount_minor: result.minor.toString() }]
      }) : []
      if (amount <= 0n || amount > 9223372036854775807n || (isAllocation.value && allocations.reduce((sum, a) => sum + BigInt(a.amount_minor), 0n) !== amount)) {
        formError.value = t('ar.errors.allocation'); return
      }
      await command('post_ar_document', {
        p_kind: form.kind, p_customer_id: form.customer, p_control_account_id: form.control,
        p_document_date: form.date, p_due_date: form.kind === 'invoice' ? form.due : null,
        p_amount_minor: amount.toString(), p_offset_account_id: form.offset, p_reference: form.reference,
        p_reason: form.reason || null, p_idempotency_key: form.key, p_allocations: allocations,
      })
    }
    if (currentId.value !== organizationId || user.value?.id !== actor) return
    complete()
    toasts.success(t('ar.saved'))
  }
  catch (failure) { if (currentId.value === organizationId && user.value?.id === actor) formError.value = failureMessage(failure) }
  finally { saving.value = false }
}
const ledgerPresentation = useLedgerPresentation()
</script>

<template>
  <div class="space-y-6">
    <BsPageHeader :title="t('ar.title')" :subtitle="t('ar.policy')"  :context="ledgerPresentation.context(from, asOf, undefined)" :context-label="ledgerPresentation.t('pageContext.label')" />
    <FxSubledgerPanel v-if="can('fx.read')" subledger="customer" :as-of="asOf" :read-only="readOnly" />
    <p v-if="!can('ar.read')" role="status" class="ls-card p-5">{{ t('ar.denied') }}</p>
    <template v-else>
      <div class="ls-card grid items-end gap-4 p-5 sm:grid-cols-3">
        <BsFloatingField :label="t('ar.from')"><input id="ar-from" v-model="from" class="ls-input" type="date" :max="asOf"></BsFloatingField>
        <BsFloatingField :label="t('ar.asOf')"><input id="ar-asof" v-model="asOf" class="ls-input" type="date" :min="from"></BsFloatingField>
        <BsFloatingField :label="t('ar.customer')"><select id="ar-customer-filter" v-model="customer" class="ls-input"><option value="">{{ t('ar.allCustomers') }}</option><option v-for="c in data?.customers ?? []" :key="c.id" :value="c.id">{{ c.name }}</option></select></BsFloatingField>
        <BsTableDensity v-model="tableDensity" :disabled="!tablePreferenceHydrated" :label="ledgerPresentation.t('accountingTable.density')" :compact-label="ledgerPresentation.t('accountingTable.compact')" :comfortable-label="ledgerPresentation.t('accountingTable.comfortable')" />
      </div>
      <p v-if="error" class="ls-error" role="alert">{{ t('ar.errors.load') }} <BsButton type="submit" class="ls-btn" @click="load">{{ t('ar.retry') }}</BsButton></p>
      <BsSectionSkeleton v-else-if="pending" variant="table" :rows="5" />
      <template v-else-if="data">
        <div class="flex flex-wrap gap-2"><template v-for="kind in kinds" :key="kind"><BsButton v-if="can(capability[kind])" type="submit" class="ls-btn" :disabled="readOnly || !controls.length || saving" @click="begin(kind)">{{ t(`ar.actions.${kind}`) }}</BsButton></template></div>
        <p v-if="!controls.length" role="status" class="ls-card p-5">{{ t('ar.setup') }} <NuxtLink to="/accounts" class="text-link underline">{{ t('nav.accounts') }}</NuxtLink></p>
        <section class="ls-card overflow-hidden">
          <h2 class="p-4 text-h2 font-bold">{{ t('ar.openItems') }}</h2>
          <BsDataTable :value="items" row-key="invoice_id" :density="tableDensity" sticky-header max-height="32rem" :scroll-label="t('accountingTable.receivablesScroll')" :label="t('ar.openItems')" :columns="[{ key: 'column1', header: (t('ar.customer')) + '/' + (t('ar.reference')) }, { key: 'issue_date', field: 'issue_date', header: t('ar.issueDate') }, { key: 'due_date', field: 'due_date', header: t('ar.dueDate') }, { key: 'column4', header: t('ar.original') }, { key: 'column5', header: t('ar.outstanding') }, { key: 'column6', header: t('ar.aging') }]">
            <template #empty>{{ t('ar.empty') }}</template>
            <template #header-column1>{{ t('ar.customer') }} / {{ t('ar.reference') }}</template>
            <template #cell-column1="{ row }"><span class="block font-semibold">{{ row.customer_name }}</span><span class="block text-xs text-fg-muted" dir="ltr">{{ row.reference }}</span></template>
            <template #cell-column4="{ row }"><BsMoneyText :amount="row.original_minor" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" /></template>
            <template #cell-column5="{ row }"><BsMoneyText :amount="row.outstanding_minor" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" /></template>
            <template #cell-column6="{ row }">{{ t(`ar.buckets.${row.aging_bucket}`) }}</template>

          </BsDataTable>
        </section>
        <section class="ls-card p-4"><h2 class="text-h2 font-bold">{{ t('ar.aging') }}</h2><p class="my-2 text-sm text-fg-muted">{{ t('ar.agingPolicy') }}</p><dl class="grid gap-3 sm:grid-cols-5"><div v-for="bucket in aging" :key="bucket.bucket"><dt>{{ t(`ar.buckets.${bucket.bucket}`) }}</dt><dd><BsMoneyText :amount="bucket.amount" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" /></dd></div></dl></section>
        <section class="ls-card overflow-hidden">
          <h2 class="p-4 text-h2 font-bold">{{ t('ar.statement') }}</h2>
          <p v-if="!data.statement" class="p-4 text-fg-muted">{{ t('ar.chooseCustomer') }}</p>
          <template v-else>
            <dl class="grid gap-3 p-4 sm:grid-cols-5"><div v-for="field in statementFields" :key="field"><dt>{{ t(`ar.totals.${field}`) }}</dt><dd><BsMoneyText :amount="data.statement[`${field}_minor`]" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" /></dd></div></dl>
            <BsDataTable :value="data.statement.movements" row-key="id" :density="tableDensity" sticky-header max-height="32rem" :scroll-label="t('accountingTable.receivablesScroll')" :label="t('ar.statement')" :columns="[{ key: 'date', field: 'date', header: t('ar.date') }, { key: 'reference', field: 'reference', header: t('ar.reference') }, { key: 'column3', header: t('ar.kind') }, { key: 'column4', header: t('ar.movement') }, { key: 'column5', header: t('ar.balance') }, { key: 'reason', field: 'reason', header: t('ar.reason') }, { key: 'column7', header: t('ar.history') }]">
              <template #empty>{{ t('ar.empty') }}</template>
              <template #cell-column3="{ row }">{{ t(`ar.kinds.${row.kind}`) }}<span v-if="row.reversed"> · {{ t('ar.reversed') }}</span></template>
              <template #cell-column4="{ row }"><BsMoneyText :amount="row.effect_minor" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" /></template>
              <template #cell-column5="{ row }"><BsMoneyText :amount="row.balance_minor" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" /></template>
              <template #cell-column7="{ row }"><NuxtLink :to="{ path: '/transactions', query: { q: row.transaction_id } }" class="text-link underline">{{ t('ar.journal') }}</NuxtLink><p v-if="row.reverses_document_id" class="text-xs">{{ t('ar.reverses') }}: {{ row.reverses_document_id }}</p><BsButton v-if="can('ar.reverse') && !row.reversed && row.kind !== 'reversal'" type="submit" class="ls-btn ms-2" :disabled="readOnly || saving" @click="begin('reversal', row)">{{ t('ar.actions.reversal') }}</BsButton></template>

            </BsDataTable>
          </template>
        </section>
        <section v-if="can('controls.reconcile')" class="ls-card overflow-hidden"><h2 class="p-4 text-h2 font-bold">{{ t('controls.reconciliation') }}</h2><p class="px-4 text-sm text-fg-muted">{{ t('ar.reconciliationPolicy') }}</p>
          <BsDataTable :value="data.reconciliation" row-key="control_account_id" :density="tableDensity" :label="t('controls.reconciliation')" :columns="[{ key: 'account_name', field: 'account_name', header: t('ar.control') }, { key: 'column2', header: t('controls.glBalance') }, { key: 'column3', header: t('controls.subledgerBalance') }, { key: 'column4', header: t('controls.variance') }, { key: 'column5', header: t('controls.status') }]">
            <template #empty>{{ t('ar.empty') }}</template><template #cell-column2="{ row }"><BsMoneyText :amount="row.gl_balance_minor" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" /></template>
            <template #cell-column3="{ row }"><BsMoneyText :amount="row.subledger_balance_minor" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" /></template>
            <template #cell-column4="{ row }"><BsMoneyText :amount="row.variance_minor" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" /></template>
            <template #cell-column5="{ row }">{{ t(`controls.statuses.${row.status}`) }}<p>{{ row.explanation_reason }}</p></template>

          </BsDataTable>
        </section>
        <details v-if="can('commitments.read')" class="ls-card p-4"><summary class="cursor-pointer font-bold">{{ t('ar.legacy') }}</summary><p class="my-3 text-sm text-fg-muted">{{ t('ar.legacyPolicy') }}</p>
          <BsDataTable :value="data.legacy" row-key="commitment_id" :density="tableDensity" :label="t('ar.legacy')" :columns="[{ key: 'reference', field: 'reference', header: t('ar.reference') }, { key: 'column2', header: t('ar.original') }, { key: 'column3', header: t('ar.cashSettled') }, { key: 'column4', header: t('ar.outstanding') }]"><template #empty>{{ t('ar.empty') }}</template><template #cell-column2="{ row }"><BsMoneyText :amount="row.original_minor" :currency="ledgerPresentation.currency(row.currency_code)" :locale="ledgerPresentation.locale" /></template>
            <template #cell-column3="{ row }"><BsMoneyText :amount="row.cash_settled_minor" :currency="ledgerPresentation.currency(row.currency_code)" :locale="ledgerPresentation.locale" /></template>
            <template #cell-column4="{ row }"><BsMoneyText :amount="row.legacy_open_minor" :currency="ledgerPresentation.currency(row.currency_code)" :locale="ledgerPresentation.locale" /></template></BsDataTable>
        </details>
      </template>
    </template>
    <BsRecordActionDialog v-model:visible="visible" :title="t(`ar.actions.${form.kind}`)" :pending="saving" :dirty="dirty" :error="formError" size="lg" :submit-label="t('common.save')" :cancel-label="t('common.cancel')" :submit-disabled="readOnly" @submit="save">
          <p v-if="form.kind === 'reversal'" class="text-fg-muted">{{ t('ar.reversalPolicy') }}</p>
          <template v-else>
            <BsFloatingField :label="t('ar.customer')"><select id="ar-form-customer" v-model="form.customer" class="ls-input" required><option value="" /><option v-for="c in data?.customers.filter(c => !c.archived) ?? []" :key="c.id" :value="c.id">{{ c.name }}</option></select></BsFloatingField>
            <BsFloatingField :label="t('ar.control')"><select id="ar-control" v-model="form.control" class="ls-input" required><option v-for="a in controls" :key="a.id" :value="a.id">{{ a.name }}</option></select></BsFloatingField>
            <BsFloatingField :label="t(form.kind === 'receipt' ? 'ar.cash' : form.kind === 'adjustment' ? 'ar.expense' : 'ar.revenue')"><select id="ar-offset" v-model="form.offset" class="ls-input" required><option value="" /><option v-for="a in offsets" :key="a.id" :value="a.id">{{ a.name }}</option></select></BsFloatingField>
            <BsFloatingField :label="t('ar.reference')"><input id="ar-reference" v-model="form.reference" class="ls-input" required></BsFloatingField>
            <BsFloatingField :label="t('ar.amount')"><input id="ar-amount" v-model="form.amount" class="ls-input" inputmode="decimal" required :aria-invalid="Boolean(amountError)" :aria-describedby="amountError ? 'ar-amount-error' : undefined" @blur="amountMinor()"></BsFloatingField>
            <p v-if="amountError" id="ar-amount-error" class="text-sm text-danger" role="alert">{{ amountError }}</p>
          </template>
          <BsFloatingField :label="t('ar.date')"><input id="ar-date" v-model="form.date" class="ls-input" type="date" required></BsFloatingField>
          <BsFloatingField v-if="form.kind === 'invoice'" :label="t('ar.dueDate')"><input id="ar-due" v-model="form.due" class="ls-input" type="date" :min="form.date" required></BsFloatingField>
          <BsFloatingField v-if="['credit', 'adjustment', 'reversal'].includes(form.kind)" :label="t('ar.reason')"><input id="ar-reason" v-model="form.reason" class="ls-input" required></BsFloatingField>
          <fieldset v-if="isAllocation" class="space-y-3"><legend class="font-bold">{{ t('ar.allocations') }}</legend><p class="text-sm text-fg-muted">{{ t('ar.allocationPolicy') }}</p><p v-if="!allocationItems.length">{{ t('ar.noAllocationItems') }}</p><div v-for="item in allocationItems" :key="item.invoice_id"><BsFloatingField :label="item.reference"><input :id="`ar-allocation-${item.invoice_id}`" v-model="form.allocations[item.invoice_id]" class="ls-input" inputmode="decimal"></BsFloatingField><p class="text-sm">{{ t('ar.outstanding') }}: <BsMoneyText :amount="item.outstanding_minor" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" /></p></div></fieldset>
    </BsRecordActionDialog>
  </div>
</template>
