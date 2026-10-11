import { serverSupabaseClient } from '#supabase/server'
import type { Database } from '../../app/types/database.types'
import { parseActivityQuery } from '../../app/utils/activity'
import { AdminAccessError, authorizeAdmin } from '../utils/authorize'
import { adminRpc } from '../utils/admin-rpc'
import type { AdminRpcClient } from '../utils/admin-rpc'
export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'private, no-store'); setHeader(event, 'Vary', 'Cookie')
  try {
    const client = await serverSupabaseClient<Database>(event)
    await authorizeAdmin(client)
    let query
    try { query = parseActivityQuery(getQuery(event)) } catch { throw createError({ statusCode: 400, statusMessage: 'Invalid activity filter' }) }
    return await adminRpc(client as unknown as AdminRpcClient, 'super_admin_activity_read', { p_query: query })
  } catch (error) {
    if (error instanceof AdminAccessError) throw createError({ statusCode: error.statusCode, statusMessage: error.message })
    if (isError(error)) throw error
    throw createError({ statusCode: 503, statusMessage: 'Activity unavailable' })
  }
})
