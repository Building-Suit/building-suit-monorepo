import { setResponseHeader } from 'h3'
import { hqRpc, requireHqFounder } from '../../../../utils/hqAccess'
import { emailTestId } from '../../../../utils/hqEmailTests'
export default defineEventHandler(async event => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const config = useRuntimeConfig(event)
  const { accessToken } = await requireHqFounder(event, config)
  return hqRpc(config, accessToken, 'hq_email_test_status', { p_id: emailTestId(event) })
})
