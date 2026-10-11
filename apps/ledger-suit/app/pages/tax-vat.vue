<script setup lang="ts">
import { formatPresentationMoney } from '@building-suit/ui/utils/presentation'
import type { BsTaxWorkspaceCopy, BsTaxWorkspaceSetupForm, BsTaxWorkspaceDocumentForm, BsTaxWorkspaceView, BsTaxWorkspaceChoices } from '@building-suit/ui/types/taxWorkspacePresentation'
import type { VatDirection, VatDocumentKind, VatDocumentRow } from '~/utils/egyptVat'
import { calculateVatMinor, vatReportReconciles } from '~/utils/egyptVat'

definePageMeta({ layout: 'default' })
const { t, locale } = useI18n()
const { currentId, can } = useTenant()
const user = useSupabaseUser()
const { readOnly } = useBilling()
const toasts = useToasts()
const { workspace, pending, error, from, to, load, command } = useEgyptVat()
useHead({ title: () => `${t('vat.title')} · ${t('app.name')}` })

const setup = reactive({ registration: '', effective: new Date().toISOString().slice(0, 10), output: '', input: '' })
const setupError = ref('')
const setupSaving = ref(false)
const profile = computed(() => workspace.value?.profiles[0] ?? null)
const report = computed(() => workspace.value?.report ?? null)
const reconciled = computed(() => vatReportReconciles(report.value))
const outputAccounts = computed(() => workspace.value?.accounts.filter(a => !a.archived && a.type === 'liability' && a.subtype === 'taxes_payable' && a.currency === 'EGP') ?? [])
const inputAccounts = computed(() => workspace.value?.accounts.filter(a => !a.archived && a.type === 'asset' && a.currency === 'EGP') ?? [])

const form = reactive({ direction: 'output' as VatDirection, kind: 'invoice' as VatDocumentKind, documentDate: '', taxPointDate: '', reference: '', base: '', baseAccount: '', grossAccount: '', counterparty: '', original: '', reason: '', key: '' })
const { visible, pending: saving, dirty, open, complete } = useRecordAction(() => form)
const formError = ref('')
const amountError = ref('')
const availableBaseAccounts = computed(() => workspace.value?.accounts.filter(a => !a.archived && a.currency === 'EGP' && (form.direction === 'output' ? a.type === 'revenue' : ['expense', 'asset'].includes(a.type))) ?? [])
const availableGrossAccounts = computed(() => workspace.value?.accounts.filter(a => !a.archived && a.currency === 'EGP' && a.type === (form.direction === 'output' ? 'asset' : 'liability')) ?? [])
const originalInvoices = computed(() => report.value?.documents.filter(d => d.kind === 'invoice' && d.direction === form.direction && !report.value?.documents.some(a => a.adjusts_document_id === d.id)) ?? [])
const currentRule = computed(() => workspace.value?.rules[0])
const previewTax = computed(() => {
  try { return calculateVatMinor(parseMoneyToMinor(form.base, 'EGP'), BigInt(currentRule.value?.rate_basis_points ?? 1400)).toString() }
  catch { return '0' }
})
function minorToInput(value: string) {
  const minor = BigInt(value)
  return `${minor / 100n}.${(minor % 100n).toString().padStart(2, '0')}`
}

watch([from, to], () => { if (from.value <= to.value) void load() })
watch(() => form.original, (id) => {
  if (form.kind !== 'credit') return
  const source = originalInvoices.value.find(d => d.id === id)
  if (!source) return
  Object.assign(form, { reference: source.reference, base: minorToInput(source.taxable_base_minor), baseAccount: source.base_account_id, grossAccount: source.gross_account_id, counterparty: source.counterparty_id ?? '' })
})
watch([currentId, () => user.value?.id], () => {
  visible.value = false; setupError.value = ''; formError.value = ''; amountError.value = ''
  Object.assign(setup, { registration: '', effective: new Date().toISOString().slice(0, 10), output: '', input: '' })
  Object.assign(form, { documentDate: '', taxPointDate: '', reference: '', base: '', baseAccount: '', grossAccount: '', counterparty: '', original: '', reason: '', key: '' })
}, { flush: 'sync' })

