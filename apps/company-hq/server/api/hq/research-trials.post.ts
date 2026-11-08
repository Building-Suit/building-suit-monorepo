import { setResponseHeader } from 'h3'
import { hqRpc, requireHqFounder } from '../../utils/hqAccess'
import { hqPublicResearchTrialBody } from '../../utils/hqAgents'

export default defineEventHandler(async event => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const config = useRuntimeConfig(event)
  const { accessToken } = await requireHqFounder(event, config)
  const body = await hqPublicResearchTrialBody(event)
  return hqRpc<unknown>(config, accessToken, 'hq_begin_public_research_trial', {
    p_skill_file_id: body.skillFileId, p_request_key: body.requestKey,
  })
})
