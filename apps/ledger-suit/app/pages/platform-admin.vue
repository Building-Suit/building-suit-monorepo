<script setup lang="ts">
import type { AdminResource, AdminRow } from '~/composables/usePlatformAdmin'

definePageMeta({ layout: false })
type DialogMode = 'payment' | 'access' | 'subscription' | 'support'
const { t } = useI18n()
const client = useSupabaseClient()
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
  support: ['organization_name', 'requester_email', 'subject', 'status', 'priority', 'reminder_count', 'reminder_delivery_status', 'updated_at'],
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
</script>

<template>
  <BsAppShell home-path="/platform-admin" :product-name="t('admin.title')" :groups="[]" :labels="{ close: t('nav.close'), open: t('nav.open'), navigation: t('nav.primary'), dashboard: t('admin.title') }">
    <template #logo><AppLogo class="h-14 w-auto max-w-52" /></template>
    <template #header><SettingsMenu /><button type="button" class="ls-btn" @click="signOut">{{ t('common.signOut') }}</button></template>
    <div class="space-y-4">
      <h1 class="text-h1 font-bold">{{ t('admin.title') }}</h1>
      <p class="text-fg-muted">{{ t('admin.subtitle') }}</p>
      <p v-if="role" role="status">{{ t(`admin.roles.${role}`) }}</p>
      <p v-if="error" class="ls-error" role="alert">{{ error }}</p>
      <p v-if="success" role="status">{{ t('admin.saved') }}</p>
      <div class="flex flex-wrap items-end gap-3">
        <FloatingField :label="t('admin.view')"><select v-model="resource" class="ls-input" :disabled="pending || denied" @change="changeResource"><option v-for="view in resources" :key="view" :value="view">{{ t(`admin.views.${view}`) }}</option></select></FloatingField>
        <FloatingField v-if="resource !== 'status'" :label="t('admin.search')"><input v-model="search" class="ls-input" maxlength="100" :disabled="pending || denied" @keyup.enter="applyFilters"></FloatingField>
        <FloatingField v-if="filterOptions[resource]?.length" :label="t('admin.filter')"><select v-model="status" class="ls-input" :disabled="pending || denied"><option value="">{{ t('admin.allStates') }}</option><option v-for="item in filterOptions[resource]" :key="item" :value="item">{{ t(`admin.states.${item}`, item) }}</option></select></FloatingField>
        <button v-if="resource !== 'status'" type="button" class="ls-btn" :disabled="pending" @click="applyFilters">{{ t('admin.apply') }}</button>
        <button v-if="resource !== 'status' && (search || status || targetId)" type="button" class="ls-btn" :disabled="pending" @click="clearFilters">{{ t('admin.clear') }}</button>
        <button type="button" class="ls-btn" :disabled="pending" @click="refresh">{{ t('common.refresh') }}</button>
      </div>
      <p v-if="targetId" class="text-sm text-fg-muted">{{ t('admin.scopedResults') }}</p>
      <p v-if="pending" role="status">{{ t('app.loading') }}</p>
      <p v-else-if="!error && !rows.length">{{ t('admin.empty') }}</p>
      <BsDataTable v-if="rows.length && !denied" :value="rows" data-key="id" :loading="pending">
        <Column v-for="column in columns" :key="column.field" :field="column.field" :header="column.header">
          <template #body="{ data }"><pre v-if="column.field.endsWith('_state')" class="max-w-80 overflow-auto text-xs" dir="ltr">{{ display(data[column.field]) }}</pre><span v-else class="break-words">{{ display(data[column.field]) }}</span></template>
        </Column>
        <Column v-if="resource === 'users' || resource === 'organizations'" :header="t('admin.memberships')"><template #body="{ data }"><button type="button" class="ls-btn" :disabled="pending" @click="inspectMemberships(data)">{{ t('admin.memberships') }}</button></template></Column>
        <Column v-if="resource === 'organizations' && isPlatformAdmin" :header="t('admin.access')"><template #body="{ data }"><button type="button" class="ls-btn" :disabled="pending" @click="open(data, 'access')">{{ data.operator_suspended ? t('admin.reactivate') : t('admin.suspend') }}</button></template></Column>
        <Column v-if="resource === 'subscriptions' && isPlatformAdmin" :header="t('admin.correction')"><template #body="{ data }"><button type="button" class="ls-btn" :disabled="pending || data.provider !== 'manual'" @click="open(data, 'subscription')">{{ t('admin.correction') }}</button></template></Column>
        <Column v-if="resource === 'payments'" :header="t('admin.review')"><template #body="{ data }"><button v-if="data.evidence_id" type="button" class="ls-btn" :disabled="pending" @click="open(data, 'payment')">{{ t('admin.review') }}</button></template></Column>
        <Column v-if="resource === 'support' && isPlatformAdmin" :header="t('admin.manage')"><template #body="{ data }"><button type="button" class="ls-btn" :disabled="pending" @click="open(data, 'support')">{{ t('admin.manage') }}</button></template></Column>
      </BsDataTable>
      <div v-if="role && resource !== 'status'" class="flex gap-3">
        <button type="button" class="ls-btn" :disabled="pending || offset === 0" @click="page(-50)">{{ t('admin.previous') }}</button>
        <button type="button" class="ls-btn" :disabled="pending || rows.length < 50 || offset >= 100000" @click="page(50)">{{ t('admin.next') }}</button>
      </div>
    </div>
    <BsDialog :visible="!!selected" :title="dialogTitle" :dirty="dirty" :pending="pending" @update:visible="value => { if (!value) close() }">
      <form class="space-y-4 p-4" @submit.prevent="submit">
        <p class="break-all">{{ selected?.id }}</p>
        <p v-if="dialogMode === 'support'" class="whitespace-pre-wrap rounded bg-surface-muted p-3">{{ selected?.customer_message }}</p>
        <p v-if="dialogMode === 'subscription'">{{ t('admin.currentPlan') }}: <strong>{{ display(selected?.plan_key) }}</strong></p>
        <p v-if="error" role="alert" class="ls-error">{{ error }}</p>
        <template v-if="dialogMode === 'payment'">
          <button type="button" class="ls-btn" :disabled="pending" @click="inspectReceipt">{{ t('admin.inspect') }}</button>
          <a v-if="receiptUrl" :href="receiptUrl" target="_blank" rel="noopener noreferrer" class="block text-link">{{ t('admin.openReceipt') }}</a>
          <FloatingField v-if="role === 'billing_operator' || isPlatformAdmin" :label="t('admin.action')"><select v-model="action" class="ls-input" :disabled="pending"><option v-for="state in ['under_review', 'approved', 'rejected']" :key="state" :value="state">{{ t(`billing.manual.states.${state}`) }}</option></select></FloatingField>
        </template>
        <FloatingField v-else-if="dialogMode === 'access'" :label="t('admin.action')"><select v-model="action" class="ls-input" :disabled="pending"><option value="suspend">{{ t('admin.suspend') }}</option><option value="reactivate">{{ t('admin.reactivate') }}</option></select></FloatingField>
        <FloatingField v-else-if="dialogMode === 'subscription'" :label="t('admin.targetPlan')"><select v-model="targetPlanKey" class="ls-input" :disabled="pending"><option v-for="plan in ['solo', 'starter', 'business']" :key="plan" :value="plan">{{ plan }}</option></select></FloatingField>
        <FloatingField v-else :label="t('admin.action')"><select v-model="action" class="ls-input" :disabled="pending"><option v-for="item in ['start', 'wait_customer', 'resolve', 'close', 'reopen', 'remind']" :key="item" :value="item">{{ t(`admin.supportActions.${item}`) }}</option></select></FloatingField>
        <template v-if="dialogMode !== 'payment' || role === 'billing_operator' || isPlatformAdmin">
          <FloatingField :label="t(dialogMode === 'payment' ? 'admin.paymentReason' : 'admin.reason')"><textarea v-model="reason" class="ls-input" required maxlength="1000" :disabled="pending" /></FloatingField>
          <FloatingField :label="t('admin.context')"><textarea v-model="context" class="ls-input" required maxlength="1000" :disabled="pending" /></FloatingField>
          <button type="submit" class="ls-btn ls-btn-primary" :disabled="pending || !reason.trim() || !context.trim()">{{ t('admin.submit') }}</button>
        </template>
      </form>
    </BsDialog>
  </BsAppShell>
</template>
