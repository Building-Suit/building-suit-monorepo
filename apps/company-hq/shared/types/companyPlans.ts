/** HQ operation data is separate from Brain notes and employee execution. */
export interface HqCompanyPlan {
  id: string
  title: string
  summary: string
  body: string
  status: 'ready' | 'approved' | 'rejected'
  revision: number
  departments: { id: string; key: string; name: string; nameAr?: string }[]
  hiring: { id: string; departmentId?: string; role: string; reason: string }[]
  skills: { id: string; employeeId: string; skill: string; reason: string }[]
  hrReview: { reference: string; summary: string } | null
  ceoReview: { reference: string; summary: string } | null
  createdAt: string
  approvedAt?: string
  legacy: boolean
}

export interface HqApprovedDepartment {
  id: string
  name: string
  nameAr?: string
  approvedAt: string
}

export interface HqCompanySnapshot {
  plans: HqCompanyPlan[]
  departments: HqApprovedDepartment[]
}

export const HQ_PLAN_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_SNAPSHOT_BYTES = 512 * 1_024

function record(value: unknown, keys: readonly string[]): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const result = value as Record<string, unknown>
  return Object.keys(result).every(key => keys.includes(key)) ? result : null
}

function text(value: unknown, maximum: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maximum && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)
}

function uuid(value: unknown): value is string { return typeof value === 'string' && HQ_PLAN_UUID.test(value) }
function optional(value: unknown) { return value === undefined || value === null }
function nameKey(value: string) { return value.normalize('NFKC').trim().toLocaleLowerCase('en-US').replace(/\s+/g, ' ') }

function timestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(?:Z|([+-])(\d{2}):(\d{2}))$/.exec(value)
  if (!match) return false
  const [, year, month, day, hour, minute, second, , offsetHour, offsetMinute] = match
  const calendar = new Date(`${year}-${month}-${day}T00:00:00Z`)
  return calendar.getUTCFullYear() === Number(year) && calendar.getUTCMonth() + 1 === Number(month) && calendar.getUTCDate() === Number(day)
    && Number(hour) <= 23 && Number(minute) <= 59 && Number(second) <= 59
    && (offsetHour === undefined || Number(offsetHour) <= 14 && Number(offsetMinute) <= 59 && (Number(offsetHour) < 14 || Number(offsetMinute) === 0))
    && Number.isFinite(Date.parse(value)) && Date.parse(value) <= Date.now()
}

function dateOnly(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value && date.getTime() <= Date.now()
}

function review(value: unknown): { reference: string; summary: string } | null {
  const data = record(value, ['reference', 'summary'])
  return data && text(data.reference, 2_000) && text(data.summary, 4_000) ? { reference: data.reference, summary: data.summary } : null
}

