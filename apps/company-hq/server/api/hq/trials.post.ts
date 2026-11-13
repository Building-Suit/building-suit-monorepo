import { setResponseHeader } from 'h3'
import { hqRpc, requireHqFounder } from '../../utils/hqAccess'
import { hqTrialBody } from '../../utils/hqAgents'

export default defineEventHandler(async event => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const config = useRuntimeConfig(event)
  const { accessToken } = await requireHqFounder(event, config)
  const body = await hqTrialBody(event)
  return hqRpc<unknown>(config, accessToken, 'hq_issue_workforce_qualification', { p_trial_id: body.trialId })
})
