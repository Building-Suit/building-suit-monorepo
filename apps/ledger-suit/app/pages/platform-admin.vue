<script setup lang="ts">
import type { Database } from '~~/types/database.types'
import type { AdminResource, AdminRow } from '~/composables/usePlatformAdmin'

definePageMeta({ layout: false })
type DialogMode = 'payment' | 'access' | 'subscription' | 'support'
const { t, te, locale } = useI18n()
const client = useSupabaseClient()
const catalogClient = useSupabaseClient<Database>()
const user = useSupabaseUser()
const { role, rows, pending, error, denied, load, review, setAccess, correctSubscription, updateSupport, receipt } = usePlatformAdmin()
const resource = ref<AdminResource>('status')
const resources: AdminResource[] = ['status', 'users', 'organizations', 'memberships', 'subscriptions', 'payments', 'support', 'audit']
const offset = ref(0)
const search = ref('')
const status = ref('')
const targetId = ref('')
const selected = shallowRef<AdminRow | null>(null)
const dialogMode = ref<DialogMode>('payment')
const action = ref('under_review')
const targetPlanKey = ref('solo')
const reason = ref('')
const context = ref('')
const success = ref(false)
const receiptUrl = ref('')
const { data: planCatalog, pending: planCatalogPending, error: planCatalogError } = await useAsyncData(
  'launch-plan-catalog',
  async () => {
    const { data, error } = await catalogClient.rpc('subscription_plan_catalog')
    if (error) throw error
    return data
  },
)
const purchasablePlans = computed(() => (planCatalog.value ?? []).filter(plan => plan.is_purchasable))
let receiptTimer: ReturnType<typeof setTimeout> | undefined
let commandId = ''
let commandPayload = ''
const { dirty, markSaved } = useRecordAction(
  () => ({ action: action.value, targetPlanKey: targetPlanKey.value, reason: reason.value, context: context.value }),
  computed(() => !!selected.value),
)
const fields: Record<AdminResource, string[]> = {
  users: ['id', 'email', 'full_name', 'membership_count', 'created_at'],
  organizations: ['id', 'name', 'status', 'access_state', 'operator_suspended', 'plan_key', 'subscription_status', 'member_count', 'pending_payment_count', 'open_support_count'],
  memberships: ['organization_name', 'email', 'full_name', 'role', 'status', 'joined_at'],
  subscriptions: ['organization_name', 'plan_key', 'status', 'access_state', 'operator_suspended', 'provider', 'billing_interval', 'current_period_end', 'trial_ends_at'],
  payments: ['organization_name', 'plan_key', 'amount_minor', 'currency_code', 'status', 'evidence_id', 'period_end'],
  audit: ['occurred_at', 'actor_id', 'actor_role', 'operation', 'target_id', 'command_id', 'outcome', 'reason', 'context', 'error_code', 'before_state', 'after_state'],
  status: ['checked_at', 'pending_payments', 'unprocessed_billing_events', 'failed_billing_events', 'open_support_requests', 'suspended_organizations', 'support_reminder_delivery'],
  support: ['organization_name', 'requester_email', 'category', 'subject', 'customer_message', 'status', 'priority', 'reminder_count', 'reminder_delivery_status', 'updated_at'],
}
const filterOptions: Partial<Record<AdminResource, string[]>> = {
  users: ['active', 'suspended'], organizations: ['trial', 'active', 'past_due', 'suspended', 'cancelled', 'archived', 'read_only'],
  memberships: ['active', 'suspended', 'owner', 'admin', 'accountant', 'data_entry', 'viewer'],
  subscriptions: ['trialing', 'active', 'past_due', 'grace_period', 'suspended', 'cancelled', 'read_only', 'manual', 'paymob'],
  payments: ['draft', 'submitted', 'under_review', 'approved', 'rejected', 'cancelled'],
  support: ['open', 'in_progress', 'waiting_customer', 'resolved', 'closed', 'normal', 'high', 'urgent'],
  audit: ['succeeded', 'rejected', 'replayed'],
}
const columns = computed(() => fields[resource.value].map(field => ({ field, header: t(`admin.fields.${field}`) })))
const isPlatformAdmin = computed(() => role.value === 'platform_admin')
const dialogTitle = computed(() => t(`admin.dialogs.${dialogMode.value}`))
useHead({ title: () => `${t('admin.title')} · ${t('app.name')}` })

