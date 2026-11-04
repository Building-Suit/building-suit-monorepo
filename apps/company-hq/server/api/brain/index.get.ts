import { assertLocalBrainRequest, readBrainIndex } from '../../utils/brain'

export default defineEventHandler(async event => {
  assertLocalBrainRequest(event)
  return readBrainIndex(useRuntimeConfig(event).hqBrainPath)
})
