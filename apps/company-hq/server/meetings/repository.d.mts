import type { MeetingCommand, MeetingRecord, MeetingTask, WorkerResult } from '../../shared/meetings/domain.mjs'
export interface MeetingLease {
  id: string
  meetingId: string
  ownerId: string
  generation: number
  token: string
  workerId: string
  deadline: number
  attempt: number
  payload: MeetingTask
}
export interface ReviewReceipt {
  reviewerId: string
  stage: 'supervisor' | 'steve'
  verdict: 'accepted' | 'revision-required' | 'rejected'
  evidence: string
  requestId: string
  resultDigest: string
  at: string
  synthetic: true
}
export interface MeetingJobReceipt {
  id: string
  status: MeetingTask['status']
  generation: number
  attempts: number
  leaseUntil: number | null
  deadline: number | null
  result: WorkerResult | null
  review: { supervisor?: ReviewReceipt; steve?: ReviewReceipt } | null
  error: string | null
}
export interface MutationOptions { requestId?: string; expectedRevision?: number }
export interface SyntheticMeetingRepository {
  create(owner: string, record: MeetingRecord): MeetingRecord
  load(owner: string, meetingId: string): MeetingRecord
  get(owner: string, meetingId: string): MeetingRecord
  list(owner: string): MeetingRecord[]
  save(owner: string, record: MeetingRecord, options: { expectedRevision: number }): MeetingRecord
  command(owner: string, meetingId: string, command: MeetingCommand, options?: MutationOptions): MeetingRecord
  claim(workerId: string, options?: { leaseMs?: number }): MeetingLease | null
  heartbeat(lease: MeetingLease, options?: { leaseMs?: number }): true
  complete(lease: MeetingLease, output: Omit<WorkerResult, 'taskId' | 'generation'>): MeetingRecord
  cancel(owner: string, meetingId: string, taskId: string, options?: MutationOptions): MeetingRecord
  review(owner: string, meetingId: string, taskId: string, input: {
    reviewerId: string
    stage?: 'supervisor' | 'steve'
    verdict: ReviewReceipt['verdict']
    evidence: string
    requestId?: string
  }): ReviewReceipt
  jobs(owner: string, meetingId: string): MeetingJobReceipt[]
  report(owner: string, meetingId: string): {
    taskId: string; status: MeetingTask['status']; result: WorkerResult | null
    reviews: MeetingJobReceipt['review']; readyForFounder: boolean; destination: string; synthetic: true
  }[]
  /** Internal synthetic processor only. Never expose this cross-owner queue over HTTP. */
  pendingReviews(limit?: number): {
    ownerId: string; meetingId: string; taskId: string; reviewerId: string
    mode: MeetingRecord['mode']; task: MeetingTask; result: WorkerResult
    reviews: MeetingJobReceipt['review']
  }[]
  delete(owner: string, meetingId: string): true
  close(): void
}
export class MeetingRepositoryError extends Error { constructor(code: string); readonly code: string }
export function createSyntheticMeetingRepository(options: { filename: string; synthetic: true; now?: () => number }): SyntheticMeetingRepository
