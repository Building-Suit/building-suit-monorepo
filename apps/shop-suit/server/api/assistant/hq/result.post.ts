import { z } from 'zod'
import { readShopAssistantRequest } from '../../../utils/shopAssistantRequest'
import { hqAssistantJob, hqAssistantSelection, readHqAssistantRpc } from '../../../utils/shopHqAssistant'

const request = z.strictObject({ ...hqAssistantSelection, jobId: z.uuid() })

export default defineEventHandler(async (event) => {
  const { input, scope } = await readShopAssistantRequest(event, request, 1_024, 'hq')
  return readHqAssistantRpc(hqAssistantJob, await scope.client.rpc('shop_hq_assistant_job', {
    p_shop_id: scope.shopId,
    p_location_id: scope.locationId,
    p_job_id: input.jobId,
  }))
})
