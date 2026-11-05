import type { MeetingTask, WorkerResult } from '../../shared/meetings/domain.mjs'
import type { MeetingLease, SyntheticMeetingRepository } from './repository.mjs'
export interface SyntheticExecutor {
  mode: 'synthetic'
  name: string
  execute(task: MeetingTask, context: { signal: AbortSignal; lease: MeetingLease }): Promise<Omit<WorkerResult, 'taskId' | 'generation'>>
}
export interface WorkerObservation {
  claimed: boolean
  synthetic: true
  taskId?: string
  status?: string
  attempt?: number
  elapsedMs?: number
  rssMiB?: number
  maxRssMiB?: number
}
export function validateResearchUrl(value: string, allowedHosts: string[]): string
export function createSyntheticExecutor(options?: { delayMs?: number; fail?: boolean }): SyntheticExecutor
export function createMeetingWorker(input: {
  repository: SyntheticMeetingRepository
  executor: SyntheticExecutor
  workerId?: string
  leaseMs?: number
  heartbeatMs?: number
}): { runOnce(): Promise<WorkerObservation> }
