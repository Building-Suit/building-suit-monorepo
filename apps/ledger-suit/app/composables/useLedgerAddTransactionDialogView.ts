import type { Database } from '~~/types/database.types'

/** Ledger-owned orchestration; mounted by a shared workflow scope in its route/layout. */
export function useLedgerAddTransactionDialogView(_values: Record<string, unknown>, _emit: (event: string, ...args: unknown[]) => void) {
/**
 * The single entry point for recording money.
 *
 * The user picks a plain-language flow ("Expense") and fills in plain-language
 * fields. No debit or credit appears anywhere — the database derives the
 * journal. The one exception is Adjustment, which is explicitly the accountant's
 * manual-journal tool.
 */

const supabase = useSupabaseClient<Database>()
const nuxtApp = useNuxtApp()
const { currentId, baseCurrency, can } = useTenant()
const { open, flow, close, markChanged } = useAddTransaction()
const toasts = useToasts()
const { t } = useI18n()
const describeError = useErrorMessage()
const { refresh: refreshPlanUsage } = usePlanUsage()

const { data: accounts } = useOrgAccounts()
const { data: categories } = useOrgCategories()
const { data: counterparties } = useOrgCounterparties()
const { data: canMultiCurrency } = usePlanFeature('multi_currency')
const { workspace: dimensionWorkspace } = useAccountingDimensions()

const paymentAccounts = usePaymentAccounts(accounts)
const assetAccounts = useAccountsOfType(accounts, ['asset'])
const liabilityAccounts = useAccountsOfType(accounts, ['liability'])
const equityAccounts = useAccountsOfType(accounts, ['equity'])
const postableAccounts = useAccountsOfType(accounts, ['asset', 'liability', 'equity', 'revenue', 'expense'])

const incomeCategories = computed(() => categories.value.filter(c => c.kind === 'income'))
const expenseCategories = computed(() => categories.value.filter(c => c.kind === 'expense'))

const availableFlows = computed(() => ADD_FLOWS.filter(f => can(FLOW_CAPABILITY[f])))

interface JournalLine {
  accountId: string
  side: 'debit' | 'credit'
  amount: string
  allocations: Array<{ kind: 'cost_center' | 'project', valueId: string, amount: string }>
}

const today = () => new Date().toISOString().slice(0, 10)

const form = reactive({
  amount: '',
  date: today(),
  description: '',
  reference: '',
  counterpartyId: '',
  categoryId: '',
  sourceAccountId: '',
  destinationAccountId: '',
  assetAccountId: '',
  liabilityAccountId: '',
  equityAccountId: '',
  feeAmount: '',
  principal: '',
  interest: '',
  fees: '',
  dueDate: '',
  usefulLifeMonths: '',
  reason: '',
  exchangeRate: '',
  destinationAmount: '',
  destinationExchangeRate: '',
  lines: [] as JournalLine[],
})

const submitting = ref(false)
const fieldError = ref<string | null>(null)

// One key per dialog session: a double-click, or a retry after a dropped
// response, resolves to the same transaction instead of posting twice.
const idempotencyKey = ref('')

function resetForm() {
  Object.assign(form, {
    amount: '',
    date: today(),
    description: '',
    reference: '',
    counterpartyId: '',
    categoryId: '',
    sourceAccountId: '',
    destinationAccountId: '',
    assetAccountId: '',
    liabilityAccountId: '',
    equityAccountId: '',
    feeAmount: '',
    principal: '',
    interest: '',
    fees: '',
    dueDate: '',
    usefulLifeMonths: '',
    reason: '',
    exchangeRate: '',
    destinationAmount: '',
    destinationExchangeRate: '',
    lines: [
      { accountId: '', side: 'debit', amount: '', allocations: [] },
      { accountId: '', side: 'credit', amount: '', allocations: [] },
    ],
  })
  fieldError.value = null
  idempotencyKey.value = crypto.randomUUID()
}

watch(open, (isOpen) => {
  if (isOpen) resetForm()
})

/** Parses an amount field, returning null and setting an error if invalid. */
function accountCurrency(accountId: string) {
  return accounts.value.find(account => account.id === accountId)?.currency
}

function accountLabel(account: { code?: string | null, name: string }) {
  return account.code ? `${account.code} · ${account.name}` : account.name
}

const effectiveCurrency = computed(() => {
  switch (flow.value) {
    case 'income': return accountCurrency(form.destinationAccountId) ?? baseCurrency.value
    case 'expense': return accountCurrency(form.sourceAccountId) ?? baseCurrency.value
    case 'transfer': return accountCurrency(form.sourceAccountId) ?? baseCurrency.value
    case 'asset_purchase': return accountCurrency(form.sourceAccountId) ?? baseCurrency.value
    case 'liability_created': return accountCurrency(form.destinationAccountId) ?? baseCurrency.value
    case 'liability_payment': return accountCurrency(form.sourceAccountId) ?? baseCurrency.value
    case 'owner_contribution': return accountCurrency(form.destinationAccountId) ?? baseCurrency.value
    case 'owner_withdrawal': return accountCurrency(form.sourceAccountId) ?? baseCurrency.value
    default: return baseCurrency.value
  }
})

const destinationCurrency = computed(() =>
  accountCurrency(form.destinationAccountId) ?? effectiveCurrency.value,
)
const isCrossCurrencyTransfer = computed(() =>
  flow.value === 'transfer'
  && Boolean(form.sourceAccountId)
  && Boolean(form.destinationAccountId)
  && effectiveCurrency.value !== destinationCurrency.value,
)

function toMinor(input: string, label: string, currency = effectiveCurrency.value): bigint | null {
  const result = validatePositiveMoney(input, currency)
  if (result.valid) return result.minor
  fieldError.value = t(`add.validation.${result.reason === 'positive' ? 'amountPositive' : result.reason === 'tooLarge' ? 'amountTooLarge' : result.reason === 'precision' ? 'amountPrecision' : 'amountInvalid'}`, { field: label, currency, precision: minorUnitFor(currency) })
  return null
}

function optionalMinor(input: string, label: string): bigint | null | undefined {
  if (!input.trim()) return 0n
  return toMinor(input, label)
}

const adjustmentTotals = computed(() => {
  let debit = 0n
  let credit = 0n
  for (const line of form.lines) {
    if (!line.amount.trim()) continue
    try {
      const minor = parseMoneyToMinor(line.amount, baseCurrency.value)
      if (line.side === 'debit') debit += minor
      else credit += minor
    }
    catch { /* an unparseable line simply does not count yet */ }
  }
  return { debit, credit, balanced: debit === credit && debit > 0n }
})

function addLine() {
  form.lines.push({ accountId: '', side: 'debit', amount: '', allocations: [] })
}

function removeLine(index: number) {
  if (form.lines.length <= 2) return
  form.lines.splice(index, 1)
}

function addAllocation(line: JournalLine, kind: 'cost_center' | 'project') {
  line.allocations.push({ kind, valueId: '', amount: line.amount })
}

const nullable = (value: string) => (value.trim() === '' ? null : value)

function positiveRate(input: string): number | null {
  const rate = Number(input)
  if (!Number.isFinite(rate) || rate <= 0) {
    fieldError.value = t('errors.INVALID_EXCHANGE_RATE')
    return null
  }
  return rate
}

async function submit() {
  if (submitting.value || !currentId.value) return
  fieldError.value = null
  submitting.value = true

  try {
    const org = currentId.value
    const exchangeRate = effectiveCurrency.value === baseCurrency.value || !canMultiCurrency.value
      ? undefined
      : positiveRate(form.exchangeRate)
    if (exchangeRate === null) return
    const shared = {
      p_organization_id: org,
      p_transaction_date: form.date,
      p_description: nullable(form.description),
      p_reference: nullable(form.reference),
      p_idempotency_key: idempotencyKey.value,
    }

    let rpc: { fn: string, args: Record<string, unknown> } | null = null

    switch (flow.value) {
      case 'income': {
        const amount = toMinor(form.amount, t('transactions.amount'))
        if (amount === null) return
        rpc = { fn: 'record_income', args: {
          ...shared,
          p_amount_minor: amount.toString(),
          p_destination_account_id: form.destinationAccountId,
          p_category_id: nullable(form.categoryId),
          p_counterparty_id: nullable(form.counterpartyId),
          p_currency_code: effectiveCurrency.value,
          p_exchange_rate: exchangeRate,
        } }
        break
      }

      case 'expense': {
        const amount = toMinor(form.amount, t('transactions.amount'))
        if (amount === null) return
        rpc = { fn: 'record_expense', args: {
          ...shared,
          p_amount_minor: amount.toString(),
          p_source_account_id: form.sourceAccountId,
          p_category_id: nullable(form.categoryId),
          p_counterparty_id: nullable(form.counterpartyId),
          p_currency_code: effectiveCurrency.value,
          p_exchange_rate: exchangeRate,
        } }
        break
      }

      case 'transfer': {
        const amount = toMinor(form.amount, t('transactions.amount'))
        if (amount === null) return
        const fee = optionalMinor(form.feeAmount, t('add.transferFee'))
        if (fee === null) return
        const destinationAmount = isCrossCurrencyTransfer.value
          ? toMinor(form.destinationAmount, t('add.destinationAmount'), destinationCurrency.value)
          : undefined
        const destinationExchangeRate = !isCrossCurrencyTransfer.value
          || destinationCurrency.value === baseCurrency.value
          ? undefined
          : positiveRate(form.destinationExchangeRate)
        if (destinationAmount === null || destinationExchangeRate === null) return
        rpc = { fn: 'record_transfer', args: {
          ...shared,
          p_amount_minor: amount.toString(),
          p_from_account_id: form.sourceAccountId,
          p_to_account_id: form.destinationAccountId,
          p_fee_minor: fee?.toString(),
          p_destination_amount_minor: destinationAmount?.toString(),
          p_exchange_rate: exchangeRate,
          p_destination_exchange_rate: destinationExchangeRate,
        } }
        break
      }

      case 'asset_purchase': {
        const amount = toMinor(form.amount, t('transactions.amount'))
        if (amount === null) return
        rpc = { fn: 'record_asset_purchase', args: {
          ...shared,
          p_amount_minor: amount.toString(),
          p_asset_account_id: form.assetAccountId,
          p_payment_account_id: form.sourceAccountId,
          p_counterparty_id: nullable(form.counterpartyId),
          p_useful_life_months: form.usefulLifeMonths ? Number(form.usefulLifeMonths) : null,
          p_exchange_rate: exchangeRate,
        } }
        break
      }

      case 'liability_created': {
        const amount = toMinor(form.amount, t('transactions.amount'))
        if (amount === null) return
        rpc = { fn: 'record_liability_created', args: {
          ...shared,
          p_amount_minor: amount.toString(),
          p_liability_account_id: form.liabilityAccountId,
          p_destination_account_id: form.destinationAccountId,
          p_counterparty_id: nullable(form.counterpartyId),
          p_due_date: nullable(form.dueDate),
          p_exchange_rate: exchangeRate,
        } }
        break
      }

      case 'liability_payment': {
        const principal = optionalMinor(form.principal, t('add.principal'))
        const interest = optionalMinor(form.interest, t('add.interest'))
        const fees = optionalMinor(form.fees, t('add.fees'))
        if (principal === null || interest === null || fees === null) return
        if ((principal ?? 0n) + (interest ?? 0n) + (fees ?? 0n) <= 0n) {
          fieldError.value = t('add.validation.paymentRequired')
          return
        }
        rpc = { fn: 'record_liability_payment', args: {
          ...shared,
          p_liability_account_id: form.liabilityAccountId,
          p_payment_account_id: form.sourceAccountId,
          p_principal_minor: principal?.toString(),
          p_interest_minor: interest?.toString(),
          p_fees_minor: fees?.toString(),
          p_counterparty_id: nullable(form.counterpartyId),
          p_exchange_rate: exchangeRate,
        } }
        break
      }

      case 'owner_contribution': {
        const amount = toMinor(form.amount, t('transactions.amount'))
        if (amount === null) return
        rpc = { fn: 'record_owner_contribution', args: {
          ...shared,
          p_amount_minor: amount.toString(),
          p_destination_account_id: form.destinationAccountId,
          p_equity_account_id: nullable(form.equityAccountId),
          p_exchange_rate: exchangeRate,
        } }
        break
      }

      case 'owner_withdrawal': {
        const amount = toMinor(form.amount, t('transactions.amount'))
        if (amount === null) return
        rpc = { fn: 'record_owner_withdrawal', args: {
          ...shared,
          p_amount_minor: amount.toString(),
          p_source_account_id: form.sourceAccountId,
          p_drawings_account_id: nullable(form.equityAccountId),
          p_exchange_rate: exchangeRate,
        } }
        break
      }

      case 'adjustment': {
        if (!adjustmentTotals.value.balanced) {
          fieldError.value = t('add.validation.mustBalance')
          return
        }
        if (!form.description.trim() || !form.reason.trim()) {
          fieldError.value = t('add.validation.descriptionAndReason')
          return
        }

        const lines = []
        for (const line of form.lines.filter(item => item.accountId && item.amount.trim())) {
          const amount = parseMoneyToMinor(line.amount, baseCurrency.value)
          const allocations = []
          for (const kind of ['cost_center', 'project'] as const) {
            const rows = line.allocations.filter(item => item.kind === kind && item.valueId)
            if (!rows.length) continue
            const parsed = rows.map(item => ({ ...item, minor: parseMoneyToMinor(item.amount, baseCurrency.value) }))
            if (parsed.reduce((sum, item) => sum + item.minor, 0n) !== amount) {
              fieldError.value = t('dimensions.allocationMismatch', { kind: t(`dimensions.kinds.${kind}`) })
              return
            }
            allocations.push(...parsed.map(item => ({ dimension_value_id: item.valueId, amount_minor: item.minor.toString(), base_amount_minor: item.minor.toString() })))
          }
          lines.push({ account_id: line.accountId, side: line.side, amount_minor: amount.toString(), allocations })
        }

        rpc = { fn: 'create_adjustment', args: {
          p_organization_id: org,
          p_transaction_date: form.date,
          p_lines: lines,
          p_description: form.description,
          p_reason: form.reason,
          p_idempotency_key: idempotencyKey.value,
        } }
        break
      }
    }

    if (!rpc) return

    const { error } = await supabase.rpc(rpc.fn as never, rpc.args as never)
    if (error) throw error

    await refreshPlanUsage()
    markChanged()
    // Keep mounted account/category selectors populated after a successful post.
    // Refresh balances and reads without clearing their currently selected options.
    const refreshKeys = Object.keys(nuxtApp.payload.data).filter(key => key.startsWith('org:') && !key.startsWith('org:record-page:'))
    await nuxtApp.runWithContext(() => refreshNuxtData(refreshKeys))
    toasts.success(t('add.savedTitle'), t('add.savedBody'))
    close()
  }
  catch (err) {
    fieldError.value = describeError(err)
  }
  finally {
    submitting.value = false
  }
}

const { dirty: overlayDirty0 } = useRecordAction(() => form, computed(() => Boolean(open.value)))
const ledgerPresentation = useLedgerPresentation()
const ledgerUsage = useLedgerUsagePresentation()
return { supabase, nuxtApp, currentId, baseCurrency, can, open, flow, close, markChanged, toasts, t, describeError, refreshPlanUsage, accounts, categories, counterparties, canMultiCurrency, dimensionWorkspace, paymentAccounts, assetAccounts, liabilityAccounts, equityAccounts, postableAccounts, incomeCategories, expenseCategories, availableFlows, today, form, submitting, fieldError, idempotencyKey, resetForm, accountCurrency, accountLabel, effectiveCurrency, destinationCurrency, isCrossCurrencyTransfer, toMinor, optionalMinor, adjustmentTotals, addLine, removeLine, addAllocation, nullable, positiveRate, submit, overlayDirty0, ledgerPresentation, ledgerUsage }
}
