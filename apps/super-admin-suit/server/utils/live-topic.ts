import { AdminAccessError } from './authorize.ts'
import type { AdminSession } from './authorize.ts'
interface LiveClient {
  rpc(name: 'super_admin_live_topic'): PromiseLike<{ data: unknown; error: { code?: string } | null }>
}
/** Topic identity is resolved by a definer RPC from verified Auth/authority state. */
export async function readLiveTopic(client: LiveClient, session: AdminSession) {
  const { data, error } = await client.rpc('super_admin_live_topic')
  if (error) throw new AdminAccessError(error.code === '42501' ? 403 : 503)
  const prefix = `sas:${session.authorityEnvironmentId}:${session.userId}:`
  if (typeof data !== 'string' || !data.startsWith(prefix)
    || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(data.slice(prefix.length))) throw new AdminAccessError(503)
  return data
}
