<script setup lang="ts">
import { useLedgerFxPresentation } from '~/composables/useLedgerFxPresentation'
import { formatPresentationMoney } from '@building-suit/ux'
import type { BsSubledgerCopy, BsSubledgerForm, BsSubledgerFilters, BsSubledgerView, BsSubledgerChoices } from '@building-suit/ui/types/subledgerPresentation'
import { useCustomerSubledger } from '~/composables/useCustomerSubledger'
import type { ArKind, ArMovement } from '~/utils/customerSubledger'
import { summarizeAging } from '~/utils/customerSubledger'

definePageMeta({ layout: 'default' })
const { t, locale } = useI18n()
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

const fx = useLedgerFxPresentation('customer', asOf, readOnly)
const subledgerMoney = (value: string, currency = baseCurrency.value) => formatPresentationMoney(value, { currency, locale: locale.value, unit: 'minor', numberingSystem: 'latn' })
const subledgerFilters = computed<BsSubledgerFilters>({ get: () => ({ from: from.value, asOf: asOf.value, party: customer.value, density: tableDensity.value }), set: value => { from.value = value.from; asOf.value = value.asOf; customer.value = value.party; tableDensity.value = value.density } })
const subledgerForm = computed<BsSubledgerForm>({ get: () => ({ party: form.customer, control: form.control, offset: form.offset, date: form.date, due: form.due, reference: form.reference, amount: form.amount, reason: form.reason, allocations: { ...form.allocations } }), set: value => { Object.assign(form, { customer: value.party, control: value.control, offset: value.offset, date: value.date, due: value.due, reference: value.reference, amount: value.amount, reason: value.reason, allocations: { ...value.allocations } }) } })
const subledgerCopy = computed<BsSubledgerCopy>(() => ({ title: t('ar.title'), policy: t('ar.policy'), contextLabel: t('pageContext.label'), denied: t('ar.denied'), from: t('ar.from'), asOf: t('ar.asOf'), party: t('ar.customer'), allParties: t('ar.allCustomers'), density: t('accountingTable.density'), compact: t('accountingTable.compact'), comfortable: t('accountingTable.comfortable'), loadError: t('ar.errors.load'), retry: t('ar.retry'), setup: t('ar.setup'), accounts: t('nav.accounts'), openItems: t('ar.openItems'), reference: t('ar.reference'), issueDate: t('ar.issueDate'), dueDate: t('ar.dueDate'), original: t('ar.original'), outstanding: t('ar.outstanding'), aging: t('ar.aging'), empty: t('ar.empty'), agingPolicy: t('ar.agingPolicy'), statement: t('ar.statement'), chooseParty: t('ar.chooseCustomer'), date: t('ar.date'), kind: t('ar.kind'), movement: t('ar.movement'), balance: t('ar.balance'), reason: t('ar.reason'), history: t('ar.history'), journal: t('ar.journal'), reverses: t('ar.reverses'), reverse: t('ar.actions.reversal'), reconciliation: t('controls.reconciliation'), reconciliationPolicy: t('ar.reconciliationPolicy'), control: t('ar.control'), glBalance: t('controls.glBalance'), subledgerBalance: t('controls.subledgerBalance'), variance: t('controls.variance'), status: t('controls.status'), legacy: t('ar.legacy'), legacyPolicy: t('ar.legacyPolicy'), cashSettled: t('ar.cashSettled'), reversalPolicy: t('ar.reversalPolicy'), amount: t('ar.amount'), allocations: t('ar.allocations'), allocationPolicy: t('ar.allocationPolicy'), noAllocationItems: t('ar.noAllocationItems'), save: t('common.save'), cancel: t('common.cancel'), scroll: t('accountingTable.receivablesScroll') }))
const subledgerChoices = computed<BsSubledgerChoices>(() => { const choices = (rows: { id: string; name: string }[]) => rows.map(row => ({ value: row.id, label: row.name })); return { parties: choices(data.value?.customers || []), activeParties: choices(data.value?.customers.filter(row => !row.archived) || []), controls: choices(controls.value), offsets: choices(offsets.value) } })
const subledgerView = computed<BsSubledgerView>(() => ({
 context: ledgerPresentation.context(from.value, asOf.value), allowed: can('ar.read'), loading: pending.value, error: Boolean(error.value), found: Boolean(data.value), preferenceReady: tablePreferenceHydrated.value, setupRequired: !controls.value.length, actions: kinds.filter(kind => can(capability[kind])).map(kind => ({ id: kind, label: t(`ar.actions.${kind}`), disabled: readOnly.value || !controls.value.length || saving.value })),
 items: items.value.map(row => ({ id: row.invoice_id, name: row.customer_name, reference: row.reference, issueDate: row.issue_date, dueDate: row.due_date, original: subledgerMoney(row.original_minor), outstanding: subledgerMoney(row.outstanding_minor), aging: t(`ar.buckets.${row.aging_bucket}`) })),
 aging: aging.value.map(bucket => ({ id: bucket.bucket, label: t(`ar.buckets.${bucket.bucket}`), value: subledgerMoney(bucket.amount) })), totals: data.value?.statement ? statementFields.map(field => ({ id: field, label: t(`ar.totals.${field}`), value: subledgerMoney(data.value!.statement![`${field}_minor`]) })) : [], statementAvailable: Boolean(data.value?.statement),
 movements: (data.value?.statement?.movements || []).map(row => ({ id: row.id, date: row.date, reference: row.reference, kind: [t(`ar.kinds.${row.kind}`), row.reversed ? t('ar.reversed') : ''].filter(Boolean).join(' · '), movement: subledgerMoney(row.effect_minor), balance: subledgerMoney(row.balance_minor), reason: row.reason || '', journalTo: `/transactions?q=${encodeURIComponent(row.transaction_id)}`, reverses: row.reverses_document_id || '', canReverse: can('ar.reverse') && !row.reversed && row.kind !== 'reversal', disabled: readOnly.value || saving.value })),
 showReconciliation: can('controls.reconcile'), reconciliation: (data.value?.reconciliation || []).map(row => ({ id: row.control_account_id, name: row.account_name, gl: subledgerMoney(row.gl_balance_minor), subledger: subledgerMoney(row.subledger_balance_minor), variance: subledgerMoney(row.variance_minor), status: t(`controls.statuses.${row.status}`), explanation: row.explanation_reason || '' })),
 showLegacy: can('commitments.read'), legacy: (data.value?.legacy || []).map(row => ({ id: row.commitment_id, reference: row.reference, original: subledgerMoney(row.original_minor, row.currency_code), settled: subledgerMoney(row.cash_settled_minor, row.currency_code), outstanding: subledgerMoney(row.legacy_open_minor, row.currency_code) })),
 dialog: { title: t(`ar.actions.${form.kind}`), dirty: dirty.value, pending: saving.value, error: formError.value, disabled: readOnly.value, reversal: form.kind === 'reversal', showDue: form.kind === 'invoice', showReason: ['credit', 'adjustment', 'reversal'].includes(form.kind), showAllocations: isAllocation.value, amountError: amountError.value, offsetLabel: t(form.kind === 'receipt' ? 'ar.cash' : form.kind === 'adjustment' ? 'ar.expense' : 'ar.revenue'), allocationItems: allocationItems.value.map(row => ({ id: row.invoice_id, reference: row.reference, outstanding: subledgerMoney(row.outstanding_minor) })) },
 fx: { copy: fx.copy.value, view: fx.view.value, choices: fx.choices.value },
}))
function beginSubledgerAction(id: string) { if (kinds.includes(id as ArKind)) begin(id as ArKind) }
function reverseSubledgerMovement(id: string) { const movement = data.value?.statement?.movements.find(row => row.id === id); if (movement) begin('reversal', movement) }
</script>
<template>
  <BsSubledgerPage v-model:filters="subledgerFilters" v-model:form="subledgerForm" v-model:fx-form="fx.form.value" v-model:visible="visible" :copy="subledgerCopy" :view="subledgerView" :choices="subledgerChoices" accounts-to="/accounts" @retry="load" @action="beginSubledgerAction" @reverse="reverseSubledgerMovement" @submit="save" @validate-amount="amountMinor()" @retry-fx="fx.retry" @fx-mapping="fx.saveMapping" @fx-item="fx.saveItem" @fx-settlement="fx.saveSettlement" @fx-preview="fx.runPreview" @fx-confirm="fx.confirmRevaluation" @fx-reversal="fx.saveReversal"/>
</template>
