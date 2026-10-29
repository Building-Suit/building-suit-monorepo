import { clinicalReleased, clinicalUuid } from './clinical.ts'

/** Synthetic input to a future patient adapter; never an Auth identity/relationship decision. */
export interface PatientTimelineScope {
  environment: 'synthetic'
  portal: 'patient'
  accountId: string
  sessionId: string
  patientId: string
  validUntil: number
  relationships: readonly { id: string; version: number; doctorId: string; practiceId: string; locationIds: readonly string[] }[]
}
export interface PatientTimelineItem {
  releaseId: string
  versionId: string
  revision: number
  snapshotSha256: string
  doctorName: string
  locationName: string
  finalizedAt: string
  expiresAt: string
  timezone: string
  prescriptionCount: number
  releasedResultCount: number
}
export interface PatientTimelineGroup {
  relationshipId: string
  doctorId: string
  practiceId: string
  locationId: string
  items: readonly PatientTimelineItem[]
}
export interface PatientTimelinePage { page: number; total: number; hasMore: boolean; groups: readonly PatientTimelineGroup[]; validUntil: number; dataMode: 'synthetic'; clinicalApproval: false }
const finiteTime = (n: unknown): n is number => Number.isSafeInteger(n) && Number(n) >= 0
function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value) }
function shape(value: unknown, keys: string[]): value is Record<string, unknown> { return object(value) && Object.keys(value).length === keys.length && Object.keys(value).every(key => keys.includes(key)) }
function validScope(scope: PatientTimelineScope, now: number) {
  return scope?.environment === 'synthetic' && scope.portal === 'patient' && [scope.accountId, scope.sessionId, scope.patientId].every(clinicalUuid)
    && finiteTime(now) && finiteTime(scope.validUntil) && now < scope.validUntil && Array.isArray(scope.relationships) && scope.relationships.length <= 50
    && new Set(scope.relationships.map(r => r.id)).size === scope.relationships.length
    && scope.relationships.every(r => [r.id, r.doctorId, r.practiceId].every(clinicalUuid) && Number.isSafeInteger(r.version) && r.version >= 1 && Array.isArray(r.locationIds) && r.locationIds.length <= 50 && r.locationIds.every(clinicalUuid) && new Set(r.locationIds).size === r.locationIds.length)
}
function invalid(): never { throw Error('PATIENT_TIMELINE_PREVIEW_INVALID') }
/** Reject contaminated pages; do not silently filter records while retaining misleading totals. */
export function patientReleasedTimeline(raw: unknown, scope: PatientTimelineScope, page: number, now: number): PatientTimelinePage {
  if (!validScope(scope, now) || !Number.isSafeInteger(page) || page < 0 || !Number.isSafeInteger(page * 20)) return invalid()
  if (!shape(raw, ['account_id', 'patient_id', 'page', 'page_size', 'total', 'rows', 'data_mode', 'clinical_approval', 'live_prescribing']) || raw.account_id !== scope.accountId || raw.patient_id !== scope.patientId || raw.page !== page || raw.page_size !== 20 || raw.data_mode !== 'synthetic' || raw.clinical_approval !== false || raw.live_prescribing !== false || !Number.isSafeInteger(raw.total) || Number(raw.total) < 0 || !Array.isArray(raw.rows) || raw.rows.length !== Math.min(20, Math.max(0, Number(raw.total) - page * 20))) return invalid()
  const ids = new Set<string>(), groups = new Map<string, PatientTimelineGroup>()
  let validUntil = scope.validUntil
  let previous: { at: number; id: string } | null = null
  for (const row of raw.rows) {
    if (!shape(row, ['relationship_id', 'relationship_version', 'doctor_id', 'practice_id', 'location_id', 'revoked', 'release']) || row.revoked !== false || !object(row.release) || !clinicalUuid(row.release.release_id)) return invalid()
    const relationship = scope.relationships.find(r => r.id === row.relationship_id)
    if (!relationship || relationship.version !== row.relationship_version || relationship.doctorId !== row.doctor_id || relationship.practiceId !== row.practice_id || !relationship.locationIds.includes(String(row.location_id))) return invalid()
    const release = clinicalReleased(row.release, row.release.release_id)
    const at = Date.parse(release.finalized_at), until = Date.parse(release.expires_at)
    if (release.patient_id !== scope.patientId || release.responsible_doctor !== row.doctor_id || ids.has(release.release_id) || at > now || until <= now || until <= at || previous && (at > previous.at || at === previous.at && release.release_id <= previous.id)) return invalid()
    previous = { at, id: release.release_id }; ids.add(release.release_id); validUntil = Math.min(validUntil, until)
    const key = JSON.stringify([relationship.id, relationship.doctorId, relationship.practiceId, row.location_id])
    const item: PatientTimelineItem = Object.freeze({ releaseId: release.release_id, versionId: release.version_id, revision: release.revision, snapshotSha256: release.snapshot_sha256, doctorName: release.doctor_name, locationName: release.location_name, finalizedAt: release.finalized_at, expiresAt: release.expires_at, timezone: release.timezone, prescriptionCount: release.prescriptions.length, releasedResultCount: release.results.length })
    const group = groups.get(key)
    groups.set(key, Object.freeze({ relationshipId: relationship.id, doctorId: relationship.doctorId, practiceId: relationship.practiceId, locationId: String(row.location_id), items: Object.freeze([...(group?.items ?? []), item]) }))
  }
  return Object.freeze({ page, total: Number(raw.total), hasMore: page * 20 + raw.rows.length < Number(raw.total), groups: Object.freeze([...groups.values()]), validUntil, dataMode: 'synthetic', clinicalApproval: false })
}
function scopeKey(scope: PatientTimelineScope | null) {
  return scope ? JSON.stringify([scope.environment, scope.portal, scope.accountId, scope.sessionId, scope.patientId, scope.validUntil, scope.relationships]) : null
}
/** No production adapter, offline cache, pagination accumulation or clinician query is installed. */
export function createPatientTimelinePreview(dependencies: { scope: () => PatientTimelineScope | null; load: (scope: PatientTimelineScope, page: number) => Promise<unknown>; now: () => number }) {
  let revision = 0, retainedKey: string | null = null, value: PatientTimelinePage | null = null, lastClock = 0
  function clear() { revision++; value = null; retainedKey = null }
  function clock() { const now = dependencies.now(); if (!finiteTime(now) || now < lastClock) { clear(); return null } lastClock = now; return now }
  function current() { const now = clock(); if (value && (now === null || now >= value.validUntil || retainedKey !== scopeKey(dependencies.scope()))) clear(); return value }
  async function load(page = 0) {
    clear()
    const generation = revision, scope = dependencies.scope(), key = scopeKey(scope), startedAt = clock()
    if (!scope || startedAt === null || !validScope(scope, startedAt) || !Number.isSafeInteger(page) || page < 0 || !Number.isSafeInteger(page * 20)) return false
    // Copy the fixture scope before crossing an asynchronous boundary.
    const captured = Object.freeze({ ...scope, relationships: Object.freeze(scope.relationships.map(r => Object.freeze({ ...r, locationIds: Object.freeze([...r.locationIds]) }))) })
    try {
      const raw = await dependencies.load(captured, page), now = clock()
      if (generation !== revision || key !== scopeKey(dependencies.scope()) || now === null) return false
      const projected = patientReleasedTimeline(raw, captured, page, now)
      value = projected; retainedKey = key
      return true
    } catch { if (generation === revision) clear(); return false }
  }
  // Future integration must clear on release/relationship withdrawal, offline and background.
  return { load, current, clear }
}
