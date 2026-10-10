<script setup lang="ts">
import { useLedgerFxSubledgerPanelView } from '~/composables/useLedgerFxSubledgerPanelView'
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
  <BsStack gap="lg">
    <BsPageHeader
      :title="t('ap.title')"
      :subtitle="t('ap.policy')"
      :context="ledgerPresentation.context(from, asOf, undefined)"
      :context-label="ledgerPresentation.t('pageContext.label')"
    />
    <BsWorkflowScope v-if="can('fx.read')" :factory="useLedgerFxSubledgerPanelView" :input="{ subledger: 'supplier', asOf: (asOf), readOnly: (readOnly) }">
      <template #default="{ state: ledgerView10 }">
        <BsCard data-testid="fx-panel" as="section" padding="none" overflow="hidden">
          <BsBox padding="lg">
            <BsHeading :level="2" size="h2">{{ ledgerView10.t('fx.title') }}</BsHeading>
            <BsText size="sm" tone="muted">{{ ledgerView10.t('fx.policy') }}</BsText>
          </BsBox>
          <BsInline role="tablist" gap="sm" :wrap="true" padding="lg">
            <BsButton
              v-for="name in (['item','settlement','revaluation','reversal','mapping'] as const)"
              :key="name"
              variant="chip"
              type="submit"
              :aria-selected="ledgerView10.tab===name"
              @click="ledgerView10.tab=name"
            >{{ ledgerView10.t(`fx.tabs.${name}`) }}</BsButton>
          </BsInline>
          <BsText v-if="ledgerView10.error" role="alert" tone="danger">{{ ledgerView10.t('fx.errors.load') }} <BsButton type="submit" @click="ledgerView10.load">{{ ledgerView10.t('common.retry') }}</BsButton></BsText>
          <BsSectionSkeleton v-else-if="ledgerView10.pending" variant="table" :rows="3" />
          <BsStack v-else gap="md" padding="lg">
            <BsText v-if="ledgerView10.failure" role="alert" tone="danger">{{ ledgerView10.t('fx.errors.save') }} · {{ ledgerView10.failure }}</BsText>
            <BsText v-if="ledgerView10.message" role="status">{{ ledgerView10.message }}</BsText>
            <BsText v-if="!ledgerView10.data?.mapping && ledgerView10.tab!=='mapping'" tone="warning">{{ ledgerView10.t('fx.mappingRequired') }}</BsText>
            <BsText v-if="ledgerView10.tab==='mapping' && ledgerView10.data?.mapping" role="status">{{ ledgerView10.t('fx.mappingConfigured') }}</BsText>
            <BsForm v-if="ledgerView10.tab==='mapping' && !ledgerView10.data?.mapping" layout="grid" :columns="2" @submit.prevent="ledgerView10.saveMapping">
              <BsFloatingField
                v-for="field in ([['realizedGain','realizedGain'],['realizedLoss','realizedLoss'],['unrealizedGain','unrealizedGain'],['unrealizedLoss','unrealizedLoss']] as const)"
                :key="field[0]"
                :label="ledgerView10.t(`fx.${field[1]}`)"
              >
                <BsSelect v-model="ledgerView10.mapping[field[0]]" required native>
                  <BsSelectOption value="" />
                  <BsSelectOption
                    v-for="a in ledgerView10.posting.filter(a=>field[0].toLowerCase().includes('gain')?a.type==='revenue':a.type==='expense')"
                    :key="a.id"
                    :value="a.id"
                  >{{ a.name }}</BsSelectOption>
                </BsSelect>
              </BsFloatingField>
              <BsButton type="submit" :disabled="ledgerView10.busy || ledgerView10.readOnly || !ledgerView10.can('fx.manage')" variant="primary">{{ ledgerView10.t('common.save') }}</BsButton>
            </BsForm>
            <BsForm v-if="ledgerView10.tab==='item'" layout="grid" :columns="2" @submit.prevent="ledgerView10.saveItem">
              <BsFloatingField :label="ledgerView10.t('fx.counterparty')">
                <BsSelect v-model="ledgerView10.item.counterparty" required native>
                  <BsSelectOption value="" />
                  <BsSelectOption v-for="c in ledgerView10.data?.counterparties??[]" :key="c.id" :value="c.id">{{ c.name }}</BsSelectOption>
                </BsSelect>
              </BsFloatingField>
              <BsFloatingField :label="ledgerView10.t('fx.control')">
                <BsSelect v-model="ledgerView10.item.control" required native>
                  <BsSelectOption value="" />
                  <BsSelectOption v-for="a in ledgerView10.controls" :key="a.id" :value="a.id">{{ a.name }}</BsSelectOption>
                </BsSelect>
              </BsFloatingField>
              <BsFloatingField :label="ledgerView10.t('fx.offset')">
                <BsSelect v-model="ledgerView10.item.offset" required native>
                  <BsSelectOption value="" />
                  <BsSelectOption
                    v-for="a in ledgerView10.posting.filter(a=>ledgerView10.subledger==='customer'?a.type==='revenue':['expense','asset'].includes(a.type))"
                    :key="a.id"
                    :value="a.id"
                  >{{ a.name }}</BsSelectOption>
                </BsSelect>
              </BsFloatingField>
              <BsFloatingField :label="ledgerView10.t('fx.currency')">
                <BsSelect v-model="ledgerView10.item.currency" native>
                  <BsSelectOption v-for="c in ledgerView10.data?.currencies??[]" :key="c.code" :value="c.code">{{ c.code }} · {{ c.name }}</BsSelectOption>
                </BsSelect>
              </BsFloatingField>
              <BsFloatingField :label="ledgerView10.t('fx.documentDate')">
                <BsInput v-model="ledgerView10.item.date" type="date" required />
              </BsFloatingField>
              <BsFloatingField :label="ledgerView10.t('fx.dueDate')">
                <BsInput v-model="ledgerView10.item.due" type="date" :min="ledgerView10.item.date" required />
              </BsFloatingField>
              <BsFloatingField :label="ledgerView10.t('fx.reference')">
                <BsInput v-model="ledgerView10.item.reference" required />
              </BsFloatingField>
              <BsFloatingField :label="ledgerView10.t('fx.amount')">
                <BsInput v-model="ledgerView10.item.amount" inputmode="decimal" required />
              </BsFloatingField>
              <BsFloatingField :label="ledgerView10.t('fx.baseRate')">
                <BsInput v-model="ledgerView10.item.rate" inputmode="decimal" required />
              </BsFloatingField>
              <BsFloatingField :label="ledgerView10.t('fx.rateSource')">
                <BsInput v-model="ledgerView10.item.source" required />
              </BsFloatingField>
              <BsFloatingField :label="ledgerView10.t('fx.rateEvidence')">
                <BsInput v-model="ledgerView10.item.evidence" required />
              </BsFloatingField>
              <BsButton type="submit" :disabled="ledgerView10.busy || ledgerView10.readOnly || !ledgerView10.data?.mapping" variant="primary">{{ ledgerView10.t('fx.postItem') }}</BsButton>
            </BsForm>
            <BsForm v-if="ledgerView10.tab==='settlement'" @submit.prevent="ledgerView10.saveSettlement">
              <BsGrid :columns="2" gap="md">
                <BsFloatingField :label="ledgerView10.t('fx.counterparty')">
                  <BsSelect v-model="ledgerView10.settlement.counterparty" required native>
                    <BsSelectOption value="" />
                    <BsSelectOption v-for="c in ledgerView10.data?.counterparties??[]" :key="c.id" :value="c.id">{{ c.name }}</BsSelectOption>
                  </BsSelect>
                </BsFloatingField>
                <BsFloatingField :label="ledgerView10.t('fx.control')">
                  <BsSelect v-model="ledgerView10.settlement.control" required native>
                    <BsSelectOption value="" />
                    <BsSelectOption v-for="a in ledgerView10.controls" :key="a.id" :value="a.id">{{ a.name }}</BsSelectOption>
                  </BsSelect>
                </BsFloatingField>
                <BsFloatingField :label="ledgerView10.t('fx.cash')">
                  <BsSelect v-model="ledgerView10.settlement.cash" required native>
                    <BsSelectOption value="" />
                    <BsSelectOption v-for="a in ledgerView10.cash" :key="a.id" :value="a.id">{{ a.name }} · {{ a.currency }}</BsSelectOption>
                  </BsSelect>
                </BsFloatingField>
                <BsFloatingField :label="ledgerView10.t('fx.currency')">
                  <BsSelect v-model="ledgerView10.settlement.currency" native>
                    <BsSelectOption v-for="c in ledgerView10.data?.currencies??[]" :key="c.code" :value="c.code">{{ c.code }}</BsSelectOption>
                  </BsSelect>
                </BsFloatingField>
                <BsFloatingField :label="ledgerView10.t('fx.settlementDate')">
                  <BsInput v-model="ledgerView10.settlement.date" type="date" required />
                </BsFloatingField>
                <BsFloatingField :label="ledgerView10.t('fx.reference')">
                  <BsInput v-model="ledgerView10.settlement.reference" required />
                </BsFloatingField>
                <BsFloatingField :label="ledgerView10.t('fx.gross')">
                  <BsInput v-model="ledgerView10.settlement.gross" inputmode="decimal" required />
                </BsFloatingField>
                <BsFloatingField :label="ledgerView10.t('fx.baseRate')">
                  <BsInput v-model="ledgerView10.settlement.rate" inputmode="decimal" required />
                </BsFloatingField>
                <BsFloatingField :label="ledgerView10.t('fx.rateSource')">
                  <BsInput v-model="ledgerView10.settlement.source" required />
                </BsFloatingField>
                <BsFloatingField :label="ledgerView10.t('fx.rateEvidence')">
                  <BsInput v-model="ledgerView10.settlement.evidence" required />
                </BsFloatingField>
              </BsGrid>
              <BsBox v-for="openItem in ledgerView10.eligibleItems" :key="openItem.id" padding="md" border>
                <BsText emphasis="bold">{{ openItem.reference }} · {{ openItem.currency_code }} <BsMoneyText :amount="openItem.outstanding_minor" :currency="ledgerView10.ledgerPresentation.currency(openItem.currency_code)" :locale="ledgerView10.ledgerPresentation.locale" /></BsText>
                <BsGrid :columns="4" gap="md">
                  <BsFloatingField :label="ledgerView10.t('fx.documentAmount')">
                    <BsInput v-model="ledgerView10.settlement.rows[openItem.id]!.document" />
                  </BsFloatingField>
                  <BsFloatingField :label="ledgerView10.t('fx.settlementAmount')">
                    <BsInput v-model="ledgerView10.settlement.rows[openItem.id]!.settlement" />
                  </BsFloatingField>
                  <BsFloatingField :label="ledgerView10.t('fx.crossRate')">
                    <BsInput v-model="ledgerView10.settlement.rows[openItem.id]!.rate" />
                  </BsFloatingField>
                  <BsFloatingField :label="ledgerView10.t('fx.conversionEvidence')">
                    <BsInput v-model="ledgerView10.settlement.rows[openItem.id]!.evidence" />
                  </BsFloatingField>
                </BsGrid>
                <BsText size="xs" tone="muted">{{ ledgerView10.t('fx.expected') }}: {{ ledgerView10.expectedSettlement(ledgerView10.settlement.rows[openItem.id]!,openItem.currency_code) }} {{ ledgerView10.settlement.currency }} {{ ledgerView10.t('fx.minorUnits') }}</BsText>
              </BsBox>
              <BsButton type="submit" :disabled="ledgerView10.busy || ledgerView10.readOnly || !ledgerView10.data?.mapping" variant="primary">{{ ledgerView10.t('fx.postSettlement') }}</BsButton>
            </BsForm>
            <BsForm v-if="ledgerView10.tab==='revaluation'" @submit.prevent="ledgerView10.runPreview">
              <BsGrid :columns="2" gap="md">
                <BsFloatingField :label="ledgerView10.t('fx.control')">
                  <BsSelect v-model="ledgerView10.revaluation.control" required native>
                    <BsSelectOption value="" />
                    <BsSelectOption v-for="a in ledgerView10.controls" :key="a.id" :value="a.id">{{ a.name }}</BsSelectOption>
                  </BsSelect>
                </BsFloatingField>
                <BsFloatingField :label="ledgerView10.t('fx.reference')">
                  <BsInput v-model="ledgerView10.revaluation.reference" required />
                </BsFloatingField>
                <BsFloatingField :label="ledgerView10.t('fx.rateSource')">
                  <BsInput v-model="ledgerView10.revaluation.source" required />
                </BsFloatingField>
              </BsGrid>
              <BsGrid v-for="currency in ledgerView10.itemCurrencies" :key="currency" :columns="2" gap="md">
                <BsFloatingField :label="`${currency} · ${ledgerView10.t('fx.closingRate')}`">
                  <BsInput v-model="(ledgerView10.revaluation.rates[currency]??={rate:'',reference:''}).rate" required />
                </BsFloatingField>
                <BsFloatingField :label="ledgerView10.t('fx.rateEvidence')">
                  <BsInput v-model="ledgerView10.revaluation.rates[currency]!.reference" required />
                </BsFloatingField>
              </BsGrid>
              <BsButton type="submit" :disabled="ledgerView10.busy || !ledgerView10.data?.mapping">{{ ledgerView10.t('fx.preview') }}</BsButton>
            </BsForm>
            <BsStack v-if="ledgerView10.previewLines.length" gap="md">
              <BsDataTable
                :value="ledgerView10.previewLines"
                row-key="open_item_id"
                :label="ledgerView10.t('fx.preview')"
                :columns="[{ key: 'reference', field: 'reference', header: ledgerView10.t('fx.reference') }, { key: 'currency_code', field: 'currency_code', header: ledgerView10.t('fx.currency') }, { key: 'column3', header: ledgerView10.t('fx.outstanding') }, { key: 'column4', header: ledgerView10.t('fx.currentCarrying') }, { key: 'column5', header: ledgerView10.t('fx.closingBase') }, { key: 'column6', header: ledgerView10.t('fx.delta') }]"
              >
                <template #cell-column3="{row:row}">
                  <BsMoneyText
                    :amount="row.outstanding_minor"
                    :currency="ledgerView10.ledgerPresentation.currency(row.currency_code)"
                    :locale="ledgerView10.ledgerPresentation.locale"
                  />
                </template>
                <template #cell-column4="{row:row}">
                  <BsMoneyText
                    :amount="row.current_carrying_base_minor"
                    :currency="ledgerView10.ledgerPresentation.currency()"
                    :locale="ledgerView10.ledgerPresentation.locale"
                  />
                </template>
                <template #cell-column5="{row:row}">
                  <BsMoneyText :amount="row.closing_base_minor" :currency="ledgerView10.ledgerPresentation.currency()" :locale="ledgerView10.ledgerPresentation.locale" />
                </template>
                <template #cell-column6="{row:row}">
                  <BsMoneyText :amount="row.delta_base_minor" :currency="ledgerView10.ledgerPresentation.currency()" :locale="ledgerView10.ledgerPresentation.locale" />
                </template>
              </BsDataTable>
              <BsButton
                type="submit"
                :disabled="ledgerView10.busy || ledgerView10.readOnly || !ledgerView10.can('fx.revalue')"
                variant="primary"
                @click="ledgerView10.confirmRevaluation"
              >{{ ledgerView10.t('fx.confirm') }}</BsButton>
            </BsStack>
            <BsForm v-if="ledgerView10.tab==='reversal'" layout="grid" :columns="2" @submit.prevent="ledgerView10.saveReversal">
              <BsFloatingField :label="ledgerView10.t('fx.reversalKind')">
                <BsSelect v-model="ledgerView10.reversal.kind" native>
                  <BsSelectOption value="item">{{ ledgerView10.t('fx.tabs.item') }}</BsSelectOption>
                  <BsSelectOption value="settlement">{{ ledgerView10.t('fx.tabs.settlement') }}</BsSelectOption>
                  <BsSelectOption value="revaluation">{{ ledgerView10.t('fx.tabs.revaluation') }}</BsSelectOption>
                </BsSelect>
              </BsFloatingField>
              <BsFloatingField :label="ledgerView10.t('fx.reversalTarget')">
                <BsSelect v-model="ledgerView10.reversal.id" required native>
                  <BsSelectOption value="" />
                  <BsSelectOption
                    v-for="row in ledgerView10.reversal.kind==='item'?(ledgerView10.data?.items??[]):ledgerView10.reversal.kind==='settlement'?(ledgerView10.data?.settlements.filter(row=>!row.reverses_settlement_id)??[]):(ledgerView10.data?.revaluations.filter(row=>row.transaction_id)??[])"
                    :key="row.id"
                    :value="row.id"
                  >{{ row.reference }}</BsSelectOption>
                </BsSelect>
              </BsFloatingField>
              <BsFloatingField :label="ledgerView10.t('fx.reversalDate')">
                <BsInput v-model="ledgerView10.reversal.date" type="date" required />
              </BsFloatingField>
              <BsFloatingField :label="ledgerView10.t('fx.reversalReason')">
                <BsInput v-model="ledgerView10.reversal.reason" required />
              </BsFloatingField>
              <BsText size="sm" tone="muted">{{ ledgerView10.t('fx.reversalPolicy') }}</BsText>
              <BsButton type="submit" :disabled="ledgerView10.busy || ledgerView10.readOnly" variant="primary">{{ ledgerView10.t('fx.postReversal') }}</BsButton>
            </BsForm>
            <BsDataTable
              :value="ledgerView10.data?.items??[]"
              row-key="id"
              :label="ledgerView10.t('fx.openItems')"
              :columns="[{ key: 'counterparty_name', field: 'counterparty_name', header: ledgerView10.t('fx.counterparty') }, { key: 'reference', field: 'reference', header: ledgerView10.t('fx.reference') }, { key: 'currency_code', field: 'currency_code', header: ledgerView10.t('fx.currency') }, { key: 'column4', header: ledgerView10.t('fx.outstanding') }, { key: 'column5', header: ledgerView10.t('fx.currentCarrying') }, { key: 'rate_reference', field: 'rate_reference', header: ledgerView10.t('fx.rateEvidence') }]"
            >
              <template #empty>{{ ledgerView10.t('fx.empty') }}</template>
              <template #cell-column4="{row:row}">
                <BsMoneyText
                  :amount="row.outstanding_minor"
                  :currency="ledgerView10.ledgerPresentation.currency(row.currency_code)"
                  :locale="ledgerView10.ledgerPresentation.locale"
                />
              </template>
              <template #cell-column5="{row:row}">
                <BsMoneyText :amount="row.carrying_base_minor" :currency="ledgerView10.ledgerPresentation.currency()" :locale="ledgerView10.ledgerPresentation.locale" />
              </template>
            </BsDataTable>
            <BsDataTable
              :value="ledgerView10.data?.settlements??[]"
              row-key="id"
              :label="ledgerView10.t('fx.settlementHistory')"
              :columns="[{ key: 'date', field: 'date', header: ledgerView10.t('fx.settlementDate') }, { key: 'reference', field: 'reference', header: ledgerView10.t('fx.reference') }, { key: 'column3', header: ledgerView10.t('fx.gross') }, { key: 'column4', header: ledgerView10.t('fx.currentCarrying') }, { key: 'column5', header: ledgerView10.t('fx.settlementBase') }, { key: 'column6', header: ledgerView10.t('fx.realizedDifference') }, { key: 'rate_reference', field: 'rate_reference', header: ledgerView10.t('fx.rateEvidence') }]"
            >
              <template #empty>{{ ledgerView10.t('fx.noSettlements') }}</template>
              <template #cell-column3="{row:row}">
                <BsMoneyText
                  :amount="row.gross_minor"
                  :currency="ledgerView10.ledgerPresentation.currency(row.currency_code)"
                  :locale="ledgerView10.ledgerPresentation.locale"
                />
              </template>
              <template #cell-column4="{row:row}">
                <BsMoneyText :amount="row.carrying_base_minor" :currency="ledgerView10.ledgerPresentation.currency()" :locale="ledgerView10.ledgerPresentation.locale" />
              </template>
              <template #cell-column5="{row:row}">
                <BsMoneyText :amount="row.settlement_base_minor" :currency="ledgerView10.ledgerPresentation.currency()" :locale="ledgerView10.ledgerPresentation.locale" />
              </template>
              <template #cell-column6="{row:row}">
                <BsMoneyText
                  :amount="row.realized_fx_base_minor"
                  :currency="ledgerView10.ledgerPresentation.currency()"
                  :locale="ledgerView10.ledgerPresentation.locale"
                />
              </template>
            </BsDataTable>
            <BsDataTable
              :value="ledgerView10.data?.allocations??[]"
              row-key="id"
              :label="ledgerView10.t('fx.allocationHistory')"
              :columns="[{ key: 'settlement_reference', field: 'settlement_reference', header: ledgerView10.t('fx.reference') }, { key: 'item_reference', field: 'item_reference', header: ledgerView10.t('fx.openItems') }, { key: 'column3', header: ledgerView10.t('fx.documentAmount') }, { key: 'column4', header: ledgerView10.t('fx.settlementAmount') }, { key: 'allocation_rate', field: 'allocation_rate', header: ledgerView10.t('fx.crossRate') }, { key: 'conversion_evidence', field: 'conversion_evidence', header: ledgerView10.t('fx.conversionEvidence') }, { key: 'column7', header: ledgerView10.t('fx.realizedDifference') }, { key: 'column8', header: ledgerView10.t('fx.roundingResidual') }]"
            >
              <template #empty>{{ ledgerView10.t('fx.noAllocations') }}</template>
              <template #cell-column3="{row:row}">
                <BsMoneyText
                  :amount="row.document_amount_minor"
                  :currency="ledgerView10.ledgerPresentation.currency(row.document_currency)"
                  :locale="ledgerView10.ledgerPresentation.locale"
                />
              </template>
              <template #cell-column4="{row:row}">
                <BsMoneyText
                  :amount="row.settlement_amount_minor"
                  :currency="ledgerView10.ledgerPresentation.currency(row.settlement_currency)"
                  :locale="ledgerView10.ledgerPresentation.locale"
                />
              </template>
              <template #cell-column7="{row:row}">
                <BsMoneyText
                  :amount="row.realized_fx_base_minor"
                  :currency="ledgerView10.ledgerPresentation.currency()"
                  :locale="ledgerView10.ledgerPresentation.locale"
                />
              </template>
              <template #cell-column8="{row:row}">
                <BsMoneyText
                  :amount="row.rounding_residual_base_minor"
                  :currency="ledgerView10.ledgerPresentation.currency()"
                  :locale="ledgerView10.ledgerPresentation.locale"
                />
              </template>
            </BsDataTable>
          </BsStack>
        </BsCard>
      </template>
    </BsWorkflowScope>
    <BsText v-if="!can('ap.read')" role="status">{{ t('ap.denied') }}</BsText>
    <template v-else>
      <BsCard as="div" padding="md">
        <BsStack gap="md">
          <BsFloatingField :label="t('ap.from')">
            <BsInput id="ap-from" v-model="from" type="date" :max="asOf" />
          </BsFloatingField>
          <BsFloatingField :label="t('ap.asOf')">
            <BsInput id="ap-asof" v-model="asOf" type="date" :min="from" />
          </BsFloatingField>
          <BsFloatingField :label="t('ap.supplier')">
            <BsSelect id="ap-supplier-filter" v-model="supplier" native>
              <BsSelectOption value="">{{ t('ap.allSuppliers') }}</BsSelectOption>
              <BsSelectOption v-for="c in data?.suppliers ?? []" :key="c.id" :value="c.id">{{ c.name }}</BsSelectOption>
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
      <BsText v-if="error" role="alert" tone="danger">{{ t('ap.errors.load') }} <BsButton type="submit" @click="load">{{ t('ap.retry') }}</BsButton></BsText>
      <BsSectionSkeleton v-else-if="pending" variant="table" :rows="5" />
      <template v-else-if="data">
        <BsInline gap="sm" :wrap="true">
          <template v-for="kind in kinds" :key="kind">
            <BsButton v-if="can(capability[kind])" type="submit" :disabled="readOnly || !controls.length || saving" @click="begin(kind)">{{ t(`ap.actions.${kind}`) }}</BsButton>
          </template>
        </BsInline>
        <BsText v-if="!controls.length" role="status">{{ t('ap.setup') }} <BsLink to="/accounts">{{ t('nav.accounts') }}</BsLink></BsText>
        <BsCard as="section" padding="none" overflow="hidden">
          <BsHeading :level="2" size="h2">{{ t('ap.openItems') }}</BsHeading>
          <BsDataTable
            :value="items"
            row-key="bill_id"
            :density="tableDensity"
            sticky-header
            max-height="32rem"
            :scroll-label="t('accountingTable.payablesScroll')"
            :label="t('ap.openItems')"
            :columns="[{ key: 'column1', header: (t('ap.supplier')) + '/' + (t('ap.reference')) }, { key: 'issue_date', field: 'issue_date', header: t('ap.issueDate') }, { key: 'due_date', field: 'due_date', header: t('ap.dueDate') }, { key: 'column4', header: t('ap.original') }, { key: 'column5', header: t('ap.outstanding') }, { key: 'column6', header: t('ap.aging') }]"
          >
            <template #empty>{{ t('ap.empty') }}</template>
            <template #header-column1>{{ t('ap.supplier') }} / {{ t('ap.reference') }}</template>
            <template #cell-column1="{ row }">
              <BsText as="span" emphasis="semibold">{{ row.supplier_name }}</BsText>
              <BsText dir="ltr" as="span" size="xs" tone="muted">{{ row.reference }}</BsText>
            </template>
            <template #cell-column4="{ row }">
              <BsMoneyText :amount="row.original_minor" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" />
            </template>
            <template #cell-column5="{ row }">
              <BsMoneyText :amount="row.outstanding_minor" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" />
            </template>
            <template #cell-column6="{ row }">{{ t(`ap.buckets.${row.aging_bucket}`) }}</template>
          </BsDataTable>
        </BsCard>
        <BsCard as="section" padding="md">
          <BsHeading :level="2" size="h2">{{ t('ap.aging') }}</BsHeading>
          <BsText size="sm" tone="muted">{{ t('ap.agingPolicy') }}</BsText>
          <BsDescriptionList :columns="3">
            <BsBox v-for="bucket in aging" :key="bucket.bucket">
              <BsDescriptionTerm>{{ t(`ap.buckets.${bucket.bucket}`) }}</BsDescriptionTerm>
              <BsDescriptionValue>
                <BsMoneyText :amount="bucket.amount" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" />
              </BsDescriptionValue>
            </BsBox>
          </BsDescriptionList>
        </BsCard>
        <BsCard as="section" padding="none" overflow="hidden">
          <BsHeading :level="2" size="h2">{{ t('ap.statement') }}</BsHeading>
          <BsText v-if="!data.statement" tone="muted">{{ t('ap.chooseSupplier') }}</BsText>
          <template v-else>
            <BsDescriptionList :columns="3">
              <BsBox v-for="field in statementFields" :key="field">
                <BsDescriptionTerm>{{ t(`ap.totals.${field}`) }}</BsDescriptionTerm>
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
              :scroll-label="t('accountingTable.payablesScroll')"
              :label="t('ap.statement')"
              :columns="[{ key: 'date', field: 'date', header: t('ap.date') }, { key: 'reference', field: 'reference', header: t('ap.reference') }, { key: 'column3', header: t('ap.kind') }, { key: 'column4', header: t('ap.movement') }, { key: 'column5', header: t('ap.balance') }, { key: 'reason', field: 'reason', header: t('ap.reason') }, { key: 'column7', header: t('ap.history') }]"
            >
              <template #empty>{{ t('ap.empty') }}</template>
              <template #cell-column3="{ row }">{{ t(`ap.kinds.${row.kind}`) }}<BsText v-if="row.reversed" as="span"> · {{ t('ap.reversed') }}</BsText></template>
              <template #cell-column4="{ row }">
                <BsMoneyText :amount="row.effect_minor" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" />
              </template>
              <template #cell-column5="{ row }">
                <BsMoneyText :amount="row.balance_minor" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" />
              </template>
              <template #cell-column7="{ row }">
                <BsLink :to="{ path: '/transactions', query: { q: row.transaction_id } }">{{ t('ap.journal') }}</BsLink>
                <BsText v-if="row.reverses_document_id" size="xs">{{ t('ap.reverses') }}: {{ row.reverses_document_id }}</BsText>
                <BsButton
                  v-if="can('ap.reverse') && !row.reversed && row.kind !== 'reversal'"
                  type="submit"
                  :disabled="readOnly || saving"
                  @click="begin('reversal', row)"
                >{{ t('ap.actions.reversal') }}</BsButton>
              </template>
            </BsDataTable>
          </template>
        </BsCard>
        <BsCard v-if="can('controls.reconcile')" as="section" padding="none" overflow="hidden">
          <BsHeading :level="2" size="h2">{{ t('controls.reconciliation') }}</BsHeading>
          <BsText size="sm" tone="muted">{{ t('ap.reconciliationPolicy') }}</BsText>
          <BsDataTable
            :value="data.reconciliation"
            row-key="control_account_id"
            :density="tableDensity"
            :label="t('controls.reconciliation')"
            :columns="[{ key: 'account_name', field: 'account_name', header: t('ap.control') }, { key: 'column2', header: t('controls.glBalance') }, { key: 'column3', header: t('controls.subledgerBalance') }, { key: 'column4', header: t('controls.variance') }, { key: 'column5', header: t('controls.status') }]"
          >
            <template #empty>{{ t('ap.empty') }}</template>
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
          <template #summary>{{ t('ap.legacy') }}</template>
          <BsText size="sm" tone="muted">{{ t('ap.legacyPolicy') }}</BsText>
          <BsDataTable
            :value="data.legacy"
            row-key="commitment_id"
            :density="tableDensity"
            :label="t('ap.legacy')"
            :columns="[{ key: 'reference', field: 'reference', header: t('ap.reference') }, { key: 'column2', header: t('ap.original') }, { key: 'column3', header: t('ap.cashSettled') }, { key: 'column4', header: t('ap.outstanding') }]"
          >
            <template #empty>{{ t('ap.empty') }}</template>
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
      :title="t(`ap.actions.${form.kind}`)"
      :pending="saving"
      :dirty="dirty"
      :error="formError"
      size="lg"
      :submit-label="t('common.save')"
      :cancel-label="t('common.cancel')"
      :submit-disabled="readOnly"
      @submit="save"
    >
      <BsText v-if="form.kind === 'reversal'" tone="muted">{{ t('ap.reversalPolicy') }}</BsText>
      <template v-else>
        <BsFloatingField :label="t('ap.supplier')">
          <BsSelect id="ap-form-supplier" v-model="form.supplier" required native>
            <BsSelectOption value="" />
            <BsSelectOption v-for="c in data?.suppliers.filter(c => !c.archived) ?? []" :key="c.id" :value="c.id">{{ c.name }}</BsSelectOption>
          </BsSelect>
        </BsFloatingField>
        <BsFloatingField :label="t('ap.control')">
          <BsSelect id="ap-control" v-model="form.control" required native>
            <BsSelectOption v-for="a in controls" :key="a.id" :value="a.id">{{ a.name }}</BsSelectOption>
          </BsSelect>
        </BsFloatingField>
        <BsFloatingField :label="t(form.kind === 'payment' ? 'ap.cash' : 'ap.expenseOrAsset')">
          <BsSelect id="ap-offset" v-model="form.offset" required native>
            <BsSelectOption value="" />
            <BsSelectOption v-for="a in offsets" :key="a.id" :value="a.id">{{ a.name }}</BsSelectOption>
          </BsSelect>
        </BsFloatingField>
        <BsFloatingField :label="t('ap.reference')">
          <BsInput id="ap-reference" v-model="form.reference" required />
        </BsFloatingField>
        <BsFloatingField :label="t('ap.amount')">
          <BsInput
            id="ap-amount"
            v-model="form.amount"
            inputmode="decimal"
            required
            :aria-invalid="Boolean(amountError)"
            :aria-describedby="amountError ? 'ap-amount-error' : undefined"
            @blur="amountMinor()"
          />
        </BsFloatingField>
        <BsText v-if="amountError" id="ap-amount-error" role="alert" size="sm" tone="danger">{{ amountError }}</BsText>
      </template>
      <BsFloatingField :label="t('ap.date')">
        <BsInput id="ap-date" v-model="form.date" type="date" required />
      </BsFloatingField>
      <BsFloatingField v-if="form.kind === 'bill'" :label="t('ap.dueDate')">
        <BsInput id="ap-due" v-model="form.due" type="date" :min="form.date" required />
      </BsFloatingField>
      <BsFloatingField v-if="['credit', 'adjustment', 'reversal'].includes(form.kind)" :label="t('ap.reason')">
        <BsInput id="ap-reason" v-model="form.reason" required />
      </BsFloatingField>
      <BsFieldGroup v-if="isAllocation">
        <template #legend>{{ t('ap.allocations') }}</template>
        <BsText size="sm" tone="muted">{{ t('ap.allocationPolicy') }}</BsText>
        <BsText v-if="!allocationItems.length">{{ t('ap.noAllocationItems') }}</BsText>
        <BsBox v-for="item in allocationItems" :key="item.bill_id">
          <BsFloatingField :label="item.reference">
            <BsInput :id="`ap-allocation-${item.bill_id}`" v-model="form.allocations[item.bill_id]" inputmode="decimal" />
          </BsFloatingField>
          <BsText size="sm">{{ t('ap.outstanding') }}: <BsMoneyText :amount="item.outstanding_minor" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" /></BsText>
        </BsBox>
      </BsFieldGroup>
    </BsRecordActionDialog>
  </BsStack>
</template>
