import { getRouterParam } from 'h3'
import { assertLocalBrainRequest, hqHostedOrigin, readBrainNote } from '../../../utils/brain'
import { requireHqFounder } from '../../../utils/hqAccess'

export default defineEventHandler(async event => {
  const config = useRuntimeConfig(event)
  assertLocalBrainRequest(event, config)
  if (hqHostedOrigin(config)) await requireHqFounder(event, config)
  return readBrainNote(config, getRouterParam(event, 'id'))
})
