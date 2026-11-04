import { getRouterParam } from 'h3'
import { assertLocalBrainRequest, readBrainNote } from '../../../utils/brain'

export default defineEventHandler(async event => {
  assertLocalBrainRequest(event)
  return readBrainNote(useRuntimeConfig(event), getRouterParam(event, 'id'))
})
