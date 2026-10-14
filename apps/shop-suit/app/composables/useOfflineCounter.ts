import { useConnectivity } from '@building-suit/ux'
import { createOfflineStore, type OfflineCommand, type OfflineRecord } from '~/utils/offlineStore.js'
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'

type Functions = ShopRpcDatabase['public']['Functions']
export function useOfflineCounter() {
  const { online } = useConnectivity()
  const user = useSupabaseUser()
  const config = useRuntimeConfig()
  const { currentId, currentLocationId } = useShop()
  const rpc = useSupabaseClient<ShopRpcDatabase>().schema('public')
  const records = ref<OfflineRecord[]>([])
  const storageError = ref('')
  const ready = ref(false)
  const busy = ref(false)
  const scope = computed(() => user.value && currentId.value && currentLocationId.value
    ? JSON.stringify([config.public.supabase.url, user.value.id, currentId.value, currentLocationId.value]) : '')
  let store: ReturnType<typeof createOfflineStore> | undefined
  let generation = 0
  let mounted = false
  let channel: BroadcastChannel | undefined
  async function update() { if (store) records.value = await store.list() }
  async function initialize() {
    const currentGeneration = ++generation
    const previous = store
    if (previous) void previous.clearCache().finally(() => previous.close()).catch(() => {})
    channel?.close(); store = undefined; records.value = []; ready.value = false; busy.value = false; storageError.value = ''
    if (!mounted || !scope.value) return
    try {
      const next = createOfflineStore({ scope: scope.value })
      const list = await next.list()
      if (generation !== currentGeneration) { next.close(); return }
      store = next; records.value = list; ready.value = true
      channel = new BroadcastChannel(`shop-pos:${scope.value}`)
      channel.onmessage = () => { void update().catch(() => { storageError.value = 'OFFLINE_STORAGE_UNAVAILABLE' }) }
      if (online.value) void sync()
    } catch { storageError.value = 'OFFLINE_STORAGE_UNAVAILABLE' }
  }
  async function cache(key: string, value: unknown) { if (store) { try { await store.cache(key, value) } catch { storageError.value = 'OFFLINE_STORAGE_UNAVAILABLE' } } }
  async function cached<T>(key: string) { return store ? store.cached<T>(key) : null }
  async function enqueue(command: OfflineCommand, id?: string) {
    if (!store || !ready.value) throw new Error('OFFLINE_STORAGE_UNAVAILABLE')
    const queued = await store.enqueue(command, id); await update(); channel?.postMessage('changed'); return queued
  }
  async function execute(command: OfflineCommand) {
    let result
    if (command.kind === 'sale') result = await rpc.rpc('replay_offline_pos_sale', command.args as Functions['replay_offline_pos_sale']['Args'])
    else if (command.kind === 'movement') result = await rpc.rpc('record_cash_movement', command.args as Functions['record_cash_movement']['Args'])
    else result = await rpc.rpc('close_cash_shift', command.args as Functions['close_cash_shift']['Args'])
    if (result.error) {
      const transient = !result.error.code || ['PGRST000', 'PGRST001', 'PGRST002', 'PGRST003', '57014', '40001', '40P01'].includes(result.error.code)
      const known = result.error.message.match(/\b(?:OFFLINE_SHIFT_CONFLICT|INSUFFICIENT_STOCK|POS_REQUEST_CONFLICT|POS_CHECKOUT_REQUIRES_FULL_PAYMENT|SHOP_PERMISSION_DENIED|CASH_SESSION_CLOSED|INVALID_POS_STAFF|SALE_OPEN_CASH_SHIFT_REQUIRED)\b/)
      throw Object.assign(new Error('Replay failed'), { retryable: transient, code: known?.[0] ?? (transient ? 'OFFLINE_NETWORK_UNAVAILABLE' : 'OFFLINE_REPLAY_REJECTED') })
    }
    return result.data
  }
  async function sync() {
    if (!store || busy.value || !online.value) return
    const activeStore = store; const currentGeneration = generation
    busy.value = true
    try {
      const list = await activeStore.sync(execute, () => generation === currentGeneration && online.value, record => {
        if (generation === currentGeneration) { records.value = records.value.map(old => old.envelope.localId === record.envelope.localId ? { ...record } : old); channel?.postMessage('changed') }
      })
      if (generation === currentGeneration) records.value = list
    } catch { if (generation === currentGeneration) storageError.value = 'OFFLINE_STORAGE_CORRUPT' }
    finally { if (generation === currentGeneration) busy.value = false }
  }
  async function retry(id: string) { if (store) { await store.retry(id); await update(); await sync() } }
  const shiftClosing = computed(() => records.value.some(record => record.envelope.command.kind === 'close' && record.state !== 'synced'))
  watch(scope, () => { void initialize() })
  watch(online, value => { if (value) void sync() })
  onMounted(() => { mounted = true; void initialize() })
  onBeforeUnmount(() => { mounted = false; ++generation; store?.close(); channel?.close() })
  return { scope, online, ready, records, storageError, busy, cache, cached, enqueue, sync, retry, shiftClosing }
}
