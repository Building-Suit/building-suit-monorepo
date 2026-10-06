import { serverSupabaseClient } from '#supabase/server'
import type { Database } from '../../app/types/database.types'
import { parseRegistry } from '../../app/utils/registry'
import { AdminAccessError, authorizeAdmin } from '../utils/authorize'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  setHeader(event, 'Vary', 'Cookie')
  try {
    const client = await serverSupabaseClient<Database>(event)
    await authorizeAdmin(client)
    const { data, error } = await client.rpc('super_admin_configuration_read', { p_resource: 'registry' })
    if (error) throw new AdminAccessError(error.code === '42501' ? 403 : 503)
    return parseRegistry(data)
  } catch (error) {
    throw createError({ statusCode: error instanceof AdminAccessError ? error.statusCode : 503, statusMessage: 'Registry unavailable' })
  }
})
