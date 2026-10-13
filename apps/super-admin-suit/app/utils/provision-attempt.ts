import type { AccountScope } from '../types/account-workflow.ts'
import type { ProvisionAttempt } from '../types/account-provisioning.ts'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const provisionKey = (scope: AccountScope) => `sas-provision:${scope.userId}:${scope.authorityEnvironmentId}:${scope.bindingId}`
export function restoreProvision(value: string | null, scope: AccountScope): ProvisionAttempt | null {
  try {
    const saved = JSON.parse(value || 'null') as ProvisionAttempt
    if (!saved || !['create','resend'].includes(saved.kind) || !saved.input || saved.input.bindingId !== scope.bindingId
      || [saved.input.bindingId,saved.input.requestId,saved.input.correlationId].some(id => !uuid.test(id))
      || typeof saved.input.reason !== 'string' || saved.input.reason.trim().length < 8 || saved.input.reason.length > 1000) return null
    if (saved.kind === 'resend') {
      if (saved.input.acknowledgeUncertainSend !== true || !uuid.test(saved.input.provisioningId) || Object.keys(saved.input).length !== 6) return null
    } else {
      if (Object.keys(saved.input).length !== 11 || !uuid.test(saved.input.planId) || !uuid.test(saved.input.catalogTermsId)
        || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(saved.input.email) || saved.input.email.length > 254
        || ['displayName','shopName','mainLocationName'].some(key => {
          const text = saved.input[key as keyof typeof saved.input]
          return typeof text !== 'string' || text.trim().length < 2 || text.length > 120
        }) || typeof saved.input.businessMode !== 'string' || saved.input.businessMode.length > 32) return null
    }
    return saved
  } catch { return null }
}
