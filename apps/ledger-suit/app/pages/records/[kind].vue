<script setup lang="ts">
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
const number = (row: TransactionRow | GenericRow, key: string) => Number(value(row, key) ?? 0)
const date = (row: TransactionRow | GenericRow, key: string) => {
  const raw = value(row, key)
  return formatDate(typeof raw === 'string' ? raw.slice(0, 10) : null, locale.value)
}
const { dirty: overlayDirty0 } = useRecordAction(() => commitmentAction, computed(() => Boolean(commitmentAction.id)))
</script>

<template>
  <div class="space-y-6">
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <NuxtLink v-if="isTransaction" to="/transactions" class="text-xs font-semibold text-link">{{ t('recordPages.allTransactions') }}</NuxtLink>
        <h1 class="mt-1 text-h1 font-bold">{{ title }}</h1>
        <p class="mt-1 text-sm text-fg-muted">{{ t('recordPages.count', rows.length) }}</p>
      </div>
      <button v-if="canCreate" type="button" class="ls-btn ls-btn-primary" @click="addRecord">
        {{ kind === 'tags' ? t('recordPages.addTag') : t('recordPages.add', { item: title }) }}
      </button>
    </header>

    <section v-if="kind === 'tags'" class="ls-card space-y-5 p-5 sm:p-6" aria-labelledby="tags-guide-title">
      <div><h2 id="tags-guide-title" class="text-lg font-bold">{{ t('tagsGuide.title') }}</h2><p class="mt-2 max-w-3xl leading-relaxed text-fg-muted">{{ t('tagsGuide.body') }}</p></div>
      <div class="grid gap-4 md:grid-cols-3">
        <div v-for="step in ['create', 'assign', 'find']" :key="step" class="rounded-control bg-surface-muted p-4"><h3 class="font-semibold">{{ t(`tagsGuide.steps.${step}.title`) }}</h3><p class="mt-2 text-sm leading-relaxed text-fg-muted">{{ t(`tagsGuide.steps.${step}.body`) }}</p></div>
      </div>
      <p class="text-sm text-fg-muted">{{ t('tagsGuide.example') }}</p>
      <NuxtLink v-if="can('transactions.read')" to="/transactions" class="ls-btn">{{ t('tagsGuide.openTransactions') }}<AppIcon name="arrowRight" directional :size="18" /></NuxtLink>
    </section>

    <div v-if="loadError" role="alert" class="ls-card p-5"><p>{{ t('transactionWorkspace.loadError') }}</p><button type="button" class="ls-btn mt-3" @click="refresh()">{{ t('accounts.retry') }}</button></div>
    <SectionSkeleton v-else-if="pending" variant="table" :rows="8" />
    <EmptyState v-else-if="rows.length === 0" :title="kind === 'tags' ? t('tagsGuide.emptyTitle') : t('recordPages.empty', { item: title })" :description="t(kind === 'tags' ? 'tagsGuide.emptyHint' : 'recordPages.emptyHint')" :action-label="canCreate ? (kind === 'tags' ? t('recordPages.addTag') : t('recordPages.add', { item: title })) : undefined" @action="addRecord" />

    <div v-else class="ls-card overflow-x-auto">
      <BsDataTable v-if="isTransaction" :value="rows" :label="title" :row-class="() => 'cursor-pointer hover:bg-surface-muted'" @row-click="event => selectedId = text(event.data, 'id')">
  <Column body-class="whitespace-nowrap">
    <template #header>{{ t('transactions.date') }}</template>
    <template #body="{ data: row }">{{ date(row, 'transaction_date') }}</template>
  </Column>
  <Column >
    <template #header>{{ t('transactions.description') }}</template>
    <template #body="{ data: row }">{{ text(row, 'description') }}</template>
  </Column>
  <Column >
    <template #header>{{ t('transactions.category') }}</template>
    <template #body="{ data: row }">{{ text(row, 'category_name') }}</template>
  </Column>
  <Column body-class="whitespace-nowrap text-fg-muted">
    <template #header>{{ t('transactions.fromTo') }}</template>
    <template #body="{ data: row }">{{ text(row, 'from_account_name') }} <AppIcon name="arrowRight" :size="14" directional class="inline-block" /> {{ text(row, 'to_account_name') }}</template>
  </Column>
  <Column >
    <template #header>{{ t('transactions.status') }}</template>
    <template #body="{ data: row }"><StatusBadge :status="text(row, 'status')" /></template>
  </Column>
  <Column header-class="text-end" body-class="ls-num font-semibold">
    <template #header>{{ t('transactions.amount') }}</template>
    <template #body="{ data: row }"><MoneyText :amount-minor="number(row, 'amount_minor')" :currency="text(row, 'currency_code')" /></template>
  </Column>
