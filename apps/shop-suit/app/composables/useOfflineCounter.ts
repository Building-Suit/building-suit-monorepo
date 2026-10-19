import { useConnectivity } from '@building-suit/ux'
import { createOfflineStore, type OfflineCommand, type OfflineRecord } from '~/utils/offlineStore.js'
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'

type Functions = ShopRpcDatabase['public']['Functions']
export function useOfflineCounter() {
  const { online } = useConnectivity()
  const user = useSupabaseUser()
  const confirmation = useConfirmation()
  const { locale } = useI18n()
  const recoveryError = ref('')
  const config = useRuntimeConfig()
  const { currentId, currentLocationId } = useShop()
  const supabase = useShopClient<ShopRpcDatabase>()
  const rpc = supabase.schema('public')
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
    channel?.close(); store = undefined; records.value = []; ready.value = false; busy.value = false; storageError.value = ''; recoveryError.value = ''
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
  async function capturedAuthorization(expectedUser: string, isCurrent: () => boolean) {
    const { data, error } = await supabase.auth.getSession()
    if (error || !data.session || data.session.user.id !== expectedUser || !isCurrent()) throw Object.assign(new Error('Offline identity changed'), { retryable: true, code: 'OFFLINE_AUTH_REQUIRED' })
    return `Bearer ${data.session.access_token}`
  }
  async function execute(command: OfflineCommand, expectedUser: string, isCurrent: () => boolean) {
    // Bind the request to the vault's user even if a login/tenant switch races SDK fetch.
    const authorization = await capturedAuthorization(expectedUser, isCurrent)
    const query = command.kind === 'service'
      ? rpc.rpc('complete_service', command.args as Functions['complete_service']['Args'])
      : command.kind === 'sale'
      ? rpc.rpc('replay_offline_pos_sale', command.args as Functions['replay_offline_pos_sale']['Args'])
      : rpc.rpc('replay_offline_cash_command', { p_kind: command.kind, p_shop_id: String(command.args.p_shop_id), p_args: command.args })
    const result = await query.setHeader('Authorization', authorization)
    if (result.error) {
      const transient = !result.error.code || ['PGRST000', 'PGRST001', 'PGRST002', 'PGRST003', '57014', '40001', '40P01'].includes(result.error.code)
      const known = result.error.message.match(/\b(?:SERVICE_REQUEST_CANCELLED|SERVICE_REQUEST_CONFLICT|SERVICE_QUANTITY_EXCEEDED|INSUFFICIENT_SERVICE_MATERIAL_STOCK|SERVICE_SALE_NOT_FULFILLABLE|INVALID_SERVICE_APPOINTMENT|OFFLINE_CASH_CANCELLED|CASH_SHIFT_NOT_OPEN|OFFLINE_SALE_CANCELLED|OFFLINE_SHIFT_CONFLICT|INSUFFICIENT_STOCK|POS_REQUEST_CONFLICT|POS_CHECKOUT_REQUIRES_FULL_PAYMENT|SHOP_PERMISSION_DENIED|CASH_SESSION_CLOSED|INVALID_POS_STAFF|SALE_OPEN_CASH_SHIFT_REQUIRED)\b/)
      throw Object.assign(new Error('Replay failed'), { retryable: transient, code: known?.[0] ?? (transient ? 'OFFLINE_NETWORK_UNAVAILABLE' : 'OFFLINE_REPLAY_REJECTED') })
    }
    return result.data
  }
  async function sync() {
    if (!store || busy.value || !online.value) return
    const activeStore = store; const currentGeneration = generation
    const expectedUser = JSON.parse(scope.value)[1] as string
    busy.value = true
    try {
      const list = await activeStore.sync(command => execute(command, expectedUser, () => generation === currentGeneration && online.value), () => generation === currentGeneration && online.value, record => {
        if (generation === currentGeneration) { records.value = records.value.map(old => old.envelope.localId === record.envelope.localId ? { ...record } : old); channel?.postMessage('changed') }
      })
      if (generation === currentGeneration) records.value = list
    } catch { if (generation === currentGeneration) storageError.value = 'OFFLINE_STORAGE_CORRUPT' }
    finally { if (generation === currentGeneration) busy.value = false }
  }
  async function retry(id: string) { if (store) { await store.retry(id); await update(); await sync() } }
  async function reconcile(id: string) {
    if (!store || busy.value) return
    const activeStore = store; const currentGeneration = generation
    const record = records.value.find(record => record.envelope.localId === id)
    if (!record || (!online.value && record.resolution?.phase !== 'cancelled')) return
    const ar = locale.value === 'ar'
    if (record.resolution?.phase !== 'cancelled' && !await confirmation.ask(ar
      ? 'نوقف إعادة إرسال العملية ونفحص نتيجتها عند الخادم؟ العملية المسجلة تبقى مسجلة، وإلا سنمنع هذا الطلب من التسجيل لاحقًا. لا يتم رد أموال تلقائيًا.'
      : 'Stop replay and check this transaction at the server? An already recorded transaction remains recorded. Otherwise this request will be permanently prevented from posting. No money is refunded automatically.')) return
    if (generation !== currentGeneration) return
    busy.value = true; recoveryError.value = ''
    try {
      const outcome = await activeStore.reconcile(id, async (command, resolution) => {
        if (generation !== currentGeneration || !online.value) throw new Error('OFFLINE_SCOPE_CHANGED')
        const args = command.args
        const authorization = await capturedAuthorization(JSON.parse(record.envelope.scope)[1] as string, () => generation === currentGeneration && online.value)
        if (command.kind === 'service') {
          const result = await rpc.rpc('reconcile_service_completion', { p_shop_id: String(args.p_shop_id), p_args: args, p_resolution_request_id: resolution.requestId, p_reason: resolution.reason }).setHeader('Authorization', authorization)
          if (result.error) throw new Error('OFFLINE_RECONCILIATION_UNAVAILABLE')
          return result.data
        }
        if (command.kind !== 'sale') {
          const result = await rpc.rpc('reconcile_offline_cash_command', { p_kind: command.kind, p_shop_id: String(args.p_shop_id), p_args: args, p_resolution_request_id: resolution.requestId, p_reason: resolution.reason }).setHeader('Authorization', authorization)
          if (result.error) throw new Error('OFFLINE_RECONCILIATION_UNAVAILABLE')
          return result.data.state === 'synced' ? { state: 'synced' as const, invoiceId: result.data.resultId } : result.data
        }
        const result = await rpc.rpc('reconcile_offline_pos_sale', { p_request_id: String(args.p_request_id), p_shop_id: String(args.p_shop_id), p_location_id: String(args.p_location_id), p_original_args: args, p_resolution_request_id: resolution.requestId, p_reason: resolution.reason }).setHeader('Authorization', authorization)
        if (result.error) throw new Error('OFFLINE_RECONCILIATION_UNAVAILABLE')
        return result.data
      })
      if (generation !== currentGeneration) return
      await update(); channel?.postMessage('changed')
      if (outcome.state === 'synced') return // Existing issued receipt; use the ordinary correction workflow.
      if (outcome.resolution?.phase === 'cancelled' && await confirmation.ask(ar
        ? record.envelope.command.kind === 'service' ? 'أكد توثيق الخدمة المنفذة والمواد المستخدمة من خلال مسار التنفيذ أو التصحيح المعتمد. إلغاء الطلب لا يعني عدم تنفيذ الخدمة ولا يعيد مواد تلقائيًا.' : record.envelope.command.kind === 'sale' ? 'أكد أن البضاعة وأي مبلغ محصل تم تسويتهما مع العميل. سيُحفظ إقرارك قبل متابعة الطابور. هذا الإجراء لا يُصدر بيعًا ولا يسجل رد أموال أو حركة مخزون.' : 'أكد تسوية حركة النقد أو العد وتوثيق أي تصحيح من خلال المسار المعتمد. سيُحفظ إقرارك قبل متابعة الطابور. لن تتغير الورديات المغلقة أو القيود السابقة.'
        : record.envelope.command.kind === 'service' ? 'Confirm performed service and material usage have been documented through the authorized fulfillment or correction workflow. Cancelling this request does not undo performance or restore material automatically.' : record.envelope.command.kind === 'sale' ? 'Confirm the goods and any collected payment have been reconciled with the customer. Your acknowledgement will be retained before the queue continues. This does not issue a sale, post a refund or move stock.' : 'Confirm the physical cash movement/count has been reconciled and any required correction documented through the ordinary authorized workflow. Your acknowledgement will be retained before the queue continues. Closed shifts and prior ledger entries remain unchanged.')) {
        if (generation !== currentGeneration) return
        await activeStore.acknowledge(id); await update(); channel?.postMessage('changed')
      }
    } catch { if (generation === currentGeneration) recoveryError.value = 'OFFLINE_RECONCILIATION_UNAVAILABLE' }
    finally { if (generation === currentGeneration) busy.value = false }
    if (generation === currentGeneration) await sync()
  }
  const shiftClosing = computed(() => records.value.some(record => record.envelope.command.kind === 'close' && record.state !== 'synced' && record.resolution?.phase !== 'reconciled'))
  watch(scope, () => { void initialize() }, { flush: 'sync' })
  watch(online, value => { if (value) void sync() })
  onMounted(() => { mounted = true; void initialize() })
  onBeforeUnmount(() => { mounted = false; ++generation; store?.close(); channel?.close() })
  return { scope, online, ready, records, storageError, recoveryError, busy, cache, cached, enqueue, sync, retry, reconcile, shiftClosing }
}
