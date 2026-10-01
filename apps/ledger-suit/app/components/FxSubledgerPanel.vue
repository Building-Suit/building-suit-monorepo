<script setup lang="ts">
import type { Json } from '../../types/database.types'
import type { FxRevaluationLine } from '../../types/fx-rpc.types'
import type { FxSubledgerType } from '~/utils/fxSubledger'
import { convertMinorExact, parsePositiveDecimal } from '~/utils/fxMoney'

const props = defineProps<{ subledger: FxSubledgerType, asOf: string, readOnly: boolean }>()
const asOfRef = toRef(props, 'asOf')
const { t } = useI18n()
const { baseCurrency, can } = useTenant()
const { data, pending, error, load, command, preview } = useFxSubledger(props.subledger, asOfRef)
const busy = ref(false)
const message = ref('')
const failure = ref('')
const tab = ref<'item' | 'settlement' | 'revaluation' | 'reversal' | 'mapping'>('item')
const item = reactive({ counterparty: '', control: '', offset: '', date: props.asOf, due: props.asOf, reference: '', currency: 'USD', amount: '', rate: '', source: '', evidence: '' })
const settlement = reactive({ counterparty: '', control: '', cash: '', date: props.asOf, reference: '', currency: 'EUR', gross: '', rate: '', source: '', evidence: '', rows: {} as Record<string, { document: string, settlement: string, rate: string, evidence: string }> })
const revaluation = reactive({ control: '', reference: '', source: '', rates: {} as Record<string, { rate: string, reference: string }> })
const mapping = reactive({ realizedGain: '', realizedLoss: '', unrealizedGain: '', unrealizedLoss: '' })
const reversal = reactive({ kind: 'settlement' as 'item' | 'settlement' | 'revaluation', id: '', date: props.asOf, reason: '' })
const previewLines = ref<FxRevaluationLine[]>([])
const controls = computed(() => data.value?.accounts.filter(a => a.role === 'control' && a.subledger === props.subledger) ?? [])
const posting = computed(() => data.value?.accounts.filter(a => a.role === 'posting' && a.currency === baseCurrency.value) ?? [])
const cash = computed(() => data.value?.accounts.filter(a => a.role === 'posting' && a.type === 'asset' && a.currency === settlement.currency && ['cash', 'bank', 'mobile_wallet'].includes(a.subtype)) ?? [])
const eligibleItems = computed(() => data.value?.items.filter(row => row.counterparty_id === settlement.counterparty && row.control_account_id === settlement.control) ?? [])
const itemCurrencies = computed(() => [...new Set((data.value?.items ?? []).filter(row => !revaluation.control || row.control_account_id === revaluation.control).map(row => row.currency_code))])
watch(eligibleItems, rows => {
  for (const row of rows) settlement.rows[row.id] ??= { document: '', settlement: '', rate: '', evidence: '' }
}, { immediate: true })

