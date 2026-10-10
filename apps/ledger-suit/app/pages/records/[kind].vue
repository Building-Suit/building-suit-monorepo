<script setup lang="ts">
import { useLedgerTransactionDetailDialogView } from '~/composables/useLedgerTransactionDetailDialogView'
import { useLedgerTransactionTagsView } from '~/composables/useLedgerTransactionTagsView'
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
const ledgerPresentation = useLedgerPresentation()
</script>

<template>
  <BsStack gap="lg">
    <BsInline as="header" gap="md" :wrap="true" align="start" justify="between">
      <BsBox>
        <BsLink v-if="isTransaction" to="/transactions">{{ t('recordPages.allTransactions') }}</BsLink>
        <BsHeading :level="1" size="h1">{{ title }}</BsHeading>
        <BsText size="sm" tone="muted">{{ t('recordPages.count', rows.length) }}</BsText>
      </BsBox>
      <BsButton v-if="canCreate" type="button" variant="primary" @click="addRecord">{{ kind === 'tags' ? t('recordPages.addTag') : t('recordPages.add', { item: title }) }}</BsButton>
    </BsInline>
    <BsCard v-if="kind === 'tags'" aria-labelledby="tags-guide-title" as="section" padding="lg">
      <BsStack gap="md">
        <BsBox>
          <BsHeading id="tags-guide-title" :level="2" size="h3">{{ t('tagsGuide.title') }}</BsHeading>
          <BsText tone="muted">{{ t('tagsGuide.body') }}</BsText>
        </BsBox>
        <BsGrid :columns="3" gap="md">
          <BsBox v-for="step in ['create', 'assign', 'find']" :key="step" padding="lg" surface="muted" radius="control">
            <BsHeading :level="3" size="body">{{ t(`tagsGuide.steps.${step}.title`) }}</BsHeading>
            <BsText size="sm" tone="muted">{{ t(`tagsGuide.steps.${step}.body`) }}</BsText>
          </BsBox>
        </BsGrid>
        <BsText size="sm" tone="muted">{{ t('tagsGuide.example') }}</BsText>
        <BsLink v-if="can('transactions.read')" to="/transactions">{{ t('tagsGuide.openTransactions') }}<BsIcon name="arrowRight" directional :size="18" /></BsLink>
      </BsStack>
    </BsCard>
    <BsCard v-if="loadError" role="alert" as="div" padding="md">
      <BsText>{{ t('transactionWorkspace.loadError') }}</BsText>
      <BsButton type="button" @click="refresh()">{{ t('accounts.retry') }}</BsButton>
    </BsCard>
    <BsSectionSkeleton v-else-if="pending" variant="table" :rows="8" />
    <BsEmptyState
      v-else-if="rows.length === 0"
      :title="kind === 'tags' ? t('tagsGuide.emptyTitle') : t('recordPages.empty', { item: title })"
      :description="t(kind === 'tags' ? 'tagsGuide.emptyHint' : 'recordPages.emptyHint')"
      :action-label="canCreate ? (kind === 'tags' ? t('recordPages.addTag') : t('recordPages.add', { item: title })) : undefined"
      @action="addRecord"
    />
    <BsCard v-else as="div" padding="none">
      <BsDataTable
        v-if="isTransaction"
        :value="rows"
        :label="title"
        :columns="[{ key: 'column1', header: (t('transactions.date')) }, { key: 'column2', header: (t('transactions.description')) }, { key: 'column3', header: (t('transactions.category')) }, { key: 'column4', header: (t('transactions.fromTo')) }, { key: 'column5', header: (t('transactions.status')) }, { key: 'column6', header: (t('transactions.amount')), align: 'end' as const }]"
        @row-click="event => selectedId = text(event.data, 'id')"
      >
        <template #header-column1>{{ t('transactions.date') }}</template>
        <template #cell-column1="{ row }">{{ date(row, 'transaction_date') }}</template>
        <template #header-column2>{{ t('transactions.description') }}</template>
        <template #cell-column2="{ row }">{{ text(row, 'description') }}</template>
        <template #header-column3>{{ t('transactions.category') }}</template>
        <template #cell-column3="{ row }">{{ text(row, 'category_name') }}</template>
        <template #header-column4>{{ t('transactions.fromTo') }}</template>
        <template #cell-column4="{ row }">{{ text(row, 'from_account_name') }} <BsIcon name="arrowRight" :size="14" directional /> {{ text(row, 'to_account_name') }}</template>
        <template #header-column5>{{ t('transactions.status') }}</template>
        <template #cell-column5="{ row }">
          <BsStatusBadge :status="text(row, 'status')" />
        </template>
        <template #header-column6>{{ t('transactions.amount') }}</template>
        <template #cell-column6="{ row }">
          <BsMoneyText
            :amount="number(row, 'amount_minor')"
            :currency="ledgerPresentation.currency(text(row, 'currency_code'))"
            :locale="ledgerPresentation.locale"
          />
        </template>
      </BsDataTable>
      <BsDataTable
        v-else-if="kind === 'commitments'"
        :value="rows"
        :columns="[{ key: 'column1', header: (t('operations.name')) }, { key: 'column2', header: (t('recordPages.kind')) }, { key: 'column3', header: (t('add.dueDate')) }, { key: 'column4', header: (t('transactions.status')) }, { key: 'column5', header: (t('transactions.amount')), align: 'end' as const }, { key: 'column6', header: (t('accounts.actions')), align: 'end' as const }]"
      >
        <template #header-column1>{{ t('operations.name') }}</template>
        <template #cell-column1="{ row }">{{ text(row, 'title') }}</template>
        <template #header-column2>{{ t('recordPages.kind') }}</template>
        <template #cell-column2="{ row }">{{ text(row, 'type').replaceAll('_', ' ') }}</template>
        <template #header-column3>{{ t('add.dueDate') }}</template>
        <template #cell-column3="{ row }">{{ date(row, 'due_date') }}</template>
        <template #header-column4>{{ t('transactions.status') }}</template>
        <template #cell-column4="{ row }">
          <BsStatusBadge :status="text(row, 'status')" />
        </template>
        <template #header-column5>{{ t('transactions.amount') }}</template>
        <template #cell-column5="{ row }">
          <BsMoneyText
            :amount="number(row, 'outstanding_minor')"
            :currency="ledgerPresentation.currency(text(row, 'currency_code'))"
            :locale="ledgerPresentation.locale"
          />
        </template>
        <template #header-column6>{{ t('accounts.actions') }}</template>
        <template #cell-column6="{ row }">
          <template v-if="!['paid','cancelled'].includes(text(row, 'status'))">
            <BsButton v-if="can('commitments.settle')" type="submit" size="sm" @click="openCommitmentAction(text(row, 'id'), 'settle')">{{ t('operations.settle') }}</BsButton>
            <BsButton v-if="can('commitments.update')" type="submit" size="sm" @click="openCommitmentAction(text(row, 'id'), 'postpone')">{{ t('operations.postpone') }}</BsButton>
            <BsButton v-if="can('commitments.update')" type="submit" :disabled="actionBusy" size="sm" @click="cancelCommitment(text(row, 'id'))">{{ t('common.cancel') }}</BsButton>
          </template>
        </template>
      </BsDataTable>
      <BsDataTable
        v-else-if="kind === 'recurring'"
        :value="rows"
        :columns="[{ key: 'column1', header: (t('operations.name')) }, { key: 'column2', header: (t('transactions.type')) }, { key: 'column3', header: (t('recordPages.schedule')) }, { key: 'column4', header: (t('recordPages.nextRun')) }, { key: 'column5', header: (t('transactions.status')) }, { key: 'column6', header: (t('accounts.actions')), align: 'end' as const }]"
      >
        <template #header-column1>{{ t('operations.name') }}</template>
        <template #cell-column1="{ row }">{{ text(row, 'name') }}</template>
        <template #header-column2>{{ t('transactions.type') }}</template>
        <template #cell-column2="{ row }">{{ t(`types.${text(row, 'transaction_type')}`) }}</template>
        <template #header-column3>{{ t('recordPages.schedule') }}</template>
        <template #cell-column3="{ row }">{{ text(row, 'interval_count') }} × {{ text(row, 'frequency') }}</template>
        <template #header-column4>{{ t('recordPages.nextRun') }}</template>
        <template #cell-column4="{ row }">{{ date(row, 'next_run_on') }}</template>
        <template #header-column5>{{ t('transactions.status') }}</template>
        <template #cell-column5="{ row }">
          <BsStatusBadge :status="text(row, 'status')" />
        </template>
        <template #header-column6>{{ t('accounts.actions') }}</template>
        <template #cell-column6="{ row }">
          <BsButton
            v-if="can('recurring.manage') && text(row, 'status') === 'active'"
            type="submit"
            :disabled="actionBusy"
            size="sm"
            @click="setRuleStatus(text(row, 'id'), 'paused')"
          >{{ t('operations.pause') }}</BsButton>
          <BsButton
            v-else-if="can('recurring.manage') && ['paused','failed'].includes(text(row, 'status'))"
            type="submit"
            :disabled="actionBusy"
            size="sm"
            @click="setRuleStatus(text(row, 'id'), 'active')"
          >{{ t('operations.resume') }}</BsButton>
        </template>
      </BsDataTable>
      <BsDataTable
        v-else-if="kind === 'counterparties'"
        :value="rows"
        :columns="[{ key: 'column1', header: (t('operations.name')) }, { key: 'column2', header: (t('recordPages.kind')) }, { key: 'column3', header: (t('auth.email')) }, { key: 'column4', header: (t('operations.phone')) }, { key: 'column5', header: (t('transactions.status')) }]"
      >
        <template #header-column1>{{ t('operations.name') }}</template>
        <template #cell-column1="{ row }">{{ text(row, 'name') }}</template>
        <template #header-column2>{{ t('recordPages.kind') }}</template>
        <template #cell-column2="{ row }">{{ text(row, 'type') }}</template>
        <template #header-column3>{{ t('auth.email') }}</template>
        <template #cell-column3="{ row }">{{ text(row, 'email') }}</template>
        <template #header-column4>{{ t('operations.phone') }}</template>
        <template #cell-column4="{ row }">{{ text(row, 'phone') }}</template>
        <template #header-column5>{{ t('transactions.status') }}</template>
        <template #cell-column5="{ row }">
          <BsStatusBadge :status="value(row, 'is_archived') ? 'archived' : 'active'" />
        </template>
      </BsDataTable>
      <BsDataTable
        v-else-if="kind === 'tags'"
        :value="rows"
        :label="t('operations.tabs.tags')"
        :columns="[{ key: 'column1', header: (t('operations.name')) }, { key: 'column2', header: (t('recordPages.created')) }, ...((can('transactions.read')) ? [{ key: 'column3', header: t('accounts.actions'), align: 'end' as const }] : [])]"
      >
        <template #header-column1>{{ t('operations.name') }}</template>
        <template #cell-column1="{ row }">
          <BsInline as="span" gap="sm" :wrap="false"><BsColorSwatch :color="text(row, 'color')" />{{ text(row, 'name') }}</BsInline>
        </template>
        <template #header-column2>{{ t('recordPages.created') }}</template>
        <template #cell-column2="{ row }">{{ date(row, 'created_at') }}</template>
        <template #cell-column3="{ row }">
          <BsLink :to="{ path: '/transactions', query: { tag: text(row, 'id') } }">{{ t('tagsGuide.viewTransactions') }}</BsLink>
        </template>
      </BsDataTable>
      <BsDataTable
        v-else
        :value="rows"
        :columns="[{ key: 'column1', header: (t('auth.email')) }, { key: 'column2', header: (t('recordPages.role')) }, { key: 'column3', header: (t('transactions.status')) }, { key: 'column4', header: (t('recordPages.created')) }, { key: 'column5', header: (t('recordPages.expires')) }]"
      >
        <template #header-column1>{{ t('auth.email') }}</template>
        <template #cell-column1="{ row }">{{ text(row, 'email') }}</template>
        <template #header-column2>{{ t('recordPages.role') }}</template>
        <template #cell-column2="{ row }">{{ roleLabel(text(row, 'role'), text(row, 'role_id')) }}</template>
        <template #header-column3>{{ t('transactions.status') }}</template>
        <template #cell-column3="{ row }">
          <BsStatusBadge :status="text(row, 'status')" />
        </template>
        <template #header-column4>{{ t('recordPages.created') }}</template>
        <template #cell-column4="{ row }">{{ date(row, 'created_at') }}</template>
        <template #header-column5>{{ t('recordPages.expires') }}</template>
        <template #cell-column5="{ row }">{{ date(row, 'expires_at') }}</template>
      </BsDataTable>
    </BsCard>
    <BsText v-if="actionError && !commitmentAction.id" role="alert" tone="danger">{{ actionError }}</BsText>
    <BsRecordActionDialog
      v-if="commitmentAction.id"
      :visible="true"
      :title="t(commitmentAction.mode === 'settle' ? 'operations.settle' : 'operations.postpone')"
      size="md"
      :dirty="overlayDirty0"
      :pending="actionBusy"
      :error="actionError"
      :submit-label="t(commitmentAction.mode === 'settle' ? 'operations.convert' : 'operations.postpone')"
      :cancel-label="t('common.cancel')"
      @update:visible="(value: boolean) => { if (!value) commitmentAction.id = '' }"
      @submit="submitCommitmentAction"
    >
      <template v-if="commitmentAction.mode === 'settle'">
        <BsFloatingField :label="t('add.chooseAccount')">
          <BsSelect v-model="commitmentAction.paymentAccountId" required native>
            <BsSelectOption value="">{{ t('add.chooseAccount') }}</BsSelectOption>
            <BsSelectOption v-for="account in paymentAccounts" :key="account.id" :value="account.id">{{ account.name }}</BsSelectOption>
          </BsSelect>
        </BsFloatingField>
        <BsFloatingField :label="t('operations.fullOrPartialAmount')">
          <BsInput v-model="commitmentAction.amount" inputmode="decimal" :placeholder="t('operations.fullOrPartialAmount')" />
        </BsFloatingField>
      </template>
      <BsFloatingField :label="t('add.date')">
        <BsInput v-model="commitmentAction.date" type="date" required />
      </BsFloatingField>
    </BsRecordActionDialog>
    <BsWorkflowScope
      v-if="selectedId"
      :factory="useLedgerTransactionDetailDialogView"
      :input="{ transactionId: (selectedId) }"
      @changed="refresh"
      @close="selectedId = null"
    >
      <template #default="{ state: ledgerView12 }">
        <BsDialog
          v-if="ledgerView12.transactionId"
          :visible="true"
          :title="ledgerView12.transaction?.description || ledgerView12.t('detail.title')"
          :aria-label="ledgerView12.transaction?.description || ledgerView12.t('detail.title')"
          :show-header="false"
          size="md"
          :dirty="ledgerView12.overlayDirty0"
          :pending="ledgerView12.reversing || ledgerView12.uploading || ledgerView12.tagPending"
          @update:visible="(value: boolean) => { if (!value) ledgerView12.emit('close') }"
        >
          <template #default="{ close: dismiss }">
            <BsStack gap="none" overflow="hidden">
              <BsInline as="header" gap="md" :wrap="false" align="start" justify="between">
                <BsBox>
                  <BsHeading id="transaction-detail-title" :level="2" size="body">{{ ledgerView12.transaction?.description || ledgerView12.t('detail.title') }}</BsHeading>
                  <BsText size="sm" tone="muted">
                    <BsStatusBadge v-if="ledgerView12.transaction?.status" :status="ledgerView12.transaction.status" />
                    <BsText v-if="ledgerView12.transaction?.type" as="span">{{ ledgerView12.t(`types.${ledgerView12.transaction.type}`) }}</BsText>
                    <BsText v-if="ledgerView12.transaction?.journal_reference" as="span" emphasis="semibold">{{ ledgerView12.transaction.journal_reference }}</BsText>
                  </BsText>
                </BsBox>
                <BsButton type="button" :aria-label="ledgerView12.t('common.close')" size="sm" @click="dismiss">
                  <BsIcon name="close" />
                </BsButton>
              </BsInline>
              <BsStack gap="lg" grow>
                <BsDescriptionList :columns="2">
                  <BsBox>
                    <BsDescriptionTerm>{{ ledgerView12.t('journalCenter.journalReference') }}</BsDescriptionTerm>
                    <BsDescriptionValue>{{ ledgerView12.transaction?.journal_reference || ledgerView12.t('common.dash') }}</BsDescriptionValue>
                  </BsBox>
                  <BsBox>
                    <BsDescriptionTerm>{{ ledgerView12.t('journalCenter.accountingDate') }}</BsDescriptionTerm>
                    <BsDescriptionValue>{{ formatDate(ledgerView12.transaction?.transaction_date, ledgerView12.locale) }}</BsDescriptionValue>
                  </BsBox>
                  <BsBox>
                    <BsDescriptionTerm>{{ ledgerView12.t('journalCenter.source') }}</BsDescriptionTerm>
                    <BsDescriptionValue>{{ ledgerView12.transaction?.source ? ledgerView12.t(`journalSources.${ledgerView12.transaction.source}`) : ledgerView12.t('common.dash') }}</BsDescriptionValue>
                  </BsBox>
                  <BsBox>
                    <BsDescriptionTerm>{{ ledgerView12.t('transactions.category') }}</BsDescriptionTerm>
                    <BsDescriptionValue>{{ ledgerView12.transaction?.category_name || ledgerView12.t('common.dash') }}</BsDescriptionValue>
                  </BsBox>
                  <BsBox>
                    <BsDescriptionTerm>{{ ledgerView12.t('transactions.counterparty') }}</BsDescriptionTerm>
                    <BsDescriptionValue>{{ ledgerView12.transaction?.counterparty_name || ledgerView12.t('common.dash') }}</BsDescriptionValue>
                  </BsBox>
                  <BsBox>
                    <BsDescriptionTerm>{{ ledgerView12.t('transactions.reference') }}</BsDescriptionTerm>
                    <BsDescriptionValue>{{ ledgerView12.transaction?.reference || ledgerView12.t('common.dash') }}</BsDescriptionValue>
                  </BsBox>
                  <BsBox>
                    <BsDescriptionTerm>{{ ledgerView12.t('transactions.createdBy') }}</BsDescriptionTerm>
                    <BsDescriptionValue>{{ ledgerView12.transaction?.created_by_name || ledgerView12.transaction?.created_by_email || ledgerView12.t('common.dash') }}</BsDescriptionValue>
                  </BsBox>
                  <BsBox v-if="ledgerView12.transaction?.adjustment_reason" :span="2">
                    <BsDescriptionTerm>{{ ledgerView12.t('detail.reason') }}</BsDescriptionTerm>
                    <BsDescriptionValue>{{ ledgerView12.transaction.adjustment_reason }}</BsDescriptionValue>
                  </BsBox>
                  <BsBox v-if="ledgerView12.sourceLink" :span="2">
                    <BsDescriptionTerm>{{ ledgerView12.t('journalCenter.sourceRecord') }}</BsDescriptionTerm>
                    <BsDescriptionValue>
                      <BsLink :to="ledgerView12.sourceLink">{{ ledgerView12.t('journalCenter.openSource') }}</BsLink>
                    </BsDescriptionValue>
                  </BsBox>
                </BsDescriptionList>
                <BsBox aria-labelledby="journal-heading" as="section">
                  <BsHeading id="journal-heading" :level="3" size="body">{{ ledgerView12.t('detail.journal') }}</BsHeading>
                  <BsDataTable :value="ledgerView12.entries" :columns="[{ key: 'column1', header: (ledgerView12.t('detail.account')) }, { key: 'column2', header: (ledgerView12.t('detail.debit')), align: 'end' as const }, { key: 'column3', header: (ledgerView12.t('detail.credit')), align: 'end' as const }]">
                    <template #header-column1>{{ ledgerView12.t('detail.account') }}</template>
                    <template #cell-column1="{ row: entry }">
                      <BsText as="span">{{ entry.account_name }}</BsText>
                      <BsText v-if="entry.memo" as="span" size="xs" tone="muted">{{ entry.memo }}</BsText>
                    </template>
                    <template #header-column2>{{ ledgerView12.t('detail.debit') }}</template>
                    <template #cell-column2="{ row: entry }">
                      <BsMoneyText
                        v-if="entry.side === 'debit'"
                        :amount="entry.amount_minor"
                        :currency="ledgerView12.ledgerPresentation.currency(entry.currency_code)"
                        :locale="ledgerView12.ledgerPresentation.locale"
                      />
                      <BsText v-else as="span">{{ ledgerView12.t('common.dash') }}</BsText>
                    </template>
                    <template #header-column3>{{ ledgerView12.t('detail.credit') }}</template>
                    <template #cell-column3="{ row: entry }">
                      <BsMoneyText
                        v-if="entry.side === 'credit'"
                        :amount="entry.amount_minor"
                        :currency="ledgerView12.ledgerPresentation.currency(entry.currency_code)"
                        :locale="ledgerView12.ledgerPresentation.locale"
                      />
                      <BsText v-else as="span">{{ ledgerView12.t('common.dash') }}</BsText>
                    </template>
                  </BsDataTable>
                  <BsInline gap="md" :wrap="true" justify="between" padding="md" surface="muted" radius="control">
                    <BsText as="span">{{ ledgerView12.t('journalCenter.lineTotals') }}</BsText>
                    <BsText as="span">{{ ledgerView12.t('detail.debit') }}: <BsMoneyText :amount="ledgerView12.transaction?.debit_minor" :currency="ledgerView12.ledgerPresentation.currency(ledgerView12.transaction?.currency_code ?? undefined)" :locale="ledgerView12.ledgerPresentation.locale" /></BsText>
                    <BsText as="span">{{ ledgerView12.t('detail.credit') }}: <BsMoneyText :amount="ledgerView12.transaction?.credit_minor" :currency="ledgerView12.ledgerPresentation.currency(ledgerView12.transaction?.currency_code ?? undefined)" :locale="ledgerView12.ledgerPresentation.locale" /></BsText>
                  </BsInline>
                </BsBox>
                <BsWorkflowScope
                  :factory="useLedgerTransactionTagsView"
                  :input="{ selected: ledgerView12.selectedTagId, pending: ledgerView12.tagPending, transactionId: (ledgerView12.transactionId) }"
                  @update:selected="(value: string) => ledgerView12.selectedTagId = value"
                  @update:pending="(value: boolean) => ledgerView12.tagPending = value"
                  @changed="ledgerView12.emit('changed')"
                >
                  <template #default="{ state: ledgerView13 }">
                    <BsStack v-if="ledgerView13.can('tags.read')" aria-labelledby="transaction-tags-heading" as="section" gap="md">
                      <BsBox>
                        <BsHeading id="transaction-tags-heading" :level="3" size="body">{{ ledgerView13.t('operations.tabs.tags') }}</BsHeading>
                        <BsText size="sm" tone="muted">{{ ledgerView13.t('tagsGuide.detailHint') }}</BsText>
                      </BsBox>
                      <BsText v-if="ledgerView13.pending || ledgerView13.tagsPending" role="status" size="sm" tone="muted">{{ ledgerView13.t('app.loading') }}</BsText>
                      <BsBox v-else-if="ledgerView13.error || ledgerView13.tagsError" role="alert">{{ ledgerView13.t('tagsGuide.loadError') }}
      <BsButton type="button" size="sm" @click="ledgerView13.refresh(); ledgerView13.refreshOptions()">{{ ledgerView13.t('accounts.retry') }}</BsButton></BsBox>
                      <template v-else>
                        <BsList v-if="ledgerView13.assigned.length" :aria-label="ledgerView13.t('tagsGuide.assigned')" :ordered="false" marker="none">
                          <BsListItem v-for="row in ledgerView13.assigned" :key="row.tag_id">
                            <BsColorSwatch :color="text(row, 'color')" />
                            <BsText as="span">{{ row.tags?.name }}</BsText>
                            <BsButton
                              v-if="ledgerView13.canManage"
                              type="button"
                              :disabled="ledgerView13.busy"
                              :aria-label="ledgerView13.t('tagsGuide.remove', { name: row.tags?.name })"
                              size="sm"
                              @click="ledgerView13.changeTag(row.tag_id, true)"
                            >
                              <BsIcon name="close" :size="14" />
                            </BsButton>
                          </BsListItem>
                        </BsList>
                        <BsText v-else size="sm" tone="muted">{{ ledgerView13.t('tagsGuide.noneAssigned') }}</BsText>
                        <BsInline v-if="ledgerView13.canManage && ledgerView13.available.length" gap="sm" :wrap="true" align="end">
                          <BsFloatingField :label="ledgerView13.t('tagsGuide.choose')">
                            <BsSelect id="transaction-tag" v-model="ledgerView13.selected" :disabled="ledgerView13.busy" native>
                              <BsSelectOption value="">{{ ledgerView13.t('tagsGuide.choose') }}</BsSelectOption>
                              <BsSelectOption v-for="tag in ledgerView13.available" :key="tag.id" :value="tag.id">{{ tag.name }}</BsSelectOption>
                            </BsSelect>
                          </BsFloatingField>
                          <BsButton type="button" :disabled="!ledgerView13.selected || ledgerView13.busy" @click="ledgerView13.changeTag(ledgerView13.selected)">{{ ledgerView13.t('operations.assign') }}</BsButton>
                        </BsInline>
                        <BsText v-if="!ledgerView13.tags.length" size="sm" tone="muted">{{ ledgerView13.t('tagsGuide.noOptions') }}</BsText>
                        <BsText v-if="ledgerView13.failure" role="alert" tone="danger">{{ ledgerView13.failure }}</BsText>
                      </template>
                    </BsStack>
                  </template>
                </BsWorkflowScope>
                <BsBox aria-labelledby="attachments-heading" as="section">
                  <BsInline gap="none" :wrap="false" justify="between">
                    <BsHeading id="attachments-heading" :level="3" size="body">{{ ledgerView12.t('operations.attachments') }}</BsHeading>
                    <BsFieldLabel v-if="ledgerView12.can('attachments.create')">{{ ledgerView12.uploading ? ledgerView12.t('common.saving') : ledgerView12.t('operations.upload') }}<BsFileInput accept="application/pdf,image/png,image/jpeg,image/webp" :disabled="ledgerView12.uploading" bare @change="ledgerView12.uploadAttachment"  hide-control /></BsFieldLabel>
                  </BsInline>
                  <BsUsageMeter
                    v-if="(ledgerView12.can('attachments.create')) && ledgerView12.ledgerUsage.item('max_storage_bytes')"
                    compact
                    :item="ledgerView12.ledgerUsage.item('max_storage_bytes')!"
                  />
                  <BsStack v-if="ledgerView12.attachments.length" gap="sm">
                    <BsInline v-for="item in ledgerView12.attachments" :key="item.id" gap="none" :wrap="false" justify="between" surface="muted" radius="control">
                      <BsButton variant="link" type="submit" @click="ledgerView12.downloadAttachment(item)">{{ item.file_name }}</BsButton>
                      <BsButton
                        v-if="ledgerView12.can('attachments.delete')"
                        type="submit"
                        :aria-label="ledgerView12.t('common.delete')"
                        size="sm"
                        @click="ledgerView12.deleteAttachment(item)"
                      >
                        <BsIcon name="delete" :size="18" />
                      </BsButton>
                    </BsInline>
                  </BsStack>
                  <BsText v-else size="sm" tone="muted">{{ ledgerView12.t('operations.noAttachments') }}</BsText>
                </BsBox>
                <BsBox
                  v-if="ledgerView12.transaction?.reverses_transaction_id || ledgerView12.transaction?.reversed_by_transaction_id || ledgerView12.transaction?.correction_of_transaction_id"
                  aria-labelledby="relationships-heading"
                  as="section"
                  radius="control"
                >
                  <BsHeading id="relationships-heading" :level="3" size="body">{{ ledgerView12.t('journalCenter.relationships') }}</BsHeading>
                  <BsText v-if="ledgerView12.transaction?.reversed_by_transaction_id">{{ ledgerView12.t('detail.reversedNotice') }} <BsButton variant="link" type="button" @click="ledgerView12.emit('navigate', ledgerView12.transaction.reversed_by_transaction_id)">{{ ledgerView12.t('journalCenter.reversalJournal') }} {{ ledgerView12.relationship(ledgerView12.transaction.reversed_by_transaction_id)?.journal_reference }}</BsButton></BsText>
                  <BsText v-if="ledgerView12.transaction?.reverses_transaction_id">{{ ledgerView12.t('journalCenter.reverses') }} <BsButton variant="link" type="button" @click="ledgerView12.emit('navigate', ledgerView12.transaction.reverses_transaction_id)">{{ ledgerView12.t('journalCenter.originalJournal') }} {{ ledgerView12.relationship(ledgerView12.transaction.reverses_transaction_id)?.journal_reference }}</BsButton></BsText>
                  <BsText v-if="ledgerView12.transaction?.correction_of_transaction_id">{{ ledgerView12.t('journalCenter.adjusts') }} <BsButton variant="link" type="button" @click="ledgerView12.emit('navigate', ledgerView12.transaction.correction_of_transaction_id)">{{ ledgerView12.relationship(ledgerView12.transaction.correction_of_transaction_id)?.journal_reference }}</BsButton></BsText>
                </BsBox>
                <BsText v-if="ledgerView12.periodRestriction" size="sm" tone="muted">{{ ledgerView12.periodRestriction }}</BsText>
                <BsCard v-if="ledgerView12.confirming" as="div" variant="flat" padding="md">
                  <BsStack gap="md">
                    <BsText size="sm">{{ ledgerView12.t('detail.reverseExplain') }}</BsText>
                    <BsBox>
                      <BsFieldLabel for="reverse-reason">{{ ledgerView12.t('detail.reverseReason') }}</BsFieldLabel>
                      <BsInput id="reverse-reason" v-model="ledgerView12.reason" :placeholder="ledgerView12.t('detail.reverseReasonPlaceholder')" />
                    </BsBox>
                    <BsInline gap="sm" :wrap="false" justify="end">
                      <BsButton type="button" @click="ledgerView12.confirming = false">{{ ledgerView12.t('common.cancel') }}</BsButton>
                      <BsButton type="button" :disabled="ledgerView12.reversing" variant="danger" @click="ledgerView12.reverse">{{ ledgerView12.reversing ? ledgerView12.t('detail.reversing') : ledgerView12.t('detail.reverseConfirm') }}</BsButton>
                    </BsInline>
                  </BsStack>
                </BsCard>
                <BsText v-if="ledgerView12.errorMessage" role="alert" tone="danger">{{ ledgerView12.errorMessage }}</BsText>
              </BsStack>
              <BsBox v-if="ledgerView12.canReverse && !ledgerView12.confirming" as="footer">
                <BsButton type="button" @click="ledgerView12.confirming = true">{{ ledgerView12.t('detail.reverseAction') }}</BsButton>
              </BsBox>
            </BsStack>
          </template>
        </BsDialog>
      </template>
    </BsWorkflowScope>
  </BsStack>
</template>
