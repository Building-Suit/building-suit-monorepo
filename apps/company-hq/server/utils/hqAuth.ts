import { scryptSync, timingSafeEqual } from 'node:crypto'
import { isAbsolute } from 'node:path'
import { hqProjects } from './hqProjects'
import { tokenHash } from './hqStore'
import { HqProblem } from './hqDomain'
import type { HqActor } from './hqDomain'
export interface HqConfiguration { origin: string; dataPath: string; passwordHash: string; ceoHash: string; hrHash: string; remote?: { url: string; key: string }; environment: string }
export function configuration(env: NodeJS.ProcessEnv = process.env): HqConfiguration | null {
  if (!env.HQ_APP_ORIGIN || !env.HQ_FOUNDER_PASSWORD_HASH) return null
  let url: URL
  try { url = new URL(env.HQ_APP_ORIGIN) } catch { return null }
  if (url.origin !== env.HQ_APP_ORIGIN) return null
  const environment = env.HQ_ENVIRONMENT || 'local'
  let remote: HqConfiguration['remote']
  if (environment === 'staging' || environment === 'production') {
    const expected = hqProjects[environment]
    if (env.HQ_BACKEND_SCOPE_VERIFIED !== 'true' || env.HQ_SUPABASE_URL !== 'https://' + expected + '.supabase.co' || !env.HQ_SUPABASE_SECRET_KEY || env.HQ_HOSTING_COST_VERIFIED !== 'true') return null
    remote = { url: env.HQ_SUPABASE_URL, key: env.HQ_SUPABASE_SECRET_KEY }
  } else if (environment !== 'local' || !env.HQ_DATA_PATH || !isAbsolute(env.HQ_DATA_PATH)) return null
  const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
  if (url.protocol !== 'https:' && !(loopback && url.protocol === 'http:')) return null
  // A production host's free capacity/persistent disk must be explicitly verified before activation.
  if (!loopback && env.HQ_HOSTING_COST_VERIFIED !== 'true') return null
  if (!/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(env.HQ_FOUNDER_PASSWORD_HASH)) return null
  const ceoHash = env.HQ_CEO_TOKEN_SHA256 || '', hrHash = env.HQ_HR_TOKEN_SHA256 || ''
  if ((ceoHash && !/^[a-f0-9]{64}$/.test(ceoHash)) || (hrHash && !/^[a-f0-9]{64}$/.test(hrHash)) || (ceoHash && ceoHash === hrHash)) return null
  return { origin: url.origin, dataPath: env.HQ_DATA_PATH || '', passwordHash: env.HQ_FOUNDER_PASSWORD_HASH, ceoHash, hrHash, environment, ...(remote ? { remote } : {}) }
}
export function requireOrigin(origin: string | undefined, expected: string) {
  if (origin !== expected) throw new HqProblem(403, 'HQ_ORIGIN', 'Same-origin access is required.')
}
export function passwordMatches(value: unknown, encoded: string) {
  if (typeof value !== 'string' || value.length < 12 || value.length > 512) return false
  const [salt, digest] = encoded.split(':')
  if (!salt || !digest) return false
  return timingSafeEqual(scryptSync(value, salt, 64), Buffer.from(digest, 'hex'))
}
export function executorActor(authorization: string | undefined, config: HqConfiguration): HqActor {
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (token.length < 32 || token.length > 512) throw new HqProblem(401, 'HQ_UNAUTHORIZED', 'An executor credential is required.')
  const hash = tokenHash(token)
  const matches = (expected: string) => expected.length === hash.length && timingSafeEqual(Buffer.from(expected), Buffer.from(hash))
  if (config.ceoHash && matches(config.ceoHash)) return { id: 'AG-CEO-001', role: 'ceo' }
  if (config.hrHash && matches(config.hrHash)) return { id: 'AG-HR-001', role: 'hr' }
  throw new HqProblem(401, 'HQ_UNAUTHORIZED', 'An executor credential is required.')
}
