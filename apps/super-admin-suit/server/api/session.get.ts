import { serverSupabaseClient } from '#supabase/server'
import type { Database } from '../../app/types/database.types'
import { AdminAccessError, authorizeAdmin } from '../utils/authorize'
import { readLiveTopic } from '../utils/live-topic'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  setHeader(event, 'Vary', 'Cookie')
  try {
    const client = await serverSupabaseClient<Database>(event)
    const session = await authorizeAdmin(client)
    await readLiveTopic(client, session) // A cached JWT must not preserve a revoked session.
    return session
  } catch (error) {
    throw createError({
      statusCode: error instanceof AdminAccessError ? error.statusCode : 503,
      statusMessage: error instanceof AdminAccessError ? error.message : 'Authorization unavailable',
    })
  }
})
