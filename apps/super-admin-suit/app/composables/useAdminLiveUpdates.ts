import { createAdminLiveUpdates } from '../utils/live-updates'
import type { AdminLiveScope, AdminUpdateKind } from '../utils/live-updates'

export function useAdminLiveUpdates(options: {
  scope(): AdminLiveScope | null
  authorize(): Promise<boolean>
  paused(): boolean
  refresh(kinds: readonly AdminUpdateKind[], isCurrent: () => boolean): Promise<void>
}) {
  const client = useSupabaseClient()
  const identity = useSupabaseSession()
  const requestFetch = useRequestFetch()
  let cleanup = () => {}
  onBeforeUnmount(() => cleanup())
  onMounted(() => {
    const updates = createAdminLiveUpdates({
      ...options,
      authorize: () => navigator.onLine ? options.authorize() : Promise.resolve(false),
      channel(scope) {
        // Same-project, receive-only private broadcast; never subscribe to Shop
        // or expose control-plane tables through postgres_changes.
        const channel = client.channel(scope.topic!, { config: { private: true } })
        return {
          onInvalidate: callback => { channel.on('broadcast', { event: 'invalidate' }, event => callback(event.payload)) },
          subscribe: callback => { channel.subscribe(callback) },
          close: () => client.removeChannel(channel),
        }
      },
    })
    let topicRevision = 0
    const resolveTopic = async () => {
      const current = ++topicRevision, scope = options.scope()
      if (!scope) { await updates.update(null); return }
      try {
        const live = await requestFetch<{ userId: string; authorityEnvironmentId: string; topic: string }>('/api/live')
        if (current !== topicRevision) return
        if (live.userId !== scope.userId || live.authorityEnvironmentId !== scope.authorityEnvironmentId
          || typeof live.topic !== 'string' || !live.topic.startsWith(`sas:${scope.authorityEnvironmentId}:${scope.userId}:`)) throw new Error('live_scope_mismatch')
        await updates.update({ ...scope, topic: live.topic })
      } catch { if (current === topicRevision) await updates.update(null) }
    }
    watch([() => options.scope()?.userId, () => options.scope()?.authorityEnvironmentId, () => identity.value?.access_token], resolveTopic, { immediate: true })
    watch(options.paused, paused => { if (!paused) updates.resume() })
    const recover = () => { if (navigator.onLine && document.visibilityState === 'visible') void resolveTopic().then(() => updates.recover()) }
    window.addEventListener('online', recover)
    document.addEventListener('visibilitychange', recover)
    window.addEventListener('focus', recover)
    cleanup = () => {
      ++topicRevision
      window.removeEventListener('online', recover)
      document.removeEventListener('visibilitychange', recover)
      window.removeEventListener('focus', recover)
      void updates.dispose()
    }
  })
}
