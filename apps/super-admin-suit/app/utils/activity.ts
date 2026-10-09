/** Closed support projection. Payloads, before/after snapshots and provider details never enter this view. */
export interface ActivityRow {
  id: string; source: string; suit: string | null; environment: string; actor: string | null
  action: string; target: string | null; status: string; reason: string
  requestId: string | null; correlationId: string | null; occurredAt: string
}
export interface ActivityQuery {
  page: number; pageSize: number; order: 'asc' | 'desc'
  suit: string | null; environment: string | null; action: string | null; actor: string | null
  target: string | null; from: string | null; to: string | null; correlationId: string | null; requestId: string | null
}
export function parseActivityQuery(value: Record<string, unknown>): ActivityQuery {
  const allowed = ['page', 'pageSize', 'order', 'suit', 'environment', 'action', 'actor', 'target', 'from', 'to', 'correlationId', 'requestId']
  if (Object.keys(value).some(key => !allowed.includes(key))) throw new Error('invalid_request')
  const page = Number(value.page ?? 1), pageSize = Number(value.pageSize ?? 25), order = value.order ?? 'desc'
  if (!Number.isInteger(page) || page < 1 || page > 10000 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100 || !['asc', 'desc'].includes(String(order))) throw new Error('invalid_request')
  const result: ActivityQuery = { page, pageSize, order: order as 'asc' | 'desc', suit: null, environment: null, action: null, actor: null, target: null, from: null, to: null, correlationId: null, requestId: null }
  for (const key of allowed.slice(3) as (keyof Omit<ActivityQuery, 'page' | 'pageSize' | 'order'>)[]) {
    const field = value[key]
    if (field === undefined || field === null || field === '') continue
    if (typeof field !== 'string' || field.length > 200) throw new Error('invalid_request')
    if ((key === 'from' || key === 'to') && !Number.isFinite(Date.parse(field))) throw new Error('invalid_request')
    result[key] = field
  }
  if (result.from && result.to && Date.parse(result.from) > Date.parse(result.to)) throw new Error('invalid_request')
  return result
}
export type AuditStream = 'platform' | 'billing' | 'plan'
export interface RemoteAuditRow { id: string; actor: string | null; action: string; target: string | null; reason: string; occurredAt: string }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
function identifier(value: unknown): string | null { return typeof value === 'string' && uuid.test(value) ? value : null }
/** Free text may contain arbitrary pasted credentials/PII. Mask it as a whole, rather than guessing secret formats. */
export function maskReason(value: unknown): string { return typeof value === 'string' && value.trim() ? '[redacted]' : '' }
export function normalizeRemoteAudit(value: unknown, stream: AuditStream, page: number, pageSize: number) {
  const data = value as { items?: Record<string, unknown>[]; total?: number; page?: number; pageSize?: number }
  if (!data || !Array.isArray(data.items) || data.items.length > pageSize || !Number.isSafeInteger(data.total) || data.total! < data.items.length || data.page !== page || data.pageSize !== pageSize) throw new Error('remote_projection_invalid')
  const items: RemoteAuditRow[] = data.items.map(row => {
    if (!row || !identifier(row.id) || typeof row.action !== 'string' || !/^[a-z][a-z0-9_.-]{0,127}$/.test(row.action) || typeof row.occurredAt !== 'string' || !Number.isFinite(Date.parse(row.occurredAt))) throw new Error('remote_projection_invalid')
    return { id: row.id as string, actor: identifier(row.actorUserId), action: row.action, target: identifier(row.targetId) || identifier(row.submissionId) || identifier(row.shopId) || identifier(row.planId), reason: maskReason(row.reason), occurredAt: new Date(row.occurredAt).toISOString() }
  })
  if (new Set(items.map(row => row.id)).size !== items.length) throw new Error('remote_projection_invalid')
  return { items, total: data.total!, page, pageSize, stream }
}
