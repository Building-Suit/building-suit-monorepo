import { getCookie, getHeader, getRequestIP, setCookie, createError, setResponseHeader } from 'h3'
import type { H3Event } from 'h3'
import { configuration, requireOrigin } from './hqAuth'
import { HqStore } from './hqStore'
import { HqRemoteStore } from './hqRemoteStore'
import { HqProblem } from './hqDomain'
let instance: HqStore | HqRemoteStore | null = null
let configuredPath = ''
export const sessionCookie = (secure: boolean, environment = configuration()?.environment || 'local') => (secure ? '__Host-' : '') + 'bs-company-hq-' + environment + '-session'
export function runtime(event: H3Event) {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const config = configuration()
  if (!config) throw new HqProblem(503, 'HQ_UNCONFIGURED', 'HQ authentication and dedicated storage are not configured.')
  const identity = config.remote?.url || config.dataPath
  if (!instance || configuredPath !== identity) { instance?.close(); instance = config.remote ? new HqRemoteStore(config.remote.url, config.remote.key) : new HqStore(config.dataPath); configuredPath = identity }
  return { config, store: instance }
}
export async function founder(event: H3Event) {
  const context = runtime(event)
  const token = getCookie(event, sessionCookie(context.config.origin.startsWith('https:'))) || ''
  if (!/^[A-Za-z0-9_-]{43}$/.test(token) || !await context.store.sessionValid(token)) throw new HqProblem(401, 'HQ_UNAUTHORIZED', 'Sign in with the HQ founder account.')
  return { ...context, actor: { id: 'founder', role: 'founder' as const }, token }
}
export function mutationOrigin(event: H3Event, origin: string) { requireOrigin(getHeader(event, 'origin'), origin) }
export function loginAddress(event: H3Event) { return getRequestIP(event, { xForwardedFor: false }) || 'unknown' }
export async function jsonBody(event: H3Event) {
  if (!getHeader(event, 'content-type')?.startsWith('application/json')) throw new HqProblem(415, 'HQ_CONTENT_TYPE', 'JSON is required.')
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of event.node.req.iterator({ destroyOnReturn: false })) {
    size += Buffer.byteLength(chunk)
    if (size > 40_000) { event.node.req.resume(); throw new HqProblem(413, 'HQ_TOO_LARGE', 'Request is too large.') }
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  let body: unknown
  try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { throw new HqProblem(422, 'HQ_INVALID_JSON', 'Valid JSON is required.') }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HqProblem(422, 'HQ_INVALID_JSON', 'A JSON object is required.')
  return body as Record<string, unknown>
}
export function writeSession(event: H3Event, token: string, origin: string) {
  const secure = origin.startsWith('https:')
  setCookie(event, sessionCookie(secure), token, { httpOnly: true, secure, sameSite: 'strict', path: '/', maxAge: token ? 8 * 60 * 60 : 0 })
}
export async function safe<T>(operation: () => T | Promise<T>) {
  try { return await operation() }
  catch (error) {
    if (error instanceof HqProblem) throw createError({ statusCode: error.status, statusMessage: error.message, data: { code: error.code } })
    throw createError({ statusCode: 503, statusMessage: 'HQ is temporarily unavailable. No automatic paid fallback is enabled.' })
  }
}
