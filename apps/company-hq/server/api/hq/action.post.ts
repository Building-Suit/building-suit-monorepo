import { founder, jsonBody, mutationOrigin, safe } from '../../utils/hqRuntime'
import { parseFounderAction } from '../../utils/hqDomain'
export default defineEventHandler(event => safe(async () => {
  const { actor, config, store } = await founder(event)
  mutationOrigin(event, config.origin)
  return store.execute(actor, parseFounderAction(await jsonBody(event), actor))
}))
