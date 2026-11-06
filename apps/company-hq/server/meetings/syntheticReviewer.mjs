import { randomUUID } from 'node:crypto'

const SYNTHETIC_ACTIONS = new Set(['synthetic-fixture', 'read-fixture'])
const SYNTHETIC_TOOLS = new Set(['synthetic-fixture', 'fixture-read'])

/** Checks persisted fixture evidence without importing/calling its executor. */
export function inspectSyntheticDeliverable(candidate) {
  const { mode, task, result } = candidate
  if (mode !== 'demonstration' || task.kind !== 'execution' || task.status !== 'completed'
    || task.budget !== 0 || !task.allowedActions.length || !task.allowedTools.length
    || task.allowedActions.some(action => !SYNTHETIC_ACTIONS.has(action))
    || task.allowedTools.some(tool => !SYNTHETIC_TOOLS.has(tool))) return { accepted: false, reason: 'scope-is-not-explicit-synthetic-fixture' }
  const expected = `[SYNTHETIC FIXTURE] ${task.deliverable}. Question: ${task.question}. No repository, website, model or live employee was consulted.`
  if (result?.status !== 'completed' || result.deliverable !== expected || task.result !== expected
    || result.taskId !== task.id || result.generation !== task.generation) return { accepted: false, reason: 'stored-result-does-not-match-bounded-fixture-contract' }
  if (!Array.isArray(result.evidence) || result.evidence.length !== 1
    || result.evidence[0].url !== 'https://example.com/synthetic-meeting-fixture'
    || result.evidence[0].title !== 'Disposable synthetic worker fixture; no external request occurred'
    || result.evidence[0].excerpt !== 'Deterministic local test input only.'
    || !Number.isFinite(Date.parse(result.evidence[0].inspectedAt))) return { accepted: false, reason: 'fixture-evidence-missing-or-substituted' }
  return { accepted: true, reason: 'exact-synthetic-output-and-evidence-match;zero-budget;synthetic-only-actions' }
}

/** One bounded review pass; configured employee IDs remain synthetic actors. */
export function reviewSyntheticResults(repository, { maxStages = 32, processId = `fixture-reviewer:${randomUUID()}` } = {}) {
  if (!Number.isSafeInteger(maxStages) || maxStages < 1 || maxStages > 32) throw new Error('invalid-review-limit')
  const observations = []
  for (let stage = 0; stage < maxStages; stage++) {
    const candidate = repository.pendingReviews(1)[0]
    if (!candidate) break
    const inspection = inspectSyntheticDeliverable(candidate)
    const receipt = repository.review(candidate.ownerId, candidate.meetingId, candidate.taskId, {
      reviewerId: candidate.reviewerId,
      verdict: inspection.accepted ? 'accepted' : 'rejected',
      evidence: `[SYNTHETIC REVIEW PROCESS ${processId}] Independently inspected persisted task/result/evidence: ${inspection.reason}. This deterministic fixture check is not an employee qualification or live model review.`,
      requestId: randomUUID(),
    })
    observations.push({ taskId: candidate.taskId, reviewerId: receipt.reviewerId, verdict: receipt.verdict, resultDigest: receipt.resultDigest, synthetic: true })
  }
  return observations
}
