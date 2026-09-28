import type { Json } from '~~/types/database.types'
import type { PlatformAdminDatabase } from '~~/types/platform-admin.types'

export type AdminResource = 'users' | 'organizations' | 'memberships' | 'subscriptions' | 'payments' | 'audit' | 'status' | 'support'
export type AdminRow = { id: string, [key: string]: Json | undefined }
type Envelope = { ok: boolean, error?: string, data?: Json }
export type AdminQuery = { offset?: number, search?: string, status?: string, targetId?: string }
export type AdminCommand = { id: string, targetId: string, action?: string, targetPlanKey?: string, reason: string, context: string }

export function usePlatformAdmin() {
  const client = useSupabaseClient<PlatformAdminDatabase>()
  const user = useSupabaseUser()
  const role = ref<string | null>(null)
  const rows = shallowRef<AdminRow[]>([])
  const pending = ref(false)
  const error = ref('')
  const denied = ref(false)
  const { t } = useI18n()
  let generation = 0
  let disposed = false
  // No global cache or persistent table state. In-flight responses cannot restore
  // another session's data after a sign-out, account switch or component disposal.
  function reset() { generation++; role.value = null; rows.value = []; error.value = ''; denied.value = false; pending.value = false }
  watch(() => user.value?.id, reset, { flush: 'sync' })
  onBeforeUnmount(() => { disposed = true; reset() })
  async function run<T>(work: () => Promise<T>): Promise<T | undefined> {
    if (pending.value || disposed) return
    const version = generation
    pending.value = true; error.value = ''
    try {
      const result = await work()
      if (version === generation && !disposed) return result
    } catch (failure) {
      if (version === generation && !disposed) {
        const code = failure instanceof Error ? failure.message : ''
        denied.value = code === 'OPERATOR_REQUIRED'
        if (denied.value) { role.value = null; rows.value = [] }
        error.value = t(denied.value ? 'admin.denied' : 'admin.failed')
      }
    } finally { if (version === generation && !disposed) pending.value = false }
  }
  function unwrap(data: Json | null, error: unknown): Json {
    if (error || !data || typeof data !== 'object' || Array.isArray(data)) throw new Error('ADMIN_FAILED')
    const result = data as Envelope
    if (!result.ok) throw new Error(result.error ?? 'ADMIN_FAILED')
    return result.data ?? null
  }
  async function load(resource: AdminResource, query: AdminQuery = {}) {
    rows.value = []
    const result = await run(async () => {
      const identity = await client.rpc('platform_admin_read', { p_resource: 'identity' })
      const info = unwrap(identity.data, identity.error) as Array<{ role: string }>
      const response = await client.rpc('platform_admin_read', {
        p_resource: resource, p_offset: query.offset ?? 0, p_limit: 50,
        p_search: query.search?.trim() || undefined, p_status: query.status || undefined,
        p_target_id: query.targetId || undefined,
      })
      return { role: info[0]!.role, rows: unwrap(response.data, response.error) as AdminRow[] }
    })
    if (result) { role.value = result.role; rows.value = result.rows; denied.value = false }
  }
  async function review(command: { id: string, requestId: string, evidenceId: string, action: string, reason: string, context: string }) {
    return run(async () => {
      const result = await client.rpc('platform_admin_review_payment', {
        p_command_id: command.id, p_request_id: command.requestId, p_evidence_id: command.evidenceId,
        p_action: command.action, p_reason: command.reason, p_context: command.context,
      })
      unwrap(result.data, result.error)
      return true
    })
  }
  async function setAccess(command: AdminCommand) {
    return run(async () => {
      const result = await client.rpc('platform_admin_set_access', {
        p_command_id: command.id, p_organization_id: command.targetId, p_action: command.action!,
        p_reason: command.reason, p_context: command.context,
      })
      unwrap(result.data, result.error)
      return true
    })
  }
  async function correctSubscription(command: AdminCommand) {
    return run(async () => {
      const result = await client.rpc('platform_admin_correct_subscription', {
        p_command_id: command.id, p_organization_id: command.targetId, p_target_plan_key: command.targetPlanKey!,
        p_reason: command.reason, p_context: command.context,
      })
      unwrap(result.data, result.error)
      return true
    })
  }
  async function updateSupport(command: AdminCommand) {
    return run(async () => {
      const result = await client.rpc('platform_admin_update_support', {
        p_command_id: command.id, p_request_id: command.targetId, p_action: command.action!,
        p_reason: command.reason, p_context: command.context,
      })
      unwrap(result.data, result.error)
      return true
    })
  }
  async function receipt(requestId: string) {
    return run(async () => {
      const result = await client.functions.invoke('platform-admin-receipt', { body: { requestId } })
      if (result.error || !result.data?.url) throw new Error('ADMIN_FAILED')
      return result.data.url as string
    })
  }
  return { role, rows, pending, error, denied, load, review, setAccess, correctSubscription, updateSupport, receipt }
}
