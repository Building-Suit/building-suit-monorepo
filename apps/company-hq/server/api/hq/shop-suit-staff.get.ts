import { createError, getQuery, setResponseHeader } from 'h3'
import { SHOP_SUIT_STAFF_PAGE_SIZE } from '#shared/shopSuitStaff'
import { hqRpc, requireHqFounder } from '../../utils/hqAccess'

const uuid = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i
const unavailable = () => createError({ statusCode: 503, statusMessage: 'Shop Suit staff unavailable' })

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw unavailable()
  return value as Record<string, unknown>
}

function staffPage(value: unknown, after?: string) {
  const { status, staff, next, observedAt } = object(value)
  if (!Array.isArray(staff) || staff.length > SHOP_SUIT_STAFF_PAGE_SIZE) throw unavailable()
  if (status === 'unconfigured' && observedAt === null && staff.length === 0 && next === null) return { status, staff: [], next, observedAt }
  if (typeof observedAt !== 'string' || !Number.isFinite(Date.parse(observedAt))) throw unavailable()
  if (status === 'overflow' && staff.length === 0 && next === null) return { status, staff: [], next, observedAt }
  if (status !== 'ready') throw unavailable()
  let prior = after?.toLowerCase() ?? ''
  const employees = staff.map(row => {
    const { employeeId, shopName, state } = object(row)
    if (typeof employeeId !== 'string' || !uuid.test(employeeId) || employeeId.toLowerCase() <= prior
      || typeof shopName !== 'string' || !shopName.trim() || [...shopName].length > 200
      || (state !== 'idle' && state !== 'busy')) throw unavailable()
    prior = employeeId.toLowerCase()
    return { employeeId, shopName, state }
  })
  if (next !== null && (employees.length !== SHOP_SUIT_STAFF_PAGE_SIZE || next !== employees.at(-1)?.employeeId)) throw unavailable()
  return { status, staff: employees, next, observedAt }
}

export default defineEventHandler(async event => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const config = useRuntimeConfig(event)
  const { accessToken } = await requireHqFounder(event, config)
  const query = getQuery(event)
  if (Object.keys(query).some(key => key !== 'after')
    || (query.after !== undefined && (typeof query.after !== 'string' || !uuid.test(query.after)))) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid staff page' })
  }
  const result = await hqRpc<unknown>(config, accessToken, 'hq_shop_suit_staff', {
    p_after: query.after ?? null, p_limit: SHOP_SUIT_STAFF_PAGE_SIZE,
  })
  return staffPage(result, query.after)
})
