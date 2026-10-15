import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
import type { TaxQuote } from '~/types/tax'
/** Server catalog prices are authoritative. Keying by the full input prevents stale totals. */
export function useSaleTaxQuote(shop: Ref<string | null>, location: Ref<string | null>, lines: ComputedRef<{ item_type: string; source_id: string; quantity: number }[]>, online?: Ref<boolean>) {
 const rpc = useSupabaseClient<ShopRpcDatabase>().schema('public')
 const counter = online ? useOfflineCounter() : null
 const key = computed(() => `shop-data:tax-quote:${shop.value}:${location.value}:${JSON.stringify(lines.value)}:${online?.value ?? true}`)
 return useAsyncData(key, async () => {
  if (!shop.value || !location.value || !lines.value.length || lines.value.some(line => !line.source_id || line.quantity <= 0)) return null
  if (online?.value === false) {
   const enabled = await counter?.cached<boolean>('tax-calculation-enabled')
   if (enabled !== false) throw new Error('TAX_OFFLINE_QUOTE_REQUIRED')
   return null
  }
  const result = await rpc.rpc('quote_sale_tax', { p_shop_id: shop.value, p_location_id: location.value, p_lines: lines.value })
  if (result.error) throw result.error
  const quote = result.data as TaxQuote
  if (counter) await counter.cache('tax-calculation-enabled', quote.calculationEnabled)
  return quote
 }, { default: () => null })
}
