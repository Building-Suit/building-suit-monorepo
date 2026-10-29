import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
import type { TaxQuote } from '~/types/tax'
/** Server catalog prices are authoritative. Keying by the full input prevents stale totals. */
export function useSaleTaxQuote(shop: Ref<string | null>, location: Ref<string | null>, lines: ComputedRef<import('~/types/measurement').SaleLineInput[]>, offline?: Pick<ReturnType<typeof useOfflineCounter>, 'online' | 'cache' | 'cached'>, bundles = false, customer?: Ref<string | null>, draft?: Ref<string | null>) {
 const user = useSupabaseUser()
 const rpc = useShopClient<ShopRpcDatabase>().schema('public')
 const online = offline?.online
 const counter = offline
 const key = computed(() => `shop-data:tax-quote:${bundles ? 'pos' : 'sale'}:${user.value?.id}:${shop.value}:${location.value}:${customer?.value ?? ''}:${draft?.value ?? ''}:${JSON.stringify(lines.value)}:${online?.value ?? true}`)
 const quote = useShopQuery(key, async () => {
  if (!shop.value || !location.value || !lines.value.length || lines.value.some(line => !line.source_id || Number(line.quantity) <= 0)) return null
  if (online?.value === false) {
   const tradeEnabled = await counter?.cached<boolean>('trade-pricing-enabled')
   if (tradeEnabled !== false) throw new Error('TRADE_OFFLINE_QUOTE_REQUIRED')
   const enabled = await counter?.cached<boolean>('tax-calculation-enabled')
   if (enabled !== false || bundles && !(await counter?.cached('pos-catalog-offers'))) throw new Error('TAX_OFFLINE_QUOTE_REQUIRED')
   return null
  }
  const scope = key.value
  const result = await rpc.rpc('quote_customer_sale', { p_shop_id: shop.value, p_location_id: location.value, p_customer_id: customer?.value || null, p_lines: lines.value, p_bundles: bundles, p_invoice_id: draft?.value || null })
  if (result.error) throw result.error
  const quote = result.data as TaxQuote
  if (counter && scope === key.value) { await counter.cache('tax-calculation-enabled', quote.calculationEnabled); if (typeof quote.tradePricingEnabled === 'boolean') await counter.cache('trade-pricing-enabled', quote.tradePricingEnabled) }
  return quote
 }, { default: () => null })
 // Checkout stays blocked while an authoritative quote is being recalculated.
 return { ...quote, pending: computed(() => quote.pending.value || quote.isLoading.value) }
}
