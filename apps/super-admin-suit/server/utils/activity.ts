import { randomUUID } from 'node:crypto'
import { normalizeRemoteAudit } from '../../app/utils/activity.ts'
import type { AuditStream } from '../../app/utils/activity.ts'
import { invokeShopAdapter } from './shop-adapter.ts'
import type { AdapterDatabase, SignedAttempt, WireResponse } from './shop-adapter.ts'
export interface ActivityDatabase {
  context(bindingId: string, stream: AuditStream): Promise<{ page: number; pageSize: number }>
  save(bindingId: string, projection: ReturnType<typeof normalizeRemoteAudit>, requestId: string): Promise<void>
  failed(bindingId: string, stream: AuditStream): Promise<void>
}
/** A failed remote fetch never advances the persisted cursor or claims an empty/complete remote history. */
export async function retrieveAuditPage(bindingId: string, stream: AuditStream, authority: string, database: ActivityDatabase, adapter: AdapterDatabase, transport: (attempt: SignedAttempt) => Promise<WireResponse>) {
  const cursor = await database.context(bindingId, stream)
  try {
    const response = await invokeShopAdapter({ bindingId, operation: `shop.${stream}.query`, requestId: randomUUID(), correlationId: randomUUID(), reason: null, payload: { resource: 'audit', page: cursor.page, pageSize: cursor.pageSize } }, authority, adapter, transport)
    const projection = normalizeRemoteAudit(response.data, stream, cursor.page, cursor.pageSize)
    await database.save(bindingId, projection, response.requestId)
    return { status: 'observed', coverage: 'partial' }
  } catch {
    await database.failed(bindingId, stream)
    return { status: 'unavailable', coverage: 'partial' }
  }
}
