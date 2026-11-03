import { DatabaseSync } from 'node:sqlite'
import { mkdirSync, chmodSync } from 'node:fs'
import { dirname } from 'node:path'
import { createHash, randomBytes } from 'node:crypto'
import { schema } from './hqSchema'
import { executeLocal, initialDocument, HqProblem } from './hqDomain'
import type { HqActor, HqCommand, HqDocument } from './hqDomain'
export const tokenHash = (value: string) => createHash('sha256').update(value).digest('hex')
export class HqStore {
  private db: DatabaseSync
  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
    this.db = new DatabaseSync(path)
    if (path !== ':memory:') chmodSync(path, 0o600)
    this.db.exec('pragma journal_mode=WAL; pragma busy_timeout=5000;')
    const version = Number((this.db.prepare('pragma user_version').get() as { user_version: number }).user_version)
    if (version > 1) throw new Error('Unsupported HQ database version')
    this.db.exec(schema)
    this.db.prepare('insert or ignore into hq_workspace(id,document) values(1,?)').run(JSON.stringify(initialDocument()))
  }
  read(): HqDocument { return JSON.parse((this.db.prepare('select document from hq_workspace where id=1').get() as { document: string }).document) }
  execute(actor: HqActor, command: HqCommand) {
    return this.transaction(doc => {
      const { document, result } = executeLocal(doc, actor, command)
      return { document, result }
    })
  }
  /** Server-only synchronous reducer. No I/O/await while holding the writer lock. */
  transaction<T>(reduce: (doc: HqDocument) => { document: HqDocument; result: T }): T {
    // Approval, command, idempotency receipt and event commit under one writer lock.
    this.db.exec('begin immediate')
    try {
      const { document, result } = reduce(this.read())
      const encoded = JSON.stringify(document)
      const budgets = Object.values(document.workflowRuns || {}).map(run => run.evidenceBudget ?? 0)
      if (budgets.some(bytes => !Number.isSafeInteger(bytes) || bytes < 0)) throw new HqProblem(507, 'HQ_CAPACITY', 'Invalid evidence reservation.')
      const reserved = budgets.reduce((total, bytes) => total + bytes, 0)
      if (!Number.isSafeInteger(reserved) || reserved < 0 || Buffer.byteLength(encoded) + reserved > 8_000_000) throw new HqProblem(507, 'HQ_CAPACITY', 'HQ storage is full. Export and archive records before continuing.')
      this.db.prepare('update hq_workspace set document=?, revision=revision+1 where id=1').run(encoded)
      this.db.exec('commit')
      return result
    } catch (error) { this.db.exec('rollback'); throw error }
  }
  createSession(now = Date.now()) {
    this.db.prepare('delete from hq_sessions where expires_at <= ?').run(now)
    const token = randomBytes(32).toString('base64url')
    this.db.prepare('insert into hq_sessions values(?,?)').run(tokenHash(token), now + 8 * 60 * 60 * 1000)
    return token
  }
  sessionValid(token: string, now = Date.now()) { return !!this.db.prepare('select 1 from hq_sessions where token_hash=? and expires_at>?').get(tokenHash(token), now) }
  revokeSession(token: string) { this.db.prepare('delete from hq_sessions where token_hash=?').run(tokenHash(token)) }
  checkLoginLimit(address: string, now = Date.now()) {
    this.db.prepare('delete from hq_login_limits where window_end <= ?').run(now)
    const row = this.db.prepare('select failures from hq_login_limits where address_hash=?').get(tokenHash(address)) as { failures: number } | undefined
    if (row && row.failures >= 8) throw new HqProblem(429, 'HQ_RATE_LIMIT', 'Too many attempts. Try again in 15 minutes.')
  }
  failedLogin(address: string, now = Date.now()) { this.db.prepare('insert into hq_login_limits values(?,1,?) on conflict(address_hash) do update set failures=failures+1').run(tokenHash(address), now + 15 * 60 * 1000) }
  consumeLoginAttempt(address: string, now = Date.now()) { this.checkLoginLimit(address, now); this.failedLogin(address, now) }
  close() { this.db.close() }
}
