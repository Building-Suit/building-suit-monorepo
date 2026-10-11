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
</script>

<template>
  <BsStack gap="lg">
    <BsPageHeader
      :title="t('vat.title')"
      :subtitle="t('vat.policy')"
      :context="ledgerPresentation.context(from, to, undefined)"
      :context-label="ledgerPresentation.t('pageContext.label')"
    />
    <BsBox role="note" as="aside" padding="lg" border radius="control">{{ t('vat.scopeWarning') }}</BsBox>
    <BsText v-if="!can('tax.read')" role="status">{{ t('vat.denied') }}</BsText>
    <template v-else>
      <BsText v-if="error" role="alert" tone="danger">{{ t('vat.errors.load') }} <BsButton type="submit" @click="load">{{ t('common.retry') }}</BsButton></BsText>
      <BsSectionSkeleton v-else-if="pending" variant="table" :rows="5" />
      <template v-else-if="workspace">
        <BsCard v-if="!profile" as="section" padding="md">
          <BsStack gap="md">
            <BsHeading :level="2" size="h2">{{ t('vat.setupTitle') }}</BsHeading>
            <BsText>{{ t('vat.setupPolicy') }}</BsText>
            <BsText v-if="setupError" role="alert" tone="danger">{{ setupError }}</BsText>
            <BsForm v-if="can('tax.configure')" layout="grid" :columns="2" @submit.prevent="saveSetup">
              <BsFloatingField :label="t('vat.registration')">
                <BsInput v-model="setup.registration" required maxlength="64" />
              </BsFloatingField>
              <BsFloatingField :label="t('vat.effectiveFrom')">
                <BsInput v-model="setup.effective" type="date" required />
              </BsFloatingField>
              <BsFloatingField :label="t('vat.outputAccount')">
                <BsSelect v-model="setup.output" required native>
                  <BsSelectOption value="" />
                  <BsSelectOption v-for="a in outputAccounts" :key="a.id" :value="a.id">{{ a.code }} · {{ a.name }}</BsSelectOption>
                </BsSelect>
              </BsFloatingField>
              <BsFloatingField :label="t('vat.inputAccount')">
                <BsSelect v-model="setup.input" required native>
                  <BsSelectOption value="" />
                  <BsSelectOption v-for="a in inputAccounts" :key="a.id" :value="a.id">{{ a.code }} · {{ a.name }}</BsSelectOption>
                </BsSelect>
              </BsFloatingField>
              <BsButton type="submit" :disabled="setupSaving || readOnly || !outputAccounts.length || !inputAccounts.length" variant="primary">{{ t('vat.confirmRegistration') }}</BsButton>
            </BsForm>
          </BsStack>
        </BsCard>
        <template v-else>
          <BsCard as="section" padding="md">
            <BsDescriptionList :columns="3">
              <BsBox>
                <BsDescriptionTerm>{{ t('vat.registration') }}</BsDescriptionTerm>
                <BsDescriptionValue>{{ profile.registration_number }}</BsDescriptionValue>
              </BsBox>
              <BsBox>
                <BsDescriptionTerm>{{ t('vat.jurisdiction') }}</BsDescriptionTerm>
                <BsDescriptionValue>{{ t('vat.egypt') }}</BsDescriptionValue>
              </BsBox>
              <BsBox>
                <BsDescriptionTerm>{{ t('vat.rate') }}</BsDescriptionTerm>
                <BsDescriptionValue>{{ (currentRule?.rate_basis_points ?? 0) / 100 }}%</BsDescriptionValue>
              </BsBox>
              <BsBox>
                <BsDescriptionTerm>{{ t('vat.evidenceDate') }}</BsDescriptionTerm>
                <BsDescriptionValue>{{ currentRule?.evidence_verified_on }}</BsDescriptionValue>
              </BsBox>
            </BsDescriptionList>
            <BsText size="sm" tone="muted">{{ locale === 'ar' ? currentRule?.name_ar : currentRule?.name_en }}</BsText>
          </BsCard>
          <BsCard as="div" padding="md">
            <BsStack gap="md">
              <BsFloatingField :label="t('vat.from')">
                <BsInput v-model="from" type="date" :max="to" />
              </BsFloatingField>
              <BsFloatingField :label="t('vat.to')">
                <BsInput v-model="to" type="date" :min="from" />
              </BsFloatingField>
              <BsButton type="submit" @click="load">{{ t('vat.run') }}</BsButton>
            </BsStack>
          </BsCard>
          <BsInline gap="sm" :wrap="true">
            <BsButton v-if="can('tax.post')" type="submit" :disabled="readOnly" variant="primary" @click="begin('output')">{{ t('vat.addOutput') }}</BsButton>
            <BsButton v-if="can('tax.post')" type="submit" :disabled="readOnly" variant="primary" @click="begin('input')">{{ t('vat.addInput') }}</BsButton>
            <BsButton v-if="can('tax.adjust')" type="submit" :disabled="readOnly" @click="begin('output','credit')">{{ t('vat.addOutputCredit') }}</BsButton>
            <BsButton v-if="can('tax.adjust')" type="submit" :disabled="readOnly" @click="begin('input','credit')">{{ t('vat.addInputCredit') }}</BsButton>
          </BsInline>
          <template v-if="report">
            <BsCard as="section" padding="md">
              <BsText :data-vat-reconciled="reconciled" :tone="reconciled ? 'success' : 'danger'">{{ reconciled ? t('vat.reconciled') : t('vat.notReconciled') }}</BsText>
              <BsDescriptionList :columns="3">
                <BsBox>
                  <BsDescriptionTerm>{{ t('vat.outputVat') }}</BsDescriptionTerm>
                  <BsDescriptionValue>
                    <BsMoneyText :amount="report.output_tax_minor" :currency="ledgerPresentation.currency('EGP')" :locale="ledgerPresentation.locale" />
                  </BsDescriptionValue>
                </BsBox>
                <BsBox>
                  <BsDescriptionTerm>{{ t('vat.inputVat') }}</BsDescriptionTerm>
                  <BsDescriptionValue>
                    <BsMoneyText :amount="report.input_tax_minor" :currency="ledgerPresentation.currency('EGP')" :locale="ledgerPresentation.locale" />
                  </BsDescriptionValue>
                </BsBox>
                <BsBox>
                  <BsDescriptionTerm>{{ t('vat.netVat') }}</BsDescriptionTerm>
                  <BsDescriptionValue>
                    <BsMoneyText :amount="report.net_vat_minor" :currency="ledgerPresentation.currency('EGP')" :locale="ledgerPresentation.locale" />
                  </BsDescriptionValue>
                </BsBox>
                <BsBox>
                  <BsDescriptionTerm>{{ t('vat.outputDifference') }}</BsDescriptionTerm>
                  <BsDescriptionValue>
                    <BsMoneyText :amount="report.output_difference_minor" :currency="ledgerPresentation.currency('EGP')" :locale="ledgerPresentation.locale" />
                  </BsDescriptionValue>
                </BsBox>
                <BsBox>
                  <BsDescriptionTerm>{{ t('vat.inputDifference') }}</BsDescriptionTerm>
                  <BsDescriptionValue>
                    <BsMoneyText :amount="report.input_difference_minor" :currency="ledgerPresentation.currency('EGP')" :locale="ledgerPresentation.locale" />
                  </BsDescriptionValue>
                </BsBox>
              </BsDescriptionList>
            </BsCard>
            <BsCard as="section" padding="none" overflow="hidden">
              <BsHeading :level="2" size="h2">{{ t('vat.documents') }}</BsHeading>
              <BsDataTable
                :value="report.documents"
                row-key="id"
                :label="t('vat.documents')"
                :columns="[{ key: 'tax_point_date', field: 'tax_point_date', header: t('vat.taxPointDate') }, { key: 'document_date', field: 'document_date', header: t('vat.documentDate') }, { key: 'reference', field: 'reference', header: t('vat.reference') }, { key: 'column4', header: t('vat.direction') }, { key: 'column5', header: t('vat.base') }, { key: 'column6', header: t('vat.tax') }, { key: 'column7', header: t('vat.history') }]"
              >
                <template #empty>{{ t('vat.empty') }}</template>
                <template #cell-column4="{ row }">{{ t(`vat.directions.${row.direction}`) }} · {{ t(`vat.kinds.${row.kind}`) }}</template>
                <template #cell-column5="{ row }">
                  <BsMoneyText :amount="row.taxable_base_minor" :currency="ledgerPresentation.currency('EGP')" :locale="ledgerPresentation.locale" />
                </template>
                <template #cell-column6="{ row }">
                  <BsMoneyText :amount="row.tax_minor" :currency="ledgerPresentation.currency('EGP')" :locale="ledgerPresentation.locale" />
                </template>
                <template #cell-column7="{ row }">
                  <BsLink :to="{ path: '/transactions', query: { q: row.transaction_id } }">{{ t('vat.journal') }}</BsLink>
                  <BsButton
                    v-if="row.kind==='invoice' && !report.documents.some(a=>a.adjusts_document_id===row.id) && can('tax.reverse')"
                    type="submit"
                    :disabled="readOnly"
                    @click="beginReversal(row)"
                  >{{ t('vat.reverse') }}</BsButton>
                </template>
              </BsDataTable>
            </BsCard>
          </template>
        </template>
      </template>
    </template>
    <BsRecordActionDialog
      v-model:visible="visible"
      :title="t(form.kind === 'reversal' ? 'vat.reverse' : form.kind === 'credit' ? 'vat.creditTitle' : form.direction === 'output' ? 'vat.addOutput' : 'vat.addInput')"
      :pending="saving"
      :dirty="dirty"
      :error="formError"
      size="lg"
      :submit-label="t('common.save')"
      :cancel-label="t('common.cancel')"
      :submit-disabled="readOnly"
      @submit="saveDocument"
    >
      <BsFloatingField v-if="form.kind==='credit'" :label="t('vat.original')">
        <BsSelect v-model="form.original" required native>
          <BsSelectOption value="" />
          <BsSelectOption v-for="d in originalInvoices" :key="d.id" :value="d.id">{{ d.reference }} · {{ d.tax_point_date }}</BsSelectOption>
        </BsSelect>
      </BsFloatingField>
      <BsFloatingField :label="t('vat.reference')">
        <BsInput v-model="form.reference" :disabled="form.kind==='reversal'" required />
      </BsFloatingField>
      <BsGrid :columns="2" gap="md">
        <BsFloatingField :label="t('vat.documentDate')">
          <BsInput v-model="form.documentDate" type="date" required />
        </BsFloatingField>
        <BsFloatingField :label="t('vat.taxPointDate')">
          <BsInput v-model="form.taxPointDate" type="date" required />
        </BsFloatingField>
      </BsGrid>
      <BsFloatingField :label="t('vat.counterparty')">
        <BsSelect v-model="form.counterparty" :disabled="form.kind==='reversal'" native>
          <BsSelectOption value="" />
          <BsSelectOption v-for="c in workspace?.counterparties.filter(c=>!c.archived)" :key="c.id" :value="c.id">{{ c.name }}</BsSelectOption>
        </BsSelect>
      </BsFloatingField>
      <BsFloatingField :label="t('vat.baseAccount')">
        <BsSelect v-model="form.baseAccount" :disabled="form.kind==='reversal'" required native>
          <BsSelectOption value="" />
          <BsSelectOption v-for="a in availableBaseAccounts" :key="a.id" :value="a.id">{{ a.code }} · {{ a.name }}</BsSelectOption>
        </BsSelect>
      </BsFloatingField>
      <BsFloatingField :label="t('vat.grossAccount')">
        <BsSelect v-model="form.grossAccount" :disabled="form.kind==='reversal'" required native>
          <BsSelectOption value="" />
          <BsSelectOption v-for="a in availableGrossAccounts" :key="a.id" :value="a.id">{{ a.code }} · {{ a.name }}</BsSelectOption>
        </BsSelect>
      </BsFloatingField>
      <BsFloatingField :label="t('vat.base')">
        <BsInput
          id="vat-base"
          v-model="form.base"
          inputmode="decimal"
          :disabled="form.kind==='reversal'"
          required
          :aria-invalid="Boolean(amountError)"
          :aria-describedby="amountError ? 'vat-base-error' : undefined"
          @blur="baseMinor()"
        />
      </BsFloatingField>
      <BsText v-if="amountError" id="vat-base-error" role="alert" size="sm" tone="danger">{{ amountError }}</BsText>
      <BsText>{{ t('vat.calculatedTax') }}: <BsMoneyText :amount="previewTax" :currency="ledgerPresentation.currency('EGP')" :locale="ledgerPresentation.locale" /></BsText>
      <BsFloatingField v-if="form.kind!=='invoice'" :label="t(form.kind==='reversal' ? 'vat.reversalReason' : 'vat.reason')">
        <BsInput v-model="form.reason" required />
      </BsFloatingField>
    </BsRecordActionDialog>
  </BsStack>
</template>
