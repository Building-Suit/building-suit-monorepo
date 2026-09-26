<script setup lang="ts">
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
watch([currentId, () => user.value?.id], () => { visible.value = false; setupError.value = ''; formError.value = '' }, { flush: 'sync' })

function begin(direction: VatDirection, kind: 'invoice' | 'credit' = 'invoice') {
  const date = to.value
  Object.assign(form, { direction, kind, documentDate: date, taxPointDate: date, reference: '', base: '', baseAccount: '', grossAccount: '', counterparty: '', original: '', reason: '', key: crypto.randomUUID() })
  formError.value = ''
  open()
}
function beginReversal(document: VatDocumentRow) {
  Object.assign(form, { direction: document.direction, kind: 'reversal', documentDate: to.value, taxPointDate: to.value,
    reference: document.reference, base: minorToInput(document.taxable_base_minor), baseAccount: document.base_account_id,
    grossAccount: document.gross_account_id, counterparty: document.counterparty_id ?? '', original: document.id,
    reason: '', key: crypto.randomUUID() })
  formError.value = ''
  open()
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
  formError.value = ''; saving.value = true
  try {
    const base = parseMoneyToMinor(form.base, 'EGP')
    if (base <= 0n) throw new Error('invalid')
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
</script>

<template>
  <div class="space-y-6">
    <header><h1 class="text-h1 font-bold">{{ t('vat.title') }}</h1><p class="mt-2 text-fg-muted">{{ t('vat.policy') }}</p></header>
    <aside class="rounded-control border border-warning bg-[var(--bs-status-warning-bg)] p-4" role="note">{{ t('vat.scopeWarning') }}</aside>
    <p v-if="!can('tax.read')" class="ls-card p-5" role="status">{{ t('vat.denied') }}</p>
    <template v-else>
      <p v-if="error" class="ls-error" role="alert">{{ t('vat.errors.load') }} <button class="ls-btn" @click="load">{{ t('common.retry') }}</button></p>
      <SectionSkeleton v-else-if="pending" variant="table" :rows="5" />
      <template v-else-if="workspace">
        <section v-if="!profile" class="ls-card p-5 space-y-4">
          <h2 class="text-h2 font-bold">{{ t('vat.setupTitle') }}</h2><p>{{ t('vat.setupPolicy') }}</p>
          <p v-if="setupError" class="ls-error" role="alert">{{ setupError }}</p>
          <form v-if="can('tax.configure')" class="grid gap-4 md:grid-cols-2" @submit.prevent="saveSetup">
            <FloatingField :label="t('vat.registration')"><input v-model="setup.registration" class="ls-input" required maxlength="64"></FloatingField>
            <FloatingField :label="t('vat.effectiveFrom')"><input v-model="setup.effective" type="date" class="ls-input" required></FloatingField>
            <FloatingField :label="t('vat.outputAccount')"><select v-model="setup.output" class="ls-input" required><option value="" /><option v-for="a in outputAccounts" :key="a.id" :value="a.id">{{ a.code }} · {{ a.name }}</option></select></FloatingField>
            <FloatingField :label="t('vat.inputAccount')"><select v-model="setup.input" class="ls-input" required><option value="" /><option v-for="a in inputAccounts" :key="a.id" :value="a.id">{{ a.code }} · {{ a.name }}</option></select></FloatingField>
            <button class="ls-btn ls-btn-primary md:col-span-2" :disabled="setupSaving || readOnly || !outputAccounts.length || !inputAccounts.length">{{ t('vat.confirmRegistration') }}</button>
          </form>
        </section>
        <template v-else>
          <section class="ls-card p-5"><dl class="grid gap-3 md:grid-cols-4"><div><dt>{{ t('vat.registration') }}</dt><dd>{{ profile.registration_number }}</dd></div><div><dt>{{ t('vat.jurisdiction') }}</dt><dd>{{ t('vat.egypt') }}</dd></div><div><dt>{{ t('vat.rate') }}</dt><dd>{{ (currentRule?.rate_basis_points ?? 0) / 100 }}%</dd></div><div><dt>{{ t('vat.evidenceDate') }}</dt><dd>{{ currentRule?.evidence_verified_on }}</dd></div></dl><p class="mt-3 text-sm text-fg-muted">{{ locale === 'ar' ? currentRule?.name_ar : currentRule?.name_en }}</p></section>
          <div class="ls-card grid gap-4 p-5 sm:grid-cols-3"><FloatingField :label="t('vat.from')"><input v-model="from" type="date" class="ls-input" :max="to"></FloatingField><FloatingField :label="t('vat.to')"><input v-model="to" type="date" class="ls-input" :min="from"></FloatingField><button class="ls-btn self-end" @click="load">{{ t('vat.run') }}</button></div>
          <div class="flex flex-wrap gap-2"><button v-if="can('tax.post')" class="ls-btn ls-btn-primary" :disabled="readOnly" @click="begin('output')">{{ t('vat.addOutput') }}</button><button v-if="can('tax.post')" class="ls-btn ls-btn-primary" :disabled="readOnly" @click="begin('input')">{{ t('vat.addInput') }}</button><button v-if="can('tax.adjust')" class="ls-btn" :disabled="readOnly" @click="begin('output','credit')">{{ t('vat.addOutputCredit') }}</button><button v-if="can('tax.adjust')" class="ls-btn" :disabled="readOnly" @click="begin('input','credit')">{{ t('vat.addInputCredit') }}</button></div>
          <template v-if="report">
            <section class="ls-card p-5"><p :class="reconciled ? 'text-success' : 'text-danger'" :data-vat-reconciled="reconciled">{{ reconciled ? t('vat.reconciled') : t('vat.notReconciled') }}</p><dl class="mt-4 grid gap-3 sm:grid-cols-5"><div><dt>{{ t('vat.outputVat') }}</dt><dd><MoneyText :amount-minor="report.output_tax_minor" currency="EGP" /></dd></div><div><dt>{{ t('vat.inputVat') }}</dt><dd><MoneyText :amount-minor="report.input_tax_minor" currency="EGP" /></dd></div><div><dt>{{ t('vat.netVat') }}</dt><dd><MoneyText :amount-minor="report.net_vat_minor" currency="EGP" /></dd></div><div><dt>{{ t('vat.outputDifference') }}</dt><dd><MoneyText :amount-minor="report.output_difference_minor" currency="EGP" /></dd></div><div><dt>{{ t('vat.inputDifference') }}</dt><dd><MoneyText :amount-minor="report.input_difference_minor" currency="EGP" /></dd></div></dl></section>
            <section class="ls-card overflow-hidden"><h2 class="p-4 text-h2 font-bold">{{ t('vat.documents') }}</h2><BsDataTable :value="report.documents" data-key="id" :table-props="{ 'aria-label': t('vat.documents') }"><template #empty>{{ t('vat.empty') }}</template><Column field="tax_point_date" :header="t('vat.taxPointDate')" /><Column field="document_date" :header="t('vat.documentDate')" /><Column field="reference" :header="t('vat.reference')" /><Column :header="t('vat.direction')"><template #body="{ data: row }">{{ t(`vat.directions.${row.direction}`) }} · {{ t(`vat.kinds.${row.kind}`) }}</template></Column><Column :header="t('vat.base')"><template #body="{ data: row }"><MoneyText :amount-minor="row.taxable_base_minor" currency="EGP" /></template></Column><Column :header="t('vat.tax')"><template #body="{ data: row }"><MoneyText :amount-minor="row.tax_minor" currency="EGP" /></template></Column><Column :header="t('vat.history')"><template #body="{ data: row }"><NuxtLink :to="{ path: '/transactions', query: { q: row.transaction_id } }" class="text-link underline">{{ t('vat.journal') }}</NuxtLink><button v-if="row.kind==='invoice' && !report.documents.some(a=>a.adjusts_document_id===row.id) && can('tax.reverse')" class="ls-btn ms-2" :disabled="readOnly" @click="beginReversal(row)">{{ t('vat.reverse') }}</button></template></Column></BsDataTable></section>
          </template>
        </template>
      </template>
    </template>

    <BsDialog v-model:visible="visible" :title="t(form.kind === 'reversal' ? 'vat.reverse' : form.kind === 'credit' ? 'vat.creditTitle' : form.direction === 'output' ? 'vat.addOutput' : 'vat.addInput')" :pending="saving" :dirty="dirty" size="lg"><template #default="{ close }"><form class="space-y-4 p-5" @submit.prevent="saveDocument"><p v-if="formError" class="ls-error" role="alert">{{ formError }}</p><FloatingField v-if="form.kind==='credit'" :label="t('vat.original')"><select v-model="form.original" class="ls-input" required><option value="" /><option v-for="d in originalInvoices" :key="d.id" :value="d.id">{{ d.reference }} · {{ d.tax_point_date }}</option></select></FloatingField><FloatingField :label="t('vat.reference')"><input v-model="form.reference" class="ls-input" :disabled="form.kind==='reversal'" required></FloatingField><div class="grid gap-4 sm:grid-cols-2"><FloatingField :label="t('vat.documentDate')"><input v-model="form.documentDate" type="date" class="ls-input" required></FloatingField><FloatingField :label="t('vat.taxPointDate')"><input v-model="form.taxPointDate" type="date" class="ls-input" required></FloatingField></div><FloatingField :label="t('vat.counterparty')"><select v-model="form.counterparty" class="ls-input" :disabled="form.kind==='reversal'"><option value="" /><option v-for="c in workspace?.counterparties.filter(c=>!c.archived)" :key="c.id" :value="c.id">{{ c.name }}</option></select></FloatingField><FloatingField :label="t('vat.baseAccount')"><select v-model="form.baseAccount" class="ls-input" :disabled="form.kind==='reversal'" required><option value="" /><option v-for="a in availableBaseAccounts" :key="a.id" :value="a.id">{{ a.code }} · {{ a.name }}</option></select></FloatingField><FloatingField :label="t('vat.grossAccount')"><select v-model="form.grossAccount" class="ls-input" :disabled="form.kind==='reversal'" required><option value="" /><option v-for="a in availableGrossAccounts" :key="a.id" :value="a.id">{{ a.code }} · {{ a.name }}</option></select></FloatingField><FloatingField :label="t('vat.base')"><input v-model="form.base" class="ls-input" inputmode="decimal" :disabled="form.kind==='reversal'" required></FloatingField><p>{{ t('vat.calculatedTax') }}: <MoneyText :amount-minor="previewTax" currency="EGP" /></p><FloatingField v-if="form.kind!=='invoice'" :label="t(form.kind==='reversal' ? 'vat.reversalReason' : 'vat.reason')"><input v-model="form.reason" class="ls-input" required></FloatingField><div class="flex justify-end gap-2"><button type="button" class="ls-btn" @click="close">{{ t('common.cancel') }}</button><button class="ls-btn ls-btn-primary" :disabled="saving || readOnly">{{ t('common.save') }}</button></div></form></template></BsDialog>
  </div>
</template>
