import { createError } from 'h3'
import { hqRpc, requireHqFounder } from '../../../utils/hqAccess'

export default defineEventHandler(async event => {
  const config = useRuntimeConfig(event)
  const { accessToken } = await requireHqFounder(event, config)
  if (config.hqMeetingsLive !== true) throw createError({ statusCode: 503, statusMessage: 'Live meetings are disabled' })
  // Canonical, source-bound workforce projection; qualification is a separate
  // evidence-bound meeting gate, never inferred from configured attendance.
  return hqRpc(config, accessToken, 'hq_meeting_roster')
})
