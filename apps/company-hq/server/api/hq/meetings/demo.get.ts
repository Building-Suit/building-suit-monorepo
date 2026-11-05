import { createError, getQuery } from 'h3'
import { demoSnapshot } from '../../../meetings/demoService.mjs'
import { requireMeetingDemo } from '../../../utils/meetingRequest'

export default defineEventHandler(event => {
  const { filename, owner } = requireMeetingDemo(event, useRuntimeConfig(event))
  const id = getQuery(event).id
  if (id !== undefined && (typeof id !== 'string' || !/^[a-f0-9-]{36}$/i.test(id))) throw createError({ statusCode: 400, statusMessage: 'Invalid meeting' })
  try { return demoSnapshot(filename, owner, id) }
  catch { throw createError({ statusCode: 404, statusMessage: 'Meeting unavailable' }) }
})
