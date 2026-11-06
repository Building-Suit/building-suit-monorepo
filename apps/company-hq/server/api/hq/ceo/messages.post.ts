import { setResponseHeader } from 'h3'
import { hqRpc, requireHqFounder } from '../../../utils/hqAccess'
import { hqAgentSnapshot, hqCeoMessageBody } from '../../../utils/hqAgents'

export default defineEventHandler(async event => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const config = useRuntimeConfig(event)
  const { accessToken } = await requireHqFounder(event, config)
  const { prompt, requestKey } = await hqCeoMessageBody(event)
  return hqAgentSnapshot(await hqRpc<unknown>(config, accessToken, 'hq_send_ceo_message', {
    p_prompt: prompt, p_request_key: requestKey,
  }), event)
})