/** Pure fail-closed boundary shared by the server RPC adapter and client. */
export function parseHqCompanySnapshot(value: unknown): HqCompanySnapshot | null {
  try {
    const source = record(value, ['plans', 'departments'])
    if (!source || !Array.isArray(source.plans) || source.plans.length > 128
      || !Array.isArray(source.departments) || source.departments.length > 128
      || new TextEncoder().encode(JSON.stringify(value)).byteLength > MAX_SNAPSHOT_BYTES) return null
    const departmentIds = new Set<string>()
    const departmentNames = new Set<string>()
    const departments: HqApprovedDepartment[] = []
    // Legacy records preserve the source's date precision and missing reviews.
    // The same exception is permitted for their explicitly linked departments.
    const legacyDates = new Map<string, Set<string>>()
    for (const row of source.plans) {
      const data = record(row, ['id', 'title', 'summary', 'body', 'status', 'revision', 'departments', 'hiring', 'skills', 'hrReview', 'ceoReview', 'createdAt', 'approvedAt', 'legacy'])
      if (data?.legacy !== true || data.status !== 'approved' || !dateOnly(data.approvedAt) || !Array.isArray(data.departments)) continue
      for (const item of data.departments) {
        const entry = record(item, ['id', 'key', 'name', 'nameAr'])
        if (!entry || !uuid(entry.id)) continue
        const id = entry.id.toLowerCase()
        const dates = legacyDates.get(id) ?? new Set<string>()
        dates.add(data.approvedAt)
        legacyDates.set(id, dates)
      }
    }
    for (const item of source.departments) {
      const entry = record(item, ['id', 'name', 'nameAr', 'approvedAt'])
      if (!entry || !uuid(entry.id) || !text(entry.name, 200)
        || !(timestamp(entry.approvedAt) || dateOnly(entry.approvedAt) && legacyDates.get(entry.id.toLowerCase())?.has(entry.approvedAt))
        || !optional(entry.nameAr) && !text(entry.nameAr, 200)) return null
      const id = entry.id.toLowerCase()
      const names = [nameKey(entry.name), ...(typeof entry.nameAr === 'string' ? [nameKey(entry.nameAr)] : [])]
      if (departmentIds.has(id) || names.some(name => departmentNames.has(name))) return null
      departmentIds.add(id)
      names.forEach(name => departmentNames.add(name))
      departments.push({ id, name: entry.name, ...(typeof entry.nameAr === 'string' ? { nameAr: entry.nameAr } : {}), approvedAt: entry.approvedAt })
    }
    const planIds = new Set<string>()
    const plans: HqCompanyPlan[] = []
    for (const item of source.plans) {
      const entry = record(item, ['id', 'title', 'summary', 'body', 'status', 'revision', 'departments', 'hiring', 'skills', 'hrReview', 'ceoReview', 'createdAt', 'approvedAt', 'legacy'])
      if (!entry || !uuid(entry.id) || planIds.has(entry.id.toLowerCase()) || !text(entry.title, 200) || !text(entry.summary, 2_000) || !text(entry.body, 16_000)
        || !['ready', 'approved', 'rejected'].includes(String(entry.status)) || typeof entry.revision !== 'number' || !Number.isSafeInteger(entry.revision) || entry.revision < 1
        || typeof entry.legacy !== 'boolean' || !timestamp(entry.createdAt) || !Array.isArray(entry.departments) || entry.departments.length > 128
        || !Array.isArray(entry.hiring) || entry.hiring.length > 256 || !Array.isArray(entry.skills) || entry.skills.length > 256) return null
      if (entry.status === 'approved'
        ? !(timestamp(entry.approvedAt) || entry.legacy && dateOnly(entry.approvedAt)) || !entry.legacy && Date.parse(entry.approvedAt as string) < Date.parse(entry.createdAt)
        : !optional(entry.approvedAt)) return null
      const hrReview = review(entry.hrReview)
      const ceoReview = review(entry.ceoReview)
      if ((!hrReview && !(entry.legacy && entry.hrReview === null)) || (!ceoReview && !(entry.legacy && entry.ceoReview === null))) return null
      const planDepartments: HqCompanyPlan['departments'] = []
      const planDepartmentIds = new Set<string>()
      const keys = new Set<string>()
      const names = new Set<string>()
      for (const row of entry.departments) {
        const data = record(row, ['id', 'key', 'name', 'nameAr'])
        if (!data || !uuid(data.id) || typeof data.key !== 'string' || !/^[a-z][a-z0-9-]{1,63}$/.test(data.key)
          || !text(data.name, 200) || !optional(data.nameAr) && !text(data.nameAr, 200)) return null
        const id = data.id.toLowerCase()
        const labels = [nameKey(data.name), ...(typeof data.nameAr === 'string' ? [nameKey(data.nameAr)] : [])]
        if (planDepartmentIds.has(id) || keys.has(data.key) || labels.some(name => names.has(name))) return null
        planDepartmentIds.add(id)
        keys.add(data.key)
        labels.forEach(name => names.add(name))
        planDepartments.push({ id, key: data.key, name: data.name, ...(typeof data.nameAr === 'string' ? { nameAr: data.nameAr } : {}) })
      }
      const hiring: HqCompanyPlan['hiring'] = []
      const skills: HqCompanyPlan['skills'] = []
      const itemIds = new Set<string>()
      for (const row of entry.hiring) {
        const data = record(row, ['id', 'departmentId', 'role', 'reason'])
        if (!data || !uuid(data.id) || itemIds.has(data.id.toLowerCase()) || !text(data.role, 200) || !text(data.reason, 4_000)
          || !optional(data.departmentId) && (!uuid(data.departmentId) || !planDepartmentIds.has(data.departmentId.toLowerCase()) && !departmentIds.has(data.departmentId.toLowerCase()))) return null
        itemIds.add(data.id.toLowerCase())
        hiring.push({ id: data.id.toLowerCase(), ...(typeof data.departmentId === 'string' ? { departmentId: data.departmentId.toLowerCase() } : {}), role: data.role, reason: data.reason })
      }
      for (const row of entry.skills) {
        const data = record(row, ['id', 'employeeId', 'skill', 'reason'])
        if (!data || !uuid(data.id) || itemIds.has(data.id.toLowerCase()) || typeof data.employeeId !== 'string'
          || !/^[A-Za-z0-9][A-Za-z0-9_-]{1,99}$/.test(data.employeeId) || !text(data.skill, 200) || !text(data.reason, 4_000)) return null
        itemIds.add(data.id.toLowerCase())
        skills.push({ id: data.id.toLowerCase(), employeeId: data.employeeId, skill: data.skill, reason: data.reason })
      }
      const id = entry.id.toLowerCase()
      planIds.add(id)
      plans.push({
        id, title: entry.title, summary: entry.summary, body: entry.body, status: entry.status as HqCompanyPlan['status'], revision: entry.revision,
        departments: planDepartments, hiring, skills, hrReview, ceoReview, createdAt: entry.createdAt,
        ...(typeof entry.approvedAt === 'string' ? { approvedAt: entry.approvedAt } : {}), legacy: entry.legacy,
      })
    }
    return { plans, departments }
  }
  catch { return null }
}
