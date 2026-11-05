import { createError, getQuery } from 'h3'
import { hqRpc, requireHqFounder } from '../../../utils/hqAccess'

export default defineEventHandler(async event => {
  const config = useRuntimeConfig(event)
  const { accessToken } = await requireHqFounder(event, config)
  if (config.hqMeetingsLive !== true) throw createError({ statusCode: 503, statusMessage: 'Live meetings are disabled' })
  const id = getQuery(event).id
  if (id !== undefined && (typeof id !== 'string' || !/^[a-f0-9-]{36}$/i.test(id))) throw createError({ statusCode: 400, statusMessage: 'Invalid meeting' })
  return hqRpc(config, accessToken, 'hq_meeting_snapshot', { p_meeting_id: id ?? null })
})