</BsDataTable>

      <BsDataTable v-else-if="kind === 'commitments'" :value="rows">
  <Column >
    <template #header>{{ t('operations.name') }}</template>
    <template #body="{ data: row }">{{ text(row, 'title') }}</template>
  </Column>
  <Column >
    <template #header>{{ t('recordPages.kind') }}</template>
    <template #body="{ data: row }">{{ text(row, 'type').replaceAll('_', ' ') }}</template>
  </Column>
  <Column >
    <template #header>{{ t('add.dueDate') }}</template>
    <template #body="{ data: row }">{{ date(row, 'due_date') }}</template>
  </Column>
  <Column >
    <template #header>{{ t('transactions.status') }}</template>
    <template #body="{ data: row }"><StatusBadge :status="text(row, 'status')" /></template>
  </Column>
  <Column header-class="text-end" body-class="ls-num">
    <template #header>{{ t('transactions.amount') }}</template>
    <template #body="{ data: row }"><MoneyText :amount-minor="number(row, 'outstanding_minor')" :currency="text(row, 'currency_code')" /></template>
  </Column>
  <Column header-class="text-end" body-class="whitespace-nowrap text-end">
    <template #header>{{ t('accounts.actions') }}</template>
    <template #body="{ data: row }"><template v-if="!['paid','cancelled'].includes(text(row, 'status'))"><button v-if="can('commitments.settle')" class="ls-btn ls-btn-sm" @click="openCommitmentAction(text(row, 'id'), 'settle')">{{ t('operations.settle') }}</button><button v-if="can('commitments.update')" class="ls-btn ls-btn-sm ms-1" @click="openCommitmentAction(text(row, 'id'), 'postpone')">{{ t('operations.postpone') }}</button><button v-if="can('commitments.update')" class="ls-btn ls-btn-sm ms-1" :disabled="actionBusy" @click="cancelCommitment(text(row, 'id'))">{{ t('common.cancel') }}</button></template></template>
  </Column>
</BsDataTable>

      <BsDataTable v-else-if="kind === 'recurring'" :value="rows">
  <Column >
    <template #header>{{ t('operations.name') }}</template>
    <template #body="{ data: row }">{{ text(row, 'name') }}</template>
  </Column>
  <Column >
    <template #header>{{ t('transactions.type') }}</template>
    <template #body="{ data: row }">{{ t(`types.${text(row, 'transaction_type')}`) }}</template>
  </Column>
  <Column >
    <template #header>{{ t('recordPages.schedule') }}</template>
    <template #body="{ data: row }">{{ text(row, 'interval_count') }} × {{ text(row, 'frequency') }}</template>
  </Column>
  <Column >
    <template #header>{{ t('recordPages.nextRun') }}</template>
    <template #body="{ data: row }">{{ date(row, 'next_run_on') }}</template>
  </Column>
  <Column >
    <template #header>{{ t('transactions.status') }}</template>
    <template #body="{ data: row }"><StatusBadge :status="text(row, 'status')" /></template>
  </Column>
  <Column header-class="text-end" body-class="text-end">
    <template #header>{{ t('accounts.actions') }}</template>
    <template #body="{ data: row }"><button v-if="can('recurring.manage') && text(row, 'status') === 'active'" class="ls-btn ls-btn-sm" :disabled="actionBusy" @click="setRuleStatus(text(row, 'id'), 'paused')">{{ t('operations.pause') }}</button><button v-else-if="can('recurring.manage') && ['paused','failed'].includes(text(row, 'status'))" class="ls-btn ls-btn-sm" :disabled="actionBusy" @click="setRuleStatus(text(row, 'id'), 'active')">{{ t('operations.resume') }}</button></template>
  </Column>
</BsDataTable>

      <BsDataTable v-else-if="kind === 'counterparties'" :value="rows">
  <Column >
    <template #header>{{ t('operations.name') }}</template>
    <template #body="{ data: row }">{{ text(row, 'name') }}</template>
  </Column>
  <Column >
    <template #header>{{ t('recordPages.kind') }}</template>
    <template #body="{ data: row }">{{ text(row, 'type') }}</template>
  </Column>
  <Column >
    <template #header>{{ t('auth.email') }}</template>
    <template #body="{ data: row }">{{ text(row, 'email') }}</template>
  </Column>
  <Column >
    <template #header>{{ t('operations.phone') }}</template>
    <template #body="{ data: row }">{{ text(row, 'phone') }}</template>
  </Column>
  <Column >
    <template #header>{{ t('transactions.status') }}</template>
    <template #body="{ data: row }"><StatusBadge :status="value(row, 'is_archived') ? 'archived' : 'active'" /></template>
  </Column>
