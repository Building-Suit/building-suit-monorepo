import { z } from 'zod'
import { assistantChatRequest, readShopAssistantRequest } from '../../../utils/shopAssistantRequest'
import { hqAssistantEnqueue, readHqAssistantRpc } from '../../../utils/shopHqAssistant'

const request = assistantChatRequest
  .extend({ requestId: z.uuid() })
  .refine(input => input.messages.every(message => Buffer.byteLength(message.content, 'utf8') <= 2_000))

export default defineEventHandler(async (event) => {
  const { input, scope } = await readShopAssistantRequest(event, request, 32_768, 'hq')
  const result = await scope.client.rpc('shop_hq_assistant_enqueue', {
    p_shop_id: scope.shopId,
    p_location_id: scope.locationId,
    p_request_id: input.requestId,
    p_messages: input.messages,
  })
  setResponseStatus(event, 202)
  return readHqAssistantRpc(hqAssistantEnqueue, result)
})
