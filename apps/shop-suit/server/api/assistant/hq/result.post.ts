import { z } from 'zod'
import { readShopAssistantRequest } from '../../../utils/shopAssistantRequest'
import { hqAssistantJob, hqAssistantSelection, readHqAssistantRpc } from '../../../utils/shopHqAssistant'
import { resolveShopHqSaleIntent } from '../../../utils/shopHqSaleIntent'

const request = z.strictObject({ ...hqAssistantSelection, jobId: z.uuid() })

export default defineEventHandler(async (event) => {
  const { input, scope } = await readShopAssistantRequest(event, request, 1_024, 'hq')
  const job = readHqAssistantRpc(hqAssistantJob, await scope.client.rpc('shop_hq_assistant_job', {
    p_shop_id: scope.shopId,
    p_location_id: scope.locationId,
    p_job_id: input.jobId,
  }))
  if (job.state !== 'completed') return { state: job.state }
  if (job.intent.kind === 'reply') return { state: 'completed' as const, text: job.intent.reply }

  return {
    state: 'completed' as const,
    sale: await resolveShopHqSaleIntent(scope, job.intent),
  }
})
