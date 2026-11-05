import { createError, getRouterParam, setResponseHeader } from 'h3'
import { hqRpc, requireHqFounder } from '../../../../utils/hqAccess'
import { hqAgentSnapshot } from '../../../../utils/hqAgents'
import { HQ_AGENT_UUID } from '../../../../../shared/types/agents'

export default defineEventHandler(async event => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const config = useRuntimeConfig(event)
  const { accessToken } = await requireHqFounder(event, config)
  const id = getRouterParam(event, 'id')
  if (!id || !HQ_AGENT_UUID.test(id)) throw createError({ statusCode: 400, statusMessage: 'HQ task unavailable' })
  return hqAgentSnapshot(await hqRpc<unknown>(config, accessToken, 'hq_cancel_task', { p_task_id: id }), event)
})
