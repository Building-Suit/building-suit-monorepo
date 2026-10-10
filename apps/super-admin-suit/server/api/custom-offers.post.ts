import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '../../app/types/database.types'
import { AdminAccessError, authorizeAdmin } from '../utils/authorize'
import { invokeShopAdapter, parseAdapterInput } from '../utils/shop-adapter'
import type { SignedAttempt } from '../utils/shop-adapter'
import { sendAdapterAttempt } from '../utils/adapter-transport'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  setHeader(event, 'Vary', 'Cookie')
  try {
    const client = await serverSupabaseClient<Database>(event)
    const actor = await authorizeAdmin(client)
    const input = await readBody(event) as Record<string, unknown>
    interface RpcClient { rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }> }
    const db = client as unknown as RpcClient
    const read = input?.action === 'read'
    if (read && (Object.keys(input).sort().join() !== 'action,bindingId' || typeof input.bindingId !== 'string')) throw createError({ statusCode: 400 })
    const { data, error } = await db.rpc(read ? 'super_admin_custom_offers_read' : 'super_admin_custom_offer_command', read ? { p_binding_id: input.bindingId } : { p_input: input })
    if (error) throw createError({ statusCode: error.code === '42501' ? 403 : error.code === '22023' ? 400 : 503,
      data: { code: error.message === 'SHOP_SECURE_REDEMPTION_CONTRACT_REQUIRED' ? 'secure_redemption_unavailable' : 'offer_command_unavailable' } })
    const descriptor = data as { dispatchId?: string; dispatchInput?: unknown; redemptionToken?: string; targetState?: string }
    if (!read && descriptor?.dispatchId && !descriptor.targetState) {
      const dispatchInput = parseAdapterInput(descriptor.dispatchInput)
      const service = serverSupabaseServiceRole(event) as unknown as RpcClient
      const call = async (name: string, args: Record<string, unknown>) => {
        const response = await service.rpc(name, args)
        if (response.error) throw createError({ statusCode: 503, statusMessage: 'Offer dispatch unavailable' })
        return response.data
      }
      await invokeShopAdapter(dispatchInput, actor.authorityEnvironmentId, {
        enqueue: async () => descriptor.dispatchId!,
        claim: async id => await call('super_admin_adapter_claim', { p_dispatch_id: id }) as SignedAttempt,
        complete: (id, response) => call('super_admin_adapter_complete', { p_attempt_id: id, p_response: response }),
      }, sendAdapterAttempt)
      // Re-read the same authenticated command; only durable verified target receipts count.
      const confirmed = await db.rpc('super_admin_custom_offer_command', { p_input: input })
      if (confirmed.error) throw createError({ statusCode: 503, statusMessage: 'Offer confirmation unavailable' })
      return confirmed.data
    }
    return data
  } catch (error) {
    if (error instanceof AdminAccessError) throw createError({ statusCode: error.statusCode, statusMessage: 'Access unavailable' })
    if ((error as { statusCode?: number }).statusCode) throw error
    throw createError({ statusCode: 503, statusMessage: 'Offer unavailable' })
  }
})
