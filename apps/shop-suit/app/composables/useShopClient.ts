import { shopQueryError } from '~/utils/shopQueryError'
import type { Database as ShopDatabase } from '~/types/database.types'
import { useShopQueryCache } from './useShopQueryCache'
import { useShopMutation } from './useShopMutation'

/** Explicit read RPC contract. Unknown/new RPCs are commands, never cached as reads. */
const reads = new Set([
  'trade_order_reservation_context', 'trade_order_context', 'trade_quotation_context', 'trade_pricing_context', 'quote_customer_sale', 'purchase_reel_options', 'inventory_reel_context', 'pos_reel_options', 'product_technical_options', 'product_measurement_options', 'shop_storefront_builder', 'shop_offers', 'shop_offer_sources', 'pos_catalog_offers', 'quote_pos_sale',
  'appointment_access_status', 'appointment_calendar', 'appointment_options', 'barcode_label_data', 'business_currency_settings',
  'cash_shift_dashboard', 'catalog_sales_report', 'commission_assignment_context', 'commission_history', 'customer_access', 'customer_statement',
  'eta_settings', 'get_customer', 'get_location_sale', 'get_location_sale_receipt', 'get_own_pos_receipt', 'list_own_pos_receipts', 'get_purchase', 'get_sale', 'get_sale_tax_snapshot', 'inventory_access',
  'list_catalog_categories', 'list_customers', 'list_expenses', 'list_inventory', 'list_inventory_history', 'list_location_sales', 'list_outstanding_invoices',
  'list_products', 'list_purchases', 'list_services_by_category', 'list_shop_locations', 'list_stock_counts', 'list_vendors', 'payment_access',
  'platform_admin_billing_read', 'platform_admin_read', 'platform_admin_session', 'platform_plan_read', 'pos_catalog_search', 'pos_catalog_search_by_category',
  'pos_checkout_context', 'preview_sale_return', 'quote_sale_tax', 'receipt_settings', 'sale_access', 'sale_catalog', 'sale_correction_state', 'sale_return_context',
  'service_fulfillment_context', 'service_recipe_context', 'service_scheduling_options', 'shop_billing_change_preview', 'shop_billing_change_read', 'shop_billing_currency_plans',
  'shop_billing_read', 'shop_booking_settings', 'shop_cash_policy', 'shop_operating_report', 'shop_operational_report', 'shop_permission_access', 'shop_plan_usage',
  'shop_private_offer_read', 'shop_public_plan_catalog', 'shop_subscription_currency_catalog', 'shop_team_read', 'shop_website_address', 'shop_website_catalog',
  'shop_website_inquiries', 'shop_website_profile', 'shop_xpay_order_read', 'shop_xpay_proration_status', 'supplier_access', 'tax_settings',
])
type Response = { data: unknown; error: { message?: string } | null }
type Builder = PromiseLike<Response> & { abortSignal?: (signal: AbortSignal) => Builder }
function responseError(response: Response) { return Object.assign(new Error(response.error?.message ?? 'Shop request failed'), { shopResponse: response }) }

