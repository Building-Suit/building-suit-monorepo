<script setup lang="ts">
import { useSupplierSubledger } from '~/composables/useSupplierSubledger'
import type { ApKind, ApMovement } from '~/utils/supplierSubledger'
import { summarizePayablesAging } from '~/utils/supplierSubledger'

definePageMeta({ layout: 'default' })
const { t } = useI18n()
const { currentId, can, baseCurrency } = useTenant()
const user = useSupabaseUser()
const { readOnly } = useBilling()
const toasts = useToasts()
const { from, asOf, supplier, data, pending, error, load, command } = useSupplierSubledger()
const { density: tableDensity, hydrated: tablePreferenceHydrated } = useAccountingTablePreferences('payables')
useHead({ title: () => `${t('ap.title')} · ${t('app.name')}` })
const kinds: ApKind[] = ['bill', 'payment', 'credit', 'adjustment']
const capability: Record<ApKind, string> = { bill: 'ap.issue', payment: 'ap.receive', credit: 'ap.credit', adjustment: 'ap.adjust' }
const form = reactive({ kind: 'bill' as ApKind | 'reversal', supplier: '', control: '', offset: '', date: '', due: '', reference: '', amount: '', reason: '', key: '', document: '', allocations: {} as Record<string, string> })
const { visible, pending: saving, dirty, open, complete } = useRecordAction(() => form)
const formError = ref('')
const amountError = ref('')
const controls = computed(() => data.value?.accounts.filter(a => a.role === 'control' && a.subledger === 'supplier') ?? [])
const offsets = computed(() => data.value?.accounts.filter(a => a.role === 'posting' && (
  form.kind === 'payment' ? ['cash', 'bank', 'mobile_wallet'].includes(a.subtype) && a.type === 'asset'
    : ['expense', 'asset'].includes(a.type)
)) ?? [])
const items = computed(() => data.value?.items ?? [])
const allocationItems = computed(() => items.value.filter(i => i.supplier_id === form.supplier && i.control_account_id === form.control))
const aging = computed(() => summarizePayablesAging(items.value))
const statementFields = ['opening', 'bills', 'adjustments', 'payments', 'closing'] as const
const isAllocation = computed(() => ['payment', 'credit', 'adjustment'].includes(form.kind))
watch([() => form.supplier, () => form.control], () => { form.allocations = {} })
watch([currentId, () => user.value?.id], () => {
  visible.value = false
  Object.assign(form, { supplier: '', control: '', offset: '', amount: '', reason: '', reference: '', key: '', document: '', allocations: {} })
  formError.value = ''
  amountError.value = ''
}, { flush: 'sync' })
function begin(kind: ApKind | 'reversal', movement?: ApMovement) {
  Object.assign(form, { kind, supplier: supplier.value, control: controls.value[0]?.id ?? '', offset: '',
    date: asOf.value, due: asOf.value, reference: '', amount: '', reason: '', key: crypto.randomUUID(),
    document: movement?.id ?? '', allocations: {} })
  formError.value = ''
  amountError.value = ''
  open()
}
function moneyError(reason: 'invalid' | 'precision' | 'positive' | 'tooLarge') {
  if (reason === 'precision') return t('ap.errors.amountPrecision', { currency: baseCurrency.value, precision: minorUnitFor(baseCurrency.value) })
  if (reason === 'tooLarge') return t('ap.errors.amountTooLarge')
  return t('ap.errors.amountInvalid')
}
function amountMinor(value = form.amount) {
  const result = validatePositiveMoney(value, baseCurrency.value)
  amountError.value = result.valid ? '' : moneyError(result.reason)
  return result.valid ? result.minor : null
}
function failureMessage(failure: unknown) {
  const message = typeof failure === 'object' && failure !== null && 'message' in failure ? String(failure.message) : ''
  if (message.includes('AP_OVERPAYMENT')) return t('ap.errors.overpayment')
  if (message.includes('IDEMPOTENCY_CONFLICT')) return t('ap.errors.retryConflict')
  if (message.includes('ACCOUNTING_PERIOD') || message.includes('BOOKS_LOCKED')) return t('ap.errors.period')
  if (message.includes('AP_ADJUSTMENT_APPROVAL_REQUIRED')) return t('ap.errors.approval')
  if (message.includes('AP_INVALID_REVERSAL')) return t('ap.errors.reversal')
  if (message.includes('AP_CREDIT_ACCOUNT_MISMATCH')) return t('ap.errors.creditAccount')
  if (message.includes('AP_ALLOCATION_AMOUNT_INVALID')) return t('ap.errors.allocationAmount')
  return t('ap.errors.save')
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
      await command('reverse_ap_document', { p_document_id: form.document, p_date: form.date, p_reason: form.reason, p_idempotency_key: form.key })
    }
    else {
      const amount = amountMinor()
      if (amount === null) return
      const allocations = isAllocation.value ? allocationItems.value.flatMap(item => {
        const value = form.allocations[item.bill_id]?.trim()
        if (!value) return []
        const result = validatePositiveMoney(value, baseCurrency.value)
        if (!result.valid) throw new Error('AP_ALLOCATION_AMOUNT_INVALID')
        return [{ bill_id: item.bill_id, amount_minor: result.minor.toString() }]
      }) : []
      if (amount <= 0n || amount > 9223372036854775807n || (isAllocation.value && allocations.reduce((sum, a) => sum + BigInt(a.amount_minor), 0n) !== amount)) {
        formError.value = t('ap.errors.allocation'); return
      }
      await command('post_ap_document', {
        p_kind: form.kind, p_supplier_id: form.supplier, p_control_account_id: form.control,
        p_document_date: form.date, p_due_date: form.kind === 'bill' ? form.due : null,
        p_amount_minor: amount.toString(), p_offset_account_id: form.offset, p_reference: form.reference,
        p_reason: form.reason || null, p_idempotency_key: form.key, p_allocations: allocations,
      })
    }
    if (currentId.value !== organizationId || user.value?.id !== actor) return
    complete()
    toasts.success(t('ap.saved'))
  }
  catch (failure) { if (currentId.value === organizationId && user.value?.id === actor) formError.value = failureMessage(failure) }
  finally { saving.value = false }
}
const ledgerPresentation = useLedgerPresentation()
</script>

