import { createError } from 'h3'
import { assertHqAccessRequest, requireHqFounder } from '../../../utils/hqAccess'
import { hqHostedOrigin } from '../../../utils/brain'

export default defineEventHandler(async event => {
  const config = useRuntimeConfig(event)
  assertHqAccessRequest(event, config)
  if (config.hqMeetingsDemo === true && config.hqMeetingsLive === true) throw createError({ statusCode: 503, statusMessage: 'Select one meeting transport explicitly' })
  const live = config.hqMeetingsLive === true
  if (live) await requireHqFounder(event, config)
  return { demonstration: config.hqMeetingsDemo === true && hqHostedOrigin(config) === null && !process.env.VERCEL, live, blockers: ['Meeting speech, quota, staff qualification and capacity require acceptance before rollout.', 'Live mode requires explicit configuration and fresh qualified canonical bindings. Existing HQ tasks/chat remain separate.'] }
})
