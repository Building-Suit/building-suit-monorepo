import { DatabaseSync } from 'node:sqlite'
import { lstatSync, realpathSync } from 'node:fs'
import { isAbsolute, resolve } from 'node:path'
import { HqStore } from './hqStore'
import { HqCeoDispatcher } from './hqCeoDispatch'
import { requireWorkflow } from './hqWorkflow'

/** Manual bootstrap only. No env reads, cron, startup hooks, credentials or network.
 * Existing local SQLite identity is checked; host durability/scope/cost remain unverified.
 */
export function openDisabledHqHost(path: string) {
  requireWorkflow(isAbsolute(path) && path !== ':memory:' && realpathSync(path) === resolve(path) && lstatSync(path).isFile(), 'PERSISTENT_HQ_FILE_REQUIRED')
  const probe = new DatabaseSync(path, { readOnly: true })
  try {
    requireWorkflow(Number((probe.prepare('pragma user_version').get() as { user_version: number }).user_version) === 1, 'HQ_DATABASE_IDENTITY')
    const names = (probe.prepare("select name from sqlite_master where type='table' and name not like 'sqlite_%' order by name").all() as { name: string }[]).map(row => row.name)
    requireWorkflow(JSON.stringify(names) === JSON.stringify(['hq_login_limits', 'hq_sessions', 'hq_workspace']), 'HQ_DATABASE_IDENTITY')
    const rows = probe.prepare('select id,document from hq_workspace').all() as { id: number; document: string }[]
    requireWorkflow(rows.length === 1 && rows[0]!.id === 1 && Buffer.byteLength(rows[0]!.document) <= 8_000_000, 'HQ_DATABASE_IDENTITY')
    const doc = JSON.parse(rows[0]!.document)
    requireWorkflow(Array.isArray(doc.tasks) && Array.isArray(doc.messages) && Array.isArray(doc.events) && doc.receipts && typeof doc.receipts === 'object', 'HQ_DATABASE_IDENTITY')
  } finally { probe.close() }
  const dispatcher = new HqCeoDispatcher(new HqStore(path))
  let closed = false
  return {
    status: Object.freeze({ enabled: false, sqlitePath: realpathSync(path), blockers: ['HOST_SCOPE_AND_DURABILITY_UNVERIFIED', 'NO_ENFORCEABLE_FREE_ALLOWANCE', 'MODEL_AUTH_AND_DATA_SCOPE_UNVERIFIED', 'LIVE_DRIVE_AUTH_UNVERIFIED'] }),
    async tick(signal?: AbortSignal) { requireWorkflow(!closed, 'HOST_CLOSED'); signal?.throwIfAborted(); requireWorkflow(false, 'RUNNER_NOT_VERIFIED') },
    async dispatchTask(taskId: string, signal?: AbortSignal) { requireWorkflow(!closed, 'HOST_CLOSED'); return dispatcher.dispatchTask(taskId, signal) },
    async dispatchNext(signal?: AbortSignal) { requireWorkflow(!closed, 'HOST_CLOSED'); return dispatcher.dispatchNext(signal) },
    close() { closed = true; return dispatcher.close() },
  }
}
