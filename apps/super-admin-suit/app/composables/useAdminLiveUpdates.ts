import { createAdminLiveUpdates } from '../utils/live-updates'
import type { AdminLiveScope, AdminUpdateKind } from '../utils/live-updates'

export function useAdminLiveUpdates(options: {
  scope(): AdminLiveScope | null
  authorize(): Promise<boolean>
  paused(): boolean
  refresh(kinds: readonly AdminUpdateKind[], isCurrent: () => boolean): Promise<void>
}) {
  const client = useSupabaseClient()
  let cleanup = () => {}
  onBeforeUnmount(() => cleanup())
  onMounted(() => {
    const updates = createAdminLiveUpdates({
      ...options,
      authorize: () => navigator.onLine ? options.authorize() : Promise.resolve(false),
      channel(scope) {
        // Same-project, receive-only private broadcast; never subscribe to Shop
        // or expose control-plane tables through postgres_changes.
        const channel = client.channel(`sas:${scope.authorityEnvironmentId}`, { config: { private: true } })
        return {
          onInvalidate: callback => { channel.on('broadcast', { event: 'invalidate' }, event => callback(event.payload)) },
          subscribe: callback => { channel.subscribe(callback) },
          close: () => client.removeChannel(channel),
        }
      },
    })
    watch(() => options.scope(), scope => { void updates.update(scope).catch(() => {}) }, { immediate: true })
    watch(options.paused, paused => { if (!paused) updates.resume() })
    const recover = () => { if (navigator.onLine && document.visibilityState === 'visible') updates.recover() }
    window.addEventListener('online', recover)
    document.addEventListener('visibilitychange', recover)
    window.addEventListener('focus', recover)
    cleanup = () => {
      window.removeEventListener('online', recover)
      document.removeEventListener('visibilitychange', recover)
      window.removeEventListener('focus', recover)
      void updates.dispose()
    }
  })
}
