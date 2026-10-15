import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
import type { TaxQuote } from '~/types/tax'
/** Server catalog prices are authoritative. Keying by the full input prevents stale totals. */
export function useSaleTaxQuote(shop: Ref<string | null>, location: Ref<string | null>, lines: ComputedRef<{ item_type: string; source_id: string; quantity: number }[]>) {
 const rpc = useSupabaseClient<ShopRpcDatabase>().schema('public')
 const key = computed(() => `shop-data:tax-quote:${shop.value}:${location.value}:${JSON.stringify(lines.value)}`)
 return useAsyncData(key, async () => {
  if (!shop.value || !location.value || !lines.value.length || lines.value.some(line => !line.source_id || line.quantity <= 0)) return null
  const result = await rpc.rpc('quote_sale_tax', { p_shop_id: shop.value, p_location_id: location.value, p_lines: lines.value })
  if (result.error) throw result.error
  return result.data as TaxQuote
 }, { default: () => null })
}
