import { authorizeAdmin } from './authorize.ts'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const keys = ['bindingId', 'shopId', 'subscriptionId', 'planId', 'requestId', 'correlationId', 'reason'] as const

export interface TrialActivationInput {
  bindingId: string
  shopId: string
  subscriptionId: string
  planId: string
  requestId: string
  correlationId: string
  reason: string
}

export class ActivationInputError extends Error {
  constructor() { super('Invalid activation request') }
}

/** Protocol data only. Bindings, identity, term dates, quotas and prices stay database-owned. */
export function trialActivationCommand(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ActivationInputError()
  const input = value as Record<string, unknown>
  if (Object.keys(input).length !== keys.length || Object.keys(input).some(key => !keys.includes(key as typeof keys[number]))) throw new ActivationInputError()
  for (const key of keys.filter(key => key !== 'reason')) {
    if (typeof input[key] !== 'string' || !uuid.test(input[key] as string)) throw new ActivationInputError()
  }
  if (typeof input.reason !== 'string' || input.reason.trim().length < 8 || input.reason.trim().length > 1000) throw new ActivationInputError()
  return {
    bindingId: input.bindingId as string,
    requestId: input.requestId as string,
    correlationId: input.correlationId as string,
    operation: 'shop.plan.command',
    reason: input.reason.trim(),
    payload: {
      action: 'activate_trial',
      shopId: input.shopId as string,
      planId: input.planId as string,
      payload: { subscriptionId: input.subscriptionId as string },
    },
  }
}

interface ActivationClient {
  auth: { getUser(): Promise<{ data: { user: { id: string } | null }; error: unknown }> }
  rpc(name: 'super_admin_session'): PromiseLike<{ data: unknown; error: { code?: string } | null }>
  rpc(name: 'super_admin_adapter_enqueue', args: { p_input: ReturnType<typeof trialActivationCommand> }): PromiseLike<{ data: unknown; error: unknown }>
}

/** Enqueue is acceptance only. A caller must not display this result as an activated account. */
export async function enqueueTrialActivation(client: ActivationClient, input: unknown) {
  await authorizeAdmin(client)
  const command = trialActivationCommand(input)
  const { data, error } = await client.rpc('super_admin_adapter_enqueue', { p_input: command })
  if (error || typeof data !== 'string' || !uuid.test(data)) throw new Error('Activation request unavailable')
  return { state: 'queued' as const, dispatchId: data, requestId: command.requestId }
}
