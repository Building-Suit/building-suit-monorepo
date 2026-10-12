import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '../../app/types/database.types'
import type { AuditStream } from '../../app/utils/activity'
import { AdminAccessError, authorizeAdmin } from '../utils/authorize'
import { retrieveAuditPage } from '../utils/activity'
import { adminRpc } from '../utils/admin-rpc'
import type { AdminRpcClient } from '../utils/admin-rpc'
import type { SignedAttempt } from '../utils/shop-adapter'
import { sendAdapterAttempt } from '../utils/adapter-transport'
export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'private, no-store'); setHeader(event, 'Vary', 'Cookie')
  try {
    const client = await serverSupabaseClient<Database>(event)
    const actor = await authorizeAdmin(client)
    const input = await readBody(event)
    if (!input || typeof input !== 'object' || Array.isArray(input) || typeof input.bindingId !== 'string' || typeof input.stream !== 'string' || Object.keys(input).sort().join(',') !== 'bindingId,stream' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.bindingId) || !['platform', 'billing', 'plan'].includes(input.stream)) throw createError({ statusCode: 400, statusMessage: 'Invalid audit source' })
    const db = client as unknown as AdminRpcClient
    const service = () => serverSupabaseServiceRole(event) as unknown as AdminRpcClient
    const result = await retrieveAuditPage(input.bindingId, input.stream as AuditStream, actor.authorityEnvironmentId, {
      context: async (bindingId, stream) => await adminRpc(db, 'super_admin_activity_context', { p_binding: bindingId, p_stream: stream }) as { page: number; pageSize: number },
      save: async (bindingId, projection, requestId) => { await adminRpc(service(), 'super_admin_activity_observe', { p_binding: bindingId, p_request: requestId, p_projection: projection }) },
      failed: async (bindingId, stream) => { await adminRpc(db, 'super_admin_activity_failure', { p_binding: bindingId, p_stream: stream }) },
    }, {
      enqueue: async value => await adminRpc(db, 'super_admin_adapter_enqueue', { p_input: value }) as string,
      claim: async id => await adminRpc(service(), 'super_admin_adapter_claim', { p_dispatch_id: id }) as SignedAttempt,
      complete: async (id, response) => adminRpc(service(), 'super_admin_adapter_complete', { p_attempt_id: id, p_response: response }),
    }, sendAdapterAttempt)
    if (result.status === 'unavailable') setResponseStatus(event, 503)
    return result
  } catch (error) {
    if (error instanceof AdminAccessError) throw createError({ statusCode: error.statusCode, statusMessage: error.message })
    if (isError(error)) throw error
    throw createError({ statusCode: 503, statusMessage: 'Activity unavailable' })
  }
})
