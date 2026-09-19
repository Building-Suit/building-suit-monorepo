<script setup lang="ts">
import type { Database } from '~~/types/database.types'

const props = defineProps<{ accountId: string, scope: string }>()
const emit = defineEmits<{ close: [] }>()
const supabase = useSupabaseClient<Database>()
const { currentId } = useTenant()
const { t, locale } = useI18n()
const describeError = useErrorMessage()
interface Line { entry_id: string, transaction_id: string, entry_date: string, reference: string | null, description: string | null, memo: string | null, debit_minor: string, credit_minor: string, balance_minor: string }
interface Activity {
  account: { id: string, name: string, code: string | null, type: string, normal_balance: string, is_archived: boolean }
  currency: string, from_date: string, to_date: string, opening_minor: string, debit_minor: string, credit_minor: string, closing_minor: string, total: number, rows: Line[]
}
interface Journal {
  id: string, description: string | null, reference: string | null, date: string, type: string, status: string, currency: string,
  reverses_transaction_id: string | null, reversed_by_transaction_id: string | null, debit_minor: string, credit_minor: string,
  rows: Array<{ entry_id: string, account_id: string, account_name: string, account_code: string | null, memo: string | null, debit_minor: string, credit_minor: string, original_amount_minor: string, original_currency: string }>
}
interface Position { scroll?: number, focus?: string }
type View = ({ kind: 'account', id: string, from: string, to: string, offset: number, data?: Activity } | { kind: 'journal', id: string, data?: Journal }) & Position
const views = ref<View[]>([{ kind: 'account', id: props.accountId, from: '', to: '', offset: 0 }])
const current = computed(() => views.value.at(-1)!)
const activity = computed(() => current.value.kind === 'account' ? current.value.data : undefined)
const journal = computed(() => current.value.kind === 'journal' ? current.value.data : undefined)
const loading = ref(false)
const error = ref('')
const content = ref<HTMLElement>()
const heading = ref<HTMLElement>()
const pageSize = 25
const organizationId = currentId.value
const initialScope = props.scope
let disposed = false
let sequence = 0
let controller: AbortController | undefined
const isCurrent = (request: number) => !disposed && sequence === request && props.scope === initialScope && currentId.value === organizationId
const title = computed(() => current.value.kind === 'account' ? t('accountActivity.title') : t('accountActivity.journal'))
const periodInvalid = computed(() => current.value.kind === 'account' && (!current.value.from || !current.value.to || current.value.from > current.value.to))
const cards = computed(() => activity.value ? [
  { key: 'opening', amount: activity.value.opening_minor, signed: true },
  { key: 'debits', amount: activity.value.debit_minor, signed: false },
  { key: 'credits', amount: activity.value.credit_minor, signed: false },
  { key: 'closing', amount: activity.value.closing_minor, signed: true },
] : [])

async function load(force = false) {
  const view = current.value
  controller?.abort()
  controller = new AbortController()
  const request = ++sequence
  error.value = ''
  loading.value = false
  if (!organizationId || (view.data && !force)) return
  loading.value = true
  try {
    const result = view.kind === 'account'
      ? await supabase.rpc('read_account_activity', { p_organization_id: organizationId, p_account_id: view.id, p_from_date: view.from || undefined, p_to_date: view.to || undefined, p_offset: view.offset, p_limit: pageSize }).abortSignal(controller.signal)
      : await supabase.rpc('read_activity_journal', { p_organization_id: organizationId, p_transaction_id: view.id }).abortSignal(controller.signal)
    if (!isCurrent(request)) return
    if (result.error) throw result.error
    if (view.kind === 'account') {
      view.data = result.data as unknown as Activity
      view.from = view.data.from_date
      view.to = view.data.to_date
    }
    else view.data = result.data as unknown as Journal
  }
  catch (failure) { if (isCurrent(request)) error.value = describeError(failure) }
  finally { if (isCurrent(request)) loading.value = false }
}
onMounted(() => load())
onBeforeUnmount(() => { disposed = true; ++sequence; controller?.abort() })

