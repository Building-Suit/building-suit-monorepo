/** Independent, memory-only synthetic protocol. No patient endpoint or legal authorization. */
export const caregiverPreviewActions = ['released_timeline', 'released_prescription', 'patient_report', 'reminder_preview'] as const
export type CaregiverPreviewAction = typeof caregiverPreviewActions[number]
export interface CaregiverPreviewScope {
  environment: 'synthetic'
  accountId: string
  sessionId: string
  patientId: string
  doctorId: string
  practiceId: string
  relationshipId: string
}
export interface CaregiverPreviewGrant {
  id: string
  version: number
  grantorAccountId: string
  recipientAccountId: string
  patientId: string
  doctorId: string
  practiceId: string
  relationshipId: string
  authorityEvidenceRef: string
  policyRef: string
  actions: readonly CaregiverPreviewAction[]
  validFrom: number
  validUntil: number
  revokedAt: number | null
  syntheticOnly: true
  legalApproval: false
}
export interface CaregiverPreviewEvent {
  grantId: string
  version: number
  action: 'recorded' | 'revoked'
  actorAccountId: string
  at: number
  evidenceRef: string
}
const identifier = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,127}$/.test(value)
const instant = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
const grantKeys = ['id', 'version', 'grantorAccountId', 'recipientAccountId', 'patientId', 'doctorId', 'practiceId', 'relationshipId', 'authorityEvidenceRef', 'policyRef', 'actions', 'validFrom', 'validUntil', 'revokedAt', 'syntheticOnly', 'legalApproval']
function validGrant(grant: CaregiverPreviewGrant): boolean {
  return !!grant && Object.keys(grant).length === grantKeys.length && Object.keys(grant).every(key => grantKeys.includes(key))
    && [grant.id, grant.grantorAccountId, grant.recipientAccountId, grant.patientId, grant.doctorId, grant.practiceId, grant.relationshipId, grant.authorityEvidenceRef, grant.policyRef].every(identifier)
    && grant.grantorAccountId !== grant.recipientAccountId && grant.syntheticOnly === true && grant.legalApproval === false
    && Number.isSafeInteger(grant.version) && grant.version >= 1 && instant(grant.validFrom) && instant(grant.validUntil) && grant.validUntil > grant.validFrom
    && (grant.revokedAt === null || (instant(grant.revokedAt) && grant.revokedAt >= grant.validFrom))
    && Array.isArray(grant.actions) && grant.actions.length > 0 && grant.actions.every(action => caregiverPreviewActions.includes(action)) && new Set(grant.actions).size === grant.actions.length
}
function copyGrant(grant: CaregiverPreviewGrant): CaregiverPreviewGrant {
  return Object.freeze({ ...grant, actions: Object.freeze([...grant.actions]) })
}
/** Exact synthetic account/session/relationship scope; never contact matching or sibling expansion. */
export function caregiverPreviewAllows(grant: CaregiverPreviewGrant | null, scope: CaregiverPreviewScope | null, action: CaregiverPreviewAction, now: number, expectedVersion?: number): boolean {
  return !!grant && validGrant(grant) && !!scope && scope.environment === 'synthetic' && identifier(scope.accountId) && identifier(scope.sessionId)
    && grant.recipientAccountId === scope.accountId && grant.patientId === scope.patientId && grant.doctorId === scope.doctorId && grant.practiceId === scope.practiceId && grant.relationshipId === scope.relationshipId
    && instant(now) && grant.validFrom <= now && now < grant.validUntil && grant.revokedAt === null && grant.actions.includes(action)
    && (expectedVersion === undefined || expectedVersion === grant.version)
}
/** Fixture store only. Its methods cannot grant an Auth user any product capability. */
export function createSyntheticCaregiverLedger() {
  const grants = new Map<string, CaregiverPreviewGrant>()
  const events: CaregiverPreviewEvent[] = []
  function record(grant: CaregiverPreviewGrant) {
    if (!validGrant(grant) || grant.version !== 1 || grant.revokedAt !== null || grants.has(grant.id)) throw Error('CAREGIVER_PREVIEW_INVALID')
    const stored = copyGrant(grant)
    grants.set(stored.id, stored)
    events.push(Object.freeze({ grantId: stored.id, version: 1, action: 'recorded', actorAccountId: stored.grantorAccountId, at: stored.validFrom, evidenceRef: stored.authorityEvidenceRef }))
    return stored
  }
  function revoke(id: string, expectedVersion: number, actorAccountId: string, evidenceRef: string, at: number) {
    const grant = grants.get(id)
    // A fixture grantor may only reduce its own grant. No inferred guardian/legal authority.
    if (!grant || grant.version !== expectedVersion || grant.revokedAt !== null || grant.grantorAccountId !== actorAccountId || !identifier(evidenceRef) || !instant(at) || at < grant.validFrom || !Number.isSafeInteger(grant.version + 1)) throw Error('CAREGIVER_PREVIEW_DENIED')
    const revoked = copyGrant({ ...grant, version: grant.version + 1, revokedAt: at })
    grants.set(id, revoked)
    events.push(Object.freeze({ grantId: id, version: revoked.version, action: 'revoked', actorAccountId, at, evidenceRef }))
    return revoked
  }
  // No enumeration API and no record content; caller must already know the grant and scope.
  function lookup(id: string, scope: CaregiverPreviewScope, action: CaregiverPreviewAction, now: number) {
    const grant = grants.get(id) ?? null
    return caregiverPreviewAllows(grant, scope, action, now) ? grant : null
  }
  return { record, revoke, lookup, audit: () => Object.freeze([...events]) }
}
function scopeKey(scope: CaregiverPreviewScope | null) {
  return scope ? JSON.stringify([scope.environment, scope.accountId, scope.sessionId, scope.patientId, scope.doctorId, scope.practiceId, scope.relationshipId]) : null
}
/** Memory projection harness for stale-read/revocation tests; deliberately has no production adapter. */
export function createCaregiverPreviewReader<T>(dependencies: {
  scope: () => CaregiverPreviewScope | null
  grant: (scope: CaregiverPreviewScope) => Promise<CaregiverPreviewGrant | null>
  read: (scope: CaregiverPreviewScope, grant: CaregiverPreviewGrant) => Promise<T>
  now: () => number
  action: CaregiverPreviewAction
}) {
  let generation = 0
  let value: T | null = null
  let retainedKey: string | null = null
  let validUntil = 0
  let lastClock = 0
  function clear() { generation++; value = null; retainedKey = null; validUntil = 0 }
  function clock() {
    const now = dependencies.now()
    if (!instant(now) || now < lastClock) { clear(); return null }
    lastClock = now
    return now
  }
  function current() {
    const now = clock()
    if (value === null) return null
    if (now === null || scopeKey(dependencies.scope()) !== retainedKey || now >= validUntil) clear()
    return value
  }
  async function refresh() {
    clear()
    const revision = generation, original = dependencies.scope(), key = scopeKey(original)
    if (!original) return false
    const scope = Object.freeze({ ...original })
    const stillCurrent = () => revision === generation && key === scopeKey(dependencies.scope())
    try {
      const grant = await dependencies.grant(scope), now = clock()
      if (!stillCurrent() || now === null || !caregiverPreviewAllows(grant, scope, dependencies.action, now) || !grant) return false
      // Capture immutable version before awaiting: never accept an in-place mutated authorization.
      const version = grant.version, id = grant.id, until = grant.validUntil
      const result = await dependencies.read(scope, copyGrant(grant))
      const fresh = await dependencies.grant(scope), checkedAt = clock()
      if (!stillCurrent() || checkedAt === null || fresh?.id !== id || fresh.validUntil !== until || !caregiverPreviewAllows(fresh, scope, dependencies.action, checkedAt, version)) return false
      value = result; retainedKey = key; validUntil = until
      return true
    } catch { if (stillCurrent()) clear(); return false }
  }
  // Caller must invoke clear on background/offline/revocation notification; no offline policy is approved.
  return { refresh, current, clear }
}
