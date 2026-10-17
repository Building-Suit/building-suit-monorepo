export interface DoctorAuditRow { id: string; actorId: string; eventType: string; entityId: string; happenedAt: string }
export interface DoctorAuditResult { rows: DoctorAuditRow[]; total: number; page: number }
export interface DoctorAuditQuery { search: string; page: number }
export interface DoctorAuditScope { key: string; kind: 'practice'|'personal'; practiceId: string|null; locationId: string|null }
const uuid = (value: unknown): value is string => typeof value==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
export function validDoctorAuditQuery(query: DoctorAuditQuery) { return typeof query.search==='string' && query.search.length<=120 && !Array.from(query.search).some(character => character.charCodeAt(0)<32 || character.charCodeAt(0)===127) && Number.isSafeInteger(query.page) && query.page>=0 && query.page<=100000 }
export function doctorAuditResult(value: unknown): DoctorAuditResult {
  if(!value || typeof value!=='object')throw { code: '22023' }
  const data = value as Record<string,unknown>
  if(!Array.isArray(data.items) || data.items.length>20 || !Number.isSafeInteger(data.total) || Number(data.total)<0 || !Number.isSafeInteger(data.page) || Number(data.page)<0 || Number(data.page)>100000)throw { code: '22023' }
  const rows = data.items.map(value => {
    if(!value || typeof value!=='object')throw { code: '22023' }
    const row = value as Record<string,unknown>
    if(!(uuid(row.id) || (typeof row.id==='string' && /^[1-9][0-9]{0,18}$/.test(row.id) && BigInt(row.id)<=9223372036854775807n)) || !uuid(row.actor_user_id) || !uuid(row.entity_id) || typeof row.event_type!=='string' || !/^[a-z_]+\.[a-z_]+$/.test(row.event_type) || row.event_type.length>80 || typeof row.happened_at!=='string' || !Number.isFinite(Date.parse(row.happened_at)))throw { code: '22023' }
    return { id: row.id,actorId: row.actor_user_id,eventType: row.event_type,entityId: row.entity_id,happenedAt: row.happened_at }
  })
  if(new Set(rows.map(row => row.id)).size!==rows.length || Number(data.total)<rows.length)throw { code: '22023' }
  return { rows,total: Number(data.total),page: Number(data.page) }
}
