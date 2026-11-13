import { setResponseHeader } from 'h3'
import { hqRpc, requireHqFounder } from '../../utils/hqAccess'
import { hqAgentSnapshot } from '../../utils/hqAgents'
import { parseHqOfficeObservations } from '../../../shared/types/officeObservations'

export default defineEventHandler(async event => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const config = useRuntimeConfig(event)
  const { accessToken } = await requireHqFounder(event, config)
  const snapshot = hqAgentSnapshot(await hqRpc<unknown>(config, accessToken, 'hq_agent_snapshot'), event)
  try {
    const observations = parseHqOfficeObservations(await hqRpc<unknown>(config, accessToken, 'hq_office_observations'))
    if (observations) snapshot.observations = observations
    else console.warn('HQ_OFFICE_OBSERVATIONS_INVALID')
  } catch { console.warn('HQ_OFFICE_OBSERVATIONS_UNAVAILABLE') }
  return snapshot
})
