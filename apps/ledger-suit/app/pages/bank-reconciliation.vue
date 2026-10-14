<script setup lang="ts">
import { formatPresentationMoney } from '@building-suit/ui/utils/presentation'
import type { BsBankReconciliationCopy, BsBankReconciliationView, BsBankReconciliationForm, BsBankReconciliationChoices } from '@building-suit/ui/types/bankReconciliationPresentation'
import { bankStatementTemplate, minorToDecimalInput, parseBankStatementCsv, selectedMinorTotal } from '~/utils/bankReconciliation'
import type { BankCandidate, BankMatch, BankOutstanding, BankStatementLine } from '~/utils/bankReconciliation'

definePageMeta({ layout: 'default' })
const { t, locale } = useI18n()
const { currentId, can } = useTenant()
const user = useSupabaseUser()
const { readOnly } = useBilling()
const toasts = useToasts()
const { selectedId, data, pending, error, load, command } = useBankReconciliation()
useHead({ title: () => `${t('bank.title')} · ${t('app.name')}` })
const selectedLines = ref(new Set<string>())
const selectedTransactions = ref(new Set<string>())
const action = reactive({ mode: '' as 'import' | 'adjust' | 'correct' | 'unmatch' | 'outstanding' | 'removeOutstanding' | 'reopen', target: '', date: '', amount: '', description: '', reference: '', reason: '', offset: '', file: null as File | null, account: '', start: '', end: '', opening: '', closing: '', key: '' })
const { visible, pending: saving, dirty, open, complete } = useRecordAction(() => action)
const formError = ref('')
const current = computed(() => data.value?.reconciliations.find(item => item.id === selectedId.value) ?? null)
const bankAccounts = computed(() => data.value?.accounts.filter(a => a.type === 'asset' && a.subtype === 'bank' && a.role === 'posting') ?? [])
const offsetAccounts = computed(() => data.value?.accounts.filter(a => a.role === 'posting' && a.id !== current.value?.bank_account_id) ?? [])
const lineTotal = computed(() => selectedMinorTotal(selectedLines.value, data.value?.lines ?? []))
const transactionTotal = computed(() => selectedMinorTotal(selectedTransactions.value, data.value?.candidates ?? []))
const exact = computed(() => selectedLines.value.size > 0 && selectedTransactions.value.size > 0 && lineTotal.value === transactionTotal.value)
const lineStates = ['matched', 'unmatched', 'unresolved'] as const
const stateSummary = computed(() => lineStates.map(status => ({ status, count: data.value?.lines.filter(line => line.status === status).length ?? 0, amount: (data.value?.lines.filter(line => line.status === status && line.amount_minor !== null).reduce((sum, line) => sum + BigInt(line.amount_minor!), 0n) ?? 0n).toString() })))
watch(selectedId, () => { selectedLines.value = new Set(); selectedTransactions.value = new Set() })
watch([currentId, () => user.value?.id], () => { visible.value = false; selectedLines.value = new Set(); selectedTransactions.value = new Set() }, { flush: 'sync' })
function begin(mode: typeof action.mode, target: BankStatementLine | BankMatch | BankCandidate | BankOutstanding | null = null) {
  const minor = 'amount_minor' in (target ?? {}) ? (target as BankStatementLine).amount_minor : null
  Object.assign(action, { mode, target: target?.id ?? '', date: 'date' in (target ?? {}) ? (target as BankStatementLine).date ?? '' : '', amount: minor && current.value ? minorToDecimalInput(minor, current.value.currency_code) : '', description: 'description' in (target ?? {}) ? (target as BankStatementLine).description : '', reference: 'external_reference' in (target ?? {}) ? (target as BankStatementLine).external_reference ?? '' : '', reason: '', offset: '', file: null, account: bankAccounts.value[0]?.id ?? '', start: '', end: '', opening: '', closing: '', key: crypto.randomUUID() })
  formError.value = ''; open()
}
function message(failure: unknown) {
  const value = typeof failure === 'object' && failure && 'message' in failure ? String(failure.message) : ''
  if (value.includes('DUPLICATE_FILE')) return t('bank.errors.duplicateFile')
  if (value.includes('DUPLICATE_STATEMENT_LINE')) return t('bank.errors.duplicateLine')
  if (value.includes('NOT_EXACT')) return t('bank.errors.notExact')
  if (value.includes('INCOMPLETE')) return t('bank.errors.incomplete')
  if (value.includes('NOT_BALANCED')) return t('bank.errors.notBalanced')
  if (value.includes('ACCOUNTING_PERIOD') || value.includes('BOOKS_LOCKED')) return t('bank.errors.period')
  if (value.includes('APPROVAL_REQUIRED')) return t('bank.errors.approval')
  if (value.includes('INSUFFICIENT_PERMISSION')) return t('bank.errors.permission')
  return t('bank.errors.save')
}
async function digest(file: File) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()))].map(byte => byte.toString(16).padStart(2, '0')).join('') }
async function save() {
  if (saving.value || !currentId.value) return
  const organization = currentId.value; const actor = user.value?.id
  formError.value = ''; saving.value = true
  try {
    if (action.mode === 'import') {
      if (!action.file) throw new Error('file required')
      const account = bankAccounts.value.find(item => item.id === action.account)
      if (!account) throw new Error('account required')
      const rows = parseBankStatementCsv(await action.file.text(), account.currency, { date: t('bank.csv.date'), amount: t('bank.csv.amount'), description: t('bank.csv.description'), reference: t('bank.csv.reference') })
      const id = await command('import_bank_statement', { p_bank_account_id: account.id, p_file_name: action.file.name, p_file_sha256: await digest(action.file), p_statement_start: action.start, p_statement_end: action.end, p_opening_balance_minor: parseMoneyToMinor(action.opening, account.currency).toString(), p_closing_balance_minor: parseMoneyToMinor(action.closing, account.currency).toString(), p_currency_code: account.currency, p_rows: rows })
      selectedId.value = String(id)
    }
    else if (action.mode === 'correct') await command('correct_bank_statement_line', { p_statement_line_id: action.target, p_transaction_date: action.date, p_amount_minor: parseMoneyToMinor(action.amount, current.value!.currency_code).toString(), p_description: action.description, p_external_reference: action.reference || null, p_reason: action.reason })
    else if (action.mode === 'adjust') await command('create_bank_adjustment', { p_reconciliation_id: selectedId.value, p_statement_line_id: action.target, p_offset_account_id: action.offset, p_reason: action.reason, p_idempotency_key: action.key })
    else if (action.mode === 'unmatch') await command('unmatch_bank_items', { p_match_group_id: action.target, p_reason: action.reason })
    else if (action.mode === 'outstanding') await command('add_bank_outstanding_item', { p_reconciliation_id: selectedId.value, p_transaction_id: action.target, p_reason: action.reason })
    else if (action.mode === 'removeOutstanding') await command('remove_bank_outstanding_item', { p_outstanding_item_id: action.target, p_reason: action.reason })
    else if (action.mode === 'reopen') await command('reopen_bank_reconciliation', { p_reconciliation_id: selectedId.value, p_reason: action.reason })
    if (organization !== currentId.value || actor !== user.value?.id) return
    complete(); toasts.success(t('bank.saved'))
  }
  catch (failure) { if (organization === currentId.value && actor === user.value?.id) formError.value = message(failure) }
  finally { saving.value = false }
}
async function matchSelected() {
  if (!exact.value || saving.value) return
  saving.value = true
  try { await command('match_bank_items', { p_reconciliation_id: selectedId.value, p_statement_line_ids: [...selectedLines.value], p_transaction_ids: [...selectedTransactions.value], p_idempotency_key: crypto.randomUUID() }); selectedLines.value = new Set(); selectedTransactions.value = new Set(); toasts.success(t('bank.matched')) }
  catch (failure) { toasts.error(t('bank.errors.title'), message(failure)) }
  finally { saving.value = false }
}
async function completeReconciliation() {
  saving.value = true
  try { await command('complete_bank_reconciliation', { p_reconciliation_id: selectedId.value }); toasts.success(t('bank.completed')) }
  catch (failure) { toasts.error(t('bank.errors.title'), message(failure)) }
  finally { saving.value = false }
}
function downloadTemplate() { downloadCsv('bank-statement-template.csv', bankStatementTemplate({ date: t('bank.csv.date'), amount: t('bank.csv.amount'), description: t('bank.csv.description'), reference: t('bank.csv.reference'), example: t('bank.csv.example') })) }
const ledgerPresentation = useLedgerPresentation()

