import { accountQuery } from '../../utils/account-workflow'
import { accountClients, accountHttpError, privateAccountResponse } from '../../utils/account-http'

export default defineEventHandler(async (event) => {
  privateAccountResponse(event)
  try {
    const { client, worker } = await accountClients(event)
    const query = getQuery(event)
    return await accountQuery(client, worker, { bindingId: query.bindingId, shopId: query.shopId })
  } catch (error) { throw accountHttpError(error) }
})