<template>
  <div class="space-y-6">
    <BsPageHeader :title="t('ap.title')" :subtitle="t('ap.policy')"  :context="ledgerPresentation.context(from, asOf, undefined)" :context-label="ledgerPresentation.t('pageContext.label')" />
    <FxSubledgerPanel v-if="can('fx.read')" subledger="supplier" :as-of="asOf" :read-only="readOnly" />
    <p v-if="!can('ap.read')" role="status" class="ls-card p-5">{{ t('ap.denied') }}</p>
    <template v-else>
      <div class="ls-card grid items-end gap-4 p-5 sm:grid-cols-3">
        <BsFloatingField :label="t('ap.from')"><input id="ap-from" v-model="from" class="ls-input" type="date" :max="asOf"></BsFloatingField>
        <BsFloatingField :label="t('ap.asOf')"><input id="ap-asof" v-model="asOf" class="ls-input" type="date" :min="from"></BsFloatingField>
        <BsFloatingField :label="t('ap.supplier')"><select id="ap-supplier-filter" v-model="supplier" class="ls-input"><option value="">{{ t('ap.allSuppliers') }}</option><option v-for="c in data?.suppliers ?? []" :key="c.id" :value="c.id">{{ c.name }}</option></select></BsFloatingField>
        <BsTableDensity v-model="tableDensity" :disabled="!tablePreferenceHydrated" :label="ledgerPresentation.t('accountingTable.density')" :compact-label="ledgerPresentation.t('accountingTable.compact')" :comfortable-label="ledgerPresentation.t('accountingTable.comfortable')" />
      </div>
      <p v-if="error" class="ls-error" role="alert">{{ t('ap.errors.load') }} <BsButton type="submit" class="ls-btn" @click="load">{{ t('ap.retry') }}</BsButton></p>
      <BsSectionSkeleton v-else-if="pending" variant="table" :rows="5" />
      <template v-else-if="data">
        <div class="flex flex-wrap gap-2"><template v-for="kind in kinds" :key="kind"><BsButton v-if="can(capability[kind])" type="submit" class="ls-btn" :disabled="readOnly || !controls.length || saving" @click="begin(kind)">{{ t(`ap.actions.${kind}`) }}</BsButton></template></div>
        <p v-if="!controls.length" role="status" class="ls-card p-5">{{ t('ap.setup') }} <NuxtLink to="/accounts" class="text-link underline">{{ t('nav.accounts') }}</NuxtLink></p>
        <section class="ls-card overflow-hidden">
          <h2 class="p-4 text-h2 font-bold">{{ t('ap.openItems') }}</h2>
          <BsDataTable :value="items" row-key="bill_id" :density="tableDensity" sticky-header max-height="32rem" :scroll-label="t('accountingTable.payablesScroll')" :label="t('ap.openItems')" :columns="[{ key: 'column1', header: (t('ap.supplier')) + '/' + (t('ap.reference')) }, { key: 'issue_date', field: 'issue_date', header: t('ap.issueDate') }, { key: 'due_date', field: 'due_date', header: t('ap.dueDate') }, { key: 'column4', header: t('ap.original') }, { key: 'column5', header: t('ap.outstanding') }, { key: 'column6', header: t('ap.aging') }]">
            <template #empty>{{ t('ap.empty') }}</template>
            <template #header-column1>{{ t('ap.supplier') }} / {{ t('ap.reference') }}</template>
            <template #cell-column1="{ row }"><span class="block font-semibold">{{ row.supplier_name }}</span><span class="block text-xs text-fg-muted" dir="ltr">{{ row.reference }}</span></template>
            <template #cell-column4="{ row }"><BsMoneyText :amount="row.original_minor" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" /></template>
            <template #cell-column5="{ row }"><BsMoneyText :amount="row.outstanding_minor" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" /></template>
            <template #cell-column6="{ row }">{{ t(`ap.buckets.${row.aging_bucket}`) }}</template>

          </BsDataTable>
        </section>
        <section class="ls-card p-4"><h2 class="text-h2 font-bold">{{ t('ap.aging') }}</h2><p class="my-2 text-sm text-fg-muted">{{ t('ap.agingPolicy') }}</p><dl class="grid gap-3 sm:grid-cols-5"><div v-for="bucket in aging" :key="bucket.bucket"><dt>{{ t(`ap.buckets.${bucket.bucket}`) }}</dt><dd><BsMoneyText :amount="bucket.amount" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" /></dd></div></dl></section>
        <section class="ls-card overflow-hidden">
          <h2 class="p-4 text-h2 font-bold">{{ t('ap.statement') }}</h2>
          <p v-if="!data.statement" class="p-4 text-fg-muted">{{ t('ap.chooseSupplier') }}</p>
          <template v-else>
            <dl class="grid gap-3 p-4 sm:grid-cols-5"><div v-for="field in statementFields" :key="field"><dt>{{ t(`ap.totals.${field}`) }}</dt><dd><BsMoneyText :amount="data.statement[`${field}_minor`]" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" /></dd></div></dl>
            <BsDataTable :value="data.statement.movements" row-key="id" :density="tableDensity" sticky-header max-height="32rem" :scroll-label="t('accountingTable.payablesScroll')" :label="t('ap.statement')" :columns="[{ key: 'date', field: 'date', header: t('ap.date') }, { key: 'reference', field: 'reference', header: t('ap.reference') }, { key: 'column3', header: t('ap.kind') }, { key: 'column4', header: t('ap.movement') }, { key: 'column5', header: t('ap.balance') }, { key: 'reason', field: 'reason', header: t('ap.reason') }, { key: 'column7', header: t('ap.history') }]">
              <template #empty>{{ t('ap.empty') }}</template>
              <template #cell-column3="{ row }">{{ t(`ap.kinds.${row.kind}`) }}<span v-if="row.reversed"> · {{ t('ap.reversed') }}</span></template>
              <template #cell-column4="{ row }"><BsMoneyText :amount="row.effect_minor" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" /></template>
              <template #cell-column5="{ row }"><BsMoneyText :amount="row.balance_minor" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" /></template>
              <template #cell-column7="{ row }"><NuxtLink :to="{ path: '/transactions', query: { q: row.transaction_id } }" class="text-link underline">{{ t('ap.journal') }}</NuxtLink><p v-if="row.reverses_document_id" class="text-xs">{{ t('ap.reverses') }}: {{ row.reverses_document_id }}</p><BsButton v-if="can('ap.reverse') && !row.reversed && row.kind !== 'reversal'" type="submit" class="ls-btn ms-2" :disabled="readOnly || saving" @click="begin('reversal', row)">{{ t('ap.actions.reversal') }}</BsButton></template>

            </BsDataTable>
          </template>
        </section>
        <section v-if="can('controls.reconcile')" class="ls-card overflow-hidden"><h2 class="p-4 text-h2 font-bold">{{ t('controls.reconciliation') }}</h2><p class="px-4 text-sm text-fg-muted">{{ t('ap.reconciliationPolicy') }}</p>
          <BsDataTable :value="data.reconciliation" row-key="control_account_id" :density="tableDensity" :label="t('controls.reconciliation')" :columns="[{ key: 'account_name', field: 'account_name', header: t('ap.control') }, { key: 'column2', header: t('controls.glBalance') }, { key: 'column3', header: t('controls.subledgerBalance') }, { key: 'column4', header: t('controls.variance') }, { key: 'column5', header: t('controls.status') }]">
            <template #empty>{{ t('ap.empty') }}</template><template #cell-column2="{ row }"><BsMoneyText :amount="row.gl_balance_minor" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" /></template>
            <template #cell-column3="{ row }"><BsMoneyText :amount="row.subledger_balance_minor" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" /></template>
            <template #cell-column4="{ row }"><BsMoneyText :amount="row.variance_minor" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" /></template>
            <template #cell-column5="{ row }">{{ t(`controls.statuses.${row.status}`) }}<p>{{ row.explanation_reason }}</p></template>

          </BsDataTable>
        </section>
        <details v-if="can('commitments.read')" class="ls-card p-4"><summary class="cursor-pointer font-bold">{{ t('ap.legacy') }}</summary><p class="my-3 text-sm text-fg-muted">{{ t('ap.legacyPolicy') }}</p>
          <BsDataTable :value="data.legacy" row-key="commitment_id" :density="tableDensity" :label="t('ap.legacy')" :columns="[{ key: 'reference', field: 'reference', header: t('ap.reference') }, { key: 'column2', header: t('ap.original') }, { key: 'column3', header: t('ap.cashSettled') }, { key: 'column4', header: t('ap.outstanding') }]"><template #empty>{{ t('ap.empty') }}</template><template #cell-column2="{ row }"><BsMoneyText :amount="row.original_minor" :currency="ledgerPresentation.currency(row.currency_code)" :locale="ledgerPresentation.locale" /></template>
            <template #cell-column3="{ row }"><BsMoneyText :amount="row.cash_settled_minor" :currency="ledgerPresentation.currency(row.currency_code)" :locale="ledgerPresentation.locale" /></template>
            <template #cell-column4="{ row }"><BsMoneyText :amount="row.legacy_open_minor" :currency="ledgerPresentation.currency(row.currency_code)" :locale="ledgerPresentation.locale" /></template></BsDataTable>
        </details>
      </template>
    </template>
    <BsRecordActionDialog v-model:visible="visible" :title="t(`ap.actions.${form.kind}`)" :pending="saving" :dirty="dirty" :error="formError" size="lg" :submit-label="t('common.save')" :cancel-label="t('common.cancel')" :submit-disabled="readOnly" @submit="save">
          <p v-if="form.kind === 'reversal'" class="text-fg-muted">{{ t('ap.reversalPolicy') }}</p>
          <template v-else>
            <BsFloatingField :label="t('ap.supplier')"><select id="ap-form-supplier" v-model="form.supplier" class="ls-input" required><option value="" /><option v-for="c in data?.suppliers.filter(c => !c.archived) ?? []" :key="c.id" :value="c.id">{{ c.name }}</option></select></BsFloatingField>
            <BsFloatingField :label="t('ap.control')"><select id="ap-control" v-model="form.control" class="ls-input" required><option v-for="a in controls" :key="a.id" :value="a.id">{{ a.name }}</option></select></BsFloatingField>
            <BsFloatingField :label="t(form.kind === 'payment' ? 'ap.cash' : 'ap.expenseOrAsset')"><select id="ap-offset" v-model="form.offset" class="ls-input" required><option value="" /><option v-for="a in offsets" :key="a.id" :value="a.id">{{ a.name }}</option></select></BsFloatingField>
            <BsFloatingField :label="t('ap.reference')"><input id="ap-reference" v-model="form.reference" class="ls-input" required></BsFloatingField>
            <BsFloatingField :label="t('ap.amount')"><input id="ap-amount" v-model="form.amount" class="ls-input" inputmode="decimal" required :aria-invalid="Boolean(amountError)" :aria-describedby="amountError ? 'ap-amount-error' : undefined" @blur="amountMinor()"></BsFloatingField>
            <p v-if="amountError" id="ap-amount-error" class="text-sm text-danger" role="alert">{{ amountError }}</p>
          </template>
          <BsFloatingField :label="t('ap.date')"><input id="ap-date" v-model="form.date" class="ls-input" type="date" required></BsFloatingField>
          <BsFloatingField v-if="form.kind === 'bill'" :label="t('ap.dueDate')"><input id="ap-due" v-model="form.due" class="ls-input" type="date" :min="form.date" required></BsFloatingField>
          <BsFloatingField v-if="['credit', 'adjustment', 'reversal'].includes(form.kind)" :label="t('ap.reason')"><input id="ap-reason" v-model="form.reason" class="ls-input" required></BsFloatingField>
          <fieldset v-if="isAllocation" class="space-y-3"><legend class="font-bold">{{ t('ap.allocations') }}</legend><p class="text-sm text-fg-muted">{{ t('ap.allocationPolicy') }}</p><p v-if="!allocationItems.length">{{ t('ap.noAllocationItems') }}</p><div v-for="item in allocationItems" :key="item.bill_id"><BsFloatingField :label="item.reference"><input :id="`ap-allocation-${item.bill_id}`" v-model="form.allocations[item.bill_id]" class="ls-input" inputmode="decimal"></BsFloatingField><p class="text-sm">{{ t('ap.outstanding') }}: <BsMoneyText :amount="item.outstanding_minor" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" /></p></div></fieldset>
    </BsRecordActionDialog>
  </div>
</template>
