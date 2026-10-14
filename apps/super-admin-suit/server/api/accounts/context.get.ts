import { serverSupabaseClient } from '#supabase/server'
import { accountContext, type ActorClient } from '../../utils/account-workflow'
import { accountHttpError, privateAccountResponse } from '../../utils/account-http'

export default defineEventHandler(async (event) => {
  privateAccountResponse(event)
  try { return await accountContext(await serverSupabaseClient(event) as unknown as ActorClient) }
  catch (error) { throw accountHttpError(error) }
})
