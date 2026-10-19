import { doctorEntitlement,type DoctorEntitlement } from './entitlement.ts'
import { doctorEditionMode, type DoctorEditionMode } from './administrativeEdition.ts'
import { doctorAdministrativeCapabilities, doctorUuid, type DoctorAdministrativeCapability } from './locationContext.ts'
export interface DoctorDelegationGrant { locationId: string; capabilities: DoctorAdministrativeCapability[] }
export interface DoctorTeamLocation { id: string; name: string; timezone: string; archived: boolean }
export interface DoctorTeamMember { id: string; email: string; status: 'active' | 'suspended' | 'revoked'; version: number; createdAt: string; grants: (DoctorDelegationGrant & { locationName: string; archived: boolean })[] }
export interface DoctorTeamInvitation { id: string; email: string; status: 'pending' | 'accepted' | 'cancelled' | 'expired'; version: number; expiresAt: string; createdAt: string; grants: DoctorDelegationGrant[] }
export interface DoctorTeamDirectory { practiceId: string; practiceName: string; edition: DoctorEditionMode; editionRevision: number; availableCapabilities: DoctorAdministrativeCapability[]; entitlement?: DoctorEntitlement; members: DoctorTeamMember[]; invitations: DoctorTeamInvitation[]; locations: DoctorTeamLocation[]; memberTotal: number; invitationTotal: number; locationTotal: number }
export interface DoctorInvitationDetails { id: string; practiceId: string; practiceName: string; doctorName: string; expiresAt: string; status: 'pending' | 'accepted'; grants: (DoctorDelegationGrant & { locationName: string; timezone: string })[] }
export interface DoctorTeamQuery { page: number; size: number; search: string }
export interface DoctorInvitationForm { email: string; grants: DoctorDelegationGrant[] }
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))
const text = (value: unknown): value is string => typeof value === 'string'
const count = (value: unknown) => Number.isSafeInteger(value) && Number(value)>=0
const version = (value: unknown) => count(value) && Number(value)>0
function invalid(): never { throw new Error('DOCTOR_DELEGATION_RESPONSE_INVALID') }
function array(value: unknown): unknown[] { if (!Array.isArray(value)) invalid(); return value }
function unique<T extends { id: string }>(values: T[]): T[] { if (new Set(values.map(item => item.id)).size!==values.length) invalid(); return values }
function grant(value: unknown): DoctorDelegationGrant {
  if (!record(value) || !doctorUuid(value.location_id) || !Array.isArray(value.capabilities)
    || value.capabilities.some(item => !doctorAdministrativeCapabilities.includes(item as DoctorAdministrativeCapability))) invalid()
  return { locationId: value.location_id, capabilities: [...new Set(value.capabilities)] as DoctorAdministrativeCapability[] }
}
function grants(value: unknown): DoctorDelegationGrant[] {
  const result = array(value).map(grant)
  if (new Set(result.map(item => item.locationId)).size!==result.length) invalid()
  return result
}
export function doctorTeamDirectory(value: unknown, practiceId: string): DoctorTeamDirectory {
  if (!record(value) || value.practice_id!==practiceId || !text(value.practice_name) || !count(value.member_total) || !count(value.invitation_total) || !count(value.location_total)) invalid()
  if (!doctorEditionMode(value.edition) || !version(value.edition_revision) || !Array.isArray(value.available_capabilities) || new Set(value.available_capabilities).size !== value.available_capabilities.length || value.available_capabilities.some(cap => !doctorAdministrativeCapabilities.includes(cap as DoctorAdministrativeCapability) || (value.edition === 'administrative_candidate' && ['documents.read', 'documents.write'].includes(String(cap))))) invalid()
  const locations = unique(array(value.locations).map((item): DoctorTeamLocation => {
    if (!record(item) || !doctorUuid(item.id) || !text(item.name) || !text(item.timezone) || typeof item.archived!=='boolean') invalid()
    return { id: item.id, name: item.name, timezone: item.timezone, archived: item.archived }
  }))
  const members = unique(array(value.members).map((item): DoctorTeamMember => {
    if (!record(item) || !doctorUuid(item.id) || !text(item.email) || !['active','suspended','revoked'].includes(String(item.status)) || !version(item.version) || !text(item.created_at)) invalid()
    const values = array(item.grants).map((input) => {
      if (!record(input) || !text(input.location_name) || typeof input.archived!=='boolean') invalid()
      return { ...grant(input), locationName: input.location_name, archived: input.archived }
    })
    if (new Set(values.map(item => item.locationId)).size!==values.length) invalid()
    return { id: item.id, email: item.email, status: item.status as DoctorTeamMember['status'], version: Number(item.version), createdAt: item.created_at, grants: values }
  }))
  const invitations = unique(array(value.invitations).map((item): DoctorTeamInvitation => {
    if (!record(item) || !doctorUuid(item.id) || !text(item.recipient_email) || !['pending','accepted','cancelled','expired'].includes(String(item.status)) || !version(item.version) || !text(item.expires_at) || !text(item.created_at)) invalid()
    return { id: item.id, email: item.recipient_email, status: item.status as DoctorTeamInvitation['status'], version: Number(item.version), expiresAt: item.expires_at, createdAt: item.created_at, grants: grants(item.grants) }
  }))
  const entitlement=doctorEntitlement(value.entitlement,value.edition as DoctorEditionMode)
  return { ...(entitlement?{entitlement}:{}),practiceId, practiceName: value.practice_name, edition: value.edition, editionRevision: Number(value.edition_revision), availableCapabilities: [...value.available_capabilities] as DoctorAdministrativeCapability[], members, invitations, locations, memberTotal: Number(value.member_total), invitationTotal: Number(value.invitation_total), locationTotal: Number(value.location_total) }
}
export function doctorInvitationDetails(value: unknown, invitationId: string): DoctorInvitationDetails {
  if (!record(value) || value.invitation_id!==invitationId || !doctorUuid(value.practice_id) || !text(value.practice_name) || !text(value.doctor_name) || !text(value.expires_at) || !['pending','accepted'].includes(String(value.status))) invalid()
  const values = array(value.grants).map(item => {
    if (!record(item) || !text(item.location_name) || !text(item.timezone)) invalid()
    return { ...grant(item), locationName: item.location_name, timezone: item.timezone }
  })
  if (!values.length || new Set(values.map(item => item.locationId)).size!==values.length) invalid()
  return { id: invitationId, practiceId: value.practice_id, practiceName: value.practice_name, doctorName: value.doctor_name, expiresAt: value.expires_at, status: value.status as DoctorInvitationDetails['status'], grants: values }
}
export function validDoctorDelegationGrants(values: DoctorDelegationGrant[], locations: DoctorTeamLocation[], invitation = false): boolean {
  if (!Array.isArray(values) || values.length>100 || (invitation && !values.length) || new Set(values.map(item => item.locationId)).size!==values.length) return false
  return values.every(item => locations.some(location => location.id===item.locationId && (!invitation || !location.archived))
    && item.capabilities.length>0 && item.capabilities.length<=doctorAdministrativeCapabilities.length && item.capabilities.every(capability => doctorAdministrativeCapabilities.includes(capability)))
}
export function doctorCanonicalGrants(values: DoctorDelegationGrant[]): DoctorDelegationGrant[] {
  return values.map(item => ({ locationId: item.locationId,capabilities: [...new Set(item.capabilities)].sort() })).sort((a,b) => a.locationId.localeCompare(b.locationId))
}
export function validDoctorInvitation(form: DoctorInvitationForm, locations: DoctorTeamLocation[]): boolean {
  return form.email.length<=254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) && validDoctorDelegationGrants(form.grants, locations, true)
}
export function doctorInvitationCredential(value: unknown): { id: string; token: string } | null {
  if (typeof value!=='string') return null
  const [id, token, ...extra] = value.trim().toLowerCase().split('.')
  return !extra.length && doctorUuid(id) && token && /^[0-9a-f]{64}$/.test(token) ? { id, token } : null
}
export async function createDoctorInvitationSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const hex = (value: Uint8Array) => [...value].map(item => item.toString(16).padStart(2,'0')).join('')
  return { token: hex(bytes), hash: hex(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))) }
}
export type DoctorDelegationError = 'denied' | 'invalid' | 'conflict' | 'network' | null
export function doctorDelegationFailure(error: unknown): DoctorDelegationError {
  const code = error && typeof error==='object' && 'code' in error ? String(error.code) : ''
  if (['42501','DS001','DS002','DS003','DS006','DS007'].includes(String(code))) return 'denied'
  if (['22023','23514'].includes(code)) return 'invalid'
  if (['40001','23505'].includes(code)) return 'conflict'
  return 'network'
}

/** Security reductions remain possible after subscription expiry. */
export function doctorDelegationReduction(before: DoctorDelegationGrant[],after: DoctorDelegationGrant[]): boolean {
  return after.every(next=>next.capabilities.every(capability=>before.find(prior=>prior.locationId===next.locationId)?.capabilities.includes(capability)))
}

export function doctorTeamCanAllocate(directory: DoctorTeamDirectory | null): boolean {
  return Boolean(directory && (directory.edition!=='administrative_candidate' || (directory.entitlement?.writesAllowed && directory.entitlement.canAddStaff)))
}
export function doctorTeamCanChangeGrants(directory: DoctorTeamDirectory | null,before: DoctorDelegationGrant[],after: DoctorDelegationGrant[]): boolean {
  return Boolean(directory && (directory.edition!=='administrative_candidate' || directory.entitlement?.writesAllowed || doctorDelegationReduction(before,after)))
}
