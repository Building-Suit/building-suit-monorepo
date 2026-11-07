import { createHash, randomBytes } from 'node:crypto'
import { isAbsolute } from 'node:path'
import { createError, getCookie, getHeader, setCookie, type H3Event } from 'h3'
import { assertHqAccessRequest, type HqAccessConfig } from './hqAccess'
import { hqHostedOrigin } from './brain'

export function requireMeetingDemo(event: H3Event, config: HqAccessConfig & { hqMeetingsDemo?: unknown; hqMeetingsDemoDatabase?: unknown }) {
  assertHqAccessRequest(event, config)
  if (hqHostedOrigin(config) !== null || process.env.VERCEL) throw createError({ statusCode: 503, statusMessage: 'Synthetic meetings are loopback-only' })
  if (config.hqMeetingsDemo !== true || typeof config.hqMeetingsDemoDatabase !== 'string' || !isAbsolute(config.hqMeetingsDemoDatabase)) throw createError({ statusCode: 503, statusMessage: 'Synthetic meeting preview is disabled' })
  let token = getCookie(event, 'bs-hq-synthetic-meeting')
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
    token = randomBytes(32).toString('base64url')
    setCookie(event, 'bs-hq-synthetic-meeting', token, { httpOnly: true, sameSite: 'strict', path: '/api/hq/meetings', maxAge: 86_400 })
  }
  // The public record contains the hash, never the unguessable session token.
  return { filename: config.hqMeetingsDemoDatabase, owner: `demo:${createHash('sha256').update(token).digest('hex')}` }
}

export async function readMeetingBody(event: H3Event): Promise<Record<string, unknown>> {
  const invalid = () => createError({ statusCode: 400, statusMessage: 'Invalid meeting request' })
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(getHeader(event, 'content-type') ?? '') || getHeader(event, 'content-encoding') && getHeader(event, 'content-encoding') !== 'identity') throw invalid()
  const length = getHeader(event, 'content-length')
  if (length && (!/^\d+$/.test(length) || Number(length) > 24576)) throw invalid()
  const request = event.node.req
  const body = await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []; let count = 0
    const cleanup = () => { clearTimeout(timer); request.removeListener('data', data); request.removeListener('end', end); request.removeListener('error', failure); request.removeListener('aborted', failure) }
    const failure = () => { cleanup(); reject(invalid()) }
    const data = (chunk: Buffer) => { count += chunk.length; if (count > 24576) { request.pause(); failure(); return }; chunks.push(chunk) }
    const end = () => { cleanup(); resolve(Buffer.concat(chunks)) }
    const timer = setTimeout(failure, 10000)
    request.on('data', data); request.once('end', end); request.once('error', failure); request.once('aborted', failure)
  })
  try { const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body)); if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid(); return value as Record<string, unknown> }
  catch { throw invalid() }
}
