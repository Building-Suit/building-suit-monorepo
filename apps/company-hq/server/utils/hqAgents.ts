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

/** Explicit projection prevents private worker identities/leases from leaking through the BFF. */
export function hqAgentSnapshot(value: unknown, event?: H3Event): HqAgentSnapshot {
  const snapshot = parseHqAgentSnapshot(value)
  if (!snapshot) throw createError({ statusCode: 503, statusMessage: 'HQ agents unavailable' })
  // Older open tabs validate exact job keys. Negotiate presentation metadata
  // so a rollout cannot invalidate their snapshots or interrupt their drafts.
  if (event && getHeader(event, 'x-hq-chat-progress') === '1') return snapshot
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
export async function hqTaskBody(event: H3Event): Promise<{ title: string; brief: string; acceptance: string; assigneeId: string | null; requestKey: string }> {
  const entry = exact(await boundedBody(event, 140000), ['title', 'brief', 'acceptance', 'assigneeId', 'requestKey'])
  if (!entry || !text(entry.title, 180) || !text(entry.brief, 12000) || !text(entry.acceptance, 6000) || !id(entry.requestKey)
    || !(entry.assigneeId === null || typeof entry.assigneeId === 'string' && /^AG-[A-Z]+-[0-9]{3}$/.test(entry.assigneeId))) {
    throw createError({ statusCode: 400, statusMessage: 'HQ task unavailable' })
  }
  return { title: String(entry.title).trim(), brief: String(entry.brief).trim(), acceptance: String(entry.acceptance).trim(),
    assigneeId: entry.assigneeId as string | null, requestKey: String(entry.requestKey).toLowerCase() }
}
