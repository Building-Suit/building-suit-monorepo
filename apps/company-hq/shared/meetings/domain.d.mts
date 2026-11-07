export type MeetingLanguage = 'ar' | 'en'
export type ParticipantStatus = 'listening' | 'thinking' | 'speaking' | 'researching' | 'hand-raised' | 'unavailable' | 'failed'
export interface VoiceProfile {
  agentId: string
  provider: string
  voiceId: string | null
  languages: MeetingLanguage[]
  dialects?: string[]
  settings?: Record<string, unknown>
  available: boolean
  fallback: 'none'
}
export interface MeetingParticipantInput {
  id: string
  name: string
  nameAr?: string
  role: string
  avatar?: string
  supervisorId?: string | null
  /** Fresh canonical registry source/version reference supplied by the trusted reader. */
  registryReference: string
  qualified?: boolean
  allowedTools?: string[]
  voice?: VoiceProfile
}
export interface MeetingParticipant extends MeetingParticipantInput {
  status: ParticipantStatus
  handRaised: boolean
  qualified: boolean
  allowedTools: string[]
  voice: VoiceProfile
}
export interface MeetingMeta {
  actorId: string
  kind?: 'founder' | 'coordinator' | 'worker' | 'playback'
  now?: string
  id?: string
}
export interface MeetingEvent {
  id: string
  type: string
  category: 'transcription' | 'interpretation' | 'founder-instruction' | 'meeting-event' | 'agent-contribution' | 'reference' | 'proposal' | 'founder-decision' | 'verified-finding' | 'approved-execution-instruction'
  actorId: string
  at: string
  data: Record<string, unknown>
}
export interface ResearchTaskInput {
  id: string
  agentId: string
  supervisorId: string
  question: string
  scope: string
  allowedTools: string[]
  allowedActions: string[]
  links: string[]
  deliverable: string
  budget: 0
  timeoutMs: number
  dependencies?: string[]
}
export interface PlanTaskInput {
  id: string
  objective: string
  owner: string
  supervisor: string
  deliverable: string
  inputs: string[]
  dependencies: string[]
  allowedActions: string[]
  allowedTools?: string[]
  links?: string[]
  scope?: string
  budget: 0
  acceptanceCriteria: string[]
  /** Ordered independent chain: supervising head then Steve, with no duplicate or author. */
  requiredReview: string[]
  blockers: string[]
  priority: 'low' | 'normal' | 'high'
  executionEnvironment: string
  timeoutMs?: number
}
export interface TaskEvidence { url: string; title: string; excerpt?: string; inspectedAt?: string }
export interface MeetingTask extends ResearchTaskInput {
  meetingId: string
  kind: 'research' | 'execution'
  resourceLimits: { concurrency: 1; maxOutputBytes: number }
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
  generation: number
  attempt: number
  maxAttempts: number
  createdAt: string
  startedAt: string | null
  completedAt: string | null
  cancellationRequested: boolean
  evidence: TaskEvidence[]
  result: string | null
  error: string | null
  resultEventId?: string
  reportEventId?: string
  planId?: string
  planVersion?: number
  planHash?: string
  requiredReview?: string[]
  reviews?: { reviewerId: string; decision: 'accepted' | 'rejected'; note: string; at: string; sourceEventId: string | null }[]
  reviewStatus?: 'pending' | 'accepted' | 'rejected'
}
export interface MeetingPlan {
  id: string
  version: number
  title: string
  summary: string
  tasks: PlanTaskInput[]
  hash: string
  status: 'draft' | 'awaiting-approval' | 'approved' | 'dispatched' | 'revised' | 'deferred' | 'discarded'
  approval: { actorId: string; at: string; version: number; hash: string; start: 'now' | 'meeting-end' | 'manual' } | null
  createdAt: string
  sourceEventIds: string[]
}
export interface MeetingTurn {
  id: string
  agentId: string
  generation: number
  language: MeetingLanguage
  status: 'thinking' | 'speaking' | 'interrupted' | 'completed'
  sourceEventId: string | null
  reportTaskId: string | null
  contributionEventId?: string
  interruptedAt?: string
}
export interface DispatchReceipt { key: string; taskId: string; planId: string; planVersion: number; planHash: string; at: string; trigger: string }
export interface MeetingRecord {
  id: string
  founderId: string
  title: string
  mode: 'demonstration' | 'live'
  chairId: string
  language: MeetingLanguage
  dialect: string | null
  status: 'active' | 'ended'
  connection: 'connected' | 'reconnecting' | 'disconnected'
  disconnectPolicy: 'hold' | 'dispatch-approved'
  participants: MeetingParticipant[]
  floor: { kind: 'unassigned' | 'founder' } | { kind: 'agent'; agentId: string }
  paused: boolean
  generation: number
  turn: MeetingTurn | null
  pendingRoute: { agentId: string; sourceEventId: string | null; summary?: boolean; clarification?: boolean; reportTaskId?: string | null; coordinationOnly?: boolean } | null
  interruptedTurn: MeetingTurn | null
  revision: number
  events: MeetingEvent[]
  tasks: MeetingTask[]
  plans: MeetingPlan[]
  dispatches: DispatchReceipt[]
  commandReceipts: { id: string; hash: string }[]
  createdAt: string
  endedAt: string | null
}
export interface CreateMeetingInput {
  id: string
  founderId: string
  title: string
  language?: MeetingLanguage
  participants: MeetingParticipantInput[]
  mode?: 'demonstration' | 'live'
  chairId?: string
  disconnectPolicy?: 'hold' | 'dispatch-approved'
}
export type MeetingCommand =
  | { type: 'utterance'; text: string; source?: 'text' | 'speech'; final: true; confidence?: number; uncertain?: boolean; addressedTo?: string }
  | { type: 'interrupt' | 'pause' | 'continue' }
  | { type: 'language'; language: MeetingLanguage; dialect?: string | null }
  | { type: 'grant-floor'; agentId: string; taskId?: string }
  | { type: 'agent-start'; agentId: string; turnId: string }
  | { type: 'agent-contribution'; agentId: string; turnId: string; generation: number; text: string }
  | { type: 'agent-failed'; agentId: string; reason?: string }
  | { type: 'speech-ended'; turnId: string; generation: number }
  | { type: 'raise-hand'; agentId: string; reason: string }
  | { type: 'dismiss-hand'; agentId: string }
  | { type: 'share-link'; url: string; text?: string }
  | { type: 'chat'; text: string }
  | { type: 'research'; task: ResearchTaskInput }
  | { type: 'worker-accepted' | 'retry-task'; taskId: string; generation: number }
  | { type: 'cancel-task'; taskId: string }
  | { type: 'review-task'; taskId: string; decision: 'accepted' | 'rejected'; note: string; sourceEventId?: string }
  | { type: 'propose-plan' | 'revise-plan'; planId: string; title: string; summary: string; tasks: PlanTaskInput[]; sourceEventIds?: string[] }
  | { type: 'submit-plan' | 'dispatch-plan'; planId: string; version: number; hash: string }
  | { type: 'decision'; planId: string; version: number; hash: string; decision: 'approve' | 'revise' | 'defer' | 'discard'; source: 'control'; confirmed: true; start?: 'now' | 'meeting-end' | 'manual' }
  | { type: 'connection'; state: 'connected' | 'reconnecting' | 'disconnected' }
  | { type: 'end'; intentional: true }
