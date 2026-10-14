import { useVerificationTimer } from '@building-suit/ux'
import { parseProrationQuote, prorationStorageKey } from '~/utils/proration-quote.mjs'
import type { ProrationQuote } from '~/utils/proration-quote.mjs'
import { checkoutAttempt, checkoutAttemptKey, checkoutFailureCode, isXPayOrderId } from '~/utils/xpay-checkout.mjs'
type Context = { generation: number; shop: string | null; user: string | undefined }
type Target = { selection: string; catalogTermsId: string | null; privateOffer: Record<string, string | number> | null }
export function useShopProrationCheckout(input: {
  context: () => Context; sameContext: (value: Context) => boolean; target: () => Target; locale: () => 'en' | 'ar'
  invoke: (body: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>
}) {
  const quote = shallowRef<ProrationQuote | null>(null)
  const deadline = useVerificationTimer()
  const expired = computed(() => !!quote.value && deadline.expired.value)
  function reset() { quote.value = null; deadline.reset() }
  function clear(context = input.context()) {
    reset()
    if (!import.meta.client || !context.user || !context.shop) return
    try { sessionStorage.removeItem(prorationStorageKey(context.user, context.shop)); sessionStorage.removeItem(checkoutAttemptKey(context.user, context.shop)) } catch { /* No authority in storage. */ }
  }
  function accept(value: unknown, context: Context) {
    const parsed = parseProrationQuote(value)
    if (parsed.shopId !== context.shop) throw new Error('invalid_quote_context')
    if (!input.sameContext(context)) return null
    quote.value = parsed
    deadline.restore(Date.parse(parsed.expiresAt), 0)
    try { if (context.user && context.shop) sessionStorage.setItem(prorationStorageKey(context.user, context.shop), parsed.quoteId) } catch { /* Server remains authoritative. */ }
    return parsed
  }
  async function command(action: string, context: Context, extra: Record<string, unknown>) {
    const result = await input.invoke({ action, shopId: context.shop, locale: input.locale(), ...extra })
    const failure = await checkoutFailureCode(result.data, result.error)
    if (failure) throw Object.assign(new Error('checkout_failed'), { checkoutCode: failure })
    if (result.error) throw new Error('checkout_failed')
    return accept(result.data, context)
  }
  async function prepare() {
    const context = input.context(), target = input.target()
    if (!context.user || !context.shop) throw new Error('invalid_quote_context')
    const requestId = checkoutAttempt(sessionStorage, checkoutAttemptKey(context.user, context.shop), target.selection, () => crypto.randomUUID())
    return command('quote', context, { requestId, catalogTermsId: target.catalogTermsId, privateOffer: target.privateOffer })
  }
  async function restore(orderQuoteId?: string) {
    const context = input.context()
    if (!context.user || !context.shop) return null
    let id = orderQuoteId
    try { id ||= sessionStorage.getItem(prorationStorageKey(context.user, context.shop)) ?? undefined } catch { /* No storage fallback authority. */ }
    if (!isXPayOrderId(id)) return null
    const parsed = await command('read_quote', context, { quoteId: id })
    if (parsed && ['settled', 'abandoned'].includes(parsed.state)) clear(context)
    return parsed
  }
  async function abandon() {
    if (!quote.value) return
    const context = input.context()
    const parsed = await command('abandon_quote', context, { quoteId: quote.value.quoteId })
    if (parsed?.state === 'abandoned') clear(context)
  }
  async function confirmCredit() {
    if (!quote.value || quote.value.calculation.amountDueMinor !== 0) throw new Error('payment_required')
    const context = input.context()
    const parsed = await command('apply_credit', context, { quoteId: quote.value.quoteId })
    if (parsed?.state === 'settled') clear(context)
    return parsed
  }
  return { quote, deadline, expired, reset, clear, prepare, restore, abandon, confirmCredit }
}
