<script setup lang="ts">
import type { BsAdminOperatorForm, BsAdminResourceView, BsPlatformAdministrationCopy, BsAdminStandaloneShell } from '@building-suit/ui/types/platformAdministrationPresentation'
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
const receiptState = useExpiringValue('', 60000)
const receiptUrl = receiptState.value
const { data: planCatalog, pending: planCatalogPending, error: planCatalogError } = await useAsyncData(
  'launch-plan-catalog',
  async () => {
    const { data, error } = await catalogClient.rpc('subscription_plan_catalog')
    if (error) throw error
    return data
  },
)
const purchasablePlans = computed(() => (planCatalog.value ?? []).filter(plan => plan.is_purchasable))
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
const isPlatformAdmin = computed(() => role.value === 'platform_admin')
const dialogTitle = computed(() => t(`admin.dialogs.${dialogMode.value}`))
useHead({ title: () => `${t('admin.title')} · ${t('app.name')}` })

function clearReceipt() { receiptState.clear() }
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
  const id = selected.value.id
  await receiptState.load(async () => (await receipt(id)) || '')
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

const operatorForm = computed<BsAdminOperatorForm>({ get: () => ({ action: action.value, targetPlan: targetPlanKey.value, reason: reason.value, context: context.value }), set: value => { action.value = value.action; targetPlanKey.value = value.targetPlan; reason.value = value.reason; context.value = value.context } })
const presentationCopy = computed<BsPlatformAdministrationCopy>(() => ({
  title: t('admin.title'), subtitle: t('admin.subtitle'), saved: t('admin.saved'), view: t('admin.view'), search: t('admin.search'), filter: t('admin.filter'), apply: t('admin.apply'), clear: t('admin.clear'), refresh: t('common.refresh'), loading: t('app.loading'), empty: t('admin.empty'), scoped: t('admin.scopedResults'), memberships: t('admin.memberships'), review: t('admin.review'), manage: t('admin.manage'), previous: t('admin.previous'), next: t('admin.next'), action: t('admin.action'), targetPlan: t('admin.targetPlan'), currentPlan: t('admin.currentPlan'), inspect: t('admin.inspect'), openReceipt: t('admin.openReceipt'), reason: t(dialogMode.value === 'payment' ? 'admin.paymentReason' : 'admin.reason'), context: t('admin.context'), cancel: t('common.cancel'), submit: t('admin.submit'),
}))
const shell = computed<BsAdminStandaloneShell>(() => ({ productName: t('admin.title'), homePath: '/platform-admin', groups: [], labels: { close: t('nav.close'), open: t('nav.open'), navigation: t('nav.primary'), dashboard: t('admin.title') }, account: { email: user.value?.email, label: t('common.accountMenu'), signOut: t('common.signOut') }, logo: { kind: 'product', assetPrefix: '/brand/ledger-suit' } }))
const resourceView = computed<BsAdminResourceView>(() => {
  const canSubmit = dialogMode.value !== 'payment' || role.value === 'billing_operator' || isPlatformAdmin.value
  const actionValues = dialogMode.value === 'payment' ? ['under_review', 'approved', 'rejected'] : dialogMode.value === 'access' ? ['suspend', 'reactivate'] : dialogMode.value === 'support' ? ['start', 'wait_customer', 'resolve', 'close', 'reopen', 'remind'] : []
  return {
    pending: pending.value, denied: denied.value, error: error.value, success: success.value, role: role.value ? t(`admin.roles.${role.value}`) : '', selected: resource.value, resources: resources.map(value => ({ value, label: t(`admin.views.${value}`) })), search: search.value, status: status.value, statusChoices: filterOptions[resource.value]?.length ? [{ value: '', label: t('admin.allStates') }, ...(filterOptions[resource.value] ?? []).map(value => ({ value, label: t(`admin.states.${value}`, value) }))] : [], showSearch: resource.value !== 'status', clearable: resource.value !== 'status' && !!(search.value || status.value || targetId.value), scoped: !!targetId.value,
    columns: fields[resource.value].map(key => ({ key, header: t(`admin.fields.${key}`), code: key.endsWith('_state') })),
    rows: rows.value.map(row => ({ id: row.id, values: Object.fromEntries(fields[resource.value].map(key => [key, key === 'plan_key' ? planName(row[key]) : display(row[key])])), memberships: resource.value === 'users' || resource.value === 'organizations', access: resource.value === 'organizations' && isPlatformAdmin.value ? { label: t(row.operator_suspended ? 'admin.reactivate' : 'admin.suspend'), disabled: false } : undefined, correction: resource.value === 'subscriptions' && isPlatformAdmin.value ? { label: t('admin.correction'), disabled: row.provider !== 'manual' } : undefined, review: resource.value === 'payments' && !!row.evidence_id, support: resource.value === 'support' && isPlatformAdmin.value })),
    paginated: !!role.value && resource.value !== 'status', previousDisabled: pending.value || offset.value === 0, nextDisabled: pending.value || rows.value.length < 50 || offset.value >= 100000,
    dialog: { visible: !!selected.value, title: dialogTitle.value, recordId: selected.value?.id ?? '', message: dialogMode.value === 'support' ? String(selected.value?.customer_message ?? '') : '', currentPlan: dialogMode.value === 'subscription' ? planName(selected.value?.plan_key) : '', dirty: dirty.value, pending: pending.value, error: error.value, canSubmit, showContext: true, actionChoices: (canSubmit ? actionValues : []).map(value => ({ value, label: dialogMode.value === 'payment' ? t(`billing.manual.states.${value}`) : dialogMode.value === 'support' ? t(`admin.supportActions.${value}`) : t(`admin.${value}`) })), planChoices: purchasablePlans.value.map(plan => ({ value: plan.plan_key, label: planName(plan.plan_key) })), planPending: planCatalogPending.value, planError: planCatalogError.value ? t('billing.plans.loadFailed') : '', showPlan: dialogMode.value === 'subscription', showReceipt: dialogMode.value === 'payment', receiptUrl: receiptUrl.value },
  }
})
async function selectResource(value: string) { if (!resources.includes(value as AdminResource)) return; resource.value = value as AdminResource; await changeResource() }
function openById(id: string, mode: DialogMode) { const row = rows.value.find(item => item.id === id); if (row) open(row, mode) }
async function membershipsById(id: string) { const row = rows.value.find(item => item.id === id); if (row) await inspectMemberships(row) }
</script>
<template>
  <BsPlatformAdministrationPage v-model:form="operatorForm" :copy="presentationCopy" :resource="resourceView" :shell="shell" @sign-out="signOut" @resource="selectResource" @search="search = $event" @status="status = $event" @apply="applyFilters" @clear="clearFilters" @refresh="refresh" @page="page" @memberships="membershipsById" @open="openById" @close="close" @inspect-receipt="inspectReceipt" @submit="submit"/>
</template>
