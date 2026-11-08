import { createError, getHeader, type H3Event } from 'h3'
import { hasHqControlCharacters, parseHqAgentSnapshot, type HqAgentSnapshot } from '../../shared/types/agents'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}
function exact(value: unknown, keys: string[]) {
  const entry = object(value)
  return entry && Object.keys(entry).length === keys.length && Object.keys(entry).every(key => keys.includes(key)) ? entry : null
}
function text(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max && !hasHqControlCharacters(value)
}
function id(value: unknown) { return typeof value === 'string' && UUID.test(value) }

export async function hqStaffingDecisionBody(event: H3Event): Promise<{ planId: string; digest: string; decision: 'approved' | 'rejected'; resumeOriginal: boolean; requestKey: string }> {
  const entry = exact(await boundedBody(event, 2048), ['planId', 'digest', 'decision', 'resumeOriginal', 'requestKey'])
  if (!entry || !id(entry.planId) || !id(entry.requestKey) || typeof entry.digest !== 'string' || !/^[0-9a-f]{64}$/.test(entry.digest)
    || !['approved','rejected'].includes(String(entry.decision)) || typeof entry.resumeOriginal !== 'boolean'
    || entry.decision === 'rejected' && entry.resumeOriginal) throw createError({ statusCode: 400, statusMessage: 'HQ staffing decision unavailable' })
  return { planId: String(entry.planId), digest: entry.digest, decision: entry.decision as 'approved' | 'rejected',
    resumeOriginal: entry.resumeOriginal, requestKey: String(entry.requestKey) }
}

/** Explicit projection prevents private worker identities/leases from leaking through the BFF. */
export function hqAgentSnapshot(value: unknown, event?: H3Event): HqAgentSnapshot {
  const snapshot = parseHqAgentSnapshot(value)
  if (!snapshot) throw createError({ statusCode: 503, statusMessage: 'HQ agents unavailable' })
  // Older open tabs validate exact job keys. Negotiate presentation metadata
  // so a rollout cannot invalidate their snapshots or interrupt their drafts.
  if (event && getHeader(event, 'x-hq-chat-progress') === '1') {
    if (getHeader(event, 'x-hq-staffing') === '1') return snapshot
    // Existing tabs know the ordinary kind enum. Preserve their job/status
    // projection without sending a new kind they cannot parse.
    return { ...snapshot, jobs: snapshot.jobs.map(job => {
      if (!['staffing-plan','staffing-review'].includes(job.kind ?? '')) return job
      const compatible = { ...job }
      delete compatible.kind
      return compatible
    }) }
  }
  return { ...snapshot, jobs: snapshot.jobs.map(job => ({ id: job.id, agentId: job.agentId, status: job.status,
    createdAt: job.createdAt, startedAt: job.startedAt, completedAt: job.completedAt, error: job.error })) }
}

/** Bounded UTF-8 stream; framework defaults must not read an unbounded message body first. */
async function boundedBody(event: H3Event, limit: number): Promise<unknown> {
  const invalid = () => createError({ statusCode: 400, statusMessage: 'HQ message unavailable' })
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(getHeader(event, 'content-type') ?? '')
    || getHeader(event, 'content-encoding') && getHeader(event, 'content-encoding') !== 'identity') throw invalid()
  const length = getHeader(event, 'content-length')
  if (length && (!/^\d+$/.test(length) || Number(length) > limit)) throw invalid()
  const request = event.node.req
  const body = await new Promise<Buffer>((resolveBody, rejectBody) => {
    const chunks: Buffer[] = []; let count = 0
    const cleanup = () => {
      clearTimeout(timer); request.removeListener('data', onData); request.removeListener('end', onEnd)
      request.removeListener('error', onError); request.removeListener('aborted', onError)
    }
    const onError = () => { cleanup(); rejectBody(invalid()) }
    const onData = (chunk: Buffer | string) => {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      count += bytes.length
      if (count > limit) { request.pause(); onError(); return }
      chunks.push(bytes)
    }
    const onEnd = () => { cleanup(); resolveBody(Buffer.concat(chunks)) }
    const timer = setTimeout(() => { request.pause(); onError() }, 10000)
    request.on('data', onData); request.once('end', onEnd); request.once('error', onError); request.once('aborted', onError)
  })
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body)) }
  catch { throw invalid() }
}
export async function hqCeoMessageBody(event: H3Event): Promise<{ prompt: string; requestKey: string }> {
  const entry = exact(await boundedBody(event, 40000), ['prompt', 'requestKey'])
  if (!entry || !text(entry.prompt, 6000) || !id(entry.requestKey)) throw createError({ statusCode: 400, statusMessage: 'HQ message unavailable' })
  return { prompt: String(entry.prompt).trim(), requestKey: String(entry.requestKey).toLowerCase() }
}
export async function hqTrialBody(event: H3Event): Promise<{ trialId: string }> {
  const qualification = exact(await boundedBody(event, 4096), ['trialId'])
  if (qualification && id(qualification.trialId)) return { trialId: String(qualification.trialId) }
  throw createError({ statusCode: 400, statusMessage: 'HQ trial qualification unavailable' })
}

/** Fixed Research policy trial; no caller-supplied agent, model, URL or tool config. */
export async function hqPublicResearchTrialBody(event: H3Event): Promise<{ skillFileId: string; requestKey: string }> {
  const entry = exact(await boundedBody(event, 2048), ['skillFileId', 'requestKey'])
  if (!entry || typeof entry.skillFileId !== 'string' || !/^[A-Za-z0-9_-]{8,200}$/.test(entry.skillFileId)
    || !id(entry.requestKey)) throw createError({ statusCode: 400, statusMessage: 'HQ research trial unavailable' })
  return { skillFileId: entry.skillFileId, requestKey: String(entry.requestKey) }
}

/** Assigned-skill fixture trial only; reviewer/model/tool authority are server-owned. */
export async function hqOrdinaryTrialBody(event: H3Event): Promise<{ agentId: string; skillFileId: string; requestKey: string }> {
  const entry = exact(await boundedBody(event, 2048), ['agentId', 'skillFileId', 'requestKey'])
  if (!entry || typeof entry.agentId !== 'string' || !/^AG-[A-Z]{2,10}-[0-9]{3}$/.test(entry.agentId)
    || typeof entry.skillFileId !== 'string' || !/^[A-Za-z0-9_-]{8,200}$/.test(entry.skillFileId)
    || !id(entry.requestKey)) throw createError({ statusCode: 400, statusMessage: 'HQ skill trial unavailable' })
  return { agentId: entry.agentId, skillFileId: entry.skillFileId, requestKey: String(entry.requestKey) }
}

/** Finite public criteria; no freeform provider query, URL or private context. */
export async function hqPublicRetailTrialBody(event: H3Event): Promise<{ skillFileId: string; category: 'clothing' | 'footwear' | 'homewares'; requestKey: string }> {
  const entry = exact(await boundedBody(event, 2048), ['skillFileId', 'category', 'requestKey'])
  if (!entry || typeof entry.skillFileId !== 'string' || !/^[A-Za-z0-9_-]{8,200}$/.test(entry.skillFileId)
    || typeof entry.category !== 'string' || !['clothing','footwear','homewares'].includes(entry.category) || !id(entry.requestKey))
    throw createError({ statusCode: 400, statusMessage: 'HQ retail trial unavailable' })
  return { skillFileId: entry.skillFileId, category: entry.category as 'clothing' | 'footwear' | 'homewares', requestKey: String(entry.requestKey) }
}
