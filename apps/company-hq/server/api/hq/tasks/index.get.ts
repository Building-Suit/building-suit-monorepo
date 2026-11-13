import { createError, getQuery, setResponseHeader } from 'h3'
import { hqRpc, requireHqFounder } from '../../../utils/hqAccess'
import { HQ_AGENT_UUID } from '../../../../shared/types/agents'
import { parseHqTaskPage } from '../../../../shared/types/taskBrowser'

export default defineEventHandler(async event => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const config = useRuntimeConfig(event)
  const { accessToken } = await requireHqFounder(event, config)
  const query = getQuery(event)
  const group = query.group ?? 'running', offset = query.offset ?? '0', limit = query.limit ?? '12'
  if (Object.keys(query).some(key => !['group','officeId','offset','limit','taskId'].includes(key))
    || typeof group !== 'string' || !['running','waiting','done'].includes(group)
    || typeof offset !== 'string' || !/^\d{1,9}$/.test(offset)
    || typeof limit !== 'string' || !/^(?:[1-9]|1[0-2])$/.test(limit)
    || query.officeId !== undefined && (typeof query.officeId !== 'string' || query.officeId !== 'executive' && !HQ_AGENT_UUID.test(query.officeId))
    || query.taskId !== undefined && (typeof query.taskId !== 'string' || !HQ_AGENT_UUID.test(query.taskId))) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid task query' })
  }
  const page = parseHqTaskPage(await hqRpc<unknown>(config, accessToken, 'hq_task_browser', {
    p_group: group, p_office_id: query.officeId ?? null, p_offset: Number(offset), p_limit: Number(limit), p_task_id: query.taskId ?? null,
  }))
  if (!page) throw createError({ statusCode: 503, statusMessage: 'HQ tasks unavailable' })
  return page
})
