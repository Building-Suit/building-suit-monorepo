<script setup lang="ts">
import { formatPresentationMoney } from '@building-suit/ui/utils/presentation'
import type { BsCommitmentActionForm, BsOperationalRecordsCopy, BsOperationalRecordsView } from '@building-suit/ui/types/operationalRecordsPresentation'
import { scopedQueryKey } from '@building-suit/data-access'
import type { Database } from '~~/types/database.types'

definePageMeta({
  layout: 'default',
  middleware: (to) => {
    const kind = String(to.params.kind)
    if ((ADD_FLOWS as readonly string[]).includes(kind)) return navigateTo({ path: '/transactions', query: { ...to.query, type: kind } }, { replace: true })
  },
})

type TransactionFlow = typeof ADD_FLOWS[number]
type OperationKind = 'commitments' | 'recurring' | 'counterparties' | 'tags'
type RecordKind = TransactionFlow | OperationKind | 'invitations'
type GenericRow = Record<string, unknown>
type TransactionRow = Database['public']['Functions']['search_transactions']['Returns'][number]

const route = useRoute()
const supabase = useSupabaseClient<Database>()
const user = useSupabaseUser()
const config = useRuntimeConfig()
const { currentId, baseCurrency, can, roleLabel } = useTenant()
const { writesAllowed } = useBilling()
const { start, revision: transactionRevision } = useAddTransaction()
const { show: showOperations, revision: operationRevision } = useOperationsCenter()
const { show: showInvitation, revision: invitationRevision } = useTeamInvitation()
const { t, locale } = useI18n()
const toasts = useToasts()
const describeError = useErrorMessage()
const { data: accounts } = useOrgAccounts()
const paymentAccounts = usePaymentAccounts(accounts)

const OPERATION_KINDS: OperationKind[] = ['commitments', 'recurring', 'counterparties', 'tags']
const VALID_KINDS: RecordKind[] = [...ADD_FLOWS, ...OPERATION_KINDS, 'invitations']
const kind = computed(() => String(route.params.kind) as RecordKind)

if (!VALID_KINDS.includes(kind.value)) {
  throw createError({ statusCode: 404, statusMessage: 'Page not found' })
}

// Preserve old bookmarks while replacing the invitation-only screen with the
// complete workspace access console.
if (kind.value === 'invitations') await navigateTo('/team', { replace: true })

const isTransaction = computed(() => (ADD_FLOWS as readonly string[]).includes(kind.value))
const title = computed(() => {
  if (isTransaction.value) return t(`add.flows.${kind.value}`)
  if (kind.value === 'invitations') return t('add.items.invitation')
  if (kind.value === 'commitments') return t('operations.tabs.commitments')
  if (kind.value === 'tags') return t('operations.tabs.tags')
  const itemKey = kind.value === 'counterparties' ? 'counterparty' : 'recurring'
  return t(`add.items.${itemKey}`)
})

useHead({ title: () => `${title.value} · ${t('app.name')}` })

const dataKey = computed(() => `org:${scopedQueryKey({
  environment: String(config.public.supabase.url), portal: 'ledger-suit',
  userId: user.value?.id ?? '', tenantId: currentId.value ?? '',
}, `record-page:${kind.value}`)}`)
const { data: rows, pending, error: loadError, refresh } = useLazyAsyncData<Array<TransactionRow | GenericRow>>(dataKey, async () => {
  if (!currentId.value) return []

  if (isTransaction.value) {
    const { data, error } = await supabase.rpc('search_transactions', {
      p_organization_id: currentId.value,
      p_types: [kind.value as TransactionFlow],
      p_sort: 'transaction_date',
      p_direction: 'desc',
      p_limit: 100,
      p_offset: 0,
    })
    if (error) throw error
    return (data ?? []) as TransactionRow[]
  }

  if (kind.value === 'commitments') {
    const { data, error } = await supabase.from('commitment_states').select('*').eq('organization_id', currentId.value).order('due_date')
    if (error) throw error
    return (data ?? []) as GenericRow[]
  }
  if (kind.value === 'recurring') {
    const { data, error } = await supabase.from('recurring_rules').select('*').eq('organization_id', currentId.value).order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as GenericRow[]
  }
  if (kind.value === 'counterparties') {
    const { data, error } = await supabase.from('counterparties').select('*').eq('organization_id', currentId.value).order('name')
    if (error) throw error
    return (data ?? []) as GenericRow[]
  }
  if (kind.value === 'tags') {
    const { data, error } = await supabase.from('tags').select('*').eq('organization_id', currentId.value).order('name')
    if (error) throw error
    return (data ?? []) as GenericRow[]
  }

  const { data, error } = await supabase.from('organization_invitations').select('id, email, role, role_id, status, created_at, expires_at').eq('organization_id', currentId.value).order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as GenericRow[]
}, { watch: [currentId, kind], default: () => [] })

