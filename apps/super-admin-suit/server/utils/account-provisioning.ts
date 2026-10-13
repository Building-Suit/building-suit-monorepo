import { accountContext, accountId, type ActorClient } from './account-workflow.ts'
import { dispatchRequest, type RpcClient } from './adapter-dispatch.ts'
import type { ProvisionProjection } from '../../app/types/account-provisioning.ts'

export class ProvisioningInputError extends Error { constructor() { super('Invalid provisioning request') } }
type ObjectValue = Record<string, unknown>
function object(value: unknown, keys: string[]): ObjectValue {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length
    || Object.keys(value).some(key => !keys.includes(key))) throw new ProvisioningInputError()
  return value as ObjectValue
}
function text(value: unknown, min: number, max: number): string {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) throw new ProvisioningInputError()
  return value.trim()
}
export function provisionCommand(value: unknown) {
  const input = object(value, ['bindingId','email','displayName','shopName','businessMode','mainLocationName','planId','catalogTermsId','requestId','correlationId','reason'])
  const email = text(input.email, 3, 254).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ProvisioningInputError()
  return {
    bindingId: accountId(input.bindingId), requestId: accountId(input.requestId), correlationId: accountId(input.correlationId),
    reason: text(input.reason,8,1000), operation: 'shop.account.command',
    payload: { action: 'create_and_activate', email, displayName: text(input.displayName,2,120), shopName: text(input.shopName,2,120),
      mainLocationName: text(input.mainLocationName,2,120), businessMode: text(input.businessMode,2,32), planId: accountId(input.planId), catalogTermsId: accountId(input.catalogTermsId) },
  }
}
export function invitationCommand(value: unknown) {
  const input = object(value,['bindingId','provisioningId','requestId','correlationId','reason','acknowledgeUncertainSend'])
  if (input.acknowledgeUncertainSend !== true) throw new ProvisioningInputError()
  return { bindingId: accountId(input.bindingId), requestId: accountId(input.requestId), correlationId: accountId(input.correlationId),
    reason: text(input.reason,8,1000), operation: 'shop.account.command',
    payload: { action: 'resend_invitation', provisioningId: accountId(input.provisioningId), acknowledgeUncertainSend: true } }
}
async function permitted(client: ActorClient, binding: string) {
  const context = await accountContext(client)
  if (!context.modules.some(module => module.bindingId === binding && module.provisioningAvailable)) throw new Error('Provisioning capability unavailable')
}
function checkedProjection(result: Awaited<ReturnType<typeof dispatchRequest>>, expected: { email?: string; planId?: string; provisioningId?: string } = {}) {
  if (result.state !== 'success') return result
  const value = result.data as ProvisionProjection | null
  try {
    if (!value || !['reserved','active','conflict','review_required'].includes(value.phase)
      || !['pending','sending','sent','claimed','unknown','failed'].includes(value.invitationState)
      || typeof value.email !== 'string' || typeof value.ownerVerified !== 'boolean'
      || (expected.email && value.email !== expected.email) || (expected.planId && value.planId !== expected.planId)
      || (expected.provisioningId && value.provisioningId !== expected.provisioningId)) throw new Error()
    accountId(value.provisioningId); accountId(value.planId)
    if (value.phase === 'active') {
      accountId(value.shopId); accountId(value.subscriptionId)
      if (!value.subscription || value.subscription.id !== value.subscriptionId || value.subscription.planId !== value.planId
        || value.subscription.status !== 'active' || !Number.isFinite(Date.parse(value.subscription.periodStart))
        || !Number.isFinite(Date.parse(value.subscription.periodEnd)) || Date.parse(value.subscription.periodEnd) <= Date.parse(value.subscription.periodStart)) throw new Error()
    }
    // Return a closed projection. Internal reserved Auth IDs/markers/leases can never leak.
    return { ...result, data: { provisioningId:value.provisioningId,phase:value.phase,email:value.email,
      shopId:value.shopId,subscriptionId:value.subscriptionId,planId:value.planId,invitationState:value.invitationState,ownerVerified:value.ownerVerified,
      subscription:value.subscription ? { id:value.subscription.id,planId:value.subscription.planId,status:value.subscription.status,
        periodStart:value.subscription.periodStart,periodEnd:value.subscription.periodEnd,trialStartAt:value.subscription.trialStartAt,trialEndAt:value.subscription.trialEndAt } : null } }
  } catch { return { state:'outcome_unknown' as const,requestId:result.requestId } }
}
export async function provisionAccount(client: ActorClient, worker: RpcClient, input: unknown, send?: Parameters<typeof dispatchRequest>[3]) {
  const command = provisionCommand(input)
  await permitted(client, command.bindingId)
  return checkedProjection(await dispatchRequest(client, worker, command, send),{email:command.payload.email,planId:command.payload.planId})
}
export async function resendAccountInvitation(client: ActorClient, worker: RpcClient, input: unknown, send?: Parameters<typeof dispatchRequest>[3]) {
  const command = invitationCommand(input)
  await permitted(client, command.bindingId)
  return checkedProjection(await dispatchRequest(client, worker, command, send),{provisioningId:command.payload.provisioningId})
}
export async function provisionQuery(client: ActorClient, worker: RpcClient, input: { bindingId: unknown; provisioningId?: unknown }, send?: Parameters<typeof dispatchRequest>[3]) {
  const bindingId = accountId(input.bindingId)
  await permitted(client,bindingId)
  const result = await dispatchRequest(client,worker,{ bindingId, operation:'shop.account.query',requestId:crypto.randomUUID(),correlationId:crypto.randomUUID(),reason:null,
    payload: input.provisioningId === undefined ? { resource:'catalog' } : { resource:'status',provisioningId:accountId(input.provisioningId) } },send)
  if (input.provisioningId !== undefined) return checkedProjection(result,{provisioningId:accountId(input.provisioningId)})
  if (result.state !== 'success') return result
  const catalog=result.data as { plans?: { id:string;catalogTermsId:string;name:string;billingInterval:string;isActive:boolean;isPurchasable:boolean;isComingSoon:boolean }[];businessModes?: string[] }
  if (!Array.isArray(catalog.plans) || !Array.isArray(catalog.businessModes)) return {state:'outcome_unknown' as const,requestId:result.requestId}
  return {...result,data:{plans:catalog.plans.filter(plan=>plan.isActive&&plan.isPurchasable&&!plan.isComingSoon).map(plan=>({id:accountId(plan.id),catalogTermsId:accountId(plan.catalogTermsId),name:plan.name,billingInterval:plan.billingInterval,isActive:true,isPurchasable:true,isComingSoon:false})),businessModes:catalog.businessModes}}
}