function begin(direction: VatDirection, kind: 'invoice' | 'credit' = 'invoice') {
  const date = to.value
  Object.assign(form, { direction, kind, documentDate: date, taxPointDate: date, reference: '', base: '', baseAccount: '', grossAccount: '', counterparty: '', original: '', reason: '', key: crypto.randomUUID() })
  formError.value = ''
  amountError.value = ''
  open()
}
function beginReversal(document: VatDocumentRow) {
  Object.assign(form, { direction: document.direction, kind: 'reversal', documentDate: to.value, taxPointDate: to.value,
    reference: document.reference, base: minorToInput(document.taxable_base_minor), baseAccount: document.base_account_id,
    grossAccount: document.gross_account_id, counterparty: document.counterparty_id ?? '', original: document.id,
    reason: '', key: crypto.randomUUID() })
  formError.value = ''
  amountError.value = ''
  open()
}
function baseMinor() {
  const result = validatePositiveMoney(form.base, 'EGP')
  amountError.value = result.valid ? '' : result.reason === 'precision'
    ? t('vat.errors.amountPrecision', { currency: 'EGP', precision: minorUnitFor('EGP') })
    : result.reason === 'tooLarge' ? t('vat.errors.amountTooLarge') : t('vat.errors.amountInvalid')
  return result.valid ? result.minor : null
}
function failureMessage(failure: unknown) {
  const message = typeof failure === 'object' && failure !== null && 'message' in failure ? String(failure.message) : ''
  if (message.includes('IDEMPOTENCY_CONFLICT')) return t('vat.errors.retryConflict')
  if (message.includes('ACCOUNTING_PERIOD') || message.includes('BOOKS_LOCKED')) return t('vat.errors.period')
  if (message.includes('VAT_ADJUSTMENT_INVALID')) return t('vat.errors.adjustment')
  if (message.includes('VAT_RULE_NOT_EFFECTIVE')) return t('vat.errors.effectiveDate')
  return t('vat.errors.save')
}
async function saveSetup() {
  if (setupSaving.value) return
  setupError.value = ''; setupSaving.value = true
  try {
    await command('configure_egypt_vat', { p_registration_number: setup.registration, p_effective_from: setup.effective, p_output_vat_account_id: setup.output, p_input_vat_account_id: setup.input })
    toasts.success(t('vat.configured'))
  }
  catch { setupError.value = t('vat.errors.configure') }
  finally { setupSaving.value = false }
}
async function saveDocument() {
  if (saving.value || !currentId.value) return
  const organizationId = currentId.value; const actor = user.value?.id
  formError.value = ''; amountError.value = ''; saving.value = true
  try {
    const base = baseMinor()
    if (base === null) return
    if (form.kind === 'reversal') await command('reverse_egypt_vat_document', { p_document_id: form.original, p_document_date: form.documentDate, p_tax_point_date: form.taxPointDate, p_reason: form.reason, p_idempotency_key: form.key })
    else await command('post_egypt_vat_document', {
        p_direction: form.direction, p_kind: form.kind, p_document_date: form.documentDate,
        p_tax_point_date: form.taxPointDate, p_reference: form.reference, p_taxable_base_minor: base.toString(),
        p_base_account_id: form.baseAccount, p_gross_account_id: form.grossAccount, p_idempotency_key: form.key,
        p_counterparty_id: form.counterparty || null, p_input_eligible: form.direction === 'input',
        p_reason: form.reason || null, p_adjusts_document_id: form.original || null,
      })
    if (currentId.value !== organizationId || user.value?.id !== actor) return
    complete(); toasts.success(t('vat.saved'))
  }
  catch (failure) { if (currentId.value === organizationId && user.value?.id === actor) formError.value = failureMessage(failure) }
  finally { saving.value = false }
}
const ledgerPresentation = useLedgerPresentation()