/** Retains the SDK's typed builders, headers and atomic commands; Colada owns execution. */
export function useShopClient<Database = ShopDatabase>() {
  const client = useSupabaseClient<Database>()
  const queries = useShopQueryCache()
  const mutate = useShopMutation()
  function wrapBuilder(builder: Builder, resource: string, parameters: unknown, write: boolean): Builder {
    return new Proxy(builder, {
      get(target, property) {
        if (property === 'then') return (resolve: (value: Response) => unknown, reject: (error: unknown) => unknown) => {
          const identity = queries.scopeKey()
          const execute = async () => {
            if (write) {
              let result: Response
              try { result = await mutate(async () => { const response = await target; if (response.error) throw responseError(response); return response }) }
              catch (error) { const response = (error as { shopResponse?: Response }).shopResponse; if (response) return response; throw error }
              if (!result.error && identity.join(':') === queries.scopeKey().join(':')) {
                const affected = (key: string) => key !== 'shop-context' && key !== 'shop-locations'
                queries.invalidate(affected)
                void queries.refresh(affected).catch(() => { /* Queries expose their own retry/error state. */ })
              }
              return result
            }
            const url = Reflect.get(target, 'url')
            const rpcArgs = (parameters as [{ p_redemption_token?: unknown; p_private_offer?: unknown }] | undefined)?.[0]
            const transient = Boolean(rpcArgs?.p_redemption_token || rpcArgs?.p_private_offer)
            // Redemption tokens stay in the request closure, never in keys or SSR payloads.
            const key = transient ? [...identity, resource, ++queries.scope.requestSequence] : [...identity, resource, JSON.stringify(parameters), url ? String(url) : '']
            const callerSignal = Reflect.get(target, 'signal') as AbortSignal | undefined
            const entry = queries.cache.ensure<Response>({ key, staleTime: transient ? 0 : 1_000, gcTime: transient ? 0 : 300_000, meta: { shopResource: resource }, query: async ({ signal }) => {
              const combined = callerSignal ? AbortSignal.any([signal, callerSignal]) : signal
              const result = await (target.abortSignal ? target.abortSignal(combined) : target)
              if (result.error) throw shopQueryError(result.error, result)
              return result
            } })
            try { const result = await queries.cache.refresh(entry); if (result.error) throw result.error; if (!result.data) throw new DOMException('Shop request superseded', 'AbortError'); return result.data }
            catch (error) { const response = (error as { shopResponse?: Response }).shopResponse; if (response) return response; throw error }
            finally { if (transient) queries.cache.remove(entry) }
          }
          return execute().then(resolve, reject)
        }
        const value = Reflect.get(target, property)
        if (typeof value !== 'function') return value
        return (...args: unknown[]) => {
          const result = Reflect.apply(value, target, args)
          return result && typeof result === 'object' && 'then' in result
            ? wrapBuilder(result as Builder, resource, parameters, write || ['insert', 'update', 'upsert', 'delete'].includes(String(property))) : result
        }
      },
    })
  }
  function wrapService<T extends object>(raw: T, service: string): T {
    return new Proxy(raw, { get(target, property) {
      const value = Reflect.get(target, property)
      if (typeof value !== 'function') return value
      if (property === 'from') return (...args: unknown[]) => wrapService(Reflect.apply(value, target, args), `${service}:${String(args[0])}`)
      if (property === 'getPublicUrl') return value.bind(target)
      return (...args: unknown[]) => {
        const resource = `${service}:${String(property)}`
        const invokeOptions = args[1] as { body?: { action?: string; orderId?: string }; signal?: AbortSignal } | undefined
        const body = invokeOptions?.body
        const read = service === 'functions'
          ? args[0] === 'shop-xpay-checkout' && (body?.action === 'status' || Boolean(body?.orderId && !body.action))
          : ['createSignedUrl', 'createSignedUrls', 'list', 'info', 'exists', 'download', 'getBucket', 'listBuckets'].includes(String(property))
        // Storage and Edge Functions preserve their SDK error/result contract too.
        const identity = queries.scopeKey()
        const operation = (signal?: AbortSignal) => Promise.resolve(Reflect.apply(value, target, signal && service === 'functions' ? [args[0], { ...invokeOptions, signal: invokeOptions?.signal ? AbortSignal.any([signal, invokeOptions.signal]) : signal }] : args)) as Promise<Response>
        if (!read) return mutate(async () => {
          const response = await operation()
          if (response.error) throw responseError(response)
          if (identity.join(':') === queries.scopeKey().join(':')) {
            const affected = (key: string) => key !== 'shop-context' && key !== 'shop-locations'
            queries.invalidate(affected)
            void queries.refresh(affected).catch(() => { /* Queries expose retry/error state. */ })
          }
          return response
        }).catch(error => { const response = (error as { shopResponse?: Response }).shopResponse; if (response) return response; throw error })
        const entry = queries.cache.ensure<Response>({
          key: [...queries.scopeKey(), resource, JSON.stringify(args)],
          meta: { shopResource: resource }, staleTime: 0, gcTime: 0,
          query: async ({ signal }) => { const response = await operation(signal); if (response.error) throw shopQueryError(response.error, response); return response },
        })
        return queries.cache.refresh(entry).then(result => {
          if (result.error) throw result.error
          if (!result.data) throw new DOMException('Shop request superseded', 'AbortError')
          return result.data
        }).catch(error => { const response = (error as { shopResponse?: Response }).shopResponse; if (response) return response; throw error })
          .finally(() => queries.cache.remove(entry))
      }
    } })
  }
  function wrapClient<T extends object>(raw: T): T {
    return new Proxy(raw, { get(target, property) {
      const value = Reflect.get(target, property)
      // Supabase alone owns credentials, session refresh and auth event subscriptions.
      if (property === 'auth') return value
      if ((property === 'functions' || property === 'storage') && value !== null && typeof value === 'object') return wrapService(value, String(property))
      if (typeof value !== 'function') return value
      if (property === 'schema') return (...args: unknown[]) => wrapClient(Reflect.apply(value, target, args))
      if (property === 'rpc') return (name: string, ...args: unknown[]) => {
        const action = (args[0] as { p_action?: string } | undefined)?.p_action
        const read = reads.has(name) || name === 'shop_catalog_media' && ['products', 'services', 'pos'].includes(action ?? '')
        return wrapBuilder(Reflect.apply(value, target, [name, ...args]), `rpc:${name}`, args, !read)
      }
      if (property === 'from') return (...args: unknown[]) => wrapBuilder(Reflect.apply(value, target, args), `table:${args[0]}`, [], false)
      return value.bind(target)
    } })
  }
  return wrapClient(client)
}
