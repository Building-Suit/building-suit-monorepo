import { getHeader } from 'h3'
import { runtime, safe } from '../../../utils/hqRuntime'
import { executorActor } from '../../../utils/hqAuth'
import { projectState } from '../../../utils/hqDomain'
export default defineEventHandler(event => safe(async () => {
  const { config, store } = runtime(event)
  const actor = executorActor(getHeader(event, 'authorization'), config)
  return projectState(await store.read(), actor, config.remote ? 'supabase' : 'sqlite')
}))
