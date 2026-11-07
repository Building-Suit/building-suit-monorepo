import { createHash, randomBytes } from 'node:crypto'
import { createError, deleteCookie, getCookie, getHeader, setCookie, setResponseHeader, setResponseStatus, type H3Event } from 'h3'
import { createRequestRateLimit } from '@building-suit/auth/rate-limit'
import type { HqFounderAccessResponse } from '../../shared/types/access'
import { assertLocalBrainRequest, hqHostedOrigin } from './brain'

export interface HqAccessConfig {
  hqSupabaseUrl?: unknown
  hqSupabasePublishableKey?: unknown
  hqEnvironment?: unknown
  hqFounderEmail?: unknown
  hqBrainDevProxyToken?: unknown
  hqAppOrigin?: unknown
}

interface VerifiedConfig {
  url: string
  key: string
  environment: 'staging' | 'production'
  project: string
  founderEmail: string
  appOrigin: string | null
}

interface SessionTokens { accessToken: string; refreshToken: string; expiresIn: number }
export interface HqFounderSession { accessToken: string; user: { id: string; email: string } }
type AccessReason = NonNullable<HqFounderAccessResponse['reason']>
const PROJECTS = { staging: 'dpruoncalmwicrqhqelu', production: 'nkpvskyugnnnozepbwzb' } as const
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TOKEN = /^[A-Za-z0-9._~-]+$/
const MAX_INPUT_BYTES = 8_192
const MAX_PROVIDER_BYTES = 1536 * 1_024
const limitAttempt = createRequestRateLimit(6, 300_000, 128)
const refreshing = new Map<string, Promise<SessionTokens>>()

class ProviderError extends Error {
  constructor(readonly status: number, readonly confirmationRequired = false) { super('HQ provider request unavailable') }
}

function failure(statusCode: number, reason: AccessReason) {
  return createError({ statusCode, statusMessage: 'HQ access unavailable', data: { reason } })
}

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function verifiedConfig(config: HqAccessConfig): VerifiedConfig {
  const environment = config.hqEnvironment ?? 'staging'
  if (environment !== 'staging' && environment !== 'production') throw failure(503, 'setup-required')
  const project = PROJECTS[environment]
  if (typeof config.hqSupabaseUrl !== 'string' || config.hqSupabaseUrl !== `https://${project}.supabase.co`
    || typeof config.hqSupabasePublishableKey !== 'string') throw failure(503, 'setup-required')
  const key = config.hqSupabasePublishableKey
  let acceptable = /^sb_publishable_[A-Za-z0-9_-]{16,512}$/.test(key)
  // Legacy anon keys are accepted only for this immutable project. Decoding is
  // a configuration guard, never token verification or user authorization.
  if (!acceptable && key.length <= 4_096 && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key)) {
    try {
      const payload = object(JSON.parse(Buffer.from(key.split('.')[1] ?? '', 'base64url').toString('utf8')))
      acceptable = payload?.role === 'anon' && payload.ref === project
    }
    catch { acceptable = false }
  }
  const founderEmail = typeof config.hqFounderEmail === 'string' ? config.hqFounderEmail.trim().toLowerCase() : 'ceo@building-suit.com'
  if (!acceptable || !/^[^\s@]{1,64}@[^\s@.]+(?:\.[^\s@.]+)+$/.test(founderEmail) || founderEmail.length > 254) throw failure(503, 'setup-required')
  return { url: config.hqSupabaseUrl, key, environment, project, founderEmail, appOrigin: hqHostedOrigin(config) }
}

export function assertHqAccessRequest(event: H3Event, config: HqAccessConfig): void {
  assertLocalBrainRequest(event, config)
  setResponseHeader(event, 'Vary', 'Origin, X-HQ-Brain, X-HQ-Access')
  if (getHeader(event, 'x-hq-access') !== '1') throw failure(403, 'not-founder')
  // Mutations require the browser's actual Origin as well as the configured
  // Host/same-origin/custom-header gate. Forwarded headers grant nothing.
  if (event.method !== 'GET' && !getHeader(event, 'origin')) throw failure(403, 'not-founder')
}

