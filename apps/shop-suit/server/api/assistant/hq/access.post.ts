import { z } from 'zod'
import { readShopAssistantRequest } from '../../../utils/shopAssistantRequest'
import { hqAssistantAccess, hqAssistantSelection, readHqAssistantRpc } from '../../../utils/shopHqAssistant'

const request = z.strictObject({ ...hqAssistantSelection, enabled: z.boolean().optional() })

export default defineEventHandler(async (event) => {
  const { input, scope } = await readShopAssistantRequest(event, request, 1_024, 'hq')
  const selection = { p_shop_id: scope.shopId }
  const result = input.enabled === undefined
    ? await scope.client.rpc('shop_hq_assistant_access', selection)
    : await scope.client.rpc('shop_hq_assistant_authorize', { ...selection, p_enabled: input.enabled })
  return readHqAssistantRpc(hqAssistantAccess, result)
})
