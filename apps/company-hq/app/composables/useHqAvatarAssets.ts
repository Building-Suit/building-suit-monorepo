import type { HqAgentPresentation, HqAvatarAssetKey, HqGameCharacter } from '@building-suit/ui/types/hqAgentsPresentation'
import type { HqAvatarAssets } from '@building-suit/ui/types/hqLayoutPresentation'

export function useHqAvatarAssets(roster: () => readonly HqAgentPresentation[]) {
  const assets = shallowRef<HqAvatarAssets>({})
  const pending = new AbortController()
  const requests = new Map<HqAvatarAssetKey, Promise<boolean>>()
  const failedGameCharacter = shallowRef<HqGameCharacter>()
  let gameRequest = 0

  function load(key: HqAvatarAssetKey, pack: string) {
    if (assets.value[key]) return Promise.resolve(true)
    const existing = requests.get(key)
    if (existing) return existing
    const request = fetch(`/avatars/${pack}.glb`, { signal: pending.signal })
      .then(response => {
        if (!response.ok) throw new Error('Avatar pack unavailable')
        return response.blob()
      })
      .then(blob => {
        if (pending.signal.aborted) return false
        assets.value = { ...assets.value, [key]: blob }
        return true
      })
      .catch(() => false)
      .finally(() => requests.delete(key))
    requests.set(key, request)
    return request
  }

  async function loadGameCharacter(character: HqGameCharacter) {
    const current = ++gameRequest
    failedGameCharacter.value = undefined
    const loaded = await load(character, `hq-game-${character}`)
    if (!loaded && current === gameRequest && !pending.signal.aborted) failedGameCharacter.value = character
  }

  // Each visible employee shares the pack for their body preset.
  onMounted(() => {
    watch(roster, agents => {
      for (const agent of agents) {
        const avatar = agent.avatar
        if (!avatar || !(agent.activity === 'working' || agent.activity === 'idle' || agent.cosmeticIdle)) continue
        void load(avatar.body, `hq-lego-${avatar.body}`)
      }
    }, { immediate: true })
  })
  onScopeDispose(() => pending.abort())
  return { assets, loadGameCharacter, failedGameCharacter }
}
