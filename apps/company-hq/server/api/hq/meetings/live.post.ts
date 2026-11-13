import { createError } from 'h3'
import { hqRpc, requireHqFounder } from '../../../utils/hqAccess'
import { readMeetingBody } from '../../../utils/meetingRequest'

/** Prepared semantic adapter; enabling transport does not qualify an executor. */
export default defineEventHandler(async event => {
  const config = useRuntimeConfig(event)
  const { accessToken } = await requireHqFounder(event, config)
  if (config.hqMeetingsLive !== true) throw createError({ statusCode: 503, statusMessage: 'Live meetings are disabled pending provider and worker qualification' })
  const body = await readMeetingBody(event)
  if (typeof body.requestId !== 'string' || !/^[a-f0-9-]{36}$/i.test(body.requestId)) throw createError({ statusCode: 400, statusMessage: 'Invalid meeting command' })
  if (body.type === 'create') return hqRpc(config, accessToken, 'hq_meeting_create', { p_id: body.requestId, p_title: body.title, p_language: body.language, p_participants: body.participantIds, p_request_key: body.requestId })
  if (body.type === 'command' && typeof body.meetingId === 'string' && /^[a-f0-9-]{36}$/i.test(body.meetingId)
    && body.command && typeof body.command === 'object' && !Array.isArray(body.command)) {
    const command = body.command as Record<string, unknown>
    if (['research', 'proposePlan', 'submitPlan'].includes(String(command.type))
      || command.type === 'decidePlan' && command.decision === 'approved') {
      throw createError({ statusCode: 403, statusMessage: 'Request new work in Chat' })
    }
    return hqRpc(config, accessToken, 'hq_meeting_command', { p_meeting_id: body.meetingId, p_command: command, p_request_key: body.requestId })
  }
  throw createError({ statusCode: 400, statusMessage: 'Invalid meeting command' })
})
