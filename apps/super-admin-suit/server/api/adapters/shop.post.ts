import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '../../../app/types/database.types'
import { AdminAccessError, authorizeAdmin } from '../../utils/authorize'
import { AdapterError, invokeShopAdapter, parseAdapterInput } from '../../utils/shop-adapter'
import type { SignedAttempt } from '../../utils/shop-adapter'
import { sendAdapterAttempt } from '../../utils/adapter-transport'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  setHeader(event, 'Vary', 'Cookie')
  let requestId: string | undefined
  let correlationId: string | undefined
  try {
    const client = await serverSupabaseClient<Database>(event)
    const actor = await authorizeAdmin(client)
    const input = parseAdapterInput(await readBody(event))
    requestId = input.requestId
    correlationId = input.correlationId
    // JSON-returning RPCs remain app-owned; no generated schema artifact is hand-edited.
    interface RpcClient { rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }> }
    const call = async (db: RpcClient, name: string, args: Record<string, unknown>) => {
      const { data, error } = await db.rpc(name, args)
      if (error) {
        const code = error.message === 'CAPABILITY_UNAVAILABLE' ? 'capability_unavailable'
          : error.message === 'ENVIRONMENT_MISMATCH' ? 'environment_mismatch'
            : error.message === 'IDEMPOTENCY_KEY_REUSED' ? 'invalid_request'
              : error.code === '42501' ? 'access_denied' : 'configuration_unavailable'
        throw new AdapterError(code)
      }
      return data
    }
    const userDb = client as unknown as RpcClient
    return await invokeShopAdapter(input, actor.authorityEnvironmentId, {
      enqueue: async value => await call(userDb, 'super_admin_adapter_enqueue', { p_input: value }) as string,
      claim: async id => await call(serverSupabaseServiceRole(event) as unknown as RpcClient, 'super_admin_adapter_claim', { p_dispatch_id: id }) as SignedAttempt,
      complete: async (id, response) => call(serverSupabaseServiceRole(event) as unknown as RpcClient, 'super_admin_adapter_complete', { p_attempt_id: id, p_response: response }),
    }, sendAdapterAttempt)
  } catch (error) {
    const code = error instanceof AdapterError ? error.code : 'configuration_unavailable'
    throw createError({ statusCode: error instanceof AdminAccessError ? error.statusCode : code === 'invalid_request' ? 400 : code === 'access_denied' ? 403 : 503,
      statusMessage: 'Adapter unavailable', data: { code, requestId, correlationId } })
  }
})
