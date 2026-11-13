import { z } from 'zod'
import { readShopAssistantRequest } from '../../../utils/shopAssistantRequest'
import { hqAssistantRecent, hqAssistantSelection, readHqAssistantRpc } from '../../../utils/shopHqAssistant'

export default defineEventHandler(async (event) => {
  const { scope } = await readShopAssistantRequest(event, z.strictObject(hqAssistantSelection), 1_024, 'hq')
  return readHqAssistantRpc(hqAssistantRecent, await scope.client.rpc('shop_hq_assistant_recent', {
    p_shop_id: scope.shopId,
    p_location_id: scope.locationId,
  }))
})