</BsDataTable>

      <BsDataTable v-else-if="kind === 'tags'" :value="rows" :label="t('operations.tabs.tags')">
  <Column >
    <template #header>{{ t('operations.name') }}</template>
    <template #body="{ data: row }"><span class="inline-flex items-center gap-2 font-semibold"><span class="size-3 shrink-0 rounded-full" aria-hidden="true" :style="{ backgroundColor: text(row, 'color') }" />{{ text(row, 'name') }}</span></template>
  </Column>
  <Column >
    <template #header>{{ t('recordPages.created') }}</template>
    <template #body="{ data: row }">{{ date(row, 'created_at') }}</template>
  </Column>
  <Column v-if="can('transactions.read')" :header="t('accounts.actions')" body-class="text-end">
    <template #body="{ data: row }"><NuxtLink :to="{ path: '/transactions', query: { tag: text(row, 'id') } }" class="ls-btn ls-btn-sm">{{ t('tagsGuide.viewTransactions') }}</NuxtLink></template>
  </Column>
</BsDataTable>

      <BsDataTable v-else :value="rows">
  <Column >
    <template #header>{{ t('auth.email') }}</template>
    <template #body="{ data: row }">{{ text(row, 'email') }}</template>
  </Column>
  <Column >
    <template #header>{{ t('recordPages.role') }}</template>
    <template #body="{ data: row }">{{ roleLabel(text(row, 'role'), text(row, 'role_id')) }}</template>
  </Column>
  <Column >
    <template #header>{{ t('transactions.status') }}</template>
    <template #body="{ data: row }"><StatusBadge :status="text(row, 'status')" /></template>
  </Column>
  <Column >
    <template #header>{{ t('recordPages.created') }}</template>
    <template #body="{ data: row }">{{ date(row, 'created_at') }}</template>
  </Column>
  <Column >
    <template #header>{{ t('recordPages.expires') }}</template>
    <template #body="{ data: row }">{{ date(row, 'expires_at') }}</template>
  </Column>
</BsDataTable>
    </div>

    <p v-if="actionError && !commitmentAction.id" class="ls-error" role="alert">{{ actionError }}</p>
        <BsDialog v-if="commitmentAction.id" :visible="true" :title="t(commitmentAction.mode === 'settle' ? 'operations.settle' : 'operations.postpone')" :aria-label="t(commitmentAction.mode === 'settle' ? 'operations.settle' : 'operations.postpone')" :show-header="false" size="md" :dirty="overlayDirty0" @update:visible="value => { if (!value) commitmentAction.id = '' }"><template #default="{ close: dismiss }">
<form class="space-y-4 p-6" @submit.prevent="submitCommitmentAction">
            <div class="flex items-center justify-between"><h2 class="text-lg font-bold">{{ t(commitmentAction.mode === 'settle' ? 'operations.settle' : 'operations.postpone') }}</h2><button type="button" class="ls-btn ls-btn-sm" :aria-label="t('common.close')" @click="dismiss"><AppIcon name="close" /></button></div>
            <template v-if="commitmentAction.mode === 'settle'"><FloatingField :label="t('add.chooseAccount')"><select v-model="commitmentAction.paymentAccountId" class="ls-input" required><option value="">{{ t('add.chooseAccount') }}</option><option v-for="account in paymentAccounts" :key="account.id" :value="account.id">{{ account.name }}</option></select></FloatingField><FloatingField :label="t('operations.fullOrPartialAmount')"><input v-model="commitmentAction.amount" class="ls-input" inputmode="decimal" :placeholder="t('operations.fullOrPartialAmount')"></FloatingField></template>
            <FloatingField :label="t('add.date')"><input v-model="commitmentAction.date" type="date" class="ls-input" required></FloatingField>
            <p v-if="actionError" class="ls-error" role="alert">{{ actionError }}</p>
            <div class="flex justify-end gap-2"><button type="button" class="ls-btn" @click="dismiss">{{ t('common.cancel') }}</button><button class="ls-btn ls-btn-primary" :disabled="actionBusy">{{ t(commitmentAction.mode === 'settle' ? 'operations.convert' : 'operations.postpone') }}</button></div>
          </form>
</template></BsDialog>

    <TransactionDetailDialog v-if="selectedId" :transaction-id="selectedId" @changed="refresh" @close="selectedId = null" />
  </div>
</template>
