import type { DoctorEditionMode } from './administrativeEdition.ts'
import { doctorEntitlementKey,type DoctorEntitlement } from './entitlement.ts'
export interface DoctorContextScope {
  environment: 'local' | 'staging' | 'production'
  portal: 'doctor' | 'secretary'
  userId: string
  sessionId: string
  practiceId: string
  locationId: string | null
  grantsVersion: number
  locationVersion?: number
  edition?: DoctorEditionMode
  editionRevision?: number
  entitlement?: DoctorEntitlement
}

export function doctorScopeKey(scope: DoctorContextScope, feature: string, query: unknown = null): string {
  return JSON.stringify(['doctor-suit', scope.environment, scope.portal, scope.userId, scope.sessionId,
    scope.practiceId, scope.locationId, scope.grantsVersion, scope.locationVersion ?? 0, feature, query,
    ...(scope.edition === undefined && scope.editionRevision === undefined ? [] : [scope.edition, scope.editionRevision]),
    ...(scope.entitlement === undefined ? [] : [doctorEntitlementKey(scope.entitlement)])])
}

/** Product context lifecycle, never an authorization decision. Trusted adapters supply the scope. */
export function createDoctorContextLifecycle() {
  let current: DoctorContextScope | null = null
  let generation = 0
  let controller = new AbortController()
  let cleanup = Promise.resolve()
  const clearers = new Set<() => void | Promise<void>>()
  return {
    get scope() { return current ? { ...current } : null },
    registerClear(clear: () => void | Promise<void>) { clearers.add(clear); return () => clearers.delete(clear) },
    capture(feature: string, query: unknown = null) {
      if (!current) throw new Error('DOCTOR_CONTEXT_REQUIRED')
      const captured = generation
      return {
        key: doctorScopeKey(current, feature, query), signal: controller.signal,
        accepts: () => captured === generation && current !== null,
      }
    },
    async transition(next: DoctorContextScope | null) {
      const captured = ++generation
      current = null
      controller.abort()
      controller = new AbortController()
      const pending = Promise.allSettled([...clearers].map(clear => {
        try { return Promise.resolve(clear()) } catch (error) { return Promise.reject(error) }
      }))
      const previous = cleanup
      cleanup = Promise.all([previous, pending]).then(() => undefined)
      const outcomes = await pending
      await previous
      if (captured !== generation) return
      if (outcomes.some(result => result.status === 'rejected')) throw new Error('DOCTOR_CONTEXT_CLEANUP_FAILED')
      current = next ? { ...next } : null
    },
  }
}
