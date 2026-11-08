import { setResponseHeader } from 'h3'
import { hqRpc, requireHqFounder } from '../../../utils/hqAccess'
import { hqPublicRetailTrialBody } from '../../../utils/hqAgents'
export default defineEventHandler(async event => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const config = useRuntimeConfig(event)
  const { accessToken } = await requireHqFounder(event, config)
  const body = await hqPublicRetailTrialBody(event)
  return hqRpc<unknown>(config, accessToken, 'hq_begin_public_retail_trial', {
    p_skill_file_id: body.skillFileId, p_category: body.category, p_request_key: body.requestKey,
  })
})
