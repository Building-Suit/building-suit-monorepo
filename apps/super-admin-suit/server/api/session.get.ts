import { serverSupabaseClient } from '#supabase/server'
import type { Database } from '../../app/types/database.types'
import { AdminAccessError, authorizeAdmin } from '../utils/authorize'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  setHeader(event, 'Vary', 'Cookie')
  try {
    const client = await serverSupabaseClient<Database>(event)
    return await authorizeAdmin(client)
  } catch (error) {
    throw createError({
      statusCode: error instanceof AdminAccessError ? error.statusCode : 503,
      statusMessage: error instanceof AdminAccessError ? error.message : 'Authorization unavailable',
    })
  }
})