const bankCopy = computed<BsBankReconciliationCopy>(() => ({
  bank_actions: t('bank.actions'),
  bank_active: t('bank.active'),
  bank_adjust: t('bank.adjust'),
  bank_amount: t('bank.amount'),
  bank_auditHistory: t('bank.auditHistory'),
  bank_bankAccount: t('bank.bankAccount'),
  bank_closing: t('bank.closing'),
  bank_complete: t('bank.complete'),
  bank_correct: t('bank.correct'),
  bank_date: t('bank.date'),
  bank_denied: t('bank.denied'),
  bank_description: t('bank.description'),
  bank_difference: t('bank.difference'),
  bank_empty: t('bank.empty'),
  bank_emptyHint: t('bank.emptyHint'),
  bank_end: t('bank.end'),
  bank_equation: t('bank.equation'),
  bank_equationPolicy: t('bank.equationPolicy'),
  bank_errors_load: t('bank.errors.load'),
  bank_file: t('bank.file'),
  bank_import: t('bank.import'),
  bank_journal: t('bank.journal'),
  bank_ledgerBalance: t('bank.ledgerBalance'),
  bank_ledgerCandidates: t('bank.ledgerCandidates'),
  bank_markOutstanding: t('bank.markOutstanding'),
  bank_matchExact: t('bank.matchExact'),
  bank_matchHistory: t('bank.matchHistory'),
  bank_noCandidates: t('bank.noCandidates'),
  bank_noLines: t('bank.noLines'),
  bank_noMatches: t('bank.noMatches'),
  bank_noOutstanding: t('bank.noOutstanding'),
  bank_offsetAccount: t('bank.offsetAccount'),
  bank_opening: t('bank.opening'),
  bank_outstanding: t('bank.outstanding'),
  bank_outstandingTotal: t('bank.outstandingTotal'),
  bank_policy: t('bank.policy'),
  bank_reason: t('bank.reason'),
  bank_reconciliation: t('bank.reconciliation'),
  bank_reference: t('bank.reference'),
  bank_remove: t('bank.remove'),
  bank_reopen: t('bank.reopen'),
  bank_retry: t('bank.retry'),
  bank_select: t('bank.select'),
  bank_selectedTotals: t('bank.selectedTotals'),
  bank_start: t('bank.start'),
  bank_state: t('bank.state'),
  bank_statementBalance: t('bank.statementBalance'),
  bank_statementLines: t('bank.statementLines'),
  bank_statementMismatch: t('bank.statementMismatch'),
  bank_template: t('bank.template'),
  bank_title: t('bank.title'),
  bank_unmatch: t('bank.unmatch'),
  bank_unmatched: t('bank.unmatched'),
  common_cancel: t('common.cancel'),
  common_save: t('common.save'),
  pageContext_label: t('pageContext.label'),
}))