function clearReceipt() { receiptUrl.value = ''; clearTimeout(receiptTimer) }
function close() { selected.value = null; clearReceipt(); reason.value = ''; context.value = ''; commandId = ''; commandPayload = '' }
watch(() => user.value?.id, () => { close(); success.value = false }, { flush: 'sync' })
watch(denied, value => { if (value) close() })
onBeforeUnmount(clearReceipt)
onMounted(refresh)
async function refresh() {
  success.value = false
  await load(resource.value, { offset: offset.value, search: search.value, status: status.value, targetId: targetId.value })
}
async function changeResource() { offset.value = 0; search.value = ''; status.value = ''; targetId.value = ''; await refresh() }
async function applyFilters() { offset.value = 0; targetId.value = ''; await refresh() }
async function clearFilters() { offset.value = 0; search.value = ''; status.value = ''; targetId.value = ''; await refresh() }
async function page(delta: number) { offset.value = Math.max(0, offset.value + delta); await refresh() }
async function inspectMemberships(row: AdminRow) { resource.value = 'memberships'; offset.value = 0; search.value = ''; status.value = ''; targetId.value = row.id; await refresh() }
function open(row: AdminRow, mode: DialogMode) {
  close(); selected.value = row; dialogMode.value = mode; success.value = false
  action.value = mode === 'payment' ? 'under_review' : mode === 'access' ? (row.operator_suspended ? 'reactivate' : 'suspend') : mode === 'support' ? 'start' : ''
  targetPlanKey.value = String(row.plan_key || 'solo')
  markSaved()
}
async function inspectReceipt() {
  if (!selected.value) return
  clearReceipt()
  const url = await receipt(selected.value.id)
  if (url) { receiptUrl.value = url; receiptTimer = setTimeout(clearReceipt, 60000) }
}
async function submit() {
  if (!selected.value || !reason.value.trim() || !context.value.trim()) return
  if (!(await useConfirmation().ask(t(`admin.confirmations.${dialogMode.value}`)))) return
  if (!selected.value) return
  const organizationId = String(selected.value.organization_id || selected.value.id)
  const payload = JSON.stringify([dialogMode.value, selected.value.id, organizationId, selected.value.evidence_id, action.value, targetPlanKey.value, reason.value, context.value])
  if (payload !== commandPayload) { commandId = crypto.randomUUID(); commandPayload = payload }
  let done: boolean | undefined
  if (dialogMode.value === 'payment') done = await review({ id: commandId, requestId: selected.value.id, evidenceId: String(selected.value.evidence_id), action: action.value, reason: reason.value, context: context.value })
  else if (dialogMode.value === 'access') done = await setAccess({ id: commandId, targetId: selected.value.id, action: action.value, reason: reason.value, context: context.value })
  else if (dialogMode.value === 'subscription') done = await correctSubscription({ id: commandId, targetId: organizationId, targetPlanKey: targetPlanKey.value, reason: reason.value, context: context.value })
  else done = await updateSupport({ id: commandId, targetId: selected.value.id, action: action.value, reason: reason.value, context: context.value })
  if (done) { markSaved(); close(); await refresh(); success.value = true }
}
async function signOut() { close(); await client.auth.signOut(); await navigateTo('/login?operator=1') }
function display(value: unknown) { return value === null || value === undefined ? '—' : typeof value === 'object' ? JSON.stringify(value, null, 2) : typeof value === 'boolean' ? t(value ? 'admin.yes' : 'admin.no') : String(value) }
function planName(key: unknown) {
  const value = String(key ?? '')
  const translation = `billing.plans.${value}.name`
  const catalogName = planCatalog.value?.find(plan => plan.plan_key === value)?.name
  return locale.value === 'ar' && te(translation) ? t(translation) : catalogName ?? (te(translation) ? t(translation) : value)
}
</script>

