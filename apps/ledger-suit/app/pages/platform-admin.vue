<script setup lang="ts">
import type { AdminResource, AdminRow } from '~/composables/usePlatformAdmin'

definePageMeta({ layout: false })
const { t } = useI18n()
const client = useSupabaseClient()
const user = useSupabaseUser()
const { role, rows, pending, error, denied, load, review, receipt } = usePlatformAdmin()
const resource = ref<AdminResource>('status')
const resources: AdminResource[] = ['status', 'users', 'organizations', 'subscriptions', 'payments', 'support', 'audit']
const offset = ref(0)
const selected = shallowRef<AdminRow | null>(null)
const action = ref('under_review')
const reason = ref('')
const context = ref('')
const success = ref(false)
const receiptUrl = ref('')
let receiptTimer: ReturnType<typeof setTimeout> | undefined
let commandId = ''
let commandPayload = ''
const { dirty, markSaved } = useRecordAction(() => ({ action: action.value, reason: reason.value, context: context.value }), computed(() => !!selected.value))
const fields: Record<AdminResource, string[]> = {
  users: ['id', 'email', 'full_name', 'created_at'],
  organizations: ['id', 'name', 'status', 'created_at'],
  subscriptions: ['id', 'organization_id', 'plan_key', 'status', 'provider', 'billing_interval', 'current_period_end', 'trial_ends_at'],
  payments: ['id', 'organization_id', 'plan_key', 'amount_minor', 'currency_code', 'status', 'evidence_id', 'period_end'],
  audit: ['occurred_at', 'actor_id', 'actor_role', 'operation', 'target_id', 'command_id', 'outcome', 'reason', 'context', 'error_code', 'before_state', 'after_state'],
  status: ['checked_at', 'pending_payments', 'unprocessed_billing_events', 'failed_billing_events', 'support_available'],
  support: [],
}
const columns = computed(() => fields[resource.value].map(field => ({ field, header: t(`admin.fields.${field}`) })))
useHead({ title: () => `${t('admin.title')} · ${t('app.name')}` })
function clearReceipt() { receiptUrl.value = ''; clearTimeout(receiptTimer) }
function close() { selected.value = null; clearReceipt(); reason.value = ''; context.value = ''; commandId = ''; commandPayload = '' }
watch(() => user.value?.id, () => { close(); success.value = false }, { flush: 'sync' })
watch(denied, value => { if (value) close() })
onBeforeUnmount(clearReceipt)
onMounted(() => load(resource.value))
async function refresh() { success.value = false; await load(resource.value, offset.value) }
async function changeResource() { offset.value = 0; await refresh() }
async function page(delta: number) { offset.value = Math.max(0, offset.value + delta); await refresh() }
function open(row: AdminRow) {
  close(); selected.value = row; action.value = 'under_review'; success.value = false; markSaved()
}
async function inspect() {
  if (!selected.value) return
  clearReceipt()
  const url = await receipt(selected.value.id)
  if (url) { receiptUrl.value = url; receiptTimer = setTimeout(clearReceipt, 60000) }
}
async function submit() {
  if (!selected.value || !reason.value.trim() || !context.value.trim()) return
  if (!(await useConfirmation().ask(t('admin.confirm')))) return
  if (!selected.value) return
  const payload = JSON.stringify([selected.value.id, selected.value.evidence_id, action.value, reason.value, context.value])
  // Retain the key on ambiguous network failures; changed input is a new command.
  if (payload !== commandPayload) { commandId = crypto.randomUUID(); commandPayload = payload }
  const done = await review({ id: commandId, requestId: selected.value.id, evidenceId: String(selected.value.evidence_id), action: action.value, reason: reason.value, context: context.value })
  if (done) { markSaved(); close(); await load(resource.value, offset.value); success.value = true }
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
        <button type="button" class="ls-btn" :disabled="pending" @click="refresh">{{ t('common.refresh') }}</button>
      </div>
      <p v-if="pending" role="status">{{ t('app.loading') }}</p>
      <p v-else-if="!error && resource === 'support'">{{ t('admin.supportUnavailable') }}</p>
      <p v-else-if="!error && !rows.length">{{ t('admin.empty') }}</p>
      <BsDataTable v-if="rows.length && !denied" :value="rows" data-key="id" :loading="pending">
        <Column v-for="column in columns" :key="column.field" :field="column.field" :header="column.header">
          <template #body="{ data }"><pre v-if="column.field.endsWith('_state')" class="max-w-80 overflow-auto text-xs" dir="ltr">{{ display(data[column.field]) }}</pre><span v-else class="break-words">{{ display(data[column.field]) }}</span></template>
        </Column>
        <Column v-if="resource === 'payments'" :header="t('admin.review')"><template #body="{ data }"><button v-if="data.evidence_id" type="button" class="ls-btn" :disabled="pending" @click="open(data)">{{ t('admin.review') }}</button></template></Column>
      </BsDataTable>
      <div v-if="role && !['status', 'support'].includes(resource)" class="flex gap-3">
        <button type="button" class="ls-btn" :disabled="pending || offset === 0" @click="page(-50)">{{ t('admin.previous') }}</button>
        <button type="button" class="ls-btn" :disabled="pending || rows.length < 50 || offset >= 100000" @click="page(50)">{{ t('admin.next') }}</button>
      </div>
    </div>
    <BsDialog :visible="!!selected" :title="t('admin.review')" :dirty="dirty" :pending="pending" @update:visible="value => { if (!value) close() }">
      <form class="space-y-4 p-4" @submit.prevent="submit">
        <p class="break-all">{{ selected?.id }}</p>
        <p v-if="error" role="alert" class="ls-error">{{ error }}</p>
        <button type="button" class="ls-btn" :disabled="pending" @click="inspect">{{ t('admin.inspect') }}</button>
        <a v-if="receiptUrl" :href="receiptUrl" target="_blank" rel="noopener noreferrer" class="block text-link">{{ t('admin.openReceipt') }}</a>
        <template v-if="role === 'billing_operator'">
          <FloatingField :label="t('admin.action')"><select v-model="action" class="ls-input" :disabled="pending"><option v-for="state in ['under_review', 'approved', 'rejected']" :key="state" :value="state">{{ t(`billing.manual.states.${state}`) }}</option></select></FloatingField>
          <FloatingField :label="t('admin.reason')"><textarea v-model="reason" class="ls-input" required maxlength="1000" :disabled="pending" /></FloatingField>
          <FloatingField :label="t('admin.context')"><textarea v-model="context" class="ls-input" required maxlength="1000" :disabled="pending" /></FloatingField>
          <button type="submit" class="ls-btn ls-btn-primary" :disabled="pending || !reason.trim() || !context.trim()">{{ t('admin.submit') }}</button>
        </template>
      </form>
    </BsDialog>
  </BsAppShell>
</template>