function remember(focus: string) {
  current.value.scroll = content.value?.parentElement?.scrollTop ?? 0
  current.value.focus = focus
}
async function openJournal(id: string, entryId: string) {
  remember(`entry-${entryId}`)
  views.value.push({ kind: 'journal', id })
  await load()
  await nextTick()
  if (!disposed && current.value.kind === 'journal' && current.value.id === id) heading.value?.focus()
}
async function openAccount(id: string, entryId: string) {
  remember(`account-${entryId}`)
  const previous = [...views.value].reverse().find(view => view.kind === 'account')
  views.value.push({ kind: 'account', id, from: previous?.kind === 'account' ? previous.from : '', to: previous?.kind === 'account' ? previous.to : '', offset: 0 })
  await load()
  await nextTick()
  if (!disposed && current.value.kind === 'account' && current.value.id === id) heading.value?.focus()
}
async function back() {
  if (views.value.length < 2) return
  views.value.pop()
  await load()
  await nextTick()
  const view = current.value
  content.value?.querySelector<HTMLElement>(`[data-nav-id="${view.focus}"]`)?.focus({ preventScroll: true })
  if (content.value?.parentElement) content.value.parentElement.scrollTop = view.scroll ?? 0
}
async function applyPeriod() {
  if (current.value.kind !== 'account' || periodInvalid.value) return
  current.value.offset = 0
  await load(true)
}
async function page(offset: number) {
  if (current.value.kind !== 'account') return
  current.value.offset = offset
  await load(true)
}
</script>