const selectedId = ref<string | null>(null)
const canCreate = computed(() => {
  if (!writesAllowed.value) return false
  if (isTransaction.value) return can(FLOW_CAPABILITY[kind.value as TransactionFlow])
  if (kind.value === 'commitments') return can('commitments.create')
  if (kind.value === 'recurring') return can('recurring.manage')
  if (kind.value === 'counterparties') return can('counterparties.manage')
  if (kind.value === 'tags') return can('tags.manage')
  return can('members.invite')
})

function addRecord() {
  if (isTransaction.value) start(kind.value as TransactionFlow)
  else if (kind.value === 'invitations') showInvitation()
  else showOperations(kind.value as OperationKind)
}

async function openCreateFromRoute() {
  if (route.query.create !== '1' || !canCreate.value) return
  addRecord()
  await navigateTo(route.path, { replace: true })
}

watch(() => route.query.create, () => void openCreateFromRoute(), { immediate: true })
watch(transactionRevision, () => { if (isTransaction.value) void refresh() })
watch(() => operationRevision.value[kind.value as OperationKind], () => { if (OPERATION_KINDS.includes(kind.value as OperationKind)) void refresh() })
watch(invitationRevision, () => { if (kind.value === 'invitations') void refresh() })

const actionBusy = ref(false)
const actionError = ref<string | null>(null)
const today = () => new Date().toISOString().slice(0, 10)
const commitmentAction = reactive({ id: '', mode: 'settle' as 'settle' | 'postpone', amount: '', paymentAccountId: '', date: today() })

function openCommitmentAction(id: string, mode: 'settle' | 'postpone') {
  Object.assign(commitmentAction, { id, mode, amount: '', paymentAccountId: paymentAccounts.value[0]?.id ?? '', date: today() })
  actionError.value = null
}

async function runRowAction(action: () => PromiseLike<{ error: unknown }>) {
  actionBusy.value = true
  actionError.value = null
  try {
    const { error } = await action()
    if (error) throw error
    await refresh()
    toasts.success(t('operations.saved'))
  }
  catch (error) { actionError.value = describeError(error) }
  finally { actionBusy.value = false }
}

async function submitCommitmentAction() {
  if (!commitmentAction.id) return
  const id = commitmentAction.id
  await runRowAction(() => commitmentAction.mode === 'settle'
    ? supabase.rpc('settle_commitment', {
        p_commitment_id: id,
        p_payment_account_id: commitmentAction.paymentAccountId,
        p_amount_minor: commitmentAction.amount ? Number(parseMoneyToMinor(commitmentAction.amount, baseCurrency.value)) : undefined,
        p_settled_on: commitmentAction.date,
      })
    : supabase.rpc('postpone_commitment', { p_commitment_id: id, p_new_due_date: commitmentAction.date }))
  if (!actionError.value) commitmentAction.id = ''
}

async function cancelCommitment(id: string) {
  await runRowAction(() => supabase.rpc('cancel_commitment', { p_commitment_id: id }))
}

async function setRuleStatus(id: string, status: Database['public']['Enums']['recurring_status']) {
  await runRowAction(() => supabase.rpc('set_recurring_rule_status', { p_rule_id: id, p_status: status }))
}

const value = (row: TransactionRow | GenericRow, key: string) => (row as GenericRow)[key]
const text = (row: TransactionRow | GenericRow, key: string) => String(value(row, key) ?? t('common.dash'))
const date = (row: TransactionRow | GenericRow, key: string) => {
  const raw = value(row, key)
  return formatDate(typeof raw === 'string' ? raw.slice(0, 10) : null, locale.value)
}
const { dirty: overlayDirty0 } = useRecordAction(() => commitmentAction, computed(() => Boolean(commitmentAction.id)))

