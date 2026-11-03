import { founder, mutationOrigin, writeSession, safe } from '../../../utils/hqRuntime'
export default defineEventHandler(event => safe(async () => {
  const { config, store, token } = await founder(event)
  mutationOrigin(event, config.origin)
  await store.revokeSession(token); writeSession(event, '', config.origin)
  return { ok: true }
}))