<template>
  <BsDialog :visible="true" :title="title" size="lg" @update:visible="value => { if (!value) emit('close') }">
    <div ref="content" class="min-w-0 space-y-5">
      <button v-if="views.length > 1" type="button" class="ls-btn ls-btn-sm" @click="back"><span class="rotate-180"><AppIcon name="arrowRight" directional :size="16" /></span>{{ t('accountActivity.back') }}</button>
      <h2 ref="heading" tabindex="-1" class="break-words text-xl font-bold outline-none">{{ activity?.account.name || journal?.description || title }}</h2>
      <template v-if="current.kind === 'account'">
        <div v-if="activity" class="flex flex-wrap items-center gap-2 text-sm text-fg-muted">
          <span v-if="activity.account.code" class="ls-badge bg-surface-muted">{{ activity.account.code }}</span>
          <span>{{ t(`accounts.groups.${activity.account.type}`) }}</span>
          <span v-if="activity.account.is_archived" class="ls-badge bg-surface-muted">{{ t('accounts.archived') }}</span>
          <span>{{ t('accountActivity.baseCurrency', { currency: activity.currency }) }}</span>
        </div>
        <form class="grid grid-cols-2 items-end gap-3 sm:flex sm:flex-wrap" @submit.prevent="applyPeriod">
          <FloatingField class="min-w-0" :label="t('reports.from')"><input id="activity-from" v-model="current.from" type="date" class="ls-input" required :disabled="loading"></FloatingField>
          <FloatingField class="min-w-0" :label="t('reports.to')"><input id="activity-to" v-model="current.to" type="date" class="ls-input" required :min="current.from" :disabled="loading"></FloatingField>
          <button class="ls-btn ls-btn-primary col-span-2" type="submit" :disabled="loading || periodInvalid">{{ t('accountActivity.apply') }}</button>
        </form>
      </template>
      <p v-if="error" role="alert" class="ls-error">{{ error }} <button type="button" class="ls-btn ls-btn-sm" @click="load(true)">{{ t('accounts.retry') }}</button></p>
      <SectionSkeleton v-if="loading" variant="table" :rows="5" />
      <template v-else-if="!error && activity">
        <p class="text-sm text-fg-muted">{{ t('accountActivity.period', { from: formatDate(activity.from_date, locale), to: formatDate(activity.to_date, locale) }) }}</p>
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div v-for="card in cards" :key="card.key" class="ls-card-flat min-w-0 p-3" :data-testid="`activity-${card.key}`">
            <p class="text-xs text-fg-muted">{{ t(`accountActivity.${card.key}`) }}</p>
            <p class="mt-2 break-words text-base font-bold"><MoneyText :amount-minor="card.signed ? accountBalanceDisplay(card.amount).amount : card.amount" :currency="activity.currency" /></p>
            <p v-if="card.signed" class="mt-1 text-xs text-fg-muted">{{ t(`accounts.sides.${accountBalanceDisplay(card.amount).side}`) }}</p>
          </div>
        </div>
        <p v-if="!activity.total" class="rounded-control bg-surface-muted p-5 text-sm">{{ t('accountActivity.empty') }}</p>
        <div v-else class="overflow-x-auto">
          <BsDataTable :label="t('accountActivity.title')" :value="activity.rows" data-key="entry_id">
            <Column :header="t('transactions.date')"><template #body="{ data: row }"><span class="whitespace-nowrap">{{ formatDate(row.entry_date, locale) }}</span></template></Column>
            <Column :header="t('transactions.description')"><template #body="{ data: row }"><button type="button" class="text-start font-medium text-link hover:underline" :data-nav-id="`entry-${row.entry_id}`" @click="openJournal(row.transaction_id, row.entry_id)">{{ row.description || t('accountActivity.journal') }}</button><p v-if="row.reference || row.memo" class="mt-1 text-xs text-fg-muted">{{ row.reference || row.memo }}</p></template></Column>
            <Column :header="t('detail.debit')" body-class="ls-num whitespace-nowrap"><template #body="{ data: row }"><MoneyText :amount-minor="row.debit_minor" :currency="activity.currency" /></template></Column>
            <Column :header="t('detail.credit')" body-class="ls-num whitespace-nowrap"><template #body="{ data: row }"><MoneyText :amount-minor="row.credit_minor" :currency="activity.currency" /></template></Column>
            <Column :header="t('accountActivity.running')" body-class="ls-num whitespace-nowrap"><template #body="{ data: row }"><MoneyText :amount-minor="accountBalanceDisplay(row.balance_minor).amount" :currency="activity.currency" /><span class="ms-1 text-xs text-fg-muted">{{ t(`accounts.sides.${accountBalanceDisplay(row.balance_minor).side}`) }}</span></template></Column>
          </BsDataTable>
          <nav v-if="current.kind === 'account'" :aria-label="t('accountActivity.pages')" class="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
            <button type="button" class="ls-btn ls-btn-sm" :disabled="current.offset === 0" @click="page(Math.max(0, current.offset - pageSize))">{{ t('accounts.previousPage') }}</button>
            <span>{{ t('accountActivity.showing', { from: current.offset + 1, to: Math.min(current.offset + pageSize, activity.total), total: activity.total }) }}</span>
            <button type="button" class="ls-btn ls-btn-sm" :disabled="current.offset + pageSize >= activity.total" @click="page(current.offset + pageSize)">{{ t('accounts.nextPage') }}</button>
          </nav>
        </div>
      </template>
      <template v-else-if="!error && journal">
        <div class="flex flex-wrap gap-3 text-sm text-fg-muted"><span>{{ formatDate(journal.date, locale) }}</span><span v-if="journal.reference">{{ journal.reference }}</span><span>{{ t(`types.${journal.type}`) }}</span><span class="ls-badge bg-surface-muted">{{ t(`status.${journal.status}`) }}</span></div>
        <p v-if="journal.reverses_transaction_id || journal.reversed_by_transaction_id" class="rounded-control bg-surface-muted p-3 text-sm">{{ t('accountActivity.reversal') }}</p>
        <p class="text-sm text-fg-muted">{{ t('accountActivity.journalHint', { currency: journal.currency }) }}</p>
        <div class="overflow-x-auto"><BsDataTable :label="t('accountActivity.journal')" :value="journal.rows" data-key="entry_id">
          <Column :header="t('detail.account')"><template #body="{ data: row }"><button type="button" class="text-start font-medium text-link hover:underline" :data-nav-id="`account-${row.entry_id}`" @click="openAccount(row.account_id, row.entry_id)">{{ row.account_name }}</button><p class="mt-1 text-xs text-fg-muted">{{ row.account_code }}<span v-if="row.memo"> · {{ row.memo }}</span></p><p v-if="row.original_currency !== journal.currency" class="text-xs text-fg-muted"><MoneyText :amount-minor="row.original_amount_minor" :currency="row.original_currency" /></p></template></Column>
          <Column :header="t('detail.debit')" body-class="ls-num whitespace-nowrap"><template #body="{ data: row }"><MoneyText :amount-minor="row.debit_minor" :currency="journal.currency" /></template></Column>
          <Column :header="t('detail.credit')" body-class="ls-num whitespace-nowrap"><template #body="{ data: row }"><MoneyText :amount-minor="row.credit_minor" :currency="journal.currency" /></template></Column>
        </BsDataTable></div>
        <div class="flex flex-wrap justify-between gap-3 rounded-control bg-surface-muted p-4 font-semibold"><span>{{ t('accountActivity.balanced') }}</span><span>{{ t('detail.debit') }}: <MoneyText :amount-minor="journal.debit_minor" :currency="journal.currency" /></span><span>{{ t('detail.credit') }}: <MoneyText :amount-minor="journal.credit_minor" :currency="journal.currency" /></span></div>
      </template>
    </div>
  </BsDialog>
</template>
