import { randomBytes } from 'node:crypto'
import { executeLocal, HqProblem } from './hqDomain'
import { tokenHash } from './hqStore'
import type { HqActor, HqCommand, HqDocument } from './hqDomain'
/** Service-only PostgREST adapter. No product records or identities are imported. */
export class HqRemoteStore {
  constructor(private url: string, private key: string, private send: typeof fetch = fetch) {}
  private async rpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
    const response = await this.send(this.url + '/rest/v1/rpc/' + name, { method: 'POST', redirect: 'error', headers: { apikey: this.key, ...(this.key.startsWith('sb_secret_') ? {} : { Authorization: 'Bearer ' + this.key }), 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15_000) })
    if (!response.ok) throw new HqProblem(503, 'HQ_BACKEND', 'HQ storage is unavailable. No paid fallback is enabled.')
    return response.json() as Promise<T>
  }
  async read() { return (await this.rpc<{ document: HqDocument; revision: number }>('hq_read_workspace', {})).document }
  async execute(actor: HqActor, command: HqCommand) {
    // Retry only revision conflicts: approval/cancellation/evidence and receipts are re-read together.
    for (let attempt = 0; attempt < 5; attempt++) {
      const current = await this.rpc<{ document: HqDocument; revision: number }>('hq_read_workspace', {})
      const { document, result } = executeLocal(current.document, actor, command)
      if (await this.rpc<boolean>('hq_commit_workspace', { p_revision: current.revision, p_document: document })) return result
    }
    throw new HqProblem(409, 'HQ_BUSY', 'HQ changed concurrently. Retry the same request key.')
  }
  async createSession(now = Date.now()) {
    const token = randomBytes(32).toString('base64url')
    await this.rpc('hq_save_session', { p_hash: tokenHash(token), p_expiry: now + 8 * 60 * 60 * 1000 })
    return token
  }
  sessionValid(token: string, now = Date.now()) { return this.rpc<boolean>('hq_session_valid', { p_hash: tokenHash(token), p_now: now }) }
  revokeSession(token: string) { return this.rpc('hq_revoke_session', { p_hash: tokenHash(token) }) }
  async consumeLoginAttempt(address: string, now = Date.now()) {
    const accepted = await this.rpc<boolean>('hq_consume_login_attempt', { p_hash: tokenHash(address), p_now: now })
    if (!accepted) throw new HqProblem(429, 'HQ_RATE_LIMIT', 'Too many attempts. Try again in 15 minutes.')
  }
  close() { /* PostgREST holds no long-lived client connection. */ }
}
