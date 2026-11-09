import { createError } from 'h3'
import { hqRpc, requireHqFounder } from '../../../utils/hqAccess'
import { readMeetingBody } from '../../../utils/meetingRequest'

export default defineEventHandler(async event => {
  const config = useRuntimeConfig(event)
  const { accessToken } = await requireHqFounder(event, config)
  const { action, endpoint, p256dh, auth } = await readMeetingBody(event)
  const invalid = () => createError({ statusCode: 400, statusMessage: 'Invalid notification subscription' })
  if (typeof endpoint !== 'string' || endpoint.length > 2048 || endpoint.includes('\\')) throw invalid()
  if (action === 'check') {
    return { enabled: await hqRpc<boolean>(config, accessToken, 'hq_check_push_device', { p_endpoint: endpoint }) }
  }
  if (action !== 'disable' && (action !== 'enable' || !config.hqPushVapidPublicKey
    || typeof p256dh !== 'string' || !/^[A-Za-z0-9_-]{87}$/.test(p256dh)
    || typeof auth !== 'string' || !/^[A-Za-z0-9_-]{22}$/.test(auth))) throw invalid()
  const success = await hqRpc<boolean>(config, accessToken, 'hq_manage_push_device', {
    p_endpoint: endpoint, p_p256dh: action === 'enable' ? p256dh : null, p_auth: action === 'enable' ? auth : null,
  })
  if (!success) throw invalid()
  return { enabled: action === 'enable' }
})
