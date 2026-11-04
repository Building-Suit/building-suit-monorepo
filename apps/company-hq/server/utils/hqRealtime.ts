import { createHash } from 'node:crypto'
import { HqProblem } from './hqDomain'
import { hqProjects } from './hqProjects'

export const localUpdatePolicy = Object.freeze({ intervalMs: 2000, lifetimeMs: 30_000, maxStreams: 8, maxSessionStreams: 2, reconnectDelayMs: 3000 })

/** Inspection-only descriptor: no env boolean, credential or client can enable hosted Realtime. */
export function hostedRealtimePlan(environment: 'staging' | 'production') {
  return {
    enabled: false as const,
    requestedProjectRef: hqProjects[environment],
    access: 'denied' as const,
    blockers: [
      'PROJECT_ACCESS_DENIED',
      ...(environment === 'staging' ? ['SUPER_ADMIN_PROJECT_MAPPING_CONFLICT'] : []),
      'DEDICATED_HQ_SCOPE_UNVERIFIED', 'FOUNDER_REALTIME_AUTH_UNVERIFIED', 'ZERO_COST_HOST_UNVERIFIED',
    ],
    proposedTransport: 'private_invalidation_only' as const,
    sendsWorkspaceDocument: false as const,
  }
}

type LocalRevisionSource = { sessionValid(token: string): boolean; revision(): number }
export type LocalUpdate = { kind: 'closed' } | { kind: 'unchanged' } | { kind: 'invalidate'; revision: string }
/** Synchronous local store only: auth is checked again before every possible emission. */
export class LocalInvalidationCursor {
  private previous: number | undefined
  private closed = false
  constructor(private store: LocalRevisionSource, private token: string, private startedAt = Date.now()) {}
  poll(now = Date.now()): LocalUpdate {
    if (this.closed) return { kind: 'closed' }
    if (!Number.isFinite(now) || now < this.startedAt || now - this.startedAt >= localUpdatePolicy.lifetimeMs || !/^[A-Za-z0-9_-]{43}$/.test(this.token) || !this.store.sessionValid(this.token)) {
      this.closed = true
      return { kind: 'closed' }
    }
    const revision = this.store.revision()
    if (!Number.isSafeInteger(revision) || revision < 0) { this.closed = true; return { kind: 'closed' } }
    if (revision === this.previous) return { kind: 'unchanged' }
    this.previous = revision
    return { kind: 'invalidate', revision: String(revision) }
  }
}

/** Process-local connection budget, never a billing or hosted allowance authority. */
export class LocalUpdateConnections {
  private sessions = new Map<string, number>()
  private total = 0
  acquire(token: string) {
    const key = createHash('sha256').update(token).digest('hex'), count = this.sessions.get(key) || 0
    if (this.total >= localUpdatePolicy.maxStreams || count >= localUpdatePolicy.maxSessionStreams) throw new HqProblem(429, 'HQ_UPDATE_LIMIT', 'Too many HQ update streams; use periodic refresh.')
    this.sessions.set(key, count + 1); this.total++
    let released = false
    return () => {
      if (released) return
      released = true; this.total--
      const remaining = (this.sessions.get(key) || 1) - 1
      if (remaining) this.sessions.set(key, remaining); else this.sessions.delete(key)
    }
  }
}
