<script setup lang="ts">
import { useLedgerFxPresentation } from '~/composables/useLedgerFxPresentation'
import { formatPresentationMoney } from '@building-suit/ui/utils/presentation'
import type { BsSubledgerCopy, BsSubledgerForm, BsSubledgerFilters, BsSubledgerView, BsSubledgerChoices } from '@building-suit/ui/types/subledgerPresentation'
import { useSupplierSubledger } from '~/composables/useSupplierSubledger'
import type { ApKind, ApMovement } from '~/utils/supplierSubledger'
import { summarizePayablesAging } from '~/utils/supplierSubledger'

definePageMeta({ layout: 'default' })
const { t, locale } = useI18n()
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

const fx = useLedgerFxPresentation('supplier', asOf, readOnly)
const subledgerMoney = (value: string, currency = baseCurrency.value) => formatPresentationMoney(value, { currency, locale: locale.value, unit: 'minor', numberingSystem: 'latn' })
const subledgerFilters = computed<BsSubledgerFilters>({ get: () => ({ from: from.value, asOf: asOf.value, party: supplier.value, density: tableDensity.value }), set: value => { from.value = value.from; asOf.value = value.asOf; supplier.value = value.party; tableDensity.value = value.density } })
const subledgerForm = computed<BsSubledgerForm>({ get: () => ({ party: form.supplier, control: form.control, offset: form.offset, date: form.date, due: form.due, reference: form.reference, amount: form.amount, reason: form.reason, allocations: { ...form.allocations } }), set: value => { Object.assign(form, { supplier: value.party, control: value.control, offset: value.offset, date: value.date, due: value.due, reference: value.reference, amount: value.amount, reason: value.reason, allocations: { ...value.allocations } }) } })
const subledgerCopy = computed<BsSubledgerCopy>(() => ({ title: t('ap.title'), policy: t('ap.policy'), contextLabel: t('pageContext.label'), denied: t('ap.denied'), from: t('ap.from'), asOf: t('ap.asOf'), party: t('ap.supplier'), allParties: t('ap.allSuppliers'), density: t('accountingTable.density'), compact: t('accountingTable.compact'), comfortable: t('accountingTable.comfortable'), loadError: t('ap.errors.load'), retry: t('ap.retry'), setup: t('ap.setup'), accounts: t('nav.accounts'), openItems: t('ap.openItems'), reference: t('ap.reference'), issueDate: t('ap.issueDate'), dueDate: t('ap.dueDate'), original: t('ap.original'), outstanding: t('ap.outstanding'), aging: t('ap.aging'), empty: t('ap.empty'), agingPolicy: t('ap.agingPolicy'), statement: t('ap.statement'), chooseParty: t('ap.chooseSupplier'), date: t('ap.date'), kind: t('ap.kind'), movement: t('ap.movement'), balance: t('ap.balance'), reason: t('ap.reason'), history: t('ap.history'), journal: t('ap.journal'), reverses: t('ap.reverses'), reverse: t('ap.actions.reversal'), reconciliation: t('controls.reconciliation'), reconciliationPolicy: t('ap.reconciliationPolicy'), control: t('ap.control'), glBalance: t('controls.glBalance'), subledgerBalance: t('controls.subledgerBalance'), variance: t('controls.variance'), status: t('controls.status'), legacy: t('ap.legacy'), legacyPolicy: t('ap.legacyPolicy'), cashSettled: t('ap.cashSettled'), reversalPolicy: t('ap.reversalPolicy'), amount: t('ap.amount'), allocations: t('ap.allocations'), allocationPolicy: t('ap.allocationPolicy'), noAllocationItems: t('ap.noAllocationItems'), save: t('common.save'), cancel: t('common.cancel'), scroll: t('accountingTable.payablesScroll') }))
const subledgerChoices = computed<BsSubledgerChoices>(() => { const choices = (rows: { id: string; name: string }[]) => rows.map(row => ({ value: row.id, label: row.name })); return { parties: choices(data.value?.suppliers || []), activeParties: choices(data.value?.suppliers.filter(row => !row.archived) || []), controls: choices(controls.value), offsets: choices(offsets.value) } })
const subledgerView = computed<BsSubledgerView>(() => ({
 context: ledgerPresentation.context(from.value, asOf.value), allowed: can('ap.read'), loading: pending.value, error: Boolean(error.value), found: Boolean(data.value), preferenceReady: tablePreferenceHydrated.value, setupRequired: !controls.value.length, actions: kinds.filter(kind => can(capability[kind])).map(kind => ({ id: kind, label: t(`ap.actions.${kind}`), disabled: readOnly.value || !controls.value.length || saving.value })),
 items: items.value.map(row => ({ id: row.bill_id, name: row.supplier_name, reference: row.reference, issueDate: row.issue_date, dueDate: row.due_date, original: subledgerMoney(row.original_minor), outstanding: subledgerMoney(row.outstanding_minor), aging: t(`ap.buckets.${row.aging_bucket}`) })),
 aging: aging.value.map(bucket => ({ id: bucket.bucket, label: t(`ap.buckets.${bucket.bucket}`), value: subledgerMoney(bucket.amount) })), totals: data.value?.statement ? statementFields.map(field => ({ id: field, label: t(`ap.totals.${field}`), value: subledgerMoney(data.value!.statement![`${field}_minor`]) })) : [], statementAvailable: Boolean(data.value?.statement),
 movements: (data.value?.statement?.movements || []).map(row => ({ id: row.id, date: row.date, reference: row.reference, kind: [t(`ap.kinds.${row.kind}`), row.reversed ? t('ap.reversed') : ''].filter(Boolean).join(' · '), movement: subledgerMoney(row.effect_minor), balance: subledgerMoney(row.balance_minor), reason: row.reason || '', journalTo: `/transactions?q=${encodeURIComponent(row.transaction_id)}`, reverses: row.reverses_document_id || '', canReverse: can('ap.reverse') && !row.reversed && row.kind !== 'reversal', disabled: readOnly.value || saving.value })),
 showReconciliation: can('controls.reconcile'), reconciliation: (data.value?.reconciliation || []).map(row => ({ id: row.control_account_id, name: row.account_name, gl: subledgerMoney(row.gl_balance_minor), subledger: subledgerMoney(row.subledger_balance_minor), variance: subledgerMoney(row.variance_minor), status: t(`controls.statuses.${row.status}`), explanation: row.explanation_reason || '' })),
 showLegacy: can('commitments.read'), legacy: (data.value?.legacy || []).map(row => ({ id: row.commitment_id, reference: row.reference, original: subledgerMoney(row.original_minor, row.currency_code), settled: subledgerMoney(row.cash_settled_minor, row.currency_code), outstanding: subledgerMoney(row.legacy_open_minor, row.currency_code) })),
 dialog: { title: t(`ap.actions.${form.kind}`), dirty: dirty.value, pending: saving.value, error: formError.value, disabled: readOnly.value, reversal: form.kind === 'reversal', showDue: form.kind === 'bill', showReason: ['credit', 'adjustment', 'reversal'].includes(form.kind), showAllocations: isAllocation.value, amountError: amountError.value, offsetLabel: t(form.kind === 'payment' ? 'ap.cash' : 'ap.expenseOrAsset'), allocationItems: allocationItems.value.map(row => ({ id: row.bill_id, reference: row.reference, outstanding: subledgerMoney(row.outstanding_minor) })) },
 fx: { copy: fx.copy.value, view: fx.view.value, choices: fx.choices.value },
}))
function beginSubledgerAction(id: string) { if (kinds.includes(id as ApKind)) begin(id as ApKind) }
function reverseSubledgerMovement(id: string) { const movement = data.value?.statement?.movements.find(row => row.id === id); if (movement) begin('reversal', movement) }
</script>
<template>
  <BsSubledgerPage v-model:filters="subledgerFilters" v-model:form="subledgerForm" v-model:fx-form="fx.form.value" v-model:visible="visible" :copy="subledgerCopy" :view="subledgerView" :choices="subledgerChoices" accounts-to="/accounts" @retry="load" @action="beginSubledgerAction" @reverse="reverseSubledgerMovement" @submit="save" @validate-amount="amountMinor()" @retry-fx="fx.retry" @fx-mapping="fx.saveMapping" @fx-item="fx.saveItem" @fx-settlement="fx.saveSettlement" @fx-preview="fx.runPreview" @fx-confirm="fx.confirmRevaluation" @fx-reversal="fx.saveReversal"/>
</template>
