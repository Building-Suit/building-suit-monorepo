import { assertHqAccessRequest } from '../../../utils/hqAccess'
import { hqHostedOrigin } from '../../../utils/brain'

export default defineEventHandler(event => {
  const config = useRuntimeConfig(event)
  assertHqAccessRequest(event, config)
  return { demonstration: config.hqMeetingsDemo === true && hqHostedOrigin(config) === null && !process.env.VERCEL, live: false, blockers: ['Meeting speech, quota, staff qualification and capacity are not yet verified.', 'Meeting transport and source-only migration are not activated. Existing HQ tasks/chat remain separate.'] }
})
