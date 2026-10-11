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
const ledgerPresentation = useLedgerPresentation()
</script>

<template>
  <BsStack gap="lg">
    <BsPageHeader
      :title="t('bank.title')"
      :subtitle="t('bank.policy')"
      :context="ledgerPresentation.context(current?.statement_start, current?.statement_end, undefined)"
      :context-label="ledgerPresentation.t('pageContext.label')"
    >
      <template #actions>
        <BsButton v-if="can('bank.import')" type="submit" :disabled="readOnly" @click="begin('import')">{{ t('bank.import') }}</BsButton>
        <BsButton type="submit" @click="downloadTemplate">{{ t('bank.template') }}</BsButton>
      </template>
    </BsPageHeader>
    <BsText v-if="!can('bank.read')" role="status">{{ t('bank.denied') }}</BsText>
    <template v-else>
      <BsCard v-if="data?.reconciliations.length" as="div" padding="md">
        <BsFloatingField :label="t('bank.reconciliation')">
          <BsSelect id="bank-reconciliation" v-model="selectedId" native>
            <BsSelectOption v-for="item in data.reconciliations" :key="item.id" :value="item.id">{{ item.file_name }} · {{ item.statement_end }} · {{ t(`bank.statuses.${item.status}`) }}</BsSelectOption>
          </BsSelect>
        </BsFloatingField>
      </BsCard>
      <BsText v-if="error" role="alert" tone="danger">{{ t('bank.errors.load') }} <BsButton type="submit" @click="load">{{ t('bank.retry') }}</BsButton></BsText>
      <BsSectionSkeleton v-else-if="pending" variant="table" :rows="5" />
      <BsEmptyState v-else-if="!current" :title="t('bank.empty')" :description="t('bank.emptyHint')" />
      <template v-else-if="data">
        <BsCard as="section" padding="md">
          <BsInline gap="md" :wrap="true" justify="between">
            <BsBox>
              <BsHeading :level="2" size="h2">{{ current.file_name }}</BsHeading>
              <BsText>{{ current.statement_start }} — {{ current.statement_end }} · {{ current.currency_code }} · {{ t(`bank.statuses.${current.status}`) }}</BsText>
            </BsBox>
            <BsInline gap="sm" :wrap="false">
              <BsButton
                v-if="current.status !== 'completed' && can('bank.complete')"
                type="submit"
                :disabled="readOnly || saving"
                variant="primary"
                @click="completeReconciliation"
              >{{ t('bank.complete') }}</BsButton>
              <BsButton v-if="current.status === 'completed' && can('bank.reopen')" type="submit" :disabled="readOnly" @click="begin('reopen')">{{ t('bank.reopen') }}</BsButton>
            </BsInline>
          </BsInline>
          <BsText v-if="current.import_errors.length" tone="danger">{{ t('bank.statementMismatch') }}</BsText>
        </BsCard>
        <BsCard aria-labelledby="bank-equation" as="section" padding="md">
          <BsHeading id="bank-equation" :level="2" size="h2">{{ t('bank.equation') }}</BsHeading>
          <BsText size="sm" tone="muted">{{ t('bank.equationPolicy') }}</BsText>
          <BsDescriptionList v-if="data.equation" :columns="3">
            <BsBox>
              <BsDescriptionTerm>{{ t('bank.statementBalance') }}</BsDescriptionTerm>
              <BsDescriptionValue>
                <BsMoneyText :amount="data.equation.statement_minor" :currency="ledgerPresentation.currency(current.currency_code)" :locale="ledgerPresentation.locale" />
              </BsDescriptionValue>
            </BsBox>
            <BsBox>
              <BsDescriptionTerm>{{ t('bank.outstandingTotal') }}</BsDescriptionTerm>
              <BsDescriptionValue>
                <BsMoneyText
                  :amount="data.equation.outstanding_minor"
                  :currency="ledgerPresentation.currency(current.currency_code)"
                  :locale="ledgerPresentation.locale"
                />
              </BsDescriptionValue>
            </BsBox>
            <BsBox>
              <BsDescriptionTerm>{{ t('bank.ledgerBalance') }}</BsDescriptionTerm>
              <BsDescriptionValue>
                <BsMoneyText :amount="data.equation.ledger_minor" :currency="ledgerPresentation.currency(current.currency_code)" :locale="ledgerPresentation.locale" />
              </BsDescriptionValue>
            </BsBox>
            <BsBox>
              <BsDescriptionTerm>{{ t('bank.difference') }}</BsDescriptionTerm>
              <BsDescriptionValue data-bank-difference>
                <BsMoneyText :amount="data.equation.difference_minor" :currency="ledgerPresentation.currency(current.currency_code)" :locale="ledgerPresentation.locale" />
              </BsDescriptionValue>
            </BsBox>
          </BsDescriptionList>
        </BsCard>
        <BsCard as="section" padding="none" overflow="hidden">
          <BsHeading :level="2" size="h2">{{ t('bank.statementLines') }}</BsHeading>
          <BsDescriptionList :columns="3">
            <BsBox v-for="summary in stateSummary" :key="summary.status" :data-bank-state-total="summary.status">
              <BsDescriptionTerm>{{ t(`bank.lineStatuses.${summary.status}`) }} · {{ summary.count }}</BsDescriptionTerm>
              <BsDescriptionValue>
                <BsMoneyText :amount="summary.amount" :currency="ledgerPresentation.currency(current.currency_code)" :locale="ledgerPresentation.locale" />
              </BsDescriptionValue>
            </BsBox>
          </BsDescriptionList>
          <BsDataTable
            :value="data.lines"
            row-key="id"
            :label="t('bank.statementLines')"
            :columns="[{ key: 'column1', header: t('bank.select') }, { key: 'date', field: 'date', header: t('bank.date') }, { key: 'description', field: 'description', header: t('bank.description') }, { key: 'external_reference', field: 'external_reference', header: t('bank.reference') }, { key: 'column5', header: t('bank.amount') }, { key: 'column6', header: t('bank.state') }, { key: 'column7', header: t('bank.actions') }]"
          >
            <template #empty>{{ t('bank.noLines') }}</template>
            <template #cell-column1="{ row }">
              <BsCheckbox
                v-if="row.status === 'unmatched' && !row.validation_error && current.status !== 'completed'"
                :aria-label="t('bank.selectLine', { row: row.source_row })"
                :checked="selectedLines.has(row.id)"
                bare
                @native-change="toggle('line', row.id, ($event.target as HTMLInputElement).checked)"
              />
            </template>
            <template #cell-column5="{ row }">
              <BsMoneyText
                v-if="row.amount_minor"
                :amount="row.amount_minor"
                :currency="ledgerPresentation.currency(current.currency_code)"
                :locale="ledgerPresentation.locale"
              />
            </template>
            <template #cell-column6="{ row }">
              <BsText :data-bank-state="row.status" as="span">{{ t(`bank.lineStatuses.${row.status}`) }}</BsText>
              <BsText v-if="row.validation_error" size="xs" tone="danger">{{ t(`bank.validation.${row.validation_error}`) }}</BsText>
            </template>
            <template #cell-column7="{ row }">
              <BsInline v-if="current.status !== 'completed'" gap="xs" :wrap="false">
                <BsButton v-if="can('bank.import') && row.status !== 'matched'" type="submit" @click="begin('correct', row)">{{ t('bank.correct') }}</BsButton>
                <BsButton v-if="can('bank.adjust') && row.status === 'unmatched' && !row.validation_error" type="submit" @click="begin('adjust', row)">{{ t('bank.adjust') }}</BsButton>
              </BsInline>
            </template>
          </BsDataTable>
        </BsCard>
        <BsCard as="section" padding="none" overflow="hidden">
          <BsHeading :level="2" size="h2">{{ t('bank.ledgerCandidates') }}</BsHeading>
          <BsDataTable
            :value="data.candidates"
            row-key="id"
            :label="t('bank.ledgerCandidates')"
            :columns="[{ key: 'column1', header: t('bank.select') }, { key: 'date', field: 'date', header: t('bank.date') }, { key: 'description', field: 'description', header: t('bank.description') }, { key: 'reference', field: 'reference', header: t('bank.reference') }, { key: 'column5', header: t('bank.amount') }, { key: 'column6', header: t('bank.actions') }]"
          >
            <template #empty>{{ t('bank.noCandidates') }}</template>
            <template #cell-column1="{ row }">
              <BsCheckbox
                v-if="current.status !== 'completed'"
                :aria-label="t('bank.selectTransaction', { reference: row.reference || row.description })"
                :checked="selectedTransactions.has(row.id)"
                bare
                @native-change="toggle('transaction', row.id, ($event.target as HTMLInputElement).checked)"
              />
            </template>
            <template #cell-column5="{ row }">
              <BsMoneyText :amount="row.effect_minor" :currency="ledgerPresentation.currency(current.currency_code)" :locale="ledgerPresentation.locale" />
            </template>
            <template #cell-column6="{ row }">
              <BsButton v-if="can('bank.match') && current.status !== 'completed'" type="submit" @click="begin('outstanding', row)">{{ t('bank.markOutstanding') }}</BsButton>
            </template>
          </BsDataTable>
          <BsInline v-if="current.status !== 'completed'" gap="md" :wrap="true" justify="between" padding="lg">
            <BsText>{{ t('bank.selectedTotals') }}: <BsMoneyText :amount="lineTotal" :currency="ledgerPresentation.currency(current.currency_code)" :locale="ledgerPresentation.locale" /> = <BsMoneyText :amount="transactionTotal" :currency="ledgerPresentation.currency(current.currency_code)" :locale="ledgerPresentation.locale" /></BsText>
            <BsButton v-if="can('bank.match')" type="submit" :disabled="!exact || saving || readOnly" variant="primary" @click="matchSelected">{{ t('bank.matchExact') }}</BsButton>
          </BsInline>
        </BsCard>
        <BsCard as="section" padding="none" overflow="hidden">
          <BsHeading :level="2" size="h2">{{ t('bank.outstanding') }}</BsHeading>
          <BsDataTable
            :value="data.outstanding.filter(item => item.active)"
            row-key="id"
            :table-props="{ 'aria-label': t('bank.outstanding') }"
            :columns="[{ key: 'transaction_id', field: 'transaction_id', header: t('bank.journal') }, { key: 'reason', field: 'reason', header: t('bank.reason') }, { key: 'column3', header: t('bank.amount') }, { key: 'column4', header: t('bank.actions') }]"
          >
            <template #empty>{{ t('bank.noOutstanding') }}</template>
            <template #cell-column3="{ row }">
              <BsMoneyText :amount="row.bank_effect_minor" :currency="ledgerPresentation.currency(current.currency_code)" :locale="ledgerPresentation.locale" />
            </template>
            <template #cell-column4="{ row }">
              <BsButton v-if="can('bank.match') && current.status !== 'completed'" type="submit" @click="begin('removeOutstanding', row)">{{ t('bank.remove') }}</BsButton>
            </template>
          </BsDataTable>
        </BsCard>
        <BsCard as="section" padding="none" overflow="hidden">
          <BsHeading :level="2" size="h2">{{ t('bank.matchHistory') }}</BsHeading>
          <BsDataTable
            :value="data.matches"
            row-key="id"
            :label="t('bank.matchHistory')"
            :columns="[{ key: 'matched_at', field: 'matched_at', header: t('bank.date') }, { key: 'column2', header: t('bank.amount') }, { key: 'column3', header: t('bank.state') }, { key: 'column4', header: t('bank.actions') }]"
          >
            <template #empty>{{ t('bank.noMatches') }}</template>
            <template #cell-column2="{ row }">
              <BsMoneyText :amount="row.statement_total_minor" :currency="ledgerPresentation.currency(current.currency_code)" :locale="ledgerPresentation.locale" />
            </template>
            <template #cell-column3="{ row }">{{ row.active ? t('bank.active') : t('bank.unmatched') }}<BsText>{{ row.unmatch_reason }}</BsText></template>
            <template #cell-column4="{ row }">
              <BsButton v-if="row.active && can('bank.match') && current.status !== 'completed'" type="submit" @click="begin('unmatch', row)">{{ t('bank.unmatch') }}</BsButton>
            </template>
          </BsDataTable>
        </BsCard>
        <BsDisclosure>
          <template #summary>{{ t('bank.auditHistory') }}</template>
          <BsList :ordered="true" marker="none">
            <BsListItem v-for="event in data.events" :key="event.id"><BsText as="time">{{ event.occurred_at }}</BsText> · {{ t(`bank.events.${event.event_type}`) }}<BsText v-if="event.reason" as="span"> · {{ event.reason }}</BsText></BsListItem>
          </BsList>
        </BsDisclosure>
      </template>
    </template>
    <BsRecordActionDialog
      v-model:visible="visible"
      :title="t(`bank.dialogs.${action.mode}`)"
      :pending="saving"
      :dirty="dirty"
      :error="formError"
      size="lg"
      :submit-label="t('common.save')"
      :cancel-label="t('common.cancel')"
      :submit-disabled="readOnly"
      @submit="save"
    >
      <template v-if="action.mode === 'import'">
        <BsFloatingField :label="t('bank.bankAccount')">
          <BsSelect id="bank-account" v-model="action.account" required native>
            <BsSelectOption v-for="account in bankAccounts" :key="account.id" :value="account.id">{{ account.name }} · {{ account.currency }}</BsSelectOption>
          </BsSelect>
        </BsFloatingField>
        <BsFloatingField :label="t('bank.file')">
          <BsFileInput id="bank-file" accept=".csv,text/csv" required bare @change="action.file = ($event.target as HTMLInputElement).files?.[0] ?? null" />
        </BsFloatingField>
        <BsGrid :columns="2" gap="md">
          <BsFloatingField :label="t('bank.start')">
            <BsInput id="bank-start" v-model="action.start" type="date" required />
          </BsFloatingField>
          <BsFloatingField :label="t('bank.end')">
            <BsInput id="bank-end" v-model="action.end" type="date" :min="action.start" required />
          </BsFloatingField>
          <BsFloatingField :label="t('bank.opening')">
            <BsInput id="bank-opening" v-model="action.opening" inputmode="decimal" required />
          </BsFloatingField>
          <BsFloatingField :label="t('bank.closing')">
            <BsInput id="bank-closing" v-model="action.closing" inputmode="decimal" required />
          </BsFloatingField>
        </BsGrid>
      </template>
      <template v-if="action.mode === 'correct'">
        <BsFloatingField :label="t('bank.date')">
          <BsInput id="bank-correct-date" v-model="action.date" type="date" required />
        </BsFloatingField>
        <BsFloatingField :label="t('bank.amount')">
          <BsInput id="bank-correct-amount" v-model="action.amount" required />
        </BsFloatingField>
        <BsFloatingField :label="t('bank.description')">
          <BsInput id="bank-correct-description" v-model="action.description" required />
        </BsFloatingField>
        <BsFloatingField :label="t('bank.reference')">
          <BsInput id="bank-correct-reference" v-model="action.reference" />
        </BsFloatingField>
      </template>
      <BsFloatingField v-if="action.mode === 'adjust'" :label="t('bank.offsetAccount')">
        <BsSelect id="bank-offset" v-model="action.offset" required native>
          <BsSelectOption value="" />
          <BsSelectOption v-for="account in offsetAccounts" :key="account.id" :value="account.id">{{ account.name }}</BsSelectOption>
        </BsSelect>
      </BsFloatingField>
      <BsFloatingField v-if="action.mode !== 'import'" :label="t('bank.reason')">
        <BsInput id="bank-reason" v-model="action.reason" required />
      </BsFloatingField>
    </BsRecordActionDialog>
  </BsStack>
</template>
