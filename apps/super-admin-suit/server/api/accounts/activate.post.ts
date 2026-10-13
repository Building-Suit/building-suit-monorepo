import { activateAccount } from '../../utils/account-workflow'
import { accountClients, accountHttpError, privateAccountResponse, requireAccountPost } from '../../utils/account-http'

export default defineEventHandler(async (event) => {
  privateAccountResponse(event)
  requireAccountPost(event)
  try {
    const { client, worker } = await accountClients(event)
    const input = await readBody(event)
    return await activateAccount(client, worker, input)
  } catch (error) { throw accountHttpError(error) }
})
