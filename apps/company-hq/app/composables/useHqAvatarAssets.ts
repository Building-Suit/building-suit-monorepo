import type { HqAgentPresentation } from '@building-suit/ui/types/hqAgentsPresentation'
import type { HqAvatarAssets } from '@building-suit/ui/types/hqLayoutPresentation'

export function useHqAvatarAssets(roster: () => readonly HqAgentPresentation[]) {
  const assets = shallowRef<HqAvatarAssets>({})
  const pending = new AbortController()
  const requested = new Set<'female' | 'male'>()

  // Both packs are public, immutable art assets. The roster only determines
  // which of the two files this view needs to load.
  onMounted(() => {
    watch(roster, agents => {
      for (const agent of agents) {
        const body = agent.avatar?.body
        if (!body || requested.has(body) || !(agent.activity === 'working' || agent.activity === 'idle' || agent.cosmeticIdle)) continue
        requested.add(body)
        void fetch(`/avatars/hq-lego-${body}.glb`, { signal: pending.signal })
          .then(response => {
            if (!response.ok) throw new Error('Avatar pack unavailable')
            return response.blob()
          })
          .then(blob => {
            if (!pending.signal.aborted) assets.value = { ...assets.value, [body]: blob }
          })
          .catch(() => { /* A missing asset leaves the employee nameplate available. */ })
      }
    }, { immediate: true })
  })
  onScopeDispose(() => pending.abort())
  return assets
}