async function responseJson(response: Response): Promise<unknown> {
  if (response.status === 204) return null
  if (!response.headers.get('content-type')?.toLowerCase().includes('application/json')) throw failure(503, 'cloud-unavailable')
  const declared = response.headers.get('content-length')
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > MAX_PROVIDER_BYTES)) throw failure(503, 'cloud-unavailable')
  const reader = response.body?.getReader()
  if (!reader) throw failure(503, 'cloud-unavailable')
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    while (true) {
      const next = await reader.read()
      if (next.done) break
      length += next.value.byteLength
      if (length > MAX_PROVIDER_BYTES) { await reader.cancel(); throw failure(503, 'cloud-unavailable') }
      chunks.push(next.value)
    }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)))
  }
  catch { throw failure(503, 'cloud-unavailable') }
  finally { reader.releaseLock() }
}

async function provider(config: VerifiedConfig, path: string, options: { method?: 'GET' | 'POST'; accessToken?: string; body?: Record<string, unknown>; signal?: AbortSignal } = {}): Promise<unknown> {
  try {
    const body = options.body ? JSON.stringify(options.body) : undefined
    if (body && Buffer.byteLength(body) > MAX_PROVIDER_BYTES) throw failure(400, 'cloud-unavailable')
    const response = await fetch(`${config.url}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        apikey: config.key, Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}),
      },
      body,
      signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(8_000)]) : AbortSignal.timeout(8_000),
      redirect: 'error',
      cache: 'no-store',
    })
    const data = await responseJson(response)
    if (!response.ok) throw new ProviderError(response.status, object(data)?.error_code === 'email_not_confirmed')
    return data
  }
  catch (error: unknown) {
    if (error instanceof ProviderError) throw error
    throw failure(503, 'cloud-unavailable')
  }
}

function cookieOptions(event: H3Event, config: VerifiedConfig) {
  return {
    httpOnly: true, sameSite: 'strict' as const, path: '/api',
    secure: config.appOrigin !== null || config.environment === 'production' || Boolean((event.node.req.socket as { encrypted?: boolean }).encrypted),
  }
}
function cookieNames(config: VerifiedConfig) {
  // Versioned names prevent an older longer-path cookie from shadowing the
  // new Brain-capable /api session in an incoming Cookie header.
  const prefix = `bs-hq-${config.environment}-${config.project}-v2`
  return { access: `${prefix}-access`, refresh: `${prefix}-refresh` }
}
function clearLegacyCookies(event: H3Event, config: VerifiedConfig) {
  const prefix = `bs-hq-${config.environment}-${config.project}`
  const options = cookieOptions(event, config)
  for (const name of [`${prefix}-access`, `${prefix}-refresh`]) {
    deleteCookie(event, name, { ...options, path: '/api/hq' })
    deleteCookie(event, name, { ...options, path: '/api' })
  }
}
function clearCookies(event: H3Event, config: VerifiedConfig) {
  const names = cookieNames(config)
  const options = cookieOptions(event, config)
  deleteCookie(event, names.access, options)
  deleteCookie(event, names.refresh, options)
  clearLegacyCookies(event, config)
}
function storeCookies(event: H3Event, config: VerifiedConfig, tokens: SessionTokens) {
  const names = cookieNames(config)
  const options = cookieOptions(event, config)
  clearLegacyCookies(event, config)
  setCookie(event, names.access, tokens.accessToken, { ...options, maxAge: Math.max(1, Math.min(tokens.expiresIn, 86_400)) })
  setCookie(event, names.refresh, tokens.refreshToken, { ...options, maxAge: 7 * 86_400 })
}
function tokenString(value: unknown, maximum: number): value is string {
  return typeof value === 'string' && value.length >= 10 && value.length <= maximum && TOKEN.test(value)
}
function sessionTokens(value: unknown): SessionTokens {
  const session = object(value)
  if (!session || !tokenString(session.access_token, 3_500) || !tokenString(session.refresh_token, 2_000)
    || typeof session.expires_in !== 'number' || !Number.isFinite(session.expires_in) || session.expires_in < 1) throw failure(503, 'cloud-unavailable')
  return { accessToken: session.access_token, refreshToken: session.refresh_token, expiresIn: Math.floor(session.expires_in) }
}

async function emailConfirmationRequired(config: VerifiedConfig) {
  const settings = object(await provider(config, '/auth/v1/settings'))
  if (settings?.mailer_autoconfirm !== false) throw failure(503, 'setup-required')
}

async function refreshTokens(config: VerifiedConfig, refreshToken: string): Promise<SessionTokens> {
  const key = createHash('sha256').update(config.project).update(refreshToken).digest('hex')
  const existing = refreshing.get(key)
  if (existing) return existing
  if (refreshing.size >= 32) throw failure(503, 'cloud-unavailable')
  const task = provider(config, '/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: refreshToken } })
    .then(sessionTokens).finally(() => refreshing.delete(key))
  refreshing.set(key, task)
  return task
}

async function verifiedUser(config: VerifiedConfig, accessToken: string): Promise<HqFounderSession['user']> {
  const user = object(await provider(config, '/auth/v1/user', { accessToken }))
  if (!user || typeof user.id !== 'string' || !UUID.test(user.id) || typeof user.email !== 'string'
    || user.email.toLowerCase() !== config.founderEmail || user.is_anonymous === true
    || typeof user.email_confirmed_at !== 'string' || !Number.isFinite(Date.parse(user.email_confirmed_at))) throw failure(403, 'not-founder')
  return { id: user.id, email: user.email }
}

/** Only server-selected HQ RPCs; caller must requireHqFounder for privileged work. */
export async function hqRpc<T>(config: HqAccessConfig, accessToken: string, name: string, body: Record<string, unknown> = {}, signal?: AbortSignal): Promise<T> {
  const verified = verifiedConfig(config)
  if (!/^hq_[a-z0-9_]{1,80}$/.test(name) || !tokenString(accessToken, 3_500)) throw failure(403, 'not-founder')
  try { return await provider(verified, `/rest/v1/rpc/${name}`, { method: 'POST', accessToken, body, signal }) as T }
  catch (error: unknown) {
    if (error instanceof ProviderError && error.status === 401) throw failure(401, 'invalid-credentials')
    if (error instanceof ProviderError && error.status === 403) throw failure(403, 'not-founder')
    if (error instanceof ProviderError && (error.status === 400 || error.status === 409)) throw failure(error.status, 'cloud-unavailable')
    throw failure(503, 'cloud-unavailable')
  }
}

/** Server-only transport configuration; the founder JWT never enters the URL. */
export function hqRealtimeUrl(config: HqAccessConfig): string {
  const verified = verifiedConfig(config)
  const url = new URL('/realtime/v1/websocket', verified.url)
  url.protocol = 'wss:'
  url.searchParams.set('apikey', verified.key)
  // Version 1 uses bounded JSON text frames, avoiding a binary broadcast parser.
  url.searchParams.set('vsn', '1.0.0')
  return url.href
}

async function founderSession(event: H3Event, input: HqAccessConfig, config: VerifiedConfig): Promise<HqFounderSession | null> {
  clearLegacyCookies(event, config)
  const names = cookieNames(config)
  let accessToken = getCookie(event, names.access)
  const refreshToken = getCookie(event, names.refresh)
  if (!accessToken && !refreshToken) return null
  if (accessToken && !tokenString(accessToken, 3_500) || refreshToken && !tokenString(refreshToken, 2_000)) {
    clearCookies(event, config)
    return null
  }
  let user: HqFounderSession['user']
  try {
    if (!accessToken) {
      const tokens = await refreshTokens(config, refreshToken!)
      accessToken = tokens.accessToken
      storeCookies(event, config, tokens)
    }
    try { user = await verifiedUser(config, accessToken) }
    catch (error: unknown) {
      if (!(error instanceof ProviderError) || ![401, 403].includes(error.status) || !refreshToken) throw error
      const tokens = await refreshTokens(config, refreshToken)
      accessToken = tokens.accessToken
      storeCookies(event, config, tokens)
      user = await verifiedUser(config, accessToken)
    }
    await emailConfirmationRequired(config)
    const authority = object(await hqRpc<unknown>(input, accessToken, 'hq_founder_access'))
    // The RPC checks the live Auth session and trusted invitation/membership;
    // neither email nor any metadata claim grants application authority here.
    if (authority?.isFounder !== true) throw failure(403, 'not-founder')
    return { accessToken, user }
  }
  catch (error: unknown) {
    if (error instanceof ProviderError && [400, 401, 403, 422].includes(error.status)) {
      clearCookies(event, config)
      return null
    }
    const statusCode = object(error)?.statusCode
    if (statusCode === 401 || statusCode === 403) clearCookies(event, config)
    throw error
  }
}

export async function requireHqFounder(event: H3Event, config: HqAccessConfig): Promise<HqFounderSession> {
  assertHqAccessRequest(event, config)
  const session = await founderSession(event, config, verifiedConfig(config))
  if (!session) throw failure(401, 'invalid-credentials')
  return session
}

function accessFailure(event: H3Event, error: unknown): HqFounderAccessResponse {
  const value = object(error)
  const code = typeof value?.statusCode === 'number' ? value.statusCode : 503
  const suppliedReason = object(value?.data)?.reason
  const reason: AccessReason = suppliedReason === 'setup-required' || suppliedReason === 'confirmation-required' ? suppliedReason
    : code === 401 || code === 400 ? 'invalid-credentials' : code === 403 ? 'not-founder' : 'cloud-unavailable'
  setResponseStatus(event, [400, 401, 403, 429, 503].includes(code) ? code : 503)
  return { status: reason === 'confirmation-required' || code === 401 || code === 400 ? 'anonymous' : code === 403 ? 'denied' : 'unavailable', reason }
}

export async function readHqAccess(event: H3Event, config: HqAccessConfig): Promise<HqFounderAccessResponse> {
  try {
    assertHqAccessRequest(event, config)
    const session = await founderSession(event, config, verifiedConfig(config))
    return session ? { status: 'founder', user: { displayName: session.user.email } } : { status: 'anonymous' }
  }
  catch (error: unknown) { return accessFailure(event, error) }
}

async function credentials(event: H3Event): Promise<{ email: string; password: string }> {
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(getHeader(event, 'content-type') ?? '')
    || getHeader(event, 'content-encoding') && getHeader(event, 'content-encoding') !== 'identity') throw failure(400, 'invalid-credentials')
  const length = getHeader(event, 'content-length')
  if (length && (!/^\d+$/.test(length) || Number(length) > MAX_INPUT_BYTES)) throw failure(400, 'invalid-credentials')
  const request = event.node.req
  const raw = await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    let count = 0
    const cleanup = () => {
      clearTimeout(timer)
      request.removeListener('data', onData)
      request.removeListener('end', onEnd)
      request.removeListener('error', onError)
      request.removeListener('aborted', onError)
    }
    const onError = () => { cleanup(); reject(failure(400, 'invalid-credentials')) }
    const onData = (chunk: Buffer | string) => {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      count += bytes.length
      if (count > MAX_INPUT_BYTES) { request.pause(); onError(); return }
      chunks.push(bytes)
    }
    const onEnd = () => { cleanup(); resolve(Buffer.concat(chunks)) }
    const timer = setTimeout(() => { request.pause(); onError() }, 10_000)
    request.on('data', onData)
    request.once('end', onEnd)
    request.once('error', onError)
    request.once('aborted', onError)
  })
  try {
    const value = object(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw)))
    if (!value || Object.keys(value).some(key => key !== 'email' && key !== 'password')
      || typeof value.email !== 'string' || value.email.length > 254 || typeof value.password !== 'string'
      || value.password.length < 1 || value.password.length > 1_024) throw new Error('Invalid credentials')
    return { email: value.email.trim().toLowerCase(), password: value.password }
  }
  catch { throw failure(400, 'invalid-credentials') }
}

function authAttempt(event: H3Event, config: VerifiedConfig) {
  const peer = event.node.req.socket.remoteAddress ?? 'checked-development-proxy'
  if (!limitAttempt(`${config.project}:${peer}`)) {
    setResponseHeader(event, 'Retry-After', 300)
    throw failure(429, 'cloud-unavailable')
  }
}

async function revoke(config: VerifiedConfig, accessToken: string): Promise<boolean> {
  try { await provider(config, '/auth/v1/logout?scope=local', { method: 'POST', accessToken }); return true }
  catch (error: unknown) {
    if (!(error instanceof ProviderError) || ![401, 403, 404].includes(error.status)) throw error
    return false
  }
}

export async function signInHqFounder(event: H3Event, input: HqAccessConfig): Promise<HqFounderAccessResponse> {
  let config: VerifiedConfig | undefined
  let tokens: SessionTokens | undefined
  try {
    assertHqAccessRequest(event, input)
    config = verifiedConfig(input)
    authAttempt(event, config)
    clearCookies(event, config)
    const body = await credentials(event)
    if (body.email !== config.founderEmail) throw failure(403, 'not-founder')
    await emailConfirmationRequired(config)
    try { tokens = sessionTokens(await provider(config, '/auth/v1/token?grant_type=password', { method: 'POST', body })) }
    catch (error: unknown) {
      if (error instanceof ProviderError && error.confirmationRequired) throw failure(401, 'confirmation-required')
      if (error instanceof ProviderError && [400, 401, 403, 422].includes(error.status)) throw failure(401, 'invalid-credentials')
      throw error
    }
    const user = await verifiedUser(config, tokens.accessToken)
    const authority = object(await hqRpc<unknown>(input, tokens.accessToken, 'hq_founder_access'))
    if (authority?.isFounder !== true) throw failure(403, 'not-founder')
    storeCookies(event, config, tokens)
    return { status: 'founder', user: { displayName: user.email } }
  }
  catch (error: unknown) {
    if (config) {
      clearCookies(event, config)
      if (tokens) { try { await revoke(config, tokens.accessToken) } catch { /* No session tokens are retained on a failed login. */ } }
    }
    return accessFailure(event, error)
  }
}

export async function registerHqFounder(event: H3Event, input: HqAccessConfig): Promise<HqFounderAccessResponse> {
  try {
    assertHqAccessRequest(event, input)
    const config = verifiedConfig(input)
    authAttempt(event, config)
    const body = await credentials(event)
    if (body.email !== config.founderEmail) throw failure(403, 'not-founder')
    if (body.password.length < 8) throw failure(400, 'invalid-credentials')
    await emailConfirmationRequired(config)
    let result: unknown
    // Confirmation should verify the email, then require a separate password
    // login. PKCE prevents the default implicit-flow token URL fragment. This
    // application never exchanges or retains the confirmation's unused grant.
    const challenge = createHash('sha256').update(randomBytes(48).toString('base64url')).digest('base64url')
    try { result = await provider(config, '/auth/v1/signup', { method: 'POST', body: { ...body, code_challenge: challenge, code_challenge_method: 's256' } }) }
    catch (error: unknown) {
      if (error instanceof ProviderError && [400, 401, 403, 422].includes(error.status)) throw failure(400, 'invalid-credentials')
      throw error
    }
    const returned = object(result)
    if (!returned) throw failure(503, 'cloud-unavailable')
    if (tokenString(returned.access_token, 3_500)) {
      // A provider configuration race must not produce an authenticated signup.
      try { await revoke(config, returned.access_token) } catch { /* Never publish or retain these tokens. */ }
      throw failure(503, 'setup-required')
    }
    return { status: 'anonymous', reason: 'confirmation-required' }
  }
  catch (error: unknown) { return accessFailure(event, error) }
}

export async function signOutHqFounder(event: H3Event, input: HqAccessConfig): Promise<HqFounderAccessResponse> {
  let config: VerifiedConfig | undefined
  try {
    assertHqAccessRequest(event, input)
    config = verifiedConfig(input)
    const names = cookieNames(config)
    let accessToken = getCookie(event, names.access)
    const refreshToken = getCookie(event, names.refresh)
    if (!tokenString(accessToken, 3_500) && tokenString(refreshToken, 2_000)) {
      try { accessToken = (await refreshTokens(config, refreshToken)).accessToken }
      catch (error: unknown) { if (!(error instanceof ProviderError) || ![400, 401, 403, 422].includes(error.status)) throw error }
    }
    if (tokenString(accessToken, 3_500)) {
      const revoked = await revoke(config, accessToken)
      if (!revoked && tokenString(refreshToken, 2_000)) {
        try { await revoke(config, (await refreshTokens(config, refreshToken)).accessToken) }
        catch (error: unknown) { if (!(error instanceof ProviderError) || ![400, 401, 403, 422].includes(error.status)) throw error }
      }
    }
    return { status: 'anonymous' }
  }
  catch (error: unknown) { return accessFailure(event, error) }
  finally { if (config) clearCookies(event, config) }
}
