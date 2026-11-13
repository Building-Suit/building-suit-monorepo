import { z } from 'zod'
import { readShopAssistantRequest } from '../../../utils/shopAssistantRequest'
import { hqAssistantHistory, hqAssistantSelection, readHqAssistantRpc } from '../../../utils/shopHqAssistant'

const request = z.strictObject({ ...hqAssistantSelection, beforeSequence: z.int().positive().optional() })

export default defineEventHandler(async (event) => {
  const { input, scope } = await readShopAssistantRequest(event, request, 1_024, 'hq')
  return readHqAssistantRpc(hqAssistantHistory, await scope.client.rpc('shop_hq_assistant_history', {
    p_shop_id: scope.shopId,
    p_location_id: scope.locationId,
    p_before_sequence: input.beforeSequence ?? null,
    p_limit: 30,
  }))
})
