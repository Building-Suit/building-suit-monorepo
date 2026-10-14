import { resendAccountInvitation } from '../../utils/account-provisioning'
import { accountClients, accountHttpError, privateAccountResponse, requireAccountPost } from '../../utils/account-http'
export default defineEventHandler(async (event) => {
  privateAccountResponse(event); requireAccountPost(event)
  try { const { client,worker }=await accountClients(event); return await resendAccountInvitation(client,worker,await readBody(event)) }
  catch(error) { throw accountHttpError(error) }
})