<template>
  <BsAppShell
    home-path="/platform-admin"
    :product-name="t('admin.title')"
    :groups="[]"
    :labels="{ close: t('nav.close'), open: t('nav.open'), navigation: t('nav.primary'), dashboard: t('admin.title') }"
  >
    <template #logo>
      <BsProductLogo name="Ledger Suit" asset-prefix="/brand/ledger-suit" />
    </template>
    <template #header>
      <BsUserMenu :email="user?.email" :account-label="t('common.accountMenu')" :sign-out-label="t('common.signOut')" @sign-out="signOut" />
    </template>
    <BsStack gap="md">
      <BsHeading :level="1" size="h1">{{ t('admin.title') }}</BsHeading>
      <BsText tone="muted">{{ t('admin.subtitle') }}</BsText>
      <BsText v-if="role" role="status">{{ t(`admin.roles.${role}`) }}</BsText>
      <BsText v-if="error" role="alert" tone="danger">{{ error }}</BsText>
      <BsText v-if="success" role="status">{{ t('admin.saved') }}</BsText>
      <BsInline gap="md" :wrap="true" align="end">
        <BsFloatingField :label="t('admin.view')">
          <BsSelect v-model="resource" :disabled="pending || denied" native @change="changeResource">
            <BsSelectOption v-for="view in resources" :key="view" :value="view">{{ t(`admin.views.${view}`) }}</BsSelectOption>
          </BsSelect>
        </BsFloatingField>
        <BsFloatingField v-if="resource !== 'status'" :label="t('admin.search')">
          <BsInput v-model="search" maxlength="100" :disabled="pending || denied" @keyup.enter="applyFilters" />
        </BsFloatingField>
        <BsFloatingField v-if="filterOptions[resource]?.length" :label="t('admin.filter')">
          <BsSelect v-model="status" :disabled="pending || denied" native>
            <BsSelectOption value="">{{ t('admin.allStates') }}</BsSelectOption>
            <BsSelectOption v-for="item in filterOptions[resource]" :key="item" :value="item">{{ t(`admin.states.${item}`, item) }}</BsSelectOption>
          </BsSelect>
        </BsFloatingField>
        <BsButton v-if="resource !== 'status'" type="button" :disabled="pending" @click="applyFilters">{{ t('admin.apply') }}</BsButton>
        <BsButton v-if="resource !== 'status' && (search || status || targetId)" type="button" :disabled="pending" @click="clearFilters">{{ t('admin.clear') }}</BsButton>
        <BsButton type="button" :disabled="pending" @click="refresh">{{ t('common.refresh') }}</BsButton>
      </BsInline>
      <BsText v-if="targetId" size="sm" tone="muted">{{ t('admin.scopedResults') }}</BsText>
      <BsText v-if="pending" role="status">{{ t('app.loading') }}</BsText>
      <BsText v-else-if="!error && !rows.length">{{ t('admin.empty') }}</BsText>
      <BsDataTable
        v-if="rows.length && !denied"
        :value="rows"
        row-key="id"
        :loading="pending"
        :columns="[...(columns ?? []).map((column) => ({ key: column.field, field: column.field, header: column.header, sortable: true })), ...((resource === 'users' || resource === 'organizations') ? [{ key: 'column2', header: t('admin.memberships') }] : []), ...((resource === 'organizations' && isPlatformAdmin) ? [{ key: 'column3', header: t('admin.access') }] : []), ...((resource === 'subscriptions' && isPlatformAdmin) ? [{ key: 'column4', header: t('admin.correction') }] : []), ...((resource === 'payments') ? [{ key: 'column5', header: t('admin.review') }] : []), ...((resource === 'support' && isPlatformAdmin) ? [{ key: 'column6', header: t('admin.manage') }] : [])]"
      >
        <template v-for="column in columns" :key="column.field" #[`cell-${column.field}`]="{ row: data }">
          <BsCodeBlock v-if="column.field.endsWith('_state')" dir="ltr">{{ display(data[column.field]) }}</BsCodeBlock>
          <BsText v-else as="span">{{ column.field === 'plan_key' ? planName(data[column.field]) : display(data[column.field]) }}</BsText>
        </template>
        <template #cell-column2="{ row: data }">
          <BsButton type="button" :disabled="pending" @click="inspectMemberships(data)">{{ t('admin.memberships') }}</BsButton>
        </template>
        <template #cell-column3="{ row: data }">
          <BsButton type="button" :disabled="pending" @click="open(data, 'access')">{{ data.operator_suspended ? t('admin.reactivate') : t('admin.suspend') }}</BsButton>
        </template>
        <template #cell-column4="{ row: data }">
          <BsButton type="button" :disabled="pending || data.provider !== 'manual'" @click="open(data, 'subscription')">{{ t('admin.correction') }}</BsButton>
        </template>
        <template #cell-column5="{ row: data }">
          <BsButton v-if="data.evidence_id" type="button" :disabled="pending" @click="open(data, 'payment')">{{ t('admin.review') }}</BsButton>
        </template>
        <template #cell-column6="{ row: data }">
          <BsButton type="button" :disabled="pending" @click="open(data, 'support')">{{ t('admin.manage') }}</BsButton>
        </template>
      </BsDataTable>
      <BsInline v-if="role && resource !== 'status'" gap="md" :wrap="false">
        <BsButton type="button" :disabled="pending || offset === 0" @click="page(-50)">{{ t('admin.previous') }}</BsButton>
        <BsButton type="button" :disabled="pending || rows.length < 50 || offset >= 100000" @click="page(50)">{{ t('admin.next') }}</BsButton>
      </BsInline>
    </BsStack>
    <BsRecordActionDialog
      :visible="!!selected"
      :title="dialogTitle"
      :dirty="dirty"
      :pending="pending"
      :error="error"
      :cancel-label="t('common.cancel')"
      @update:visible="(value: boolean) => { if (!value) close() }"
      @submit="submit"
    >
      <BsText>{{ selected?.id }}</BsText>
      <BsText v-if="dialogMode === 'support'" wrap="preserve">{{ selected?.customer_message }}</BsText>
      <BsText v-if="dialogMode === 'subscription'">{{ t('admin.currentPlan') }}: <BsText as="strong">{{ planName(selected?.plan_key) }}</BsText></BsText>
      <template v-if="dialogMode === 'payment'">
        <BsButton type="button" :disabled="pending" @click="inspectReceipt">{{ t('admin.inspect') }}</BsButton>
        <BsLink v-if="receiptUrl" :to="receiptUrl" target="_blank" rel="noopener noreferrer">{{ t('admin.openReceipt') }}</BsLink>
        <BsFloatingField v-if="role === 'billing_operator' || isPlatformAdmin" :label="t('admin.action')">
          <BsSelect v-model="action" :disabled="pending" native>
            <BsSelectOption v-for="state in ['under_review', 'approved', 'rejected']" :key="state" :value="state">{{ t(`billing.manual.states.${state}`) }}</BsSelectOption>
          </BsSelect>
        </BsFloatingField>
      </template>
      <BsFloatingField v-else-if="dialogMode === 'access'" :label="t('admin.action')">
        <BsSelect v-model="action" :disabled="pending" native>
          <BsSelectOption value="suspend">{{ t('admin.suspend') }}</BsSelectOption>
          <BsSelectOption value="reactivate">{{ t('admin.reactivate') }}</BsSelectOption>
        </BsSelect>
      </BsFloatingField>
      <template v-else-if="dialogMode === 'subscription'">
        <BsText v-if="planCatalogError" role="alert" tone="danger">{{ t('billing.plans.loadFailed') }}</BsText>
        <BsFloatingField :label="t('admin.targetPlan')">
          <BsSelect v-model="targetPlanKey" :disabled="pending || planCatalogPending || !!planCatalogError" native>
            <BsSelectOption v-for="plan in purchasablePlans" :key="plan.plan_key" :value="plan.plan_key">{{ planName(plan.plan_key) }}</BsSelectOption>
          </BsSelect>
        </BsFloatingField>
      </template>
      <BsFloatingField v-else :label="t('admin.action')">
        <BsSelect v-model="action" :disabled="pending" native>
          <BsSelectOption v-for="item in ['start', 'wait_customer', 'resolve', 'close', 'reopen', 'remind']" :key="item" :value="item">{{ t(`admin.supportActions.${item}`) }}</BsSelectOption>
        </BsSelect>
      </BsFloatingField>
      <template v-if="dialogMode !== 'payment' || role === 'billing_operator' || isPlatformAdmin">
        <BsFloatingField :label="t(dialogMode === 'payment' ? 'admin.paymentReason' : 'admin.reason')">
          <BsTextarea v-model="reason" required maxlength="1000" :disabled="pending" />
        </BsFloatingField>
        <BsFloatingField :label="t('admin.context')">
          <BsTextarea v-model="context" required maxlength="1000" :disabled="pending" />
        </BsFloatingField>
      </template>
      <template #actions="{ close: dismiss }">
        <BsButton type="button" :disabled="pending" @click="dismiss">{{ t('common.cancel') }}</BsButton>
        <BsButton
          v-if="dialogMode !== 'payment' || role === 'billing_operator' || isPlatformAdmin"
          type="submit"
          variant="primary"
          :pending="pending"
          :disabled="!reason.trim() || !context.trim()"
        >{{ t('admin.submit') }}</BsButton>
      </template>
    </BsRecordActionDialog>
  </BsAppShell>
</template>
