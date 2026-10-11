import type { Json } from '../../types/database.types'
import type { FxRevaluationLine } from '../../types/fx-rpc.types'
import type { FxSubledgerType } from '~/utils/fxSubledger'
import { convertMinorExact, parsePositiveDecimal } from '~/utils/fxMoney'

/** Ledger-owned orchestration; mounted by a shared workflow scope in its route/layout. */
export function useLedgerFxSubledgerPanelView(_values: { subledger: FxSubledgerType, asOf: string, readOnly: boolean }, _emit: (event: string, ...args: unknown[]) => void) {
const _props = new Proxy(_values, { get: (target, key) => Reflect.get(target, key) ?? Reflect.get({}, key) })
const subledger = computed(() => _props.subledger)
const asOf = computed(() => _props.asOf)
const readOnly = computed(() => _props.readOnly)
const props = _props
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
const ledgerPresentation = useLedgerPresentation()
return { convertMinorExact, parsePositiveDecimal, props, asOfRef, t, baseCurrency, can, data, pending, error, load, command, preview, busy, message, failure, tab, item, settlement, revaluation, mapping, reversal, previewLines, controls, posting, cash, eligibleItems, itemCurrencies, minor, rate, act, key, saveItem, saveSettlement, ratePayload, runPreview, confirmRevaluation, saveMapping, saveReversal, expectedSettlement, ledgerPresentation, subledger, asOf, readOnly }
}
