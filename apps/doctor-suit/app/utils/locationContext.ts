import type { DoctorContextScope } from './contextScope'
import type { DoctorIdentity } from './authController'
import { doctorEditionMode } from './administrativeEdition.ts'
import { doctorEntitlement } from './entitlement.ts'
export const doctorAdministrativeCapabilities = ['dashboard.read', 'locations.read', 'locations.manage', 'patients.read', 'patients.write', 'documents.read', 'documents.write', 'availability.manage', 'appointments.read', 'appointments.write', 'queue.manage', 'audit.read', 'worklists.read', 'worklists.manage'] as const
export type DoctorAdministrativeCapability = typeof doctorAdministrativeCapabilities[number]
export interface DoctorLocationContext extends DoctorContextScope {
  locationId: string
  practiceName: string
  doctorName: string
  locationName: string
  timezone: string
  locationVersion: number
  capabilities: DoctorAdministrativeCapability[]
}
export interface DoctorContextPreference { userId: string; sessionId: string; practiceId: string; locationId: string }
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))
export const doctorUuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
function invalid(): never { throw new Error('DOCTOR_CONTEXT_RESPONSE_INVALID') }
export function doctorLocationContext(value: unknown, actor: DoctorIdentity, environment: DoctorContextScope['environment']): DoctorLocationContext {
  if (!record(value) || !doctorUuid(value.practice_id) || !doctorUuid(value.location_id)
    || typeof value.practice_name !== 'string' || typeof value.doctor_name !== 'string' || typeof value.location_name !== 'string' || typeof value.timezone !== 'string'
    || !['doctor', 'secretary'].includes(String(value.portal)) || !Number.isSafeInteger(value.grants_version) || Number(value.grants_version)<1
    || !Number.isSafeInteger(value.location_version) || Number(value.location_version)<1 || !Array.isArray(value.capabilities)
    || value.capabilities.some(item => !doctorAdministrativeCapabilities.includes(item as DoctorAdministrativeCapability))) invalid()
  const edition = value.edition !== undefined || value.edition_revision !== undefined
  if (edition && (!doctorEditionMode(value.edition) || !Number.isSafeInteger(value.edition_revision) || Number(value.edition_revision) < 1)) invalid()
  if (value.edition==='administrative_candidate' && value.capabilities.some(capability => ['documents.read','documents.write','worklists.read','worklists.manage'].includes(String(capability)))) invalid()
  let entitlement
  try { entitlement=doctorEntitlement(value.entitlement,value.edition as DoctorContextScope['edition']) } catch { invalid() }
  return { environment, userId: actor.userId, sessionId: actor.sessionId, practiceId: value.practice_id, locationId: value.location_id,
    portal: value.portal as DoctorContextScope['portal'], practiceName: value.practice_name, doctorName: value.doctor_name,
    locationName: value.location_name, timezone: value.timezone, grantsVersion: Number(value.grants_version), locationVersion: Number(value.location_version), capabilities: [...new Set(value.capabilities)] as DoctorAdministrativeCapability[],
    ...(edition ? { edition: value.edition as NonNullable<DoctorContextScope['edition']>, editionRevision: Number(value.edition_revision) } : {}),
    ...(entitlement ? { entitlement } : {}) }
}
export function doctorLocationContexts(value: unknown, actor: DoctorIdentity, environment: DoctorContextScope['environment']) {
  if (!Array.isArray(value)) invalid()
  const result = value.map(item => doctorLocationContext(item, actor, environment))
  if (new Set(result.map(doctorContextId)).size !== result.length) invalid()
  return result
}
export function doctorContextId(value: Pick<DoctorContextScope, 'practiceId' | 'locationId'>): string { return `${value.practiceId}:${value.locationId}` }
export function doctorContextPreference(value: unknown, actor: DoctorIdentity): DoctorContextPreference | null {
  return record(value) && value.userId === actor.userId && value.sessionId === actor.sessionId && doctorUuid(value.practiceId) && doctorUuid(value.locationId)
    ? { userId: actor.userId, sessionId: actor.sessionId, practiceId: value.practiceId, locationId: value.locationId } : null
}
