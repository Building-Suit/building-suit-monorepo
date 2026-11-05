import type { MeetingRecord } from './domain.mjs'
import type { MeetingRegistryParticipant } from './registry.mjs'
import type { HqMeetingCommand } from '@building-suit/ui/types/hqMeetingPresentation'

export interface LiveMeetingRegistryParticipant extends MeetingRegistryParticipant {
  qualified: boolean
  supervisorId: string | null
  allowedTools: string[]
  registryReference: string
}
export interface LiveMeetingPlanTask {
  id: string
  objective: string
  ownerId: string
  supervisorId: string
  deliverable: string
  inputs: string[]
  dependencies: string[]
  allowedActions: string[]
  budget: 0
  acceptanceCriteria: string[]
  requiredReview: 'independent'
  blockers: string[]
  priority: number
  environment: 'qualified-cloud' | 'synthetic' | 'hq-existing-worker'
  timeLimitSeconds: number
  timeoutScope?: 'worker-job'
}
export interface LiveMeetingPlanDocument { title: string; summary?: string; tasks: LiveMeetingPlanTask[] }
export interface LiveMeetingRecord extends MeetingRecord {
  /** Exact normalized source document retained for versioned revision requests. */
  livePlanDocuments: Record<string, LiveMeetingPlanDocument>
  /** Latest blocked version only; the neutral domain state is deferred. */
  liveBlockedPlanIds: string[]
  liveContributionErrors: { agentId: string; error: string }[]
}
export interface LiveMeetingCreateRequest { type: 'create'; requestId: string; title: string; language: 'ar' | 'en'; participantIds: string[] }
export interface LiveMeetingCommandRequest { type: 'command'; requestId: string; meetingId: string; command: Record<string, unknown> }
export type LiveMeetingRequest = LiveMeetingCreateRequest | LiveMeetingCommandRequest
export type LiveMeetingTransportCommand = HqMeetingCommand | { type: 'playback-ended'; turnId: string; generation: number } | { type: 'reconnect' }
export interface LiveMeetingRequestContext { requestId: string; meetingId?: string; record?: LiveMeetingRecord | null; roster?: readonly LiveMeetingRegistryParticipant[] }

/** Throws for a malformed trusted RPC payload. Never infers qualification. */
export function parseLiveRoster(value: unknown): LiveMeetingRegistryParticipant[]
/** Agent output requires the actual persisted response correlation and digest. */
export function parseLiveMeetingSnapshot(value: unknown, roster: readonly LiveMeetingRegistryParticipant[]): LiveMeetingRecord | null
/** Produces the existing live route body; browser-local controls return null. */
export function buildLiveMeetingRequest(command: LiveMeetingTransportCommand, context: LiveMeetingRequestContext): LiveMeetingRequest | null
/** Second step after proposePlan: uses the returned immutable revision digest. */
export function buildLivePlanSubmission(record: LiveMeetingRecord, requestId: string, planId?: string): LiveMeetingCommandRequest
