import { getHeader } from 'h3'
import { runtime, jsonBody, safe } from '../../../utils/hqRuntime'
import { executorActor } from '../../../utils/hqAuth'
import { parseAgentAction } from '../../../utils/hqDomain'
export default defineEventHandler(event => safe(async () => {
  const { config, store } = runtime(event)
  const actor = executorActor(getHeader(event, 'authorization'), config)
  const body = await jsonBody(event)
  if (!body || typeof body !== 'object' || Object.keys(body).some(k => !['command', 'input'].includes(k))) throw new Error('Invalid envelope')
  return store.execute(actor, parseAgentAction(body.command, body.input, actor))
}))
