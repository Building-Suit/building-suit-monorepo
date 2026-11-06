import type { MeetingRecord, MeetingTask, WorkerResult } from '../../shared/meetings/domain.mjs'
import type { ReviewReceipt, SyntheticMeetingRepository } from './repository.mjs'
export function inspectSyntheticDeliverable(candidate: {
  mode: MeetingRecord['mode']; task: MeetingTask; result: WorkerResult
}): { accepted: boolean; reason: string }
export function reviewSyntheticResults(repository: SyntheticMeetingRepository, options?: { maxStages?: number; processId?: string }): {
  taskId: string; reviewerId: string; verdict: ReviewReceipt['verdict']; resultDigest: string; synthetic: true
}[]
