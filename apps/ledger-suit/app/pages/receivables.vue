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
useHead({ title: () => `${t('ar.title')} · ${t('app.name')}` })
const kinds: ArKind[] = ['invoice', 'receipt', 'credit', 'adjustment']
const capability: Record<ArKind, string> = { invoice: 'ar.issue', receipt: 'ar.receive', credit: 'ar.credit', adjustment: 'ar.adjust' }
const form = reactive({ kind: 'invoice' as ArKind | 'reversal', customer: '', control: '', offset: '', date: '', due: '', reference: '', amount: '', reason: '', key: '', document: '', allocations: {} as Record<string, string> })
const { visible, pending: saving, dirty, open, complete } = useRecordAction(() => form)
const formError = ref('')
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
}, { flush: 'sync' })
function begin(kind: ArKind | 'reversal', movement?: ArMovement) {
  Object.assign(form, { kind, customer: customer.value, control: controls.value[0]?.id ?? '', offset: '',
    date: asOf.value, due: asOf.value, reference: '', amount: '', reason: '', key: crypto.randomUUID(),
    document: movement?.id ?? '', allocations: {} })
  formError.value = ''
  open()
}
function failureMessage(failure: unknown) {
  const message = typeof failure === 'object' && failure !== null && 'message' in failure ? String(failure.message) : ''
  if (message.includes('AR_OVERPAYMENT')) return t('ar.errors.overpayment')
  if (message.includes('IDEMPOTENCY_CONFLICT')) return t('ar.errors.retryConflict')
  if (message.includes('ACCOUNTING_PERIOD') || message.includes('BOOKS_LOCKED')) return t('ar.errors.period')
  if (message.includes('AR_ADJUSTMENT_APPROVAL_REQUIRED')) return t('ar.errors.approval')
  if (message.includes('AR_INVALID_REVERSAL')) return t('ar.errors.reversal')
  if (message.includes('AR_CREDIT_REVENUE_MISMATCH')) return t('ar.errors.creditAccount')
  return t('ar.errors.save')
}
async function save() {
  if (saving.value || !currentId.value) return
  const organizationId = currentId.value
  const actor = user.value?.id
  formError.value = ''
  saving.value = true
  try {
    if (form.kind === 'reversal') {
      await command('reverse_ar_document', { p_document_id: form.document, p_date: form.date, p_reason: form.reason, p_idempotency_key: form.key })
    }
    else {
      const amount = parseMoneyToMinor(form.amount, baseCurrency.value)
      const allocations = isAllocation.value ? allocationItems.value.flatMap(item => {
        const value = form.allocations[item.invoice_id]?.trim()
        if (!value) return []
        const minor = parseMoneyToMinor(value, baseCurrency.value)
        if (minor <= 0n) throw new Error('invalid amount')
        return [{ invoice_id: item.invoice_id, amount_minor: minor.toString() }]
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
</script>

<template>
  <div class="space-y-6">
    <header><h1 class="text-h1 font-bold">{{ t('ar.title') }}</h1><p class="mt-2 text-fg-muted">{{ t('ar.policy') }}</p></header>
    <p v-if="!can('ar.read')" role="status" class="ls-card p-5">{{ t('ar.denied') }}</p>
    <template v-else>
      <div class="ls-card grid gap-4 p-5 sm:grid-cols-3">
        <FloatingField :label="t('ar.from')"><input id="ar-from" v-model="from" class="ls-input" type="date" :max="asOf"></FloatingField>
        <FloatingField :label="t('ar.asOf')"><input id="ar-asof" v-model="asOf" class="ls-input" type="date" :min="from"></FloatingField>
        <FloatingField :label="t('ar.customer')"><select id="ar-customer-filter" v-model="customer" class="ls-input"><option value="">{{ t('ar.allCustomers') }}</option><option v-for="c in data?.customers ?? []" :key="c.id" :value="c.id">{{ c.name }}</option></select></FloatingField>
      </div>
      <p v-if="error" class="ls-error" role="alert">{{ t('ar.errors.load') }} <button class="ls-btn" @click="load">{{ t('ar.retry') }}</button></p>
      <SectionSkeleton v-else-if="pending" variant="table" :rows="5" />
      <template v-else-if="data">
        <div class="flex flex-wrap gap-2"><template v-for="kind in kinds" :key="kind"><button v-if="can(capability[kind])" class="ls-btn" :disabled="readOnly || !controls.length || saving" @click="begin(kind)">{{ t(`ar.actions.${kind}`) }}</button></template></div>
        <p v-if="!controls.length" role="status" class="ls-card p-5">{{ t('ar.setup') }} <NuxtLink to="/accounts" class="text-link underline">{{ t('nav.accounts') }}</NuxtLink></p>
        <section class="ls-card overflow-hidden">
          <h2 class="p-4 text-h2 font-bold">{{ t('ar.openItems') }}</h2>
          <BsDataTable :value="items" data-key="invoice_id" :table-props="{ 'aria-label': t('ar.openItems') }">
            <template #empty>{{ t('ar.empty') }}</template>
            <Column field="customer_name" :header="t('ar.customer')" /><Column field="reference" :header="t('ar.reference')" />
            <Column field="issue_date" :header="t('ar.issueDate')" /><Column field="due_date" :header="t('ar.dueDate')" />
            <Column :header="t('ar.original')"><template #body="{ data: row }"><MoneyText :amount-minor="row.original_minor" /></template></Column>
            <Column :header="t('ar.outstanding')"><template #body="{ data: row }"><MoneyText :amount-minor="row.outstanding_minor" /></template></Column>
            <Column :header="t('ar.aging')"><template #body="{ data: row }">{{ t(`ar.buckets.${row.aging_bucket}`) }}</template></Column>
          </BsDataTable>
        </section>
        <section class="ls-card p-4"><h2 class="text-h2 font-bold">{{ t('ar.aging') }}</h2><p class="my-2 text-sm text-fg-muted">{{ t('ar.agingPolicy') }}</p><dl class="grid gap-3 sm:grid-cols-5"><div v-for="bucket in aging" :key="bucket.bucket"><dt>{{ t(`ar.buckets.${bucket.bucket}`) }}</dt><dd><MoneyText :amount-minor="bucket.amount" /></dd></div></dl></section>
        <section class="ls-card overflow-hidden">
          <h2 class="p-4 text-h2 font-bold">{{ t('ar.statement') }}</h2>
          <p v-if="!data.statement" class="p-4 text-fg-muted">{{ t('ar.chooseCustomer') }}</p>
          <template v-else>
            <dl class="grid gap-3 p-4 sm:grid-cols-5"><div v-for="field in statementFields" :key="field"><dt>{{ t(`ar.totals.${field}`) }}</dt><dd><MoneyText :amount-minor="data.statement[`${field}_minor`]" /></dd></div></dl>
            <BsDataTable :value="data.statement.movements" data-key="id" :table-props="{ 'aria-label': t('ar.statement') }">
              <template #empty>{{ t('ar.empty') }}</template>
              <Column field="date" :header="t('ar.date')" /><Column field="reference" :header="t('ar.reference')" />
              <Column :header="t('ar.kind')"><template #body="{ data: row }">{{ t(`ar.kinds.${row.kind}`) }}<span v-if="row.reversed"> · {{ t('ar.reversed') }}</span></template></Column>
              <Column :header="t('ar.movement')"><template #body="{ data: row }"><MoneyText :amount-minor="row.effect_minor" /></template></Column>
              <Column :header="t('ar.balance')"><template #body="{ data: row }"><MoneyText :amount-minor="row.balance_minor" /></template></Column>
              <Column field="reason" :header="t('ar.reason')" />
              <Column :header="t('ar.history')"><template #body="{ data: row }"><NuxtLink :to="{ path: '/transactions', query: { q: row.transaction_id } }" class="text-link underline">{{ t('ar.journal') }}</NuxtLink><p v-if="row.reverses_document_id" class="text-xs">{{ t('ar.reverses') }}: {{ row.reverses_document_id }}</p><button v-if="can('ar.reverse') && !row.reversed && row.kind !== 'reversal'" class="ls-btn ms-2" :disabled="readOnly || saving" @click="begin('reversal', row)">{{ t('ar.actions.reversal') }}</button></template></Column>
            </BsDataTable>
          </template>
        </section>
        <section v-if="can('controls.reconcile')" class="ls-card overflow-hidden"><h2 class="p-4 text-h2 font-bold">{{ t('controls.reconciliation') }}</h2><p class="px-4 text-sm text-fg-muted">{{ t('ar.reconciliationPolicy') }}</p>
          <BsDataTable :value="data.reconciliation" data-key="control_account_id" :table-props="{ 'aria-label': t('controls.reconciliation') }">
            <template #empty>{{ t('ar.empty') }}</template><Column field="account_name" :header="t('ar.control')" />
            <Column :header="t('controls.glBalance')"><template #body="{ data: row }"><MoneyText :amount-minor="row.gl_balance_minor" /></template></Column>
            <Column :header="t('controls.subledgerBalance')"><template #body="{ data: row }"><MoneyText :amount-minor="row.subledger_balance_minor" /></template></Column>
            <Column :header="t('controls.variance')"><template #body="{ data: row }"><MoneyText :amount-minor="row.variance_minor" /></template></Column>
            <Column :header="t('controls.status')"><template #body="{ data: row }">{{ t(`controls.statuses.${row.status}`) }}<p>{{ row.explanation_reason }}</p></template></Column>
          </BsDataTable>
        </section>
        <details v-if="can('commitments.read')" class="ls-card p-4"><summary class="cursor-pointer font-bold">{{ t('ar.legacy') }}</summary><p class="my-3 text-sm text-fg-muted">{{ t('ar.legacyPolicy') }}</p>
          <BsDataTable :value="data.legacy" data-key="commitment_id" :table-props="{ 'aria-label': t('ar.legacy') }"><template #empty>{{ t('ar.empty') }}</template><Column field="reference" :header="t('ar.reference')" /><Column :header="t('ar.original')"><template #body="{ data: row }"><MoneyText :amount-minor="row.original_minor" :currency="row.currency_code" /></template></Column><Column :header="t('ar.cashSettled')"><template #body="{ data: row }"><MoneyText :amount-minor="row.cash_settled_minor" :currency="row.currency_code" /></template></Column><Column :header="t('ar.outstanding')"><template #body="{ data: row }"><MoneyText :amount-minor="row.legacy_open_minor" :currency="row.currency_code" /></template></Column></BsDataTable>
        </details>
      </template>
    </template>
    <BsDialog v-model:visible="visible" :title="t(`ar.actions.${form.kind}`)" :pending="saving" :dirty="dirty" size="lg">
      <template #default="{ close }">
        <form class="space-y-4 p-5" @submit.prevent="save">
          <p v-if="formError" class="ls-error" role="alert">{{ formError }}</p>
          <p v-if="form.kind === 'reversal'" class="text-fg-muted">{{ t('ar.reversalPolicy') }}</p>
          <template v-else>
            <FloatingField :label="t('ar.customer')"><select id="ar-form-customer" v-model="form.customer" class="ls-input" required><option value="" /><option v-for="c in data?.customers.filter(c => !c.archived) ?? []" :key="c.id" :value="c.id">{{ c.name }}</option></select></FloatingField>
            <FloatingField :label="t('ar.control')"><select id="ar-control" v-model="form.control" class="ls-input" required><option v-for="a in controls" :key="a.id" :value="a.id">{{ a.name }}</option></select></FloatingField>
            <FloatingField :label="t(form.kind === 'receipt' ? 'ar.cash' : form.kind === 'adjustment' ? 'ar.expense' : 'ar.revenue')"><select id="ar-offset" v-model="form.offset" class="ls-input" required><option value="" /><option v-for="a in offsets" :key="a.id" :value="a.id">{{ a.name }}</option></select></FloatingField>
            <FloatingField :label="t('ar.reference')"><input id="ar-reference" v-model="form.reference" class="ls-input" required></FloatingField>
            <FloatingField :label="t('ar.amount')"><input id="ar-amount" v-model="form.amount" class="ls-input" inputmode="decimal" required></FloatingField>
          </template>
          <FloatingField :label="t('ar.date')"><input id="ar-date" v-model="form.date" class="ls-input" type="date" required></FloatingField>
          <FloatingField v-if="form.kind === 'invoice'" :label="t('ar.dueDate')"><input id="ar-due" v-model="form.due" class="ls-input" type="date" :min="form.date" required></FloatingField>
          <FloatingField v-if="['credit', 'adjustment', 'reversal'].includes(form.kind)" :label="t('ar.reason')"><input id="ar-reason" v-model="form.reason" class="ls-input" required></FloatingField>
          <fieldset v-if="isAllocation" class="space-y-3"><legend class="font-bold">{{ t('ar.allocations') }}</legend><p class="text-sm text-fg-muted">{{ t('ar.allocationPolicy') }}</p><p v-if="!allocationItems.length">{{ t('ar.noAllocationItems') }}</p><div v-for="item in allocationItems" :key="item.invoice_id"><FloatingField :label="item.reference"><input :id="`ar-allocation-${item.invoice_id}`" v-model="form.allocations[item.invoice_id]" class="ls-input" inputmode="decimal"></FloatingField><p class="text-sm">{{ t('ar.outstanding') }}: <MoneyText :amount-minor="item.outstanding_minor" /></p></div></fieldset>
          <div class="flex justify-end gap-2"><button type="button" class="ls-btn" @click="close">{{ t('common.cancel') }}</button><button type="submit" class="ls-btn ls-btn-primary" :disabled="saving || readOnly">{{ t('common.save') }}</button></div>
        </form>
      </template>
    </BsDialog>
  </div>
</template>