export interface WorkerResult { taskId: string; generation: number; status: 'completed' | 'failed' | 'cancelled'; deliverable?: string; evidence?: TaskEvidence[]; error?: string }
export class MeetingError extends Error { constructor(code: string, message?: string); readonly code: string }
export function createMeeting(input: CreateMeetingInput, meta?: Partial<MeetingMeta>): MeetingRecord
export function applyCommand(record: MeetingRecord, command: MeetingCommand, meta: MeetingMeta): MeetingRecord
export function acceptWorkerResult(record: MeetingRecord, result: WorkerResult, meta: MeetingMeta): MeetingRecord
export function meetingDigest(value: unknown): string
export function safeSharedUrl(input: string): string
export function resolveRecentLink(record: MeetingRecord, referenceEventId?: string): { status: 'resolved'; url: string; sourceEventId: string } | { status: 'ambiguous' | 'missing'; candidates: { url: string; sourceEventId: string }[] }
export function meetingContext(record: MeetingRecord, agentId: string, maximum?: number): { meetingId: string; language: MeetingLanguage; dialect: string | null; agentId: string; mode: 'demonstration' | 'live'; founderId: string; chairId: string; instruction: string; recentEvents: MeetingEvent[]; decisionEvents: MeetingEvent[]; findings: { taskId: string; resultEventId?: string; evidence: TaskEvidence[]; result: string | null }[]; planVersions: Pick<MeetingPlan, 'id' | 'version' | 'hash' | 'status'>[] }
export const meetingLimits: Readonly<{ participants: number; events: number; commands: number; tasks: number; plans: number; text: number; output: number }>
