import { provisionQuery } from '../../utils/account-provisioning'
import { accountClients, accountHttpError, privateAccountResponse } from '../../utils/account-http'
export default defineEventHandler(async(event)=>{
  privateAccountResponse(event)
  try { const { client,worker }=await accountClients(event); const input=getQuery(event); return await provisionQuery(client,worker,{bindingId:input.bindingId,provisioningId:input.provisioningId}) }
  catch(error) { throw accountHttpError(error) }
})
