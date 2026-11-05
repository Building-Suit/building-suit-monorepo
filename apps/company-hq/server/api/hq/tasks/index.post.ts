import { setResponseHeader } from 'h3'
import { hqRpc, requireHqFounder } from '../../../utils/hqAccess'
import { hqAgentSnapshot, hqTaskBody } from '../../../utils/hqAgents'

export default defineEventHandler(async event => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const config = useRuntimeConfig(event)
  const { accessToken } = await requireHqFounder(event, config)
  const task = await hqTaskBody(event)
  return hqAgentSnapshot(await hqRpc<unknown>(config, accessToken, 'hq_create_task', {
    p_title: task.title, p_brief: task.brief, p_acceptance: task.acceptance,
    p_assignee_id: task.assigneeId, p_request_key: task.requestKey,
  }), event)
})
