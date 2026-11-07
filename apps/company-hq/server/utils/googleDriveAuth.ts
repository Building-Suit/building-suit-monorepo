import { createPrivateKey, sign } from 'node:crypto'
import type { BrainIndex } from '../../shared/types/brain'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const DRIVE_URL = 'https://www.googleapis.com/drive/v3/files'
const READ_ONLY_SCOPE = 'https://www.googleapis.com/auth/drive.readonly'
const MAX_JSON_BYTES = 1024 * 1024
const MAX_REQUESTS = 250
const QUOTA_REASONS = new Set(['rateLimitExceeded', 'userRateLimitExceeded', 'dailyLimitExceeded', 'quotaExceeded'])
export const MAX_NOTE_BYTES = 512 * 1024

export interface GoogleBrainConfig {
  hqBrainGoogleClientEmail?: unknown
  hqBrainGooglePrivateKey?: unknown
}

export class BrainCloudError extends Error {
  constructor(readonly reason: NonNullable<BrainIndex['reason']> = 'cloud-unavailable') {
    super('Company Brain cloud access unavailable')
  }
}

export class BrainCloudLimit extends Error {
  constructor() { super('Company Brain metadata limit reached') }
}

export interface DriveReader {
  json(fileId: string | null, parameters: Record<string, string>): Promise<unknown>
  markdown(fileId: string): Promise<string>
}

async function boundedBody(response: Response, maximum: number): Promise<Uint8Array> {
  if (!response.body) throw new BrainCloudError()
  const declaredSize = response.headers.get('content-length')
  if (declaredSize && Number(declaredSize) > maximum) {
    await response.body.cancel()
    throw new BrainCloudError()
  }
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const result = await reader.read()
      if (result.done) break
      size += result.value.byteLength
      if (size > maximum) {
        await reader.cancel()
        throw new BrainCloudError()
      }
      chunks.push(result.value)
    }
  }
  finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  return bytes
}

async function boundedJson(response: Response, maximum = MAX_JSON_BYTES): Promise<unknown> {
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await boundedBody(response, maximum))) as unknown
  }
  catch {
    throw new BrainCloudError()
  }
}

async function hasQuotaReason(response: Response): Promise<boolean> {
  try {
    const payload = await boundedJson(response, 16 * 1024)
    if (!payload || typeof payload !== 'object' || !('error' in payload)
      || !payload.error || typeof payload.error !== 'object' || !('errors' in payload.error)
      || !Array.isArray(payload.error.errors)) return false
    return payload.error.errors.some((entry: unknown) => entry !== null && typeof entry === 'object'
      && 'reason' in entry && typeof entry.reason === 'string' && QUOTA_REASONS.has(entry.reason))
  }
  catch {
    // Unknown/malformed permission errors retain the ordinary 403 classification.
    return false
  }
}

/** No delegated user, domain-wide authority, credential file, or local fallback. */
export async function createDriveReader(config: GoogleBrainConfig): Promise<DriveReader | null> {
  const email = typeof config.hqBrainGoogleClientEmail === 'string' ? config.hqBrainGoogleClientEmail.trim() : ''
  const configuredKey = typeof config.hqBrainGooglePrivateKey === 'string' ? config.hqBrainGooglePrivateKey.trim() : ''
  if (!email || !configuredKey) return null
  if (email.length > 320 || configuredKey.length > 16 * 1024
    || !/^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+\.gserviceaccount\.com$/.test(email)) throw new BrainCloudError('authorization-required')

  let assertion: string
  try {
    const key = createPrivateKey(configuredKey.replace(/\\n/g, '\n'))
    if (key.asymmetricKeyType !== 'rsa' || (key.asymmetricKeyDetails?.modulusLength ?? 0) < 2048) throw new Error('Invalid key')
    const now = Math.floor(Date.now() / 1000)
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
    const claims = Buffer.from(JSON.stringify({ iss: email, scope: READ_ONLY_SCOPE, aud: TOKEN_URL, iat: now - 30, exp: now + 300 })).toString('base64url')
    const unsigned = `${header}.${claims}`
    assertion = `${unsigned}.${sign('RSA-SHA256', Buffer.from(unsigned), key).toString('base64url')}`
  }
  catch {
    throw new BrainCloudError('authorization-required')
  }

  // One operation has a hard deadline; each HTTP exchange also has a shorter
  // deadline. There are no implicit retries or persisted token/content caches.
  const operationSignal = AbortSignal.timeout(30_000)
  let requests = 0
  async function request(url: URL | string, options: RequestInit, tokenRequest = false): Promise<Response> {
    if (requests >= MAX_REQUESTS) throw new BrainCloudLimit()
    requests += 1
    try {
      const response = await fetch(url, {
        ...options, redirect: 'error', cache: 'no-store',
        signal: AbortSignal.any([operationSignal, AbortSignal.timeout(8_000)]),
      })
      if (!response.ok) {
        const quotaLimited = response.status === 403 && await hasQuotaReason(response)
        await response.body?.cancel()
        const authorization = response.status === 401 || (response.status === 403 && !quotaLimited) || response.status === 404
          || (tokenRequest && response.status === 400)
        throw new BrainCloudError(authorization ? 'authorization-required' : 'cloud-unavailable')
      }
      return response
    }
    catch (error) {
      if (error instanceof BrainCloudError) throw error
      throw new BrainCloudError()
    }
  }

  const tokenResponse = await request(TOKEN_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  }, true)
  const grant = await boundedJson(tokenResponse, 16 * 1024)
  if (!grant || typeof grant !== 'object' || !('access_token' in grant) || typeof grant.access_token !== 'string'
    || grant.access_token.length < 10 || grant.access_token.length > 16 * 1024
    || !('token_type' in grant) || typeof grant.token_type !== 'string' || grant.token_type.toLowerCase() !== 'bearer') {
    throw new BrainCloudError('authorization-required')
  }
  const accessToken = grant.access_token

  function driveUrl(fileId: string | null, parameters: Record<string, string>): URL {
    const url = new URL(fileId ? `${DRIVE_URL}/${encodeURIComponent(fileId)}` : DRIVE_URL)
    url.search = new URLSearchParams({ supportsAllDrives: 'true', ...parameters }).toString()
    return url
  }

  return {
    async json(fileId, parameters) {
      return boundedJson(await request(driveUrl(fileId, parameters), { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } }))
    },
    async markdown(fileId) {
      const response = await request(driveUrl(fileId, { alt: 'media' }), {
        headers: { Authorization: `Bearer ${accessToken}`, Range: `bytes=0-${MAX_NOTE_BYTES}`, Accept: 'text/markdown, text/plain' },
      })
      try {
        const content = new TextDecoder('utf-8', { fatal: true }).decode(await boundedBody(response, MAX_NOTE_BYTES))
        if (content.includes('\0')) throw new BrainCloudError()
        return content
      }
      catch {
        throw new BrainCloudError()
      }
    },
  }
}