function minor(value: string, currency: string) {
  const parsed = validatePositiveMoney(value, currency)
  if (!parsed.valid) throw new Error('FX_AMOUNT_INVALID')
  return parsed.minor
}
function rate(value: string) { return parsePositiveDecimal(value).canonical }
async function act(action: () => Promise<unknown>, success: string) {
  if (busy.value) return
  busy.value = true; failure.value = ''; message.value = ''
  try { await action(); message.value = success }
  catch (reason) { failure.value = String((reason as { message?: string })?.message ?? reason) }
  finally { busy.value = false }
}
function key() { return crypto.randomUUID() }
async function saveItem() {
  await act(() => command('post_fx_open_item', { p_subledger_type: props.subledger, p_counterparty_id: item.counterparty, p_control_account_id: item.control, p_offset_account_id: item.offset, p_document_date: item.date, p_due_date: item.due, p_reference: item.reference, p_currency_code: item.currency, p_original_minor: minor(item.amount, item.currency).toString(), p_recognition_rate: rate(item.rate), p_rate_date: item.date, p_rate_source: item.source, p_rate_reference: item.evidence, p_idempotency_key: key() }), t('fx.saved'))
}
async function saveSettlement() {
  const allocations = eligibleItems.value.flatMap(open => {
    const row = settlement.rows[open.id]
    if (!row?.document || !row.settlement) return []
    return [{ item_id: open.id, document_amount_minor: minor(row.document, open.currency_code).toString(), settlement_amount_minor: minor(row.settlement, settlement.currency).toString(), allocation_rate: rate(row.rate), conversion_evidence: row.evidence }]
  })
  const gross = minor(settlement.gross, settlement.currency)
  if (!allocations.length || allocations.reduce((sum, row) => sum + BigInt(row.settlement_amount_minor), 0n) !== gross) throw new Error('FX_FULL_ALLOCATION_REQUIRED')
  await act(() => command('post_fx_settlement', { p_subledger_type: props.subledger, p_counterparty_id: settlement.counterparty, p_control_account_id: settlement.control, p_cash_account_id: settlement.cash, p_settlement_date: settlement.date, p_reference: settlement.reference, p_settlement_currency: settlement.currency, p_gross_settlement_minor: gross.toString(), p_settlement_rate: rate(settlement.rate), p_rate_date: settlement.date, p_rate_source: settlement.source, p_rate_reference: settlement.evidence, p_allocations: allocations as Json, p_idempotency_key: key() }), t('fx.saved'))
}
function ratePayload(): Json { return Object.fromEntries(itemCurrencies.value.map(currency => [currency, { rate: rate(revaluation.rates[currency]?.rate ?? ''), reference: revaluation.rates[currency]?.reference ?? '' }])) }
async function runPreview() {
  await act(async () => { previewLines.value = await preview({ p_subledger_type: props.subledger, p_control_account_id: revaluation.control, p_as_of_date: props.asOf, p_rates: ratePayload() }) }, t('fx.previewReady'))
}
async function confirmRevaluation() {
  await act(() => command('confirm_fx_revaluation', { p_subledger_type: props.subledger, p_control_account_id: revaluation.control, p_as_of_date: props.asOf, p_reference: revaluation.reference, p_rate_source: revaluation.source, p_rates: ratePayload(), p_idempotency_key: key() }), t('fx.saved'))
}
async function saveMapping() {
  await act(() => command('configure_fx_accounts', { p_realized_gain: mapping.realizedGain, p_realized_loss: mapping.realizedLoss, p_unrealized_gain: mapping.unrealizedGain, p_unrealized_loss: mapping.unrealizedLoss }), t('fx.saved'))
}
async function saveReversal() {
  const rpc = reversal.kind === 'item' ? 'reverse_fx_open_item' : reversal.kind === 'settlement' ? 'reverse_fx_settlement' : 'reverse_fx_revaluation'
  const target = reversal.kind === 'item' ? { p_item_id: reversal.id } : reversal.kind === 'settlement' ? { p_settlement_id: reversal.id } : { p_batch_id: reversal.id }
  await act(() => command(rpc, { ...target, p_date: reversal.date, p_reason: reversal.reason, p_idempotency_key: key() } as never), t('fx.saved'))
}
function expectedSettlement(row: { document: string, rate: string }, currency: string) {
  try { return convertMinorExact(minor(row.document, currency), currency, settlement.currency, rate(row.rate)).toString() }
  catch { return '' }
}
</script>

