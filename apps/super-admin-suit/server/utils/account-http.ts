import type { H3Event } from 'h3'
import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import type { ActorClient } from './account-workflow'
import type { RpcClient } from './adapter-dispatch'
import { AdminAccessError, authorizeAdmin } from './authorize'
import { ActivationInputError } from './trial-activation'
import { ProvisioningInputError } from './account-provisioning'

export function privateAccountResponse(event: H3Event) {
  setHeader(event, 'Cache-Control', 'private, no-store')
  setHeader(event, 'Vary', 'Cookie')
}
export function requireAccountPost(event: H3Event) {
  if (getHeader(event, 'content-type')?.split(';')[0] !== 'application/json'
    || getHeader(event, 'origin') !== getRequestURL(event).origin) throw createError({ statusCode: 403, statusMessage: 'Request denied' })
}
export async function accountClients(event: H3Event) {
  const client = await serverSupabaseClient(event)
  await authorizeAdmin(client as unknown as ActorClient)
  // These are narrow runtime RPC contracts, not edits to generated database types.
  return { client: client as unknown as ActorClient, worker: serverSupabaseServiceRole(event) as unknown as RpcClient }
}
export function accountHttpError(error?: unknown) {
  if (error instanceof AdminAccessError) return createError({ statusCode: error.statusCode, statusMessage: error.message })
  if (error instanceof ActivationInputError) return createError({ statusCode: 400, statusMessage: 'Invalid activation request' })
  if (error instanceof ProvisioningInputError) return createError({ statusCode: 400, statusMessage: 'Invalid provisioning request' })
  return createError({ statusCode: 503, statusMessage: 'Account operation unavailable' })
}
