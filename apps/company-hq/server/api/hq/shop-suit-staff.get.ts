import { createError, getQuery, setResponseHeader } from 'h3'
import { requireHqFounder } from '../../utils/hqAccess'
import { loadShopSuitStaff } from '../../utils/shopSuitStaff'

export default defineEventHandler(async event => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const config = useRuntimeConfig(event)
  await requireHqFounder(event, config)
  const query = getQuery(event)
  if (Object.keys(query).some(key => key !== 'after')
    || (query.after !== undefined && (typeof query.after !== 'string' || !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(query.after)))) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid staff page' })
  }
  return loadShopSuitStaff(config, query.after)
})