const bankForm = computed<BsBankReconciliationForm>({ get: () => ({ date: action.date, amount: action.amount, description: action.description, reference: action.reference, reason: action.reason, offset: action.offset, account: action.account, start: action.start, end: action.end, opening: action.opening, closing: action.closing }), set: value => Object.assign(action, value) })
const bankLineSelection = computed({ get: () => [...selectedLines.value], set: (value: string[]) => { selectedLines.value = new Set(value) } })
const bankTransactionSelection = computed({ get: () => [...selectedTransactions.value], set: (value: string[]) => { selectedTransactions.value = new Set(value) } })
const bankMoney = (value: string | bigint | null) => value == null ? '' : formatPresentationMoney(value.toString(), { currency: ledgerPresentation.currency(current.value?.currency_code), locale: locale.value, unit: 'minor', numberingSystem: 'latn' })
const bankView = computed<BsBankReconciliationView>(() => ({ context: ledgerPresentation.context(current.value?.statement_start, current.value?.statement_end), contextLabel: t('pageContext.label'), canRead: can('bank.read'), canImport: can('bank.import'), readOnly: readOnly.value, failed: Boolean(error.value), pending: pending.value, saving: saving.value, dirty: dirty.value, formError: formError.value, formTitle: t(`bank.dialogs.${action.mode}`), importForm: action.mode === 'import', correctionForm: action.mode === 'correct', adjustmentForm: action.mode === 'adjust', reasonField: action.mode !== 'import', current: current.value ? { title: current.value.file_name, detail: `${current.value.statement_start} — ${current.value.statement_end} · ${current.value.currency_code} · ${t(`bank.statuses.${current.value.status}`)}`, canComplete: current.value.status !== 'completed' && can('bank.complete'), canReopen: current.value.status === 'completed' && can('bank.reopen'), editable: current.value.status !== 'completed', mismatch: Boolean(current.value.import_errors.length) } : null, equation: data.value?.equation ? { statement: bankMoney(data.value.equation.statement_minor), outstanding: bankMoney(data.value.equation.outstanding_minor), ledger: bankMoney(data.value.equation.ledger_minor), difference: bankMoney(data.value.equation.difference_minor) } : null, states: stateSummary.value.map(summary => ({ ...summary, label: t(`bank.lineStatuses.${summary.status}`), amount: bankMoney(summary.amount) })), lines: (data.value?.lines ?? []).map(row => ({ id: row.id, date: row.date ?? '', description: row.description, reference: row.external_reference ?? '', amount: bankMoney(row.amount_minor), status: row.status, statusLabel: t(`bank.lineStatuses.${row.status}`), error: row.validation_error ? t(`bank.validation.${row.validation_error}`) : '', selectable: row.status === 'unmatched' && !row.validation_error && current.value?.status !== 'completed', selectionLabel: t('bank.selectLine', { row: row.source_row }), canCorrect: can('bank.import') && row.status !== 'matched', canAdjust: can('bank.adjust') && row.status === 'unmatched' && !row.validation_error })), candidates: (data.value?.candidates ?? []).map(row => ({ id: row.id, date: row.date, description: row.description, reference: row.reference ?? '', amount: bankMoney(row.effect_minor), selectable: current.value?.status !== 'completed', selectionLabel: t('bank.selectTransaction', { reference: row.reference || row.description }), canOutstanding: can('bank.match') && current.value?.status !== 'completed' })), lineTotal: bankMoney(lineTotal.value), transactionTotal: bankMoney(transactionTotal.value), canMatch: can('bank.match'), matchDisabled: !exact.value || saving.value || readOnly.value, outstanding: (data.value?.outstanding ?? []).filter(row => row.active).map(row => ({ id: row.id, journal: row.transaction_id, reason: row.reason, amount: bankMoney(row.bank_effect_minor), canRemove: can('bank.match') && current.value?.status !== 'completed' })), matches: (data.value?.matches ?? []).map(row => ({ id: row.id, date: row.matched_at, amount: bankMoney(row.statement_total_minor), statusLabel: t(row.active ? 'bank.active' : 'bank.unmatched'), reason: row.unmatch_reason ?? '', canUnmatch: row.active && can('bank.match') && current.value?.status !== 'completed' })), events: (data.value?.events ?? []).map(event => ({ id: String(event.id), time: event.occurred_at, label: t(`bank.events.${event.event_type}`), reason: event.reason ?? '' })) }))
const bankChoices = computed<BsBankReconciliationChoices>(() => ({ reconciliations: (data.value?.reconciliations ?? []).map(item => ({ value: item.id, label: `${item.file_name} · ${item.statement_end} · ${t(`bank.statuses.${item.status}`)}` })), banks: bankAccounts.value.map(account => ({ value: account.id, label: `${account.name} · ${account.currency}` })), offsets: offsetAccounts.value.map(account => ({ value: account.id, label: account.name })) }))
function beginBank(mode: string, id: string) {
  if (!['import','adjust','correct','unmatch','outstanding','removeOutstanding','reopen'].includes(mode)) return
  const target = mode === 'correct' || mode === 'adjust' ? data.value?.lines.find(row => row.id === id) : mode === 'unmatch' ? data.value?.matches.find(row => row.id === id) : mode === 'outstanding' ? data.value?.candidates.find(row => row.id === id) : mode === 'removeOutstanding' ? data.value?.outstanding.find(row => row.id === id) : null
  begin(mode as typeof action.mode, target ?? null)
}
function bankFile(file: File | null) { action.file = file }
</script>
<template>
  <BsBankReconciliationPage v-model:selected-id="selectedId" v-model:selected-lines="bankLineSelection" v-model:selected-transactions="bankTransactionSelection" v-model:visible="visible" v-model:form="bankForm" :copy="bankCopy" :view="bankView" :choices="bankChoices" @download="downloadTemplate" @reload="load" @begin="beginBank" @match="matchSelected" @complete="completeReconciliation" @save="save" @file="bankFile" />
</template>
