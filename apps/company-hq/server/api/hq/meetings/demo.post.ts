import { createError } from 'h3'
import { demoCommand } from '../../../meetings/demoService.mjs'
import { readMeetingBody, requireMeetingDemo } from '../../../utils/meetingRequest'

export default defineEventHandler(async event => {
  const { filename, owner } = requireMeetingDemo(event, useRuntimeConfig(event))
  const body = await readMeetingBody(event)
  if (typeof body.requestId !== 'string' || body.meetingId !== undefined && typeof body.meetingId !== 'string' || !body.command || typeof body.command !== 'object' || Array.isArray(body.command)) throw createError({ statusCode: 400, statusMessage: 'Invalid meeting request' })
  try { return demoCommand(filename, owner, { requestId: body.requestId, meetingId: body.meetingId as string | undefined, command: body.command }) }
  catch { throw createError({ statusCode: 409, statusMessage: 'Meeting command requires review or is unavailable' }) }
})
