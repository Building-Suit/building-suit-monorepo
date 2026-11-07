import { setResponseHeader } from 'h3'
import { hqRpc, requireHqFounder } from '../../utils/hqAccess'

export default defineEventHandler(async event => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const config = useRuntimeConfig(event)
  const { accessToken } = await requireHqFounder(event, config)
  return hqRpc<unknown>(config, accessToken, 'hq_workforce_trial_status')
})