const taxCopy = computed<BsTaxWorkspaceCopy>(() => ({
  common_cancel: t('common.cancel'),
  common_retry: t('common.retry'),
  common_save: t('common.save'),
  vat_addInput: t('vat.addInput'),
  vat_addInputCredit: t('vat.addInputCredit'),
  vat_addOutput: t('vat.addOutput'),
  vat_addOutputCredit: t('vat.addOutputCredit'),
  vat_base: t('vat.base'),
  vat_baseAccount: t('vat.baseAccount'),
  vat_calculatedTax: t('vat.calculatedTax'),
  vat_confirmRegistration: t('vat.confirmRegistration'),
  vat_counterparty: t('vat.counterparty'),
  vat_denied: t('vat.denied'),
  vat_direction: t('vat.direction'),
  vat_documentDate: t('vat.documentDate'),
  vat_documents: t('vat.documents'),
  vat_effectiveFrom: t('vat.effectiveFrom'),
  vat_egypt: t('vat.egypt'),
  vat_empty: t('vat.empty'),
  vat_errors_load: t('vat.errors.load'),
  vat_evidenceDate: t('vat.evidenceDate'),
  vat_from: t('vat.from'),
  vat_grossAccount: t('vat.grossAccount'),
  vat_history: t('vat.history'),
  vat_inputAccount: t('vat.inputAccount'),
  vat_inputDifference: t('vat.inputDifference'),
  vat_inputVat: t('vat.inputVat'),
  vat_journal: t('vat.journal'),
  vat_jurisdiction: t('vat.jurisdiction'),
  vat_netVat: t('vat.netVat'),
  vat_notReconciled: t('vat.notReconciled'),
  vat_original: t('vat.original'),
  vat_outputAccount: t('vat.outputAccount'),
  vat_outputDifference: t('vat.outputDifference'),
  vat_outputVat: t('vat.outputVat'),
  vat_policy: t('vat.policy'),
  vat_rate: t('vat.rate'),
  vat_reconciled: t('vat.reconciled'),
  vat_reference: t('vat.reference'),
  vat_registration: t('vat.registration'),
  vat_reverse: t('vat.reverse'),
  vat_run: t('vat.run'),
  vat_scopeWarning: t('vat.scopeWarning'),
  vat_setupPolicy: t('vat.setupPolicy'),
  vat_setupTitle: t('vat.setupTitle'),
  vat_tax: t('vat.tax'),
  vat_taxPointDate: t('vat.taxPointDate'),
  vat_title: t('vat.title'),
  vat_to: t('vat.to'),
}))
const taxSetup = computed<BsTaxWorkspaceSetupForm>({ get: () => ({ ...setup }), set: value => Object.assign(setup, value) })
const taxForm = computed<BsTaxWorkspaceDocumentForm>({ get: () => ({ documentDate: form.documentDate, taxPointDate: form.taxPointDate, reference: form.reference, base: form.base, baseAccount: form.baseAccount, grossAccount: form.grossAccount, counterparty: form.counterparty, original: form.original, reason: form.reason }), set: value => Object.assign(form, value) })
function taxMoney(value: string | number) { return formatPresentationMoney(value, { currency: 'EGP', locale: locale.value, unit: 'minor', numberingSystem: 'latn' }) }
const taxView = computed<BsTaxWorkspaceView>(() => ({
  context: ledgerPresentation.context(from.value, to.value), contextLabel: t('pageContext.label'), canRead: can('tax.read'), canConfigure: can('tax.configure'), canPost: can('tax.post'), canAdjust: can('tax.adjust'), readOnly: readOnly.value,
  pending: pending.value, loadError: Boolean(error.value), available: Boolean(workspace.value), setupError: setupError.value, setupPending: setupSaving.value, setupDisabled: setupSaving.value || readOnly.value || !outputAccounts.value.length || !inputAccounts.value.length,
  profile: profile.value ? { registration: profile.value.registration_number, rate: `${(currentRule.value?.rate_basis_points ?? 0) / 100}%`, evidenceDate: currentRule.value?.evidence_verified_on ?? '', ruleName: (locale.value === 'ar' ? currentRule.value?.name_ar : currentRule.value?.name_en) ?? '' } : null,
  report: report.value ? { output: taxMoney(report.value.output_tax_minor), input: taxMoney(report.value.input_tax_minor), net: taxMoney(report.value.net_vat_minor), outputDifference: taxMoney(report.value.output_difference_minor), inputDifference: taxMoney(report.value.input_difference_minor), reconciled: reconciled.value, documents: report.value.documents.map(row => ({ id: row.id, taxPointDate: row.tax_point_date, documentDate: row.document_date, reference: row.reference, kindLabel: `${t(`vat.directions.${row.direction}`)} · ${t(`vat.kinds.${row.kind}`)}`, base: taxMoney(row.taxable_base_minor), tax: taxMoney(row.tax_minor), journalTo: `/transactions?q=${encodeURIComponent(row.transaction_id)}`, canReverse: row.kind === 'invoice' && !report.value!.documents.some(adjustment => adjustment.adjusts_document_id === row.id) && can('tax.reverse') })) } : null,
  dialogTitle: t(form.kind === 'reversal' ? 'vat.reverse' : form.kind === 'credit' ? 'vat.creditTitle' : form.direction === 'output' ? 'vat.addOutput' : 'vat.addInput'), dialogPending: saving.value, dialogDirty: dirty.value, dialogError: formError.value, isCredit: form.kind === 'credit', isReversal: form.kind === 'reversal', needsReason: form.kind !== 'invoice', reasonLabel: t(form.kind === 'reversal' ? 'vat.reversalReason' : 'vat.reason'), amountError: amountError.value, previewTax: taxMoney(previewTax.value),
}))
const taxChoices = computed<BsTaxWorkspaceChoices>(() => ({ output: outputAccounts.value.map(row => ({ value: row.id, label: `${row.code} · ${row.name}` })), input: inputAccounts.value.map(row => ({ value: row.id, label: `${row.code} · ${row.name}` })), base: availableBaseAccounts.value.map(row => ({ value: row.id, label: `${row.code} · ${row.name}` })), gross: availableGrossAccounts.value.map(row => ({ value: row.id, label: `${row.code} · ${row.name}` })), originals: originalInvoices.value.map(row => ({ value: row.id, label: `${row.reference} · ${row.tax_point_date}` })), counterparties: (workspace.value?.counterparties ?? []).filter(row => !row.archived).map(row => ({ value: row.id, label: row.name })) }))
function reverseTaxDocument(id: string) { const document = report.value?.documents.find(row => row.id === id); if (document) beginReversal(document) }
</script>
<template>
  <BsTaxWorkspacePage v-model:setup="taxSetup" v-model:form="taxForm" v-model:from="from" v-model:to="to" v-model:visible="visible" :copy="taxCopy" :view="taxView" :choices="taxChoices" @reload="load" @save-setup="saveSetup" @save-document="saveDocument" @validate-amount="baseMinor" @begin-output="begin('output')" @begin-input="begin('input')" @begin-output-credit="begin('output', 'credit')" @begin-input-credit="begin('input', 'credit')" @reverse="reverseTaxDocument" />
</template>
