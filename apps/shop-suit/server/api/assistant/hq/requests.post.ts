import { z } from 'zod'
import { readShopAssistantRequest } from '../../../utils/shopAssistantRequest'
import { hqAssistantEnqueue, hqAssistantSelection, readHqAssistantRpc } from '../../../utils/shopHqAssistant'

const request = z.strictObject({
  ...hqAssistantSelection,
  requestId: z.uuid(),
  message: z.string().trim().min(1).max(2_000)
    .refine(text => Buffer.byteLength(text, 'utf8') <= 2_000),
})

export default defineEventHandler(async (event) => {
  const { input, scope } = await readShopAssistantRequest(event, request, 16_384, 'hq')
  const result = await scope.client.rpc('shop_hq_assistant_send', {
    p_shop_id: scope.shopId,
    p_location_id: scope.locationId,
    p_request_id: input.requestId,
    p_message: input.message,
  })
  setResponseStatus(event, 202)
  return readHqAssistantRpc(hqAssistantEnqueue, result)
})
