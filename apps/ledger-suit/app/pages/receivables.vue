<script setup lang="ts">
import { useLedgerFxSubledgerPanelView } from '~/composables/useLedgerFxSubledgerPanelView'
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
  <BsStack gap="lg">
    <BsPageHeader
      :title="t('ar.title')"
      :subtitle="t('ar.policy')"
      :context="ledgerPresentation.context(from, asOf, undefined)"
      :context-label="ledgerPresentation.t('pageContext.label')"
    />
    <BsWorkflowScope v-if="can('fx.read')" :factory="useLedgerFxSubledgerPanelView" :input="{ subledger: 'customer', asOf: (asOf), readOnly: (readOnly) }">
      <template #default="{ state: ledgerView11 }">
        <BsCard data-testid="fx-panel" as="section" padding="none" overflow="hidden">
          <BsBox padding="lg">
            <BsHeading :level="2" size="h2">{{ ledgerView11.t('fx.title') }}</BsHeading>
            <BsText size="sm" tone="muted">{{ ledgerView11.t('fx.policy') }}</BsText>
          </BsBox>
          <BsInline role="tablist" gap="sm" :wrap="true" padding="lg">
            <BsButton
              v-for="name in (['item','settlement','revaluation','reversal','mapping'] as const)"
              :key="name"
              variant="chip"
              type="submit"
              :aria-selected="ledgerView11.tab===name"
              @click="ledgerView11.tab=name"
            >{{ ledgerView11.t(`fx.tabs.${name}`) }}</BsButton>
          </BsInline>
          <BsText v-if="ledgerView11.error" role="alert" tone="danger">{{ ledgerView11.t('fx.errors.load') }} <BsButton type="submit" @click="ledgerView11.load">{{ ledgerView11.t('common.retry') }}</BsButton></BsText>
          <BsSectionSkeleton v-else-if="ledgerView11.pending" variant="table" :rows="3" />
          <BsStack v-else gap="md" padding="lg">
            <BsText v-if="ledgerView11.failure" role="alert" tone="danger">{{ ledgerView11.t('fx.errors.save') }} · {{ ledgerView11.failure }}</BsText>
            <BsText v-if="ledgerView11.message" role="status">{{ ledgerView11.message }}</BsText>
            <BsText v-if="!ledgerView11.data?.mapping && ledgerView11.tab!=='mapping'" tone="warning">{{ ledgerView11.t('fx.mappingRequired') }}</BsText>
            <BsText v-if="ledgerView11.tab==='mapping' && ledgerView11.data?.mapping" role="status">{{ ledgerView11.t('fx.mappingConfigured') }}</BsText>
            <BsForm v-if="ledgerView11.tab==='mapping' && !ledgerView11.data?.mapping" layout="grid" :columns="2" @submit.prevent="ledgerView11.saveMapping">
              <BsFloatingField
                v-for="field in ([['realizedGain','realizedGain'],['realizedLoss','realizedLoss'],['unrealizedGain','unrealizedGain'],['unrealizedLoss','unrealizedLoss']] as const)"
                :key="field[0]"
                :label="ledgerView11.t(`fx.${field[1]}`)"
              >
                <BsSelect v-model="ledgerView11.mapping[field[0]]" required native>
                  <BsSelectOption value="" />
                  <BsSelectOption
                    v-for="a in ledgerView11.posting.filter(a=>field[0].toLowerCase().includes('gain')?a.type==='revenue':a.type==='expense')"
                    :key="a.id"
                    :value="a.id"
                  >{{ a.name }}</BsSelectOption>
                </BsSelect>
              </BsFloatingField>
              <BsButton type="submit" :disabled="ledgerView11.busy || ledgerView11.readOnly || !ledgerView11.can('fx.manage')" variant="primary">{{ ledgerView11.t('common.save') }}</BsButton>
            </BsForm>
            <BsForm v-if="ledgerView11.tab==='item'" layout="grid" :columns="2" @submit.prevent="ledgerView11.saveItem">
              <BsFloatingField :label="ledgerView11.t('fx.counterparty')">
                <BsSelect v-model="ledgerView11.item.counterparty" required native>
                  <BsSelectOption value="" />
                  <BsSelectOption v-for="c in ledgerView11.data?.counterparties??[]" :key="c.id" :value="c.id">{{ c.name }}</BsSelectOption>
                </BsSelect>
              </BsFloatingField>
              <BsFloatingField :label="ledgerView11.t('fx.control')">
                <BsSelect v-model="ledgerView11.item.control" required native>
                  <BsSelectOption value="" />
                  <BsSelectOption v-for="a in ledgerView11.controls" :key="a.id" :value="a.id">{{ a.name }}</BsSelectOption>
                </BsSelect>
              </BsFloatingField>
              <BsFloatingField :label="ledgerView11.t('fx.offset')">
                <BsSelect v-model="ledgerView11.item.offset" required native>
                  <BsSelectOption value="" />
                  <BsSelectOption
                    v-for="a in ledgerView11.posting.filter(a=>ledgerView11.subledger==='customer'?a.type==='revenue':['expense','asset'].includes(a.type))"
                    :key="a.id"
                    :value="a.id"
                  >{{ a.name }}</BsSelectOption>
                </BsSelect>
              </BsFloatingField>
              <BsFloatingField :label="ledgerView11.t('fx.currency')">
                <BsSelect v-model="ledgerView11.item.currency" native>
                  <BsSelectOption v-for="c in ledgerView11.data?.currencies??[]" :key="c.code" :value="c.code">{{ c.code }} · {{ c.name }}</BsSelectOption>
                </BsSelect>
              </BsFloatingField>
              <BsFloatingField :label="ledgerView11.t('fx.documentDate')">
                <BsInput v-model="ledgerView11.item.date" type="date" required />
              </BsFloatingField>
              <BsFloatingField :label="ledgerView11.t('fx.dueDate')">
                <BsInput v-model="ledgerView11.item.due" type="date" :min="ledgerView11.item.date" required />
              </BsFloatingField>
              <BsFloatingField :label="ledgerView11.t('fx.reference')">
                <BsInput v-model="ledgerView11.item.reference" required />
              </BsFloatingField>
              <BsFloatingField :label="ledgerView11.t('fx.amount')">
                <BsInput v-model="ledgerView11.item.amount" inputmode="decimal" required />
              </BsFloatingField>
              <BsFloatingField :label="ledgerView11.t('fx.baseRate')">
                <BsInput v-model="ledgerView11.item.rate" inputmode="decimal" required />
              </BsFloatingField>
              <BsFloatingField :label="ledgerView11.t('fx.rateSource')">
                <BsInput v-model="ledgerView11.item.source" required />
              </BsFloatingField>
              <BsFloatingField :label="ledgerView11.t('fx.rateEvidence')">
                <BsInput v-model="ledgerView11.item.evidence" required />
              </BsFloatingField>
              <BsButton type="submit" :disabled="ledgerView11.busy || ledgerView11.readOnly || !ledgerView11.data?.mapping" variant="primary">{{ ledgerView11.t('fx.postItem') }}</BsButton>
            </BsForm>
            <BsForm v-if="ledgerView11.tab==='settlement'" @submit.prevent="ledgerView11.saveSettlement">
              <BsGrid :columns="2" gap="md">
                <BsFloatingField :label="ledgerView11.t('fx.counterparty')">
                  <BsSelect v-model="ledgerView11.settlement.counterparty" required native>
                    <BsSelectOption value="" />
                    <BsSelectOption v-for="c in ledgerView11.data?.counterparties??[]" :key="c.id" :value="c.id">{{ c.name }}</BsSelectOption>
                  </BsSelect>
                </BsFloatingField>
                <BsFloatingField :label="ledgerView11.t('fx.control')">
                  <BsSelect v-model="ledgerView11.settlement.control" required native>
                    <BsSelectOption value="" />
                    <BsSelectOption v-for="a in ledgerView11.controls" :key="a.id" :value="a.id">{{ a.name }}</BsSelectOption>
                  </BsSelect>
                </BsFloatingField>
                <BsFloatingField :label="ledgerView11.t('fx.cash')">
                  <BsSelect v-model="ledgerView11.settlement.cash" required native>
                    <BsSelectOption value="" />
                    <BsSelectOption v-for="a in ledgerView11.cash" :key="a.id" :value="a.id">{{ a.name }} · {{ a.currency }}</BsSelectOption>
                  </BsSelect>
                </BsFloatingField>
                <BsFloatingField :label="ledgerView11.t('fx.currency')">
                  <BsSelect v-model="ledgerView11.settlement.currency" native>
                    <BsSelectOption v-for="c in ledgerView11.data?.currencies??[]" :key="c.code" :value="c.code">{{ c.code }}</BsSelectOption>
                  </BsSelect>
                </BsFloatingField>
                <BsFloatingField :label="ledgerView11.t('fx.settlementDate')">
                  <BsInput v-model="ledgerView11.settlement.date" type="date" required />
                </BsFloatingField>
                <BsFloatingField :label="ledgerView11.t('fx.reference')">
                  <BsInput v-model="ledgerView11.settlement.reference" required />
                </BsFloatingField>
                <BsFloatingField :label="ledgerView11.t('fx.gross')">
                  <BsInput v-model="ledgerView11.settlement.gross" inputmode="decimal" required />
                </BsFloatingField>
                <BsFloatingField :label="ledgerView11.t('fx.baseRate')">
                  <BsInput v-model="ledgerView11.settlement.rate" inputmode="decimal" required />
                </BsFloatingField>
                <BsFloatingField :label="ledgerView11.t('fx.rateSource')">
                  <BsInput v-model="ledgerView11.settlement.source" required />
                </BsFloatingField>
                <BsFloatingField :label="ledgerView11.t('fx.rateEvidence')">
                  <BsInput v-model="ledgerView11.settlement.evidence" required />
                </BsFloatingField>
              </BsGrid>
              <BsBox v-for="openItem in ledgerView11.eligibleItems" :key="openItem.id" padding="md" border>
                <BsText emphasis="bold">{{ openItem.reference }} · {{ openItem.currency_code }} <BsMoneyText :amount="openItem.outstanding_minor" :currency="ledgerView11.ledgerPresentation.currency(openItem.currency_code)" :locale="ledgerView11.ledgerPresentation.locale" /></BsText>
                <BsGrid :columns="4" gap="md">
                  <BsFloatingField :label="ledgerView11.t('fx.documentAmount')">
                    <BsInput v-model="ledgerView11.settlement.rows[openItem.id]!.document" />
                  </BsFloatingField>
                  <BsFloatingField :label="ledgerView11.t('fx.settlementAmount')">
                    <BsInput v-model="ledgerView11.settlement.rows[openItem.id]!.settlement" />
                  </BsFloatingField>
                  <BsFloatingField :label="ledgerView11.t('fx.crossRate')">
                    <BsInput v-model="ledgerView11.settlement.rows[openItem.id]!.rate" />
                  </BsFloatingField>
                  <BsFloatingField :label="ledgerView11.t('fx.conversionEvidence')">
                    <BsInput v-model="ledgerView11.settlement.rows[openItem.id]!.evidence" />
                  </BsFloatingField>
                </BsGrid>
                <BsText size="xs" tone="muted">{{ ledgerView11.t('fx.expected') }}: {{ ledgerView11.expectedSettlement(ledgerView11.settlement.rows[openItem.id]!,openItem.currency_code) }} {{ ledgerView11.settlement.currency }} {{ ledgerView11.t('fx.minorUnits') }}</BsText>
              </BsBox>
              <BsButton type="submit" :disabled="ledgerView11.busy || ledgerView11.readOnly || !ledgerView11.data?.mapping" variant="primary">{{ ledgerView11.t('fx.postSettlement') }}</BsButton>
            </BsForm>
            <BsForm v-if="ledgerView11.tab==='revaluation'" @submit.prevent="ledgerView11.runPreview">
              <BsGrid :columns="2" gap="md">
                <BsFloatingField :label="ledgerView11.t('fx.control')">
                  <BsSelect v-model="ledgerView11.revaluation.control" required native>
                    <BsSelectOption value="" />
                    <BsSelectOption v-for="a in ledgerView11.controls" :key="a.id" :value="a.id">{{ a.name }}</BsSelectOption>
                  </BsSelect>
                </BsFloatingField>
                <BsFloatingField :label="ledgerView11.t('fx.reference')">
                  <BsInput v-model="ledgerView11.revaluation.reference" required />
                </BsFloatingField>
                <BsFloatingField :label="ledgerView11.t('fx.rateSource')">
                  <BsInput v-model="ledgerView11.revaluation.source" required />
                </BsFloatingField>
              </BsGrid>
              <BsGrid v-for="currency in ledgerView11.itemCurrencies" :key="currency" :columns="2" gap="md">
                <BsFloatingField :label="`${currency} · ${ledgerView11.t('fx.closingRate')}`">
                  <BsInput v-model="(ledgerView11.revaluation.rates[currency]??={rate:'',reference:''}).rate" required />
                </BsFloatingField>
                <BsFloatingField :label="ledgerView11.t('fx.rateEvidence')">
                  <BsInput v-model="ledgerView11.revaluation.rates[currency]!.reference" required />
                </BsFloatingField>
              </BsGrid>
              <BsButton type="submit" :disabled="ledgerView11.busy || !ledgerView11.data?.mapping">{{ ledgerView11.t('fx.preview') }}</BsButton>
            </BsForm>
            <BsStack v-if="ledgerView11.previewLines.length" gap="md">
              <BsDataTable
                :value="ledgerView11.previewLines"
                row-key="open_item_id"
                :label="ledgerView11.t('fx.preview')"
                :columns="[{ key: 'reference', field: 'reference', header: ledgerView11.t('fx.reference') }, { key: 'currency_code', field: 'currency_code', header: ledgerView11.t('fx.currency') }, { key: 'column3', header: ledgerView11.t('fx.outstanding') }, { key: 'column4', header: ledgerView11.t('fx.currentCarrying') }, { key: 'column5', header: ledgerView11.t('fx.closingBase') }, { key: 'column6', header: ledgerView11.t('fx.delta') }]"
              >
                <template #cell-column3="{row:row}">
                  <BsMoneyText
                    :amount="row.outstanding_minor"
                    :currency="ledgerView11.ledgerPresentation.currency(row.currency_code)"
                    :locale="ledgerView11.ledgerPresentation.locale"
                  />
                </template>
                <template #cell-column4="{row:row}">
                  <BsMoneyText
                    :amount="row.current_carrying_base_minor"
                    :currency="ledgerView11.ledgerPresentation.currency()"
                    :locale="ledgerView11.ledgerPresentation.locale"
                  />
                </template>
                <template #cell-column5="{row:row}">
                  <BsMoneyText :amount="row.closing_base_minor" :currency="ledgerView11.ledgerPresentation.currency()" :locale="ledgerView11.ledgerPresentation.locale" />
                </template>
                <template #cell-column6="{row:row}">
                  <BsMoneyText :amount="row.delta_base_minor" :currency="ledgerView11.ledgerPresentation.currency()" :locale="ledgerView11.ledgerPresentation.locale" />
                </template>
              </BsDataTable>
              <BsButton
                type="submit"
                :disabled="ledgerView11.busy || ledgerView11.readOnly || !ledgerView11.can('fx.revalue')"
                variant="primary"
                @click="ledgerView11.confirmRevaluation"
              >{{ ledgerView11.t('fx.confirm') }}</BsButton>
            </BsStack>
            <BsForm v-if="ledgerView11.tab==='reversal'" layout="grid" :columns="2" @submit.prevent="ledgerView11.saveReversal">
              <BsFloatingField :label="ledgerView11.t('fx.reversalKind')">
                <BsSelect v-model="ledgerView11.reversal.kind" native>
                  <BsSelectOption value="item">{{ ledgerView11.t('fx.tabs.item') }}</BsSelectOption>
                  <BsSelectOption value="settlement">{{ ledgerView11.t('fx.tabs.settlement') }}</BsSelectOption>
                  <BsSelectOption value="revaluation">{{ ledgerView11.t('fx.tabs.revaluation') }}</BsSelectOption>
                </BsSelect>
              </BsFloatingField>
              <BsFloatingField :label="ledgerView11.t('fx.reversalTarget')">
                <BsSelect v-model="ledgerView11.reversal.id" required native>
                  <BsSelectOption value="" />
                  <BsSelectOption
                    v-for="row in ledgerView11.reversal.kind==='item'?(ledgerView11.data?.items??[]):ledgerView11.reversal.kind==='settlement'?(ledgerView11.data?.settlements.filter(row=>!row.reverses_settlement_id)??[]):(ledgerView11.data?.revaluations.filter(row=>row.transaction_id)??[])"
                    :key="row.id"
                    :value="row.id"
                  >{{ row.reference }}</BsSelectOption>
                </BsSelect>
              </BsFloatingField>
              <BsFloatingField :label="ledgerView11.t('fx.reversalDate')">
                <BsInput v-model="ledgerView11.reversal.date" type="date" required />
              </BsFloatingField>
              <BsFloatingField :label="ledgerView11.t('fx.reversalReason')">
                <BsInput v-model="ledgerView11.reversal.reason" required />
              </BsFloatingField>
              <BsText size="sm" tone="muted">{{ ledgerView11.t('fx.reversalPolicy') }}</BsText>
              <BsButton type="submit" :disabled="ledgerView11.busy || ledgerView11.readOnly" variant="primary">{{ ledgerView11.t('fx.postReversal') }}</BsButton>
            </BsForm>
            <BsDataTable
              :value="ledgerView11.data?.items??[]"
              row-key="id"
              :label="ledgerView11.t('fx.openItems')"
              :columns="[{ key: 'counterparty_name', field: 'counterparty_name', header: ledgerView11.t('fx.counterparty') }, { key: 'reference', field: 'reference', header: ledgerView11.t('fx.reference') }, { key: 'currency_code', field: 'currency_code', header: ledgerView11.t('fx.currency') }, { key: 'column4', header: ledgerView11.t('fx.outstanding') }, { key: 'column5', header: ledgerView11.t('fx.currentCarrying') }, { key: 'rate_reference', field: 'rate_reference', header: ledgerView11.t('fx.rateEvidence') }]"
            >
              <template #empty>{{ ledgerView11.t('fx.empty') }}</template>
              <template #cell-column4="{row:row}">
                <BsMoneyText
                  :amount="row.outstanding_minor"
                  :currency="ledgerView11.ledgerPresentation.currency(row.currency_code)"
                  :locale="ledgerView11.ledgerPresentation.locale"
                />
              </template>
              <template #cell-column5="{row:row}">
                <BsMoneyText :amount="row.carrying_base_minor" :currency="ledgerView11.ledgerPresentation.currency()" :locale="ledgerView11.ledgerPresentation.locale" />
              </template>
            </BsDataTable>
            <BsDataTable
              :value="ledgerView11.data?.settlements??[]"
              row-key="id"
              :label="ledgerView11.t('fx.settlementHistory')"
              :columns="[{ key: 'date', field: 'date', header: ledgerView11.t('fx.settlementDate') }, { key: 'reference', field: 'reference', header: ledgerView11.t('fx.reference') }, { key: 'column3', header: ledgerView11.t('fx.gross') }, { key: 'column4', header: ledgerView11.t('fx.currentCarrying') }, { key: 'column5', header: ledgerView11.t('fx.settlementBase') }, { key: 'column6', header: ledgerView11.t('fx.realizedDifference') }, { key: 'rate_reference', field: 'rate_reference', header: ledgerView11.t('fx.rateEvidence') }]"
            >
              <template #empty>{{ ledgerView11.t('fx.noSettlements') }}</template>
              <template #cell-column3="{row:row}">
                <BsMoneyText
                  :amount="row.gross_minor"
                  :currency="ledgerView11.ledgerPresentation.currency(row.currency_code)"
                  :locale="ledgerView11.ledgerPresentation.locale"
                />
              </template>
              <template #cell-column4="{row:row}">
                <BsMoneyText :amount="row.carrying_base_minor" :currency="ledgerView11.ledgerPresentation.currency()" :locale="ledgerView11.ledgerPresentation.locale" />
              </template>
              <template #cell-column5="{row:row}">
                <BsMoneyText :amount="row.settlement_base_minor" :currency="ledgerView11.ledgerPresentation.currency()" :locale="ledgerView11.ledgerPresentation.locale" />
              </template>
              <template #cell-column6="{row:row}">
                <BsMoneyText
                  :amount="row.realized_fx_base_minor"
                  :currency="ledgerView11.ledgerPresentation.currency()"
                  :locale="ledgerView11.ledgerPresentation.locale"
                />
              </template>
            </BsDataTable>
            <BsDataTable
              :value="ledgerView11.data?.allocations??[]"
              row-key="id"
              :label="ledgerView11.t('fx.allocationHistory')"
              :columns="[{ key: 'settlement_reference', field: 'settlement_reference', header: ledgerView11.t('fx.reference') }, { key: 'item_reference', field: 'item_reference', header: ledgerView11.t('fx.openItems') }, { key: 'column3', header: ledgerView11.t('fx.documentAmount') }, { key: 'column4', header: ledgerView11.t('fx.settlementAmount') }, { key: 'allocation_rate', field: 'allocation_rate', header: ledgerView11.t('fx.crossRate') }, { key: 'conversion_evidence', field: 'conversion_evidence', header: ledgerView11.t('fx.conversionEvidence') }, { key: 'column7', header: ledgerView11.t('fx.realizedDifference') }, { key: 'column8', header: ledgerView11.t('fx.roundingResidual') }]"
            >
              <template #empty>{{ ledgerView11.t('fx.noAllocations') }}</template>
              <template #cell-column3="{row:row}">
                <BsMoneyText
                  :amount="row.document_amount_minor"
                  :currency="ledgerView11.ledgerPresentation.currency(row.document_currency)"
                  :locale="ledgerView11.ledgerPresentation.locale"
                />
              </template>
              <template #cell-column4="{row:row}">
                <BsMoneyText
                  :amount="row.settlement_amount_minor"
                  :currency="ledgerView11.ledgerPresentation.currency(row.settlement_currency)"
                  :locale="ledgerView11.ledgerPresentation.locale"
                />
              </template>
              <template #cell-column7="{row:row}">
                <BsMoneyText
                  :amount="row.realized_fx_base_minor"
                  :currency="ledgerView11.ledgerPresentation.currency()"
                  :locale="ledgerView11.ledgerPresentation.locale"
                />
              </template>
              <template #cell-column8="{row:row}">
                <BsMoneyText
                  :amount="row.rounding_residual_base_minor"
                  :currency="ledgerView11.ledgerPresentation.currency()"
                  :locale="ledgerView11.ledgerPresentation.locale"
                />
              </template>
            </BsDataTable>
          </BsStack>
        </BsCard>
      </template>
    </BsWorkflowScope>
    <BsText v-if="!can('ar.read')" role="status">{{ t('ar.denied') }}</BsText>
    <template v-else>
      <BsCard as="div" padding="md">
        <BsStack gap="md">
          <BsFloatingField :label="t('ar.from')">
            <BsInput id="ar-from" v-model="from" type="date" :max="asOf" />
          </BsFloatingField>
          <BsFloatingField :label="t('ar.asOf')">
            <BsInput id="ar-asof" v-model="asOf" type="date" :min="from" />
          </BsFloatingField>
          <BsFloatingField :label="t('ar.customer')">
            <BsSelect id="ar-customer-filter" v-model="customer" native>
              <BsSelectOption value="">{{ t('ar.allCustomers') }}</BsSelectOption>
              <BsSelectOption v-for="c in data?.customers ?? []" :key="c.id" :value="c.id">{{ c.name }}</BsSelectOption>
            </BsSelect>
          </BsFloatingField>
          <BsTableDensity
            v-model="tableDensity"
            :disabled="!tablePreferenceHydrated"
            :label="ledgerPresentation.t('accountingTable.density')"
            :compact-label="ledgerPresentation.t('accountingTable.compact')"
            :comfortable-label="ledgerPresentation.t('accountingTable.comfortable')"
          />
        </BsStack>
      </BsCard>
      <BsText v-if="error" role="alert" tone="danger">{{ t('ar.errors.load') }} <BsButton type="submit" @click="load">{{ t('ar.retry') }}</BsButton></BsText>
      <BsSectionSkeleton v-else-if="pending" variant="table" :rows="5" />
      <template v-else-if="data">
        <BsInline gap="sm" :wrap="true">
          <template v-for="kind in kinds" :key="kind">
            <BsButton v-if="can(capability[kind])" type="submit" :disabled="readOnly || !controls.length || saving" @click="begin(kind)">{{ t(`ar.actions.${kind}`) }}</BsButton>
          </template>
        </BsInline>
        <BsText v-if="!controls.length" role="status">{{ t('ar.setup') }} <BsLink to="/accounts">{{ t('nav.accounts') }}</BsLink></BsText>
        <BsCard as="section" padding="none" overflow="hidden">
          <BsHeading :level="2" size="h2">{{ t('ar.openItems') }}</BsHeading>
          <BsDataTable
            :value="items"
            row-key="invoice_id"
            :density="tableDensity"
            sticky-header
            max-height="32rem"
            :scroll-label="t('accountingTable.receivablesScroll')"
            :label="t('ar.openItems')"
            :columns="[{ key: 'column1', header: (t('ar.customer')) + '/' + (t('ar.reference')) }, { key: 'issue_date', field: 'issue_date', header: t('ar.issueDate') }, { key: 'due_date', field: 'due_date', header: t('ar.dueDate') }, { key: 'column4', header: t('ar.original') }, { key: 'column5', header: t('ar.outstanding') }, { key: 'column6', header: t('ar.aging') }]"
          >
            <template #empty>{{ t('ar.empty') }}</template>
            <template #header-column1>{{ t('ar.customer') }} / {{ t('ar.reference') }}</template>
            <template #cell-column1="{ row }">
              <BsText as="span" emphasis="semibold">{{ row.customer_name }}</BsText>
              <BsText dir="ltr" as="span" size="xs" tone="muted">{{ row.reference }}</BsText>
            </template>
            <template #cell-column4="{ row }">
              <BsMoneyText :amount="row.original_minor" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" />
            </template>
            <template #cell-column5="{ row }">
              <BsMoneyText :amount="row.outstanding_minor" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" />
            </template>
            <template #cell-column6="{ row }">{{ t(`ar.buckets.${row.aging_bucket}`) }}</template>
          </BsDataTable>
        </BsCard>
        <BsCard as="section" padding="md">
          <BsHeading :level="2" size="h2">{{ t('ar.aging') }}</BsHeading>
          <BsText size="sm" tone="muted">{{ t('ar.agingPolicy') }}</BsText>
          <BsDescriptionList :columns="3">
            <BsBox v-for="bucket in aging" :key="bucket.bucket">
              <BsDescriptionTerm>{{ t(`ar.buckets.${bucket.bucket}`) }}</BsDescriptionTerm>
              <BsDescriptionValue>
                <BsMoneyText :amount="bucket.amount" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" />
              </BsDescriptionValue>
            </BsBox>
          </BsDescriptionList>
        </BsCard>
        <BsCard as="section" padding="none" overflow="hidden">
          <BsHeading :level="2" size="h2">{{ t('ar.statement') }}</BsHeading>
          <BsText v-if="!data.statement" tone="muted">{{ t('ar.chooseCustomer') }}</BsText>
          <template v-else>
            <BsDescriptionList :columns="3">
              <BsBox v-for="field in statementFields" :key="field">
                <BsDescriptionTerm>{{ t(`ar.totals.${field}`) }}</BsDescriptionTerm>
                <BsDescriptionValue>
                  <BsMoneyText :amount="data.statement[`${field}_minor`]" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" />
                </BsDescriptionValue>
              </BsBox>
            </BsDescriptionList>
            <BsDataTable
              :value="data.statement.movements"
              row-key="id"
              :density="tableDensity"
              sticky-header
              max-height="32rem"
              :scroll-label="t('accountingTable.receivablesScroll')"
              :label="t('ar.statement')"
              :columns="[{ key: 'date', field: 'date', header: t('ar.date') }, { key: 'reference', field: 'reference', header: t('ar.reference') }, { key: 'column3', header: t('ar.kind') }, { key: 'column4', header: t('ar.movement') }, { key: 'column5', header: t('ar.balance') }, { key: 'reason', field: 'reason', header: t('ar.reason') }, { key: 'column7', header: t('ar.history') }]"
            >
              <template #empty>{{ t('ar.empty') }}</template>
              <template #cell-column3="{ row }">{{ t(`ar.kinds.${row.kind}`) }}<BsText v-if="row.reversed" as="span"> · {{ t('ar.reversed') }}</BsText></template>
              <template #cell-column4="{ row }">
                <BsMoneyText :amount="row.effect_minor" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" />
              </template>
              <template #cell-column5="{ row }">
                <BsMoneyText :amount="row.balance_minor" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" />
              </template>
              <template #cell-column7="{ row }">
                <BsLink :to="{ path: '/transactions', query: { q: row.transaction_id } }">{{ t('ar.journal') }}</BsLink>
                <BsText v-if="row.reverses_document_id" size="xs">{{ t('ar.reverses') }}: {{ row.reverses_document_id }}</BsText>
                <BsButton
                  v-if="can('ar.reverse') && !row.reversed && row.kind !== 'reversal'"
                  type="submit"
                  :disabled="readOnly || saving"
                  @click="begin('reversal', row)"
                >{{ t('ar.actions.reversal') }}</BsButton>
              </template>
            </BsDataTable>
          </template>
        </BsCard>
        <BsCard v-if="can('controls.reconcile')" as="section" padding="none" overflow="hidden">
          <BsHeading :level="2" size="h2">{{ t('controls.reconciliation') }}</BsHeading>
          <BsText size="sm" tone="muted">{{ t('ar.reconciliationPolicy') }}</BsText>
          <BsDataTable
            :value="data.reconciliation"
            row-key="control_account_id"
            :density="tableDensity"
            :label="t('controls.reconciliation')"
            :columns="[{ key: 'account_name', field: 'account_name', header: t('ar.control') }, { key: 'column2', header: t('controls.glBalance') }, { key: 'column3', header: t('controls.subledgerBalance') }, { key: 'column4', header: t('controls.variance') }, { key: 'column5', header: t('controls.status') }]"
          >
            <template #empty>{{ t('ar.empty') }}</template>
            <template #cell-column2="{ row }">
              <BsMoneyText :amount="row.gl_balance_minor" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" />
            </template>
            <template #cell-column3="{ row }">
              <BsMoneyText :amount="row.subledger_balance_minor" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" />
            </template>
            <template #cell-column4="{ row }">
              <BsMoneyText :amount="row.variance_minor" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" />
            </template>
            <template #cell-column5="{ row }">{{ t(`controls.statuses.${row.status}`) }}<BsText>{{ row.explanation_reason }}</BsText></template>
          </BsDataTable>
        </BsCard>
        <BsDisclosure v-if="can('commitments.read')">
          <template #summary>{{ t('ar.legacy') }}</template>
          <BsText size="sm" tone="muted">{{ t('ar.legacyPolicy') }}</BsText>
          <BsDataTable
            :value="data.legacy"
            row-key="commitment_id"
            :density="tableDensity"
            :label="t('ar.legacy')"
            :columns="[{ key: 'reference', field: 'reference', header: t('ar.reference') }, { key: 'column2', header: t('ar.original') }, { key: 'column3', header: t('ar.cashSettled') }, { key: 'column4', header: t('ar.outstanding') }]"
          >
            <template #empty>{{ t('ar.empty') }}</template>
            <template #cell-column2="{ row }">
              <BsMoneyText :amount="row.original_minor" :currency="ledgerPresentation.currency(row.currency_code)" :locale="ledgerPresentation.locale" />
            </template>
            <template #cell-column3="{ row }">
              <BsMoneyText :amount="row.cash_settled_minor" :currency="ledgerPresentation.currency(row.currency_code)" :locale="ledgerPresentation.locale" />
            </template>
            <template #cell-column4="{ row }">
              <BsMoneyText :amount="row.legacy_open_minor" :currency="ledgerPresentation.currency(row.currency_code)" :locale="ledgerPresentation.locale" />
            </template>
          </BsDataTable>
        </BsDisclosure>
      </template>
    </template>
    <BsRecordActionDialog
      v-model:visible="visible"
      :title="t(`ar.actions.${form.kind}`)"
      :pending="saving"
      :dirty="dirty"
      :error="formError"
      size="lg"
      :submit-label="t('common.save')"
      :cancel-label="t('common.cancel')"
      :submit-disabled="readOnly"
      @submit="save"
    >
      <BsText v-if="form.kind === 'reversal'" tone="muted">{{ t('ar.reversalPolicy') }}</BsText>
      <template v-else>
        <BsFloatingField :label="t('ar.customer')">
          <BsSelect id="ar-form-customer" v-model="form.customer" required native>
            <BsSelectOption value="" />
            <BsSelectOption v-for="c in data?.customers.filter(c => !c.archived) ?? []" :key="c.id" :value="c.id">{{ c.name }}</BsSelectOption>
          </BsSelect>
        </BsFloatingField>
        <BsFloatingField :label="t('ar.control')">
          <BsSelect id="ar-control" v-model="form.control" required native>
            <BsSelectOption v-for="a in controls" :key="a.id" :value="a.id">{{ a.name }}</BsSelectOption>
          </BsSelect>
        </BsFloatingField>
        <BsFloatingField :label="t(form.kind === 'receipt' ? 'ar.cash' : form.kind === 'adjustment' ? 'ar.expense' : 'ar.revenue')">
          <BsSelect id="ar-offset" v-model="form.offset" required native>
            <BsSelectOption value="" />
            <BsSelectOption v-for="a in offsets" :key="a.id" :value="a.id">{{ a.name }}</BsSelectOption>
          </BsSelect>
        </BsFloatingField>
        <BsFloatingField :label="t('ar.reference')">
          <BsInput id="ar-reference" v-model="form.reference" required />
        </BsFloatingField>
        <BsFloatingField :label="t('ar.amount')">
          <BsInput
            id="ar-amount"
            v-model="form.amount"
            inputmode="decimal"
            required
            :aria-invalid="Boolean(amountError)"
            :aria-describedby="amountError ? 'ar-amount-error' : undefined"
            @blur="amountMinor()"
          />
        </BsFloatingField>
        <BsText v-if="amountError" id="ar-amount-error" role="alert" size="sm" tone="danger">{{ amountError }}</BsText>
      </template>
      <BsFloatingField :label="t('ar.date')">
        <BsInput id="ar-date" v-model="form.date" type="date" required />
      </BsFloatingField>
      <BsFloatingField v-if="form.kind === 'invoice'" :label="t('ar.dueDate')">
        <BsInput id="ar-due" v-model="form.due" type="date" :min="form.date" required />
      </BsFloatingField>
      <BsFloatingField v-if="['credit', 'adjustment', 'reversal'].includes(form.kind)" :label="t('ar.reason')">
        <BsInput id="ar-reason" v-model="form.reason" required />
      </BsFloatingField>
      <BsFieldGroup v-if="isAllocation">
        <template #legend>{{ t('ar.allocations') }}</template>
        <BsText size="sm" tone="muted">{{ t('ar.allocationPolicy') }}</BsText>
        <BsText v-if="!allocationItems.length">{{ t('ar.noAllocationItems') }}</BsText>
        <BsBox v-for="item in allocationItems" :key="item.invoice_id">
          <BsFloatingField :label="item.reference">
            <BsInput :id="`ar-allocation-${item.invoice_id}`" v-model="form.allocations[item.invoice_id]" inputmode="decimal" />
          </BsFloatingField>
          <BsText size="sm">{{ t('ar.outstanding') }}: <BsMoneyText :amount="item.outstanding_minor" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" /></BsText>
        </BsBox>
      </BsFieldGroup>
    </BsRecordActionDialog>
  </BsStack>
</template>
