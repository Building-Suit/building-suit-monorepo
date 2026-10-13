import { authorizeAdmin } from './authorize.ts'
import { trialActivationCommand } from './trial-activation.ts'
import { dispatchRequest, type RpcClient } from './adapter-dispatch.ts'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function accountId(value: unknown): string {
  if (typeof value !== 'string' || !uuid.test(value)) throw new Error('Invalid account selection')
  return value
}
export interface AccountModule { bindingId: string; label: Record<string, string>; suitLabel: Record<string, string> }
export type ActorClient = Parameters<typeof authorizeAdmin>[0] & RpcClient

export async function accountContext(client: ActorClient) {
  const session = await authorizeAdmin(client)
  const registry = await client.rpc('super_admin_configuration_read', { p_resource: 'registry', p_id: null })
  if (registry.error) throw new Error('Account configuration unavailable')
  const projection = registry.data as { suits?: { label: Record<string, string>; items: { module: string; bindingId: string; label: Record<string, string> }[] }[] } | null
  const modules: AccountModule[] = []
  for (const suit of projection?.suits ?? []) {
    for (const item of suit.items ?? []) {
      if (item.module === 'accounts' && uuid.test(item.bindingId)) modules.push({ bindingId: item.bindingId, label: item.label, suitLabel: suit.label })
    }
  }
  return { session, modules }
}
async function requireBinding(client: ActorClient, bindingId: unknown) {
  const binding = accountId(bindingId)
  const { modules } = await accountContext(client)
  if (!modules.some(module => module.bindingId === binding)) throw new Error('Account capability unavailable')
  return binding
}

/** Queries use fresh logical request IDs; commands retain caller IDs on every retry. */
export async function accountQuery(client: ActorClient, worker: RpcClient, input: { bindingId: unknown; shopId?: unknown; page?: unknown }, send?: Parameters<typeof dispatchRequest>[3]) {
  const bindingId = await requireBinding(client, input.bindingId)
  const page = input.page === undefined ? 1 : Number(input.page)
  if (!Number.isInteger(page) || page < 1 || page > 100000) throw new Error('Invalid account page')
  const shopId = input.shopId === undefined ? null : accountId(input.shopId)
  const command = {
    bindingId, requestId: crypto.randomUUID(), correlationId: crypto.randomUUID(), reason: null,
    operation: shopId ? 'shop.plan.query' : 'shop.platform.query',
    payload: shopId ? { resource: 'shop', shopId, page: 1, pageSize: 100 } : { resource: 'shops', page, pageSize: 50 },
  }
  const result = await dispatchRequest(client, worker, command, send)
  if (!shopId || result.state !== 'success') return result
  const catalog = await dispatchRequest(client, worker, {
    bindingId, requestId: crypto.randomUUID(), correlationId: crypto.randomUUID(), reason: null,
    operation: 'shop.plan.query', payload: { resource: 'catalog', page: 1, pageSize: 100 },
  }, send)
  if (catalog.state !== 'success') return { state: 'outcome_unknown' as const, requestId: result.requestId }
  const purchasable = new Set(((catalog.data as { items?: { id: string; isActive: boolean; isPurchasable: boolean; isComingSoon: boolean }[] })?.items ?? [])
    .filter(plan => plan.isActive && plan.isPurchasable && !plan.isComingSoon).map(plan => plan.id))
  const projection = result.data as { availablePlans?: { planId: string }[] }
  return { ...result, data: { ...projection, availablePlans: (projection.availablePlans ?? []).filter(plan => purchasable.has(plan.planId)) } }
}

export async function activateAccount(client: ActorClient, worker: RpcClient, input: unknown, send?: Parameters<typeof dispatchRequest>[3]) {
  const command = trialActivationCommand(input)
  await requireBinding(client, command.bindingId)
  const result = await dispatchRequest(client, worker, command, send)
  if (result.state !== 'success') return result
  const snapshot = result.data as { id?: string; planId?: string; status?: string; periodStart?: string; periodEnd?: string } | null
  if (!snapshot || snapshot.id !== command.payload.payload.subscriptionId || snapshot.planId !== command.payload.planId
    || snapshot.status !== 'active' || typeof snapshot.periodStart !== 'string' || typeof snapshot.periodEnd !== 'string'
    || !Number.isFinite(Date.parse(snapshot.periodStart)) || !Number.isFinite(Date.parse(snapshot.periodEnd))
    || Date.parse(snapshot.periodEnd) <= Date.parse(snapshot.periodStart)) return { state: 'outcome_unknown' as const, requestId: result.requestId }
  return result
}
