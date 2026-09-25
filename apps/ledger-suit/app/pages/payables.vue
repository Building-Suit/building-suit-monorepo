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
useHead({ title: () => `${t('ap.title')} · ${t('app.name')}` })
const kinds: ApKind[] = ['bill', 'payment', 'credit', 'adjustment']
const capability: Record<ApKind, string> = { bill: 'ap.issue', payment: 'ap.receive', credit: 'ap.credit', adjustment: 'ap.adjust' }
const form = reactive({ kind: 'bill' as ApKind | 'reversal', supplier: '', control: '', offset: '', date: '', due: '', reference: '', amount: '', reason: '', key: '', document: '', allocations: {} as Record<string, string> })
const { visible, pending: saving, dirty, open, complete } = useRecordAction(() => form)
const formError = ref('')
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
}, { flush: 'sync' })
function begin(kind: ApKind | 'reversal', movement?: ApMovement) {
  Object.assign(form, { kind, supplier: supplier.value, control: controls.value[0]?.id ?? '', offset: '',
    date: asOf.value, due: asOf.value, reference: '', amount: '', reason: '', key: crypto.randomUUID(),
    document: movement?.id ?? '', allocations: {} })
  formError.value = ''
  open()
}
function failureMessage(failure: unknown) {
  const message = typeof failure === 'object' && failure !== null && 'message' in failure ? String(failure.message) : ''
  if (message.includes('AP_OVERPAYMENT')) return t('ap.errors.overpayment')
  if (message.includes('IDEMPOTENCY_CONFLICT')) return t('ap.errors.retryConflict')
  if (message.includes('ACCOUNTING_PERIOD') || message.includes('BOOKS_LOCKED')) return t('ap.errors.period')
  if (message.includes('AP_ADJUSTMENT_APPROVAL_REQUIRED')) return t('ap.errors.approval')
  if (message.includes('AP_INVALID_REVERSAL')) return t('ap.errors.reversal')
  if (message.includes('AP_CREDIT_ACCOUNT_MISMATCH')) return t('ap.errors.creditAccount')
  return t('ap.errors.save')
}
async function save() {
  if (saving.value || !currentId.value) return
  const organizationId = currentId.value
  const actor = user.value?.id
  formError.value = ''
  saving.value = true
  try {
    if (form.kind === 'reversal') {
      await command('reverse_ap_document', { p_document_id: form.document, p_date: form.date, p_reason: form.reason, p_idempotency_key: form.key })
    }
    else {
      const amount = parseMoneyToMinor(form.amount, baseCurrency.value)
      const allocations = isAllocation.value ? allocationItems.value.flatMap(item => {
        const value = form.allocations[item.bill_id]?.trim()
        if (!value) return []
        const minor = parseMoneyToMinor(value, baseCurrency.value)
        if (minor <= 0n) throw new Error('invalid amount')
        return [{ bill_id: item.bill_id, amount_minor: minor.toString() }]
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
</script>

<template>
  <div class="space-y-6">
    <header><h1 class="text-h1 font-bold">{{ t('ap.title') }}</h1><p class="mt-2 text-fg-muted">{{ t('ap.policy') }}</p></header>
    <p v-if="!can('ap.read')" role="status" class="ls-card p-5">{{ t('ap.denied') }}</p>
    <template v-else>
      <div class="ls-card grid gap-4 p-5 sm:grid-cols-3">
        <FloatingField :label="t('ap.from')"><input id="ap-from" v-model="from" class="ls-input" type="date" :max="asOf"></FloatingField>
        <FloatingField :label="t('ap.asOf')"><input id="ap-asof" v-model="asOf" class="ls-input" type="date" :min="from"></FloatingField>
        <FloatingField :label="t('ap.supplier')"><select id="ap-supplier-filter" v-model="supplier" class="ls-input"><option value="">{{ t('ap.allSuppliers') }}</option><option v-for="c in data?.suppliers ?? []" :key="c.id" :value="c.id">{{ c.name }}</option></select></FloatingField>
      </div>
      <p v-if="error" class="ls-error" role="alert">{{ t('ap.errors.load') }} <button class="ls-btn" @click="load">{{ t('ap.retry') }}</button></p>
      <SectionSkeleton v-else-if="pending" variant="table" :rows="5" />
      <template v-else-if="data">
        <div class="flex flex-wrap gap-2"><template v-for="kind in kinds" :key="kind"><button v-if="can(capability[kind])" class="ls-btn" :disabled="readOnly || !controls.length || saving" @click="begin(kind)">{{ t(`ap.actions.${kind}`) }}</button></template></div>
        <p v-if="!controls.length" role="status" class="ls-card p-5">{{ t('ap.setup') }} <NuxtLink to="/accounts" class="text-link underline">{{ t('nav.accounts') }}</NuxtLink></p>
        <section class="ls-card overflow-hidden">
          <h2 class="p-4 text-h2 font-bold">{{ t('ap.openItems') }}</h2>
          <BsDataTable :value="items" data-key="bill_id" :table-props="{ 'aria-label': t('ap.openItems') }">
            <template #empty>{{ t('ap.empty') }}</template>
            <Column field="supplier_name" :header="t('ap.supplier')" /><Column field="reference" :header="t('ap.reference')" />
            <Column field="issue_date" :header="t('ap.issueDate')" /><Column field="due_date" :header="t('ap.dueDate')" />
            <Column :header="t('ap.original')"><template #body="{ data: row }"><MoneyText :amount-minor="row.original_minor" /></template></Column>
            <Column :header="t('ap.outstanding')"><template #body="{ data: row }"><MoneyText :amount-minor="row.outstanding_minor" /></template></Column>
            <Column :header="t('ap.aging')"><template #body="{ data: row }">{{ t(`ap.buckets.${row.aging_bucket}`) }}</template></Column>
          </BsDataTable>
        </section>
        <section class="ls-card p-4"><h2 class="text-h2 font-bold">{{ t('ap.aging') }}</h2><p class="my-2 text-sm text-fg-muted">{{ t('ap.agingPolicy') }}</p><dl class="grid gap-3 sm:grid-cols-5"><div v-for="bucket in aging" :key="bucket.bucket"><dt>{{ t(`ap.buckets.${bucket.bucket}`) }}</dt><dd><MoneyText :amount-minor="bucket.amount" /></dd></div></dl></section>
        <section class="ls-card overflow-hidden">
          <h2 class="p-4 text-h2 font-bold">{{ t('ap.statement') }}</h2>
          <p v-if="!data.statement" class="p-4 text-fg-muted">{{ t('ap.chooseSupplier') }}</p>
          <template v-else>
            <dl class="grid gap-3 p-4 sm:grid-cols-5"><div v-for="field in statementFields" :key="field"><dt>{{ t(`ap.totals.${field}`) }}</dt><dd><MoneyText :amount-minor="data.statement[`${field}_minor`]" /></dd></div></dl>
            <BsDataTable :value="data.statement.movements" data-key="id" :table-props="{ 'aria-label': t('ap.statement') }">
              <template #empty>{{ t('ap.empty') }}</template>
              <Column field="date" :header="t('ap.date')" /><Column field="reference" :header="t('ap.reference')" />
              <Column :header="t('ap.kind')"><template #body="{ data: row }">{{ t(`ap.kinds.${row.kind}`) }}<span v-if="row.reversed"> · {{ t('ap.reversed') }}</span></template></Column>
              <Column :header="t('ap.movement')"><template #body="{ data: row }"><MoneyText :amount-minor="row.effect_minor" /></template></Column>
              <Column :header="t('ap.balance')"><template #body="{ data: row }"><MoneyText :amount-minor="row.balance_minor" /></template></Column>
              <Column field="reason" :header="t('ap.reason')" />
              <Column :header="t('ap.history')"><template #body="{ data: row }"><NuxtLink :to="{ path: '/transactions', query: { q: row.transaction_id } }" class="text-link underline">{{ t('ap.journal') }}</NuxtLink><p v-if="row.reverses_document_id" class="text-xs">{{ t('ap.reverses') }}: {{ row.reverses_document_id }}</p><button v-if="can('ap.reverse') && !row.reversed && row.kind !== 'reversal'" class="ls-btn ms-2" :disabled="readOnly || saving" @click="begin('reversal', row)">{{ t('ap.actions.reversal') }}</button></template></Column>
            </BsDataTable>
          </template>
        </section>
        <section v-if="can('controls.reconcile')" class="ls-card overflow-hidden"><h2 class="p-4 text-h2 font-bold">{{ t('controls.reconciliation') }}</h2><p class="px-4 text-sm text-fg-muted">{{ t('ap.reconciliationPolicy') }}</p>
          <BsDataTable :value="data.reconciliation" data-key="control_account_id" :table-props="{ 'aria-label': t('controls.reconciliation') }">
            <template #empty>{{ t('ap.empty') }}</template><Column field="account_name" :header="t('ap.control')" />
            <Column :header="t('controls.glBalance')"><template #body="{ data: row }"><MoneyText :amount-minor="row.gl_balance_minor" /></template></Column>
            <Column :header="t('controls.subledgerBalance')"><template #body="{ data: row }"><MoneyText :amount-minor="row.subledger_balance_minor" /></template></Column>
            <Column :header="t('controls.variance')"><template #body="{ data: row }"><MoneyText :amount-minor="row.variance_minor" /></template></Column>
            <Column :header="t('controls.status')"><template #body="{ data: row }">{{ t(`controls.statuses.${row.status}`) }}<p>{{ row.explanation_reason }}</p></template></Column>
          </BsDataTable>
        </section>
        <details v-if="can('commitments.read')" class="ls-card p-4"><summary class="cursor-pointer font-bold">{{ t('ap.legacy') }}</summary><p class="my-3 text-sm text-fg-muted">{{ t('ap.legacyPolicy') }}</p>
          <BsDataTable :value="data.legacy" data-key="commitment_id" :table-props="{ 'aria-label': t('ap.legacy') }"><template #empty>{{ t('ap.empty') }}</template><Column field="reference" :header="t('ap.reference')" /><Column :header="t('ap.original')"><template #body="{ data: row }"><MoneyText :amount-minor="row.original_minor" :currency="row.currency_code" /></template></Column><Column :header="t('ap.cashSettled')"><template #body="{ data: row }"><MoneyText :amount-minor="row.cash_settled_minor" :currency="row.currency_code" /></template></Column><Column :header="t('ap.outstanding')"><template #body="{ data: row }"><MoneyText :amount-minor="row.legacy_open_minor" :currency="row.currency_code" /></template></Column></BsDataTable>
        </details>
      </template>
    </template>
    <BsDialog v-model:visible="visible" :title="t(`ap.actions.${form.kind}`)" :pending="saving" :dirty="dirty" size="lg">
      <template #default="{ close }">
        <form class="space-y-4 p-5" @submit.prevent="save">
          <p v-if="formError" class="ls-error" role="alert">{{ formError }}</p>
          <p v-if="form.kind === 'reversal'" class="text-fg-muted">{{ t('ap.reversalPolicy') }}</p>
          <template v-else>
            <FloatingField :label="t('ap.supplier')"><select id="ap-form-supplier" v-model="form.supplier" class="ls-input" required><option value="" /><option v-for="c in data?.suppliers.filter(c => !c.archived) ?? []" :key="c.id" :value="c.id">{{ c.name }}</option></select></FloatingField>
            <FloatingField :label="t('ap.control')"><select id="ap-control" v-model="form.control" class="ls-input" required><option v-for="a in controls" :key="a.id" :value="a.id">{{ a.name }}</option></select></FloatingField>
            <FloatingField :label="t(form.kind === 'payment' ? 'ap.cash' : 'ap.expenseOrAsset')"><select id="ap-offset" v-model="form.offset" class="ls-input" required><option value="" /><option v-for="a in offsets" :key="a.id" :value="a.id">{{ a.name }}</option></select></FloatingField>
            <FloatingField :label="t('ap.reference')"><input id="ap-reference" v-model="form.reference" class="ls-input" required></FloatingField>
            <FloatingField :label="t('ap.amount')"><input id="ap-amount" v-model="form.amount" class="ls-input" inputmode="decimal" required></FloatingField>
          </template>
          <FloatingField :label="t('ap.date')"><input id="ap-date" v-model="form.date" class="ls-input" type="date" required></FloatingField>
          <FloatingField v-if="form.kind === 'bill'" :label="t('ap.dueDate')"><input id="ap-due" v-model="form.due" class="ls-input" type="date" :min="form.date" required></FloatingField>
          <FloatingField v-if="['credit', 'adjustment', 'reversal'].includes(form.kind)" :label="t('ap.reason')"><input id="ap-reason" v-model="form.reason" class="ls-input" required></FloatingField>
          <fieldset v-if="isAllocation" class="space-y-3"><legend class="font-bold">{{ t('ap.allocations') }}</legend><p class="text-sm text-fg-muted">{{ t('ap.allocationPolicy') }}</p><p v-if="!allocationItems.length">{{ t('ap.noAllocationItems') }}</p><div v-for="item in allocationItems" :key="item.bill_id"><FloatingField :label="item.reference"><input :id="`ap-allocation-${item.bill_id}`" v-model="form.allocations[item.bill_id]" class="ls-input" inputmode="decimal"></FloatingField><p class="text-sm">{{ t('ap.outstanding') }}: <MoneyText :amount-minor="item.outstanding_minor" /></p></div></fieldset>
          <div class="flex justify-end gap-2"><button type="button" class="ls-btn" @click="close">{{ t('common.cancel') }}</button><button type="submit" class="ls-btn ls-btn-primary" :disabled="saving || readOnly">{{ t('common.save') }}</button></div>
        </form>
      </template>
    </BsDialog>
  </div>
</template>
