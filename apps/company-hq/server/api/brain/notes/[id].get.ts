import { getRouterParam } from 'h3'
import { assertLocalBrainRequest, readBrainNote } from '../../../utils/brain'

export default defineEventHandler(async event => {
  const config = useRuntimeConfig(event)
  assertLocalBrainRequest(event, config)
  return readBrainNote(config, getRouterParam(event, 'id'))
})
