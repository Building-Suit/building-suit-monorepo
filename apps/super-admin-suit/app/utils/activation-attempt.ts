import type { AccountScope, ActivationAttempt } from '../types/account-workflow.ts'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function attemptKey(scope: AccountScope) {
  return `sas-activation:${scope.userId}:${scope.authorityEnvironmentId}:${scope.bindingId}`
}
export function restoreAttempt(value: string | null, scope: AccountScope): ActivationAttempt | null {
  if (!value) return null
  try {
    const input = JSON.parse(value) as Record<string, unknown>
    const ids = ['bindingId', 'shopId', 'subscriptionId', 'planId', 'requestId', 'correlationId']
    if (Object.keys(input).length !== 7 || input.bindingId !== scope.bindingId
      || ids.some(key => typeof input[key] !== 'string' || !uuid.test(input[key] as string))
      || typeof input.reason !== 'string' || input.reason.trim().length < 8 || input.reason.trim().length > 1000) return null
    return input as unknown as ActivationAttempt
  } catch { return null }
}
export function clearActivationAttempts(storage: Pick<Storage, 'length' | 'key' | 'removeItem'>, keepUserId?: string) {
  for (let index = storage.length - 1; index >= 0; index--) {
    const key = storage.key(index)
    if (key?.startsWith('sas-activation:') && (!keepUserId || !key.startsWith(`sas-activation:${keepUserId}:`))) storage.removeItem(key)
  }
}
