import { assertLocalBrainRequest, hqHostedOrigin, readBrainIndex } from '../../utils/brain'
import { requireHqFounder } from '../../utils/hqAccess'

export default defineEventHandler(async event => {
  const config = useRuntimeConfig(event)
  assertLocalBrainRequest(event, config)
  if (hqHostedOrigin(config)) await requireHqFounder(event, config)
  return readBrainIndex(config)
})
