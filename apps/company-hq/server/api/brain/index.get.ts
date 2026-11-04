import { assertLocalBrainRequest, readBrainIndex } from '../../utils/brain'

export default defineEventHandler(async event => {
  const config = useRuntimeConfig(event)
  assertLocalBrainRequest(event, config)
  return readBrainIndex(config)
})
