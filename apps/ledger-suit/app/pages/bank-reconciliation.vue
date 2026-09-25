<script setup lang="ts">
import { bankStatementTemplate, minorToDecimalInput, parseBankStatementCsv, selectedMinorTotal } from '~/utils/bankReconciliation'
import type { BankCandidate, BankMatch, BankOutstanding, BankStatementLine } from '~/utils/bankReconciliation'

definePageMeta({ layout: 'default' })
const { t } = useI18n()
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
function toggle(kind: 'line' | 'transaction', id: string, checked: boolean) { const selection = kind === 'line' ? selectedLines : selectedTransactions; const next = new Set(selection.value); if (checked) next.add(id); else next.delete(id); selection.value = next }
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
</script>

<template>
  <div class="space-y-6">
    <header class="flex flex-wrap items-start justify-between gap-3"><div><h1 class="text-h1 font-bold">{{ t('bank.title') }}</h1><p class="mt-2 text-fg-muted">{{ t('bank.policy') }}</p></div><div class="flex gap-2"><button v-if="can('bank.import')" class="ls-btn" :disabled="readOnly" @click="begin('import')">{{ t('bank.import') }}</button><button class="ls-btn" @click="downloadTemplate">{{ t('bank.template') }}</button></div></header>
    <p v-if="!can('bank.read')" role="status" class="ls-card p-5">{{ t('bank.denied') }}</p>
    <template v-else>
      <div v-if="data?.reconciliations.length" class="ls-card p-5"><FloatingField :label="t('bank.reconciliation')"><select id="bank-reconciliation" v-model="selectedId" class="ls-input"><option v-for="item in data.reconciliations" :key="item.id" :value="item.id">{{ item.file_name }} · {{ item.statement_end }} · {{ t(`bank.statuses.${item.status}`) }}</option></select></FloatingField></div>
      <p v-if="error" class="ls-error" role="alert">{{ t('bank.errors.load') }} <button class="ls-btn" @click="load">{{ t('bank.retry') }}</button></p>
      <SectionSkeleton v-else-if="pending" variant="table" :rows="5" />
      <EmptyState v-else-if="!current" :title="t('bank.empty')" :description="t('bank.emptyHint')" />
      <template v-else-if="data">
        <section class="ls-card p-5"><div class="flex flex-wrap items-center justify-between gap-3"><div><h2 class="text-h2 font-bold">{{ current.file_name }}</h2><p>{{ current.statement_start }} — {{ current.statement_end }} · {{ current.currency_code }} · {{ t(`bank.statuses.${current.status}`) }}</p></div><div class="flex gap-2"><button v-if="current.status !== 'completed' && can('bank.complete')" class="ls-btn ls-btn-primary" :disabled="readOnly || saving" @click="completeReconciliation">{{ t('bank.complete') }}</button><button v-if="current.status === 'completed' && can('bank.reopen')" class="ls-btn" :disabled="readOnly" @click="begin('reopen')">{{ t('bank.reopen') }}</button></div></div><p v-if="current.import_errors.length" class="ls-error mt-3">{{ t('bank.statementMismatch') }}</p></section>
        <section class="ls-card p-5" aria-labelledby="bank-equation"><h2 id="bank-equation" class="text-h2 font-bold">{{ t('bank.equation') }}</h2><p class="text-sm text-fg-muted">{{ t('bank.equationPolicy') }}</p><dl v-if="data.equation" class="mt-4 grid gap-4 sm:grid-cols-4"><div><dt>{{ t('bank.statementBalance') }}</dt><dd><MoneyText :amount-minor="data.equation.statement_minor" :currency="current.currency_code" /></dd></div><div><dt>{{ t('bank.outstandingTotal') }}</dt><dd><MoneyText :amount-minor="data.equation.outstanding_minor" :currency="current.currency_code" /></dd></div><div><dt>{{ t('bank.ledgerBalance') }}</dt><dd><MoneyText :amount-minor="data.equation.ledger_minor" :currency="current.currency_code" /></dd></div><div><dt>{{ t('bank.difference') }}</dt><dd data-bank-difference><MoneyText :amount-minor="data.equation.difference_minor" :currency="current.currency_code" /></dd></div></dl></section>
        <section class="ls-card overflow-hidden"><h2 class="p-4 text-h2 font-bold">{{ t('bank.statementLines') }}</h2><dl class="grid gap-3 border-y border-line p-4 sm:grid-cols-3"><div v-for="summary in stateSummary" :key="summary.status" :data-bank-state-total="summary.status"><dt>{{ t(`bank.lineStatuses.${summary.status}`) }} · {{ summary.count }}</dt><dd><MoneyText :amount-minor="summary.amount" :currency="current.currency_code" /></dd></div></dl><BsDataTable :value="data.lines" data-key="id" :table-props="{ 'aria-label': t('bank.statementLines') }"><template #empty>{{ t('bank.noLines') }}</template><Column :header="t('bank.select')"><template #body="{ data: row }"><input v-if="row.status === 'unmatched' && !row.validation_error && current.status !== 'completed'" type="checkbox" :aria-label="t('bank.selectLine', { row: row.source_row })" :checked="selectedLines.has(row.id)" @change="toggle('line', row.id, ($event.target as HTMLInputElement).checked)"></template></Column><Column field="date" :header="t('bank.date')" /><Column field="description" :header="t('bank.description')" /><Column field="external_reference" :header="t('bank.reference')" /><Column :header="t('bank.amount')"><template #body="{ data: row }"><MoneyText v-if="row.amount_minor" :amount-minor="row.amount_minor" :currency="current.currency_code" /></template></Column><Column :header="t('bank.state')"><template #body="{ data: row }"><span :data-bank-state="row.status">{{ t(`bank.lineStatuses.${row.status}`) }}</span><p v-if="row.validation_error" class="text-xs text-danger">{{ t(`bank.validation.${row.validation_error}`) }}</p></template></Column><Column :header="t('bank.actions')"><template #body="{ data: row }"><div v-if="current.status !== 'completed'" class="flex gap-1"><button v-if="can('bank.import') && row.status !== 'matched'" class="ls-btn" @click="begin('correct', row)">{{ t('bank.correct') }}</button><button v-if="can('bank.adjust') && row.status === 'unmatched' && !row.validation_error" class="ls-btn" @click="begin('adjust', row)">{{ t('bank.adjust') }}</button></div></template></Column></BsDataTable></section>
        <section class="ls-card overflow-hidden"><h2 class="p-4 text-h2 font-bold">{{ t('bank.ledgerCandidates') }}</h2><BsDataTable :value="data.candidates" data-key="id" :table-props="{ 'aria-label': t('bank.ledgerCandidates') }"><template #empty>{{ t('bank.noCandidates') }}</template><Column :header="t('bank.select')"><template #body="{ data: row }"><input v-if="current.status !== 'completed'" type="checkbox" :aria-label="t('bank.selectTransaction', { reference: row.reference || row.description })" :checked="selectedTransactions.has(row.id)" @change="toggle('transaction', row.id, ($event.target as HTMLInputElement).checked)"></template></Column><Column field="date" :header="t('bank.date')" /><Column field="description" :header="t('bank.description')" /><Column field="reference" :header="t('bank.reference')" /><Column :header="t('bank.amount')"><template #body="{ data: row }"><MoneyText :amount-minor="row.effect_minor" :currency="current.currency_code" /></template></Column><Column :header="t('bank.actions')"><template #body="{ data: row }"><button v-if="can('bank.match') && current.status !== 'completed'" class="ls-btn" @click="begin('outstanding', row)">{{ t('bank.markOutstanding') }}</button></template></Column></BsDataTable><div v-if="current.status !== 'completed'" class="flex flex-wrap items-center justify-between gap-3 border-t border-line p-4"><p>{{ t('bank.selectedTotals') }}: <MoneyText :amount-minor="lineTotal" :currency="current.currency_code" /> = <MoneyText :amount-minor="transactionTotal" :currency="current.currency_code" /></p><button v-if="can('bank.match')" class="ls-btn ls-btn-primary" :disabled="!exact || saving || readOnly" @click="matchSelected">{{ t('bank.matchExact') }}</button></div></section>
        <section class="ls-card overflow-hidden"><h2 class="p-4 text-h2 font-bold">{{ t('bank.outstanding') }}</h2><BsDataTable :value="data.outstanding.filter(item => item.active)" data-key="id" :table-props="{ 'aria-label': t('bank.outstanding') }"><template #empty>{{ t('bank.noOutstanding') }}</template><Column field="transaction_id" :header="t('bank.journal')" /><Column field="reason" :header="t('bank.reason')" /><Column :header="t('bank.amount')"><template #body="{ data: row }"><MoneyText :amount-minor="row.bank_effect_minor" :currency="current.currency_code" /></template></Column><Column :header="t('bank.actions')"><template #body="{ data: row }"><button v-if="can('bank.match') && current.status !== 'completed'" class="ls-btn" @click="begin('removeOutstanding', row)">{{ t('bank.remove') }}</button></template></Column></BsDataTable></section>
        <section class="ls-card overflow-hidden"><h2 class="p-4 text-h2 font-bold">{{ t('bank.matchHistory') }}</h2><BsDataTable :value="data.matches" data-key="id" :table-props="{ 'aria-label': t('bank.matchHistory') }"><template #empty>{{ t('bank.noMatches') }}</template><Column field="matched_at" :header="t('bank.date')" /><Column :header="t('bank.amount')"><template #body="{ data: row }"><MoneyText :amount-minor="row.statement_total_minor" :currency="current.currency_code" /></template></Column><Column :header="t('bank.state')"><template #body="{ data: row }">{{ row.active ? t('bank.active') : t('bank.unmatched') }}<p>{{ row.unmatch_reason }}</p></template></Column><Column :header="t('bank.actions')"><template #body="{ data: row }"><button v-if="row.active && can('bank.match') && current.status !== 'completed'" class="ls-btn" @click="begin('unmatch', row)">{{ t('bank.unmatch') }}</button></template></Column></BsDataTable></section>
        <details class="ls-card p-4"><summary class="cursor-pointer font-bold">{{ t('bank.auditHistory') }}</summary><ol class="mt-3 space-y-2"><li v-for="event in data.events" :key="event.id"><time>{{ event.occurred_at }}</time> · {{ t(`bank.events.${event.event_type}`) }}<span v-if="event.reason"> · {{ event.reason }}</span></li></ol></details>
      </template>
    </template>
    <BsDialog v-model:visible="visible" :title="t(`bank.dialogs.${action.mode}`)" :pending="saving" :dirty="dirty" size="lg"><template #default="{ close }"><form class="space-y-4 p-5" @submit.prevent="save"><p v-if="formError" class="ls-error" role="alert">{{ formError }}</p>
      <template v-if="action.mode === 'import'"><FloatingField :label="t('bank.bankAccount')"><select id="bank-account" v-model="action.account" class="ls-input" required><option v-for="account in bankAccounts" :key="account.id" :value="account.id">{{ account.name }} · {{ account.currency }}</option></select></FloatingField><FloatingField :label="t('bank.file')"><input id="bank-file" class="ls-input" type="file" accept=".csv,text/csv" required @change="action.file = ($event.target as HTMLInputElement).files?.[0] ?? null"></FloatingField><div class="grid gap-3 sm:grid-cols-2"><FloatingField :label="t('bank.start')"><input id="bank-start" v-model="action.start" class="ls-input" type="date" required></FloatingField><FloatingField :label="t('bank.end')"><input id="bank-end" v-model="action.end" class="ls-input" type="date" :min="action.start" required></FloatingField><FloatingField :label="t('bank.opening')"><input id="bank-opening" v-model="action.opening" class="ls-input" inputmode="decimal" required></FloatingField><FloatingField :label="t('bank.closing')"><input id="bank-closing" v-model="action.closing" class="ls-input" inputmode="decimal" required></FloatingField></div></template>
      <template v-if="action.mode === 'correct'"><FloatingField :label="t('bank.date')"><input id="bank-correct-date" v-model="action.date" class="ls-input" type="date" required></FloatingField><FloatingField :label="t('bank.amount')"><input id="bank-correct-amount" v-model="action.amount" class="ls-input" required></FloatingField><FloatingField :label="t('bank.description')"><input id="bank-correct-description" v-model="action.description" class="ls-input" required></FloatingField><FloatingField :label="t('bank.reference')"><input id="bank-correct-reference" v-model="action.reference" class="ls-input"></FloatingField></template>
      <FloatingField v-if="action.mode === 'adjust'" :label="t('bank.offsetAccount')"><select id="bank-offset" v-model="action.offset" class="ls-input" required><option value="" /><option v-for="account in offsetAccounts" :key="account.id" :value="account.id">{{ account.name }}</option></select></FloatingField>
      <FloatingField v-if="action.mode !== 'import'" :label="t('bank.reason')"><input id="bank-reason" v-model="action.reason" class="ls-input" required></FloatingField><div class="flex justify-end gap-2"><button type="button" class="ls-btn" @click="close">{{ t('common.cancel') }}</button><button type="submit" class="ls-btn ls-btn-primary" :disabled="saving || readOnly">{{ t('common.save') }}</button></div></form></template></BsDialog>
  </div>
</template>
