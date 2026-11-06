import type { MeetingTask, TaskEvidence } from '../../shared/meetings/domain.mjs'

export interface PublicRepositoryInspectionReport {
  schemaVersion: 1
  type: 'public-github-repository-inspection'
  mode: 'public-read-only'
  inspectedAt: string
  repository: { owner: string; name: string; url: string; visibility: 'public'; defaultBranch: string | null }
  inspection: {
    requests: number
    maximumRequests: 5
    bytesReceived: number
    maximumBytes: number
    authentication: 'none'
    networkHost: 'api.github.com'
    sources: { kind: string; url: string; status: 'inspected' | 'unavailable' | 'failed'; bytes: number; sha256: string | null; inspectedAt: string }[]
    codeExecuted: false
    repositoryInstructionsFollowed: false
  }
  capabilities: Record<string, unknown>
  license: Record<string, unknown>
  maintenance: Record<string, unknown>
  integration: Record<string, unknown>
  dependencies: Record<string, unknown>
  modelAndProviderRequirements: Record<string, unknown>
  operatingCost: Record<string, unknown>
  securityAndDataHandling: Record<string, unknown>
  fitForUseCase: Record<string, unknown>
  unknowns: string[]
  recommendedNextAction: string
}
export interface PublicRepositoryResearchExecutor {
  /** Existing synthetic-only workers deliberately reject this distinct mode. */
  mode: 'public-read-only'
  name: string
  execute(task: MeetingTask, context?: { signal?: AbortSignal }): Promise<{ status: 'completed'; deliverable: string; evidence: TaskEvidence[]; report: PublicRepositoryInspectionReport }>
}
export class PublicRepositoryResearchError extends Error { constructor(code: string); readonly code: string }
export function createPublicRepositoryResearchExecutor(options?: { fetch?: typeof globalThis.fetch }): PublicRepositoryResearchExecutor