const journalPresentation = useLedgerJournalDetailPresentation(reactive({ get transactionId() { return selectedId.value } }), { close: () => { selectedId.value = null }, changed: refresh, navigate: id => { selectedId.value = id } })
const journalForm = journalPresentation.form
const commitmentForm = computed<BsCommitmentActionForm>({ get: () => ({ amount: commitmentAction.amount, account: commitmentAction.paymentAccountId, date: commitmentAction.date }), set: value => Object.assign(commitmentAction, { amount: value.amount, paymentAccountId: value.account, date: value.date }) })
const presentationCopy = computed<BsOperationalRecordsCopy>(() => ({
  title: title.value, count: t('recordPages.count', rows.value.length), allJournals: t('recordPages.allTransactions'), create: kind.value === 'tags' ? t('recordPages.addTag') : t('recordPages.add', { item: title.value }), empty: kind.value === 'tags' ? t('tagsGuide.emptyTitle') : t('recordPages.empty', { item: title.value }), emptyHint: t(kind.value === 'tags' ? 'tagsGuide.emptyHint' : 'recordPages.emptyHint'), failed: t('transactionWorkspace.loadError'), retry: t('accounts.retry'), name: t('operations.name'), kind: t('recordPages.kind'), date: t(kind.value === 'commitments' ? 'add.dueDate' : 'transactions.date'), description: t('transactions.description'), category: t('transactions.category'), fromTo: t('transactions.fromTo'), status: t('transactions.status'), amount: t('transactions.amount'), actions: t('accounts.actions'), schedule: t('recordPages.schedule'), nextRun: t('recordPages.nextRun'), email: t('auth.email'), phone: t('operations.phone'), created: t('recordPages.created'), role: t('recordPages.role'), expires: t('recordPages.expires'), settle: t('operations.settle'), postpone: t('operations.postpone'), cancel: t('common.cancel'), pause: t('operations.pause'), resume: t('operations.resume'), viewJournals: t('tagsGuide.viewTransactions'), account: t('add.chooseAccount'), partialAmount: t('operations.fullOrPartialAmount'), actionDate: t('add.date'),
}))
const presentationView = computed<BsOperationalRecordsView>(() => ({
  kind: isTransaction.value ? 'journals' : kind.value === 'counterparties' ? 'parties' : kind.value as 'commitments' | 'recurring' | 'tags' | 'invitations', journalDirectoryTo: '/transactions', canCreate: canCreate.value, loading: pending.value, failed: !!loadError.value, pending: actionBusy.value, error: actionError.value,
  rows: rows.value.map(row => {
    const status = kind.value === 'counterparties' ? value(row, 'is_archived') ? 'archived' : 'active' : text(row, 'status')
    const commitmentMutable = kind.value === 'commitments' && !['paid', 'cancelled'].includes(status)
    const currency = typeof value(row, 'currency_code') === 'string' ? String(value(row, 'currency_code')) : baseCurrency.value
    const rawAmount = value(row, kind.value === 'commitments' ? 'outstanding_minor' : 'amount_minor')
    return { id: text(row, 'id'), name: text(row, isTransaction.value ? 'description' : kind.value === 'commitments' ? 'title' : 'name'), kind: kind.value === 'recurring' ? t(`types.${text(row, 'transaction_type')}`) : kind.value === 'commitments' ? text(row, 'type').replaceAll('_', ' ') : text(row, 'type'), date: date(row, isTransaction.value ? 'transaction_date' : kind.value === 'commitments' ? 'due_date' : 'created_at'), status, amount: isTransaction.value || kind.value === 'commitments' ? formatPresentationMoney(typeof rawAmount === 'string' || typeof rawAmount === 'number' ? rawAmount : 0, { currency, locale: locale.value, unit: 'minor', numberingSystem: 'latn' }) : '', from: text(row, 'from_account_name'), to: text(row, 'to_account_name'), category: text(row, 'category_name'), schedule: `${text(row, 'interval_count')} × ${text(row, 'frequency')}`, nextRun: date(row, 'next_run_on'), email: text(row, 'email'), phone: text(row, 'phone'), color: text(row, 'color'), role: kind.value === 'invitations' ? roleLabel(text(row, 'role'), text(row, 'role_id')) : '', expires: date(row, 'expires_at'), toJournal: kind.value === 'tags' && can('transactions.read') ? `/transactions?tag=${encodeURIComponent(text(row, 'id'))}` : null, canSettle: commitmentMutable && can('commitments.settle'), canPostpone: commitmentMutable && can('commitments.update'), canCancel: commitmentMutable && can('commitments.update'), canPause: kind.value === 'recurring' && can('recurring.manage') && status === 'active', canResume: kind.value === 'recurring' && can('recurring.manage') && ['paused', 'failed'].includes(status) }
  }),
  guide: kind.value === 'tags' ? { title: t('tagsGuide.title'), body: t('tagsGuide.body'), steps: ['create', 'assign', 'find'].map(id => ({ id, title: t(`tagsGuide.steps.${id}.title`), body: t(`tagsGuide.steps.${id}.body`) })), example: t('tagsGuide.example'), link: can('transactions.read') ? '/transactions' : '', linkLabel: t('tagsGuide.openTransactions') } : null,
  dialog: { visible: !!commitmentAction.id, title: t(commitmentAction.mode === 'settle' ? 'operations.settle' : 'operations.postpone'), dirty: overlayDirty0.value, pending: actionBusy.value, error: actionError.value, submit: t(commitmentAction.mode === 'settle' ? 'operations.convert' : 'operations.postpone'), settling: commitmentAction.mode === 'settle', accounts: paymentAccounts.value.map(account => ({ value: account.id, label: account.name })) }, journal: { copy: journalPresentation.copy.value, view: journalPresentation.view.value },
}))
</script>
<template>
  <BsOperationalRecordsPage v-model:commitment="commitmentForm" v-model:journal="journalForm" :copy="presentationCopy" :view="presentationView" @create="addRecord" @retry="refresh" @open-journal="selectedId = $event" @commitment="openCommitmentAction" @cancel-commitment="cancelCommitment" @rule-status="setRuleStatus" @close-commitment="commitmentAction.id = ''" @submit-commitment="submitCommitmentAction" @close-journal="selectedId = null" @retry-journal="journalPresentation.retry" @retry-tags="journalPresentation.retryTags" @assign-tag="journalPresentation.assignTag" @remove-tag="journalPresentation.removeTag" @upload="journalPresentation.upload" @download="journalPresentation.download" @delete-attachment="journalPresentation.deleteAttachment" @reverse="journalPresentation.reverse"/>
</template>
