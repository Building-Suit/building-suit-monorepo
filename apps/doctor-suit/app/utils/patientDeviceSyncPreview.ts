import { clinicalUuid } from './clinical.ts'
import type { PatientReportedState, ReportPreviewCommand } from './patientReportPreview.ts'
import type { ReminderPreviewEvent } from './patientReminderPreview.ts'
export interface PreviewInstallation { id: string; generation: number; actorAccountId: string; binding: string; registeredRevision: number; validUntil: number; revokedAt: number | null }
export interface DeviceSyncContext { binding: string; actorAccountId: string; revision: number; minimumRevision: number; checkedAt: number; validUntil: number; installations: readonly PreviewInstallation[]; syntheticOnly: true; clinicalApproval: false }
export interface PatientActionProposal { installationId: string; command: ReportPreviewCommand; outcome: 'unsubmitted' | 'unknown'; deviceTimezone: string }
export interface PatientActionServer extends DeviceSyncContext {
  events: readonly { eventId: string; version: number; reportedState: PatientReportedState; patientReported: true; clinicallyVerified: false }[]
  receipts: readonly { key: string; intent: string; eventId: string; version: number; status: 'recorded' | 'conflict' }[]
}
export interface NotificationOwnershipPolicy { mode: 'unknown' | 'single_owner'; ownerInstallationId: string | null; qualifiedPolicy: false }
export interface NotificationOwnershipLease {
  binding: string; actorAccountId: string; eventId: string; ownerInstallationId: string; generation: number; registryRevision: number; attemptKey: string
  status: 'issued' | 'unknown' | 'scheduled' | 'presented' | 'cancel_requested' | 'cancel_confirmed' | 'retired'
}
const instant = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0
function invalid(): never { throw Error('PATIENT_DEVICE_SYNC_PREVIEW_INVALID') }
function contextValid(context: DeviceSyncContext, now: number) {
  return !!context && context.syntheticOnly === true && context.clinicalApproval === false && typeof context.binding === 'string' && context.binding.length > 0 && context.binding.length <= 8192 && clinicalUuid(context.actorAccountId) && Number.isSafeInteger(context.revision) && context.revision >= 1 && Number.isSafeInteger(context.minimumRevision) && context.minimumRevision >= 0 && context.revision >= context.minimumRevision && instant(now) && instant(context.checkedAt) && context.checkedAt <= now && instant(context.validUntil) && now < context.validUntil && Array.isArray(context.installations) && context.installations.length <= 64 && new Set(context.installations.map(i => i.id)).size === context.installations.length && context.installations.every(i => clinicalUuid(i.id) && clinicalUuid(i.actorAccountId) && typeof i.binding === 'string' && Number.isSafeInteger(i.generation) && i.generation > 0 && Number.isSafeInteger(i.registeredRevision) && i.registeredRevision > 0 && i.registeredRevision <= context.revision && instant(i.validUntil) && (i.revokedAt === null || instant(i.revokedAt)))
}
function activeInstallation(context: DeviceSyncContext, id: string, now: number) { return context.installations.find(i => i.id === id && i.actorAccountId === context.actorAccountId && i.binding === context.binding && i.revokedAt === null && now < i.validUntil) ?? null }
/** Same exact-intent fingerprint as the M5-008 fixture protocol; never an approval/signature. */
export function patientActionPreviewIntent(input: ReportPreviewCommand) {
  if (!input || !clinicalUuid(input.key) || typeof input.eventId !== 'string' || !input.eventId || input.eventId.length > 512 || !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0 || input.patientTime !== null && !instant(input.patientTime) || !['taken', 'skip', 'snooze', 'correct'].includes(input.kind)) return invalid()
  const fields = ['key', 'eventId', 'expectedVersion', 'patientTime', 'kind', ...(input.kind === 'snooze' ? ['until'] : input.kind === 'correct' ? ['report', 'reason'] : [])]
  if (Object.keys(input).length !== fields.length || Object.keys(input).some(key => !fields.includes(key))) return invalid()
  if (input.kind === 'snooze' && !instant(input.until) || input.kind === 'correct' && (!['unreported', 'taken', 'skip'].includes(input.report) || typeof input.reason !== 'string' || !input.reason.trim() || input.reason.length > 400)) return invalid()
  return JSON.stringify([input.eventId, input.expectedVersion, input.kind, input.patientTime, input.kind === 'snooze' ? input.until : null, input.kind === 'correct' ? [input.report, input.reason] : null])
}
/** Read/compare proposals only. No offline storage, replay, server write or native call. */
export function planPatientActionSync(server: PatientActionServer, proposals: readonly PatientActionProposal[], now: number) {
  if (!contextValid(server, now) || !Array.isArray(server.events) || server.events.length > 512 || !Array.isArray(server.receipts) || server.receipts.length > 512 || !Array.isArray(proposals) || proposals.length > 512 || new Set(server.events.map(e => e.eventId)).size !== server.events.length || new Set(server.receipts.map(r => r.key)).size !== server.receipts.length) return invalid()
  const events = new Map<string, PatientActionServer['events'][number]>(server.events.map((e: PatientActionServer['events'][number]) => [e.eventId, e]))
  for (const event of server.events) if (typeof event.eventId !== 'string' || !event.eventId || event.eventId.length > 512 || !Number.isSafeInteger(event.version) || event.version < 0 || !['unreported', 'taken', 'skip'].includes(event.reportedState) || event.patientReported !== true || event.clinicallyVerified !== false) return invalid()
  for (const receipt of server.receipts) if (!clinicalUuid(receipt.key) || typeof receipt.intent !== 'string' || receipt.intent.length > 8192 || !events.has(receipt.eventId) || !Number.isSafeInteger(receipt.version) || receipt.version < 0 || receipt.version > events.get(receipt.eventId)!.version || !['recorded', 'conflict'].includes(receipt.status)) return invalid()
  const receipts = new Map<string, PatientActionServer['receipts'][number]>(server.receipts.map((r: PatientActionServer['receipts'][number]) => [r.key, r]))
  const sorted: PatientActionProposal[] = [...proposals].sort((a, b) => a.command.key.localeCompare(b.command.key) || a.installationId.localeCompare(b.installationId))
  const intents = sorted.map(p => { if (!clinicalUuid(p.installationId) || !['unsubmitted', 'unknown'].includes(p.outcome) || typeof p.deviceTimezone !== 'string' || p.deviceTimezone.length > 100) return invalid(); return patientActionPreviewIntent(p.command) })
  const eligible = sorted.map(p => !!activeInstallation(server, p.installationId, now))
  const owned = sorted.map(p => server.installations.some(i => i.id === p.installationId && i.actorAccountId === server.actorAccountId && i.binding === server.binding))
  const groups = new Map<string, Set<string>>()
  for (const [index, proposal] of sorted.entries()) if (eligible[index] && proposal.outcome === 'unsubmitted' && !receipts.has(proposal.command.key) && proposal.command.expectedVersion === events.get(proposal.command.eventId)?.version) {
    const keys = groups.get(proposal.command.eventId) ?? new Set<string>(); keys.add(proposal.command.key); groups.set(proposal.command.eventId, keys)
  }
  const seen = new Set<string>()
  const decisions = sorted.map((proposal, index) => {
    const command = proposal.command, event = events.get(command.eventId), saved = receipts.get(command.key)
    let status = 'ready_for_explicit_submit'
    if (!eligible[index]) status = 'device_unavailable'
    else if (sorted.some((other, otherIndex) => owned[otherIndex] && other.command.key === command.key && intents[otherIndex] !== intents[index])) status = 'key_reused'
    else if (saved) status = saved.intent !== intents[index] || saved.eventId !== command.eventId ? 'key_reused' : saved.status === 'recorded' ? 'recorded_on_server' : 'conflict_on_server'
    else if (sorted.some((other, otherIndex) => owned[otherIndex] && other.command.key === command.key && other.outcome === 'unknown')) status = 'lookup_receipt'
    else if (!event) status = 'event_unavailable'
    else if (command.expectedVersion !== event.version) status = 'version_conflict'
    else if ((groups.get(command.eventId)?.size ?? 0) > 1) status = 'needs_explicit_resolution'
    else if (seen.has(command.key)) status = 'duplicate_logical_request'
    else if (command.patientTime !== null && command.patientTime > now) status = 'device_clock_uncertain'
    else if (command.kind === 'snooze' && command.until <= now) status = 'expired_proposal'
    if (status === 'ready_for_explicit_submit') seen.add(command.key)
    return Object.freeze({ key: command.key, eventId: command.eventId, installationId: proposal.installationId, status, serverVersion: event?.version ?? null, receiptVersion: saved?.version ?? null, deviceTimeUnverified: true })
  })
  const conflicts = [...groups].filter(([, keys]) => keys.size > 1).sort(([a], [b]) => a.localeCompare(b)).map(([eventId, keys]) => Object.freeze({ eventId, serverVersion: events.get(eventId)!.version, proposalKeys: Object.freeze([...keys].sort()), winner: null, state: 'unresolved' as const }))
  return Object.freeze({ decisions: Object.freeze(decisions), conflicts: Object.freeze(conflicts), serverEvents: Object.freeze(server.events.map((e: PatientActionServer['events'][number]) => Object.freeze({ eventId: e.eventId, version: e.version, reportedState: e.reportedState, patientReported: true, clinicallyVerified: false }))), automaticMutations: Object.freeze([]), requiresServerValidation: true, syntheticOnly: true, clinicallyVerified: false, qualifiedDevicePolicy: false, externalNotifications: false })
}
/** Ownership proposal only; actual atomic claims/cancellation/delivery require approved server/native integration. */
export function planPatientNotificationOwner(context: DeviceSyncContext, event: ReminderPreviewEvent, notAfter: number, sourceActive: boolean, policy: NotificationOwnershipPolicy, lease: NotificationOwnershipLease | null, now: number) {
  if (!contextValid(context, now) || !event || typeof event.id !== 'string' || !event.id || event.id.length > 512 || !instant(Date.parse(event.occurrenceUtc)) || !instant(notAfter) || notAfter <= Date.parse(event.occurrenceUtc) || typeof sourceActive !== 'boolean' || !policy || policy.qualifiedPolicy !== false || !['unknown', 'single_owner'].includes(policy.mode)) return invalid()
  if (lease && (lease.binding !== context.binding || lease.actorAccountId !== context.actorAccountId || lease.eventId !== event.id || !clinicalUuid(lease.ownerInstallationId) || !Number.isSafeInteger(lease.generation) || lease.generation < 1 || !Number.isSafeInteger(lease.registryRevision) || lease.registryRevision < 1 || lease.registryRevision > context.revision || !['issued', 'unknown', 'scheduled', 'presented', 'cancel_requested', 'cancel_confirmed', 'retired'].includes(lease.status))) return invalid()
  if (lease && (!context.installations.some(i => i.id === lease.ownerInstallationId && i.generation === lease.generation && i.actorAccountId === context.actorAccountId && i.binding === context.binding) || lease.attemptKey !== event.id + ':installation:' + lease.ownerInstallationId + ':' + lease.generation)) return invalid()
  let action = 'disabled_no_policy', newAttemptKey: string | null = null, inspectAttemptKey: string | null = null, cancelAttemptKey: string | null = null
  if (lease?.status === 'retired' || !sourceActive || now >= notAfter) { action = 'retire'; if (lease && !['cancel_confirmed', 'retired'].includes(lease.status)) cancelAttemptKey = lease.attemptKey }
  else if (policy.mode === 'single_owner' && policy.ownerInstallationId) {
    const target = activeInstallation(context, policy.ownerInstallationId, now)
    if (!target) action = 'owner_unavailable'
    else if (lease && lease.ownerInstallationId === target.id && lease.generation === target.generation && !['cancel_confirmed', 'retired'].includes(lease.status)) { action = 'already_owned'; if (['issued', 'unknown', 'cancel_requested'].includes(lease.status)) inspectAttemptKey = lease.attemptKey }
    else if (lease?.status === 'cancel_confirmed' && lease.ownerInstallationId === target.id && lease.generation === target.generation) action = 'cancelled_same_owner'
    else if (lease && !['cancel_confirmed', 'retired'].includes(lease.status)) { action = 'cancel_then_inspect'; cancelAttemptKey = lease.attemptKey; inspectAttemptKey = lease.attemptKey }
    else if (now >= Date.parse(event.occurrenceUtc)) action = 'elapsed_no_catchup'
    else { action = 'propose_once'; newAttemptKey = event.id + ':installation:' + target.id + ':' + target.generation }
  }
  return Object.freeze({ eventId: event.id, action, newAttemptKey, inspectAttemptKey, cancelAttemptKey, expectedRegistryRevision: context.revision, requiresAtomicServerClaim: true, syntheticOnly: true, qualifiedDevicePolicy: false, clinicalApproval: false, externalNotifications: false })
}