<template>
  <section class="ls-card overflow-hidden" data-testid="fx-panel">
    <div class="border-b border-border p-4"><h2 class="text-h2 font-bold">{{ t('fx.title') }}</h2><p class="text-sm text-fg-muted">{{ t('fx.policy') }}</p></div>
    <div class="flex flex-wrap gap-2 p-4" role="tablist">
      <BsButton type="submit" v-for="name in (['item','settlement','revaluation','reversal','mapping'] as const)" :key="name" class="ls-btn" :aria-selected="tab===name" @click="tab=name">{{ t(`fx.tabs.${name}`) }}</BsButton>
    </div>
    <p v-if="error" class="ls-error m-4" role="alert">{{ t('fx.errors.load') }} <BsButton type="submit" @click="load">{{ t('common.retry') }}</BsButton></p>
    <SectionSkeleton v-else-if="pending" class="m-4" variant="table" :rows="3" />
    <div v-else class="space-y-4 p-4">
      <p v-if="failure" class="ls-error" role="alert">{{ t('fx.errors.save') }} · {{ failure }}</p><p v-if="message" role="status">{{ message }}</p>
      <p v-if="!data?.mapping && tab!=='mapping'" class="text-warning">{{ t('fx.mappingRequired') }}</p>
      <p v-if="tab==='mapping' && data?.mapping" role="status">{{ t('fx.mappingConfigured') }}</p>
      <BsForm v-if="tab==='mapping' && !data?.mapping" class="grid gap-4 md:grid-cols-2" @submit.prevent="saveMapping">
        <FloatingField v-for="field in ([['realizedGain','realizedGain'],['realizedLoss','realizedLoss'],['unrealizedGain','unrealizedGain'],['unrealizedLoss','unrealizedLoss']] as const)" :key="field[0]" :label="t(`fx.${field[1]}`)"><select v-model="mapping[field[0]]" class="ls-input" required><option value=""/><option v-for="a in posting.filter(a=>field[0].toLowerCase().includes('gain')?a.type==='revenue':a.type==='expense')" :key="a.id" :value="a.id">{{ a.name }}</option></select></FloatingField>
        <BsButton type="submit" class="ls-btn ls-btn-primary" :disabled="busy || readOnly || !can('fx.manage')">{{ t('common.save') }}</BsButton>
      </BsForm>
      <BsForm v-if="tab==='item'" class="grid gap-4 md:grid-cols-2" @submit.prevent="saveItem">
        <FloatingField :label="t('fx.counterparty')"><select v-model="item.counterparty" class="ls-input" required><option value=""/><option v-for="c in data?.counterparties??[]" :key="c.id" :value="c.id">{{ c.name }}</option></select></FloatingField>
        <FloatingField :label="t('fx.control')"><select v-model="item.control" class="ls-input" required><option value=""/><option v-for="a in controls" :key="a.id" :value="a.id">{{ a.name }}</option></select></FloatingField>
        <FloatingField :label="t('fx.offset')"><select v-model="item.offset" class="ls-input" required><option value=""/><option v-for="a in posting.filter(a=>subledger==='customer'?a.type==='revenue':['expense','asset'].includes(a.type))" :key="a.id" :value="a.id">{{ a.name }}</option></select></FloatingField>
        <FloatingField :label="t('fx.currency')"><select v-model="item.currency" class="ls-input"><option v-for="c in data?.currencies??[]" :key="c.code" :value="c.code">{{ c.code }} · {{ c.name }}</option></select></FloatingField>
        <FloatingField :label="t('fx.documentDate')"><input v-model="item.date" type="date" class="ls-input" required></FloatingField><FloatingField :label="t('fx.dueDate')"><input v-model="item.due" type="date" class="ls-input" :min="item.date" required></FloatingField>
        <FloatingField :label="t('fx.reference')"><input v-model="item.reference" class="ls-input" required></FloatingField><FloatingField :label="t('fx.amount')"><input v-model="item.amount" class="ls-input" inputmode="decimal" required></FloatingField>
        <FloatingField :label="t('fx.baseRate')"><input v-model="item.rate" class="ls-input" inputmode="decimal" required></FloatingField><FloatingField :label="t('fx.rateSource')"><input v-model="item.source" class="ls-input" required></FloatingField><FloatingField :label="t('fx.rateEvidence')"><input v-model="item.evidence" class="ls-input" required></FloatingField>
        <BsButton type="submit" class="ls-btn ls-btn-primary" :disabled="busy || readOnly || !data?.mapping">{{ t('fx.postItem') }}</BsButton>
      </BsForm>
      <BsForm v-if="tab==='settlement'" class="space-y-4" @submit.prevent="saveSettlement">
        <div class="grid gap-4 md:grid-cols-2"><FloatingField :label="t('fx.counterparty')"><select v-model="settlement.counterparty" class="ls-input" required><option value=""/><option v-for="c in data?.counterparties??[]" :key="c.id" :value="c.id">{{ c.name }}</option></select></FloatingField><FloatingField :label="t('fx.control')"><select v-model="settlement.control" class="ls-input" required><option value=""/><option v-for="a in controls" :key="a.id" :value="a.id">{{ a.name }}</option></select></FloatingField><FloatingField :label="t('fx.cash')"><select v-model="settlement.cash" class="ls-input" required><option value=""/><option v-for="a in cash" :key="a.id" :value="a.id">{{ a.name }} · {{ a.currency }}</option></select></FloatingField><FloatingField :label="t('fx.currency')"><select v-model="settlement.currency" class="ls-input"><option v-for="c in data?.currencies??[]" :key="c.code" :value="c.code">{{ c.code }}</option></select></FloatingField><FloatingField :label="t('fx.settlementDate')"><input v-model="settlement.date" type="date" class="ls-input" required></FloatingField><FloatingField :label="t('fx.reference')"><input v-model="settlement.reference" class="ls-input" required></FloatingField><FloatingField :label="t('fx.gross')"><input v-model="settlement.gross" class="ls-input" inputmode="decimal" required></FloatingField><FloatingField :label="t('fx.baseRate')"><input v-model="settlement.rate" class="ls-input" inputmode="decimal" required></FloatingField><FloatingField :label="t('fx.rateSource')"><input v-model="settlement.source" class="ls-input" required></FloatingField><FloatingField :label="t('fx.rateEvidence')"><input v-model="settlement.evidence" class="ls-input" required></FloatingField></div>
        <div v-for="open in eligibleItems" :key="open.id" class="rounded border border-border p-3"><p class="font-bold">{{ open.reference }} · {{ open.currency_code }} <MoneyText :amount-minor="open.outstanding_minor" :currency="open.currency_code" /></p><div class="grid gap-3 md:grid-cols-4"><FloatingField :label="t('fx.documentAmount')"><input v-model="settlement.rows[open.id]!.document" class="ls-input"></FloatingField><FloatingField :label="t('fx.settlementAmount')"><input v-model="settlement.rows[open.id]!.settlement" class="ls-input"></FloatingField><FloatingField :label="t('fx.crossRate')"><input v-model="settlement.rows[open.id]!.rate" class="ls-input"></FloatingField><FloatingField :label="t('fx.conversionEvidence')"><input v-model="settlement.rows[open.id]!.evidence" class="ls-input"></FloatingField></div><p class="text-xs text-fg-muted">{{ t('fx.expected') }}: {{ expectedSettlement(settlement.rows[open.id]!,open.currency_code) }} {{ settlement.currency }} {{ t('fx.minorUnits') }}</p></div>
        <BsButton type="submit" class="ls-btn ls-btn-primary" :disabled="busy || readOnly || !data?.mapping">{{ t('fx.postSettlement') }}</BsButton>
      </BsForm>
      <BsForm v-if="tab==='revaluation'" class="space-y-4" @submit.prevent="runPreview"><div class="grid gap-4 md:grid-cols-2"><FloatingField :label="t('fx.control')"><select v-model="revaluation.control" class="ls-input" required><option value=""/><option v-for="a in controls" :key="a.id" :value="a.id">{{ a.name }}</option></select></FloatingField><FloatingField :label="t('fx.reference')"><input v-model="revaluation.reference" class="ls-input" required></FloatingField><FloatingField :label="t('fx.rateSource')"><input v-model="revaluation.source" class="ls-input" required></FloatingField></div><div v-for="currency in itemCurrencies" :key="currency" class="grid gap-3 md:grid-cols-2"><FloatingField :label="`${currency} · ${t('fx.closingRate')}`"><input v-model="(revaluation.rates[currency]??={rate:'',reference:''}).rate" class="ls-input" required></FloatingField><FloatingField :label="t('fx.rateEvidence')"><input v-model="revaluation.rates[currency]!.reference" class="ls-input" required></FloatingField></div><BsButton type="submit" class="ls-btn" :disabled="busy || !data?.mapping">{{ t('fx.preview') }}</BsButton></BsForm>
      <div v-if="previewLines.length" class="space-y-3"><BsDataTable :value="previewLines" data-key="open_item_id" :table-props="{'aria-label':t('fx.preview')}"><Column field="reference" :header="t('fx.reference')"/><Column field="currency_code" :header="t('fx.currency')"/><Column :header="t('fx.outstanding')"><template #body="{data:row}"><MoneyText :amount-minor="row.outstanding_minor" :currency="row.currency_code"/></template></Column><Column :header="t('fx.currentCarrying')"><template #body="{data:row}"><MoneyText :amount-minor="row.current_carrying_base_minor"/></template></Column><Column :header="t('fx.closingBase')"><template #body="{data:row}"><MoneyText :amount-minor="row.closing_base_minor"/></template></Column><Column :header="t('fx.delta')"><template #body="{data:row}"><MoneyText :amount-minor="row.delta_base_minor"/></template></Column></BsDataTable><BsButton type="submit" class="ls-btn ls-btn-primary" :disabled="busy || readOnly || !can('fx.revalue')" @click="confirmRevaluation">{{ t('fx.confirm') }}</BsButton></div>
      <BsForm v-if="tab==='reversal'" class="grid gap-4 md:grid-cols-2" @submit.prevent="saveReversal"><FloatingField :label="t('fx.reversalKind')"><select v-model="reversal.kind" class="ls-input"><option value="item">{{ t('fx.tabs.item') }}</option><option value="settlement">{{ t('fx.tabs.settlement') }}</option><option value="revaluation">{{ t('fx.tabs.revaluation') }}</option></select></FloatingField><FloatingField :label="t('fx.reversalTarget')"><select v-model="reversal.id" class="ls-input" required><option value=""/><option v-for="row in reversal.kind==='item'?(data?.items??[]):reversal.kind==='settlement'?(data?.settlements.filter(row=>!row.reverses_settlement_id)??[]):(data?.revaluations.filter(row=>row.transaction_id)??[])" :key="row.id" :value="row.id">{{ row.reference }}</option></select></FloatingField><FloatingField :label="t('fx.reversalDate')"><input v-model="reversal.date" type="date" class="ls-input" required></FloatingField><FloatingField :label="t('fx.reversalReason')"><input v-model="reversal.reason" class="ls-input" required></FloatingField><p class="text-sm text-fg-muted">{{ t('fx.reversalPolicy') }}</p><BsButton type="submit" class="ls-btn ls-btn-primary" :disabled="busy || readOnly">{{ t('fx.postReversal') }}</BsButton></BsForm>
      <BsDataTable :value="data?.items??[]" data-key="id" :table-props="{'aria-label':t('fx.openItems')}"><template #empty>{{ t('fx.empty') }}</template><Column field="counterparty_name" :header="t('fx.counterparty')"/><Column field="reference" :header="t('fx.reference')"/><Column field="currency_code" :header="t('fx.currency')"/><Column :header="t('fx.outstanding')"><template #body="{data:row}"><MoneyText :amount-minor="row.outstanding_minor" :currency="row.currency_code"/></template></Column><Column :header="t('fx.currentCarrying')"><template #body="{data:row}"><MoneyText :amount-minor="row.carrying_base_minor"/></template></Column><Column field="rate_reference" :header="t('fx.rateEvidence')"/></BsDataTable>
      <BsDataTable :value="data?.settlements??[]" data-key="id" :table-props="{'aria-label':t('fx.settlementHistory')}"><template #empty>{{ t('fx.noSettlements') }}</template><Column field="date" :header="t('fx.settlementDate')"/><Column field="reference" :header="t('fx.reference')"/><Column :header="t('fx.gross')"><template #body="{data:row}"><MoneyText :amount-minor="row.gross_minor" :currency="row.currency_code"/></template></Column><Column :header="t('fx.currentCarrying')"><template #body="{data:row}"><MoneyText :amount-minor="row.carrying_base_minor"/></template></Column><Column :header="t('fx.settlementBase')"><template #body="{data:row}"><MoneyText :amount-minor="row.settlement_base_minor"/></template></Column><Column :header="t('fx.realizedDifference')"><template #body="{data:row}"><MoneyText :amount-minor="row.realized_fx_base_minor"/></template></Column><Column field="rate_reference" :header="t('fx.rateEvidence')"/></BsDataTable>
      <BsDataTable :value="data?.allocations??[]" data-key="id" :table-props="{'aria-label':t('fx.allocationHistory')}"><template #empty>{{ t('fx.noAllocations') }}</template><Column field="settlement_reference" :header="t('fx.reference')"/><Column field="item_reference" :header="t('fx.openItems')"/><Column :header="t('fx.documentAmount')"><template #body="{data:row}"><MoneyText :amount-minor="row.document_amount_minor" :currency="row.document_currency"/></template></Column><Column :header="t('fx.settlementAmount')"><template #body="{data:row}"><MoneyText :amount-minor="row.settlement_amount_minor" :currency="row.settlement_currency"/></template></Column><Column field="allocation_rate" :header="t('fx.crossRate')"/><Column field="conversion_evidence" :header="t('fx.conversionEvidence')"/><Column :header="t('fx.realizedDifference')"><template #body="{data:row}"><MoneyText :amount-minor="row.realized_fx_base_minor"/></template></Column><Column :header="t('fx.roundingResidual')"><template #body="{data:row}"><MoneyText :amount-minor="row.rounding_residual_base_minor"/></template></Column></BsDataTable>
    </div>
  </section>
</template>
